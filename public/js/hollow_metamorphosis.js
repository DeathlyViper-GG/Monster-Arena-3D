// ============================================================
// Monster Arena — THE HOLLOW METAMORPHOSIS (3D world cutscene)
// Secret mid-fight transformation at half health: the Hollow
// devours its five soul-shards inside the live 3D world the
// player is standing in. This hijacks the Render3D camera (like
// the Gauntlet intro) and dollies around the Hollow while its
// own draw3D renders the body; we emit spiraling soul motes,
// fracture flashes and a white-out climax, then flip the Hollow
// to its metamorphosed form (the VOID EVOLUTION sprite). Combat
// stays frozen via window._GAUNTLET_INTRO (set by boss_hollow's
// tick before calling play). Only letterbox / dialogue / skip
// are DOM overlays. Exposes window.HollowMetamorphosis.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#b066ff';
  const COLS = ['#00ff40', '#ffcc00', '#00ccff', '#ff0000', '#8000ff'];

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
    const tt = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      tt[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    o.set(tt); return o;
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

  // ---- timed dialogue beats ----
  const BEATS = [
    { t: 0.4,  text: 'You would take them from me... the souls I hold.' },
    { t: 4.2,  text: 'No. They are MINE. I will devour them — and you with them.' },
    { t: 7.8,  text: 'FEAST.' },
    { t: 9.4,  text: 'FUEL. FORGE. TWIST.' },
    { t: 12.8, text: 'Behold what your theft has wrought.' }
  ];
  const DEVOUR_START = 7.6, MORPH_AT = 11.2, END_T = 16.0;

  let overlay = null, lbTop = null, lbBot = null, subEl = null, skipBtn = null, flashEl = null;
  let onDoneCb = null, startT = 0, finished = false, savedUpdate = null, lastMs = 0;
  let KFS = null, beatIdx = 0, morphed = false;

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #hmOverlay{position:fixed;inset:0;z-index:60;pointer-events:none;}
      #hmLbTop,#hmLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:60;opacity:0;transition:opacity .4s ease;}
      #hmLbTop{top:0;} #hmLbBot{bottom:0;}
      #hmOverlay.on #hmLbTop,#hmOverlay.on #hmLbBot{opacity:1;}
      #hmSub{position:fixed;left:50%;bottom:13%;transform:translateX(-50%);z-index:61;text-align:center;
        font-size:clamp(15px,2.6vw,24px);letter-spacing:.04em;color:#f0e6ff;max-width:84vw;
        text-shadow:0 2px 14px rgba(0,0,0,.95),0 0 22px rgba(176,102,255,.6);opacity:0;transition:opacity .3s ease;}
      #hmSub.show{opacity:.96;}
      #hmSub .who{display:block;font-size:clamp(11px,1.6vw,14px);letter-spacing:.22em;text-transform:uppercase;
        color:#c9a8ff;margin-bottom:6px;font-weight:700;}
      #hmFlash{position:fixed;inset:0;z-index:59;background:#fff;opacity:0;pointer-events:none;
        transition:opacity .08s linear;}
      #hmSkip{position:fixed;top:22px;right:26px;z-index:62;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(224,198,255,.3);background:rgba(8,4,16,.7);color:#e6d6f5;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #hmSkip:hover{background:rgba(34,18,52,.85);box-shadow:0 8px 24px rgba(160,100,220,.35);}`;
    document.head.appendChild(st);

    overlay = document.createElement('div'); overlay.id = 'hmOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'hmLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'hmLbBot';
    subEl = document.createElement('div'); subEl.id = 'hmSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(subEl);
    document.body.appendChild(overlay);

    flashEl = document.createElement('div'); flashEl.id = 'hmFlash'; document.body.appendChild(flashEl);

    skipBtn = document.createElement('button'); skipBtn.id = 'hmSkip'; skipBtn.textContent = 'Skip ▸';
    skipBtn.addEventListener('click', finish);
    document.body.appendChild(skipBtn);
  }

  function setSub(beat) {
    if (!subEl) return;
    if (!beat) { subEl.classList.remove('show'); return; }
    subEl.innerHTML = '<span class="who">The Hollow</span>' + beat.text;
    subEl.classList.add('show');
  }

  // ---- locate the live Hollow + its body centre height ----
  function getHollow() {
    const G = window._Gauntlet; if (!G || !G.enemies) return null;
    return G.enemies.find(function (e) { return e && e.type === 'hollow'; }) || null;
  }
  function hollowCentre(h) {
    const rr = h.r || 52;
    const fl = h._float || { base: 50, amp: 8 };
    const by = rr * 1.3 + fl.base;
    return { x: h.x, z: h.y, y: by };
  }

  // ---- cinematic keyframes: fixed-axis dolly (no orbit → no rotation) ----
  function buildKeys() {
    const h = getHollow(); if (!h) return null;
    const c = hollowCentre(h);
    // Pin the player on the camera side so the Hollow's `ang` (it faces the
    // player) points toward the lens — and never changes mid-cutscene.
    const G = window._Gauntlet;
    if (G && G.player) { G.player.x = c.x; G.player.y = c.z + 260; }
    const kfs = [];
    const push = (t, dist, height, fov) => kfs.push({
      t, eye: [c.x, height, c.z + dist], look: [c.x, c.y, c.z], fov
    });
    // Stable axis: camera stays on ONE side of the Hollow (south / +Z) and
    // only dollies in/out + changes height. cam.tyaw stays constant, so the
    // Hollow's billboard tilt never sweeps — it never "rotates". Matches the
    // Gauntlet intro, which frames each Warden on a fixed axis.
    push(0.0,  740, 210, 0.60);
    push(4.2,  660, 185, 0.58);
    push(7.8,  580, 170, 0.56);
    push(9.4,  500, 165, 0.55);
    push(11.2, 470, 165, 0.56);
    push(12.8, 840, 215, 0.62);
    push(16.0, 920, 225, 0.64);
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
    return { eye: lerp3(a.eye, b.eye, f), look: lerp3(a.look, b.look, f), fov: a.fov + (b.fov - a.fov) * f };
  }

  // ---- emit one soul mote spiraling inward toward the Hollow core ----
  function emitSoulMote(R, h, c, i, tt) {
    const ang = tt * 3 + i * (Math.PI * 2 / 5);
    const rad = 230;
    const mx = c.x + Math.cos(ang) * rad, mz = c.z + Math.sin(ang) * rad, my = c.y + (Math.random() - 0.5) * 50;
    // spiral inward
    const inAng = ang + Math.PI + 0.4;
    const sp = 220 + Math.random() * 80;
    R.emit({
      x: mx, y: my, z: mz,
      vx: Math.cos(inAng) * sp, vy: (c.y - my) * 1.2, vz: Math.sin(inAng) * sp,
      life: 1.1, age: 0, s0: 12, s1: 2, col: COLS[i], a: 0.95, kind: 0, drag: 0.85
    });
  }

  // ---- per-frame cinematic camera (installed as Render3D.updateCamera) ----
  function cinematicCamera(F) {
    const R = window.Render3D; if (!R || !R.ok) return;
    R.time = F.t;
    const t = (performance.now() - startT) / 1000;
    const s = sample(t);
    if (!s) return;
    R.eye[0] = s.eye[0]; R.eye[1] = s.eye[1]; R.eye[2] = s.eye[2];
    lookAt(R.view, R.eye, s.look, [0, 1, 0]);
    const asp = R.aspect || (R.cw && R.ch ? R.cw / R.ch : 1.6);
    persp(R.proj, s.fov, asp, 4, 9000);
    mul(R.vp, R.proj, R.view);
    inv(R.ivp, R.vp);
    R.focus = [s.look[0], s.look[2]];
    R.right = [R.view[0], R.view[4], R.view[8]];
    R.up = [R.view[1], R.view[5], R.view[9]];

    // stay in third-person so the Hollow's own draw3D uses its upright billboard
    R.isTps = true;
    if (R.cam) {
      R.cam.fp = false;
      const fdx = s.look[0] - s.eye[0], fdz = s.look[2] - s.eye[2];
      if (fdx * fdx + fdz * fdz > 1e-6) R.cam.tyaw = Math.atan2(fdz, fdx);
    }

    const h = getHollow();
    if (h) {
      const c = hollowCentre(h);
      // keep the player pinned on the camera side every frame so the Hollow's
      // facing angle never drifts (which would make the billboard turn)
      const Gp = window._Gauntlet;
      if (Gp && Gp.player) { Gp.player.x = c.x; Gp.player.y = c.z + 260; }
      const nowMs = performance.now();
      const dt = Math.min(0.05, (nowMs - (lastMs || nowMs)) / 1000);
      lastMs = nowMs;

      // DEVOUR: emit the five soul motes spiraling inward into the core
      if (t >= DEVOUR_START && t < MORPH_AT) {
        for (let i = 0; i < 5; i++) {
          if (Math.random() < 0.65) emitSoulMote(R, h, c, i, t);
        }
        // building shake + chromatic kick as the devour escalates
        const heat = (t - DEVOUR_START) / (MORPH_AT - DEVOUR_START);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.18 * heat);
        // a halo of void energy closing in around the body
        if (U_torus(R)) {
          const AC = R.hexRGB(ACCENT);
          R.draw(R.unit.torus, R.mm(c.x, c.y, c.z, t * 1.6, 200 * (1 - heat * 0.6), 6, 200 * (1 - heat * 0.6), 0.14),
            R.mat([1, 1, 1], { emissive: AC, emisK: 2.6, alpha: 0.6 * (1 - heat * 0.5), shadow: false, rim: 2.0, rimCol: AC }));
        }
      }

      // CLIMAX: white flash + flip the Hollow to its metamorphosed form
      if (t >= MORPH_AT && !morphed) {
        morphed = true;
        if (h._hb) h._hb.morphed = true;
        if (flashEl) { flashEl.style.opacity = '1'; setTimeout(() => { if (flashEl) flashEl.style.opacity = '0'; }, 120); }
        R.cameraKick = 0.9;
        // burst of soul + void particles outward from the core
        const AC = R.hexRGB(ACCENT);
        for (let i = 0; i < 60; i++) {
          const a = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 260;
          R.emit({ x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * sp, vy: (Math.random() - 0.3) * 160, vz: Math.sin(a) * sp,
            life: 1.3, age: 0, s0: 14, s1: 2, col: Math.random() < 0.5 ? AC : COLS[i % 5], a: 0.95, kind: 0, drag: 0.8 });
        }
        R.glow(c.x, c.y, c.z, 420, AC[0], AC[1], AC[2], 1.0, 0);
        if (R.cam) R.cam.shake = Math.max(R.cam.shake || 0, 18);
      }

      // REVEAL: gentle drift of void motes around the new form
      if (t >= MORPH_AT && t < END_T) {
        const AC = R.hexRGB(ACCENT);
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2, dd = 120 + Math.random() * 200;
          R.emit({ x: c.x + Math.cos(a) * dd, y: c.y + (Math.random() - 0.5) * 160, z: c.z + Math.sin(a) * dd,
            vx: -Math.cos(a) * 18, vy: 12 + Math.random() * 24, vz: -Math.sin(a) * 18,
            life: 1.6, age: 0, s0: 8, s1: 2, col: AC, a: 0.7, kind: 0, drag: 0.85 });
        }
        R.glow(c.x, c.y, c.z, 320, AC[0], AC[1], AC[2], 0.5 + 0.2 * Math.sin(t * 3), 0);
      }
    }

    // dialogue beats
    while (beatIdx < BEATS.length && t >= BEATS[beatIdx].t) { setSub(BEATS[beatIdx]); beatIdx++; }
    if (beatIdx >= BEATS.length && t > BEATS[BEATS.length - 1].t + 2.5) setSub(null);

    if (t >= END_T) finish();
  }

  function U_torus(R) { return R.unit && R.unit.torus && R.mm && R.mat; }

  function finish() {
    if (finished) return; finished = true;
    setSub(null);
    if (overlay) overlay.classList.remove('on');
    if (flashEl) flashEl.style.opacity = '0';
    // make sure the Hollow is left in its metamorphosed state even if we skipped
    const h = getHollow();
    if (h && h._hb) h._hb.morphed = true;
    // restore the real camera
    if (window.Render3D && savedUpdate) { try { window.Render3D.updateCamera = savedUpdate; } catch (_) {} savedUpdate = null; }
    setTimeout(() => {
      if (overlay) overlay.remove();
      if (skipBtn) skipBtn.remove();
      if (flashEl) flashEl.remove();
      overlay = null; lbTop = null; lbBot = null; subEl = null; skipBtn = null; flashEl = null;
    }, 300);
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function play(opts) {
    ensureDOM();
    finished = false; onDoneCb = (opts && opts.onDone) || function () {};
    beatIdx = 0; morphed = false; lastMs = 0;
    window._GAUNTLET_INTRO = true;

    const G = window._Gauntlet;
    if (!G || !G.world || !G.player || !getHollow()) { finish(); return; }

    KFS = buildKeys();
    if (!KFS) { finish(); return; }

    // take over the 3D camera
    if (window.Render3D && window.Render3D.ok) {
      savedUpdate = window.Render3D.updateCamera;
      window.Render3D.updateCamera = cinematicCamera;
    }
    if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (_) {} }

    overlay.classList.add('on');
    startT = performance.now();
  }

  // force-finish (called by hollow_gauntlet on restart / death / victory)
  function done() { if (!finished) finish(); }

  window.HollowMetamorphosis = { play, done };
})();
