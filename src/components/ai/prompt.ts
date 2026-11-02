import type { TerminalRound } from "../../TerminalComponent";

/** 消息里是否已有代码块（有的话就不显示"整段插入"，改用代码块自带的按钮） */
export const HAS_FENCE = /(^|\n)\s*`{2,}/;

export const SYSTEM_PROMPT =
  "You are a terminal copilot inside a developer's AI terminal app on Windows with PowerShell. " +
  "Answer concisely and concretely. When you propose shell commands, put them in fenced code blocks. " +
  "If the user provides terminal output, base your answer on it and quote the relevant lines.";

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
