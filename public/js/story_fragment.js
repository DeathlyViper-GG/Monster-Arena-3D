// ============================================================
// Monster Arena — Fragment Bestowal (cinematic, v2)
// After a Warden falls, its stolen soul-essence dissolves upward
// and coalesces into a faceted soul-crystal. The crystal drifts
// up a luminous ribbon of light and settles above a glowing
// sigil-altar, casting volumetric god-rays and orbiting runes.
// Layered parallax backdrop, per-facet shaded crystal, cached
// sprites, delta-time, letterbox + grain + vignette. No external
// assets — runs while integration credits are exhausted.
// API unchanged: FragmentScene.play({accent,icon,theme,who,line,onDone}), .done()
// ============================================================
(function () {
  'use strict';
  let overlay = null, canvas = null, ctx = null, raf = 0;
  let skipBtn = null, contBtn = null, whoEl = null, lineEl = null;
  let cur = null, elapsed = 0;
  let bg = null, bgKey = '', grain = null, emberSprite = null, smokeSprite = null, softSprite = null, moteSpriteCache = {};
  let motes = [], embers = [], ash = [], trail = [], rings = [], burstParts = [], wisps = [];
  let shake = 0;

  // ---------- setup ----------
  function ensure() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #overlayFragment{position:fixed;inset:0;z-index:62;display:none;background:#000;}
      #overlayFragment canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      #fsPanel{position:absolute;left:0;right:0;bottom:0;padding:60px 44px 30px;z-index:4;
        background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(2,4,8,0.72) 42%,rgba(1,2,5,0.97) 100%);
        pointer-events:none;text-align:center;}
      #fsWho{font-size:13px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;
        margin-bottom:8px;text-shadow:0 0 14px currentColor;}
      #fsLine{font-size:clamp(18px,2.3vw,28px);line-height:1.5;color:#eef3ff;
        text-shadow:0 2px 20px rgba(0,0,0,.96);max-width:980px;margin:0 auto;min-height:1.4em;opacity:0;transition:opacity .5s ease;}
      #fsLine.show{opacity:1;}
      #fsLine .caret{display:inline-block;width:.5ch;color:#fff;opacity:.9;animation:fsBlink 1s steps(2) infinite;}
      @keyframes fsBlink{50%{opacity:0}}
      .fsBtn{position:absolute;z-index:5;cursor:pointer;border:1px solid rgba(255,255,255,.22);
        background:rgba(10,14,22,.72);color:#eaf4ff;padding:10px 18px;border-radius:8px;
        font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
        transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
      .fsBtn:hover{transform:translateY(-1px);background:rgba(30,40,60,.88);box-shadow:0 8px 22px rgba(0,0,0,.5);}
      #fsSkip{top:30px;right:30px;}
      #fsContinue{bottom:30px;right:40px;display:none;}
      #fsContinue.ready{animation:fsPulse 1.4s ease-in-out infinite;}
      @keyframes fsPulse{0%,100%{box-shadow:0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 26px rgba(255,255,255,.32)}}`;
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.id = 'overlayFragment';
    canvas = document.createElement('canvas'); overlay.appendChild(canvas);
    const panel = document.createElement('div'); panel.id = 'fsPanel';
    whoEl = document.createElement('div'); whoEl.id = 'fsWho';
    lineEl = document.createElement('div'); lineEl.id = 'fsLine';
    panel.appendChild(whoEl); panel.appendChild(lineEl); overlay.appendChild(panel);
    skipBtn = document.createElement('button'); skipBtn.className = 'fsBtn'; skipBtn.id = 'fsSkip'; skipBtn.textContent = 'Skip ▸';
    contBtn = document.createElement('button'); contBtn.className = 'fsBtn'; contBtn.id = 'fsContinue'; contBtn.textContent = 'Continue ▸';
    overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    skipBtn.addEventListener('click', done);
    contBtn.addEventListener('click', done);
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
  function easeOut(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function hexToRGB(h) {
    h = (h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (h.length !== 6) return [125, 255, 163];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(c, k) { return [Math.floor(c[0] * k), Math.floor(c[1] * k), Math.floor(c[2] * k)]; }

  // tinted soft-glow sprite per mote colour (replaces flat filled circles)
  function moteSpriteFor(col) {
    if (moteSpriteCache[col]) return moteSpriteCache[col];
    const cv = document.createElement('canvas'); cv.width = cv.height = 24;
    const x = cv.getContext('2d'), rgb = hexToRGB(col);
    const g = x.createRadialGradient(12, 12, 0, 12, 12, 12);
    g.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)');
    g.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.5)');
    g.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
    x.fillStyle = g; x.fillRect(0, 0, 24, 24);
    moteSpriteCache[col] = cv; return cv;
  }

  // per-realm backdrop signature (cached once per size into bg)
  function drawBackdropSignature(c, W, H, cur, hy) {
    if (cur.theme === 'meadow') {
      c.fillStyle = '#0a160e';
      for (let i = 0; i < 7; i++) { const tx = (i + 0.3) / 7 * W, ty = hy - H * 0.04;
        c.beginPath(); c.moveTo(tx - 3, ty); c.lineTo(tx, ty - H * 0.09 - (i % 2) * H * 0.03); c.lineTo(tx + 3, ty); c.closePath(); c.fill(); }
    } else if (cur.theme === 'dunes') {
      c.fillStyle = '#1c0e06';
      for (let i = 0; i < 5; i++) { const ox = (i + 0.5) / 5 * W + Math.sin(i * 3) * 24, oh = H * (0.07 + (i % 3) * 0.03), ow = 9 + (i % 2) * 4;
        c.fillRect(ox - ow / 2, hy - oh, ow, oh); c.beginPath(); c.moveTo(ox - ow / 2, hy - oh); c.lineTo(ox, hy - oh - ow); c.lineTo(ox + ow / 2, hy - oh); c.closePath(); c.fill(); }
    } else if (cur.theme === 'glacial') {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) { const g = c.createLinearGradient(0, H * 0.1, 0, H * 0.4);
        g.addColorStop(0, 'rgba(120,200,255,0)'); g.addColorStop(0.5, 'rgba(120,200,255,0.12)'); g.addColorStop(1, 'rgba(120,200,255,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, H * (0.15 + b * 0.06));
        for (let x = 0; x <= W; x += 40) c.lineTo(x, H * (0.15 + b * 0.06) + Math.sin(x * 0.008 + b) * 16);
        c.lineTo(W, H * (0.3 + b * 0.06)); c.lineTo(0, H * (0.3 + b * 0.06)); c.closePath(); c.fill(); }
      c.restore();
    } else if (cur.theme === 'cinder') {
      c.fillStyle = '#0a0402';
      for (let i = 0; i < 10; i++) { const sx = (i + 0.5) / 10 * W, len = H * (0.05 + (i % 3) * 0.04);
        c.beginPath(); c.moveTo(sx - 4, 0); c.lineTo(sx + 4, 0); c.lineTo(sx, len); c.closePath(); c.fill(); }
    } else if (cur.theme === 'void') {
      c.save(); c.fillStyle = '#fff';
      for (let i = 0; i < 80; i++) { c.globalAlpha = 0.3 + rnd() * 0.5; c.beginPath(); c.arc(rnd() * W, rnd() * H, rnd() * 1.4, 0, 6.2832); c.fill(); }
      c.globalAlpha = 1; c.restore();
    }
  }

  // ---------- per-realm sigil-altar motifs (distinct, no cheap circles) ----------
  function altarMeadow(c, cx, cy, t, accent, cc, pulse) {
    const R = 60; c.globalAlpha = 0.7; c.strokeStyle = accent; c.lineWidth = 2.2; c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * 6.2832 + t * 0.1, a1 = a0 + 0.7;
      const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
      const mx = cx + Math.cos((a0 + a1) / 2) * (R + 14), my = cy + Math.sin((a0 + a1) / 2) * (R + 14);
      c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, x1, y1); c.stroke();
      c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2 + i); c.fillStyle = accent;
      c.save(); c.translate(mx, my); c.rotate((a0 + a1) / 2); c.beginPath(); c.ellipse(0, 0, 5, 9, 0, 0, 6.2832); c.fill(); c.restore();
      c.globalAlpha = 0.7;
    }
  }
  function altarDunes(c, cx, cy, t, accent, cc, pulse) {
    const R = 62; c.globalAlpha = 0.7; c.strokeStyle = accent; c.lineWidth = 2;
    c.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * 6.2832, r = R + Math.sin(a * 6 + t) * 2; i ? c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.stroke();
    c.lineWidth = 2.4;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.2832 + t * 0.05, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); c.stroke(); }
    c.lineWidth = 1.4; c.globalAlpha = 0.4;
    for (let s = 0; s < 2; s++) { c.beginPath(); for (let k = 0; k <= 30; k++) { const a = k * 0.4 + t * 0.5 + s * 3.14, r = (1 - k / 30) * R * 0.7, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  }
  function altarGlacial(c, cx, cy, t, accent, cc, pulse) {
    const R = 60; c.globalAlpha = 0.75; c.strokeStyle = accent;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.2832 + t * 0.06, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R, len = 14 + Math.sin(t * 2 + i) * 4;
      c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
      c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + 0.3) * len * 0.4, y + Math.sin(a + 0.3) * len * 0.4); c.lineTo(x + Math.cos(a - 0.3) * len * 0.4, y + Math.sin(a - 0.3) * len * 0.4); c.closePath(); c.stroke(); }
    c.lineWidth = 1.8; c.globalAlpha = 0.6;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832 + t * 0.2; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R - 8), cy + Math.sin(a) * (R - 8)); c.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); c.stroke(); }
  }
  function altarCinder(c, cx, cy, t, accent, cc, pulse) {
    const R = 60; c.globalAlpha = 0.8; c.strokeStyle = accent; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
    c.lineWidth = 1.6;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.2832; c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      let x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      for (let k = 1; k <= 5; k++) { const aa = a + Math.sin(t * 2 + i + k) * 0.2; x += Math.cos(aa) * 8; y += Math.sin(aa) * 8; c.lineTo(x, y); } c.stroke(); }
    c.globalAlpha = 0.5 + 0.3 * pulse;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.2832 + t * 0.3, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; c.drawImage(emberSprite, x - 6, y - 6, 12, 12); }
  }
  function altarVoid(c, cx, cy, t, accent, cc, pulse) {
    const R = 62; c.globalAlpha = 0.7; c.strokeStyle = accent;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const a = t * 0.3 + i * 2.1; c.beginPath();
      for (let k = 0; k <= 50; k++) { const aa = a + k * 0.12, r = R * 0.5 + k * 1.2, x = cx + Math.cos(aa) * r, y = cy + Math.sin(aa) * r; k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = rgba(cc, 0.12); c.lineWidth = 2; c.stroke(); }
    c.restore();
    c.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832 + t * 0.4, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      c.save(); c.translate(x, y); c.rotate(a + t); c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, 0); c.lineTo(-5, 5); c.lineTo(-2, 0); c.closePath(); c.stroke(); c.restore(); }
  }
  function drawAltarMotif(c, cx, cy, t, accent, cc, cur, pulse) {
    const fn = { meadow: altarMeadow, dunes: altarDunes, glacial: altarGlacial, cinder: altarCinder, void: altarVoid }[cur.theme] || altarMeadow;
    fn(c, cx, cy, t, accent, cc, pulse);
  }

  // ---------- per-realm environment ----------
  const THEME = {
    meadow:  { sky: ['#070d18', '#0e1c2c', '#1c3326', '#061008'], far: '#0c1814', mid: '#162a1e', near: '#0a140c', fog: 'rgba(120,200,140,0.10)', ground: '#040a06', motes: 'spore',  accent2: '#9effb0' },
    dunes:   { sky: ['#080612', '#1a1226', '#3a1c1e', '#120a06'], far: '#2a140a', mid: '#3a1c0e', near: '#1a0e06', fog: 'rgba(220,150,80,0.10)',  ground: '#0e0604', motes: 'sand',   accent2: '#ffd28a' },
    glacial: { sky: ['#030610', '#0a1626', '#143044', '#040c14'], far: '#0e2030', mid: '#163a4e', near: '#0a1a26', fog: 'rgba(150,210,255,0.10)', ground: '#04080e', motes: 'snow',   accent2: '#9fe3ff' },
    cinder:  { sky: ['#0a0402', '#1c0806', '#3a1208', '#160604'], far: '#1c0806', mid: '#2a0e08', near: '#140604', fog: 'rgba(255,120,40,0.10)',  ground: '#0a0402', motes: 'ember',  accent2: '#ff8a3a' },
    void:    { sky: ['#06030c', '#0e0820', '#160a2a', '#04020a'], far: '#0a0618', mid: '#120826', near: '#06030e', fog: 'rgba(180,120,255,0.10)', ground: null,     motes: 'mote',   accent2: '#c08aff' }
  };

  // ---------- pre-rendered sprites ----------
  function buildSprites() {
    if (emberSprite) return;
    emberSprite = document.createElement('canvas'); emberSprite.width = emberSprite.height = 32;
    let x = emberSprite.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,250,230,1)'); g.addColorStop(0.2, 'rgba(255,210,150,0.9)'); g.addColorStop(0.6, 'rgba(255,140,60,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    softSprite = document.createElement('canvas'); softSprite.width = softSprite.height = 128;
    x = softSprite.getContext('2d'); g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.4, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    smokeSprite = document.createElement('canvas'); smokeSprite.width = smokeSprite.height = 128;
    x = smokeSprite.getContext('2d');
    for (let i = 0; i < 12; i++) {
      const px = 64 + (rnd() - 0.5) * 54, py = 64 + (rnd() - 0.5) * 54, pr = 22 + rnd() * 32;
      g = x.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, 'rgba(60,55,70,0.28)'); g.addColorStop(1, 'rgba(60,55,70,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    x = grain.getContext('2d'); const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 18; }
    x.putImageData(id, 0, 0);
  }

  // ---------- backdrop: layered parallax silhouettes + depth fog ----------
  function buildBackdrop(W, H, cur) {
    if (!bg) bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.floor(W)); bg.height = Math.max(1, Math.floor(H));
    const c = bg.getContext('2d'), env = cur.env, hy = H * 0.78;
    let g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, env.sky[0]); g.addColorStop(0.42, env.sky[1]); g.addColorStop(0.72, env.sky[2]); g.addColorStop(1, env.sky[3]);
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    if (cur.theme === 'void') {
      // fractured void: slow rifts and a distant singularity glow
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * 6.28, rc = cur.env.fog;
        c.strokeStyle = rc.replace('0.10', '0.04'); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(W * 0.5, H * 0.5); c.lineTo(W * 0.5 + Math.cos(a) * W, H * 0.5 + Math.sin(a) * H); c.stroke();
      }
      const sg = c.createRadialGradient(W * 0.5, H * 0.42, 4, W * 0.5, H * 0.42, W * 0.5);
      sg.addColorStop(0, rgba(cur.rgb, 0.22)); sg.addColorStop(0.5, rgba(cur.rgb, 0.06)); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.fillRect(0, 0, W, H); c.restore();
    } else {
      // three depth layers of silhouettes, each lighter and closer
      const layers = [{ col: env.far, base: hy - H * 0.02, amp: 0.05, seed: 1.2, step: 26 },
      { col: env.mid, base: hy + H * 0.02, amp: 0.07, seed: 4.7, step: 20 },
      { col: env.near, base: hy + H * 0.06, amp: 0.09, seed: 8.1, step: 16 }];
      for (const L of layers) {
        c.fillStyle = L.col; c.beginPath(); c.moveTo(0, H);
        for (let x = 0; x <= W + L.step; x += L.step) {
          const crest = (Math.sin(x * 0.004 + L.seed) * 0.5 + 0.5) * H * L.amp + Math.sin(x * 0.02 + L.seed * 2) * H * 0.015;
          c.lineTo(x, L.base - crest);
        }
        c.lineTo(W, H); c.closePath(); c.fill();
      }
      // depth fog band over the ridges
      c.save(); c.globalCompositeOperation = 'lighter';
      const fg = c.createLinearGradient(0, hy - H * 0.12, 0, hy + H * 0.06);
      fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, env.fog);
      c.fillStyle = fg; c.fillRect(0, hy - H * 0.12, W, H * 0.18); c.restore();
      // ground plane
      c.fillStyle = env.ground; c.fillRect(0, hy + H * 0.06, W, H);
    }
    // per-realm backdrop signature (cached once per size)
    drawBackdropSignature(c, W, H, cur, hy);
    // faint horizon glow where the Warden fell (seeded left of centre)
    c.save(); c.globalCompositeOperation = 'lighter';
    const sx = W * 0.30, sy = cur.theme === 'void' ? H * 0.5 : hy;
    const hg = c.createRadialGradient(sx, sy, 4, sx, sy, W * 0.5);
    hg.addColorStop(0, rgba(cur.rgb, 0.30)); hg.addColorStop(0.4, rgba(cur.rgb, 0.08)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.fillRect(0, 0, W, H); c.restore();
  }

  // ---------- make particles ----------
  function makeAssets(cur) {
    motes = []; const env = cur.env, kind = env.motes, c2 = cur.rgb, a2 = hexToRGB(env.accent2);
    const N = cur.theme === 'void' ? 150 : 120;
    for (let i = 0; i < N; i++) {
      const m = { x: rnd(), y: rnd(), r: 0.6 + rnd() * 2.4, a: 0.2 + rnd() * 0.6, ph: rnd() * 6.28, vx: 0, vy: 0, z: rnd(), col: '#ffffff' };
      if (kind === 'spore') { m.vy = -(0.03 + rnd() * 0.07); m.vx = (rnd() - 0.5) * 0.008; m.col = rnd() < 0.5 ? env.accent2 : '#ffd98a'; }
      else if (kind === 'sand') { m.vx = 0.04 + rnd() * 0.1; m.vy = (rnd() - 0.5) * 0.008; m.col = rnd() < 0.5 ? env.accent2 : '#d8a85a'; }
      else if (kind === 'snow') { m.vy = 0.03 + rnd() * 0.06; m.vx = (rnd() - 0.5) * 0.008; m.col = '#eaf6ff'; }
      else if (kind === 'ember') { m.vy = -(0.04 + rnd() * 0.09); m.vx = (rnd() - 0.5) * 0.008; m.col = rnd() < 0.5 ? env.accent2 : '#ffcf6a'; }
      else { m.vx = (rnd() - 0.5) * 0.006; m.vy = (rnd() - 0.5) * 0.006; m.col = rnd() < 0.5 ? env.accent2 : cur.accent; }
      m.sprite = moteSpriteFor(m.col);
      motes.push(m);
    }
    embers = []; for (let i = 0; i < 60; i++) embers.push({ x: 0.3 + rnd() * 0.4, y: 0.7 + rnd() * 0.2, s: 2 + rnd() * 5, vy: 0.02 + rnd() * 0.06, sw: rnd() * 6.28, a: 0.4 + rnd() * 0.6, z: rnd() });
    ash = []; for (let i = 0; i < 50; i++) ash.push({ x: rnd(), y: rnd(), r: 0.5 + rnd() * 1.4, vy: 0.01 + rnd() * 0.025, vx: -0.003 - rnd() * 0.008, a: 0.12 + rnd() * 0.3, ph: rnd() * 6.28 });
    trail = []; rings = []; burstParts = []; wisps = [];
  }

  // ---------- public ----------
  function play(opts) {
    ensure(); opts = opts || {};
    const accent = opts.accent || '#7dffa3';
    const theme = opts.theme || 'meadow';
    cur = {
      accent, theme, env: THEME[theme] || THEME.meadow, rgb: hexToRGB(accent),
      icon: opts.icon || '✦', who: opts.who || 'The Last Scribe',
      line: opts.line || 'The fragment settles into your hand.',
      onDone: opts.onDone || function () {},
      t: 0, arrived: false, burst: 0, char: 0, typing: false
    };
    buildSprites(); makeAssets(cur); resize();
    whoEl.style.color = accent; lineEl.classList.remove('show');
    contBtn.classList.remove('ready'); contBtn.style.display = 'none';
    overlay.style.display = 'block'; elapsed = 0; shake = 0; bgKey = '';
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // ---------- main loop ----------
  function loop(ts) {
    if (!cur) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const W = window.innerWidth, H = window.innerHeight, c = ctx, t = elapsed;
    const dt = 1 / 60; elapsed += dt;
    const cc = cur.rgb, accent = cur.accent;
    const key = W + 'x' + H;
    if (key !== bgKey) { buildBackdrop(W, H, cur); bgKey = key; }

    let ox = 0, oy = 0;
    if (shake > 0) { ox = (rnd() - 0.5) * shake; oy = (rnd() - 0.5) * shake; shake = Math.max(0, shake - 0.6); }
    const push = 1 + Math.min(0.05, t * 0.003);
    const dx = Math.sin(t * 0.19) * W * 0.006, dy = Math.cos(t * 0.15) * H * 0.005;
    c.save(); c.translate(W / 2 + dx + ox, H / 2 + dy + oy); c.scale(push, push); c.translate(-W / 2, -H / 2);

    c.drawImage(bg, 0, 0, W, H);

    // volumetric god-rays converging on the resting point
    const endX = W * 0.5, endY = H * 0.46;
    drawGodRays(c, W, H, t, endX, endY, cc);

    // drifting motes (ambient atmosphere)
    drawMotes(c, W, H, t, cur);

    // fragment journey: coalesce from dispersed essence, drift up a luminous ribbon
    const journeyDur = 3.2, p = Math.min(1, t / journeyDur), e = ease(p);
    const startX = W * 0.30, startY = cur.theme === 'void' ? H * 0.5 : H * 0.78;
    const arcH = H * 0.22;
    const pos = arcPoint(startX, startY, endX, endY, arcH, e);

    // warden remnant glow at the start — the stolen soul dissolving upward
    drawRemnant(c, W, H, t, startX, startY, cc, p, cur);

    if (p < 1) {
      trail.push({ x: pos.x, y: pos.y, life: 1 });
      if (trail.length > 46) trail.shift();
    }
    for (const tp of trail) tp.life -= 0.018;
    drawTrail(c, W, H, t, cc, accent, p);
    if (p < 1) {
      drawWisps(c, pos.x, pos.y, t, cc);
      drawCrystal(c, pos.x, pos.y, (24 + Math.sin(t * 6) * 2) * (0.6 + 0.4 * p), t, cur);
    }

    // arrival
    if (p >= 1 && !cur.arrived) {
      cur.arrived = true; cur.burst = 1.0; shake = 16;
      rings = [{ r: 0, a: 1 }, { r: 0, a: 1, d: 0.16 }, { r: 0, a: 1, d: 0.32 }];
      for (let i = 0; i < 54; i++) { const a = (i / 54) * 6.28 + rnd() * 0.2, sp = 80 + rnd() * 320; burstParts.push({ x: endX, y: endY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.9 + rnd() * 1.2, age: 0, r: 1.5 + rnd() * 3 }); }
      startTyping();
    }
    if (cur.arrived) {
      drawAltar(c, W, H, t, endX, endY, cc, accent, cur);
      drawCrystal(c, endX, endY + Math.sin(t * 1.6) * 4, 30 + Math.sin(t * 2) * 1.5, t, cur);
    }
    drawBurst(c, W, H, dt);

    // cinematic grade
    c.restore();
    const vg = c.createRadialGradient(W / 2, H * 0.52, H * 0.22, W / 2, H * 0.52, H * 0.98);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.6, 'rgba(0,0,0,0.45)'); vg.addColorStop(1, 'rgba(0,0,0,0.92)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.5 + 0.1 * Math.sin(t * 40);
    c.translate(-Math.floor(rnd() * 80), -Math.floor(rnd() * 80));
    c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W + 160, H + 160); c.restore();
    const bar = H * 0.075; c.fillStyle = '#000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
    if (t < 1.4) { c.fillStyle = 'rgba(0,0,0,' + (1 - ease(t / 1.4)) + ')'; c.fillRect(0, 0, W, H); }

    if (cur.typing) {
      const full = cur.line.length; cur.char += 1.6;
      if (cur.char >= full) { cur.char = full; cur.typing = false; lineEl.innerHTML = cur.line; contBtn.style.display = 'block'; contBtn.classList.add('ready'); }
      else lineEl.innerHTML = cur.line.slice(0, Math.floor(cur.char)) + '<span class="caret">▋</span>';
    }
  }

  function arcPoint(sx, sy, ex, ey, h, e) { return { x: sx + (ex - sx) * e, y: sy + (ey - sy) * e - Math.sin(e * Math.PI) * h }; }

  // ---------- god-rays: volumetric shafts converging on the resting point ----------
  function drawGodRays(c, W, H, t, ex, ey, cc) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const n = 7;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i - n / 2) * 0.26 + Math.sin(t * 0.4 + i) * 0.04;
      const flick = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7);
      const len = Math.hypot(W, H), w = H * (0.05 + 0.03 * Math.sin(t * 0.7 + i));
      c.save(); c.translate(ex, ey); c.rotate(ang);
      const g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, rgba(cc, 0.16 * flick)); g.addColorStop(0.5, rgba(cc, 0.05 * flick)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -w); c.lineTo(len, w); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
  }

  // ---------- ambient motes ----------
  function drawMotes(c, W, H, t, cur) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.x += m.vx * 0.016; m.y += m.vy * 0.016; m.ph += 0.02;
      if (m.y < -0.06) m.y = 1.06; if (m.y > 1.06) m.y = -0.06; if (m.x < -0.06) m.x = 1.06; if (m.x > 1.06) m.x = -0.06;
      const fl = 0.5 + 0.5 * Math.sin(m.ph); if (fl <= 0.02) continue;
      c.globalAlpha = m.a * fl * (0.5 + 0.5 * m.z);
      const sz = m.r * (2.6 + m.z * 2.6);
      c.drawImage(m.sprite, m.x * W - sz, m.y * H - sz, sz * 2, sz * 2);
    }
    c.restore();
    // slow drifting ash/smoke for depth
    c.save();
    for (const a of ash) {
      a.y += a.vy * 0.016; a.x += a.vx * 0.016 + Math.sin(t * 0.5 + a.ph) * 0.0003;
      if (a.y > 1.02) { a.y = -0.02; a.x = rnd(); }
      c.globalAlpha = a.a * (0.5 + 0.5 * Math.sin(t + a.ph)); c.fillStyle = '#b0a8a0';
      c.beginPath(); c.arc(a.x * W, a.y * H, a.r, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  // ---------- warden remnant: the stolen soul dissolving upward into motes ----------
  function drawRemnant(c, W, H, t, sx, sy, cc, p, cur) {
    const fade = Math.max(0, 1 - p * 1.3); if (fade <= 0.01) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const rg = c.createRadialGradient(sx, sy, 2, sx, sy, 150 * fade + 30);
    rg.addColorStop(0, rgba(cc, 0.55 * fade)); rg.addColorStop(0.5, rgba(cc, 0.18 * fade)); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.fillRect(sx - 180, sy - 180, 360, 360);
    // rising soul-motes streaming up from the fallen warden
    for (let i = 0; i < 22; i++) {
      const ph = (t * 0.6 + i * 0.4) % 1, ry = sy - ph * H * 0.34, rx = sx + Math.sin(t * 1.5 + i) * 28 * (1 - ph);
      c.globalAlpha = fade * (1 - ph) * 0.8; c.fillStyle = i % 3 ? cur.accent : '#ffffff';
      c.drawImage(emberSprite, rx - 5, ry - 5, 10, 10);
    }
    c.restore();
  }

  // ---------- luminous energy ribbon trailing the crystal ----------
  function drawTrail(c, W, H, t, cc, accent, p) {
    if (trail.length < 2) return;
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    // three soft glow layers
    for (let layer = 0; layer < 3; layer++) {
      const w = (3 - layer) * 7 + 2;
      c.beginPath();
      for (let i = 0; i < trail.length; i++) { const tp = trail[i]; i ? c.lineTo(tp.x, tp.y) : c.moveTo(tp.x, tp.y); }
      c.strokeStyle = rgba(cc, (0.10 + (2 - layer) * 0.05) * (1 - p * 0.15)); c.lineWidth = w; c.stroke();
    }
    // bright core
    c.beginPath();
    for (let i = 0; i < trail.length; i++) { const tp = trail[i]; i ? c.lineTo(tp.x, tp.y) : c.moveTo(tp.x, tp.y); }
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.5; c.stroke();
    // sparkles
    for (let i = 0; i < trail.length; i += 2) {
      const tp = trail[i], a = (i / trail.length) * 0.55 * (1 - p * 0.2);
      if (a <= 0.02) continue; c.globalAlpha = a; c.fillStyle = i % 4 ? accent : '#ffffff';
      c.beginPath(); c.arc(tp.x, tp.y, 1.5 + (i / trail.length) * 2.5, 0, 6.2832); c.fill();
    }
    c.restore();
  }

  // ---------- orbiting wisps around the crystal in flight ----------
  function drawWisps(c, x, y, t, cc) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const oa = t * 2.2 + i * (6.2832 / 5), od = 26 + Math.sin(t * 3 + i) * 7;
      const wx = x + Math.cos(oa) * od, wy = y + Math.sin(oa) * od;
      c.globalAlpha = 0.7; c.drawImage(softSprite, wx - 7, wy - 7, 14, 14);
    }
    c.restore();
  }

  // ---------- the soul-crystal: per-facet shaded bipyramid with luminous core ----------
  function drawCrystal(c, x, y, size, t, cur) {
    const cc = cur.rgb, s = Math.max(4, size);
    c.save(); c.translate(x, y);
    // volumetric halo
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(t * 1.8);
    const hg = c.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 5);
    hg.addColorStop(0, rgba(cc, 0.50 * pulse)); hg.addColorStop(0.5, rgba(cc, 0.12 * pulse)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, s * 5, 0, 6.2832); c.fill();
    c.restore();

    c.globalCompositeOperation = 'source-over';
    const spin = t * 0.6;
    // back facet (counter-rotating, darker) — gives real depth
    c.save(); c.rotate(-spin * 0.55);
    const bg = c.createLinearGradient(0, -s * 0.95, 0, s * 0.95);
    bg.addColorStop(0, rgba(mix(cc, 0.5), 0.5)); bg.addColorStop(1, rgba(mix(cc, 0.25), 0.55));
    c.fillStyle = bg; facetPath(s * 0.8, s * 0.95); c.fill();
    c.restore();

    // main body: elongated bipyramid with per-facet shading
    c.save(); c.rotate(spin);
    const w = s * 0.62;
    const facets = [
      [[0, -s], [w, -s * 0.45], [0, s * 0.1], 1.0],
      [[0, -s], [0, s * 0.1], [-w, -s * 0.45], 0.55],
      [[w, -s * 0.45], [w, s * 0.45], [0, s * 0.1], 0.82],
      [[-w, -s * 0.45], [0, s * 0.1], [-w, s * 0.45], 0.42],
      [[0, s * 0.1], [w, s * 0.45], [0, s], 0.7],
      [[0, s * 0.1], [-w, s * 0.45], [0, s], 0.35]
    ];
    for (const f of facets) {
      const k = f[3];
      c.fillStyle = 'rgba(' + Math.floor(255 * k * 0.3 + cc[0] * k * 0.7) + ',' + Math.floor(255 * k * 0.3 + cc[1] * k * 0.7) + ',' + Math.floor(255 * k * 0.3 + cc[2] * k * 0.7) + ',0.96)';
      c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill();
    }
    // facet seam lines
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

    // luminous soul-core
    c.globalCompositeOperation = 'lighter';
    const cp = 0.7 + 0.3 * Math.sin(t * 4.5);
    const cg = c.createRadialGradient(0, 0, 0.5, 0, 0, s * 0.55);
    cg.addColorStop(0, 'rgba(255,255,255,' + (0.95 * cp) + ')'); cg.addColorStop(0.5, rgba(cc, 0.7 * cp)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, s * 0.55, 0, 6.2832); c.fill();
    // tiny orbiting sparks
    for (let i = 0; i < 4; i++) { const oa = t * 3 + i * 1.57, od = s * 0.7; c.globalAlpha = 0.85; c.fillStyle = '#fff'; c.beginPath(); c.arc(Math.cos(oa) * od, Math.sin(oa) * od * 0.5, 1.6, 0, 6.2832); c.fill(); }
    c.restore();
  }
  function facetPath(w, h) { ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(w, 0); ctx.lineTo(0, h); ctx.lineTo(-w, 0); ctx.closePath(); }

  // ---------- the sigil-altar where the crystal rests ----------
  function drawAltar(c, W, H, t, cx, cy, cc, accent, cur) {
    c.save(); c.globalCompositeOperation = 'lighter';
    // soft ground glow on the resting plane
    const hy = cur.theme === 'void' ? cy + H * 0.1 : H * 0.78;
    const gg = c.createRadialGradient(cx, hy, 4, cx, hy, W * 0.28);
    gg.addColorStop(0, rgba(cc, 0.22)); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.fillRect(0, hy - 80, W, 160);
    // expanding shock-bloom rings (gradient, not hard strokes)
    for (const ring of rings) {
      ring.r += 4.2; ring.a = Math.max(0, ring.a - 0.0095); if (ring.a <= 0) continue;
      const rr = ring.r;
      const rg = c.createRadialGradient(cx, cy, Math.max(1, rr - 16), cx, cy, rr + 16);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.5, rgba(cc, ring.a * 0.5)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, rr + 16, 0, 6.2832); c.fill();
    }
    // soft radial halo (gradient, not stacked solid circles)
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const hg = c.createRadialGradient(cx, cy, 6, cx, cy, 120 + pulse * 14);
    hg.addColorStop(0, rgba(cc, 0.20 + 0.06 * pulse)); hg.addColorStop(0.6, rgba(cc, 0.05)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.9; c.fillStyle = hg; c.beginPath(); c.arc(cx, cy, 120 + pulse * 14, 0, 6.2832); c.fill();
    // themed sigil motif (distinct per realm)
    drawAltarMotif(c, cx, cy, t, accent, cc, cur, pulse);
    // central core glow beneath the crystal
    const cg = c.createRadialGradient(cx, cy, 1, cx, cy, 32);
    cg.addColorStop(0, 'rgba(255,255,255,0.95)'); cg.addColorStop(0.5, rgba(cc, 0.6)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.85 + 0.15 * pulse; c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, 32, 0, 6.2832); c.fill();
    c.restore();
  }

  // ---------- arrival burst particles (soul-embers with gravity) ----------
  function drawBurst(c, W, H, dt) {
    if (cur.burst <= 0 && burstParts.length === 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = burstParts.length - 1; i >= 0; i--) {
      const b = burstParts[i]; b.age += dt; b.vy += 380 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.age >= b.life) { burstParts.splice(i, 1); continue; }
      const k = 1 - b.age / b.life; c.globalAlpha = k * 0.85;
      c.drawImage(emberSprite, b.x - b.r * 2, b.y - b.r * 2, b.r * 4, b.r * 4);
      c.strokeStyle = rgba(cur.rgb, 0.5 * k); c.lineWidth = Math.max(1, b.r * 0.5);
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); c.stroke();
    }
    c.restore();
    cur.burst = Math.max(0, cur.burst - 1 / 70);
  }

  function startTyping() { whoEl.textContent = cur.who; lineEl.textContent = ''; lineEl.classList.add('show'); cur.typing = true; cur.char = 0; }

  function done() {
    if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
    const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
    overlay.style.display = 'none'; if (typeof cb === 'function') cb();
  }

  window.FragmentScene = { play, done };
})();
