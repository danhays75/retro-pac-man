import { useGameStore } from "@/store/gameStore";
import { motion } from "motion/react";

/**
 * HUD — in-game heads-up display rendered as an overlay on the canvas.
 *
 * Complements the existing GameLayout top bar by overlaying score, high
 * score, lives (as Pac-Man wedges), and level directly on the maze stage.
 * This keeps the play field self-contained when the top bar scrolls off on
 * mobile or when the canvas is focused. Reads from the zustand game store.
 *
 * Rendered as a non-interactive (pointer-events-none) layer so it never
 * blocks canvas input; only the mute toggle is interactive.
 */
const LIFE_SLOTS = [
  "hud-life-1",
  "hud-life-2",
  "hud-life-3",
  "hud-life-4",
  "hud-life-5",
  "hud-life-6",
  "hud-life-7",
  "hud-life-8",
] as const;

export function HUD() {
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const lives = useGameStore((s) => s.lives);
  const level = useGameStore((s) => s.level);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 px-3 py-2 sm:px-4"
      data-ocid="game.hud.overlay"
    >
      {/* Left: score + level */}
      <div className="flex flex-col gap-1">
        <Stat label="SCORE" value={score.toString().padStart(6, "0")} />
        <Stat label="LEVEL" value={level.toString().padStart(2, "0")} />
      </div>

      {/* Center: high score */}
      <div className="flex flex-col items-center gap-1">
        <Stat
          label="HI-SCORE"
          value={highScore.toString().padStart(6, "0")}
          accent
        />
      </div>

      {/* Right: lives + mute */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground sm:text-[10px]">
            LIVES
          </span>
          <div className="flex gap-0.5" aria-label={`${lives} lives remaining`}>
            {LIFE_SLOTS.slice(0, Math.max(0, lives)).map((id) => (
              <motion.span
                key={id}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="inline-block h-2.5 w-2.5 rounded-full bg-primary sm:h-3 sm:w-3"
                style={{
                  clipPath: "polygon(100% 50%, 0% 0%, 35% 50%, 0% 100%)",
                  filter: "drop-shadow(0 0 0.2rem oklch(0.88 0.17 90 / 0.6))",
                }}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          aria-pressed={muted}
          data-ocid="game.hud.mute.toggle"
          className="pointer-events-auto rounded-sm border border-secondary/40 bg-secondary/10 p-1 text-secondary transition-smooth hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {muted ? (
            <span className="font-mono text-[10px] leading-none">🔇</span>
          ) : (
            <span className="font-mono text-[10px] leading-none">🔊</span>
          )}
        </button>
      </div>
    </div>
  );
}

/** Compact stat block for the in-canvas HUD. */
function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col leading-none">
      <span className="font-mono text-[9px] tracking-[0.2em] text-muted-foreground sm:text-[10px]">
        {label}
      </span>
      <span
        className={
          accent
            ? "font-mono text-sm font-bold text-primary text-glow-yellow sm:text-base"
            : "font-mono text-sm font-bold text-foreground sm:text-base"
        }
      >
        {value}
      </span>
    </div>
  );
}
