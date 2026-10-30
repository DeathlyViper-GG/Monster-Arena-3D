// ============================================================
// Monster Arena — Glacial Cutscene (Realm 3 intro) — cinematic v2
// Cold, prismatic, ethereal. Aurora ribbons, vertical light beams
// through ice, refractive crystal facets, drifting snow-glow
// sprites (no flat circles), drawn ice-sigils (no unicode runes),
// a frost vortex (the Oracle) with glowing eyes, and a crystal
// monolith holding a frozen memory. Deep cyan grade + grain.
// ============================================================
(function () {
  'use strict';
  const CG = window.CG;
  let flakes = [], shards = [], runes = [];
  let gCyan, gWhite;

  function makeParticles() {
    gCyan = CG.glow('#9fe3ff'); gWhite = CG.glow('#eaf6ff');
    flakes = [];
    for (let i = 0; i < 220; i++) flakes.push({
      x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 2.0,
      vx: (Math.random() - 0.5) * 0.2, vy: 0.25 + Math.random() * 0.8,
      a: 0.2 + Math.random() * 0.6, ph: Math.random() * 6.28, tw: 0.4 + Math.random() * 0.6,
      sp: Math.random() < 0.6 ? gWhite : gCyan
    });
    shards = [];
    for (let i = 0; i < 16; i++) shards.push({
      x: Math.random(), y: Math.random(), s: 6 + Math.random() * 22,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.6,
      a: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28
    });
    runes = [];
    for (let i = 0; i < 11; i++) runes.push({
      x: 0.06 + Math.random() * 0.88, y: 0.1 + Math.random() * 0.6, s: 12 + Math.random() * 30,
      ph: Math.random() * 6.28, a: 0.16 + Math.random() * 0.34, drift: 0.01 + Math.random() * 0.03,
      rot: Math.random() * 6.28, sp: Math.random() < 0.5 ? gCyan : gWhite
    });
  }

  function buildBackdrop(ctx, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#050a1a'); g.addColorStop(0.4, '#0a1832'); g.addColorStop(0.7, '#0c2240'); g.addColorStop(1, '#03070f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const ay = H * (0.1 + i * 0.07);
      const ag = ctx.createLinearGradient(0, ay - H * 0.1, 0, ay + H * 0.1);
      ag.addColorStop(0, 'rgba(0,0,0,0)'); ag.addColorStop(0.5, `hsla(${165 + i * 35},85%,55%,0.12)`); ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.moveTo(0, ay);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ay + Math.sin(x * 0.0035 + i * 2 + 1) * H * 0.06);
      ctx.lineTo(W, ay + H * 0.18); ctx.lineTo(0, ay + H * 0.18); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    for (const side of [0, 1]) {
      ctx.beginPath();
      if (side === 0) { ctx.moveTo(0, H); ctx.lineTo(0, H * 0.42); } else { ctx.moveTo(W, H); ctx.lineTo(W, H * 0.42); }
      let seed = side * 91 + 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let k = 0; k <= 30; k++) { const tt = k / 30; const x = side === 0 ? tt * W * 0.46 : W - tt * W * 0.46; const env = Math.sin(tt * Math.PI * (2 + side)); ctx.lineTo(x, H * 0.42 - Math.abs(env) * H * 0.12 * (0.5 + rnd() * 0.6)); }
      ctx.closePath();
      const ig = ctx.createLinearGradient(side ? W : 0, 0, side ? W * 0.5 : W * 0.5, H);
      ig.addColorStop(0, 'hsla(200,45%,16%,1)'); ig.addColorStop(1, 'hsla(205,45%,8%,1)');
      ctx.fillStyle = ig; ctx.fill();
    }
    const mx = W * 0.74, my = H * 0.2, mr = Math.min(W, H) * 0.05;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const mg = ctx.createRadialGradient(mx, my, mr * 0.1, mx, my, mr * 5);
    mg.addColorStop(0, 'rgba(200,230,255,0.6)'); mg.addColorStop(0.3, 'rgba(140,190,240,0.2)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#dceeff'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 6.28); ctx.fill(); ctx.restore();
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function drawAurora(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const ay = H * (0.12 + i * 0.07);
      c.beginPath(); c.moveTo(0, ay);
      for (let x = 0; x <= W; x += 18) c.lineTo(x, ay + Math.sin(x * 0.004 + t * 0.6 + i * 2) * H * 0.05);
      c.lineTo(W, ay + H * 0.16); c.lineTo(0, ay + H * 0.16); c.closePath();
      const ag = c.createLinearGradient(0, ay - H * 0.08, 0, ay + H * 0.08);
      const fl = 0.5 + 0.5 * Math.sin(t * 0.7 + i);
      ag.addColorStop(0, 'rgba(0,0,0,0)'); ag.addColorStop(0.5, `hsla(${170 + i * 30},85%,60%,${0.1 * fl})`); ag.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ag; c.fill();
    }
    c.restore();
  }
  function drawBeams(c, W, H, t, mul) {
    mul = mul == null ? 1 : mul;
    c.save(); c.globalCompositeOperation = 'lighter';
    const bx = W * 0.5;
    for (let i = 0; i < 7; i++) {
      const a = 0.1 + i * 0.05 + Math.sin(t * 0.2 + i) * 0.03;
      const rx = bx + (i - 3) * W * 0.08;
      c.save(); c.translate(rx, 0); c.rotate(a);
      const rg = c.createLinearGradient(0, 0, 0, H);
      const fl = 0.4 + 0.4 * Math.sin(t * 0.5 + i);
      rg.addColorStop(0, `rgba(180,225,255,${0.08 * fl * mul})`); rg.addColorStop(0.6, `rgba(140,200,255,${0.04 * fl * mul})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(-W * 0.035, 0, W * 0.07, H); c.restore();
    }
    c.restore();
  }
  // Drawn radiating ice-sigils (replace unicode runes).
  function drawRunes(c, W, H, t, mul) {
    mul = mul || 1; c.save(); c.globalCompositeOperation = 'lighter';
    for (const g of runes) {
      g.y -= g.drift * 0.003; g.ph += 0.028; g.rot += 0.003; if (g.y < -0.05) g.y = 1.05;
      const fl = 0.5 + 0.5 * Math.sin(g.ph), s = g.s * mul;
      c.save(); c.translate(g.x * W, g.y * H); c.rotate(g.rot);
      c.globalAlpha = g.a * fl * 0.7; c.drawImage(g.sp, -s * 1.6, -s * 1.6, s * 3.2, s * 3.2); c.globalAlpha = 1;
      // radiating 6-point frost star
      c.strokeStyle = `rgba(170,220,255,${g.a * fl})`; c.lineWidth = 1.1;
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * s, Math.sin(a) * s); c.stroke(); }
      c.strokeStyle = `rgba(220,240,255,${g.a * fl * 0.7})`; c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, 0, s * 0.5, 0, 6.28); c.stroke();
      c.restore();
    }
    c.globalAlpha = 1; c.restore();
  }
  function drawSnow(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const f of flakes) {
      f.x += f.vx * 0.005; f.y += f.vy * 0.005 + Math.sin(t * 1.5 + f.ph) * 0.0015;
      if (f.y > 1.05) { f.y = -0.05; f.x = Math.random(); }
      if (f.x > 1.05) f.x = -0.05; if (f.x < -0.05) f.x = 1.05;
      const fl = 0.5 + 0.5 * Math.sin(f.ph + t * f.tw * 3);
      c.globalAlpha = f.a * fl; const r = f.r * 3;
      c.drawImage(f.sp, f.x * W - r, f.y * H - r, r * 2, r * 2);
    }
    c.globalAlpha = 1; c.restore();
  }
  // The Rime Oracle: a vortex of frost-glow + ice shards with glowing eyes.
  function drawOracle(c, x, y, s, t, env) {
    const form = Math.max(0, Math.min(1, (env.sceneT - 0.2) * 0.5)); if (form <= 0) return;
    c.save(); c.globalAlpha = form; c.translate(x, y - s * 1.4);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 28; i++) { const a = t * 1.4 + i * 0.4; const rr = s * (0.5 + 0.6 * Math.abs(Math.sin(a * 1.3)));
      const px = Math.cos(a) * rr, py = Math.sin(a * 2) * s * 0.8;
      c.globalAlpha = form * 0.4; c.drawImage(gCyan, px - 5, py - 5, 10, 10); }
    c.globalAlpha = form;
    for (let i = 0; i < shards.length; i++) {
      const sh = shards[i]; const ang = t * 1.6 + i * 0.9; const rad = s * (0.7 + 0.4 * Math.sin(t + i));
      c.save(); c.translate(Math.cos(ang) * rad, Math.sin(ang * 2) * s * 0.7); c.rotate(ang);
      c.globalAlpha = form * sh.a * 0.5; c.drawImage(gWhite, -sh.s, -sh.s, sh.s * 2, sh.s * 2); c.globalAlpha = form;
      c.strokeStyle = `rgba(180,225,255,${sh.a})`; c.fillStyle = `rgba(130,190,240,${sh.a * 0.3})`;
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(0, -sh.s); c.lineTo(sh.s * 0.4, 0); c.lineTo(0, sh.s); c.lineTo(-sh.s * 0.4, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
    const hg = c.createLinearGradient(0, -s * 1.1, 0, s * 0.5);
    hg.addColorStop(0, 'rgba(30,50,80,0.8)'); hg.addColorStop(1, 'rgba(20,36,60,0.5)');
    c.fillStyle = hg;
    c.beginPath(); c.moveTo(0, -s * 1.1); c.quadraticCurveTo(s * 0.9, -s * 0.4, s * 0.7, s * 0.5);
    c.quadraticCurveTo(s * 0.3, s * 0.8, 0, s * 0.72); c.quadraticCurveTo(-s * 0.3, s * 0.8, -s * 0.7, s * 0.5);
    c.quadraticCurveTo(-s * 0.9, -s * 0.4, 0, -s * 1.1); c.fill();
    c.globalCompositeOperation = 'lighter';
    const ef = 0.7 + 0.3 * Math.sin(t * 3);
    for (const dx of [-s * 0.16, s * 0.16]) { c.globalAlpha = ef * form; c.drawImage(gWhite, dx - s * 0.16, -s * 0.2 - s * 0.16, s * 0.32, s * 0.32); }
    c.globalAlpha = 1; c.restore();
  }
  // Crystal monolith with prismatic facets + a frozen memory (no glyph).
  function drawMonolith(c, x, y, s, t, env) {
    const h = s * (0.95 + 0.04 * Math.sin(t * 1.1));
    c.save(); c.translate(x, y);
    const faces = [
      { pts: [[0, -h], [s, 0], [0, h * 0.2]], cols: ['rgba(180,225,255,0.55)', 'rgba(210,240,255,0.85)', 'rgba(120,180,235,0.4)'] },
      { pts: [[0, -h], [-s, 0], [0, h * 0.2]], cols: ['rgba(120,180,235,0.45)', 'rgba(200,235,255,0.75)', 'rgba(150,210,255,0.35)'] }
    ];
    for (const f of faces) {
      const fg = c.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[1][0], f.pts[1][1]);
      fg.addColorStop(0, f.cols[0]); fg.addColorStop(0.5, f.cols[1]); fg.addColorStop(1, f.cols[2]);
      c.fillStyle = fg; c.strokeStyle = 'rgba(200,235,255,0.85)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.closePath(); c.fill(); c.stroke();
    }
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -h); c.lineTo(0, h * 0.2); c.stroke();
    const form = Math.max(0, Math.min(1, (env.sceneT - 0.4) * 0.6));
    if (form > 0) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = form * (0.5 + 0.4 * Math.sin(t * 4));
      c.translate(0, -h * 0.35);
      c.fillStyle = 'rgba(190,225,255,0.8)'; c.strokeStyle = 'rgba(190,225,255,0.8)'; c.lineWidth = 2;
      for (const dir of [-1, 1]) { c.beginPath(); c.moveTo(dir * s * 0.5, s * 0.5); c.lineTo(dir * s * 0.5, s * 0.1);
        c.quadraticCurveTo(dir * s * 0.5, -s * 0.2, dir * s * 0.3, -s * 0.35);
        c.quadraticCurveTo(dir * s * 0.15, -s * 0.45, 0, -s * 0.45); c.stroke(); }
      const fl = 0.6 + 0.4 * Math.sin(t * 2);
      c.globalAlpha = form * 0.9 * fl; c.drawImage(gCyan, -s * 0.3, -s * 0.25 - s * 0.3, s * 0.6, s * 0.6); c.globalAlpha = form * (0.5 + 0.4 * Math.sin(t * 4));
      const gg = c.createRadialGradient(0, -s * 0.25, 1, 0, -s * 0.25, s * 0.2);
      gg.addColorStop(0, `rgba(220,245,255,${fl})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(0, -s * 0.25, s * 0.2, 0, 6.28); c.fill();
    }
    c.restore();
  }

  function render(ctx, scene, W, H, t, env) {
    const k = Math.min(1, env.sceneT / 8);
    if (scene === 0) {
      env.cam(1 + 0.16 * k, 0, -H * 0.04 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawAurora(ctx, W, H, t); drawBeams(ctx, W, H, t); drawRunes(ctx, W, H, t); drawSnow(ctx, W, H, t);
    } else if (scene === 1) {
      env.cam(1.3 + 0.14 * k, 0, -H * 0.06 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawAurora(ctx, W, H, t); drawBeams(ctx, W, H, t, 0.6);
      drawOracle(ctx, W * 0.5, H * 0.52, Math.min(W, H) * 0.16, t, env);
      drawRunes(ctx, W, H, t, 0.8); drawSnow(ctx, W, H, t);
    } else {
      env.cam(1.18 + 0.16 * k, 0, -H * 0.05 * k); ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawAurora(ctx, W, H, t); drawBeams(ctx, W, H, t, 0.7); drawRunes(ctx, W, H, t, 1.2);
      drawMonolith(ctx, W * 0.5, H * 0.62, Math.min(W, H) * 0.22, t, env); drawSnow(ctx, W, H, t);
    }
    ctx.restore();
  }

  function post(ctx, W, H, t, env) {
    env.grade('rgba(80,160,220,1)', 0.2, 'soft-light'); env.grade('rgba(10,20,50,1)', 0.12, 'multiply'); env.grain(0.06);
  }

  // The realm 3 intro is the full 3D "Glacial Archive" cinematic (three.js),
  // played by the host app over the game. Ask the host for it; when no host
  // answers (standalone page / older host) fall back to this canvas version.
  function playCanvas(script, done) {
    makeParticles();
    Cinematic.play({
      prefix: 'Glacial', accent: '#9fe3ff',
      beats: script, beatScenes: [0, 1, 2],
      buildBackdrop, render, post, onDone: done
    });
  }

  function play(script, opts) {
    const done = (opts && opts.onDone) || function () {};
    const host = (window.parent && window.parent !== window) ? window.parent : null;
    if (!host) { playCanvas(script, done); return; }

    let acked = false;
    function onMsg(e) {
      const d = e.data || {};
      if (d.type === 'glacial-archive-ack') {
        acked = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
      } else if (d.type === 'glacial-archive-done') {
        window.removeEventListener('message', onMsg);
        clearTimeout(timer);
        done();
      }
    }
    const timer = setTimeout(function () {
      if (acked) return;
      window.removeEventListener('message', onMsg);
      playCanvas(script, done);
    }, 900);

    window.addEventListener('message', onMsg);
    try { host.postMessage({ type: 'glacial-archive-start' }, '*'); }
    catch (_) {
      window.removeEventListener('message', onMsg);
      clearTimeout(timer);
      playCanvas(script, done);
    }
  }
  window.GlacialCutscene = { play, done: () => Cinematic.done() };
})();
