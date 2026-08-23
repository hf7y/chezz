/* Synthesizes assets/earcons/*.wav -- short wooden-click samples for the
 * capture/check/floor-clear earcons (hf7y/chezz#5: "audio default on, short
 * wooden click is fine"). Pure Node math, no audio libs and no network --
 * a seeded PRNG shapes noise into a decaying "knock" per event, so the same
 * bytes come out every run. `npm run earcons:generate`
 *
 * Deliberately NOT WebAudio synthesis at runtime: hf7y picked pre-rendered
 * samples over live FM synthesis (see #5). This script is the one-time
 * render step; tools/wire-earcons.mjs bakes the resulting WAVs into
 * index1.html the same way wire-pieces.mjs bakes sprites.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "assets", "earcons");

const SAMPLE_RATE = 22050;

// Deterministic PRNG (mulberry32) so regenerating without changing the
// parameters below reproduces byte-identical WAVs -- a diff in these files
// means a parameter changed, not that noise happened to land differently.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One "knock": a burst of noise low-passed into a thump, times a decaying
// sine for pitch, so it reads as wood rather than static.
function knock(samples, startSample, durationMs, freqHz, gain, rand) {
  const n = Math.round((durationMs / 1000) * SAMPLE_RATE);
  let lp = 0;
  const lpCoeff = 0.15; // lower = duller thump, higher = brighter click
  for (let i = 0; i < n; i++) {
    const idx = startSample + i;
    if (idx >= samples.length) break;
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * (1000 / durationMs) * 6);
    const noise = rand() * 2 - 1;
    lp += lpCoeff * (noise - lp);
    const tone = Math.sin(2 * Math.PI * freqHz * t);
    samples[idx] += gain * envelope * (0.55 * lp + 0.45 * tone);
  }
}

function renderClip(totalMs, knocks, seed) {
  const rand = mulberry32(seed);
  const total = Math.round((totalMs / 1000) * SAMPLE_RATE);
  const samples = new Float32Array(total);
  for (const k of knocks) {
    knock(samples, Math.round((k.atMs / 1000) * SAMPLE_RATE), k.durationMs, k.freqHz, k.gain, rand);
  }
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.9 / peak : 1;
  const pcm = new Int16Array(total);
  for (let i = 0; i < total; i++) pcm[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * norm * 32767)));
  return pcm;
}

function pcmToWav(pcm) {
  const dataSize = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], 44 + i * 2);
  return buf;
}

const CLIPS = {
  // Crisp, single, mid-high -- a piece landing on another.
  capture: { totalMs: 90, seed: 1, knocks: [{ atMs: 0, durationMs: 70, freqHz: 1500, gain: 1 }] },
  // Two rapid low knocks -- more urgent, the King is under attack.
  check: { totalMs: 220, seed: 2, knocks: [
    { atMs: 0, durationMs: 90, freqHz: 700, gain: 1 },
    { atMs: 100, durationMs: 90, freqHz: 620, gain: 0.85 },
  ] },
  // One longer, lower, resonant knock -- clearing a floor is the big beat.
  floorClear: { totalMs: 320, seed: 3, knocks: [{ atMs: 0, durationMs: 300, freqHz: 350, gain: 1 }] },
};

for (const [name, spec] of Object.entries(CLIPS)) {
  const pcm = renderClip(spec.totalMs, spec.knocks, spec.seed);
  const wav = pcmToWav(pcm);
  const file = path.join(OUT_DIR, `${name}.wav`);
  writeFileSync(file, wav);
  console.log(`generate-earcons: wrote ${file} (${wav.length} bytes)`);
}
