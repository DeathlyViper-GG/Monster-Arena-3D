// ============================================================
// Monster Arena — OUTRO ENGINE (shared by the realm outros)
// Handles the overlay, typed dialogue, Skip/Continue, slow camera
// drift + push-in, cinematic grade (vignette, grain, letterbox),
// fade-in, and shared pre-rendered sprites (ember, smoke, mote).
// A realm supplies a scene: { id, accent, speaker, text, body,
//   init(W,H,S), backdrop(c,W,H), draw(c,W,H,t,S), shake? }
// Exposes OutroEngine.create(scene) -> { play(beats,{onDone}), done() }
// ============================================================
(function () {
  'use strict';

  function rnd() { return Math.random(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // ---- shared sprites, built once ----
  let sprites = null;
  function getSprites() {
    if (sprites) return sprites;
    function glow(size, stops) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
      stops.forEach(s => g.addColorStop(s[0], s[1]));
      x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
    }
    const smoke = document.createElement('canvas'); smoke.width = smoke.height = 128;
    let x = smoke.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const px = 64 + (rnd() - 0.5) * 50, py = 64 + (rnd() - 0.5) * 50, pr = 22 + rnd() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, pr);
      g.addColorStop(0, 'rgba(255,255,255,0.30)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    }
    const grain = document.createElement('canvas'); grain.width = grain.height = 160;
    x = grain.getContext('2d'); const id = x.createImageData(160, 160);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
    x.putImageData(id, 0, 0);
    sprites = {
      smoke, grain,
      white: glow(32, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.7)'], [0.6, 'rgba(255,255,255,0.18)'], [1, 'rgba(255,255,255,0)']]),
      soft: glow(64, [[0, 'rgba(255,255,255,0.9)'], [0.5, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']])
    };
    return sprites;
  }

  // tint a white sprite to a colour (cached per colour)
  const tintCache = {};
  function tinted(key, base, color) {
    const k = key + color;
    if (tintCache[k]) return tintCache[k];
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d'); x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return (tintCache[k] = c);
  }

  function create(scene) {
    const P = scene.id; // css prefix
    let overlay = null, canvas = null, ctx = null, raf = 0;
    let skipBtn, contBtn, speakerEl, bodyEl;
    let cur = null, elapsed = 0, bg = null, bgKey = '', S = null, grade = null, gradeKey = '', lastTs = 0;

    function ensure() {
      if (overlay) return;
      const a = scene.accent || '#fff';
      const style = document.createElement('style');
      style.textContent = `
        #ov${P}{position:fixed;inset:0;z-index:61;display:none;background:#020103;}
        #ov${P} canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
        #${P}Panel{position:absolute;left:0;right:0;bottom:0;padding:60px 44px 32px;z-index:4;
          background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(2,2,4,0.72) 45%,rgba(0,0,0,0.97) 100%);pointer-events:none;}
        #${P}Speaker{font-size:13px;letter-spacing:.3em;text-transform:uppercase;font-weight:800;margin-bottom:8px;
          color:${scene.speaker || a};text-shadow:0 0 14px ${a}88;}
        #${P}Body{font-size:clamp(18px,2.3vw,28px);line-height:1.5;color:${scene.text || '#eee'};
          text-shadow:0 2px 20px rgba(0,0,0,.98);max-width:960px;min-height:1.4em;}
        #${P}Body .caret{display:inline-block;width:.5ch;color:${a};animation:${P}Blink 1s steps(2) infinite;}
        @keyframes ${P}Blink{50%{opacity:0}}
        .${P}Btn{position:absolute;z-index:5;cursor:pointer;border:1px solid ${a}66;background:rgba(6,6,10,.75);
          color:#eee;padding:10px 18px;border-radius:6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;
          transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
        .${P}Btn:hover{transform:translateY(-1px);background:rgba(20,20,28,.92);box-shadow:0 8px 24px ${a}55;}
        #${P}Skip{top:30px;right:30px;} #${P}Cont{bottom:30px;right:40px;}
        #${P}Cont.ready{animation:${P}Pulse 1.4s ease-in-out infinite;}
        @keyframes ${P}Pulse{0%,100%{box-shadow:0 0 0 ${a}00}50%{box-shadow:0 0 26px ${a}88}}`;
      document.head.appendChild(style);
      overlay = document.createElement('div'); overlay.id = 'ov' + P;
      canvas = document.createElement('canvas'); overlay.appendChild(canvas);
      const panel = document.createElement('div'); panel.id = P + 'Panel';
      speakerEl = document.createElement('div'); speakerEl.id = P + 'Speaker';
      bodyEl = document.createElement('div'); bodyEl.id = P + 'Body';
      panel.appendChild(speakerEl); panel.appendChild(bodyEl); overlay.appendChild(panel);
      skipBtn = document.createElement('button'); skipBtn.className = P + 'Btn'; skipBtn.id = P + 'Skip'; skipBtn.textContent = 'Skip ▸';
      contBtn = document.createElement('button'); contBtn.className = P + 'Btn'; contBtn.id = P + 'Cont'; contBtn.textContent = 'Continue ▸';
      overlay.appendChild(skipBtn); overlay.appendChild(contBtn);
      document.body.appendChild(overlay);
      ctx = canvas.getContext('2d');
      skipBtn.addEventListener('click', done);
      contBtn.addEventListener('click', advance);
      overlay.addEventListener('click', (e) => { if (e.target === skipBtn || e.target === contBtn) return; advance(); });
      window.addEventListener('resize', resize);
    }

    function resize() {
      if (!canvas) return;
      const d = Math.min(1.25, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * d));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
      bgKey = ''; gradeKey = '';
    }

    function play(script, opts) {
      ensure(); opts = opts || {};
      cur = { beats: (script || []).slice(), onDone: opts.onDone || function () {}, idx: 0, char: 0, typing: true };
      S = { spr: getSprites(), tint: tinted, rnd, clamp, ease, st: {} };
      resize(); lastTs = 0; gradeKey = '';
      contBtn.classList.remove('ready'); contBtn.style.display = 'none';
      overlay.style.display = 'block'; elapsed = 0;
      scene.init(window.innerWidth, window.innerHeight, S);
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function beat() { return cur && cur.beats[cur.idx]; }
    function advance() {
      if (!cur) return;
      const b = beat(); if (!b) { done(); return; }
      if (cur.typing) { cur.typing = false; cur.char = (b.text || '').length; renderText(); showCont(); }
      else {
        cur.idx++; if (cur.idx >= cur.beats.length) { done(); return; }
        cur.char = 0; cur.typing = true; contBtn.classList.remove('ready'); contBtn.style.display = 'none';
      }
    }
    function showCont() { contBtn.style.display = 'block'; contBtn.classList.add('ready'); }
    function renderText() {
      const b = beat() || {}, text = b.text || '';
      speakerEl.textContent = b.who || '';
      bodyEl.innerHTML = (cur.typing ? text.slice(0, Math.floor(cur.char)) : text) + (cur.typing ? '<span class="caret">▋</span>' : '');
    }

    function loop(ts) {
      if (!cur) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
      const W = window.innerWidth, H = window.innerHeight, c = ctx;
      // real-time clock (capped) so slow frames don't slow the story down
      const dtReal = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60; lastTs = ts;
      elapsed += dtReal; const t = elapsed;
      const key = W + 'x' + H;
      if (key !== bgKey) {
        if (!bg) bg = document.createElement('canvas');
        bg.width = Math.max(1, Math.floor(W)); bg.height = Math.max(1, Math.floor(H));
        scene.backdrop(bg.getContext('2d'), W, H, S); bgKey = key;
      }
      const push = 1 + Math.min(0.06, t * 0.004);
      const sh = scene.shake ? scene.shake(t, S) : 0;
      const dx = Math.sin(t * 0.21) * W * 0.008 + (sh ? (rnd() - 0.5) * sh : 0);
      const dy = Math.cos(t * 0.17) * H * 0.006 + (sh ? (rnd() - 0.5) * sh : 0);
      c.save();
      c.translate(W / 2 + dx, H / 2 + dy); c.scale(push, push); c.translate(-W / 2, -H / 2);
      c.drawImage(bg, 0, 0, W, H);
      scene.draw(c, W, H, t, S);
      c.restore();

      // grade: cached vignette + grain overlay (one pre-rendered layer, one blit each)
      if (!grade || gradeKey !== key) {
        if (!grade) grade = document.createElement('canvas');
        grade.width = Math.max(1, Math.floor(W)); grade.height = Math.max(1, Math.floor(H));
        const gx = grade.getContext('2d');
        const v = gx.createRadialGradient(W / 2, H * 0.52, H * 0.18, W / 2, H * 0.52, H * 0.98);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.6, 'rgba(0,0,0,0.5)'); v.addColorStop(1, 'rgba(0,0,0,0.95)');
        gx.fillStyle = v; gx.fillRect(0, 0, W, H);
        gx.globalAlpha = 0.5; gx.fillStyle = gx.createPattern(S.spr.grain, 'repeat'); gx.fillRect(0, 0, W, H);
        gradeKey = key;
      }
      c.drawImage(grade, 0, 0, W, H);
      const bar = H * 0.075; c.fillStyle = '#000'; c.fillRect(0, 0, W, bar); c.fillRect(0, H - bar, W, bar);
      if (t < 1.6) { c.fillStyle = `rgba(0,0,0,${1 - ease(t / 1.6)})`; c.fillRect(0, 0, W, H); }

      if (cur.typing) {
        const b = beat(), full = (b && b.text) ? b.text.length : 0;
        cur.char += 1.6;
        if (cur.char >= full) { cur.char = full; cur.typing = false; renderText(); showCont(); }
        else renderText();
      }
    }

    function done() {
      if (!cur) { if (overlay) overlay.style.display = 'none'; return; }
      const cb = cur.onDone; cur = null; if (raf) cancelAnimationFrame(raf); raf = 0;
      overlay.style.display = 'none'; if (typeof cb === 'function') cb();
    }
    return { play, done };
  }

  window.OutroEngine = { create, ease, clamp };
})();
