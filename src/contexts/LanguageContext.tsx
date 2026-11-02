import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
export type Language = "zh" | "en";

// 👇 所有用户可见文案集中在这里。新增中文键时，en 少写一个就会直接编译报错。
const zh = {
  terminal: "终端",
  apiManagement: "API 管理",
  aboutTerminal: "关于终端",
  aboutTagline: "一个把 AI 塞进终端的桌面工具：命令轮次即上下文，答案只填入、不执行。",
  language: "界面语言",
  themeColor: "主题强调色",
  bgColor: "全局背景色",
  fontSize: "字体大小",
  preview: "实时预览",
  aiCopilot: "AI 助手",

  // 首次启动隐私说明
  privacyTitle: "关于隐私的两件事",
  privacyAiLine:
    "勾选的终端输出会原样发给你配置的 AI 端点（如 DeepSeek / OpenAI），本程序不做脱敏、也没有任何自有服务器中转。",
  privacyKeyLine:
    "API Key 由本机 Windows 加密后保存在配置目录，不会上传、也不会回传前端。",
  privacyTelemetryLine: "除此之外没有任何遥测、崩溃上报或使用统计。",
  privacyDontShow: "不再提示",
  privacyOk: "我知道了",

  // 命令面板
  searchPlaceholder: "搜索常用命令...",
  noResults: "没有找到匹配的命令",
  times: "次",

  // 主界面
  shortcutHint: "双击 Ctrl 搜索命令 (或 Ctrl+Shift+P)",

  // 设置面板
  appearance: "外观与主题",
  languageHint: "切换界面显示语言",
  accentHint: "更改光标和 UI 强调色",
  bgHint: "更改终端底色",

  // 终端状态灯
  statusReady: "就绪",
  statusRunning: "执行中",
  statusError: "错误",
  browserModeNotice: "[浏览器模式] 请在桌面端运行以连接 PTY。",

  // 终端启动选项
  hideBanner: "隐藏启动横幅",
  hideBannerHint: "新开终端时不再显示 PowerShell 的版权和更新提示",

  // AI 面板
  aiPlaceholder: "问点什么…（Enter 发送，Shift+Enter 换行）",
  aiSend: "发送",
  aiStop: "停止",
  aiClear: "清空",
  aiInsert: "插入终端",
  aiContext: "上下文",
  aiNoRounds: "还没有可选的命令轮次",
  aiRoundsSelected: "已选 {n} 轮",
  aiContextHint: "勾选要一起发给 AI 的命令轮次",
  aiNoKey: "还没配置 API Key，去「设置 → API 管理」填一下。",
  aiEmpty: "选中一段终端输出，或者直接提问。",
  aiThinking: "思考中…",
  aiError: "出错了",

  // API 管理
  apiBaseUrl: "接口地址",
  apiModel: "模型",
  apiKey: "API Key",
  apiKeyPlaceholder: "已保存；留空表示不修改",
  apiTemperature: "温度",
  apiSave: "保存",
  apiTest: "测试连接",
  apiTesting: "测试中…",
  apiSaved: "已保存",
  apiTestOk: "连接正常",
  apiTestFail: "连接失败",
  apiKeyRequired: "请先填写 API Key",
  apiHint: "支持任何 OpenAI 兼容的 Chat Completions 端点",
};

const en: Record<keyof typeof zh, string> = {
  terminal: "Terminal",
  apiManagement: "API Management",
  aboutTerminal: "About Terminal",
  aboutTagline:
    "A desktop tool that puts AI inside your terminal: command rounds are the context, answers are inserted but never executed.",
  language: "Language",
  themeColor: "Accent Color",
  bgColor: "Background Color",
  fontSize: "Font Size",
  preview: "Live Preview",
  aiCopilot: "AI Copilot",

  privacyTitle: "Two things about privacy",
  privacyAiLine:
    "The terminal output you select is sent verbatim to the AI endpoint you configure (e.g. DeepSeek / OpenAI). No redaction, no relay through any server of ours.",
  privacyKeyLine:
    "Your API key is encrypted by Windows on this machine and stored in the config directory. It is never uploaded and never returned to the frontend.",
  privacyTelemetryLine: "There is no telemetry, crash reporting, or usage analytics.",
  privacyDontShow: "Don't show again",
  privacyOk: "Got it",

  searchPlaceholder: "Search commands...",
  noResults: "No matching commands",
  times: "times",

  shortcutHint: "Double-tap Ctrl to search (or Ctrl+Shift+P)",

  appearance: "Appearance",
  languageHint: "Switch interface language",
  accentHint: "Change the cursor and UI accent color",
  bgHint: "Change the terminal background color",

  statusReady: "Ready",
  statusRunning: "Running",
  statusError: "Error",
  browserModeNotice: "[Browser mode] Run the desktop app to connect the PTY.",

  hideBanner: "Hide startup banner",
  hideBannerHint:
    "Don't show the PowerShell copyright and update notice in new terminals",

  aiPlaceholder: "Ask something… (Enter to send, Shift+Enter for newline)",
  aiSend: "Send",
  aiStop: "Stop",
  aiClear: "Clear",
  aiInsert: "Insert",
  aiContext: "Context",
  aiNoRounds: "No command rounds yet",
  aiRoundsSelected: "{n} selected",
  aiContextHint: "Pick the rounds to send along with your question",
  aiNoKey: "No API key yet. Add one in Settings → API.",
  aiEmpty: "Select some terminal output, or just ask.",
  aiThinking: "Thinking…",
  aiError: "Error",

  apiBaseUrl: "Base URL",
  apiModel: "Model",
  apiKey: "API Key",
  apiKeyPlaceholder: "Saved; leave blank to keep it",
  apiTemperature: "Temperature",
  apiSave: "Save",
  apiTest: "Test connection",
  apiTesting: "Testing…",
  apiSaved: "Saved",
  apiTestOk: "Connection OK",
  apiTestFail: "Connection failed",
  apiKeyRequired: "API key is required",
  apiHint: "Works with any OpenAI-compatible Chat Completions endpoint",
};

const translations: Record<Language, Record<keyof typeof zh, string>> = {
  zh,
  en,
};

const STORAGE_KEY = "app_language";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof zh) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

function readInitialLang(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // localStorage 不可用（隐私模式等）时退回默认值
  }
  return "zh";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(readInitialLang);

  // 持久化 + 同步 <html lang>，刷新后不会又跳回中文
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 忽略写入失败
    }
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);

  const t = (key: keyof typeof zh) => translations[lang][key];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Provider 和 hook 放同一个文件是刻意为之：它们是同一份上下文的两个入口，
// 拆开反而要额外导出 context 对象。代价只是改这个文件时走整页刷新而非 Fast Refresh。
// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
