import type { ReactNode } from "react";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * 极简 Markdown 渲染（无第三方依赖）。
 * 支持：围栏代码块、行内代码、粗体、有序/无序列表、标题、段落换行。
 * 刻意不支持 HTML / 图片 / 表格——AI 回复里几乎用不到，而它们会带来注入面。
 */

type Block =
  | { kind: "code"; lang: string; code: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "heading"; level: number; text: string }
  | { kind: "para"; text: string };

// 围栏代码块：容忍 3 个以上反引号，也容忍模型偶尔少写一个（``lang）
const FENCE = /^\s*`{2,}\s*([^\s`]*)\s*$/;
const HEADING = /^\s*(#{1,6})\s+(.*)$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let i = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join("\n").replace(/\s+$/, "");
    para = [];
    if (text.trim()) blocks.push({ kind: "para", text });
  };

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块（流式输出中可能还没有收尾的 ```，此时按代码块渲染，避免闪烁）
    const fence = line.match(FENCE);
    if (fence) {
      flushPara();
      const lang = fence[1] || "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 跳过收尾的 ```
      blocks.push({ kind: "code", lang, code: code.join("\n") });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushPara();
      blocks.push({
        kind: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      i++;
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      flushPara();
      const ordered = OL.test(line);
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(ordered ? OL : UL);
        if (!m) break;
        items.push(m[1].replace(/\s+$/, ""));
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }

    para.push(line);
    i++;
  }

  flushPara();
  return blocks;
}

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  INLINE.lastIndex = 0;

  let m = INLINE.exec(text);
  while (m) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      out.push(
        <code
          key={key++}
          className="px-1 py-px rounded bg-white/10 font-mono text-[11px] text-[var(--accent-color)]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      out.push(
        <strong key={key++} className="font-semibold text-gray-100">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    last = m.index + token.length;
    m = INLINE.exec(text);
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({
  text,
  onInsert,
}: {
  text: string;
  onInsert: (code: string) => void;
}) {
  const { t } = useLanguage();
  const blocks = parseBlocks(text);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === "code") {
          return (
            <div
              key={index}
              className="rounded-md border border-white/10 bg-black/60 overflow-hidden"
            >
              <div className="flex items-center justify-between px-2.5 py-1 bg-white/5">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">
                  {block.lang || "text"}
                </span>
                <button
                  onClick={() => onInsert(block.code)}
                  className="text-[10px] text-gray-400 hover:text-[var(--accent-color)] transition-colors"
                >
                  {t("aiInsert")}
                </button>
              </div>
              <pre className="px-3 py-2 overflow-x-auto text-[11px] leading-[1.6] font-mono text-gray-200 whitespace-pre">
                {block.code}
              </pre>
            </div>
          );
        }

        if (block.kind === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={`pl-4 space-y-0.5 ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, i) => (
                <li key={i} className="whitespace-pre-wrap break-words">
                  {renderInline(item)}
                </li>
              ))}
            </Tag>
          );
        }

        if (block.kind === "heading") {
          return (
            <div
              key={index}
              className={`font-semibold text-gray-100 ${
                block.level <= 2 ? "text-sm" : "text-xs"
              }`}
            >
              {renderInline(block.text)}
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
