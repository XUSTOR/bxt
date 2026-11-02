import { useState } from "react";
import type { TerminalRound } from "../TerminalComponent";
import { useLanguage } from "../contexts/LanguageContext";
import { providerLabel } from "../lib/ai";
import ContextPicker from "./ai/ContextPicker";
import MessageList from "./ai/MessageList";
import { useAiChat } from "./ai/useAiChat";

interface AiPanelProps {
  isAiOpen: boolean;
  closeAi: () => void;
  themeColor: string;
  rounds: TerminalRound[];
  onInsert: (text: string) => void;
}

export default function AiPanel({
  isAiOpen,
  closeAi,
  themeColor,
  rounds,
  onInsert,
}: AiPanelProps) {
  const { t } = useLanguage();
  const chat = useAiChat({ rounds, isAiOpen });
  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (await chat.send(input)) setInput("");
  };

  return (
    <div
      className={`w-80 shrink-0 bg-black/50 backdrop-blur-xl border-l flex flex-col h-full transition-transform duration-300 ease-in-out ${
        isAiOpen ? "translate-x-0" : "translate-x-full hidden"
      }`}
      style={{
        borderColor: `${themeColor}4D`,
        boxShadow: `0 0 20px ${themeColor}26`,
      }}
    >
      {/* 顶部：标题随配置动态变化（不写死厂商） */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
        <h2
          className="font-bold text-sm tracking-wider transition-colors truncate"
          style={{ color: "var(--accent-color)" }}
          title={
            chat.config
              ? `${chat.config.baseUrl} · ${chat.config.model}`
              : undefined
          }
        >
          {chat.config
            ? `${providerLabel(chat.config.baseUrl)} · ${chat.config.model}`
            : t("aiCopilot")}
        </h2>
        <div className="flex items-center gap-3">
          {chat.messages.length > 0 && (
            <button
              onClick={chat.clearChat}
              className="text-[10px] text-gray-500 hover:text-gray-200 uppercase tracking-wider"
            >
              {t("aiClear")}
            </button>
          )}
          <button
            onClick={closeAi}
            className="text-gray-500 hover:text-white text-lg"
          >
            &times;
          </button>
        </div>
      </div>

      <ContextPicker
        rounds={rounds}
        selected={chat.selected}
        onToggle={chat.toggleRound}
        themeColor={themeColor}
      />

      <MessageList
        messages={chat.messages}
        busy={chat.busy}
        error={chat.error}
        themeColor={themeColor}
        onInsert={onInsert}
      />

      {/* 输入区 */}
      <div className="p-3 border-t border-white/5 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          rows={3}
          placeholder={t("aiPlaceholder")}
          className="w-full resize-none bg-black/40 border border-white/10 rounded-md px-3 py-2 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-white/25 transition-colors font-mono"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={chat.selectAll}
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            {t("aiContext")}: {"#" + rounds.length}
          </button>
          {chat.busy ? (
            <button
              onClick={chat.stop}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors"
            >
              {t("aiStop")}
            </button>
          ) : (
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim()}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: `${themeColor}26`,
                color: themeColor,
              }}
            >
              {t("aiSend")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
