/**
 * levels.ts — per-level difficulty configuration and maze cycling.
 *
 * The classic arcade Pac-Man escalates difficulty by:
 *   - increasing ghost speed each level (Pac-Man's speed is roughly constant),
 *   - shortening the frightened (blue) duration until it vanishes,
 *   - tightening the scatter/chase timing schedule,
 *   - raising the bonus fruit value.
 *
 * This module exposes a pure `getLevelConfig(level)` that the game loop and
 * HUD consume. Mazes cycle every (MAX_MAZE_INDEX + 1) levels via the store's
 * `mazeIndexForLevel` helper — after the last maze, the layout returns to
 * maze 0 while difficulty keeps climbing.
 */
import { MAX_MAZE_INDEX, type MazeLayout } from "@/types/game";
import { getMaze } from "./mazes";

/** A single scatter or chase phase in the classic alternating schedule. */
export interface ModePhase {
  /** "scatter" (ghosts retreat to corners) or "chase" (ghosts pursue). */
  mode: "scatter" | "chase";
  /** Duration of this phase in seconds. */
  duration: number;
}

/** Per-level tuning knobs consumed by the game loop. */
export interface LevelConfig {
  /** 1-indexed level number. */
  level: number;
  /** 0-based maze index (cycles 0..MAX_MAZE_INDEX). */
  mazeIndex: number;
  /** The resolved MazeLayout for this level. */
  maze: MazeLayout;
  /**
   * Ghost speed multiplier relative to Pac-Man's base speed.
   * Classic arcade: ~0.75 at level 1, climbing toward ~0.95 by level 21+.
   */
  ghostSpeed: number;
  /**
   * Pac-Man's speed multiplier (slightly below 1.0; the arcade creeps it
   * up a hair on later levels but never above the ghosts' ceiling).
   */
  pacSpeed: number;
  /**
   * Frightened-mode duration in seconds. The arcade drops this to 0 by
   * level 19; we floor it at 1.0s so power pellets always grant a brief
   * grace window even on the hardest cycles.
   */
  frightenedDuration: number;
  /**
   * Number of ghost "flashes" during the final second of frightened mode
   * (the white/blue blink warning that frightened is about to end).
   */
  frightenedFlashes: number;
  /**
   * The scatter/chase schedule for this level. Durations shrink as levels
   * rise; from a certain level onward the arcade collapses to pure chase.
   * We keep at least one short scatter so the AI has its signature rhythm.
   */
  schedule: ModePhase[];
  /** Bonus fruit point value for this level (scales up). */
  fruitValue: number;
  /** Bonus fruit kind label, for the renderer / HUD. */
  fruitKind: string;
}

/**
 * Classic arcade scatter/chase schedule (seconds), per the Pac-Man dossier.
 * Level 1 uses the full long-scatter schedule; later levels compress it.
 */
const SCHEDULE_LEVEL_1: ModePhase[] = [
  { mode: "scatter", duration: 7 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 7 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 5 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 5 },
  { mode: "chase", duration: Number.POSITIVE_INFINITY }, // permanent chase after final scatter
];

/** Compressed schedule for mid levels — shorter scatters. */
const SCHEDULE_MID: ModePhase[] = [
  { mode: "scatter", duration: 5 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 5 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 3 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 3 },
  { mode: "chase", duration: Number.POSITIVE_INFINITY },
];

/** Late-game schedule — minimal scatter, mostly relentless chase. */
const SCHEDULE_LATE: ModePhase[] = [
  { mode: "scatter", duration: 3 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 2 },
  { mode: "chase", duration: 20 },
  { mode: "scatter", duration: 2 },
  { mode: "chase", duration: Number.POSITIVE_INFINITY },
];

/**
 * Classic arcade fruit progression (level → fruit, points).
 * Cherries → Strawberry → Peach → Apple → Melon → Galaxian → Key → Key…
 */
const FRUIT_TABLE: Array<{ kind: string; value: number }> = [
  { kind: "Cherry", value: 100 },
  { kind: "Strawberry", value: 300 },
  { kind: "Peach", value: 500 },
  { kind: "Apple", value: 700 },
  { kind: "Melon", value: 1000 },
  { kind: "Galaxian", value: 2000 },
  { kind: "Bell", value: 3000 },
  { kind: "Key", value: 5000 },
];

/** Resolve the fruit for a 1-indexed level. Past the table, it stays at Key. */
function fruitForLevel(level: number): { kind: string; value: number } {
  const idx = Math.min(level - 1, FRUIT_TABLE.length - 1);
  return FRUIT_TABLE[idx];
}

/**
 * Compute the full LevelConfig for a 1-indexed level.
 *
 * Difficulty curves (clamped to sane bounds):
 *   ghostSpeed:     0.75 + min(level-1, 20) * 0.01  → 0.75 .. 0.95
 *   pacSpeed:       0.80 + min(level-1, 4)  * 0.02  → 0.80 .. 0.88
 *   frightenedDur:  max(7 - (level-1), 1) seconds   → 7 .. 1 (floored)
 *
 * Mazes cycle every (MAX_MAZE_INDEX + 1) levels, so level 1 → maze 0,
 * level 5 → maze 0 again (with harder ghosts), level 9 → maze 0, etc.
 */
export function getLevelConfig(level: number): LevelConfig {
  const lvl = Math.max(1, Math.floor(level));
  const mazeIndex = (lvl - 1) % (MAX_MAZE_INDEX + 1);
  const maze = getMaze(mazeIndex);

  const ghostSpeed = 0.75 + Math.min(lvl - 1, 20) * 0.01;
  const pacSpeed = 0.8 + Math.min(lvl - 1, 4) * 0.02;
  const frightenedDuration = Math.max(7 - (lvl - 1), 1);
  const frightenedFlashes = frightenedDuration >= 7 ? 5 : 3;

  let schedule: ModePhase[];
  if (lvl <= 1) schedule = SCHEDULE_LEVEL_1;
  else if (lvl <= 4) schedule = SCHEDULE_MID;
  else schedule = SCHEDULE_LATE;

  const fruit = fruitForLevel(lvl);

  return {
    level: lvl,
    mazeIndex,
    maze,
    ghostSpeed,
    pacSpeed,
    frightenedDuration,
    frightenedFlashes,
    schedule,
    fruitValue: fruit.value,
    fruitKind: fruit.kind,
  };
}

/**
 * The maze index for a given level — re-exported here so callers can import
 * all level logic from one module instead of reaching into the store.
 * Mirrors `mazeIndexForLevel` from the game store.
 */
export function mazeIndexForLevel(level: number): number {
  return (Math.max(1, Math.floor(level)) - 1) % (MAX_MAZE_INDEX + 1);
}

/** Total number of distinct maze layouts (MAX_MAZE_INDEX + 1). */
export const MAZE_COUNT = MAX_MAZE_INDEX + 1;
