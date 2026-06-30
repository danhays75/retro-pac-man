/**
 * render — canvas rendering for the Pac-Man maze, pellets, Pac-Man, ghosts,
 * and bonus fruit. All drawing uses the design system's neon-arcade palette
 * (neon-blue walls on pure black, classic Pac-Man yellow, ghost chart tokens).
 *
 * The renderer is pure: it reads a GameState + phase and draws one frame to
 * the supplied 2D context. It does not own state or run the loop — the
 * GameRenderer component wires it into useGameLoop.
 */
import type {
  BonusFruit,
  GamePhase,
  Ghost,
  MazeLayout,
  PacMan,
} from "@/types/game";
import type { GameState } from "./engine";
import { type ModeScheduler, isFrightenedFlashing } from "./ghostModes";
import { TILE } from "./mazeData";

// ── Palette (matches index.css OKLCH tokens for visual consistency) ─────────
const COLORS = {
  wall: "#0063ff", // neon blue (--secondary)
  wallGlow: "rgba(0, 99, 255, 0.55)",
  door: "#ffb3c7", // pinkish ghost-house door
  dot: "#ffd9b3", // warm white pellet
  power: "#ffd9b3",
  pac: "#ffd400", // Pac-Man yellow (--primary)
  pacGlow: "rgba(255, 212, 0, 0.6)",
  frightened: "#2121ff", // frightened blue (--chart-5)
  frightenedFlash: "#ffffff",
  eatenEyes: "#ffffff",
  fruit: "#ff5a5a",
  text: "#ffd400",
} as const;

const GHOST_COLORS: Record<Ghost["colorToken"], string> = {
  "chart-1": "#ff3b3b", // Blinky red
  "chart-2": "#ff7fbf", // Pinky pink
  "chart-3": "#5ad7ff", // Inky cyan
  "chart-4": "#ff9a3c", // Clyde orange
};

/** Render a full frame. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  maze: MazeLayout,
  state: Pick<GameState, "pac" | "ghosts" | "fruit" | "scheduler">,
  view: {
    w: number;
    h: number;
    scale: number;
    offsetX: number;
    offsetY: number;
  },
  phase: GamePhase,
  time: number,
): void {
  // Clear to pure black.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.save();
  ctx.translate(view.offsetX, view.offsetY);
  ctx.scale(view.scale, view.scale);

  drawMaze(ctx, maze, time);
  // Pellets are drawn from the live mutated grid by the GameRenderer via
  // drawPelletsFromGrid — not here, where we only have the static layout.
  if (state.fruit) drawFruit(ctx, state.fruit, time);
  drawPacMan(ctx, state.pac, time);
  for (const g of state.ghosts) drawGhost(ctx, g, state.scheduler, time);

  ctx.restore();

  // Overlays (READY / GAME OVER) drawn in screen space by the component.
  if (phase === "ready") drawReadyText(ctx, view);
}

/** Compute the scale + offset to fit the maze inside the canvas viewport. */
export function computeView(
  maze: MazeLayout,
  canvasW: number,
  canvasH: number,
): { w: number; h: number; scale: number; offsetX: number; offsetY: number } {
  const mazeW = maze.width * TILE;
  const mazeH = maze.height * TILE;
  const scale = Math.min(canvasW / mazeW, canvasH / mazeH);
  const w = mazeW * scale;
  const h = mazeH * scale;
  return {
    w: canvasW,
    h: canvasH,
    scale,
    offsetX: (canvasW - w) / 2,
    offsetY: (canvasH - h) / 2,
  };
}

// ── Maze walls ──────────────────────────────────────────────────────────────
function drawMaze(
  ctx: CanvasRenderingContext2D,
  maze: MazeLayout,
  _time: number,
): void {
  ctx.lineWidth = 2;
  ctx.strokeStyle = COLORS.wall;
  ctx.shadowColor = COLORS.wallGlow;
  ctx.shadowBlur = 6;

  for (let r = 0; r < maze.height; r++) {
    for (let c = 0; c < maze.width; c++) {
      const cell = maze.grid[r][c];
      if (cell.kind === "wall") drawWallCell(ctx, maze, c, r);
      else if (cell.kind === "door") drawDoor(ctx, c, r);
    }
  }
  ctx.shadowBlur = 0;
}

/** Draw a wall cell as a neon-blue rounded segment, merging with neighbors. */
function drawWallCell(
  ctx: CanvasRenderingContext2D,
  maze: MazeLayout,
  col: number,
  row: number,
): void {
  const x = col * TILE;
  const y = row * TILE;
  const inset = 3;
  // Only draw edges that border a non-wall cell — gives the classic "outline"
  // look instead of solid blocks.
  const isWall = (c: number, r: number) =>
    c < 0 || c >= maze.width || r < 0 || r >= maze.height
      ? false
      : maze.grid[r][c].kind === "wall";

  ctx.beginPath();
  // Top edge
  if (!isWall(col, row - 1)) {
    ctx.moveTo(x + inset, y + inset);
    ctx.lineTo(x + TILE - inset, y + inset);
  }
  // Bottom edge
  if (!isWall(col, row + 1)) {
    ctx.moveTo(x + inset, y + TILE - inset);
    ctx.lineTo(x + TILE - inset, y + TILE - inset);
  }
  // Left edge
  if (!isWall(col - 1, row)) {
    ctx.moveTo(x + inset, y + inset);
    ctx.lineTo(x + inset, y + TILE - inset);
  }
  // Right edge
  if (!isWall(col + 1, row)) {
    ctx.moveTo(x + TILE - inset, y + inset);
    ctx.lineTo(x + TILE - inset, y + TILE - inset);
  }
  ctx.stroke();
}

function drawDoor(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
): void {
  ctx.strokeStyle = COLORS.door;
  ctx.beginPath();
  ctx.moveTo(col * TILE + 2, row * TILE + TILE / 2);
  ctx.lineTo(col * TILE + TILE - 2, row * TILE + TILE / 2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.wall;
}

// ── Pellets ─────────────────────────────────────────────────────────────────
/** Draw dots + power pellets from a (possibly mutated) grid. */
export function drawPelletsFromGrid(
  ctx: CanvasRenderingContext2D,
  grid: MazeLayout["grid"],
  time: number,
): void {
  ctx.fillStyle = COLORS.dot;
  ctx.shadowColor = COLORS.dot;
  ctx.shadowBlur = 2;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (!cell.hasPellet) continue;
      const cx = c * TILE + TILE / 2;
      const cy = r * TILE + TILE / 2;
      if (cell.kind === "dot") {
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell.kind === "power") {
        // Pulsing power pellet.
        const pulse = 0.75 + 0.25 * Math.sin(time * 6 + c + r);
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.shadowBlur = 0;
}

// ── Pac-Man ────────────────────────────────────────────────────────────────
function drawPacMan(
  ctx: CanvasRenderingContext2D,
  pac: PacMan,
  time: number,
): void {
  const { x, y } = pac.pos;
  const radius = TILE * 0.45;

  // Mouth opening oscillates with pac.mouth (0..1) → 0..0.7 rad.
  const mouthOpen = pac.dying
    ? Math.min(Math.PI, time * 4) // death: mouth opens wide
    : Math.abs(Math.sin(pac.mouth * Math.PI)) * 0.7;
  const facing = angleForDir(pac.dir);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(facing);
  ctx.shadowColor = COLORS.pacGlow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = COLORS.pac;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, mouthOpen, Math.PI * 2 - mouthOpen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.shadowBlur = 0;
}

function angleForDir(dir: PacMan["dir"]): number {
  switch (dir) {
    case "right":
      return 0;
    case "down":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "up":
      return -Math.PI / 2;
    default:
      return 0;
  }
}

// ── Ghosts ──────────────────────────────────────────────────────────────────
function drawGhost(
  ctx: CanvasRenderingContext2D,
  ghost: Ghost,
  scheduler: ModeScheduler,
  time: number,
): void {
  const { x, y } = ghost.pos;
  const r = TILE * 0.45;

  // Eaten ghosts: just eyes heading home.
  if (ghost.mode === "eaten") {
    drawGhostEyes(ctx, x, y, ghost.dir, COLORS.eatenEyes);
    return;
  }

  // Frightened ghosts flash white near the end of the frightened window.
  let body = GHOST_COLORS[ghost.colorToken];
  if (ghost.mode === "frightened") {
    const flashing =
      isFrightenedFlashing(scheduler) && Math.floor(time * 6) % 2 === 0;
    body = flashing ? COLORS.frightenedFlash : COLORS.frightened;
  }

  ctx.save();
  ctx.shadowColor = body;
  ctx.shadowBlur = 6;
  ctx.fillStyle = body;

  // Dome + wavy skirt.
  ctx.beginPath();
  ctx.arc(x, y - 1, r, Math.PI, 0);
  ctx.lineTo(x + r, y + r);
  // Wavy bottom hem (3 humps).
  const humps = 3;
  const w = (r * 2) / humps;
  for (let i = 0; i < humps; i++) {
    const sx = x + r - i * w;
    ctx.quadraticCurveTo(sx - w / 2, y + r - 4, sx - w, y + r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  if (ghost.mode === "frightened") {
    drawFrightenedFace(ctx, x, y, time);
  } else {
    drawGhostEyes(ctx, x, y, ghost.dir, "#ffffff");
  }
}

function drawGhostEyes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: Ghost["dir"],
  white: string,
): void {
  const eyeOffset = 4;
  const look = { x: 0, y: 0 };
  if (dir === "left") look.x = -1;
  else if (dir === "right") look.x = 1;
  else if (dir === "up") look.y = -1;
  else if (dir === "down") look.y = 1;

  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.arc(x - eyeOffset, y - 2, 3, 0, Math.PI * 2);
  ctx.arc(x + eyeOffset, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1aff";
  ctx.beginPath();
  ctx.arc(x - eyeOffset + look.x, y - 2 + look.y, 1.5, 0, Math.PI * 2);
  ctx.arc(x + eyeOffset + look.x, y - 2 + look.y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrightenedFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _time: number,
): void {
  ctx.fillStyle = "#ffffff";
  // Two small eyes.
  ctx.beginPath();
  ctx.arc(x - 4, y - 2, 1.5, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Wavy mouth.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 4);
  ctx.quadraticCurveTo(x - 2.5, y + 2, x, y + 4);
  ctx.quadraticCurveTo(x + 2.5, y + 6, x + 5, y + 4);
  ctx.stroke();
}

// ── Bonus fruit ─────────────────────────────────────────────────────────────
function drawFruit(
  ctx: CanvasRenderingContext2D,
  fruit: BonusFruit,
  _time: number,
): void {
  const cx = fruit.pos.col * TILE + TILE / 2;
  const cy = fruit.pos.row * TILE + TILE / 2;
  ctx.save();
  ctx.shadowColor = COLORS.fruit;
  ctx.shadowBlur = 6;
  ctx.fillStyle = COLORS.fruit;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  // Stem.
  ctx.strokeStyle = "#3c8c3c";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.lineTo(cx + 2, cy - 7);
  ctx.stroke();
  ctx.restore();
}

// ── READY! text ─────────────────────────────────────────────────────────────
function drawReadyText(
  ctx: CanvasRenderingContext2D,
  view: { w: number; h: number },
): void {
  ctx.save();
  ctx.fillStyle = COLORS.text;
  ctx.shadowColor = COLORS.pacGlow;
  ctx.shadowBlur = 8;
  ctx.font = "bold 18px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("READY!", view.w / 2, view.h / 2 + 40);
  ctx.restore();
}
