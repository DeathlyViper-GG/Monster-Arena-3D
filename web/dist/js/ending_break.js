// ============================================================
// Monster Arena — ENDING: BREAK THE SEALS (3D magical cutscene)
// The Scribe shatters the ancient seals. The Hollow — the last
// echo of Nhalori — dissolves into thousands of light motes that
// rise upward and disperse. Dawn breaks over the Neon Void as the
// glyphs fade from the Scribe's skin. Hijacks the live Render3D
// camera. Exposes window.EndingBreak.play({ onDone }).
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

  const WHITE = [1, 1, 1], GOLD = [1, 0.84, 0.42], DAWN = [0.7, 0.85, 1];

  let overlay = null, lbTop = null, lbBot = null, subEl = null, skipBtn = null, whiteout = null;
  let onDoneCb = null, startT = 0, finished = false, savedUpdate = null, savedCollect = null, KFS = null;
  let cx = 0, cz = 0, px = 0, pz = 0, ux = 0, uz = 0;
  let lastMote = 0, shattered = false;

  const LINES = [
    { from: 0.0, to: 3.5, text: 'I break the seals. The ancient magic of Nhalori unravels.' },
    { from: 3.6, to: 7.5, text: 'The Hollow — the last echo of Nhalori — dissolves into the dark. An age of hunger, finished.' },
    { from: 7.6, to: 11.5, text: 'The glyphs fade from my skin. The magic sleeps at last.' },
    { from: 11.6, to: 14.0, text: 'I am only a scribe. I am only myself. Dawn breaks — and the world is free.' }
  ];

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #ebOverlay{position:fixed;inset:0;z-index:68;pointer-events:none;}
      #ebLbTop,#ebLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:68;opacity:0;transition:opacity .4s ease;}
      #ebLbTop{top:0;} #ebLbBot{bottom:0;}
      #ebOverlay.on #ebLbTop,#ebOverlay.on #ebLbBot{opacity:1;}
      #ebOverlay .ebSub{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);
        font-size:clamp(16px,2.7vw,24px);letter-spacing:.14em;text-transform:uppercase;color:#eef6ff;
        text-shadow:0 2px 16px rgba(0,0,0,.95),0 0 26px rgba(180,210,255,.6);opacity:0;transition:opacity .35s ease;
        text-align:center;max-width:80vw;line-height:1.5;font-weight:600;padding:10px 22px;border-radius:12px;
        background:linear-gradient(180deg,rgba(4,8,16,.86),rgba(2,4,10,.78));
        border:1px solid rgba(180,210,255,.28);box-shadow:0 10px 30px rgba(0,0,0,.55);}
      #ebOverlay .ebSub.show{opacity:.97;}
      #ebWhiteout{position:fixed;inset:0;z-index:69;pointer-events:none;opacity:0;
        background:radial-gradient(circle at 50% 35%, rgba(255,252,245,1) 0%, rgba(255,236,200,.95) 40%, rgba(200,220,255,.6) 100%);
        transition:opacity .12s linear;}
      #ebSkip{position:fixed;top:22px;right:26px;z-index:70;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(180,210,255,.35);background:rgba(4,8,16,.7);color:#dceaff;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #ebSkip:hover{background:rgba(12,20,36,.85);box-shadow:0 8px 24px rgba(120,170,255,.4);}`;
    document.head.appendChild(st);
    overlay = document.createElement('div'); overlay.id = 'ebOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'ebLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'ebLbBot';
    subEl = document.createElement('div'); subEl.className = 'ebSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(subEl);
    document.body.appendChild(overlay);
    whiteout = document.createElement('div'); whiteout.id = 'ebWhiteout';
    document.body.appendChild(whiteout);
    skipBtn = document.createElement('button'); skipBtn.id = 'ebSkip'; skipBtn.textContent = 'Skip ▸';
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
    push(0.0, [cx - ux * 340, 50, cz - uz * 340], [cx, 50, cz], 0.56);
    push(3.5, [cx - ux * 300, 70, cz - uz * 300], [cx, 60, cz], 0.52);
    push(7.5, [cx + 280, 120, cz - 260], [cx, 80, cz], 0.54);
    push(9.5, [px - ux * 260, 44, pz - uz * 260], [px, 50, pz], 0.50);
    push(11.5, [px - ux * 220, 80, pz - uz * 220], [px, 260, pz], 0.46);
    push(14.0, [px - ux * 200, 120, pz - uz * 200], [px, 500, pz], 0.44);
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

    // --- CRACKING SEALS (phase 0-3) ---
    if (t < 4.0) {
      const fade = t < 3.0 ? 1 : Math.max(0, 1 - (t - 3.0));
      R.decal(cx, cz, 180, DAWN[0], DAWN[1], DAWN[2], 0.6 * fade, 12, t * 0.5, 0, true, 2.0);
      R.decal(cx, cz, 260, GOLD[0], GOLD[1], GOLD[2], 0.4 * fade, 16, -t * 0.3, 0, true, 1.6);
      if (t < 3.0 && t - lastMote > 0.06) {
        lastMote = t;
        for (let i = 0; i < 6; i++) {
          const a = Math.random() * 6.28, r = 60 + Math.random() * 120;
          R.emit({ x: cx + Math.cos(a) * r, y: 5, z: cz + Math.sin(a) * r, vx: Math.cos(a) * 80, vy: 40 + Math.random() * 60, vz: Math.sin(a) * 80, life: 1.2, age: 0, s0: 10, s1: 2, col: DAWN, a: 0.8, kind: 0, drag: 0.7 });
        }
      }
    }

    // --- SHATTER FLASH ---
    if (t > 2.8 && t < 3.2 && !shattered) {
      shattered = true;
      R.cameraKick = Math.max(R.cameraKick || 0, 1.2);
      if (window._Gauntlet && window._Gauntlet.camShake) window._Gauntlet.camShake(20);
      for (let i = 0; i < 120; i++) {
        const a = Math.random() * 6.28, sp = 100 + Math.random() * 300;
        R.emit({ x: cx, y: 30, z: cz, vx: Math.cos(a) * sp, vy: 60 + Math.random() * 120, vz: Math.sin(a) * sp, life: 2.0, age: 0, s0: 14, s1: 2, col: Math.random() < 0.5 ? WHITE : DAWN, a: 0.95, kind: 0, drag: 0.75 });
      }
    }

    // --- DISSOLVING HOLLOW (phase 3-7) ---
    if (t > 2.5 && t < 7.5) {
      const fade = t < 7.0 ? 1 : Math.max(0, 1 - (t - 7.0) / 0.5);
      const breathe = 1 + 0.06 * Math.sin(t * 3);
      const scl = Math.max(0.2, 1 - (t - 2.5) / 4.5) * breathe;
      if (scl > 0.2) {
        R.draw(U.sphere, mm(cx, 60, cz, t * 0.3, 46 * scl, 56 * scl, 46 * scl), mat([0.05, 0.01, 0.12], { emissive: [0.3, 0.08, 0.5], rim: 2.0, rimCol: [0.8, 0.3, 1.2], alpha: fade, shadow: false }));
        R.glow(cx, 60, cz, 160, 0.4, 0.08, 0.7, 0.5 * fade, 0);
      }
      if (t - lastMote > 0.04) {
        lastMote = t;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * 6.28, r = Math.random() * 60;
          const isLight = Math.random() < 0.6;
          R.emit({ x: cx + Math.cos(a) * r, y: 40 + Math.random() * 40, z: cz + Math.sin(a) * r, vx: (Math.random() - 0.5) * 20, vy: 80 + Math.random() * 120, vz: (Math.random() - 0.5) * 20, life: 2.5, age: 0, s0: 10, s1: 2, col: isLight ? WHITE : DAWN, a: 0.85, kind: 0, drag: 0.92 });
        }
      }
    }

    // --- DAWN BREAKING (phase 7-11) ---
    if (t > 6.5) {
      const dawn = Math.min(1, (t - 6.5) / 3.0);
      R.glow(cx, 300, cz, 800 * dawn, 1, 0.95, 0.8, 0.7 * dawn, 0);
      R.light(cx, cz, 400, 1200 * dawn, 1, 0.95, 0.8, 0.9 * dawn);
      R.decal(cx, cz, 600 * dawn, 1, 0.95, 0.8, 0.3 * dawn, 20, t * 0.2, 0, true, 3.0);
      if (t - lastMote > 0.1 && t < 12) {
        lastMote = t;
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * 6.28, r = 50 + Math.random() * 250;
          R.emit({ x: cx + Math.cos(a) * r, y: 280 + Math.random() * 100, z: cz + Math.sin(a) * r, vx: 0, vy: -20 - Math.random() * 30, vz: 0, life: 3.0, age: 0, s0: 8, s1: 2, col: Math.random() < 0.5 ? GOLD : DAWN, a: 0.7, kind: 0, drag: 0.97 });
        }
      }
    }

    // --- THE SCRIBE: glyphs fading (phase 9-14) ---
    if (t > 9.0) {
      const dim = Math.max(0, 1 - (t - 9.0) / 4.0);
      const pulse = 0.6 + 0.4 * Math.sin(t * 2);
      R.glow(px, 40, pz, 220 * dim, GOLD[0], GOLD[1], GOLD[2], 0.7 * pulse * dim, 0);
      R.light(px, pz, 50, 400 * dim, GOLD[0], GOLD[1], GOLD[2], 0.6 * dim);
      R.decal(px, pz, 160 * dim, 1, 0.95, 0.8, 0.4 * dim, 12, t * 0.2, 0, true, 1.6);
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
    lastMote = 0; shattered = false;
    window._GAUNTLET_INTRO = true;
    const G = window._Gauntlet;
    cx = (G && G.world) ? G.world.w / 2 : 0;
    cz = (G && G.world) ? G.world.h * 0.5 : 0;
    px = (G && G.player) ? G.player.x : cx;
    pz = (G && G.player) ? G.player.y : cz;
    const dx = px - cx, dz = pz - cz, dl = Math.hypot(dx, dz) || 1;
    ux = dx / dl; uz = dz / dl;
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

  window.EndingBreak = { play };
})();
