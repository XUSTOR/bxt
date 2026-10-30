import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
export type Language = "zh" | "en";

const translations = {
  zh: {
    terminal: "终端",
    snippets: "命令片段",
    preferences: "偏好设置",
    apiManagement: "API 管理",
    aboutTerminal: "关于终端",
    language: "界面语言",
    themeColor: "主题强调色",
    bgColor: "全局背景色",
    fontSize: "字体大小",
    preview: "实时预览",
    aiCopilot: "DEEPSEEK COPILOT",
    aiHint: "你的 5173 端口被占用了。",
  },
  en: {
    terminal: "Terminal",
    snippets: "SNIPPETS",
    preferences: "Preferences",
    apiManagement: "API Management",
    aboutTerminal: "About Terminal",
    language: "Language",
    themeColor: "Accent Color",
    bgColor: "Background Color",
    fontSize: "Font Size",
    preview: "Live Preview",
    aiCopilot: "DEEPSEEK COPILOT",
    aiHint: "Port 5173 is already in use.",
  },
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof typeof translations.zh) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>("zh");
  const t = (key: keyof typeof translations.zh) => translations[lang][key];
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context)
    throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
