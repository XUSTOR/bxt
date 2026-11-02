import { useState, useEffect } from "react";

export interface Snippet {
  cmd: string;
  count: number; // 使用次数
  lastUsed: number; // 最后使用时间戳
}

const DEFAULT_SNIPPETS: Snippet[] = [
  { cmd: "netstat -ano | findstr 8080", count: 10, lastUsed: Date.now() },
  { cmd: "docker system prune -a", count: 5, lastUsed: Date.now() },
  { cmd: "git pull origin main", count: 8, lastUsed: Date.now() },
];

// 忽略一些太基础、或者不需要记录的命令
const IGNORE_COMMANDS = [
  "clear",
  "cls",
  "exit",
  "cd",
  "ls",
  "dir",
  "pwd",
  "whoami",
];

export function useSnippets() {
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    try {
      const saved = localStorage.getItem("terminal_snippets");
      return saved ? (JSON.parse(saved) as Snippet[]) : DEFAULT_SNIPPETS;
    } catch {
      return DEFAULT_SNIPPETS;
    }
  });

  // 当数据改变时，自动持久化到本地
  useEffect(() => {
    localStorage.setItem("terminal_snippets", JSON.stringify(snippets));
  }, [snippets]);

  // 记录一条新命令
  const recordCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();

    // 过滤条件：太短、包含空格的基础命令、或者是空回车
    if (!trimmedCmd || trimmedCmd.length < 4) return;
    if (IGNORE_COMMANDS.includes(trimmedCmd.toLowerCase())) return;

    setSnippets((prev) => {
      const existingIndex = prev.findIndex((s) => s.cmd === trimmedCmd);
      const newSnippets = [...prev];

      if (existingIndex >= 0) {
        // 如果已经存在，增加次数，更新时间
        newSnippets[existingIndex] = {
          ...newSnippets[existingIndex],
          count: newSnippets[existingIndex].count + 1,
          lastUsed: Date.now(),
        };
      } else {
        // 如果是新命令，加入列表
        newSnippets.push({ cmd: trimmedCmd, count: 1, lastUsed: Date.now() });
      }

      // 核心排序算法：优先按使用频次降序，频次一样则按最近使用时间降序
      newSnippets.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastUsed - a.lastUsed;
      });

      // 只保留前 15 条最常用的
      return newSnippets.slice(0, 15);
    });
  };

  return { snippets, recordCommand };
}
