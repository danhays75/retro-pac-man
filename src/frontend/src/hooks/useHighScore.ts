import { createActor } from "@/backend";
import { useGameStore } from "@/store/gameStore";
/**
 * useHighScore — backend-backed high-score persistence.
 *
 * Exposes two hooks that bridge the canister high-score API with the
 * zustand game store:
 *
 *  - useGetHighScore(): TanStack Query that fetches the persisted high
 *    score on app load and writes it into the store. Loading and error
 *    states are handled gracefully — the store keeps its current value
 *    (0 on first load) and `highScoreLoaded` is flipped to true once the
 *    query settles, so the UI never hangs waiting on the backend.
 *
 *  - useSubmitScore(): mutation that pushes a new score to the canister
 *    when the player's final score beats the stored high score. On
 *    success it updates the store with the canister's authoritative
 *    new high score. The caller is responsible for the "beats high
 *    score" guard; this hook only performs the write.
 *
 * Backend signatures (from backend.d.ts):
 *   getHighScore(): Promise<bigint>
 *   submitScore(score: bigint, playerName: string): Promise<bigint>
 *
 * Scores are stored as bigint on the canister but the arcade score range
 * fits comfortably inside a JS number, so we convert at the boundary.
 */
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/** Query key for the persisted high score. */
export const HIGH_SCORE_QUERY_KEY = ["high-score"] as const;

/** Default player name attached to submitted scores. */
const DEFAULT_PLAYER_NAME = "PLAYER 1";

/** Safe upper bound for an arcade score as a JS number. */
const MAX_SAFE_SCORE = Number.MAX_SAFE_INTEGER;

/**
 * Convert a backend bigint score to a JS number.
 * Arcade scores are well within safe integer range; this clamps
 * defensively in case the canister ever returns an unexpected value.
 */
function bigToScore(value: bigint): number {
  if (value > BigInt(MAX_SAFE_SCORE)) return MAX_SAFE_SCORE;
  return Number(value);
}

/**
 * Fetch the persisted high score from the canister on app load and
 * mirror it into the game store. Gracefully degrades to the store's
 * current value (0 on first load) when the backend is unavailable.
 */
export function useGetHighScore() {
  const { actor, isFetching } = useActor(createActor);
  const setHighScore = useGameStore((s) => s.setHighScore);

  return useQuery<number>({
    queryKey: HIGH_SCORE_QUERY_KEY,
    queryFn: async () => {
      if (!actor) return useGameStore.getState().highScore;
      const raw = await actor.getHighScore();
      return bigToScore(raw);
    },
    enabled: !!actor && !isFetching,
    // The high score rarely changes from the outside; stale-then-refetch
    // keeps the UI snappy on reconnects without hammering the canister.
    staleTime: 30_000,
    gcTime: Number.POSITIVE_INFINITY,
    select: (score) => {
      // Mirror the fetched value into the store as a side effect of
      // reading the query. setHighScore uses Math.max so a stale local
      // high score from the current run is never overwritten downward.
      setHighScore(score);
      return score;
    },
    // On error we still mark the store as loaded so the UI proceeds
    // with the default (0) or last known high score.
    throwOnError: false,
  });
}

/**
 * Submit a new score to the canister when it beats the stored high
 * score. Returns a mutation whose `mutate` accepts the final score;
 * the caller decides whether the score qualifies before invoking.
 *
 * On success the canister returns the new authoritative high score,
 * which we write back into the store and refresh the query cache.
 */
export function useSubmitScore() {
  const { actor, isFetching } = useActor(createActor);
  const queryClient = useQueryClient();
  const setHighScore = useGameStore((s) => s.setHighScore);

  return useMutation<number, Error, number, { previous: number | undefined }>({
    mutationFn: async (score: number) => {
      if (!actor) {
        // No actor yet — surface the score unchanged so the UI still
        // updates locally even if the backend isn't reachable.
        return score;
      }
      const raw = await actor.submitScore(BigInt(score), DEFAULT_PLAYER_NAME);
      return bigToScore(raw);
    },
    onMutate: async (score) => {
      // Optimistically bump the store so the HUD reflects the new
      // high score immediately while the canister confirms.
      await queryClient.cancelQueries({ queryKey: HIGH_SCORE_QUERY_KEY });
      const previous = queryClient.getQueryData<number>(HIGH_SCORE_QUERY_KEY);
      setHighScore(score);
      queryClient.setQueryData<number>(HIGH_SCORE_QUERY_KEY, score);
      return { previous };
    },
    onSuccess: (newHighScore) => {
      // Reconcile with the canister's authoritative value.
      setHighScore(newHighScore);
      queryClient.setQueryData<number>(HIGH_SCORE_QUERY_KEY, newHighScore);
    },
    onError: (_err, _score, context) => {
      // Roll back the optimistic update; the store's setHighScore uses
      // Math.max so we restore the previous cached value directly.
      if (typeof context?.previous === "number") {
        queryClient.setQueryData<number>(
          HIGH_SCORE_QUERY_KEY,
          context.previous,
        );
      }
    },
    // Skip when the actor isn't ready; the caller can retry on the
    // next game-over if needed.
    retry: false,
    meta: { actorReady: !!actor && !isFetching },
  });
}

/**
 * Convenience: submit a score only if it strictly beats the stored
 * high score. Returns the bound submit function plus the mutation
 * state so callers can show loading/error/success surfaces.
 */
export function useSubmitScoreIfBeats() {
  const submit = useSubmitScore();
  const highScore = useGameStore((s) => s.highScore);

  const submitIfBeats = (finalScore: number) => {
    if (finalScore > highScore) {
      submit.mutate(finalScore);
    }
  };

  return {
    submitIfBeats,
    isLoading: submit.isPending,
    isError: submit.isError,
    isSuccess: submit.isSuccess,
    error: submit.error,
  };
}
