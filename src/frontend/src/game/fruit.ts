/**
 * fruit.ts — bonus fruit spawning logic.
 *
 * In the classic arcade, a bonus fruit appears twice per level: once after
 * a certain number of dots are eaten and again after more are eaten. The
 * fruit sits in the maze center (just below the ghost house) for ~9–10
 * seconds, then disappears. Eating it awards points that scale with level.
 *
 * This module is pure: it holds no timers. The game loop calls
 * `shouldSpawnFruit` / `makeFruit` / `isFruitExpired` against its own
 * clock, keeping the fruit state in the simulation layer.
 */
import type { BonusFruit, GridPos } from "@/types/game";
import { getLevelConfig } from "./levels";

/**
 * Dot-count thresholds (out of ~240 total pellets) at which the fruit
 * spawns. Classic arcade: 70 and 170 dots eaten. We use the same.
 */
export const FRUIT_SPAWN_THRESHOLDS = [70, 170] as const;

/** How long the fruit stays on screen, in milliseconds. */
export const FRUIT_TTL_MS = 9_000;

/**
 * The canonical fruit spawn position: dead-center of the maze, just below
 * the ghost house door. For a 28-wide maze this is col 13/14; we use col 13
 * to sit just left of center on the tunnel row's lower corridor (row 17),
 * matching the classic arcade's fruit alcove.
 */
export const FRUIT_SPAWN_POS: GridPos = { col: 13, row: 17 };

/**
 * Decide whether a fruit should spawn now, given how many dots have been
 * eaten so far this level and which spawn slots have already fired.
 *
 * @param dotsEaten   Pellets consumed this level (dots + power pellets).
 * @param slotsFired  Which of the FRUIT_SPAWN_THRESHOLDS have already
 *                    triggered a spawn this level (0-indexed positions).
 * @returns The index of the threshold that should fire now, or `null`.
 */
export function shouldSpawnFruit(
  dotsEaten: number,
  slotsFired: ReadonlySet<number>,
): number | null {
  for (let i = 0; i < FRUIT_SPAWN_THRESHOLDS.length; i++) {
    if (slotsFired.has(i)) continue;
    if (dotsEaten >= FRUIT_SPAWN_THRESHOLDS[i]) return i;
  }
  return null;
}

/**
 * Create a BonusFruit for the given level, stamped at `now` (ms).
 * Point value and kind come from the level config so they scale up.
 */
export function makeFruit(level: number, now: number): BonusFruit {
  const cfg = getLevelConfig(level);
  return {
    pos: { ...FRUIT_SPAWN_POS },
    points: cfg.fruitValue,
    spawnedAt: now,
    ttl: FRUIT_TTL_MS,
  };
}

/** True if the fruit has been on screen past its TTL. */
export function isFruitExpired(fruit: BonusFruit | null, now: number): boolean {
  if (!fruit) return true;
  return now - fruit.spawnedAt >= fruit.ttl;
}

/**
 * Remaining time fraction 0..1 for the fruit's blink-before-vanish animation.
 * The final ~1.5s of life, the renderer blinks the fruit to telegraph
 * that it is about to disappear.
 */
export function fruitBlinkFraction(fruit: BonusFruit, now: number): number {
  const elapsed = now - fruit.spawnedAt;
  const remaining = fruit.ttl - elapsed;
  const BLINK_WINDOW = 1_500;
  if (remaining >= BLINK_WINDOW) return 0;
  if (remaining <= 0) return 1;
  return 1 - remaining / BLINK_WINDOW;
}

/** Empty-state sentinel: no fruit present. */
export const NO_FRUIT: BonusFruit = {
  pos: { ...FRUIT_SPAWN_POS },
  points: 0,
  spawnedAt: 0,
  ttl: 0,
};

/**
 * Convenience: the fruit kind label for a level (for HUD / renderer).
 * Delegates to the level config so fruit.ts stays the single source for
 * fruit spawning while levels.ts owns the value table.
 */
export function fruitKindForLevel(level: number): string {
  return getLevelConfig(level).fruitKind;
}
