/* =====================================================================
   themed_buildings.js — realm-specific themed landmark buildings.
   A factory receiving the render3d_fx.js locals it needs (R, U, mm, mat,
   hash, clamp, TAU, q, emit, ring) and returning drawThemedSigils(F, tt).
   Loaded via game.html before render3d_fx.js; render3d_fx.js installs it.
   Drop-in supplied by the user (5 realms: meadow/desert/frost/lava/void).
   ===================================================================== */
window.ThemedBuildings = function (R, U, mm, mat, hash, clamp, TAU, q, emit, ring) {
  // ---------------------------------------------------- themed landmark buildings
  // Every themed building is dressed in something ancient, magical and cursed, and the dressing is different on each map:
  //   1 Meadow  — an overgrown ruin: ancient vines winding down the walls, clawing roots, a crown of thorn-antlers and a
  //               pulsing cursed heart-bulb with a thorn ring
  //   2 Desert  — a sand-cursed reliquary: corner obelisks with floating gold glyph plates, an inverted pyramid with a
  //               watching golden eye, a sand vortex, falling sand and hieroglyph bands
  //   3 Frost   — a frozen cairn: crystal spires bursting through the roof, an icicle fringe, aurora ribbons, orbiting
  //               shards and a hex-frost seal with cracks across the ground
  //   4 Lava    — an infernal maw: magma fissures down every wall, curved obsidian horns, tilted rings of fire with
  //               charred runes, a molten core, dripping lava and smoke
  //   5 Void    — a voidgate: a rotating tesseract over a dark rift with an accretion ring, glitching monoliths,
  //               dashed data streams and scan-lines running over the walls
  // Everything is drawn per frame (nothing is baked), so detail drops with distance: nothing past 2600 units,
  // fewer / simpler shapes past 650 and again past 1400. Fine detail uses ribbons + glows (cheap, batched); only focal shapes are solid meshes.
  // Reads these building flags (set elsewhere): _themed, _sigilAcc, _sigilKind, _sigilY (roof height).
  const wallPt = (b, side, u, off) => side === 0 ? [b.x + u * b.w, b.y - off] : side === 1 ? [b.x + b.w + off, b.y + u * b.h] : side === 2 ? [b.x + (1 - u) * b.w, b.y + b.h + off] : [b.x - off, b.y + (1 - u) * b.h];
  const mixC = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const scl = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  // a solid cylinder / cone running between two points (heights relative to the ground under the building)
  function seg3(mesh, ax, ay, az, bx, by, bz, r, m) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, Ln = Math.hypot(dx, dy, dz) || 1e-3, ux = dx / Ln, uy = dy / Ln, uz = dz / Ln;
    let qx = 0, qy = 0, qz = 0; if (Math.abs(uy) < .9) qy = 1; else qx = 1;
    let xx = qy * uz - qz * uy, xy = qz * ux - qx * uz, xz = qx * uy - qy * ux; const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    const zx = xy * uz - xz * uy, zy = xz * ux - xx * uz, zz = xx * uy - xy * ux, o = mm(0, 0, 0, 0, 1, 1, 1);
    o[0] = xx * r; o[1] = xy * r; o[2] = xz * r; o[3] = 0; o[4] = dx; o[5] = dy; o[6] = dz; o[7] = 0; o[8] = zx * r; o[9] = zy * r; o[10] = zz * r; o[11] = 0;
    o[12] = ax; o[13] = ay + R.groundY(ax, az); o[14] = az; o[15] = 1;
    R.draw(mesh, o, m);
  }
  // point on the rect boundary in direction a from the centre
  function rectEdge(b, a, pad) { const ca = Math.cos(a), sa = Math.sin(a), t = Math.min(Math.abs(ca) < 1e-3 ? 1e9 : (b.w / 2) / Math.abs(ca), Math.abs(sa) < 1e-3 ? 1e9 : (b.h / 2) / Math.abs(sa)) + (pad || 0); return [b.x + b.w / 2 + ca * t, b.y + b.h / 2 + sa * t, ca, sa]; }

  // ============================================================ 1. MEADOW — the overgrown, cursed ruin
  function themedMeadow(c) {
    const { b, cx, cz, H, gy, tt, acc, sd, det, v } = c, W = b.w, D = b.h, top = gy + H;
    const bark = mat([.13, .1, .06], { rough: .9, metal: .05, emissive: [.02, .05, .01] });
    const heartM = mat([.1, .32, .12], { emissive: [.12, .55, .18], rim: 1.6, rimCol: [.5, 1.5, .4], rough: .35, shadow: false });
    const lush = mixC([.35, 1.15, .4], acc, .25);
    // ancient vines winding down every wall: thick, knotted, woody, clothed in glowing leaves and blossoms
    const leafM = mat([.18, .55, .2], { emissive: [.05, .3, .08], rough: .5, rim: .8, rimCol: [.4, 1.2, .4], shadow: false });
    for (let side = 0; side < 4; side++) {
      const len = side % 2 ? D : W, n = Math.max(1, Math.round(len / (det > .5 ? 130 : 200)));
      for (let k = 0; k < n; k++) {
        const u0 = (k + .5) / n, ph = hash(c.sd + side * 7.3 + k * 3.1) * TAU, N = det > .8 ? 7 : det > .5 ? 5 : 3, pts = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N, u = clamp(u0 + Math.sin(t * 6 + ph) * .07, .03, .97), off = 4.5 + Math.sin(t * 10 + ph) * 2.6 + Math.sin(tt * .8 + ph + t * 3) * 1.8 * t;
          const [x, z] = wallPt(b, side, u, off); pts.push(x, H * (1 - t) + 3, z);
        }
        for (let i = 0; i < N; i++) seg3(U().cyl, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], pts[i * 3 + 3], pts[i * 3 + 4], pts[i * 3 + 5], 3.6 * (1 - i / N * .55), bark);
        for (let i = 1; i < N; i += 2) {            // leaf clusters (solid only up close) and glowing blossoms
          const lx = pts[i * 3], ly = pts[i * 3 + 1], lz = pts[i * 3 + 2], bl = hash(c.sd + i + k * 5 + side) < .45;
          if (det > .8 && i % 4 === 1) R.draw(U().sphereLo, mm(lx, ly, lz, ph + i, 8, 6, 8), leafM);
          R.glow(lx, ly + 3, lz, bl ? 12 : 9, bl ? 1.5 : .5, bl ? .5 : 1.4, bl ? .9 : .4, .8 + .15 * Math.sin(tt * 2 + i + ph), 0);
        }
      }
    }
    // curtains of vines hanging from the eaves, swaying
    if (det > .5) for (let side = 0; side < 4; side++) {
      const len = side % 2 ? D : W, m = Math.round(len / 95);
      for (let k = 0; k < m; k++) { const u = (k + .5) / m, L = 24 + hash(c.sd + side + k * 2.7) * 60, sw = Math.sin(tt * 1.3 + k + side) * 4, [x, z] = wallPt(b, side, u, 6);
        seg3(U().cyl, x, H, z, x + sw, H - L, z + sw * .6, 1.5, bark);
        R.glow(x + sw, H - L, z + sw * .6, 8, .5, 1.4, .5, .7, 0); }
    }
    // roots clawing outward across the ground
    const nr = 5 + v;
    for (let i = 0; i < nr; i++) {
      const a = i / nr * TAU + c.sd, [ex, ez, ca, sa] = rectEdge(b, a, 3), L = 60 + hash(c.sd + i * 1.9) * 60; let px = ex, pz = ez, py = 3;
      for (let s = 1; s <= (det > .8 ? 4 : 2); s++) { const t = s / 4, w = Math.sin(t * 7 + i) * 8, nx = ex + ca * L * t - sa * w, nz = ez + sa * L * t + ca * w, ny = 3 + Math.sin(t * 3.1) * 3 * (1 - t); seg3(U().cyl, px, py, pz, nx, ny, nz, 5.5 * (1 - t * .75), bark); px = nx; py = ny; pz = nz; }
      R.glow(px, py + 4, pz, 12, .4, 1.3, .45, .5 + .2 * Math.sin(tt * 2 + i), 0);
    }
    // crown of thorn-antlers growing from the roof
    const nb = det > .6 ? 5 + v : 3, rc = Math.min(W, D) * .2, segN = det > .8 ? 3 : 2;
    for (let i = 0; i < nb; i++) {
      const a0 = i / nb * TAU + c.sd, curl = (i % 2 ? 1 : -1) * .26; let px = cx + Math.cos(a0) * rc, py = H, pz = cz + Math.sin(a0) * rc, ang = a0, rad = 6.2; const Ls = 34 + hash(c.sd + i) * 14;
      for (let s = 0; s < segN; s++) {
        ang += curl; const out = s < 2 ? .6 : -.25, nx = px + Math.cos(ang) * Ls * out, nz = pz + Math.sin(ang) * Ls * out, ny = py + Ls * (.95 - s * .16);
        seg3(U().cyl, px, py, pz, nx, ny, nz, rad, bark);
        if (det > .8 && s === 1) seg3(U().cone, nx, ny, nz, nx + Math.cos(ang + 1.4) * 6, ny + 5, nz + Math.sin(ang + 1.4) * 6, 1.4, bark);   // thorn
        px = nx; py = ny; pz = nz; rad *= .72;
      }
      R.glow(px, py, pz, 16, .5, 1.5, .4, .55 + .3 * Math.sin(tt * 2 + i), 0);       // glowing berry at the tip
    }
    // the cursed heart, ringed by thorns
    const hy = H + 140 + Math.sin(tt * 1.3) * 6, pul = 1 + .12 * Math.sin(tt * 3.2);
    R.draw(U().sphere, mm(cx, hy, cz, tt * .4, 26 * pul, 30 * pul, 26 * pul), heartM);
    R.draw(U().torus, mm(cx, hy, cz, tt * 1.1, 50, 50, 50, .9, tt * .5), bark);
    R.glow(cx, hy, cz, 80, .4, 1.3, .45, .2 + .08 * Math.sin(tt * 3.2), 0);
    R.light(cx, cz, hy, 300, .4, 1.2, .4, .5);
    if (Math.random() < .55 * q()) emit({ x: cx + (Math.random() - .5) * W, y: H * Math.random(), z: cz + (Math.random() - .5) * D, vx: (Math.random() - .5) * 8, vy: 12 + Math.random() * 14, vz: (Math.random() - .5) * 8, life: 2.2, age: 0, s0: 4, s1: 0, col: [.6, 1.5, .5], a: .7, kind: 5, drag: .2 });
    ring(cx, cz, Math.max(W, D) * .8, [.35, 1.1, .4], .28, 9, tt * .4, 1.4);
  }

  // ============================================================ 2. DESERT — the sand-cursed reliquary
  function themedDesert(c) {
    const { b, cx, cz, H, gy, tt, acc, sd, det, v } = c, W = b.w, D = b.h, top = gy + H;
    const stone = mat([.58, .45, .28], { rough: .8, emissive: [.03, .02, .01] });
    const gold = mixC([1.6, 1.2, .35], acc, .2);
    const goldM = mat([1, .8, .3], { metal: .9, rough: .2, emissive: [gold[0] * .6, gold[1] * .6, gold[2] * .6], shadow: false });
    // obelisks at the corners, each with gold bands and floating glyph plates
    [[b.x, b.y, -1, -1], [b.x + W, b.y, 1, -1], [b.x + W, b.y + D, 1, 1], [b.x, b.y + D, -1, 1]].forEach(([x, z, sx, sz], i) => {
      const h = 100 + 24 * hash(c.sd + i) + v * 12, ox = x + sx * 5, oz = z + sz * 5, rot = hash(c.sd + i * 2) * 1.5;
      R.draw(U().box, mm(ox, H + h / 2, oz, rot, 13, h, 13), stone);
      R.draw(U().cone, mm(ox, H + h, oz, rot, 17, 24, 17), goldM);
      if (det > .5) {
        for (const fy of [.3, .62]) R.draw(U().box, mm(ox, H + h * fy, oz, rot, 15, 3.4, 15), goldM);
        for (let k = 0; k < 3; k++) { const a = tt * 1.1 + k * 2.09 + i, rr = 24; R.draw(U().box, mm(ox + Math.cos(a) * rr, H + h * .55 + Math.sin(tt * 1.6 + k + i) * 6, oz + Math.sin(a) * rr, -a + 1.57, 9, 13, 1.4), goldM); }
        R.glow(ox, H + h + 16, oz, 18, gold[0], gold[1], gold[2], .55, 0);
      }
    });
    // an inverted pyramid hanging over the roof, with a golden eye that watches
    const py = H + 125 + Math.sin(tt * 1.2) * 6;
    R.draw(U().cone, mm(cx, py, cz, tt * .6, 36, 46, 36, Math.PI), goldM);
    R.draw(U().sphere, mm(cx, py - 22, cz, 0, 11, 11, 11), mat([1.3, 1.1, .6], { emissive: [1.4, 1, .3], shadow: false }));
    R.draw(U().sphereLo, mm(cx + Math.cos(tt * .5) * 3, py - 22, cz + 10, 0, 4, 5, 1.8), mat([.02, .02, .03], { shadow: false }));
    R.glow(cx, py - 22, cz, 56, gold[0], gold[1], gold[2], .3 + .1 * Math.sin(tt * 3), 0);
    R.light(cx, cz, py, 280, gold[0], gold[1], gold[2], .55);
    for (let k = 0; k < 5; k++) { const a = tt * 1.7 + k * 1.26; R.glow(cx + Math.cos(a) * 40, py - 14 + Math.sin(a * 2) * 5, cz + Math.sin(a) * 40, 7, .2, 1.3, 1.1, .85, 0); }   // scarabs
    // sand vortex wound around the building (soft dust puffs, not ribbons)
    const Rv = Math.hypot(W, D) * .5 + 30;
    for (let h = 0; h < 2; h++) {
      const N = det > .5 ? 22 : 10;
      for (let i = 0; i <= N; i++) { const t = i / N, a = tt * .6 + t * 9 + h * Math.PI, rr = Rv * (1 + .3 * Math.sin(t * 5 + tt)) * (1 - t * .25);
        R.quads.alpha.push(cx + Math.cos(a) * rr, gy + 6 + H * t * 1.1, cz + Math.sin(a) * rr * (D / Math.max(W, D) * .6 + .4), 22 + 10 * t, .8, .6, .33, .2 + .1 * Math.sin(tt * 2 + i), 0, 3, 0, 0); }
    }
    // sand pouring from the eaves + hieroglyph bands that flicker
    for (let side = 0; side < 4; side++) {
      const [x, z] = wallPt(b, side, .5, 4), L = H * .6;
      for (let k = 0; k < 8; k++) { const t = k / 8, yy = H - L * ((t + tt * .5) % 1); R.quads.alpha.push(x + Math.sin(tt * 3 + k + side) * 1.5, gy + yy, z, 9, .82, .64, .36, .3, 0, 3, 0, 0); }
      if (det > .5) for (let k = 0; k < 7; k++) { const u0 = .08 + k * .13, fl = .45 + .55 * Math.sin(tt * 3 + k * 1.7 + side), [x0, z0] = wallPt(b, side, u0 + .035, 3); R.glow(x0, H * .55, z0, 11, gold[0], gold[1] * .85, gold[2] * .5, .75 * Math.max(0, fl), 0); }
      if (Math.random() < .5 * q()) emit({ x: x + (Math.random() - .5) * 10, y: H, z: z + (Math.random() - .5) * 10, vx: 0, vy: -10, vz: 0, grav: 160, life: .9, age: 0, s0: 4, s1: 2, col: [.7, .55, .3], a: .5, kind: 3, add: false });
    }
    ring(cx, cz, Math.max(W, D) * .85, gold, .3, 9, -tt * .35, 1.4); ring(cx, cz, Math.max(W, D) * .6, scl(gold, .8), .18, 7, tt * .2, 1.5);
  }

  // ============================================================ 3. FROST — the frozen cairn
  function themedFrost(c) {
    const { b, cx, cz, H, gy, tt, acc, sd, det, v } = c, W = b.w, D = b.h, top = gy + H;
    const ice = mat([.35, .72, 1.25], { emissive: [.14, .5, .95], alpha: .86, rim: 1.6, rimCol: [.5, .95, 1.6], rough: .05, metal: .2, shadow: false });
    const iceD = mat([.22, .5, 1.0], { emissive: [.08, .3, .7], alpha: .9, rim: 1.3, rimCol: [.4, .85, 1.5], rough: .05, shadow: false });
    // crystal spires bursting through the roof: one great central one, a ring of leaning ones, each with companion shards
    const nS = 4 + v + (det > .6 ? 2 : 0);
    seg3(U().cone, cx, H - 8, cz, cx + 8, H + 140 + 16 * v, cz - 5, 15, ice);
    seg3(U().cone, cx, H - 8, cz, cx - 10, H + 95, cz + 8, 11, iceD);
    for (let i = 0; i < nS; i++) {
      const a = i / nS * TAU + c.sd, rr = Math.min(W, D) * (.28 + .12 * hash(c.sd + i)), bx = cx + Math.cos(a) * rr, bz = cz + Math.sin(a) * rr, h = 65 + 50 * hash(c.sd + i * 3.3), lean = 22 + 14 * hash(c.sd + i * 5);
      seg3(U().cone, bx, H - 6, bz, bx + Math.cos(a) * lean, H + h, bz + Math.sin(a) * lean, 9.5, ice);
      if (det > .6) { seg3(U().cone, bx, H - 6, bz, bx + Math.cos(a + .6) * lean * 1.5, H + h * .6, bz + Math.sin(a + .6) * lean * 1.5, 6, iceD); R.glow(bx + Math.cos(a) * lean, H + h, bz + Math.sin(a) * lean, 14, .5, 1.1, 1.7, .55 + .2 * Math.sin(tt * 2 + i), 0); }
    }
    R.glow(cx, H + 90, cz, 64, .4, .9, 1.6, .18 + .06 * Math.sin(tt * 2), 0);
    R.light(cx, cz, H + 60, 300, .4, .85, 1.6, .55);
    // icicle fringe hanging from the whole roof edge
    for (let side = 0; side < 4; side++) {
      const len = side % 2 ? D : W, n = Math.max(3, Math.round(len / (det > .5 ? 24 : 40)));
      for (let k = 0; k < n; k++) { const u = (k + .5) / n, L = 10 + 26 * hash(c.sd + side * 4.1 + k * 1.3), [x, z] = wallPt(b, side, u, 2); R.rib.line([x, top, z, x, top - L * 1.3, z], 7, .4, .8, .95, 1.25, .92); }
    }
    // aurora rippling over the roof (a chain of soft glows, no hard ribbons)
    if (det > .4) for (let k = 0; k < 3; k++) {
      const col = [[.3, 1.5, 1.0], [.4, 1.0, 1.6], [.9, .5, 1.6]][k], N = 16;
      for (let i = 0; i <= N; i++) { const t = i / N; R.glow(cx + (t - .5) * W * 1.7, H + 125 + k * 22 + 20 * Math.sin(tt * .8 + i * .5 + k), cz + Math.sin(i * .6 + tt * .3 + k * 2) * D * .35, 38, col[0], col[1], col[2], .17 + .06 * Math.sin(tt + i + k), 0); }
    }
    // orbiting ice shards
    for (let k = 0; k < (det > .5 ? 6 : 3); k++) { const a = tt * .7 + k * TAU / 6, rr = Math.hypot(W, D) * .42 + 20; R.draw(U().octa, mm(cx + Math.cos(a) * rr, H + 46 + Math.sin(tt * 1.5 + k) * 8, cz + Math.sin(a) * rr, tt * 2 + k, 5.5, 15, 5.5), ice); }
    // frost seal on the ground with cracks running out from the walls
    const Rr = Math.max(W, D) * .85;
    R.draw(U().hexRing, mm(cx, 5, cz, tt * .15, Rr, Rr, Rr, 1.5708), mat([.7, .92, 1.2], { emissive: [.2, .5, .8], alpha: .55, shadow: false }));
    ring(cx, cz, Rr, [.5, 1.2, 1.7], .3, 9, tt * .3, 1.4); ring(cx, cz, Rr * .6, [.7, 1.4, 1.8], .22, 7, 0, 1.5);
    if (det > .4) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU + c.sd, [ex, ez, ca, sa] = rectEdge(b, a, 4), L = 60 + 60 * hash(c.sd + i * 2.3), pts = [];
      for (let s = 0; s <= 6; s++) { const t = s / 6, w = (hash(c.sd + i + s * 9) - .5) * 14; pts.push(ex + ca * L * t - sa * w, gy + 2, ez + sa * L * t + ca * w); } R.rib.line(pts, 3.4, .8, .6, 1.2, 1.6, .55); }
    if (Math.random() < .6 * q()) emit({ x: cx + (Math.random() - .5) * W * 1.6, y: H + 60 + Math.random() * 30, z: cz + (Math.random() - .5) * D * 1.6, vx: (Math.random() - .5) * 10, vy: -26, vz: (Math.random() - .5) * 10, life: 2.4, age: 0, s0: 3, s1: 1, col: [1.2, 1.4, 1.7], a: .75, kind: 5, drag: .1 });
  }

  // ============================================================ 4. LAVA — the infernal maw
  function themedLava(c) {
    const { b, cx, cz, H, gy, tt, acc, sd, det, v } = c, W = b.w, D = b.h, top = gy + H;
    const obs = mat([.06, .03, .04], { metal: .85, rough: .22, emissive: [.22, .035, .02] });
    const hot = mat([1.2, .35, .05], { emissive: [1.6, .45, .08], shadow: false });
    const mag = mixC([1.9, .55, .1], acc, .2);
    // magma fissures splitting every wall
    for (let side = 0; side < 4; side++) {
      const len = side % 2 ? D : W, n = Math.max(1, Math.round(len / 120 * (.6 + .4 * det)));
      for (let k = 0; k < n; k++) {
        const u0 = (k + .5) / n, ph = hash(c.sd + side * 3.7 + k * 2.1) * TAU, N = det > .5 ? 12 : 7, pts = [], fl = .75 + .25 * Math.sin(tt * 3 + ph);
        for (let i = 0; i <= N; i++) { const t = i / N, u = clamp(u0 + (i % 2 ? 1 : -1) * .035 * (1 - t * .3), .03, .97), [x, z] = wallPt(b, side, u, 2.5); pts.push(x, top - H * t, z); }
        R.rib.line(pts, 4.4, 2, mag[0], mag[1] * .8, mag[2] * .6, .8 * fl);
        if (det > .5) for (let i = 1; i < N; i += 2) R.glow(pts[i * 3], pts[i * 3 + 1] - gy, pts[i * 3 + 2], 13 + 3 * Math.sin(tt * 4 + i), mag[0], mag[1] * .8, mag[2], .45 * fl, 0);
      }
    }
    // four curved obsidian horns rising from the corners and curling in over the roof
    [[b.x, b.y], [b.x + W, b.y], [b.x + W, b.y + D], [b.x, b.y + D]].forEach(([x, z], i) => {
      const ox = Math.sign(x - cx) || 1, oz = Math.sign(z - cz) || 1, len = Math.hypot(ox, oz); let px = x, py = H, pz = z, rad = 9.5; const Ls = 30 + 8 * v;
      for (let s = 0; s < (det > .6 ? 4 : 2); s++) {
        const out = s < 2 ? .75 : -.55, nx = px + ox / len * Ls * out, nz = pz + oz / len * Ls * out, ny = py + Ls * (1 - s * .12);
        seg3(s === 3 ? U().cone : U().cyl, px, py, pz, nx, ny, nz, rad, obs); px = nx; py = ny; pz = nz; rad *= .68;
      }
      R.glow(px, py, pz, 18, mag[0], mag[1], mag[2], .8 + .2 * Math.sin(tt * 5 + i), 0);
    });
    // tilted rings of fire with charred runes, around a molten core
    const cy = H + 96 + Math.sin(tt * 1.4) * 5, pul = 1 + .1 * Math.sin(tt * 4);
    R.draw(U().torus, mm(cx, cy, cz, tt * .7, 52, 52, 52, .6, tt * .3), hot);
    if (det > .5) R.draw(U().torus, mm(cx, cy, cz, -tt * .9, 38, 38, 38, -.5, tt * .4), hot);
    R.draw(U().sphere, mm(cx, cy, cz, tt, 17 * pul, 17 * pul, 17 * pul), mat([1.4, .4, .05], { emissive: [2, .6, .1], rim: 1.2, rimCol: [1.6, .5, .1], shadow: false }));
    for (let k = 0; k < (det > .5 ? 6 : 3); k++) { const a = tt * .9 + k * TAU / 6; R.draw(U().box, mm(cx + Math.cos(a) * 52, cy + Math.sin(a * 2) * 10, cz + Math.sin(a) * 52, -a, 11, 15, 2.2), mat([.1, .05, .05], { emissive: [1.8 * (.6 + .4 * Math.sin(tt * 3 + k)), .5, .08], shadow: false })); }
    R.glow(cx, cy, cz, 80, mag[0], mag[1] * .8, mag[2], .24 + .08 * Math.sin(tt * 4), 0);
    R.light(cx, cz, cy, 340, 1.8, .55, .12, .9);
    // dripping lava, smoke and heat
    if (Math.random() < .7 * q()) { const side = Math.floor(Math.random() * 4), [x, z] = wallPt(b, side, Math.random(), 4); emit({ x, y: H - 2, z, vx: 0, vy: -4, vz: 0, grav: 420, life: .7, age: 0, s0: 5, s1: 2, col: [1.9, .6, .1], a: .9, kind: 0, drag: 0 }); }
    if (Math.random() < .45 * q()) emit({ x: cx + (Math.random() - .5) * W * .7, y: H + 4, z: cz + (Math.random() - .5) * D * .7, vx: 8, vy: 36 + Math.random() * 26, vz: 4, life: 2.4, age: 0, s0: 12, s1: 30, col: [.1, .08, .08], a: .45, kind: 3, add: false, drag: .3 });
    R.decal(cx, cz, Math.max(W, D) * .8, 1.7, .45, .08, .4, 7, 0, 0, true, 1.4); ring(cx, cz, Math.max(W, D) * .85, mag, .35, 9, tt * .5, 1.5);
  }

  // ============================================================ 5. VOID — the voidgate
  function themedVoid(c) {
    const { b, cx, cz, H, gy, tt, acc, sd, det, v } = c, W = b.w, D = b.h, top = gy + H;
    const neon = [[.2, 1.4, 1.8], [1.7, .3, 1.5], [.9, .45, 1.9]], nc = (i) => mixC(neon[i % 3], acc, .2);
    const dark = mat([.07, .05, .15], { metal: .8, rough: .2, emissive: [.03, .02, .07] });
    const ty = H + 130 + Math.sin(tt * 1.1) * 6;
    // the rift: a black sun with an accretion ring and a halo of bent light
    R.draw(U().sphere, mm(cx, ty, cz, 0, 22, 22, 22), mat([0, 0, 0], { emissive: [.01, 0, .03], rim: 2.6, rimCol: [1.2, .35, 1.7], shadow: false }));
    R.draw(U().torus, mm(cx, ty, cz, tt * .8, 44, 44, 44, 1.2, tt * .25), mat([1, .5, 1.6], { emissive: [1.3, .5, 1.7], shadow: false }));
    R.draw(U().torus, mm(cx, ty, cz, -tt * 1.1, 32, 32, 32, .4, -tt * .3), mat([.4, 1.2, 1.7], { emissive: [.3, 1.2, 1.7], shadow: false }));
    R.glow(cx, ty, cz, 100, .8, .3, 1.6, .22 + .08 * Math.sin(tt * 3), 0);
    R.light(cx, cz, ty, 340, .8, .3, 1.6, .85);
    // a rotating tesseract above it: two cubes drawn as edges, counter-rotating
    const cube = (s, ry, rx, col) => {
      const P = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        let x = sx * s, y = sy * s, z = sz * s; const cy1 = Math.cos(ry), sy1 = Math.sin(ry), x1 = x * cy1 - z * sy1, z1 = x * sy1 + z * cy1; const cx1 = Math.cos(rx), sx1 = Math.sin(rx), y1 = y * cx1 - z1 * sx1, z2 = y * sx1 + z1 * cx1;
        P.push([cx + x1, ty + 96 + y1, cz + z2]);
      }
      const em = mat(col, { emissive: [col[0] * 1.2, col[1] * 1.2, col[2] * 1.2], shadow: false });
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) { const d = (i ^ j); if (d === 1 || d === 2 || d === 4) seg3(U().cyl, P[i][0], P[i][1] - gy, P[i][2], P[j][0], P[j][1] - gy, P[j][2], 1.6, em); }
    };
    if (det > .5) { cube(22, tt * .9, tt * .6, nc(0)); cube(12, -tt * 1.3, -tt * .8, nc(1)); } else R.glow(cx, ty + 96, cz, 40, .5, 1.2, 1.7, .6, 0);
    // fractured monoliths orbiting, jittering as if the signal is breaking up
    const step = Math.floor(tt * 7), nM = det > .5 ? 7 : 4;
    for (let i = 0; i < nM; i++) {
      const a = tt * .35 + i * TAU / nM, rr = Math.hypot(W, D) * .5 + 34, jx = (hash(sd + i + step * .37) - .5) * (hash(step + i) < .12 ? 14 : 2), y = H + 24 + 70 * hash(c.sd + i * 2.2) + Math.sin(tt + i) * 6, h = 34 + 30 * hash(c.sd + i);
      const x = cx + Math.cos(a) * rr + jx, z = cz + Math.sin(a) * rr; const col = nc(i);
      R.draw(U().box, mm(x, y, z, -a + .3, 10, h * 1.3, 4, .15 * Math.sin(tt + i), .2), dark);
      R.draw(U().box, mm(x, y, z, -a + .3, 10.8, h * 1.3 + .8, 1.1, .15 * Math.sin(tt + i), .2), mat(col, { emissive: [col[0], col[1], col[2]], alpha: .85, shadow: false }));
      R.glow(x, y + h / 2, z, 8, col[0], col[1], col[2], .55, 0);
    }
    // dashed data streams running up each corner into the rift
    [[b.x, b.y], [b.x + W, b.y], [b.x + W, b.y + D], [b.x, b.y + D]].forEach(([x, z], i) => {
      const col = nc(i);
      for (let k = 0; k < (det > .5 ? 5 : 2); k++) { const t0 = ((tt * .35 + k * .2 + i * .13) % 1), y0 = top - 10 + t0 * (ty + 60 - top), y1 = y0 + 22;
        R.rib.line([x + (cx - x) * t0 * .6, y0, z + (cz - z) * t0 * .6, x + (cx - x) * (t0 + .05) * .6, y1, z + (cz - z) * (t0 + .05) * .6], 5, 2, col[0], col[1], col[2], .9 * (1 - t0 * .5)); }
    });
    // scan-lines sliding over the walls
    if (det > .5) for (let k = 0; k < 3; k++) { const f = (tt * .22 + k / 3) % 1, col = nc(k + 1), hh = top - H * (1 - f); for (let side = 0; side < 4; side++) { const [x0, z0] = wallPt(b, side, .02, 3), [x1, z1] = wallPt(b, side, .98, 3); R.rib.line([x0, hh, z0, x1, hh, z1], 3.4, 3.4, col[0] * .8, col[1] * .8, col[2] * .8, .3 * Math.sin(f * Math.PI)); } }
    // hex seal on the ground
    const Rr = Math.max(W, D) * .85; R.draw(U().hexRing, mm(cx, 4, cz, tt * .25, Rr, Rr, Rr, 1.5708), mat([.9, .45, 1.8], { emissive: [.6, .25, 1.2], alpha: .5, shadow: false }));
    ring(cx, cz, Rr, nc(1), .32, 9, -tt * .6, 1.4); ring(cx, cz, Rr * .55, nc(0), .22, 7, tt * .4, 1.5);
    if (Math.random() < .5 * q()) emit({ x: cx + (Math.random() - .5) * W, y: 4, z: cz + (Math.random() - .5) * D, vx: 0, vy: 40, vz: 0, life: 1.6, age: 0, s0: 4, s1: 0, col: [.9, .5, 1.8], a: .8, kind: 5, drag: .1 });
  }

  const THEMED = { 1: themedMeadow, 2: themedDesert, 3: themedFrost, 4: themedLava, 5: themedVoid };

  // the previous floating-sigil design, kept as the fallback for any map id that has no dedicated look
  function sigilCrystal(kind, acc, em, i, tt) {
    if (kind === 'flame') return { mesh: U().cone, sx: 5, sy: 14, sz: 5, col: [1, .5, .2], spin: tt * 3 + i };
    if (kind === 'frost' || kind === 'snowflake' || kind === 'crystal') return { mesh: U().octa, sx: 7, sy: 16, sz: 7, col: [.8, .95, 1], spin: tt * 1.5 + i };
    if (kind === 'spike') return { mesh: U().cone, sx: 6, sy: 18, sz: 6, col: [acc[0]*.6, acc[1]*.6, acc[2]*.6], spin: tt * 2 + i };
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
      R.draw(k.mesh, mm(ox, cy, oz, k.spin, k.sx, k.sy, k.sz), mat(k.col, { emissive: [k.col[0] * 1.6, k.col[1] * 1.6, k.col[2] * 1.6], metal: .4, rough: .1, shadow: false })); R.glow(ox, cy, oz, 14, k.col[0], k.col[1], k.col[2], .8, 0); }
    R.draw(U().cyl, mm(cx, (base + y) / 2, cz, 0, 2.4, y - base, 2.4), mat(acc, { emissive: acc, alpha: .25, shadow: false }));
    R.glow(cx, y, cz, sr * 1.3, acc[0], acc[1], acc[2], .5 + 0.2 * Math.sin(tt * 3), 0); R.light(cx, cz, y, 300, acc[0], acc[1], acc[2], .7);
    if (Math.random() < 0.6 * q()) emit({ x: cx + (Math.random() - .5) * sr, y: base, z: cz + (Math.random() - .5) * sr, vx: 0, vy: -22, vz: 0, life: 1.3, age: 0, s0: 5, s1: 0, col: em, a: .7, kind: 5, drag: .2 });
  }
  function drawThemedSigils(F, tt) {
    const bs = F.world && F.world.buildings; if (!bs) return;
    const tid = (F.theme && F.theme.id) || 1, ex = R.eye[0], ez = R.eye[2], fn = THEMED[tid];
    for (const b of bs) {
      if (!b._themed) continue;
      const cx = b.x + b.w / 2, cz = b.y + b.h / 2, d = Math.hypot(ex - cx, ez - cz);
      if (d > 2600) continue;                                   // too far to read: skip entirely
      if (!fn) { drawSigilLegacy(b, tt); continue; }
      const sd = b.x * .0137 + b.y * .0071;
      fn({ b, cx, cz, H: b._sigilY || 120, gy: R.groundY(cx, cz), tt, acc: b._sigilAcc || [1, 1, 1], kind: b._sigilKind || 'ring', sd, det: d < 650 ? 1 : d < 1400 ? .6 : .32, v: Math.floor(hash(sd * 3.7) * 3) });
    }
  }
  return drawThemedSigils;
};
