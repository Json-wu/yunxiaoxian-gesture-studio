import { BPM } from "./audio.js";
import { ACTIONS, GESTURE_NAMES, GESTURE_TO_ACTION } from "./program.js";

export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const HOLD_SEC = 0.22;
export const WINDOW_EARLY = 0.42;
export const WINDOW_LATE = 0.34;
export const WINDOW_LATE_TIGHT = 0.2;
export const PERFECT = 0.18;
export const ROUND_COUNT = 30;
export const OPENING = 8;
export const DOUBLE_FROM = 17;
export const DOUBLE_TO = 24;

const EASY = ["ok", "fist", "peace", "gun"];
const STEADY = ["ok", "fist", "peace", "gun", "ily", "slap", "piano"];
const DOUBLED = ["ok", "fist", "peace", "gun", "ily"];

const EASY_WEIGHTS = { ok: 3, fist: 3, peace: 3, gun: 2 };
const STEADY_WEIGHTS = { ok: 5, fist: 5, peace: 5, gun: 2, ily: 2, slap: 1, piano: 1 };
const DOUBLE_WEIGHTS = { ok: 3, fist: 3, peace: 3, gun: 2, ily: 2 };

const FLASH_SEC = 0.55;
const FLASH_LABEL = {
  perfect: "完美",
  hit: "命中",
  miss: "错过",
  wrong: "不对",
};

function catalog() {
  const items = {};
  for (const [gesture, action] of Object.entries(GESTURE_TO_ACTION)) {
    items[gesture] = {
      gesture,
      action,
      name: GESTURE_NAMES[gesture],
      title: ACTIONS[action].title,
      color: ACTIONS[action].color,
    };
  }
  return items;
}

function weighted(items, gestures, weights) {
  const pool = [];
  for (const gesture of gestures) {
    const item = items[gesture];
    const weight = weights[gesture] || 0;
    if (!item || weight <= 0) continue;
    for (let i = 0; i < weight; i += 1) pool.push(item);
  }
  return pool;
}

function beatNumber(index) {
  return index + 1;
}

function isDoubleBeat(index) {
  const beat = beatNumber(index);
  return beat >= DOUBLE_FROM && beat <= DOUBLE_TO;
}

function alignBar(time) {
  const bars = Math.round(time / BAR);
  if (Math.abs(time - bars * BAR) < 0.001) return bars * BAR;
  return (Math.floor(time / BAR) + 1) * BAR;
}

function blank() {
  return {
    phase: "idle",
    origin: 0,
    prompts: [],
    index: 0,
    holdRaw: null,
    holdSinceMusic: 0,
    score: 0,
    combo: 0,
    best: 0,
    hits: 0,
    perfects: 0,
    misses: 0,
    flash: null,
  };
}

function pointsFor(combo, perfect) {
  const base = 100 + (combo - 1) * 25;
  return perfect ? base * 2 : base;
}

export function createRound(random = Math.random) {
  const items = catalog();
  const easyPool = weighted(items, EASY, EASY_WEIGHTS);
  const steadyPool = weighted(items, STEADY, STEADY_WEIGHTS);
  const doublePool = weighted(items, DOUBLED, DOUBLE_WEIGHTS);
  let state = blank();

  function pick(pool, prev) {
    for (let i = 0; i < 8; i += 1) {
      const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
      const choice = pool[index];
      if (choice.gesture !== prev) return choice;
    }
    return pool.find((item) => item.gesture !== prev) || pool[0];
  }

  function hit(prompt, perfect) {
    state.combo += 1;
    state.best = Math.max(state.best, state.combo);
    const points = pointsFor(state.combo, perfect) * (prompt.double ? 2 : 1);
    state.score += points;
    if (perfect) state.perfects += 1;
    else state.hits += 1;
    return {
      type: "hit",
      action: prompt.action,
      gesture: prompt.gesture,
      perfect,
      double: Boolean(prompt.double),
      points,
      combo: state.combo,
    };
  }

  function miss(reason) {
    state.combo = 0;
    state.misses += 1;
    return { type: "miss", reason };
  }

  function finish(events, musicElapsed) {
    if (state.phase === "done") return;
    state.phase = "done";
    state.flash = null;
    events.push({
      type: "done",
      score: state.score,
      best: state.best,
      hits: state.hits,
      perfects: state.perfects,
      misses: state.misses,
      total: state.prompts.length,
      at: musicElapsed,
    });
  }

  function judge(prompt, musicElapsed) {
    const center = state.origin + prompt.beat;
    const open = center - WINDOW_EARLY;
    const close = center + (prompt.late || WINDOW_LATE);
    const raw = state.holdRaw;
    const since = state.holdSinceMusic;

    if (raw === prompt.gesture) {
      const completed = since + HOLD_SEC;
      const judgeAt = Math.max(completed, open);
      if (musicElapsed >= judgeAt && judgeAt <= close) {
        return hit(prompt, Math.abs(judgeAt - center) <= PERFECT);
      }
    } else if (raw && GESTURE_TO_ACTION[raw]) {
      const completed = since + HOLD_SEC;
      const mark = Math.max(completed, open + HOLD_SEC);
      if (musicElapsed >= mark && mark <= close) return miss("wrong");
    }

    if (musicElapsed > close) return miss("miss");
    return null;
  }

  function snapshot(musicElapsed) {
    const flashing = Boolean(state.flash && musicElapsed < state.flash.until);
    const prompt = state.phase === "live" ? state.prompts[state.index] : null;
    const center = prompt ? state.origin + prompt.beat : 0;
    const open = center - WINDOW_EARLY;
    const lead = center - BAR;
    let travel = 0;
    if (prompt) travel = Math.max(0, Math.min(1, (musicElapsed - lead) / BAR));
    let hold = 0;
    if (prompt && state.holdRaw === prompt.gesture) {
      hold = Math.max(0, Math.min(1, (musicElapsed - state.holdSinceMusic) / HOLD_SEC));
    }
    let kicker = "";
    if (prompt) {
      if (hold > 0 && hold < 1) kicker = "稳住";
      else if (musicElapsed >= open) kicker = "出手";
      else kicker = "准备";
    }
    return {
      phase: state.phase,
      gesture: prompt?.gesture || "",
      name: prompt?.name || "",
      title: prompt?.title || "",
      action: prompt?.action || "",
      color: prompt?.color || "#3ee0ff",
      kicker,
      flash: flashing ? FLASH_LABEL[state.flash.kind] || "" : "",
      double: Boolean(prompt?.double),
      beat: prompt ? state.index + 1 : 0,
      total: state.prompts.length,
      travel,
      hold,
      score: state.score,
      combo: state.combo,
      best: state.best,
      hits: state.hits,
      perfects: state.perfects,
      misses: state.misses,
      origin: state.origin,
    };
  }

  return {
    start(musicElapsed) {
      const origin = alignBar(musicElapsed);
      const prompts = [];
      let prev = "";
      for (let i = 0; i < ROUND_COUNT; i += 1) {
        const doubled = isDoubleBeat(i);
        const pool = i < OPENING ? easyPool : doubled ? doublePool : steadyPool;
        const item = prev === "gun" ? items.middle : pick(pool, prev);
        prev = item.gesture;
        prompts.push({
          ...item,
          beat: (i + 1) * BAR,
          late: i < OPENING ? WINDOW_LATE : WINDOW_LATE_TIGHT,
          double: doubled,
        });
      }
      state = {
        ...blank(),
        phase: "live",
        origin,
        prompts,
      };
    },
    stop() {
      state = blank();
    },
    phase() {
      return state.phase;
    },
    plan() {
      return state.prompts.map((item) => item.gesture);
    },
    end(musicElapsed) {
      const events = [];
      if (state.phase !== "live") return events;
      finish(events, musicElapsed);
      return events;
    },
    offer(raw, musicElapsed) {
      if (state.phase !== "live") return;
      if (!raw || raw === state.holdRaw) return;
      state.holdRaw = raw;
      state.holdSinceMusic = musicElapsed;
    },
    advance(musicElapsed) {
      const events = [];
      if (state.phase !== "live") return events;
      const prompt = state.prompts[state.index];
      if (!prompt) {
        finish(events, musicElapsed);
        return events;
      }
      const event = judge(prompt, musicElapsed);
      if (!event) return events;
      events.push(event);
      state.flash = {
        kind: event.type === "hit" ? (event.perfect ? "perfect" : "hit") : event.reason,
        until: musicElapsed + FLASH_SEC,
      };
      state.index += 1;
      state.holdRaw = null;
      if (state.index >= state.prompts.length) finish(events, musicElapsed);
      return events;
    },
    snapshot,
  };
}
