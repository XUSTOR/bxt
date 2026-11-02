import { describe, expect, it } from "vitest";
import {
  ROUND_MAX_LINES,
  sliceRound,
  stripPrompt,
  PROMPT_LINE_RE,
} from "./round";

describe("stripPrompt", () => {
  it("去掉 PS 提示符", () => {
    expect(stripPrompt("PS C:\\Users\\you> npm test")).toBe("npm test");
  });

  it("去掉盘符提示符", () => {
    expect(stripPrompt("C:\\project>git status")).toBe("git status");
  });

  it("纯输出行原样返回", () => {
    expect(stripPrompt("PASS src/lib/round.test.ts")).toBe(
      "PASS src/lib/round.test.ts",
    );
  });
});

describe("PROMPT_LINE_RE", () => {
  it("只匹配整行提示符", () => {
    expect(PROMPT_LINE_RE.test("PS C:\\Users\\you>")).toBe(true);
    expect(PROMPT_LINE_RE.test("PS C:\\Users\\you> dir")).toBe(false);
  });
});

describe("sliceRound", () => {
  it("切出命令 + 输出，并剔除末尾的提示符行和空行", () => {
    const lines = [
      "PS C:\\Users\\you> npm test",
      "",
      "> vitest run",
      "PASS  round.test.ts",
      "",
      "PS C:\\Users\\you>",
    ];

    const r = sliceRound(lines, 0);

    expect(r.command).toBe("npm test");
    expect(r.output).toBe("> vitest run\nPASS  round.test.ts");
    expect(r.truncated).toBe(false);
  });

  it("输出超过上限时只留末尾，并标记 truncated", () => {
    const lines = [
      "PS C:\\Users\\you> seq 1 600",
      ...Array.from({ length: 600 }, (_, i) => `line ${i + 1}`),
      "PS C:\\Users\\you>",
    ];

    const r = sliceRound(lines, 0);

    expect(r.output.split("\n")).toHaveLength(ROUND_MAX_LINES);
    // 保留的是末尾：最后一行应该是 line 600
    expect(r.output.split("\n").at(-1)).toBe("line 600");
    expect(r.output.split("\n")[0]).toBe(`line ${600 - ROUND_MAX_LINES + 1}`);
    expect(r.truncated).toBe(true);
  });

  it("标记失效（markerLine = null）时整段都是输出，且标记 truncated", () => {
    const lines = ["", "old output a", "old output b", "", "PS C:\\Users\\you>"];

    const r = sliceRound(lines, null);

    expect(r.command).toBe("");
    expect(r.output).toBe("old output a\nold output b");
    expect(r.truncated).toBe(true);
  });

  it("只有命令没有输出时，output 为空", () => {
    const r = sliceRound(["PS C:\\Users\\you> cls", "PS C:\\Users\\you>"], 0);

    expect(r.command).toBe("cls");
    expect(r.output).toBe("");
    expect(r.truncated).toBe(false);
  });
});
