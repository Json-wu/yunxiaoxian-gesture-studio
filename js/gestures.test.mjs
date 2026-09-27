import { createTracker } from "./gestures.js";

function hand({ pose, wrist = { x: 0.5, y: 0.62, z: 0 }, indexTip = null }) {
  const lm = Array.from({ length: 21 }, () => ({ ...wrist, z: 0 }));
  lm[0] = { ...wrist, z: 0 };
  const spread = { index: -0.055, middle: -0.018, ring: 0.02, pinky: 0.058 };
  const ids = {
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };
  const straight = new Set(pose);
  for (const name of Object.keys(ids)) {
    const [mcp, pip, dip, tip] = ids[name];
    const sx = spread[name];
    lm[mcp] = { x: wrist.x + sx, y: wrist.y - 0.055, z: 0 };
    if (straight.has(name)) {
      lm[pip] = { x: wrist.x + sx * 1.2, y: wrist.y - 0.12, z: 0 };
      lm[dip] = { x: wrist.x + sx * 1.35, y: wrist.y - 0.175, z: 0 };
      lm[tip] = { x: wrist.x + sx * 1.45, y: wrist.y - 0.235, z: 0 };
    } else {
      lm[pip] = { x: wrist.x + sx * 0.8, y: wrist.y - 0.07, z: 0 };
      lm[dip] = { x: wrist.x + sx * 0.35, y: wrist.y - 0.03, z: 0 };
      lm[tip] = { x: wrist.x + sx * 0.1, y: wrist.y + 0.01, z: 0 };
    }
  }
  lm[1] = { x: wrist.x - 0.03, y: wrist.y - 0.02, z: 0 };
  lm[2] = { x: wrist.x - 0.06, y: wrist.y - 0.045, z: 0 };
  if (straight.has("thumb")) {
    lm[3] = { x: wrist.x - 0.11, y: wrist.y - 0.09, z: 0 };
    lm[4] = { x: wrist.x - 0.155, y: wrist.y - 0.14, z: 0 };
  } else {
    lm[3] = { x: wrist.x - 0.045, y: wrist.y - 0.03, z: 0 };
    lm[4] = { x: wrist.x - 0.02, y: wrist.y - 0.015, z: 0 };
  }
  if (indexTip) lm[8] = { ...indexTip, z: 0 };
  return lm;
}

function sideHand(openNames) {
  const wrist = { x: 0.38, y: 0.5, z: 0 };
  const lm = Array.from({ length: 21 }, () => ({ ...wrist }));
  const names = ["index", "middle", "ring", "pinky"];
  const ids = {
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };
  const spread = { index: -0.045, middle: -0.015, ring: 0.015, pinky: 0.045 };
  const open = new Set(openNames);
  for (const name of names) {
    const [mcp, pip, dip, tip] = ids[name];
    const sy = spread[name];
    lm[mcp] = { x: wrist.x + 0.06, y: wrist.y + sy, z: 0 };
    if (open.has(name)) {
      lm[pip] = { x: wrist.x + 0.12, y: wrist.y + sy * 1.1, z: 0 };
      lm[dip] = { x: wrist.x + 0.17, y: wrist.y + sy * 1.15, z: 0 };
      lm[tip] = { x: wrist.x + 0.23, y: wrist.y + sy * 1.2, z: 0 };
    } else {
      lm[pip] = { x: wrist.x + 0.09, y: wrist.y + sy, z: 0 };
      lm[dip] = { x: wrist.x + 0.07, y: wrist.y + sy * 0.4, z: 0 };
      lm[tip] = { x: wrist.x + 0.045, y: wrist.y + sy * 0.2, z: 0 };
    }
  }
  lm[1] = { x: wrist.x + 0.02, y: wrist.y + 0.05, z: 0 };
  lm[2] = { x: wrist.x + 0.04, y: wrist.y + 0.07, z: 0 };
  lm[3] = { x: wrist.x + 0.03, y: wrist.y + 0.045, z: 0 };
  lm[4] = { x: wrist.x + 0.02, y: wrist.y + 0.03, z: 0 };
  return lm;
}

function push(tracker, lm, n, t0 = 0) {
  let sample = null;
  for (let i = 0; i < n; i += 1) sample = tracker.update(lm, t0 + i * 33);
  return sample;
}

const cases = [
  ["fist", ["fist"], hand({ pose: [] })],
  ["palm", ["palm"], hand({ pose: ["index", "middle", "ring", "pinky", "thumb"] })],
  ["peace", ["peace"], hand({ pose: ["index", "middle"] })],
  ["gun", ["gun"], hand({ pose: ["thumb", "index"] })],
  ["ily", ["ily"], hand({ pose: ["thumb", "index", "pinky"] })],
  ["middle", ["middle"], hand({ pose: ["middle"] })],
];

let failed = 0;
for (const [name, expected, lm] of cases) {
  const tracker = createTracker();
  const sample = push(tracker, lm, 10);
  const ok = expected.includes(sample.label) && expected.includes(sample.raw);
  console.log(name, "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

function okHand() {
  const lm = hand({ pose: ["middle", "ring", "pinky"] });
  lm[4] = { x: lm[8].x + 0.012, y: lm[8].y, z: 0 };
  return lm;
}

{
  const tracker = createTracker();
  const sample = push(tracker, okHand(), 10);
  const ok = sample.raw === "ok" && sample.label === "ok";
  console.log("ok", "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

function towardCamera(openNames) {
  const wrist = { x: 0.5, y: 0.58, z: 0 };
  const lm = Array.from({ length: 21 }, () => ({ ...wrist }));
  const names = ["index", "middle", "ring", "pinky"];
  const ids = {
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20],
  };
  const spread = { index: -0.03, middle: -0.01, ring: 0.01, pinky: 0.03 };
  const open = new Set(openNames);
  for (const name of names) {
    const [mcp, pip, dip, tip] = ids[name];
    const sx = spread[name];
    lm[mcp] = { x: wrist.x + sx, y: wrist.y - 0.09, z: 0 };
    if (open.has(name)) {
      lm[pip] = { x: wrist.x + sx, y: wrist.y - 0.03, z: -0.06 };
      lm[dip] = { x: wrist.x + sx, y: wrist.y - 0.035, z: -0.11 };
      lm[tip] = { x: wrist.x + sx, y: wrist.y - 0.04, z: -0.16 };
    } else {
      lm[pip] = { x: wrist.x + sx, y: wrist.y + 0.01, z: 0.04 };
      lm[dip] = { x: wrist.x + sx * 0.2, y: wrist.y - 0.02, z: 0.01 };
      lm[tip] = { x: wrist.x, y: wrist.y + 0.03, z: 0.02 };
    }
  }
  lm[1] = { x: wrist.x - 0.02, y: wrist.y - 0.01, z: 0 };
  lm[2] = { x: wrist.x - 0.04, y: wrist.y, z: 0 };
  lm[3] = { x: wrist.x - 0.03, y: wrist.y + 0.02, z: 0 };
  lm[4] = { x: wrist.x - 0.08, y: wrist.y + 0.04, z: 0 };
  return lm;
}

{
  const tracker = createTracker();
  let sample = null;
  for (let i = 0; i < 12; i += 1) {
    const open = i % 2 === 0 ? ["index", "ring"] : ["middle", "pinky"];
    sample = tracker.update(towardCamera(open), i * 40);
  }
  const ok = sample.raw === "piano" && sample.label === "piano";
  console.log("piano-toward-camera", "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

{
  const tracker = createTracker();
  let sample = null;
  for (let i = 0; i < 12; i += 1) {
    const open = i % 2 === 0 ? ["index", "ring"] : ["middle", "pinky"];
    sample = tracker.update(sideHand(open), i * 40);
  }
  const ok = sample.raw === "piano" && sample.label === "piano";
  console.log("piano", "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

{
  const tracker = createTracker();
  let sample = null;
  for (let i = 0; i < 8; i += 1) {
    const wrist = { x: 0.5, y: 0.32 + i * 0.025, z: 0 };
    sample = tracker.update(hand({ pose: ["index", "middle", "ring", "pinky", "thumb"], wrist }), i * 33);
  }
  for (let i = 0; i < 8; i += 1) {
    sample = tracker.update(hand({
      pose: ["index", "middle", "ring", "pinky", "thumb"],
      wrist: { x: 0.5, y: 0.52, z: 0 },
    }), 300 + i * 33);
  }
  const ok = sample.raw === "slap" && sample.label === "slap";
  console.log("slap", "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

function beckonHand(indexStraight) {
  const wrist = { x: 0.5, y: 0.55, z: 0 };
  const pose = indexStraight ? ["index"] : [];
  const lm = hand({ pose, wrist });
  lm[5].z = 0;
  lm[8].z = -0.04;
  lm[9].y = wrist.y - 0.02;
  lm[9].z = 0;
  lm[12].z = -0.03;
  return lm;
}

{
  const tracker = createTracker();
  let sample = null;
  for (let i = 0; i < 14; i += 1) {
    sample = tracker.update(beckonHand(i % 2 === 0), i * 40);
  }
  const ok = sample.raw === "beckon" && sample.label === "beckon";
  console.log("beckon", "raw", sample.raw, "label", sample.label, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

function pointToward(tip) {
  const lm = hand({ pose: ["index"] });
  const origin = lm[5];
  const place = (t) => ({
    x: origin.x + (tip.x - origin.x) * t,
    y: origin.y + (tip.y - origin.y) * t,
    z: 0,
  });
  lm[6] = place(0.42);
  lm[7] = place(0.7);
  lm[8] = { ...tip, z: 0 };
  return lm;
}

{
  const tracker = createTracker();
  let sample = null;
  let sweep = 0;
  const cx = 0.46;
  const cy = 0.34;
  for (let i = 0; i < 40; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const lm = pointToward({ x: cx + Math.cos(a) * 0.07, y: cy + Math.sin(a) * 0.07 });
    sample = tracker.update(lm, i * 33);
    sweep += sample.yawDelta;
  }
  const ok = sample.circling && Math.abs(sweep) > 2;
  console.log("circle", "circling", sample.circling, "raw", sample.raw, "sweep", sweep.toFixed(2), ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

{
  const tracker = createTracker();
  const palm = push(tracker, hand({ pose: ["index", "middle", "ring", "pinky", "thumb"] }), 8);
  const fist = push(tracker, hand({ pose: [] }), 2, 1000);
  const ok = fist.label === "palm";
  console.log("hold-through-flicker", fist.label, ok ? "OK" : "FAIL", "palmWas", palm.label);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all passed");
