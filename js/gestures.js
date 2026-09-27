const FINGERS = {
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

const EMPTY = {
  raw: "none",
  label: "none",
  span: 0,
  circling: false,
  yawDelta: 0,
  pointing: false,
};

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z - b.z) * 0.65;
  return Math.hypot(dx, dy, dz);
}

function angleAt(a, b, c) {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v1z = a.z - b.z;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const v2z = c.z - b.z;
  const d1 = Math.hypot(v1x, v1y, v1z) || 1;
  const d2 = Math.hypot(v2x, v2y, v2z) || 1;
  const cos = (v1x * v2x + v1y * v2y + v1z * v2z) / (d1 * d2);
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

function fingerStraight(lm, ids) {
  const [mcp, pip, dip, tip] = ids;
  const bend = angleAt(lm[mcp], lm[pip], lm[dip]);
  const outer = angleAt(lm[pip], lm[dip], lm[tip]);
  const reach = dist(lm[tip], lm[0]) > dist(lm[pip], lm[0]) * 1.08;
  return bend > 2.05 && outer > 1.85 && reach;
}

function thumbExtended(lm) {
  const bend = angleAt(lm[2], lm[3], lm[4]);
  const away = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.06;
  const longer = dist(lm[4], lm[1]) > dist(lm[3], lm[1]) * 1.02;
  return bend > 1.95 && away && longer;
}

function straightness(lm, ids) {
  const [mcp, pip, dip] = ids;
  const bend = angleAt(lm[mcp], lm[pip], lm[dip]);
  return Math.min(1, Math.max(0, (bend - 1.15) / 1.55));
}

function palmNormal(lm) {
  const ax = lm[5].x - lm[0].x;
  const ay = lm[5].y - lm[0].y;
  const az = lm[5].z - lm[0].z;
  const bx = lm[17].x - lm[0].x;
  const by = lm[17].y - lm[0].y;
  const bz = lm[17].z - lm[0].z;
  let x = ay * bz - az * by;
  let y = az * bx - ax * bz;
  let z = ax * by - ay * bx;
  const len = Math.hypot(x, y, z) || 1;
  x /= len;
  y /= len;
  z /= len;
  return { x, y, z };
}

function palmFacingUp(lm, upright) {
  const normal = palmNormal(lm);
  const flat = Math.abs(lm[9].y - lm[0].y) < 0.14;
  const tipCloser = lm[8].z < lm[5].z - 0.012 || lm[12].z < lm[9].z - 0.012;
  const facingUp = normal.y < -0.22 || (Math.abs(normal.y) > 0.22 && tipCloser);
  return !upright && flat && (tipCloser || facingUp);
}

function classifyShape(lm) {
  const straight = {
    index: fingerStraight(lm, FINGERS.index),
    middle: fingerStraight(lm, FINGERS.middle),
    ring: fingerStraight(lm, FINGERS.ring),
    pinky: fingerStraight(lm, FINGERS.pinky),
  };
  const count = Object.values(straight).filter(Boolean).length;
  const thumb = thumbExtended(lm);
  const upright = lm[9].y < lm[0].y - 0.035;
  const dx = Math.abs(lm[9].x - lm[0].x);
  const dy = Math.abs(lm[9].y - lm[0].y);
  const horizontal = dx > 0.045 && dx > dy * 1.15 && dy < 0.14;
  const curls = [
    straightness(lm, FINGERS.index),
    straightness(lm, FINGERS.middle),
    straightness(lm, FINGERS.ring),
    straightness(lm, FINGERS.pinky),
  ];
  const span = Math.hypot(lm[0].x - lm[12].x, lm[0].y - lm[12].y);

  return { straight, count, thumb, upright, horizontal, curls, span };
}

function vote(history) {
  const counts = new Map();
  for (const label of history) {
    if (label === "none" || label === "point") continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  let best = "none";
  let n = 0;
  for (const [label, count] of counts) {
    if (count > n) {
      best = label;
      n = count;
    }
  }
  return n >= 7 ? best : "none";
}

export function createTracker() {
  const history = [];
  const tips = [];
  const wrists = [];
  const indexCurl = [];
  const curls = [];
  let spanSmooth = 0.28;
  let latched = false;
  let stillSince = 0;
  let slapUntil = 0;
  let beckonUntil = 0;
  let pianoUntil = 0;

  function resetMotion() {
    tips.length = 0;
    latched = false;
    stillSince = 0;
  }

  return {
    update(landmarks, now) {
      if (!landmarks || landmarks.length < 21) {
        history.push("none");
        if (history.length > 12) history.shift();
        slapUntil = 0;
        beckonUntil = 0;
        pianoUntil = 0;
        curls.length = 0;
        resetMotion();
        return { ...EMPTY, label: vote(history), span: spanSmooth };
      }

      const shape = classifyShape(landmarks);
      curls.push(shape.curls);
      if (curls.length > 10) curls.shift();

      let pianoHot = false;
      if (curls.length >= 6) {
        const series = curls.slice(-6);
        const ranges = series[0].map((_, finger) => {
          let min = 1;
          let max = 0;
          let maxAt = 0;
          for (let i = 0; i < series.length; i += 1) {
            const value = series[i][finger];
            if (value < min) min = value;
            if (value > max) {
              max = value;
              maxAt = i;
            }
          }
          return { min, max, maxAt, range: max - min };
        });
        const movers = ranges.filter((item) => item.range > 0.12);
        let opposed = false;
        for (let i = 0; i < ranges.length && !opposed; i += 1) {
          if (ranges[i].range <= 0.12) continue;
          for (let j = i + 1; j < ranges.length; j += 1) {
            if (ranges[j].range <= 0.12) continue;
            const otherAtPeak = series[ranges[i].maxAt][j];
            const thisAtPeak = series[ranges[j].maxAt][i];
            if (otherAtPeak < ranges[j].max - 0.1 && thisAtPeak < ranges[i].max - 0.1) opposed = true;
          }
        }
        pianoHot = movers.length >= 2 && opposed;
      }

      wrists.push({ y: landmarks[0].y, t: now });
      while (wrists.length > 8) wrists.shift();
      indexCurl.push(shape.curls[0]);
      while (indexCurl.length > 10) indexCurl.shift();

      let slapStroke = false;
      if (wrists.length >= 4 && shape.count >= 3) {
        const oldest = wrists[0];
        const drop = landmarks[0].y - oldest.y;
        const elapsed = now - oldest.t;
        slapStroke = drop > 0.07 && elapsed > 40 && elapsed < 280;
      }
      if (slapStroke) slapUntil = now + 560;

      let reversals = 0;
      let prevSign = 0;
      for (let i = 1; i < indexCurl.length; i += 1) {
        const delta = indexCurl[i] - indexCurl[i - 1];
        const sign = delta > 0.05 ? 1 : delta < -0.05 ? -1 : 0;
        if (sign && prevSign && sign !== prevSign) reversals += 1;
        if (sign) prevSign = sign;
      }
      const curlRange = indexCurl.length
        ? Math.max(...indexCurl) - Math.min(...indexCurl)
        : 0;
      const beckonHot = reversals >= 2
        && curlRange > 0.34
        && !shape.straight.middle
        && shape.count <= 2
        && palmFacingUp(landmarks, shape.upright);
      if (beckonHot) beckonUntil = now + 700;
      if (pianoHot) pianoUntil = now + 720;

      const gun = shape.straight.index
        && shape.thumb
        && !shape.straight.middle
        && !shape.straight.ring
        && !shape.straight.pinky;
      const peace = shape.straight.index
        && shape.straight.middle
        && !shape.straight.ring
        && !shape.straight.pinky;
      const ily = shape.straight.index
        && shape.straight.pinky
        && !shape.straight.middle
        && !shape.straight.ring
        && shape.thumb;
      const handSize = dist(landmarks[0], landmarks[9]) || 0.12;
      const pinch = dist(landmarks[4], landmarks[8]) < handSize * 0.72;
      const ok = pinch
        && !shape.straight.index
        && shape.straight.middle
        && shape.straight.ring
        && shape.straight.pinky;
      const middle = shape.straight.middle
        && !shape.straight.index
        && !shape.straight.ring
        && !shape.straight.pinky;

      let raw = "none";
      if (ok) {
        raw = "ok";
        slapUntil = 0;
        beckonUntil = 0;
        pianoUntil = 0;
      } else if (pianoHot) {
        raw = "piano";
        slapUntil = 0;
      } else if (peace) {
        raw = "peace";
        slapUntil = 0;
        beckonUntil = 0;
        pianoUntil = 0;
      } else if (ily) {
        raw = "ily";
        slapUntil = 0;
        beckonUntil = 0;
        pianoUntil = 0;
      } else if (now < pianoUntil) {
        raw = "piano";
        slapUntil = 0;
      } else if (middle) {
        raw = "middle";
        slapUntil = 0;
        beckonUntil = 0;
      } else if (beckonHot || now < beckonUntil) {
        raw = "beckon";
        slapUntil = 0;
      } else if (gun) {
        raw = "gun";
        slapUntil = 0;
      } else if (slapStroke || now < slapUntil) {
        raw = "slap";
      } else if (shape.straight.index && !shape.straight.middle && !shape.straight.ring && !shape.straight.pinky && !shape.horizontal) {
        raw = "point";
      } else if (shape.count === 0 && !shape.thumb) {
        raw = "fist";
        slapUntil = 0;
        beckonUntil = 0;
      } else if (shape.count >= 4 && shape.upright && !shape.horizontal) {
        raw = "palm";
      }

      history.push(raw);
      if (history.length > 12) history.shift();

      spanSmooth = spanSmooth * 0.72 + shape.span * 0.28;

      const pointing = raw === "point";
      let yawDelta = 0;
      if (pointing) {
        tips.push({
          x: 1 - landmarks[8].x,
          y: landmarks[8].y,
          t: now,
        });
        while (tips.length > 22) tips.shift();

        if (tips.length >= 12) {
          let cx = 0;
          let cy = 0;
          for (const tip of tips) {
            cx += tip.x;
            cy += tip.y;
          }
          cx /= tips.length;
          cy /= tips.length;

          let radius = 0;
          for (const tip of tips) radius += Math.hypot(tip.x - cx, tip.y - cy);
          radius /= tips.length;

          const prev = tips[tips.length - 2];
          const last = tips[tips.length - 1];
          const speed = Math.hypot(last.x - prev.x, last.y - prev.y);
          const a0 = Math.atan2(prev.y - cy, prev.x - cx);
          const a1 = Math.atan2(last.y - cy, last.x - cx);
          let delta = a1 - a0;
          if (delta > Math.PI) delta -= Math.PI * 2;
          if (delta < -Math.PI) delta += Math.PI * 2;

          let sweep = 0;
          let angle = Math.atan2(tips[0].y - cy, tips[0].x - cx);
          for (let i = 1; i < tips.length; i += 1) {
            const next = Math.atan2(tips[i].y - cy, tips[i].x - cx);
            let step = next - angle;
            if (step > Math.PI) step -= Math.PI * 2;
            if (step < -Math.PI) step += Math.PI * 2;
            sweep += step;
            angle = next;
          }

          const circular = radius > 0.03 && Math.abs(sweep) > 0.9 && speed > 0.004;
          if (circular) {
            latched = true;
            stillSince = 0;
            yawDelta = Math.max(-0.42, Math.min(0.42, delta));
          } else if (latched) {
            if (!stillSince) stillSince = now;
            if (speed > 0.008) {
              stillSince = 0;
              yawDelta = Math.max(-0.42, Math.min(0.42, delta));
            } else if (now - stillSince > 280) {
              latched = false;
              stillSince = 0;
            }
          }
        }
      } else if (latched) {
        if (!stillSince) stillSince = now;
        if (now - stillSince > 180) {
          resetMotion();
        }
      }

      const label = vote(history);
      return {
        raw,
        label,
        span: spanSmooth,
        circling: latched && pointing,
        yawDelta: latched && pointing ? yawDelta : 0,
        pointing,
      };
    },
  };
}
