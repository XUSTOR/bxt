import { describe, expect, it } from "vitest";
import { cellIsBlank, hitTestGrid } from "./hitTest";
import type { CellLike, GridRect, LineLike } from "./hitTest";

/** 用 [字符, 宽度] 拼一条假的行，宽度 0 的格子表示宽字符的右半格 */
const lineOf = (cells: [string, number][]): LineLike => ({
  getCell: (x) =>
    cells[x]
      ? ({
          getWidth: () => cells[x][1],
          getChars: () => cells[x][0],
        } satisfies CellLike)
      : undefined,
});

/** 10 列 × 5 行、左上角在 (100, 50)、每格 8×16 的网格 */
const rect: GridRect = { left: 100, top: 50, width: 80, height: 80 };

describe("hitTestGrid", () => {
  it("把坐标换算成行列", () => {
    // 第 2 行第 3 列（每格 8×16）
    expect(hitTestGrid(100 + 24 + 1, 50 + 32 + 1, rect, 10, 5)).toEqual({
      row: 2,
      col: 3,
    });
  });

  it("落在网格下面为状态灯预留的空白 → null", () => {
    expect(hitTestGrid(120, 50 + 80 + 20, rect, 10, 5)).toBeNull();
  });

  it("落在右侧留白、内边距 → null", () => {
    expect(hitTestGrid(100 + 80 + 4, 60, rect, 10, 5)).toBeNull();
    expect(hitTestGrid(100 - 1, 60, rect, 10, 5)).toBeNull();
  });

  it("右下角边界本身属于网格外", () => {
    expect(hitTestGrid(100 + 79, 50 + 79, rect, 10, 5)).toEqual({
      row: 4,
      col: 9,
    });
    expect(hitTestGrid(100 + 80, 50 + 79, rect, 10, 5)).toBeNull();
  });

  it("网格尺寸还没量出来时一律当空白", () => {
    expect(hitTestGrid(120, 60, rect, 0, 0)).toBeNull();
    expect(hitTestGrid(120, 60, { ...rect, width: 0 }, 10, 5)).toBeNull();
  });
});

describe("cellIsBlank", () => {
  it("有字的格子不是空白", () => {
    expect(cellIsBlank(lineOf([["P", 1]]), 0)).toBe(false);
  });

  it("空格、空行、越界都算空白", () => {
    expect(cellIsBlank(lineOf([[" ", 1]]), 0)).toBe(true);
    expect(cellIsBlank(lineOf([]), 3)).toBe(true);
    expect(cellIsBlank(undefined, 0)).toBe(true);
  });

  it("全角字符的左半格和右半格都不是空白", () => {
    // 中 = 宽 2，紧跟着一个宽度 0 的占位格
    const line = lineOf([["中", 2], ["", 0], [" ", 1]]);
    expect(cellIsBlank(line, 0)).toBe(false);
    expect(cellIsBlank(line, 1)).toBe(false);
    expect(cellIsBlank(line, 2)).toBe(true);
  });
});
