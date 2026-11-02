import { useState } from "react";
import type { TerminalRound } from "../../TerminalComponent";
import { useLanguage } from "../../contexts/LanguageContext";

interface Props {
  rounds: TerminalRound[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  themeColor: string;
}

/** 上下文选择器：勾选要一起发给 AI 的命令轮次 */
export default function ContextPicker({
  rounds,
  selected,
  onToggle,
  themeColor,
}: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const selectedCount = rounds.filter((r) => selected.has(r.id)).length;

  return (
    <div className="border-b border-white/5 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs text-gray-400 hover:text-gray-200 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="uppercase tracking-wider text-[10px]">
            {t("aiContext")}
          </span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{
              color: selectedCount ? themeColor : undefined,
              backgroundColor: selectedCount
                ? `${themeColor}1a`
                : "rgba(255,255,255,0.05)",
            }}
          >
            {t("aiRoundsSelected").replace("{n}", String(selectedCount))}
          </span>
        </span>
        <span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="max-h-56 overflow-y-auto custom-scrollbar px-3 pb-3">
          {rounds.length === 0 ? (
            <p className="text-[11px] text-gray-500 px-1 py-2">
              {t("aiNoRounds")}
            </p>
          ) : (
            <>
              <p className="text-[10px] text-gray-600 px-1 pb-1">
                {t("aiContextHint")}
              </p>
              {rounds
                .slice()
                .reverse()
                .map((r) => {
                  const checked = selected.has(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-2 px-2 py-1.5 mb-1 rounded cursor-pointer border text-[11px] font-mono transition-colors ${
                        checked
                          ? "border-white/20 bg-white/5"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(r.id)}
                        className="mt-0.5 accent-[var(--accent-color)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-gray-300 truncate block">
                          #{r.index} {r.command}
                        </span>
                        <span className="text-gray-600 text-[10px]">
                          {r.output.split("\n").filter(Boolean).length} lines
                          {r.truncated ? " · truncated" : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
