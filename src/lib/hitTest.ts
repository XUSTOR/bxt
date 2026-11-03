/**
 * "点到的到底是空白还是字" —— 终端里的命中测试。
 *
 * 抽成纯函数是为了能单测：坐标换算是纯算术，缓冲区这边只要求 getCell，
 * 传 xterm 的 IBufferLine 或者测试里的假对象都行。
 */

/** IBufferCell 里真正用到的两个方法 */
export interface CellLike {
  /** 1 = 普通字符，2 = 全角字符（占两格），0 = 全角字符的右半格 */
  getWidth(): number;
  /** 格子里放的字符；占位格/空格是空串或空格 */
  getChars(): string;
}

/** IBufferLine 里真正用到的方法 */
export interface LineLike {
  getCell(x: number): CellLike | undefined;
}

/** 屏幕坐标系里的矩形，DOMRect 天然满足这个形状 */
export interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridPoint {
  /** 视口内第几行，0 = 视口顶端 */
  row: number;
  /** 第几列，0 起 */
  col: number;
}

/**
 * 屏幕坐标 → 网格坐标。落在网格之外返回 null，那本身就是"真空白"：
 * 底部给状态灯预留的空档、终端的内边距、右侧没铺满的那一条。
 */
export function hitTestGrid(
  x: number,
  y: number,
  rect: GridRect,
  cols: number,
  rows: number,
): GridPoint | null {
  if (cols <= 0 || rows <= 0) return null;
  if (!(rect.width > 0) || !(rect.height > 0)) return null;

  const offsetX = x - rect.left;
  const offsetY = y - rect.top;
  // 右/下边界用 >= 排除：那一个像素属于网格外
  if (
    offsetX < 0 ||
    offsetY < 0 ||
    offsetX >= rect.width ||
    offsetY >= rect.height
  ) {
    return null;
  }

  const col = Math.floor((offsetX / rect.width) * cols);
  const row = Math.floor((offsetY / rect.height) * rows);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
  return { row, col };
}

/**
 * 这一格有没有字。空格、空行、越界都算空白。
 *
 * 全角字符占两格：右边那格 width = 0、chars 为空，但它仍是那个字的一部分，
 * 点在这半格上同样算"点在字上"。
 */
export function cellIsBlank(line: LineLike | undefined, col: number): boolean {
  if (!line) return true;
  const cell = line.getCell(col);
  if (!cell) return true;

  if (cell.getWidth() === 0) {
    const prev = col > 0 ? line.getCell(col - 1) : undefined;
    if (prev && prev.getWidth() === 2) return false;
    return true;
  }

  return cell.getChars().trim() === "";
}
