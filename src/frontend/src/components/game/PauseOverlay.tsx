import { useGameStore } from "@/store/gameStore";
import { motion } from "motion/react";
import { OverlayShell } from "./StartScreen";

/**
 * PauseOverlay — overlay shown when phase === "paused".
 *
 * Shows "PAUSED" with a resume prompt. Resume is driven by the gameplay
 * task's input handler (Esc / P / tap); this overlay is presentational and
 * offers a tap-to-resume affordance that flips the phase back to "playing".
 */
export function PauseOverlay() {
  const setPhase = useGameStore((s) => s.setPhase);

  return (
    <OverlayShell data-ocid="game.pause.overlay" className="bg-background/75">
      <motion.h1
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="font-display text-4xl font-bold tracking-[0.2em] text-secondary text-glow-blue sm:text-6xl"
      >
        PAUSED
      </motion.h1>

      <motion.button
        type="button"
        onClick={() => setPhase("playing")}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="mt-6 rounded-sm border-2 border-secondary bg-secondary/10 px-8 py-3 font-mono text-sm font-bold tracking-[0.2em] text-secondary text-glow-blue transition-smooth hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-12 sm:py-4 sm:text-base"
        data-ocid="game.pause.primary_button"
      >
        ▶ RESUME
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-4 font-mono text-[10px] tracking-[0.25em] text-muted-foreground sm:text-xs"
      >
        PRESS ESC OR P TO RESUME
      </motion.p>
    </OverlayShell>
  );
}
