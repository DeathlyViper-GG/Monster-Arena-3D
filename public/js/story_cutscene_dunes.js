// ============================================================
// Monster Arena — Dunes Cutscene (Realm 2 intro) — cinematic v2
// Gritty, dusty, high-contrast desert dusk. Massive glaring sun
// with anamorphic lens flare, layered dune silhouettes, sandstorm
// haze. Drifting sand-grain glow sprites (no flat circles),
// prismatic glass shards (no shadowBlur), floating faceted
// sand-glass sigils (no unicode glyphs), the Pharaoh as sand +
// glass with refraction shards and glowing eyes, and a prismatic
// glass pyramid tomb. Warm amber grade + heavy grain.
// ============================================================
(function () {
  'use strict';
  const CG = window.CG;
  let grains = [], shards = [], sigils = [], dunes = [];
  let gAmber, gWhite, gBlue;

  function makeParticles() {
    gAmber = CG.glow('#ffb860'); gWhite = CG.glow('#fff4d0'); gBlue = CG.glow('#9fd8ff');
    grains = [];
    for (let i = 0; i < 360; i++) grains.push({
      x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 2.0,
      vx: 0.7 + Math.random() * 1.8, vy: (Math.random() - 0.5) * 0.4,
      a: 0.1 + Math.random() * 0.45, ph: Math.random() * 6.28, sp: Math.random() < 0.7 ? gAmber : gWhite
    });
    shards = [];
    for (let i = 0; i < 16; i++) shards.push({
      x: Math.random(), y: Math.random(), s: 6 + Math.random() * 22,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2,
      vx: 0.4 + Math.random() * 1.0, vy: (Math.random() - 0.5) * 0.3,
      a: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28
    });
    sigils = [];
    for (let i = 0; i < 12; i++) sigils.push({
      x: 0.08 + Math.random() * 0.84, y: 0.12 + Math.random() * 0.5, s: 10 + Math.random() * 26,
      ph: Math.random() * 6.28, a: 0.16 + Math.random() * 0.3, drift: 0.02 + Math.random() * 0.04,
      rot: Math.random() * 6.28, sp: Math.random() < 0.5 ? gAmber : gWhite
    });
    dunes = [];
    for (let i = 0; i < 6; i++) dunes.push({ base: 0.58 + i * 0.07, amp: 0.04 + Math.random() * 0.06, hue: 30 - i * 3, lit: 14 + i * 4, seed: i * 13.7 });
  }

  function buildBackdrop(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a0b2e'); g.addColorStop(0.32, '#3d1a3a'); g.addColorStop(0.58, '#7a3a1a');
    g.addColorStop(0.8, '#b5602a'); g.addColorStop(1, '#321a06');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const sx = W * 0.6, sy = H * 0.34, sr = Math.min(W, H) * 0.1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr * 4.5);
    sg.addColorStop(0, 'rgba(255,248,210,0.95)'); sg.addColorStop(0.18, 'rgba(255,200,120,0.6)'); sg.addColorStop(0.5, 'rgba(255,140,50,0.18)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 6.28); ctx.fill();
    ctx.restore();
    for (let i = 0; i < dunes.length; i++) {
      const d = dunes[i]; const by = H * d.base;
      const dg = ctx.createLinearGradient(0, by - H * 0.06, 0, by + H * 0.2);
      dg.addColorStop(0, `hsl(${d.hue},55%,${d.lit}%)`); dg.addColorStop(1, `hsl(${d.hue},50%,${d.lit - 6}%)`);
      ctx.fillStyle = dg; ctx.beginPath(); ctx.moveTo(0, by);
      let seed = d.seed * 99 + 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const steps = 50;
      for (let k = 0; k <= steps; k++) { const x = (k / steps) * W; const env = Math.sin((k / steps) * Math.PI * (3 + i)); ctx.lineTo(x, by - Math.abs(env) * H * d.amp * (0.6 + rnd() * 0.5)); }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.75);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(220,170,90,0.08)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, H * 0.5, W, H * 0.25); ctx.restore();
    const v = ctx.createRadialGradient(W * 0.6, H * 0.34, H * 0.2, W * 0.5, H * 0.6, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function lensFlare(c, W, H, t) {
    const sx = W * 0.6, sy = H * 0.34;
    c.save(); c.globalCompositeOperation = 'lighter';
    const st = c.createLinearGradient(0, sy, W, sy);
    const fl = 0.5 + 0.5 * Math.sin(t * 0.8);
    st.addColorStop(0, 'rgba(255,220,150,0)'); st.addColorStop(0.5, `rgba(255,235,180,${0.18 * fl})`); st.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = st; c.fillRect(0, sy - 2, W, 4);
    for (let i = 1; i <= 5; i++) {
      const gx = sx - (sx - W * 0.2) * (i / 6), gy = sy + (H * 0.6 - sy) * (i / 6), rr = 14 + i * 6;
      c.globalAlpha = 0.12 * fl / i; c.drawImage(gWhite, gx - rr, gy - rr, rr * 2, rr * 2);
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawGrains(c, W, H, t, mul) {
    mul = mul || 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (const gr of grains) {
      gr.x += gr.vx * 0.008 * mul; gr.y += gr.vy * 0.008 + Math.sin(t * 2 + gr.ph) * 0.003;
      if (gr.x > 1.05) gr.x = -0.05;
      const fl = 0.6 + 0.4 * Math.sin(gr.ph + t * 3);
      c.globalAlpha = gr.a * fl; const r = gr.r * 3;
      c.drawImage(gr.sp, gr.x * W - r, gr.y * H - r, r * 2, r * 2);
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawShards(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const s of shards) {
      s.x += s.vx * 0.004; s.y += s.vy * 0.004; s.rot += s.vr * 0.02; s.ph += 0.03;
      if (s.x > 1.1) s.x = -0.1; if (s.x < -0.1) s.x = 1.1; if (s.y > 1.1) s.y = -0.1; if (s.y < -0.1) s.y = 1.1;
      const fl = 0.5 + 0.5 * Math.sin(s.ph);
      c.save(); c.translate(s.x * W, s.y * H); c.rotate(s.rot);
      c.globalAlpha = s.a * fl * 0.6; c.drawImage(gWhite, -s.s * 1.6, -s.s * 1.6, s.s * 3.2, s.s * 3.2); c.globalAlpha = 1;
      const gg = c.createLinearGradient(0, -s.s, 0, s.s);
      gg.addColorStop(0, `rgba(255,235,180,${s.a * fl})`); gg.addColorStop(0.5, `rgba(180,220,255,${s.a * 0.6 * fl})`); gg.addColorStop(1, `rgba(255,235,180,${s.a * fl})`);
      c.fillStyle = gg; c.strokeStyle = `rgba(255,240,200,${s.a * fl * 0.6})`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -s.s); c.lineTo(s.s * 0.4, 0); c.lineTo(0, s.s); c.lineTo(-s.s * 0.4, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.restore();
  }
  // Floating faceted sand-glass sigils (replace unicode hieroglyphs).
  function drawSigils(c, W, H, t, mul) {
    mul = mul || 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (const g of sigils) {
      g.y -= g.drift * 0.004; g.ph += 0.03; g.rot += 0.004; if (g.y < -0.05) g.y = 1.05;
      const fl = 0.5 + 0.5 * Math.sin(g.ph), s = g.s * mul;
      c.save(); c.translate(g.x * W, g.y * H); c.rotate(g.rot);
      c.globalAlpha = g.a * fl * 0.7; c.drawImage(g.sp, -s * 1.8, -s * 1.8, s * 3.6, s * 3.6); c.globalAlpha = 1;
      // faceted diamond
      const fg = c.createLinearGradient(0, -s, 0, s);
      fg.addColorStop(0, `rgba(255,230,170,${g.a * fl})`); fg.addColorStop(0.5, `rgba(200,150,80,${g.a * fl})`); fg.addColorStop(1, `rgba(120,80,30,${g.a * fl})`);
      c.fillStyle = fg; c.strokeStyle = `rgba(255,240,200,${g.a * fl * 0.8})`; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.5, 0); c.lineTo(0, s); c.lineTo(-s * 0.5, 0); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = `rgba(255,250,220,${g.a * fl * 0.6})`; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -s); c.lineTo(0, s); c.moveTo(-s * 0.5, 0); c.lineTo(s * 0.5, 0); c.stroke();
      c.restore();
    }
    c.globalAlpha = 1; c.restore();
  }
  // The Pharaoh: sand-glass form — headdress silhouette in swirling sand-glow,
  // refraction shards, glowing blue eyes. No shadowBlur.
  function drawPharaoh(c, x, y, s, t, env) {
    const form = Math.max(0, Math.min(1, (env.sceneT - 0.25) * 0.5)); if (form <= 0) return;
    c.save(); c.globalAlpha = form; c.translate(x, y - s * 1.4);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 36; i++) { const a = t * 1.1 + i * 0.45; const rr = s * (0.5 + 0.7 * Math.abs(Math.sin(a * 1.4)));
      const px = Math.cos(a) * rr, py = Math.sin(a * 2) * s * 0.7;
      c.globalAlpha = form * 0.35; c.drawImage(gAmber, px - 5, py - 5, 10, 10); }
    c.globalAlpha = form;
    for (let i = 0; i < 12; i++) { const a = t * 1.3 + i * 0.9; const rr = s * (1.0 + 0.25 * Math.sin(a * 2));
      c.save(); c.translate(Math.cos(a) * rr, Math.sin(a) * rr * 0.6); c.rotate(a);
      c.globalAlpha = form * 0.5; c.drawImage(gWhite, -s * 0.4, -s * 0.4, s * 0.8, s * 0.8); c.globalAlpha = form;
      const gg = c.createLinearGradient(0, -s * 0.18, 0, s * 0.18);
      gg.addColorStop(0, 'rgba(255,235,180,0.5)'); gg.addColorStop(0.5, 'rgba(160,210,255,0.3)'); gg.addColorStop(1, 'rgba(255,235,180,0.5)');
      c.fillStyle = gg; c.strokeStyle = 'rgba(255,240,200,0.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -s * 0.18); c.lineTo(s * 0.08, 0); c.lineTo(0, s * 0.18); c.lineTo(-s * 0.08, 0); c.closePath(); c.fill(); c.stroke();
      c.restore(); }
    c.globalCompositeOperation = 'source-over';
    const hg = c.createLinearGradient(0, -s * 1.1, 0, s * 0.4);
    hg.addColorStop(0, 'rgba(70,46,18,0.85)'); hg.addColorStop(1, 'rgba(40,26,10,0.6)');
    c.fillStyle = hg;
    c.beginPath(); c.moveTo(0, -s * 1.1); c.quadraticCurveTo(s * 1.2, -s * 0.5, s * 0.9, s * 0.5);
    c.quadraticCurveTo(s * 0.4, s * 0.85, 0, s * 0.78); c.quadraticCurveTo(-s * 0.4, s * 0.85, -s * 0.9, s * 0.5);
    c.quadraticCurveTo(-s * 1.2, -s * 0.5, 0, -s * 1.1); c.fill();
    c.globalCompositeOperation = 'lighter';
    const ef = 0.7 + 0.3 * Math.sin(t * 3);
    for (const dx of [-s * 0.2, s * 0.2]) { c.globalAlpha = ef * form; c.drawImage(gBlue, dx - s * 0.16, -s * 0.2 - s * 0.16, s * 0.32, s * 0.32); }
    c.globalAlpha = 1; c.restore();
  }
  // Glass pyramid tomb — prismatic facets + inner fragment glow (no glyph).
  function drawPyramid(c, x, y, s, t) {
    const h = s * (0.95 + 0.05 * Math.sin(t * 1.2));
    c.save(); c.translate(x, y);
    const faces = [
      { pts: [[0, -h], [s, 0], [0, h * 0.18]], cols: ['rgba(255,235,180,0.5)', 'rgba(160,210,255,0.35)', 'rgba(255,225,170,0.3)'] },
      { pts: [[0, -h], [-s, 0], [0, h * 0.18]], cols: ['rgba(140,200,255,0.4)', 'rgba(255,220,150,0.3)', 'rgba(120,180,240,0.25)'] }
    ];
    for (const f of faces) {
      const fg = c.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[1][0], f.pts[1][1]);
      fg.addColorStop(0, f.cols[0]); fg.addColorStop(0.5, f.cols[1]); fg.addColorStop(1, f.cols[2]);
      c.fillStyle = fg; c.strokeStyle = 'rgba(255,240,200,0.6)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.closePath(); c.fill(); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -h); c.lineTo(0, h * 0.18); c.stroke();
    c.globalCompositeOperation = 'lighter';
    const fl = 0.6 + 0.4 * Math.sin(t * 2);
    c.globalAlpha = 0.9 * fl; c.drawImage(gAmber, -s * 0.7, -h * 0.32 - s * 0.7, s * 1.4, s * 1.4); c.globalAlpha = 1;
    const fg2 = c.createRadialGradient(0, -h * 0.32, 2, 0, -h * 0.32, s * 0.4);
    fg2.addColorStop(0, `rgba(255,245,210,${fl})`); fg2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = fg2; c.beginPath(); c.arc(0, -h * 0.32, s * 0.4, 0, 6.28); c.fill();
    c.restore();
  }

  function render(ctx, scene, W, H, t, env) {
    const k = Math.min(1, env.sceneT / 8);
    if (scene === 0) {
      env.cam(1 + 0.14 * k, 0, -H * 0.03 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      lensFlare(ctx, W, H, t); drawSigils(ctx, W, H, t); drawGrains(ctx, W, H, t, 1.1);
    } else if (scene === 1) {
      env.cam(1.32 + 0.14 * k, 0, -H * 0.06 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      lensFlare(ctx, W, H, t); drawSigils(ctx, W, H, t, 0.8); drawShards(ctx, W, H, t);
      drawPharaoh(ctx, W * 0.5, H * 0.5, Math.min(W, H) * 0.15, t, env); drawGrains(ctx, W, H, t, 1.2);
    } else {
      env.cam(1.16 + 0.16 * k, 0, -H * 0.04 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      lensFlare(ctx, W, H, t); drawSigils(ctx, W, H, t, 1.1); drawShards(ctx, W, H, t);
      drawPyramid(ctx, W * 0.5, H * 0.64, Math.min(W, H) * 0.2, t); drawGrains(ctx, W, H, t, 1);
    }
    ctx.restore();
  }

  function post(ctx, W, H, t, env) {
    env.grade('rgba(255,150,60,1)', 0.2, 'soft-light'); env.grade('rgba(60,20,40,1)', 0.12, 'multiply'); env.grain(0.08);
  }

  function play(script, opts) {
    makeParticles();
    Cinematic.play({
      prefix: 'Dunes', accent: '#ffd166',
      beats: script, beatScenes: [0, 1, 2],
      buildBackdrop, render, post, onDone: (opts && opts.onDone) || function () {}
    });
  }
  window.DunesCutscene = { play, done: () => Cinematic.done() };
})();
