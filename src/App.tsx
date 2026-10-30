import { useState, useEffect, useRef } from "react";
import TerminalComponent from "./TerminalComponent";
// 👇 核心修复：使用 import type，防止 Vite 擦除类型导致白屏
import type { TerminalHandle } from "./TerminalComponent";
import Sidebar from "./components/Sidebar";
import AiPanel from "./components/AiPanel";
import { useTheme } from "./hooks/useTheme";
import { useResizableSidebar } from "./hooks/useResizableSidebar";

function App() {
  const [isAiOpen, setIsAiOpen] = useState(false);

  // 👇 严格使用 TerminalHandle 类型
  const terminalRef = useRef<TerminalHandle>(null);

  const theme = useTheme();
  const sidebar = useResizableSidebar();

  // 监听快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setIsAiOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="flex h-screen w-screen text-gray-300 font-sans overflow-hidden select-none"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* 左侧边栏 */}
      <Sidebar
        isSidebarOpen={sidebar.isSidebarOpen}
        sidebarWidth={sidebar.sidebarWidth}
        isDragging={sidebar.isDragging}
        handlePointerDown={sidebar.handlePointerDown}
        handlePointerMove={sidebar.handlePointerMove}
        handlePointerUp={sidebar.handlePointerUp}
        // 👇 调用组件暴露的 runCommand
        writeCommandToTerminal={(cmd) => terminalRef.current?.runCommand(cmd)}
        settingsProps={{
          themeColor: theme.themeColor,
          bgColor: theme.bgColor,
          fontSize: theme.fontSize,
          setFontSize: theme.setFontSize,
          handleThemeChange: theme.handleThemeChange,
          handleBgChange: theme.handleBgChange,
        }}
      />

      {/* 中间终端 */}
      <div className="flex-1 bg-black/80 flex flex-col relative overflow-hidden">
        <TerminalComponent
          ref={terminalRef}
          themeColor={theme.themeColor}
          bgColor={theme.bgColor}
          fontSize={theme.fontSize}
        />
      </div>

      {/* 右侧 AI 面板 */}
      <AiPanel
        isAiOpen={isAiOpen}
        closeAi={() => setIsAiOpen(false)}
        themeColor={theme.themeColor}
      />
    </div>
  );
}

export default App;
