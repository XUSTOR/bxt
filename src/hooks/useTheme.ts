import { useState, useEffect } from "react";

const KEY_THEME = "themeColor";
const KEY_BG = "bgColor";
const KEY_FONT = "termFontSize";
const DEFAULT_FONT = 14;

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readFontSize(): number {
  const value = Number(read(KEY_FONT, String(DEFAULT_FONT)));
  return Number.isFinite(value) && value >= 10 && value <= 24
    ? value
    : DEFAULT_FONT;
}

/** 主题色 / 背景色 / 字号：统一走 CSS 变量 + localStorage 持久化 */
export function useTheme() {
  const [themeColor, setThemeColor] = useState(() =>
    read(KEY_THEME, "#22d3ee"),
  );
  const [bgColor, setBgColor] = useState(() => read(KEY_BG, "#1e1e2e"));
  const [fontSize, setFontSize] = useState(readFontSize);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-color", themeColor);
    root.style.setProperty("--bg-main", bgColor);
    try {
      localStorage.setItem(KEY_THEME, themeColor);
      localStorage.setItem(KEY_BG, bgColor);
      localStorage.setItem(KEY_FONT, String(fontSize));
    } catch {
      // 隐私模式等场景写不进去，忽略
    }
  }, [themeColor, bgColor, fontSize]);

  return {
    themeColor,
    bgColor,
    fontSize,
    setFontSize,
    handleThemeChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setThemeColor(e.target.value),
    handleBgChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setBgColor(e.target.value),
  };
}
