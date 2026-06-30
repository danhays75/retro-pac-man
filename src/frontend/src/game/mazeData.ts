/**
 * mazeData — shared maze constants.
 *
 * The canonical maze layouts live in `mazes.ts` (the single source of truth
 * for maze grids, spawns, and scatter corners). This module re-exports the
 * shared tile/size constants that the renderer and Pac-Man movement need,
 * so those modules don't reach into `mazes.ts` for low-level geometry.
 */
import type { MazeCell, MazeLayout } from "@/types/game";
import { getMaze } from "./mazes";

/** Logical pixels per maze cell — scaled by the canvas DPR at draw time. */
export const TILE = 16;

/** Maze width in columns (classic arcade = 28). */
export const MAZE_COLS = 28;

/** Maze height in rows (classic arcade = 31). */
export const MAZE_ROWS = 31;

// Re-exports so existing imports keep resolving while `mazes.ts` stays the
// single maze source.
export { cloneMazeGrid, countPellets } from "./mazes";

/** Get the maze for a given 1-indexed level (cycles through the layout set). */
export function getMazeForLevel(level: number): MazeLayout {
  return getMaze(level - 1);
}

/** Deep-clone a maze grid so pellet state can be mutated per-run. */
export function cloneGrid(grid: MazeCell[][]): MazeCell[][] {
  return grid.map((row) => row.map((c) => ({ ...c })));
}
