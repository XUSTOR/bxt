import { useEffect, useMemo, useRef, useState } from "react";
import type { TerminalRound } from "../../TerminalComponent";
import {
  cancelAi,
  chatAi,
  getAiConfig,
  onAiEvents,
  type AiConfigPublic,
  type AiMessage,
} from "../../lib/ai";
import { isTauri } from "../../lib/env";
import { useLanguage } from "../../contexts/LanguageContext";
import { buildSystemPrompt, contextHeader, buildContext } from "./prompt";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 最多带最近几条对话 */
const HISTORY_LIMIT = 12;

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}`;
}

/**
 * AI 对话的全部状态机：配置、消息、流式订阅、上下文勾选、发送/停止。
 * 组件只负责画，不负责这些。
 */
export function useAiChat({
  rounds,
  isAiOpen,
}: {
  rounds: TerminalRound[];
  isAiOpen: boolean;
}) {
  const { t, lang } = useLanguage();

  const [config, setConfig] = useState<AiConfigPublic | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const requestId = useRef("");

  // 打开时拉一次配置；每次打开都刷新（用户可能刚在设置里填了 key）
  useEffect(() => {
    if (!isAiOpen) return;
    let alive = true;
    const load = () =>
      getAiConfig()
        .then((c) => {
          if (alive) setConfig(c);
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    load();

    // 设置里保存了新配置 → 立刻刷新标题
    const onChange = () => void load();
    window.addEventListener("ai-config-changed", onChange);

    return () => {
      alive = false;
      window.removeEventListener("ai-config-changed", onChange);
    };
  }, [isAiOpen]);

  // 订阅流式事件
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let alive = true;

    void onAiEvents({
      onDelta: ({ id, text }) => {
        if (id !== requestId.current) return;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + text };
          }
          return next;
        });
      },
      onDone: ({ id }) => {
        if (id !== requestId.current) return;
        setBusy(false);
      },
      onError: ({ id, message }) => {
        if (id !== requestId.current) return;
        setError(message);
        setBusy(false);
      },
    }).then((fn) => {
      if (alive) dispose = fn;
      else fn();
    });

    return () => {
      alive = false;
      dispose?.();
    };
  }, []);

  // 勾选状态跟着当前终端的轮次走：
  // 1) 切换标签后，属于别的终端的勾选立刻剪掉（避免上下文串台）
  // 2) 一个都没选时，默认勾上最后一轮（"问刚才这个报错"是最高频场景）
  // 这是"props 变了就收敛 state"的场景，effect 里 setState 是刻意的。
  useEffect(() => {
    const ids = new Set(rounds.map((r) => r.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected((prev) => {
      const kept = new Set<string>();
      prev.forEach((id) => {
        if (ids.has(id)) kept.add(id);
      });

      if (kept.size > 0) {
        return kept.size === prev.size ? prev : kept;
      }
      if (prev.size === 0 && isAiOpen && rounds.length > 0) {
        return new Set([rounds[rounds.length - 1].id]);
      }
      return prev.size === 0 ? prev : kept;
    });
  }, [isAiOpen, rounds]);

  const selectedRounds = useMemo(
    () => rounds.filter((r) => selected.has(r.id)),
    [rounds, selected],
  );

  const toggleRound = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(rounds.map((r) => r.id)));

  /** 发送一条消息。返回 true 表示请求已发出（调用方可以清空输入框）。 */
  const send = async (text: string): Promise<boolean> => {
    const content = text.trim();
    if (!content || busy) return false;

    if (!isTauri()) {
      setError(t("browserModeNotice"));
      return false;
    }
    if (!config?.hasKey) {
      setError(t("aiNoKey"));
      return false;
    }

    const id = newRequestId();
    requestId.current = id;

    const context = buildContext(selectedRounds);
    const history: AiMessage[] = messages
      .filter((m) => m.content.trim() !== "")
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content }));

    const payload: AiMessage[] = [
      { role: "system", content: buildSystemPrompt(lang) },
      ...(context
        ? [{ role: "system" as const, content: `${contextHeader(lang)}\n\n${context}` }]
        : []),
      ...history,
      { role: "user", content },
    ];

    setError(null);
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: "" },
    ]);

    try {
      await chatAi(id, payload);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
    return true;
  };

  const stop = () => {
    if (!requestId.current) return;
    void cancelAi(requestId.current).catch(() => {});
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return {
    config,
    messages,
    busy,
    error,
    send,
    stop,
    clearChat,
    selected,
    toggleRound,
    selectAll,
    selectedRounds,
  };
}
