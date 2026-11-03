import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import TerminalComponent from "./TerminalComponent";
import type { TerminalHandle, TerminalRound } from "./TerminalComponent";
import AiPanel from "./components/AiPanel";
import PrivacyNotice from "./components/PrivacyNotice";
import { useTheme } from "./hooks/useTheme";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { useSnippets } from "./hooks/useSnippets";
import { hasAckedPrivacy } from "./lib/settings";

// 首屏不需要的弹窗按需加载：不进主 chunk，启动时少解析几十 KB。
// 两者在打开前都不渲染，所以懒加载不会造成可见的延迟。
const CommandPalette = lazy(() => import("./components/CommandPalette"));
const SettingsModal = lazy(() => import("./components/SettingsModal"));

interface Tab {
  id: string;
}

function AppContent() {
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // 首次启动（或隐私说明升版后）弹一次，勾了"不再提示"就不再出现
  const [showPrivacy, setShowPrivacy] = useState(() => !hasAckedPrivacy());

  const { t } = useLanguage();
  const { snippets, recordCommand } = useSnippets();
  const [tabs, setTabs] = useState<Tab[]>([{ id: "term-1" }]);
  const [activeTabId, setActiveTabId] = useState("term-1");

  const terminalRefs = useRef<Map<string, TerminalHandle>>(new Map());
  // 终端轮次（命令 + 输出），按标签分开存：不同标签的上下文不能串
  const [roundsByTab, setRoundsByTab] = useState<Record<string, TerminalRound[]>>(
    {},
  );
  const rounds = roundsByTab[activeTabId] ?? [];
  const theme = useTheme();

  useEffect(() => {
    // 双击 Ctrl 的判定只用 keyup：一次"按一下"必然产生且只产生一次 keyup，
    // 而长按产生的自动重复只有 keydown、没有 keyup，天然不会被误判成连击。
    let lastCtrlTap = 0;

    const isCtrlKey = (e: KeyboardEvent) =>
      e.key === "Control" ||
      e.code === "ControlLeft" ||
      e.code === "ControlRight";

    const handleKeyDown = (e: KeyboardEvent) => {
      // 👇 长按时系统会以几十毫秒的间隔重复派发 keydown（e.repeat === true）。
      //    这些重复事件必须全部丢弃，否则面板会被反复开关。
      if (e.repeat) return;

      // Ctrl 的判定交给 keyup，按下时不做任何事
      if (isCtrlKey(e)) return;

      // 按了其他键就重置，防止 Ctrl+C / Ctrl+V 被算成一次 Ctrl 点击
      lastCtrlTap = 0;

      // 保留 Ctrl+Shift+A 唤出 AI
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        setIsAiOpen((prev) => !prev);
      }
      // 命令面板：Ctrl+Shift+P（Ctrl+K 已还给 shell）
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isCtrlKey(e)) return;

      const now = Date.now();
      if (now - lastCtrlTap < 300) {
        setIsPaletteOpen((prev) => !prev);
        lastCtrlTap = 0; // 用掉这次双击，等待下一轮
      } else {
        lastCtrlTap = now;
      }
    };

    // 必须绑定在 document，且使用 capture: true 优先拦截
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    document.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, []);

  // Ctrl + 滚轮切换 Tab
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      if (currentIndex === -1) return;
      let nextIndex = currentIndex;
      if (e.deltaY < 0) {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      } else if (e.deltaY > 0) {
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      }
      if (nextIndex !== currentIndex) setActiveTabId(tabs[nextIndex].id);
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [tabs, activeTabId]);

  const addTab = () => {
    const newId = `term-${Date.now()}`;
    setTabs([...tabs, { id: newId }]);
    setActiveTabId(newId);
  };

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // 关掉标签就丢掉它那一份轮次，避免新终端"继承"上一个终端的上下文
    setRoundsByTab((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // 一并结束这个标签的 PTY 进程，否则会留下孤儿 powershell.exe
    void invoke("pty_kill", { id }).catch(() => {});

    const newTabs = tabs.filter((tab) => tab.id !== id);
    if (newTabs.length === 0) {
      setTabs([{ id: "term-1" }]);
      setActiveTabId("term-1");
      setRoundsByTab({}); // 全部关掉 = 上下文清零
    } else {
      setTabs(newTabs);
      if (activeTabId === id) setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div
      className="flex h-screen w-screen text-gray-300 font-sans overflow-hidden relative cursor-default"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* 终端主区域（占满全屏） */}
      <div className="flex-1 bg-black/80 flex flex-col relative overflow-hidden">
        {/* 顶部标签栏 */}
        <div className="flex items-end bg-[#181818] border-b border-gray-700/50 px-2 pt-2 gap-1 overflow-x-auto select-none no-scrollbar h-[42px]">
          {tabs.map((tab, index) => {
            const isActive = activeTabId === tab.id;
            const isFirst = index === 0;
            const isLast = index === tabs.length - 1;
            const roundClass = `${isFirst ? "rounded-tl-lg" : "rounded-tl-none"} ${
              isLast ? "rounded-tr-lg" : "rounded-tr-none"
            }`;

            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group relative flex items-center justify-between gap-2 pl-3.5 pr-1.5 py-1.5 ${roundClass} cursor-pointer min-w-[130px] max-w-[180px] h-full text-xs font-mono transition-all duration-200 border-t border-x ${
                  isActive
                    ? "bg-black/80 text-[var(--accent-color)] border-gray-700/50 z-10 border-b-transparent"
                    : "bg-transparent text-gray-500 border-transparent hover:bg-white/5 hover:text-gray-300"
                }`}
                style={{
                  boxShadow: isActive
                    ? `inset 0 2px 0 0 ${theme.themeColor}80`
                    : "none",
                }}
              >
                <span className="truncate">
                  {t("terminal")} {index + 1}
                </span>
                <button
                  onClick={(e) => closeTab(e, tab.id)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-sm leading-none transition-all ${
                    isActive
                      ? "opacity-100 hover:bg-red-500/20 hover:text-red-400"
                      : "opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400"
                  }`}
                >
                  &times;
                </button>
                {isActive && (
                  <div className="absolute -bottom-[1px] left-0 right-0 h-[2px] bg-black/80"></div>
                )}
              </div>
            );
          })}
          <button
            onClick={addTab}
            className="w-7 h-7 mb-1 ml-1 flex items-center justify-center rounded-md text-gray-500 hover:text-[var(--accent-color)] hover:bg-white/10 transition-all active:scale-95 shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* 终端渲染区 */}
        <div className="flex-1 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${
                activeTabId === tab.id
                  ? "z-10"
                  : "z-0 opacity-0 pointer-events-none"
              }`}
            >
              <TerminalComponent
                id={tab.id}
                isActive={activeTabId === tab.id}
                ref={(el) => {
                  if (el) terminalRefs.current.set(tab.id, el);
                  else terminalRefs.current.delete(tab.id);
                }}
                themeColor={theme.themeColor}
                bgColor={theme.bgColor}
                fontSize={theme.fontSize}
                onCommandExecuted={recordCommand}
                onRoundComplete={(round) =>
                  setRoundsByTab((prev) => ({
                    ...prev,
                    [tab.id]: [...(prev[tab.id] ?? []), round].slice(-50),
                  }))
                }
              />
            </div>
          ))}
        </div>

        {/* 悬浮的齿轮按钮（极简返回设置） */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="absolute bottom-4 left-4 z-50 w-10 h-10 bg-[#252535]/80 backdrop-blur border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-[var(--accent-color)] hover:border-[var(--accent-color)] hover:shadow-[0_0_15px_var(--accent-color)] transition-all duration-200"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>

        {/* 底部提示 */}
        <div className="absolute bottom-5 left-16 z-50 pointer-events-none text-[10px] text-gray-600 font-mono tracking-widest">
          {t("shortcutHint")}
        </div>
      </div>

      {/* 弹窗挂载：只在打开时渲染，配合 lazy 按需加载 */}
      <Suspense fallback={null}>
        {isPaletteOpen && (
          <CommandPalette
            // 每次打开都重新挂载，搜索词和选中项自然归零
            key="palette"
            isOpen={isPaletteOpen}
            onClose={() => setIsPaletteOpen(false)}
            snippets={snippets}
            onSelect={(cmd) =>
              terminalRefs.current.get(activeTabId)?.injectCommand(cmd)
            }
            themeColor={theme.themeColor}
            bgColor={theme.bgColor}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            themeColor={theme.themeColor}
            setThemeColor={theme.handleThemeChange}
            bgColor={theme.bgColor}
            setBgColor={theme.handleBgChange}
            fontSize={theme.fontSize}
            setFontSize={theme.setFontSize}
          />
        )}
      </Suspense>

      {showPrivacy && (
        <PrivacyNotice onClose={() => setShowPrivacy(false)} />
      )}

      <AiPanel
        isAiOpen={isAiOpen}
        closeAi={() => setIsAiOpen(false)}
        themeColor={theme.themeColor}
        rounds={rounds}
        onInsert={(text) =>
          terminalRefs.current.get(activeTabId)?.injectCommand(text)
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
