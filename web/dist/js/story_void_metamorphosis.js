// ============================================================
// Monster Arena — VOID METAMORPHOSIS CUTSCENE
// The secret transformation: the Void boss's initial crystal
// form stretches and detonates into the VOID EVOLUTION — a vast
// horizontal singularity with multi-coloured crystal wings and
// orbiting sigil rings. Serious, cursed, cosmic-horror tone.
// Uses the shared Cinematic engine (letterbox, beats, skip).
// ============================================================
(function () {
  'use strict';
  const ACCENT = '#c88aff';
  const COLS = ['#7dffa3', '#ffd166', '#9fe3ff', '#ff7a66'];
  let stars = [], shards = [], rings = [], debris = [];

  function makeStars() {
    stars = [];
    for (let i = 0; i < 200; i++) stars.push({
      x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.4,
      a: 0.2 + Math.random() * 0.6, ph: Math.random() * 6.28, pull: 0
    });
  }
  function makeShards() {
    shards = [];
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * 6.28, sp = 0.2 + Math.random() * 1.2;
      shards.push({ a, sp, s: 8 + Math.random() * 32, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6, tilt: Math.random() * 6.28, col: COLS[i % 4] });
    }
  }
  function makeRings() {
    rings = [];
    for (let i = 0; i < 4; i++) rings.push({ r: 0.3 + i * 0.12, w: 0.6 + i * 0.3, ph: i * 1.3, col: COLS[i % 4] });
  }

  function buildBackdrop(c, W, H) {
    c.fillStyle = '#010003'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, H * 0.5, 10, W / 2, H * 0.5, W * 0.8);
    g.addColorStop(0, 'rgba(50,10,90,0.4)'); g.addColorStop(0.5, 'rgba(20,5,50,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function drawStars(c, W, H, t, det) {
    c.save();
    for (const s of stars) {
      s.ph += 0.02;
      const dx = s.x - 0.5, dy = s.y - 0.5, d = Math.hypot(dx, dy) + 0.01;
      s.pull += (det - s.pull) * 0.05;
      const px = s.x + dx / d * s.pull * 0.12, py = s.y + dy / d * s.pull * 0.12;
      c.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(t * 1.4 + s.ph)) * (1 - det * 0.5);
      c.fillStyle = '#d8d0ff';
      c.beginPath(); c.arc(px * W, py * H, s.r, 0, 6.28); c.fill();
    }
    c.restore();
  }

  // the initial crystal form — a compact obsidian cluster with a black core
  function drawForm1(c, W, H, t, k) {
    const cx = W / 2, cy = H * 0.48, R = Math.min(W, H) * 0.16 * (1 - k * 0.3);
    // gravitational glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(cx, cy, 4, cx, cy, R * 3.5);
    gg.addColorStop(0, 'rgba(200,138,255,' + (0.5 + k * 0.3) + ')'); gg.addColorStop(0.4, 'rgba(120,40,200,0.2)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, 0, W, H); c.restore();
    // obsidian crystal body
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.5) * 0.06);
    const F = [
      { pts: [[0, -R * 1.2], [R * 0.7, -R * 0.2], [0, R * 0.8]], col: '#2a1038', sh: 1 },
      { pts: [[0, -R * 1.2], [-R * 0.7, -R * 0.2], [0, R * 0.8]], col: '#1a0828', sh: 0.5 },
      { pts: [[R * 0.7, -R * 0.2], [R * 0.4, R * 1.1], [0, R * 0.8]], col: '#3a1850', sh: 0.8 },
      { pts: [[-R * 0.7, -R * 0.2], [0, R * 0.8], [-R * 0.4, R * 1.1]], col: '#150520', sh: 0.3 }
    ];
    for (const f of F) {
      const g = c.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[2][0], f.pts[2][1]);
      g.addColorStop(0, f.col); g.addColorStop(1, '#05010a');
      c.fillStyle = g; c.strokeStyle = 'rgba(200,138,255,0.5)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.closePath(); c.fill(); c.stroke();
    }
    // black core + accretion ring
    c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, R * 0.28, 0, 6.28); c.fill();
    c.strokeStyle = 'rgba(200,138,255,0.9)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R * 0.3, 0, 6.28); c.stroke();
    c.restore();
  }

  // the detonation — crystal shatters, reality tears, light erupts
  function drawDetonation(c, W, H, t, p) {
    const cx = W / 2, cy = H * 0.48;
    c.save(); c.globalCompositeOperation = 'lighter';
    const fl = Math.max(0, 1 - p * 3); if (fl > 0) { c.fillStyle = 'rgba(220,180,255,' + (0.8 * fl) + ')'; c.fillRect(0, 0, W, H); }
    const rr = p * W * 0.7;
    c.strokeStyle = 'rgba(200,138,255,' + (0.8 * Math.max(0, 1 - p * 1.5)) + ')'; c.lineWidth = 10 * Math.max(0.1, 1 - p); c.beginPath(); c.arc(cx, cy, rr, 0, 6.28); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,' + (0.6 * Math.max(0, 1 - p * 1.5)) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, rr * 0.9, 0, 6.28); c.stroke();
    c.restore();
    // flying shards
    c.save();
    for (const s of shards) {
      const d = s.sp * W * 0.5 * Math.pow(p, 0.6), x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d * 0.7;
      c.save(); c.translate(x, y); c.rotate(s.rot + p * s.vr); c.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(s.tilt)));
      const col = s.col;
      c.fillStyle = col + 'cc'; c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -s.s * (1 - p * 0.3)); c.lineTo(s.s * 0.25, 0); c.lineTo(-s.s * 0.15, s.s * 0.5); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // the VOID EVOLUTION — vast horizontal singularity with crystal wings
  function drawForm2(c, W, H, t, k) {
    const cx = W / 2, cy = H * 0.46, R = Math.min(W, H) * 0.14 * (0.5 + k * 0.5);
    // gravitational lensing glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(cx, cy, 4, cx, cy, R * 6);
    gg.addColorStop(0, 'rgba(200,138,255,' + (0.45 * k) + ')'); gg.addColorStop(0.3, 'rgba(120,40,200,' + (0.2 * k) + ')'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, 0, W, H); c.restore();

    // two great segmented crystal wings extending outward
    c.save(); c.translate(cx, cy);
    for (const side of [-1, 1]) {
      c.save(); c.scale(side, 1);
      const segs = 6;
      for (let i = 0; i < segs; i++) {
        const f = i / segs, w = R * (2.5 - f * 1.8), h = R * (0.5 - f * 0.35) * (1 + Math.sin(t * 2 + i) * 0.1);
        const seg = c.createLinearGradient(0, -h, 0, h);
        const col = COLS[i % 4];
        seg.addColorStop(0, col + 'aa'); seg.addColorStop(0.5, '#0a0218'); seg.addColorStop(1, col + '66');
        c.fillStyle = seg; c.strokeStyle = 'rgba(200,138,255,0.6)'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(R * 0.3, -h); c.lineTo(R * 0.3 + w, -h * 0.3); c.lineTo(R * 0.3 + w * 0.9, h); c.lineTo(R * 0.3, h); c.closePath(); c.fill(); c.stroke();
      }
      c.restore();
    }
    c.restore();

    // orbiting sigil rings (multi-coloured, etched with runes)
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(cx, cy);
    for (const r of rings) {
      const rr = R * r.r * (1 + k * 0.3), rot = t * r.w + r.ph;
      c.strokeStyle = r.col + 'aa'; c.lineWidth = 2.5; c.setLineDash([14, 8]); c.lineDashOffset = -rot * 40;
      c.beginPath(); c.ellipse(0, 0, rr, rr * 0.3, rot, 0, 6.28); c.stroke();
      c.setLineDash([]);
    }
    c.restore();

    // the event horizon — solid black core with bright accretion ring
    c.save(); c.translate(cx, cy);
    c.fillStyle = '#000'; c.beginPath(); c.ellipse(0, 0, R * 0.5, R * 0.18, 0, 0, 6.28); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(200,138,255,' + (0.8 + 0.2 * Math.sin(t * 3)) + ')'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(0, 0, R * 0.55, R * 0.2, 0, 0, 6.28); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, 0, R * 0.55, R * 0.2, 0, 0, 6.28); c.stroke();
    c.restore();
    c.restore();

    // floating mini-singularities
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = t * 0.5 + i * 1.26, d = R * (2.2 + Math.sin(t + i) * 0.3), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.3;
      c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, 4, 0, 6.28); c.fill();
      c.strokeStyle = 'rgba(200,138,255,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 5, 0, 6.28); c.stroke();
    }
    c.restore();
  }

  function render(ctx, scene, W, H, t, env) {
    const k = Math.min(1, env.sceneT / 8);
    if (scene === 0) {
      env.cam(1 + 0.15 * k, 0, H * 0.02 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawStars(ctx, W, H, t, 0);
      drawForm1(ctx, W, H, t, k);
    } else if (scene === 1) {
      env.cam(1.2 + 0.3 * k, 0, -H * 0.03 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawStars(ctx, W, H, t, k * 0.5);
      drawDetonation(ctx, W, H, t, k);
      drawForm1(ctx, W, H, t, 1 - k);
    } else {
      env.cam(1.5 + 0.1 * k, 0, -H * 0.04 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawStars(ctx, W, H, t, 1);
      drawForm2(ctx, W, H, t, k);
    }
    ctx.restore();
  }

  function post(ctx, W, H, t, env) {
    env.grade('rgba(200,138,255,1)', 0.16, 'soft-light');
    env.grade('rgba(10,2,20,1)', 0.18, 'multiply');
    env.grain(0.08);
  }

  function play(script, opts) {
    makeStars(); makeShards(); makeRings();
    Cinematic.play({
      prefix: 'VoidMetamorphosis', accent: ACCENT,
      beats: script, beatScenes: [0, 1, 2],
      buildBackdrop, render, post, onDone: (opts && opts.onDone) || function () {}
    });
  }
  window.VoidMetamorphosisCutscene = { play, done: () => Cinematic.done() };
})();
