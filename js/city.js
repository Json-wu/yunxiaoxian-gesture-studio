function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawCity(ctx, width, height) {
  const rand = mulberry32(11);
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#12061c");
  sky.addColorStop(0.28, "#241246");
  sky.addColorStop(0.55, "#12304a");
  sky.addColorStop(0.78, "#071018");
  sky.addColorStop(1, "#04060c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const moon = ctx.createRadialGradient(width * 0.74, height * 0.16, 8, width * 0.74, height * 0.16, width * 0.28);
  moon.addColorStop(0, "rgba(255, 186, 230, 0.85)");
  moon.addColorStop(0.18, "rgba(255, 120, 190, 0.28)");
  moon.addColorStop(1, "rgba(255, 120, 190, 0)");
  ctx.fillStyle = moon;
  ctx.fillRect(0, 0, width, height);

  const cyanGlow = ctx.createRadialGradient(width * 0.18, height * 0.62, 10, width * 0.18, height * 0.62, width * 0.32);
  cyanGlow.addColorStop(0, "rgba(40, 230, 255, 0.22)");
  cyanGlow.addColorStop(1, "rgba(40, 230, 255, 0)");
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, width, height);

  const ground = height * 0.8;
  function skyline(yBase, darkness, windowAlpha, minH, maxH) {
    let x = -20;
    while (x < width + 40) {
      const bw = 28 + rand() * 78;
      const bh = minH + rand() * maxH;
      const y = yBase - bh;
      ctx.fillStyle = darkness;
      ctx.fillRect(x, y, bw, bh + 8);

      const winW = 3 + rand() * 2;
      const winH = 5 + rand() * 4;
      for (let wy = y + 10; wy < yBase - 12; wy += winH + 6) {
        for (let wx = x + 6; wx < x + bw - 8; wx += winW + 5) {
          if (rand() > 0.42) continue;
          const warm = rand() > 0.72;
          ctx.fillStyle = warm
            ? `rgba(255, 196, 120, ${windowAlpha})`
            : `rgba(120, 230, 255, ${windowAlpha * 0.85})`;
          ctx.fillRect(wx, wy, winW, winH);
        }
      }

      if (rand() > 0.72) {
        const signW = 16 + rand() * 28;
        const signH = 8 + rand() * 14;
        const sx = x + rand() * (bw - signW);
        const sy = y + 16 + rand() * Math.max(10, bh * 0.4);
        ctx.shadowColor = rand() > 0.5 ? "#ff3d92" : "#29e1ff";
        ctx.shadowBlur = 18;
        ctx.fillStyle = ctx.shadowColor;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(sx, sy, signW, signH);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      x += bw - 2;
    }
  }

  skyline(ground - height * 0.02, "#12182a", 0.9, height * 0.22, height * 0.48);
  skyline(ground + height * 0.04, "#1a2340", 1, height * 0.1, height * 0.28);

  const haze = ctx.createLinearGradient(0, ground - height * 0.12, 0, height);
  haze.addColorStop(0, "rgba(255, 70, 160, 0)");
  haze.addColorStop(0.35, "rgba(255, 60, 150, 0.18)");
  haze.addColorStop(0.7, "rgba(20, 220, 255, 0.12)");
  haze.addColorStop(1, "rgba(4, 6, 12, 0.2)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, ground - height * 0.16, width, height);

  ctx.fillStyle = "rgba(80, 240, 255, 0.16)";
  for (let i = 0; i < 18; i += 1) {
    const y = ground + 8 + i * 7;
    ctx.globalAlpha = 0.25 - i * 0.01;
    ctx.fillRect(0, y, width, 2);
  }
  ctx.globalAlpha = 1;
}

export function mountCity(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let frame = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    drawCity(ctx, width, height);
  }

  resize();
  window.addEventListener("resize", () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(resize);
  });
}
