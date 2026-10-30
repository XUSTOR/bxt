import React from "react";

interface SettingsPopoverProps {
  isSettingsOpen: boolean;
  isSidebarOpen: boolean;
  closeSettings: () => void;
  themeColor: string;
  bgColor: string;
  fontSize: number;
  setFontSize: (val: number) => void;
  handleThemeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBgChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SettingsPopover({
  isSettingsOpen,
  isSidebarOpen,
  closeSettings,
  themeColor,
  bgColor,
  fontSize,
  setFontSize,
  handleThemeChange,
  handleBgChange,
}: SettingsPopoverProps) {
  if (!isSettingsOpen || !isSidebarOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={closeSettings}></div>
      <div
        className="absolute bottom-16 left-4 w-64 bg-[#252535]/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl p-4 z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ boxShadow: `0 10px 40px -10px ${themeColor}40` }}
      >
        <div className="text-xs text-gray-500 font-semibold tracking-wider border-b border-gray-700/50 pb-2 flex justify-between items-center">
          <span>SETTINGS</span>
          <button onClick={closeSettings} className="hover:text-white">
            &times;
          </button>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>主题强调色</span>
          <input
            type="color"
            value={themeColor}
            onChange={handleThemeChange}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border-none"
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-300">
          <span>全局背景色</span>
          <input
            type="color"
            value={bgColor}
            onChange={handleBgChange}
            className="w-8 h-6 rounded cursor-pointer bg-transparent border-none"
          />
        </div>
        <div className="flex items-center justify-between text-sm text-gray-300 mt-2">
          <span>终端字体大小</span>
          <input
            type="range"
            min="10"
            max="24"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-20 accent-[var(--accent-color)]"
          />
        </div>
      </div>
    </>
  );
}
