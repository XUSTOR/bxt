import React from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  setThemeColor: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgColor: string;
  setBgColor: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  themeColor,
  setThemeColor,
  bgColor,
  setBgColor,
  fontSize,
  setFontSize,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* 👇 整体尺寸缩小：从 800x520 缩减到 700x460 */}
      <div
        className="w-[700px] h-[460px] bg-[#1e1e2e] border border-gray-700 rounded-xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200"
        style={{ boxShadow: `0 10px 50px -10px ${themeColor}40` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧导航：宽度从 w-48 缩到 w-40，间距收紧 */}
        <div className="w-40 bg-black/30 border-r border-gray-700/50 p-3 flex flex-col gap-1 shrink-0">
          <div className="text-xs text-gray-500 font-semibold tracking-wider mb-3 px-2">
            SETTINGS
          </div>
          <button className="text-left px-3 py-1.5 bg-white/5 text-[var(--accent-color)] rounded-md text-sm font-semibold">
            外观与主题
          </button>
          <button className="text-left px-3 py-1.5 text-gray-400 hover:bg-white/5 hover:text-gray-200 rounded-md text-sm transition-colors">
            终端与字体
          </button>
          <button className="text-left px-3 py-1.5 text-gray-400 hover:bg-white/5 hover:text-gray-200 rounded-md text-sm transition-colors">
            快捷键
          </button>
        </div>

        {/* 右侧内容：内边距从 p-8 缩到 p-6 */}
        <div className="flex-1 p-6 relative overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white text-xl transition-colors"
          >
            &times;
          </button>
          {/* 标题字号从 text-2xl 缩到 text-xl */}
          <h2 className="text-xl font-bold text-gray-100 mb-5">外观与主题</h2>

          {/* 👇 列表间距从 gap-5 缩到 gap-3 */}
          <div className="flex flex-col gap-3">
            {/* 主题色 */}
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  主题强调色
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  更改光标的颜色和 UI 强调色
                </div>
              </div>
              {/* 色块从 40x40 缩到 32x32 */}
              <input
                type="color"
                value={themeColor}
                onChange={setThemeColor}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
              />
            </div>

            {/* 背景色 */}
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  全局背景色
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  更改终端背景颜色
                </div>
              </div>
              <input
                type="color"
                value={bgColor}
                onChange={setBgColor}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
              />
            </div>

            {/* 字体大小 */}
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  字体大小
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  调整终端代码字号 (10px - 24px)
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-5 text-right font-mono">
                  {fontSize}
                </span>
                {/* 滑块稍微缩短 */}
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-28 accent-[var(--accent-color)]"
                />
              </div>
            </div>

            {/* 👇 实时预览区域：高度和内边距也相应收紧 */}
            <div
              className="mt-1 p-3 rounded-lg border border-gray-700/50 flex flex-col relative shadow-inner overflow-hidden transition-colors duration-200"
              style={{ backgroundColor: bgColor }}
            >
              <div className="absolute top-2.5 right-2.5 flex gap-1.5 opacity-50">
                <div className="w-2 h-2 rounded-full bg-[#ff5f56]"></div>
                <div className="w-2 h-2 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-2 h-2 rounded-full bg-[#27c93f]"></div>
              </div>

              <div className="text-[10px] text-gray-500 font-semibold tracking-wider mb-1 select-none">
                PREVIEW
              </div>

              <div
                className="font-mono transition-all duration-200"
                style={{
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.4,
                }}
              >
                <div>
                  <span style={{ color: themeColor }}>
                    PS C:\Users\lenovo&gt;
                  </span>
                  <span className="text-gray-200 ml-2">npm run dev</span>
                </div>
                <div className="text-gray-400 mt-0.5">
                  &gt; vite v8.3.5 ready in 287 ms
                </div>
                <div className="text-[#27c93f] mt-0.5">
                  ➜ Local: http://localhost:5173/
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span style={{ color: themeColor }}>
                    PS C:\Users\lenovo&gt;
                  </span>
                  <span className="w-1.5 h-3.5 bg-gray-400 animate-pulse inline-block"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
