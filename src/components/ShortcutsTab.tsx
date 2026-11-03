import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useKeybindings, type BindingError } from "../hooks/useKeybindings";
import {
  APP_BINDINGS,
  GESTURE_KEYS,
  GESTURE_LABELS,
  TERMINAL_BINDINGS,
  eventToCombo,
  formatCombo,
  isShellKey,
  type BindingDef,
  type BindingId,
  type GestureKey,
} from "../lib/keybindings";

const ROW =
  "flex items-center justify-between gap-4 p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all";
const LABEL = "text-sm font-semibold text-gray-200";
const HINT = "text-[11px] text-gray-400 mt-0.5";
const SELECT =
  "bg-black/40 border border-white/10 text-gray-300 text-sm rounded-md px-3 py-1.5 outline-none hover:border-white/30 focus:border-white/40 transition-colors cursor-pointer";

export default function ShortcutsTab() {
  const { t } = useLanguage();
  const kb = useKeybindings();
  const [recording, setRecording] = useState<BindingId | null>(null);
  const [error, setError] = useState<BindingError | null>(null);
  const [errorHolder, setErrorHolder] = useState<BindingId | null>(null);

  // 录制：捕获阶段吞掉所有按键，别让它们真的触发动作。
  // kb.capturing 同时让 App 的分发器闭嘴（它挂在更早的位置，只能靠这个标志让路）。
  useEffect(() => {
    if (!recording) return;
    const id = recording;
    kb.beginCapture();

    const stop = () => {
      setRecording(null);
      setError(null);
      setErrorHolder(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Esc = 放弃本次录制
      if (e.key === "Escape") {
        stop();
        return;
      }
      // Backspace / Delete = 解绑这个动作
      if (e.key === "Backspace" || e.key === "Delete") {
        kb.setBinding(id, null);
        stop();
        return;
      }

      const combo = eventToCombo(e);
      if (!combo) return; // 只按了修饰键：继续等主键

      const blocked = kb.checkBinding(id, combo);
      if (blocked) {
        setError(blocked);
        setErrorHolder(kb.holders(id, combo)[0] ?? null);
        return; // 不落盘，继续录
      }

      kb.setBinding(id, combo);
      stop();
    };

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      kb.endCapture();
    };
  }, [recording, kb]);

  const errorText = (code: BindingError) => {
    if (code === "modifier") return t("shortcutNeedModifier");
    if (code === "unsupported") return t("shortcutUnsupported");
    const holder = errorHolder ? t(kb.labelOf(errorHolder)) : "";
    return t("shortcutConflict").replace("{name}", holder);
  };

  const renderRows = (defs: readonly BindingDef[], title: string) => (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-gray-500 px-1">
        {title}
      </div>
      {defs.map((def) => {
        const combo = kb.effective[def.id as BindingId];
        const isRecording = recording === def.id;
        const conflict = !!combo && kb.conflicts.has(combo);
        const shell = !!combo && isShellKey(combo);

        return (
          <div key={def.id} className={ROW}>
            <div className="min-w-0">
              <div className={LABEL}>{t(kb.labelOf(def.id as BindingId))}</div>
              {shell && !isRecording && (
                <div className="text-[11px] text-amber-400/80 mt-0.5">
                  ⚠ {t("shortcutShellWarn")}
                </div>
              )}
              {conflict && combo && (
                <div className="text-[11px] text-red-400/80 mt-0.5">
                  ⚠{" "}
                  {t("shortcutConflict").replace(
                    "{name}",
                    kb
                      .holders(def.id as BindingId, combo)
                      .map((other) => t(kb.labelOf(other)))
                      .join(" / "),
                  )}
                </div>
              )}
              {isRecording && error && (
                <div className="text-[11px] text-red-400/80 mt-0.5">
                  ⚠ {errorText(error)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setRecording(def.id as BindingId);
                  setError(null);
                  setErrorHolder(null);
                }}
                className={`font-mono text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  isRecording
                    ? "border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/10 animate-pulse"
                    : combo
                      ? "border-white/10 text-gray-200 hover:border-white/30 bg-black/30"
                      : "border-dashed border-white/15 text-gray-500 hover:border-white/30 hover:text-gray-300"
                }`}
              >
                {isRecording
                  ? t("shortcutRecording")
                  : combo
                    ? formatCombo(combo)
                    : t("shortcutUnbound")}
              </button>
              <button
                onClick={() => kb.resetBinding(def.id as BindingId)}
                title={t("shortcutReset")}
                className="text-[11px] text-gray-500 hover:text-gray-200 px-1"
              >
                ⟲
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {renderRows(APP_BINDINGS, t("shortcutScopeApp"))}
      {renderRows(TERMINAL_BINDINGS, t("shortcutScopeTerminal"))}

      {/* 双击手势：手势固定，只让"双击哪个键"可配 */}
      <div className={ROW}>
        <div>
          <div className={LABEL}>{t("shortcutDoubleTap")}</div>
          <div className={HINT}>{t("shortcutDoubleTapHint")}</div>
        </div>
        <select
          value={kb.gestureKey}
          onChange={(e) => kb.setGestureKey(e.target.value as GestureKey)}
          className={SELECT}
        >
          {GESTURE_KEYS.map((key) => (
            <option key={key} value={key}>
              {GESTURE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="text-[11px] text-gray-500 leading-relaxed">
          {t("shortcutWebviewNote")}
        </div>
        <button
          onClick={() => kb.resetAll()}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-100 border border-white/10 hover:border-white/30 rounded-md px-3 py-1.5 transition-colors"
        >
          {t("shortcutResetAll")}
        </button>
      </div>
    </div>
  );
}
