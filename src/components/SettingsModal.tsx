import React from "react";
import { useLanguage } from "../contexts/LanguageContext";
import type { Language } from "../contexts/LanguageContext";

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
  const { lang, setLang, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-[700px] h-[540px] border border-white/10 rounded-xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: bgColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧导航 */}
        <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2 shrink-0">
          <div className="text-xs text-gray-500 font-semibold tracking-wider mb-4 px-2">
            SETTINGS
          </div>

          <button
            className="relative text-left px-4 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 bg-white/10"
            style={{ color: themeColor }}
          >
            <div
              className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md"
              style={{ backgroundColor: themeColor }}
            ></div>
            {lang === "zh" ? "外观与主题" : "Appearance"}
          </button>

          <button className="text-left px-4 py-2.5 text-gray-400 hover:bg-white/10 hover:text-gray-200 rounded-md text-sm transition-colors">
            {lang === "zh" ? "终端与字体" : "Terminal & Font"}
          </button>
          <button className="text-left px-4 py-2.5 text-gray-400 hover:bg-white/10 hover:text-gray-200 rounded-md text-sm transition-colors">
            {lang === "zh" ? "快捷键" : "Shortcuts"}
          </button>
        </div>

        {/* 👇 核心修改：加上 custom-scrollbar，并注入 CSS 变量 */}
        <div
          className="flex-1 p-8 relative overflow-y-auto custom-scrollbar"
          style={
            {
              // 把主题色加上 40 的十六进制透明度，作为滚动条滑块的颜色
              "--scrollbar-thumb": `${themeColor}66`,
            } as React.CSSProperties
          }
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-500 hover:text-white text-2xl transition-colors hover:rotate-90 duration-200"
          >
            &times;
          </button>

          <h2 className="text-xl font-bold text-gray-100 mb-6">
            {lang === "zh" ? "外观与主题" : "Appearance & Theme"}
          </h2>

          <div className="flex flex-col gap-4 pb-4">
            {/* 语言切换 */}
            <div className="flex items-center justify-between p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  {t("language")}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {lang === "zh"
                    ? "切换界面显示语言"
                    : "Switch interface language"}
                </div>
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Language)}
                className="bg-black/40 border border-white/10 text-gray-300 text-sm rounded-md px-3 py-1.5 outline-none cursor-pointer hover:border-white/30 transition-colors"
              >
                <option value="zh">中文 (Chinese)</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* 主题强调色 */}
            <div className="flex items-center justify-between p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  {t("themeColor")}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  更改光标和 UI 强调色
                </div>
              </div>
              <div
                className="relative w-9 h-9 rounded-md overflow-hidden cursor-pointer"
                style={{ boxShadow: `0 0 12px ${themeColor}40` }}
              >
                <input
                  type="color"
                  value={themeColor}
                  onChange={setThemeColor}
                  className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer bg-transparent border-none"
                />
              </div>
            </div>

            {/* 全局背景色 */}
            <div className="flex items-center justify-between p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  {t("bgColor")}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  更改终端底色
                </div>
              </div>
              <div className="relative w-9 h-9 rounded-md overflow-hidden cursor-pointer border border-white/10">
                <input
                  type="color"
                  value={bgColor}
                  onChange={setBgColor}
                  className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer bg-transparent border-none"
                />
              </div>
            </div>

            {/* 字体大小 */}
            <div className="flex items-center justify-between p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all">
              <div>
                <div className="text-sm font-semibold text-gray-200">
                  {t("fontSize")}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-5 text-right font-mono">
                  {fontSize}
                </span>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-28 cursor-pointer accent-[var(--accent-color)]"
                />
              </div>
            </div>

            {/* 实时预览 */}
            <div
              className="mt-2 p-4 rounded-lg border border-white/10 flex flex-col relative shadow-inner overflow-hidden"
              style={{ backgroundColor: bgColor }}
            >
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-60">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
              </div>
              <div className="text-[10px] text-gray-500 font-semibold tracking-wider mb-2 select-none">
                {t("preview")}
              </div>

              <div
                className="font-mono transition-all duration-200"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
              >
                <div>
                  <span style={{ color: themeColor }}>
                    PS C:\Users\lenovo&gt;
                  </span>
                  <span className="text-gray-200 ml-2">npm run dev</span>
                </div>
                <div className="text-gray-400 mt-1">
                  &gt; vite v8.3.5 ready in 287 ms
                </div>
                <div className="text-[#27c93f] mt-1">
                  ➜ Local: http://localhost:5173/
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span style={{ color: themeColor }}>
                    PS C:\Users\lenovo&gt;
                  </span>
                  <span
                    className="w-2 h-4 animate-pulse inline-block"
                    style={{ backgroundColor: themeColor }}
                  ></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
