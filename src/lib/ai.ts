import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "./env";

export interface AiConfigPublic {
  baseUrl: string;
  model: string;
  temperature: number;
  hasKey: boolean;
}

export interface AiConfigInput {
  baseUrl: string;
  model: string;
  temperature: number;
  /** null/undefined = 保持原 key 不变；"" = 清除 */
  apiKey?: string | null;
}

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiDeltaEvent {
  id: string;
  text: string;
}

export interface AiDoneEvent {
  id: string;
  cancelled: boolean;
}

export interface AiErrorEvent {
  id: string;
  message: string;
}

/** 从 baseUrl 推断服务商名称，用来做面板标题（不写死任何厂商） */
export function providerLabel(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (host.includes("deepseek")) return "DeepSeek";
    if (host.includes("openai")) return "OpenAI";
    if (host.includes("moonshot")) return "Moonshot";
    if (host.includes("anthropic")) return "Anthropic";
    if (host.includes("google") || host.includes("gemini")) return "Gemini";
    if (host.includes("mistral")) return "Mistral";
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return "Local";
    }
    const parts = host.split(".").filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 2] : host;
  } catch {
    return "AI";
  }
}

export async function getAiConfig(): Promise<AiConfigPublic> {
  if (!isTauri()) {
    return {
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      temperature: 0.3,
      hasKey: false,
    };
  }
  return invoke<AiConfigPublic>("ai_get_config");
}

export function setAiConfig(config: AiConfigInput) {
  return invoke<AiConfigPublic>("ai_set_config", { config });
}

export function testAiConnection() {
  return invoke<string>("ai_test");
}

export function cancelAi(id: string) {
  return invoke<void>("ai_cancel", { id });
}

export function chatAi(id: string, messages: AiMessage[]) {
  return invoke<void>("ai_chat", { request: { id, messages } });
}

/** 订阅三种 AI 事件，返回统一的取消订阅函数 */
export async function onAiEvents(handlers: {
  onDelta: (e: AiDeltaEvent) => void;
  onDone: (e: AiDoneEvent) => void;
  onError: (e: AiErrorEvent) => void;
}): Promise<() => void> {
  if (!isTauri()) return () => {};

  const unlisteners = await Promise.all([
    listen<AiDeltaEvent>("ai-delta", (e) => handlers.onDelta(e.payload)),
    listen<AiDoneEvent>("ai-done", (e) => handlers.onDone(e.payload)),
    listen<AiErrorEvent>("ai-error", (e) => handlers.onError(e.payload)),
  ]);

  return () => unlisteners.forEach((un) => un());
}
