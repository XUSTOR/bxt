/**
 * 轮次切片的纯函数层。
 *
 * 这一层刻意不依赖 xterm：调用方从终端缓冲区读出字符串数组后交给这里，
 * 所以可以脱离浏览器/终端直接单测（见 round.test.ts）。
 */

/** 整行只有提示符：既用来判定"命令结束"，也用来从输出里剔除提示符行 */
export const PROMPT_LINE_RE = /^\s*(?:PS\s+[^\n]*>|[A-Za-z]:\\[^\n]*>)\s*$/;

/** 单轮最多保留的行数（超出只留末尾） */
export const ROUND_MAX_LINES = 400;

/** 去掉行首提示符和行尾空白，得到用户实际输入的命令 */
export function stripPrompt(line: string): string {
  return line
    .replace(/^\s*(?:PS\s+[^\n]*?>|[A-Za-z]:\\[^\n]*?>)\s*/, "")
    .replace(/\s+$/, "");
}

export interface RoundSlice {
  /** 命令行本身（marker 行去掉提示符）；标记失效时为 "" */
  command: string;
  /** 命令行之后的输出，已去掉提示符行和首尾空行 */
  output: string;
  /** 是否发生过截断（标记失效，或输出超出 ROUND_MAX_LINES） */
  truncated: boolean;
}

/**
 * 从一段终端行缓冲里切出一轮：命令行 + 输出。
 *
 * @param lines      缓冲区窗口里的文本行（已 translateToString）
 * @param markerLine 命令行在 `lines` 中的下标；`null` 表示标记已失效
 *                   （那几行早被滚出缓冲），此时整个窗口都当作输出。
 */
export function sliceRound(
  lines: string[],
  markerLine: number | null,
): RoundSlice {
  const markerValid =
    markerLine !== null &&
    Number.isInteger(markerLine) &&
    markerLine >= 0 &&
    markerLine < lines.length;

  const command = markerValid ? stripPrompt(lines[markerLine!]) : "";

  // 标记有效 → 从命令行下一行开始；失效 → 整个窗口都是能拿到的输出
  let body = markerValid ? lines.slice(markerLine! + 1) : lines.slice();
  let truncated = !markerValid;

  // 去掉尾部的空行和提示符行（提示符意味着这一轮已经结束）
  while (
    body.length &&
    (body[body.length - 1].trim() === "" || PROMPT_LINE_RE.test(body[body.length - 1]))
  ) {
    body.pop();
  }
  // 再去掉开头空行
  while (body.length && body[0].trim() === "") body.shift();

  if (body.length > ROUND_MAX_LINES) {
    body = body.slice(-ROUND_MAX_LINES);
    truncated = true;
  }

  return { command, output: body.join("\n"), truncated };
}
