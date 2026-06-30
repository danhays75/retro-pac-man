import { useGameStore } from "@/store/gameStore";
/**
 * GameCanvas — full-viewport responsive canvas for the Pac-Man maze.
 *
 * Foundation: sets up a high-DPI canvas that scales to fit both phone and
 * desktop viewports while preserving the maze's aspect ratio. The canvas
 * exposes a stable 2D context via a ref for the gameplay task to render
 * walls, pellets, Pac-Man, and ghosts. A subtle neon-glow border and CRT
 * scanline overlay reinforce the arcade aesthetic.
 *
 * The actual maze rendering and game simulation are added by the gameplay
 * task; this component owns only the canvas lifecycle, sizing, and the
 * empty arcade backdrop so the foundation looks intentional on first load.
 *
 * Robustness: every canvas/2D-context acquisition is guarded so a null
 * context (e.g. a browser that refuses 2D context, or a canvas that failed
 * to mount) never throws and breaks the React tree. ResizeObserver is
 * feature-detected before use so older mobile browsers don't crash on boot.
 */
import { useEffect, useRef } from "react";

/** Classic arcade maze aspect ratio (28 cols x 31 rows ≈ 0.9:1). */
const MAZE_ASPECT = 28 / 31;

export interface GameCanvasHandle {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
}

export interface GameCanvasProps {
  /** Optional external ref to grab the canvas/context from a parent. */
  canvasRef?: React.RefObject<GameCanvasHandle | null>;
}

export function GameCanvas({ canvasRef }: GameCanvasProps) {
  const innerRef = useRef<HTMLCanvasElement>(null);
  const phase = useGameStore((s) => s.phase);

  useEffect(() => {
    const canvas = innerRef.current;
    if (!canvas) return;
    // Guard context acquisition — getContext("2d") can return null on some
    // browsers/configurations. We still expose the handle (with ctx: null)
    // so the renderer can no-op gracefully instead of throwing.
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (canvasRef) {
      canvasRef.current = { canvas, ctx };
    }

    // High-DPI sizing: match device pixel ratio for crisp neon lines.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const parent = canvas.parentElement;
      if (!parent) return;
      const maxW = parent.clientWidth;
      const maxH = parent.clientHeight;
      if (maxW <= 0 || maxH <= 0) return;
      // Fit maze aspect ratio inside the available box.
      let w = maxW;
      let h = w / MAZE_ASPECT;
      if (h > maxH) {
        h = maxH;
        w = h * MAZE_ASPECT;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Foundation backdrop: pure black with a faint neon grid hint.
        paintBackdrop(ctx, w, h);
      }
    };

    resize();

    // Feature-detect ResizeObserver — some older mobile browsers lack it
    // and constructing it would throw, breaking the boot path.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
      try {
        ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
      } catch {
        ro = null;
      }
    }
    window.addEventListener("resize", resize);
    return () => {
      if (ro) {
        try {
          ro.disconnect();
        } catch {
          /* ignore */
        }
      }
      window.removeEventListener("resize", resize);
      if (canvasRef) canvasRef.current = null;
    };
  }, [canvasRef]);

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      data-ocid="game.canvas.section"
    >
      <div className="neon-glow pixel-crisp relative overflow-hidden rounded-sm border border-secondary/60 bg-black">
        <canvas
          ref={innerRef}
          className="block"
          data-ocid="game.canvas_target"
          aria-label="Pac-Man arcade maze"
          role="img"
        />
        {/* CRT scanline overlay — purely decorative, sits above the canvas. */}
        <div
          className="pointer-events-none absolute inset-0 animate-scanline-drift opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0) 4px)",
          }}
        />
        {/* Phase watermark so the foundation reads as intentional. */}
        {phase === "boot" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-xs tracking-[0.3em] text-secondary/70 text-glow-blue">
              INSERT COIN
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Paints the foundation backdrop: black void with a faint neon grid. */
function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);
  // Faint neon grid hint so the empty canvas isn't a flat void.
  ctx.strokeStyle = "rgba(0, 99, 255, 0.06)";
  ctx.lineWidth = 1;
  const step = 16;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}
