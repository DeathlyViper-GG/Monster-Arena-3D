// ============================================================
// Monster Arena — ENDING: TAKE THE POWER (3D magical cutscene)
// The Scribe claims the fragments. Dark Nhalori power floods
// inward, the Scribe rises and transforms, a dark vortex forms
// around them, their eyes open with the Hollow's red/cyan gaze.
// The new Hollow King looms over the darkened realm. Hijacks the
// live Render3D camera. Exposes window.EndingTake.play({ onDone }).
// ============================================================
(function () {
  'use strict';

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
    const a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7],
      a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
    const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,
      b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,
      b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
    let d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
    if(!d){o.fill(0);o[0]=o[5]=o[10]=o[15]=1;return o;}d=1/d;
    o[0]=(a11*b11-a12*b10+a13*b09)*d;o[1]=(a02*b10-a01*b11-a03*b09)*d;
    o[2]=(a31*b05-a32*b04+a33*b03)*d;o[3]=(a22*b04-a21*b05-a23*b03)*d;
    o[4]=(a12*b08-a10*b11-a13*b07)*d;o[5]=(a00*b11-a02*b08+a03*b07)*d;
    o[6]=(a32*b02-a30*b05-a33*b01)*d;o[7]=(a20*b05-a22*b02+a23*b01)*d;
    o[8]=(a10*b10-a11*b08+a13*b06)*d;o[9]=(a01*b08-a00*b10-a03*b06)*d;
    o[10]=(a30*b04-a31*b02+a33*b00)*d;o[11]=(a21*b02-a20*b04-a23*b00)*d;
    o[12]=(a11*b07-a10*b09-a12*b06)*d;o[13]=(a00*b09-a01*b07+a02*b06)*d;
    o[14]=(a31*b01-a30*b03-a32*b00)*d;o[15]=(a20*b03-a21*b01+a22*b00)*d;
    return o;
  }
  const lerp3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const ss = (f) => { f = Math.max(0, Math.min(1, f)); return f * f * (3 - 2 * f); };

  const VOID = [0.5, 0.1, 0.8], RED = [1, 0.15, 0.2], CYAN = [0.1, 0.8, 1], DARK = [0.08, 0.01, 0.15];

  let overlay = null, lbTop = null, lbBot = null, subEl = null, skipBtn = null, whiteout = null;
  let onDoneCb = null, startT = 0, finished = false, savedUpdate = null, savedCollect = null, KFS = null;
  let px = 0, pz = 0;
  let lastStream = 0, lastMote = 0, transformed = false;

  const LINES = [
    { from: 0.0, to: 3.5, text: 'I take the fragments. The power of Nhalori floods through me — the hunger, the ambition, the will to outlast everything.' },
    { from: 3.6, to: 7.5, text: 'The seals bend to my hand. The Wardens kneel. The old Hollow\'s power transfers — and I rise.' },
    { from: 7.6, to: 11.0, text: 'My eyes open. I see the world as the Hollow King saw it — small, brief, and mine to devour.' },
    { from: 11.1, to: 14.0, text: 'Somewhere, a child is learning to read glyphs. They will come for me. And I am waiting.' }
  ];

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #etOverlay{position:fixed;inset:0;z-index:68;pointer-events:none;}
      #etLbTop,#etLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:68;opacity:0;transition:opacity .4s ease;}
      #etLbTop{top:0;} #etLbBot{bottom:0;}
      #etOverlay.on #etLbTop,#etOverlay.on #etLbBot{opacity:1;}
      #etOverlay .etSub{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);
        font-size:clamp(16px,2.7vw,24px);letter-spacing:.14em;text-transform:uppercase;color:#f0e6ff;
        text-shadow:0 2px 16px rgba(0,0,0,.95),0 0 26px rgba(200,100,255,.6);opacity:0;transition:opacity .35s ease;
        text-align:center;max-width:80vw;line-height:1.5;font-weight:600;padding:10px 22px;border-radius:12px;
        background:linear-gradient(180deg,rgba(8,4,16,.86),rgba(4,2,10,.78));
        border:1px solid rgba(200,100,255,.28);box-shadow:0 10px 30px rgba(0,0,0,.55);}
      #etOverlay .etSub.show{opacity:.97;}
      #etWhiteout{position:fixed;inset:0;z-index:69;pointer-events:none;opacity:0;
        background:radial-gradient(circle at 50% 45%, rgba(40,5,60,1) 0%, rgba(20,2,40,.96) 45%, rgba(5,0,15,.8) 100%);
        transition:opacity .12s linear;}
      #etSkip{position:fixed;top:22px;right:26px;z-index:70;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(200,100,255,.35);background:rgba(8,4,16,.7);color:#e6d6ff;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #etSkip:hover{background:rgba(20,10,36,.85);box-shadow:0 8px 24px rgba(160,80,255,.4);}`;
    document.head.appendChild(st);
    overlay = document.createElement('div'); overlay.id = 'etOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'etLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'etLbBot';
    subEl = document.createElement('div'); subEl.className = 'etSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(subEl);
    document.body.appendChild(overlay);
    whiteout = document.createElement('div'); whiteout.id = 'etWhiteout';
    document.body.appendChild(whiteout);
    skipBtn = document.createElement('button'); skipBtn.id = 'etSkip'; skipBtn.textContent = 'Skip ▸';
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
    push(0.0, [px - 280, 40, pz - 280], [px, 40, pz], 0.56);
    push(3.5, [px - 220, 60, pz - 220], [px, 60, pz], 0.52);
    push(7.5, [px + 280, 100, pz - 260], [px, 80, pz], 0.54);
    push(9.5, [px - 200, 120, pz + 240], [px, 100, pz], 0.50);
    push(11.5, [px - 360, 180, pz - 360], [px, 120, pz], 0.46);
    push(14.0, [px - 440, 240, pz - 440], [px, 140, pz], 0.42);
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

  function drawVFX() {
    const R = window.Render3D; if (!R || !R.ok || !KFS) return;
    const t = (performance.now() - startT) / 1000;
    const U = R.unit, mm = R.mm, mat = R.mat;

    // --- DARK POWER STREAMING INWARD (phase 0-4) ---
    if (t < 5.0 && t - lastStream > 0.04) {
      lastStream = t;
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * 6.28, r = 200 + Math.random() * 200;
        const sx = px + Math.cos(a) * r, sz = pz + Math.sin(a) * r;
        R.emit({ x: sx, y: 20 + Math.random() * 60, z: sz, vx: -Math.cos(a) * 180, vy: 20 + Math.random() * 40, vz: -Math.sin(a) * 180, life: 1.5, age: 0, s0: 12, s1: 2, col: VOID, a: 0.8, kind: 0, drag: 0.6 });
      }
    }

    // --- THE SCRIBE RISING, DARK VORTEX (phase 2.5-8) ---
    if (t > 2.5) {
      const grow = Math.min(1, (t - 2.5) / 4.0);
      const breathe = 1 + 0.1 * Math.sin(t * 4);
      const scl = (0.5 + grow * 1.5) * breathe;
      R.draw(U.torus, mm(px, 60, pz, t * 1.2, 80 * scl, 12 * scl, 80 * scl, 0.2), mat(VOID, { emissive: [1.0, 0.2, 1.8], shadow: false, alpha: 0.8 }));
      R.draw(U.sphere, mm(px, 60 + grow * 40, pz, t * 0.5, 30 * scl, 40 * scl, 30 * scl), mat([0.05, 0.01, 0.1], { emissive: [0.5, 0.1, 0.8], rim: 2.5, rimCol: [1.5, 0.3, 2], alpha: 0.9, shadow: false }));
      R.glow(px, 60 + grow * 40, pz, 200 * grow, 0.5, 0.1, 0.8, 0.8 * grow, 0);
      R.light(px, pz, 60, 600 * grow, 0.5, 0.1, 0.8, 0.8 * grow);
    }

    // --- TRANSFORMATION FLASH ---
    if (t > 6.8 && t < 7.2 && !transformed) {
      transformed = true;
      R.cameraKick = Math.max(R.cameraKick || 0, 1.5);
      if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(24);
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * 6.28, sp = 80 + Math.random() * 300;
        R.emit({ x: px, y: 60, z: pz, vx: Math.cos(a) * sp, vy: 40 + Math.random() * 100, vz: Math.sin(a) * sp, life: 2.0, age: 0, s0: 14, s1: 2, col: Math.random() < 0.4 ? RED : VOID, a: 0.95, kind: 0, drag: 0.7 });
      }
    }

    // --- EYES OPENING: red/cyan gaze (phase 7-10) ---
    if (t > 6.5) {
      const eyeOpen = Math.min(1, (t - 6.5) / 2.5);
      for (const s of [-1, 1]) {
        const col = s < 0 ? RED : CYAN;
        R.draw(U.sphereLo, mm(px + s * 14, 90, pz - 20, 0, 5, 5, 5), mat(col, { emissive: [col[0] * 2, col[1] * 2, col[2] * 2], shadow: false }));
        R.glow(px + s * 14, 90, pz - 20, 14, col[0], col[1], col[2], eyeOpen, 0);
      }
      R.light(px, pz, 90, 400 * eyeOpen, 1, 0.15, 0.2, 0.7 * eyeOpen);
      R.decal(px, pz, 200, 1, 0.15, 0.2, 0.4 * eyeOpen, 10, t * 0.5, 0, true, 1.8);
    }

    // --- REALM DARKENING + dark rain (phase 8-14) ---
    if (t > 8.0) {
      const dark = Math.min(1, (t - 8.0) / 3.0);
      R.glow(px, 120, pz, 500 * dark, 0.3, 0.05, 0.5, 0.6 * dark, 0);
      R.decal(px, pz, 400 * dark, 0.3, 0.05, 0.5, 0.3 * dark, 16, t * 0.3, 0, true, 2.5);
      if (t - lastMote > 0.08 && t < 13) {
        lastMote = t;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * 6.28, r = 50 + Math.random() * 300;
          R.emit({ x: px + Math.cos(a) * r, y: 200 + Math.random() * 100, z: pz + Math.sin(a) * r, vx: -Math.cos(a) * 20, vy: -60 - Math.random() * 80, vz: -Math.sin(a) * 20, life: 2.0, age: 0, s0: 8, s1: 2, col: Math.random() < 0.3 ? RED : VOID, a: 0.7, kind: 0, drag: 0.9 });
        }
      }
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
    R.isTps = true;
    if (R.cam) { R.cam.fp = false; const fdx = s.look[0] - s.eye[0], fdz = s.look[2] - s.eye[2]; if (fdx * fdx + fdz * fdz > 1e-6) R.cam.tyaw = Math.atan2(fdz, fdx); }
    let line = '';
    for (const l of LINES) if (t >= l.from && t < l.to) { line = l.text; break; }
    setSub(line);
    if (whiteout) { const w = t >= 12.5 ? Math.min(1, (t - 12.5) / 1.5) : 0; whiteout.style.opacity = String(w); }
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
      overlay = null; whiteout = null; skipBtn = null;
    }, 300);
    window._GAUNTLET_INTRO = false;
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function play(opts) {
    opts = opts || {};
    ensureDOM();
    finished = false; onDoneCb = opts.onDone || function () {};
    lastStream = 0; lastMote = 0; transformed = false;
    window._GAUNTLET_INTRO = true;
    const G = window._Gauntlet;
    px = (G && G.player) ? G.player.x : 0;
    pz = (G && G.player) ? G.player.y : 0;
    KFS = buildKeys();
    if (window.Render3D && window.Render3D.ok) {
      savedUpdate = window.Render3D.updateCamera;
      window.Render3D.updateCamera = cinematicCamera;
      savedCollect = window.Render3D.collect;
      window.Render3D.collect = function (F, th) {
        const r = savedCollect ? savedCollect.call(this, F, th) : undefined;
        try { drawVFX(); } catch (_) {}
        return r;
      };
    }
    if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (_) {} }
    if (whiteout) whiteout.style.opacity = '0';
    overlay.classList.add('on');
    startT = performance.now();
    if (!window.Render3D || !window.Render3D.ok) finish();
  }

  window.EndingTake = { play };
})();
