import React, { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import type { Language } from "../contexts/LanguageContext";
import { getAiConfig, setAiConfig, testAiConnection } from "../lib/ai";
import { getHideBanner, setHideBanner } from "../lib/settings";
import GhostPet from "./GhostPet";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  setThemeColor: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgColor: string;
  setBgColor: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
}

type Tab = "appearance" | "api" | "about";

const ROW =
  "flex items-center justify-between p-3.5 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-all";
const LABEL = "text-sm font-semibold text-gray-200";
const HINT = "text-[11px] text-gray-400 mt-0.5";
const INPUT =
  "bg-black/40 border border-white/10 text-gray-300 text-sm rounded-md px-3 py-1.5 outline-none hover:border-white/30 focus:border-white/40 transition-colors";

export default function SettingsModal({
  isOpen,
  onClose,
  themeColor,
  setThemeColor,
  bgColor,
  setBgColor,
  fontSize,
  setFontSize,
}: SettingsModalProps) {
  const { lang, setLang, t } = useLanguage();
  const [tab, setTab] = useState<Tab>("appearance");
  const [hideBanner, setHideBannerState] = useState<boolean>(getHideBanner);

  // ---- API 管理表单 ----
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [status, setStatus] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  // 打开时拉取一次配置
  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    getAiConfig()
      .then((c) => {
        if (!alive) return;
        setBaseUrl(c.baseUrl);
        setModel(c.model);
        setTemperature(c.temperature);
        setHasKey(c.hasKey);
        setApiKey("");
      })
      .catch((e) => {
        if (alive) setStatus({ kind: "err", text: String(e) });
      });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const save = async () => {
    setStatus(null);
    try {
      const next = await setAiConfig({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        temperature,
        apiKey: apiKey.trim() === "" ? null : apiKey.trim(),
      });
      setHasKey(next.hasKey);
      setApiKey("");
      setStatus({ kind: "ok", text: t("apiSaved") });
      // 通知 AI 面板刷新标题（服务商/模型可能变了）
      window.dispatchEvent(new Event("ai-config-changed"));
    } catch (e) {
      setStatus({ kind: "err", text: String(e) });
    }
  };

  const runTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await testAiConnection();
      setStatus({ kind: "ok", text: t("apiTestOk") });
    } catch (e) {
      setStatus({ kind: "err", text: `${t("apiTestFail")}: ${String(e)}` });
    } finally {
      setTesting(false);
    }
  };

  const navButton = (key: Tab, label: string) => {
    const active = tab === key;
    return (
      <button
        onClick={() => setTab(key)}
        className={`relative text-left px-4 py-2.5 rounded-md text-sm transition-all duration-200 ${
          active ? "font-semibold bg-white/10" : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
        }`}
        style={active ? { color: themeColor } : undefined}
      >
        {active && (
          <div
            className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md"
            style={{ backgroundColor: themeColor }}
          ></div>
        )}
        {label}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      // 关于页里有个可拖动的小幽灵，误点背景就关窗太容易了 —— 这一页只认右上角的 ×
      onClick={tab === "about" ? undefined : onClose}
    >
      <div
        className="w-[700px] h-[540px] border border-white/10 rounded-xl shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: bgColor,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧导航 */}
        <div className="w-44 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2 shrink-0">
          <div className="text-xs text-gray-500 font-semibold tracking-wider mb-4 px-2">
            SETTINGS
          </div>
          {navButton("appearance", t("appearance"))}
          {navButton("api", t("apiManagement"))}
          {navButton("about", t("aboutTerminal"))}
        </div>

        <div
          className="flex-1 p-8 relative overflow-y-auto custom-scrollbar"
          style={
            {
              // 把主题色加上 40 的十六进制透明度，作为滚动条滑块的颜色
              "--scrollbar-thumb": `${themeColor}66`,
            } as React.CSSProperties
          }
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-500 hover:text-white text-2xl transition-colors hover:rotate-90 duration-200"
          >
            &times;
          </button>

          <h2 className="text-xl font-bold text-gray-100 mb-6">
            {tab === "appearance"
              ? t("appearance")
              : tab === "api"
                ? t("apiManagement")
                : t("aboutTerminal")}
          </h2>

          {tab === "appearance" ? (
            <div className="flex flex-col gap-4 pb-4">
              {/* 语言切换 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("language")}</div>
                  <div className={HINT}>{t("languageHint")}</div>
                </div>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Language)}
                  className={`${INPUT} cursor-pointer`}
                >
                  <option value="zh">中文 (Chinese)</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* 主题强调色 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("themeColor")}</div>
                  <div className={HINT}>{t("accentHint")}</div>
                </div>
                <div
                  className="relative w-9 h-9 rounded-md overflow-hidden cursor-pointer"
                  style={{ boxShadow: `0 0 12px ${themeColor}40` }}
                >
                  <input
                    type="color"
                    value={themeColor}
                    onChange={setThemeColor}
                    className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer bg-transparent border-none"
                  />
                </div>
              </div>

              {/* 全局背景色 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("bgColor")}</div>
                  <div className={HINT}>{t("bgHint")}</div>
                </div>
                <div className="relative w-9 h-9 rounded-md overflow-hidden cursor-pointer border border-white/10">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={setBgColor}
                    className="absolute -top-2 -left-2 w-14 h-14 cursor-pointer bg-transparent border-none"
                  />
                </div>
              </div>

              {/* 字体大小 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("fontSize")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-5 text-right font-mono">
                    {fontSize}
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-28 cursor-pointer accent-[var(--accent-color)]"
                  />
                </div>
              </div>

              {/* 实时预览（紧跟字体大小，方便直接看字号效果） */}
              <div
                className="mt-2 p-4 rounded-lg border border-white/10 flex flex-col relative shadow-inner overflow-hidden"
                style={{ backgroundColor: bgColor }}
              >
                <div className="absolute top-3 right-3 flex gap-1.5 opacity-60">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                </div>
                <div className="text-[10px] text-gray-500 font-semibold tracking-wider mb-2 select-none">
                  {t("preview")}
                </div>

                <div
                  className="font-mono transition-all duration-200"
                  style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                >
                  <div>
                    <span style={{ color: themeColor }}>
                      PS C:\Users\you&gt;
                    </span>
                    <span className="text-gray-200 ml-2">npm run dev</span>
                  </div>
                  <div className="text-gray-400 mt-1">
                    &gt; vite v8.3.5 ready in 287 ms
                  </div>
                  <div className="text-[#27c93f] mt-1">
                    ➜ Local: http://localhost:5173/
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span style={{ color: themeColor }}>
                      PS C:\Users\you&gt;
                    </span>
                    <span
                      className="w-2 h-4 animate-pulse inline-block"
                      style={{ backgroundColor: themeColor }}
                    ></span>
                  </div>
                </div>
              </div>

              {/* 隐藏启动横幅 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("hideBanner")}</div>
                  <div className={HINT}>{t("hideBannerHint")}</div>
                </div>
                <input
                  type="checkbox"
                  checked={hideBanner}
                  onChange={(e) => {
                    setHideBannerState(e.target.checked);
                    setHideBanner(e.target.checked);
                  }}
                  className="w-4 h-4 cursor-pointer accent-[var(--accent-color)]"
                />
              </div>
            </div>
          ) : tab === "api" ? (
            <div className="flex flex-col gap-4 pb-4">
              <p className="text-[11px] text-gray-500 -mt-2">{t("apiHint")}</p>

              {/* 接口地址 */}
              <div className={ROW}>
                <div className="pr-4">
                  <div className={LABEL}>{t("apiBaseUrl")}</div>
                  <div className={HINT}>https://api.deepseek.com/v1</div>
                </div>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  spellCheck={false}
                  className={`${INPUT} w-64 font-mono text-xs`}
                />
              </div>

              {/* 模型 */}
              <div className={ROW}>
                <div className="pr-4">
                  <div className={LABEL}>{t("apiModel")}</div>
                  <div className={HINT}>deepseek-chat</div>
                </div>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  spellCheck={false}
                  className={`${INPUT} w-64 font-mono text-xs`}
                />
              </div>

              {/* API Key */}
              <div className={ROW}>
                <div className="pr-4">
                  <div className={LABEL}>{t("apiKey")}</div>
                  <div className={HINT}>
                    {hasKey ? t("apiKeyPlaceholder") : t("apiKeyRequired")}
                  </div>
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasKey ? "••••••••" : "sk-..."}
                  spellCheck={false}
                  autoComplete="off"
                  className={`${INPUT} w-64 font-mono text-xs`}
                />
              </div>

              {/* 温度 */}
              <div className={ROW}>
                <div>
                  <div className={LABEL}>{t("apiTemperature")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-8 text-right font-mono">
                    {temperature.toFixed(1)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-28 cursor-pointer accent-[var(--accent-color)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                {status && (
                  <span
                    className={`text-xs mr-auto ${
                      status.kind === "ok" ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {status.text}
                  </span>
                )}
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="px-3 py-1.5 rounded-md text-xs text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
                >
                  {testing ? t("apiTesting") : t("apiTest")}
                </button>
                <button
                  onClick={save}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: `${themeColor}26`,
                    color: themeColor,
                  }}
                >
                  {t("apiSave")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-6 select-none">
              <GhostPet size={180} />
              <div className="text-center">
                <div className="text-lg font-bold text-gray-100 tracking-wider">
                  BXT
                </div>
                <div className="text-[11px] text-gray-500 font-mono mt-1">
                  Better Xustor Terminal · v0.1.0
                </div>
                <div className="text-xs text-gray-400 mt-3 leading-relaxed max-w-[320px]">
                  {t("aboutTagline")}
                </div>
                <div className="text-[10px] text-gray-600 font-mono mt-4 tracking-wider">
                  Tauri · React · xterm.js · Rust
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
