import React, { useState } from "react";
import SettingsMenu from "./SettingsMenu";
import SettingsModal from "./SettingsModal";

// 👇 完整的 Props 类型定义（之前漏掉的）
interface SidebarProps {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  writeCommandToTerminal: (cmd: string) => void;
  settingsProps: {
    themeColor: string;
    handleThemeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    bgColor: string;
    handleBgChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fontSize: number;
    setFontSize: (val: number) => void;
  };
}

export default function Sidebar({
  isSidebarOpen,
  sidebarWidth,
  isDragging,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  writeCommandToTerminal,
  settingsProps,
}: SidebarProps) {
  const snippets = [
    { id: 1, name: "查端口占用", cmd: "netstat -ano | findstr 8080" },
    { id: 2, name: "清理 Docker", cmd: "docker system prune -a" },
    { id: 3, name: "Git 拉取", cmd: "git pull origin main" },
  ];

  // 👇 新增状态管理：控制小菜单和大弹窗
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "preferences" | "api" | "about" | null
  >(null);

  return (
    <div
      className={`bg-black/20 flex flex-col relative ${
        isDragging ? "" : "transition-all duration-300 ease-in-out"
      } ${isSidebarOpen ? "border-r border-gray-700/50" : "border-r-0"}`}
      style={{ width: isSidebarOpen ? `${sidebarWidth}px` : "0px" }}
    >
      <div
        className={`p-4 flex flex-col gap-3 h-full w-full overflow-hidden ${
          isSidebarOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: isSidebarOpen ? `${sidebarWidth}px` : "100px" }}
      >
        <h2 className="font-bold text-sm tracking-widest mb-2 text-[var(--accent-color)]">
          SNIPPETS
        </h2>

        {/* Snippets 列表 */}
        {snippets.map((s) => (
          <div
            key={s.id}
            onClick={() => writeCommandToTerminal(s.cmd)}
            className="p-3 rounded-lg cursor-pointer transition-all duration-200 group border border-white/5 hover:border-[var(--accent-color)] active:scale-95"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          >
            <div className="text-sm font-semibold mb-1 text-gray-200 group-hover:text-[var(--accent-color)] transition-colors">
              {s.name}
            </div>
            <div className="text-xs text-gray-500 font-mono truncate group-hover:text-gray-400">
              {s.cmd}
            </div>
          </div>
        ))}

        {/* 👇 底部区域：菜单和齿轮 */}
        <div className="mt-auto pt-4 border-t border-gray-700/50 relative">
          {/* 小菜单 */}
          <SettingsMenu
            isOpen={isMenuOpen}
            onClose={() => setIsMenuOpen(false)}
            onOpenModal={(modal) => setActiveModal(modal)}
          />

          {/* 齿轮按钮 */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${
              isMenuOpen
                ? "bg-white/10 text-white"
                : "hover:bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-sm font-semibold">偏好设置</span>
          </button>
        </div>
      </div>

      {/* 👇 挂载大窗口 */}
      <SettingsModal
        isOpen={activeModal === "preferences"}
        onClose={() => setActiveModal(null)}
        themeColor={settingsProps.themeColor}
        setThemeColor={settingsProps.handleThemeChange}
        bgColor={settingsProps.bgColor}
        setBgColor={settingsProps.handleBgChange}
        fontSize={settingsProps.fontSize}
        setFontSize={settingsProps.setFontSize}
      />

      {/* API 弹窗（占位） */}
      {activeModal === "api" && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="bg-[#1e1e2e] p-8 rounded-lg border border-gray-700 shadow-2xl w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg text-white mb-4">API 管理</h2>
            <p className="text-gray-400 text-sm mb-4">
              这里以后用来填 DeepSeek API Key。
            </p>
            <button
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 拖拽层 */}
      <div
        className={`absolute top-0 right-0 w-2 h-full translate-x-1/2 cursor-col-resize z-50 flex items-center justify-center group ${
          isDragging
            ? "bg-[var(--accent-color)]/50"
            : "hover:bg-[var(--accent-color)]/30 transition-colors"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={`w-6 h-6 bg-[#252535] border border-gray-600 rounded-full flex items-center justify-center shadow-md pointer-events-none transition-transform ${
            isDragging
              ? "scale-110 text-[var(--accent-color)] border-[var(--accent-color)]"
              : "group-hover:text-[var(--accent-color)] group-hover:border-[var(--accent-color)]"
          }`}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-300 ${
              isSidebarOpen ? "" : "rotate-180"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
