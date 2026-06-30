import type { GamePhase } from "@/types/game";
import { MAX_MAZE_INDEX, START_LIVES } from "@/types/game";
/**
 * Central game state store using zustand.
 * Holds score, lives, level, high score, game phase, and mute state.
 * The actual maze/ghost/pac-man simulation state lives in the game loop
 * (useGameLoop) and is rendered directly to canvas; this store tracks the
 * player-facing meta state that drives HUD and overlays.
 */
import { create } from "zustand";

export interface GameStoreState {
  /** Current player score for the active run. */
  score: number;
  /** Lives remaining. */
  lives: number;
  /** Current level (1-indexed). Mazes cycle every MAX_MAZE_INDEX levels. */
  level: number;
  /** Highest score persisted across sessions (loaded from backend). */
  highScore: number;
  /** Current game phase driving overlays. */
  phase: GamePhase;
  /** Whether sound effects are muted. */
  muted: boolean;
  /** Whether the high score has been loaded from the backend yet. */
  highScoreLoaded: boolean;

  // Actions
  setPhase: (phase: GamePhase) => void;
  addScore: (points: number) => void;
  resetScore: () => void;
  loseLife: () => void;
  resetLives: () => void;
  nextLevel: () => void;
  setHighScore: (score: number) => void;
  setHighScoreLoaded: (loaded: boolean) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  startGame: () => void;
  restartGame: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  score: 0,
  lives: START_LIVES,
  level: 1,
  highScore: 0,
  phase: "boot",
  muted: false,
  highScoreLoaded: false,

  setPhase: (phase) => set({ phase }),

  addScore: (points) => {
    const next = get().score + points;
    set({ score: next });
    if (next > get().highScore) {
      set({ highScore: next });
    }
  },

  resetScore: () => set({ score: 0 }),

  loseLife: () => {
    const remaining = get().lives - 1;
    if (remaining <= 0) {
      set({ lives: 0, phase: "gameOver" });
    } else {
      set({ lives: remaining });
    }
  },

  resetLives: () => set({ lives: START_LIVES }),

  nextLevel: () => set({ level: get().level + 1 }),

  setHighScore: (score) =>
    set((s) => ({ highScore: Math.max(score, s.highScore) })),

  setHighScoreLoaded: (loaded) => set({ highScoreLoaded: loaded }),

  toggleMute: () => set((s) => ({ muted: !s.muted })),

  setMuted: (muted) => set({ muted }),

  startGame: () =>
    set({
      score: 0,
      lives: START_LIVES,
      level: 1,
      phase: "ready",
    }),

  restartGame: () =>
    set({
      score: 0,
      lives: START_LIVES,
      level: 1,
      phase: "ready",
    }),
}));

/** Helper: which maze index (0-based) corresponds to a given level. */
export function mazeIndexForLevel(level: number): number {
  return (level - 1) % (MAX_MAZE_INDEX + 1);
}
