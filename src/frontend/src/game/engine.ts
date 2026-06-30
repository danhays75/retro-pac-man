/**
 * engine — core game simulation: the tick that updates Pac-Man and ghosts,
 * consumes pellets, drives the scatter/chase/frightened mode scheduler,
 * spawns bonus fruit, detects level completion, and checks collisions.
 *
 * The engine owns a mutable `GameState` (kept in a ref by the renderer) and
 * exposes a single `tick(deltaSeconds)` entry point driven by useGameLoop.
 * Ghost AI (targeting + movement) is delegated to ghostAI.ts; mode scheduling
 * to ghostModes.ts; ghost factory to ghosts.ts; maze source to mazes.ts via
 * levels.ts.
 */
import type {
  BonusFruit,
  GamePhase,
  Ghost,
  GhostMode,
  GridPos,
  MazeCell,
  MazeLayout,
  PacMan,
} from "@/types/game";
import { GHOST_EAT_CHAIN, SCORE } from "@/types/game";
import {
  FRUIT_SPAWN_THRESHOLDS,
  FRUIT_TTL_MS,
  isFruitExpired,
  makeFruit,
  shouldSpawnFruit,
} from "./fruit";
import {
  decideDirection,
  findBlinky,
  moveGhost,
  respawnEatenGhost,
} from "./ghostAI";
import {
  EATEN_SPEED_MULT,
  FRIGHTENED_SPEED_MULT,
  type ModeScheduler,
  createScheduler,
  ghostSpeedMultiplier,
  startFrightened,
  syncGhostModes,
  tickScheduler,
} from "./ghostModes";
import { TILE, createGhosts, isOnTileCenter, resetGhost } from "./ghosts";
import { getLevelConfig } from "./levels";
import { cloneMazeGrid, countPellets, getMaze } from "./mazes";
import {
  createPacMan,
  pixelToGrid,
  resetPacMan,
  setPacDir,
  tickPacMan,
} from "./pacman";

/** Distance (px) under which Pac-Man and a ghost are considered to collide. */
const COLLISION_RADIUS = TILE * 0.5;

/** Base ghost speed in pixels per second (matches Pac-Man's base ~11 tiles/s). */
const GHOST_BASE_SPEED = 11 * TILE;

export interface GameState {
  maze: MazeLayout;
  /** Mutable per-run grid (pellets get consumed). */
  grid: MazeCell[][];
  pac: PacMan;
  ghosts: Ghost[];
  fruit: BonusFruit | null;
  /** Remaining pellets in the grid. */
  pelletsLeft: number;
  /** Total pellets originally in the grid (for fruit spawn thresholds). */
  pelletsTotal: number;
  /** Scatter/chase/frightened mode scheduler. */
  scheduler: ModeScheduler;
  /** Index into GHOST_EAT_CHAIN for the current power-pellet combo. */
  frightChain: number;
  /** Seconds since the level started (for fruit spawn timing). */
  levelTime: number;
  /** Dots eaten this level (for fruit spawn thresholds). */
  dotsEaten: number;
  /** Fruit spawn slots already fired this level (indices into FRUIT_SPAWN_THRESHOLDS). */
  fruitSlotsFired: Set<number>;
  /** 1-indexed level number (drives difficulty + maze cycling). */
  level: number;
}

export interface TickCallbacks {
  onScore: (points: number) => void;
  onDotEat: () => void;
  onPowerPellet: () => void;
  onGhostEat: (ghost: Ghost, points: number) => void;
  onPacDeath: () => void;
  onLevelComplete: () => void;
  onFruitEat: (points: number) => void;
}

/** Build the initial game state for a given 1-indexed level. */
export function createState(level: number): GameState {
  const cfg = getLevelConfig(level);
  const maze = cfg.maze;
  const grid = cloneMazeGrid(maze);
  const pac = createPacMan(maze.pacSpawn);
  const ghosts = createGhosts(maze);
  const pelletsTotal = countPellets(grid);
  return {
    maze,
    grid,
    pac,
    ghosts,
    fruit: null,
    pelletsLeft: pelletsTotal,
    pelletsTotal,
    scheduler: createScheduler(level),
    frightChain: 0,
    levelTime: 0,
    dotsEaten: 0,
    fruitSlotsFired: new Set<number>(),
    level,
  };
}

/** Reset an existing state for a fresh attempt at the current level. */
export function resetState(state: GameState): void {
  state.grid = cloneMazeGrid(state.maze);
  resetPacMan(state.pac, state.maze.pacSpawn);
  state.ghosts = state.ghosts.map((g) => resetGhost(g, state.maze));
  state.fruit = null;
  state.pelletsLeft = countPellets(state.grid);
  state.scheduler = createScheduler(state.level);
  state.frightChain = 0;
  state.levelTime = 0;
  state.dotsEaten = 0;
  state.fruitSlotsFired = new Set<number>();
}

/** Push a direction from input into Pac-Man's queued turn. */
export function inputDirection(
  state: GameState,
  dir: import("@/types/game").Direction,
): void {
  setPacDir(state.pac, dir);
}

/**
 * The core game tick. Advances the mode scheduler, Pac-Man, ghosts (with
 * their targeting AI), consumes pellets, manages frightened mode, spawns/eats
 * fruit, and detects collisions + level completion.
 */
export function tick(
  state: GameState,
  deltaSeconds: number,
  phase: GamePhase,
  cb: TickCallbacks,
): GamePhase {
  if (phase !== "playing") return phase;

  const dtMs = deltaSeconds * 1000;
  state.levelTime += deltaSeconds;

  // 1. Advance the scatter/chase/frightened scheduler.
  const { scheduler, modeChanged } = tickScheduler(
    state.scheduler,
    dtMs,
    state.level,
  );
  state.scheduler = scheduler;
  // Apply the scheduler's effective mode to all ghosts (force-reverse on flip).
  state.ghosts = syncGhostModes(state.ghosts, state.scheduler, modeChanged);

  // 2. Advance Pac-Man.
  const { cell } = tickPacMan(state.pac, state.maze, deltaSeconds);

  // 3. Consume pellet at Pac-Man's cell.
  eatPellet(state, cell, cb);

  // 4. Advance ghosts with their targeting AI.
  tickGhosts(state, deltaSeconds);

  // 5. Fruit spawn / expire / eat.
  tickFruit(state, deltaSeconds, cb);

  // 6. Pac-Man / ghost collisions.
  const collided = checkGhostCollisions(state, cb);
  if (collided) return "dying";

  // 7. Level completion.
  if (state.pelletsLeft <= 0) {
    cb.onLevelComplete();
    return "levelComplete";
  }

  return "playing";
}

/**
 * Move each ghost one tick: at tile centers, decide the next direction via
 * the targeting AI, then advance. Eaten ghosts head home and respawn on
 * arrival. Speed scales with mode (frightened slower, eaten faster) and
 * level (ghostSpeedMultiplier).
 */
function tickGhosts(state: GameState, deltaSeconds: number): void {
  const blinky = findBlinky(state.ghosts) ?? state.ghosts[0];
  const levelMult = ghostSpeedMultiplier(state.level);
  const baseSpeed = GHOST_BASE_SPEED * levelMult * deltaSeconds;

  state.ghosts = state.ghosts.map((g) => {
    let ghost = g;

    // Eaten ghosts that reached the house door respawn into the global mode.
    if (ghost.mode === "eaten") {
      const doorRow = state.maze.ghostSpawns[1]?.row ?? 14;
      const gCell = pixelToGrid(ghost.pos);
      if (gCell.row >= doorRow) {
        const globalMode: "scatter" | "chase" = state.scheduler.frightenedActive
          ? state.scheduler.current
          : state.scheduler.current;
        ghost = respawnEatenGhost(ghost, globalMode);
      }
    }

    // At a tile center, choose the next direction via the targeting AI.
    if (isOnTileCenter(ghost.pos)) {
      const nextDir = decideDirection(ghost, state.pac, blinky, state.maze);
      ghost = { ...ghost, dir: nextDir };
    }

    // Speed depends on mode.
    let speed = baseSpeed;
    if (ghost.mode === "frightened") speed = baseSpeed * FRIGHTENED_SPEED_MULT;
    else if (ghost.mode === "eaten") speed = baseSpeed * EATEN_SPEED_MULT;

    return moveGhost(ghost, speed, state.maze);
  });
}

/** Eat the pellet at a grid cell, if present. */
function eatPellet(state: GameState, cell: GridPos, cb: TickCallbacks): void {
  const row = state.grid[cell.row];
  if (!row) return;
  const c = row[cell.col];
  if (!c || !c.hasPellet) return;

  if (c.kind === "dot") {
    c.hasPellet = false;
    state.pelletsLeft -= 1;
    state.dotsEaten += 1;
    cb.onScore(SCORE.DOT);
    cb.onDotEat();
  } else if (c.kind === "power") {
    c.hasPellet = false;
    state.pelletsLeft -= 1;
    state.dotsEaten += 1;
    cb.onScore(SCORE.POWER_PELT);
    // Trigger frightened mode via the scheduler.
    state.scheduler = startFrightened(state.scheduler);
    state.frightChain = 0;
    state.ghosts = syncGhostModes(state.ghosts, state.scheduler, false);
    cb.onPowerPellet();
  }
}

/** Check Pac-Man vs each ghost; eat frightened ghosts or kill Pac-Man. */
function checkGhostCollisions(state: GameState, cb: TickCallbacks): boolean {
  for (const g of state.ghosts) {
    const dx = g.pos.x - state.pac.pos.x;
    const dy = g.pos.y - state.pac.pos.y;
    if (Math.hypot(dx, dy) > COLLISION_RADIUS) continue;

    if (g.mode === "frightened") {
      // Eat the ghost: award escalating points, send it home.
      const pts = GHOST_EAT_CHAIN[state.frightChain] ?? SCORE.GHOST_BASE;
      state.frightChain = Math.min(
        state.frightChain + 1,
        GHOST_EAT_CHAIN.length - 1,
      );
      const idx = state.ghosts.indexOf(g);
      state.ghosts[idx] = { ...g, mode: "eaten" as GhostMode };
      cb.onGhostEat(g, pts);
      cb.onScore(pts);
    } else if (g.mode === "chase" || g.mode === "scatter") {
      // Pac-Man dies.
      state.pac.dying = true;
      cb.onPacDeath();
      return true;
    }
    // "eaten" ghosts pass through Pac-Man harmlessly on their way home.
  }
  return false;
}

/**
 * Spawn the bonus fruit at the classic dot-count thresholds, let it expire,
 * and let Pac-Man eat it. Uses fruit.ts for spawn logic + level-scaled value.
 */
function tickFruit(
  state: GameState,
  deltaSeconds: number,
  cb: TickCallbacks,
): void {
  // Check spawn thresholds against dots eaten this level.
  if (!state.fruit) {
    const slot = shouldSpawnFruit(state.dotsEaten, state.fruitSlotsFired);
    if (slot !== null) {
      state.fruitSlotsFired.add(slot);
      state.fruit = makeFruit(state.level, state.levelTime * 1000);
    }
  }

  if (state.fruit) {
    // Expire after TTL.
    if (isFruitExpired(state.fruit, state.levelTime * 1000)) {
      state.fruit = null;
      return;
    }
    // Eat check: Pac-Man on the fruit's tile.
    const pacCell = pixelToGrid(state.pac.pos);
    if (
      pacCell.col === state.fruit.pos.col &&
      pacCell.row === state.fruit.pos.row
    ) {
      cb.onFruitEat(state.fruit.points);
      cb.onScore(state.fruit.points);
      state.fruit = null;
    }
  }
  // Suppress unused-param lint while keeping the signature stable.
  void deltaSeconds;
  void FRUIT_TTL_MS;
  void FRUIT_SPAWN_THRESHOLDS;
}

/** Set all non-eaten ghosts to a mode (used by the ghost-AI task's mode timer). */
export function setGhostMode(state: GameState, mode: GhostMode): void {
  for (const g of state.ghosts) {
    if (g.mode !== "eaten" && g.mode !== "frightened") g.mode = mode;
  }
}
