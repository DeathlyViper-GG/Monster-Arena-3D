// ============================================================
// Monster Arena — Meadow Cutscene (Realm 1 intro) — cinematic v2
// Painterly, dreamy, soft. Deep mist layers parallax, luminous
// bokeh (glow sprites, no CSS blur), organic bezier roots
// (stroke-pairs, no shadowBlur), glow-based subjects, a drawn
// vine-and-bloom ground sigil (no font glyph). Green-gold dawn
// grade + film grain. Ken-Burns drift, letterbox, cross-dissolve.
// ============================================================
(function () {
  'use strict';
  const CG = window.CG;
  let spores = [], bokeh = [], roots = [];
  let gGreen, gGold, gWhite;

  function makeParticles() {
    gGreen = CG.glow('#7dffa3'); gGold = CG.glow('#ffe9a0'); gWhite = CG.glow('#ffffff');
    spores = [];
    for (let i = 0; i < 110; i++) spores.push({
      x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.15, vy: -0.06 - Math.random() * 0.3,
      a: 0.2 + Math.random() * 0.5, ph: Math.random() * 6.28, sp: Math.random() < 0.6 ? gGreen : gWhite
    });
    bokeh = [];
    for (let i = 0; i < 24; i++) bokeh.push({
      x: Math.random(), y: Math.random(), r: 16 + Math.random() * 60,
      vx: (Math.random() - 0.5) * 0.04, vy: -0.01 - Math.random() * 0.03,
      sp: Math.random() < 0.5 ? gGreen : gGold, a: 0.05 + Math.random() * 0.1, ph: Math.random() * 6.28
    });
    roots = [];
    for (let i = 0; i < 9; i++) roots.push({ x: 0.05 + Math.random() * 0.9, base: 0.5 + Math.random() * 0.3, amp: 0.04 + Math.random() * 0.07, len: 0.2 + Math.random() * 0.3, ph: Math.random() * 6.28 });
  }

  function buildBackdrop(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d1f15'); g.addColorStop(0.3, '#16331f'); g.addColorStop(0.6, '#1f4a2c'); g.addColorStop(1, '#0a1a10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sx = W * 0.34, sy = H * 0.2, sr = Math.min(W, H) * 0.5;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, sr);
    sg.addColorStop(0, 'rgba(200,255,210,0.5)'); sg.addColorStop(0.25, 'rgba(140,235,170,0.22)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e6ffe9'; ctx.beginPath(); ctx.arc(sx, sy, Math.min(W, H) * 0.06, 0, 6.28); ctx.fill();
    ctx.restore();
    for (let i = 0; i < 5; i++) {
      const by = H * (0.46 + i * 0.11);
      const hg = ctx.createLinearGradient(0, by - H * 0.1, 0, by + H * 0.2);
      hg.addColorStop(0, `hsla(${120 - i * 6},40%,${10 + i * 4}%,0.9)`);
      hg.addColorStop(1, `hsla(${120 - i * 6},40%,${6 + i * 3}%,0.95)`);
      ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(0, by);
      for (let x = 0; x <= W; x += 16) ctx.lineTo(x, by - Math.sin(x * 0.0024 + i * 2.1) * H * (0.04 + i * 0.02) * (0.6 + 0.4 * Math.sin(x * 0.0007)));
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const my = H * (0.55 + i * 0.1);
      const mg = ctx.createLinearGradient(0, my - H * 0.08, 0, my + H * 0.08);
      mg.addColorStop(0, 'rgba(0,0,0,0)'); mg.addColorStop(0.5, 'rgba(160,230,190,0.06)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = mg; ctx.fillRect(0, my - H * 0.08, W, H * 0.16);
    }
    ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.25, W / 2, H * 0.6, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function drawBokeh(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const b of bokeh) {
      b.x += b.vx * 0.004; b.y += b.vy * 0.004; b.ph += 0.012;
      if (b.y < -0.1) { b.y = 1.1; b.x = Math.random(); }
      const fl = 0.5 + 0.5 * Math.sin(b.ph);
      c.globalAlpha = b.a * fl; c.drawImage(b.sp, b.x * W - b.r, b.y * H - b.r, b.r * 2, b.r * 2);
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawSpores(c, W, H, t, mul) {
    mul = mul || 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (const f of spores) {
      f.x += f.vx * 0.005; f.y += f.vy * 0.005 + Math.sin(t * 1.3 + f.ph) * 0.0012;
      if (f.y < -0.05) { f.y = 1.05; f.x = Math.random(); }
      const fl = 0.5 + 0.5 * Math.sin(f.ph + t * 2.5);
      c.globalAlpha = f.a * fl * mul; const r = f.r * 3;
      c.drawImage(f.sp, f.x * W - r, f.y * H - r, r * 2, r * 2);
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawGodRays(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const sx = W * 0.34;
    for (let i = 0; i < 6; i++) {
      const a = 0.2 + i * 0.18 + Math.sin(t * 0.3 + i) * 0.04;
      const rx = sx + (i - 2.5) * W * 0.05;
      c.save(); c.translate(rx, 0); c.rotate(a);
      const rg = c.createLinearGradient(0, 0, 0, H);
      const fl = 0.4 + 0.4 * Math.sin(t * 0.5 + i);
      rg.addColorStop(0, `rgba(200,255,210,${0.05 * fl})`); rg.addColorStop(0.5, `rgba(170,240,190,${0.03 * fl})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(-W * 0.04, 0, W * 0.08, H); c.restore();
    }
    c.restore();
  }

  // Drawn vine-and-bloom ground sigil (replaces the font-glyph rune).
  function drawSeal(c, x, y, s, t, intensity) {
    intensity = intensity || 1; c.save(); const fl = 0.6 + 0.4 * Math.sin(t * 1.8);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.5 * intensity * fl; c.drawImage(gGreen, x - s * 2.4, y - s * 1.1, s * 4.8, s * 2.2);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    for (let r = 0; r < 3; r++) {
      const rr = s * (1.1 - r * 0.22), ry = s * (0.42 - r * 0.08), a = (0.5 - r * 0.13) * intensity * fl;
      c.strokeStyle = `rgba(160,250,190,${a * 0.3})`; c.lineWidth = 6 - r; c.beginPath(); c.ellipse(x, y, rr, ry, 0, 0, 6.28); c.stroke();
      c.strokeStyle = `rgba(200,255,220,${a})`; c.lineWidth = 2 - r * 0.5; c.beginPath(); c.ellipse(x, y, rr, ry, 0, 0, 6.28); c.stroke();
    }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.9 * intensity * fl; c.drawImage(gWhite, x - s * 0.5, y - s * 0.5, s, s); c.globalAlpha = 1;
    c.strokeStyle = `rgba(200,255,220,${0.8 * intensity * fl})`; c.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45 * 0.4, x + Math.cos(a) * s * 0.78, y + Math.sin(a) * s * 0.78 * 0.4); c.stroke(); }
    c.restore();
  }
  // Glowing roots growing as stroke-pair bezier curves (no shadowBlur).
  function drawRoots(c, W, H, t, s, cx) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const r of roots) {
      r.ph += 0.015; const fl = 0.4 + 0.4 * Math.sin(r.ph);
      const x0 = (cx || W / 2) + (r.x - 0.5) * W * 0.6, ex = x0 + Math.sin(r.ph) * W * r.amp;
      c.strokeStyle = `rgba(140,250,180,${0.12 * fl})`; c.lineWidth = s * 0.14;
      c.beginPath(); c.moveTo(x0, H); c.bezierCurveTo(x0, H * (1 - r.len * 0.4), ex - 30, H * (1 - r.len * 0.7), ex, H * (1 - r.len)); c.stroke();
      c.strokeStyle = `rgba(190,255,205,${0.32 * fl})`; c.lineWidth = s * 0.05;
      c.beginPath(); c.moveTo(x0, H); c.bezierCurveTo(x0, H * (1 - r.len * 0.4), ex - 30, H * (1 - r.len * 0.7), ex, H * (1 - r.len)); c.stroke();
    }
    c.restore();
  }
  // The Hearth Warden as a tower of mist + glow-spore body with two blazing eyes.
  function drawWarden(c, x, y, s, t, env) {
    const form = Math.max(0, Math.min(1, (env.sceneT - 0.2) * 0.5)); if (form <= 0) return;
    c.save(); c.globalAlpha = form;
    c.globalCompositeOperation = 'lighter';
    const col = c.createLinearGradient(x, y - s * 2, x, y + s);
    col.addColorStop(0, 'rgba(120,255,170,0)'); col.addColorStop(0.4, 'rgba(120,255,170,0.16)'); col.addColorStop(1, 'rgba(80,200,130,0.05)');
    c.fillStyle = col; c.beginPath();
    c.moveTo(x - s * 0.9, y + s * 0.6); c.quadraticCurveTo(x - s * 1.1, y - s, x - s * 0.3, y - s * 1.9);
    c.quadraticCurveTo(x, y - s * 2.2, x + s * 0.3, y - s * 1.9);
    c.quadraticCurveTo(x + s * 1.1, y - s, x + s * 0.9, y + s * 0.6); c.closePath(); c.fill();
    for (let i = 0; i < 26; i++) { const a = t * 0.9 + i * 0.5; const rr = s * (0.4 + 0.5 * Math.abs(Math.sin(a * 1.3)));
      const px = x + Math.cos(a) * rr, py = y - s * 1.0 + Math.sin(a * 2) * s * 0.9;
      c.globalAlpha = form * 0.5; c.drawImage(gGreen, px - 6, py - 6, 12, 12); }
    c.globalAlpha = form;
    const ef = 0.7 + 0.3 * Math.sin(t * 3);
    for (const dx of [-s * 0.2, s * 0.2]) { c.globalAlpha = ef * form; c.drawImage(gWhite, x + dx - s * 0.22, y - s * 1.5 - s * 0.22, s * 0.44, s * 0.44); }
    c.globalAlpha = 1; c.restore();
  }

  function render(ctx, scene, W, H, t, env) {
    const k = Math.min(1, env.sceneT / 8);
    if (scene === 0) {
      env.cam(1 + 0.16 * k, 0, -H * 0.04 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawGodRays(ctx, W, H, t); drawSeal(ctx, W * 0.5, H * 0.74, Math.min(W, H) * 0.1, t, 0.55);
      drawSpores(ctx, W, H, t); drawBokeh(ctx, W, H, t);
    } else if (scene === 1) {
      env.cam(1.35 + 0.14 * k, 0, -H * 0.07 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawWarden(ctx, W * 0.5, H * 0.66, Math.min(W, H) * 0.16, t, env);
      drawSpores(ctx, W, H, t, 1.3); drawBokeh(ctx, W, H, t);
    } else {
      env.cam(1.2 + 0.18 * k, 0, -H * 0.06 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawGodRays(ctx, W, H, t); drawRoots(ctx, W, H, t, Math.min(W, H) * 0.16, W * 0.5);
      drawSeal(ctx, W * 0.5, H * 0.62, Math.min(W, H) * 0.16, t, 1);
      drawSpores(ctx, W, H, t, 1.2); drawBokeh(ctx, W, H, t);
    }
    ctx.restore();
  }

  function post(ctx, W, H, t, env) { env.grade('rgba(120,200,120,1)', 0.18, 'soft-light'); env.grain(0.05); }

  function play(script, opts) {
    makeParticles();
    Cinematic.play({
      prefix: 'Meadow', accent: '#7dffa3',
      beats: script, beatScenes: [0, 1, 2],
      buildBackdrop, render, post, onDone: (opts && opts.onDone) || function () {}
    });
  }
  window.MeadowCutscene = { play, done: () => Cinematic.done() };
})();
