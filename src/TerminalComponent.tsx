import { useEffect, useRef, useImperativeHandle, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface TerminalHandle {
  injectCommand: (cmd: string) => void;
}

interface TerminalProps {
  id: string;
  isActive: boolean;
  themeColor: string;
  bgColor: string;
  fontSize: number;
  onCommandExecuted?: (cmd: string) => void;
  ref?: React.Ref<TerminalHandle>;
}

const TerminalComponent = ({
  id,
  isActive,
  themeColor,
  bgColor,
  fontSize,
  onCommandExecuted,
  ref,
}: TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const [status, setStatus] = useState<
    "idle" | "running" | "streaming" | "error"
  >("idle");
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 暴露注入方法，使用 bracketed paste 防止直接执行
  useImperativeHandle(
    ref,
    () => ({
      injectCommand: (cmd: string) => {
        const term = termInstance.current;
        if (!term || !(window as any).__TAURI_INTERNALS__) return;

        const clean = cmd.replace(/[\r\n]+$/, "");
        const useBracketed = term.modes.bracketedPasteMode;
        const data = useBracketed ? `\x1b[200~${clean}\x1b[201~` : clean;

        invoke("pty_write", { id, data }).catch((err) => {
          console.error(err);
          setStatus("error");
        });
      },
    }),
    [id],
  );

  // 切换标签页时自动 fit 尺寸
  useEffect(() => {
    if (isActive && fitAddonRef.current && termInstance.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        invoke("pty_resize", {
          id,
          rows: termInstance.current!.rows,
          cols: termInstance.current!.cols,
        }).catch(console.error);
      }, 50);
    }
  }, [isActive, id]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: bgColor, foreground: "#ffffff", cursor: themeColor },
      fontFamily: "Consolas, monospace",
      fontSize: fontSize,
    });
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    term.focus();
    terminalRef.current.addEventListener("pointerdown", () => term.focus());

    // 👇 核心拦截：放行 Shift，拦截 Ctrl+K 和 Ctrl+Shift+A
    term.attachCustomKeyEventHandler((event) => {
      if (
        event.ctrlKey &&
        (event.key.toLowerCase() === "k" ||
          (event.shiftKey && event.key.toLowerCase() === "a"))
      ) {
        return false; // 阻止 xterm 输出控制字符
      }
      return true;
    });

    termInstance.current = term;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let currentInput = "";

    const initPty = async () => {
      if (!(window as any).__TAURI_INTERNALS__) {
        term.write(
          "\x1b[33m[浏览器模式] 请在桌面端运行以连接 PTY。\x1b[0m\r\n",
        );
        return;
      }

      try {
        unlisten = await listen<{ id: string; data: string }>(
          "pty-output",
          (event) => {
            if (!disposed && event.payload.id === id) {
              term.write(event.payload.data);

              setStatus((prev) => (prev === "idle" ? "streaming" : prev));
              if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
              streamTimerRef.current = setTimeout(() => setStatus("idle"), 500);
            }
          },
        );
        if (disposed) {
          unlisten();
          return;
        }

        await invoke("pty_start", { id });

        requestAnimationFrame(() => {
          fitAddon.fit();
          invoke("pty_resize", { id, rows: term.rows, cols: term.cols }).catch(
            console.error,
          );
        });
      } catch (err) {
        console.error("PTY 启动失败:", err);
        setStatus("error");
      }
    };

    initPty();

    term.onData((data) => {
      if ((window as any).__TAURI_INTERNALS__) {
        if (data === "\r") {
          setStatus("running");
          if (currentInput.trim() && onCommandExecuted) {
            onCommandExecuted(currentInput);
          }
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
      }
    });

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
          if ((window as any).__TAURI_INTERNALS__) {
            invoke("pty_resize", {
              id,
              rows: term.rows,
              cols: term.cols,
            }).catch(console.error);
          }
        } catch (e) {}
      }, 50);
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      disposed = true;
      if (unlisten) unlisten();
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
      if (streamTimerRef.current) clearTimeout(streamTimerRef.current);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (termInstance.current) {
      termInstance.current.options.theme = {
        background: bgColor,
        foreground: "#ffffff",
        cursor: themeColor,
      };
      termInstance.current.options.fontSize = fontSize;
    }
  }, [themeColor, bgColor, fontSize]);

  return (
    <div className="w-full h-full relative cursor-text">
      <div ref={terminalRef} className="w-full h-full p-2" />

      <div className="absolute bottom-4 right-6 flex items-center gap-2 pointer-events-none select-none">
        <div
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            status === "idle"
              ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]"
              : status === "running"
                ? "bg-yellow-500 animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                : status === "streaming"
                  ? "bg-blue-500 animate-pulse shadow-[0_0_12px_rgba(59,130,246,1)]"
                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          }`}
        ></div>
        <span className="text-[10px] text-gray-500 uppercase font-mono tracking-wider">
          {status === "idle"
            ? "Ready"
            : status === "running"
              ? "Running"
              : status === "streaming"
                ? "Streaming"
                : "Error"}
        </span>
      </div>
    </div>
  );
};

export default TerminalComponent;
