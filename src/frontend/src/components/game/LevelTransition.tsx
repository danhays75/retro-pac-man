import { useGameStore } from "@/store/gameStore";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { OverlayShell } from "./StartScreen";

/** Countdown duration in seconds before the level starts. */
const COUNTDOWN_SECONDS = 3;

/**
 * LevelTransition — overlay shown when phase === "levelComplete".
 *
 * Shows "LEVEL X" and a brief READY! prompt with a countdown ring. The
 * gameplay task advances the phase to "ready" then "playing"; this overlay
 * is purely presentational and reads the current level from the store.
 */
export function LevelTransition() {
  const level = useGameStore((s) => s.level);

  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  // biome-ignore lint/correctness/useExhaustiveDependencies: level is the re-arm trigger for the countdown
  useEffect(() => {
    setCount(COUNTDOWN_SECONDS);
    const id = window.setInterval(() => {
      setCount((c) => (c <= 1 ? COUNTDOWN_SECONDS : c - 1));
    }, 1000);
    return () => window.clearInterval(id);
    // Re-arm the countdown whenever the level changes.
  }, [level]);

  return (
    <OverlayShell
      data-ocid="game.level_transition.overlay"
      className="bg-background/70"
    >
      <motion.div
        key={level}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-2"
      >
        <span className="font-mono text-xs tracking-[0.4em] text-secondary text-glow-blue sm:text-sm">
          LEVEL
        </span>
        <span className="font-display text-6xl font-bold tracking-tight text-primary text-glow-yellow sm:text-8xl">
          {level.toString().padStart(2, "0")}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-4 flex flex-col items-center gap-3"
      >
        <span className="font-mono text-2xl font-bold tracking-[0.3em] text-secondary text-glow-blue sm:text-3xl">
          READY!
        </span>

        {/* Countdown ring */}
        <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 36 36"
            role="img"
            aria-label={`Level starts in ${count} seconds`}
          >
            <title>{`Level starts in ${count} seconds`}</title>
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="oklch(0.62 0.18 250 / 0.2)"
              strokeWidth="2"
            />
            <motion.circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="oklch(0.88 0.17 90)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 16}
              key={count}
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 16 }}
              transition={{ duration: 1, ease: "linear" }}
              style={{
                filter: "drop-shadow(0 0 0.3rem oklch(0.88 0.17 90 / 0.7))",
              }}
            />
          </svg>
          <span
            key={count}
            className="font-mono text-2xl font-bold text-primary text-glow-yellow"
          >
            {count}
          </span>
        </div>
      </motion.div>
    </OverlayShell>
  );
}
