import soundManager from "@/game/sound";
import { useGameStore } from "@/store/gameStore";
/**
 * useSound — wires the sound manager singleton to the game store's mute state.
 *
 * Call this hook once near the root of the game UI (e.g. in the game layout).
 * It:
 *   1. Subscribes to the store's `muted` flag and pushes it into the sound
 *      manager so synthesized effects respect the player's mute preference.
 *   2. Registers a one-time user-gesture listener that resumes the
 *      AudioContext (required by browser autoplay policies) and plays the
 *      game-start jingle when the player first interacts.
 *
 * Sound initialization is lazy and never blocks render: AudioContext creation
 * and resume are wrapped in try/catch so a failure (e.g. a browser that
 * blocks AudioContext entirely) cannot break the gesture listener or the
 * React tree. The game remains fully playable without sound.
 *
 * Returns the sound manager so callers can fire effects directly:
 *   const sound = useSound();
 *   sound.playChomp();
 */
import { useEffect } from "react";

export function useSound() {
  const muted = useGameStore((s) => s.muted);

  // Keep the sound manager's internal mute flag in sync with the store.
  useEffect(() => {
    try {
      soundManager.setMuted(muted);
    } catch {
      /* sound manager failure must never break the UI */
    }
  }, [muted]);

  // Unlock the AudioContext on the first user gesture (autoplay policy).
  // Wrapped in try/catch so a browser that refuses AudioContext creation
  // cannot break the gesture listener or prevent the game from rendering.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        soundManager.resume();
      } catch {
        /* AudioContext unavailable — game continues silently */
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: false });
    window.addEventListener("keydown", unlock, { once: false });
    window.addEventListener("touchstart", unlock, { once: false });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  return soundManager;
}

export default useSound;
