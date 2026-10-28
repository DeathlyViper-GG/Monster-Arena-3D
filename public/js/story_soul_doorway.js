// ============================================================
// Monster Arena — THE SOUL DOORWAY (cursed magical transition)
// The final-boss intro cinematic. Plays the moment the Scribe
// chooses to step through the Soul Doorway — AFTER the Casket
// choice, BEFORE the Hollow Gauntlet intro (where the Wardens
// demonstrate their attacks). A bespoke, lore-driven canvas
// sequence: the five recovered soul-shards (one per realm)
// braid into a radiant doorway of light with a cursed dark
// core, the Scribe steps through and is swallowed, reality
// fractures (chromatic aberration, god-rays) into the Neon
// Void, and the Hollow's eye opens overhead. Typed dialogue
// with a Continue button advances the beats. Exposes
// window.SoulDoorway.play({ onDone }).
// ============================================================
(function () {
  'use strict';

  // per-realm shard colours (meadow / dunes / glacial / cinder / void)
  const SHARD_COLORS = ['#7dffa3', '#ffd166', '#9fe3ff', '#ff7a66', '#c066ff'];
  const VOID = '#c066ff';

  // lore-rich, cursed-magical dialogue beats; each beat drives a visual phase
  const BEATS = [
    { who: 'The Last Scribe', text: 'Five shards. My soul, whole at last. I hold the Casket of Seals — and within it, a doorway.', phase: 0 },
    { who: 'The Hollow', text: 'Whole again, little scribe. I feel you from across the dark. Come. Step through. I have waited so very long.', phase: 1 },
    { who: 'The Last Scribe', text: 'I open the Casket. The five shards rise — each a piece of me I paid in blood to reclaim — and braid into one door of light.', phase: 2 },
    { who: 'The Archivist', text: 'The seals dissolve. Beyond the door, every Warden you slew is reborn at once — and above them, the Hollow.', phase: 3 },
    { who: 'The Last Scribe', text: 'I step through.', phase: 4 },
    { who: 'The Hollow', text: 'Welcome to my gauntlet. Five Wardens. Ten stages. Slay them all, scribe — then face me. Or die, and begin again at my door.', phase: 5 }
  ];

  let overlay = null, canvas = null, ctx = null, raf = 0;
  let skipBtn = null, contBtn = null, speakerEl = null, bodyEl = null;
  let cur = null, elapsed = 0;
  let grain = null, softSprite = null, moteSprites = {};
  let shards = [], motes = [], cracks = [], runes = [], wardenSil = [], eye = null;
  let shake = 0, flash = 0, whiteout = 0;

  function ensure() {
    if (overlay) return;
    const style = document.createElement('style');
    style.textContent = `
      #overlaySoulDoor{position:fixed;inset:0;z-index:67;display:none;background:#000;}
      #overlaySoulDoor canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
      #sdBar{position:absolute;left:0;right:0;height:0;background:#000;z-index:3;pointer-events:none;transition:height .6s cubic-bezier(.6,0,.4,1);}
      #sdBarTop{top:0;} #sdBarBot{bottom:0;}
      #sdPanel{position:absolute;left:0;right:0;bottom:0;padding:60px 44px 30px;z-index:4;
        background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0.74) 42%,rgba(1,2,5,0.97) 100%);pointer-events:none;}
      #sdSpeaker{font-size:13px;letter-spacing:.26em;text-transform:uppercase;font-weight:800;margin-bottom:8px;text-shadow:0 0 14px currentColor;}
      #sdBody{font-size:clamp(18px,2.3vw,28px);line-height:1.5;color:#eef3ff;text-shadow:0 2px 20px rgba(0,0,0,.96);max-width:980px;min-height:1.4em;}
      #sdBody .caret{display:inline-block;width:.5ch;color:#fff;opacity:.9;animation:sdBlink 1s steps(2) infinite;}
      @keyframes sdBlink{50%{opacity:0}}
      .sdBtn{position:absolute;z-index:5;cursor:pointer;border:1px solid rgba(255,255,255,.22);
        background:rgba(10,14,22,.72);color:#eaf4ff;padding:10px 18px;border-radius:8px;
        font-size:13px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;
        transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
      .sdBtn:hover{transform:translateY(-1px);background:rgba(30,40,60,.88);box-shadow:0 8px 22px rgba(0,0,0,.5);}
      #sdSkip{top:30px;right:30px;}
      #sdContinue{bottom:30px;right:40px;display:none;}
      #sdContinue.ready{animation:sdPulse 1.4s ease-in-out infinite;}
      @keyframes sdPulse{0%,100%{box-shadow:0 0 0 rgba(255,255,255,0)}50%{box-shadow:0 0 26px rgba(255,255,255,.32)}}`;
    document.head.appendChild(style);
    overlay = document.createElement('div'); overlay.id = 'overlaySoulDoor';
    canvas = document.createElement('canvas'); overlay.appendChild(canvas);
    const bt = document.createElement('div'); bt.className = 'sdBar'; bt.id = 'sdBarTop';
    const bb = document.createElement('div'); bb.className = 'sdBar'; bb.id = 'sdBarBot';
    overlay.appendChild(bt); overlay.appendChild(bb);
    const panel = document.createElement('div'); panel.id = 'sdPanel';
    speakerEl = document.createElement('div'); speakerEl.id = 'sdSpeaker';
    bodyEl = document.createElement('div'); bodyEl.id = 'sdBody';
    panel.appendChild(speakerEl); panel.appendChild(bodyEl); overlay.appendChild(panel);
    skipBtn = document.createElement('button'); skipBtn.className = 'sdBtn'; skipBtn.id = 'sdSkip'; skipBtn.textContent = 'Skip ▸';
    contBtn = document.createElement('button'); contBtn.className = 'sdBtn'; contBtn.id = 'sdContinue'; contBtn.textContent = 'Continue ▸';
    overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
    document.body.appendChild(overlay);
    ctx = canvas.getContext('2d');
    skipBtn.addEventListener('click', done);
    contBtn.addEventListener('click', advance);
    overlay.addEventListener('click', (e) => { if (e.target === skipBtn || e.target === contBtn) return; advance(); });
    window.addEventListener('resize', resize);
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
    if (h.length !== 6) return [192, 102, 255];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
  function mix(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  function buildSprites() {
    if (grain) return;
    softSprite = document.createElement('canvas'); softSprite.width = softSprite.height = 128;
    let x = softSprite.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(0.4, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    grain = document.createElement('canvas'); grain.width = grain.height = 160;
    x = grain.getContext('2d'); const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 16; }
    x.putImageData(id, 0, 0);
    for (const col of SHARD_COLORS) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 24;
      const cx = cv.getContext('2d'), rgb = hexToRGB(col);
      const gg = cx.createRadialGradient(12, 12, 0, 12, 12, 12);
      gg.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',1)');
      gg.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0.45)');
      gg.addColorStop(1, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',0)');
      cx.fillStyle = gg; cx.fillRect(0, 0, 24, 24);
      moteSprites[col] = cv;
    }
  }

  function makeAssets() {
    shards = [];
    for (let i = 0; i < 5; i++) {
      const col = SHARD_COLORS[i];
      const a = (i / 5) * 6.2832 - Math.PI / 2;
      shards.push({ col, rgb: hexToRGB(col), a, d: 0.5, s: 14, rot: rnd() * 6.28, vr: 0.3, ph: rnd() * 6.28, x: 0, y: 0, vx: 0, vy: 0, merged: false });
    }
    motes = [];
    for (let i = 0; i < 70; i++) {
      const col = SHARD_COLORS[(rnd() * 5) | 0];
      motes.push({ x: rnd(), y: rnd(), r: 0.6 + rnd() * 2.2, vy: 0.02 + rnd() * 0.07, vx: (rnd() - 0.5) * 0.006, a: 0.2 + rnd() * 0.5, ph: rnd() * 6.28, col, sprite: moteSprites[col] });
    }
    cracks = [];
    for (let i = 0; i < 6; i++) cracks.push({ a: rnd() * 6.28, len: 0.3 + rnd() * 0.4, w: 1 + rnd() * 2, seed: rnd() * 99, born: 0 });
    runes = [];
    for (let i = 0; i < 10; i++) runes.push({ off: i / 10, ph: rnd() * 6.28, side: i % 2 });
    wardenSil = [];
    for (let i = 0; i < 5; i++) wardenSil.push({ x: (i - 2) * 0.16, col: SHARD_COLORS[i], h: 0.18 + rnd() * 0.06, ph: rnd() * 6.28 });
    eye = { open: 0 };
  }

  function play(opts) {
    opts = opts || {};
    ensure(); buildSprites(); makeAssets(); resize();
    cur = { idx: 0, char: 0, typing: true, waiting: false, onDone: opts.onDone || function () {} };
    speakerEl.style.color = VOID;
    contBtn.classList.remove('ready'); contBtn.style.display = 'none';
    overlay.style.display = 'block'; elapsed = 0; shake = 0; flash = 0; whiteout = 0;
    requestAnimationFrame(() => {
      const bh = Math.max(56, window.innerHeight * 0.10);
      const bt = document.getElementById('sdBarTop'), bb = document.getElementById('sdBarBot');
      if (bt) bt.style.height = bh + 'px'; if (bb) bb.style.height = bh + 'px';
    });
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function currentBeat() { return cur && BEATS[cur.idx]; }
  function advance() {
    if (!cur) return;
    const b = currentBeat(); if (!b) { done(); return; }
    if (cur.typing) { cur.typing = false; cur.char = (b.text || '').length; renderText(); showContinue(); }
    else { cur.idx++; if (cur.idx >= BEATS.length) { done(); return; } cur.char = 0; cur.typing = true; contBtn.classList.remove('ready'); contBtn.style.display = 'none'; flash = 0.3; shake = 6; }
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
    elapsed += 1 / 60;
    const phase = (currentBeat() || {}).phase || 0;

    let ox = 0, oy = 0;
    if (shake > 0) { ox = (rnd() - 0.5) * shake; oy = (rnd() - 0.5) * shake; shake = Math.max(0, shake - 0.4); }
    c.save();
    if (phase >= 5) { /* void phase: slight drift */ c.translate(Math.sin(t * 0.2) * 6 + ox, Math.cos(t * 0.16) * 4 + oy); }
    else { c.translate(ox, oy); }

    // ---- background ----
    drawBackground(c, W, H, t, phase);
    // ---- ambient drifting motes ----
    drawMotes(c, W, H, t, phase);
    // ---- god-rays converging on the doorway center (phases 2-5) ----
    if (phase >= 2) drawRays(c, W, H, t, phase);
    // ---- the five shards converging / braiding (phases 0-3) ----
    if (phase < 4) drawShards(c, W, H, t, phase);
    // ---- the doorway of light (phases 3-4) ----
    if (phase >= 3 && phase < 5) drawDoorway(c, W, H, t, phase);
    // ---- chromatic aberration cracks (phases 1-4) ----
    if (phase >= 1 && phase < 5) drawCracks(c, W, H, t, phase);
    // ---- the Scribe stepping through (phase 4) ----
    if (phase === 4) drawScribe(c, W, H, t);
    // ---- the Neon Void + Hollow eye reveal (phase 5) ----
    if (phase >= 5) drawVoidReveal(c, W, H, t);

    c.restore();

    // typing
    if (cur.typing) {
      const b = currentBeat(), full = (b && b.text) ? b.text.length : 0, wasZero = cur.char === 0;
      cur.char += 1.6;
      if (wasZero) { flash = 0.3; shake = 6; }
      if (cur.char >= full) { cur.char = full; cur.typing = false; renderText(); showContinue(); } else renderText();
    }

    // whiteout (phase 4 step-through + final)
    if (phase === 4) { const w = ease(clamp((t - 0.3) / 1.2, 0, 1)); whiteout = Math.max(whiteout, w * 0.9); }
    if (whiteout > 0) { c.fillStyle = 'rgba(255,252,240,' + whiteout + ')'; c.fillRect(0, 0, W, H); whiteout = Math.max(0, whiteout - 0.02); }

    if (flash > 0) { c.fillStyle = 'rgba(255,255,255,' + flash + ')'; c.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.03); }

    // cinematic grade: vignette + grain
    const v = c.createRadialGradient(W / 2, H * 0.52, H * 0.22, W / 2, H * 0.52, H * 0.98);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.42)'); v.addColorStop(1, 'rgba(0,0,0,0.9)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.45 + 0.1 * Math.sin(t * 40);
    c.translate(-Math.floor(rnd() * 80), -Math.floor(rnd() * 80));
    c.fillStyle = c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W + 160, H + 160); c.restore();
    if (t < 1.0) { c.fillStyle = 'rgba(0,0,0,' + (1 - ease(t / 1.0)) + ')'; c.fillRect(0, 0, W, H); }
  }

  function drawBackground(c, W, H, t, phase) {
    const cc = hexToRGB(VOID);
    let g = c.createLinearGradient(0, 0, 0, H);
    if (phase < 5) {
      g.addColorStop(0, '#02020a'); g.addColorStop(0.5, '#060414'); g.addColorStop(1, rgba(mix(cc, 0.10), 1));
    } else {
      // Neon Void aesthetic
      g.addColorStop(0, '#0a0218'); g.addColorStop(0.4, '#120630'); g.addColorStop(1, '#06020f');
    }
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // starfield
    c.save(); c.fillStyle = '#fff';
    for (let i = 0; i < 70; i++) {
      const sx = ((i * 137.13) % W), sy = ((i * 91.7) % (H * 0.8));
      c.globalAlpha = 0.2 + 0.4 * Math.abs(Math.sin(t * 0.5 + i));
      c.beginPath(); c.arc(sx, sy, 0.8 + (i % 3) * 0.4, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1; c.restore();
    // central cursed bloom
    if (phase < 5) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const cy = H * 0.46, pulse = 0.7 + 0.3 * Math.sin(t * 1.6);
      const bg = c.createRadialGradient(W / 2, cy, 6, W / 2, cy, W * 0.55);
      bg.addColorStop(0, rgba(cc, 0.22 * pulse)); bg.addColorStop(0.5, rgba(cc, 0.06)); bg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = bg; c.fillRect(0, 0, W, H); c.restore();
    }
  }

  function drawMotes(c, W, H, t, phase) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.y -= m.vy * 0.016; m.x += m.vx * 0.016; m.ph += 0.02;
      if (m.y < -0.06) m.y = 1.06; if (m.x < -0.06) m.x = 1.06; if (m.x > 1.06) m.x = -0.06;
      const fl = 0.5 + 0.5 * Math.sin(m.ph); if (fl <= 0.02) continue;
      c.globalAlpha = m.a * fl;
      const sz = m.r * 3;
      c.drawImage(m.sprite, m.x * W - sz, m.y * H - sz, sz * 2, sz * 2);
    }
    c.restore();
  }

  function drawRays(c, W, H, t, phase) {
    const cx = W / 2, cy = H * 0.46;
    const cc = hexToRGB(VOID);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.18 + Math.sin(t * 0.3 + i) * 0.03;
      const flick = 0.5 + 0.5 * Math.sin(t * 1.2 + i);
      const len = Math.hypot(W, H), w = H * 0.05;
      c.save(); c.translate(cx, cy); c.rotate(a);
      const lg = c.createLinearGradient(0, 0, len, 0);
      lg.addColorStop(0, rgba(cc, 0.12 * flick)); lg.addColorStop(0.5, rgba(cc, 0.04 * flick)); lg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = lg; c.beginPath(); c.moveTo(0, 0); c.lineTo(len, -w); c.lineTo(len, w); c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
  }

  // shard phase targets: 0 = wide orbit drift, 1 = pull inward, 2 = streak to center, 3 = braid held in doorway
  function drawShards(c, W, H, t, phase) {
    const cx = W / 2, cy = H * 0.46;
    const R = Math.min(W, H);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      let d, scale, alpha;
      if (phase === 0) { d = 0.5 + Math.sin(t * 0.5 + s.ph) * 0.04; scale = 1; alpha = 0.85; }
      else if (phase === 1) { const p = ease(clamp(t / 2, 0, 1)); d = 0.5 - p * 0.12; scale = 1 + p * 0.2; alpha = 0.95; }
      else if (phase === 2) { const p = ease(clamp(t / 2.5, 0, 1)); d = 0.38 - p * 0.36; scale = 1.2 - p * 0.4; alpha = 0.95; }
      else { d = 0.02; scale = 0.4; alpha = 0.6; }
      const a = s.a + t * 0.4;
      const x = cx + Math.cos(a) * d * R, y = cy + Math.sin(a) * d * R * 0.7;
      const sz = s.s * scale * (R / 700);
      // glowing mote
      const sg = c.createRadialGradient(x, y, 0, x, y, sz * 4);
      sg.addColorStop(0, rgba(s.rgb, 0.9 * alpha)); sg.addColorStop(0.4, rgba(s.rgb, 0.3 * alpha)); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(x, y, sz * 4, 0, 6.2832); c.fill();
      // faceted shard
      c.save(); c.translate(x, y); c.rotate(s.rot + t * s.vr);
      c.fillStyle = rgba(s.rgb, alpha); c.strokeStyle = 'rgba(255,255,255,' + (0.6 * alpha) + ')'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -sz); c.lineTo(sz * 0.35, 0); c.lineTo(0, sz); c.lineTo(-sz * 0.35, 0); c.closePath(); c.fill(); c.stroke();
      c.restore();
      // trailing streak as they converge (phase 2)
      if (phase === 2) {
        c.strokeStyle = rgba(s.rgb, 0.4); c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y); c.lineTo(cx + Math.cos(a - 0.4) * (d + 0.08) * R, cy + Math.sin(a - 0.4) * (d + 0.08) * R * 0.7); c.stroke();
      }
    }
    c.restore();
  }

  function drawDoorway(c, W, H, t, phase) {
    const cx = W / 2, cy = H * 0.46;
    const R = Math.min(W, H);
    const dw = R * 0.16, dh = R * 0.42;
    const grow = phase === 3 ? ease(clamp((t) / 1.5, 0, 1)) : 1;
    const w = dw * grow, h = dh * grow;
    const cc = hexToRGB(VOID);
    c.save();
    // outer cursed halo
    c.globalCompositeOperation = 'lighter';
    const hg = c.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 4);
    hg.addColorStop(0, rgba(cc, 0.35)); hg.addColorStop(0.5, rgba(cc, 0.08)); hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(cx, cy, w * 4, 0, 6.2832); c.fill();
    c.restore();

    // door frame: runic arch
    c.save(); c.globalCompositeOperation = 'source-over';
    const frameMat = c.createLinearGradient(cx - w, 0, cx + w, 0);
    frameMat.addColorStop(0, rgba([255, 230, 170], 0.9)); frameMat.addColorStop(0.5, 'rgba(255,255,255,0.95)'); frameMat.addColorStop(1, rgba([255, 230, 170], 0.9));
    c.strokeStyle = frameMat; c.lineWidth = Math.max(4, w * 0.10);
    c.beginPath();
    c.moveTo(cx - w, cy + h); c.lineTo(cx - w, cy - h * 0.6);
    c.quadraticCurveTo(cx - w, cy - h, cx, cy - h);
    c.quadraticCurveTo(cx + w, cy - h, cx + w, cy - h * 0.6);
    c.lineTo(cx + w, cy + h); c.stroke();
    // glowing runes climbing the frame
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const r of runes) {
      const u = (r.off + t * 0.15) % 1;
      const side = r.side ? 1 : -1;
      const ry = cy + h - u * (h * 1.6);
      const rx = cx + side * (w + w * 0.12);
      const fl = 0.5 + 0.5 * Math.sin(t * 3 + r.ph);
      c.fillStyle = rgba([255, 240, 200], 0.8 * fl);
      c.beginPath(); c.arc(rx, ry, 3, 0, 6.2832); c.fill();
    }
    c.restore();
    c.restore();

    // door interior: bright edges → cursed dark core, swirling shard colors
    c.save(); c.globalCompositeOperation = 'lighter';
    const ig = c.createLinearGradient(cx, cy - h, cx, cy + h);
    ig.addColorStop(0, 'rgba(255,255,255,0.95)'); ig.addColorStop(0.5, rgba(cc, 0.6)); ig.addColorStop(1, 'rgba(20,5,40,0.2)');
    c.fillStyle = ig;
    c.beginPath();
    c.moveTo(cx - w, cy + h); c.lineTo(cx - w, cy - h * 0.6);
    c.quadraticCurveTo(cx - w, cy - h, cx, cy - h);
    c.quadraticCurveTo(cx + w, cy - h, cx + w, cy - h * 0.6);
    c.lineTo(cx + w, cy + h); c.closePath(); c.fill();
    // swirling shard colors inside
    for (let i = 0; i < 5; i++) {
      const srgb = hexToRGB(SHARD_COLORS[i]);
      const a = t * 1.2 + i * 1.25;
      const sx = cx + Math.cos(a) * w * 0.5, sy = cy + Math.sin(a * 0.7) * h * 0.5;
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, w * 0.5);
      sg.addColorStop(0, rgba(srgb, 0.5)); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, w * 0.5, 0, 6.2832); c.fill();
    }
    // cursed dark core
    c.globalCompositeOperation = 'source-over';
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.5);
    core.addColorStop(0, 'rgba(10,2,20,0.85)'); core.addColorStop(0.7, 'rgba(30,8,50,0.4)'); core.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = core; c.beginPath(); c.ellipse(cx, cy, w * 0.45, h * 0.5, 0, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawCracks(c, W, H, t, phase) {
    const cx = W / 2, cy = H * 0.46;
    const intensity = phase >= 2 ? 1 : 0.5;
    for (let i = 0; i < cracks.length; i++) {
      const k = cracks[i];
      const appear = clamp((t - i * 0.2) / 1.5, 0, 1);
      if (appear <= 0) continue;
      const a = k.a + Math.sin(t * 0.3 + i) * 0.1;
      const len = k.len * Math.min(W, H) * appear;
      const x2 = cx + Math.cos(a) * len, y2 = cy + Math.sin(a) * len;
      // jagged path
      const pts = jagPath(cx, cy, x2, y2, 6, k.seed);
      // red + cyan offset for chromatic aberration
      c.save(); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,40,40,' + (0.5 * intensity * appear) + ')'; c.lineWidth = k.w;
      c.beginPath(); drawPoly(c, pts, -3, 0); c.stroke();
      c.strokeStyle = 'rgba(40,200,255,' + (0.5 * intensity * appear) + ')'; c.lineWidth = k.w;
      c.beginPath(); drawPoly(c, pts, 3, 0); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,' + (0.7 * intensity * appear) + ')'; c.lineWidth = 1;
      c.beginPath(); drawPoly(c, pts, 0, 0); c.stroke();
      c.restore();
    }
  }
  function jagPath(x1, y1, x2, y2, seg, seed) {
    const pts = [[x1, y1]]; let s = seed * 99 + 7;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 1; i < seg; i++) {
      const u = i / seg, off = (r() - 0.5) * L * 0.08;
      pts.push([x1 + dx * u + nx * off, y1 + dy * u + ny * off]);
    }
    pts.push([x2, y2]); return pts;
  }
  function drawPoly(c, pts, ox, oy) { c.moveTo(pts[0][0] + ox, pts[0][1] + oy); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] + ox, pts[i][1] + oy); }

  function drawScribe(c, W, H, t) {
    const cx = W / 2, cy = H * 0.46;
    const R = Math.min(W, H);
    const dw = R * 0.16, dh = R * 0.42;
    // walk from bottom-center into the doorway over ~1.2s
    const p = ease(clamp(t / 1.3, 0, 1));
    const startY = H * 0.86, endY = cy;
    const y = startY + (endY - startY) * p;
    const x = cx;
    const scale = 1 - p * 0.6;
    const alpha = 1 - p * 0.9;
    const sh = R * 0.13 * scale;
    c.save(); c.globalAlpha = alpha;
    c.fillStyle = 'rgba(8,6,16,0.95)';
    // cloak silhouette
    c.beginPath();
    c.moveTo(x - sh * 0.7, y + sh); c.quadraticCurveTo(x - sh * 0.5, y - sh * 0.2, x - sh * 0.28, y - sh * 0.9);
    c.quadraticCurveTo(x, y - sh * 1.15, x + sh * 0.28, y - sh * 0.9);
    c.quadraticCurveTo(x + sh * 0.5, y - sh * 0.2, x + sh * 0.7, y + sh); c.closePath(); c.fill();
    // hooded head
    c.beginPath(); c.arc(x, y - sh * 0.85, sh * 0.32, 0, 6.2832); c.fill();
    // faint glyph glow at chest
    c.globalCompositeOperation = 'lighter';
    const gg = c.createRadialGradient(x, y - sh * 0.2, 0, x, y - sh * 0.2, sh * 0.5);
    gg.addColorStop(0, 'rgba(180,140,255,' + (0.6 * (1 - p)) + ')'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gg; c.beginPath(); c.arc(x, y - sh * 0.2, sh * 0.5, 0, 6.2832); c.fill();
    c.restore();
  }

  function drawVoidReveal(c, W, H, t) {
    const cx = W / 2, cy = H * 0.46;
    const R = Math.min(W, H);
    // perspective grid floor (Neon Void)
    c.save(); c.globalCompositeOperation = 'lighter';
    const horizon = H * 0.52, gridY = H * 0.95;
    c.strokeStyle = 'rgba(192,102,255,0.4)'; c.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      const fx = cx + i * R * 0.08;
      c.beginPath(); c.moveTo(cx + i * R * 0.02, horizon); c.lineTo(fx, gridY); c.stroke();
    }
    for (let j = 1; j <= 8; j++) {
      const u = j / 8, y = horizon + u * (gridY - horizon);
      const w = u * R * 0.5;
      c.globalAlpha = 0.15 + 0.25 * u; c.strokeStyle = 'rgba(192,102,255,0.5)';
      c.beginPath(); c.moveTo(cx - w, y); c.lineTo(cx + w, y); c.stroke();
    }
    c.globalAlpha = 1; c.restore();

    // five Warden silhouettes rising far below
    c.save();
    for (const w of wardenSil) {
      const rise = ease(clamp((t - 0.5) / 2, 0, 1));
      const x = cx + w.x * R, y = H * 0.78 - rise * H * 0.08 + Math.sin(t * 2 + w.ph) * 3;
      const sh = R * 0.06 * (0.6 + rise * 0.4);
      const rgb = hexToRGB(w.col);
      c.fillStyle = 'rgba(8,4,16,0.9)';
      c.beginPath(); c.moveTo(x - sh * 0.6, y + sh); c.lineTo(x, y - sh); c.lineTo(x + sh * 0.6, y + sh); c.closePath(); c.fill();
      c.globalCompositeOperation = 'lighter';
      const gg = c.createRadialGradient(x, y - sh * 0.3, 0, x, y - sh * 0.3, sh);
      gg.addColorStop(0, rgba(rgb, 0.7)); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(x, y - sh * 0.3, sh, 0, 6.2832); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();

    // the Hollow's giant eye opening overhead
    const open = ease(clamp((t - 0.8) / 2.5, 0, 1));
    eye.open = open;
    const ex = cx, ey = H * 0.22, ew = R * 0.28, eh = R * 0.13 * open;
    c.save();
    // outer cursed glow
    c.globalCompositeOperation = 'lighter';
    const og = c.createRadialGradient(ex, ey, 0, ex, ey, ew * 1.6);
    og.addColorStop(0, 'rgba(192,60,255,' + (0.4 * open) + ')'); og.addColorStop(0.5, 'rgba(120,30,200,0.15)'); og.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = og; c.beginPath(); c.arc(ex, ey, ew * 1.6, 0, 6.2832); c.fill();
    c.restore();
    // eye shape (almond) with iris + slit pupil
    c.save();
    c.fillStyle = 'rgba(8,2,16,0.95)';
    c.beginPath(); c.ellipse(ex, ey, ew, Math.max(2, eh), 0, 0, 6.2832); c.fill();
    if (open > 0.1) {
      const ir = Math.min(ew * 0.5, eh * 1.4);
      const ig = c.createRadialGradient(ex, ey, 0, ex, ey, ir);
      ig.addColorStop(0, 'rgba(255,80,200,0.95)'); ig.addColorStop(0.6, 'rgba(140,40,200,0.7)'); ig.addColorStop(1, 'rgba(40,10,60,0.3)');
      c.fillStyle = ig; c.beginPath(); c.arc(ex, ey, ir, 0, 6.2832); c.fill();
      // slit pupil
      c.fillStyle = 'rgba(0,0,0,0.95)';
      c.beginPath(); c.ellipse(ex, ey, ir * 0.18, ir * 0.85, 0, 0, 6.2832); c.fill();
      // specular
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.beginPath(); c.arc(ex - ir * 0.3, ey - ir * 0.3, ir * 0.12, 0, 6.2832); c.fill();
    }
    c.restore();
    // chromatic cracks radiating from the eye
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 6.2832 + t * 0.1, len = ew * (0.4 + 0.3 * Math.sin(t * 2 + i));
      const x2 = ex + Math.cos(a) * len, y2 = ey + Math.sin(a) * len;
      c.strokeStyle = 'rgba(255,40,80,0.4)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ex - 2, ey); c.lineTo(x2, y2); c.stroke();
      c.strokeStyle = 'rgba(40,200,255,0.4)'; c.beginPath(); c.moveTo(ex + 2, ey); c.lineTo(x2, y2); c.stroke();
    }
    c.restore();
  }

  function done() {
    if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
    const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
    const bt = document.getElementById('sdBarTop'), bb = document.getElementById('sdBarBot');
    if (bt) bt.style.height = '0px'; if (bb) bb.style.height = '0px';
    overlay.style.display = 'none'; if (typeof cb === 'function') cb();
  }

  window.SoulDoorway = { play };
})();
