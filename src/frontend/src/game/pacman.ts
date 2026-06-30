/**
 * pacman — Pac-Man entity logic: smooth grid-based movement, mouth animation,
 * four-direction turning with a queued "next direction", and tunnel wrapping.
 *
 * Movement model (classic arcade):
 *  - Pac-Man moves continuously in `dir` at a fixed speed (pixels per tick).
 *  - When the player presses a direction, it is stored in `nextDir` and applied
 *    at the next grid-aligned intersection or as a reverse mid-corridor.
 *  - Position is sub-grid (PixelPos) for smooth motion; collision uses the
 *    centered grid cell.
 *  - Tunnels wrap the pixel x to the opposite side when crossing the edge.
 */
import type {
  Direction,
  GridPos,
  MazeCell,
  MazeLayout,
  PacMan,
  PixelPos,
} from "@/types/game";
import { MAZE_COLS, TILE } from "./mazeData";

/** Pac-Man speed in pixels per second (classic ≈ 11 tiles/s at 60fps). */
export const PAC_SPEED = 11 * TILE; // 176 px/s

/** Direction unit vectors in pixel space. */
export const DIR_VEC: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

export const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
  none: "none",
};

/** Create a Pac-Man entity at a grid spawn. */
export function createPacMan(spawn: GridPos): PacMan {
  return {
    pos: gridToPixel(spawn),
    dir: "left",
    nextDir: "none",
    mouth: 0,
    dying: false,
  };
}

/** Convert grid coords to the centered pixel position of that cell. */
export function gridToPixel(g: GridPos): PixelPos {
  return { x: g.col * TILE + TILE / 2, y: g.row * TILE + TILE / 2 };
}

/** Convert a pixel position to the grid cell it is centered in. */
export function pixelToGrid(p: PixelPos): GridPos {
  return {
    col: Math.floor(p.x / TILE),
    row: Math.floor(p.y / TILE),
  };
}

/** True if a grid cell is walkable by Pac-Man (path/dot/power/tunnel). */
export function isWalkable(cell: MazeCell | undefined): boolean {
  if (!cell) return false;
  return (
    cell.kind === "path" ||
    cell.kind === "dot" ||
    cell.kind === "power" ||
    cell.kind === "tunnel"
  );
}

/** True if Pac-Man is centered enough on its current cell to make a turn. */
function isCenteredOnCell(p: PixelPos): boolean {
  const cx = Math.floor(p.x / TILE) * TILE + TILE / 2;
  const cy = Math.floor(p.y / TILE) * TILE + TILE / 2;
  return Math.abs(p.x - cx) < 1.5 && Math.abs(p.y - cy) < 1.5;
}

/**
 * Advance Pac-Man by `deltaSeconds`. Handles:
 *  - applying queued nextDir at intersections / reversals
 *  - wall-blocked movement (stop at the wall edge)
 *  - tunnel wrapping on tunnel rows
 *  - mouth animation phase
 *
 * Returns the grid cell Pac-Man is currently centered in (for pellet eating).
 */
export function tickPacMan(
  pac: PacMan,
  maze: MazeLayout,
  deltaSeconds: number,
): { cell: GridPos; moved: boolean } {
  if (pac.dying) return { cell: pixelToGrid(pac.pos), moved: false };

  // Mouth animation: oscillate 0..1 while moving.
  if (pac.dir !== "none") {
    pac.mouth = (pac.mouth + deltaSeconds * 8) % 1;
  }

  // Try to apply queued turn at the next cell center.
  const grid = pixelToGrid(pac.pos);
  if (
    pac.nextDir !== "none" &&
    pac.nextDir !== pac.dir &&
    isCenteredOnCell(pac.pos)
  ) {
    if (canMove(pac.pos, pac.nextDir, maze)) {
      // Snap to cell center to avoid drift, then turn.
      pac.pos = gridToPixel(grid);
      pac.dir = pac.nextDir;
      pac.nextDir = "none";
    }
  }

  // Move in the current direction.
  const v = DIR_VEC[pac.dir];
  const step = PAC_SPEED * deltaSeconds;
  let nx = pac.pos.x + v.x * step;
  let ny = pac.pos.y + v.y * step;

  // Wall blocking: if the next cell ahead is a wall/door, clamp to the edge
  // of the current cell so Pac-Man stops flush against it.
  if (pac.dir !== "none" && !canMove(pac.pos, pac.dir, maze)) {
    // Clamp to current cell center along the movement axis.
    const cx = Math.floor(pac.pos.x / TILE) * TILE + TILE / 2;
    const cy = Math.floor(pac.pos.y / TILE) * TILE + TILE / 2;
    if (pac.dir === "left" || pac.dir === "right") nx = cx;
    else ny = cy;
  }

  // Tunnel wrap: on tunnel rows, wrap x across the maze width.
  const row = Math.floor(ny / TILE);
  if (maze.tunnelRows.includes(row)) {
    if (nx < -TILE / 2) nx = MAZE_COLS * TILE + TILE / 2;
    else if (nx > MAZE_COLS * TILE + TILE / 2) nx = -TILE / 2;
  }

  pac.pos.x = nx;
  pac.pos.y = ny;

  return { cell: pixelToGrid(pac.pos), moved: step > 0 };
}

/** Whether Pac-Man at `pos` can step one pixel in `dir` without hitting a wall. */
function canMove(pos: PixelPos, dir: Direction, maze: MazeLayout): boolean {
  if (dir === "none") return false;
  const v = DIR_VEC[dir];
  // Probe the cell just ahead of Pac-Man's leading edge.
  const probeX = pos.x + v.x * (TILE / 2 + 0.5);
  const probeY = pos.y + v.y * (TILE / 2 + 0.5);
  const col = Math.floor(probeX / TILE);
  const row = Math.floor(probeY / TILE);
  // Tunnels are always passable (wrap handled separately).
  if (col < 0 || col >= MAZE_COLS) return true;
  if (row < 0 || row >= maze.height) return false;
  return isWalkable(maze.grid[row]?.[col]);
}

/** Queue a new direction (called by input handlers). */
export function setPacDir(pac: PacMan, dir: Direction): void {
  // Instant reverse mid-corridor is allowed (classic behavior).
  if (dir === OPPOSITE[pac.dir]) {
    pac.dir = dir;
    pac.nextDir = "none";
    return;
  }
  pac.nextDir = dir;
}

/** Reset Pac-Man to its spawn position and idle state. */
export function resetPacMan(pac: PacMan, spawn: GridPos): void {
  pac.pos = gridToPixel(spawn);
  pac.dir = "left";
  pac.nextDir = "none";
  pac.mouth = 0;
  pac.dying = false;
}
