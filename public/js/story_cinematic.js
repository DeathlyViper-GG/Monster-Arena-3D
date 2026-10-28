// ============================================================
// Monster Arena — Cinematic Cutscene Engine
// A shared video-like cutscene player: each lore beat cuts to a
// new shot with a cross-dissolve (and a dark dip), slow Ken-Burns
// camera drift, letterbox bars, and typed dialogue. Realm modules
// supply a static backdrop builder and a per-shot render function.
//
// Usage:
//   Cinematic.play({
//     prefix:'Meadow', accent:'#7dffa3',
//     beats:[{who,text},...], beatScenes:[0,1,2],
//     buildBackdrop(ctx,W,H), render(ctx,scene,W,H,t,env), onDone
//   });
// env = { cam(zoom,panX,panY), sceneT, bgCanvas, flash(v), shake(v) }
// render must ctx.save() (via env.cam) ... ctx.restore() around its shot.
// ============================================================
(function () {
  'use strict';
  const INST = {};
  function dpr() { return Math.min(1.25, window.devicePixelRatio || 1); }

  // Shared glow-sprite cache so realm cutscenes can render luminous particles,
  // eyes and halos without expensive shadowBlur / flat circles.
  const CG = (function () {
    const soft = document.createElement('canvas'); soft.width = soft.height = 128;
    { const x = soft.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
    const cache = {};
    function glow(col) { if (cache[col]) return cache[col]; const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const x = cv.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, col); g.addColorStop(0.4, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); cache[col] = cv; return cv; }
    return { soft, glow };
  })();

  function css(p, accent) {
    return `
#overlay${p}Cut{position:fixed;inset:0;z-index:61;display:none;background:#03060e;}
#overlay${p}Cut canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
#${p}LetterTop,#${p}LetterBot{position:absolute;left:0;right:0;height:0;z-index:3;background:#000;pointer-events:none;transition:height .55s cubic-bezier(.4,0,.2,1);}
#${p}LetterTop{top:0;}#${p}LetterBot{bottom:0;}
#overlay${p}Cut.cinematic #${p}LetterTop,#overlay${p}Cut.cinematic #${p}LetterBot{height:9vh;}
#${p}Panel{position:absolute;left:0;right:0;bottom:0;padding:30px 44px 32px;z-index:4;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(6,14,26,.72) 38%,rgba(2,5,12,.97) 100%);pointer-events:none;}
#${p}Speaker{font-size:14px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;margin-bottom:8px;color:${accent};text-shadow:0 0 16px ${accent}b3;}
#${p}Body{font-size:clamp(18px,2.4vw,30px);line-height:1.45;color:#eaf6ff;text-shadow:0 2px 20px rgba(0,0,0,.95);max-width:980px;min-height:1.4em;}
#${p}Body .caret{display:inline-block;width:.5ch;color:${accent};animation:${p}Blink 1s steps(2) infinite;}
@keyframes ${p}Blink{50%{opacity:0}}
.${p}Btn{position:absolute;z-index:5;cursor:pointer;border:1px solid ${accent}66;background:rgba(8,16,30,.7);color:#dff2ff;padding:10px 18px;border-radius:10px;font-size:14px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;transition:transform .12s ease,box-shadow .12s ease,background .12s ease;}
.${p}Btn:hover{transform:translateY(-1px);background:rgba(18,36,60,.85);box-shadow:0 8px 24px ${accent}59;}
#${p}Skip{top:30px;right:30px;}
#${p}Continue{bottom:30px;right:40px;}
#${p}Continue.ready{animation:${p}Pulse 1.3s ease-in-out infinite;}
@keyframes ${p}Pulse{0%,100%{box-shadow:0 0 0 ${accent}00}50%{box-shadow:0 0 30px ${accent}80}}`;
  }

  function ensure(cfg) {
    const p = cfg.prefix;
    if (INST[p] && INST[p].overlay) return INST[p];
    const inst = { cfg, overlay: null, canvas: null, ctx: null, raf: 0,
      skipBtn: null, contBtn: null, speakerEl: null, bodyEl: null,
      bgCanvas: null, bgCtx: null, bgKey: '', cur: null, shake: 0, flash: 0 };
    INST[p] = inst;

    const style = document.createElement('style');
    style.textContent = css(p, cfg.accent);
    document.head.appendChild(style);

    const ov = document.createElement('div');
    ov.id = 'overlay' + p + 'Cut';
    const canvas = document.createElement('canvas');
    ov.appendChild(canvas);
    const lt = document.createElement('div'); lt.id = p + 'LetterTop';
    const lb = document.createElement('div'); lb.id = p + 'LetterBot';
    ov.appendChild(lt); ov.appendChild(lb);
    const panel = document.createElement('div'); panel.id = p + 'Panel';
    const sp = document.createElement('div'); sp.id = p + 'Speaker';
    const bd = document.createElement('div'); bd.id = p + 'Body';
    panel.appendChild(sp); panel.appendChild(bd); ov.appendChild(panel);
    const skip = document.createElement('button'); skip.className = p + 'Btn'; skip.id = p + 'Skip'; skip.textContent = 'Skip ▸';
    const cont = document.createElement('button'); cont.className = p + 'Btn'; cont.id = p + 'Continue'; cont.textContent = 'Continue ▸';
    ov.appendChild(skip); ov.appendChild(cont);
    document.body.appendChild(ov);

    inst.overlay = ov; inst.canvas = canvas; inst.ctx = canvas.getContext('2d');
    inst.skipBtn = skip; inst.contBtn = cont; inst.speakerEl = sp; inst.bodyEl = bd;

    skip.addEventListener('click', () => done(p));
    cont.addEventListener('click', () => advance(p));
    ov.addEventListener('click', (e) => { if (e.target === skip || e.target === cont) return; advance(p); });
    window.addEventListener('resize', () => resize(p));
    return inst;
  }

  function resize(p) {
    const inst = INST[p]; if (!inst || !inst.canvas) return;
    const d = dpr();
    inst.canvas.width = Math.floor(window.innerWidth * d);
    inst.canvas.height = Math.floor(window.innerHeight * d);
    inst.ctx.setTransform(d, 0, 0, d, 0, 0);
    inst.bgKey = '';
  }

  function play(config) {
    const inst = ensure(config);
    const bs = config.beatScenes || [0, 1, 2];
    inst.cur = {
      beats: (config.beats || []).slice(),
      onDone: config.onDone || function () {},
      beatScenes: bs, idx: 0, char: 0, typing: true, waiting: false,
      scene: bs[0], prevScene: bs[0], trans: 1, sceneT: 0, lastTs: 0
    };
    resize(config.prefix);
    inst.contBtn.classList.remove('ready'); inst.contBtn.style.display = 'none';
    inst.overlay.style.display = 'block';
    inst.overlay.classList.add('cinematic');
    inst.flash = 0.4; inst.shake = 0;
    if (!inst.raf) inst.raf = requestAnimationFrame((ts) => loop(config.prefix, ts));
  }

  function curBeat(p) { const inst = INST[p]; return inst.cur && inst.cur.beats[inst.cur.idx]; }
  function targetScene(p, idx) { const inst = INST[p]; return inst.cur.beatScenes[Math.min(idx, inst.cur.beatScenes.length - 1)]; }

  function advance(p) {
    const inst = INST[p]; if (!inst || !inst.cur) return;
    const b = curBeat(p);
    if (!b) { done(p); return; }
    if (inst.cur.typing) {
      inst.cur.typing = false; inst.cur.char = (b.text || '').length; renderText(p); showContinue(p);
    } else {
      inst.cur.idx++;
      if (inst.cur.idx >= inst.cur.beats.length) { done(p); return; }
      const next = targetScene(p, inst.cur.idx);
      if (next !== inst.cur.scene) {
        inst.cur.prevScene = inst.cur.scene; inst.cur.scene = next; inst.cur.trans = 0; inst.cur.sceneT = 0;
        inst.flash = 0.35; inst.shake = 5;
      }
      inst.cur.char = 0; inst.cur.typing = true; inst.cur.waiting = false;
      inst.contBtn.classList.remove('ready'); inst.contBtn.style.display = 'none';
    }
  }

  function showContinue(p) { const inst = INST[p]; inst.cur.waiting = true; inst.contBtn.style.display = 'block'; inst.contBtn.classList.add('ready'); }
  function renderText(p) {
    const inst = INST[p]; const b = curBeat(p) || {};
    inst.speakerEl.textContent = b.who || '';
    const text = b.text || '';
    const shown = inst.cur.typing ? text.slice(0, Math.floor(inst.cur.char)) : text;
    inst.bodyEl.innerHTML = shown + (inst.cur.typing ? '<span class="caret">▋</span>' : '');
  }

  function loop(p, ts) {
    const inst = INST[p]; if (!inst || !inst.cur) { inst.raf = 0; return; }
    inst.raf = requestAnimationFrame((t) => loop(p, t));
    const W = window.innerWidth, H = window.innerHeight;
    const dt = inst.cur.lastTs ? Math.min(0.05, (ts - inst.cur.lastTs) / 1000) : 0.016;
    inst.cur.lastTs = ts; inst.cur.sceneT += dt;
    if (inst.cur.trans < 1) inst.cur.trans = Math.min(1, inst.cur.trans + dt / 0.8);
    const t = (ts || 0) / 1000;
    const key = W + 'x' + H;
    if (key !== inst.bgKey) {
      if (!inst.bgCanvas) { inst.bgCanvas = document.createElement('canvas'); inst.bgCtx = inst.bgCanvas.getContext('2d'); }
      inst.bgCanvas.width = Math.max(1, Math.floor(W)); inst.bgCanvas.height = Math.max(1, Math.floor(H));
      inst.cfg.buildBackdrop(inst.bgCtx, W, H); inst.bgKey = key;
    }

    const ctx = inst.ctx;
    let ox = 0, oy = 0;
    if (inst.shake > 0) { ox = (Math.random() - 0.5) * inst.shake; oy = (Math.random() - 0.5) * inst.shake; inst.shake = Math.max(0, inst.shake - 0.5); }
    ctx.save(); ctx.translate(ox, oy);

    const env = {
      cam: (zoom, panX, panY) => { ctx.save(); ctx.translate(W / 2 + (panX || 0), H / 2 + (panY || 0)); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2); },
      sceneT: inst.cur.sceneT, bgCanvas: inst.bgCanvas,
      flash: (v) => { inst.flash = Math.max(inst.flash, v); },
      shake: (v) => { inst.shake = Math.max(inst.shake, v); },
      grain: (amount) => {
        if (!inst.noisePat) {
          const nc = document.createElement('canvas'); nc.width = 128; nc.height = 128;
          const nctx = nc.getContext('2d'); const id = nctx.createImageData(128, 128);
          for (let i = 0; i < id.data.length; i += 4) { const v = (Math.random() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
          nctx.putImageData(id, 0, 0); inst.noisePat = ctx.createPattern(nc, 'repeat');
        }
        ctx.save(); ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
        ctx.translate((Math.random() * 8) | 0, (Math.random() * 8) | 0);
        ctx.fillStyle = inst.noisePat; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.restore();
      },
      grade: (color, alpha, mode) => {
        ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode || 'soft-light';
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, color); g.addColorStop(1, color);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    };

    if (inst.cur.trans < 1 && inst.cur.prevScene !== inst.cur.scene) {
      ctx.save(); ctx.globalAlpha = 1 - inst.cur.trans; inst.cfg.render(ctx, inst.cur.prevScene, W, H, t, env); ctx.restore();
      ctx.save(); ctx.globalAlpha = inst.cur.trans; inst.cfg.render(ctx, inst.cur.scene, W, H, t, env); ctx.restore();
      const dip = Math.sin(inst.cur.trans * Math.PI);
      ctx.fillStyle = 'rgba(3,6,14,' + (0.55 * dip) + ')';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.save(); ctx.globalAlpha = 1; inst.cfg.render(ctx, inst.cur.scene, W, H, t, env); ctx.restore();
    }

    if (inst.cur.typing) {
      const b = curBeat(p);
      const full = (b && b.text) ? b.text.length : 0;
      const wasZero = inst.cur.char === 0;
      inst.cur.char += 1.6;
      if (wasZero) { inst.flash = Math.max(inst.flash, 0.35); inst.shake = Math.max(inst.shake, 5); }
      if (inst.cur.char >= full) { inst.cur.char = full; inst.cur.typing = false; renderText(p); showContinue(p); }
      else renderText(p);
    }

    if (inst.cfg.post) inst.cfg.post(ctx, W, H, t, env);

    if (inst.flash > 0) {
      ctx.fillStyle = 'rgba(200,230,255,' + (inst.flash * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
      inst.flash = Math.max(0, inst.flash - 0.05);
    }
    ctx.restore();
  }

  function done(p) {
    const inst = INST[p]; if (!inst) return;
    if (!inst.cur) { if (inst.overlay) inst.overlay.style.display = 'none'; return; }
    const cb = inst.cur.onDone;
    inst.cur = null;
    if (inst.raf) cancelAnimationFrame(inst.raf); inst.raf = 0;
    inst.overlay.classList.remove('cinematic');
    inst.overlay.style.display = 'none';
    if (typeof cb === 'function') cb();
  }

  window.CG = CG;
  window.Cinematic = {
    play,
    done: () => { for (const p in INST) if (INST[p].cur) done(p); }
  };
})();
