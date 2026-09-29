export const BPM = 124;
const BARS = 4;
const STEPS = BARS * 16;
const STEP = 60 / BPM / 4;

const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.0;
const A3 = 220.0;
const B3 = 246.94;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const F5 = 698.46;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;

export function renderGunshot(sampleRate) {
  const duration = 0.42;
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);
  let low = 0;
  let band = 0;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    const noise = Math.random() * 2 - 1;
    low = low * 0.82 + noise * 0.18;
    band = band * 0.55 + noise * 0.45;
    const crack = Math.exp(-t * 46);
    const body = Math.exp(-t * 12);
    const tail = Math.exp(-t * 7) * 0.22;
    const boom = Math.sin(2 * Math.PI * (70 + 40 * Math.exp(-t * 30)) * t) * Math.exp(-t * 16);
    const click = noise * Math.exp(-t * 140);
    const echoAt = t - 0.045;
    const echo = echoAt > 0 ? (Math.random() * 2 - 1) * Math.exp(-echoAt * 28) * 0.28 : 0;
    data[i] = click * 0.55 + band * crack * 0.7 + low * body * 0.45 + boom * 0.8 + tail * low + echo;
  }
  normalize(data, 0.96);
  return data;
}

export function renderMusic(sampleRate) {
  const duration = STEPS * STEP;
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);

  for (let step = 0; step < STEPS; step += 1) {
    const slot = step % 16;
    const when = Math.floor(step * STEP * sampleRate);
    if (slot === 0 || slot === 8 || slot === 10) addKick(data, sampleRate, when);
    if (slot === 4 || slot === 12) addClap(data, sampleRate, when);
    if (step % 2 === 0) addHat(data, sampleRate, when, slot % 4 === 2 ? 0.11 : 0.055);
  }

  const bass = [
    [0, 2, C3], [2, 2, G3], [4, 2, E3], [6, 2, G3],
    [8, 2, C3], [10, 2, G3], [12, 2, C4], [14, 2, G3],
    [16, 2, G3], [18, 2, D4], [20, 2, B3], [22, 2, D4],
    [24, 2, G3], [26, 2, D4], [28, 2, B3], [30, 2, G3],
    [32, 2, A3], [34, 2, E4], [36, 2, C4], [38, 2, E4],
    [40, 2, A3], [42, 2, E4], [44, 2, C4], [46, 2, A3],
    [48, 2, F3], [50, 2, C4], [52, 2, A3], [54, 2, C4],
    [56, 2, F3], [58, 2, C4], [60, 2, A3], [62, 2, G3],
  ];
  for (const [step, steps, freq] of bass) {
    addTone(data, sampleRate, freq, step * STEP, steps * STEP, 0.2, 2.2, 0.08);
  }

  const chords = [
    [0, [C4, E4, G4]],
    [16, [B3, D4, G4]],
    [32, [A3, C4, E4]],
    [48, [A3, C4, F4]],
  ];
  for (const [step, notes] of chords) {
    for (const freq of notes) {
      addTone(data, sampleRate, freq, step * STEP, 16 * STEP, 0.055, 0.35, 0.02);
    }
  }

  const lead = [
    [0, 2, E5], [2, 2, G5], [4, 2, A5], [6, 2, G5],
    [8, 2, E5], [10, 2, D5], [12, 4, C5],
    [16, 2, D5], [18, 2, G5], [20, 2, B5], [22, 2, A5],
    [24, 2, G5], [26, 2, D5], [28, 4, B4],
    [32, 2, C5], [34, 2, E5], [36, 2, A5], [38, 2, G5],
    [40, 2, E5], [42, 2, C5], [44, 4, A4],
    [48, 2, A4], [50, 2, C5], [52, 2, F5], [54, 2, E5],
    [56, 2, D5], [58, 2, C5], [60, 4, E5],
  ];
  for (const [step, steps, freq] of lead) {
    const start = step * STEP;
    const dur = steps * STEP * 0.92;
    addTone(data, sampleRate, freq, start, dur, 0.16, 7.2, 0.22);
    addTone(data, sampleRate, freq, start + 0.14, dur, 0.045, 6, 0.1);
  }

  normalize(data, 0.8);
  return data;
}

function addKick(data, sampleRate, start) {
  const len = Math.floor(0.16 * sampleRate);
  let phase = 0;
  for (let i = 0; i < len && start + i < data.length; i += 1) {
    const t = i / sampleRate;
    const freq = 150 * Math.exp(-t * 28) + 52;
    phase += (2 * Math.PI * freq) / sampleRate;
    data[start + i] += Math.sin(phase) * Math.exp(-t * 16) * 0.72;
  }
}

function addHat(data, sampleRate, start, amp) {
  const len = Math.floor(0.04 * sampleRate);
  let prev = 0;
  let high = 0;
  for (let i = 0; i < len && start + i < data.length; i += 1) {
    const noise = Math.random() * 2 - 1;
    high = noise - prev + high * 0.7;
    prev = noise;
    data[start + i] += high * Math.exp((-i / sampleRate) * 80) * amp;
  }
}

function addClap(data, sampleRate, start) {
  const bursts = [0, 0.008, 0.016];
  for (const offset of bursts) {
    const from = start + Math.floor(offset * sampleRate);
    const len = Math.floor(0.09 * sampleRate);
    for (let i = 0; i < len && from + i < data.length; i += 1) {
      const t = i / sampleRate;
      data[from + i] += (Math.random() * 2 - 1) * Math.exp(-t * 24) * 0.16;
    }
  }
}

function addTone(data, sampleRate, freq, startSec, durSec, amp, decay, harmonic) {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const len = Math.floor(durSec * sampleRate);
  for (let i = 0; i < len && start + i < data.length; i += 1) {
    const t = i / sampleRate;
    const remain = (len - i) / sampleRate;
    const attack = Math.min(1, t / 0.012);
    const release = remain < 0.05 ? remain / 0.05 : 1;
    const env = attack * Math.exp(-t * decay) * release;
    const wave = Math.sin(2 * Math.PI * freq * t) + harmonic * Math.sin(4 * Math.PI * freq * t);
    data[start + i] += wave * env * amp;
  }
}

function normalize(data, peakTarget) {
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
  const gain = peakTarget / (peak || 1);
  for (let i = 0; i < data.length; i += 1) data[i] *= gain;
}

export function renderJudge(kind, sampleRate) {
  const miss = kind === "miss" || kind === "wrong";
  const duration = miss ? 0.1 : kind === "perfect" ? 0.16 : 0.12;
  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);
  const freq = kind === "perfect" ? 880 : 660;
  for (let i = 0; i < length; i += 1) {
    const t = i / sampleRate;
    if (miss) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 36);
      continue;
    }
    const ping = Math.sin(2 * Math.PI * freq * t);
    const over = kind === "perfect" ? Math.sin(2 * Math.PI * freq * 2 * t) * 0.28 : 0;
    data[i] = (ping + over) * Math.exp(-t * (kind === "perfect" ? 12 : 16));
  }
  normalize(data, miss ? 0.28 : kind === "perfect" ? 0.48 : 0.36);
  return data;
}

export function createScore() {
  let ctx;
  let musicGain;
  let musicSource;
  let musicBuffer;
  let gunBuffer;
  let analyser;
  let mode = "music";
  let pendingGun = false;
  let musicOrigin = 0;
  const judgeBuffers = {};

  function ensure() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    musicBuffer = bufferFrom(renderMusic(ctx.sampleRate));
    gunBuffer = bufferFrom(renderGunshot(ctx.sampleRate));
    musicGain = ctx.createGain();
    musicGain.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    musicGain.connect(ctx.destination);
    musicGain.connect(analyser);
  }

  function bufferFrom(samples) {
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  function apply() {
    if (!ctx || ctx.state !== "running") return;
    if (mode === "die") {
      stopMusic();
      if (pendingGun) {
        pendingGun = false;
        playGunshot();
      }
      return;
    }
    startMusic();
    if (pendingGun) {
      pendingGun = false;
      playGunshot();
    }
  }

  function startMusic() {
    if (musicSource) {
      const now = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
      musicGain.gain.linearRampToValueAtTime(0.42, now + 0.25);
      return;
    }
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(0.0001, now);
    musicGain.gain.linearRampToValueAtTime(0.42, now + 0.35);
    musicSource = ctx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start();
    musicOrigin = now;
  }

  function clock() {
    if (!ctx || !musicSource || !musicOrigin) return null;
    return { elapsed: ctx.currentTime - musicOrigin };
  }

  function stopMusic() {
    if (!musicSource) return;
    const now = ctx.currentTime;
    const source = musicSource;
    musicSource = null;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), now);
    musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.06);
    source.stop(now + 0.08);
  }

  function playJudge(kind) {
    const key = kind === "wrong" ? "miss" : kind;
    if (key !== "perfect" && key !== "hit" && key !== "miss") return;
    if (!judgeBuffers[key]) judgeBuffers[key] = bufferFrom(renderJudge(key, ctx.sampleRate));
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = key === "perfect" ? 0.22 : key === "hit" ? 0.16 : 0.12;
    source.buffer = judgeBuffers[key];
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  function playGunshot() {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.9;
    source.buffer = gunBuffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    gain.connect(analyser);
    source.start();
  }

  function unlock() {
    try {
      ensure();
    } catch (error) {
      console.warn(error);
      return;
    }
    if (ctx.state === "suspended") ctx.resume().then(apply);
    else apply();
  }

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);

  return {
    play(action, options = {}) {
      const keepBeat = Boolean(options.keepBeat);
      if (action === "die" && !keepBeat) {
        mode = "die";
        pendingGun = true;
      } else if (action === "die") {
        mode = "music";
        pendingGun = true;
      } else {
        mode = "music";
        pendingGun = false;
      }
      try {
        ensure();
      } catch (error) {
        console.warn(error);
        return;
      }
      apply();
    },
    async arm() {
      try {
        ensure();
      } catch (error) {
        console.warn(error);
        return null;
      }
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (error) {
          console.warn(error);
          return null;
        }
      }
      if (ctx.state !== "running") return null;
      if (mode === "die") {
        mode = "music";
        pendingGun = false;
      }
      apply();
      return clock();
    },
    clock,
    mark(kind) {
      try {
        ensure();
      } catch (error) {
        console.warn(error);
        return;
      }
      if (!ctx || ctx.state !== "running") return;
      playJudge(kind);
    },
    debugState() {
      if (!analyser) return { state: ctx?.state || "idle", level: 0, mode, music: Boolean(musicSource) };
      const bins = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(bins);
      let energy = 0;
      for (const value of bins) {
        const sample = (value - 128) / 128;
        energy += sample * sample;
      }
      return {
        state: ctx.state,
        level: Math.sqrt(energy / bins.length),
        mode,
        music: Boolean(musicSource),
      };
    },
  };
}
