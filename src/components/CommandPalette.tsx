import React, { useState, useEffect, useRef } from "react";
import type { Snippet } from "../hooks/useSnippets";
import { useLanguage } from "../contexts/LanguageContext";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: Snippet[];
  onSelect: (cmd: string) => void;
  themeColor: string;
  bgColor: string;
}

export default function CommandPalette({
  isOpen,
  onClose,
  snippets,
  onSelect,
  themeColor,
  bgColor,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 最近一次滚轮时间：滚动后的一小段时间内忽略"悬停选中"，
  // 否则列表自动滚动时条目从鼠标下滑过，会把选中项改成指针下那一项
  const lastWheelRef = useRef(0);
  const { t } = useLanguage();

  // 打开时自动聚焦（搜索词/选中项由 App 侧 key 重挂载重置，见 App.tsx）
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // 模糊搜索过滤
  const filteredSnippets = snippets.filter((s) =>
    s.cmd.toLowerCase().includes(query.toLowerCase()),
  );

  // 滚轮 = 逐项遍历选中项（不是原生滚动）。
  // 遍历走出可视区时，由下面那个 scrollIntoView 的 effect 自动把列表带下去。
  useEffect(() => {
    if (!isOpen) return;

    let lastTick = 0;
    const handleWheel = (e: WheelEvent) => {
      // 阻止原生滚动/页面滚动，滚轮只用来遍历选项
      e.preventDefault();
      lastWheelRef.current = Date.now();

      const now = Date.now();
      // 触控板一次手势会连发几十个事件，节流一下才会"一项一项"走
      if (now - lastTick < 60) return;
      lastTick = now;

      if (filteredSnippets.length === 0) return;

      setSelectedIndex((prev) => {
        if (e.deltaY > 0) return Math.min(prev + 1, filteredSnippets.length - 1);
        if (e.deltaY < 0) return Math.max(prev - 1, 0);
        return prev;
      });
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isOpen, filteredSnippets.length]);

  // 选中项变了（滚轮/上下键/悬停）就把它滚进可视区 —— 这就是"遍历到框外时界面自动滚动"
  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredSnippets.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSnippets[selectedIndex]) {
        onSelect(filteredSnippets[selectedIndex].cmd);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-w-[90vw] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 border"
        style={{
          backgroundColor: bgColor,
          borderColor: `${themeColor}40`,
          boxShadow: `0 20px 40px -10px ${themeColor}20`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入框 */}
        <div className="flex items-center px-4 py-3 border-b border-white/10">
          <svg
            className="w-5 h-5 text-gray-500 mr-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-gray-100 placeholder-gray-500 outline-none text-lg font-mono"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 结果列表 */}
        <div
          ref={listRef}
          className="max-h-[350px] overflow-y-auto custom-scrollbar py-2"
        >
          {filteredSnippets.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 font-mono text-sm">
              {t("noResults")}
            </div>
          ) : (
            filteredSnippets.map((s, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={s.cmd}
                  data-index={index}
                  onMouseMove={() => {
                    // 用 mousemove 而不是 mouseenter：列表自动滚动时鼠标没动，不该改选中项
                    if (Date.now() - lastWheelRef.current < 150) return;
                    setSelectedIndex(index);
                  }}
                  onClick={() => {
                    onSelect(s.cmd);
                    onClose();
                  }}
                  className={`px-4 py-2 mx-2 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${
                    isSelected ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  style={{
                    borderLeft: isSelected
                      ? `3px solid ${themeColor}`
                      : "3px solid transparent",
                  }}
                >
                  <div className="font-mono text-gray-300 truncate pr-4">
                    {s.cmd}
                  </div>
                  <div className="text-[10px] text-gray-500 bg-black/40 px-2 py-0.5 rounded shrink-0">
                    {s.count} {t("times")}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
