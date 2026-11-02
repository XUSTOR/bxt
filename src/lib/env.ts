declare global {
  interface Window {
    /** Tauri 注入的 IPC 入口；纯浏览器里不存在 */
    __TAURI_INTERNALS__?: unknown;
  }
}

/** 是否运行在 Tauri 桌面端（浏览器预览时为 false） */
export function isTauri(): boolean {
  return window.__TAURI_INTERNALS__ != null;
}
