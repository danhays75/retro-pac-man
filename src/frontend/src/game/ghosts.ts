/**
 * ghosts.ts — ghost entity factory, color tokens, scatter-corner mapping,
 * and ghost-house release timing.
 *
 * The four classic ghosts (Blinky, Pinky, Inky, Clyde) are created here with
 * their canonical color tokens and scatter-corner indices. Release timing
 * follows the original arcade pattern: Blinky leaves immediately, the others
 * leave on a timed schedule (with a dot-count fallback so a stalled player
 * still gets released).
 *
 * Movement and AI live in ghostAI.ts; mode scheduling lives in ghostModes.ts.
 */
import type {
  Direction,
  Ghost,
  GhostId,
  GridPos,
  MazeLayout,
  PixelPos,
} from "@/types/game";

/** Tile size in CSS pixels — shared with the renderer. */
export const TILE = 16;

/** Canonical ghost order — matches MazeLayout.ghostSpawns / scatterCorners. */
export const GHOST_ORDER: GhostId[] = ["blinky", "pinky", "inky", "clyde"];

/**
 * Color token per ghost. Maps to the --chart-N tokens in index.css:
 *  chart-1 Blinky red, chart-2 Pinky pink, chart-3 Inky cyan,
 *  chart-4 Clyde orange, chart-5 frightened blue.
 */
export const GHOST_COLOR_TOKEN: Record<GhostId, Ghost["colorToken"]> = {
  blinky: "chart-1",
  pinky: "chart-2",
  inky: "chart-3",
  clyde: "chart-4",
};

/** Scatter-corner index per ghost (into MazeLayout.scatterCorners). */
export const GHOST_SCATTER_INDEX: Record<GhostId, number> = {
  blinky: 0, // top-right
  pinky: 1, // top-left
  inky: 2, // bottom-right
  clyde: 3, // bottom-left
};

/** Convert grid coords to centered pixel coords. */
export function gridToPixel(pos: GridPos): PixelPos {
  return { x: pos.col * TILE + TILE / 2, y: pos.row * TILE + TILE / 2 };
}

/** Convert pixel coords to the containing grid cell. */
export function pixelToGrid(pos: PixelPos): GridPos {
  return {
    col: Math.floor(pos.x / TILE),
    row: Math.floor(pos.y / TILE),
  };
}

/**
 * True when a ghost is centered on its current tile (within a small epsilon).
 * This is the moment ghosts are allowed to choose a new direction.
 */
export function isOnTileCenter(pos: PixelPos, eps = 0.5): boolean {
  const cx = Math.floor(pos.x / TILE) * TILE + TILE / 2;
  const cy = Math.floor(pos.y / TILE) * TILE + TILE / 2;
  return Math.abs(pos.x - cx) <= eps && Math.abs(pos.y - cy) <= eps;
}

/** Snap a pixel position to the center of its current tile. */
export function snapToTileCenter(pos: PixelPos): PixelPos {
  return {
    x: Math.floor(pos.x / TILE) * TILE + TILE / 2,
    y: Math.floor(pos.y / TILE) * TILE + TILE / 2,
  };
}

/**
 * Build the four ghosts at their spawn positions for a level.
 * Blinky starts outside the house facing left; the others start inside.
 */
export function createGhosts(maze: MazeLayout): Ghost[] {
  return GHOST_ORDER.map((id, i) => {
    const spawn = maze.ghostSpawns[i];
    if (!spawn) {
      throw new Error(`Maze "${maze.name}" missing ghostSpawns[${i}]`);
    }
    const pos = gridToPixel(spawn);
    return {
      id,
      pos,
      // Blinky faces left (toward the maze); others face up inside the house.
      dir: id === "blinky" ? "left" : "up",
      nextDir: "none",
      mode: id === "blinky" ? "scatter" : "scatter",
      colorToken: GHOST_COLOR_TOKEN[id],
      scatterIndex: GHOST_SCATTER_INDEX[id],
      leftHouse: id === "blinky",
    };
  });
}

/**
 * Per-level release schedule (ms from level start) for each ghost.
 * Classic arcade: Blinky out at 0, Pinky ~0s but bobbing, Inky/Clyde later.
 * We use a simple timed ladder; the dot-count fallback (see below) ensures
 * release even if the player idles.
 */
export function releaseSchedule(level: number): Record<GhostId, number> {
  // Higher levels release faster.
  const accel = Math.max(0.4, 1 - (level - 1) * 0.08);
  return {
    blinky: 0,
    pinky: Math.round(2000 * accel),
    inky: Math.round(6000 * accel),
    clyde: Math.round(10000 * accel),
  };
}

/**
 * Dot-count fallback thresholds (classic arcade "global dot counter").
 * If a ghost hasn't been released by the time the player eats this many dots
 * since level start, it is force-released. Prevents a stuck game.
 */
export const RELEASE_DOT_FALLBACK: Record<GhostId, number> = {
  blinky: 0,
  pinky: 30,
  inky: 60,
  clyde: 90,
};

/** Ghost-house door tile (the cell ghosts aim for when eaten). */
export function ghostHouseDoor(maze: MazeLayout): GridPos {
  // The door sits directly above the first ghost spawn (the house center).
  const center = maze.ghostSpawns[1] ?? maze.ghostSpawns[0];
  if (!center) return { col: 13, row: 11 };
  return { col: center.col, row: center.row - 2 };
}

/** Whether a ghost has reached the house door (used to respawn after eaten). */
export function reachedHouseDoor(ghost: Ghost, door: GridPos): boolean {
  const g = pixelToGrid(ghost.pos);
  return g.col === door.col && g.row === door.row;
}

/** Reset a single ghost to its spawn (after Pac-Man dies). */
export function resetGhost(ghost: Ghost, maze: MazeLayout): Ghost {
  const idx = GHOST_ORDER.indexOf(ghost.id);
  const spawn = maze.ghostSpawns[idx];
  if (!spawn) return ghost;
  return {
    ...ghost,
    pos: gridToPixel(spawn),
    dir: ghost.id === "blinky" ? "left" : "up",
    nextDir: "none",
    mode: "scatter",
    leftHouse: ghost.id === "blinky",
  };
}

/** The four cardinal directions in a stable order for AI iteration. */
export const CARDINAL: Direction[] = ["up", "left", "down", "right"];

/** Opposite direction (used to forbid reversing except on mode change). */
export function opposite(dir: Direction): Direction {
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
