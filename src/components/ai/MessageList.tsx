import { useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Markdown } from "../Markdown";
import { HAS_FENCE } from "./prompt";
import type { ChatMessage } from "./useAiChat";

interface Props {
  messages: ChatMessage[];
  busy: boolean;
  error: string | null;
  themeColor: string;
  onInsert: (text: string) => void;
}

/** 消息列表：自动滚到底 + 代码块插入按钮 */
export default function MessageList({
  messages,
  busy,
  error,
  themeColor,
  onInsert,
}: Props) {
  const { t } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新消息自动滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3"
    >
      {messages.length === 0 && !error && (
        <p className="text-xs text-gray-500 leading-relaxed">{t("aiEmpty")}</p>
      )}

      {messages.map((m, i) => (
        <div key={i} className="text-xs leading-relaxed">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: m.role === "user" ? "#9ca3af" : themeColor }}
            >
              {m.role === "user" ? "you" : "ai"}
            </span>
            {m.role === "assistant" && m.content && !HAS_FENCE.test(m.content) && (
              <button
                onClick={() => onInsert(m.content)}
                className="text-[10px] text-gray-500 hover:text-[var(--accent-color)] transition-colors"
              >
                {t("aiInsert")}
              </button>
            )}
          </div>
          <div
            className={`${m.role === "user" ? "whitespace-pre-wrap break-words" : ""} rounded-md px-3 py-2 ${
              m.role === "user" ? "bg-white/5 text-gray-300" : "text-gray-200"
            }`}
          >
            {m.role === "assistant" && m.content ? (
              <Markdown text={m.content} onInsert={onInsert} />
            ) : (
              m.content || (busy ? t("aiThinking") : "")
            )}
          </div>
        </div>
      ))}

      {error && (
        <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 whitespace-pre-wrap">
          {t("aiError")}: {error}
        </div>
      )}
    </div>
  );
}
