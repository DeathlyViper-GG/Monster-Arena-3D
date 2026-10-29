// ============================================================
// Monster Arena — Hollow Gauntlet Intro Cutscene (3D)
// A true 3D cinematic: it hijacks the live Render3D camera and
// dollies through the Neon Void world the player is standing in,
// framing each spawned Warden (rendered by its own draw3D) and
// finally tilting up to the Hollow looming in the sky. The game's
// normal first-person camera is replaced for the duration; the
// world, lighting, particles and enemies all keep rendering, so it
// reads as a movie shot inside the map. Combat stays frozen via
// window._GAUNTLET_INTRO. Only the letterbox / title / subtitle /
// skip are DOM overlays.
// Exposes window.GauntletIntro.play({ onDone }).
// ============================================================
(function () {
  'use strict';

  const WARDENS = [
    { type: 'hearth_warden', mod: 'HearthWarden', key: '_hw', accent: '#7dffa3', label: 'HEARTH WARDEN' },
    { type: 'pharaoh_glass', mod: 'PharaohGlass', key: '_pg', accent: '#ffd166', label: 'PHARAOH OF GLASS' },
    { type: 'rime_oracle',  mod: 'RimeOracle',    key: '_ro', accent: '#9fe3ff', label: 'RIME ORACLE' },
    { type: 'magma_titan',   mod: 'MagmaTitan',   key: '_mt', accent: '#ff7a66', label: 'MAGMA TITAN' },
    { type: 'void',          mod: 'VoidBoss',     key: '_vb', accent: '#d066ff', label: 'VOID' }
  ];

  // ---- tiny mat4 helpers (copied from gl3d.js so conventions match) ----
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
    const t = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      t[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    o.set(t); return o;
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

  let overlay = null, lbTop = null, lbBot = null, redText = null, subEl = null, skipBtn = null;
  let onDoneCb = null, startT = 0, finished = false;
  let KFS = null, RED_ON = [13.8, 17.6];
  let savedUpdate = null, savedPointerLock = false;
  let holos = [], lastLabel = null, lastTag = null, lastMs = 0;

  function hexRGB(h) {
    if (window.Render3D && window.Render3D.hexRGB) return window.Render3D.hexRGB(h);
    h = h.replace('#', ''); const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function startHolo(i) { holos.push({ i, t: 0, dur: 2.8 }); }

  function tickHolos(dt) {
    const R = window.Render3D; if (!R || !R.ok) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const G = window._Gauntlet, P = G && G.player;
    for (const h of holos) {
      h.t += dt;
      const wp = wardenPos(h.i), AC = hexRGB(WARDENS[h.i].accent);
      const EC = [Math.min(1, AC[0] * 1.8), Math.min(1, AC[1] * 1.8), Math.min(1, AC[2] * 1.8)];
      const x = wp.x, z = wp.y;
      const pulse = 0.5 + 0.5 * Math.sin(h.t * 3);

      // floor-level glowing rings around the warden's feet
      R.decal(x, z, 150, AC[0], AC[1], AC[2], 0.9, 12, h.t * 0.5, 0, true, 1.8);
      R.decal(x, z, 100, EC[0], EC[1], EC[2], 1.0, 8, -h.t * 0.8, 0, true, 2.0);
      R.glow(x, 3, z, 200, AC[0], AC[1], AC[2], 0.85 + 0.1 * pulse, 0);
      if (U && U.torus && mm && mat) {
        // flat glowing ring lying on the ground at the feet
        R.draw(U.torus, mm(x, 6, z, h.t * 0.8, 130, 8, 130, 0.14), mat([1, 1, 1], { emissive: EC, emisK: 2.8, alpha: 0.95, shadow: false, rim: 2.0, rimCol: AC }));
        R.draw(U.torus, mm(x, 8, z, -h.t * 1.1, 86, 6, 86, 0.16), mat([1, 1, 1], { emissive: AC, emisK: 2.4, alpha: 0.9, shadow: false, rim: 1.8, rimCol: AC }));
      }

      // a few low floor-level motes drifting near the feet (toned down)
      if (Math.random() < 0.5) {
        const a = Math.random() * 6.28, dd = 20 + Math.random() * 110;
        R.emit({ x: x + Math.cos(a) * dd, y: 1 + Math.random() * 6, z: z + Math.sin(a) * dd, vx: Math.cos(a) * 8, vy: 20 + Math.random() * 30, vz: Math.sin(a) * 8, life: 1.4, age: 0, s0: 8, s1: 2, col: AC, a: 0.7, kind: 0, drag: 0.8 });
      }
    }
    if (holos.length) holos = holos.filter(h => h.t < h.dur);
  }

  // Drive ONLY the Warden the camera is currently on, so each one performs
  // its real in-game attacks one at a time as the cinematic frames it. Damage
  // is suppressed by window._GAUNTLET_INTRO (hurtPlayer returns early). The
  // active Warden is kicked into an attack immediately when framed, ticked
  // while it's on screen, and pinned back to its mark so the framing holds.
  // Non-framed Wardens are frozen (no tick, no lingering telegraph) and left
  // in place — which also preserves clearCenterForHollow() during the reveal.
  // Stand the Scribe just in front of the active Warden (between it and the
  // cinematic camera) so the Warden's real attacks — which aim at the player —
  // land on-camera instead of off-screen at the centre-bottom spawn point.
  function placePlayerFor(activeIdx) {
    const G = window._Gauntlet; if (!G || !G.player || !G.world) return;
    if (activeIdx < 0) { G.player.x = G.world.w * 0.5; G.player.y = G.world.h * 0.82; return; }
    const wp = wardenPos(activeIdx);
    const cx = G.world.w * 0.5, cy = G.world.h * 0.82;
    let dx = cx - wp.x, dy = cy - wp.y, l = Math.hypot(dx, dy) || 1;
    G.player.x = wp.x + (dx / l) * 230;
    G.player.y = wp.y + (dy / l) * 230;
  }

  function driveWardens(dt, activeIdx) {
    const G = window._Gauntlet; if (!G || !G.enemies) return;
    // Stand the Scribe just in front of the ACTIVE Warden (between it and the
    // cinematic camera) so that Warden's real attacks — which aim at the
    // player — land on-camera. The player only moves when activeIdx changes,
    // and activeIdx only changes once the camera has arrived at the new
    // Warden (see cinematicCamera), so the outgoing Warden is already off
    // screen by then and never visibly swivels.
    placePlayerFor(activeIdx);
    for (let i = 0; i < WARDENS.length; i++) {
      const def = WARDENS[i];
      const e = G.enemies.find(en => en && en.type === def.type);
      if (!e) continue;
      const st = e[def.key];
      if (i === activeIdx) {
        if (st) { st.intro = 0; if (!st.cur) st.idle = Math.min(st.idle || 0, 0.05); }
        // Freeze the boss's own movement during its tick so it holds its mark
        // (attacks still fire, but the sprite no longer lunges/drifts, which
        // was making the upright billboard tilt back and forth each frame).
        const _sp = e.speed; e.speed = 0;
        const mod = window[def.mod];
        if (mod && typeof mod.tick === 'function') { try { mod.tick(e, dt); } catch (_) {} }
        e.speed = _sp;
        const wp = wardenPos(i);
        e.x = wp.x; e.y = wp.y; e.vx = 0; e.vy = 0;
      } else {
        // not framed: freeze any in-progress attack so telegraphs don't linger
        if (st) st.cur = null;
      }
    }
  }

  // move the spawned wardens off the center axis so the Hollow reveal isn't blocked
  function clearCenterForHollow() {
    const G = window._Gauntlet; if (!G || !G.enemies) return;
    const w = G.world;
    let side = 0;
    for (const e of G.enemies) {
      if (!e || !WARDENS.some(w => w.type === e.type)) continue;
      e.x = (side % 2 === 0 ? 0.06 : 0.94) * w.w;
      e.y = w.h * (0.26 + (side % 3) * 0.04);
      e.vx = 0; e.vy = 0;
      side++;
    }
  }

  function ensureDOM() {
    if (overlay) return;
    const st = document.createElement('style');
    st.textContent = `
      #giOverlay{position:fixed;inset:0;z-index:60;pointer-events:none;}
      #giLbTop,#giLbBot{position:fixed;left:0;right:0;height:9vh;background:#000;z-index:60;
        opacity:0;transition:opacity .4s ease;}
      #giLbTop{top:0;} #giLbBot{bottom:0;}
      #giOverlay.on #giLbTop,#giOverlay.on #giLbBot{opacity:1;}
      #giOverlay .giText{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);
        text-align:center;font-size:clamp(30px,7vw,80px);font-weight:900;letter-spacing:.14em;
        text-transform:uppercase;color:#ff3a3a;text-shadow:0 0 22px rgba(255,30,30,.85),0 0 48px rgba(200,0,0,.6);
        opacity:0;transition:opacity .25s ease;}
      #giOverlay .giText.show{opacity:1;animation:giShake .18s linear infinite;}
      @keyframes giShake{0%{transform:translate(-50%,-50%)}25%{transform:translate(calc(-50% + 4px),calc(-50% - 3px))}
        50%{transform:translate(calc(-50% - 3px),calc(-50% + 2px))}75%{transform:translate(calc(-50% + 2px),calc(-50% - 4px))}100%{transform:translate(-50%,-50%)}}
      #giOverlay .giSub{position:absolute;left:50%;bottom:13%;transform:translateX(-50%);
        font-size:clamp(14px,2.4vw,20px);letter-spacing:.18em;text-transform:uppercase;color:#e6d6ff;
        text-shadow:0 2px 14px rgba(0,0,0,.95),0 0 18px rgba(160,100,220,.5);opacity:0;transition:opacity .35s ease;text-align:center;white-space:nowrap;}
      #giOverlay .giSub.show{opacity:.92;}
      #giSkip{position:fixed;top:22px;right:26px;z-index:62;pointer-events:auto;cursor:pointer;
        border:1px solid rgba(224,198,255,.3);background:rgba(8,4,16,.7);color:#e6d6f5;
        padding:8px 16px;border-radius:8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;}
      #giSkip:hover{background:rgba(34,18,52,.85);box-shadow:0 8px 24px rgba(160,100,220,.35);}`;
    document.head.appendChild(st);

    overlay = document.createElement('div'); overlay.id = 'giOverlay';
    lbTop = document.createElement('div'); lbTop.id = 'giLbTop';
    lbBot = document.createElement('div'); lbBot.id = 'giLbBot';
    redText = document.createElement('div'); redText.className = 'giText'; redText.textContent = 'DEFEAT MY WARDENS';
    subEl = document.createElement('div'); subEl.className = 'giSub'; subEl.id = 'giSub';
    overlay.appendChild(lbTop); overlay.appendChild(lbBot); overlay.appendChild(redText); overlay.appendChild(subEl);
    document.body.appendChild(overlay);

    skipBtn = document.createElement('button'); skipBtn.id = 'giSkip'; skipBtn.textContent = 'Skip ▸';
    skipBtn.addEventListener('click', finish);
    document.body.appendChild(skipBtn);
  }

  function setSub(text) {
    if (!subEl) return;
    if (text) { subEl.textContent = text; subEl.classList.add('show'); } else subEl.classList.remove('show');
  }

  // ---- world layout ----
  function wardenPos(i) {
    const G = window._Gauntlet, w = G.world;
    const t = i / 4;
    return { x: w.w * (0.18 + t * 0.64), y: w.h * (0.30 - Math.sin(t * Math.PI) * 0.06) };
  }
  function hollowPos() { const G = window._Gauntlet, w = G.world; return { x: w.w / 2, y: w.h * 0.14 }; }

  // ---- warden setup on spawn ----
  function adjustWarden(e, def) {
    e.absorbing = false; e._addsSeen = true;
    const st = e[def.key];
    if (st) { st.intro = 0; st.cur = null; st.idle = 0; }   // ready to attack the instant it's framed
    if (def.type === 'void') {
      e._vb.form = 2; e._vb.morphed = true; e._vb.cur = null; e._vb.intro = 0.2;
      e.maxhp = Math.round((e.maxhp || 3400) * 0.55 * 0.8); e.hp = e.maxhp; e.r = 56; e.speed = 70;
    } else {
      e.maxhp = Math.round((e.maxhp || 2000) * 0.42); e.hp = e.maxhp;
    }
  }
  function spawnWarden(i) {
    const G = window._Gauntlet; if (!G || !G.spawnBoss) return;
    const p = wardenPos(i);
    G.spawnBoss(WARDENS[i].type, p.x, p.y);
    const e = G.enemies[G.enemies.length - 1];
    if (e) adjustWarden(e, WARDENS[i]);
  }
  function spawnHollow() {
    const G = window._Gauntlet; if (!G || !G.spawnBoss) return;
    const p = hollowPos();
    G.spawnBoss('hollow', p.x, p.y);
    const e = G.enemies[G.enemies.length - 1];
    if (e) { e.absorbing = true; e._float = { base: 300, amp: 16 }; if (e._hb) { e._hb.intro = 0.2; e._hb.cur = null; } }
  }

  // ---- keyframes ----
  function buildKeys() {
    const G = window._Gauntlet, w = G.world, P = G.player;
    const px = P.x, py = P.y;
    const hp = hollowPos();
    // Camera sits on the Warden→player axis (player side), looking back at the
    // Warden. This is the SAME geometry as normal TPS gameplay (camera behind
    // the player, monster faces the player), so each boss's upright billboard
    // tilt matches exactly — no per-warden twist accumulation. Distances/heights
    // vary per beat for subtle dolly motion; the axis stays on-line so the
    // sprite never flips upside-down.
    const wEye = (i, side) => {
      const wp = wardenPos(i);
      const fx = px - wp.x, fy = py - wp.y, fl = Math.hypot(fx, fy) || 1;
      const dist = 860 + side * 70;     // pulled back so the whole Warden fits
      const h = 250 - side * 60;        // raised so the head isn't cropped
      return [wp.x + (fx / fl) * dist, h, wp.y + (fy / fl) * dist];
    };
    const wLook = (i) => { const wp = wardenPos(i); return [wp.x, 180, wp.y]; };
    const kfs = [];
    const push = (t, eye, look, fov, tag, label) => kfs.push({ t, eye, look, fov, tag, label });

    push(0.0, [px, 30, py - 150], [w.w / 2, 120, w.h * 0.30], 0.62, 'player', '');
    // warden 0 — two-beat dolly on the player axis
    push(1.2, wEye(0, 0), wLook(0), 0.50, 'warden', WARDENS[0].label);
    push(3.6, wEye(0, 1), wLook(0), 0.48, 'warden', WARDENS[0].label);
    // wardens 1..4 — travel + dolly, always on the Warden→player axis
    for (let i = 1; i < 5; i++) {
      push(kfs[kfs.length - 1].t + 0.6, wEye(i, 0), wLook(i), 0.50, 'warden', WARDENS[i].label);
      push(kfs[kfs.length - 1].t + 1.8, wEye(i, 1), wLook(i), 0.48, 'warden', WARDENS[i].label);
    }
    // hollow — the body floats at y≈450 (base 300 + body offset), so aim the
    // camera at its chest, pull well back, and use a wider FOV so the entire
    // towering silhouette fills the frame instead of just its feet.
    const h0 = kfs[kfs.length - 1].t + 0.8;
    push(h0,      [hp.x, 300, hp.y + 1050], [hp.x, 460, hp.y], 0.66, 'hollow', '');
    push(h0 + 2.4, [hp.x, 260, hp.y + 920], [hp.x, 450, hp.y], 0.68, 'hollow', '');
    // pan back to the player — FIRST PERSON: the camera sits at the Scribe's
    // eyes and tilts up to reveal the Hollow looming overhead, so the handoff
    // back to the real game camera reads as the player's own viewpoint.
    const p0 = h0 + 3.2;
    push(p0,      [px, 52, py], [hp.x, 220, hp.y], 0.66, 'player', '');
    push(p0 + 1.8, [px, 46, py], [hp.x, 440, hp.y], 0.62, 'player', '');
    RED_ON = [h0, p0];
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
    return {
      eye: lerp3(a.eye, b.eye, f),
      look: lerp3(a.look, b.look, f),
      fov: a.fov + (b.fov - a.fov) * f,
      label: b.label,
      tag: b.tag,
      srcLabel: a.label,
      f
    };
  }

  // ---- cinematic camera installed as Render3D.updateCamera ----
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
    // fire a themed holo the first frame each Warden is framed
    if (s.tag === 'warden' && s.label && s.label !== lastLabel) {
      lastLabel = s.label;
      const wi = WARDENS.findIndex(w => w.label === s.label);
      if (wi >= 0) startHolo(wi);
    }
    // the first time we cut to the Hollow, shove the wardens off the center axis
    if (s.tag === 'hollow' && lastTag !== 'hollow') clearCenterForHollow();
    lastTag = s.tag;
    const nowMs = performance.now();
    const fdt = Math.min(0.05, (nowMs - (lastMs || nowMs)) / 1000);
    tickHolos(fdt);
    // only the Warden the camera is currently on performs its real attack.
    // During a Warden→Warden handoff, keep the OUTGOING Warden active (and the
    // player near it) until the camera has actually arrived at the next one —
    // otherwise the player jumps to the new Warden the instant the dolly
    // begins, which makes the still-on-screen Warden swivel toward the next.
    let activeIdx = -1;
    if (s.tag === 'warden') {
      if (s.srcLabel && s.srcLabel !== s.label && s.f < 0.82) {
        activeIdx = WARDENS.findIndex(w => w.label === s.srcLabel);
      } else {
        activeIdx = WARDENS.findIndex(w => w.label === s.label);
      }
    }
    driveWardens(fdt, activeIdx);
    lastMs = nowMs;
    // Stay in third-person TPS so each boss's own draw3D uses its upright
    // billboard branch (the flat relief sprite would otherwise lie on the
    // ground). Sync cam.tyaw to the cinematic forward so the billboard axis
    // matches the moving camera. The final pan-back-to-player beat switches
    // to first person (the Scribe's own viewpoint looking up at the Hollow).
    const finalFP = t >= RED_ON[1];
    R.isTps = !finalFP;
    if (R.cam) {
      R.cam.fp = finalFP;
      const fdx = s.look[0] - s.eye[0], fdz = s.look[2] - s.eye[2];
      if (fdx * fdx + fdz * fdz > 1e-6) R.cam.tyaw = Math.atan2(fdz, fdx);
    }
    // DOM timing
    if (redText) { if (t >= RED_ON[0] && t < RED_ON[1]) redText.classList.add('show'); else redText.classList.remove('show'); }
    setSub(s.label || '');
    if (t >= KFS[KFS.length - 1].t) finish();
  }

  function spawnAll() {
    for (let i = 0; i < 5; i++) spawnWarden(i);
    spawnHollow();
  }

  function finish() {
    if (finished) return; finished = true;
    holos = []; lastLabel = null; lastTag = null; lastMs = 0;
    setSub('');
    if (redText) redText.classList.remove('show');
    if (overlay) overlay.classList.remove('on');
    // restore the real camera
    if (window.Render3D && savedUpdate) { try { window.Render3D.updateCamera = savedUpdate; } catch (_) {} savedUpdate = null; }
    // release the pointer lock we suppressed, so the player can re-aim when combat resumes
    setTimeout(() => {
      if (overlay) overlay.remove();
      if (skipBtn) skipBtn.remove();
      overlay = null; lbTop = null; lbBot = null; redText = null; subEl = null; skipBtn = null;
    }, 250);
    window._GAUNTLET_INTRO = false;
    window._GAUNTLET_INTRO_CAM = null;
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function play(opts) {
    opts = opts || {};
    ensureDOM();
    finished = false; onDoneCb = opts.onDone || function () {};
    holos = []; lastLabel = null; lastTag = null; lastMs = 0;
    window._GAUNTLET_INTRO = true;
    window._GAUNTLET_INTRO_CAM = null;

    const G = window._Gauntlet;
    if (!G || !G.world || !G.player) { finish(); return; }
    // stand the Scribe at the bottom-centre so the Wardens arc above
    G.player.x = G.world.w * 0.5; G.player.y = G.world.h * 0.82;

    KFS = buildKeys();
    spawnAll();

    // take over the 3D camera
    if (window.Render3D && window.Render3D.ok) {
      savedUpdate = window.Render3D.updateCamera;
      window.Render3D.updateCamera = cinematicCamera;
    }
    // free the cursor so Skip is clickable; remember to let the game re-lock later
    if (document.pointerLockElement && document.exitPointerLock) { try { document.exitPointerLock(); } catch (_) {} }

    overlay.classList.add('on');
    startT = performance.now();
  }

  window.GauntletIntro = { play };
})();
