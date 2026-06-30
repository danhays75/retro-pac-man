import { useGameStore } from "@/store/gameStore";
import type { Direction } from "@/types/game";
/**
 * useSwipe — touch/swipe direction detection for the game canvas.
 *
 * Attaches non-blocking touch listeners to a target element (the canvas or
 * its touch wrapper) and reports the dominant swipe direction once the
 * gesture crosses a small threshold. Taps below the threshold are ignored
 * so they don't trigger spurious direction changes.
 *
 * The hook is phase-aware: it only fires `onSwipe` while the game is in the
 * `playing` phase, mirroring the keyboard gating in `useInput`.
 *
 * Returns a ref callback to attach to the touch surface.
 */
import { useCallback, useEffect, useRef } from "react";

export interface SwipeApi {
  /** Ref callback — attach to the touch surface element. */
  ref: (el: HTMLElement | null) => void;
}

export interface UseSwipeOptions {
  /** Minimum pixel distance before a swipe is recognized. */
  threshold?: number;
  /** Called with the recognized swipe direction. */
  onSwipe: (dir: Direction) => void;
}

/** Minimum travel in px to count as a swipe (below = tap, ignored). */
const DEFAULT_THRESHOLD = 24;

export function useSwipe({
  threshold = DEFAULT_THRESHOLD,
  onSwipe,
}: UseSwipeOptions): SwipeApi {
  const elRef = useRef<HTMLElement | null>(null);
  const phaseRef = useRef(useGameStore.getState().phase);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  // Track phase via store subscription so the listener doesn't rebind.
  useEffect(() => {
    const unsub = useGameStore.subscribe((s) => {
      phaseRef.current = s.phase;
    });
    return unsub;
  }, []);

  const ref = useCallback((el: HTMLElement | null) => {
    // Detach from any previous element.
    const prev = elRef.current;
    if (prev) {
      prev.removeEventListener("touchstart", handleTouchStart);
      prev.removeEventListener("touchmove", handleTouchMove);
      prev.removeEventListener("touchend", handleTouchEnd);
    }
    elRef.current = el;
    if (el) {
      el.addEventListener("touchstart", handleTouchStart, { passive: false });
      el.addEventListener("touchmove", handleTouchMove, { passive: false });
      el.addEventListener("touchend", handleTouchEnd, { passive: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch tracking state — kept in module-scoped refs to avoid re-renders.
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    if (phaseRef.current !== "playing") return;
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
    last.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (phaseRef.current !== "playing") return;
    if (!start.current) return;
    // Prevent the page from scrolling while swiping on the canvas.
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    last.current = { x: t.clientX, y: t.clientY };

    // Live direction updates as the finger drags past the threshold — gives
    // responsive feel for continuous swipes (e.g. rounding corners).
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < threshold) return;
    const dir: Direction =
      absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    onSwipeRef.current(dir);
    // Reset the start point so subsequent drag segments register fresh.
    start.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (phaseRef.current !== "playing") return;
    // Prevent synthetic mouse events / click forwarding.
    e.preventDefault();
    start.current = null;
    last.current = null;
  };

  return { ref };
}
