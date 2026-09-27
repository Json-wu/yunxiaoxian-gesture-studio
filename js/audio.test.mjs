import { renderGunshot, renderMusic } from "./audio.js";

const rate = 44100;
const gun = renderGunshot(rate);
const music = renderMusic(rate);

function rms(data, from, to) {
  let energy = 0;
  const start = Math.max(0, from);
  const end = Math.min(data.length, to);
  for (let i = start; i < end; i += 1) energy += data[i] * data[i];
  return Math.sqrt(energy / (end - start || 1));
}

function peak(data) {
  let max = 0;
  for (const value of data) max = Math.max(max, Math.abs(value));
  return max;
}

let failed = 0;
function check(name, ok, detail) {
  console.log(name, detail, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

const gunHead = rms(gun, 0, Math.floor(rate * 0.04));
const gunTail = rms(gun, Math.floor(rate * 0.32), gun.length);
check("gunshot-punch", gunHead > 0.12 && gunHead > gunTail * 3, `head ${gunHead.toFixed(3)} tail ${gunTail.toFixed(3)}`);
check("gunshot-short", gun.length / rate < 0.5 && peak(gun) > 0.7, `len ${(gun.length / rate).toFixed(2)} peak ${peak(gun).toFixed(2)}`);

const musicRms = rms(music, 0, music.length);
const bars = 4 * 4 * (60 / 124);
check("music-length", Math.abs(music.length / rate - bars) < 0.05, `len ${(music.length / rate).toFixed(2)} expected ${bars.toFixed(2)}`);
check("music-level", musicRms > 0.04 && musicRms < 0.35 && peak(music) <= 0.82, `rms ${musicRms.toFixed(3)} peak ${peak(music).toFixed(2)}`);

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all passed");
