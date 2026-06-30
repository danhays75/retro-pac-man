/**
 * Shared game types for the Pac-Man arcade game.
 * These types are consumed by the game store, hooks, and canvas renderer.
 */

/** Cardinal movement directions. `None` is used for stationary entities. */
export type Direction = "up" | "down" | "left" | "right" | "none";

/** Grid cell coordinates (column, row). */
export interface GridPos {
  col: number;
  row: number;
}

/** Pixel-space coordinates for smooth sub-grid movement. */
export interface PixelPos {
  x: number;
  y: number;
}

/** Maze cell kinds. Walls are neon-blue; paths hold pellets or are empty. */
export type CellKind =
  | "wall" // neon-blue wall
  | "path" // walkable, no pellet
  | "dot" // walkable, small pellet (10 pts)
  | "power" // walkable, power pellet (50 pts)
  | "door" // ghost-house exit door (impassable to Pac-Man)
  | "tunnel"; // walkable tunnel marker (wraps to opposite side)

/** A single cell in the maze grid. */
export interface MazeCell {
  kind: CellKind;
  /** Whether this cell still holds its pellet (consumed on eat). */
  hasPellet: boolean;
}

/** A complete maze layout: a 2D grid plus metadata. */
export interface MazeLayout {
  id: number;
  name: string;
  /** Grid of cells, indexed [row][col]. */
  grid: MazeCell[][];
  width: number;
  height: number;
  /** Tunnel row(s) that wrap left<->right. */
  tunnelRows: number[];
  /** Pac-Man's spawn position (grid coords). */
  pacSpawn: GridPos;
  /** Ghost-house spawn positions for the four ghosts (grid coords). */
  ghostSpawns: GridPos[];
  /** Scatter-mode corner targets for each ghost (grid coords). */
  scatterCorners: GridPos[];
}

/** The four classic ghosts, each with distinct targeting AI. */
export type GhostId = "blinky" | "pinky" | "inky" | "clyde";

/** Ghost behavioral modes following the original arcade. */
export type GhostMode = "scatter" | "chase" | "frightened" | "eaten";

/** A ghost entity with position, mode, and AI state. */
export interface Ghost {
  id: GhostId;
  pos: PixelPos;
  dir: Direction;
  nextDir: Direction;
  mode: GhostMode;
  /** Color token name from chart-1..5 mapping. */
  colorToken: "chart-1" | "chart-2" | "chart-3" | "chart-4";
  /** Scatter corner index into MazeLayout.scatterCorners. */
  scatterIndex: number;
  /** Whether the ghost has left the ghost house this life. */
  leftHouse: boolean;
}

/** Pac-Man entity. */
export interface PacMan {
  pos: PixelPos;
  dir: Direction;
  nextDir: Direction;
  /** Mouth animation phase 0..1. */
  mouth: number;
  /** Whether Pac-Man is currently dying (death animation). */
  dying: boolean;
}

/** High-level game phases driving the UI overlays. */
export type GamePhase =
  | "boot" // initial load
  | "start" // start screen
  | "ready" // "READY!" countdown before a level
  | "playing" // active gameplay
  | "paused" // user-paused
  | "levelComplete" // maze cleared, transition
  | "gameOver" // all lives lost
  | "dying"; // death animation playing

/** Bonus fruit that appears periodically for extra points. */
export interface BonusFruit {
  pos: GridPos;
  /** Points awarded when eaten. */
  points: number;
  /** ms timestamp when the fruit spawned; 0 means no fruit. */
  spawnedAt: number;
  /** ms the fruit stays before disappearing. */
  ttl: number;
}

/** Scoring constants — classic arcade values. */
export const SCORE = {
  DOT: 10,
  POWER_PELT: 50,
  GHOST_BASE: 200,
  FRUIT: 100,
} as const;

/** Escalating ghost-eat values per power pellet: 200, 400, 800, 1600. */
export const GHOST_EAT_CHAIN = [200, 400, 800, 1600] as const;

/** Starting lives. */
export const START_LIVES = 3;

/** Maximum level index (mazes cycle beyond this). */
export const MAX_MAZE_INDEX = 3;
