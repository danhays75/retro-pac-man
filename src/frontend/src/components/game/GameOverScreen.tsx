import { useGameStore } from "@/store/gameStore";
import { motion } from "motion/react";
import { OverlayShell } from "./StartScreen";

/**
 * GameOverScreen — overlay shown when phase === "gameOver".
 *
 * Final score, high score, and a RESTART button. Blinky-red accent on the
 * title reinforces the death theme; high score glows yellow if it's a new best.
 */
export function GameOverScreen() {
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const restartGame = useGameStore((s) => s.restartGame);

  const isNewBest = score >= highScore && score > 0;

  return (
    <OverlayShell data-ocid="game.gameover.overlay">
      <motion.h1
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="font-display text-4xl font-bold tracking-tight text-destructive sm:text-6xl"
        style={{ textShadow: "0 0 0.5rem oklch(0.58 0.21 27 / 0.7)" }}
      >
        GAME OVER
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-6 flex flex-col items-center gap-4"
      >
        <ScoreRow label="SCORE" value={score} />
        <ScoreRow label="HI-SCORE" value={highScore} accent />
        {isNewBest && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="font-mono text-xs font-bold tracking-[0.3em] text-primary text-glow-yellow"
          >
            ★ NEW HIGH SCORE ★
          </motion.span>
        )}
      </motion.div>

      <motion.button
        type="button"
        onClick={restartGame}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="mt-8 rounded-sm border-2 border-primary bg-primary/10 px-8 py-3 font-mono text-sm font-bold tracking-[0.2em] text-primary text-glow-yellow transition-smooth hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-12 sm:py-4 sm:text-base"
        data-ocid="game.gameover.primary_button"
      >
        ↻ RESTART
      </motion.button>
    </OverlayShell>
  );
}

/** Score row: mono label + glowing value. */
function ScoreRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground sm:text-xs">
        {label}
      </span>
      <span
        className={
          accent
            ? "font-mono text-2xl font-bold text-primary text-glow-yellow sm:text-3xl"
            : "font-mono text-2xl font-bold text-foreground sm:text-3xl"
        }
      >
        {value.toString().padStart(6, "0")}
      </span>
    </div>
  );
}
