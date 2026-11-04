import type { TerminalRound } from "../../TerminalComponent";
import type { Language } from "../../contexts/LanguageContext";

/** 消息里是否已有代码块（有的话就不显示"整段插入"，改用代码块自带的按钮） */
export const HAS_FENCE = /(^|\n)\s*`{2,}/;

const SYSTEM_PROMPT_BASE =
  "You are a terminal copilot inside a developer's AI terminal app on Windows with PowerShell. " +
  "Answer concisely and concretely. When you propose shell commands, put them in fenced code blocks. " +
  "If the user provides terminal output, base your answer on it and quote the relevant lines. " +
  "Never wrap commands in anything that would auto-execute them.";

/**
 * 语言规则。没有它的时候，像 `1 1 1` 这种不含任何语言信号的输入会让模型自己挑语言
 * （实测会挑到日语）。所以这里显式规定：跟随用户消息；用户消息没有语言时用界面语言。
 */
function languageRule(lang: Language): string {
  const uiLanguage =
    lang === "zh" ? "Simplified Chinese (简体中文)" : "English";
  return (
    `Reply in the same language the user writes in. ` +
    `If the user's message carries no natural language at all — only digits, a path, ` +
    `a bare command, pasted output, or empty text — reply in ${uiLanguage}, ` +
    `which is the language of this app's interface. ` +
    `Never switch to a third language on your own. ` +
    `Keep code, commands, paths and flags exactly as they are, untranslated.`
  );
}

/** 组装本次请求的 system prompt */
export function buildSystemPrompt(lang: Language): string {
  return `${SYSTEM_PROMPT_BASE} ${languageRule(lang)}`;
}

/** 上下文段的标题也要跟界面语言一致，否则会反向把模型拽回中文 */
export function contextHeader(lang: Language): string {
  return lang === "zh" ? "终端里最近几轮命令与输出：" : "Recent rounds from the terminal:";
}

// 单轮带进 prompt 的最大行数 / 字符数，防止一次请求把上下文撑爆
const CONTEXT_MAX_LINES = 200;
const CONTEXT_MAX_CHARS = 8000;

/** 把一轮输出裁到上限内，并注明省略了多少 */
export function truncateRoundOutput(output: string): string {
  let text = output;
  let note = "";

  const lines = text.split("\n");
  if (lines.length > CONTEXT_MAX_LINES) {
    text = lines.slice(-CONTEXT_MAX_LINES).join("\n");
    note = `\n…（省略前 ${lines.length - CONTEXT_MAX_LINES} 行）`;
  }
  if (text.length > CONTEXT_MAX_CHARS) {
    text = text.slice(-CONTEXT_MAX_CHARS);
    note = `\n…（已截断，仅保留末尾 ${CONTEXT_MAX_CHARS} 字符）`;
  }
  return text + note;
}

/** 把勾选的轮次拼成一段上下文（按轮次序号升序） */
export function buildContext(rounds: TerminalRound[]): string {
  if (rounds.length === 0) return "";
  return rounds
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((r) => {
      const out = truncateRoundOutput(r.output);
      const head = `#${r.index} PS> ${r.command}`;
      return out ? `${head}\n${out}` : head;
    })
    .join("\n\n---\n\n");
}
