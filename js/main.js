import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HandLandmarker, FilesetResolver } from "../vendor/mediapipe/vision_bundle.mjs";
import { mountCity } from "./city.js";
import { createTracker } from "./gestures.js";
import { ACTIONS, GESTURE_NAMES, GESTURE_TO_ACTION, PROGRAMS } from "./program.js";
import { createScore } from "./audio.js";

const HOLD_MS = 480;
const PALM_HOLD_MS = 300;
const MODEL_URL = "./model-files/rigged_character.glb";
const CLIP_URLS = {
  walking: "./model-files/walking.glb",
  boxing: "./model-files/boxing.glb",
  jiangnan: "./model-files/jiangnan_dance.glb",
  die: "./model-files/die.glb",
  running: "./model-files/running.glb",
  getup: "./model-files/getup.glb",
  love: "./model-files/love_dance.glb",
  swing: "./model-files/swing_dance.glb",
};

const HAND_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

const stageCanvas = document.querySelector("#stage");
const statusText = document.querySelector("#status-text");
const statusDot = document.querySelector("#status-dot");
const cameraBtn = document.querySelector("#camera-btn");
const hintEl = document.querySelector("#hint");
const meterEl = document.querySelector("#meter");
const nowMeta = document.querySelector("#now-meta");
const loadingEl = document.querySelector("#loading");
const pip = document.querySelector("#pip");
const video = document.querySelector("#video");
const overlay = document.querySelector("#overlay");
const overlayCtx = overlay.getContext("2d");
const linksSvg = document.querySelector("#links");
const rulesBtn = document.querySelector("#rules-btn");
const rulesPanel = document.querySelector("#rules-panel");
const toastEl = document.querySelector("#toast");

const tracker = createTracker();
const score = createScore();
const cards = buildCards();

let renderer;
let scene;
let camera;
let mixer;
let spin;
let rigOffset;
let armature;
let hips;
let hipsAnchor = new THREE.Vector3();
let fitScale = 1;
let footOffset = 0;
let baseFacing = 0;
let actions = {};
let currentClip = null;
let activeAction = "walking";

let live = false;
let stream = null;
let landmarker = null;
let landmarkerPromise = null;
let lastVideoTime = -1;
let lastTick = performance.now();
let pendingAction = null;
let pendingAt = 0;
let palmSince = 0;
let palmEngaged = false;
let targetScale = 1;
let userScale = 1;
let targetYaw = 0;
let currentYaw = 0;
let wasCircling = false;
let circleStill = 0;
let linkOpacity = 0;
let toastTimer = 0;

mountCity(document.querySelector("#city"));
layoutLinks();
mountPipDrag();
window.addEventListener("resize", () => {
  layoutLinks();
  clampPip();
});

if (location.protocol === "file:") {
  showToast("请用本地服务器打开。直接双击文件时，摄像头和模块都不可用。");
}

initStage().catch((error) => {
  console.error(error);
  loadingEl.textContent = "模型加载失败";
  showToast(error.message || "模型加载失败");
});

cameraBtn.addEventListener("click", () => {
  if (live) stopLive();
  else startLive();
});

rulesBtn.addEventListener("click", () => {
  const open = rulesPanel.hasAttribute("hidden");
  if (open) rulesPanel.removeAttribute("hidden");
  else rulesPanel.setAttribute("hidden", "");
  rulesBtn.setAttribute("aria-expanded", open ? "true" : "false");
});

document.addEventListener("click", (event) => {
  if (rulesPanel.hasAttribute("hidden")) return;
  if (rulesPanel.contains(event.target) || rulesBtn.contains(event.target)) return;
  rulesPanel.setAttribute("hidden", "");
  rulesBtn.setAttribute("aria-expanded", "false");
});

function buildCards() {
  const root = document.querySelector("#cards");
  return PROGRAMS.walking.map((snippet, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.slot = String(index);
    card.innerHTML = `<header><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="file"></span></header><pre></pre>`;
    root.append(card);
    const file = card.querySelector(".file");
    const pre = card.querySelector("pre");
    file.textContent = snippet.file;
    pre.textContent = snippet.body;
    return { file, pre, card };
  });
}

function renderProgram(action, animate) {
  const pack = PROGRAMS[action];
  document.body.dataset.action = action;
  linksSvg.style.setProperty("--link", ACTIONS[action].color);
  cards.forEach((slot, index) => {
    const snippet = pack[index];
    slot.file.textContent = snippet.file;
    if (!animate) {
      slot.pre.textContent = snippet.body;
      return;
    }
    scramble(slot.pre, snippet.body);
    slot.card.classList.remove("flash");
    void slot.card.offsetWidth;
    slot.card.classList.add("flash");
  });
}

function scramble(el, text) {
  const glyphs = "01{}();=<>/_*[]";
  let frame = 0;
  const timer = setInterval(() => {
    frame += 1;
    if (frame < 9) {
      el.textContent = [...text].map((ch, i) => {
        if (ch === "\n" || ch === " ") return ch;
        return i < frame * 5 ? text[i] : glyphs[(i * 5 + frame) % glyphs.length];
      }).join("");
      return;
    }
    el.textContent = text;
    clearInterval(timer);
  }, 28);
}

function mountPipDrag() {
  let drag = null;

  pip.addEventListener("pointerdown", (event) => {
    if (pip.hidden || event.button > 0) return;
    const rect = pip.getBoundingClientRect();
    drag = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    pip.classList.add("is-dragging");
    try { pip.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });

  pip.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    placePip(event.clientX - drag.dx, event.clientY - drag.dy);
  });

  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    pip.classList.remove("is-dragging");
  }

  pip.addEventListener("pointerup", finish);
  pip.addEventListener("pointercancel", finish);
}

function placePip(left, top) {
  const maxX = Math.max(0, window.innerWidth - pip.offsetWidth);
  const maxY = Math.max(0, window.innerHeight - pip.offsetHeight);
  pip.style.left = `${Math.min(maxX, Math.max(0, left))}px`;
  pip.style.top = `${Math.min(maxY, Math.max(0, top))}px`;
  pip.style.right = "auto";
  pip.style.bottom = "auto";
}

function clampPip() {
  if (pip.hidden || !pip.style.left) return;
  placePip(parseFloat(pip.style.left), parseFloat(pip.style.top));
}

function layoutLinks() {
  const hub = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.46 };
  const relays = [
    { x: hub.x - window.innerWidth * 0.16, y: hub.y - 70 },
    { x: hub.x + window.innerWidth * 0.16, y: hub.y - 36 },
    { x: hub.x - window.innerWidth * 0.1, y: hub.y + 130 },
    { x: hub.x + window.innerWidth * 0.11, y: hub.y + 150 },
  ];
  const cardNodes = [...document.querySelectorAll(".card")].filter((card) => card.getClientRects().length).map((card) => {
    const rect = card.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.5,
    };
  });
  const lines = [];
  relays.forEach((relay) => lines.push([hub, relay]));
  cardNodes.forEach((node) => {
    let nearest = relays[0];
    let best = Infinity;
    relays.forEach((relay) => {
      const d = (relay.x - node.x) ** 2 + (relay.y - node.y) ** 2;
      if (d < best) {
        best = d;
        nearest = relay;
      }
    });
    lines.push([nearest, node]);
  });
  const nodes = [hub, ...relays];
  linksSvg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
  linksSvg.innerHTML = `${lines.map(([a, b]) => `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" />`).join("")}${nodes.map((node) => `<circle cx="${node.x}" cy="${node.y}" r="3.2" />`).join("")}`;
}

async function initStage() {
  renderer = new THREE.WebGLRenderer({
    canvas: stageCanvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.1, 40);
  camera.position.set(0, 1.22, 4.55);
  camera.lookAt(0, 1.02, 0);

  scene.add(new THREE.AmbientLight(0xb7c4e6, 0.55));
  const key = new THREE.DirectionalLight(0xfff6ec, 1.25);
  key.position.set(1.4, 3.4, 2.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8ea2ff, 0.45);
  fill.position.set(-2.2, 1.6, 2.2);
  scene.add(fill);
  const rimPink = new THREE.PointLight(0xff3d8e, 18, 7);
  rimPink.position.set(-1.5, 1.7, -0.8);
  scene.add(rimPink);
  const rimCyan = new THREE.PointLight(0x35e4ff, 16, 7);
  rimCyan.position.set(1.55, 1.45, -0.2);
  scene.add(rimCyan);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 40),
    new THREE.MeshBasicMaterial({ color: 0x02030a, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  scene.add(shadow);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.52, 72),
    new THREE.MeshBasicMaterial({
      color: 0x3ee0ff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const loader = new GLTFLoader();
  const [character, walking, boxing, jiangnan, die, running, getup, love, swing] = await Promise.all([
    loader.loadAsync(MODEL_URL),
    loader.loadAsync(CLIP_URLS.walking),
    loader.loadAsync(CLIP_URLS.boxing),
    loader.loadAsync(CLIP_URLS.jiangnan),
    loader.loadAsync(CLIP_URLS.die),
    loader.loadAsync(CLIP_URLS.running),
    loader.loadAsync(CLIP_URLS.getup),
    loader.loadAsync(CLIP_URLS.love),
    loader.loadAsync(CLIP_URLS.swing),
  ]);

  spin = new THREE.Group();
  rigOffset = new THREE.Group();
  scene.add(spin);
  spin.add(rigOffset);
  const model = character.scene;
  rigOffset.add(model);
  armature = model.getObjectByName("Armature") || model;
  hips = model.getObjectByName("Hips");

  model.traverse((node) => {
    if (!node.isMesh) return;
    node.frustumCulled = false;
    node.castShadow = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (material.emissiveMap) material.emissiveIntensity = 0.42;
      material.needsUpdate = true;
    });
  });

  const head = model.getObjectByName("Head");
  const front = model.getObjectByName("headfront");
  model.updateMatrixWorld(true);
  if (head && front) {
    const headPos = new THREE.Vector3();
    const frontPos = new THREE.Vector3();
    head.getWorldPosition(headPos);
    front.getWorldPosition(frontPos);
    if (frontPos.z < headPos.z) baseFacing = Math.PI;
  }

  mixer = new THREE.AnimationMixer(model);
  actions = {
    walking: clipAction(walking.animations[0], "walking", false),
    boxing: clipAction(boxing.animations[0], "boxing", false),
    jiangnan: clipAction(jiangnan.animations[0], "jiangnan", false),
    die: clipAction(die.animations[0], "die", true),
    running: clipAction(running.animations[0], "running", false),
    getup: clipAction(getup.animations[0], "getup", true),
    dance: clipAction(love.animations[0], "dance", false),
    swing: clipAction(swing.animations[0], "swing", false),
  };

  playClip("walking", true);
  mixer.update(0);
  fitModel();
  hipsAnchor = hips.position.clone();
  pinHips();

  loadingEl.setAttribute("hidden", "");
  applyActionUi("walking", false);
  score.play("walking");
  renderer.setAnimationLoop(tick);
}

function clipAction(clip, name, once) {
  const next = clip.clone();
  next.name = name;
  const action = mixer.clipAction(next);
  if (once) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  } else {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
  }
  return action;
}

function fitModel() {
  spin.scale.setScalar(1);
  spin.position.set(0, 0, 0);
  spin.rotation.set(0, baseFacing, 0);
  rigOffset.position.set(0, 0, 0);
  spin.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(spin);
  const height = Math.max(0.001, box.max.y - box.min.y);
  footOffset = box.min.y;
  fitScale = 1.68 / height;
  spin.scale.setScalar(fitScale);
  spin.position.y = -footOffset * fitScale;
}

function pinHips() {
  if (!hips || !armature || !rigOffset) return;
  const scale = armature.scale.x;
  rigOffset.position.x = -(hips.position.x - hipsAnchor.x) * scale;
  rigOffset.position.z = -(hips.position.z - hipsAnchor.z) * scale;
}

function playClip(name, immediate) {
  const next = actions[name];
  if (!next || currentClip === next) return;
  next.enabled = true;
  next.reset().setEffectiveWeight(1).play();
  if (currentClip && !immediate) currentClip.crossFadeTo(next, 0.45, false);
  else if (currentClip) currentClip.stop();
  currentClip = next;
}

function setAction(name) {
  if (!ACTIONS[name] || name === activeAction) return;
  activeAction = name;
  const clip = ACTIONS[name].clip;
  playClip(clip, false);
  applyActionUi(name, true);
  score.play(name);
}

const DEV_ACTIONS = ["walking", "boxing", "jiangnan", "die", "running", "getup", "dance", "swing"];

function isDevHost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "::1";
}

if (isDevHost()) {
  const brand = document.querySelector("#brand");
  brand.classList.add("is-dev");
  brand.tabIndex = 0;
  brand.setAttribute("role", "button");
  brand.setAttribute("aria-label", "切换动作");
  brand.addEventListener("click", cycleDevAction);
  brand.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    cycleDevAction();
  });
}

function cycleDevAction() {
  if (!actions.walking) return;
  const index = DEV_ACTIONS.indexOf(activeAction);
  setAction(DEV_ACTIONS[(index + 1) % DEV_ACTIONS.length]);
}

function applyActionUi(name, animate) {
  const action = ACTIONS[name];
  statusText.textContent = action.title;
  document.documentElement.style.setProperty("--action", action.color);
  renderProgram(name, animate);
  layoutLinks();
}

function tick(now) {
  const dt = Math.min(0.05, (now - lastTick) / 1000 || 0);
  lastTick = now;

  if (live && landmarker && video.readyState >= 2) {
    sampleHand(now);
  }

  if (mixer) {
    mixer.update(dt);
    pinHips();
  }

  const circling = live && trackerLast.circling;
  if (circling) {
    if (!wasCircling) targetYaw = currentYaw;
    targetYaw += trackerLast.yawDelta;
    circleStill = 0;
    wasCircling = true;
  } else if (wasCircling) {
    circleStill += dt;
    if (circleStill > 0.28) {
      wasCircling = false;
      targetYaw = Math.atan2(Math.sin(targetYaw), Math.cos(targetYaw));
      currentYaw = Math.atan2(Math.sin(currentYaw), Math.cos(currentYaw));
    }
  } else {
    targetYaw = THREE.MathUtils.damp(targetYaw, 0, 3.2, dt);
  }
  currentYaw = THREE.MathUtils.damp(currentYaw, targetYaw, 7, dt);
  if (live && palmEngaged) {
    const ratio = THREE.MathUtils.clamp((trackerLast.span - 0.16) / 0.36, 0, 1);
    targetScale = THREE.MathUtils.lerp(0.74, 1.62, ratio);
  } else if (!live) {
    targetScale = THREE.MathUtils.damp(targetScale, 1, 2.4, dt);
  }
  userScale = THREE.MathUtils.damp(userScale, targetScale, 5, dt);
  if (spin) {
    const scale = fitScale * userScale;
    spin.rotation.y = baseFacing + currentYaw;
    spin.scale.setScalar(scale);
    spin.position.y = -footOffset * scale;
  }

  const linkTarget = live ? 1 : 0;
  linkOpacity = THREE.MathUtils.damp(linkOpacity, linkTarget, 4, dt);
  linksSvg.style.opacity = String(linkOpacity);

  const degrees = Math.round(THREE.MathUtils.radToDeg(currentYaw));
  const turning = Math.abs(degrees) > 1;
  nowMeta.textContent = `缩放 ${userScale.toFixed(2)} · ${turning ? `转动 ${degrees}°` : "正面"}`;

  renderer.render(scene, camera);
}

let trackerLast = { raw: "none", label: "none", span: 0.28, circling: false, yawDelta: 0, pointing: false };

function sampleHand(now) {
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  let result;
  try {
    result = landmarker.detectForVideo(video, now);
  } catch (error) {
    console.warn(error);
    return;
  }
  const landmarks = result.landmarks?.[0];
  trackerLast = tracker.update(landmarks, now);
  drawOverlay(landmarks);
  consumeGesture(trackerLast, now);
}

function consumeGesture(sample, now) {
  const action = GESTURE_TO_ACTION[sample.label];
  if (action && action !== activeAction) {
    if (pendingAction !== action) {
      pendingAction = action;
      pendingAt = now;
    }
    const progress = (now - pendingAt) / HOLD_MS;
    setMeter(progress);
    hintEl.textContent = `${GESTURE_NAMES[sample.label]} · 稳定中 ${Math.round(Math.min(1, progress) * 100)}%`;
    if (progress >= 1) {
      setAction(action);
      pendingAction = null;
      setMeter(0);
      hintEl.textContent = `${GESTURE_NAMES[sample.label]} · 已切换到${ACTIONS[action].title}`;
    }
  } else {
    pendingAction = null;
    if (sample.label === "palm") {
      if (!palmSince) palmSince = now;
      const progress = (now - palmSince) / PALM_HOLD_MS;
      setMeter(progress);
      if (progress >= 1) palmEngaged = true;
      hintEl.textContent = palmEngaged ? "张开手掌 · 靠近放大，远离缩小" : "张开手掌 · 稳定后开始缩放";
    } else if (sample.circling || sample.pointing) {
      palmSince = 0;
      palmEngaged = false;
      setMeter(sample.circling ? 1 : 0.35);
      hintEl.textContent = sample.circling ? "食指画圈 · 跟随转动，停止后回正" : "食指伸出 · 画圈才会转动";
    } else if (action && action === activeAction) {
      palmSince = 0;
      palmEngaged = false;
      setMeter(0);
      hintEl.textContent = `${GESTURE_NAMES[sample.label]} · ${ACTIONS[action].title}`;
    } else {
      palmSince = 0;
      palmEngaged = false;
      setMeter(0);
      hintEl.textContent = "把手放进画面，手势稳住约半秒";
    }
  }
}

function setMeter(progress) {
  const value = Math.max(0, Math.min(1, progress));
  meterEl.style.transform = `scaleX(${value})`;
}

function drawOverlay(landmarks) {
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;
  if (overlay.width !== width) overlay.width = width;
  if (overlay.height !== height) overlay.height = height;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  if (!landmarks) return;
  overlayCtx.lineWidth = 3;
  overlayCtx.strokeStyle = "rgba(90, 235, 255, 0.9)";
  overlayCtx.fillStyle = "#ffe38a";
  for (const [a, b] of HAND_EDGES) {
    overlayCtx.beginPath();
    overlayCtx.moveTo(landmarks[a].x * width, landmarks[a].y * height);
    overlayCtx.lineTo(landmarks[b].x * width, landmarks[b].y * height);
    overlayCtx.stroke();
  }
  landmarks.forEach((point) => {
    overlayCtx.beginPath();
    overlayCtx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2);
    overlayCtx.fill();
  });
}

async function startLive() {
  if (location.protocol === "file:") {
    showToast("请先运行 python3 -m http.server 5173，再打开 http://localhost:5173");
    return;
  }
  cameraBtn.disabled = true;
  hintEl.textContent = "正在打开摄像头…";
  try {
    landmarker = await ensureLandmarker();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
    live = true;
    pip.hidden = false;
    statusDot.classList.add("live");
    cameraBtn.setAttribute("aria-label", "关闭摄像头");
    cameraBtn.setAttribute("aria-pressed", "true");
    cameraBtn.classList.add("is-on");
    statusText.textContent = ACTIONS[activeAction].title;
    hintEl.textContent = "把手放进画面，手势稳住约半秒";
    layoutLinks();
  } catch (error) {
    console.error(error);
    const message = cameraError(error);
    showToast(message);
    hintEl.textContent = message;
    stopTracks();
  } finally {
    cameraBtn.disabled = false;
  }
}

function stopLive() {
  live = false;
  palmEngaged = false;
  palmSince = 0;
  pendingAction = null;
  wasCircling = false;
  setMeter(0);
  stopTracks();
  pip.hidden = true;
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  statusDot.classList.remove("live");
  cameraBtn.setAttribute("aria-label", "开启摄像头");
  cameraBtn.setAttribute("aria-pressed", "false");
  cameraBtn.classList.remove("is-on");
  hintEl.textContent = "";
  if (activeAction !== "walking") setAction("walking");
  else applyActionUi("walking", false);
}

function stopTracks() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
}

async function ensureLandmarker() {
  if (landmarker) return landmarker;
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        new URL("../vendor/mediapipe/wasm", import.meta.url).href,
      );
      try {
        return await HandLandmarker.createFromOptions(fileset, landmarkerOptions("GPU"));
      } catch (error) {
        console.warn(error);
        return HandLandmarker.createFromOptions(fileset, landmarkerOptions("CPU"));
      }
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

function landmarkerOptions(delegate) {
  return {
    baseOptions: {
      modelAssetPath: new URL("../vendor/mediapipe/hand_landmarker.task", import.meta.url).href,
      delegate,
    },
    runningMode: "VIDEO",
    numHands: 1,
  };
}

function cameraError(error) {
  if (error?.name === "NotAllowedError") return "没有摄像头权限。请在浏览器地址栏允许后重试。";
  if (error?.name === "NotFoundError") return "没有找到摄像头。";
  return "摄像头或手势模型打开失败，请检查网络后重试。";
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 4600);
}

if (new URLSearchParams(location.search).has("debug")) {
  window.__stage = {
    setAction,
    pose(name) {
      setAction(name);
    },
    setLive(on) {
      live = on;
      if (on) {
        statusDot.classList.add("live");
        pip.hidden = false;
      }
    },
    nudgeYaw(delta) {
      if (!wasCircling) targetYaw = currentYaw;
      targetYaw += delta;
      wasCircling = true;
      circleStill = 0;
    },
    releaseYaw() {
      circleStill = 1;
      wasCircling = true;
    },
    audio: () => score.debugState(),
  };
}
