import { describe, expect, it } from "vitest";
import {
  BINDINGS,
  DEFAULT_GESTURE_KEY,
  conflictingIds,
  eventToCombo,
  formatCombo,
  hasModifier,
  isBindableCombo,
  isGestureKey,
  isShellKey,
  isValidCombo,
  keyNameOf,
  parseCombo,
  resolveBindings,
  type BindingId,
  type KeyLike,
} from "./keybindings";

/** 造一个键盘事件：只需要 code 和修饰键状态 */
const key = (code: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  code,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...mods,
});

describe("keyNameOf", () => {
  it("字母 / 数字 / 功能键按物理键位取名", () => {
    expect(keyNameOf("KeyP")).toBe("P");
    expect(keyNameOf("Digit1")).toBe("1");
    expect(keyNameOf("F5")).toBe("F5");
    expect(keyNameOf("Numpad3")).toBe("Num3");
    expect(keyNameOf("ArrowUp")).toBe("Up");
    expect(keyNameOf("Escape")).toBe("Esc");
  });

  it("不认识的键返回 null", () => {
    expect(keyNameOf("AudioVolumeUp")).toBeNull();
    expect(keyNameOf("")).toBeNull();
  });
});

describe("eventToCombo", () => {
  it("修饰键按固定顺序排列", () => {
    expect(
      eventToCombo(key("KeyP", { ctrlKey: true, shiftKey: true })),
    ).toBe("Ctrl+Shift+P");
    expect(
      eventToCombo(key("ArrowUp", { altKey: true, ctrlKey: true })),
    ).toBe("Ctrl+Alt+Up");
  });

  it("数字键用物理键位：Shift+1 不会变成 Shift+! ", () => {
    expect(eventToCombo(key("Digit1", { shiftKey: true }))).toBe("Shift+1");
    // 同一个物理键，不按 Shift 也是 1
    expect(eventToCombo(key("Digit1", { ctrlKey: true }))).toBe("Ctrl+1");
  });

  it("只按修饰键 → null（录制时要忽略）", () => {
    expect(eventToCombo(key("ControlLeft", { ctrlKey: true }))).toBeNull();
    expect(eventToCombo(key("AltRight", { altKey: true }))).toBeNull();
  });

  it("裸键也能解析出来，但不允许绑定", () => {
    expect(eventToCombo(key("KeyP"))).toBe("P");
    expect(hasModifier("P")).toBe(false);
    expect(isBindableCombo("P")).toBe(false);
  });

  it("不认识的物理键 → null", () => {
    expect(eventToCombo(key("AudioVolumeUp"))).toBeNull();
    expect(eventToCombo(key(""))).toBeNull();
  });
});

describe("parseCombo", () => {
  it("固定的修饰键顺序才算合法", () => {
    expect(parseCombo("Ctrl+Shift+P")).toEqual({
      mods: ["Ctrl", "Shift"],
      key: "P",
    });
    // 顺序反了 → 不合法，避免同一个组合出现两种写法
    expect(parseCombo("Shift+Ctrl+P")).toBeNull();
    expect(parseCombo("Ctrl+Ctrl+P")).toBeNull();
    expect(parseCombo("Cuatro+P")).toBeNull();
  });

  it("符号键和方向键都能解析", () => {
    expect(parseCombo("Ctrl+=")).toEqual({ mods: ["Ctrl"], key: "=" });
    expect(parseCombo("Ctrl+Alt+Up")).toEqual({
      mods: ["Ctrl", "Alt"],
      key: "Up",
    });
  });
});

describe("isValidCombo / isBindableCombo", () => {
  it("语法合法且键名认识才算合法", () => {
    expect(isValidCombo("Ctrl+Shift+P")).toBe(true);
    expect(isValidCombo("Ctrl+Alt+P")).toBe(true);
    expect(isValidCombo("Ctrl+")).toBe(false);
    expect(isValidCombo("P")).toBe(true); // 语法上合法，但下面这条挡住它
    expect(isValidCombo("Ctrl+Whatever")).toBe(false);
  });

  it("裸键不能绑定", () => {
    expect(isBindableCombo("P")).toBe(false);
    expect(isBindableCombo("Tab")).toBe(false);
    expect(isBindableCombo("Ctrl+P")).toBe(true);
  });
});

describe("formatCombo", () => {
  it("给人看的写法", () => {
    expect(formatCombo("Ctrl+Shift+P")).toBe("Ctrl + Shift + P");
    expect(formatCombo("Ctrl+Up")).toBe("Ctrl + ↑");
    expect(formatCombo("不是组合键")).toBe("不是组合键");
  });
});

describe("resolveBindings", () => {
  it("没改过就用默认值", () => {
    const { effective } = resolveBindings();
    expect(effective["palette.open"]).toBe("Ctrl+Shift+P");
    expect(effective["ai.toggle"]).toBe("Ctrl+Shift+A");
    expect(effective["terminal.copy"]).toBe("Ctrl+Shift+C");
  });

  it("没有默认值的动作 = 未绑定", () => {
    const { effective } = resolveBindings();
    expect(effective["tab.new"]).toBeNull();
    expect(effective["settings.open"]).toBeNull();
    expect(effective["terminal.focus"]).toBeNull();
  });

  it("用户改动覆盖默认值，null 表示明确解绑", () => {
    const { effective } = resolveBindings({
      "palette.open": "Ctrl+Shift+K",
      "ai.toggle": null,
    });
    expect(effective["palette.open"]).toBe("Ctrl+Shift+K");
    expect(effective["ai.toggle"]).toBeNull();
  });

  it("localStorage 被手改坏的值会被丢掉，而不是让整表失效", () => {
    const { effective, byCombo } = resolveBindings({
      "palette.open": "P", // 裸键
      "tab.new": "Ctrl+Shift+K+J", // 语法不合法
      "terminal.focus": "Ctrl+Shift+F",
    });
    expect(effective["palette.open"]).toBeNull();
    expect(effective["tab.new"]).toBeNull();
    expect(effective["terminal.focus"]).toBe("Ctrl+Shift+F");
    expect(byCombo.get("P")).toBeUndefined();
  });

  it("同一个键绑给两个动作会被识别成冲突", () => {
    const { conflicts, byCombo, effective } = resolveBindings({
      "tab.new": "Ctrl+Shift+P", // 和 palette.open 的默认值撞了
    });
    expect(effective["tab.new"]).toBe("Ctrl+Shift+P");
    expect(conflicts.get("Ctrl+Shift+P")).toEqual([
      "palette.open",
      "tab.new",
    ]);
    // 冲突时仍然取注册表里靠前的那个，行为可预测
    expect(byCombo.get("Ctrl+Shift+P")).toBe("palette.open");
  });
});

describe("conflictingIds", () => {
  it("新键被别的动作占着就报出来", () => {
    expect(
      conflictingIds({}, "tab.new" as BindingId, "Ctrl+Shift+P"),
    ).toEqual(["palette.open"]);
  });

  it("自己的键不算冲突（可以原地改）", () => {
    expect(
      conflictingIds({}, "palette.open" as BindingId, "Ctrl+Shift+P"),
    ).toEqual([]);
  });
});

describe("isShellKey", () => {
  it("终端常用键给出提醒", () => {
    expect(isShellKey("Ctrl+C")).toBe(true);
    expect(isShellKey("Ctrl+R")).toBe(true);
    expect(isShellKey("Ctrl+Shift+P")).toBe(false);
  });
});

describe("注册表自检", () => {
  it("id 不重复", () => {
    const ids = BINDINGS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("默认值必须能通过校验（拼错了启动就没键可用）", () => {
    for (const def of BINDINGS) {
      if (def.default === null) continue;
      expect(isBindableCombo(def.default), `${def.id} 的默认值不合法`).toBe(
        true,
      );
    }
  });

  it("默认值之间不冲突", () => {
    const { conflicts } = resolveBindings();
    expect([...conflicts.keys()]).toEqual([]);
  });

  it("每个动作都有文案键", () => {
    for (const def of BINDINGS) {
      expect(def.labelKey.length).toBeGreaterThan(0);
    }
  });
});

describe("双击手势的键", () => {
  it("默认双击 Ctrl", () => {
    expect(DEFAULT_GESTURE_KEY).toBe("Control");
  });

  it("只接受列出来的几个键", () => {
    expect(isGestureKey("Alt")).toBe(true);
    expect(isGestureKey("Control")).toBe(true);
    expect(isGestureKey("Meta")).toBe(false);
    expect(isGestureKey(null)).toBe(false);
  });
});
