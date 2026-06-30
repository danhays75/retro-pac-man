/* eslint-disable */
// @ts-nocheck
// Visual QA mock backend for the Pac-Man arcade game.
// Implements the backendInterface surface used by the frontend so the app
// renders fully without a live canister. Loaded when VITE_USE_MOCK=true via
// @caffeineai/core-infrastructure's maybeLoadMockBackend glob.
import type { backendInterface } from "../backend";

const SAMPLE_HIGH_SCORE = 10000n;
const SAMPLE_PLAYER_NAME = "PLAYER 1";

export const mockBackend: backendInterface = {
  __accessControlState: async () => ({}),
  __highScore: async () => ({
    score: SAMPLE_HIGH_SCORE,
    updatedAt: 0n,
    playerName: SAMPLE_PLAYER_NAME,
  }),
  _initialize_access_control: async () => undefined,
  _internet_identity_sign_in_finish: async () => ({ __kind__: "ok", ok: null }),
  _internet_identity_sign_in_start: async () => new Uint8Array(),
  assignCallerUserRole: async () => undefined,
  getCallerUserRole: async () => "guest" as any,
  getHighScore: async () => SAMPLE_HIGH_SCORE,
  getHighScoreRecord: async () => ({
    score: SAMPLE_HIGH_SCORE,
    updatedAt: 0n,
    playerName: SAMPLE_PLAYER_NAME,
  }),
  isCallerAdmin: async () => false,
  submitScore: async () => SAMPLE_HIGH_SCORE,
};
