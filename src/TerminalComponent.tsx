import { useEffect, useRef, useImperativeHandle, useState } from "react";
import { Terminal } from "@xterm/xterm";
import type { IMarker } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useLanguage } from "./contexts/LanguageContext";
import { getHideBanner } from "./lib/settings";
import { isTauri } from "./lib/env";
// 提示符正则、单轮上限、轮次切片：与测试共用同一份实现
import {
  PROMPT_LINE_RE,
  ROUND_MAX_LINES,
  sliceRound,
  stripPrompt,
} from "./lib/round";

export interface TerminalHandle {
  injectCommand: (cmd: string) => void;
}

/** 一轮 = 用户提交一条命令 + 它的全部输出（提示符回来即结束） */
export interface TerminalRound {
  id: string;
  index: number;
  command: string;
  /** 已去掉 ANSI、\r 覆盖行和提示符行的纯文本 */
  output: string;
  truncated: boolean;
}

interface TerminalProps {
  id: string;
  isActive: boolean;
  themeColor: string;
  bgColor: string;
  fontSize: number;
  onCommandExecuted?: (cmd: string) => void;
  onRoundComplete?: (round: TerminalRound) => void;
  ref?: React.Ref<TerminalHandle>;
}

// 状态灯文案 → 翻译键
const STATUS_KEYS = {
  idle: "statusReady",
  running: "statusRunning",
  error: "statusError",
} as const;

// 终端底部永久预留的空白高度（像素）。
// 按像素而不是行数：行高随字号变（14px 字号约 17px 一行），
// 底部浮着齿轮（40px + 16px 偏移）和提示文字，总共要让开约 90px。
const BOTTOM_RESERVE_PX = 96;

/**
 * 从终端行缓冲里取出这一帧的窗口文本。
 * marker 还有效就从命令行那一行开始；被滚出缓冲区（超长输出）就退化成"取末尾若干行"。
 * 真正的切片逻辑在 lib/round.ts 里（纯函数，可单测）。
 */
function readBufferLines(term: Terminal, marker: IMarker | null) {
  const buf = term.buffer.active;
  const end = buf.baseY + buf.cursorY; // 光标行（也就是提示符所在行）
  const markerValid = !!marker && !marker.isDisposed && marker.line >= 0;
  // 标记有效 → 窗口第一条就是命令行；否则窗口是"末尾若干行"的兜底
  const start = markerValid
    ? marker!.line
    : Math.max(0, end - ROUND_MAX_LINES);

  const lines: string[] = [];
  for (let y = start; y <= end; y++) {
    const line = buf.getLine(y);
    lines.push(line ? line.translateToString(true) : "");
  }
  return { lines, markerValid };
}

const TerminalComponent = ({
  id,
  isActive,
  themeColor,
  bgColor,
  fontSize,
  onCommandExecuted,
  onRoundComplete,
  ref,
}: TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");

  const { t } = useLanguage();
  // 初始化 effect 只跑一次，用 ref 保证它在里面拿到的是"当前语言"的文案
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // 注入命令：用 bracketed paste 包装，只填入不执行
  useImperativeHandle(
    ref,
    () => ({
      injectCommand: (cmd: string) => {
        const term = termInstance.current;
        if (!term || !isTauri()) return;

        const clean = cmd.replace(/[\r\n]+$/, "");
        const data = term.modes.bracketedPasteMode
          ? `\x1b[200~${clean}\x1b[201~`
          : clean;

        invoke("pty_write", { id, data }).catch((err) => {
          console.error(err);
          setStatus("error");
        });
      },
    }),
    [id],
  );

  // 尺寸同步：表格类输出由 shell 按它以为的宽度排版，
  // 所以执行命令前、回到提示符后都强制对齐一次，避免按旧宽度排版。
  const syncSizeRef = useRef<() => void>(() => {});
  const fitAndSyncRef = useRef<() => void>(() => {});

  // 切回这个标签时重新 fit（隐藏期间容器尺寸可能变过）
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => fitAndSyncRef.current(), 50);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    const host = terminalRef.current;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: bgColor, foreground: "#ffffff", cursor: themeColor },
      fontFamily: "Consolas, monospace",
      fontSize,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(host);

    term.focus();
    // 点终端任意位置（包括底部的空白区）都回到最底部并聚焦，
    // 光标直接落在等待输入的那一行，不用自己去滚回来找。
    host.addEventListener("pointerdown", () => {
      term.scrollToBottom();
      term.focus();
    });

    // ============ 终端内快捷键 ============
    // 除了应用级快捷键和"复制"，其余组合键一律原样交给 shell：
    // Ctrl+C(\x03) / Ctrl+D(\x04) / Ctrl+Z(\x1a) / Ctrl+L(\x0c) / Ctrl+A(\x01)
    // / Ctrl+E(\x05) / Ctrl+U(\x15) / Ctrl+R(\x12) / Ctrl+W(\x17) 全部走 xterm 默认行为
    const copySelection = async () => {
      const text = term.getSelection();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        term.clearSelection();
      } catch (err) {
        console.error("复制失败:", err);
      }
    };

    // 右键：有选中就复制，没有就粘贴（同时拦掉 WebView2 默认菜单）。
    // 想在终端里开 DevTools 用 F12，或在终端以外区域右键。
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      if (term.getSelection()) {
        void copySelection();
        return;
      }
      if (!isTauri()) return;

      // 前端没有 clipboard-read 权限，交给 Rust 读系统剪贴板
      invoke<string>("clipboard_read_text")
        .then((text) => {
          // term.paste 会按 bracketed paste 包装并走 onData → PTY，不会自动执行
          if (text) term.paste(text);
        })
        .catch((err) => console.error("粘贴失败:", err));
    };
    host.addEventListener("contextmenu", handleContextMenu);

    term.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;

      const key = event.key.toLowerCase();

      // 1. 应用级快捷键让路：Ctrl+Shift+P（命令面板）、Ctrl+Shift+A（AI 面板）
      //    Ctrl+K 已还给 shell —— PSReadLine 的"删除到行尾"恢复可用
      if (event.ctrlKey && event.shiftKey && (key === "p" || key === "a")) {
        return false;
      }
      if (!event.ctrlKey) return true;

      // 2. Ctrl+Shift+C：永远当"复制"，不发给 shell
      if (event.shiftKey && key === "c") {
        event.preventDefault();
        void copySelection();
        return false;
      }

      // 3. Ctrl+C：有选中文本就复制；没有就交给 xterm 发 \x03 中断前台进程
      if (key === "c" && term.hasSelection()) {
        event.preventDefault();
        void copySelection();
        return false;
      }

      // 4. Ctrl+V / Shift+Insert 不拦：浏览器派发原生 paste 事件，xterm 自己写入 PTY
      return true;
    });

    termInstance.current = term;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let currentInput = "";
    let inFlight = false; // 是否有命令正在执行（回车提交 → 提示符返回）

    // ---- 轮次采集 ----
    // 不用"数据流分片累积"，而是回车时给光标行打一个 marker，
    // 结束时直接读行缓冲：拿到的就是屏幕上真实的文本（ANSI、\r 进度条都已由 xterm 解析完）
    let openRound: {
      command: string;
      marker: IMarker | null;
      startedAt: number;
    } | null = null;
    let roundSeq = 0;

    // 读光标所在行并去掉提示符，就是用户实际输入的命令。
    // 比逐字符拼 currentInput 可靠：粘贴、注入、输入法都能正确覆盖。
    const readCurrentCommand = () => {
      const buf = term.buffer.active;
      const line = buf.getLine(buf.baseY + buf.cursorY);
      return stripPrompt(line ? line.translateToString(true) : "");
    };

    // 光标是否已经离开命令行（marker 被回收说明那几行早滚出缓冲区，等于确实跑过东西）
    const roundHasNewLines = (r: { marker: IMarker | null }) => {
      if (!r.marker) return true;
      if (r.marker.isDisposed || r.marker.line < 0) return true;
      const buf = term.buffer.active;
      return buf.baseY + buf.cursorY > r.marker.line;
    };

    // 命令是否已结束：看光标那一行是不是提示符。
    // 比匹配"最近 N 字符的输出尾巴"可靠 —— 长输出滚动后尾巴很容易和提示符错位。
    const cursorLineIsPrompt = () => {
      const buf = term.buffer.active;
      const line = buf.getLine(buf.baseY + buf.cursorY);
      if (!line) return false;
      return PROMPT_LINE_RE.test(line.translateToString(true));
    };

    const closeRound = () => {
      if (!openRound) return;
      const r = openRound;
      openRound = null;

      const { lines, markerValid } = readBufferLines(term, r.marker);
      // 标记有效 → 命令行就是窗口第 0 条；失效 → 用回车时抓到的命令名兜底
      const slice = sliceRound(lines, markerValid ? 0 : null);
      const command = slice.command || r.command;

      r.marker?.dispose();

      // 空回车（既没命令也没输出）不记一轮
      if (!command.trim() && !slice.output.trim()) return;

      roundSeq += 1;
      onRoundComplete?.({
        id: `${id}-${r.startedAt}-${roundSeq}`,
        index: roundSeq,
        command,
        output: slice.output,
        truncated: slice.truncated,
      });
    };

    // 结束判定：光标已离开命令行 + 光标行是提示符。
    // 不设时间门槛 —— 快速命令几十毫秒就跑完，加了门槛就再也等不到第二次触发。
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const tryCloseRound = () => {
      if (!inFlight || !openRound) return;
      if (!roundHasNewLines(openRound)) return;
      if (!cursorLineIsPrompt()) return;
      inFlight = false;
      setStatus("idle");
      closeRound();
      syncSizeRef.current();
    };

    // 把当前 xterm 的行列数告诉 PTY（表格类输出靠它决定列宽）
    const syncSize = () => {
      if (!isTauri()) return;
      invoke("pty_resize", { id, rows: term.rows, cols: term.cols }).catch(
        console.error,
      );
    };
    syncSizeRef.current = syncSize;

    // fit 之后再砍掉底部若干行：网格变矮，多出来的空白就留在容器底部。
    // 行数按实际行高换算，保证任何字号下都让开固定像素的高度。
    const fitAndSync = () => {
      fitAddon.fit();

      const el = term.element;
      const boxHeight = el ? el.getBoundingClientRect().height : 0;
      const cellHeight =
        term.rows > 0 && boxHeight > 0 ? boxHeight / term.rows : 18;
      const reserveRows = Math.max(1, Math.ceil(BOTTOM_RESERVE_PX / cellHeight));
      // 窗口很矮时不要把终端砍没了
      const maxReserve = Math.max(1, Math.floor(term.rows * 0.3));
      const cut = Math.min(reserveRows, maxReserve);

      if (term.rows > cut + 4) {
        term.resize(term.cols, term.rows - cut);
      }
      syncSize();
    };
    fitAndSyncRef.current = fitAndSync;

    const initPty = async () => {
      if (!isTauri()) {
        term.write(`\x1b[33m${tRef.current("browserModeNotice")}\x1b[0m\r\n`);
        return;
      }

      try {
        unlisten = await listen<{ id: string; data: string }>(
          "pty-output",
          (event) => {
            if (disposed || event.payload.id !== id) return;
            term.write(event.payload.data);

            // 有命令在跑时，每次输出后都尝试收尾
            if (!inFlight) return;
            tryCloseRound();
            // 兜底：提示符可能还没画进缓冲区，150ms 后再检查一次
            if (inFlight) {
              clearTimeout(settleTimer);
              settleTimer = setTimeout(tryCloseRound, 150);
            }
          },
        );
        if (disposed) {
          unlisten();
          return;
        }

        await invoke("pty_start", { id, noBanner: getHideBanner() });

        requestAnimationFrame(() => fitAndSync());
      } catch (err) {
        console.error("PTY 启动失败:", err);
        setStatus("error");
      }
    };

    initPty();

    term.onData((data) => {
      if (!isTauri()) return;

      if (data === "\r") {
        inFlight = true;
        setStatus("running");

        // 执行前把 PTY 宽度和当前显示对齐，保证这次输出按正确宽度排版
        syncSizeRef.current();
        // 上一轮如果还没闭合（提示符没认出来），先收尾，绝不静默丢弃
        closeRound();

        // 命令优先从缓冲区读，读不到再退回按键累积
        const command = readCurrentCommand() || currentInput;
        openRound = {
          command,
          // 锚定命令所在行，结束后从这里往下读屏幕内容
          marker: term.registerMarker(0),
          startedAt: Date.now(),
        };

        if (command.trim()) onCommandExecuted?.(command);
        currentInput = "";
      } else if (data === "\x7F") {
        currentInput = currentInput.slice(0, -1);
      } else if (data >= " ") {
        currentInput += data;
      }

      invoke("pty_write", { id, data }).catch((err) => {
        console.error(err);
        setStatus("error");
      });
    });

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          fitAndSync();
        } catch (err) {
          console.error(err);
        }
      }, 50);
    });
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      unlisten?.();
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
      clearTimeout(settleTimer);
      host.removeEventListener("contextmenu", handleContextMenu);
      openRound?.marker?.dispose();
      term.dispose();
    };
    // 只在 id 变化时重建终端，其余 props 由第二个 effect 单独同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 主题 / 字号变化：直接改 xterm 选项，不重建终端
  useEffect(() => {
    if (!termInstance.current) return;
    termInstance.current.options.theme = {
      background: bgColor,
      foreground: "#ffffff",
      cursor: themeColor,
    };
    termInstance.current.options.fontSize = fontSize;
  }, [themeColor, bgColor, fontSize]);

  return (
    <div
      className="w-full h-full relative cursor-text"
      // 底部预留的空白行跟终端同色，否则会看到一条色带
      style={{ backgroundColor: bgColor }}
    >
      <div ref={terminalRef} className="w-full h-full p-2" />

      <div className="absolute bottom-4 right-6 flex items-center gap-2 pointer-events-none select-none">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            status === "idle"
              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
              : status === "running"
                ? "bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          }`}
        ></div>
        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">
          {t(STATUS_KEYS[status])}
        </span>
      </div>
    </div>
  );
};

export default TerminalComponent;
