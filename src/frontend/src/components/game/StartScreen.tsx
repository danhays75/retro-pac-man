import { useGameStore } from "@/store/gameStore";
import { motion } from "motion/react";

/**
 * StartScreen — overlay shown when phase === "start".
 *
 * Retro arcade title screen: glowing PAC-MAN wordmark, high-score display,
 * and a START button. Uses neon-glow tokens, pixel mono font, true-black
 * backdrop with CRT scanlines. Responsive for mobile and desktop.
 *
 * IMPORTANT: All content is visible by default. The motion animations are
 * pure enhancements — `initial` is set to the resting (visible) state so
 * that if `motion/react` fails to hydrate or an animation never fires on a
 * given device/browser, the title and START button remain visible and
 * tappable. We never gate the START button's visibility on animation
 * completion.
 */
export function StartScreen() {
  const highScore = useGameStore((s) => s.highScore);
  const startGame = useGameStore((s) => s.startGame);

  return (
    <OverlayShell data-ocid="game.start.overlay">
      {/* Title — visible by default; subtle scale-in is a non-blocking enhancement */}
      <motion.h1
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="font-display text-5xl font-bold tracking-tight text-primary text-glow-yellow sm:text-7xl"
      >
        PAC-MAN
      </motion.h1>

      <motion.p
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="font-mono text-xs tracking-[0.4em] text-secondary text-glow-blue sm:text-sm"
      >
        ARCADE EDITION
      </motion.p>

      {/* High score */}
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-6 flex flex-col items-center gap-1"
      >
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground sm:text-xs">
          HIGH SCORE
        </span>
        <span className="font-mono text-2xl font-bold text-primary text-glow-yellow sm:text-3xl">
          {highScore.toString().padStart(6, "0")}
        </span>
      </motion.div>

      {/* Start button — always visible and tappable; no opacity:0 entrance */}
      <motion.button
        type="button"
        onClick={startGame}
        initial={{ opacity: 1, y: 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        className="mt-8 rounded-sm border-2 border-primary bg-primary/10 px-8 py-3 font-mono text-sm font-bold tracking-[0.2em] text-primary text-glow-yellow transition-smooth hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-12 sm:py-4 sm:text-base"
        data-ocid="game.start.primary_button"
      >
        ▶ START
      </motion.button>

      <motion.p
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="mt-6 font-mono text-[10px] tracking-[0.25em] text-muted-foreground sm:text-xs"
      >
        ARROW KEYS · WASD · SWIPE TO MOVE
      </motion.p>
    </OverlayShell>
  );
}

/** Shared overlay shell: full-cover black backdrop with CRT scanlines. */
export function OverlayShell({
  children,
  className = "",
  ...rest
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-background/85 backdrop-blur-[2px] ${className}`}
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0) 4px)",
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
