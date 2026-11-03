import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../lib/env";

/** 默认主题色 */
export const DEFAULT_THEME_COLOR = "#22d3ee";
/**
 * 默认背景色。改这里必须同步 index.html（预启动脚本的兜底色）和 index.css 的 `--bg-main`，
 * 否则"没配过色的用户"启动时会看到两种颜色。
 */
export const DEFAULT_BG_COLOR = "#1e1e2e";

const KEY_THEME = "themeColor";
const KEY_BG = "bgColor";
const KEY_FONT = "termFontSize";
const DEFAULT_FONT = 14;

/**
 * 取色框的采样频率上限。
 *
 * 在原生取色器里拖动时，鼠标事件可能以 120Hz 甚至更高频地派发 input，
 * 每来一次就 setState 的话：整棵树重渲染 + xterm 重绘 + 落盘全跟着跑上百次。
 * 这里把它压到 60Hz（约 16.7ms 一次），画面仍然是跟手的。
 */
const COLOR_SAMPLE_HZ = 60;
const COLOR_SAMPLE_MS = 1000 / COLOR_SAMPLE_HZ;

/** 同步给 Rust 的那次 IPC 再防抖一下：拖色时不要每帧写一次配置文件 */
const BG_SYNC_DEBOUNCE_MS = 300;

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

/**
 * 把高频的颜色变化合并成 60Hz：一帧内来多少次都只提交一次，
 * 而且最后一次的值一定会落地（不会停在中间的某个颜色）。
 */
function useColorSampler(commit: (value: string) => void) {
  const latest = useRef<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (value: string) => {
      latest.current = value;
      if (timer.current !== null) return; // 这一帧已经排过了

      timer.current = window.setTimeout(() => {
        timer.current = null;
        const next = latest.current;
        latest.current = null;
        if (next !== null) commit(next);
      }, COLOR_SAMPLE_MS);
    },
    [commit],
  );
}

/** 主题色 / 背景色 / 字号：统一走 CSS 变量 + localStorage 持久化 */
export function useTheme() {
  const [themeColor, setThemeColor] = useState(() =>
    read(KEY_THEME, DEFAULT_THEME_COLOR),
  );
  const [bgColor, setBgColor] = useState(() => read(KEY_BG, DEFAULT_BG_COLOR));
  const [fontSize, setFontSize] = useState(readFontSize);

  // 取色框的高频输入在这里被压到 60Hz
  const pushThemeColor = useColorSampler(setThemeColor);
  const pushBgColor = useColorSampler(setBgColor);

  const handleThemeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => pushThemeColor(e.target.value),
    [pushThemeColor],
  );
  const handleBgChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => pushBgColor(e.target.value),
    [pushBgColor],
  );

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-color", themeColor);
    root.style.setProperty("--bg-main", bgColor);
    // body 那层也跟上，免得任何透明区域漏出上一次的颜色
    document.body.style.backgroundColor = bgColor;
    try {
      localStorage.setItem(KEY_THEME, themeColor);
      localStorage.setItem(KEY_BG, bgColor);
      localStorage.setItem(KEY_FONT, String(fontSize));
    } catch {
      // 隐私模式等场景写不进去，忽略
    }

    if (!isTauri()) return;

    // 窗口创建时 WebView 还没起来，Rust 读不到 localStorage，
    // 所以背景色要另外落一份到磁盘：下次启动在 WebView2 出首帧之前就贴上
    // （见 src-tauri/src/ui.rs）。首次启动没有这份文件，用的就是默认色。
    // 防抖：拖色时只写最后停下来的那个值，别每帧写一次配置文件。
    const timer = window.setTimeout(() => {
      void invoke("ui_set_bg_color", { color: bgColor }).catch((err) =>
        console.error("同步背景色失败:", err),
      );
    }, BG_SYNC_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [themeColor, bgColor, fontSize]);

  return {
    themeColor,
    bgColor,
    fontSize,
    setFontSize,
    handleThemeChange,
    handleBgChange,
  };
}
