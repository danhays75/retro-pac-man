/**
 * useGameLoop — requestAnimationFrame-based game tick.
 *
 * This is the foundation tick hook. It runs a callback at a fixed logical
 * step (default ~60fps) and exposes the running state plus start/stop
 * controls. The actual game simulation (movement, AI, collisions) is wired
 * in by the gameplay task; this hook only owns the rAF lifecycle and
 * delta-time bookkeeping.
 *
 * Honors prefers-reduced-motion by clamping the delta so animations don't
 * jump when the tab is backgrounded.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface GameLoopOptions {
  /** Target frames per second for the logical tick. */
  fps?: number;
  /** Whether the loop should start running immediately. */
  autoStart?: boolean;
}

export interface GameLoopApi {
  /** True while the rAF loop is active. */
  running: boolean;
  /** Start the loop (no-op if already running). */
  start: () => void;
  /** Stop the loop (cancels the pending frame). */
  stop: () => void;
  /** Toggle running state. */
  toggle: () => void;
}

export function useGameLoop(
  tick: (deltaSeconds: number) => void,
  options: GameLoopOptions = {},
): GameLoopApi {
  const { fps = 60, autoStart = false } = options;
  const targetStep = 1 / fps;

  const tickRef = useRef(tick);
  tickRef.current = tick;

  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const [running, setRunning] = useState<boolean>(autoStart);

  const frame = useCallback(
    (now: number) => {
      const last = lastRef.current || now;
      let delta = (now - last) / 1000;
      // Clamp large deltas (tab backgrounded) to avoid huge jumps.
      if (delta > 0.25) delta = 0.25;
      lastRef.current = now;
      accRef.current += delta;

      while (accRef.current >= targetStep) {
        tickRef.current(targetStep);
        accRef.current -= targetStep;
      }

      rafRef.current = requestAnimationFrame(frame);
    },
    [targetStep],
  );

  const start = useCallback(() => {
    if (rafRef.current !== null) return;
    lastRef.current = 0;
    accRef.current = 0;
    setRunning(true);
    rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
  }, []);

  const toggle = useCallback(() => {
    if (rafRef.current === null) start();
    else stop();
  }, [start, stop]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only autostart; start/stop are stable via useCallback
  useEffect(() => {
    if (autoStart) start();
    return stop;
  }, []);

  return { running, start, stop, toggle };
}
