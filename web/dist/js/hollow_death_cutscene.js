// ============================================================
// Monster Arena — THE HOLLOW'S BANISHMENT (3D heroic death cinematic)
// Plays the moment the Hollow falls in the Gauntlet. A true in-world
// 3D sequence: the destabilising Hollow is struck by a pillar of light,
// shatters into thousands of luminous soul shards that spiral upward,
// god-rays & shockwaves roll across the Neon Void floor, then the
// camera swings down to frame the Scribe standing victorious under a
// golden halo as a radiant doorway opens overhead — building to a
// heroic white-gold fade. Hijacks the live Render3D camera exactly like
// hollow_breakfree.js / gauntlet_intro.js; the player is frozen via
// window._GAUNTLET_INTRO. Pure VFX at the Hollow's last recorded
// position (the boss entity is already gone from the world by the time
// this fires). Exposes window.HollowDeath.play({ x, y, onDone }).
// ============================================================
(function () {
  'use strict';

  // ---- tiny mat4 helpers (same conventions as gl3d.js / hollow_breakfree) ----
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

  // heroic palette
  const WHITE = [1, 1, 1], GOLD = [1, 0.84, 0.42], SOUL = [0.86, 0.76, 1], RADIANT = [1, 0.93, 0.72];

  let overlay = null, lbTop = null, lbBot = null, subEl = null, skipBtn = null, whiteout = null;
  let onDoneCb = null, startT = 0, finished = false, savedUpdate = null, savedCollect = null, savedHelpDisplay = null;
  let KFS = null, lastMs = 0;
  let banished = false, revealed = false;
  let lastSpiral = 0, lastRing = 0, lastBless = 0;
  let hx = 0, hz = 0, px = 0, pz = 0, ux = 0, uz = 0;
  const BODY_H = 60; // where the Hollow's body floated

  const LINES = [
    { from: 0.0, to: 2.3, text: 'The Hollow gathers what remains of itself.' },
    { from: 2.4, to: 3.1, text: 'Begone.' },
    { from: 3.3, to: 7.0, text: 'The silence shatters. Your soul breaks free.' },
    { from: 7.2, to: 11.0, text: 'Rise, Last Scribe. It is finished.' },
    { from: 11.1, to: 14.0, text: 'The doorway home opens.' }
  ];

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #hdOverlay{position:fixed;inset:0;z-index:64;pointer-events:none;}
      #hdLbTop,#hdLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:64;
        opacity:0;transition:opacity .4s ease;}
      #hdLbTop{top:0;} #hdLbBot{bottom:0;}
      #hdOverlay.on #hdLbTop,#hdOverlay.on #hdLbBot{opacity:1;}
      #hdOverlay .hdSub{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);
        font-size:clamp(16px,2.7vw,24px);letter-spacing:.14em;text-transform:uppercase;color:#fff7e6;
        text-shadow:0 2px 16px rgba(0,0,0,.95),0 0 26px rgba(255,200,110,.6);opacity:0;transition:opacity .35s ease;
        text-align:center;max-width:80vw;line-height:1.5;font-weight:600;padding:10px 22px;border-radius:12px;
        background:linear-gradient(180deg,rgba(10,8,4,.86),rgba(6,5,2,.78));
        border:1px solid rgba(255,200,110,.28);box-shadow:0 10px 30px rgba(0,0,0,.55);}
      #hdOverlay .hdSub.show{opacity:.97;}
      #hdWhiteout{position:fixed;inset:0;z-index:65;pointer-events:none;opacity:0;
        background:radial-gradient(circle at 50% 42%, rgba(255,252,240,1) 0%, rgba(255,224,170,.96) 45%, rgba(210,170,255,.7) 100%);
        transition:opacity .12s linear;}
      #hdSkip{position:fixed;top:22px;right:26px;z-index:66;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(255,220,150,.35);background:rgba(16,10,4,.7);color:#ffe9c4;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #hdSkip:hover{background:rgba(40,28,12,.85);box-shadow:0 8px 24px rgba(255,190,90,.4);}`;
    document.head.appendChild(st);
    overlay = document.createElement('div'); overlay.id = 'hdOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'hdLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'hdLbBot';
    subEl = document.createElement('div'); subEl.className = 'hdSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(subEl);
    document.body.appendChild(overlay);
    whiteout = document.createElement('div'); whiteout.id = 'hdWhiteout';
    document.body.appendChild(whiteout);
    skipBtn = document.createElement('button'); skipBtn.id = 'hdSkip'; skipBtn.textContent = 'Skip ▸';
    skipBtn.addEventListener('click', finish);
    document.body.appendChild(skipBtn);
  }
  function setSub(text) {
    if (!subEl) return;
    if (text) { subEl.textContent = text; subEl.classList.add('show'); } else subEl.classList.remove('show');
  }

  function buildKeys() {
    const kfs = [];
    const push = (t, eye, look, fov) => kfs.push({ t, eye, look, fov });
    // DESTABILIZE — low hero angle looking up at the looming Hollow
    push(0.0, [hx - ux * 420, 34, hz - uz * 420], [hx, BODY_H + 20, hz], 0.60);
    push(2.3, [hx - ux * 280, 52, hz - uz * 280], [hx, BODY_H, hz], 0.52);
    // BANISH — snap back to catch the pillar of light
    push(2.5, [hx - ux * 640, 130, hz - uz * 640], [hx, BODY_H, hz], 0.62);
    push(3.3, [hx + 420, 280, hz - 620], [hx, 150, hz], 0.64);
    // ASCEND — orbit the rising spiral of soul shards
    push(5.4, [hx + 560, 230, hz - 360], [hx, 240, hz], 0.60);
    push(7.0, [hx - 360, 200, hz + 520], [hx, 200, hz], 0.60);
    // REVEAL — swing down to the Scribe, heroic low angle, radiant sky behind
    push(7.4, [px - ux * 340, 38, pz - uz * 340], [px, 55, pz], 0.54);
    push(9.6, [px - ux * 240, 46, pz - uz * 240], [px, 70, pz], 0.50);
    // DOORWAY — slow push in & tilt up to the light opening overhead
    push(11.0, [px - ux * 190, 58, pz - uz * 190], [px, 140, pz], 0.48);
    push(13.5, [px - ux * 150, 74, pz - uz * 150], [px, 240, pz], 0.46);
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
    return { eye: lerp3(a.eye, b.eye, f), look: lerp3(a.look, b.look, f), fov: a.fov + (b.fov - a.fov) * f, f };
  }

  // ---- particle-only beats (glow/decal/light are wiped when run from
  //      updateCamera, so all visible world drawing happens in
  //      drawCutsceneVFX via the R.collect hook below) ----
  function banish() {
    const R = window.Render3D; if (!R || !R.ok) return;
    R.cameraKick = Math.max(R.cameraKick || 0, 1.5);
    if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(46);
    // shatter — shards explode outward + up
    for (let i = 0; i < 320; i++) {
      const a = Math.random() * 6.28, sp = 140 + Math.random() * 520, up = 180 + Math.random() * 520;
      const col = Math.random() < 0.5 ? RADIANT : SOUL;
      R.emit({ x: hx, y: BODY_H + Math.random() * 50, z: hz, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, life: 1.7 + Math.random() * 0.9, age: 0, s0: 18, s1: 2, col, a: 0.96, kind: 0, drag: 0.72 });
    }
    // rising soul column
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * 6.28, r = 10 + Math.random() * 80;
      R.emit({ x: hx + Math.cos(a) * r, y: BODY_H, z: hz + Math.sin(a) * r, vx: Math.cos(a) * 22, vy: 320 + Math.random() * 280, vz: Math.sin(a) * 22, life: 2.6, age: 0, s0: 12, s1: 2, col: RADIANT, a: 0.9, kind: 0, drag: 0.92 });
    }
  }

  function ascendAmbient(t) {
    const R = window.Render3D; if (!R || !R.ok) return;
    if (t - lastSpiral > 0.12) {
      lastSpiral = t;
      const ang = t * 2.2;
      for (let i = 0; i < 26; i++) {
        const a = ang + (i / 26) * 6.28, r = 40 + 80 * Math.sin(t * 1.3) + i * 3;
        R.emit({ x: hx + Math.cos(a) * r, y: BODY_H + 20 + Math.random() * 40, z: hz + Math.sin(a) * r, vx: Math.cos(a + 1.57) * 30, vy: 220 + Math.random() * 160, vz: Math.sin(a + 1.57) * 30, life: 2.2, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? RADIANT : SOUL, a: 0.85, kind: 0, drag: 0.9 });
      }
    }
  }

  function reveal() {
    const R = window.Render3D; if (!R || !R.ok) return;
    if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(10);
    for (let i = 0; i < 140; i++) {
      const a = Math.random() * 6.28, r = 20 + Math.random() * 240, h = 220 + Math.random() * 220;
      R.emit({ x: px + Math.cos(a) * r, y: h, z: pz + Math.sin(a) * r, vx: Math.cos(a) * 8, vy: -60 - Math.random() * 80, vz: Math.sin(a) * 8, life: 2.6, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? RADIANT : WHITE, a: 0.85, kind: 0, drag: 0.96 });
    }
  }

  function blessingAmbient(t) {
    const R = window.Render3D; if (!R || !R.ok) return;
    if (t - lastBless > 0.07) {
      lastBless = t;
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, r = 20 + Math.random() * 240, h = 260 + Math.random() * 220;
        R.emit({ x: px + Math.cos(a) * r, y: h, z: pz + Math.sin(a) * r, vx: (Math.random() - 0.5) * 10, vy: -50 - Math.random() * 70, vz: (Math.random() - 0.5) * 10, life: 2.8, age: 0, s0: 8, s1: 2, col: Math.random() < 0.5 ? RADIANT : GOLD, a: 0.8, kind: 0, drag: 0.97 });
      }
    }
  }

  // ---- All visible world-space drawing. Runs from the R.collect hook so
  //      it executes AFTER the per-frame clear and actually reaches the
  //      screen (glow/decal/light/draw called from updateCamera are wiped).
  function drawCutsceneVFX() {
    const R = window.Render3D; if (!R || !R.ok || !KFS) return;
    const t = (performance.now() - startT) / 1000;
    const U = R.unit, mm = R.mm, mat = R.mat;

    // --- THE HOLLOW: a looming void figure that shatters away ---
    const bodyFade = t < 2.5 ? 1 : Math.max(0, 1 - (t - 2.5) / 1.4);
    if (bodyFade > 0.01) {
      const breathe = 1 + 0.06 * Math.sin(t * 4);
      const scl = (t < 2.5 ? 1 : 1 + (t - 2.5) * 0.5) * breathe;
      const a = bodyFade;
      R.draw(U.sphere, mm(hx, BODY_H, hz, t * 0.3, 58 * scl, 70 * scl, 58 * scl), mat([0.04, 0.02, 0.1], { emissive: [0.3, 0.1, 0.5], rim: 2.2, rimCol: [0.7, 0.3, 1.5], alpha: a, shadow: false }));
      R.draw(U.torus, mm(hx, BODY_H + 34, hz, t * 0.8, 84 * scl, 10 * scl, 84 * scl, 0.3), mat([0.6, 0.3, 1.2], { emissive: [1.0, 0.5, 1.8], shadow: false, alpha: a }));
      for (const s of [-1, 1]) {
        R.draw(U.sphereLo, mm(hx + s * 16, BODY_H + 8, hz - 40, 0, 5, 5, 5), mat([1, 0.3, 0.4], { emissive: [2, 0.4, 0.5], shadow: false }));
        R.glow(hx + s * 16, BODY_H + 8, hz - 40, 14, 1.4, 0.3, 0.4, 0.9 * a, 0);
      }
      R.glow(hx, BODY_H, hz, 240, 0.7, 0.3, 1.5, 0.6 * a, 0);
      R.light(hx, hz, BODY_H, 900, 0.7, 0.3, 1.4, 0.9 * a);
      R.decal(hx, hz, 260, 0.5, 0.2, 0.9, 0.5 * a, 9, t * 0.5, 0, true, 1.6);
    }

    // --- BANISHMENT STRIKE: pillar of light + expanding shockwave ---
    if (t > 2.3 && t < 3.8) {
      const f = Math.max(0, 1 - Math.abs(t - 2.6) / 1.0);
      R.glow(hx, BODY_H, hz, 600, 1, 1, 1, 0.95 * f, 0);
      R.glow(hx, BODY_H + 200, hz, 820, 1, 0.84, 0.42, 0.8 * f, 0);
      R.light(hx, hz, BODY_H, 1400, 1, 0.9, 0.7, 1.0 * f);
      const k = Math.min(1, (t - 2.3) / 1.4);
      R.decal(hx, hz, 120 + k * 900, 1, 0.84, 0.42, 0.9 * (1 - k), 16, t * 0.4, 0, true, 2.2);
      R.decal(hx, hz, 80 + k * 700, 1, 1, 1, 0.8 * (1 - k), 12, 0.6, 0, true, 2.0);
    }

    // --- SOUL STREAM: souls flow from the shattered Hollow INTO the Scribe ---
    if (t > 2.6 && t < 7.4) {
      const f = Math.min(1, (t - 2.6) / 1.0) * Math.max(0, 1 - (t - 6.0) / 1.4);
      if (f > 0.01) {
        const segs = 18, pts = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          const x = hx + (px - hx) * u, z = hz + (pz - hz) * u;
          const y = BODY_H + (50 - BODY_H) * u + Math.sin(t * 6 + u * 9) * 8 * u * (1 - u);
          pts.push(x, y, z);
        }
        if (R.rib) R.rib.line(pts, 16, 7, 0.86, 0.76, 1, 0.9 * f);
        for (let i = 0; i < 12; i++) {
          const u = (i / 12 + (t * 0.5)) % 1;
          const x = hx + (px - hx) * u, z = hz + (pz - hz) * u;
          const y = BODY_H + (50 - BODY_H) * u + Math.sin(t * 6 + i) * 5;
          R.glow(x, y, z, 13, 0.9, 0.8, 1, 0.95 * f, 0);
        }
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 6.28, r = Math.random() * 30;
          R.emit({ x: hx + Math.cos(a) * r, y: BODY_H + Math.random() * 40, z: hz + Math.sin(a) * r, vx: (px - hx) * 0.5 + (Math.random() - 0.5) * 20, vy: (50 - BODY_H) * 0.5, vz: (pz - hz) * 0.5 + (Math.random() - 0.5) * 20, life: 1.2, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? RADIANT : SOUL, a: 0.9 * f, kind: 0, drag: 0.4 });
        }
      }
    }

    // --- ascending soul glow + rolling floor rings ---
    if (t > 2.6 && t < 7.4) {
      const lift = Math.min(1, (t - 2.6) / 4.5), fade = Math.max(0, 1 - lift);
      R.glow(hx, BODY_H + 120 + lift * 260, hz, 420, RADIANT[0], RADIANT[1], RADIANT[2], 0.7 * fade, 0);
      const k = (t - 2.6) % 1.6 / 1.6;
      R.decal(hx, hz, 120 + k * 900, GOLD[0], GOLD[1], GOLD[2], 0.5 * (1 - k), 18, t * 0.4, 0, true, 1.6);
    }

    // --- SCRIBE REVEAL: golden halo over the player ---
    if (t > 7.0) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 2.2);
      R.glow(px, 60, pz, 380, GOLD[0], GOLD[1], GOLD[2], 0.9 * pulse, 0);
      R.glow(px, 100, pz, 560, RADIANT[0], RADIANT[1], RADIANT[2], 0.6, 0);
      R.light(px, pz, 80, 700, 1, 0.86, 0.6, 0.9);
      R.decal(px, pz, 300, GOLD[0], GOLD[1], GOLD[2], 0.8, 18, t * 0.3, 0, true, 2.0);
    }

    // --- THE DOORWAY: a radiant arch that opens over the Scribe ---
    if (t > 8.0) {
      const grow = Math.min(1, (t - 8.0) / 4.0);
      const dh = 240 * grow, dw = 100 * grow;
      const frameMat = mat([1, 0.9, 0.6], { emissive: [1.4, 1.1, 0.5], shadow: false, metal: 0.6, rough: 0.2 });
      R.draw(U.box, mm(px - dw / 2, dh / 2, pz, 0, 12, dh, 12), frameMat);
      R.draw(U.box, mm(px + dw / 2, dh / 2, pz, 0, 12, dh, 12), frameMat);
      R.draw(U.box, mm(px, dh, pz, 0, dw + 14, 14, 12), frameMat);
      R.glow(px, dh / 2, pz, 240 * grow, 1, 1, 1, 0.9 * grow, 0);
      R.glow(px, dh / 2, pz, 340 * grow, RADIANT[0], RADIANT[1], RADIANT[2], 0.7 * grow, 0);
      R.draw(U.box, mm(px, dh / 2, pz, 0, Math.max(2, dw - 16), Math.max(2, dh - 16), 4), mat([1, 0.95, 0.8], { emissive: [2.2, 1.9, 1.3], shadow: false, alpha: 0.85 * grow }));
      R.draw(U.cyl, mm(px, dh + 200, pz, 0, 20, 420, 20), mat([1, 0.9, 0.7], { emissive: [1.8, 1.4, 0.8], alpha: 0.5 * grow, shadow: false }));
      R.light(px, pz, dh, 1200, 1, 0.9, 0.7, 1.0 * grow);
      R.decal(px, pz, 180 * grow, 1, 0.9, 0.7, 0.7 * grow, 9, t * 0.3, 0, true, 2.0);
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

    // timed beats
    if (t >= 2.5 && !banished) { banished = true; banish(); }
    if (banished && t < 7.0) ascendAmbient(t);
    if (t >= 7.2 && !revealed) { revealed = true; reveal(); }
    if (revealed) blessingAmbient(t);

    // stay in third-person TPS so the world/billboards render correctly; the
    // reveal & doorway beats tilt up through the camera, not into first person
    R.isTps = true;
    if (R.cam) { R.cam.fp = false; const fdx = s.look[0] - s.eye[0], fdz = s.look[2] - s.eye[2]; if (fdx * fdx + fdz * fdz > 1e-6) R.cam.tyaw = Math.atan2(fdz, fdx); }

    // subtitle
    let line = '';
    for (const l of LINES) if (t >= l.from && t < l.to) { line = l.text; break; }
    setSub(line);

    // heroic white-gold fade over the final beat
    if (whiteout) {
      const w = t >= 11.6 ? Math.min(1, (t - 11.6) / 2.4) : 0;
      whiteout.style.opacity = String(w);
    }

    if (t >= KFS[KFS.length - 1].t) finish();
  }

  function finish() {
    if (finished) return; finished = true;
    setSub('');
    if (overlay) overlay.classList.remove('on');
    if (whiteout) whiteout.style.opacity = '1';
    if (window.Render3D && savedUpdate) { try { window.Render3D.updateCamera = savedUpdate; } catch (_) {} savedUpdate = null; }
    if (window.Render3D && savedCollect) { try { window.Render3D.collect = savedCollect; } catch (_) {} savedCollect = null; }
    setTimeout(function () {
      if (overlay) overlay.remove();
      if (whiteout) whiteout.remove();
      if (skipBtn) skipBtn.remove();
      overlay = null; lbTop = null; lbBot = null; subEl = null; skipBtn = null; whiteout = null;
    }, 300);
    window._GAUNTLET_INTRO = false;
    const helpStrip = document.getElementById('helpOverlay');
    if (helpStrip && savedHelpDisplay != null) { helpStrip.style.display = savedHelpDisplay; savedHelpDisplay = null; }
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function play(opts) {
    opts = opts || {};
    ensureDOM();
    finished = false; onDoneCb = opts.onDone || function () {};
    banished = false; revealed = false; lastSpiral = 0; lastRing = 0; lastBless = 0; lastMs = 0;
    window._GAUNTLET_INTRO = true;
    // hide the in-game controls help strip so it doesn't layer under the subtitle
    const helpStrip = document.getElementById('helpOverlay');
    if (helpStrip) { savedHelpDisplay = helpStrip.style.display; helpStrip.style.display = 'none'; }

    const G = window._Gauntlet;
    if (!G || !G.world || !G.player) { finish(); return; }
    hx = opts.x != null ? opts.x : G.world.w / 2;
    hz = opts.y != null ? opts.y : G.world.h * 0.5;
    px = G.player.x; pz = G.player.y;
    const dx = px - hx, dz = pz - hz, dl = Math.hypot(dx, dz) || 1;
    ux = dx / dl; uz = dz / dl; // hollow -> player direction
    // stand the Scribe a little back from the blast, facing it
    G.player.x = hx + ux * 520; G.player.y = hz + uz * 520;

    KFS = buildKeys();

    if (window.Render3D && window.Render3D.ok) {
      savedUpdate = window.Render3D.updateCamera;
      window.Render3D.updateCamera = cinematicCamera;
      savedCollect = window.Render3D.collect;
      window.Render3D.collect = function (F, th) {
        const r = savedCollect ? savedCollect.call(this, F, th) : undefined;
        try { drawCutsceneVFX(); } catch (_) {}
        return r;
      };
    }
    if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (_) {} }

    if (whiteout) whiteout.style.opacity = '0';
    overlay.classList.add('on');
    startT = performance.now();
  }

  window.HollowDeath = { play };
})();
