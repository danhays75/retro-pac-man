import {
  type GameState,
  type TickCallbacks,
  createState,
  tick as engineTick,
  inputDirection,
  resetState,
} from "@/game/engine";
import { computeView, drawPelletsFromGrid, renderFrame } from "@/game/render";
import { soundManager } from "@/game/sound";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useSubmitScoreIfBeats } from "@/hooks/useHighScore";
import { useInput } from "@/hooks/useInput";
import { useSound } from "@/hooks/useSound";
import { useGameStore } from "@/store/gameStore";
import type { Direction, GamePhase } from "@/types/game";
/**
 * GameRenderer — bridges the game engine + renderer into the React tree.
 *
 * Responsibilities:
 *  - Owns the mutable GameState (in a ref, not React state — the loop mutates
 *    it every tick at 60fps; React state would cause re-render storms).
 *  - Drives the simulation via useGameLoop, calling engine.tick() each step.
 *  - Renders each frame to the canvas via render.renderFrame().
 *  - Bridges engine events (score, death, level complete, power pellet) into
 *    the zustand game store so the HUD/overlays update.
 *  - Feeds input from useInput into the engine (queued turns).
 *  - Handles phase transitions: ready → playing → dying → ready/gameOver,
 *    and levelComplete → next level.
 *
 * Ghost AI movement is delegated: this component calls a placeholder
 * moveGhosts() each tick that the ghost-AI task will replace with the real
 * Blinky/Pinky/Inky/Clyde targeting. Until then, ghosts idle in the house so
 * the core Pac-Man mechanics are testable in isolation.
 */
import { useEffect, useRef } from "react";
import type { GameCanvasHandle } from "./GameCanvas";

/** Seconds the "READY!" overlay holds before play starts. */
const READY_HOLD = 1.8;
/** Seconds the death animation plays before respawning or game-over. */
const DEATH_HOLD = 1.6;
/** Seconds the level-complete flash holds before advancing. */
const LEVEL_COMPLETE_HOLD = 1.4;

export interface GameRendererProps {
  /** Ref to the GameCanvas handle (canvas + 2D context). */
  canvasRef: React.RefObject<GameCanvasHandle | null>;
}

export function GameRenderer({ canvasRef }: GameRendererProps) {
  const input = useInput();
  const phase = useGameStore((s) => s.phase);
  const level = useGameStore((s) => s.level);
  const lives = useGameStore((s) => s.lives);
  const score = useGameStore((s) => s.score);

  const setPhase = useGameStore((s) => s.setPhase);
  const addScore = useGameStore((s) => s.addScore);
  const nextLevel = useGameStore((s) => s.nextLevel);
  const loseLife = useGameStore((s) => s.loseLife);

  // Sync the sound manager's mute flag with the store and unlock the
  // AudioContext on the first user gesture.
  useSound();
  // High-score submission (only fires when the final score beats the
  // persisted high score).
  const { submitIfBeats } = useSubmitScoreIfBeats();

  // Mutable game state — survives across renders, mutated by the loop.
  const stateRef = useRef<GameState | null>(null);
  // Phase + timing refs so the loop reads fresh values without re-subscribing.
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;
  const levelRef = useRef<number>(level);
  levelRef.current = level;
  const livesRef = useRef<number>(lives);
  livesRef.current = lives;
  const scoreRef = useRef<number>(score);
  scoreRef.current = score;
  // Hold-timers for transient phases (ready / dying / levelComplete).
  const holdRef = useRef<number>(0);
  // Wall-clock for animations (seconds).
  const timeRef = useRef<number>(0);

  // Build callbacks that bridge engine events → zustand store + sound.
  const callbacks: TickCallbacks = {
    onScore: (pts) => addScore(pts),
    onDotEat: () => {
      soundManager.playChomp();
    },
    onPowerPellet: () => {
      soundManager.playPowerPellet();
    },
    onGhostEat: (_ghost, _pts) => {
      soundManager.playGhostEaten();
    },
    onPacDeath: () => {
      soundManager.playDeath();
    },
    onLevelComplete: () => {
      soundManager.playLevelIntro();
    },
    onFruitEat: (_pts) => {
      // Reuse the bright ghost-eaten arpeggio as the fruit-eat cue.
      soundManager.playGhostEaten();
    },
  };

  // (Re)create the game state when the level changes or a new run starts.
  useEffect(() => {
    if (phase === "ready" || phase === "boot") {
      stateRef.current = createState(levelRef.current);
      holdRef.current = READY_HOLD;
    }
  }, [phase]);

  // The single tick function passed to useGameLoop. Reads fresh phase/level
  // from refs so the loop closure never goes stale.
  const tick = (deltaSeconds: number) => {
    timeRef.current += deltaSeconds;
    const state = stateRef.current;
    const ctx = canvasRef.current?.ctx;
    const canvas = canvasRef.current?.canvas;
    if (!state || !ctx || !canvas) return;

    const currentPhase = phaseRef.current;

    // Drive phase-specific hold timers, then transition.
    if (currentPhase === "ready") {
      holdRef.current -= deltaSeconds;
      if (holdRef.current <= 0) setPhase("playing");
    } else if (currentPhase === "playing") {
      // Feed input into the engine (queued turns).
      if (input.direction !== "none") {
        inputDirection(state, input.direction as Direction);
      }
      const next = engineTick(state, deltaSeconds, currentPhase, callbacks);
      if (next !== currentPhase) {
        phaseRef.current = next;
        if (next === "dying") {
          holdRef.current = DEATH_HOLD;
          setPhase("dying");
        } else if (next === "levelComplete") {
          holdRef.current = LEVEL_COMPLETE_HOLD;
          setPhase("levelComplete");
        }
      }
    } else if (currentPhase === "dying") {
      holdRef.current -= deltaSeconds;
      if (holdRef.current <= 0) {
        // Decrement lives via the store action so the HUD + livesRef stay
        // in sync. loseLife() also flips phase to "gameOver" when the last
        // life is lost, but we drive phase transitions from this loop, so
        // we read the resulting lives count and decide here.
        loseLife();
        livesRef.current = useGameStore.getState().lives;
        if (livesRef.current <= 0) {
          // Final life lost — submit the score if it beats the high score.
          submitIfBeats(scoreRef.current);
          setPhase("gameOver");
        } else {
          // Respawn: reset positions but keep score + pellets.
          resetState(state);
          holdRef.current = READY_HOLD;
          setPhase("ready");
        }
      }
    } else if (currentPhase === "levelComplete") {
      holdRef.current -= deltaSeconds;
      if (holdRef.current <= 0) {
        nextLevel();
        // nextLevel() incremented the store's level; sync the ref so the
        // new maze is built for the correct (already-incremented) level.
        levelRef.current = useGameStore.getState().level;
        stateRef.current = createState(levelRef.current);
        holdRef.current = READY_HOLD;
        setPhase("ready");
      }
    }

    // ── Render ──────────────────────────────────────────────────────────
    const view = computeView(
      state.maze,
      canvas.clientWidth,
      canvas.clientHeight,
    );
    renderFrame(
      ctx,
      state.maze,
      state,
      view,
      phaseRef.current,
      timeRef.current,
    );
    // Draw live pellets from the mutated grid (overrides the static layout
    // drawn inside renderFrame).
    ctx.save();
    ctx.translate(view.offsetX, view.offsetY);
    ctx.scale(view.scale, view.scale);
    drawPelletsFromGrid(ctx, state.grid, timeRef.current);
    ctx.restore();
  };

  const loop = useGameLoop(tick, { fps: 60, autoStart: true });

  // Start/stop the loop based on phase.
  // biome-ignore lint/correctness/useExhaustiveDependencies: loop.start/stop are stable via useCallback
  useEffect(() => {
    if (phase === "gameOver" || phase === "start") {
      loop.stop();
    } else {
      loop.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Boot → start screen on first mount.
  // Reads the current phase from the store directly (not the closure) so a
  // stale closure value can never prevent the transition. This guarantees the
  // StartScreen overlay surfaces on every device, even if the initial render
  // closure captured an unexpected phase.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only boot effect
  useEffect(() => {
    const current = useGameStore.getState().phase;
    if (current === "boot") {
      // Show the start screen first; the StartScreen's START button calls
      // startGame() to begin the actual run.
      setPhase("start");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No DOM output — this component is invisible; it only drives the canvas
  // owned by GameCanvas. Overlays (start/ready/game-over) are rendered by
  // the overlays task on top of the canvas.
  return null;
}
