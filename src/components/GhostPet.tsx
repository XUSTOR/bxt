import { useEffect, useId, useRef } from "react";

/**
 * 极简小幽灵（纯 SVG）
 *
 * 交互：
 * - 鼠标移动：眼睛跟随（左右大小差 / 纵向压扁）+ 整体轻微偏头
 * - 点头部：眼睛变小、眼距收窄、脑袋缩小，松手回弹
 * - 拖头部以外的区域：整只幽灵被鼠标拖走，松手停在拖动位置
 * - 底部三个触手：各自随机相位的平滑浮动
 *
 * 性能：全部动画在 rAF 里直接写 DOM，不触发 React 渲染。
 */

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const clampScale = (v: number) => Math.max(0.6, Math.min(1.4, v));
const FRAME_MS = 1000 / 120; // 120Hz 上限
const PATH_MS = 1000 / 30; // 路径（触手浮动）重建频率

// 几何常量
const VB = { x: 48, y: 56, w: 144, h: 134 };
const CX = 120;
const BODY_CY = 123;
const EYE_CY = 112;
const EYE_R = 6;
const EYE_DX = 24;
const NARROW = 0.65;
const BOTTOM_Y = 170;
const BUMP_BASE_Y = 186;
// 深色外壳 / 白色内壁
const DEPTH_FILL = "#b9b9c9";
const DEPTH_INNER = 0.55;
// 头部区域与身体的分界（viewBox 的 y）：这条线以上算"点头部"
const HEAD_Y = 140;

export default function GhostPet({ size = 160 }: { size?: number }) {
  // 鼠标跟随
  const MAX_SHIFT_X = 5;
  const MAX_SHIFT_Y = 3.5;
  const REACH = 320;
  const EYE_SHAPE_K = 0.15;
  const TILT_DEG = 3.5;

  // 底部浮动
  const WOBBLE_AMP = 4;

  // 点按挤压
  const PRESS_HEAD_SCALE = 0.07;
  const PRESS_EYE_SCALE = 0.3;

  // 双击：闭眼 + 换音效
  const BLINK_SQUASH = 0.84; // 纵向压到 16%，看起来就是一条横杠
  const BLINK_WIDEN = 0.32; // 横向顺带拉宽一点
  const BLINK_FADE_MS = 120; // 睁眼时的缓动时长
  const CLICK_SRC_1 = "/click1.wav"; // 单击
  const CLICK_SRC_2 = "/click2.wav"; // 双击之后（含双击本身）
  const DOUBLE_PRESS_MS = 180; // 两次按下间隔小于这个值就算双击

  const hostRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<SVGGElement>(null);
  const bodyScaleRef = useRef<SVGGElement>(null);
  const bodyPathRef = useRef<SVGPathElement>(null);
  const depthPathRef = useRef<SVGPathElement>(null);
  const clipPathRef = useRef<SVGPathElement>(null);
  const eyeGroupRef = useRef<SVGGElement>(null);
  const eyeScaleRefs = useRef<(SVGGElement | null)[]>([]);
  const clipId = `ghost-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let raf = 0;
    let last = 0;
    let lastPath = 0;
    let nx = 0;
    let ny = 0;

    // 双击时的"闭眼"截止时间（与 rAF 的 t 同一时间轴：performance.now）
    let closedUntil = 0;

    // ---- 音效 ----
    // 单击 → click1；双击 → click2；双击之后的所有点击继续用 click2。
    // 音频元素懒加载：第一次真的要出声时才创建。
    let audio1: HTMLAudioElement | null = null;
    let audio2: HTMLAudioElement | null = null;
    let armed = false; // 双击过之后置真：此后一律 click2
    let pendingSingle: number | undefined; // 等待确认"不是双击"的计时器

    const playSound = (which: 1 | 2) => {
      const el =
        which === 1
          ? (audio1 ??= new Audio(CLICK_SRC_1))
          : (audio2 ??= new Audio(CLICK_SRC_2));
      el.volume = 0.7;
      el.currentTime = 0;
      void el.play().catch(() => {
        // 自动播放被拦之类的，静默忽略 —— 闭眼等反应照常发生
      });
    };

    // 点按状态
    let pressTarget = 0;
    let pressNow = 0;

    // 整只幽灵的位移（平滑逼近 target，拖动跟手、松手慢慢飞回）
    let posX = 0;
    let posY = 0;
    let targetX = 0;
    let targetY = 0;
    // 可用拖动范围（拖得越远形变越明显，所以要在 tick 里用到）
    let maxX = 140;
    let maxY = 140;
    let dragging = false;

    // 拖动状态
    let move: {
      startX: number;
      startY: number;
      baseX: number;
      baseY: number;
      maxX: number;
      maxY: number;
    } | null = null;

    // 底部三个触手：随机相位 + 随机角速度
    const bumpPhase = [0, 1, 2].map(() => Math.random() * Math.PI * 2);
    const bumpSpeed = [0, 1, 2].map(() => 0.0016 + Math.random() * 0.0014);

    // 屏幕坐标 → viewBox 坐标（考虑 preserveAspectRatio 的留白）
    const toViewBox = (clientX: number, clientY: number) => {
      const rect = host.getBoundingClientRect();
      const scale = Math.min(rect.width / VB.w, rect.height / VB.h);
      const padX = (rect.width - VB.w * scale) / 2;
      const padY = (rect.height - VB.h * scale) / 2;
      return {
        x: (clientX - rect.left - padX) / scale + VB.x,
        y: (clientY - rect.top - padY) / scale + VB.y,
      };
    };

    // 双击：眼睛压成横杠一小会儿
    const onDoubleClick = () => {
      // 闭眼时长跟双击音效对齐；拿不到 duration 就退回 600ms
      const ms =
        Number.isFinite(audio2?.duration) && (audio2?.duration ?? 0) > 0
          ? Math.min((audio2?.duration ?? 0) * 1000, 1500)
          : 600;
      closedUntil = performance.now() + Math.max(400, ms);
    };

    // 按下时的音效判定：
    //   已 armed        → 直接 click2
    //   180ms 内第二次按 → 算双击，改放 click2 并进入 armed
    //   其余            → 等 180ms，确认不是双击再放 click1
    // 之所以延迟一下，是因为"双击"必然先产生一次按下，立刻放 click1 会和
    // click2 叠在一起，听起来像两声。
    const triggerPressSound = () => {
      if (armed) {
        playSound(2);
        return;
      }
      if (pendingSingle !== undefined) {
        window.clearTimeout(pendingSingle);
        pendingSingle = undefined;
        armed = true;
        playSound(2);
        return;
      }
      pendingSingle = window.setTimeout(() => {
        pendingSingle = undefined;
        playSound(1);
      }, DOUBLE_PRESS_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      triggerPressSound();
      const p = toViewBox(e.clientX, e.clientY);

      // 点脑袋 → 额外触发挤压；其余位置只有拖动
      if (p.y < HEAD_Y) pressTarget = 1;

      // 无论按在哪里都能拖动整只幽灵
      const parent = host.parentElement;
      const pr = parent?.getBoundingClientRect();
      maxX = pr ? Math.max(40, (pr.width - host.offsetWidth) / 2) : 140;
      maxY = pr ? Math.max(40, (pr.height - host.offsetHeight) / 2) : 140;
      dragging = true;
      host.style.cursor = "grabbing";
      move = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: targetX,
        baseY: targetY,
        maxX,
        maxY,
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!move) return;
      targetX = Math.max(
        -move.maxX,
        Math.min(move.maxX, move.baseX + (e.clientX - move.startX)),
      );
      targetY = Math.max(
        -move.maxY,
        Math.min(move.maxY, move.baseY + (e.clientY - move.startY)),
      );
    };

    const onPointerUp = () => {
      move = null;
      pressTarget = 0;
      // 松手：目标回到原点，让 tick 里的缓动把它慢慢飞回去
      if (dragging) {
        dragging = false;
        host.style.cursor = "grab";
        targetX = 0;
        targetY = 0;
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      nx = clamp((e.clientX - (rect.left + rect.width / 2)) / REACH);
      ny = clamp((e.clientY - (rect.top + rect.height / 2)) / REACH);
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      // 页面不可见时不画（切走标签页/最小化）
      if (document.hidden) return;
      if (t - last < FRAME_MS) return;
      last = t;

      // 点按缓动
      pressNow += (pressTarget - pressNow) * 0.2;
      if (pressNow < 0.001) pressNow = 0;

      // 位置缓动：拖动时跟手，松手后慢慢飞回原点
      const follow = dragging ? 0.35 : 0.07;
      posX += (targetX - posX) * follow;
      posY += (targetY - posY) * follow;
      host.style.transform = `translate(${posX.toFixed(2)}px, ${posY.toFixed(2)}px)`;

      // 拖动形变：横向/纵向的贡献**各自独立叠加**（不再二选一）
      // 往右拖 → 横向拉长、纵向压扁；往下拖 → 纵向拉长、横向压扁；斜着拖 → 两者叠加
      const kx = maxX > 0 ? posX / maxX : 0;
      const ky = maxY > 0 ? posY / maxY : 0;
      const ax = Math.abs(kx);
      const ay = Math.abs(ky);
      // 离中心越远 → 整体越小（像被拖远了）
      const dist = Math.min(1, Math.hypot(kx, ky));
      const shrink = 1 - 0.3 * dist;
      const stretchX = clampScale((1 + 0.16 * ax - 0.08 * ay) * shrink);
      const stretchY = clampScale((1 + 0.16 * ay - 0.08 * ax) * shrink);

      const sx = nx * MAX_SHIFT_X;
      const sy = ny * MAX_SHIFT_Y;

      // 身体：轻微偏头 + 拖动拉伸 + 按压缩小
      const headScale = 1 - PRESS_HEAD_SCALE * pressNow;
      if (tiltRef.current) {
        tiltRef.current.setAttribute(
          "transform",
          `rotate(${(nx * TILT_DEG).toFixed(2)} ${CX} ${BODY_CY}) ` +
            `translate(${CX} ${BODY_CY}) scale(${stretchX.toFixed(4)} ${stretchY.toFixed(4)}) translate(${-CX} ${-BODY_CY})`,
        );
      }
      if (bodyScaleRef.current) {
        bodyScaleRef.current.setAttribute(
          "transform",
          headScale === 1
            ? ""
            : `translate(${CX} ${BODY_CY}) scale(${headScale.toFixed(4)}) translate(${-CX} ${-BODY_CY})`,
        );
      }

      // 眼睛：跟随 + 左右大小差 + 纵向压扁 + 按压缩小收窄
      const verticalScale = clampScale(1 + EYE_SHAPE_K * ny);
      const hLeft = clampScale(1 + EYE_SHAPE_K * nx);
      const hRight = clampScale(1 - EYE_SHAPE_K * nx);
      const pressK = 1 - PRESS_EYE_SCALE * pressNow;

      // 双击后闭眼：纵向压成一条横杠，横向稍宽，最后 120ms 缓开
      const remain = closedUntil - t;
      const closed =
        remain <= 0 ? 0 : remain < BLINK_FADE_MS ? remain / BLINK_FADE_MS : 1;
      const closeK = 1 - BLINK_SQUASH * closed;
      const widenK = 1 + BLINK_WIDEN * closed;

      if (eyeGroupRef.current) {
        eyeGroupRef.current.style.transform =
          `translate(${sx}px, ${sy}px) ` +
          `translate(${CX}px, ${EYE_CY}px) scale(${pressK.toFixed(4)}) translate(${-CX}px, ${-EYE_CY}px)`;
      }
      for (let i = 0; i < eyeScaleRefs.current.length; i++) {
        const g = eyeScaleRefs.current[i];
        if (!g) continue;
        const h = (i === 0 ? hLeft : hRight) * widenK;
        g.style.transform = `scale(${h.toFixed(4)}, ${(verticalScale * closeK).toFixed(4)})`;
      }

      // 底部三个触手：随机相位的平滑浮动。
      // 路径只受触手影响（拖拽走的是 transform），而浮动是秒级的慢动作，
      // 所以按 ~30Hz 重建路径就够了 —— 这是真正省掉的开销，不是每帧都 setAttribute。
      if (t - lastPath < PATH_MS) return;
      lastPath = t;

      const bumpY = (i: number) =>
        (
          BUMP_BASE_Y +
          Math.sin(t * bumpSpeed[i] + bumpPhase[i]) * WOBBLE_AMP
        ).toFixed(2);
      const y0 = bumpY(0);
      const y1 = bumpY(1);
      const y2 = bumpY(2);

      const d =
        `M 52 128 A 68 68 0 0 1 188 128 L 188 ${BOTTOM_Y} ` +
        // 外侧控制点与边缘同 x：切线竖直，拐角平滑
        `C 188 ${y0} 154.67 ${y0} 142.67 ${BOTTOM_Y} ` +
        `C 130.67 ${y1} 109.33 ${y1} 97.33 ${BOTTOM_Y} ` +
        `C 85.33 ${y2} 52 ${y2} 52 ${BOTTOM_Y} Z`;

      // 外壳 = 完整形变；内壁 = 55%，并裁在外壳内（深色下方不会出现白色）
      const dInner =
        `M 52 128 A 68 68 0 0 1 188 128 L 188 ${BOTTOM_Y} ` +
        `C 188 ${mix(y0, BOTTOM_Y, DEPTH_INNER)} 154.67 ${mix(y0, BOTTOM_Y, DEPTH_INNER)} 142.67 ${BOTTOM_Y} ` +
        `C 130.67 ${mix(y1, BOTTOM_Y, DEPTH_INNER)} 109.33 ${mix(y1, BOTTOM_Y, DEPTH_INNER)} 97.33 ${BOTTOM_Y} ` +
        `C 85.33 ${mix(y2, BOTTOM_Y, DEPTH_INNER)} 52 ${mix(y2, BOTTOM_Y, DEPTH_INNER)} 52 ${BOTTOM_Y} Z`;

      depthPathRef.current?.setAttribute("d", d);
      clipPathRef.current?.setAttribute("d", d);
      bodyPathRef.current?.setAttribute("d", dInner);
    };

    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("dblclick", onDoubleClick);
    window.addEventListener("mousemove", onMouseMove);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (pendingSingle !== undefined) window.clearTimeout(pendingSingle);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("dblclick", onDoubleClick);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  const eyeXs = [CX - EYE_DX * NARROW, CX + EYE_DX * NARROW];

  return (
    <div
      ref={hostRef}
      style={{
        filter: "drop-shadow(0 0 8px rgba(255,255,255,0.7))",
        touchAction: "none",
        cursor: "grab",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="ghost pet"
      >
        <g ref={tiltRef}>
          <g ref={bodyScaleRef}>
            <g
              transform={`translate(${CX} 0) scale(${NARROW} 1) translate(${-CX} 0)`}
            >
              <defs>
                <clipPath id={clipId}>
                  <path
                    ref={clipPathRef}
                    d="
                      M 52 128
                      A 68 68 0 0 1 188 128
                      L 188 170
                      C 188 186 154.67 186 142.67 170
                      C 130.67 186 109.33 186 97.33 170
                      C 85.33 186 52 186 52 170
                      Z
                    "
                  />
                </clipPath>
              </defs>

              {/* 深色外壳（完整形变） */}
              <path
                ref={depthPathRef}
                d="
                  M 52 128
                  A 68 68 0 0 1 188 128
                  L 188 170
                  C 188 186 154.67 186 142.67 170
                  C 130.67 186 109.33 186 97.33 170
                  C 85.33 186 52 186 52 170
                  Z
                "
                fill={DEPTH_FILL}
              />
              {/* 白色内壁（55% 形变，裁在外壳内） */}
              <path
                ref={bodyPathRef}
                clipPath={`url(#${clipId})`}
                d="
                  M 52 128
                  A 68 68 0 0 1 188 128
                  L 188 170
                  C 188 186 154.67 186 142.67 170
                  C 130.67 186 109.33 186 97.33 170
                  C 85.33 186 52 186 52 170
                  Z
                "
                fill="#ffffff"
              />
            </g>
          </g>

          <g ref={eyeGroupRef}>
            {eyeXs.map((cx, i) => (
              <g key={cx} transform={`translate(${cx} ${EYE_CY})`}>
                <g
                  ref={(el) => {
                    eyeScaleRefs.current[i] = el;
                  }}
                  style={{ transformOrigin: "0px 0px" }}
                >
                  <circle r={EYE_R} fill="#000000" />
                </g>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}

/** 把 value 按比例 f 从 base 方向拉回（用于内壁的 55% 形变） */
function mix(value: string, base: number, f: number) {
  const v = Number(value);
  return (base + (v - base) * f).toFixed(2);
}
