// ============================================================
// Monster Arena — The Hollow Breaks Free (3D cinematic)
// Plays after every Warden in the Hollow Gauntlet has fallen.
// The shielded Hollow, looming high in the Neon Void sky, shatters
// its shield in a fantastic explosion of particles + sigils, then
// descends to the ground, floating, and speaks to the Scribe. Finally
// it demonstrates one of its real attacks (Void Pulse) before the
// 10-stage fight begins. Hijacks the live Render3D camera exactly like
// the gauntlet intro; combat stays frozen via window._GAUNTLET_INTRO,
// and the Hollow is ticked manually so it performs its attack on cue.
// Exposes window.HollowBreakFree.play({ onDone }).
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#e0c6ff';

  // ---- tiny mat4 helpers (same conventions as gl3d.js / gauntlet_intro) ----
  function lookAt(o, e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
    o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); o[15] = 1; return o;
  }
  function persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2); o.fill(0);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  }
  function mul(o, a, b) {
    const tr = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      tr[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    o.set(tr); return o;
  }
  function inv(o, m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!d) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; } d = 1 / d;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return o;
  }
  const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const ss = (f) => { f = Math.max(0, Math.min(1, f)); return f * f * (3 - 2 * f); };

  let overlay = null, lbTop = null, lbBot = null, subEl = null, skipBtn = null;
  let onDoneCb = null, startT = 0, finished = false, savedUpdate = null;
  let KFS = null, lastMs = 0, shattered = false;

  const LINES = [
    { from: 5.3, to: 7.0, text: 'So. My Wardens were not enough to still your hand.' },
    { from: 7.1, to: 9.0, text: 'I am the Hollow — the silence at the end of every song.' },
    { from: 9.3, to: 11.9, text: 'Witness the void, Scribe.' }
  ];

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #hbOverlay{position:fixed;inset:0;z-index:60;pointer-events:none;}
      #hbLbTop,#hbLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:60;
        opacity:0;transition:opacity .4s ease;}
      #hbLbTop{top:0;} #hbLbBot{bottom:0;}
      #hbOverlay.on #hbLbTop,#hbOverlay.on #hbLbBot{opacity:1;}
      #hbOverlay .hbSub{position:absolute;left:50%;bottom:13%;transform:translateX(-50%);
        font-size:clamp(15px,2.6vw,22px);letter-spacing:.14em;text-transform:uppercase;color:#f0e6ff;
        text-shadow:0 2px 14px rgba(0,0,0,.95),0 0 20px rgba(160,100,220,.55);opacity:0;transition:opacity .35s ease;
        text-align:center;max-width:86vw;line-height:1.5;}
      #hbOverlay .hbSub.show{opacity:.95;}
      #hbSkip{position:fixed;top:22px;right:26px;z-index:62;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(224,198,255,.3);background:rgba(8,4,16,.7);color:#e6d6f5;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #hbSkip:hover{background:rgba(34,18,52,.85);box-shadow:0 8px 24px rgba(160,100,220,.35);}`;
    document.head.appendChild(st);
    overlay = document.createElement('div'); overlay.id = 'hbOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'hbLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'hbLbBot';
    subEl = document.createElement('div'); subEl.className = 'hbSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(subEl);
    document.body.appendChild(overlay);
    skipBtn = document.createElement('button'); skipBtn.id = 'hbSkip'; skipBtn.textContent = 'Skip ▸';
    skipBtn.addEventListener('click', finish);
    document.body.appendChild(skipBtn);
  }
  function setSub(text) {
    if (!subEl) return;
    if (text) { subEl.textContent = text; subEl.classList.add('show'); } else subEl.classList.remove('show');
  }

  function hollowPos() { const G = window._Gauntlet, w = G.world; return { x: w.w / 2, y: w.h * 0.14 }; }
  function getHollow() { const G = window._Gauntlet; return G.enemies.find(function (e) { return e.type === 'hollow'; }); }

  function buildKeys() {
    const G = window._Gauntlet, P = G.player;
    const px = P.x, py = P.y, hp = hollowPos();
    const dx = px - hp.x, dy = py - hp.y, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl;
    const hEye = (dist, h) => [hp.x + ux * dist, h, hp.y + uy * dist];
    const kfs = [];
    const push = (t, eye, look, fov, tag) => kfs.push({ t, eye, look, fov, tag });
    // SHATTER — look up at the shielded Hollow high in the sky, then the shield bursts
    push(0.0, [px, 50, py], [hp.x, 420, hp.y], 0.60, 'shatter');
    push(2.0, [px, 60, py], [hp.x, 360, hp.y], 0.58, 'shatter');
    // DESCEND — the Hollow floats down to the ground; camera follows on the Hollow→player axis
    push(2.2, [px, 70, py], [hp.x, 300, hp.y], 0.60, 'descend');
    push(5.0, hEye(560, 110), [hp.x, 80, hp.y], 0.54, 'descend');
    // TALK — the Hollow looms low, facing the player, speaking
    push(5.2, hEye(600, 120), [hp.x, 70, hp.y], 0.52, 'talk');
    push(9.0, hEye(640, 130), [hp.x, 70, hp.y], 0.52, 'talk');
    // DEMO — pull back a little so the Void Pulse ring reads on screen
    push(9.2, hEye(720, 140), [hp.x, 80, hp.y], 0.56, 'demo');
    push(12.0, hEye(780, 150), [hp.x, 90, hp.y], 0.58, 'demo');
    // END — drop to the Scribe's eyes, first person, looking up at the Hollow
    push(12.2, [px, 52, py], [hp.x, 90, hp.y], 0.62, 'end');
    push(13.6, [px, 46, py], [hp.x, 90, hp.y], 0.60, 'end');
    return kfs;
  }

  function sample(t) {
    if (!KFS) return null;
    const n = KFS.length;
    if (t <= KFS[0].t) return KFS[0];
    if (t >= KFS[n - 1].t) return KFS[n - 1];
    let i = 0; while (i < n - 1 && KFS[i + 1].t <= t) i++;
    const a = KFS[i], b = KFS[i + 1];
    const f = ss((t - a.t) / (b.t - a.t || 1));
    return { eye: lerp3(a.eye, b.eye, f), look: lerp3(a.look, b.look, f), fov: a.fov + (b.fov - a.fov) * f, tag: b.tag, f };
  }

  // ---- the shield-shatter explosion: particles + sigil rings + light ----
  function bigShatter(e) {
    const R = window.Render3D; if (!R || !R.ok) return;
    const AC = R.hexRGB(ACCENT);
    const x = e.x, z = e.y, y = e._float ? e._float.base : 260;
    R.cameraKick = Math.max(R.cameraKick || 0, 0.95);
    if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(30);
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * 6.28, sp = 50 + Math.random() * 300, up = 90 + Math.random() * 240;
      R.emit({ x, y: y + Math.random() * 50, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, life: 1.5, age: 0, s0: 14, s1: 2, col: AC, a: 0.95, kind: 0, drag: 0.7 });
    }
    R.decal(x, z, 280, AC[0], AC[1], AC[2], 0.95, 12, 0, 0, true, 1.8);
    R.decal(x, z, 180, Math.min(1, AC[0] * 1.3), Math.min(1, AC[1] * 1.3), Math.min(1, AC[2] * 1.3), 0.9, 8, 0.7, 0, true, 2.0);
    R.glow(x, y, z, 380, AC[0], AC[1], AC[2], 0.98, 0);
    R.light(x, z, y, 460, AC[0], AC[1], AC[2], 1.0);
  }

  // ---- ambient floating sigils + motes around the grounded Hollow ----
  function tickAmbient(t, dt) {
    const R = window.Render3D; if (!R || !R.ok) return;
    const e = getHollow(); if (!e) return;
    const AC = R.hexRGB(ACCENT);
    const x = e.x, z = e.y, y = (e._float ? e._float.base : 60) + 20;
    R.decal(x, z, 150, AC[0], AC[1], AC[2], 0.5 + 0.15 * Math.sin(t * 2), 9, t * 0.5, 0, true, 1.4);
    if (Math.random() < 0.7) {
      const a = Math.random() * 6.28, dd = 30 + Math.random() * 160;
      R.emit({ x: x + Math.cos(a) * dd, y: 2 + Math.random() * 12, z: z + Math.sin(a) * dd, vx: Math.cos(a) * 12, vy: 18 + Math.random() * 30, vz: Math.sin(a) * 12, life: 1.4, age: 0, s0: 8, s1: 2, col: AC, a: 0.7, kind: 0, drag: 0.8 });
    }
  }

  function cinematicCamera(F) {
    const R = window.Render3D; if (!R || !R.ok) return;
    R.time = F.t;
    const t = (performance.now() - startT) / 1000;
    const s = sample(t); if (!s) return;
    R.eye[0] = s.eye[0]; R.eye[1] = s.eye[1]; R.eye[2] = s.eye[2];
    lookAt(R.view, R.eye, s.look, [0, 1, 0]);
    const asp = R.aspect || (R.cw && R.ch ? R.cw / R.ch : 1.6);
    persp(R.proj, s.fov, asp, 4, 9000);
    mul(R.vp, R.proj, R.view); inv(R.ivp, R.vp);
    R.focus = [s.look[0], s.look[2]];
    R.right = [R.view[0], R.view[4], R.view[8]]; R.up = [R.view[1], R.view[5], R.view[9]];

    const nowMs = performance.now();
    const fdt = Math.min(0.05, (nowMs - (lastMs || nowMs)) / 1000);
    lastMs = nowMs;

    const e = getHollow();
    const hp = hollowPos();
    if (e) {
      // altitude schedule: high while shielded → descend to a low float
      if (t < 2.0) { if (e._float) e._float.base = 300; e.absorbing = true; }
      else if (t < 5.0) { if (e._float) e._float.base = 300 + (60 - 300) * ((t - 2) / 3); }
      else { if (e._float) e._float.base = 60; }
      // shatter the shield once, just after the camera settles on the sky
      if (t >= 1.2 && !shattered) {
        shattered = true;
        if (e._hb) { e._hb.intro = 0; e._hb.cur = null; e._hb.idle = 0; }
        e.absorbing = false;
        bigShatter(e);
      }
      // pin the Hollow to its mark so the framing holds
      e.x = hp.x; e.y = hp.y;
      // DEMO: drive the real Hollow AI for one attack (damage is suppressed by
      // window._GAUNTLET_INTRO). Freeze its own movement so the sprite stays put.
      if (t >= 9.3 && t < 12.0) {
        if (e._hb) { e._hb.intro = 0; if (!e._hb.cur) e._hb.idle = 0; }
        const _sp = e.speed; e.speed = 0;
        try { if (window.HollowBoss) window.HollowBoss.tick(e, fdt); } catch (_) {}
        e.speed = _sp;
        e.x = hp.x; e.y = hp.y; e.vx = 0; e.vy = 0;
      } else if (t < 9.3) {
        if (e._hb) e._hb.cur = null;
      }
    }

    if (t >= 5.0) tickAmbient(t, fdt);

    // Stay in third-person TPS so the Hollow's upright billboard renders
    // correctly; drop to first person for the final Scribe-POV beat.
    const finalFP = s.tag === 'end';
    R.isTps = !finalFP;
    if (R.cam) {
      R.cam.fp = finalFP;
      const fdx = s.look[0] - s.eye[0], fdz = s.look[2] - s.eye[2];
      if (fdx * fdx + fdz * fdz > 1e-6) R.cam.tyaw = Math.atan2(fdz, fdx);
    }

    let line = '';
    for (const l of LINES) if (t >= l.from && t < l.to) { line = l.text; break; }
    setSub(line);

    if (t >= KFS[KFS.length - 1].t) finish();
  }

  function finish() {
    if (finished) return; finished = true;
    setSub('');
    if (overlay) overlay.classList.remove('on');
    // leave the Hollow grounded, shield down, ready for the fight
    const e = getHollow();
    if (e) {
      e.absorbing = false;
      if (e._float) e._float.base = 60;
      if (e._hb) { e._hb.intro = 0; e._hb.cur = null; e._hb.idle = 0.0; }
    }
    if (window.Render3D && savedUpdate) { try { window.Render3D.updateCamera = savedUpdate; } catch (_) {} savedUpdate = null; }
    setTimeout(function () {
      if (overlay) overlay.remove();
      if (skipBtn) skipBtn.remove();
      overlay = null; lbTop = null; lbBot = null; subEl = null; skipBtn = null;
    }, 250);
    window._GAUNTLET_INTRO = false;
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function play(opts) {
    opts = opts || {};
    ensureDOM();
    finished = false; onDoneCb = opts.onDone || function () {};
    shattered = false; lastMs = 0;
    window._GAUNTLET_INTRO = true;

    const G = window._Gauntlet;
    if (!G || !G.world || !G.player || !getHollow()) { finish(); return; }
    // stand the Scribe at the bottom-centre, matching the intro layout
    G.player.x = G.world.w * 0.5; G.player.y = G.world.h * 0.82;

    KFS = buildKeys();

    if (window.Render3D && window.Render3D.ok) {
      savedUpdate = window.Render3D.updateCamera;
      window.Render3D.updateCamera = cinematicCamera;
    }
    if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (_) {} }

    overlay.classList.add('on');
    startT = performance.now();
  }

  window.HollowBreakFree = { play };
})();
