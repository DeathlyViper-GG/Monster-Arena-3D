// ============================================================
// Monster Arena — CINDER OUTRO (Realm 4 ending)
// A dark, cinematic COOLING: the Titan's iron chains are hauled
// down into a lava lake that slowly crusts over into black
// obsidian. Rendered as layered volumetric canvas shots (cavern
// depth, rolling smoke, heat haze, hot iron links with real
// shading/sag/physics, lava splashes, drifting ash) with slow
// camera drift, dissolves and a heavy vignette + film grain.
// Public API unchanged: CinderOutroCutscene.play(beats,{onDone}), .done()
// ============================================================
(function () {
  'use strict';
  let overlay = null, canvas = null, ctx = null, raf = 0;
  let skipBtn = null, contBtn = null, speakerEl = null, bodyEl = null;
  let cur = null, elapsed = 0;
  let bg = null, bgKey = '', grain = null, linkSprite = null, emberSprite = null, smokeSprite = null;
  let embers = [], ash = [], smokeP = [], chains = [], splashes = [], cracks = [];

  function ensure() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #overlayCinderOutro{position:fixed;inset:0;z-index:61;display:none;background:#030101;}
      #overlayCinderOutro canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      #coPanel{position:absolute;left:0;right:0;bottom:0;padding:60px 44px 32px;z-index:4;
        background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(6,2,1,0.7) 45%,rgba(2,0,0,0.97) 100%);pointer-events:none;}
      #coSpeaker{font-size:13px;letter-spacing:.3em;text-transform:uppercase;font-weight:800;
        margin-bottom:8px;color:#c8643c;text-shadow:0 0 14px rgba(255,90,40,.45);}
      #coBody{font-size:clamp(18px,2.3vw,28px);line-height:1.5;color:#e8d4c8;
        text-shadow:0 2px 20px rgba(0,0,0,.98);max-width:960px;min-height:1.4em;}
      #coBody .caret{display:inline-block;width:.5ch;color:#c8643c;animation:coBlink 1s steps(2) infinite;}
      @keyframes coBlink{50%{opacity:0}}
      .coBtn{position:absolute;z-index:5;cursor:pointer;border:1px solid rgba(200,100,60,.35);
        background:rgba(14,5,3,.75);color:#e8c8b4;padding:10px 18px;border-radius:6px;
        font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;
        transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
      .coBtn:hover{transform:translateY(-1px);background:rgba(50,18,10,.9);box-shadow:0 8px 24px rgba(255,90,40,.28);}
      #coSkip{top:30px;right:30px;}
      #coContinue{bottom:30px;right:40px;}
      #coContinue.ready{animation:coPulse 1.4s ease-in-out infinite;}
      @keyframes coPulse{0%,100%{box-shadow:0 0 0 rgba(255,90,40,0)}50%{box-shadow:0 0 26px rgba(255,90,40,.45)}}`;
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.id = 'overlayCinderOutro';
    canvas = document.createElement('canvas'); overlay.appendChild(canvas);
    const panel = document.createElement('div'); panel.id = 'coPanel';
    speakerEl = document.createElement('div'); speakerEl.id = 'coSpeaker';
    bodyEl = document.createElement('div'); bodyEl.id = 'coBody';
    panel.appendChild(speakerEl); panel.appendChild(bodyEl); overlay.appendChild(panel);
    skipBtn = document.createElement('button'); skipBtn.className = 'coBtn'; skipBtn.id = 'coSkip'; skipBtn.textContent = 'Skip ▸';
    contBtn = document.createElement('button'); contBtn.className = 'coBtn'; contBtn.id = 'coContinue'; contBtn.textContent = 'Continue ▸';
    overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    skipBtn.addEventListener('click', done);
    contBtn.addEventListener('click', advance);
    overlay.addEventListener('click', (e) => { if (e.target === skipBtn || e.target === contBtn) return; advance(); });
    window.addEventListener('resize', resize);
  }

  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }
  function resize() {
    if (!canvas) return;
    const d = dpr();
    canvas.width = Math.max(1, Math.floor(window.innerWidth * d));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
    bgKey = '';
  }
  function rnd() { return Math.random(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // ---------- pre-rendered sprites (built once) ----------
  function buildSprites() {
    if (linkSprite) return;
    // iron chain link (side-on oval ring) with metal shading + hot rim
    function link(w, h, edge) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      const th = Math.max(4, w * 0.2);
      x.lineCap = 'round';
      // dark body
      let g = x.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#6a5a52'); g.addColorStop(0.35, '#2a201c'); g.addColorStop(0.7, '#0c0807'); g.addColorStop(1, '#3a2c26');
      x.strokeStyle = g; x.lineWidth = th;
      x.beginPath(); x.ellipse(w / 2, h / 2, w / 2 - th, h / 2 - th, 0, 0, 6.2832); x.stroke();
      // specular highlight along the top-left
      x.strokeStyle = 'rgba(210,190,170,0.35)'; x.lineWidth = th * 0.28;
      x.beginPath(); x.ellipse(w / 2, h / 2, w / 2 - th * 1.25, h / 2 - th * 1.25, 0, Math.PI * 1.05, Math.PI * 1.65); x.stroke();
      // heat-edge glow (lower side facing the lava)
      x.strokeStyle = edge; x.lineWidth = th * 0.42;
      x.beginPath(); x.ellipse(w / 2, h / 2, w / 2 - th * 0.75, h / 2 - th * 0.75, 0, Math.PI * 0.1, Math.PI * 0.9); x.stroke();
      // rust speckle
      for (let i = 0; i < 26; i++) {
        const a = rnd() * 6.2832, rx = (w / 2 - th) * Math.cos(a) + w / 2, ry = (h / 2 - th) * Math.sin(a) + h / 2;
        x.fillStyle = `rgba(${90 + rnd() * 60},${34 + rnd() * 20},14,${0.15 + rnd() * 0.3})`;
        x.fillRect(rx + (rnd() - 0.5) * th, ry + (rnd() - 0.5) * th, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      return c;
    }
    linkSprite = { face: link(64, 92, 'rgba(255,120,40,0.85)'), side: link(26, 92, 'rgba(255,120,40,0.85)') };
    // soft ember
    emberSprite = document.createElement('canvas'); emberSprite.width = emberSprite.height = 32;
    let x = emberSprite.getContext('2d');
    let g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.2, 'rgba(255,170,70,0.9)'); g.addColorStop(0.6, 'rgba(220,70,20,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    // soft smoke puff with noisy lobes
    smokeSprite = document.createElement('canvas'); smokeSprite.width = smokeSprite.height = 128;
    x = smokeSprite.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const px = 64 + (rnd() - 0.5) * 50, py = 64 + (rnd() - 0.5) * 50, pr = 22 + rnd() * 30;
      g = x.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, 'rgba(70,52,46,0.32)'); g.addColorStop(1, 'rgba(70,52,46,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    // film grain tile
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    x = grain.getContext('2d'); const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
    x.putImageData(id, 0, 0);
  }

  function makeAssets() {
    embers = []; for (let i = 0; i < 110; i++) embers.push({ x: rnd(), y: 0.55 + rnd() * 0.45, s: 3 + rnd() * 7, vy: 0.02 + rnd() * 0.07, sw: rnd() * 6.28, a: 0.4 + rnd() * 0.6, z: rnd() });
    ash = []; for (let i = 0; i < 90; i++) ash.push({ x: rnd(), y: rnd(), r: 0.6 + rnd() * 1.8, vy: 0.012 + rnd() * 0.03, vx: -0.005 - rnd() * 0.01, a: 0.15 + rnd() * 0.35, ph: rnd() * 6.28 });
    smokeP = []; for (let i = 0; i < 26; i++) smokeP.push({ x: rnd(), y: 0.35 + rnd() * 0.6, sz: 0.25 + rnd() * 0.4, vy: 0.008 + rnd() * 0.018, vx: (rnd() - 0.5) * 0.01, a: 0.25 + rnd() * 0.4, rot: rnd() * 6.28 });
    splashes = [];
    // four heavy chains, hauled down into the lava at staggered times
    chains = [
      { x: 0.20, sway: 0.7, born: 0.4, haul: 1.6, links: 26, z: 0.7, w: 0.7, pull: 0, hit: false },
      { x: 0.42, sway: 0.5, born: 1.2, haul: 1.8, links: 30, z: 1.0, w: 1.0, pull: 0, hit: false },
      { x: 0.64, sway: 0.6, born: 2.0, haul: 1.5, links: 30, z: 1.0, w: 1.0, pull: 0, hit: false },
      { x: 0.84, sway: 0.8, born: 2.9, haul: 1.9, links: 24, z: 0.7, w: 0.7, pull: 0, hit: false }
    ];
    cracks = [];
    for (let i = 0; i < 34; i++) {
      const pts = []; let px = rnd(), py = 0.68 + rnd() * 0.3; const n = 5 + Math.floor(rnd() * 6);
      for (let k = 0; k < n; k++) { pts.push([px, py]); px += (rnd() - 0.5) * 0.08; py += (rnd() - 0.5) * 0.03; }
      cracks.push({ pts, born: rnd() * 2, life: 3 + rnd() * 3 });
    }
  }

  // ---------- backdrop (cavern + lava lake), cached per size ----------
  function buildBackdrop(W, H) {
    if (!bg) bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.floor(W)); bg.height = Math.max(1, Math.floor(H));
    const c = bg.getContext('2d');
    const hy = H * 0.66;
    // cavern darkness, faint hellish orange from below
    let g = c.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, '#020101'); g.addColorStop(0.55, '#0e0504'); g.addColorStop(1, '#321008');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // far cavern ribs / basalt columns (silhouettes with depth fog)
    for (let layer = 0; layer < 3; layer++) {
      const base = hy - layer * 4, col = ['#1c0b07', '#120705', '#080303'][layer];
      c.fillStyle = col; c.beginPath(); c.moveTo(0, hy);
      let x = 0, seed = layer * 13.7;
      while (x <= W + 40) {
        const hgt = (Math.sin(x * 0.011 + seed) * 0.5 + 0.5) * H * (0.2 + layer * 0.07) + Math.sin(x * 0.047 + seed) * H * 0.02;
        c.lineTo(x, base - hgt); x += 18;
      }
      c.lineTo(W, hy); c.closePath(); c.fill();
    }
    // hanging stalactites from the ceiling
    c.fillStyle = '#050202';
    for (let i = 0; i < 18; i++) {
      const sx = (i + rnd() * 0.6) / 18 * W, len = H * (0.06 + rnd() * 0.22), wd = 14 + rnd() * 40;
      c.beginPath(); c.moveTo(sx - wd, -4); c.lineTo(sx + wd, -4); c.lineTo(sx + (rnd() - 0.5) * 12, len); c.closePath(); c.fill();
    }
    // distant lava glow bleeding up the rock
    g = c.createRadialGradient(W / 2, hy, 10, W / 2, hy, W * 0.7);
    g.addColorStop(0, 'rgba(255,100,30,0.35)'); g.addColorStop(0.5, 'rgba(160,40,12,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // lava lake base
    g = c.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#d8480f'); g.addColorStop(0.15, '#8a1e08'); g.addColorStop(0.6, '#3a0c05'); g.addColorStop(1, '#120403');
    c.fillStyle = g; c.fillRect(0, hy, W, H - hy);
  }

  function play(script, opts) {
    ensure(); opts = opts || {};
    cur = { beats: (script || []).slice(), onDone: opts.onDone || function () {}, idx: 0, char: 0, typing: true, waiting: false };
    buildSprites(); makeAssets(); resize();
    contBtn.classList.remove('ready'); contBtn.style.display = 'none';
    overlay.style.display = 'block'; elapsed = 0;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function currentBeat() { return cur && cur.beats[cur.idx]; }
  function advance() {
    if (!cur) return;
    const b = currentBeat(); if (!b) { done(); return; }
    if (cur.typing) { cur.typing = false; cur.char = (b.text || '').length; renderText(); showContinue(); }
    else { cur.idx++; if (cur.idx >= cur.beats.length) { done(); return; } cur.char = 0; cur.typing = true; contBtn.classList.remove('ready'); contBtn.style.display = 'none'; }
  }
  function showContinue() { cur.waiting = true; contBtn.style.display = 'block'; contBtn.classList.add('ready'); }
  function renderText() {
    const b = currentBeat() || {}; const text = (b.text || ''), who = b.who || '';
    speakerEl.textContent = who;
    const shown = cur.typing ? text.slice(0, Math.floor(cur.char)) : text;
    bodyEl.innerHTML = shown + (cur.typing ? '<span class="caret">▋</span>' : '');
  }

  // ---------- main loop ----------
  function loop() {
    if (!cur) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const W = window.innerWidth, H = window.innerHeight, c = ctx;
    const dt = 1 / 60; elapsed += dt; const t = elapsed;
    const key = W + 'x' + H;
    if (key !== bgKey) { buildBackdrop(W, H); bgKey = key; }

    // slow handheld-style camera drift + push-in
    const push = 1 + Math.min(0.06, t * 0.004);
    const dx = Math.sin(t * 0.21) * W * 0.008, dy = Math.cos(t * 0.17) * H * 0.006;
    c.save();
    c.translate(W / 2 + dx, H / 2 + dy); c.scale(push, push); c.translate(-W / 2, -H / 2);
    c.drawImage(bg, 0, 0, W, H);

    const cool = ease((t - 1.0) / 7.0);          // 0 → 1 : lava crusting over
    drawLavaSurface(c, W, H, t, cool);
    drawBackSmoke(c, W, H, t);
    // far chains first (smaller, dimmer), then near
    for (const ch of chains) if (ch.z < 1) drawChain(c, W, H, t, ch, cool);
    for (const ch of chains) if (ch.z >= 1) drawChain(c, W, H, t, ch, cool);
    drawSplashes(c, W, H, dt);
    drawFragment(c, W, H, t, cool);
    drawEmbers(c, W, H, t, cool);
    drawAsh(c, W, H, t);
    drawHeatHaze(c, W, H, t, cool);
    c.restore();

    // cinematic grade: vignette, cold crush in the shadows, grain, letterbox
    const v = c.createRadialGradient(W / 2, H * 0.52, H * 0.18, W / 2, H * 0.52, H * 0.98);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.5)'); v.addColorStop(1, 'rgba(0,0,0,0.95)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.5 + 0.1 * Math.sin(t * 40);
    c.translate(-Math.floor(rnd() * 80), -Math.floor(rnd() * 80));
    c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W + 160, H + 160); c.restore();
    const bar = H * 0.075; c.fillStyle = '#000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
    // fade in from black
    if (t < 1.6) { c.fillStyle = `rgba(0,0,0,${1 - ease(t / 1.6)})`; c.fillRect(0, 0, W, H); }

    if (cur.typing) {
      const b = currentBeat(); const full = (b && b.text) ? b.text.length : 0;
      cur.char += 1.6;
      if (cur.char >= full) { cur.char = full; cur.typing = false; renderText(); showContinue(); }
      else renderText();
    }
  }

  // ---------- lava surface: churning, crusting into obsidian ----------
  function drawLavaSurface(c, W, H, t, cool) {
    const hy = H * 0.66;
    c.save();
    c.beginPath(); c.rect(0, hy, W, H - hy); c.clip();
    // churning molten bands (perspective: wider toward the camera)
    c.globalCompositeOperation = 'lighter';
    const bands = 22;
    for (let i = 0; i < bands; i++) {
      const f = i / bands, y = hy + Math.pow(f, 1.7) * (H - hy), amp = 2 + f * 14, hh = 3 + f * 16;
      const a = (0.2 + 0.25 * (1 - f)) * (1 - cool * 0.9);
      const g = c.createLinearGradient(0, y - hh, 0, y + hh);
      g.addColorStop(0, 'rgba(255,90,20,0)'); g.addColorStop(0.5, `rgba(255,${130 + 80 * (1 - f)},40,${a})`); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, y - hh);
      for (let x = 0; x <= W; x += 24) c.lineTo(x, y - hh + Math.sin(x * 0.012 + t * (0.5 + f) + i * 1.7) * amp);
      for (let x = W; x >= 0; x -= 24) c.lineTo(x, y + hh + Math.sin(x * 0.012 + t * (0.5 + f) + i * 1.7) * amp);
      c.closePath(); c.fill();
    }
    // obsidian crust plates growing over the molten surface
    c.globalCompositeOperation = 'source-over';
    const plates = 46;
    for (let i = 0; i < plates; i++) {
      const sd = i * 91.7, f = ((Math.sin(sd) * 0.5 + 0.5)), px = (Math.sin(sd * 1.3) * 0.5 + 0.5) * W;
      const py = hy + Math.pow(f, 1.5) * (H - hy), born = 0.8 + (i / plates) * 4.5;
      const grow = ease((t - born) / 3.5); if (grow <= 0) continue;
      const pw = (30 + f * 160) * grow, ph = pw * 0.28, rot = Math.sin(sd * 2.1) * 0.25;
      c.save(); c.translate(px, py); c.rotate(rot);
      const g = c.createLinearGradient(0, -ph, 0, ph);
      g.addColorStop(0, `rgba(30,18,16,${0.95 * grow})`); g.addColorStop(1, `rgba(6,3,3,${0.97 * grow})`);
      c.fillStyle = g;
      c.beginPath();
      for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.2832, rr = 0.75 + 0.25 * Math.sin(sd + k * 2.3); c.lineTo(Math.cos(a) * pw * rr, Math.sin(a) * ph * rr); }
      c.closePath(); c.fill();
      // hot edge where plate meets magma (fades as it cools)
      c.strokeStyle = `rgba(255,120,40,${0.7 * grow * (1 - cool * 0.85)})`; c.lineWidth = 1.5; c.shadowColor = '#ff6a20'; c.shadowBlur = 8; c.stroke();
      c.restore();
    }
    // glowing fissures between plates, fading dark
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
    for (const cr of cracks) {
      const a = ease((t - cr.born) / 1.2) * (1 - ease((t - cr.born - cr.life * 0.8) / (cr.life * 1.6))) * (1 - cool * 0.6);
      if (a <= 0.02) continue;
      c.strokeStyle = `rgba(255,${110 + 60 * a},40,${0.75 * a})`; c.lineWidth = 1.2 + a * 1.6; c.shadowColor = '#ff5a14'; c.shadowBlur = 10;
      c.beginPath(); cr.pts.forEach((p, k) => k ? c.lineTo(p[0] * W, p[1] * H) : c.moveTo(p[0] * W, p[1] * H)); c.stroke();
    }
    c.restore();
    // reflected glow above the lake
    c.save(); c.globalCompositeOperation = 'lighter';
    const rg = c.createLinearGradient(0, hy - H * 0.12, 0, hy + 4);
    rg.addColorStop(0, 'rgba(255,90,20,0)'); rg.addColorStop(1, `rgba(255,100,30,${0.28 * (1 - cool * 0.8)})`);
    c.fillStyle = rg; c.fillRect(0, hy - H * 0.12, W, H * 0.12 + 4); c.restore();
  }

  function drawBackSmoke(c, W, H, t) {
    c.save();
    for (const s of smokeP) {
      s.y -= s.vy * 0.016; s.x += s.vx * 0.016; s.rot += 0.001;
      if (s.y < -0.2) { s.y = 1.0; s.x = rnd(); }
      const sz = s.sz * Math.min(W, H) * 1.3;
      c.globalAlpha = s.a * (0.5 + 0.3 * Math.sin(t * 0.4 + s.rot * 9));
      c.save(); c.translate(s.x * W, s.y * H); c.rotate(s.rot);
      c.drawImage(smokeSprite, -sz / 2, -sz / 2, sz, sz); c.restore();
    }
    c.restore();
  }

  // ---------- chains: real hanging chain with alternating links, sag, sway, then hauled into the lava ----------
  function drawChain(c, W, H, t, ch, cool) {
    const lt = t - ch.born; if (lt < 0) return;
    const hy = H * 0.66;
    const scale = (0.55 + 0.45 * ch.z) * Math.min(1, H / 800 + 0.35);
    const linkH = 62 * scale, linkW = 44 * scale, sideW = 18 * scale, pitch = linkH * 0.7;
    const total = ch.links * pitch;
    // haul: chain slides downward into the lava, accelerating, then goes taut and stops
    const haulT = clamp((lt - 0.6) / ch.haul, 0, 1);
    const slide = Math.pow(haulT, 2.2) * total * 0.85;
    const shudder = haulT > 0 && haulT < 1 ? Math.sin(lt * 38) * 1.6 * scale : 0;
    const baseX = ch.x * W + shudder;
    const sway = Math.sin(t * 0.9 + ch.x * 7) * 14 * ch.sway * (1 - haulT * 0.7);
    // entry point in lava lake
    const entryY = hy + (H - hy) * (0.12 + 0.22 * ch.z);
    const topY = -total * 0.2 + slide;
    c.save();
    // darken far chains by depth fog
    c.globalAlpha = clamp(lt / 0.6, 0, 1) * (0.55 + 0.45 * ch.z);
    let lastY = topY, entered = false;
    for (let k = 0; k < ch.links; k++) {
      const f = k / ch.links;
      // catenary-ish bend: chain curves toward the entry point as it is dragged
      const bend = Math.sin(f * Math.PI) * sway * (1 - haulT * 0.5);
      let y = topY + k * pitch;
      const xx = baseX + bend + haulT * (entryXOffset(ch, W)) * f;
      if (y > entryY) { if (!entered) { entered = true; emitSplash(xx, entryY, ch, lt); } continue; } // sunk beneath the surface
      if (y < -linkH) continue;
      const rot = Math.sin(t * 1.3 + k * 0.5 + ch.x * 9) * 0.05 + (bend - (k > 0 ? Math.sin((k - 1) / ch.links * Math.PI) * sway : 0)) * 0.003;
      const face = (k % 2 === 0);
      const sp = face ? linkSprite.face : linkSprite.side, w = face ? linkW : sideW;
      c.save(); c.translate(xx, y); c.rotate(rot);
      // heat glow rises on links near the lava
      const heat = clamp((y - hy * 0.62) / (entryY - hy * 0.62), 0, 1);
      c.drawImage(sp, -w / 2, -linkH / 2, w, linkH);
      if (heat > 0) {
        c.globalCompositeOperation = 'lighter'; c.globalAlpha *= heat * 0.7 * (1 - cool * 0.5);
        c.fillStyle = `rgba(255,${90 + 70 * heat},30,1)`;
        c.beginPath(); c.ellipse(0, linkH * 0.1, w * 0.35, linkH * 0.32, 0, 0, 6.2832); c.fill();
      }
      c.restore();
      lastY = y;
    }
    // top: the chain is torn from an unseen anchor — a few snapped, dangling links
    c.restore();
    // glow from the lava lighting the lowest visible links
    if (lastY > hy * 0.7) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const gg = c.createRadialGradient(baseX, Math.min(lastY, entryY), 2, baseX, Math.min(lastY, entryY), 110 * scale);
      gg.addColorStop(0, `rgba(255,120,40,${0.4 * (1 - cool * 0.6)})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.fillRect(baseX - 140 * scale, Math.min(lastY, entryY) - 140 * scale, 280 * scale, 280 * scale); c.restore();
    }
    ch.entryY = entryY; ch.curX = baseX;
  }
  function entryXOffset(ch, W) { return (0.5 - ch.x) * W * 0.04; }

  function emitSplash(x, y, ch, lt) {
    if (ch.hit && ch._lastSplash && lt - ch._lastSplash < 0.12) return;
    // burst only once on first contact, then a trickle while chain still sinking
    if (!ch.hit) {
      ch.hit = true;
      for (let i = 0; i < 46; i++) {
        const a = -Math.PI / 2 + (rnd() - 0.5) * 1.5, sp = 90 + rnd() * 340;
        splashes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8 + rnd() * 1.1, age: 0, r: 2 + rnd() * 4, type: 'drop' });
      }
      splashes.push({ x, y, vx: 0, vy: 0, life: 1.6, age: 0, r: 8, type: 'ring' });
      splashes.push({ x, y, vx: 0, vy: 0, life: 2.4, age: 0, r: 60, type: 'glow' });
    } else if (rnd() < 0.35) {
      ch._lastSplash = lt;
      for (let i = 0; i < 3; i++) splashes.push({ x: x + (rnd() - 0.5) * 20, y, vx: (rnd() - 0.5) * 100, vy: -60 - rnd() * 140, life: 0.5 + rnd() * 0.5, age: 0, r: 1.5 + rnd() * 2.5, type: 'drop' });
    }
  }

  function drawSplashes(c, W, H, dt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]; s.age += dt;
      if (s.age >= s.life) { splashes.splice(i, 1); continue; }
      const k = 1 - s.age / s.life;
      if (s.type === 'drop') {
        s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        c.globalAlpha = k;
        c.drawImage(emberSprite, s.x - s.r * 2, s.y - s.r * 2, s.r * 4, s.r * 4);
        // motion streak
        c.strokeStyle = `rgba(255,150,50,${0.6 * k})`; c.lineWidth = Math.max(1, s.r * 0.5);
        c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03); c.stroke();
      } else if (s.type === 'ring') {
        const rr = s.r + (1 - k) * 220;
        c.globalAlpha = 0.7 * k; c.strokeStyle = 'rgba(255,140,50,1)'; c.lineWidth = 3 * k + 1;
        c.beginPath(); c.ellipse(s.x, s.y, rr, rr * 0.22, 0, 0, 6.2832); c.stroke();
      } else {
        const rr = s.r + (1 - k) * 180;
        const g = c.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr);
        g.addColorStop(0, `rgba(255,150,60,${0.55 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 1; c.fillStyle = g; c.fillRect(s.x - rr, s.y - rr, rr * 2, rr * 2);
      }
    }
    c.restore();
  }

  // ---------- the fragment: cools from molten glass to dark ember crystal ----------
  function drawFragment(c, W, H, t, cool) {
    const form = ease((t - 4.0) / 2.2); if (form <= 0) return;
    const cx = W * 0.5, cy = H * 0.4 + Math.sin(t * 0.8) * 6;
    const s = Math.min(W, H) * 0.075 * form;
    const fc = ease((t - 4.5) / 6.0); // fragment cooling
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.8);
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.35) * 0.1);
    // volumetric halo
    c.globalCompositeOperation = 'lighter';
    const hg = c.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 5);
    hg.addColorStop(0, `rgba(255,140,60,${(0.55 - fc * 0.38) * pulse * form})`); hg.addColorStop(0.5, `rgba(200,60,20,${0.14 * (1 - fc * 0.7)})`); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, s * 5, 0, 6.2832); c.fill();
    c.globalCompositeOperation = 'source-over';
    // faceted crystal: each facet shaded separately for real depth
    const P = [[0, -s * 1.15], [s * 0.62, -s * 0.35], [s * 0.42, s * 0.95], [-s * 0.42, s * 0.95], [-s * 0.62, -s * 0.35]];
    const hot = 1 - fc * 0.7;
    const facets = [
      [[0, -s * 1.15], [s * 0.62, -s * 0.35], [0, s * 0.1], 1.0],
      [[0, -s * 1.15], [0, s * 0.1], [-s * 0.62, -s * 0.35], 0.55],
      [[s * 0.62, -s * 0.35], [s * 0.42, s * 0.95], [0, s * 0.1], 0.8],
      [[-s * 0.62, -s * 0.35], [0, s * 0.1], [-s * 0.42, s * 0.95], 0.35],
      [[0, s * 0.1], [s * 0.42, s * 0.95], [-s * 0.42, s * 0.95], 0.6]
    ];
    for (const f of facets) {
      const k = f[3] * hot;
      c.fillStyle = `rgba(${Math.floor(60 + 195 * k)},${Math.floor(14 + 110 * k * k)},${Math.floor(8 + 30 * k * k)},0.97)`;
      c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill();
    }
    c.strokeStyle = `rgba(255,170,110,${0.55 * hot + 0.1})`; c.lineWidth = 1.2; c.shadowColor = '#ff6a20'; c.shadowBlur = 14 * hot;
    c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
    // molten core
    c.shadowBlur = 0; c.globalCompositeOperation = 'lighter';
    const cg = c.createRadialGradient(0, -s * 0.1, 1, 0, -s * 0.1, s * 0.65);
    cg.addColorStop(0, `rgba(255,220,160,${(0.85 - fc * 0.6) * pulse})`); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(0, -s * 0.1, s * 0.65, 0, 6.2832); c.fill();
    c.restore();
    // light cast on the crusting lava below
    c.save(); c.globalCompositeOperation = 'lighter';
    const hy = H * 0.66, lg = c.createRadialGradient(cx, hy + 30, 4, cx, hy + 30, W * 0.22);
    lg.addColorStop(0, `rgba(255,120,40,${0.22 * (1 - fc * 0.6) * form})`); lg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = lg; c.fillRect(0, hy - 40, W, H - hy + 40); c.restore();
  }

  function drawEmbers(c, W, H, t, cool) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.y -= e.vy * 0.016; e.sw += 0.03; e.x += Math.sin(e.sw) * 0.0008 - 0.0003;
      if (e.y < -0.05) { e.y = 0.7 + rnd() * 0.3; e.x = rnd(); }
      const fl = (0.55 + 0.45 * Math.sin(e.sw * 2.1)) * (1 - cool * 0.85) * (0.4 + 0.6 * e.z);
      if (fl <= 0.02) continue;
      c.globalAlpha = e.a * fl; const s = e.s * (0.6 + e.z * 0.6);
      c.drawImage(emberSprite, e.x * W - s, e.y * H - s, s * 2, s * 2);
    }
    c.restore();
  }

  function drawAsh(c, W, H, t) {
    c.save();
    for (const a of ash) {
      a.y += a.vy * 0.016; a.x += a.vx * 0.016 + Math.sin(t * 0.6 + a.ph) * 0.0004;
      if (a.y > 1.02) { a.y = -0.02; a.x = rnd(); } if (a.x < -0.02) a.x = 1.02;
      c.globalAlpha = a.a * (0.5 + 0.5 * Math.sin(t + a.ph));
      c.fillStyle = '#b8a090'; c.beginPath(); c.arc(a.x * W, a.y * H, a.r, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  // heat shimmer: faint wavering luminous bands rising off the lava
  function drawHeatHaze(c, W, H, t, cool) {
    const hy = H * 0.66, k = 1 - cool * 0.75;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const y = hy - 10 - i * H * 0.045 - ((t * 14) % 24);
      c.globalAlpha = 0.045 * k * (1 - i / 5);
      c.fillStyle = 'rgba(255,140,60,1)';
      c.beginPath(); c.moveTo(0, y);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x * 0.02 + t * 2 + i) * 5);
      c.lineTo(W, y + 12); c.lineTo(0, y + 12); c.closePath(); c.fill();
    }
    c.restore();
  }

  function done() {
    if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
    const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
    overlay.style.display = 'none'; if (typeof cb === 'function') cb();
  }
  window.CinderOutroCutscene = { play, done };
})();
