import { BAR, HOLD_SEC, OPENING, ROUND_COUNT, WINDOW_EARLY, WINDOW_LATE, createRound } from "./round.js";

let failed = 0;
function check(name, ok, detail = "") {
  console.log(name, detail, ok ? "OK" : "FAIL");
  if (!ok) failed += 1;
}

{
  const round = createRound(() => 0);
  round.start(0);
  const plan = round.plan();
  const adjacent = plan.some((gesture, index) => index > 0 && gesture === plan[index - 1]);
  check("plan-length", plan.length === ROUND_COUNT, String(plan.length));
  check("plan-no-repeat", !adjacent, plan.slice(0, 6).join(","));
  check("plan-starts-ok", plan[0] === "ok" && round.snapshot(0).gesture === "ok");
  check("align-zero", round.snapshot(0).origin === 0);
}

{
  const round = createRound(() => 0);
  round.start(0.5);
  check("align-next-bar", Math.abs(round.snapshot(0.5).origin - BAR) < 1e-6, String(round.snapshot(0.5).origin));
}

{
  const round = createRound(() => 0);
  round.start(0);
  const beat = BAR;
  round.offer("ok", beat - 0.2);
  const early = round.advance(beat - 0.05);
  const landed = round.advance(beat + 0.04);
  const hit = landed.find((event) => event.type === "hit");
  check("perfect-waits", early.length === 0);
  check("perfect-hit", Boolean(hit?.perfect) && hit.points === 200 && hit.combo === 1, JSON.stringify(hit));
  const view = round.snapshot(beat + 0.04);
  check("perfect-score", view.score === 200 && view.perfects === 1);
  check("flash-apart", view.flash === "完美" && view.kicker === "准备" && view.name === "握拳", `${view.flash} ${view.kicker} ${view.name}`);
}

{
  const round = createRound(() => 0);
  round.start(0);
  const beat = BAR;
  round.offer("ok", beat - WINDOW_EARLY);
  const events = round.advance(beat - 0.19);
  const hit = events.find((event) => event.type === "hit");
  check("early-hit", Boolean(hit) && !hit.perfect && hit.points === 100, JSON.stringify(hit));
}

{
  const round = createRound(() => 0);
  round.start(0);
  const first = BAR;
  round.offer("ok", first - 0.2);
  round.advance(first + 0.02);
  const second = BAR * 2;
  round.offer("gun", second - 0.3);
  const events = round.advance(second - 0.06);
  const wrong = events.find((event) => event.type === "miss");
  const view = round.snapshot(second);
  check("wrong-breaks", wrong?.reason === "wrong" && view.combo === 0 && view.misses === 1, JSON.stringify(wrong));
  check("wrong-keeps-score", view.score === 200);
}

{
  const round = createRound(() => 0);
  round.start(0);
  const beat = BAR;
  round.offer("fist", 0.1);
  const duringLead = round.advance(0.4);
  round.offer("none", 0.5);
  const events = round.advance(beat + WINDOW_LATE + 0.02);
  const miss = events.find((event) => event.type === "miss");
  check("early-wrong-ignored", duringLead.length === 0);
  check("timeout-miss", miss?.reason === "miss" && round.snapshot(beat + 1).combo === 0, JSON.stringify(miss));
}

{
  const round = createRound(() => 0);
  round.start(0);
  let done = null;
  for (let i = 1; i <= ROUND_COUNT; i += 1) {
    const close = i * BAR + WINDOW_LATE + 0.02;
    const events = round.advance(close);
    done = events.find((event) => event.type === "done") || done;
  }
  const view = round.snapshot(ROUND_COUNT * BAR + 1);
  check("round-done", view.phase === "done" && done?.misses === ROUND_COUNT && done.total === ROUND_COUNT, JSON.stringify(done));
  check("round-about-minute", ROUND_COUNT * BAR > 55 && ROUND_COUNT * BAR < 62, ROUND_COUNT * BAR.toFixed(2));
}

{
  const round = createRound(() => 0);
  round.start(0);
  const first = BAR;
  const second = BAR * 2;
  round.offer("ok", first - 0.2);
  round.advance(first + 0.02);
  round.offer("fist", second - 0.2);
  const events = round.advance(second + 0.04);
  const hit = events.find((event) => event.type === "hit");
  check("combo-points", hit?.combo === 2 && hit.perfect && hit.points === 250 && round.snapshot(second).score === 450, JSON.stringify(hit));
}

{
  const easy = new Set(["ok", "fist", "peace", "gun"]);
  const round = createRound(() => 0);
  round.start(0);
  const plan = round.plan();
  check("opening-easy", plan.slice(0, OPENING).every((gesture) => easy.has(gesture)), plan.slice(0, OPENING).join(","));
}

{
  const round = createRound(() => 0.95);
  round.start(0);
  const plan = round.plan();
  const followed = plan.every((gesture, index) => gesture !== "gun" || index === plan.length - 1 || plan[index + 1] === "middle");
  check("gun-then-getup", plan[0] === "gun" && plan[1] === "middle" && followed, plan.slice(0, 4).join(","));
}

{
  const easy = new Set(["ok", "fist", "peace", "gun"]);
  const round = createRound(() => 0.7);
  round.start(0);
  const plan = round.plan();
  const opening = plan.slice(0, OPENING).every((gesture, index) => {
    if (index > 0 && plan[index - 1] === "gun") return gesture === "middle";
    return easy.has(gesture);
  });
  check("opening-skips-hard", opening, plan.slice(0, OPENING).join(","));
  check("later-includes-hard", plan.slice(OPENING).includes("slap"), plan.slice(OPENING, OPENING + 6).join(","));
}

{
  const round = createRound(() => 0);
  round.start(0);
  const events = round.end(1);
  const done = events.find((event) => event.type === "done");
  check("quit-early", round.phase() === "done" && done?.misses === 0 && done.score === 0, JSON.stringify(done));
}

{
  const holdEnds = BAR - WINDOW_EARLY + HOLD_SEC;
  check("hold-fits-window", holdEnds < BAR + WINDOW_LATE);
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("all passed");
