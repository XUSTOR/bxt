import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  BINDING_BY_ID,
  conflictingIds,
  hasModifier,
  isValidCombo,
  resolveBindings,
  type BindingId,
  type BindingLabelKey,
  type BindingOverrides,
  type GestureKey,
} from "../lib/keybindings";
import {
  getGestureKey,
  getKeybindingOverrides,
  saveGestureKey,
  saveKeybindingOverrides,
} from "../lib/settings";

/** 保存前的校验失败原因（文案在 UI 层翻译） */
export type BindingError = "modifier" | "conflict" | "unsupported";

interface KeybindingsValue {
  /** id → 生效组合键（null = 未绑定） */
  effective: Record<BindingId, string | null>;
  /** 同一个组合键被多个动作占用的名单 */
  conflicts: Map<string, BindingId[]>;
  /** 组合键命中了哪个动作（两个作用域都算） */
  match: (combo: string) => BindingId | null;
  /** 这个组合键是不是已经被某个动作占着（终端据此决定要不要放行给 shell） */
  isBound: (combo: string) => boolean;
  setBinding: (id: BindingId, combo: string | null) => void;
  resetBinding: (id: BindingId) => void;
  resetAll: () => void;
  /** 能不能存：不能存时返回原因 */
  checkBinding: (id: BindingId, combo: string) => BindingError | null;
  /** 这个组合键现在被谁占着（不含自己） */
  holders: (id: BindingId, combo: string) => BindingId[];
  /** 动作名对应的文案键名 */
  labelOf: (id: BindingId) => BindingLabelKey;
  gestureKey: GestureKey;
  setGestureKey: (key: GestureKey) => void;
  /** 录制中：告诉全局分发器闭嘴（按什么都不能触发动作） */
  beginCapture: () => void;
  endCapture: () => void;
  isCapturing: () => boolean;
}

const KeybindingsContext = createContext<KeybindingsValue | undefined>(
  undefined,
);

export function KeybindingsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<BindingOverrides>(
    getKeybindingOverrides,
  );
  const [gestureKey, setGestureKeyState] = useState<GestureKey>(getGestureKey);

  const resolved = useMemo(() => resolveBindings(overrides), [overrides]);

  // 改动即落盘。放在 effect 里而不是 setState 的回调里：
  // StrictMode 下 updater 会被调用两次，副作用写在那里会重复执行。
  useEffect(() => {
    saveKeybindingOverrides(overrides);
  }, [overrides]);

  useEffect(() => {
    saveGestureKey(gestureKey);
  }, [gestureKey]);

  const match = useCallback(
    (combo: string) => resolved.byCombo.get(combo) ?? null,
    [resolved],
  );

  const isBound = useCallback(
    (combo: string) => resolved.byCombo.has(combo),
    [resolved],
  );

  const setBinding = useCallback((id: BindingId, combo: string | null) => {
    setOverrides((prev) => ({ ...prev, [id]: combo }));
  }, []);

  const resetBinding = useCallback((id: BindingId) => {
    // 删掉偏差 = 回到注册表默认值
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setOverrides({}), []);

  const checkBinding = useCallback(
    (id: BindingId, combo: string): BindingError | null => {
      if (!isValidCombo(combo)) return "unsupported";
      if (!hasModifier(combo)) return "modifier";
      if (conflictingIds(overrides, id, combo).length > 0) return "conflict";
      return null;
    },
    [overrides],
  );

  const holders = useCallback(
    (id: BindingId, combo: string) => conflictingIds(overrides, id, combo),
    [overrides],
  );

  const labelOf = useCallback(
    (id: BindingId) => BINDING_BY_ID[id].labelKey as BindingLabelKey,
    [],
  );

  // 录制标志用 ref：分发器要在 keydown 里同步读到它，不能等一次 state 更新
  const capturing = useRef(false);
  const beginCapture = useCallback(() => {
    capturing.current = true;
  }, []);
  const endCapture = useCallback(() => {
    capturing.current = false;
  }, []);
  const isCapturing = useCallback(() => capturing.current, []);

  const value = useMemo<KeybindingsValue>(
    () => ({
      effective: resolved.effective,
      conflicts: resolved.conflicts,
      match,
      isBound,
      setBinding,
      resetBinding,
      resetAll,
      checkBinding,
      holders,
      labelOf,
      gestureKey,
      setGestureKey: setGestureKeyState,
      beginCapture,
      endCapture,
      isCapturing,
    }),
    [
      resolved,
      match,
      isBound,
      setBinding,
      resetBinding,
      resetAll,
      checkBinding,
      holders,
      labelOf,
      gestureKey,
      beginCapture,
      endCapture,
      isCapturing,
    ],
  );

  return (
    <KeybindingsContext.Provider value={value}>
      {children}
    </KeybindingsContext.Provider>
  );
}

// Provider 和 hook 放同一个文件是刻意为之：它们是同一份上下文的两个入口。
// 代价只是改这个文件时走整页刷新而非 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export function useKeybindings(): KeybindingsValue {
  const context = useContext(KeybindingsContext);
  if (!context) {
    throw new Error("useKeybindings must be used within KeybindingsProvider");
  }
  return context;
}
