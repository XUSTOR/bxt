import { useEffect, useRef, useState } from "react";
import type { TerminalRound } from "../TerminalComponent";
import { useLanguage } from "../contexts/LanguageContext";
import { providerLabel } from "../lib/ai";
import { getAiPanelWidth, setAiPanelWidth } from "../lib/settings";
import ContextPicker from "./ai/ContextPicker";
import MessageList from "./ai/MessageList";
import { useAiChat } from "./ai/useAiChat";

/** 面板宽度的上下限（px）。默认值和原来固定的 w-80 一致 */
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 280;
const MAX_WIDTH = 720;

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

  // ---- 面板宽度：左边缘拖拽，双击复位，宽度记在 localStorage ----
  const [width, setWidth] = useState(() => getAiPanelWidth(DEFAULT_WIDTH));
  const widthRef = useRef(width);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // 小窗口下别把终端挤没：最多留 380px 给终端
  const clampWidth = (px: number) => {
    const maxByWindow = Math.max(MIN_WIDTH, window.innerWidth - 380);
    return Math.min(Math.max(px, MIN_WIDTH), Math.min(MAX_WIDTH, maxByWindow));
  };

  // 窗口变窄时重新夹一次，避免面板溢出
  useEffect(() => {
    const onResize = () =>
      setWidth((w) => {
        const next = clampWidth(w);
        widthRef.current = next;
        return next;
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = widthRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    // 拖拽期间禁止选中文本，否则会选到对话内容
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    // 面板在右侧：鼠标往左移 = 变宽
    const next = clampWidth(
      dragStartWidth.current + (dragStartX.current - e.clientX),
    );
    widthRef.current = next;
    setWidth(next);
  };

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    setAiPanelWidth(widthRef.current);
  };

  const resetWidth = () => {
    const w = clampWidth(DEFAULT_WIDTH);
    widthRef.current = w;
    setWidth(w);
    setAiPanelWidth(w);
  };

  const handleSend = async () => {
    if (await chat.send(input)) setInput("");
  };

  return (
    <div
      className={`shrink-0 bg-black/50 backdrop-blur-xl border-l flex flex-col h-full relative transition-transform duration-300 ease-in-out ${
        isAiOpen ? "translate-x-0" : "translate-x-full hidden"
      }`}
      style={{
        width: `${width}px`,
        borderColor: `${themeColor}4D`,
        boxShadow: `0 0 20px ${themeColor}26`,
      }}
    >
      {/* 左边缘拖拽条：拖动改宽度，双击复位 */}
      {isAiOpen && (
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onDoubleClick={resetWidth}
          title={t("aiResizeHint")}
          className="absolute top-0 left-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize group z-10"
        >
          <div className="h-full w-full bg-transparent group-hover:bg-[var(--accent-color)] transition-colors opacity-40" />
        </div>
      )}
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
