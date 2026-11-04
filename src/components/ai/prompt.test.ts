import { describe, expect, it } from "vitest";
import { buildSystemPrompt, contextHeader } from "./prompt";

describe("buildSystemPrompt", () => {
  it("规定跟随用户语言，并禁止自行切换成第三种语言", () => {
    for (const lang of ["zh", "en"] as const) {
      const p = buildSystemPrompt(lang);
      expect(p).toContain("same language the user writes in");
      expect(p).toContain("Never switch to a third language");
    }
  });

  it("界面语言为中文时，无语言信号的输入回中文", () => {
    expect(buildSystemPrompt("zh")).toContain("Simplified Chinese");
    expect(buildSystemPrompt("zh")).not.toContain("reply in English");
  });

  it("界面语言为英文时，无语言信号的输入回英文", () => {
    expect(buildSystemPrompt("en")).toContain("reply in English");
    expect(buildSystemPrompt("en")).not.toContain("Simplified Chinese");
  });

  it("覆盖没有自然语言的输入（数字、路径、裸命令、空文本）", () => {
    const p = buildSystemPrompt("zh");
    for (const hint of ["digits", "path", "bare command", "empty"]) {
      expect(p).toContain(hint);
    }
  });

  it("要求命令/路径保持原样不翻译", () => {
    expect(buildSystemPrompt("en")).toContain("untranslated");
  });

  it("保留原有的终端助手约束", () => {
    const p = buildSystemPrompt("en");
    expect(p).toContain("terminal copilot");
    expect(p).toContain("fenced code blocks");
    expect(p).toContain("auto-execute");
  });
});

describe("contextHeader", () => {
  it("跟随界面语言，避免把模型拽回中文", () => {
    expect(contextHeader("zh")).toContain("终端");
    expect(contextHeader("en")).toContain("terminal");
    expect(contextHeader("zh")).not.toBe(contextHeader("en"));
  });
});
