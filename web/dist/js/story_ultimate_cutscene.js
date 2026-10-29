// ============================================================
// Monster Arena — ULTIMATE CUTSCENE (Casket of Seals finale)
// Plays when all five seals are unlocked and the Scribe opens
// the Casket. A serious, movie-like sequence: five elemental
// shards drift in from the dark, slot into an ornate obsidian
// casket, its lid parts, and a solemn pillar of light releases
// the Hollow — a fractured cosmic silhouette — building to a
// white-out that hands off to the ending choice.
// Visual signatures: letterbox bars, volumetric god-rays, slow
// Ken-Burns camera, drifting dust motes, refractive crystal
// shards with luminous trails, deep socket ignition, serious
// color grade + grain. Pure canvas, no external assets.
// Exposes window.UltimateCutscene.play({ onDone }).
// ============================================================
(function () {
  'use strict';
  let overlay = null, canvas = null, ctx = null, raf = 0;
  let skipBtn = null, contBtn = null, speakerEl = null, bodyEl = null;
  let cur = null, elapsed = 0, flash = 0, shake = 0;
  let bgCanvas = null, bgCtx = null, bgKey = '';
  let dust = [], sprites = null;

  // realm accents in RGB triplets — serious, slightly desaturated
  const COLS = ['125,235,150', '240,200,110', '150,210,245', '240,130,110', '180,120,235'];
  const BEATS = [
    { who: 'The Last Scribe', text: 'Five soul-shards — five pieces of me — rise from the Casket and merge into a single doorway of light.' },
    { who: 'The Hollow', text: 'Your soul is whole again, little Scribe. The doorway opens to my guardians — and to me.' },
    { who: 'The Archivist', text: 'Step through, and face all five Wardens reborn at once. The Hollow watches from above. This is the gauntlet you forged.' }
  ];

  // shard arrival times (s) — slow, deliberate
  const ARR = [2.0, 2.9, 3.8, 4.7, 5.6];
  // shard entry origins (normalized)
  const START_X = [0.10, 0.90, 0.08, 0.92, 0.50];
  const START_Y = [0.22, 0.18, 0.84, 0.82, 0.10];

  // socket screen position (matches the 3D lid layout in drawLid)
  const SOCK_DF = [0.20, 0.55, 0.5, 0.55, 0.20];
  const SOCK_LF = [0.55, 0.55, 0.5, 0.55, 0.55];
  function socketPos(W, H, i) {
    const cx = W / 2, cy = H * 0.64;
    const baseW = Math.min(W, H) * 0.30, backW = baseW * 0.62;
    const bodyH = Math.min(W, H) * 0.14, depth = Math.min(W, H) * 0.11;
    const frontY = -bodyH * 0.1, backY = frontY - depth;
    const df = SOCK_DF[i], lf = SOCK_LF[i];
    const sign = i < 2 ? -1 : (i > 2 ? 1 : 0);
    const lidHalfW = baseW * (1 - df) + backW * df;
    const lidY = frontY + (backY - frontY) * df;
    return { x: cx + sign * lidHalfW * lf, y: cy + lidY };
  }

  function ensure() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #overlayUltimate{position:fixed;inset:0;z-index:63;display:none;background:#01010a;}
      #overlayUltimate canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      #ucPanel{position:absolute;left:0;right:0;bottom:0;padding:42px 44px 40px;z-index:4;
        background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(4,2,10,0.55) 35%,rgba(1,1,6,0.96) 100%);pointer-events:none;text-align:center;}
      #ucSpeaker{font-size:13px;letter-spacing:.24em;text-transform:uppercase;font-weight:700;
        margin-bottom:10px;color:#cdb6e8;text-shadow:0 0 18px rgba(180,120,235,.5);}
      #ucBody{font-size:clamp(17px,2.1vw,27px);line-height:1.5;color:#ede2fa;
        text-shadow:0 2px 22px rgba(0,0,0,.96);max-width:920px;margin:0 auto;min-height:1.5em;opacity:0;transition:opacity .5s ease;
        font-weight:400;letter-spacing:.005em;}
      #ucBody.show{opacity:1;}
      #ucBody .caret{display:inline-block;width:.4ch;color:#cdb6e8;animation:ucBlink 1s steps(2) infinite;}
      @keyframes ucBlink{50%{opacity:0}}
      .ucBtn{position:absolute;z-index:5;cursor:pointer;border:1px solid rgba(180,120,235,.3);
        background:rgba(12,6,20,.7);color:#e6d8f5;padding:9px 18px;border-radius:8px;
        font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;
        transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
      .ucBtn:hover{transform:translateY(-1px);background:rgba(34,18,52,.85);box-shadow:0 8px 24px rgba(160,100,220,.35);}
      #ucSkip{top:24px;right:28px;}
      #ucContinue{bottom:30px;right:40px;display:none;}
      #ucContinue.ready{animation:ucPulse 1.4s ease-in-out infinite;}
      @keyframes ucPulse{0%,100%{box-shadow:0 0 0 rgba(180,120,235,0)}50%{box-shadow:0 0 28px rgba(180,120,235,.45)}}`;
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.id = 'overlayUltimate';
    canvas = document.createElement('canvas'); overlay.appendChild(canvas);
    const panel = document.createElement('div'); panel.id = 'ucPanel';
    speakerEl = document.createElement('div'); speakerEl.id = 'ucSpeaker';
    bodyEl = document.createElement('div'); bodyEl.id = 'ucBody';
    panel.appendChild(speakerEl); panel.appendChild(bodyEl); overlay.appendChild(panel);
    skipBtn = document.createElement('button'); skipBtn.className = 'ucBtn'; skipBtn.id = 'ucSkip'; skipBtn.textContent = 'Skip ▸';
    contBtn = document.createElement('button'); contBtn.className = 'ucBtn'; contBtn.id = 'ucContinue'; contBtn.textContent = 'Continue ▸';
    overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    skipBtn.addEventListener('click', done);
    contBtn.addEventListener('click', advance);
    overlay.addEventListener('click', (e) => { if (e.target === skipBtn || e.target === contBtn) return; advance(); });
    window.addEventListener('resize', resize);
    makeSprites();
    makeDust(true);
  }

  // ---- glow sprites (cheap, reused) ----
  function makeSprites() {
    const mk = (col, soft) => {
      const s = 96, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,' + (soft ? 0.9 : 0.8) + ')');
      g.addColorStop(0.35, 'rgba(' + col + ',' + (soft ? 0.45 : 0.6) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      return cv;
    };
    sprites = { white: mk('255,255,255', true), shards: COLS.map(c => mk(c, false)) };
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

  // ---- drifting dust / atmosphere ----
  function makeDust(init) {
    dust = [];
    for (let i = 0; i < 120; i++) {
      dust.push({
        x: Math.random(), y: init ? Math.random() : 1.05,
        vx: (Math.random() - 0.5) * 0.02, vy: -(0.01 + Math.random() * 0.05),
        r: 0.4 + Math.random() * 1.8, life: 6 + Math.random() * 8,
        age: init ? Math.random() * 6 : 0, flick: Math.random() * 6.28
      });
    }
  }
  function spawnDust() { return { x: Math.random(), y: 1.05, vx: (Math.random() - 0.5) * 0.02, vy: -(0.01 + Math.random() * 0.05), r: 0.4 + Math.random() * 1.8, life: 6 + Math.random() * 8, age: 0, flick: Math.random() * 6.28 }; }

  function drawDust(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const d of dust) {
      d.age += 1 / 60; d.x += d.vx / 60 + Math.sin(t * 0.4 + d.flick) * 0.0002; d.y += d.vy / 60;
      if (d.y < -0.05 || d.age > d.life) { Object.assign(d, spawnDust()); continue; }
      const k = Math.max(0, 1 - d.age / d.life);
      const fl = 0.4 + 0.6 * Math.sin(t * 3 + d.flick);
      c.globalAlpha = k * fl * 0.22;
      const r = d.r * 3;
      c.drawImage(sprites.white, d.x * W - r, d.y * H - r, r * 2, r * 2);
    }
    c.globalAlpha = 1; c.restore();
  }

  // ---- god rays converging on the casket ----
  function drawGodRays(c, W, H, t, intensity) {
    if (intensity <= 0) return;
    const cx = W / 2, topY = 0, sinkY = H * 0.62;
    c.save(); c.globalCompositeOperation = 'lighter';
    const n = 11;
    for (let i = 0; i < n; i++) {
      const f = (i / (n - 1)) - 0.5;
      const topX = W / 2 + f * W * 0.9;
      const sway = Math.sin(t * 0.25 + i) * W * 0.012;
      const fl = 0.55 + 0.45 * Math.sin(t * 0.6 + i * 1.3);
      const g = c.createLinearGradient(topX + sway, topY, cx, sinkY);
      g.addColorStop(0, 'rgba(180,140,235,' + (0.0 * intensity) + ')');
      g.addColorStop(0.5, 'rgba(160,110,220,' + (0.045 * intensity * fl) + ')');
      g.addColorStop(1, 'rgba(200,150,255,' + (0.07 * intensity * fl) + ')');
      c.fillStyle = g;
      c.save(); c.beginPath();
      const wTop = W * 0.05; c.moveTo(topX - wTop / 2 + sway, topY); c.lineTo(topX + wTop / 2 + sway, topY);
      c.lineTo(cx + 18, sinkY); c.lineTo(cx - 18, sinkY); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  }

  function buildBackdrop(W, H) {
    if (!bgCanvas) { bgCanvas = document.createElement('canvas'); bgCtx = bgCanvas.getContext('2d'); }
    bgCanvas.width = Math.max(1, Math.floor(W)); bgCanvas.height = Math.max(1, Math.floor(H));
    const c = bgCtx;
    // deep void gradient
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02020c'); g.addColorStop(0.4, '#08041a'); g.addColorStop(0.7, '#0a0418'); g.addColorStop(1, '#040108');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // distant nebula breathing at the casket's location
    c.save(); c.globalCompositeOperation = 'lighter';
    const nx = W / 2, ny = H * 0.6;
    const ng = c.createRadialGradient(nx, ny, 10, nx, ny, Math.max(W, H) * 0.7);
    ng.addColorStop(0, 'rgba(120,70,200,0.10)'); ng.addColorStop(0.4, 'rgba(60,30,120,0.05)'); ng.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ng; c.fillRect(0, 0, W, H);
    c.restore();
    // faint distant stars
    c.save();
    for (let i = 0; i < 90; i++) {
      const sx = (i * 137.5) % W, sy = (i * 91.3) % (H * 0.5);
      c.globalAlpha = 0.12 + 0.18 * Math.abs(Math.sin(i));
      c.fillStyle = '#fff'; c.fillRect(sx, sy, 1, 1);
    }
    c.globalAlpha = 1; c.restore();

    // ---- perspective floor grid receding to the horizon ----
    const hz = H * 0.62; // horizon / vanishing point Y
    const vpx = W / 2;
    const floorH = H - hz;
    c.save();
    // floor base wash (atmospheric haze near horizon)
    const fg = c.createLinearGradient(0, hz, 0, H);
    fg.addColorStop(0, 'rgba(16,8,28,0.0)'); fg.addColorStop(0.5, 'rgba(14,7,26,0.6)'); fg.addColorStop(1, 'rgba(8,4,16,0.85)');
    c.fillStyle = fg; c.fillRect(0, hz, W, floorH);
    // receding vertical lines (radial from vanishing point)
    c.globalCompositeOperation = 'lighter';
    const cols = 17;
    for (let i = 0; i <= cols; i++) {
      const f = (i / cols) - 0.5;
      const bx = vpx + f * W * 2.2;
      c.strokeStyle = 'rgba(150,100,210,' + (0.10 + 0.05 * (1 - Math.abs(f * 2))) + ')'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(vpx, hz); c.lineTo(bx, H); c.stroke();
    }
    // horizontal floor bands (perspective spacing — denser near horizon)
    for (let k = 1; k <= 14; k++) {
      const f = k / 14;
      const y = hz + floorH * (f * f); // quadratic = denser near horizon
      const fade = 0.16 * (1 - f * 0.6);
      c.strokeStyle = 'rgba(150,100,210,' + fade + ')'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    c.restore();

    // altar platform under the casket — a low stone disc in perspective
    const ax = W / 2, ay = H * 0.74, ar = Math.min(W, H) * 0.36;
    c.save();
    const pg = c.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar);
    pg.addColorStop(0, 'rgba(22,15,34,0.9)'); pg.addColorStop(0.7, 'rgba(8,4,16,0.5)'); pg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = pg; c.beginPath(); c.ellipse(ax, ay, ar, ar * 0.26, 0, 0, 6.28); c.fill();
    // engraved rings on the platform
    c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(150,100,210,0.20)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(ax, ay, ar * 0.80, ar * 0.21, 0, 0, 6.28); c.stroke();
    c.strokeStyle = 'rgba(170,120,230,0.12)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(ax, ay, ar * 0.58, ar * 0.15, 0, 0, 6.28); c.stroke();
    c.strokeStyle = 'rgba(190,140,240,0.08)'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(ax, ay, ar * 0.36, ar * 0.095, 0, 0, 6.28); c.stroke();
    c.restore();

    // atmospheric depth haze near horizon
    c.save(); c.globalCompositeOperation = 'lighter';
    const hg = c.createLinearGradient(0, hz - H * 0.06, 0, hz + H * 0.06);
    hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(90,50,150,0.10)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.fillRect(0, hz - H * 0.06, W, H * 0.12);
    c.restore();

    // vignette
    const v = c.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 1.0);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  function play(opts) {
    ensure(); opts = opts || {};
    cur = { beats: BEATS.slice(), onDone: opts.onDone || function () {}, idx: 0, char: 0, typing: false, finaleStart: 0 };
    resize();
    contBtn.classList.remove('ready'); contBtn.style.display = 'none';
    overlay.style.display = 'block';
    flash = 0; shake = 0; elapsed = 0;
    if (!raf) raf = requestAnimationFrame(loop);
    startTyping();
  }

  function currentBeat() { return cur && cur.beats[cur.idx]; }
  function advance() {
    if (!cur) return;
    const b = currentBeat();
    if (cur.typing) { cur.typing = false; cur.char = (b.text || '').length; renderText(); showContinue(); }
    else {
      cur.idx++;
      if (cur.idx >= cur.beats.length) { done(); return; }
      if (cur.idx === cur.beats.length - 1) cur.finaleStart = elapsed;
      cur.char = 0; cur.typing = true; contBtn.classList.remove('ready'); contBtn.style.display = 'none';
      startTyping();
    }
  }
  function showContinue() { contBtn.style.display = 'block'; contBtn.classList.add('ready'); }
  function renderText() {
    const b = currentBeat() || {}; const text = (b.text || ''), who = b.who || '';
    speakerEl.textContent = who;
    const shown = cur.typing ? text.slice(0, Math.floor(cur.char)) : text;
    bodyEl.innerHTML = shown + (cur.typing ? '<span class="caret">▋</span>' : '');
  }
  function startTyping() {
    const b = currentBeat(); if (!b) return;
    speakerEl.textContent = b.who || '';
    bodyEl.textContent = ''; bodyEl.classList.add('show');
    cur.typing = true; cur.char = 0;
  }

  function loop(ts) {
    if (!cur) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const W = window.innerWidth, H = window.innerHeight;
    const dt = 1 / 60; elapsed += dt; const t = elapsed;
    const key = W + 'x' + H;
    if (key !== bgKey) { buildBackdrop(W, H); bgKey = key; }

    // slow Ken-Burns camera drift + push-in
    const camK = Math.min(1, t / 14);
    const zoom = 1.0 + 0.10 * camK;
    const dx = Math.sin(t * 0.12) * W * 0.012 + (1 - zoom) * W * 0.5;
    const dy = Math.cos(t * 0.09) * H * 0.01 + (1 - zoom) * H * 0.45;

    let ox = 0, oy = 0;
    if (shake > 0) { ox = (Math.random() - 0.5) * shake; oy = (Math.random() - 0.5) * shake; shake = Math.max(0, shake - 0.5); }

    ctx.save();
    ctx.translate(dx + ox, dy + oy);
    ctx.scale(zoom, zoom);
    ctx.drawImage(bgCanvas, 0, 0, W, H);

    // god rays intensify as more shards land
    const litCount = ARR.filter(a => t >= a).length;
    const rayIntensity = 0.3 + 0.18 * litCount + (cur.idx >= 1 ? 0.4 : 0);
    drawGodRays(ctx, W, H, t, rayIntensity);
    drawDust(ctx, W, H, t);

    drawCasket(ctx, W, H, t);
    drawFrags(ctx, W, H, t);
    drawEruption(ctx, W, H, t);
    drawHollow(ctx, W, H, t);

    ctx.restore();

    // letterbox bars (cinematic 2.39:1)
    const lb = H * 0.085;
    const lbg = ctx.createLinearGradient(0, 0, 0, lb);
    lbg.addColorStop(0, 'rgba(0,0,0,0.96)'); lbg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = lbg; ctx.fillRect(0, 0, W, lb);
    const lbg2 = ctx.createLinearGradient(0, H - lb, 0, H);
    lbg2.addColorStop(0, 'rgba(0,0,0,1)'); lbg2.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = lbg2; ctx.fillRect(0, H - lb, W, lb);

    // color grade + grain
    grade(ctx, W, H);
    grain(ctx, W, H, t);

    // finale white-out builds once the last beat is reached
    if (cur.finaleStart > 0) {
      const fp = Math.min(1, (elapsed - cur.finaleStart) / 2.6);
      if (fp > 0) {
        const wg = ctx.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, Math.max(W, H));
        wg.addColorStop(0, 'rgba(255,250,255,' + (fp * 0.95) + ')');
        wg.addColorStop(0.6, 'rgba(220,200,255,' + (fp * 0.7) + ')');
        wg.addColorStop(1, 'rgba(160,130,230,' + (fp * 0.4) + ')');
        ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
      }
    }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + flash + ')'; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.04); }

    if (cur.typing) {
      const b = currentBeat(); const full = (b && b.text) ? b.text.length : 0;
      const wasZero = cur.char === 0; cur.char += 1.3;
      if (wasZero) flash = 0.18;
      if (cur.char >= full) { cur.char = full; cur.typing = false; renderText(); showContinue(); }
      else renderText();
    }
  }

  // ---- the casket: a 3D obsidian box with a foreshortened socket lid ----
  function drawCasket(c, W, H, t) {
    const cx = W / 2, cy = H * 0.64;
    const baseW = Math.min(W, H) * 0.30;     // half-width at the front (bottom)
    const backW = baseW * 0.62;              // half-width at the back (top, foreshortened)
    const depth = Math.min(W, H) * 0.11;     // how tall the 3D body is (front-to-back on screen)
    const bodyH = Math.min(W, H) * 0.14;     // body height (front face)
    const lit = ARR.map(a => Math.max(0, Math.min(1, (t - a) / 0.5)));
    const allLit = lit.reduce((s, v) => s + v, 0) / 5;
    const open = cur.idx >= 1 ? Math.min(1, (elapsed - (cur.finaleStart > 0 ? cur.finaleStart : t)) / 1.2 + 0.4) : 0;
    c.save(); c.translate(cx, cy);

    // ground shadow (elongated, soft)
    c.save(); c.globalCompositeOperation = 'multiply';
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.beginPath(); c.ellipse(0, bodyH * 0.7, baseW * 1.15, bodyH * 0.22, 0, 0, 6.28); c.fill();
    c.restore();

    // ambient casket glow grows as sockets light
    if (allLit > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const ag = c.createRadialGradient(0, -depth * 0.4, 4, 0, -depth * 0.4, baseW * 1.8);
      ag.addColorStop(0, 'rgba(180,120,235,' + (0.16 * allLit) + ')'); ag.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ag; c.beginPath(); c.arc(0, -depth * 0.4, baseW * 1.8, 0, 6.28); c.fill();
      c.restore();
    }

    // ---- 3D body: front face + top face + right side face ----
    const frontTopY = -bodyH * 0.1;
    const frontBotY = bodyH * 0.7;
    const backTopY = frontTopY - depth;
    const backBotY = frontBotY - depth;

    // right side face (darkest — self-shadow)
    c.fillStyle = '#04020a';
    c.beginPath(); c.moveTo(baseW, frontTopY); c.lineTo(baseW, frontBotY);
    c.lineTo(backW, backBotY); c.lineTo(backW, backTopY); c.closePath(); c.fill();
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(120,80,180,0.18)'; c.lineWidth = 1; c.stroke(); c.restore();

    // front face (mid tone, lit from above)
    const fg = c.createLinearGradient(0, frontTopY, 0, frontBotY);
    fg.addColorStop(0, '#1c1230'); fg.addColorStop(0.6, '#0c0618'); fg.addColorStop(1, '#05030c');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-baseW, frontTopY); c.lineTo(baseW, frontTopY);
    c.lineTo(baseW, frontBotY); c.lineTo(-baseW, frontBotY); c.closePath(); c.fill();
    // front edge rim light
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(160,110,220,' + (0.25 + 0.3 * allLit) + ')'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-baseW, frontTopY); c.lineTo(baseW, frontTopY);
    c.moveTo(baseW, frontTopY); c.lineTo(baseW, frontBotY); c.stroke();
    c.restore();
    // gold inlay band across front
    c.strokeStyle = 'rgba(190,150,80,0.4)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-baseW * 0.95, frontBotY * 0.35); c.lineTo(baseW * 0.95, frontBotY * 0.35); c.stroke();

    // ---- top face: the slanted lid with 5 sockets, drawn in perspective ----
    // The lid is a trapezoid: wide at the front, narrower at the back (foreshortened).
    // Sockets sit on this face, scaled by perspective (smaller toward the back).
    drawLid(c, baseW, backW, frontTopY, backTopY, open, allLit, lit, t);

    c.restore();
  }

  // draws the slanted top lid in perspective with the five sockets
  function drawLid(c, baseW, backW, frontY, backY, open, allLit, lit, t) {
    // The lid face: front edge (wide) at frontY, back edge (narrow) at backY.
    // When closed it's a solid obsidian slab; when open it splits down the middle.
    const split = open * baseW * 0.42; // how far the two halves swing apart

    // helper to map a normalized position [0=front,1=back] across the lid to screen Y
    const lidY = (f) => frontY + (backY - frontY) * f;
    // helper for half-width at a given depth fraction (front wide -> back narrow)
    const lidHalfW = (f) => baseW * (1 - f) + backW * f;

    // draw one half of the lid (left or right), offset outward by 'gap'
    const drawHalf = (sign, gap) => {
      c.save(); c.translate(sign * gap, -gap * 0.35); // tilt as it opens
      // the lid slab
      const pts = [
        [sign * lidHalfW(0), lidY(0)],         // front-outer
        [sign * lidHalfW(1), lidY(1)],         // back-outer
        [0, lidY(1)],                          // back-inner (center seam)
        [0, lidY(0)]                           // front-inner (center seam)
      ];
      const lg = c.createLinearGradient(0, lidY(0), 0, lidY(1));
      lg.addColorStop(0, '#241638'); lg.addColorStop(0.5, '#180e2c'); lg.addColorStop(1, '#0a0418');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < 4; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill();
      // rim light on the outer edge
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(170,120,220,' + (0.28 + 0.3 * allLit) + ')'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.stroke();
      c.restore();
      // gold crest inlay along the center seam
      c.strokeStyle = 'rgba(195,155,85,0.4)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, lidY(0)); c.quadraticCurveTo(sign * lidHalfW(0.5) * 0.3, lidY(0.5), 0, lidY(1)); c.stroke();

      // sockets on this half: indices on the left = [0,1], right = [3,4]; center socket(2) drawn separately
      const idxs = sign < 0 ? [0, 1] : [3, 4];
      for (const i of idxs) {
        // depth fraction along the lid (sockets are arranged front-to-back across the lid)
        const df = [0.20, 0.55, 0.5, 0.55, 0.20][i];
        // lateral fraction within this half (0=center seam,1=outer edge)
        const lf = [0.55, 0.55, 0.5, 0.55, 0.55][i];
        const sx = sign * lidHalfW(df) * lf;
        const sy = lidY(df);
        const persp = 1 - df * 0.42; // foreshortening scale toward the back
        drawSocket(c, sx, sy, 9 * persp, COLS[i], lit[i], persp);
      }
      c.restore();
    };

    drawHalf(-1, split); // left half
    drawHalf(1, split);  // right half

    // center socket (index 2) sits on the seam — only fully visible when closed
    const cdf = 0.5;
    const csy = lidY(cdf);
    const cpersp = 1 - cdf * 0.42;
    // draw it slightly above the seam so it's visible even as halves part
    c.save(); c.translate(0, -split * 0.35);
    drawSocket(c, 0, csy, 9 * cpersp, COLS[2], lit[2], cpersp);
    c.restore();

    // open: pillar of light rising from inside the casket (between the parted halves)
    if (open > 0) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const cy = (lidY(0) + lidY(1)) / 2;
      const ig = c.createRadialGradient(0, cy, 2, 0, cy, baseW * 1.2);
      ig.addColorStop(0, 'rgba(255,255,255,' + (0.9 * open) + ')');
      ig.addColorStop(0.4, 'rgba(200,150,255,' + (0.6 * open) + ')');
      ig.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = ig; c.beginPath(); c.arc(0, cy, baseW * 1.2, 0, 6.28); c.fill();
      const bg2 = c.createLinearGradient(0, cy - baseW * 2.2, 0, cy);
      bg2.addColorStop(0, 'rgba(220,180,255,0)'); bg2.addColorStop(0.5, 'rgba(220,190,255,' + (0.4 * open) + ')'); bg2.addColorStop(1, 'rgba(255,240,255,' + (0.55 * open) + ')');
      c.fillStyle = bg2; c.fillRect(-baseW * 0.2, cy - baseW * 2.2, baseW * 0.4, baseW * 2.2);
      c.restore();
    }
  }

  // a single recessed socket with perspective-scaled glow
  function drawSocket(c, x, y, r, rc, litv, persp) {
    // recessed dark socket (ellipse for perspective)
    c.fillStyle = 'rgba(0,0,0,0.85)'; c.strokeStyle = 'rgba(120,80,170,0.45)'; c.lineWidth = 1.2 * persp;
    c.beginPath(); c.ellipse(x, y, r, r * 0.62, 0, 0, 6.28); c.fill(); c.stroke();
    // glow
    c.save(); c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(x, y, 1, x, y, r * 2.2);
    gg.addColorStop(0, 'rgba(255,255,255,' + (0.85 * litv) + ')');
    gg.addColorStop(0.4, 'rgba(' + rc + ',' + (0.7 * litv) + ')');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y, r * 2.2, 0, 6.28); c.fill();
    c.restore();
    // set gem
    if (litv > 0.5) {
      c.fillStyle = 'rgba(' + rc + ',' + (0.85 * litv) + ')';
      c.strokeStyle = 'rgba(255,255,255,' + (0.6 * litv) + ')'; c.lineWidth = 1 * persp;
      c.beginPath(); c.ellipse(x, y, r * 0.45, r * 0.3, 0, 0, 6.28); c.fill(); c.stroke();
    }
  }

  // ---- the shards: faceted crystals with luminous trails ----
  function drawFrags(c, W, H, t) {
    for (let i = 0; i < 5; i++) {
      const arrived = t >= ARR[i];
      const rc = COLS[i];
      const dest = socketPos(W, H, i);
      if (!arrived) {
        // approaching — slow parabolic drift with a long luminous trail
        const sx = START_X[i] * W, sy = START_Y[i] * H;
        const gx = dest.x, gy = dest.y;
        const dur = 0.9;
        const p = Math.max(0, Math.min(1, (t - (ARR[i] - dur)) / dur));
        const ease = p * p * (3 - 2 * p);
        const px = sx + (gx - sx) * ease, py = sy + (gy - sy) * ease - Math.sin(p * Math.PI) * H * 0.10;
        drawShard(c, px, py, t * 1.5 + i * 1.2, rc, 1.0, t, sx, sy, gx, gy, ease, H);
        // arrival flash
        if (p > 0.96) flash = Math.max(flash, 0.4);
      } else {
        // settled — subtle floating gem in socket (handled by casket), draw a faint orbiting mote
        const settle = Math.max(0, Math.min(1, (t - ARR[i]) / 0.6));
        c.save(); c.globalCompositeOperation = 'lighter';
        const a = t * 0.6 + i * 1.2, orb = 12 + Math.sin(t * 2 + i) * 3;
        const mx = dest.x + Math.cos(a) * orb, my = dest.y + Math.sin(a) * orb * 0.4;
        c.globalAlpha = 0.5 * settle;
        const spr = sprites.shards[i];
        const r = 9; c.drawImage(spr, mx - r, my - r, r * 2, r * 2);
        c.globalAlpha = 1; c.restore();
      }
    }
  }

  function drawShard(c, x, y, rot, rc, scale, t, sx, sy, gx, gy, p, H) {
    // luminous trail
    c.save(); c.globalCompositeOperation = 'lighter';
    const segs = 6;
    for (let s = 1; s <= segs; s++) {
      const f = s / segs;
      const tf = Math.max(0, p - f * 0.12);
      const te = tf * tf * (3 - 2 * tf);
      const tx = sx + (gx - sx) * te, ty = sy + (gy - sy) * te - Math.sin(tf * Math.PI) * H * 0.10;
      const a = (1 - f) * 0.18;
      const r = 16 * (1 - f * 0.5);
      const g = c.createRadialGradient(tx, ty, 0, tx, ty, r);
      g.addColorStop(0, 'rgba(' + rc + ',' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(tx, ty, r, 0, 6.28); c.fill();
    }
    c.restore();

    c.save(); c.translate(x, y); c.rotate(rot);
    // halo
    c.save(); c.globalCompositeOperation = 'lighter';
    const hg = c.createRadialGradient(0, 0, 1, 0, 0, 28);
    hg.addColorStop(0, 'rgba(255,255,255,0.7)'); hg.addColorStop(0.4, 'rgba(' + rc + ',0.6)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 28, 0, 6.28); c.fill();
    c.restore();
    // faceted crystal diamond
    const s = 13 * scale;
    const facets = [
      { pts: [[0, -s * 1.6], [s * 0.6, 0], [0, s * 1.4]], cols: ['#ffffff', 'rgba(' + rc + ',0.95)', 'rgba(40,20,60,0.9)'] },
      { pts: [[0, -s * 1.6], [-s * 0.6, 0], [0, s * 1.4]], cols: ['#f0f0ff', 'rgba(' + rc + ',0.8)', 'rgba(30,16,50,0.9)'] }
    ];
    for (const f of facets) {
      const fg = c.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[2][0], f.pts[2][1]);
      fg.addColorStop(0, f.cols[0]); fg.addColorStop(0.5, f.cols[1]); fg.addColorStop(1, f.cols[2]);
      c.fillStyle = fg; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.closePath(); c.fill(); c.stroke();
    }
    // bright core line
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -s * 1.6); c.lineTo(0, s * 1.4); c.stroke();
    c.restore();
  }

  // ---- eruption: a serious pillar + shockwave ----
  function drawEruption(c, W, H, t) {
    if (cur.idx < 2) return;
    const cx = W / 2, cy = H * 0.6;
    const p = Math.min(1, (elapsed - cur.finaleStart) / 2.0);
    if (p <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    // central pillar of light
    const pg = c.createLinearGradient(0, cy - H * 0.7 * p, 0, cy);
    pg.addColorStop(0, 'rgba(220,180,255,0)'); pg.addColorStop(0.6, 'rgba(210,160,250,' + (0.35 * p) + ')'); pg.addColorStop(1, 'rgba(255,240,255,' + (0.6 * p) + ')');
    c.fillStyle = pg; c.fillRect(cx - W * 0.06, cy - H * 0.7 * p, W * 0.12, H * 0.7 * p);
    // soft radial bloom
    const rg = c.createRadialGradient(cx, cy, 4, cx, cy, Math.min(W, H) * 0.8 * p);
    rg.addColorStop(0, 'rgba(255,250,255,' + (0.5 * p) + ')'); rg.addColorStop(0.4, 'rgba(190,140,250,' + (0.25 * p) + ')'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, Math.min(W, H) * 0.8 * p, 0, 6.28); c.fill();
    // expanding shockwave ring (single, serious)
    const rr = p * Math.min(W, H) * 0.85;
    c.strokeStyle = 'rgba(230,200,255,' + (0.55 * (1 - p)) + ')'; c.lineWidth = 6 * (1 - p) + 1.5;
    c.beginPath(); c.arc(cx, cy, rr, 0, 6.28); c.stroke();
    // secondary inner ring
    if (p > 0.2) {
      const rr2 = (p - 0.2) * Math.min(W, H) * 0.6;
      c.strokeStyle = 'rgba(255,255,255,' + (0.4 * (1 - p)) + ')'; c.lineWidth = 3 * (1 - p) + 1;
      c.beginPath(); c.arc(cx, cy, rr2, 0, 6.28); c.stroke();
    }
    c.restore();
    if (p > 0.25 && shake < 5) shake = 7;
  }

  // ---- the Hollow: a fractured cosmic silhouette ----
  function drawHollow(c, W, H, t) {
    if (cur.idx < 2) return;
    const p = Math.min(1, (elapsed - cur.finaleStart - 1.0) / 1.8);
    if (p <= 0) return;
    const cx = W / 2, cy = H * 0.40 - p * H * 0.05;
    const R = Math.min(W, H) * 0.11 * p;
    c.save(); c.globalCompositeOperation = 'lighter';
    // fractured halo — concentric broken arcs, slow rotation, no cartoon dashes
    for (let i = 0; i < 4; i++) {
      const rr = R * (1.0 + i * 0.55) * (0.85 + 0.15 * Math.sin(elapsed * 1.2 + i));
      const rc = COLS[i];
      const rot = elapsed * (0.15 + i * 0.08) * (i % 2 ? 1 : -1);
      c.save(); c.translate(cx, cy); c.rotate(rot);
      c.strokeStyle = 'rgba(' + rc + ',' + (0.35 * p) + ')'; c.lineWidth = 1.5;
      const arcs = 3, gap = 0.5;
      for (let a = 0; a < arcs; a++) {
        const a0 = (a / arcs) * 6.28, a1 = a0 + (6.28 / arcs) - gap;
        c.beginPath(); c.arc(0, 0, rr, a0, a1); c.stroke();
      }
      c.restore();
    }
    // dark core silhouette
    c.restore();
    c.save(); c.translate(cx, cy);
    const cg = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    cg.addColorStop(0, 'rgba(10,6,18,' + (0.95 * p) + ')'); cg.addColorStop(0.7, 'rgba(20,12,36,' + (0.6 * p) + ')'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.fill();
    // bright fractured eye-core
    c.globalCompositeOperation = 'lighter';
    const eg = c.createRadialGradient(0, 0, 1, 0, 0, R * 0.5);
    eg.addColorStop(0, 'rgba(255,250,255,' + (0.85 * p) + ')'); eg.addColorStop(0.5, 'rgba(190,130,245,' + (0.5 * p) + ')'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = eg; c.beginPath(); c.arc(0, 0, R * 0.5, 0, 6.28); c.fill();
    // chromatic fracture lines (red/cyan offset) — serious cosmic horror
    c.strokeStyle = 'rgba(255,58,106,' + (0.4 * p) + ')'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-R * 0.6, -R * 0.2); c.lineTo(R * 0.5, R * 0.3); c.stroke();
    c.strokeStyle = 'rgba(58,254,200,' + (0.4 * p) + ')'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-R * 0.6 + 2, -R * 0.2); c.lineTo(R * 0.5 + 2, R * 0.3); c.stroke();
    c.restore();
  }

  // ---- post: color grade + grain ----
  function grade(c, W, H) {
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.35;
    c.fillStyle = '#3a2a6a'; c.fillRect(0, 0, W, H); c.restore();
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.25;
    c.fillStyle = '#0a0418'; c.fillRect(0, 0, W, H); c.restore();
  }
  function grain(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = 0.05;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const x = (Math.sin(i * 12.9 + t * 4.1) * 0.5 + 0.5) * W;
      const y = (Math.cos(i * 7.3 + t * 3.7) * 0.5 + 0.5) * H;
      c.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      c.fillRect(x, y, 1, 1);
    }
    c.restore();
  }

  function done() {
    if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
    const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
    overlay.style.display = 'none'; if (typeof cb === 'function') cb();
  }

  window.UltimateCutscene = { play, done };
})();
