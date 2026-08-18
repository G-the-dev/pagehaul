/**
 * A quiet generative pad that plays under the whole site.
 *
 * There is no audio file. Four soft voices are synthesised with the Web Audio
 * API — detuned sines drifting through an A-major pentatonic set, each
 * breathing on its own slow cycle behind a gentle lowpass — so there is
 * nothing to download, no loop seam to hear, and the level is a GainNode,
 * which is what makes the fades real fades instead of cuts.
 *
 * The browser refuses sound before a user gesture, so nothing here starts
 * itself: the component calls start() from the first pointer or key press.
 * Leaving the tab hands the level a slow ramp to silence and then suspends
 * the context (a suspended context costs nothing); coming back resumes and
 * ramps it up again.
 */

const LEVEL = 0.05;
/** A major pentatonic across two octaves — nothing in it can clash. */
const NOTES = [110, 123.47, 138.59, 164.81, 185, 220, 277.18, 329.63];
const VOICES = 4;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let started = false;
let suspendTimer: ReturnType<typeof setTimeout> | undefined;

function fadeTo(level: number, seconds: number): void {
  if (!ctx || !master) return;
  const g = master.gain;
  g.cancelScheduledValues(ctx.currentTime);
  g.setValueAtTime(g.value, ctx.currentTime);
  g.linearRampToValueAtTime(level, ctx.currentTime + seconds);
}

function build(): void {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 850;
  filter.Q.value = 0.5;
  master.connect(filter);
  filter.connect(ctx.destination);

  for (let v = 0; v < VOICES; v++) {
    const voice = ctx.createGain();
    voice.gain.value = 0.22;
    voice.connect(master);

    // Two oscillators a few cents apart is what turns a sine into something
    // that sounds like air moving rather than a test tone.
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = "sine";
    oscB.type = "sine";
    const note = NOTES[(v * 2) % NOTES.length];
    oscA.frequency.value = note;
    oscB.frequency.value = note;
    oscB.detune.value = 4;
    oscA.connect(voice);
    oscB.connect(voice);
    oscA.start();
    oscB.start();

    // Each voice breathes on its own slow cycle, so the pad never sits still
    // and never repeats — four incommensurate periods do not line up.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05 + v * 0.023;
    const depth = ctx.createGain();
    depth.gain.value = 0.13;
    lfo.connect(depth);
    depth.connect(voice.gain);
    lfo.start();

    // Every so often a voice drifts to another note in the set, gliding over
    // several seconds. Timers keep firing while the context is suspended,
    // which is fine — a suspended clock just applies the glide on return.
    const wander = () => {
      if (!ctx) return;
      const next = NOTES[Math.floor(Math.random() * NOTES.length)];
      oscA.frequency.setTargetAtTime(next, ctx.currentTime, 4);
      oscB.frequency.setTargetAtTime(next, ctx.currentTime, 4);
      setTimeout(wander, 12_000 + Math.random() * 16_000);
    };
    setTimeout(wander, 8_000 + v * 5_000);
  }
}

/** Begin playing, from silence, on the back of a user gesture. */
export function startAmbience(): void {
  if (!ctx) build();
  clearTimeout(suspendTimer);
  started = true;
  void ctx!.resume();
  fadeTo(LEVEL, 3);
}

/** Fade to silence over `seconds`, then stop spending CPU. */
export function pauseAmbience(seconds = 1.2): void {
  if (!ctx || !started) return;
  fadeTo(0, seconds);
  clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => void ctx?.suspend(), seconds * 1000 + 100);
}

/** Come back up, gently. Only meaningful once start() has happened. */
export function resumeAmbience(seconds = 1.6): void {
  if (!ctx || !started) return;
  clearTimeout(suspendTimer);
  void ctx.resume();
  fadeTo(LEVEL, seconds);
}

export function ambienceStarted(): boolean {
  return started;
}
