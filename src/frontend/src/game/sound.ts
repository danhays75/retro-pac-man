/**
 * Retro arcade sound manager — synthesized via the Web Audio API.
 *
 * No external audio files are required. All effects (chomp, power pellet,
 * ghost eaten, death, game start jingle, level intro jingle) are generated
 * procedurally from oscillators and gain envelopes, evoking the classic
 * Pac-Man arcade cabinet.
 *
 * The AudioContext is created lazily on the first user gesture to satisfy
 * browser autoplay policies. Call `soundManager.resume()` (or any play*()
 * method after the first interaction) to unlock audio.
 */

type Waveform = OscillatorType;

interface ToneOptions {
  /** Frequency in Hz. */
  freq: number;
  /** Duration in seconds. */
  duration: number;
  /** Oscillator waveform. */
  type?: Waveform;
  /** Peak gain (0..1). Defaults to 0.18. */
  gain?: number;
  /** Attack time in seconds. Defaults to 0.005. */
  attack?: number;
  /** Release time in seconds. Defaults to 0.05. */
  release?: number;
  /** Optional frequency to glide to over the tone's duration. */
  glideTo?: number;
  /** Delay before the tone starts (seconds). */
  delay?: number;
}

/** Internal mute flag, kept in sync with the game store by useSound. */
let muted = false;

/** Whether the AudioContext has been created and unlocked. */
let ctx: AudioContext | null = null;

/** Master gain node shared by all voices. */
let master: GainNode | null = null;

/** Alternating chomp toggle so consecutive pellets alternate pitch. */
let chompFlip = false;

/**
 * Lazily create (or return the existing) AudioContext and master gain.
 * Returns null if the environment does not support Web Audio.
 */
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  return ctx;
}

/** Play a single synthesized tone with an attack/release envelope. */
function tone(opts: ToneOptions): void {
  const audio = getCtx();
  if (!audio || !master) return;
  if (muted) return;

  const {
    freq,
    duration,
    type = "square",
    gain = 0.18,
    attack = 0.005,
    release = 0.05,
    glideTo,
    delay = 0,
  } = opts;

  const start = audio.currentTime + delay;
  const end = start + duration;

  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), end);
  }

  const env = audio.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(gain, start + attack);
  env.gain.setValueAtTime(gain, end - release);
  env.gain.linearRampToValueAtTime(0, end);

  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(end + 0.02);
}

/**
 * Resume the AudioContext after a user gesture.
 * Browsers suspend the context until the first interaction; this unlocks it.
 */
function resume(): void {
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === "suspended") {
    void audio.resume();
  }
}

/** Set the mute flag (driven by the game store via useSound). */
function setMuted(value: boolean): void {
  muted = value;
}

/** Whether audio is currently muted. */
function isMuted(): boolean {
  return muted;
}

/**
 * Chomp — short blip that alternates pitch on each pellet eaten.
 * Classic Pac-Man "waka" feel via two alternating square-wave tones.
 */
function playChomp(): void {
  if (muted) return;
  chompFlip = !chompFlip;
  const freq = chompFlip ? 440 : 330;
  tone({
    freq,
    duration: 0.06,
    type: "square",
    gain: 0.14,
    attack: 0.002,
    release: 0.03,
  });
}

/**
 * Power pellet activation — a rising sweep signaling frightened mode.
 */
function playPowerPellet(): void {
  if (muted) return;
  tone({
    freq: 220,
    duration: 0.35,
    type: "sawtooth",
    gain: 0.2,
    glideTo: 880,
    attack: 0.01,
    release: 0.08,
  });
  tone({
    freq: 330,
    duration: 0.35,
    type: "square",
    gain: 0.12,
    glideTo: 1320,
    delay: 0.04,
  });
}

/**
 * Ghost eaten — a bright ascending arpeggio reward.
 */
function playGhostEaten(): void {
  if (muted) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((f, i) => {
    tone({
      freq: f,
      duration: 0.09,
      type: "square",
      gain: 0.18,
      delay: i * 0.06,
      attack: 0.003,
      release: 0.04,
    });
  });
}

/**
 * Death — a descending wail mimicking the classic Pac-Man death jingle.
 */
function playDeath(): void {
  if (muted) return;
  tone({
    freq: 660,
    duration: 0.9,
    type: "sawtooth",
    gain: 0.22,
    glideTo: 80,
    attack: 0.01,
    release: 0.15,
  });
  tone({
    freq: 440,
    duration: 0.9,
    type: "square",
    gain: 0.1,
    glideTo: 60,
    delay: 0.02,
  });
}

/**
 * Game start jingle — the iconic four-note "ready" fanfare.
 */
function playStart(): void {
  if (muted) return;
  const notes: Array<[number, number]> = [
    [523.25, 0.12], // C5
    [659.25, 0.12], // E5
    [783.99, 0.12], // G5
    [1046.5, 0.25], // C6
  ];
  let t = 0;
  for (const [freq, dur] of notes) {
    tone({
      freq,
      duration: dur,
      type: "square",
      gain: 0.2,
      delay: t,
      attack: 0.005,
      release: 0.05,
    });
    t += dur * 0.9;
  }
}

/**
 * Level intro jingle — a short two-tone "new maze" cue.
 */
function playLevelIntro(): void {
  if (muted) return;
  tone({
    freq: 392,
    duration: 0.18,
    type: "square",
    gain: 0.18,
    attack: 0.005,
    release: 0.06,
  });
  tone({
    freq: 587.33,
    duration: 0.28,
    type: "square",
    gain: 0.18,
    delay: 0.16,
    attack: 0.005,
    release: 0.08,
  });
}

/** Public sound manager singleton. */
export const soundManager = {
  resume,
  setMuted,
  isMuted,
  playChomp,
  playPowerPellet,
  playGhostEaten,
  playDeath,
  playStart,
  playLevelIntro,
};

export default soundManager;
