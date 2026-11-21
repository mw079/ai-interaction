// Light background music for the AI Interaction demo video, synthesized from scratch (no samples,
// no licence questions). Its own piece (the engine comes from the Edu Lab demo): 96 bpm, D major,
// Dmaj9 – Bm7 – Gmaj7 – Asus4, two bars each. Layers: a soft pad, marimba-like plucks in a
// syncopated 3-3-2 rhythm, a pulsing bass, and quiet off-beat ticks once the piece is under way;
// a small Schroeder reverb; fades at both ends. Written as 16-bit stereo WAV.
import { writeFileSync } from "node:fs";

const SR = 44100;
const BEAT = 60 / 96;
const BAR = 4 * BEAT;
const STEP = BEAT / 4; // sixteenth note
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Chords as [bass, voicing], two bars each.
const CHORDS = [
  [38, [62, 66, 69, 73, 76]], // Dmaj9
  [35, [59, 62, 66, 69, 74]], // Bm7
  [43, [59, 62, 66, 67, 71]], // Gmaj7
  [45, [57, 62, 64, 69, 76]], // Asus4
];
// Pluck positions within a bar, in sixteenths: a 3-3-2 feel, twice.
const PLUCKS = [0, 3, 6, 8, 11, 14];

export function demoMusic(seconds, file) {
  const n = Math.ceil(seconds * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const add = (start, len, pan, voice) => {
    const s0 = Math.floor(start * SR);
    const s1 = Math.min(n, s0 + Math.floor(len * SR));
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = Math.max(0, s0); i < s1; i++) {
      const v = voice((i - s0) / SR);
      L[i] += v * gl;
      R[i] += v * gr;
    }
  };

  const span = 2 * BAR;
  for (let c = 0, t = 0; t < seconds; c++, t += span) {
    const [bass, notes] = CHORDS[c % CHORDS.length];
    // Pad: a slow, airy swell; two detuned voices with few harmonics, kept low under the plucks.
    for (const m of notes.slice(0, 4)) {
      const f = mtof(m);
      const len = span + 1.2;
      add(t, len, (m % 7) / 7 - 0.45, (x) => {
        const env = Math.min(1, x / 1.0) * Math.min(1, Math.max(0, (len - x) / 1.2));
        let v = 0;
        for (let k = 1; k <= 3; k++) v += (Math.sin(2 * Math.PI * f * k * x) + Math.sin(2 * Math.PI * f * 1.004 * k * x)) / Math.pow(k, 2.2);
        return 0.013 * env * v;
      });
    }
    // Bass: a short, round pulse on beat one and the "and" of two in every bar.
    for (let b = 0; b < 2; b++) {
      for (const at of [0, 1.5 * BEAT]) {
        const f = mtof(bass);
        add(t + b * BAR + at, 1.2, 0, (x) => 0.12 * Math.exp(-x * 3.2) * Math.min(1, x / 0.012) * (Math.sin(2 * Math.PI * f * x) + 0.3 * Math.sin(4 * Math.PI * f * x)));
      }
    }
    // Marimba-like plucks (a fundamental and its bright fourth partial), from the second chord on.
    if (t >= span) {
      const order = [0, 2, 4, 1, 3, 2];
      for (let b = 0; b < 2; b++) {
        PLUCKS.forEach((p, k) => {
          const m = notes[order[(k + b * 2) % order.length]] + 12;
          const f = mtof(m);
          const vel = 0.07 * (k === 0 ? 1 : 0.78) * (0.85 + 0.3 * rnd());
          add(t + b * BAR + p * STEP, 1.1, k % 2 ? 0.4 : -0.4, (x) => {
            const a = Math.min(1, x / 0.003);
            return vel * a * (Math.exp(-x * 6) * Math.sin(2 * Math.PI * f * x) + 0.35 * Math.exp(-x * 20) * Math.sin(2 * Math.PI * f * 3.93 * x));
          });
        });
      }
    }
    // Quiet off-beat ticks (short noise bursts) once the piece is under way.
    if (t >= 2 * span) {
      for (let e = 0; e < 16; e++) {
        const accent = e % 2 ? 1 : 0.45;
        add(t + e * (BEAT / 2) + BEAT / 4, 0.06, e % 4 < 2 ? 0.25 : -0.25, (x) => 0.016 * accent * Math.exp(-x * 70) * (rnd() * 2 - 1));
      }
    }
  }

  // Schroeder reverb: four combs into two all-passes, a little different per side for width.
  const reverb = (x, spread) => {
    const out = new Float32Array(x.length);
    for (const d0 of [1557, 1617, 1491, 1422]) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      let p = 0;
      for (let i = 0; i < x.length; i++) {
        const y = buf[p];
        buf[p] = x[i] + y * 0.8;
        out[i] += y * 0.25;
        p = (p + 1) % d;
      }
    }
    for (const d0 of [225, 556]) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      let p = 0;
      for (let i = 0; i < out.length; i++) {
        const b = buf[p];
        const y = -0.5 * out[i] + b;
        buf[p] = out[i] + 0.5 * y;
        out[i] = y;
        p = (p + 1) % d;
      }
    }
    return out;
  };
  const wl = reverb(L, 0);
  const wr = reverb(R, 23);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) {
    L[i] = 0.78 * L[i] + 0.32 * wl[i];
    R[i] = 0.78 * R[i] + 0.32 * wr[i];
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  // Normalize, then fade in over 1.5 s and out over 3 s.
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 1.5) * Math.min(1, (seconds - t) / 3);
    const g = (0.7 / peak) * Math.max(0, fade);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  writeFileSync(file, Buffer.concat([header, pcm]));
}
