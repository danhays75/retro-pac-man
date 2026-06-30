/**
 * ghostAI.ts — original arcade ghost targeting AI and movement.
 *
 * Each ghost picks a target tile based on its personality and current mode,
 * then at each intersection chooses the neighbor (excluding reverse) with the
 * shortest squared distance to that target. Ties break in the classic order
 * up > left > down > right.
 *
 * Modes:
 *  - scatter:  target the ghost's scatter corner.
 *  - chase:    personality-specific target (see below).
 *  - frightened: random valid turn at intersections, slower.
 *  - eaten:    target the ghost-house door; respawn on arrival.
 *
 * Movement is grid-based: ghosts advance pixel-by-pixel but only commit to a
 * new direction when centered on a tile. Reverse direction is forbidden
 * except when a mode change forces it (handled by the caller via setMode).
 */
import type {
  Direction,
  Ghost,
  GhostId,
  GridPos,
  MazeLayout,
  PacMan,
} from "@/types/game";
import {
  CARDINAL,
  ghostHouseDoor,
  opposite,
  pixelToGrid,
  reachedHouseDoor,
  snapToTileCenter,
} from "./ghosts";

/** Squared tile distance — avoids sqrt; sufficient for comparisons. */
function distSq(a: GridPos, b: GridPos): number {
  const dc = a.col - b.col;
  const dr = a.row - b.row;
  return dc * dc + dr * dr;
}

/** Whether a cell is walkable for a ghost in the given mode. */
function isWalkable(
  maze: MazeLayout,
  cell: GridPos,
  mode: Ghost["mode"],
): boolean {
  if (cell.row < 0 || cell.row >= maze.height) return false;
  if (cell.col < 0 || cell.col >= maze.width) return false;
  const kind = maze.grid[cell.row]?.[cell.col]?.kind;
  if (!kind) return false;
  // Eaten ghosts (eyes) can pass through the door to re-enter the house.
  if (kind === "door") return mode === "eaten";
  return kind !== "wall";
}

/** The neighbor tile in a direction. */
function neighbor(cell: GridPos, dir: Direction): GridPos {
  switch (dir) {
    case "up":
      return { col: cell.col, row: cell.row - 1 };
    case "down":
      return { col: cell.col, row: cell.row + 1 };
    case "left":
      return { col: cell.col - 1, row: cell.row };
    case "right":
      return { col: cell.col + 1, row: cell.row };
    default:
      return cell;
  }
}

/** All walkable neighbors, excluding reverse (classic arcade rule). */
function validTurns(
  ghost: Ghost,
  maze: MazeLayout,
): Array<{ dir: Direction; cell: GridPos }> {
  const here = pixelToGrid(ghost.pos);
  const back = opposite(ghost.dir);
  const out: Array<{ dir: Direction; cell: GridPos }> = [];
  for (const dir of CARDINAL) {
    if (dir === back) continue; // no reversing
    const cell = neighbor(here, dir);
    if (isWalkable(maze, cell, ghost.mode)) {
      out.push({ dir, cell });
    }
  }
  return out;
}

/**
 * Choose the turn whose tile is closest to the target (classic rule).
 * Ties break in CARDINAL order: up, left, down, right.
 */
function chooseClosest(
  ghost: Ghost,
  maze: MazeLayout,
  target: GridPos,
): Direction {
  const turns = validTurns(ghost, maze);
  if (turns.length === 0) {
    // Dead end (rare): allow reversing as a fallback.
    return opposite(ghost.dir);
  }
  let best = turns[0];
  let bestD = distSq(best.cell, target);
  for (let i = 1; i < turns.length; i++) {
    const d = distSq(turns[i].cell, target);
    if (d < bestD) {
      best = turns[i];
      bestD = d;
    }
  }
  return best.dir;
}

/** Choose a random valid turn (frightened mode). */
function chooseRandom(ghost: Ghost, maze: MazeLayout): Direction {
  const turns = validTurns(ghost, maze);
  if (turns.length === 0) return opposite(ghost.dir);
  return turns[Math.floor(Math.random() * turns.length)].dir;
}

/** Two tiles ahead of Pac-Man in his facing direction. */
function twoAhead(pac: PacMan): GridPos {
  const here = pixelToGrid(pac.pos);
  let ahead = here;
  for (let i = 0; i < 2; i++) ahead = neighbor(ahead, pac.dir);
  return ahead;
}

/** Four tiles ahead of Pac-Man (Pinky's chase target). */
function fourAhead(pac: PacMan): GridPos {
  const here = pixelToGrid(pac.pos);
  let ahead = here;
  for (let i = 0; i < 4; i++) ahead = neighbor(ahead, pac.dir);
  return ahead;
}

/**
 * Per-ghost chase target tile.
 *  Blinky: Pac-Man's tile directly.
 *  Pinky: 4 tiles ahead of Pac-Man.
 *  Inky: 2 tiles ahead of Pac-Man, reflected through Blinky's tile.
 *  Clyde: Pac-Man's tile if >8 tiles away, else scatter corner.
 */
export function chaseTarget(
  ghost: Ghost,
  pac: PacMan,
  blinky: Ghost,
  maze: MazeLayout,
): GridPos {
  const pacTile = pixelToGrid(pac.pos);
  switch (ghost.id) {
    case "blinky":
      return pacTile;
    case "pinky":
      return fourAhead(pac);
    case "inky": {
      const ahead = twoAhead(pac);
      const b = pixelToGrid(blinky.pos);
      // Reflect Blinky through the 2-ahead point: target = 2*ahead - blinky.
      return { col: 2 * ahead.col - b.col, row: 2 * ahead.row - b.row };
    }
    case "clyde": {
      const here = pixelToGrid(ghost.pos);
      const d = distSq(here, pacTile);
      // >8 tiles (squared 64) → chase; else retreat to scatter corner.
      if (d > 64) return pacTile;
      return maze.scatterCorners[ghost.scatterIndex] ?? pacTile;
    }
    default:
      return pacTile;
  }
}

/** Scatter target: the ghost's assigned corner. */
export function scatterTarget(ghost: Ghost, maze: MazeLayout): GridPos {
  return maze.scatterCorners[ghost.scatterIndex] ?? { col: 0, row: 0 };
}

/**
 * Decide the next direction for a ghost at an intersection.
 * Called by the game loop when the ghost is centered on a tile.
 */
export function decideDirection(
  ghost: Ghost,
  pac: PacMan,
  blinky: Ghost,
  maze: MazeLayout,
): Direction {
  switch (ghost.mode) {
    case "frightened":
      return chooseRandom(ghost, maze);
    case "eaten": {
      const door = ghostHouseDoor(maze);
      if (reachedHouseDoor(ghost, door)) return "down"; // descend into house
      return chooseClosest(ghost, maze, door);
    }
    case "scatter":
      return chooseClosest(ghost, maze, scatterTarget(ghost, maze));
    case "chase":
      return chooseClosest(ghost, maze, chaseTarget(ghost, pac, blinky, maze));
    default:
      return ghost.dir;
  }
}

/**
 * Advance a ghost one step along its current direction.
 * Speed is in pixels per tick. Handles tunnel wrap on tunnel rows.
 */
export function moveGhost(
  ghost: Ghost,
  speed: number,
  maze: MazeLayout,
): Ghost {
  let { x, y } = ghost.pos;
  switch (ghost.dir) {
    case "up":
      y -= speed;
      break;
    case "down":
      y += speed;
      break;
    case "left":
      x -= speed;
      break;
    case "right":
      x += speed;
      break;
    default:
      return ghost;
  }

  // Tunnel wrap: if the ghost left the grid on a tunnel row, wrap around.
  const row = Math.floor(y / 16);
  if (maze.tunnelRows.includes(row)) {
    if (x < -8) x = maze.width * 16 + 8;
    else if (x > maze.width * 16 + 8) x = -8;
  }

  return { ...ghost, pos: { x, y } };
}

/**
 * Apply a mode change to a ghost. When switching between scatter/chase the
 * classic arcade forces a reverse; frightened/eaten do not force reverse.
 * Returns the updated ghost (with snapped position so the new direction
 * starts cleanly from a tile center).
 */
export function applyModeChange(ghost: Ghost, newMode: Ghost["mode"]): Ghost {
  if (ghost.mode === newMode) return ghost;
  // Scatter <-> chase forces a direction reversal (classic arcade rule).
  const forceReverse =
    (ghost.mode === "scatter" && newMode === "chase") ||
    (ghost.mode === "chase" && newMode === "scatter");
  return {
    ...ghost,
    mode: newMode,
    dir: forceReverse ? opposite(ghost.dir) : ghost.dir,
    pos: snapToTileCenter(ghost.pos),
  };
}

/**
 * Respawn an eaten ghost that has reached the house door back into chase
 * (or current global) mode. Called by the loop when reachedHouseDoor is true.
 */
export function respawnEatenGhost(
  ghost: Ghost,
  globalMode: "scatter" | "chase",
): Ghost {
  return {
    ...ghost,
    mode: globalMode,
    leftHouse: true,
  };
}

/** Find Blinky by id (used as Inky's reference point). */
export function findBlinky(ghosts: Ghost[]): Ghost | undefined {
  return ghosts.find((g) => g.id === "blinky");
}

/** Look up a ghost by id. */
export function ghostById(ghosts: Ghost[], id: GhostId): Ghost | undefined {
  return ghosts.find((g) => g.id === id);
}
