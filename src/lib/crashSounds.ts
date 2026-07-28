const ctx = typeof window !== "undefined" ? new AudioContext() : null;

let muted = false;
let musicMuted = false;
let musicOsc: OscillatorNode | null = null;
let musicGain: GainNode | null = null;
let musicInterval: number | null = null;

function now() {
  return ctx?.currentTime ?? 0;
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.05) {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, now());
  g.gain.setValueAtTime(gain, now());
  g.gain.exponentialRampToValueAtTime(0.001, now() + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now());
  o.stop(now() + duration);
}

function sweep(from: number, to: number, duration: number, type: OscillatorType = "sine") {
  if (!ctx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, now());
  o.frequency.exponentialRampToValueAtTime(to, now() + duration);
  g.gain.setValueAtTime(0.08, now());
  g.gain.exponentialRampToValueAtTime(0.001, now() + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(now());
  o.stop(now() + duration);
}

export function playCrashSound(
  sound: "win" | "lose" | "bet" | "tickSoft" | "roundStart" | "close",
) {
  if (!ctx || muted) return;
  if (ctx.state === "suspended") void ctx.resume();

  switch (sound) {
    case "win":
      sweep(440, 880, 0.4, "sine");
      setTimeout(() => beep(880, 0.2, "sine", 0.08), 150);
      setTimeout(() => beep(1100, 0.4, "sine", 0.08), 350);
      break;
    case "lose":
      sweep(220, 80, 0.6, "sawtooth");
      break;
    case "bet":
      beep(600, 0.08, "square", 0.04);
      break;
    case "tickSoft":
      beep(1200, 0.04, "sine", 0.02);
      break;
    case "roundStart":
      sweep(200, 600, 0.5, "sine");
      break;
    case "close":
      beep(400, 0.08, "triangle", 0.04);
      break;
  }
}

export function crashSoundsMuted() {
  return muted;
}

export function setCrashSoundsMuted(m: boolean) {
  muted = m;
  if (m) stopMusic();
}

export function unlockCrashSounds() {
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

export function crashMusicMuted() {
  return musicMuted;
}

export function setCrashMusicMuted(m: boolean) {
  musicMuted = m;
  if (m) stopMusic();
  else startMusic();
}

export function startMusic() {
  if (!ctx || muted || musicMuted || musicOsc) return;
  if (ctx.state === "suspended") void ctx.resume();

  const playNote = (freq: number, length: number) => {
    if (!ctx || muted || musicMuted) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, now());
    g.gain.setValueAtTime(0.015, now());
    g.gain.exponentialRampToValueAtTime(0.001, now() + length);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now());
    o.stop(now() + length);
  };

  const notes = [110, 130.81, 164.81, 196, 220, 196, 164.81, 130.81]; // dark ambient arpeggio
  let i = 0;

  playNote(notes[0], 0.8);
  musicInterval = window.setInterval(() => {
    i = (i + 1) % notes.length;
    playNote(notes[i], 0.8);
  }, 900);
}

export function stopMusic() {
  if (musicInterval) {
    window.clearInterval(musicInterval);
    musicInterval = null;
  }
  if (musicOsc) {
    try {
      musicOsc.stop();
    } catch {}
    musicOsc = null;
  }
  if (musicGain) {
    musicGain = null;
  }
}
