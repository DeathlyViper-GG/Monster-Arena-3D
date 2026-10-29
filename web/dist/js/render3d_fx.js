/* =====================================================================
   render3d_fx.js — entities, avatars, weapons and every visual effect
   Extends Render3D with R.collect(F, theme) which fills the draw lists,
   light list, particle batches and ribbon batch each frame.
   ===================================================================== */
(function (G) {
  'use strict';
  const R = G.Render3D, { M } = G.GL3D, U = () => R.unit;
  const TAU = Math.PI * 2, hex = (h) => R.hexRGB(h), mm = (...a) => R.mm(...a);
  const mat = (c, o) => R.mat(c, o);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const idHash = (e) => { if (e._h3 === undefined) { try { e._h3 = hash((e.id !== undefined ? +e.id || 0 : (R._idc = (R._idc || 0) + 1)) + 1.7); } catch (_) { return .5; } } return e._h3; };

  // ------------------------------------------------------------- particles
  const P = []; const MAXP = 5000;
  function emit(o) { if (P.length < MAXP) P.push(o); }
  const q = () => R.q.parts;
  R.emit = emit;
  function burst(n, f) { n = Math.max(1, Math.round(n * q())); for (let i = 0; i < n; i++) f(i, n); }
  function stepParticles(dt) {
    const A = R.quads.add, B = R.quads.alpha;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i]; p.age += dt; if (p.age >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
      const u = p.age / p.life; const dr = Math.max(0, 1 - (p.drag || 0) * dt);
      p.vx *= dr; p.vz *= dr; p.vy = p.vy * dr - (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 1 && p.floor !== false) { p.y = 1; p.vy = Math.abs(p.vy) * (p.bounce || 0); if (!p.bounce) { p.vx *= .8; p.vz *= .8; } }
      const s = lerp(p.s0, p.s1, u), a = (p.a * (p.fade === 'in' ? Math.min(1, u * 5) : 1)) * (1 - u * u * (p.fadeK === undefined ? 1 : p.fadeK));
      const col = p.col; const b = p.add === false ? B : A;
      if (p.mesh) { // debris mesh
        p.rx += (p.vrx || 0) * dt; p.ry += (p.vry || 0) * dt;
        R.draw(U()[p.mesh], mm(p.x, p.y, p.z, p.ry, s, s * (p.sy || 1), s, p.rx), mat(col, { emissive: [col[0] * (p.em || 0), col[1] * (p.em || 0), col[2] * (p.em || 0)], rough: .5, metal: .2, shadow: false }));
        continue;
      }
      if (p.orient === 2) { const sp = Math.hypot(p.vx, p.vz); b.push(p.x, p.y, p.z, s, col[0], col[1], col[2], a, Math.atan2(p.vz, p.vx), 4, clamp(sp * .035, 1, 6), 2); }
      else b.push(p.x, p.y, p.z, s, col[0], col[1], col[2], a, (p.rot || 0) + (p.vrot || 0) * p.age, p.kind || 0, p.param || 0, p.orient || 0);
    }
  }

  // -------------------------------------------------------------- helpers
  const COL = {
    white: [1, 1, 1], fire: [1.6, .55, .12], fireHot: [2, 1.2, .5], elec: [.55, 1.1, 1.8], spirit: [.75, .35, 1.6], water: [.3, .75, 1.6], earth: [.55, 1.2, .5],
    red: [1.6, .25, .2], gold: [1.7, 1.2, .35], green: [.4, 1.6, .55], cyan: [.4, 1.4, 1.8]
  };
  const boost = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  function rgbaStr(h, k) { const c = hex(h); return [c[0] * (k || 1), c[1] * (k || 1), c[2] * (k || 1)]; }
  function jag(x1, y1, z1, x2, y2, z2, seg, spread, seed) {
    const pts = [x1, y1, z1]; const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
    for (let i = 1; i < seg; i++) { const u = i / seg, o = (hash(seed + i * 3.1 + Math.floor(R.time * 24) * 7.7) - .5) * spread * Math.sin(u * Math.PI); pts.push(x1 + dx * u + nx * o, y1 + (y2 - y1) * u + (hash(seed + i * 9.3 + R.time * 30) - .5) * spread * .4, z1 + dz * u + nz * o); }
    pts.push(x2, y2, z2); return pts;
  }
  R.jag = jag;
  function bolt(x1, y1, z1, x2, y2, z2, col, w, a, seed, seg) { const pts = jag(x1, y1, z1, x2, y2, z2, seg || 9, Math.min(60, Math.hypot(x2 - x1, z2 - z1) * .35 + 6), seed || 1); R.rib.line(pts, w, w * .7, col[0], col[1], col[2], a); R.rib.line(pts, w * .35, w * .25, 1, 1, 1, a * .8); }
  R.bolt = bolt;
  function ring(x, z, rad, col, a, kind, param, y, add) { R.decal(x, z, rad, col[0], col[1], col[2], a, kind === undefined ? 2 : kind, param === undefined ? .08 : param, 0, add, y); }

  const ENEMY_SPRITE = { chaser: 'ravener', tank: 'gorgon-x', sniper: 'noctilith', bomber: 'hellforged', healer: 'bone-warden', shooter: 'blacksite-operative', boss: 'void-seraph', swarm: 'ravener', hearth_warden: 'hearth_warden', pharaoh_glass: 'pharaoh_glass', magma_titan: 'magma_titan' };
  const ENEMY_COL = { chaser: [1.5, .55, .2], tank: [.3, 1.4, .9], sniper: [.3, 1, 1.5], bomber: [1.6, .35, .1], healer: [.7, 1.5, .25], shooter: [.8, .9, 1.1], boss: [1.4, .35, 1.5], swarm: [1.5, .55, .2], hearth_warden: [.5, 1.0, .4], pharaoh_glass: [1.0, .8, .25], magma_titan: [1.0, .35, .12] };
  const RARITY_COL = { common: [.7, 1.1, 1.6], rare: [.5, 1.2, 1.8], epic: [1.4, .6, 1.8], legendary: [1.9, 1.3, .4], god: null };

  // --------------------------------------------------------- weapon models
  const GUN_DEPTH = { pistol: .07, rifle: .2, shotgun: .2 };
  // Shop weapon archetypes that have no sprite sheet — they render as detailed
  // procedural 3D models (buildGunModel) in both world and first-person views.
  const NEW_KINDS = { smg: 1, burst: 1, marksman: 1, crossbow: 1, lmg: 1, flamethrower: 1 };
  // Per-gun projectile look: rad = body radius, len = tracer length, glow = halo scale, fire = flame cloud (no clean tracer)
  const BULLET_VIS = {
    pistol:       { col:[1.3,1.6,2.2], rad:3.0, len:14, glow:4.0 },
    rifle:        { col:[1.2,1.6,2.4], rad:2.6, len:24, glow:4.0 },
    shotgun:      { col:[1.6,1.2,.6],  rad:2.6, len:10, glow:5.0 },
    smg:          { col:[1.3,1.6,2.3], rad:2.4, len:14, glow:3.5 },
    burst:        { col:[1.3,1.7,2.4], rad:2.6, len:18, glow:4.0 },
    marksman:     { col:[1.7,1.4,1.0], rad:2.0, len:36, glow:6.0 },
    crossbow:     { col:[1.4,1.1,.8],  rad:3.6, len:28, glow:5.0 },
    lmg:          { col:[1.5,1.4,.7],  rad:3.0, len:20, glow:4.5 },
    flamethrower: { col:[2.0,1.1,.25], rad:7.0, len:8,  glow:10.0, fire:true }
  };
  function drawGun(A, kind, img, hb, held) {
    // A: {x,z,ang,r}. replicates 2D placement rect
    const r = A.r;
    if (NEW_KINDS[kind]) { buildGunModel(A, hb, kind); return; }
    if (img) {
      const tl = kind === 'shotgun' ? 20 : kind === 'rifle' ? 30 : 110;
      const sp = R.spriteMesh(img, { depth: GUN_DEPTH[kind] || .15, power: .6 }); if (!sp) return fallbackGun(A, hb, kind);
      const dH = tl, dW = tl * sp.aspect, offx = kind === 'shotgun' ? -.1 : -.2;
      const cx = r * .4 + dW * (offx + .5), c = Math.cos(A.ang), s = Math.sin(A.ang);
      const th = dH * (GUN_DEPTH[kind] || .15) + .5;
      R.draw(sp.mesh, mm(A.x + c * cx, hb - th * .5 + (held ? -2 : 0), A.z + s * cx, A.ang, dH, dH * 1.0, dH), mat([1.15, 1.15, 1.15], { tex: sp.tex, emis: sp.emis, emisK: 1.5, rough: .4, metal: .5, shadow: true }));
      A.muzzle = r * .4 + dW * (offx + 1.0);
    } else fallbackGun(A, hb, kind);
  }
  // Stand-in weapon for players/bots in world space when the gun sprite can't be read.
  // Local frame: +x forward, +y up, +z sideways. One silhouette per kind.
  function fallbackGun(A, hb, kind) {
    const c = Math.cos(A.ang), s = Math.sin(A.ang), r = A.r;
    const mt = mat([.18, .2, .3], { metal: .7, rough: .3, emissive: [.02, .05, .09] });
    const pl = mat([.12, .13, .18], { metal: .35, rough: .6 });
    const gl = mat([.3, .9, 1.4], { emissive: [.2, .8, 1.3], shadow: false });
    const at = (f, y, sx, sy, sz, m) => R.draw(U().box, mm(A.x + c * f, hb + y, A.z + s * f, A.ang, sx, sy, sz), m);
    if (kind === 'shotgun') {
      at(r * .5 + 11, -1.0, 22, 3.6, 3.6, mt);    // fat barrel
      at(r * .5 + 7, -2.6, 6, 3.6, 4.2, pl);      // pump / forend
      at(r * .5 - 4, -1.6, 10, 5.0, 3.0, pl);     // buttstock
      at(r * .5 + 20, .8, 1.5, 1.5, 1.5, gl);     // bead sight
      A.muzzle = r * .5 + 22;
    } else if (kind === 'rifle') {
      at(r * .5 + 13, -1.2, 26, 2.6, 2.8, mt);    // receiver + barrel
      at(r * .5 + 19, -2.2, 7, 3.4, 3.4, pl);     // handguard
      at(r * .5 + 8, -3.6, 3, 4.5, 2.4, pl);      // magazine
      at(r * .5 - 4, -1.4, 9, 4.0, 2.8, pl);      // stock
      at(r * .5 + 12, .6, 3, 1.4, 1.6, mt);       // optic
      A.muzzle = r * .5 + 26;
    } else {
      at(r * .5 + 5, -1.0, 12, 2.4, 2.4, mt);     // slide
      at(r * .5 + 2, -3.4, 3, 4.0, 2.6, pl);      // grip
      A.muzzle = r * .5 + 11;
    }
  }
  // Detailed 3D models for the shop's new weapon archetypes, built from the same
  // part list as shop_gun_preview.js but in the in-game GL3D primitive system and
  // scaled to sit on the player avatar next to the existing pistol/rifle/shotgun.
  // Local frame: +x forward (along A.ang), +y up, +z sideways.
  function buildGunModel(A, hb, kind) {
    const c = Math.cos(A.ang), s = Math.sin(A.ang), r = A.r;
    const base = r * .5, S = 4.0;
    const mt = mat([.18, .20, .30], { metal: .7, rough: .3, emissive: [.02, .05, .09] });
    const pl = mat([.12, .13, .18], { metal: .35, rough: .6 });
    const st = mat([.66, .71, .78], { metal: .9, rough: .2 });
    const gl = mat([.3, .9, 1.4], { emissive: [.2, .8, 1.3], shadow: false });
    const gripRake = -0.14;
    const wp = (f, y, sd) => [A.x + c * (base + S * f) - s * (S * sd), hb + S * y, A.z + s * (base + S * f) + c * (S * sd)];
    const box = (f, y, sd, lf, ly, lz, m, rz) => { const w = wp(f, y, sd); R.draw(U().box, mm(w[0], w[1], w[2], A.ang, S * lf, S * ly, S * lz, 0, rz || 0), m); };
    const cylX = (f, y, sd, len, rad, m) => { const w = wp(f, y, sd); R.draw(U().cyl, mm(w[0], w[1], w[2], A.ang, S * rad, S * len, S * rad, 0, -Math.PI / 2), m); };
    const cylZ = (f, y, sd, len, rad, m) => { const w = wp(f, y, sd); R.draw(U().cyl, mm(w[0], w[1], w[2], A.ang, S * rad, S * len, S * rad, Math.PI / 2, 0), m); };
    if (kind === 'smg') {
      box(0.35, -1.15, 0, 0.55, 1.35, 0.78, pl, gripRake); box(0.25, 0.12, 0, 1.7, 0.92, 0.82, mt);
      cylX(1.75, 0.30, 0, 1.7, 0.30, mt); cylX(2.7, 0.30, 0, 0.5, 0.42, mt);
      box(0.05, -1.55, 0, 0.6, 1.45, 0.62, pl, gripRake * 0.4); box(-1.55, 0.05, 0, 0.7, 0.86, 0.62, pl);
      box(2.15, 0.92, 0, 0.14, 0.34, 0.18, st); box(0.7, 0.92, 0, 0.16, 0.28, 0.42, st);
      box(0.55, 0.58, 0, 1.15, 0.1, 0.32, gl); A.muzzle = base + S * 2.95;
    } else if (kind === 'burst') {
      box(0.4, -1.2, 0, 0.58, 1.4, 0.86, pl, gripRake); box(0.5, 0.18, 0, 2.5, 0.98, 0.86, mt);
      cylX(2.0, 0.35, 0, 2.6, 0.40, mt); cylX(3.4, 0.35, 0, 0.6, 0.50, mt);
      box(1.9, -0.05, 0, 2.2, 0.74, 0.74, pl); box(0.45, -1.7, 0, 0.7, 1.5, 0.66, pl, gripRake * 0.5);
      box(-1.85, -0.1, 0, 1.4, 1.0, 0.78, pl); cylX(0.7, 1.35, 0, 1.9, 0.42, st);
      box(1.78, 1.35, 0, 0.14, 0.46, 0.46, gl); box(0.7, 0.92, 0, 0.5, 0.1, 0.5, mt);
      box(2.5, 0.6, 0, 0.9, 0.08, 0.3, gl); A.muzzle = base + S * 3.7;
    } else if (kind === 'marksman') {
      box(0.3, -1.2, 0, 0.58, 1.4, 0.82, pl, gripRake); box(0.7, 0.2, 0, 2.9, 0.95, 0.8, mt);
      cylX(2.7, 0.28, 0, 3.6, 0.34, mt); cylX(4.6, 0.28, 0, 0.6, 0.56, mt);
      box(0.0, -1.55, 0, 0.66, 1.2, 0.56, pl, gripRake * 0.4); box(-2.4, -0.05, 0, 1.9, 1.05, 0.74, pl);
      cylX(0.9, 1.45, 0, 2.4, 0.46, st); box(2.2, 1.45, 0, 0.12, 0.50, 0.50, gl);
      box(0.9, 0.95, 0, 0.55, 0.1, 0.5, mt); box(4.0, 0.8, 0, 0.16, 0.42, 0.22, st);
      A.muzzle = base + S * 4.9;
    } else if (kind === 'crossbow') {
      box(-1.9, -0.05, 0, 2.1, 0.92, 0.74, pl); box(0.6, 0.5, 0, 2.7, 0.38, 0.46, mt);
      box(2.3, 0.5, 1.35, 0.3, 0.28, 1.8, pl); box(2.3, 0.5, -1.35, 0.3, 0.28, 1.8, pl);
      box(2.3, 0.9, 0, 0.22, 1.8, 0.1, st); box(0.4, -1.25, 0, 0.58, 1.3, 0.78, pl, gripRake);
      cylX(2.3, 0.5, 0, 0.6, 0.4, st); box(1.1, 0.5, 0, 0.55, 0.28, 0.5, gl);
      box(-1.6, -0.95, 0, 0.5, 0.28, 0.68, pl); A.muzzle = base + S * 2.6;
    } else if (kind === 'lmg') {
      box(0.35, -1.2, 0, 0.6, 1.45, 0.9, pl, gripRake); box(0.9, 0.25, 0, 3.0, 1.18, 0.92, mt);
      cylX(2.7, 0.35, 0, 2.9, 0.5, mt); cylX(4.25, 0.35, 0, 0.55, 0.62, mt);
      box(2.4, -0.1, 0, 2.0, 0.86, 0.86, pl); cylZ(0.7, -1.85, 0, 0.8, 1.18, pl); cylZ(0.7, -1.85, 0, 0.3, 0.7, mt);
      box(-2.0, 0.0, 0, 1.7, 1.0, 0.8, pl); box(3.9, 0.95, 0, 0.16, 0.4, 0.22, st);
      box(2.0, 0.55, 0, 1.1, 0.1, 0.34, gl); A.muzzle = base + S * 4.525;
    } else if (kind === 'flamethrower') {
      box(0.3, -1.2, 0, 0.6, 1.4, 0.9, pl, gripRake); box(0.7, 0.35, 0, 2.3, 1.15, 1.05, mt);
      cylX(0.8, 1.05, 0, 2.7, 0.66, st); cylX(0.8, -0.55, 0, 2.3, 0.5, mt);
      cylX(2.55, 0.3, 0, 1.3, 0.48, mt); cylX(3.3, 0.3, 0, 0.4, 0.5, mt); cylX(3.6, 0.3, 0, 0.3, 0.16, gl);
      box(0.6, -1.5, 0, 0.66, 1.1, 0.66, pl); box(0.7, 0.6, 0, 0.9, 0.1, 0.34, gl);
      A.muzzle = base + S * 3.75;
    } else { A.muzzle = base + S * 2; }
  }
  const MELEE_OFF = { punch: [-.20, -.50], kick: [-.22, -.55], blade: [-.16, -.70] };
  const eio3 = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function drawMelee(A, m, hb, tt) {
    const Mel = window.Melee; const img = Mel && Mel._sheets && (Mel._sheets[m.rarity] || {})[m.name]; if (!img) return;
    const sp = R.spriteMesh(img, { depth: m.kind === 'blade' ? .05 : .25, power: .5, allEmissive: false });
    if (!sp) { // fallback blade/fist when the sprite can't be read
      const L0 = m.length, ca0 = Math.cos(A.ang), sa0 = Math.sin(A.ang), sw = m.kind === 'blade' && m.state === 'using' ? m.restSide * Math.PI / 4 * (1 - 2 * eio3(clamp(m.t, 0, 1))) : 0, a0 = A.ang + sw, an = A.r * m.anchorDist;
      const rc0 = RARITY_COL[m.rarity] || [1.4, 1, 1.6];
      R.draw(U().box, mm(A.x + Math.cos(A.ang) * an + Math.cos(a0) * L0 * .45, hb - 2, A.z + Math.sin(A.ang) * an + Math.sin(a0) * L0 * .45, a0, L0 * .9, 2.5, m.kind === 'blade' ? 5 : 9), mat([.8, .85, .95], { metal: .9, rough: .2, emissive: [rc0[0] * .5, rc0[1] * .5, rc0[2] * .5] }));
      return;
    }
    const L = m.length, dW = L * sp.aspect, off = MELEE_OFF[m.kind] || MELEE_OFF.punch;
    const anchor = A.r * m.anchorDist, ca = Math.cos(A.ang), sa = Math.sin(A.ang);
    let swing = 0, sc = 1; const using = m.state === 'using', p = clamp(m.t, 0, 1);
    if (m.kind === 'blade') { const rest = m.restSide * Math.PI / 4; swing = rest + (-rest - rest) * (using ? eio3(p) : 0); }
    else if (using) { sc = p < .5 ? 1 - p * 2 : (p - .5) * 2; sc = clamp(sc, .05, 1); }
    const cxl = dW * (off[0] + .5) * sc, czl = L * (off[1] + .5) * sc;       // image centre in anchor frame
    const cs = Math.cos(swing), ss = Math.sin(swing);
    const lx = anchor + (cxl * cs - czl * ss), lz = (cxl * ss + czl * cs);
    const wx = A.x + ca * lx - sa * lz, wz = A.z + sa * lx + ca * lz;
    const ang = A.ang + swing;
    const rc = RARITY_COL[m.rarity] || [1.4, 1, 1.6];
    R.draw(sp.mesh, mm(wx, hb - 3, wz, ang, L * sc, L * sc * 1.0, L * sc), mat([1.15, 1.15, 1.15], { tex: sp.tex, emis: sp.emis, emisK: 1.3, rough: .35, metal: .55, emissive: [.02, .02, .03] }));
    if (using && m.kind === 'blade') { // glowing 3D swing trail
      const rest = m.restSide * Math.PI / 4, a0 = rest, a1 = swing, pts = [], n = 14;
      for (let i = 0; i <= n; i++) { const a = A.ang + lerp(a0, a1, i / n), rr = anchor + L * .85; pts.push(A.x + Math.cos(a) * rr, hb + 1, A.z + Math.sin(a) * rr); }
      const c = rc || [1, .8, .3]; const rb = m.rarity === 'god' ? [1.6, .8 + .6 * Math.sin(tt * 6), 1.6] : c;
      R.rib.line(pts, 16, 3, rb[0], rb[1], rb[2], .9);
      R.light(wx, wz, 30, 220, rb[0], rb[1], rb[2], .8);
    }
  }

  // ----------------------------------------------------------- the avatar
  function avatar(x, z, ang, r, design, colHex, tt, o) {
    const c3 = hex(colHex), hb = r * .95 + 7 + Math.sin(tt * 2.6 + (o.ph || 0)) * 1.4;
    const A = { x, z, ang, r }; const ca = Math.cos(ang), sa = Math.sin(ang);
    const loc = (lx, lz) => [x + ca * lx - sa * lz, z + sa * lx + ca * lz];
    const body = mat(c3, { metal: .55, rough: .22, emissive: [c3[0] * .1, c3[1] * .1, c3[2] * .1], rim: .6, rimCol: c3 });
    if (o.flash) body.flash = o.flash;
    const bodyAlpha = o.alpha === undefined ? 1 : o.alpha; if (bodyAlpha < 1) body.alpha = bodyAlpha;
    R.draw(U().sphere, mm(x, hb, z, ang, r * .96, r * .9, r * .96), body);
    // glowing core + visor facing direction
    R.glow(x, hb, z, r * 2.6, c3[0] * .8, c3[1] * .8, c3[2] * .8, .55, 0);
    const [vx, vz] = loc(r * .72, 0);
    R.draw(U().sphere, mm(vx, hb + 1, vz, ang, r * .34, r * .26, r * .5), mat([.02, .03, .05], { metal: .8, rough: .1, emissive: [.1, .6, 1.2], emisK: 1 }));
    const wt = tt;
    switch (design) {
      case 0: { const rad = r + 3 + Math.sin(wt * 4); R.draw(U().torus, mm(x, hb, z, 0, rad, rad, rad), mat(c3, { emissive: [c3[0] * 1.2, c3[1] * 1.2, c3[2] * 1.2], shadow: false })); break; }
      case 1: for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + wt * 1.2; R.draw(U().cone, mm(x + Math.cos(a) * (r * .8), hb + 3, z + Math.sin(a) * (r * .8), a, 4.2, 12, 4.2, 0, -(Math.PI / 2 - .3)), mat([1, .39, .47], { emissive: [.6, .12, .18], metal: .4, rough: .3 })); } break;
      case 2: for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + wt * 1.5; R.draw(U().cone, mm(x + Math.cos(a) * (r * .9), hb, z + Math.sin(a) * (r * .9), a, 3.6, 10, 3.6, 0, -(Math.PI / 2)), mat([.12, .07, .15], { metal: .6, rough: .3, emissive: [.3, .05, .1] })); } R.glow(x, hb, z, r * 3, .5, .05, .2, .35, 0); break;
      case 3: for (let i = 0; i < 3; i++) { const rd = r + 6 + i * 1.2; R.draw(U().hexRing, mm(x, hb, z, wt * .6 + i * 1.05, rd, rd, rd, i * 1.05 + wt * .4, i * .6), mat([.36, .5, .68], { emissive: [.25, .45, .8], metal: .8, rough: .25 })); } break;
      case 4: { const rd = r + 10; R.draw(U().torus, mm(x, hb + 4, z, wt, rd, rd, rd, .35), mat([.6, .8, 1], { emissive: [.6, 1.1, 1.8], shadow: false })); R.glow(x, hb + 4, z, rd * 2.4, .4, .7, 1.2, .18, 0); break; }
      case 5: for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + Math.sin(wt * 2) * .2; R.glow(x + Math.cos(a) * (r + 3), hb + Math.sin(wt * 4 + i) * 3, z + Math.sin(a) * (r + 3), 11 + Math.sin(wt * 4 + i) * 3, .75, .4, 1.2, .5, 0); }
        if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * r * 1.6, y: hb, z: z + (Math.random() - .5) * r * 1.6, vx: 0, vy: 30, vz: 0, grav: -20, life: .7, age: 0, s0: 6, s1: 1, col: [.75, .35, 1.4], a: .7, kind: 0, drag: 1 }); break;
      case 6: for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + wt; R.draw(U().octa, mm(x + Math.cos(a) * (r + 10), hb + Math.sin(wt * 2 + i) * 3, z + Math.sin(a) * (r + 10), a, 3.2, 8, 3.2), mat([.67, .93, 1], { emissive: [.4, .8, 1.2], metal: .5, rough: .1 })); } break;
      case 7: for (let i = 0; i < 3; i++) { const a = wt * 2 + i * 2.09, ex = x + Math.cos(a) * (r + 8), ez = z + Math.sin(a) * (r + 8); R.draw(U().cyl, mm(x + Math.cos(a) * (r * .5 + 4), hb, z + Math.sin(a) * (r * .5 + 4), a, 1.7, 1.7, 1.7 * 0 + 1, 0, 0), mat([0, 0, 0], { alpha: 1 })); R.draw(U().cyl, mm(x + Math.cos(a) * r * .5, hb, z + Math.sin(a) * r * .5, a, 1.8, 17, 1.8, 0, -Math.PI / 2), mat([.49, 1, .64], { emissive: [.2, .9, .4], metal: .6, rough: .25 })); R.glow(ex, hb, ez, 9, .4, 1.4, .6, .8, 0); } break;
      case 8: for (const s of [-1, 1]) { const [hx, hz] = loc(-2, s * (r + 2)); R.draw(U().sphere, mm(hx, hb + 8, hz, ang, 5, 12, 5, 0, s * .45), mat([1, .6, .24], { emissive: [1.2, .5, .1], alpha: 1 })); R.glow(hx, hb + 12, hz, 16, 1.4, .6, .15, .5, 0); } break;
      case 9: for (let i = 0; i < 3; i++) { const a = wt * 3 + i * TAU / 3; R.draw(U().box, mm(x + Math.cos(a) * (r * .2 + 9), hb, z + Math.sin(a) * (r * .2 + 9), a, 18, 3, 6), mat([.9, .93, 1], { metal: .9, rough: .12, emissive: [.1, .1, .15] })); } break;
      default: wings(design, loc, x, z, hb, ang, r, wt, c3);
    }
    if (o.gun !== false && !(o.equipMelee)) drawGun(A, o.kind || 'pistol', o.gunImg, hb);
    if (o.equipMelee && o.melee) drawMelee(A, o.melee, hb, tt);
    // ground contact glow + shadow blob
    R.quads.alpha.push(x, 1.1, z, r * 1.7, 0, 0, 0, .3, 0, 11, 0, 1);
    ring(x, z, r * 1.5, c3, .35 + .15 * Math.sin(tt * 3), 2, .06, 1.5);
    o.hb = hb; o.muzzle = A.muzzle; o.c3 = c3;
    return A;
  }
  function wings(design, loc, x, z, hb, ang, r, tt, c3) {
    const flap = Math.sin(tt * (design === 14 ? 26 : 3.2)) * (design === 14 ? .18 : .32);
    for (const s of [-1, 1]) {
      const [bx, bz] = loc(-r * .35, s * r * .55);
      if (design === 10) { // angel feathers
        for (let i = 0; i < 5; i++) { const a = ang + s * (1.35 + i * .2 + flap), L = 20 + i * 4.5, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U().sphere, mm(cx, hb + 2 + i * .6, cz, a, L * .5, 1.6, 4.6 - i * .2), mat([1, .98, .92], { emissive: [.35, .32, .25], rough: .4, rim: .5, rimCol: [1, .9, .6] })); }
        R.glow(bx, hb + 4, bz, 26, 1.1, 1, .7, .25, 0);
      } else if (design === 11) { // cyber blades
        for (let i = 0; i < 4; i++) { const a = ang + s * (1.5 + i * .22 + flap), L = 24 + (i % 2) * 8, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U().box, mm(cx, hb + 2, cz, a, L, 1.6, 4), mat([.1, .13, .18], { metal: .9, rough: .2, emissive: [.1, .6, 1.2] })); R.glow(bx + Math.cos(a) * L, hb + 2, bz + Math.sin(a) * L, 7, .3, 1, 1.6, .7, 0); }
      } else if (design === 12) { // void
        for (let i = 0; i < 4; i++) { const a = ang + s * (1.45 + i * .26 + flap), L = 26 - i * 2, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U().cone, mm(bx, hb + 2, bz, a, 3, L, 3, 0, -Math.PI / 2), mat([.1, .04, .2], { emissive: [.55, .1, .8], metal: .4, rough: .3 })); }
        R.glow(bx, hb + 3, bz, 30, .7, .2, 1.1, .3, 0);
      } else if (design === 13) { // fire
        for (let i = 0; i < 4; i++) { const a = ang + s * (1.35 + i * .24 + flap), L = 24 - i * 2, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U().sphere, mm(cx, hb + 3, cz, a, L * .55, 2.2, 4.5, 0), mat([1, .45, .1], { emissive: [1.8, .55, .08], alpha: 1, shadow: false })); }
        if (Math.random() < .35 * q()) emit({ x: bx, y: hb + 4, z: bz, vx: (Math.random() - .5) * 20, vy: 28, vz: (Math.random() - .5) * 20, life: .6, age: 0, s0: 7, s1: 1, col: [1.6, .5, .1], a: .7, kind: 0, drag: 1 });
        R.glow(bx, hb + 4, bz, 32, 1.4, .5, .1, .3, 0);
      } else { // insect: translucent
        for (let i = 0; i < 2; i++) { const a = ang + s * (1.2 + i * .5 + flap), L = 26 - i * 5, cx = bx + Math.cos(a) * L * .5, cz = bz + Math.sin(a) * L * .5;
          R.draw(U().sphere, mm(cx, hb + 3, cz, a, L * .5, .8, 6.5, 0), mat([.5, .95, 1], { emissive: [.2, .6, .7], alpha: .55, shadow: false, rim: 1, rimCol: [.5, 1, 1] })); }
      }
    }
  }

  // --------------------------------------------------- elemental aura (player)
  const ELEM = { fire: COL.fire, lightning: COL.elec, spirit: COL.spirit, water: COL.water, earth: COL.earth };
  function playerAura(x, z, r, path, tier, tt, hb) {
    if (!path) return; const c = ELEM[path]; const k = 1 + (tier || 0) * .25;
    ring(x, z, r * (2.1 + (tier || 0) * .3), c, .4, 9, tt * 2, 1.4);
    if (path === 'fire') { if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * r * 2, y: 3, z: z + (Math.random() - .5) * r * 2, vx: 0, vy: 40 + Math.random() * 40, vz: 0, life: .8, age: 0, s0: 6, s1: 1, col: COL.fire, a: .8, kind: 0, drag: .8 }); R.light(x, z, hb, 260, 1.4, .5, .12, .5 * k); }
    if (path === 'lightning') { if (Math.random() < .25) { const a = Math.random() * TAU, d = r * 2.2; bolt(x + Math.cos(a) * r, hb, z + Math.sin(a) * r, x + Math.cos(a + .6) * d, hb + 4, z + Math.sin(a + .6) * d, COL.elec, 3, .8, a * 50, 5); } R.light(x, z, hb, 240, .4, .8, 1.5, .5); }
    if (path === 'spirit') { for (let i = 0; i < 3; i++) { const a = tt * 1.6 + i * TAU / 3; R.glow(x + Math.cos(a) * (r + 12), hb + 4 + Math.sin(tt * 3 + i) * 4, z + Math.sin(a) * (r + 12), 14, .8, .4, 1.5, .8, 0); } R.light(x, z, hb, 200, .6, .3, 1.2, .4); }
    if (path === 'water') { if (Math.random() < .35 * q()) emit({ x: x + (Math.random() - .5) * r * 2.5, y: 2, z: z + (Math.random() - .5) * r * 2.5, vx: 0, vy: 26, vz: 0, life: .9, age: 0, s0: 5, s1: 2, col: [.4, .85, 1.5], a: .6, kind: 0, drag: .8 }); R.light(x, z, hb, 200, .3, .7, 1.3, .35); }
    if (path === 'earth') { for (let i = 0; i < 3 + (tier || 0); i++) { const a = tt * 1.1 + i * TAU / (3 + (tier || 0)); R.draw(U().rock3, mm(x + Math.cos(a) * (r + 11), hb - 2 + Math.sin(tt * 2 + i) * 2, z + Math.sin(a) * (r + 11), a * 2, 4.5, 4.5, 4.5, tt + i), mat([.5, .42, .3], { rough: .8, emissive: [.05, .2, .06] })); } }
  }

  // ------------------------------------------------------ status VFX (enemies)
  function statusFx(e, st, x, z, rr, hb, tt, m) {
    const path = R.F.me.glyphPath; if (!st || !path) return;
    if (st.burnT > 0) { if (Math.random() < .8 * q()) emit({ x: x + (Math.random() - .5) * rr, y: hb, z: z + (Math.random() - .5) * rr, vx: (Math.random() - .5) * 14, vy: 45 + Math.random() * 40, vz: (Math.random() - .5) * 14, life: .7, age: 0, s0: rr * .55, s1: 2, col: COL.fire, a: .9, kind: 0, drag: .6 }); R.light(x, z, hb + 8, 160, 1.5, .5, .1, .8); m.emissive = [.5 + .2 * Math.sin(tt * 18), .14, .02]; }
    if (st.staticT > 0) { if (Math.random() < .35) { const a = Math.random() * TAU; bolt(x + Math.cos(a) * rr * .3, hb, z + Math.sin(a) * rr * .3, x + Math.cos(a + 1) * rr * 1.6, hb + 6, z + Math.sin(a + 1) * rr * 1.6, COL.elec, 2.4, .9, a * 31, 5); } R.glow(x, hb, z, rr * 3.2, .4, .8, 1.5, .35 + .15 * Math.sin(tt * 20), 0); }
    if (st.hauntT > 0) { for (let i = 0; i < 3; i++) { const a = tt * 3 + i * 2.1; R.glow(x + Math.cos(a) * rr * 1.2, hb + 4 + Math.sin(tt * 4 + i) * 4, z + Math.sin(a) * rr * 1.2, 11, .75, .3, 1.5, .8, 0); } m.rim = 1.2; m.rimCol = [.7, .3, 1.4]; }
    if (st.drenchT > 0) { if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * rr, y: hb + 6, z: z + (Math.random() - .5) * rr, vx: 0, vy: -8, vz: 0, grav: 60, life: .5, age: 0, s0: 3, s1: 1.5, col: [.4, .85, 1.5], a: .8, kind: 0, drag: 0 }); m.rim = .7; m.rimCol = [.3, .7, 1.2]; m.rough = .15; }
    if (st.freezeT > 0) { m.color = [.65, .95, 1.5]; m.rim = 1.4; m.rimCol = [.5, .9, 1.6]; m.rough = .1; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + hash(rr + i) * 3; R.draw(U().cone, mm(x + Math.cos(a) * rr * .9, 0, z + Math.sin(a) * rr * .9, a, 3.4, 18 + (i % 2) * 8, 3.4, 0, -.35 * 0), mat([.75, .93, 1.1], { emissive: [.2, .5, .8], rough: .1, alpha: 1 })); } }
    if (st.bleedT > 0 && Math.random() < .4) emit({ x, y: hb, z, vx: (Math.random() - .5) * 40, vy: 30, vz: (Math.random() - .5) * 40, grav: 120, life: .5, age: 0, s0: 3, s1: 1.5, col: [1.2, .1, .1], a: .8, kind: 1 });
    if (e.stunT > 0) for (let i = 0; i < 3; i++) { const a = tt * 6 + i * 2.1; R.glow(x + Math.cos(a) * rr * .8, hb + 16, z + Math.sin(a) * rr * .8, 6, 1.8, 1.6, .4, .9, 5); }
  }

  // model matrix for a sprite-mesh that leans toward the camera (so top-down art faces the 3rd-person view)
  const _t1 = new Float32Array(16), _t2 = new Float32Array(16);
  function tiltMM(x, y, z, ang, sx, sy, sz, tau) {
    const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;      // camera-right axis (horizontal)
    M.trs(_t1, 0, 0, 0, ang, sx, sy, sz);
    const co = Math.cos(tau), si = Math.sin(tau), t = 1 - co, o = _t2; o.fill(0); o[15] = 1;
    o[0] = co + t * ux * ux; o[1] = si * uz; o[2] = t * ux * uz;
    o[4] = -si * uz; o[5] = co; o[6] = si * ux;
    o[8] = t * ux * uz; o[9] = -si * ux; o[10] = co + t * uz * uz;
    const out = mm(0, 0, 0, 0, 1, 1, 1); M.mul(out, o, _t1); out[12] = x; out[13] = y + R.groundY(x, z); out[14] = z; return out;
  }
  const TILT = 0.98;
  // textured sprite unavailable (e.g. file://): build a stylised 3D monster from primitives
  function proceduralMonster(e, type, rr, ang, hb, tt, ec, ph) {
    const x = e.x, z = e.y, c = Math.cos(ang), s = Math.sin(ang), k = type === 'boss' ? 1.5 : type === 'tank' ? 1.25 : 1;
    const base = [ec[0] * .38, ec[1] * .38, ec[2] * .38], glow = [ec[0] * .5, ec[1] * .5, ec[2] * .5];
    const body = mat(base, { metal: .35, rough: .4, emissive: [glow[0] * .35, glow[1] * .35, glow[2] * .35], rim: .8, rimCol: ec });
    R.draw(U().sphere, mm(x, hb + rr * .4, z, ang, rr * 1.15 * k, rr * .85 * k, rr * 1.0 * k), body);
    for (const sd of [-1, 1]) { const ex = x + c * rr * .85 * k - s * sd * rr * .35, ez = z + s * rr * .85 * k + c * sd * rr * .35; R.draw(U().sphereLo, mm(ex, hb + rr * .6, ez, 0, rr * .18, rr * .18, rr * .18), mat([1, 1, 1], { emissive: [ec[0] * 2, ec[1] * 2, ec[2] * 2], shadow: false })); R.glow(ex, hb + rr * .6, ez, rr * .9, ec[0], ec[1], ec[2], .6, 0); }
    if (type === 'tank') for (const sd of [-1, 1]) R.draw(U().box, mm(x - s * sd * rr * 1.1, hb + rr * .4, z + c * sd * rr * 1.1, ang, rr * .9, rr * .8, rr * .5), mat([.25, .3, .3], { metal: .7, rough: .35 }));
    else if (type === 'sniper' || type === 'shooter') R.draw(U().cyl, mm(x + c * rr * 1.1, hb + rr * .35, z + s * rr * 1.1, ang, rr * .12, rr * 1.4, rr * .12, 0, -Math.PI / 2), mat([.12, .14, .17], { metal: .9, rough: .25 }));
    else if (type === 'bomber') for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + tt; R.draw(U().cone, mm(x + Math.cos(a) * rr * .9, hb + rr * .5, z + Math.sin(a) * rr * .9, a, rr * .2, rr * .6, rr * .2, 0, -Math.PI / 2), mat([.9, .25, .08], { emissive: [1.2, .3, .05] })); }
    else if (type === 'healer') { R.draw(U().box, mm(x, hb + rr * 1.5 + Math.sin(tt * 3) * 2, z, tt, rr * .9, rr * .22, rr * .22), mat([.5, 1.6, .3], { emissive: [.4, 1.5, .2], shadow: false })); R.draw(U().box, mm(x, hb + rr * 1.5 + Math.sin(tt * 3) * 2, z, tt, rr * .22, rr * .9, rr * .22), mat([.5, 1.6, .3], { emissive: [.4, 1.5, .2], shadow: false })); }
    else if (type === 'boss') { for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + tt * .4; R.draw(U().cone, mm(x + Math.cos(a) * rr * 1.2, hb + rr * .6, z + Math.sin(a) * rr * 1.2, a, rr * .18, rr * 1.1, rr * .18, 0, -Math.PI / 2 + .5), mat([.1, .35, .32], { emissive: [.6, .15, .8] })); } R.draw(U().torus, mm(x, hb + rr * 1.6, z, tt, rr * .8, rr * .8, rr * .8, .3), mat([1.4, .4, 1.5], { emissive: [1.4, .4, 1.5], shadow: false })); }
    else for (let i = 0; i < 4; i++) { const a = ang + (i - 1.5) * .6; R.draw(U().cone, mm(x + Math.cos(a + Math.PI) * rr * .9, hb + rr * .5, z + Math.sin(a + Math.PI) * rr * .9, a + Math.PI, rr * .16, rr * .8, rr * .16, 0, -Math.PI / 2 + .4), mat(base, { metal: .4, rough: .4 })); }
  }
  // --------------------------------------------------------------- enemies
  const prevEnemies = new Map();
  function drawEnemies(F, tt, dt) {
    const keys = new Set(); const me = F.me;
    for (const e of F.enemies) {
      if (!e) continue; const kk = e.id !== undefined ? e.id : e; keys.add(kk);
      R._zOv = (typeof e.z === 'number') ? e.z : null;
      try {
      prevEnemies.set(kk, { x: e.x, y: e.y, r: e.r || 16, type: e.type });
      if (e.type === 'hearth_warden' && window.HearthWarden) { window.HearthWarden.draw3D(R, e, tt); } else if (e.type === 'pharaoh_glass' && window.PharaohGlass) { window.PharaohGlass.draw3D(R, e, tt); } else if (e.type === 'rime_oracle' && window.RimeOracle) { window.RimeOracle.draw3D(R, e, tt); } else if (e.type === 'magma_titan' && window.MagmaTitan) { window.MagmaTitan.draw3D(R, e, tt); } else if (e.type === 'void' && window.VoidBoss) { window.VoidBoss.draw3D(R, e, tt); } else if (e.type === 'hollow' && window.HollowBoss) { window.HollowBoss.draw3D(R, e, tt); } else {
      const type = e.type, rr = e.r ?? 16, drawR = (type === 'boss' || type === 'hearth_warden' || type === 'pharaoh_glass' || type === 'magma_titan') ? rr + 12 : rr + 6, size = drawR * 2.1;
      const key = ENEMY_SPRITE[type] || type, img = F.sprites && F.sprites[key], ph = idHash(e) * 6.28;
      const ang = Math.atan2(me.y - e.y, me.x - e.x);
      const tps = R.isTps, hov = 4 + Math.sin(tt * 3 + ph) * 1.3, hb = hov + (tps ? size * .42 : size * .18);
      const m = mat([1.18, 1.18, 1.18], { rough: .5, metal: .15, emissive: [.03, .03, .035], emisK: 1.6 });
      const sp = img && R.spriteMesh(img, { depth: type === 'boss' ? .6 : .55, power: .4 });
      const st = F.status ? F.status(e) : null;
      const ec = ENEMY_COL[type] || [1, 1, 1];
      if (e.alerted) m.emissive = [.06, .04, .02];
      statusFx(e, st, e.x, e.y, rr, hb, tt, m);
      if (sp) { m.tex = sp.tex; m.emis = sp.emis; R.draw(sp.mesh, tps ? tiltMM(e.x, hov + size * .44, e.y, ang, size * 1.1, size * .55, size * 1.1, TILT) : mm(e.x, hov, e.y, ang, size, size * 1.35, size), m); }
      else proceduralMonster(e, type, rr, ang, hb, tt, ec, ph);
      // type-specific ambience
      if (type === 'bomber') { R.glow(e.x, hb + 4, e.y, rr * 2.4, 1.5, .4, .08, .35 + .2 * Math.sin(tt * 10 + ph), 0); R.light(e.x, e.y, hb + 8, 150, 1.5, .4, .08, .5); }
      else if (type === 'healer') { R.glow(e.x, hb + 8, e.y, rr * 3, .6, 1.5, .2, .3, 0); const hr = e.healR || 240; ring(e.x, e.y, 260, [.2, 1.2, .5], .13, 7, 0, 1.2); ring(e.x, e.y, 260, [.2, 1.3, .5], .4, 9, tt * .3, 1.4); R.light(e.x, e.y, hb + 14, 220, .3, 1.2, .3, .6); }
      else if (type === 'boss') {
        if (e.absorbing) {
          const realm = (F && F.theme && F.theme.id) || 1;
          const rc = [[.45,1,.5],[1,.7,.25],[.4,.85,1.4],[1.5,.4,.25],[.65,.35,1.5]][(realm-1)%5] || [1,.4,1.4];
          const pul = .5 + .5 * Math.sin(tt * 2.4);
          R.draw(U().sphere, mm(e.x, hb + rr * .4, e.y, tt * .4, rr * 1.7, rr * 1.7, rr * 1.7), mat(rc, { emissive: [rc[0]*.3, rc[1]*.3, rc[2]*.3], alpha: .12 + .06 * pul, rim: 2.2, rimCol: rc, shadow: false }));
          ring(e.x, e.y, rr * 1.5, rc, .5 + .25 * pul, 9, tt * 2, 1.5);
          ring(e.x, e.y, rr * 1.2, [1,1,1], .35 * pul, 9, -tt * 3, 1.6);
          for (let i = 0; i < 6; i++) { const a = tt * 1.5 + i * Math.PI / 3; emit({ x: e.x + Math.cos(a) * rr * 1.8, y: hb + rr * .4, z: e.y + Math.sin(a) * rr * 1.8, vx: -Math.cos(a) * 60, vy: 0, vz: -Math.sin(a) * 60, life: .5, age: 0, s0: 5, s1: 1, col: rc, a: .8, kind: 0, drag: 0 }); }
          R.light(e.x, e.y, hb + 14, rr * 5, rc[0], rc[1], rc[2], .6 + .2 * pul);
        } else {
          R.glow(e.x, hb + 8, e.y, rr * 6, 1.1, .3, 1.3, .3 + .1 * Math.sin(tt * 3), 0); R.light(e.x, e.y, hb + 18, 380, 1.1, .3, 1.3, .9); if (Math.random() < .5 * q()) emit({ x: e.x + (Math.random() - .5) * rr * 2, y: 4, z: e.y + (Math.random() - .5) * rr * 2, vx: 0, vy: 32, vz: 0, life: 1, age: 0, s0: 6, s1: 1, col: [1, .3, 1.3], a: .7, kind: 0, drag: .4 });
        }
      }
      else if (type === 'sniper') { R.glow(e.x + Math.cos(ang) * rr * 1.1, hb + 2, e.y + Math.sin(ang) * rr * 1.1, 9, .3, 1, 1.5, .8, 0); }
      else if (type === 'chaser' || type === 'swarm') { R.glow(e.x, hb, e.y, rr * 2.3, 1.3, .45, .1, .16, 0); }
      // contact shadow + HP ring + alert ring
      R.quads.alpha.push(e.x, 1.05 + R.groundY(e.x, e.y), e.y, rr * 1.9, 0, 0, 0, .28, 0, 11, 0, 1);
      const hp = clamp((e.hp ?? 0) / Math.max(1, e.maxhp ?? e.hp ?? 1), 0, 1);
      const hc = hp > .5 ? [lerp(1.6, .3, (hp - .5) * 2), 1.4, .4] : [1.7, lerp(.2, 1.3, hp * 2), .25];
      ring(e.x, e.y, rr + 11, [.8, .8, .9], .09, 7, 0, 1.3);
      R.decal(e.x, e.y, rr + 11, hc[0], hc[1], hc[2], .95, 6, hp, 0, true, 1.7);
      if (e.alerted) R.decal(e.x, e.y, rr + 17 + Math.sin(tt * 8) * 2, 1.8, 1.5, .5, .55, 9, tt * 2, 0, true, 1.8);
      } } finally { R._zOv = null; }
    }
    // death detection -> burst
    for (const [k, v] of prevEnemies) {
      if (keys.has(k)) continue; prevEnemies.delete(k);
      if (!F.enemies.length && v.ghost) continue;
      deathBurst(v.x, v.y, v.r, v.type);
    }
  }
  function deathBurst(x, z, r, type) {
    const c = ENEMY_COL[type] || [1.4, .5, .3], big = (type === 'boss' || type === 'hearth_warden' || type === 'pharaoh_glass' || type === 'magma_titan' || type === 'void') ? 3.2 : type === 'tank' ? 1.5 : 1;
    burst(14 * big, () => { const a = Math.random() * TAU, sp = 90 + Math.random() * 220 * big; emit({ x, y: 10, z, vx: Math.cos(a) * sp, vy: 120 + Math.random() * 200, vz: Math.sin(a) * sp, grav: 520, bounce: .35, life: 1.3 + Math.random() * .5, age: 0, s0: (2.5 + Math.random() * 4) * big, s1: 0, col: [c[0] * .6, c[1] * .6, c[2] * .6], em: .9, a: 1, mesh: 'box', rx: Math.random() * 6, ry: Math.random() * 6, vrx: (Math.random() - .5) * 14, vry: (Math.random() - .5) * 14, fadeK: 0 }); });
    burst(26 * big, () => { const a = Math.random() * TAU, sp = 60 + Math.random() * 260 * big; emit({ x, y: 8, z, vx: Math.cos(a) * sp, vy: 40 + Math.random() * 140, vz: Math.sin(a) * sp, grav: 300, life: .6 + Math.random() * .5, age: 0, s0: 7, s1: 1, col: c, a: 1, kind: 0, drag: 1.2, orient: 0 }); });
    R.emit({ x, y: 14, z, vx: 0, vy: 0, vz: 0, life: .35, age: 0, s0: r * 5 * big, s1: r * 7 * big, col: [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3], a: .9, kind: 0 });
    R.emit({ x, y: 1.8, z, vx: 0, vy: 0, vz: 0, life: .5, age: 0, s0: r * 1, s1: r * 5.5 * big, col: c, a: .9, kind: 2, param: .09, orient: 1, floor: false });
    for (let i = 0; i < 4; i++) emit({ x: x + (Math.random() - .5) * r, y: 6, z: z + (Math.random() - .5) * r, vx: (Math.random() - .5) * 40, vy: 30 + Math.random() * 30, vz: (Math.random() - .5) * 40, life: 1.1, age: 0, s0: r * .9, s1: r * 2.6, col: [.12, .1, .1], a: .5, kind: 3, add: false, drag: .8 });
    R.light(x, z, 30, 300 * big, c[0], c[1], c[2], 1.8); R.cameraKick = Math.max(R.cameraKick || 0, big * .35);
    if (type === 'healer' || type === 'boss') burst(8, (i) => emit({ x, y: 6, z, vx: (Math.random() - .5) * 50, vy: 60 + Math.random() * 50, vz: (Math.random() - .5) * 50, life: 1.4, age: 0, s0: 9, s1: 2, col: type === 'boss' ? [1, .4, 1.5] : [.5, 1.5, .4], a: .9, kind: 0, drag: .3 }));
  }

  // --------------------------------------------------------------- players
  const prevRemoteFlash = {};
  function drawLocalPlayer(F, tt) {
    const me = F.me; if (me.dead) return;
    if (R.isTps && (R.cam.fp || R.cam.tcur < 52)) { R.playerHB = 30; return; }
    /* camera jammed against a wall: don't block the view */
    const o = { kind: me.weaponKind, gunImg: me.gunImg, equipMelee: me.equipMelee, melee: me.melee, ph: 0 };
    if (me.hurtFlash > 0) o.flash = [.8 * me.hurtFlash, .1 * me.hurtFlash, .1 * me.hurtFlash];
    avatar(me.x, me.y, me.angle, me.r, me.design, me.color, tt, o);
    const hb = o.hb;
    if (me.shield > 0) { R.draw(U().sphere, mm(me.x, hb, me.y, tt, me.r * 1.9 + Math.sin(tt * 7) * 1.2, me.r * 1.9, me.r * 1.9), mat([.4, .75, 1.2], { emissive: [.02, .08, .16], alpha: .08, rim: .9, rimCol: [.4, .8, 1.3], shadow: false })); ring(me.x, me.y, me.r * 2.6, [.5, 1, 1.6], .5, 9, tt, 1.6); }
    playerAura(me.x, me.y, me.r, me.glyphPath, me.glyphTier, tt, hb);
    R.light(me.x, me.y, hb + 14, 300, o.c3[0] * .6 + .3, o.c3[1] * .6 + .3, o.c3[2] * .6 + .3, .55);
    R.playerMuzzle = o.muzzle; R.playerHB = hb;
    if (me.reloading) { R.glow(me.x + Math.cos(me.angle) * (me.r + 10), hb + 14, me.y + Math.sin(me.angle) * (me.r + 10), 10, 1.6, 1.4, .4, .5 + .3 * Math.sin(tt * 14), 5); }
    if (me.dashing) R.quads.add.push(me.x, hb, me.y, me.r * 3.4, o.c3[0], o.c3[1], o.c3[2], .5, 0, 0, 0, 0);
  }
  // A bot's glyph, made readable from across the arena without any point light, bolt or white-core ribbon:
  // an element ring on the ground, orbiting motes (more with each upgrade), one pip above its head per tier,
  // a few element-coloured particles, and an expanding ring when it levels up.
  function botAura(b, tt) {
    const el = b.glyphPath, c = ELEM[el]; if (!c) return;
    const n = b.glyphTier | 0, gz = R.groundY ? R.groundY(b.x, b.y) : 0, ph = idHash(b) * 6, pul = .75 + .25 * Math.sin(tt * 3 + ph), soft = [c[0] * .7, c[1] * .7, c[2] * .7];
    ring(b.x, b.y, 36 + n * 4, soft, (.34 + .07 * n) * pul, 9, tt * 2, 1.5);
    for (let i = 0; i < n + 1; i++) { const a = tt * (1.2 + .15 * n) + i * TAU / (n + 1) + ph; R.glow(b.x + Math.cos(a) * 34, gz + 22 + Math.sin(tt * 2 + i) * 5, b.y + Math.sin(a) * 34, 3.4, soft[0], soft[1], soft[2], .95, 0); }
    for (let i = 0; i < n; i++) R.glow(b.x + (i - (n - 1) / 2) * 9, gz + 62, b.y, 3.2, soft[0], soft[1], soft[2], .95, 0);
    if (Math.random() < .8 * q()) {
      const o = { x: b.x + (Math.random() - .5) * 40, y: gz + 3, z: b.y + (Math.random() - .5) * 34, vx: (Math.random() - .5) * 10, vy: 30 + Math.random() * 30, vz: (Math.random() - .5) * 10, life: .8, age: 0, s0: 5, s1: 1, col: soft, a: .75, kind: 0, drag: .8 };
      if (el === 'water') { o.vy = 18; o.col = [.3, .7, 1.3]; }
      else if (el === 'lightning') { o.vy = 10 + Math.random() * 40; o.vx *= 4; o.vz *= 4; o.life = .25; o.s0 = 2.4; o.col = [.8, 1.2, 1.8]; o.a = .9; }
      else if (el === 'earth') { o.vy = 14; o.col = [.5, .9, .4]; }
      else if (el === 'spirit') { o.vy = 24; o.col = [.7, .4, 1.3]; }
      emit(o);
    }
    if (b.glyphUpFlash > 0) { const f = b.glyphUpFlash / 1.2; ring(b.x, b.y, 30 + (1 - f) * 100, soft, .8 * f, 9, tt * 3, 2); }
  }
  function drawOthers(F, tt) {
    for (const b of F.bots) { if (!b) continue; R._zOv = (typeof b.z === 'number') ? b.z : null; try { const col = (F.colors[b.color ?? 0] || F.colors[0]);
      const w = F.weapons[b.weapon ?? 0]; const gi = w.kind === 'pistol' ? F.gunSheets.pistols[b.guns?.pistol ?? -1] : w.kind === 'rifle' ? F.gunSheets.rifles[b.guns?.rifle ?? -1] : F.gunSheets.shotguns[b.guns?.shotgun ?? -1];
      const o = { kind: w.kind, gunImg: gi, ph: idHash(b) * 6 }; avatar(b.x, b.y, b.ang || 0, 18, b.design ?? 0, col, tt, o);
      const hp = clamp((b.hp ?? 100) / 100, 0, 1); ring(b.x, b.y, 26, [.9, .9, .9], .12, 7, 0, 1.3); R.decal(b.x, b.y, 26, .4, 1.6, .4, .95, 6, hp, 0, true, 1.7);
      if (window.TEAMS_MODE && b.team != null) { const tc = (b.team === 0) ? [.23, .65, 1] : [1, .29, .29]; ring(b.x, b.y, 31, tc, .95, 9, tt * (b.team ? -1 : 1), 1.7); R.glow(b.x, 2, b.y, 40, tc[0], tc[1], tc[2], .25, 0);
        const bh = 50 + Math.sin(tt * 3 + (b.id||'').length) * 3; R.glow(b.x, bh, b.y, 26, tc[0]*2, tc[1]*2, tc[2]*2, .85, 0); R.draw(U().sphere, mm(b.x, bh, b.y, tt*2, 5, 7, 5), mat(tc, { emissive: [tc[0]*3, tc[1]*3, tc[2]*3], shadow: false })); R.light(b.x, b.y, bh, 120, tc[0], tc[1], tc[2], .6); }
      R.light(b.x, b.y, 30, 180, .5, .6, .8, .3);
      botAura(b, tt);
      // statuses the player's glyphs put on this bot (burning, drenched, frozen, stunned)
      statusFx(b, { burnT: b.burnT, drenchT: b.drenchT, freezeT: b.freezeT, staticT: Math.max(b.stunT || 0, b._stunT || 0) }, b.x, b.y, 18, 16, tt, {}); } finally { R._zOv = null; } }
    for (const rp of F.remotes) { if (!rp) continue; const col = F.colors[rp.color] || F.colors[0];
      const w = F.weapons[rp.weapon ?? 0]; const g = rp.guns || { pistol: -1, rifle: -1, shotgun: -1 };
      const gi = w.kind === 'pistol' && g.pistol >= 0 ? F.gunSheets.pistols[g.pistol] : w.kind === 'rifle' && g.rifle >= 0 ? F.gunSheets.rifles[g.rifle] : w.kind === 'shotgun' && g.shotgun >= 0 ? F.gunSheets.shotguns[g.shotgun] : null;
      avatar(rp.x, rp.y, rp.ang || 0, rp.r || 16, rp.design | 0, col, tt, { kind: w.kind, gunImg: gi, ph: idHash(rp) * 6 });
      R.light(rp.x, rp.y, 30, 180, .5, .6, .8, .3); }
  }

  // --------------------------------------------------------------- bullets
  function drawBullets(F, tt) {
    let nl = 0;
    for (const b of F.pBullets) {
      const ang = Math.atan2(b.vy ?? 0, b.vx ?? 1);
      const y = b.z !== undefined ? b.z - R.groundY(b.x, b.y) : 14;
      const steep = Math.abs(b.vz || 0) > .3 * Math.hypot(b.vx || 0, b.vy || 0);
      const v = (b.kind && BULLET_VIS[b.kind]) || BULLET_VIS.pistol;
      const rad = v.rad, c = b.shard ? [.8, 1.5, 1.8] : (b.color ? rgbaStr(b.color, 1.6) : v.col);
      if (v.fire) {
        // Flamethrower: a rolling fire cloud with rising embers — no clean tracer line.
        R.glow(b.x, y, b.y, rad * 3.2, 2.0, 1.0, .25, .95, 0);
        R.glow(b.x, y, b.y, rad * 1.8, 2.4, 1.6, .8, .9, 0);
        R.glow(b.x - (b.vx || 0) * 0.01, y, b.y - (b.vy || 0) * 0.01, rad * 2.4, 1.6, .7, .2, .7, 0);
        if (R.emit && Math.random() < 0.9) R.emit({ x: b.x, y, z: b.y, vx: (b.vx || 0) * 0.1 + (Math.random() - .5) * 30, vy: 20 + Math.random() * 40, vz: (b.vy || 0) * 0.1 + (Math.random() - .5) * 30, life: 0.45, age: 0, s0: rad * 1.6, s1: 1, col: [2, 1.1, .3], a: .9, kind: 0, drag: 1.2 });
        R.light(b.x, b.y, y, 160, 2.0, 1.0, .25, .8);
      } else if (b.kind === 'crossbow') {
        // Heavy bolt: long shaft + bright glowing head.
        R.streak(b.x, y, b.y, ang, rad, v.len, c[0], c[1], c[2], .95);
        R.glow(b.x, y, b.y, rad * 2.4, 1.7, 1.3, .8, .85, 0);
        R.glow(b.x, y, b.y, rad * 1.2, 2.2, 1.8, 1.2, .9, 0);
      } else {
        if (steep) { for (let k = 0; k < 4; k++) R.glow(b.x - (b.vx || 0) * k * .011, y - (b.vz || 0) * k * .011, b.y - (b.vy || 0) * k * .011, rad * (3.2 - k * .5), c[0], c[1], c[2], .75 - k * .15, 0); }
        else R.streak(b.x, y, b.y, ang, rad * 1.1 + 1.2, v.len, c[0], c[1], c[2], .95);
        R.glow(b.x, y, b.y, rad * v.glow, c[0], c[1], c[2], .5, 0);
      }
      if (nl++ < 3) R.light(b.x, b.y, y, 150, c[0], c[1], c[2], .55);
    }
    for (const b of F.eBullets) {
      const rad = b.kind === 'bomb' || b.kind === 'enemyBomb' ? 7 : (b.r ?? 4); const c = b.glyphColor ? rgbaStr(b.glyphColor, 1.5) : [1.8, .38, .4], y = b.z !== undefined ? b.z - R.groundY(b.x, b.y) : 13;
      if (rad >= 7) { R.draw(U().sphere, mm(b.x, y, b.y, tt * 2, rad, rad, rad), mat([.2, .05, .05], { emissive: [1.4 + Math.sin(tt * 18) * .6, .25, .1], metal: .5, rough: .3 })); R.glow(b.x, y, b.y, rad * 4.5, 1.8, .4, .12, .5 + .3 * Math.sin(tt * 18), 0); R.light(b.x, b.y, y, 180, 1.6, .4, .1, .6); }
      else { const ang = Math.atan2(b.vy ?? 0, b.vx ?? 1); R.streak(b.x, y, b.y, ang, rad * 1.1 + 1, 9 + rad * 1.6, c[0], c[1], c[2], .95); R.glow(b.x, y, b.y, rad * 4, c[0], c[1], c[2], .5, 0); }
    }
  }

  // --------------------------------------------------------------- pickups
  function drawPickups(F, tt) {
    for (const p of F.pickups) {
      const x = p.x, z = p.y, ph = (p.t || 0) * 6;
      if (p.type === 'bossTarget') { ring(x, z, 22, [1.8, .3, .3], .9, 2, .1, 1.8); R.glow(x, 3, z, 18, 1.8, .3, .3, .9, 5); continue; }
      if (p.type === 'bossWarn') { R.decal(x, z, p.r, 1.8, .25, .2, .7, 7, 0, 0, true, 1.5); ring(x, z, p.r, [1.8, .3, .25], .8, 9, tt * 1.5, 1.9); R.light(x, z, 40, p.r * 2, 1.8, .3, .2, .6); continue; }
      if (p.type === 'bossBoom') { const age = (Date.now() - (p.t0 ?? Date.now())) / 1000, u = clamp(age / (p.life ?? .35), 0, 1), Rr = (p.r ?? 96) * (.2 + .8 * u); ring(x, z, Rr, [1.8, .45, .25], .95 * (1 - u), 2, .12, 2); R.glow(x, 22, z, Rr * 2.2, 1.9, .6, .2, .9 * (1 - u), 0); R.light(x, z, 40, 400, 1.9, .6, .2, 1.8 * (1 - u)); continue; }
      const c = p.type === 'xp' ? [1.1, 1.5, 2] : p.type === 'health' ? [.4, 1.8, .6] : p.type === 'speed' ? [.5, 1.4, 2] : p.type === 'shield' ? [.4, .8, 2] : [1.8, 1.3, .35];
      const bob = 12 + (Math.sin(ph) + 1) * 3, rr = p.type === 'xp' ? 4 : (p.r || 9);
      const sp = tt * 2 + x;
      if (p.type === 'xp') { R.draw(U().sphere, mm(x, bob - 2, z, 0, rr, rr, rr), mat(c, { emissive: c, shadow: false })); R.glow(x, bob - 2, z, 18, c[0], c[1], c[2], .8, 0); }
      else if (p.type === 'health') { R.draw(U().box, mm(x, bob, z, sp, 12, 4, 4), mat([.4, 1.6, .5], { emissive: [.2, 1.2, .3] })); R.draw(U().box, mm(x, bob, z, sp, 4, 12, 4), mat([.4, 1.6, .5], { emissive: [.2, 1.2, .3] })); R.glow(x, bob, z, 30, c[0], c[1], c[2], .55, 0); }
      else if (p.type === 'speed') { R.draw(U().octa, mm(x, bob, z, sp, 6, 11, 6), mat(c, { emissive: [.2, .7, 1.3], metal: .3, rough: .1 })); R.glow(x, bob, z, 28, c[0], c[1], c[2], .55, 0); }
      else if (p.type === 'shield') { R.draw(U().hexRing, mm(x, bob, z, sp, 10, 10, 10, 1.2), mat(c, { emissive: [.2, .5, 1.4] })); R.draw(U().sphereLo, mm(x, bob, z, 0, 5, 5, 5), mat(c, { emissive: [.2, .5, 1.4] })); R.glow(x, bob, z, 28, c[0], c[1], c[2], .5, 0); }
      else { R.draw(U().box, mm(x, bob, z, sp, 11, 8, 8), mat([1.2, .9, .3], { emissive: [.9, .6, .1], metal: .8, rough: .25 })); R.glow(x, bob, z, 26, c[0], c[1], c[2], .5, 0); }
      ring(x, z, 14 + (Math.sin(ph) + 1) * 2, c, .45, 2, .12, 1.6);
      R.quads.add.push(x, 1.2, z, 40, c[0] * .5, c[1] * .5, c[2] * .5, .22, 0, 11, 0, 1);
      if (p.type !== 'xp') R.light(x, z, bob + 6, 120, c[0], c[1], c[2], .5);
    }
  }

  // ---------------------------------------------------------------- chests
  const CH = { common: { wood: '#6b4a1a', panel: '#9c6a2a', trim: '#e5c26a', glow: '#e5c26a', scale: 1, order: 0 }, rare: { wood: '#1e3a52', panel: '#2f5f86', trim: '#7fd4ff', glow: '#7fd4ff', scale: 1.06, order: 1 }, epic: { wood: '#3a1e52', panel: '#6a2f96', trim: '#d38aff', glow: '#d38aff', scale: 1.12, order: 2 }, legendary: { wood: '#523a1e', panel: '#a97a2a', trim: '#ffd166', glow: '#ffe38a', scale: 1.2, order: 3 } };
  function drawChests(F, tt) {
    const w = F.world; if (!w.chests) return;
    for (const ch of w.chests) {
      if (!ch || ch.opened) continue; const b = w.buildings[ch.buildingIndex]; if (!b || !b.inner) continue;
      const me = F.me, ii = b.inner; if (!(me.x >= ii.x && me.x <= ii.x + ii.w && me.y >= ii.y && me.y <= ii.y + ii.h)) continue;
      const rar = CH[ch.rarity] || CH.common, themed = !!ch.typeId, s = rar.scale * 1.55 * (themed ? 1.35 : 1), x = ch.x, z = ch.y, wood = hex(rar.wood), pan = hex(rar.panel), trim = hex(rar.trim), gl = themed ? hex(ch.glow) : hex(rar.glow);
      const pulse = .6 + .4 * Math.sin(tt * 4 + ch.id);
      R.draw(U().box, mm(x, 7 * s, z, 0, 28 * s, 14 * s, 20 * s), mat(wood, { rough: .6, metal: .1 }));
      R.draw(U().box, mm(x, 7 * s, z, 0, 25 * s, 11 * s, 22 * s), mat(pan, { rough: .45, metal: .35 }));
      R.draw(U().cyl, mm(x, 14 * s, z, 0, 9.5 * s, 28 * s, 9.5 * s, 0, Math.PI / 2 * 0), mat(pan, { alpha: 0 }));
      R.draw(U().cyl, mm(x - 14 * s, 14 * s, z, 0, 9 * s, 28 * s, 9 * s * 1.0, 0, -Math.PI / 2), mat(pan, { rough: .4, metal: .4 }));
      for (const dx of [-9, 9]) R.draw(U().box, mm(x + dx * s, 10 * s, z, 0, 3 * s, 20 * s, 23 * s), mat(trim, { metal: .9, rough: .25, emissive: [trim[0] * (rar.order ? .5 : .15), trim[1] * (rar.order ? .5 : .15), trim[2] * (rar.order ? .5 : .15)] }));
      R.draw(U().sphereLo, mm(x, 11 * s, z + 10.5 * s, 0, 2.6 * s, 2.6 * s, 2.6 * s), mat([1.5, 1.2, .4], { metal: 1, rough: .2, emissive: [.4, .3, .05] }));
      if (themed) {
        R.glow(x, 16 * s, z, 64 * s, gl[0] * 1.6, gl[1] * 1.6, gl[2] * 1.6, .4 + .25 * pulse, 0);
        R.draw(U().octa, mm(x, 38 * s + Math.sin(tt * 2 + ch.id) * 4, z, tt * 1.5, 5.5 * s, 10 * s, 5.5 * s), mat(gl, { emissive: [gl[0] * 1.8, gl[1] * 1.8, gl[2] * 1.8], metal: .4, rough: .1 }));
        ring(x, z, 38 * s, [gl[0] * 1.6, gl[1] * 1.6, gl[2] * 1.6], .65 * pulse, 9, tt, 1.9);
        ring(x, z, 50 * s, [gl[0] * 1.4, gl[1] * 1.4, gl[2] * 1.4], .4 * pulse, 7, -tt * 1.3, 1.9);
        R.light(x, z, 30, 240, gl[0], gl[1], gl[2], .95 * pulse);
        if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * 24, y: 12, z: z + (Math.random() - .5) * 24, vx: 0, vy: 30, vz: 0, life: 1.2, age: 0, s0: 5, s1: 0, col: [gl[0] * 1.8, gl[1] * 1.8, gl[2] * 1.8], a: .9, kind: 5, drag: .2 });
      } else if (rar.order > 0) {
        R.glow(x, 16 * s, z, 50 * s, gl[0] * 1.5, gl[1] * 1.5, gl[2] * 1.5, .3 + .15 * rar.order * pulse, 0);
        R.draw(U().octa, mm(x, 34 * s + Math.sin(tt * 2 + ch.id) * 3, z, tt * 1.5, 4.5 * s, 8.5 * s, 4.5 * s), mat(gl, { emissive: [gl[0] * 1.6, gl[1] * 1.6, gl[2] * 1.6], metal: .4, rough: .1 }));
        ring(x, z, 34 * s, [gl[0] * 1.5, gl[1] * 1.5, gl[2] * 1.5], .55 * pulse, 9, tt, 1.7);
        R.light(x, z, 30, 200 + rar.order * 40, gl[0], gl[1], gl[2], .9 * pulse);
        if (Math.random() < .3 * rar.order * q()) emit({ x: x + (Math.random() - .5) * 20, y: 12, z: z + (Math.random() - .5) * 20, vx: 0, vy: 30, vz: 0, life: 1.1, age: 0, s0: 4, s1: 0, col: [gl[0] * 1.7, gl[1] * 1.7, gl[2] * 1.7], a: .9, kind: 5, drag: .2 });
      } else R.light(x, z, 24, 110, 1.2, .9, .4, .4);
    }
    for (const ch of (w.deathChests || [])) { if (ch && !ch.opened) { R._zOv = ch.z || 0; try { drawDeathChest(ch, tt); } finally { R._zOv = null; } } }
    R._zOv = null;
  }
  // The Death Cache a bot leaves behind: an obsidian coffin with green soul-fire — nothing like the wooden chests.
  function drawDeathChest(ch, tt) {
    const x = ch.x, z = ch.y, s = 1.3, pulse = .65 + .35 * Math.sin(tt * 3 + 1.7), g = [.35, 1.5, .8];
    const dark = [.07, .05, .1], plate = [.14, .1, .2];
    R.draw(U().box, mm(x, 7 * s, z, 0, 34 * s, 14 * s, 17 * s), mat(dark, { rough: .35, metal: .5 }));
    R.draw(U().box, mm(x, 15 * s, z, 0, 31 * s, 5 * s, 15 * s), mat(plate, { rough: .3, metal: .6 }));
    for (const dx of [-12, 0, 12]) R.draw(U().box, mm(x + dx * s, 18 * s, z, 0, 2.2 * s, 2 * s, 16 * s), mat(g, { emissive: [g[0] * .9, g[1] * .9, g[2] * .9], shadow: false }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) R.draw(U().cone, mm(x + sx * 16 * s, 14 * s, z + sz * 7 * s, 0, 3 * s, 14 * s, 3 * s), mat(dark, { rough: .3, metal: .7 }));
    R.draw(U().sphereLo, mm(x, 27 * s + Math.sin(tt * 2 + ch.t) * 3, z, 0, 5 * s, 5.5 * s, 5 * s), mat([.85, 1, .9], { emissive: [.5, 1.2, .8], rough: .3 }));
    for (const ex of [-1.6, 1.6]) R.glow(x + ex * s, 28 * s + Math.sin(tt * 2 + ch.t) * 3, z + 4 * s, 3.4, g[0], g[1], g[2], .95, 0);
    R.glow(x, 20 * s, z, 30 * s, g[0] * .8, g[1] * .8, g[2] * .8, .16 + .08 * pulse, 0);
    ring(x, z, 38 * s, [g[0] * 1.1, g[1] * 1.1, g[2] * 1.1], .55 * pulse, 9, tt, 1.7);
    R.light(x, z, 30, 190, g[0], g[1], g[2], .45 * pulse);
    if (Math.random() < .45 * q()) emit({ x: x + (Math.random() - .5) * 26, y: 8, z: z + (Math.random() - .5) * 18, vx: 0, vy: 28 + Math.random() * 20, vz: 0, life: 1.2, age: 0, s0: 5, s1: 0, col: [g[0] * 1.4, g[1] * 1.4, g[2] * 1.4], a: .85, kind: 5, drag: .25 });
  }

  // ------------------------------------------------------ misc allies (wisps/ball/golem)
  function drawAllies(F, tt) {
    for (const w of F.wisps) { const y = 16 + Math.sin(tt * 4 + w.x) * 3; R.draw(U().sphere, mm(w.x, y, w.y, 0, 5, 5, 5), mat([1, .8, 1.6], { emissive: [1, .5, 1.8], shadow: false })); R.glow(w.x, y, w.y, 32, .8, .4, 1.5, .8 * (.6 + .4 * Math.sin(tt * 5)), 0); R.light(w.x, w.y, y, 160, .8, .4, 1.5, .7);
      if (Math.random() < .5 * q()) emit({ x: w.x, y, z: w.y, vx: (Math.random() - .5) * 10, vy: 6, vz: (Math.random() - .5) * 10, life: .6, age: 0, s0: 7, s1: 0, col: [.8, .4, 1.5], a: .6, kind: 0 }); }
    for (const b of F.balls) { const y = 18; R.draw(U().sphere, mm(b.x, y, b.y, 0, 7, 7, 7), mat([.7, 1.4, 2], { emissive: [.8, 1.8, 2.6], shadow: false })); R.glow(b.x, y, b.y, 48, .4, .9, 1.7, .9, 0); R.light(b.x, b.y, y, 260, .4, .85, 1.7, 1);
      for (let i = 0; i < 4; i++) { const a = tt * 9 + i * 1.6; bolt(b.x, y, b.y, b.x + Math.cos(a) * 18, y + Math.sin(a * 1.3) * 8, b.y + Math.sin(a) * 18, COL.elec, 2, .9, a * 13, 4); }
      if (b.zapT > 0) bolt(b.x, y, b.y, b.targetX, 14, b.targetY, COL.elec, 3.4, 1, b.x, 9); }
    if (F.golem) { const g = F.golem, rr = g.r, x = g.x, z = g.y, bob = Math.sin(tt * 3) * 1.5;
      const rk = mat([.5, .62, .48], { rough: .85, emissive: [.02, .08, .03] }), core = mat([.5, 1.8, .7], { emissive: [.4, 1.7, .6], shadow: false });
      const ang = Math.atan2(F.me.y - z, F.me.x - x);
      R.draw(U().rock, mm(x, rr * .75 + bob, z, ang, rr * 1.15, rr * .9, rr * 1.0), rk);
      R.draw(U().rock2, mm(x + Math.cos(ang) * rr * .5, rr * 1.5 + bob, z + Math.sin(ang) * rr * .5, ang, rr * .55, rr * .5, rr * .55), rk);
      for (const s of [-1, 1]) { R.draw(U().rock3, mm(x - Math.sin(ang) * s * rr * 1.1, rr * .8 + bob + Math.sin(tt * 4 + s) * 2, z + Math.cos(ang) * s * rr * 1.1, ang, rr * .5, rr * .55, rr * .5), rk); }
      R.draw(U().sphereLo, mm(x + Math.cos(ang) * rr * .62, rr * 1.55 + bob, z + Math.sin(ang) * rr * .62 - 3, 0, 3, 3, 3), core);
      R.glow(x, rr * .9, z, rr * 3.2, .4, 1.5, .55, .35 + .1 * Math.sin(tt * 3), 0); R.light(x, z, rr, 300, .4, 1.5, .55, .8);
      ring(x, z, rr * 1.8, [.5, 1.6, .6], .5, 2, .08, 1.6); R.quads.alpha.push(x, 1.1, z, rr * 2.2, 0, 0, 0, .35, 0, 11, 0, 1); }
    if (F.soulLink) { const a = F.soulLink.a, b = F.soulLink.b; const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(lerp(a.x, b.x, u), 14 + Math.sin(u * Math.PI) * 14 + Math.sin(tt * 6 + u * 9) * 3, lerp(a.y, b.y, u)); } R.rib.line(pts, 5, 5, .8, .35, 1.6, .9); R.light((a.x + b.x) / 2, (a.y + b.y) / 2, 20, 200, .8, .35, 1.5, .5); }
  }

  // ------------------------------------------------------------- effects
  const seen = new WeakSet();
  function drawEffects(F, tt) {
    for (const e of F.effects) {
      if (!e) continue; const fresh = !seen.has(e); if (fresh) seen.add(e);
      const p = clamp(e.t / (e.life || .4), 0, 1), x = e.x, z = e.y, col = e.color ? rgbaStr(e.color, 1.6) : [1.6, 1.6, 1.8];
      switch (e.type) {
        case 'muzzle': { const mx = x, mz = z; R.glow(mx, 14, mz, 22 * (1 - p) + 6, 2, 1.7, 1, .9 * (1 - p), 5); R.light(mx, mz, 16, 260, 1.8, 1.4, .8, (1 - p) * 1.6);
          if (fresh) burst(5, () => { const a = Math.random() * TAU, s = 80 + Math.random() * 160; emit({ x: mx, y: 14, z: mz, vx: Math.cos(a) * s, vy: 20 + Math.random() * 40, vz: Math.sin(a) * s, grav: 200, life: .22, age: 0, s0: 4, s1: 0, col: [2, 1.6, .8], a: 1, kind: 4, orient: 2, drag: 2 }); }); break; }
        case 'rb': R.glow(x, 12, z, (e.r ?? 3) * 4, col[0], col[1], col[2], .8, 0); break;
        case 'spark': {   // bullet fizzling into a wall / building / obstacle / hillside
          const y0 = e.z !== undefined && !isNaN(e.z) ? e.z : 16, dx = e.dx || 0, dz = e.dy || 0, f = Math.max(0, 1 - p * 2.4);
          const hot = [2, 1.55, .6], tint = [hot[0] * .65 + col[0] * .35, hot[1] * .65 + col[1] * .35, hot[2] * .65 + col[2] * .35];
          R.glow(x, y0, z, 20 * f + 5, tint[0], tint[1], tint[2], .95 * f, 5); R.light(x, z, y0, 150, tint[0], tint[1], tint[2], f * 1.3);
          if (fresh) {
            burst(11, () => { const sp = (Math.random() - .5) * 2.3, ca = Math.cos(sp), sa = Math.sin(sp), ux = dx * ca - dz * sa, uz = dx * sa + dz * ca, s = 110 + Math.random() * 260;
              emit({ x, y: y0, z, vx: ux * s + (Math.random() - .5) * 50, vy: 30 + Math.random() * 150, vz: uz * s + (Math.random() - .5) * 50, grav: 520, life: .26 + Math.random() * .34, age: 0, s0: 3.4, s1: 0, col: [tint[0], tint[1] * (.8 + Math.random() * .35), tint[2]], a: 1, kind: 4, orient: 2, drag: 1.1, bounce: .3 }); });
            burst(4, () => { const sp = (Math.random() - .5) * 1.6, ca = Math.cos(sp), sa = Math.sin(sp), ux = dx * ca - dz * sa, uz = dx * sa + dz * ca, s = 30 + Math.random() * 70;
              emit({ x, y: y0, z, vx: ux * s, vy: 20 + Math.random() * 50, vz: uz * s, grav: 120, life: .45 + Math.random() * .3, age: 0, s0: 5, s1: 0, col: [2, .75, .22], a: .9, kind: 0, drag: 1.5 }); });
          }
          break; }
        case 'hit': { R.glow(x, 14, z, 26 * (1 - p * .5), col[0], col[1], col[2], .9 * (1 - p), 5); ring(x, z, 10 + 20 * p, col, .8 * (1 - p), 2, .1, 2); R.light(x, z, 16, 180, col[0], col[1], col[2], (1 - p) * 1.4);
          if (fresh) burst(7, () => { const a = Math.random() * TAU, s = 90 + Math.random() * 170; emit({ x, y: 12, z, vx: Math.cos(a) * s, vy: 30 + Math.random() * 110, vz: Math.sin(a) * s, grav: 420, life: .35 + Math.random() * .2, age: 0, s0: 4, s1: 0, col: [col[0] * 1.1, col[1] * 1.1, col[2] * 1.1], a: 1, kind: 4, orient: 2, drag: 1.2 }); }); break; }
        case 'pop': { ring(x, z, 10 + 40 * p, col, .8 * (1 - p), 2, .1, 2); R.glow(x, 14, z, 34 * (1 - p), col[0], col[1], col[2], .7 * (1 - p), 5); if (fresh) burst(8, () => { const a = Math.random() * TAU, s = 70 + Math.random() * 120; emit({ x, y: 10, z, vx: Math.cos(a) * s, vy: 40 + Math.random() * 80, vz: Math.sin(a) * s, grav: 300, life: .4, age: 0, s0: 5, s1: 0, col, a: 1, kind: 0, drag: 1.5 }); }); break; }
        case 'elemBurst': elemBurst(e, fresh, p, x, z, tt); break;
        case 'boltStrike': { const f = Math.max(0, 1 - p * 1.4); bolt(e.x1, 16, e.y1, e.x2, 16, e.y2, COL.elec, 9 * f + 2, f, e.x1 + e.y2, 12); R.light(e.x2, e.y2, 20, 260, .5, 1, 1.8, f * 2); R.glow(e.x2, 14, e.y2, 40 * f, .6, 1.2, 2, f, 5); break; }
        case 'dashTrail': { const f = Math.max(0, 1 - p), c = hex(e.col || '#9cf'), pts = [e.x1, 12, e.y1, e.x2, 12, e.y2]; R.rib.line(pts, 22 * f + 5, 8 * f + 3, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, .8 * f); break; }
        case 'dashGhost': { const f = Math.max(0, 1 - p), c = hex(e.col || '#9cf'); R.glow(x, 14, z, (e.r || 16) * 3, c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, .7 * f, 0); break; }
        case 'dreadBloom': { const pl = .6 + .4 * Math.sin(e.t * 3); R.decal(x, z, e.r, .7, .4, 1.4, .3 * pl, 7, 0, 0, true, 1.4); ring(x, z, e.r, [.7, .4, 1.4], .5, 9, e.t, 1.6); if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * e.r * 1.6, y: 4, z: z + (Math.random() - .5) * e.r * 1.6, vx: 0, vy: 20, vz: 0, life: 1.2, age: 0, s0: 9, s1: 1, col: [.7, .35, 1.4], a: .6, kind: 0 }); break; }
        case 'triBurst': for (const s of e.shards || []) { const f = Math.max(0, 1 - e.t / e.life), c = hex(s.col || '#fff'); const y = 6 + Math.sin(Math.min(1, e.t / e.life) * Math.PI) * 20; R.draw(U().octa, mm(s.x, y, s.y, s.rot, Math.max(.1, s.r1 * .35 * f + .5), Math.max(.1, s.r3 * .2 * f + .5), Math.max(.1, s.r2 * .25 * f + .5), tt * 6), mat(c.map(v => v * 1.2), { emissive: [c[0] * 1.1, c[1] * 1.1, c[2] * 1.1], shadow: false })); } break;
        case 'tidalWave': tidal(e, p, tt); break;
        case 'ghost': { const a = Math.max(0, .65 * (1 - p)), r = Math.max(6, e.r * (.85 + .15 * Math.sin(e.t * 4))), c = rgbaStr(e.color || '#c9f', 1.5); R.glow(x, 14, z, r * 2.6, c[0], c[1], c[2], a, 0); break; }
        case 'ember': R.glow(x, 12, z, 22, 1.8, .8, .25, .9, 0); R.light(x, z, 14, 120, 1.7, .6, .15, .5); break;
        case 'mendingMist': case 'mendingPulse': { const f = Math.max(0, 1 - p); R.decal(x, z, e.r * 1.1, .4, 1.3, 1.6, .28 * f, 7, 0, 0, true, 1.3); R.decal(x, z, e.r, .5, 1.4, 1.7, .5 * f, 10, 0, 0, true, 1.5); ring(x, z, e.r * (.4 + .6 * p), [.5, 1.5, 1.7], .7 * f, 2, .08, 1.7); R.light(x, z, 30, e.r * 1.6, .4, 1.3, 1.6, f * .9); if (Math.random() < .6 * q()) emit({ x: x + (Math.random() - .5) * e.r * 1.4, y: 3, z: z + (Math.random() - .5) * e.r * 1.4, vx: 0, vy: 30, vz: 0, life: 1, age: 0, s0: 5, s1: 1, col: [.5, 1.5, 1.7], a: .7, kind: 0, drag: .5 }); break; }
        case 'shade': { const pl = .65 + .35 * Math.sin((e.t || 0) * 6), br = e.r || 18, sc = e.isWraith ? 1.6 : 1; R.draw(U().sphere, mm(x, 16 + Math.sin(tt * 3 + x) * 3, z, 0, br * .9 * sc, br * 1.1 * sc, br * .9 * sc), mat([.8, .5, 1.4], { emissive: [.5, .2, .9], alpha: .5, rim: 2, rimCol: [.8, .4, 1.6], shadow: false })); R.glow(x, 16, z, br * 4 * sc, .8, .35, 1.5, .5 * pl, 0); R.light(x, z, 20, 200 * sc, .7, .3, 1.4, .8);
          for (let i = 0; i < 3; i++) { const a = (e.t || 0) * 1.6 + i * TAU / 3, len = br * (1.7 + .3 * Math.sin((e.t || 0) * 4 + i)) * sc; R.rib.line([x, 16, z, x + Math.cos(a) * len * .5, 12 + Math.sin(tt * 3 + i) * 5, z + Math.sin(a) * len * .5, x + Math.cos(a) * len, 8, z + Math.sin(a) * len], 5, 1.5, .7, .3, 1.4, .6 * pl); }
          if (e.isWraith) R.draw(U().torus, mm(x, 16 + br * 1.5 * sc, z, tt, br * .9, br * .9, br * .9), mat([1.8, 1.4, .5], { emissive: [1.8, 1.3, .3], shadow: false })); break; }
      }
    }
  }
  function elemBurst(e, fresh, p, x, z, tt) {
    const kind = e.kind, r = e.r || 80, f = 1 - p;
    if (kind === 'fire') {
      R.glow(x, 24, z, r * 2.4 * (.4 + p * .6), 2, .9, .3, .85 * f, 0); R.glow(x, 20, z, r * 1.2, 2.2, 1.6, .8, .9 * f, 0);
      ring(x, z, r * p, COL.fireHot, .85 * f, 2, .14, 2); R.light(x, z, 40, r * 3.4, 1.9, .65, .15, 3 * f);
      if (fresh) { R.cameraKick = Math.max(R.cameraKick || 0, .5);
        burst(26, () => { const a = Math.random() * TAU, s = 60 + Math.random() * r * 2.4; emit({ x, y: 10, z, vx: Math.cos(a) * s, vy: 80 + Math.random() * 240, vz: Math.sin(a) * s, grav: 260, life: .5 + Math.random() * .6, age: 0, s0: 14, s1: 2, col: Math.random() < .5 ? COL.fire : COL.fireHot, a: 1, kind: 0, drag: .7 }); });
        burst(8, () => { const a = Math.random() * TAU, s = Math.random() * r; emit({ x: x + Math.cos(a) * s * .3, y: 8, z: z + Math.sin(a) * s * .3, vx: Math.cos(a) * 30, vy: 30 + Math.random() * 40, vz: Math.sin(a) * 30, life: 1.4, age: 0, s0: r * .3, s1: r * .8, col: [.1, .08, .07], a: .55, kind: 3, add: false, drag: .6 }); });
        burst(10, () => { const a = Math.random() * TAU, s = 80 + Math.random() * 200; emit({ x, y: 8, z, vx: Math.cos(a) * s, vy: 160 + Math.random() * 200, vz: Math.sin(a) * s, grav: 600, bounce: .4, life: 1, age: 0, s0: 2.6, s1: 0, col: [.25, .15, .1], em: 1.2, a: 1, mesh: 'rock3', rx: 0, ry: 0, vrx: 9, vry: 7, fadeK: 0 }); }); }
    } else if (kind === 'lightning') {
      ring(x, z, r * p, [.6, 1.2, 1.8], .85 * f, 2, .1, 2); R.glow(x, 20, z, r * 1.8, .5, 1.1, 1.9, .8 * f, 0); R.light(x, z, 40, r * 3, .5, .9, 1.8, 3 * f);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + (e.x * 13), len = r * Math.max(.2, p); bolt(x, 16, z, x + Math.cos(a) * len, 8, z + Math.sin(a) * len, COL.elec, 4 * f + 1, f, a * 40 + tt, 7); }
    } else if (kind === 'water') {
      ring(x, z, r * p, [.5, 1.2, 1.8], .8 * f, 2, .12, 2); R.glow(x, 18, z, r * 1.6, .3, .8, 1.7, .5 * f, 0); R.light(x, z, 30, r * 2.5, .3, .8, 1.6, 2 * f);
      if (fresh) burst(22, () => { const a = Math.random() * TAU, s = 40 + Math.random() * r * 1.8; emit({ x, y: 8, z, vx: Math.cos(a) * s, vy: 120 + Math.random() * 200, vz: Math.sin(a) * s, grav: 520, life: .8 + Math.random() * .4, age: 0, s0: 6, s1: 2, col: [.5, 1.1, 1.8], a: .9, kind: 0, drag: .4 }); });
    } else if (kind === 'earth') {
      ring(x, z, r * p, [1, .8, .5], .8 * f, 2, .14, 2); R.light(x, z, 30, r * 2, 1.1, 1, .5, 1.5 * f);
      if (fresh) { burst(14, () => { const a = Math.random() * TAU, s = 70 + Math.random() * r * 1.8; emit({ x, y: 8, z, vx: Math.cos(a) * s, vy: 160 + Math.random() * 220, vz: Math.sin(a) * s, grav: 620, bounce: .4, life: 1.2, age: 0, s0: 3 + Math.random() * 4, s1: 1, col: [.48, .38, .28], em: .05, a: 1, mesh: Math.random() < .5 ? 'rock3' : 'rock2', rx: 0, ry: 0, vrx: 8, vry: 5, fadeK: 0 }); });
        burst(6, () => { const a = Math.random() * TAU, s = Math.random() * r * .6; emit({ x: x + Math.cos(a) * s, y: 6, z: z + Math.sin(a) * s, vx: Math.cos(a) * 40, vy: 25, vz: Math.sin(a) * 40, life: 1.2, age: 0, s0: r * .3, s1: r * .7, col: [.45, .38, .27], a: .5, kind: 3, add: false, drag: .8 }); }); }
    } else if (kind === 'spirit') {
      R.glow(x, 18, z, r * 2 * (.4 + p * .6), .8, .4, 1.6, .75 * f, 0); ring(x, z, r * p, [.75, .4, 1.5], .7 * f, 2, .1, 2); R.light(x, z, 30, r * 2.4, .7, .3, 1.5, 2 * f);
      if (fresh) burst(14, (i, n) => { const a = i / n * TAU; emit({ x, y: 10, z, vx: Math.cos(a) * 60, vy: 50, vz: Math.sin(a) * 60, life: 1, age: 0, s0: 12, s1: 1, col: [.8, .4, 1.6], a: .9, kind: 0, drag: .5 }); });
    } else { ring(x, z, r * p, [1.4, 1.4, 1.6], .7 * f, 2, .1, 2); R.glow(x, 14, z, r * f, 1.4, 1.4, 1.6, .5 * f, 0); }
  }
  function tidal(e, p, tt) {
    const f = 1 - p, front = Math.max(1, e.r * p), sp = e.spread || 1.2;
    for (let layer = 0; layer < 5; layer++) {
      const h = 3 + layer * 6, off = layer * e.r * .035, pts = [], n = 22;
      for (let i = 0; i <= n; i++) { const a = e.ang - sp / 2 + sp * i / n; const rr = Math.max(1, front - off) + Math.sin(tt * 8 + i * 1.3 + layer) * 3; pts.push(e.x + Math.cos(a) * rr, h + Math.sin(tt * 6 + i * .8) * 2, e.y + Math.sin(a) * rr); }
      R.rib.line(pts, 20 - layer * 2.4, 14 - layer * 2.4, .4 + layer * .1, .9 + layer * .1, 1.5, (.7 - layer * .08) * f);
    }
    if (Math.random() < .8 * q()) { const a = e.ang + (Math.random() - .5) * sp; emit({ x: e.x + Math.cos(a) * front, y: 10, z: e.y + Math.sin(a) * front, vx: Math.cos(a) * 20, vy: 60, vz: Math.sin(a) * 20, grav: 160, life: .6, age: 0, s0: 7, s1: 2, col: [.7, 1.4, 1.8], a: .8, kind: 0 }); }
    R.light(e.x + Math.cos(e.ang) * front, e.y + Math.sin(e.ang) * front, 30, 280, .3, .8, 1.6, f * 1.4);
  }

  // ---------------------------------------------------------- world vfx
  function drawWorldVfx(F, tt) {
    for (const v of F.worldVfx) {
      const x = v.x, z = v.y, life = v.maxLife || v.life || 1, p = clamp(v.t / life, 0, 1), f = 1 - p;
      if (v.type === 'stonePillar') {
        const rise = Math.min(1, p / .12), sink = p > .85 ? 1 - (p - .85) / .15 : 1, hgt = 95 * rise * sink, rad = (v.r || 28);
        R.draw(U().rock, mm(x, hgt * .5 - 6, z, v.x * .1, rad * 1.05, hgt * .6 + 6, rad * 1.05), mat([.55, .48, .38], { rough: .85, emissive: [.02, .08, .03] }));
        R.draw(U().rock2, mm(x, hgt * .95 - 6, z, 1, rad * .8, hgt * .25, rad * .8), mat([.6, .52, .4], { rough: .85 }));
        ring(x, z, rad * 2 * (.5 + rise * .5), [1, .85, .5], .5 * f, 2, .1, 1.8); R.light(x, z, hgt, 200, .6, 1, .5, .6 * f);
        if (p < .15 && Math.random() < .7) emit({ x: x + (Math.random() - .5) * rad * 2, y: 6, z: z + (Math.random() - .5) * rad * 2, vx: (Math.random() - .5) * 60, vy: 50, vz: (Math.random() - .5) * 60, life: .8, age: 0, s0: 12, s1: 22, col: [.45, .38, .27], a: .5, kind: 3, add: false });
      } else if (v.type === 'quake') {
        const rad = v.r * (.15 + .85 * Math.min(1, p * 2.5)); ring(x, z, rad, [1.6, 1.1, .5], .9 * f, 2, .1, 2); ring(x, z, rad * .7, [1.2, .8, .4], .5 * f, 2, .06, 2);
        for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + hash(i + v.x) * .4; const pts = jag(x, 3, z, x + Math.cos(a) * rad, 3, z + Math.sin(a) * rad, 7, 16, i * 7 + v.x); R.rib.line(pts, 5, 2, 1.6, .8, .3, .7 * f); }
        R.light(x, z, 30, v.r * 2, 1.5, .9, .4, 1.4 * f); if (p < .2 && Math.random() < .8) emit({ x: x + Math.cos(Math.random() * TAU) * rad, y: 4, z: z + Math.sin(Math.random() * TAU) * rad, vx: 0, vy: 60, vz: 0, grav: 200, life: .7, age: 0, s0: 9, s1: 18, col: [.45, .38, .27], a: .5, kind: 3, add: false });
      } else if (v.type === 'sanctuary') {
        const fade = p > .85 ? (1 - p) / .15 : Math.min(1, p / .08), rad = v.r;
        R.draw(U().sphere, mm(x, 0, z, tt * .3, rad, rad * .55, rad), mat([.4, 1.1, 1.6], { emissive: [.05, .25, .35], alpha: .1 * fade, rim: 2.2 * fade, rimCol: [.5, 1.4, 1.8], shadow: false }));
        R.decal(x, z, rad, .4, 1.3, 1.7, .25 * fade, 7, 0, 0, true, 1.4); ring(x, z, rad * .96, [.5, 1.4, 1.8], .7 * fade, 9, tt * .7, 1.7); ring(x, z, rad * .6, [.5, 1.4, 1.8], .35 * fade, 9, -tt, 1.8);
        R.light(x, z, 50, rad * 1.8, .4, 1.2, 1.6, .8 * fade); if (Math.random() < .6 * q()) { const a = Math.random() * TAU, d = Math.random() * rad * .9; emit({ x: x + Math.cos(a) * d, y: 2, z: z + Math.sin(a) * d, vx: 0, vy: 36, vz: 0, life: 1.3, age: 0, s0: 4.5, s1: 0, col: [.6, 1.5, 1.8], a: .9, kind: 5, drag: .2 }); }
      } else if (v.type === 'napalm') {
        const fade = p > .8 ? (1 - p) / .2 : 1, rad = v.r;
        R.decal(x, z, rad, 1.6, .45, .08, .45 * fade, 7, 0, 0, true, 1.4); R.decal(x, z, rad * .8, 1.7, .6, .15, .3 * fade, 11, 0, 0, true, 1.5);
        R.light(x, z, 30, rad * 2.4, 1.7, .55, .12, 1.3 * fade);
        burst(3, () => { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * rad * .9; emit({ x: x + Math.cos(a) * d, y: 4, z: z + Math.sin(a) * d, vx: 0, vy: 50 + Math.random() * 60, vz: 0, life: .8, age: 0, s0: 14, s1: 2, col: Math.random() < .5 ? COL.fire : COL.fireHot, a: .9 * fade, kind: 0, drag: .5 }); });
      } else if (v.type === 'maelstrom') {
        const fade = p > .85 ? (1 - p) / .15 : Math.min(1, p / .1), rad = v.r;
        R.decal(x, z, rad, .4, 1.1, 1.7, .55 * fade, 10, 0, tt, true, 1.4); R.decal(x, z, rad * .65, .6, 1.4, 1.8, .45 * fade, 10, 0, -tt * 1.4, true, 1.5); ring(x, z, rad, [.4, 1.1, 1.7], .6 * fade, 2, .07, 1.6);
        for (let i = 0; i < 3; i++) { const pts = []; for (let k = 0; k <= 16; k++) { const u = k / 16, a = tt * 4 + i * 2.09 + u * 6, rr = rad * (1 - u * .85); pts.push(x + Math.cos(a) * rr, 3 + u * 60, z + Math.sin(a) * rr); } R.rib.line(pts, 12, 3, .4, 1, 1.6, .5 * fade); }
        R.light(x, z, 40, rad * 2, .3, .9, 1.6, .9 * fade);
      }
    }
  }

  // ------------------------------------------------------------- hazards fx
  function hazardFx(F, tt) {
    for (const h of F.world.hazards || []) {
      const cx = h.x + h.w / 2, cz = h.y + h.h / 2;
      if (h.type === 'lava') {
        const boost = h.phase === 'erupt' ? 1.5 : h.phase === 'warn' ? .9 + .4 * Math.sin(tt * 14) : h.phase === 'after' ? .8 : .45;
        R.light(cx, cz, 50, Math.max(h.w, h.h) * 1.3, 1.6, .45, .08, boost);
        if (h.phase === 'warn') ring(cx, cz, Math.max(h.w, h.h) * .6, [1.8, .3, .1], .5, 9, tt * 3, 2);
        if (h.phase === 'erupt') { burst(6, () => { const a = Math.random() * TAU, d = Math.random() * h.w * .35; emit({ x: cx + Math.cos(a) * d, y: 5, z: cz + Math.sin(a) * d * (h.h / h.w), vx: (Math.random() - .5) * 60, vy: 220 + Math.random() * 260, vz: (Math.random() - .5) * 60, grav: 420, life: 1 + Math.random() * .5, age: 0, s0: 12, s1: 3, col: Math.random() < .4 ? COL.fireHot : COL.fire, a: .95, kind: 0, drag: .1 }); }); }
        else if (Math.random() < .3 * q()) emit({ x: h.x + Math.random() * h.w, y: 4, z: h.y + Math.random() * h.h, vx: 0, vy: 30 + Math.random() * 30, vz: 0, life: 1.2, age: 0, s0: 3, s1: 0, col: COL.fire, a: .8, kind: 0, drag: .3 });
      } else if (h.type === 'ice') { R.light(cx, cz, 20, Math.max(h.w, h.h), .2, .6, 1.3, .35); if (Math.random() < .2 * q()) emit({ x: h.x + Math.random() * h.w, y: 3, z: h.y + Math.random() * h.h, vx: 0, vy: 14, vz: 0, life: 1.6, age: 0, s0: 3, s1: 0, col: [.5, 1.1, 1.8], a: .7, kind: 5 }); }
      else if (h.type === 'void') { R.light(cx, cz, 30, Math.max(h.w, h.h), .7, .3, 1.5, .5); if (Math.random() < .3 * q()) emit({ x: h.x + Math.random() * h.w, y: 3, z: h.y + Math.random() * h.h, vx: 0, vy: 22, vz: 0, life: 1.8, age: 0, s0: 4, s1: 0, col: [.8, .4, 1.6], a: .8, kind: 0 }); }
      else if (h.type === 'sand' && Math.random() < .25 * q()) emit({ x: h.x + Math.random() * h.w, y: 2, z: h.y + Math.random() * h.h, vx: 10, vy: 8, vz: 0, life: 1.4, age: 0, s0: 8, s1: 16, col: [.6, .46, .25], a: .35, kind: 3, add: false });
    }
  }

  // ---------------------------------------------------------- PvP zone
  // A Fortnite-style storm wall: only the stretch of boundary near the camera is drawn, as a faint violet curtain
  // (translucent panels, fading with height and distance) with a thin base strip. Nothing is drawn around the camera
  // when it is far from the edge, and there is no filled volume, rim light or point light, so it never washes the scene in glow.
  function drawZone(F, tt) {
    const z = F.zone; if (!z) return;
    // darker, reddish ground on the storm side of the boundary (a flat ground decal only)
    R.decal(z.cx, z.cy, z.r * 4, 1.8, .15, .15, .5, 12, z.r / (z.r * 4), 0, false, 1.2);
    const ex = R.eye[0], ez = R.eye[2], dx = ex - z.cx, dz = ez - z.cy, dc = Math.hypot(dx, dz), REACH = 1500;
    if (Math.abs(z.r - dc) < REACH) {
      const base = Math.atan2(dz, dx);
      let th = Math.PI;                                                    // half-angle of boundary within REACH of the camera
      if (dc > 1) { const cs = (z.r * z.r + dc * dc - REACH * REACH) / (2 * z.r * dc); th = cs <= -1 ? Math.PI : cs >= 1 ? .05 : Math.acos(cs); }
      const arc = 2 * th * z.r, step = Math.max(90, arc / 40), n = Math.max(2, Math.ceil(arc / step)), W = step * 1.08;
      const LAYERS = [[0, 110, .2], [110, 250, .12], [250, 430, .06]];       // [y0, y1, alpha] — fades out toward the top
      for (let i = 0; i < n; i++) {
        const a = base - th + 2 * th * (i + .5) / n, x = z.cx + Math.cos(a) * z.r, y = z.cy + Math.sin(a) * z.r;
        const f = Math.pow(Math.max(0, 1 - Math.hypot(x - ex, y - ez) / REACH), 1.4); if (f < .02) continue;
        const streak = .62 + .38 * Math.sin(i * 1.9 + tt * .9) * Math.sin(i * .73 - tt * .5 + 1.3), rot = a + Math.PI / 2;
        for (const [y0, y1, al] of LAYERS)
          R.draw(U().box, mm(x, (y0 + y1) / 2, y, rot, W, y1 - y0, 3), mat([.2, .08, .45], { emissive: [.3, .12, .7], alpha: al * f * streak, rim: 0, shadow: false }));
        R.draw(U().box, mm(x, 3, y, rot, W, 6, 7), mat([.3, .12, .6], { emissive: [.5, .22, .95], alpha: .55 * f, rim: 0, shadow: false }));   // thin base strip
      }
    }
    if (z.toR && Math.abs(z.toR - z.r) > 1 || z.mode === 'wait') { R.decal(z.toX ?? z.cx, z.toY ?? z.cy, z.toR ?? z.r, 1.1, 1.0, 1.5, .3, 9, tt, 0, true, 1.5); }   // next safe circle on the ground
  }

  // ---------------------------------------------------------- ambient
  function ambient(F, tt) {
    const id = F.theme.id, fx = R.focus[0], fz = R.focus[1], N = Math.round(110 * q());
    const RANGE = 1600;
    for (let i = 0; i < N; i++) {
      const sd = i * 97.13 + id * 13.7, rx = hash(sd), rz = hash(sd + 3.3), ph = hash(sd + 9.1);
      let x, y, zz, c, s, a, k = 0;
      if (id === 1) { x = fx + ((rx * RANGE + tt * 6) % RANGE) - RANGE / 2; zz = fz + rz * RANGE * .7 - RANGE * .35; y = 14 + ph * 70 + Math.sin(tt * .8 + sd) * 8; x += Math.sin(tt * .6 + sd) * 20; c = [.8, 1.6, .5]; s = 4.5; a = Math.max(0, .35 + .55 * Math.sin(tt * 2 + sd)); }
      else if (id === 2) { x = fx + ((rx * RANGE + tt * 70) % RANGE) - RANGE / 2; zz = fz + rz * RANGE * .7 - RANGE * .35; y = 6 + ph * 40; c = [.8, .62, .35]; s = 5 + ph * 8; a = .1 + .08 * Math.sin(tt + sd); k = 3; }
      else if (id === 3) { x = fx + rx * RANGE - RANGE / 2 + Math.sin(tt * .8 + sd) * 20; zz = fz + rz * RANGE * .7 - RANGE * .35; y = 380 - ((ph * 380 + tt * 40) % 380); c = [1.2, 1.4, 1.6]; s = 2.6 + ph * 2; a = .75; }
      else if (id === 4) { x = fx + rx * RANGE - RANGE / 2 + Math.sin(tt * .9 + sd) * 14; zz = fz + rz * RANGE * .7 - RANGE * .35; y = ((ph * 300 + tt * 38) % 300); c = [1.8, .6, .15]; s = 3; a = .5 + .4 * Math.sin(tt * 4 + sd); }
      else { x = fx + rx * RANGE - RANGE / 2 + Math.sin(tt * .4 + sd) * 24; zz = fz + rz * RANGE * .7 - RANGE * .35 + Math.cos(tt * .3 + sd) * 24; y = 20 + ph * 140 + Math.sin(tt * 1.2 + sd) * 14; c = [.9, .4, 1.8]; s = 5; a = Math.max(0, .3 + .5 * Math.sin(tt * 1.4 + sd)); }
      if (k === 3) R.quads.alpha.push(x, y, zz, s, c[0], c[1], c[2], a, 0, 3, 0, 0); else R.glow(x, y, zz, s, c[0], c[1], c[2], a, 0);
    }
  }

  // ------------------------------------------------------------ collect
  let prevHp = null;

  // ================================================== FIRST-PERSON VIEWMODEL
  // Held gun drawn in camera space (own FOV + depth clear, so it never clips into walls),
  // with walk bob, breathing, look-sway, recoil, reload / swap / dash animations and per-gun aim-down-sights.
  const VM_FOV = 62 * Math.PI / 180, sm = (a) => a * a * (3 - 2 * a);
  // ADS profile per gun. zoom = view magnification, time = seconds to raise, spread = bullet-spread multiplier,
  // move = move-speed multiplier, sens = mouse sensitivity multiplier, y/z = where the gun sits on screen, yaw = barrel angle, scope = vignette overlay
  // ADS profile per gun. zoom = view magnification, time = seconds to raise, spread = bullet-spread multiplier,
  // move = move-speed multiplier, sens = mouse sensitivity multiplier, y/z = where the gun sits on screen, yaw = barrel angle, scope = vignette overlay
  const ADS = {
    pistol:       { zoom: 1.25, time: .12, spread: .45, move: .85, sens: .85, y: -3.3, z: -17.0, yaw: .15, scope: 0 },
    rifle:        { zoom: 1.80, time: .20, spread: .22, move: .65, sens: .60, y: -3.5, z: -18.5, yaw: .15, scope: 1 },
    shotgun:      { zoom: 1.15, time: .28, spread: .60, move: .75, sens: .80, y: -3.7, z: -18.5, yaw: .15, scope: 0 },
    smg:          { zoom: 1.20, time: .10, spread: .50, move: .85, sens: .85, y: -3.3, z: -17.6, yaw: .15, scope: 0 },
    burst:        { zoom: 1.50, time: .18, spread: .30, move: .70, sens: .65, y: -3.5, z: -18.6, yaw: .15, scope: 0 },
    marksman:     { zoom: 2.40, time: .28, spread: .12, move: .50, sens: .40, y: -3.6, z: -19.0, yaw: .15, scope: 1 },
    crossbow:     { zoom: 1.70, time: .24, spread: .15, move: .60, sens: .50, y: -3.6, z: -18.6, yaw: .15, scope: 1 },
    lmg:          { zoom: 1.10, time: .30, spread: .70, move: .60, sens: .90, y: -3.6, z: -18.8, yaw: .15, scope: 0 },
    flamethrower:  { zoom: 1.00, time: .20, spread: 1.0,  move: 1.0,  sens: 1.0,  y: -3.5, z: -18.6, yaw: .15, scope: 0 }
  };
  // hip-fire pose: len = gun length on screen, x/y/z = grip position in camera space, yaw = barrel angle toward the crosshair
  const HIP = {
    pistol:  { len: 9.5, x: 6.6, y: -5.6, z: -17.5, yaw: .26 },
    rifle:   { len: 19,  x: 7.4, y: -6.4, z: -19.0, yaw: .24 },
    shotgun: { len: 20,  x: 7.4, y: -6.6, z: -19.0, yaw: .24 },
    smg:          { len: 13, x: 6.8, y: -5.8, z: -17.8, yaw: .25 },
    burst:        { len: 16, x: 7.2, y: -6.2, z: -18.6, yaw: .24 },
    marksman:     { len: 19, x: 7.4, y: -6.4, z: -19.0, yaw: .24 },
    crossbow:     { len: 15, x: 7.2, y: -6.2, z: -18.4, yaw: .24 },
    lmg:          { len: 20, x: 7.4, y: -6.6, z: -19.0, yaw: .24 },
    flamethrower:  { len: 16, x: 7.4, y: -6.4, z: -18.8, yaw: .24 }
  };
  const HIP_MELEE = { len: 16, x: 7.0, y: -6.0, z: -18.0, yaw: .20 };

  // Per-weapon grip pivot on the gun sprite (fraction of the tight image bounds).
  // Default 0.30 / 0.62; a larger gy drops the gun onto the hand for art whose
  // grip sits lower in the frame (SMG skins otherwise read a touch too high).
  const GRIPD = { gx: 0.30, gy: 0.62 };
  const GRIP = { smg: { gx: 0.30, gy: 0.70 }, burst: { gx: 0.30, gy: 0.66 }, marksman: { gx: 0.30, gy: 0.66 } };
  const VM = R.vm = { ads: 0, bob: 0, spd: 0, lx: null, lz: null, lyaw: null, lpit: null, sy: 0, sp: 0, kick: 0, flash: 0, swap: 0, sig: undefined, img: null, lastShot: null, rl: false, rtot: 1, dash: 0, on: false, prof: null, seed: 0 };
  R.vmList = [];
  const _pool = []; for (let i = 0; i < 64; i++) _pool.push(new Float32Array(16)); let _pi = 0; const nextM = () => _pool[_pi++ & 63];
  const _vInv = new Float32Array(16), _vL = new Float32Array(16), _vG = new Float32Array(16), _vR = new Float32Array(16);
  R.adsZoom = () => (VM.on && VM.prof) ? 1 + (VM.prof.zoom - 1) * sm(VM.ads) : 1;
  R.adsSpreadMul = () => (VM.on && VM.prof) ? lerp(1, VM.prof.spread, sm(VM.ads)) : 1;
  R.adsMoveMul = () => (VM.on && VM.prof) ? lerp(1, VM.prof.move, sm(VM.ads)) : 1;
  R.adsSensMul = () => (VM.on && VM.prof) ? lerp(1, VM.prof.sens, sm(VM.ads)) : 1;
  R.xhAlpha = () => (VM.on && VM.prof) ? 1 - sm(VM.ads) * (VM.prof.scope ? 1 : .85) : 1;

  // ---- per-weapon crosshair reticle (rebuilds #crosshair3d per kind, then
  // animates the gap each frame from ADS raise + movement + recoil) ----
  const CROSS = {
    pistol:       { type:'tick', gap:6,  len:7,  thick:2,   dot:2,   col:'#ffffff', dyn:7 },
    rifle:        { type:'tick', gap:4,  len:8,  thick:2,   dot:1.5, col:'#9fe3ff', dyn:4 },
    shotgun:      { type:'ring', r:12,           thick:2,  dot:0,   col:'#ffd27a', dyn:7 },
    smg:          { type:'tick', gap:8,  len:6,  thick:2,   dot:2,   col:'#cfe9ff', dyn:10 },
    burst:        { type:'tick', gap:5,  len:7,  thick:2,   dot:1.5, col:'#9fe3ff', dyn:6 },
    marksman:     { type:'tick', gap:0,  len:10, thick:1,   dot:1.5, col:'#ff5a3a', dyn:2 },
    crossbow:     { type:'tick', gap:3,  len:9,  thick:1.5, dot:0,   col:'#7dffa3', dyn:3 },
    lmg:          { type:'tick', gap:10, len:7,  thick:3,   dot:2,   col:'#ffd27a', dyn:12 },
    flamethrower: { type:'ring', r:16,           thick:2,  dot:0,   col:'#ff8a3a', dyn:8 }
  };
  function buildXh(el, cfg){
    el.style.width='80px'; el.style.height='80px'; el.style.margin='-40px 0 0 -40px';
    el.style.setProperty('--xh-col', cfg.col);
    const sh='box-shadow:0 0 4px #000,0 0 1px #000;';
    let h='';
    if(cfg.type==='ring'){
      h+='<div style="position:absolute;left:50%;top:50%;width:calc(2*var(--xh-r));height:calc(2*var(--xh-r));transform:translate(-50%,-50%);border:'+cfg.thick+'px solid var(--xh-col);border-radius:50%;'+sh+'"></div>';
      if(cfg.dot>0) h+='<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:'+cfg.dot+'px;height:'+cfg.dot+'px;background:var(--xh-col);border-radius:50%;'+sh+'"></div>';
    } else {
      const t=cfg.thick,L=cfg.len;
      h+='<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,calc(-100% - var(--xh-gap)));width:'+t+'px;height:'+L+'px;background:var(--xh-col);'+sh+'"></div>';
      h+='<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,var(--xh-gap));width:'+t+'px;height:'+L+'px;background:var(--xh-col);'+sh+'"></div>';
      h+='<div style="position:absolute;left:50%;top:50%;transform:translate(calc(-100% - var(--xh-gap)),-50%);width:'+L+'px;height:'+t+'px;background:var(--xh-col);'+sh+'"></div>';
      h+='<div style="position:absolute;left:50%;top:50%;transform:translate(var(--xh-gap),-50%);width:'+L+'px;height:'+t+'px;background:var(--xh-col);'+sh+'"></div>';
      if(cfg.dot>0) h+='<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:'+cfg.dot+'px;height:'+cfg.dot+'px;background:var(--xh-col);border-radius:50%;'+sh+'"></div>';
    }
    el.innerHTML=h;
  }
  R.updateCrosshair = function(kind){
    const el=document.getElementById('crosshair3d'); if(!el) return;
    const cfg=CROSS[kind]||CROSS.pistol;
    if(el._k!==kind){ el._k=kind; buildXh(el,cfg); }
    const ads=VM.on?sm(VM.ads):0;
    const move=clamp((VM.spd||0)/230,0,1);
    const fire=(VM.kick||0)>0.15?clamp((VM.kick||0)/1.2,0,1):0;
    const dyn=(cfg.dyn||0)*Math.max(move*0.7,fire*0.8)*(1-ads);
    el.style.setProperty('--xh-gap',((cfg.gap||0)+dyn).toFixed(1)+'px');
    if(cfg.type==='ring') el.style.setProperty('--xh-r',((cfg.r||10)+dyn*0.5).toFixed(1)+'px');
  };
  function vmUI() {
    if (R._vmUI || typeof document === 'undefined') return;
    const d = document.createElement('div'); d.id = 'scope3d';
    d.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:4;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(0,0,0,0) 0,rgba(0,0,0,0) 30%,rgba(0,0,0,.55) 52%,rgba(0,0,0,.92) 78%);';
    d.innerHTML = '<div style="position:absolute;left:34%;right:34%;top:50%;height:1px;background:rgba(255,255,255,.35)"></div><div style="position:absolute;top:34%;bottom:34%;left:50%;width:1px;background:rgba(255,255,255,.35)"></div>';
    document.body.appendChild(d); R._vmUI = d;
  }
  const imgBoxCache = new WeakMap();
  function imgBox(img) {   // tight bounds of the painted pixels (sprites have transparent padding)
    let b = imgBoxCache.get(img); if (b) return b;
    b = { x0: 0, x1: 1, y0: 0, y1: 1 };
    try {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, n = 128;
      const w = iw >= ih ? n : Math.max(8, Math.round(n * iw / ih)), h = iw >= ih ? Math.max(8, Math.round(n * ih / iw)) : n;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data; let x0 = w, x1 = -1, y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= x0 && y1 >= y0) b = { x0: x0 / w, x1: (x1 + 1) / w, y0: y0 / h, y1: (y1 + 1) / h };
    } catch (_) {}
    imgBoxCache.set(img, b); return b;
  }
  // gun sprite -> world matrix. Mesh x (image right) = barrel, mesh -z (image up) = up, mesh y (relief) faces the viewer's left (mirrored so the painted side shows).
  // For the crossbow the art is a side profile (prod perpendicular to the bolt), so the standard
  // billboard maps the prod to vertical. A real crossbow is held flat — bolt forward, prod spanning
  // transverse — so for the crossbow we lie the sprite face-up: image-right (bolt) → forward,
  // image-up (prod) → transverse, relief normal → up. The camera looks down the barrel and sees
  // the painted top face, with the prod reading left-right.
  function vmModel(out, sp, box, len, px, py, pz, yaw, rx, ry, rz, vInv, kind) {
    const bw = (box.x1 - box.x0) * sp.aspect, s = len / Math.max(.05, bw); VM.s = s;
    const gp = GRIP[VM.sig] || GRIPD;
    const gx = box.x0 + (box.x1 - box.x0) * gp.gx, gy = box.y0 + (box.y1 - box.y0) * gp.gy;   // grip pivot
    const Px = (gx - .5) * sp.aspect, Pz = gy - .5, sy = Math.sin(yaw), cy = Math.cos(yaw), G = _vG, sn = s * .55;
    if (kind === 'crossbow') {
      // flat-lying: bolt→forward, prod→transverse, normal→up
      G[0] = -sy * s;  G[1] = 0; G[2] = -cy * s;  G[3] = 0;
      G[4] = 0;        G[5] = sn; G[6] = 0;        G[7] = 0;
      G[8] = cy * s;   G[9] = 0; G[10] = -sy * s;   G[11] = 0;
    } else {
      G[0] = -sy * s; G[1] = 0; G[2] = -cy * s; G[3] = 0;
      G[4] = -cy * sn; G[5] = 0; G[6] = sy * sn; G[7] = 0;
      G[8] = 0; G[9] = -s; G[10] = 0; G[11] = 0;
    }
    G[12] = -(G[0] * Px + G[8] * Pz); G[13] = -(G[1] * Px + G[9] * Pz); G[14] = -(G[2] * Px + G[10] * Pz); G[15] = 1;
    M.trs(_vR, 0, 0, 0, ry, 1, 1, 1, rx, rz); M.mul(_vL, _vR, G);
    _vL[12] += px; _vL[13] += py; _vL[14] += pz;
    const tx = (box.x1 - .5) * sp.aspect, tz = (box.y0 + (box.y1 - box.y0) * .45) - .5;
    const tip = [_vL[0] * tx + _vL[8] * tz + _vL[12], _vL[1] * tx + _vL[9] * tz + _vL[13], _vL[2] * tx + _vL[10] * tz + _vL[14]];
    M.mul(out, vInv, _vL); return tip;
  }

  const _vH = new Float32Array(16), _vP = new Float32Array(16), _vQ = new Float32Array(16), _vT = new Float32Array(16);
  // arms + hands, built from capsules/ellipsoids in the gun's own frame (H) so they move with every gun animation
  function vmHands(L, vInv, px, py, pz, yaw, rx, ry, rz, th, barY, len, kind, melee, rel, c3) {
    M.trs(_vR, 0, 0, 0, ry, 1, 1, 1, rx, rz); M.trs(_vT, 0, 0, 0, -yaw, 1, 1, 1); M.mul(_vH, _vR, _vT);
    _vH[12] = px; _vH[13] = py; _vH[14] = pz;
    const skin = mat(c3, { metal: .45, rough: .3, emissive: [c3[0] * .12, c3[1] * .12, c3[2] * .12], rim: .5, rimCol: c3, shadow: false });
    const cuff = mat([.1, .11, .15], { metal: .8, rough: .3, emissive: [.01, .03, .06], shadow: false });
    const tp = (x, y, z) => [_vH[0] * x + _vH[4] * y + _vH[8] * z + _vH[12], _vH[1] * x + _vH[5] * y + _vH[9] * z + _vH[13], _vH[2] * x + _vH[6] * y + _vH[10] * z + _vH[14]];
    const ell = (x, y, z, sx, sy, sz, mt) => { M.trs(_vP, x, y, z, 0, sx, sy, sz); M.mul(_vQ, _vH, _vP); L.push(U().sphere, M.mul(nextM(), vInv, _vQ), mt); };
    const seg = (a0, b0, r, mt) => {
      const a = tp(a0[0], a0[1], a0[2]), b = tp(b0[0], b0[1], b0[2]);
      let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]; const Ln = Math.hypot(dx, dy, dz) || 1; dx /= Ln; dy /= Ln; dz /= Ln;
      let qx = 0, qy = 0, qz = 0; if (Math.abs(dy) < .9) qy = 1; else qx = 1;
      let xx = qy * dz - qz * dy, xy = qz * dx - qx * dz, xz = qx * dy - qy * dx; const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
      const zx = xy * dz - xz * dy, zy = xz * dx - xx * dz, zz = xx * dy - xy * dx, m = _vP;
      m[0] = xx * r; m[1] = xy * r; m[2] = xz * r; m[3] = 0; m[4] = dx * Ln; m[5] = dy * Ln; m[6] = dz * Ln; m[7] = 0; m[8] = zx * r; m[9] = zy * r; m[10] = zz * r; m[11] = 0; m[12] = a[0]; m[13] = a[1]; m[14] = a[2]; m[15] = 1;
      L.push(U().cyl, M.mul(nextM(), vInv, m), mt);
    };
    const xl = -th - .45;
    // ---- right (trigger) hand --------------------------------------------------
    // The gun art is a flat billboard lying in the hand's own x=0 plane, so anything at x>0 is
    // hidden behind it and x<0 reads as "in front". The palm therefore sits just behind the plane
    // (a round ball centred on the plane used to cut straight through the gun art and swallow the
    // fingers) and only the wrapped fingers, thumb and index come round to the near side.
    ell(.55, -.60, 1.00, .60, 1.15, 1.00, skin);      // back of the hand / knuckles
    ell(.50, -2.05, 1.15, .58, 1.20, .95, skin);      // palm heel + wrist
    ell(.42, .30, .70, .56, .62, .80, skin);          // thumb web, ties palm to thumb + index
    // three fingers wrap the grip: knuckle -> round the front -> tip curling in on the near side
    for (let i = 0; i < 3; i++) {
      const y = -.45 - i * .95, rr = .50 - i * .02, t = Math.max(xl, -1.7) - .12 + i * .13;
      seg([.95, y, .35], [.62, y - .06, -.60], rr, skin);                 // proximal, behind the gun
      seg([.62, y - .06, -.60], [.10, y - .12, -1.00], rr - .03, skin);   // middle joint, round the front
      seg([.10, y - .12, -1.00], [t, y - .14, -.62], rr - .06, skin);     // distal, curling round the side
      ell(t, y - .14, -.62, rr - .06, rr - .06, rr - .06, skin);
    }
    // thumb: out of the web, over the top of the grip, tip lying forward along the near side
    seg([.55, .50, .55], [-.12, .86, .05], .54, skin);
    seg([-.12, .86, .05], [xl + .10, .76, -1.20], .48, skin); ell(xl + .10, .76, -1.20, .45, .45, .45, skin);
    // index finger: lies along the frame above the trigger guard, curling in at the muzzle end
    seg([.80, .36, .30], [.02, .42, -.85], .49, skin);
    seg([.02, .42, -.85], [xl + .06, .56, -2.10], .44, skin); ell(xl + .06, .56, -2.10, .42, .42, .42, skin);
    seg([.60, -2.00, 1.40], [5, -8.5, 11], 1.25, skin);      // forearm
    seg([.62, -2.45, 2.00], [.95, -3.5, 4.1], 1.55, cuff);   // sleeve
    // ---- left (support) hand: wraps the handguard (pistol: under the grip); drops away while reloading
    if (!melee) {
      const zf = (kind === 'pistol' ? -len * .22 : -len * .5) + rel * 2, yb = barY - 1.7 - rel * 3.5, xm = -th * .5 - .1, x0 = xm + .55;
      ell(x0, yb, zf + .35, .60, 1.05, 1.15, skin);              // palm, under / behind the gun
      ell(x0 - .05, yb + .35, zf - 1.05, .56, .85, 1.05, skin);  // knuckles reaching forward
      // four fingers, spread along the gun, curling up the near side and over the top
      for (let i = 0; i < 4; i++) {
        const z = zf + 1.05 - i * .70, rr = .46 - i * .015;
        seg([x0 + .30, yb - .30, z], [xl - .10, yb + .15, z], rr, skin);
        seg([xl - .10, yb + .15, z], [xl - .20, yb + 1.05, z - .18], rr - .03, skin);
        seg([xl - .20, yb + 1.05, z - .18], [xl + .55, yb + 1.25, z - .35], rr - .06, skin);
        ell(xl + .55, yb + 1.25, z - .35, rr - .06, rr - .06, rr - .06, skin);
      }
      // thumb over the top on the near side
      seg([x0 + .35, yb + .35, zf + .95], [xl - .15, yb + .95, zf + .35], .50, skin);
      seg([xl - .15, yb + .95, zf + .35], [xl - .25, yb + 1.10, zf - .95], .44, skin); ell(xl - .25, yb + 1.10, zf - .95, .42, .42, .42, skin);
      seg([xm - .3, yb - .3, zf + 1.7], [-8, yb - 8, zf + 12], 1.2, skin);
      seg([xm - .35, yb - .5, zf + 2.2], [xm - 1.1, yb - 1.6, zf + 4.4], 1.5, cuff);
    }
  }
  // ------------------------------------------------------------- default (no-sprite) weapons
  // Procedural stand-ins the game falls back to when a gun sprite can't be read. Each kind gets
  // its own silhouette so a rifle, a shotgun and a pistol still read as three different weapons
  // instead of sharing one box. Parts sit in the same gun frame vmHands uses: forward = -z,
  // up = +y, width = x, grip pivot at 0.
  function defGun(L, kind, len, vInv, px, py, pz, yaw, rx, ry, rz) {
    const mt = mat([.2, .22, .32], { metal: .7, rough: .3, emissive: [.03, .06, .1], shadow: false });
    const pl = mat([.13, .14, .19], { metal: .35, rough: .6, shadow: false });
    const st = mat([.66, .71, .78], { metal: .9, rough: .2, shadow: false });
    const gl = mat([.35, .95, 1.5], { emissive: [.25, 1.1, 1.6], shadow: false });
    M.trs(_vR, 0, 0, 0, ry, 1, 1, 1, rx, rz); M.trs(_vG, 0, 0, 0, -yaw, 1, 1, 1); M.mul(_vL, _vR, _vG);
    _vL[12] = px; _vL[13] = py; _vL[14] = pz;
    const part = (y, z, sx, sy, sz, m) => { M.trs(_vP, 0, y, z, 0, sx, sy, sz); M.mul(_vQ, _vL, _vP); L.push(U().box, M.mul(nextM(), vInv, _vQ), m); };
    const cylF = (y, z, lenZ, rad, m) => { M.trs(_vP, 0, y, z, 0, rad, lenZ, rad, Math.PI / 2, 0); M.mul(_vQ, _vL, _vP); L.push(U().cyl, M.mul(nextM(), vInv, _vQ), m); };
    // grip, shared by all three: slight rearward rake, sized to the hands' wrap
    part(-0.6, 0.2, 1.15, 1.3, 1.45, pl);                   // grip top
    part(-1.7, 0.4, 1.1, 1.4, 1.35, pl);
    part(-2.8, 0.6, 1, 1.3, 1.25, pl);                      // grip bottom
    if (kind === 'shotgun') {
      part(0.55, len * -.05, 1.9, 1.7, len * .22, mt);        // receiver
      part(0.85, len * -.34, 1.8, 1.9, len * .62, mt);        // fat barrel
      part(0.05, len * -.50, 2.1, 2.1, len * .26, pl);        // pump / forend
      part(-0.45, len * -.30, 1, 1, len * .30, mt);           // magazine tube
      part(0.35, len * .32, 1.6, 2.6, len * .32, pl);         // buttstock
      part(2.05, len * -.62, 0.35, 0.35, 0.35, gl);           // bead sight
    } else if (kind === 'rifle') {
      part(0.75, len * -.28, 1.3, 1.6, len * .80, mt);        // receiver + barrel
      part(0.15, len * -.50, 1.7, 1.8, len * .30, pl);        // handguard
      part(-0.5, len * -.30, 0.95, 1.6, len * 1.20, pl);      // magazine
      part(-1.75, len * -.62, 0.9, 1.5, len * 1.15, pl);
      part(0.75, len * .30, 1.15, 1.9, len * .30, pl);        // stock
      part(2.05, len * -.16, 0.75, 0.85, len * 2.40, mt);     // optic
      part(1.45, len * -.28, 1.4, 0.2, len * .50, gl);        // glowing rail
    } else if (kind === 'smg') {
      part(0.4, len * -.05, 1.5, 0.9, len * .4, mt);          // receiver
      cylF(0.35, len * -.32, len * .5, 0.32, mt);             // barrel
      cylF(0.35, len * -.58, len * .12, 0.42, mt);            // muzzle
      part(-0.55, len * -.12, 0.7, 1.3, 0.85, pl);            // mag
      part(0.2, len * .18, 0.7, 0.8, len * .28, pl);          // stock
      part(0.7, len * -.52, 0.3, 0.3, 0.3, st);               // front sight
      part(0.4, len * -.1, 1.0, 0.15, len * .3, gl);          // accent rail
    } else if (kind === 'burst') {
      part(0.45, len * -.1, 1.6, 1.0, len * .45, mt);         // receiver
      cylF(0.4, len * -.35, len * .6, 0.36, mt);              // barrel
      cylF(0.4, len * -.68, len * .14, 0.46, mt);             // muzzle
      part(-0.1, len * -.3, 1.4, 0.8, len * .4, pl);          // handguard
      part(-0.6, len * -.15, 0.8, 1.4, 0.9, pl);             // mag
      part(0.2, len * .25, 0.8, 0.9, len * .3, pl);           // stock
      cylF(0.95, len * -.2, len * .42, 0.4, st);              // scope tube
      part(0.95, len * -.42, 0.5, 0.5, 0.5, gl);             // lens glow
      part(0.5, len * .15, len * .12, 0.2, 0.5, mt);          // scope mount
      part(0.4, len * -.05, len * .25, 0.12, 0.3, gl);       // accent rail
    } else if (kind === 'marksman') {
      part(0.5, len * -.05, 1.5, 1.0, len * .5, mt);          // receiver
      cylF(0.35, len * -.4, len * .8, 0.3, mt);               // long barrel
      cylF(0.35, len * -.82, len * .14, 0.5, mt);             // muzzle brake
      part(-0.55, len * -.15, 0.8, 1.3, 0.8, pl);             // mag
      part(0.2, len * .3, 0.9, 1.0, len * .35, pl);           // stock
      cylF(1.0, len * -.2, len * .5, 0.42, st);               // scope
      part(1.0, len * -.46, 0.5, 0.5, 0.5, gl);              // lens glow
      part(0.5, len * .1, len * .12, 0.2, 0.5, mt);           // mount
      part(0.6, len * -.7, 0.3, 0.4, 0.3, st);               // front sight tower
    } else if (kind === 'crossbow') {
      part(0.25, len * .15, 0.9, 0.9, len * .4, pl);          // stock (behind the hand)
      part(0.35, len * -.05, 0.32, 0.28, len * .45, mt);      // rail / bolt groove (forward)
      part(0.5, len * -.48, len * .7, 0.22, 0.26, pl);        // transverse bow limb (spans sideways, not along the barrel)
      cylF(0.45, len * -.55, len * .24, 0.28, st);           // bolt shaft (pointing forward)
      part(0.5, len * -.40, 0.14, 1.5, 0.1, st);              // string (vertical, at the back of the limbs)
      part(0.5, len * -.3, 0.5, 0.3, 0.5, gl);               // riser accent
    } else if (kind === 'lmg') {
      part(0.55, len * -.05, 1.8, 1.2, len * .5, mt);         // receiver
      cylF(0.4, len * -.4, len * .6, 0.45, mt);               // barrel
      cylF(0.4, len * -.75, len * .14, 0.55, mt);             // muzzle
      part(-0.1, len * -.3, 1.5, 0.9, len * .35, pl);         // handguard
      part(-0.7, len * -.2, 1.3, 1.4, 1.3, pl);              // drum mag
      part(0.2, len * .25, 0.9, 1.0, len * .3, pl);           // stock
      part(0.7, len * -.7, 0.3, 0.4, 0.3, st);               // front sight
      part(0.45, len * -.05, len * .25, 0.12, 0.34, gl);     // accent rail
    } else if (kind === 'flamethrower') {
      part(0.5, len * -.05, 1.8, 1.2, len * .45, mt);         // body
      cylF(0.85, len * -.1, len * .5, 0.6, st);               // fuel tank
      cylF(0.0, len * -.1, len * .45, 0.5, mt);              // lower tank
      cylF(0.4, len * -.45, len * .3, 0.5, mt);              // nozzle
      cylF(0.4, len * -.65, len * .12, 0.55, mt);            // nozzle tip
      cylF(0.4, len * -.75, len * .1, 0.2, gl);              // pilot light
      part(-0.7, len * -.1, 0.8, 1.2, 0.8, pl);              // tank grip
      part(0.6, len * -.05, len * .2, 0.12, 0.34, gl);       // accent
    } else {
      part(0.6, len * -.26, 1.25, 1.5, len * .56, mt);        // slide
      part(0.6, len * -.58, 0.8, 0.9, len * 1.40, mt);        // barrel tip
      part(1.3, len * -.24, 0.9, 0.22, len * .34, gl);        // slide glow
    }
    const bY = kind === 'shotgun' ? .85 : kind === 'rifle' ? .75 : kind === 'marksman' ? .35 : kind === 'lmg' ? .4 : kind === 'flamethrower' ? .4 : kind === 'smg' ? .35 : kind === 'burst' ? .4 : kind === 'crossbow' ? .5 : .60;
    const mZ = len * (kind === 'shotgun' ? .66 : kind === 'rifle' ? .70 : kind === 'marksman' ? .82 : kind === 'lmg' ? .78 : kind === 'flamethrower' ? .72 : kind === 'smg' ? .6 : kind === 'burst' ? .68 : kind === 'crossbow' ? .55 : .70);
    return [_vL[4] * bY - _vL[8] * mZ + _vL[12], _vL[5] * bY - _vL[9] * mZ + _vL[13], _vL[6] * bY - _vL[10] * mZ + _vL[14]];
  }
  R.vmUpdate = function (F, dt, tt) {
    const L = R.vmList; L.length = 0; _pi = 0;
    const v = VM, me = F.me, c = R.cam;
    v.on = !!(R.isTps && c.fp && !F.idle && !me.dead);
    if (!v.on) { v.ads = 0; v.lx = null; v.lyaw = null; v.kick = 0; v.lastShot = me.lastShot; if (R._vmUI) R._vmUI.style.opacity = 0; return; }
    const melee = !!(me.equipMelee && me.melee), kind = me.weaponKind || 'pistol';
    const prof = melee ? null : (ADS[kind] || ADS.pistol); v.prof = prof; const pr = prof || ADS.pistol;
    const sig = melee ? 'm:' + (me.melee.name || '') : kind;
    if (v.sig !== sig || (!melee && v.img !== me.gunImg)) { if (v.sig !== undefined) v.swap = 1; v.sig = sig; v.img = me.gunImg; }
    // aim down sights
    const want = !!(me.ads && prof && !me.reloading && !me.dashing);
    const stepA = dt / (prof ? prof.time : .15);
    v.ads = clamp(v.ads + (want ? stepA : -stepA * 1.5), 0, 1); const aE = sm(v.ads);
    // movement -> bob
    if (v.lx === null) { v.lx = me.x; v.lz = me.y; }
    let spd = Math.hypot(me.x - v.lx, me.y - v.lz) / dt; if (spd > 1400) spd = 0; v.lx = me.x; v.lz = me.y;
    v.spd += (spd - v.spd) * (1 - Math.exp(-dt * 10));
    const amt = clamp(v.spd / 230, 0, 1.5); v.bob += dt * (amt > .03 ? 6 + amt * 5 : 0);
    // look sway (gun lags behind the camera)
    if (v.lyaw === null) { v.lyaw = c.tyaw; v.lpit = c.tpitch; }
    let dy = c.tyaw - v.lyaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const dp = c.tpitch - v.lpit; v.lyaw = c.tyaw; v.lpit = c.tpitch;
    v.sy = clamp((v.sy - dy * .5) * Math.exp(-dt * 8), -.14, .14); v.sp = clamp((v.sp + dp * .4) * Math.exp(-dt * 8), -.1, .1);
    const sw = 1 - .6 * aE, bs = 1 - .85 * aE;
    // recoil + muzzle flash
    if (v.lastShot !== null && me.lastShot !== v.lastShot && me.lastShot > 0) {
      v.kick = Math.min(1.5, v.kick + (kind === 'shotgun' ? 1.0 : kind === 'rifle' ? .34 : .6));
      if (!melee) { v.flash = kind === 'shotgun' ? .085 : .055; v.seed = Math.random(); }
    }
    v.lastShot = me.lastShot; v.kick *= Math.exp(-dt * (kind === 'rifle' ? 13 : 10)); v.flash = Math.max(0, v.flash - dt);
    // reload dip
    let rel = 0;
    if (me.reloading) { if (!v.rl) { v.rl = true; v.rtot = Math.max(.25, me.reloadT || 1); } const p = clamp(1 - (me.reloadT || 0) / v.rtot, 0, 1); rel = sm(clamp(p / .22, 0, 1)) * (1 - sm(clamp((p - .78) / .22, 0, 1))); } else v.rl = false;
    v.dash += ((me.dashing ? 1 : 0) - v.dash) * (1 - Math.exp(-dt * 14));
    v.swap = Math.max(0, v.swap - dt * 3.4); const swE = v.swap * v.swap;
    // compose the pose
    const hip = melee ? HIP_MELEE : (HIP[kind] || HIP.pistol), len = hip.len;
    let px = lerp(hip.x, .7 * len * Math.sin(pr.yaw), aE), py = lerp(hip.y, pr.y, aE), pz = lerp(hip.z, pr.z, aE), yaw = lerp(hip.yaw, pr.yaw, aE);
    px += Math.sin(v.bob) * .5 * amt * bs + v.sy * 8 * sw + Math.sin(tt * .8) * .05 * bs - rel * 1.5;
    py += Math.sin(v.bob * 2) * .45 * amt * bs + Math.sin(tt * 1.7) * .1 * (1 - amt * .7) * bs + v.sp * 6 * sw - swE * 9 - rel * 5.5;
    pz += v.kick * 1.7 * (1 - .45 * aE) + v.dash * 1.4;
    let rx = v.kick * .075 * (1 - .45 * aE) + v.sp * 1.2 * sw - rel * .45 - swE * .5 - v.dash * .22 + Math.sin(v.bob * 2) * .012 * amt * bs;
    let ry = v.sy * sw + Math.sin(v.seed * 50) * .01 * v.kick;
    let rz = Math.sin(v.bob) * .02 * amt * bs + rel * (.55 + .05 * Math.sin(tt * 18)) + swE * .25 - v.sy * .4 * sw;
    if (melee && me.melee.state === 'using') {
      const p = clamp(me.melee.t, 0, 1), a = Math.sin(p * Math.PI);
      if (me.melee.kind === 'blade') { rz += lerp(.7, -.9, sm(p)); rx -= a * .8; pz -= a * 3; px -= a * 4; } else { pz -= a * 9; py += a; }
    }
    // draw
    const img = melee ? ((window.Melee && Melee._sheets && (Melee._sheets[me.melee.rarity] || {})[me.melee.name]) || null) : me.gunImg;
    const opt = melee ? { depth: me.melee.kind === 'blade' ? .05 : .25, power: .5, allEmissive: false } : { depth: GUN_DEPTH[kind] || .15, power: .6 };
    const sp = img ? R.spriteMesh(img, opt) : null, vInv = M.inv(_vInv, R.view), wm = nextM(); let tip;
    if (sp) {
      tip = vmModel(wm, sp, imgBox(img), len, px, py, pz, yaw, rx, ry, rz, vInv, kind);
      L.push(sp.mesh, wm, mat([1.2, 1.2, 1.2], { tex: sp.tex, emis: sp.emis, emisK: 1.5, rough: .4, metal: .5, shadow: false, emissive: [.04, .04, .05] }));
      const bb = imgBox(img), thk = clamp((opt.depth || .15) * VM.s * .55 * .9, .35, 2.2), barY = .17 * (bb.y1 - bb.y0) * VM.s;
      vmHands(L, vInv, px, py, pz, yaw, rx, ry, rz, thk, barY, len, kind, melee, rel, hex(me.color || '#aef'));
    } else if (!melee) {   // no readable sprite: procedural default weapon, one shape per kind
      // The pose above converges the flat gun art's muzzle onto the crosshair, which only reads right
      // on a billboard. Ease that cant and the sideways offset out as the sights come up, so the solid
      // model sits straight down the view axis with its bore on the centre line instead of crossing it.
      px = lerp(px, 0, aE); yaw *= 1 - aE;
      tip = defGun(L, kind, len, vInv, px, py, pz, yaw, rx, ry, rz);
      vmHands(L, vInv, px, py, pz, yaw, rx, ry, rz, .6, .8, len, kind, false, rel, hex(me.color || '#aef'));
    }
    if (v.flash > 0 && !melee && tip) {
      const f = v.flash / (kind === 'shotgun' ? .085 : .055), s = (kind === 'shotgun' ? 3.4 : 2.4) * (.6 + .6 * f) * (.8 + .4 * v.seed);
      const tm = M.trs(nextM(), tip[0] - Math.sin(yaw) * s * .4, tip[1], tip[2] - Math.cos(yaw) * s * .4, 0, s * .8, s * .7, s * 1.2);
      L.push(U().sphere, M.mul(nextM(), vInv, tm), mat([1, .85, .5], { emissive: [3.2, 2.2, .9], shadow: false }));
      R.light(R.eye[0] + Math.cos(c.tyaw) * 40, R.eye[2] + Math.sin(c.tyaw) * 40, R.eye[1] - R.groundY(R.eye[0] + Math.cos(c.tyaw) * 40, R.eye[2] + Math.sin(c.tyaw) * 40) - 4, 300, 1.8, 1.35, .8, 1.6 * f);
    }
    vmUI(); if (R._vmUI) R._vmUI.style.opacity = prof && prof.scope ? sm(clamp((v.ads - .4) / .6, 0, 1)) : 0;
  };

  // ---------------------------------------------------- themed landmark buildings (16 distinct looks)
  // Every themed building type has its OWN silhouette, material and animation — nothing is shared between types:
  //   Meadow  (realm 1): watchtower  Watchtower Cottage   barn       Timber Barn        hunter      Hunter Hut
  //   Desert  (realm 2): pyramid     Desert Pyramid       suntemple  Sun Temple         nomad       Nomad Tent      sandruin  Sandstone Ruin
  //   Frost   (realm 3): igloo       Ice Igloo            vault      Glacial Vault      frostshrine Frost Shrine
  //   Lava    (realm 4): forge       Lava Forge           bastion    Obsidian Bastion   chapel      Cinder Chapel
  //   Void    (realm 5): neonshrine  Neon Shrine          voidobelisk Void Obelisk      phasesanctum Phase Sanctum
  // WHICH LOOK A BUILDING GETS: b._look (one of the ids above) wins; otherwise the type is read from the building's own
  // fields (themeType / typeId / archetype / label / name / kind / type ...) by matching its name ("Timber Barn" -> barn);
  // otherwise a stable pick per building. R.themedLookOf(b, realmId) tells you what was chosen.
  // GLOW: all glows/lights/rings in this block go through tbGl()/tbLt()/tbRg() below — TB_GLOW is the one knob that scales them.
  // Drawn per frame with distance LOD (nothing past 2600 units; simpler shapes past 650 and 1400).
  const TB_GLOW = .42;                                           // global glow strength (lower = calmer)
  const tbGl = (x, y, z, s, c, a) => R.glow(x, y, z, s * .75, c[0], c[1], c[2], a * TB_GLOW, 0);
  const tbLt = (x, z, y, rad, c, k) => R.light(x, z, y, rad * .75, c[0], c[1], c[2], k * .3);
  const tbRg = (x, z, rad, c, a, kind, p, y) => ring(x, z, rad, c, a * .55, kind, p, y);
  const tbBlk = (x, y, z, ry, sx, sy, sz, m, rx, rz) => R.draw(U().box, mm(x, y, z, ry, sx, sy, sz, rx, rz), m);
  const tbWallPt = (b, side, u, off) => side === 0 ? [b.x + u * b.w, b.y - off] : side === 1 ? [b.x + b.w + off, b.y + u * b.h] : side === 2 ? [b.x + (1 - u) * b.w, b.y + b.h + off] : [b.x - off, b.y + (1 - u) * b.h];
  const tbMix = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  function tbSeg(mesh, ax, ay, az, bx, by, bz, r, m) {            // solid cylinder/cone between two points (y relative to ground)
    const dx = bx - ax, dy = by - ay, dz = bz - az, Ln = Math.hypot(dx, dy, dz) || 1e-3, ux = dx / Ln, uy = dy / Ln, uz = dz / Ln;
    let qx = 0, qy = 0, qz = 0; if (Math.abs(uy) < .9) qy = 1; else qx = 1;
    let xx = qy * uz - qz * uy, xy = qz * ux - qx * uz, xz = qx * uy - qy * ux; const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    const zx = xy * uz - xz * uy, zy = xz * ux - xx * uz, zz = xx * uy - xy * ux, o = mm(0, 0, 0, 0, 1, 1, 1);
    o[0] = xx * r; o[1] = xy * r; o[2] = xz * r; o[3] = 0; o[4] = dx; o[5] = dy; o[6] = dz; o[7] = 0; o[8] = zx * r; o[9] = zy * r; o[10] = zz * r; o[11] = 0;
    o[12] = ax; o[13] = ay + R.groundY(ax, az); o[14] = az; o[15] = 1; R.draw(mesh, o, m);
  }
  const tbRod = (ax, ay, az, bx, by, bz, r, m) => tbSeg(U().cyl, ax, ay, az, bx, by, bz, r, m);
  const tbSpike = (ax, ay, az, bx, by, bz, r, m) => tbSeg(U().cone, ax, ay, az, bx, by, bz, r, m);
  function tbEdge(b, a, pad) { const ca = Math.cos(a), sa = Math.sin(a), t = Math.min(Math.abs(ca) < 1e-3 ? 1e9 : (b.w / 2) / Math.abs(ca), Math.abs(sa) < 1e-3 ? 1e9 : (b.h / 2) / Math.abs(sa)) + (pad || 0); return [b.x + b.w / 2 + ca * t, b.y + b.h / 2 + sa * t, ca, sa]; }
  const tbCorners = (b) => [[b.x, b.y, -1, -1], [b.x + b.w, b.y, 1, -1], [b.x + b.w, b.y + b.h, 1, 1], [b.x, b.y + b.h, -1, 1]];

  // =============================================================== MEADOW
  // ---- Watchtower Cottage: a timber lookout tower with a shingled spire, ivy spiralling up it, a watching spectral owl
  function lookWatchtower(c) {
    const { cx, cz, H, tt, sd, det, W, D } = c, tw = Math.min(W, D) * .24, th = 175, P = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const wood = mat([.3, .19, .1], { rough: .9, emissive: [.02, .01, 0] }), shingle = mat([.2, .38, .16], { rough: .85, emissive: [.02, .08, .02] });
    const ivy = mat([.14, .46, .17], { emissive: [.03, .14, .05], rough: .6, shadow: false }), green = [.5, 1.3, .5];
    for (const [sx, sz] of P) tbRod(cx + sx * tw, H, cz + sz * tw, cx + sx * tw * .85, H + th, cz + sz * tw * .85, 4.5, wood);
    for (const k of [.3, .62]) { const y = H + th * k, s = 1 - .15 * k; for (let i = 0; i < 4; i++) { const a = P[i], b2 = P[(i + 1) % 4]; tbRod(cx + a[0] * tw * s, y, cz + a[1] * tw * s, cx + b2[0] * tw * s, y, cz + b2[1] * tw * s, 2, wood); } }
    tbBlk(cx, H + th, cz, 0, tw * 2.5, 5, tw * 2.5, wood);
    R.draw(U().cone, mm(cx, H + th + 3, cz, 0, tw * 3.3, 70, tw * 3.3), shingle);
    let px = cx + tw * 1.05, pz = cz, py = H;                                   // ivy spiralling up the tower
    for (let i = 1; i <= (det > .6 ? 14 : 7); i++) { const t = i / (det > .6 ? 14 : 7), a = t * 11 + sd, nx = cx + Math.cos(a) * tw * (1.05 - .1 * t), nz = cz + Math.sin(a) * tw * (1.05 - .1 * t), ny = H + th * t; tbRod(px, py, pz, nx, ny, nz, 2, ivy); if (i % 3 === 0) tbGl(nx, ny, nz, 9, green, .7); px = nx; py = ny; pz = nz; }
    const oy = H + th + 82 + Math.sin(tt * 1.4) * 2;                            // spectral owl on the spire
    R.draw(U().sphere, mm(cx, oy, cz, tt * .3, 13, 17, 11), mat([.5, .6, .55], { emissive: [.1, .25, .2], alpha: .6, rim: 1.2, rimCol: [.6, 1.2, .8], shadow: false }));
    for (const s of [-1, 1]) tbGl(cx + s * 3.5, oy + 5, cz + 7, 5, [1.6, 1.4, .3], .9);
    tbGl(cx, H + th - 8, cz, 22, [1.3, 1.1, .5], .5 + .2 * Math.sin(tt * 2.2));    // swaying lantern under the platform
    if (Math.random() < .5 * q()) emit({ x: cx + (Math.random() - .5) * W * 1.3, y: 10 + Math.random() * H, z: cz + (Math.random() - .5) * D * 1.3, vx: (Math.random() - .5) * 10, vy: 6, vz: (Math.random() - .5) * 10, life: 2.4, age: 0, s0: 3, s1: 0, col: [1.3, 1.5, .4], a: .7, kind: 5, drag: .2 });   // fireflies
  }
  // ---- Timber Barn: stepped gambrel roof, X-braced walls, haystacks, a cursed scarecrow and circling crows
  function lookBarn(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const timber = mat([.34, .2, .1], { rough: .9 }), roofM = mat([.42, .16, .1], { rough: .85, emissive: [.03, .01, 0] }), hay = mat([.85, .66, .24], { rough: 1, emissive: [.05, .04, .01] }), cloth = mat([.38, .3, .18], { rough: 1 });
    tbBlk(cx, H + 6, cz, 0, W * 1.08, 12, D * 1.08, roofM); tbBlk(cx, H + 16, cz, 0, W * .82, 10, D * .8, roofM); tbBlk(cx, H + 25, cz, 0, W * .56, 9, D * .5, roofM); tbBlk(cx, H + 32, cz, 0, W * .3, 6, D * .24, timber);   // stepped roof
    for (let side = 0; side < 4; side++) { const [x0, z0] = tbWallPt(b, side, .1, 3), [x1, z1] = tbWallPt(b, side, .9, 3); tbRod(x0, 6, z0, x1, H * .8, z1, 2.4, timber); tbRod(x0, H * .8, z0, x1, 6, z1, 2.4, timber); }   // X braces
    const nh = det > .5 ? 7 : 4; for (let i = 0; i < nh; i++) { const a = i / nh * TAU + sd, [ex, ez, ca, sa] = tbEdge(b, a, 20 + 8 * hash(sd + i)); R.draw(U().sphere, mm(ex, 7, ez, a, 22, 14, 22), hay); if (i % 2) tbBlk(ex + ca * 22, 5, ez + sa * 22, a, 14, 10, 10, hay); }
    // scarecrow on the roof: post, arms, sack head with burning eyes, hat
    const sx = cx + W * .18, sz = cz, sy = H + 50, sw = Math.sin(tt * 1.3) * .08;
    tbRod(sx, sy, sz, sx, sy + 86, sz, 3.2, timber); tbRod(sx - 38, sy + 66, sz + sw * 40, sx + 38, sy + 66, sz - sw * 40, 3, timber);
    R.draw(U().sphere, mm(sx, sy + 97, sz, 0, 12, 13, 12), cloth); R.draw(U().cone, mm(sx, sy + 105, sz, 0, 19, 17, 19), mat([.18, .12, .08], { rough: 1 }));
    for (const s of [-1, 1]) tbGl(sx + s * 4.5, sy + 98, sz + 10, 8, [1.7, .6, .2], .85);
    for (let i = 0; i < 5; i++) { const a = tt * .9 + i * 1.26, rr = 95 + 12 * i % 20, fl = Math.sin(tt * 9 + i) * .4; R.draw(U().sphere, mm(cx + Math.cos(a) * rr, H + 70 + Math.sin(tt * 2 + i) * 10, cz + Math.sin(a) * rr, -a, 7, 3 + fl, 3), mat([.05, .05, .07], { rough: .6 })); }   // crows
    if (Math.random() < .6 * q()) emit({ x: cx + (Math.random() - .5) * W, y: H + 10, z: cz + (Math.random() - .5) * D, vx: (Math.random() - .5) * 18, vy: 8, vz: (Math.random() - .5) * 18, grav: 40, life: 1.6, age: 0, s0: 3.5, s1: 1, col: [.85, .66, .24], a: .6, kind: 3, add: false });
  }
  // ---- Hunter Hut: great antler rack, a skull totem, bone wind-chimes, hanging pelts and a spectral wolf circling
  function lookHunter(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const bone = mat([.86, .8, .66], { rough: .7, emissive: [.04, .04, .03] }), wood = mat([.26, .17, .1], { rough: .9 }), pelt = mat([.36, .24, .14], { rough: 1 });
    for (const s of [-1, 1]) {                                                    // two antlers, each a main beam with tines
      let px = cx + s * 22, py = H, pz = cz, dx = s, dy = 1;
      for (let i = 0; i < 4; i++) { const nx = px + dx * 30 * (1 - i * .12), ny = py + 40, nz = pz + Math.sin(i * 1.3 + (s > 0 ? 0 : 2)) * 16; tbRod(px, py, pz, nx, ny, nz, 7 - i * 1.2, bone); if (i > 0) tbSpike(nx, ny, nz, nx + dx * 10, ny + 42 - i * 4, nz + 12, 3.6, bone); if (i === 1 || i === 2) tbSpike(px + (nx - px) * .5, py + 20, pz + (nz - pz) * .5, px + (nx - px) * .5 - dx * 16, py + 54, pz + (nz - pz) * .5 - 18, 3, bone); px = nx; py = ny; pz = nz; }
      tbSpike(px, py, pz, px + dx * 16, py + 40, pz, 4.5, bone);
    }
    const tx = b.x + W + 14, tz = b.y + 14; tbRod(tx, 0, tz, tx, 100, tz, 7, wood);   // skull totem at the corner
    for (let i = 0; i < 3; i++) { R.draw(U().sphere, mm(tx, 22 + i * 30, tz, i, 11, 12, 11), bone); for (const s of [-1, 1]) tbGl(tx + s * 4, 24 + i * 30, tz + 9, 5, [.5, 1.4, 1.1], .7); }
    tbBlk(tx, 98, tz, 0, 34, 5, 5, wood);
    for (let i = 0; i < (det > .5 ? 7 : 3); i++) { const [x, z] = tbWallPt(b, i % 4, .2 + .2 * (i % 3), 5), sw = Math.sin(tt * 2 + i) * 4; tbRod(x, H, z, x + sw, H - 26 - 8 * (i % 3), z, 1.6, bone); }   // bone chimes
    for (let side = 0; side < 4; side += 2) { const [x, z] = tbWallPt(b, side, .5, 3); tbBlk(x, H * .55, z, side * 1.57, 30, 44, 2.4, pelt); }
    const wa = tt * .7, wr = Math.max(W, D) * .75 + 20;                           // spectral wolf
    R.draw(U().sphere, mm(cx + Math.cos(wa) * wr, 12, cz + Math.sin(wa) * wr, -wa, 20, 8, 7), mat([.4, .8, 1.1], { emissive: [.1, .3, .45], alpha: .4, rim: 1.6, rimCol: [.5, 1.1, 1.5], shadow: false }));
    for (const s of [-1, 1]) tbGl(cx + Math.cos(wa) * wr + Math.cos(wa) * 14, 16, cz + Math.sin(wa) * wr + Math.sin(wa) * 14 + s * 3, 5, [.6, 1.6, 1.8], .8);
    tbRg(cx, cz, Math.max(W, D) * .8, [.6, .8, .5], .3, 9, tt * .2, 1.4);
  }

  // =============================================================== DESERT
  // ---- Desert Pyramid: four stepped tiers with gold trim, a floating capstone eye, scarabs on the ground, sand falling
  function lookPyramid(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const sand = mat([.78, .62, .36], { rough: .9, emissive: [.04, .03, .01] }), goldM = mat([1, .8, .3], { metal: .9, rough: .25, emissive: [.45, .32, .08], shadow: false });
    const tiers = [[.92, 32], [.7, 32], [.5, 32], [.3, 32]]; let y = H;
    tiers.forEach(([s, h], i) => { tbBlk(cx, y + h / 2, cz, 0, W * s, h, D * s, sand); tbBlk(cx, y + h + .6, cz, 0, W * s * 1.02, 1.8, D * s * 1.02, goldM); if (det > .5) for (let k = 0; k < 4; k++) tbGl(cx + (k - 1.5) * W * s * .22, y + h * .5, cz + D * s * .5 + 1, 6, [1.6, 1.2, .35], .5 + .4 * Math.sin(tt * 2 + k + i)); y += h; });
    const ey = y + 38 + Math.sin(tt * 1.4) * 4; R.draw(U().cone, mm(cx, y, cz, tt * .3, 28, 52, 28), goldM);
    R.draw(U().sphere, mm(cx, ey + 6, cz, 0, 10, 10, 10), mat([1.3, 1.1, .6], { emissive: [.9, .65, .2], shadow: false })); R.draw(U().sphereLo, mm(cx + Math.cos(tt * .6) * 2.5, ey + 6, cz + 9.5, 0, 4, 5, 2), mat([.02, .02, .03], { shadow: false }));
    tbGl(cx, ey + 6, cz, 36, [1.5, 1.1, .35], .45);
    for (let i = 0; i < (det > .5 ? 7 : 3); i++) { const a = tt * .5 + i * .9, rr = Math.hypot(W, D) * .55 + 10 + (i % 2) * 14; R.draw(U().sphere, mm(cx + Math.cos(a) * rr, 4, cz + Math.sin(a) * rr, -a, 6, 3, 4), mat([.05, .14, .13], { metal: .8, rough: .3, emissive: [.02, .1, .1] })); }   // scarabs
    for (let k = 0; k < 8; k++) { const t = (k / 8 + tt * .35) % 1; R.quads.alpha.push(cx + (hash(sd + k) - .5) * W * .3, c.gy + y + 20 - t * (y - H + 20), cz + D * .22, 9, .82, .64, .36, .3, 0, 3, 0, 0); }
    tbRg(cx, cz, Math.max(W, D) * .8, [1.5, 1.1, .35], .25, 9, -tt * .3, 1.4);
  }
  // ---- Sun Temple: a huge vertical sun-disc ringed with rotating rays behind the roof, gold-capped front columns, altar fire
  function lookSunTemple(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const goldM = mat([1, .78, .28], { metal: .85, rough: .25, emissive: [.5, .34, .06], shadow: false }), stone = mat([.82, .7, .5], { rough: .8, emissive: [.04, .03, .01] }), gc = [1.7, 1.2, .35];
    const dy = H + 142, R0 = 80;
    R.draw(U().sphere, mm(cx, dy, cz, 0, R0 * .78, R0 * .78, 7), mat([1.5, 1.1, .35], { emissive: [1.1, .75, .15], shadow: false }));
    R.draw(U().torus, mm(cx, dy, cz, 0, R0, R0, R0, Math.PI / 2), goldM); R.draw(U().torus, mm(cx, dy, cz, 0, R0 * .55, R0 * .55, R0 * .55, Math.PI / 2), goldM);
    const nr = det > .5 ? 16 : 8; for (let i = 0; i < nr; i++) { const a = tt * .18 + i * TAU / nr, o = 14 + (i % 2) * 18; tbSpike(cx + Math.cos(a) * (R0 + 4), dy + Math.sin(a) * (R0 + 4), cz, cx + Math.cos(a) * (R0 + 4 + o + 14), dy + Math.sin(a) * (R0 + 4 + o + 14), cz, 4.4, goldM); }
    tbGl(cx, dy, cz, 130, gc, .32);
    for (let i = 0; i < 4; i++) { const x = b.x + W * (.14 + i * .24), z = b.y + D + 12; tbRod(x, 0, z, x, H * .95, z, 7, stone); tbBlk(x, H * .95 + 3, z, 0, 18, 6, 18, goldM); }
    R.draw(U().cone, mm(cx, 0, b.y + D + 40, 0, 12, 22 + 5 * Math.sin(tt * 9), 12), mat([1.6, .8, .2], { emissive: [1.6, .7, .1], shadow: false })); tbGl(cx, 20, b.y + D + 40, 26, [1.7, .8, .2], .6);
    tbLt(cx, cz, dy, 260, gc, .6);
    if (Math.random() < .5 * q()) emit({ x: cx + (Math.random() - .5) * W, y: H, z: cz + (Math.random() - .5) * D, vx: 0, vy: 24, vz: 0, life: 1.6, age: 0, s0: 5, s1: 0, col: [1.6, 1.1, .3], a: .55, kind: 5, drag: .2 });
  }
  // ---- Nomad Tent: a great striped canvas canopy, ridge poles, sagging bunting, hanging lanterns, drifting cloth wisps
  function lookNomad(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const red = mat([.62, .12, .1], { rough: 1, emissive: [.05, .01, 0] }), cream = mat([.9, .8, .6], { rough: 1, emissive: [.04, .03, .02] }), pole = mat([.3, .2, .12], { rough: .9 }), gold = mat([1, .8, .3], { metal: .8, rough: .3, emissive: [.3, .22, .05], shadow: false });
    const rx = W * .78, rz = D * .78, hh = 112;
    R.draw(U().cone, mm(cx, H - 2, cz, 0, rx, hh, rz), red);
    for (const [t, s] of [[.25, .78], [.5, .55], [.75, .33]]) R.draw(U().torus, mm(cx, H - 2 + hh * t, cz, 0, rx * s, rz * s * 1, rx * s * .12 + 3, 0), cream);   // cream stripes
    R.draw(U().sphere, mm(cx, H + hh - 1, cz, 0, 6, 6, 6), gold); tbRod(cx, H + hh, cz, cx, H + hh + 30, cz, 1.6, pole); tbBlk(cx + 5, H + hh + 26, cz, 0, 16, 9, 1, red);   // finial + pennant
    for (const [x, z, sx, sz] of tbCorners(b)) tbRod(x + sx * 8, 0, z + sz * 8, x + sx * 8, H + 22, z + sz * 8, 3, pole);
    const [ax, az] = [b.x - 8, b.y - 8], [bx2, bz] = [b.x + W + 8, b.y - 8];     // bunting rope with flags
    for (let i = 0; i < (det > .5 ? 10 : 5); i++) { const t = i / 10, x = ax + (bx2 - ax) * t, y = H + 22 - 14 * Math.sin(t * Math.PI), z = az + (bz - az) * t; tbBlk(x, y - 6, z, 0, 7, 9, 1, [red, cream, gold][i % 3], 0, Math.sin(tt * 3 + i) * .3); }
    for (let i = 0; i < 4; i++) { const [x, z] = tbWallPt(b, i, .5, 12), sw = Math.sin(tt * 1.5 + i) * 3; tbRod(x, H + 22, z, x + sw, H + 8, z, .8, pole); R.draw(U().sphere, mm(x + sw, H + 4, z, 0, 5, 6, 5), mat([1.4, .9, .35], { emissive: [.7, .4, .1], shadow: false })); tbGl(x + sw, H + 4, z, 14, [1.5, .9, .35], .55); }
    for (let i = 0; i < 3; i++) { const a = tt * .4 + i * 2.1, rr = Math.max(W, D) * .7; R.draw(U().sphere, mm(cx + Math.cos(a) * rr, 40 + 14 * Math.sin(tt + i), cz + Math.sin(a) * rr, -a, 14, 22, 3), mat([.9, .8, .6], { emissive: [.2, .15, .08], alpha: .22, rim: 1, rimCol: [1, .85, .6], shadow: false })); }
    R.draw(U().sphere, mm(cx, 4, cz + D * .62, 0, 60, 10, 30), mat([.78, .62, .36], { rough: 1 }));       // wind-heaped sand against the tent
  }
  // ---- Sandstone Ruin: broken fluted columns, a half-fallen arch, rubble and drifting sand-ghosts with burning eyes
  function lookSandRuin(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const st = mat([.74, .6, .38], { rough: .95, emissive: [.03, .02, .01] }), dark = mat([.5, .4, .26], { rough: 1 });
    const nc = det > .5 ? 7 : 4; for (let i = 0; i < nc; i++) { const a = i / nc * TAU + sd, [ex, ez, ca, sa] = tbEdge(b, a, 34 + 30 * hash(sd + i)), h = 75 + 95 * hash(sd + i * 2.3); tbRod(ex, 0, ez, ex, h, ez, 11, st); tbRod(ex, h * .5, ez, ex + ca * 3, h * .5 + 1, ez, 12.6, dark); if (hash(sd + i * 5) > .45) tbRod(ex + ca * 12, h + 6, ez + sa * 12, ex + ca * 32, h + 18, ez + sa * 32, 9, st); else tbBlk(ex, h + 4, ez, 0, 25, 9, 25, st); }
    const ax = b.x - 46, az = cz;                                                  // the half-fallen arch
    tbRod(ax, 0, az - 46, ax, 150, az - 46, 12, st); tbRod(ax, 0, az + 46, ax, 112, az + 46, 12, st); tbRod(ax, 150, az - 46, ax, 170, az - 8, 10, st); tbRod(ax, 170, az - 8, ax, 164, az + 24, 9, st); tbBlk(ax, 26, az + 92, .6, 36, 24, 32, st); tbBlk(ax - 34, 15, az + 30, 1, 30, 18, 26, dark);
    for (let i = 0; i < 6; i++) { const a = hash(sd + i * 9) * TAU, [ex, ez] = tbEdge(b, a, 22 + 30 * hash(sd + i * 4)); R.draw(U().rock, mm(ex, 5, ez, a, 9 + 6 * hash(i + sd), 6, 9 + 6 * hash(i + 2 + sd)), dark); }
    for (let i = 0; i < 3; i++) { const a = tt * .25 + i * 2.1, rr = Math.max(W, D) * .7, gx = cx + Math.cos(a) * rr, gz = cz + Math.sin(a) * rr, sw = Math.sin(tt * 2 + i) * 5;
      R.draw(U().cone, mm(gx + sw, 0, gz, a, 15, 78 + 10 * i, 15), mat([.8, .66, .4], { emissive: [.22, .14, .05], alpha: .26, rim: 1.3, rimCol: [1, .75, .4], shadow: false }));
      for (const s of [-1, 1]) tbGl(gx + sw + s * 4, 62 + 10 * i, gz + Math.sin(a) * 9, 5, [1.7, .7, .2], .85); }
    for (let k = 0; k < 8; k++) R.quads.alpha.push(cx + Math.cos(tt * .6 + k) * Math.max(W, D) * .8, c.gy + 6 + k * 4, cz + Math.sin(tt * .6 + k) * Math.max(W, D) * .8, 20, .78, .62, .36, .18, 0, 3, 0, 0);
  }

  // =============================================================== FROST
  // ---- Ice Igloo: a translucent ice dome over the roof with brick rings, a tunnel mouth, snow drifts and a spirit flame inside
  function lookIgloo(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const ice = mat([.72, .9, 1.15], { emissive: [.12, .3, .5], alpha: .42, rim: 1.5, rimCol: [.6, .95, 1.4], rough: .05, metal: .1, shadow: false }), brick = mat([.8, .93, 1.1], { emissive: [.1, .22, .36], alpha: .7, rough: .2, shadow: false }), snow = mat([.92, .96, 1.05], { rough: 1, emissive: [.05, .07, .1] });
    const rx = W * .84, rz = D * .84;
    R.draw(U().sphere, mm(cx, H, cz, 0, rx, 112, rz), ice);
    for (let i = 1; i <= 5; i++) { const t = i / 6, r = Math.sqrt(1 - t * t); R.draw(U().torus, mm(cx, H + 112 * t, cz, 0, rx * r, rz * r, 6 + 4 * r, 0), brick); }
    const ex = cx, ez = b.y + D + 6; R.draw(U().cyl, mm(ex, 0, ez + 10, 0, 26, 38, 26, Math.PI / 2 * 0), ice); tbRod(ex, 20, ez - 6, ex, 20, ez + 38, 24, brick);   // tunnel mouth
    for (let i = 0; i < (det > .5 ? 8 : 4); i++) { const a = i / 8 * TAU + sd, [x, z] = tbEdge(b, a, 18); R.draw(U().sphere, mm(x, 4, z, a, 30, 14, 20), snow); }
    R.draw(U().octa, mm(cx, H + 44 + Math.sin(tt * 1.5) * 4, cz, tt * .8, 14, 25, 14), mat([.5, 1, 1.5], { emissive: [.2, .6, 1.1], shadow: false })); tbGl(cx, H + 30, cz, 40, [.4, .95, 1.6], .5);
    for (let k = 0; k < 10; k++) R.quads.alpha.push(cx + Math.cos(tt * .7 + k * .63) * rx * 1.1, c.gy + 10 + (k * 7 + tt * 20) % 70, cz + Math.sin(tt * .7 + k * .63) * rz * 1.1, 14, .95, .98, 1.05, .22, 0, 3, 0, 0);
    if (Math.random() < .6 * q()) emit({ x: cx + (Math.random() - .5) * W * 1.6, y: H + 90, z: cz + (Math.random() - .5) * D * 1.6, vx: 6, vy: -24, vz: 4, life: 3, age: 0, s0: 3, s1: 1, col: [1.2, 1.4, 1.7], a: .75, kind: 5, drag: .1 });
  }
  // ---- Glacial Vault: a giant spoked vault-door ring turning on the facade, glacier teeth crowning the roof, hanging ice chains, a caged frozen core
  function lookVault(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const ice = mat([.5, .78, 1.1], { emissive: [.08, .24, .45], alpha: .9, rim: 1.2, rimCol: [.5, .9, 1.4], rough: .1, shadow: false }), steel = mat([.3, .4, .5], { metal: .85, rough: .3, emissive: [.02, .06, .1] }), core = [.5, 1.1, 1.6];
    const fz = b.y + D + 16, fy = Math.max(60, H * .5), RR = Math.min(W * .4, 68);                                   // vault door in front of the wall
    R.draw(U().torus, mm(cx, fy, fz, 0, RR, RR, RR * .22, Math.PI / 2), steel); R.draw(U().torus, mm(cx, fy, fz, 0, RR * .55, RR * .55, RR * .2, Math.PI / 2), steel);
    const ns = det > .5 ? 8 : 4; for (let i = 0; i < ns; i++) { const a = tt * .12 + i * TAU / ns; tbRod(cx + Math.cos(a) * RR * .1, fy + Math.sin(a) * RR * .1, fz, cx + Math.cos(a) * RR, fy + Math.sin(a) * RR, fz, 3, steel); if (det > .5) tbBlk(cx + Math.cos(a) * RR, fy + Math.sin(a) * RR, fz, 0, 9, 9, 9, ice); }
    R.draw(U().cyl, mm(cx, fy, fz - 2, 0, RR * .28, 8, RR * .28, Math.PI / 2), steel); tbGl(cx, fy, fz + 6, 20, core, .4);
    const nt = det > .5 ? 9 : 5; for (let i = 0; i < nt; i++) { const a = i / nt * TAU + sd, [ex, ez, ca, sa] = tbEdge(b, a, 2), h = 56 + 46 * hash(sd + i); tbSpike(ex, H - 4, ez, ex + ca * 12, H + h, ez + sa * 12, 16, ice); }     // glacier teeth
    for (const [x, z, sx, sz] of tbCorners(b)) { const sw = Math.sin(tt * 1.2 + x) * 2; tbRod(x + sx * 4, H, z + sz * 4, x + sx * 5 + sw, H - 38, z + sz * 5, 1.8, ice); tbRod(x + sx * 5 + sw, H - 38, z + sz * 5, x + sx * 6, H - 76, z + sz * 6 - sw, 1.8, ice); }
    const cy = H + 112 + Math.sin(tt * 1.3) * 5; R.draw(U().octa, mm(cx, cy, cz, tt * .6, 22, 36, 22), mat([.6, 1, 1.4], { emissive: [.25, .6, 1], shadow: false })); tbGl(cx, cy, cz, 40, core, .4);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; tbSpike(cx + Math.cos(a) * 30, cy - 42, cz + Math.sin(a) * 30, cx + Math.cos(a) * 27, cy + 44, cz + Math.sin(a) * 27, 3.4, ice); }
    for (let k = 0; k < 8; k++) R.quads.alpha.push(b.x + hash(sd + k) * W, c.gy + 6, b.y + D + 14 + hash(sd + k * 3) * 30, 36, .9, .96, 1.05, .14, 0, 3, 0, 0);
  }
  // ---- Frost Shrine: a tower of rotating hex-snowflake rings, an ice lotus blooming on the roof, a spirit flame, prayer strips
  function lookFrostShrine(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const glass = mat([.8, .94, 1.15], { emissive: [.14, .3, .5], alpha: .6, rim: 1.4, rimCol: [.6, 1, 1.5], rough: .05, shadow: false }), pale = [.7, 1.2, 1.7];
    const nR = det > .5 ? 6 : 3; for (let i = 0; i < nR; i++) { const r = (92 - i * 12) * (1 + .04 * Math.sin(tt + i)); R.draw(U().hexRing, mm(cx, H + 52 + i * 26, cz, (i % 2 ? -1 : 1) * tt * (.3 + .08 * i), r, r, r, 1.5708 * (i % 2 ? 1 : 0) * 0), glass); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + tt * .1; tbSpike(cx + Math.cos(a) * 9, H, cz + Math.sin(a) * 9, cx + Math.cos(a) * 54, H + 52 + 8 * Math.sin(tt * 1.5 + i), cz + Math.sin(a) * 54, 9.5, glass); }          // lotus petals
    const fy = H + 36 + Math.sin(tt * 2) * 3; R.draw(U().sphere, mm(cx, fy, cz, 0, 9, 13, 9), mat([.7, 1.2, 1.7], { emissive: [.4, .9, 1.4], shadow: false })); tbGl(cx, fy, cz, 34, pale, .5);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6, rr = 82, sw = Math.sin(tt * 1.6 + i) * 3; tbRod(cx + Math.cos(a) * rr, H + 52, cz + Math.sin(a) * rr, cx + Math.cos(a) * rr + sw, H + 8, cz + Math.sin(a) * rr, .7, glass); tbBlk(cx + Math.cos(a) * rr + sw, H + 2, cz + Math.sin(a) * rr, a, 9, 26, 1, glass); }
    tbRg(cx, cz, Math.max(W, D) * .8, pale, .3, 9, tt * .3, 1.4);
    if (Math.random() < .7 * q()) emit({ x: cx + (Math.random() - .5) * 90, y: H + 100, z: cz + (Math.random() - .5) * 90, vx: 4, vy: -22, vz: 3, life: 3.2, age: 0, s0: 3.2, s1: 1, col: [1.3, 1.5, 1.8], a: .8, kind: 5, drag: .1 });
  }

  // =============================================================== LAVA
  // ---- Lava Forge: twin smoking chimney stacks, a huge spinning cog, a hovering anvil showering sparks, a molten spout and hanging chains
  function lookForge(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const iron = mat([.14, .12, .13], { metal: .8, rough: .4, emissive: [.1, .03, .02] }), hot = mat([1.4, .5, .1], { emissive: [1.1, .35, .06], shadow: false }), mag = [1.8, .55, .1];
    for (const s of [-1, 1]) { const x = cx + s * W * .26; R.draw(U().cyl, mm(x, H, cz, 0, 20, 150, 20), iron); R.draw(U().torus, mm(x, H + 150, cz, 0, 26, 26, 6), hot); tbGl(x, H + 150, cz, 34, mag, .5);
      if (Math.random() < .6 * q()) emit({ x: x + (Math.random() - .5) * 8, y: H + 156, z: cz + (Math.random() - .5) * 8, vx: 6, vy: 40 + Math.random() * 20, vz: 2, life: 2.6, age: 0, s0: 12, s1: 30, col: [.1, .09, .09], a: .5, kind: 3, add: false, drag: .3 });
      if (Math.random() < .35 * q()) emit({ x, y: H + 158, z: cz, vx: (Math.random() - .5) * 30, vy: 90, vz: (Math.random() - .5) * 30, grav: 220, life: .8, age: 0, s0: 4, s1: 0, col: mag, a: .9, kind: 0, drag: .5 }); }
    const gy2 = H + 100, gR = 56; R.draw(U().cyl, mm(cx, gy2, cz, tt * .6, gR, 9, gR), iron);                                                  // great cog
    for (let i = 0; i < (det > .5 ? 10 : 6); i++) { const a = tt * .6 + i * TAU / 10; tbBlk(cx + Math.cos(a) * (gR + 5), gy2 + 4.5, cz + Math.sin(a) * (gR + 5), -a, 12, 9, 10, iron); }
    R.draw(U().torus, mm(cx, gy2 + 9, cz, tt * .6, gR * .55, gR * .55, 4, 0), hot);
    const ay = H + 160 + Math.sin(tt * 1.5) * 4; tbBlk(cx, ay, cz, tt * .4, 26, 9, 14, iron); tbBlk(cx, ay + 8, cz, tt * .4, 18, 7, 12, iron); tbSpike(cx + 13 * Math.cos(tt * .4), ay + 4, cz - 13 * Math.sin(tt * .4), cx + 30 * Math.cos(tt * .4), ay + 4, cz - 30 * Math.sin(tt * .4), 6, iron);   // anvil
    if (Math.random() < .5 * q()) emit({ x: cx, y: ay + 12, z: cz, vx: (Math.random() - .5) * 90, vy: 60 + Math.random() * 60, vz: (Math.random() - .5) * 90, grav: 300, life: .6, age: 0, s0: 3, s1: 0, col: [2, 1.2, .3], a: 1, kind: 4, orient: 2, drag: .6 });
    const [sx, sz] = tbWallPt(b, 2, .5, 6); tbRod(sx, H * .62, sz, sx, 4, sz + 8, 5, hot); tbGl(sx, H * .3, sz, 22, mag, .45); R.decal(sx, sz + 14, 36, 1.7, .5, .08, .4, 7, 0, 0, true, 1.4);   // molten spout + pool
    for (const [x, z, k1, k2] of tbCorners(b)) { const sw = Math.sin(tt * 1.4 + x) * 3; tbRod(x + k1 * 5, H, z + k2 * 5, x + k1 * 6 + sw, H - 46, z + k2 * 6, 1.6, iron); tbBlk(x + k1 * 6 + sw, H - 50, z + k2 * 6, 0, 6, 8, 3, iron); }
  }
  // ---- Obsidian Bastion: battlements, four crowned corner towers with banners, iron spikes, a red watching eye
  function lookBastion(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const obs = mat([.07, .05, .07], { metal: .75, rough: .22, emissive: [.1, .02, .03] }), red = mat([.5, .04, .05], { rough: 1, emissive: [.08, 0, 0] }), rc = [1.7, .2, .15];
    const step = det > .5 ? 34 : 60; for (let side = 0; side < 4; side++) { const len = side % 2 ? D : W; for (let k = 0; k * step < len - 40; k++) { const [x, z] = tbWallPt(b, side, (22 + k * step) / len, 1); tbBlk(x, H + 8, z, 0, side % 2 ? 11 : 20, 16, side % 2 ? 20 : 11, obs); } }
    for (const [x, z, sx, sz] of tbCorners(b)) { const tx = x + sx * 2, tz = z + sz * 2; R.draw(U().cyl, mm(tx, H, tz, 0, 20, 104, 20), obs); R.draw(U().cone, mm(tx, H + 104, tz, 0, 26, 52, 26), obs); tbGl(tx, H + 156, tz, 16, rc, .8);
      tbRod(tx, H + 150, tz, tx, H + 190, tz, 1.8, obs); tbBlk(tx + 9, H + 180, tz, 0, 18, 12, 1, red, 0, Math.sin(tt * 3 + x) * .2); }
    for (let i = 0; i < 7; i++) { const [x, z] = tbWallPt(b, 2, (i + .5) / 7, 3); tbSpike(x, 14, z, x, 14 + 8, z + 36, 4.2, obs); }                      // outward spikes at the base
    for (let i = 0; i < 3; i++) { const [x, z] = tbWallPt(b, 2, .2 + .3 * i, 4); tbBlk(x, H * .55, z, 0, 18, H * .6, 1.5, red, 0, Math.sin(tt * 1.5 + i) * .05); }
    const ey = H + 130 + Math.sin(tt * 1.4) * 4; R.draw(U().sphere, mm(cx, ey, cz, 0, 18, 18, 18), mat([.1, .02, .03], { emissive: [.7, .05, .05], rim: 2, rimCol: [1.7, .2, .15], shadow: false }));
    R.draw(U().sphereLo, mm(cx + Math.cos(tt * .6) * 4, ey, cz + 11, 0, 4, 8, 3), mat([1.6, .3, .2], { emissive: [1.6, .3, .2], shadow: false })); tbGl(cx, ey, cz, 40, rc, .35);
    if (Math.random() < .5 * q()) emit({ x: cx + (Math.random() - .5) * W, y: H, z: cz + (Math.random() - .5) * D, vx: 14, vy: 24, vz: 4, life: 2, age: 0, s0: 3, s1: 0, col: [1.7, .5, .15], a: .8, kind: 5, drag: .2 });
  }
  // ---- Cinder Chapel: a tall charred spire, a broken inverted cross, flying buttresses, a burning rose window, orbiting candles and falling ash
  function lookChapel(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const ash = mat([.2, .18, .18], { rough: .95, emissive: [.04, .01, .01] }), ember = [1.8, .45, .1], char = mat([.08, .07, .07], { rough: .9, emissive: [.05, .01, 0] });
    R.draw(U().cone, mm(cx, H, cz, 0, Math.min(W, D) * .4, 170, Math.min(W, D) * .4), ash);
    tbRod(cx, H + 166, cz, cx, H + 222, cz, 4.4, char); tbRod(cx - 20, H + 186, cz, cx + 17, H + 197, cz, 3.8, char);                            // broken cross
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .78, rr = Math.min(W, D) * .52; tbRod(cx + Math.cos(a) * rr, H - 4, cz + Math.sin(a) * rr, cx + Math.cos(a) * 11, H + 112, cz + Math.sin(a) * 11, 5.5, ash); tbRod(cx + Math.cos(a) * rr * 1.2, 0, cz + Math.sin(a) * rr * 1.2, cx + Math.cos(a) * rr, H - 4, cz + Math.sin(a) * rr, 5, ash); }
    const [wx, wz] = tbWallPt(b, 2, .5, 5), wy = Math.max(70, H * .6), wr = Math.min(W * .26, 44);                                              // rose window
    R.draw(U().torus, mm(wx, wy, wz, 0, wr, wr, wr * .16, Math.PI / 2), char);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + tt * .1; tbRod(wx, wy, wz + 1, wx + Math.cos(a) * wr, wy + Math.sin(a) * wr, wz + 1, 1.6, char); }
    tbGl(wx, wy, wz + 4, wr * 1.5, ember, .35 + .1 * Math.sin(tt * 3));
    for (let i = 0; i < (det > .5 ? 8 : 4); i++) { const a = tt * .5 + i * TAU / 8, rr = Math.min(W, D) * .55 + 18, cy2 = H + 40 + 14 * Math.sin(tt * 1.2 + i), px = cx + Math.cos(a) * rr, pz = cz + Math.sin(a) * rr; tbRod(px, cy2 - 7, pz, px, cy2 + 4, pz, 1.6, mat([.9, .85, .75], { rough: .8 })); tbGl(px, cy2 + 8, pz, 9, [1.8, .8, .25], .7 + .2 * Math.sin(tt * 8 + i)); }
    if (Math.random() < .8 * q()) emit({ x: cx + (Math.random() - .5) * W * 1.4, y: H + 120, z: cz + (Math.random() - .5) * D * 1.4, vx: 5, vy: -16, vz: 2, life: 4, age: 0, s0: 3, s1: 1, col: [.3, .26, .26], a: .7, kind: 3, add: false, drag: .1 });
    if (Math.random() < .3 * q()) emit({ x: cx + (Math.random() - .5) * W, y: H + 20, z: cz + (Math.random() - .5) * D, vx: 0, vy: 30, vz: 0, life: 1.8, age: 0, s0: 4, s1: 0, col: ember, a: .8, kind: 5, drag: .2 });
  }

  // =============================================================== VOID
  // ---- Neon Shrine: a torii gate over the roof with glowing beams, floating paper lanterns, a holo sign and falling data petals
  function lookNeonShrine(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const lac = mat([.07, .05, .12], { metal: .6, rough: .3, emissive: [.04, .02, .08] }), pink = [1.7, .3, 1.4], cyan = [.2, 1.3, 1.7];
    const gw = Math.min(W * .72, 124), gh = 138;
    for (const s of [-1, 1]) { tbRod(cx + s * gw, H, cz, cx + s * gw, H + gh, cz, 6.5, lac); tbBlk(cx + s * gw, H + 4, cz, 0, 15, 8, 15, lac); tbRod(cx + s * (gw + 2), H + 2, cz + 6, cx + s * (gw + 2), H + gh, cz + 6, 1, mat(pink, { emissive: pink, shadow: false })); }
    tbBlk(cx, H + gh * .72, cz, 0, gw * 2 + 28, 7, 8, lac); tbBlk(cx, H + gh + 4, cz, 0, gw * 2 + 52, 10, 11, lac);
    for (const s of [-1, 1]) tbBlk(cx + s * (gw + 32), H + gh + 11, cz, 0, 26, 6, 10, lac, 0, s * .32);                                          // upturned eaves
    tbBlk(cx, H + gh + 10, cz + 6, 0, gw * 2 + 40, 1.2, 1.2, mat(pink, { emissive: pink, shadow: false })); tbBlk(cx, H + gh * .72 + 3, cz + 5, 0, gw * 2 + 22, 1, 1.2, mat(cyan, { emissive: cyan, shadow: false }));
    for (let i = 0; i < 6; i++) { const t = (i + .5) / 6, x = cx - gw + t * gw * 2, sw = Math.sin(tt * 1.5 + i) * 2; tbRod(x, H + gh * .72, cz, x + sw, H + gh * .72 - 12, cz, .7, lac); const col = i % 2 ? cyan : pink; R.draw(U().sphere, mm(x + sw, H + gh * .72 - 20, cz, 0, 8, 10, 8), mat([col[0] * .5, col[1] * .5, col[2] * .5], { emissive: col, alpha: .8, shadow: false })); tbGl(x + sw, H + gh * .72 - 20, cz, 16, col, .55); }
    const py = H + gh + 46 + Math.sin(tt * 1.3) * 4; tbBlk(cx, py, cz, 0, 64, 30, 1.2, mat([.2, .9, 1.4], { emissive: [.1, .5, .8], alpha: .35, shadow: false }));   // holo sign
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if (hash(Math.floor(tt * 3) + r * 7 + k) > .3) tbGl(cx - 22 + k * 15, py + 8 - r * 8, cz + 1, 6, cyan, .8);
    if (Math.random() < .8 * q()) emit({ x: cx + (Math.random() - .5) * 150, y: H + 140, z: cz + (Math.random() - .5) * 90, vx: 8, vy: -26, vz: 3, life: 3, age: 0, s0: 3.4, s1: 1, col: Math.random() < .5 ? pink : cyan, a: .8, kind: 5, drag: .15 });
    tbRg(cx, cz, Math.max(W, D) * .8, pink, .28, 9, -tt * .5, 1.4);
  }
  // ---- Void Obelisk: three cracked monolith segments floating apart and turning, arcing energy, rune rings, orbiting void orbs
  function lookVoidObelisk(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const stone = mat([.05, .04, .1], { metal: .7, rough: .2, emissive: [.04, .02, .1] }), vio = [1, .35, 1.8], cy = [.3, 1.2, 1.8];
    const segs = [[22, 72, 0], [18, 72, 1], [15, 50, 2]]; let y = H + 36; const tops = [];
    segs.forEach(([w, h, i]) => { y += 8 + 6 * Math.sin(tt * 1.2 + i * 2); const ang = tt * (.25 + .12 * i) * (i % 2 ? -1 : 1); tbBlk(cx, y + h / 2, cz, ang, w, h, w, stone); tbBlk(cx, y + h / 2, cz, ang, w * 1.04, 1.4, w * 1.04, mat(vio, { emissive: vio, shadow: false })); R.draw(U().torus, mm(cx, y + h * .5, cz, ang, w * 1.5, w * 1.5, 2.6, 0), mat(cy, { emissive: cy, shadow: false })); tops.push([y, h]); y += h; });
    R.draw(U().cone, mm(cx, y + 6, cz, tt * .4, 15, 48, 15), stone); tbGl(cx, y + 30, cz, 26, vio, .6);
    for (let i = 0; i < 2; i++) { const y0 = tops[i][0] + tops[i][1], y1 = tops[i + 1][0]; for (let k = 0; k < 3; k++) bolt(cx + (k - 1) * 4, y0 + c.gy, cz, cx + (hash(Math.floor(tt * 14) + k + i) - .5) * 14, y1 + c.gy, cz, [vio[0] * .8, vio[1] * .8, vio[2] * .8], 2.2, .8, k * 31 + i, 5); }
    for (let i = 0; i < (det > .5 ? 5 : 3); i++) { const a = tt * .6 + i * TAU / 5, rr = 58 + 8 * i; R.draw(U().sphere, mm(cx + Math.cos(a) * rr, H + 30 + 50 * hash(sd + i) + Math.sin(tt * 2 + i) * 8, cz + Math.sin(a) * rr, 0, 7, 7, 7), mat([0, 0, 0], { emissive: [.02, 0, .05], rim: 2.4, rimCol: vio, shadow: false })); }
    if (Math.random() < .7 * q()) emit({ x: cx + (Math.random() - .5) * 60, y: H, z: cz + (Math.random() - .5) * 60, vx: 0, vy: 50 + Math.random() * 40, vz: 0, life: 2, age: 0, s0: 4, s1: 0, col: vio, a: .8, kind: 5, drag: .1 });
    R.draw(U().hexRing, mm(cx, 4, cz, tt * .2, Math.max(W, D) * .8, Math.max(W, D) * .8, Math.max(W, D) * .8, 1.5708), mat([.5, .2, 1], { emissive: [.3, .1, .6], alpha: .4, shadow: false }));
  }
  // ---- Phase Sanctum: a gyroscope of three rings spinning on different axes around a phasing core, and flickering ghost-copies of the whole building
  function lookPhaseSanctum(c) {
    const { b, cx, cz, H, tt, sd, det, W, D } = c;
    const ringM = (col) => mat(col, { emissive: [col[0] * .9, col[1] * .9, col[2] * .9], metal: .4, rough: .25, shadow: false }), A = [.3, 1.2, 1.7], B = [1.6, .35, 1.5], Cc = [.7, .4, 1.8];
    const gy2 = H + 120 + Math.sin(tt * 1.2) * 5;
    R.draw(U().torus, mm(cx, gy2, cz, tt * .7, 74, 74, 74, tt * .4), ringM(A)); R.draw(U().torus, mm(cx, gy2, cz, -tt * .9, 58, 58, 58, 1.2, tt * .6), ringM(B)); R.draw(U().hexRing, mm(cx, gy2, cz, tt * 1.2, 42, 42, 42, tt * .5, 1), ringM(Cc));
    const ph = .5 + .5 * Math.sin(tt * 3); R.draw(U().octa, mm(cx, gy2, cz, tt * 1.6, 15 * (.6 + ph * .6), 23, 15 * (.6 + ph * .6)), mat([.9, .6, 1.6], { emissive: [.5, .3, 1], alpha: .5 + ph * .4, rim: 1.6, rimCol: [1, .6, 1.8], shadow: false })); tbGl(cx, gy2, cz, 44, Cc, .35);
    const step = Math.floor(tt * 6); for (let i = 0; i < 3; i++) {                                                                                     // phase-shifted echoes of the building
      if (hash(step * 1.7 + i * 3.1) < .34) continue; const ox = (hash(step + i * 5.3) - .5) * 38, oz = (hash(step + i * 9.1) - .5) * 38, oy = (hash(step + i * 2.3) - .5) * 28, col = [A, B, Cc][i];
      tbBlk(cx + ox, H * .5 + oy, cz + oz, 0, W * 1.02, H, D * 1.02, mat(col, { emissive: [col[0] * .5, col[1] * .5, col[2] * .5], alpha: .1, shadow: false })); }
    for (let k = 0; k < (det > .5 ? 7 : 3); k++) { if (hash(Math.floor(tt * 5) + k * 4.1) < .4) continue; const a = hash(k + sd) * TAU + tt * .2, rr = Math.hypot(W, D) * .5 + 24 + 30 * hash(k * 3 + sd); tbBlk(cx + Math.cos(a) * rr, 20 + 90 * hash(k * 5 + sd), cz + Math.sin(a) * rr, a, 9, 9, 9, ringM([A, B, Cc][k % 3])); }   // glitch cubes
    tbRg(cx, cz, Math.max(W, D) * .85, B, .3, 9, tt * .5, 1.4); tbRg(cx, cz, Math.max(W, D) * .55, A, .22, 7, -tt * .4, 1.5);
  }

  // ---- picking the look
  const TB_LOOKS = { 1: ['watchtower', 'barn', 'hunter'], 2: ['pyramid', 'suntemple', 'nomad', 'sandruin'], 3: ['igloo', 'vault', 'frostshrine'], 4: ['forge', 'bastion', 'chapel'], 5: ['neonshrine', 'voidobelisk', 'phasesanctum'] };
  const TB_FN = { watchtower: lookWatchtower, barn: lookBarn, hunter: lookHunter, pyramid: lookPyramid, suntemple: lookSunTemple, nomad: lookNomad, sandruin: lookSandRuin, igloo: lookIgloo, vault: lookVault, frostshrine: lookFrostShrine, forge: lookForge, bastion: lookBastion, chapel: lookChapel, neonshrine: lookNeonShrine, voidobelisk: lookVoidObelisk, phasesanctum: lookPhaseSanctum };
  const TB_RX = { watchtower: /watch|cottage|tower/, barn: /barn|timber/, hunter: /hunter|hut/, pyramid: /pyramid/, suntemple: /sun|temple/, nomad: /nomad|tent/, sandruin: /sandstone|ruin/, igloo: /igloo/, vault: /vault|glacial/, frostshrine: /shrine/, forge: /forge/, bastion: /bastion|obsidian/, chapel: /chapel|cinder/, neonshrine: /shrine|neon/, voidobelisk: /obelisk/, phasesanctum: /sanctum|phase/ };
  const TB_KEYS = ['themeType', '_themeType', 'themedType', 'typeId', 'typeKey', 'archetype', '_archetype', 'themeName', 'label', 'title', 'name', 'kind', 'type', 'style', 'id'];
  function tbResolveLook(b, tid) {
    const list = TB_LOOKS[tid]; if (!list) return null;
    if (b._look && list.includes(b._look)) return b._look;
    let str = '';
    for (const k of TB_KEYS) { const v = b[k]; if (typeof v === 'string') str += ' ' + v.toLowerCase().replace(/[_\-]+/g, ' '); else if (typeof v === 'number' && /type/i.test(k)) return list[((v % list.length) + list.length) % list.length]; }
    for (const id of list) if (TB_RX[id].test(str)) return id;
    return list[Math.floor(hash(b.x * .0137 + b.y * .0071 + tid) * list.length)];     // no readable type: a stable pick per building
  }
  R.themedLookOf = tbResolveLook;

  // the previous floating-sigil design, kept as the fallback for any map id that has no dedicated looks
  function sigilCrystal(kind, acc, em, i, tt) {
    if (kind === 'flame') return { mesh: U().cone, sx: 5, sy: 14, sz: 5, col: [1, .5, .2], spin: tt * 3 + i };
    if (kind === 'frost' || kind === 'snowflake' || kind === 'crystal') return { mesh: U().octa, sx: 7, sy: 16, sz: 7, col: [.8, .95, 1], spin: tt * 1.5 + i };
    if (kind === 'tbSpike') return { mesh: U().cone, sx: 6, sy: 18, sz: 6, col: [acc[0]*.6, acc[1]*.6, acc[2]*.6], spin: tt * 2 + i };
    if (kind === 'eye' || kind === 'sun') return { mesh: U().sphereLo, sx: 8, sy: 8, sz: 8, col: [1, .85, .4], spin: tt + i };
    if (kind === 'skull') return { mesh: U().sphere, sx: 8, sy: 9, sz: 8, col: [.9, .9, .85], spin: tt * 0.6 + i };
    if (kind === 'voidring' || kind === 'phase') return { mesh: U().torus, sx: 9, sy: 9, sz: 9, col: [Math.min(1, acc[0]*1.2), Math.min(1, acc[1]*1.2), Math.min(1, acc[2]*1.2)], spin: tt * 2 + i };
    if (kind === 'cross') return { mesh: U().box, sx: 5, sy: 14, sz: 5, col: [1, .9, .7], spin: tt + i };
    if (kind === 'leaf') return { mesh: U().sphereLo, sx: 6, sy: 12, sz: 6, col: [.5, 1, .6], spin: tt * 1.4 + i };
    if (kind === 'star') return { mesh: U().octa, sx: 8, sy: 8, sz: 8, col: [1, .9, .5], spin: tt * 2.4 + i };
    if (kind === 'spire') return { mesh: U().cyl, sx: 3, sy: 16, sz: 3, col: [Math.min(1, acc[0]*1.1), Math.min(1, acc[1]*1.1), Math.min(1, acc[2]*1.1)], spin: tt * 3 + i };
    return { mesh: U().octa, sx: 6, sy: 13, sz: 6, col: acc, spin: tt * 2 + i };
  }
  function drawSigilLegacy(b, tt) {
    const acc = b._sigilAcc || [1, 1, 1], kind = b._sigilKind || 'ring', nCr = b._sigilCount || 4, cx = b.x + b.w / 2, cz = b.y + b.h / 2, base = b._sigilY || 120;
    const y = base + 46 + Math.sin(tt * 1.5 + b.x * 0.13) * 7, sr = Math.min(b.w, b.h) * 0.22 + 18, rot = tt * 0.7 + b.x * 0.05, em = [acc[0] * 1.7, acc[1] * 1.7, acc[2] * 1.7];
    R.draw(U().torus, mm(cx, y, cz, rot, sr, sr, sr), mat(acc, { emissive: em, metal: .3, rough: .2, shadow: false }));
    R.draw((kind === 'voidring' || kind === 'phase') ? U().torus : U().hexRing, mm(cx, y, cz, -rot * 1.4, sr * 0.7, sr * 0.7, sr * 0.7, 0.5, rot), mat([1, 1, 1], { emissive: acc, shadow: false }));
    for (let i = 0; i < nCr; i++) { const a = rot * 1.6 + i * (Math.PI * 2 / nCr), ox = cx + Math.cos(a) * (sr + 10), oz = cz + Math.sin(a) * (sr + 10), cy = y + Math.sin(tt * 2 + i) * 5, k = sigilCrystal(kind, acc, em, i, tt);
      R.draw(k.mesh, mm(ox, cy, oz, k.spin, k.sx, k.sy, k.sz), mat(k.col, { emissive: [k.col[0] * 1.6, k.col[1] * 1.6, k.col[2] * 1.6], metal: .4, rough: .1, shadow: false })); tbGl(ox, cy, oz, 14, k.col, .8); }
    R.draw(U().cyl, mm(cx, (base + y) / 2, cz, 0, 2.4, y - base, 2.4), mat(acc, { emissive: acc, alpha: .25, shadow: false }));
    tbGl(cx, y, cz, sr * 1.3, acc, .5 + 0.2 * Math.sin(tt * 3)); tbLt(cx, cz, y, 300, acc, .7);
    if (Math.random() < 0.6 * q()) emit({ x: cx + (Math.random() - .5) * sr, y: base, z: cz + (Math.random() - .5) * sr, vx: 0, vy: -22, vz: 0, life: 1.3, age: 0, s0: 5, s1: 0, col: em, a: .7, kind: 5, drag: .2 });
  }
  function drawThemedSigils(F, tt) {
    const bs = F.world && F.world.buildings; if (!bs) return;
    const tid = (F.theme && F.theme.id) || 1, ex = R.eye[0], ez = R.eye[2];
    for (const b of bs) {
      if (!b._themed) continue;
      const cx = b.x + b.w / 2, cz = b.y + b.h / 2, d = Math.hypot(ex - cx, ez - cz);
      if (d > 2600) continue;                                   // too far to read: skip entirely
      const look = tbResolveLook(b, tid), fn = look && TB_FN[look];
      if (!fn) { drawSigilLegacy(b, tt); continue; }
      const sd = b.x * .0137 + b.y * .0071;
      fn({ b, cx, cz, W: b.w, D: b.h, H: b._sigilY || 120, gy: R.groundY(cx, cz), tt, acc: b._sigilAcc || [1, 1, 1], kind: b._sigilKind || 'ring', sd, det: d < 650 ? 1 : d < 1400 ? .6 : .32, v: Math.floor(hash(sd * 3.7) * 3) });
    }
  }

  // ---------------------------------------------------------- Realistic 3D titan (heroic + scary humanoid colossus)
  function drawTitan(g, face, tt, myTeam) {
    const col = (g.team === (myTeam || 0)) ? [.23, .65, 1] : [1, .29, .29];
    const S = g.r, cx = g.x, cz = g.y;
    const pulse = 1 + .03 * Math.sin(tt * 2 + g.team);
    const sw = Math.sin(tt * 1.3 + g.team * 1.7) * 0.1;

    const armor = mat([0.12, 0.10, 0.16], { metal: 0.8, rough: 0.35, emissive: [col[0] * 0.1, col[1] * 0.1, col[2] * 0.1] });
    const plate = mat([0.20, 0.18, 0.24], { metal: 0.85, rough: 0.3 });
    const stone = mat([0.24, 0.22, 0.26], { rough: 0.85, metal: 0.1 });
    const glow = mat(col, { emissive: [col[0] * 1.8, col[1] * 1.8, col[2] * 1.8], shadow: false });
    const core = mat(col, { emissive: [col[0] * 3.2, col[1] * 3.2, col[2] * 3.2], shadow: false });
    const cape = mat([col[0] * 0.28, col[1] * 0.28, col[2] * 0.28], { rough: 0.6, metal: 0.2, emissive: [col[0] * 0.25, col[1] * 0.25, col[2] * 0.25] });

    R.glow(cx, S * 0.2, cz, S * 3.4, col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 0.35, 0);
    R.light(cx, cz, S * 1.8, S * 6, col[0], col[1], col[2], 0.9);
    R.quads.alpha.push(cx, 1.1, cz, S * 3.0, 0, 0, 0, 0.32, 0, 11, 0, 1);

    // rocky pedestal
    R.draw(U().rock2, mm(cx, S * 0.25, cz, tt * 0.1, S * 1.5, S * 0.5, S * 1.5, 0, 0.2), stone);

    // LEGS
    for (const sd of [-1, 1]) {
      R.draw(U().box, mm(cx + sd * S * 0.42, S * 0.7, cz, face + sw * sd, S * 0.42, S * 1.4, S * 0.55), armor);
      R.draw(U().sphere, mm(cx + sd * S * 0.42, S * 0.78, cz, 0, S * 0.32, S * 0.32, S * 0.32), plate);
      R.draw(U().sphereLo, mm(cx + sd * S * 0.42, S * 0.55, cz + S * 0.3, 0, S * 0.12, S * 0.12, S * 0.12), glow);
    }

    // PELVIS
    R.draw(U().box, mm(cx, S * 1.5, cz, face, S * 1.05, S * 0.4, S * 0.7), plate);

    // TORSO (broad heroic chest)
    R.draw(U().sphere, mm(cx, S * 2.0 + sw * S * 0.4, cz, face + sw * 0.5, S * 1.0 * pulse, S * 1.1, S * 0.7), armor);
    R.draw(U().box, mm(cx, S * 2.05, cz - S * 0.05, face, S * 0.85, S * 1.0, S * 0.3), plate);
    // glowing core (heart)
    R.draw(U().sphere, mm(cx, S * 2.0, cz + S * 0.2, tt * 2, S * 0.22 * pulse, S * 0.22 * pulse, S * 0.22 * pulse), core);
    R.glow(cx, S * 2.0, cz + S * 0.22, S * 1.3, col[0] * 1.5, col[1] * 1.5, col[2] * 1.5, 0.75, 0);

    // SHOULDERS (pauldrons + spikes)
    for (const sd of [-1, 1]) {
      R.draw(U().sphere, mm(cx + sd * S * 0.95, S * 2.45, cz, face, S * 0.42, S * 0.36, S * 0.42), plate);
      R.draw(U().cone, mm(cx + sd * S * 0.95, S * 2.78, cz, face, S * 0.16, S * 0.5, S * 0.16, 0, 0), glow);
    }

    // ARMS
    for (const sd of [-1, 1]) {
      const aS = Math.sin(tt * 1.6 + sd * 1.3 + g.team) * 0.12;
      R.draw(U().cyl, mm(cx + sd * S * 1.0, S * 1.95, cz, face + aS, S * 0.26, S * 1.0, S * 0.26, 0, 0), armor);
      R.draw(U().cyl, mm(cx + sd * S * 1.05, S * 1.2, cz, face + aS * 1.6, S * 0.28, S * 0.7, S * 0.28, 0, 0), armor);
      R.draw(U().sphere, mm(cx + sd * S * 1.1, S * 0.9, cz, 0, S * 0.3, S * 0.3, S * 0.3), plate);
      R.draw(U().sphereLo, mm(cx + sd * S * 1.1, S * 0.9, cz + S * 0.2, 0, S * 0.1, S * 0.1, S * 0.1), glow);
    }

    // NECK + HEAD
    R.draw(U().cyl, mm(cx, S * 2.68, cz, face, S * 0.26, S * 0.3, S * 0.26, 0, 0), armor);
    R.draw(U().sphere, mm(cx, S * 3.0, cz, face + sw, S * 0.42, S * 0.46, S * 0.42), plate);
    R.draw(U().box, mm(cx, S * 3.05, cz + S * 0.2, face, S * 0.5, S * 0.12, S * 0.2), plate); // brow
    // glowing eyes (scary)
    for (const sd of [-1, 1]) {
      R.draw(U().sphere, mm(cx + sd * S * 0.16, S * 3.0, cz + S * 0.35, 0, S * 0.07, S * 0.05, S * 0.07), core);
      R.glow(cx + sd * S * 0.16, S * 3.0, cz + S * 0.38, S * 0.5, col[0] * 2.2, col[1] * 2.2, col[2] * 2.2, 0.95, 0);
    }
    // HORNS
    for (const sd of [-1, 1]) {
      R.draw(U().cone, mm(cx + sd * S * 0.34, S * 3.2, cz - S * 0.08, face + sd * 0.5, S * 0.13, S * 0.75, S * 0.13, 0, sd * 0.4), plate);
      R.draw(U().cone, mm(cx + sd * S * 0.34, S * 3.6, cz - S * 0.22, face + sd * 0.8, S * 0.08, S * 0.5, S * 0.08, 0, sd * 0.5), glow);
    }
    // HALO crown (heroic)
    R.draw(U().torus, mm(cx, S * 3.05, cz - S * 0.12, tt * 0.6 * (g.team ? 1 : -1), S * 0.58, S * 0.58, S * 0.58, 0.2), glow);

    // CAPE
    R.draw(U().box, mm(cx, S * 1.95, cz - S * 0.55, face, S * 1.0, S * 1.7, S * 0.14, sw * 0.4), cape);

    // orbiting runic rings
    for (let i = 0; i < 3; i++) {
      const a = tt * 0.8 * (g.team ? -1 : 1) + i * 2.09;
      R.draw(U().torus, mm(cx + Math.cos(a) * S * 0.05, S * 2.0 + Math.sin(a) * S * 0.35, cz + Math.sin(a) * S * 0.05, a, S * 1.4, S * 1.4, S * 1.4, 0.6), mat(col, { emissive: [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3], shadow: false, alpha: 0.7 }));
    }

    // ground HP ring
    R.decal(cx, cz, S * 1.45, col[0], col[1], col[2], 0.95, 6, Math.max(0, g.hp / g.maxhp), 0, true, 1.7);
    ring(cx, cz, S * 1.6, col, 0.6, 9, tt * (g.team ? -1 : 1), 1.5);
  }

  // ---------------------------------------------------------- Teams mode (giants / golems / fireballs)
  function drawTeams(F, tt) {
    const T = F.teams; if (!T) return;
    const my = T.playerTeam || 0;
    const tcol = (t) => (t === my) ? [.23, .65, 1] : [1, .29, .29];
    for (const go of T.golems) {
      const act = !!go.activated, col = act ? tcol(go.team) : [.9, .9, .94], bob = Math.sin(go.wobble) * 3;
      R.draw(U().rock, mm(go.x, go.r * 0.75 + bob, go.y, go.wobble * 0.2, go.r * 1.15, go.r * 0.9, go.r * 1.0), mat([col[0] * .5, col[1] * .5, col[2] * .5], { rough: .85, emissive: [col[0] * .12, col[1] * .12, col[2] * .12] }));
      R.glow(go.x, go.r, go.y, go.r * 2.4, col[0], col[1], col[2], .4, 0);
      if (!act) { const lead = Math.max(go.dmg[0] || 0, go.dmg[1] || 0) / go.threshold; ring(go.x, go.y, go.r + 8, col, .5 * lead, 9, 0, 1.5); }
      else {
        ring(go.x, go.y, go.r + 8, col, .6, 9, tt * 2, 1.5);
        // detonation telegraph (warn → charge) on the ground
        if (go._inRange && go.dPhase && go.dPhase !== 'idle') {
          const warn = go.dPhase === 'warn';
          const grow = warn ? (1 - Math.max(0, go.dT) / 1.2) : 1;
          const Rr = go.killR * (warn ? (0.5 + 0.5 * grow) : (0.92 - 0.08 * (1 - Math.max(0, go.dT) / 0.5)));
          ring(go.x, go.y, Rr, col, warn ? .55 : .95, 2, .1, warn ? 2 : 4);
          R.glow(go.x, 14, go.y, Rr, col[0], col[1], col[2], warn ? .35 : .65, 0);
        }
      }
      R.quads.alpha.push(go.x, 1.1, go.y, go.r * 2.2, 0, 0, 0, .3, 0, 11, 0, 1);
    }
    for (const f of T.fireballs) {
      const fz = f.z || 0;
      R.quads.alpha.push(f.x, 1.2, f.y, f.r * 2.4 * (1 - Math.min(.7, fz / 500)), 0, 0, 0, .3, 0, 11, 0, 1);
      R.draw(U().sphere, mm(f.x, fz, f.y, tt * 3, f.r * 1.3, f.r * 1.3, f.r * 1.3), mat([1.4, .6, .15], { emissive: [2.4, 1.3, .3], shadow: false }));
      R.glow(f.x, fz, f.y, f.r * 6, 1.9, 1.0, .3, .95, 0);
      R.light(f.x, f.y, fz, 240, 1.8, .7, .2, .9);
    }
    for (const g of T.giants) {
      const enemy = T.giants.find(o => o.team !== g.team);
      const face = Math.atan2((enemy ? enemy.y : g.y) - g.y, (enemy ? enemy.x : g.x) - g.x);
      drawTitan(g, face, tt, my);
    }
    for (const e of (T.effects || [])) {
      if (e.type !== 'killCircle') continue;
      const p = e.t / e.life, c = hex(e.color || '#fff'), Rr = e.r * (.6 + .4 * p);
      ring(e.x, e.y, Rr, c, .9 * (1 - p), 2, .1, 2); R.glow(e.x, 14, e.y, Rr, c[0], c[1], c[2], .5 * (1 - p), 0);
    }
  }

  // ---------------------------------------------------------- Capture the Flag (bases + flags + carrier markers)
  function drawCtf(F, tt) {
    const c = F.ctf; if (!c) return;
    const my = c.playerTeam;
    const tcol = (t) => (t === my) ? [.23, .65, 1] : [1, .29, .29];
    for (const base of c.bases) {
      const col = tcol(base.team);
      const pulse = .5 + .5 * Math.sin(tt * 2 + base.team);
      ring(base.x, base.y, base.r, col, .35 + .2 * pulse, 9, tt * (base.team ? -1 : 1), 1.4);
      R.decal(base.x, base.y, base.r, col[0], col[1], col[2], .16 + .1 * pulse, 10, tt * (base.team ? 1 : -1), 0, true, 1.2);
      R.draw(U().cyl, mm(base.x, base.r * 0.16, base.y, 0, base.r * 0.5, base.r * 0.32, base.r * 0.5, 0, 0), mat([col[0] * .28, col[1] * .28, col[2] * .28], { rough: .7, metal: .3, emissive: [col[0] * .2, col[1] * .2, col[2] * .2] }));
      R.glow(base.x, base.r * 0.5, base.y, base.r * 1.3, col[0], col[1], col[2], .28 + .14 * pulse, 0);
      R.light(base.x, base.y, base.r * 0.6, base.r * 2.4, col[0], col[1], col[2], .6);
    }
    for (const f of c.flags) {
      const col = tcol(f.team);
      const bob = Math.sin(tt * 3 + f.bob) * 4;
      const fy = 30 + bob;
      R.draw(U().cyl, mm(f.x, fy * 0.5, f.y, 0, 1.2, fy, 1.2, 0, 0), mat([.15, .15, .18], { metal: .8, rough: .3 }));
      const sway = Math.sin(tt * 2 + f.bob) * .25;
      R.draw(U().box, mm(f.x + Math.cos(sway) * 6, fy + 9, f.y, sway, 15, 10, 1.6), mat(col, { emissive: [col[0] * 1.9, col[1] * 1.9, col[2] * 1.9], shadow: false }));
      R.glow(f.x, fy + 9, f.y, 28, col[0] * 1.5, col[1] * 1.5, col[2] * 1.5, .75, 0);
      R.light(f.x, f.y, fy + 9, 130, col[0], col[1], col[2], .7);
      if (f.state === 'dropped') ring(f.x, f.y, 28, col, .5 + .3 * Math.sin(tt * 5), 9, tt * 3, 1.7);
    }
    const mark = (x, z, team) => {
      const col = tcol(team);
      R.glow(x, 42, z, 48, col[0], col[1], col[2], .5 + .2 * Math.sin(tt * 6), 0);
      ring(x, z, 36, col, .6 + .3 * Math.sin(tt * 6), 9, tt * 2, 1.8);
    };
    if (c.playerCarrying && F.me && !F.me.dead) mark(F.me.x, F.me.y, 0);
    if (F.bots) for (const b of F.bots) if (b && b.hp > 0 && b._ctfCarrying) mark(b.x, b.y, b.team);
  }

  R.collect = function (F, th) {
    const tt = F.t, dt = Math.max(.001, Math.min(.05, F.dt || .016)), me = F.me;
    R.cameraKick = Math.max(0, (R.cameraKick || 0) - dt * 3); R.cam.kick = R.cameraKick;
    // roofs fade when player inside
    const insideB = F.idle ? null : F.world.buildings.find(b => b.inner && me.x >= b.inner.x && me.x <= b.inner.x + b.inner.w && me.y >= b.inner.y && me.y <= b.inner.y + b.inner.h);
    for (const rf of R.world.roofs) { const target = (rf.b === insideB) ? 0 : (F.world.buildings.length && !F.idle && me.x > rf.b.x - 30 && me.x < rf.b.x + rf.b.w + 30 && me.y > rf.b.y - 30 && me.y < rf.b.y + rf.b.h + 30 && false) ? .5 : 1; rf.alpha += (target - rf.alpha) * Math.min(1, dt * 7); }
    // screen fx state
    const fxs = R.fxState || (R.fxState = { hurt: 0, flash: 0, flashCol: [1, 1, 1], low: 0 });
    if (prevHp !== null && me.hp < prevHp - .5) { fxs.hurt = Math.min(1, fxs.hurt + .6 + (prevHp - me.hp) / 60); R.cameraKick = Math.max(R.cameraKick, .6); }
    prevHp = me.hp; fxs.hurt = Math.max(0, fxs.hurt - dt * 2.2); fxs.flash = Math.max(0, fxs.flash - dt * 3);
    const hr = me.hpMax ? me.hp / me.hpMax : 1; fxs.low = hr < .3 ? (.3 - hr) / .3 : 0;
    // Carrying the CTF flag keeps the screen clear — no low-health vignette or
    // hurt-flash darkening while you're running the flag home.
    if (window.CTF_MODE && window.CTF && window.CTF.playerCarrying) { fxs.low = 0; fxs.hurt = 0; }
    me.hurtFlash = fxs.hurt;

    if (!F.idle) { R._zOv = me.z || 0; try { drawLocalPlayer(F, tt); } finally { R._zOv = null; } }
    drawOthers(F, tt);
    drawEnemies(F, tt, dt);
    drawBullets(F, tt);
    drawPickups(F, tt);
    drawChests(F, tt);
    drawAllies(F, tt);
    drawEffects(F, tt);
    drawWorldVfx(F, tt);
    hazardFx(F, tt);
    drawZone(F, tt);
    if (F.teams) drawTeams(F, tt);
    if (F.ctf) drawCtf(F, tt);
    ambient(F, tt);
    drawThemedSigils(F, tt);
    if (window.Guardians && F.guardians && !F.enemies.some(e => e && (e.type === 'boss' || e.type === 'hearth_warden' || e.type === 'pharaoh_glass' || e.type === 'rime_oracle' || e.type === 'magma_titan' || e.type === 'void' || e.type === 'hollow'))) Guardians.draw3D(R, F);
    // "Slay the minions" warning while a boss is absorbing power (works for both 2D and 3D views)
    if (!R._bossWarnEl) { const d = document.createElement('div'); d.id = 'bossAbsorbWarn'; d.style.cssText = 'position:fixed;left:50%;top:14%;transform:translateX(-50%);z-index:8;pointer-events:none;display:none;font:800 16px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-shadow:0 0 10px rgba(0,0,0,.9),0 0 4px #000;background:rgba(10,8,20,.55);padding:7px 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25)'; document.body.appendChild(d); R._bossWarnEl = d; }
    let _absorbing = false; for (const e of F.enemies) { if (e && (e.type === 'boss' || e.type === 'hearth_warden' || e.type === 'pharaoh_glass' || e.type === 'rime_oracle' || e.type === 'magma_titan' || e.type === 'void' || e.type === 'hollow') && e.absorbing) { _absorbing = true; break; } }
    if (R._bossWarnEl) { if (_absorbing && !window._GAUNTLET_INTRO) { const rc = ['#7dffa3','#ffc24a','#7fd8ff','#ff5a3a','#b06bff'][((F.theme && F.theme.id) || 1) - 1] || '#b06bff'; R._bossWarnEl.textContent = '⚠ Slay the minions to break the shield'; R._bossWarnEl.style.borderColor = rc; R._bossWarnEl.style.color = rc; R._bossWarnEl.style.display = 'block'; } else R._bossWarnEl.style.display = 'none'; }
    stepParticles(dt);
    try { R.vmUpdate(F, dt, tt); } catch (e) { R.vmList.length = 0; if (!R._vmErr) { R._vmErr = 1; console.warn('[viewmodel]', e); } }
  };
})(window);
