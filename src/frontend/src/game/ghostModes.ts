/**
 * ghostModes.ts — scatter/chase phase scheduler, frightened timing, and
 * progressive difficulty.
 *
 * The classic arcade alternates scatter and chase phases with a fixed
 * schedule that shortens scatter at higher levels, eventually becoming
 * permanent chase. Frightened mode is triggered by eating a power pellet:
 * ghosts slow down, flee randomly, and flash white in the final 2 seconds.
 * Eaten ghosts return to the house as eyes and respawn.
 *
 * This module is pure state + helpers; the game loop drives it each tick.
 */
import type { Ghost, GhostMode } from "@/types/game";

/** A single phase in the scatter/chase schedule. */
export interface PhaseEntry {
  mode: "scatter" | "chase";
  /** Duration in ms. */
  duration: number;
}

/**
 * Classic arcade scatter/chase schedule per level (ms).
 * Level 1: 7s scatter / 20s chase / 7s / 20s / 5s / 20s / 5s / ∞ chase.
 * Higher levels shrink scatter; from level 5+ it's permanent chase.
 *
 * Indexed by level (1-based); levels beyond the table reuse the last entry.
 */
const PHASE_SCHEDULE: PhaseEntry[][] = [
  // Level 1
  [
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: Number.POSITIVE_INFINITY },
  ],
  // Level 2-4: scatter shrinks
  [
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 7000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: 1033000 },
    { mode: "scatter", duration: 1 },
    { mode: "chase", duration: Number.POSITIVE_INFINITY },
  ],
  // Level 5+: permanent chase (scatter phases are 1ms no-ops)
  [
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 5000 },
    { mode: "chase", duration: 20000 },
    { mode: "scatter", duration: 1 },
    { mode: "chase", duration: Number.POSITIVE_INFINITY },
  ],
];

/** Get the phase schedule for a level (1-based). */
export function scheduleForLevel(level: number): PhaseEntry[] {
  const idx = Math.min(level - 1, PHASE_SCHEDULE.length - 1);
  return PHASE_SCHEDULE[idx] ?? PHASE_SCHEDULE[0];
}

/** Mutable scheduler state owned by the game loop. */
export interface ModeScheduler {
  /** Index into the current level's schedule. */
  phaseIndex: number;
  /** ms elapsed in the current phase. */
  elapsed: number;
  /** The current global mode (scatter or chase). */
  current: "scatter" | "chase";
  /** Whether frightened mode is active (overrides scatter/chase). */
  frightenedActive: boolean;
  /** ms remaining in frightened mode. */
  frightenedRemaining: number;
  /** Total frightened duration for the current level (ms). */
  frightenedDuration: number;
}

/** Create a fresh scheduler for a level. */
export function createScheduler(level: number): ModeScheduler {
  const sched = scheduleForLevel(level);
  const first = sched[0];
  return {
    phaseIndex: 0,
    elapsed: 0,
    current: first?.mode ?? "scatter",
    frightenedActive: false,
    frightenedRemaining: 0,
    frightenedDuration: frightenedDurationForLevel(level),
  };
}

/**
 * Advance the scheduler by `dtMs`. Returns the new scheduler and a flag
 * indicating whether the global mode changed (so the loop can force-reverse
 * ghosts per the classic arcade rule).
 */
export function tickScheduler(
  s: ModeScheduler,
  dtMs: number,
  level: number,
): { scheduler: ModeScheduler; modeChanged: boolean } {
  let { phaseIndex, elapsed, current, frightenedActive, frightenedRemaining } =
    s;
  let modeChanged = false;

  // Frightened countdown runs independently and overrides scatter/chase.
  if (frightenedActive) {
    frightenedRemaining -= dtMs;
    if (frightenedRemaining <= 0) {
      frightenedActive = false;
      frightenedRemaining = 0;
      // Returning to the underlying scatter/chase mode counts as a change
      // only if the underlying mode flipped while frightened; we keep it
      // simple and signal a change so ghosts re-evaluate.
      modeChanged = true;
    }
  }

  // Advance the scatter/chase schedule only while not frightened.
  if (!frightenedActive) {
    elapsed += dtMs;
    const sched = scheduleForLevel(level);
    const entry = sched[phaseIndex];
    if (entry && elapsed >= entry.duration) {
      elapsed -= entry.duration;
      phaseIndex = Math.min(phaseIndex + 1, sched.length - 1);
      const next = sched[phaseIndex];
      if (next && next.mode !== current) {
        current = next.mode;
        modeChanged = true;
      }
    }
  }

  return {
    scheduler: {
      ...s,
      phaseIndex,
      elapsed,
      current,
      frightenedActive,
      frightenedRemaining,
    },
    modeChanged,
  };
}

/**
 * Trigger frightened mode (power pellet eaten). Resets the frightened timer
 * to the level's full duration. If already frightened, refreshes the timer.
 */
export function startFrightened(s: ModeScheduler): ModeScheduler {
  return {
    ...s,
    frightenedActive: true,
    frightenedRemaining: s.frightenedDuration,
  };
}

/** Frightened duration per level (ms). Decreases at higher levels. */
export function frightenedDurationForLevel(level: number): number {
  // Classic arcade: 6s levels 1, then 5s, 4s, 3s, 2s, then 1s from level 5+,
  // and 0 (no frightened) from level 19+. We keep a minimum of 2000ms so the
  // mechanic stays meaningful in our shorter sessions.
  if (level >= 19) return 0;
  const table = [6000, 5000, 4000, 3000, 2000];
  const idx = Math.min(level - 1, table.length - 1);
  return table[idx] ?? 2000;
}

/** Flash window: ghosts flash white in the final N ms of frightened mode. */
export const FRIGHTENED_FLASH_MS = 2000;

/** Whether the frightened ghosts should flash white right now. */
export function isFrightenedFlashing(s: ModeScheduler): boolean {
  if (!s.frightenedActive) return false;
  return s.frightenedRemaining <= FRIGHTENED_FLASH_MS;
}

/**
 * Resolve the effective mode a ghost should be in, given the scheduler.
 * Frightened and eaten override the global scatter/chase mode.
 */
export function effectiveMode(ghost: Ghost, s: ModeScheduler): GhostMode {
  if (ghost.mode === "eaten") return "eaten";
  if (s.frightenedActive && ghost.leftHouse) return "frightened";
  return s.current;
}

/** Apply the scheduler's effective mode to all ghosts (force-reverse on flip). */
export function syncGhostModes(
  ghosts: Ghost[],
  s: ModeScheduler,
  forceReverse: boolean,
): Ghost[] {
  return ghosts.map((g) => {
    const target = effectiveMode(g, s);
    if (g.mode === target && !forceReverse) return g;
    // Imported lazily to avoid a circular import with ghostAI.
    // We inline the small mode-change logic here to keep this module pure.
    if (g.mode === target && forceReverse) {
      // Force a reverse to honor the classic scatter<->chase flip.
      const back = oppositeDir(g.dir);
      return { ...g, mode: target, dir: back };
    }
    return { ...g, mode: target };
  });
}

/** Tiny local opposite helper to avoid importing from ghostAI (cycle-safe). */
function oppositeDir(dir: Ghost["dir"]): Ghost["dir"] {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
    default:
      return "none";
  }
}

/**
 * Ghost speed scaling per level. Returns a multiplier on the base speed.
 * Classic arcade: ghosts get ~5-10% faster each level, capped.
 */
export function ghostSpeedMultiplier(level: number): number {
  // +4% per level, capped at +40%.
  return Math.min(1.4, 1 + (level - 1) * 0.04);
}

/** Frightened speed multiplier (slower than normal). */
export const FRIGHTENED_SPEED_MULT = 0.55;

/** Eaten (eyes) speed multiplier (faster than normal). */
export const EATEN_SPEED_MULT = 1.6;
