/** 终端相关的前端偏好（存 localStorage，不进后端配置） */

import {
  DEFAULT_GESTURE_KEY,
  isGestureKey,
  type BindingId,
  type BindingOverrides,
  type GestureKey,
} from "./keybindings";

export const HIDE_BANNER_KEY = "terminal_hide_banner";

export function getHideBanner(): boolean {
  try {
    return localStorage.getItem(HIDE_BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHideBanner(value: boolean) {
  try {
    localStorage.setItem(HIDE_BANNER_KEY, value ? "1" : "0");
  } catch {
    // 忽略写入失败
  }
}

/** AI 面板宽度（拖拽分隔条时持久化） */
const AI_PANEL_WIDTH_KEY = "ai_panel_width";

export function getAiPanelWidth(fallback: number): number {
  try {
    const raw = Number(localStorage.getItem(AI_PANEL_WIDTH_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  } catch {
    return fallback;
  }
}

export function setAiPanelWidth(px: number) {
  try {
    localStorage.setItem(AI_PANEL_WIDTH_KEY, String(Math.round(px)));
  } catch {
    // 忽略写入失败
  }
}

/**
 * 隐私说明的确认标记。
 * 带版本号：隐私边界将来若有实质变化（比如开始收集遥测），把版本升到 v2，
 * 老用户会重新看到一次说明 —— 而不是被一句"你之前同意过"绑住。
 */
export const PRIVACY_ACK_KEY = "privacy_ack_v1";

export function hasAckedPrivacy(): boolean {
  try {
    return localStorage.getItem(PRIVACY_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function ackPrivacy() {
  try {
    localStorage.setItem(PRIVACY_ACK_KEY, "1");
  } catch {
    // 忽略写入失败
  }
}

/** 快捷键改动：只存"相对默认值的偏差"，没写过的动作自动吃注册表默认值 */
const KEYBINDINGS_KEY = "keybindings";

export function getKeybindingOverrides(): BindingOverrides {
  try {
    const raw = localStorage.getItem(KEYBINDINGS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    // 只收「字符串」和「null」，其余脏数据直接丢掉；
    // 值的合法性（语法、裸键）由 resolveBindings 再挡一层
    const out: BindingOverrides = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (value === null || typeof value === "string") {
        out[id as BindingId] = value as string | null;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveKeybindingOverrides(overrides: BindingOverrides) {
  try {
    localStorage.setItem(KEYBINDINGS_KEY, JSON.stringify(overrides));
  } catch {
    // 忽略写入失败
  }
}

/** 双击手势里"双击哪个键" */
const GESTURE_KEY = "gesture_double_tap_key";

export function getGestureKey(): GestureKey {
  try {
    const saved = localStorage.getItem(GESTURE_KEY);
    return isGestureKey(saved) ? saved : DEFAULT_GESTURE_KEY;
  } catch {
    return DEFAULT_GESTURE_KEY;
  }
}

export function saveGestureKey(key: GestureKey) {
  try {
    localStorage.setItem(GESTURE_KEY, key);
  } catch {
    // 忽略写入失败
  }
}
