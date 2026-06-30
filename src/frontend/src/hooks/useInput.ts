import { useGameStore } from "@/store/gameStore";
import type { Direction } from "@/types/game";
/**
 * useInput — unified keyboard + touch input hook.
 *
 * Exposes the current intended direction and a setter, plus a queued "next"
 * direction that the game loop consumes at the next intersection (classic
 * arcade pre-turn behavior). The hook reads the live game phase from the
 * zustand store so controls only affect gameplay during the `playing`
 * phase; pause toggles on `p` / `Escape` are always honored.
 *
 * Touch/swipe and on-screen D-pad wiring is provided by `useSwipe` and the
 * `DPad` component, which both push directions through `setDirection` /
 * `queueDirection`.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface InputApi {
  /** The direction the player currently wants Pac-Man to move. */
  direction: Direction;
  /** Set the intended direction immediately (used by keyboard + D-pad). */
  setDirection: (dir: Direction) => void;
  /** Queue a direction to apply at the next intersection (pre-turn). */
  queueDirection: (dir: Direction) => void;
  /** The queued next direction (consumed by the game loop at intersections). */
  nextDirection: Direction;
  /** Consume and clear the queued direction. Returns it to the loop. */
  consumeNext: () => Direction;
  /** Clear the current direction (e.g. on blur). */
  clear: () => void;
  /** Toggle pause — honored in any phase that supports it. */
  togglePause: () => void;
}

/** Keyboard map: arrow keys AND WASD both map to cardinal directions. */
const KEY_TO_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  W: "up",
  S: "down",
  A: "left",
  D: "right",
};

/** Keys that toggle pause. */
const PAUSE_KEYS = new Set(["p", "P", "Escape"]);

export function useInput(): InputApi {
  const [direction, setDirectionState] = useState<Direction>("none");
  const [nextDirection, setNextDirection] = useState<Direction>("none");

  // Refs mirror state so the stable window listener always reads fresh values
  // without re-binding on every direction change.
  const phaseRef = useRef(useGameStore.getState().phase);
  const setPhaseRef = useRef(useGameStore.getState().setPhase);

  // Keep refs in sync with the store.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      phaseRef.current = s.phase;
      setPhaseRef.current = s.setPhase;
    });
    return unsub;
  }, []);

  const setDirection = useCallback((dir: Direction) => {
    setDirectionState(dir);
  }, []);

  const queueDirection = useCallback((dir: Direction) => {
    setNextDirection(dir);
  }, []);

  const consumeNext = useCallback(() => {
    const queued = nextDirection;
    if (queued !== "none") setNextDirection("none");
    return queued;
  }, [nextDirection]);

  const clear = useCallback(() => {
    setDirectionState("none");
    setNextDirection("none");
  }, []);

  const togglePause = useCallback(() => {
    const phase = phaseRef.current;
    const setPhase = setPhaseRef.current;
    if (phase === "playing") setPhase("paused");
    else if (phase === "paused") setPhase("playing");
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Pause toggle is always honored (in any phase that supports it).
      if (PAUSE_KEYS.has(e.key)) {
        e.preventDefault();
        togglePause();
        return;
      }

      const dir = KEY_TO_DIR[e.key];
      if (!dir) return;

      // Prevent page scroll on arrow keys.
      e.preventDefault();

      // Only affect gameplay when in the `playing` phase. Outside of play,
      // we still record the direction so the loop picks it up when it
      // resumes, but we don't queue pre-turns for non-playing phases.
      if (phaseRef.current !== "playing") return;

      // Queue the direction for the next intersection (pre-turn). The
      // game loop applies it when Pac-Man reaches a tile center and the
      // queued direction is unblocked.
      queueDirection(dir);
      // Also set the immediate direction so a fresh press from a standstill
      // or a reverse (180°) takes effect instantly.
      setDirectionState(dir);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queueDirection, togglePause]);

  return {
    direction,
    setDirection,
    queueDirection,
    nextDirection,
    consumeNext,
    clear,
    togglePause,
  };
}
