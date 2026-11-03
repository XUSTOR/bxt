/**
 * 快捷键注册表 + 组合键解析。
 *
 * 纯函数、不碰 DOM / React，所以能单测（见 keybindings.test.ts）。
 *
 * 三条约定：
 * 1. 唯一真相 —— 所有可绑定的动作都写在 `BINDINGS` 里，默认值也在那里。
 *    别处（App / 终端）只查这张表，不许再散落硬编码的键名。
 * 2. 取键用 `e.code`（物理键位）—— 不受输入法、键盘布局、Shift 改字符影响，
 *    `Shift+1` 永远还是 `Shift+1`，不会变成 `Shift+!`。
 * 3. localStorage 里只存"相对默认值的偏差"，没写过的动作自动吃默认值；
 *    以后我调默认键，老用户也能跟着变。
 */

export type BindingScope = "app" | "terminal";

export interface BindingDef {
  id: string;
  scope: BindingScope;
  /** 文案键名，对应 LanguageContext 里的条目 */
  labelKey: string;
  /** null = 默认未绑定，用户在设置里自己绑 */
  default: string | null;
}

/**
 * 默认值只有三个 —— 也就是这次改造之前被写死在代码里的那些。
 * 其余动作一律未绑定（用户想用自己绑）。
 */
export const BINDINGS = [
  {
    id: "palette.open",
    scope: "app",
    labelKey: "kbPaletteOpen",
    default: "Ctrl+Shift+P",
  },
  {
    id: "ai.toggle",
    scope: "app",
    labelKey: "kbAiToggle",
    default: "Ctrl+Shift+A",
  },
  {
    id: "settings.open",
    scope: "app",
    labelKey: "kbSettingsOpen",
    default: null,
  },
  { id: "tab.new", scope: "app", labelKey: "kbTabNew", default: null },
  { id: "tab.close", scope: "app", labelKey: "kbTabClose", default: null },
  { id: "tab.next", scope: "app", labelKey: "kbTabNext", default: null },
  { id: "tab.prev", scope: "app", labelKey: "kbTabPrev", default: null },
  {
    id: "terminal.focus",
    scope: "app",
    labelKey: "kbTerminalFocus",
    default: null,
  },
  // 终端作用域：只在终端有焦点时生效，由 TerminalComponent 自己处理
  {
    id: "terminal.copy",
    scope: "terminal",
    labelKey: "kbTerminalCopy",
    default: "Ctrl+Shift+C",
  },
] as const satisfies readonly BindingDef[];

export type BindingId = (typeof BINDINGS)[number]["id"];

/** 所有动作的文案键名并集（设置页要把它喂给 t()） */
export type BindingLabelKey = (typeof BINDINGS)[number]["labelKey"];

export const BINDING_BY_ID = Object.fromEntries(
  BINDINGS.map((def) => [def.id, def]),
) as Record<BindingId, BindingDef>;

/** 设置页按作用域分组展示用 */
export const APP_BINDINGS = BINDINGS.filter((def) => def.scope === "app");
export const TERMINAL_BINDINGS = BINDINGS.filter(
  (def) => def.scope === "terminal",
);

/** 应用级动作由 App 的分发器执行；终端级的由终端自己执行（它才知道有没有选中） */
export function isAppScope(id: BindingId): boolean {
  return BINDING_BY_ID[id].scope === "app";
}

/** 用户改动（只存偏差）：null = 明确解绑 */
export type BindingOverrides = Partial<Record<BindingId, string | null>>;

// ---------------------------------------------------------------- 组合键

const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"] as const;
export type Modifier = (typeof MODIFIERS)[number];

/** 单独按下这些键不算一个组合键（录制时要忽略） */
const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "ShiftLeft",
  "ShiftRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
]);

/** `e.code` → 组合键里用的键名。数字键在这里已经和符号分开，不会混淆 */
const CODE_NAMES: Record<string, string> = {
  Space: "Space",
  Enter: "Enter",
  Tab: "Tab",
  Escape: "Esc",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

/** 键名反查表：校验用 */
const KEY_NAMES = new Set<string>([
  ...Object.values(CODE_NAMES),
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `Num${i}`),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  ..."0123456789".split(""),
]);

/** `e.code` → 键名；不认识的键（比如某些多媒体键）返回 null */
export function keyNameOf(code: string): string | null {
  if (!code) return null;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `Num${code.slice(6)}`;
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_NAMES[code] ?? null;
}

/** 只取用到的字段，测试里可以直接造对象 */
export interface KeyLike {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * 键盘事件 → 规范组合键字符串（`"Ctrl+Shift+P"`）。
 * 返回 null = 只按了修饰键 / 这个物理键不认识。
 * 注意：没有任何修饰键时也会返回 `"P"` 这样的裸键，
 * 由 isValidCombo 决定能不能存（默认禁止）。
 */
export function eventToCombo(e: KeyLike): string | null {
  if (MODIFIER_CODES.has(e.code)) return null;
  const key = keyNameOf(e.code);
  if (!key) return null;

  const mods: Modifier[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  if (e.metaKey) mods.push("Meta");

  return [...mods, key].join("+");
}

export interface ParsedCombo {
  mods: Modifier[];
  key: string;
}

/**
 * 反向解析。修饰键必须按 `Ctrl → Alt → Shift → Meta` 的固定顺序出现，
 * 这样同一个组合只会有一种写法，比较时直接比字符串就行。
 */
export function parseCombo(combo: string): ParsedCombo | null {
  if (!combo) return null;
  const parts = combo.split("+");
  const key = parts.pop();
  if (!key) return null;

  const mods: Modifier[] = [];
  for (const part of parts) {
    if (!MODIFIERS.includes(part as Modifier)) return null;
    if (mods.includes(part as Modifier)) return null;
    mods.push(part as Modifier);
  }
  const canonical = MODIFIERS.filter((m) => mods.includes(m));
  if (canonical.join("+") !== mods.join("+")) return null;

  return { mods, key };
}

/** 合法 = 能解析 + 键名认识 + （默认）至少一个修饰键 */
export function isValidCombo(combo: string): boolean {
  const parsed = parseCombo(combo);
  return !!parsed && KEY_NAMES.has(parsed.key);
}

export function hasModifier(combo: string): boolean {
  return (parseCombo(combo)?.mods.length ?? 0) > 0;
}

/**
 * 能不能真的拿去绑定：语法合法 + 至少一个修饰键。
 * 裸键（`"P"`、`"Tab"`）一律不许 —— 否则打字就被吃掉了。
 */
export function isBindableCombo(combo: string): boolean {
  return isValidCombo(combo) && hasModifier(combo);
}

const KEY_GLYPHS: Record<string, string> = {
  Up: "↑",
  Down: "↓",
  Left: "←",
  Right: "→",
  Esc: "Esc",
  Space: "Space",
};

/** 给人看的写法 */
export function formatCombo(combo: string): string {
  const parsed = parseCombo(combo);
  if (!parsed) return combo;
  const key = KEY_GLYPHS[parsed.key] ?? parsed.key;
  return [...parsed.mods, key].join(" + ");
}

/**
 * 会被终端里跑的程序用到的键：绑到它们上面不是不行，但会在终端里被抢走，
 * 设置页要提示一下。
 */
const SHELL_KEYS = new Set([
  "Ctrl+C",
  "Ctrl+D",
  "Ctrl+L",
  "Ctrl+R",
  "Ctrl+Z",
  "Ctrl+K",
  "Ctrl+W",
  "Ctrl+A",
  "Ctrl+E",
  "Ctrl+U",
  "Ctrl+V",
  "Tab",
]);

export function isShellKey(combo: string): boolean {
  return SHELL_KEYS.has(combo);
}

// ---------------------------------------------------------------- 生效值

export interface ResolvedBindings {
  /** id → 生效组合键（null = 未绑定） */
  effective: Record<BindingId, string | null>;
  /** combo → id（冲突时按注册表顺序取第一个） */
  byCombo: Map<string, BindingId>;
  /** 同一个 combo 被多个动作占用 */
  conflicts: Map<string, BindingId[]>;
}

/** 合并默认值和用户改动，顺便挡掉 localStorage 里被手改坏的值 */
export function resolveBindings(
  overrides: BindingOverrides = {},
): ResolvedBindings {
  const effective = {} as Record<BindingId, string | null>;
  const byCombo = new Map<string, BindingId>();
  const grouped = new Map<string, BindingId[]>();

  for (const def of BINDINGS) {
    const stored = Object.prototype.hasOwnProperty.call(overrides, def.id)
      ? overrides[def.id as BindingId]
      : def.default;
    const combo = stored && isBindableCombo(stored) ? stored : null;
    effective[def.id] = combo;
    if (!combo) continue;

    if (!byCombo.has(combo)) byCombo.set(combo, def.id);
    const list = grouped.get(combo) ?? [];
    list.push(def.id);
    grouped.set(combo, list);
  }

  const conflicts = new Map<string, BindingId[]>();
  for (const [combo, ids] of grouped) {
    if (ids.length > 1) conflicts.set(combo, ids);
  }

  return { effective, byCombo, conflicts };
}

/** 某个组合键还能不能给 `id` 用；能用返回 null，否则返回占用的动作 */
export function conflictingIds(
  overrides: BindingOverrides,
  id: BindingId,
  combo: string,
): BindingId[] {
  const { conflicts } = resolveBindings({ ...overrides, [id]: combo });
  return (conflicts.get(combo) ?? []).filter((other) => other !== id);
}

// ---------------------------------------------------------------- 双击手势

/** 双击手势里"双击哪个键"的可选项 */
export const GESTURE_KEYS = ["Control", "Alt", "Shift"] as const;
export type GestureKey = (typeof GESTURE_KEYS)[number];

export const DEFAULT_GESTURE_KEY: GestureKey = "Control";

/** GestureKey → KeyboardEvent.key / 显示名 */
export const GESTURE_LABELS: Record<GestureKey, string> = {
  Control: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
};

export function isGestureKey(value: unknown): value is GestureKey {
  return GESTURE_KEYS.includes(value as GestureKey);
}
