import { useIsMobile } from "@/hooks/use-mobile";
import { useGetHighScore } from "@/hooks/useHighScore";
import { useInput } from "@/hooks/useInput";
import { useSound } from "@/hooks/useSound";
import { useSwipe } from "@/hooks/useSwipe";
import { useGameStore } from "@/store/gameStore";
/**
 * GameLayout — the main game shell.
 *
 * Structure (per design contract):
 *  - Top HUD bar (bg-card, border-b): score, high score, lives, level, mute.
 *  - Center: full-viewport GameCanvas (bg-background) — the arcade centerpiece.
 *    The GameRenderer (invisible) drives the canvas simulation + rendering, and
 *    the overlay screens (start / game over / level transition / pause) and the
 *    in-canvas HUD are layered on top based on the current game phase.
 *  - Bottom: mobile D-pad zone (visible on touch / small screens).
 *
 * Controls: keyboard (arrows + WASD) and pause (p/Escape) are wired via
 * `useInput`; touch/swipe on the canvas via `useSwipe`; the on-screen D-pad
 * via the `DPad` component. All three input paths push through the same
 * `setDirection` / `queueDirection` channel so the game loop reads one source.
 */
import { Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";
import { DPad } from "./DPad";
import { GameCanvas, type GameCanvasHandle } from "./GameCanvas";
import { GameOverScreen } from "./GameOverScreen";
import { GameRenderer } from "./GameRenderer";
import { HUD } from "./HUD";
import { LevelTransition } from "./LevelTransition";
import { PauseOverlay } from "./PauseOverlay";
import { StartScreen } from "./StartScreen";

/** Stable string keys for the lives pips — avoids array-index keys. */
const LIFE_SLOTS = [
  "life-1",
  "life-2",
  "life-3",
  "life-4",
  "life-5",
  "life-6",
  "life-7",
  "life-8",
] as const;

export function GameLayout() {
  const isMobile = useIsMobile();
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const lives = useGameStore((s) => s.lives);
  const level = useGameStore((s) => s.level);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const phase = useGameStore((s) => s.phase);

  // Keep the sound manager's mute flag in sync with the store and unlock the
  // AudioContext on the first user gesture (autoplay policy).
  useSound();

  // Fetch the persisted high score from the backend on app load and mirror
  // it into the game store so the HUD shows the real high score on boot.
  useGetHighScore();

  const canvasRef = useRef<GameCanvasHandle>(null);

  // Unified input: keyboard (arrows + WASD) + pause (p/Escape). The returned
  // direction/nextDirection are read by the game loop (GameRenderer). Touch
  // and D-pad push through the same setters below.
  const { direction, setDirection, queueDirection } = useInput();

  // Touch/swipe on the canvas — feeds the same direction channel.
  const swipe = useSwipe({
    onSwipe: (dir) => {
      queueDirection(dir);
      setDirection(dir);
    },
  });

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground">
      {/* ── HUD ─────────────────────────────────────────────── */}
      <header
        className="z-20 flex items-center justify-between border-b border-secondary/40 bg-card/90 px-4 py-2 backdrop-blur-sm sm:px-6"
        data-ocid="game.hud.section"
      >
        <HudStat label="SCORE" value={score.toString().padStart(6, "0")} />
        <HudStat
          label="HI-SCORE"
          value={highScore.toString().padStart(6, "0")}
          accent
        />
        <HudStat label="LEVEL" value={level.toString().padStart(2, "0")} />

        {/* Lives — yellow Pac-Man wedges */}
        <div
          className="hidden items-center gap-2 sm:flex"
          aria-label={`${lives} lives remaining`}
        >
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            LIVES
          </span>
          <div className="flex gap-1">
            {LIFE_SLOTS.slice(0, Math.max(0, lives)).map((id) => (
              <span
                key={id}
                className="inline-block h-3 w-3 rounded-full bg-primary shadow-neon-yellow"
                style={{
                  clipPath: "polygon(100% 50%, 0% 0%, 35% 50%, 0% 100%)",
                }}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMute}
          className="rounded-sm border border-secondary/40 bg-secondary/10 p-1.5 text-secondary transition-smooth hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          aria-pressed={muted}
          data-ocid="game.mute.toggle"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>
      </header>

      {/* ── Mobile lives row ─────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-1 sm:hidden">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          LIVES
        </span>
        <div className="flex gap-1">
          {LIFE_SLOTS.slice(0, Math.max(0, lives)).map((id) => (
            <span
              key={id}
              className="inline-block h-2.5 w-2.5 rounded-full bg-primary shadow-neon-yellow"
              style={{ clipPath: "polygon(100% 50%, 0% 0%, 35% 50%, 0% 100%)" }}
              aria-hidden
            />
          ))}
        </div>
      </div>

      {/* ── Canvas centerpiece ───────────────────────────────── */}
      <main
        className="relative flex flex-1 items-center justify-center overflow-hidden p-2 sm:p-4"
        data-ocid="game.stage.section"
      >
        <div
          ref={swipe.ref}
          className="flex h-full w-full items-center justify-center"
        >
          <GameCanvas canvasRef={canvasRef} />
        </div>

        {/* Invisible engine + renderer bridge: drives the canvas simulation
            and rendering each tick. Rendered inside <main> so it shares the
            canvas ref and lifecycle with the stage. */}
        <GameRenderer canvasRef={canvasRef} />

        {/* In-canvas HUD overlay (score / hi-score / lives / level / mute). */}
        <HUD />

        {/* Phase-driven overlay screens. */}
        {phase === "start" && <StartScreen />}
        {phase === "gameOver" && <GameOverScreen />}
        {phase === "levelComplete" && <LevelTransition />}
        {phase === "paused" && <PauseOverlay />}
      </main>

      {/* ── Mobile D-pad zone ─────────────────────────────────── */}
      {isMobile && (
        <footer
          className="z-20 flex items-center justify-center border-t border-secondary/40 bg-card/90 px-4 py-3 backdrop-blur-sm"
          data-ocid="game.controls.section"
        >
          <DPad
            activeDirection={direction === "none" ? undefined : direction}
            onDirection={(dir) => {
              queueDirection(dir);
              setDirection(dir);
            }}
          />
        </footer>
      )}

      {/* Branding footer line — desktop only, kept minimal */}
      <div className="hidden items-center justify-center border-t border-secondary/20 bg-muted/40 px-4 py-1 sm:flex">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
          © {new Date().getFullYear()} · Built with love using{" "}
          <a
            href="https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=arcade"
            target="_blank"
            rel="noreferrer"
            className="text-secondary transition-smooth hover:text-primary"
          >
            caffeine.ai
          </a>
        </span>
      </div>
    </div>
  );
}

/** A single HUD stat block: mono label + glowing value. */
function HudStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
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
