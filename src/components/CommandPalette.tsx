import React, { useState, useEffect, useRef } from "react";
import type { Snippet } from "../hooks/useSnippets";

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

  // 每次打开时重置搜索状态并自动聚焦
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 模糊搜索过滤
  const filteredSnippets = snippets.filter((s) =>
    s.cmd.toLowerCase().includes(query.toLowerCase()),
  );

  // 👇 核心修复：将滚轮事件提升到全局 window，防止鼠标不在选项上时无法触发
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      // 阻止默认的页面滚动或 xterm 触发
      e.preventDefault();
      e.stopPropagation();

      if (filteredSnippets.length === 0) return;

      if (e.deltaY > 0) {
        // 向下滚动
        setSelectedIndex((prev) =>
          prev < filteredSnippets.length - 1 ? prev + 1 : prev,
        );
      } else if (e.deltaY < 0) {
        // 向上滚动
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    };

    // 必须加上 passive: false，否则 preventDefault 会被浏览器忽略
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isOpen, filteredSnippets.length]);

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
            placeholder="搜索常用命令..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 结果列表 */}
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar py-2">
          {filteredSnippets.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 font-mono text-sm">
              没有找到匹配的命令
            </div>
          ) : (
            filteredSnippets.map((s, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={s.cmd}
                  onMouseEnter={() => setSelectedIndex(index)}
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
                    {s.count} 次
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
