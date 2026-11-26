/**
 * New-order chime — generated with WebAudio so there is no asset to ship.
 * Browsers refuse audio until the user has interacted with the page, so the
 * context is created/resumed lazily on the first gesture (armSoundUnlock)
 * and every chime attempt resumes it defensively.
 */

const SOUND_KEY = "rbk.sound";

let audio: AudioContext | null = null;

export function isSoundOn(): boolean {
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundOn(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

function ctx(): AudioContext | null {
  try {
    if (!audio) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audio = new Ctor();
    }
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/** Call once at app start — unlocks audio on the first user gesture. */
export function armSoundUnlock(): () => void {
  const unlock = () => ctx();
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

function note(ac: AudioContext, freq: number, at: number, dur: number, peak: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Bright two-note kitchen bell with a soft third — audible, not alarming. */
export function playOrderChime(): void {
  if (!isSoundOn()) return;
  const ac = ctx();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.01;
  note(ac, 1318.5, t, 0.35, 0.22); // E6
  note(ac, 1760.0, t + 0.12, 0.45, 0.22); // A6
  note(ac, 2637.0, t + 0.26, 0.5, 0.1); // E7 shimmer
}

/** Softer single blip for approvals — distinct from the order chime. */
export function playApprovalBlip(): void {
  if (!isSoundOn()) return;
  const ac = ctx();
  if (!ac || ac.state !== "running") return;
  const t = ac.currentTime + 0.01;
  note(ac, 987.77, t, 0.3, 0.16); // B5
  note(ac, 1318.5, t + 0.14, 0.4, 0.14); // E6
}
