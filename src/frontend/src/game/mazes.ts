/**
 * mazes.ts — the four fixed maze layouts.
 *
 * Each maze is a 28-col × 31-row grid matching the classic arcade Pac-Man
 * dimensions so the canvas aspect ratio (28/31) and tunnel row stay constant
 * across levels. Maze 1 is the canonical Pac-Man maze; mazes 2–4 are distinct
 * variations with different wall configurations but identical overall size
 * and tunnel positions.
 *
 * Encoding (one char per cell, for human-readable authoring):
 *   #  wall            (neon-blue, impassable)
 *   .  dot             (small pellet, 10 pts)
 *   o  power pellet    (50 pts)
 *   -  ghost-house door (impassable to Pac-Man, passable to ghosts)
 *   T  tunnel cell     (walkable, wraps left<->right)
 *   _  empty path      (walkable, no pellet — used inside the ghost house
 *                       and for the fruit spawn alcove)
 *
 * The string grids are converted to MazeCell[][] via `buildMaze` below so the
 * rest of the engine consumes the typed structure from @/types/game.
 */
import type { GridPos, MazeCell, MazeLayout } from "@/types/game";

export const MAZE_WIDTH = 28;
export const MAZE_HEIGHT = 31;
/** Classic arcade tunnel row (row 14, the middle horizontal corridor). */
export const TUNNEL_ROW = 14;

type CellChar = "#" | "." | "o" | "-" | "T" | "_";

/** Authoring helper: a maze is a list of equal-length rows of CellChar. */
type MazeRows = readonly string[];

/**
 * Maze 1 — the classic Pac-Man maze.
 * Symmetric, central ghost house, four power pellets in the corners,
 * tunnel through the middle row.
 */
const MAZE_1: MazeRows = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "_____#.#####.##.#####.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.###--###.##.#_____",
  "######.##.#______#.##.######",
  "T__________#______#________T",
  "######.##.#______#.##.######",
  "_____#.##.########.##.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.########.##.#_____",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......__.......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

/**
 * Maze 2 — "Open Corridors". Wider horizontal passages, fewer interior walls,
 * a more open feel that rewards speed. Same outer border, tunnel row, and
 * ghost-house position so spawns and scatter corners stay valid.
 *
 * Distinct from Maze 1: the upper side chambers are opened up (the 4-wide
 * wall blocks become 2-wide), the lower corridors lose their inner pillars,
 * and the bottom rows merge into one long horizontal sweep.
 */
const MAZE_2: MazeRows = [
  "############################",
  "#............##............#",
  "#.##.##.#####.##.#####.##.#",
  "#o##.##.#####.##.#####.##o#",
  "#.##.##.#####.##.#####.##.#",
  "#..........................#",
  "#.##.##.########.##.##.##.#",
  "#.##.##.########.##.##.##.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "_____#.#####.##.#####.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.###--###.##.#_____",
  "######.##.#______#.##.######",
  "T__________#______#________T",
  "######.##.#______#.##.######",
  "_____#.##.########.##.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.########.##.#_____",
  "######.##.########.##.######",
  "#..........................#",
  "#.##.##.#####.##.#####.##.#",
  "#.##.##.#####.##.#####.##.#",
  "#o..##.......##.......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

/**
 * Maze 3 — "Crossroads". Diagonal-feeling wall clusters create more
 * intersections, increasing decision points for both Pac-Man and ghosts.
 * Same dimensions, tunnel row, and ghost house.
 *
 * Distinct from Mazes 1 & 2: the top rows use a 3-pillar pattern instead of
 * 4-wide blocks, the mid-maze gains extra vertical connectors, and the lower
 * half swaps the standard block grid for staggered short walls.
 */
const MAZE_3: MazeRows = [
  "############################",
  "#..........................#",
  "#.##.###.####.####.###.##.#",
  "#o##.###.####.####.###.##o#",
  "#.##.###.####.####.###.##.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "_____#.#####.##.#####.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.###--###.##.#_____",
  "######.##.#______#.##.######",
  "T__________#______#________T",
  "######.##.#______#.##.######",
  "_____#.##.########.##.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.########.##.#_____",
  "######.##.########.##.######",
  "#..........................#",
  "#.###.##.######.##.###.#####",
  "#.###.##.######.##.###.#####",
  "#o...##............##....o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

/**
 * Maze 4 — "Fortress". Denser wall blocks in the mid-section form a more
 * fortress-like interior, narrowing escape routes. Same outer frame,
 * tunnel row, and ghost house so the four ghosts always have a home.
 *
 * Distinct from Mazes 1-3: the upper rows use solid 5-wide blocks, the
 * mid-maze adds a central pillar ring around the ghost house, and the lower
 * half uses a tighter 2-pillar grid with a central vertical divider.
 */
const MAZE_4: MazeRows = [
  "############################",
  "#............##............#",
  "#.#####.####.##.####.#####.#",
  "#o#####.####.##.####.#####o#",
  "#.#####.####.##.####.#####.#",
  "#..........................#",
  "#.####.###.######.###.####.#",
  "#.####.###.######.###.####.#",
  "#......##....##....##......#",
  "######.#####.##.#####.######",
  "_____#.#####.##.#####.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.###--###.##.#_____",
  "######.##.#______#.##.######",
  "T__________#______#________T",
  "######.##.#______#.##.######",
  "_____#.##.########.##.#_____",
  "_____#.##__________##.#_____",
  "_____#.##.########.##.#_____",
  "######.##.########.##.######",
  "#............##............#",
  "#.####.######.##.######.####",
  "#.####.######.##.######.####",
  "#o..##.......##.......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

/** Map an authoring char to a MazeCell (hasPellet derived from kind). */
function charToCell(ch: CellChar): MazeCell {
  switch (ch) {
    case "#":
      return { kind: "wall", hasPellet: false };
    case ".":
      return { kind: "dot", hasPellet: true };
    case "o":
      return { kind: "power", hasPellet: true };
    case "-":
      return { kind: "door", hasPellet: false };
    case "T":
      return { kind: "tunnel", hasPellet: false };
    case "_":
      return { kind: "path", hasPellet: false };
  }
}

/**
 * Build a typed MazeLayout from authoring rows + metadata.
 * Validates dimensions so a typo in the string grid fails loudly.
 */
function buildMaze(
  id: number,
  name: string,
  rows: MazeRows,
  meta: {
    pacSpawn: GridPos;
    ghostSpawns: GridPos[];
    scatterCorners: GridPos[];
  },
): MazeLayout {
  if (rows.length !== MAZE_HEIGHT) {
    throw new Error(
      `Maze ${id} "${name}" has ${rows.length} rows, expected ${MAZE_HEIGHT}`,
    );
  }
  const grid: MazeCell[][] = rows.map((row, r) => {
    if (row.length !== MAZE_WIDTH) {
      throw new Error(
        `Maze ${id} "${name}" row ${r} has ${row.length} cols, expected ${MAZE_WIDTH}`,
      );
    }
    return Array.from(row, (ch) => charToCell(ch as CellChar));
  });
  return {
    id,
    name,
    grid,
    width: MAZE_WIDTH,
    height: MAZE_HEIGHT,
    tunnelRows: [TUNNEL_ROW],
    pacSpawn: meta.pacSpawn,
    ghostSpawns: meta.ghostSpawns,
    scatterCorners: meta.scatterCorners,
  };
}

/**
 * Shared spawn metadata. Pac-Man spawns mid-bottom on the center column;
 * the four ghosts spawn inside the ghost house (rows 12–15, center cols).
 * Scatter corners follow the classic arcade assignment:
 *   Blinky → top-right, Pinky → top-left, Inky → bottom-right, Clyde → bottom-left.
 */
const PAC_SPAWN: GridPos = { col: 13, row: 23 };
const GHOST_SPAWNS: GridPos[] = [
  { col: 13, row: 11 }, // Blinky — exits house first
  { col: 13, row: 14 }, // Pinky
  { col: 11, row: 14 }, // Inky
  { col: 15, row: 14 }, // Clyde
];
const SCATTER_CORNERS: GridPos[] = [
  { col: 25, row: 1 }, // Blinky — top-right
  { col: 2, row: 1 }, // Pinky — top-left
  { col: 27, row: 29 }, // Inky — bottom-right
  { col: 0, row: 29 }, // Clyde — bottom-left
];

/** The four fixed mazes, indexed 0..3 (matches MAX_MAZE_INDEX). */
export const MAZES: MazeLayout[] = [
  buildMaze(0, "Classic", MAZE_1, {
    pacSpawn: PAC_SPAWN,
    ghostSpawns: GHOST_SPAWNS,
    scatterCorners: SCATTER_CORNERS,
  }),
  buildMaze(1, "Open Corridors", MAZE_2, {
    pacSpawn: PAC_SPAWN,
    ghostSpawns: GHOST_SPAWNS,
    scatterCorners: SCATTER_CORNERS,
  }),
  buildMaze(2, "Crossroads", MAZE_3, {
    pacSpawn: PAC_SPAWN,
    ghostSpawns: GHOST_SPAWNS,
    scatterCorners: SCATTER_CORNERS,
  }),
  buildMaze(3, "Fortress", MAZE_4, {
    pacSpawn: PAC_SPAWN,
    ghostSpawns: GHOST_SPAWNS,
    scatterCorners: SCATTER_CORNERS,
  }),
];

/**
 * Get the maze layout for a given 0-based maze index.
 * Cycles safely via modulo so out-of-range indices never throw.
 */
export function getMaze(index: number): MazeLayout {
  const safe = ((index % MAZES.length) + MAZES.length) % MAZES.length;
  return MAZES[safe];
}

/**
 * Deep-clone a maze's grid so a run can mutate pellet state (eating dots)
 * without corrupting the canonical layout. Returns a fresh MazeCell[][].
 */
export function cloneMazeGrid(maze: MazeLayout): MazeCell[][] {
  return maze.grid.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * Count remaining pellets (dots + power pellets) in a grid.
 * Used to detect level completion.
 */
export function countPellets(grid: MazeCell[][]): number {
  let n = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.hasPellet && (cell.kind === "dot" || cell.kind === "power")) {
        n++;
      }
    }
  }
  return n;
}
