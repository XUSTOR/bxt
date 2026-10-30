import { useEffect, useRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface TerminalHandle {
  runCommand: (cmd: string) => void;
}

interface TerminalProps {
  themeColor: string;
  bgColor: string;
  fontSize: number;
  ref?: React.Ref<TerminalHandle>;
}

const TerminalComponent = ({
  themeColor,
  bgColor,
  fontSize,
  ref,
}: TerminalProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      runCommand: (cmd: string) => {
        if ((window as any).__TAURI_INTERNALS__) {
          invoke("pty_write", { data: cmd + "\r" });
        }
      },
    }),
    [],
  );

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: { background: bgColor, foreground: "#ffffff", cursor: themeColor },
      fontFamily: "Consolas, monospace",
      fontSize: fontSize,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // 自动获取焦点，点击任意位置也能获取焦点
    term.focus();
    terminalRef.current.addEventListener("pointerdown", () => term.focus());

    termInstance.current = term;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const initPty = async () => {
      if (!(window as any).__TAURI_INTERNALS__) {
        term.write(
          "\x1b[33m[浏览器模式] 请在桌面端运行以连接 PTY。\x1b[0m\r\n",
        );
        return;
      }

      // 1. 先注册监听
      unlisten = await listen<string>("pty-output", (event) => {
        if (!disposed) term.write(event.payload);
      });
      if (disposed) {
        unlisten();
        return;
      }

      // 2. 再启动 PTY
      await invoke("pty_start");

      // 3. 初始尺寸同步
      requestAnimationFrame(() => {
        fitAddon.fit();
        invoke("pty_resize", { rows: term.rows, cols: term.cols }).catch(
          console.error,
        );
      });
    };

    initPty();

    // 键盘输入发送给 PTY
    term.onData((data) => {
      if ((window as any).__TAURI_INTERNALS__) {
        invoke("pty_write", { data }).catch(console.error);
      }
    });

    // 窗口大小变化同步
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
          if ((window as any).__TAURI_INTERNALS__) {
            invoke("pty_resize", { rows: term.rows, cols: term.cols }).catch(
              console.error,
            );
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
      term.dispose();
    };
  }, []);

  // 颜色和字号响应
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

  return <div ref={terminalRef} className="w-full h-full p-2" />;
};

export default TerminalComponent;
