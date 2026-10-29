// ============================================================
// Monster Arena — Story Cutscene Player (cinematic, v3)
// A high-fidelity cosmic "soul-storm" sequence used for the
// prologue, the Void realm intro, and the ending. Layered
// fractured horizon, drifting nebula clouds, volumetric god-rays,
// a properly faceted soul-crystal with per-facet shading, soft
// glow sprites (no flat circles), smooth energy threads (no
// shadowBlur, no per-frame jitter), film grain + letterbox +
// slow camera drift. API unchanged.
// ============================================================
(function () {
  'use strict';
  let overlay = null, canvas = null, ctx = null, raf = 0;
  let skipBtn = null, contBtn = null, speakerEl = null, bodyEl = null;
  let cur = null, elapsed = 0;
  let bgCanvas = null, bgCtx = null, bgKey = '';
  let grain = null, softSprite = null, emberSprite = null, moteSpriteCache = {};
  let motes = [], rays = [], nebula = [], shards = [], wisps = [];
  let shake = 0, flash = 0;

  function ensure() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #overlayStoryCut{position:fixed;inset:0;z-index:60;display:none;background:#000;}
      #overlayStoryCut canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      .scBar{position:absolute;left:0;right:0;height:0;background:#000;z-index:3;pointer-events:none;}
      #scBarTop{top:0;transition:height .6s cubic-bezier(.6,0,.4,1);}
      #scBarBot{bottom:0;transition:height .6s cubic-bezier(.6,0,.4,1);}
      #scPanel{position:absolute;left:0;right:0;bottom:0;padding:60px 44px 30px;z-index:4;
        background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0.74) 42%,rgba(1,2,5,0.97) 100%);
        pointer-events:none;}
      #scSpeaker{font-size:13px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;
        margin-bottom:8px;text-shadow:0 0 14px currentColor;}
      #scBody{font-size:clamp(18px,2.3vw,28px);line-height:1.5;color:#eef3ff;
        text-shadow:0 2px 20px rgba(0,0,0,.96);max-width:980px;min-height:1.4em;}
      #scBody .caret{display:inline-block;width:.5ch;color:#fff;opacity:.9;animation:scBlink 1s steps(2) infinite;}
      @keyframes scBlink{50%{opacity:0}}
      .scBtn{position:absolute;z-index:5;cursor:pointer;border:1px solid rgba(255,255,255,.22);
        background:rgba(10,14,22,.72);color:#eaf4ff;padding:10px 18px;border-radius:8px;
        font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
        transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
      .scBtn:hover{transform:translateY(-1px);background:rgba(30,40,60,.88);box-shadow:0 8px 22px rgba(0,0,0,.5);}
      #scSkip{top:30px;right:30px;}
      #scContinue{bottom:30px;right:40px;}
      #scContinue.ready{animation:scPulse 1.4s ease-in-out infinite;}
      @keyframes scPulse{0%,100%{box-shadow:0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 26px rgba(255,255,255,.32)}}`;
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.id = 'overlayStoryCut';
    canvas = document.createElement('canvas'); overlay.appendChild(canvas);
    const barTop = document.createElement('div'); barTop.className = 'scBar'; barTop.id = 'scBarTop';
    const barBot = document.createElement('div'); barBot.className = 'scBar'; barBot.id = 'scBarBot';
    overlay.appendChild(barTop); overlay.appendChild(barBot);
    const panel = document.createElement('div'); panel.id = 'scPanel';
    speakerEl = document.createElement('div'); speakerEl.id = 'scSpeaker';
    bodyEl = document.createElement('div'); bodyEl.id = 'scBody';
    panel.appendChild(speakerEl); panel.appendChild(bodyEl); overlay.appendChild(panel);
    skipBtn = document.createElement('button'); skipBtn.className = 'scBtn'; skipBtn.id = 'scSkip'; skipBtn.textContent = 'Skip ▸';
    contBtn = document.createElement('button'); contBtn.className = 'scBtn'; contBtn.id = 'scContinue'; contBtn.textContent = 'Continue ▸';
    overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    skipBtn.addEventListener('click', done);
    contBtn.addEventListener('click', advance);
    overlay.addEventListener('click', (e) => { if (e.target === skipBtn || e.target === contBtn) return; advance(); });
    window.addEventListener('resize', () => { resize(); bgKey = ''; });
  }

  function dpr() { return Math.min(1.25, window.devicePixelRatio || 1); }
  function resize() {
    if (!canvas) return;
    const d = dpr();
    canvas.width = Math.max(1, Math.floor(window.innerWidth * d));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * d));
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function rnd() { return Math.random(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function hexToRGB(h) {
    h = (h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (h.length !== 6) return [125, 255, 163];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function mix(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  // ---------- cached sprites ----------
  function buildSprites() {
    if (grain) return;
    emberSprite = document.createElement('canvas'); emberSprite.width = emberSprite.height = 32;
    let x = emberSprite.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.25, 'rgba(255,210,160,0.85)'); g.addColorStop(0.65, 'rgba(255,130,60,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    softSprite = document.createElement('canvas'); softSprite.width = softSprite.height = 128;
    x = softSprite.getContext('2d'); g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.4, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    x = grain.getContext('2d'); const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 16; }
    x.putImageData(id, 0, 0);
  }
  function moteSpriteFor(col) {
    if (moteSpriteCache[col]) return moteSpriteCache[col];
    const cv = document.createElement('canvas'); cv.width = cv.height = 24;
    const x = cv.getContext('2d'), rgb = hexToRGB(col);
    const g = x.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)');
    g.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.45)');
    g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 24, 24);
    moteSpriteCache[col] = cv; return cv;
  }

  // ---------- backdrop: cosmic soul-storm with fractured horizon (cached) ----------
  function buildBackdrop(W, H, accent) {
    if (!bgCanvas) { bgCanvas = document.createElement('canvas'); bgCtx = bgCanvas.getContext('2d'); }
    bgCanvas.width = Math.max(1, Math.floor(W)); bgCanvas.height = Math.max(1, Math.floor(H));
    const c = bgCtx, cc = hexToRGB(accent), hy = H * 0.62;
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02020a'); g.addColorStop(0.35, '#070614'); g.addColorStop(0.7, rgba(mix(cc, 0.10), 1)); g.addColorStop(1, rgba(mix(cc, 0.04), 1));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // distant starfield
    c.save(); c.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) { c.globalAlpha = 0.25 + rnd() * 0.5; c.beginPath(); c.arc(rnd() * W, rnd() * H * 0.7, rnd() * 1.3, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1; c.restore();
    // central soul-bloom on the horizon (the Hollow's light)
    c.save(); c.globalCompositeOperation = 'lighter';
    const bg = c.createRadialGradient(W / 2, hy, 6, W / 2, hy, W * 0.7);
    bg.addColorStop(0, rgba(cc, 0.30)); bg.addColorStop(0.4, rgba(cc, 0.08)); bg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = bg; c.fillRect(0, 0, W, H); c.restore();
    // fractured horizon: jagged shard-silhouettes receding (the shattered sky)
    const layers = [
      { col: rgba(mix(cc, 0.10), 0.85), base: hy - H * 0.02, amp: 0.10, seed: 3.1, step: 22, jag: 1.0 },
      { col: '#04030c', base: hy + H * 0.03, amp: 0.07, seed: 8.7, step: 16, jag: 1.5 },
      { col: '#01010a', base: hy + H * 0.08, amp: 0.05, seed: 17.2, step: 12, jag: 2.0 }
    ];
    for (const L of layers) {
      c.fillStyle = L.col; c.beginPath(); c.moveTo(0, H);
      let s = L.seed * 99 + 7;
      const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      for (let x = 0; x <= W + L.step; x += L.step) {
        const env = Math.abs(Math.sin((x / W) * Math.PI * 5 + L.seed));
        const y = L.base - env * H * L.amp * (0.5 + r() * 0.7) * L.jag - Math.sin(x * 0.05 + L.seed) * 4;
        c.lineTo(x, y);
      }
      c.lineTo(W, H); c.closePath(); c.fill();
    }
    // depth haze
    c.save(); c.globalCompositeOperation = 'lighter';
    const fg = c.createLinearGradient(0, hy - H * 0.06, 0, hy + H * 0.08);
    fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, rgba(cc, 0.06));
    c.fillStyle = fg; c.fillRect(0, hy - H * 0.06, W, H * 0.14); c.restore();
    // baked vignette
    const v = c.createRadialGradient(W / 2, H * 0.5, H * 0.26, W / 2, H * 0.5, H * 0.96);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.8)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  function makeAssets(accent) {
    const cc = hexToRGB(accent);
    motes = [];
    for (let i = 0; i < 90; i++) {
      const m = { x: rnd(), y: rnd(), r: 0.6 + rnd() * 2.4, vy: 0.02 + rnd() * 0.08, vx: (rnd() - 0.5) * 0.006, a: 0.2 + rnd() * 0.6, ph: rnd() * 6.28, z: rnd(), col: rnd() < 0.5 ? accent : '#ffffff' };
      m.sprite = moteSpriteFor(m.col); motes.push(m);
    }
    rays = [];
    for (let i = 0; i < 8; i++) rays.push({ a: -Math.PI / 2 + (i - 4) * 0.22 + rnd() * 0.06, w: 0.04 + rnd() * 0.05, ph: rnd() * 6.28, sp: 0.1 + rnd() * 0.2 });
    nebula = [];
    for (let i = 0; i < 7; i++) nebula.push({ x: rnd(), y: 0.2 + rnd() * 0.5, sz: 0.3 + rnd() * 0.5, vx: (rnd() - 0.5) * 0.004, vy: (rnd() - 0.5) * 0.003, a: 0.08 + rnd() * 0.16, rot: rnd() * 6.28 });
    shards = [];
    for (let i = 0; i < 14; i++) { const a = rnd() * 6.28; shards.push({ a, d: 0.15 + rnd() * 0.3, s: 6 + rnd() * 22, rot: rnd() * 6.28, vr: (rnd() - 0.5) * 0.4, tilt: rnd() * 6.28, ph: rnd() * 6.28, z: rnd() }); }
    wisps = [];
    for (let i = 0; i < 6; i++) wisps.push({ off: i * (6.2832 / 6), r: 1.0, sp: 0.4 + rnd() * 0.3, sz: 0.7 + rnd() * 0.5 });
  }

  function play(script, opts) {
    ensure(); opts = opts || {};
    const accent = opts.accent || '#7dffa3';
    cur = { beats: (script || []).slice(), accent, rgb: hexToRGB(accent), icon: opts.icon || '✦', onDone: opts.onDone || function () {}, idx: 0, char: 0, typing: true, waiting: false };
    buildSprites(); makeAssets(accent); resize();
    speakerEl.style.color = accent;
    contBtn.classList.remove('ready'); contBtn.style.display = 'none';
    overlay.style.display = 'block'; elapsed = 0; shake = 0; flash = 0; bgKey = '';
    requestAnimationFrame(() => {
      const bt = document.getElementById('scBarTop'), bb = document.getElementById('scBarBot');
      const bh = Math.max(56, window.innerHeight * 0.10);
      if (bt) bt.style.height = bh + 'px'; if (bb) bb.style.height = bh + 'px';
    });
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function currentBeat() { return cur && cur.beats[cur.idx]; }
  function advance() {
    if (!cur) return;
    const b = currentBeat(); if (!b) { done(); return; }
    if (cur.typing) { cur.typing = false; cur.char = (b.text || '').length; renderText(); showContinue(); }
    else { cur.idx++; if (cur.idx >= cur.beats.length) { done(); return; } cur.char = 0; cur.typing = true; cur.waiting = false; contBtn.classList.remove('ready'); contBtn.style.display = 'none'; }
  }
  function showContinue() { cur.waiting = true; contBtn.style.display = 'block'; contBtn.classList.add('ready'); }
  function renderText() {
    const b = currentBeat() || {}, text = (b.text || ''), who = b.who || '';
    speakerEl.textContent = who;
    const shown = cur.typing ? text.slice(0, Math.floor(cur.char)) : text;
    bodyEl.innerHTML = shown + (cur.typing ? '<span class="caret">▋</span>' : '');
  }

  function loop(ts) {
    if (!cur) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const W = window.innerWidth, H = window.innerHeight, c = ctx, t = elapsed;
    const dt = 1 / 60; elapsed += dt;
    const cc = cur.rgb, accent = cur.accent;
    const key = W + 'x' + H + 'x' + accent;
    if (key !== bgKey) { buildBackdrop(W, H, accent); bgKey = key; }

    let ox = 0, oy = 0;
    if (shake > 0) { ox = (rnd() - 0.5) * shake; oy = (rnd() - 0.5) * shake; shake = Math.max(0, shake - 0.4); }
    const push = 1 + Math.min(0.05, t * 0.0035);
    const dx = Math.sin(t * 0.18) * W * 0.006, dy = Math.cos(t * 0.14) * H * 0.005;
    c.save(); c.translate(W / 2 + dx + ox, H / 2 + dy + oy); c.scale(push, push); c.translate(-W / 2, -H / 2);

    c.drawImage(bgCanvas, 0, 0, W, H);

    const sealX = W / 2, sealY = H * 0.4;

    // drifting nebula clouds
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const n of nebula) {
      n.x += n.vx * 0.016; n.y += n.vy * 0.016; n.rot += 0.001;
      if (n.x < -0.4) n.x = 1.4; if (n.x > 1.4) n.x = -0.4;
      const sz = n.sz * Math.min(W, H) * 1.4;
      c.globalAlpha = n.a * (0.6 + 0.4 * Math.sin(t * 0.3 + n.rot * 9));
      c.save(); c.translate(n.x * W, n.y * H); c.rotate(n.rot);
      c.drawImage(softSprite, -sz / 2, -sz / 2, sz, sz); c.restore();
    }
    c.restore();

    // volumetric god-rays converging on the crystal
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const ray of rays) {
      const ang = ray.a + Math.sin(t * ray.sp + ray.ph) * 0.03;
      const flick = 0.5 + 0.5 * Math.sin(t * 1.4 + ray.ph);
      const len = Math.hypot(W, H), w = H * ray.w;
      c.save(); c.translate(sealX, sealY); c.rotate(ang);
      const lg = c.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, rgba(cc, 0.13 * flick)); lg.addColorStop(0.5, rgba(cc, 0.04 * flick)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -w); c.lineTo(len, w); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();

    // drifting soul-ash (glow sprites, not flat circles)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.y -= m.vy * 0.016; m.x += m.vx * 0.016; m.ph += 0.02;
      if (m.y < -0.06) m.y = 1.06; if (m.x < -0.06) m.x = 1.06; if (m.x > 1.06) m.x = -0.06;
      const fl = 0.5 + 0.5 * Math.sin(m.ph); if (fl <= 0.02) continue;
      c.globalAlpha = m.a * fl * (0.5 + 0.5 * m.z);
      const sz = m.r * (2.4 + m.z * 2.4);
      c.drawImage(m.sprite, m.x * W - sz, m.y * H - sz, sz * 2, sz * 2);
    }
    c.restore();

    // distant floating shard fragments (parallax depth)
    drawShards(c, W, H, t, cc, sealX, sealY);

    // the soul-crystal
    drawCrystal(c, sealX, sealY, Math.min(W, H) * 0.072, t, cur);

    // typing + beat-change flash
    if (cur.typing) {
      const b = currentBeat(), full = (b && b.text) ? b.text.length : 0, wasZero = cur.char === 0;
      cur.char += 1.6;
      if (wasZero) { flash = 0.35; shake = 5; }
      if (cur.char >= full) { cur.char = full; cur.typing = false; renderText(); showContinue(); } else renderText();
    }
    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash + ')'; c.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.03); }

    c.restore();

    // cinematic grade: vignette, grain, fade-in
    const v = c.createRadialGradient(W / 2, H * 0.52, H * 0.22, W / 2, H * 0.52, H * 0.98);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.42)'); v.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.5 + 0.1 * Math.sin(t * 40);
    c.translate(-Math.floor(rnd() * 80), -Math.floor(rnd() * 80));
    c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W + 160, H + 160); c.restore();
    if (t < 1.3) { c.fillStyle = 'rgba(0,0,0,' + (1 - ease(t / 1.3)) + ')'; c.fillRect(0, 0, W, H); }
  }

  // ---------- distant floating shards (parallax, faceted glints) ----------
  function drawShards(c, W, H, t, cc, ox, oy) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const s of shards) {
      const drift = Math.sin(t * 0.3 + s.ph) * 0.04;
      const cx = ox + Math.cos(s.a + drift) * s.d * W, cy = oy + Math.sin(s.a + drift) * s.d * H * 0.7;
      const flick = 0.5 + 0.5 * Math.sin(t * 1.5 + s.ph * 3);
      c.save(); c.translate(cx, cy); c.rotate(s.rot + t * s.vr); c.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(s.tilt + t * 0.6)));
      const a = 0.18 + 0.22 * flick * (0.5 + s.z * 0.5);
      c.fillStyle = rgba(cc, a); c.strokeStyle = rgba([255, 255, 255], a * 0.8); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, -s.s); c.lineTo(s.s * 0.3, s.s * 0.2); c.lineTo(-s.s * 0.18, s.s); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // ---------- the soul-crystal: faceted bipyramid, per-facet shading, luminous core ----------
  function drawCrystal(c, x, y, size, t, cur) {
    const cc = cur.rgb, s = Math.max(6, size), pulse = 0.75 + 0.25 * Math.sin(t * 1.7);
    // volumetric halo
    c.save(); c.globalCompositeOperation = 'lighter';
    const hg = c.createRadialGradient(x, y, s * 0.2, x, y, s * 4.5);
    hg.addColorStop(0, rgba(cc, 0.40 * pulse)); hg.addColorStop(0.5, rgba(cc, 0.10 * pulse)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(x, y, s * 4.5, 0, 6.2832); c.fill();
    c.restore();

    c.save(); c.translate(x, y + Math.sin(t * 1.1) * 4);
    // orbiting soft wisps (glow sprites, not blocky shards)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const w of wisps) {
      const a = t * w.sp + w.off, od = s * (1.9 + Math.sin(t * 0.8 + w.off) * 0.15);
      const wx = Math.cos(a) * od, wy = Math.sin(a) * od;
      c.globalAlpha = 0.6 + 0.3 * Math.sin(t * 2 + w.off); const sz = s * 0.5 * w.sz;
      c.drawImage(softSprite, wx - sz, wy - sz, sz * 2, sz * 2);
    }
    c.restore();

    // counter-rotating back facet (depth)
    const spin = t * 0.45;
    c.save(); c.rotate(-spin * 0.6); c.globalCompositeOperation = 'source-over';
    const w = s * 0.62;
    const bg = c.createLinearGradient(0, -s * 0.95, 0, s * 0.95);
    bg.addColorStop(0, rgba(mix(cc, 0.5), 0.5)); bg.addColorStop(1, rgba(mix(cc, 0.22), 0.55));
    c.fillStyle = bg; facetPath(c, w * 0.8, s * 0.95); c.fill();
    c.restore();

    // main bipyramid with per-facet shading
    c.save(); c.rotate(spin); c.globalCompositeOperation = 'source-over';
    const facets = [
      [[0, -s], [w, -s * 0.45], [0, s * 0.1], 1.0], [[0, -s], [0, s * 0.1], [-w, -s * 0.45], 0.52],
      [[w, -s * 0.45], [w, s * 0.45], [0, s * 0.1], 0.82], [[-w, -s * 0.45], [0, s * 0.1], [-w, s * 0.45], 0.4],
      [[0, s * 0.1], [w, s * 0.45], [0, s], 0.7], [[0, s * 0.1], [-w, s * 0.45], [0, s], 0.34]
    ];
    for (const f of facets) {
      const k = f[3];
      c.fillStyle = 'rgba(' + Math.floor(255 * k * 0.3 + cc[0] * k * 0.7) + ',' + Math.floor(255 * k * 0.3 + cc[1] * k * 0.7) + ',' + Math.floor(255 * k * 0.3 + cc[2] * k * 0.7) + ',0.96)';
      c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill();
    }
    // facet seams
    c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * w * 0.62, Math.sin(a) * s * 0.95); c.stroke(); }
    // outline
    c.strokeStyle = rgba(cc, 0.7); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -s); c.lineTo(w, -s * 0.45); c.lineTo(w, s * 0.45); c.lineTo(0, s); c.lineTo(-w, s * 0.45); c.lineTo(-w, -s * 0.45); c.closePath(); c.stroke();
    // specular sheen
    c.globalCompositeOperation = 'lighter';
    const sp = c.createLinearGradient(-s * 0.5, -s, s * 0.1, s * 0.2);
    sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.5)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sp; c.beginPath(); c.moveTo(0, -s); c.lineTo(w, -s * 0.45); c.lineTo(w, s * 0.45); c.lineTo(0, s); c.lineTo(-w, s * 0.45); c.lineTo(-w, -s * 0.45); c.closePath(); c.fill();
    c.restore();

    // smooth energy threads to orbiting wisps (deterministic, no per-frame jitter)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = t * 0.5 + i * 2.1, od = s * 2.0;
      const ex = Math.cos(a) * od, ey = Math.sin(a) * od;
      c.strokeStyle = rgba([255, 255, 255], 0.25 + 0.15 * Math.sin(t * 3 + i)); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.sin(t + i) * s * 0.5, Math.cos(t + i) * s * 0.5, ex, ey); c.stroke();
    }
    c.restore();

    // luminous core
    c.save(); c.globalCompositeOperation = 'lighter';
    const cp = 0.7 + 0.3 * Math.sin(t * 4.5);
    const cg = c.createRadialGradient(0, 0, 0.5, 0, 0, s * 0.6);
    cg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * cp) + ')'); cg.addColorStop(0.4, rgba(cc, 0.8 * cp)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, s * 0.6 + pulse * 2, 0, 6.2832); c.fill();
    c.restore();

    c.restore();
  }
  function facetPath(c, w, h) { c.beginPath(); c.moveTo(0, -h); c.lineTo(w, 0); c.lineTo(0, h); c.lineTo(-w, 0); c.closePath(); }

  function done() {
    if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
    const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
    const bt = document.getElementById('scBarTop'), bb = document.getElementById('scBarBot');
    if (bt) bt.style.height = '0px'; if (bb) bb.style.height = '0px';
    overlay.style.display = 'none'; if (typeof cb === 'function') cb();
  }

  window.StoryCutscene = { play, done };
})();
