/* ======================================================================
   world3d.js  —  the vertical dimension for Monster Arena
   Terrain hills, houses with up to 3 floors (stairs inside), bridges that
   link houses on the same or different floors, player gravity / walking on
   all of it, and 3D bullet helpers (up/down aim, terrain + floor blocking).
   Everything is generated deterministically from the world's building list,
   so the same layout appears whenever the same buildings exist.
   ====================================================================== */
(function (G) {
  'use strict';
  const FH = 128, STEP = 36, SLAB = 12, EYE = 38, BODY = 50;
  const SW = 46;                       // stair width
  const BR_HALF = 40, BR_OPEN = 88;    // bridge half width, wall opening width
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function hash2(ix, iy, seed) { let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed, oct) { let s = 0, a = .5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17); n += a; f *= 2; a *= .5; } return s / n; }

  const W3 = G.W3 = { FH, STEP, SLAB, EYE, BODY, enabled: true, data: null, key: '' };

  // ---- hill shape per map. Returns 0..1 (before the flat-pad mask) ----
  // Hills: fewer, broader and lower than before (peaks stay well under one storey so they never swallow a doorway).
  const AMP = { 1: 74, 2: 64, 3: 78, 4: 72, 5: 62 };
  function shape(tid, x, y) {
    switch (tid) {
      case 1: { const n = fbm(x * .00085, y * .00085, 11, 3); return sstep(.45, .74, n); }                                  // a few soft rolling meadow hills
      case 2: { const n = fbm(x * .0007, y * .0007, 23, 2); const r = Math.sin((x * .0011 + y * .0008) + n * 6.2) * .5 + .5; return Math.pow(r, 4) * .9 * sstep(.42, .7, n) + n * .05; } // sparse dunes
      case 3: { const n = fbm(x * .001, y * .001, 37, 3); const r = 1 - Math.abs(2 * n - 1); return Math.pow(r, 4.4) * sstep(.3, .56, fbm(x * .0007, y * .0007, 41, 2)); } // a few sharp glacier ridges
      case 4: { const n = fbm(x * .001, y * .001, 51, 3); const r = 1 - Math.abs(2 * fbm(x * .003, y * .003, 59, 2) - 1); return sstep(.42, .7, n) * (.55 + .45 * r); } // scattered volcanic mounds
      default: { const q = sstep(.43, .74, fbm(x * .0009, y * .0009, 71, 2)) * 3, f = Math.floor(q), fr = q - f; return Math.min(1, (f + sstep(.35, .65, fr)) / 3); }  // a few stepped digital terraces
    }
  }

  const rectDist = (x, y, r) => { const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h)); return Math.hypot(dx, dy); };

  W3.keyOf = function (world, tid) {
    const b = world.buildings, s = world.solids, h = world.hazards;
    return [tid, world.w, world.h, b.length, s.length, h.length, b[0] ? b[0].x + ',' + b[0].y : '', b[b.length - 1] ? b[b.length - 1].x + ',' + b[b.length - 1].y : '', s[4] ? s[4].x + ',' + s[4].y : ''].join('|');
  };

  // ====================================================== BUILD
  W3.ensure = function (world, tid) {
    if (!world || !world.buildings) return null;
    const key = W3.keyOf(world, tid);
    if (W3.data && W3.key === key) { if (world.walls.length && world.walls[0].top === undefined) annotate(world, W3.data); return W3.data; }
    W3.key = key; W3.data = build(world, tid); return W3.data;
  };

  function build(world, tid) {
    const bs = world.buildings, D = { tid, w: world.w, h: world.h, buildings: [], surfaces: [], prisms: [], stairs: [], bridges: [], flat: [] };
    const r = rng((world.w * 31 + world.h * 17 + tid * 7919 + bs.length * 131 + (world.solids.length * 7)) | 0);

    // ---- floors + stairs per building
    bs.forEach((b, i) => {
      const t = b.t || 18, inn = b.inner || { x: b.x + t, y: b.y + t, w: b.w - 2 * t, h: b.h - 2 * t };
      const ix0 = inn.x, iy0 = inn.y, ix1 = inn.x + inn.w, iy1 = inn.y + inn.h, iw = inn.w, ih = inn.h;
      const horiz = iw >= ih, longD = horiz ? iw : ih, shortD = horiz ? ih : iw;
      let n = 1; const roll = r();
      if (shortD >= 124 && longD >= 150) n = roll < .35 ? 2 : 3; else if (shortD >= 62 && longD >= 140) n = roll < .2 ? 1 : 2;
      if (roll > .93) n = 1;   // a few single-storey huts
      if (b._type) n = 1;       // themed landmarks are solid single-storey shapes — no stairs/slabs/bridges
      const SL = clamp(longD * .55, 120, 200);
      const m = { i, b, t, n, inn, stairs: [], gaps: [], slabs: [] };
      if (n >= 2) {
        // Door keep-out zones: a strip running inward from every door, so a staircase never blocks an entrance.
        const keep = (b.doors || []).map(d => {
          const DEPTH = 64, LAT = 12;
          if (d.side === 'top') return { x: d.x - LAT, y: b.y, w: d.w + 2 * LAT, h: t + DEPTH };
          if (d.side === 'bottom') return { x: d.x - LAT, y: b.y + b.h - t - DEPTH, w: d.w + 2 * LAT, h: t + DEPTH };
          if (d.side === 'left') return { x: b.x, y: d.y - LAT, w: t + DEPTH, h: d.h + 2 * LAT };
          return { x: b.x + b.w - t - DEPTH, y: d.y - LAT, w: t + DEPTH, h: d.h + 2 * LAT };
        });
        const ovArea = (a, c) => Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));
        // Candidate runs: along either long wall (and the middle row when the room is wide), starting at several
        // offsets, rising either way. The original corner layouts come first so clear buildings look unchanged.
        const cands = [];
        const shortSpan = horiz ? ih : iw, longSpan = horiz ? iw : ih;
        const rows = [8, shortSpan - 8 - SW]; if (shortSpan >= 124) rows.push((shortSpan - SW) / 2);
        const mk = (row, off, dir, L) => horiz ? { x: ix0 + off, y: iy0 + row, w: L, h: SW, ax: 'x', dir } : { x: ix0 + row, y: iy0 + off, w: SW, h: L, ax: 'y', dir };
        const Ls = [SL]; if (SL > 104 && longSpan - 16 >= 104) Ls.push(104);   // a shorter, steeper run as a last resort
        for (const L of Ls) {
          const offs = []; for (let o = 8; o <= longSpan - 8 - L + .5; o += 24) offs.push(o);
          const lastOff = longSpan - 8 - L; if (!offs.length || offs[offs.length - 1] < lastOff - 1) offs.push(lastOff);
          if (L === SL) cands.push(mk(rows[0], offs[0], 1, L), mk(rows[1], offs[offs.length - 1], -1, L));
          for (const row of rows) for (const off of offs) for (const dir of [1, -1]) cands.push(mk(row, off, dir, L));
        }
        // How much a stair obstructs a doorway: overlap with the keep-out strip, weighted by how tall the ramp is there
        // (the first steps are walkable, a tall ramp is a wall).
        const NS = 10;
        const penalty = (c) => {
          let a = 0;
          for (let si = 0; si < NS; si++) {
            const u0 = si / NS, u1 = (si + 1) / NS, um = (si + .5) / NS, hh = (c.dir > 0 ? um : 1 - um) * FH;
            const seg = c.ax === 'x' ? { x: c.x + c.w * u0, y: c.y, w: c.w / NS, h: c.h } : { x: c.x, y: c.y + c.h * u0, w: c.w, h: c.h / NS };
            const wgt = hh <= STEP * .75 ? .15 : 1 + hh / FH * 2;
            for (const k of keep) a += ovArea(seg, k) * wgt;
          }
          return a;
        };
        const pick = (other) => {
          let best = null, bs = Infinity;
          for (const c of cands) {
            let sc = penalty(c); if ((c.ax === 'x' ? c.w : c.h) < SL) sc += 40;
            if (other) { const g = 26; sc += ovArea({ x: c.x - g, y: c.y - g, w: c.w + 2 * g, h: c.h + 2 * g }, other) * 6; }
            if (sc < bs - 1e-6) { bs = sc; best = c; if (sc === 0) break; }
          }
          return Object.assign({}, best);
        };
        // A doorway is blocked only if the tall part of a ramp leaves less than a body-width (36) of clear passage.
        // (The first steps of a ramp are walkable, so they don't count.) If nowhere clears every door, drop that storey's stairs.
        const blocksDoor = (c) => {
          for (const d of (b.doors || [])) {
            const hz = d.side === 'top' || d.side === 'bottom', DEP = t + 56;
            const zone = d.side === 'top' ? { x: d.x, y: b.y, w: d.w, h: DEP } : d.side === 'bottom' ? { x: d.x, y: b.y + b.h - DEP, w: d.w, h: DEP }
              : d.side === 'left' ? { x: b.x, y: d.y, w: DEP, h: d.h } : { x: b.x + b.w - DEP, y: d.y, w: DEP, h: d.h };
            const iv = [];
            for (let si = 0; si < NS; si++) {
              const um = (si + .5) / NS, hh = (c.dir > 0 ? um : 1 - um) * FH; if (hh <= STEP * 1.1) continue;
              const u0 = si / NS, seg = c.ax === 'x' ? { x: c.x + c.w * u0, y: c.y, w: c.w / NS, h: c.h } : { x: c.x, y: c.y + c.h * u0, w: c.w, h: c.h / NS };
              if (!ovArea(seg, zone)) continue;
              iv.push(hz ? [Math.max(seg.x, zone.x), Math.min(seg.x + seg.w, zone.x + zone.w)] : [Math.max(seg.y, zone.y), Math.min(seg.y + seg.h, zone.y + zone.h)]);
            }
            if (!iv.length) continue;
            iv.sort((p, q) => p[0] - q[0]);
            let cov = 0, cs = iv[0][0], ce = iv[0][1];
            for (let k = 1; k < iv.length; k++) { if (iv[k][0] <= ce) ce = Math.max(ce, iv[k][1]); else { cov += ce - cs; cs = iv[k][0]; ce = iv[k][1]; } }
            cov += ce - cs;
            if ((hz ? d.w : d.h) - cov < 36) return true;
          }
          return false;
        };
        const A = pick(null);
        if (blocksDoor(A)) { m.n = 1; }
        else {
          m.stairs.push(Object.assign(A, { z0: 0, z1: FH, k: 'stair', b: i, level: 0 }));
          if (n >= 3) {
            const B = pick(A);
            if (blocksDoor(B)) m.n = 2;
            else m.stairs.push(Object.assign(B, { z0: FH, z1: 2 * FH, k: 'stair', b: i, level: 1 }));
          }
        }
        // Lets bridge placement shove a staircase aside (never onto a door, another stair, or any of `avoid`).
        m.relocate = (level, avoid) => {
          const cur = m.stairs.find(q => q.level === level); if (!cur) return false;
          const other = m.stairs.find(q => q.level !== level);
          let best = null, bs = Infinity;
          for (const c of cands) {
            if (blocksDoor(c)) continue;
            let sc = penalty(c);
            if (other) sc += ovArea({ x: c.x - 26, y: c.y - 26, w: c.w + 52, h: c.h + 52 }, other) * 6;
            for (const a of avoid) sc += ovArea(c, a) * 50;
            if ((c.ax === 'x' ? c.w : c.h) < SL) sc += 40;
            if (sc < bs) { bs = sc; best = c; }
          }
          if (!best) return false;
          for (const a of avoid) if (ovArea(best, a) > 0) return false;
          Object.assign(cur, { x: best.x, y: best.y, w: best.w, h: best.h, ax: best.ax, dir: best.dir });
          return true;
        };
      }
      D.buildings.push(m);
    });

    // ---- bridges between nearby houses (same or different floors)
    const used = new Array(bs.length).fill(0);
    const bigSolids = world.solids.filter(s => (s.w > 66 || s.h > 58));
    const cand = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const A = bs[i], B = bs[j];
      if (D.buildings[i].n < 2 || D.buildings[j].n < 2) continue;
      const t = Math.max(A.t || 18, B.t || 18);
      // north-south
      for (const [P, Q, pi, qi] of [[A, B, i, j], [B, A, j, i]]) {
        const gap = Q.y - (P.y + P.h);
        if (gap >= 70 && gap <= 700) {
          const lo = Math.max(P.x, Q.x) + t + 6 + BR_OPEN / 2, hi = Math.min(P.x + P.w, Q.x + Q.w) - t - 6 - BR_OPEN / 2;
          if (hi - lo >= 0) cand.push({ axis: 'y', p: pi, q: qi, gap, lo, hi, d: gap });
        }
        const gx = Q.x - (P.x + P.w);
        if (gx >= 70 && gx <= 700) {
          const lo = Math.max(P.y, Q.y) + t + 6 + BR_OPEN / 2, hi = Math.min(P.y + P.h, Q.y + Q.h) - t - 6 - BR_OPEN / 2;
          if (hi - lo >= 0) cand.push({ axis: 'x', p: pi, q: qi, gap: gx, lo, hi, d: gx });
        }
      }
    }
    cand.sort((a, b) => a.d - b.d);
    for (const c of cand) {
      if (used[c.p] >= 3 || used[c.q] >= 3) continue;
      const P = bs[c.p], Q = bs[c.q], mp = D.buildings[c.p], mq = D.buildings[c.q];
      const mid = (c.lo + c.hi) / 2, span = (c.hi - c.lo) * .5, side = (c.axis === 'y') ? ['bottom', 'top'] : ['right', 'left'];
      let cc = 0, corr = null, kP = 1, kQ = 1, placed = false;
      // try several positions along the shared wall (and different floor pairings) before giving up on this pair
      for (let at = 0; at < 10 && !placed; at++) {
      cc = at === 0 ? mid + (r() * 2 - 1) * span * .6 : c.lo + (c.hi - c.lo) * ((at * .381 + .13) % 1);
      corr = c.axis === 'y' ? { x: cc - BR_HALF - 10, y: P.y + P.h, w: 2 * BR_HALF + 20, h: c.gap } : { x: P.x + P.w, y: cc - BR_HALF - 10, w: c.gap, h: 2 * BR_HALF + 20 };
      {
        let bad = false;   // corridor must not cross a third house or a big rock/forest
        for (const m of D.buildings) { if (m.i === c.p || m.i === c.q) continue; const o = m.b; if (!(corr.x + corr.w < o.x - 8 || o.x + o.w + 8 < corr.x || corr.y + corr.h < o.y - 8 || o.y + o.h + 8 < corr.y)) { bad = true; break; } }
        if (!bad) for (const s of bigSolids) { if (!(corr.x + corr.w < s.x - 8 || s.x + s.w + 8 < corr.x || corr.y + corr.h < s.y - 8 || s.y + s.h + 8 < corr.y)) { bad = true; break; } }
        if (bad) continue;
      }
      // clash with an existing bridge opening on the same wall?
      kP = 1 + Math.floor(r() * (mp.n - 1)); kQ = 1 + Math.floor(r() * (mq.n - 1));
      const maxSlope = .72; if (Math.abs(kP - kQ) * FH / c.gap > maxSlope) kQ = kP <= mq.n - 1 ? kP : mq.n - 1;
      if (kP > mp.n - 1) kP = mp.n - 1;
      const clash = (m, sd, k) => m.gaps.some(g => g.side === sd && g.k === k && Math.abs(g.c - cc) < BR_OPEN + 30);
      const openRect = (m, sd, pos) => {
        const bb = m.b, tt = m.t, W = BR_OPEN + 16, DEP = 56;
        return sd === 'top' ? { x: pos - W / 2, y: bb.y, w: W, h: tt + DEP } : sd === 'bottom' ? { x: pos - W / 2, y: bb.y + bb.h - tt - DEP, w: W, h: tt + DEP }
          : sd === 'left' ? { x: bb.x, y: pos - W / 2, w: tt + DEP, h: W } : { x: bb.x + bb.w - tt - DEP, y: pos - W / 2, w: tt + DEP, h: W };
      };
      const hitR = (o, q) => !(o.x + o.w < q.x || q.x + q.w < o.x || o.y + o.h < q.y || q.y + q.h < o.y);
      const blockers = (m, sd, k) => {   // staircases that would block an opening on wall `sd` at storey k
        const o = openRect(m, sd, cc);
        return m.stairs.filter(st => {
          if (st.level === k - 1) return hitR(o, st);               // arrives through a hole in this floor: can't open onto the hole
          if (st.level !== k) return false;
          const f = .3, u0 = st.dir > 0 ? f : 0, u1 = st.dir > 0 ? 1 : 1 - f;   // rises from this floor: only its tall part is in the way
          const tall = st.ax === 'x' ? { x: st.x + st.w * u0, y: st.y, w: st.w * (u1 - u0), h: st.h } : { x: st.x, y: st.y + st.h * u0, w: st.w, h: st.h * (u1 - u0) };
          return hitR(o, tall);
        });
      };
      // blocked? try sliding the offending staircase somewhere clear of this opening and any opening already cut
      const stairBlocks = (m, sd, k) => {
        const bl = blockers(m, sd, k); if (!bl.length) return false;
        for (const st of bl) {
          const avoid = [openRect(m, sd, cc)];
          for (const g of m.gaps) if (g.k === st.level || g.k === st.level + 1) avoid.push(openRect(m, g.side, g.c));
          if (!m.relocate || !m.relocate(st.level, avoid)) return true;
        }
        return blockers(m, sd, k).length > 0;
      };
      if (clash(mp, side[0], kP) || clash(mq, side[1], kQ)) continue;
      if (stairBlocks(mp, side[0], kP) || stairBlocks(mq, side[1], kQ)) continue;
      placed = true;
      }
      if (!placed) continue;
      mp.gaps.push({ side: side[0], k: kP, c: cc }); mq.gaps.push({ side: side[1], k: kQ, c: cc });
      used[c.p]++; used[c.q]++;
      const tP = P.t || 18, tQ = Q.t || 18, zP = kP * FH, zQ = kQ * FH;
      let deck, rails;
      if (c.axis === 'y') {
        deck = { x: cc - BR_HALF, y: P.y + P.h - tP, w: 2 * BR_HALF, h: (Q.y + tQ) - (P.y + P.h - tP), ax: 'y', dir: 1, z0: zP, z1: zQ, k: 'deck', b: -1 };
        rails = [{ x: cc - BR_HALF - 6, y: P.y + P.h, w: 6, h: c.gap }, { x: cc + BR_HALF, y: P.y + P.h, w: 6, h: c.gap }];
      } else {
        deck = { x: P.x + P.w - tP, y: cc - BR_HALF, w: (Q.x + tQ) - (P.x + P.w - tP), h: 2 * BR_HALF, ax: 'x', dir: 1, z0: zP, z1: zQ, k: 'deck', b: -1 };
        rails = [{ x: P.x + P.w, y: cc - BR_HALF - 6, w: c.gap, h: 6 }, { x: P.x + P.w, y: cc + BR_HALF, w: c.gap, h: 6 }];
      }
      D.surfaces.push(deck);
      for (const rc of rails) D.prisms.push(Object.assign(rc, { z0: Math.min(zP, zQ), z1: Math.max(zP, zQ) + 46, rail: true }));
      D.bridges.push({ axis: c.axis, cc, p: c.p, q: c.q, kP, kQ, zP, zQ, deck, rails, len: c.gap, from: { x: c.axis === 'y' ? cc : P.x + P.w, y: c.axis === 'y' ? P.y + P.h : cc }, to: { x: c.axis === 'y' ? cc : Q.x, y: c.axis === 'y' ? Q.y : cc } });
      D.flat.push({ x: corr.x - 30, y: corr.y - 30, w: corr.w + 60, h: corr.h + 60 });
    }

    // ---- slabs, upper walls, roofs
    for (const m of D.buildings) {
      const b = m.b, t = m.t, inn = m.inn;
      for (let k = 1; k < m.n; k++) {
        const holes = m.stairs.filter(s => s.level === k - 1).map(s => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
        const slab = { x: inn.x, y: inn.y, w: inn.w, h: inn.h, ax: 'x', dir: 1, z0: k * FH, z1: k * FH, k: 'slab', b: m.i, holes, level: k };
        D.surfaces.push(slab); m.slabs.push(slab);
        // outline walls for this level, with gaps for bridge openings
        const gaps = m.gaps.filter(g => g.k === k);
        const seg = (x0, y0, x1, y1, side) => {   // axis-aligned wall strip, remove bridge openings
          const horizontal = side === 'top' || side === 'bottom';
          let parts = [[horizontal ? x0 : y0, horizontal ? x1 : y1]];
          for (const g of gaps) if (g.side === side) { const a = g.c - BR_OPEN / 2, bb = g.c + BR_OPEN / 2; const np = []; for (const [s0, s1] of parts) { if (bb <= s0 || a >= s1) { np.push([s0, s1]); continue; } if (a > s0) np.push([s0, a]); if (bb < s1) np.push([bb, s1]); } parts = np; }
          for (const [s0, s1] of parts) { if (s1 - s0 < 1) continue; const wall = horizontal ? { x: s0, y: y0, w: s1 - s0, h: y1 - y0 } : { x: x0, y: s0, w: x1 - x0, h: s1 - s0 }; D.prisms.push(Object.assign(wall, { z0: k * FH, z1: (k + 1) * FH, wall: true, b: m.i, level: k, side })); }
        };
        seg(b.x, b.y, b.x + b.w, b.y + t, 'top'); seg(b.x, b.y + b.h - t, b.x + b.w, b.y + b.h, 'bottom');
        seg(b.x, b.y + t, b.x + t, b.y + b.h - t, 'left'); seg(b.x + b.w - t, b.y + t, b.x + b.w, b.y + b.h - t, 'right');
      }
      D.surfaces.push({ x: b.x, y: b.y, w: b.w, h: b.h, ax: 'x', dir: 1, z0: m.n * FH + 8, z1: m.n * FH + 8, k: 'roof', b: m.i });
      for (const s of m.stairs) { D.surfaces.push(s); D.stairs.push(s); }
    }

    // ---- terrain heightmap (flat pads under every structure, hazard and bridge)
    const CELL = 28, gx = Math.ceil(world.w / CELL) + 1, gy = Math.ceil(world.h / CELL) + 1, H = new Float32Array(gx * gy), amp = AMP[tid] || 80;
    const pads = []; for (const b of bs) pads.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    for (const s of world.solids) { if (s.x <= 1 || s.y <= 1 || s.x + s.w >= world.w - 1 || s.y + s.h >= world.h - 1) continue; pads.push(s); }
    for (const h of world.hazards) pads.push({ x: h.x, y: h.y, w: h.w, h: h.h });
    for (const f of D.flat) pads.push(f);
    let hMax = 0;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const x = i * CELL, y = j * CELL;
      let d = Math.min(x, y, world.w - x, world.h - y) - 70;     // flat near the arena walls
      for (const p of pads) { const dd = rectDist(x, y, p); if (dd < d) d = dd; }
      const mask = sstep(22, 150, d);
      const v = mask > 0 ? shape(tid, x, y) * amp * mask : 0;
      H[j * gx + i] = v; if (v > hMax) hMax = v;
    }
    D.grid = { H, gx, gy, CELL, hMax };

    annotate(world, D);
    D.iP = buildIdx(D.prisms); D.iS = buildIdx(D.stairs); D.iF = buildIdx(D.surfaces.filter(q => q.k !== 'roof'));
    return D;
  }

  // ---- tiny uniform-grid index so collision / surface lookups don't scan every prism, stair and slab
  const IDX = 96;
  const ikey = (cx, cy) => cx * 4096 + cy;
  function buildIdx(items) {
    const m = new Map();
    for (const it of items) {
      const x0 = Math.floor(it.x / IDX), x1 = Math.floor((it.x + it.w) / IDX), y0 = Math.floor(it.y / IDX), y1 = Math.floor((it.y + it.h) / IDX);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const k = ikey(cx, cy); let a = m.get(k); if (!a) m.set(k, a = []); a.push(it); }
    }
    return m;
  }
  function idxAny(m, x, y, r, fn) {   // true as soon as fn(item) is true for any item near (x,y)
    const x0 = Math.floor((x - r) / IDX), x1 = Math.floor((x + r) / IDX), y0 = Math.floor((y - r) / IDX), y1 = Math.floor((y + r) / IDX);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) { const a = m.get(ikey(cx, cy)); if (a) for (const it of a) if (fn(it)) return true; }
    return false;
  }

  function annotate(world, D) {   // wall heights so bullets / the player can pass over low things
    const isBorder = (s) => s.x <= 1 || s.y <= 1 || s.x + s.w >= world.w - 1 || s.y + s.h >= world.h - 1;
    for (const w of world.walls) {
      let top = 150, bi = -1;
      for (const m of D.buildings) { const b = m.b; if (w.x >= b.x - 1 && w.y >= b.y - 1 && w.x + w.w <= b.x + b.w + 1 && w.y + w.h <= b.y + b.h + 1) { top = FH; bi = m.i; break; } }
      if (bi < 0) { if (isBorder(w)) top = 9999; else if (w.w <= 66 && w.h <= 58) top = D.tid === 5 ? 100 : 46; else top = 150; }
      w.top = top;
    }
  }

  // ====================================================== TERRAIN SAMPLE
  W3.terrain = function (x, y) {
    const D = W3.data; if (!D || !D.grid) return 0;
    const g = D.grid, fx = clamp(x / g.CELL, 0, g.gx - 1.001), fy = clamp(y / g.CELL, 0, g.gy - 1.001), ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const a = g.H[iy * g.gx + ix], b = g.H[iy * g.gx + ix + 1], c = g.H[(iy + 1) * g.gx + ix], d = g.H[(iy + 1) * g.gx + ix + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  // ====================================================== SURFACES
  function heightOf(S, x, y) {
    if (S.z0 === S.z1) return S.z0;
    let u = S.ax === 'x' ? (x - S.x) / S.w : (y - S.y) / S.h; u = clamp(u, 0, 1); if (S.dir < 0) u = 1 - u;
    return S.z0 + (S.z1 - S.z0) * u;
  }
  W3.heightOf = heightOf;
  const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  function onSurface(S, x, y) {
    if (!inRect(x, y, S)) return false;
    if (S.holes) for (const h of S.holes) if (inRect(x, y, h)) return false;
    return true;
  }
  // highest standable surface at (x,y) that is no more than STEP above z
  W3.surfaceZ = function (x, y, z) {
    const D = W3.data; let best = W3.terrain(x, y); if (!D) return best;
    const list = D.iF ? D.iF.get(ikey(Math.floor(x / IDX), Math.floor(y / IDX))) : D.surfaces;
    if (list) for (const S of list) {
      if (S.k === 'roof') continue;
      if (!onSurface(S, x, y)) continue;
      const h = heightOf(S, x, y);
      if (h <= z + STEP && h > best) best = h;
    }
    return best;
  };
  // ground an AI-controlled thing stands on (terrain, or the floor it is inside if it lives indoors)
  W3.groundAt = function (x, y) { return W3.terrain(x, y); };

  // ====================================================== PLAYER PHYSICS
  W3.stepPlayer = function (p, dt) {
    if (!W3.enabled || !W3.data) { p.z = 0; p.vz = 0; return; }
    if (p.z === undefined || isNaN(p.z)) { p.z = W3.terrain(p.x, p.y); p.vz = 0; }
    dt = Math.min(dt, .05);
    const g = W3.surfaceZ(p.x, p.y, p.z);
    if (p.vz > 0 || p.z - g > 1.5) {
      p.vz = (p.vz || 0) - 1900 * dt; p.z += p.vz * dt;
      if (p.z <= g) { p.z = g; p.vz = 0; }
    } else {
      const d = g - p.z; p.z += d * Math.min(1, dt * 24); if (Math.abs(g - p.z) < .4) p.z = g; p.vz = 0;
    }
  };
  W3.jump = function (p) { if (p.vz === 0 && Math.abs(p.z - W3.surfaceZ(p.x, p.y, p.z)) < 3) p.vz = 560; };

  // ====================================================== MONSTER PHYSICS + PATH-FINDING
  // Monsters stand on terrain / floors / stairs / bridge decks like the player does (no jumping), and fall if dropped.
  W3.stepActor = function (e, dt) {
    if (!W3.enabled || !W3.data) { e.z = 0; e.vz = 0; return; }
    if (e.z === undefined || isNaN(e.z)) { e.z = W3.terrain(e.x, e.y); e.vz = 0; }
    dt = Math.min(dt, .05);
    const g = W3.surfaceZ(e.x, e.y, e.z);
    if (e.z - g > 2) { e.vz = (e.vz || 0) - 1500 * dt; e.z += e.vz * dt; if (e.z <= g) { e.z = g; e.vz = 0; } }
    else { e.z += (g - e.z) * Math.min(1, dt * 14); if (Math.abs(g - e.z) < .4) e.z = g; e.vz = 0; }
  };
  // A* over a 24-unit lattice that follows real surface heights, so routes go through doors, up stairs and over bridges.
  // opts: { r (clearance radius), blocked(x,y,r,z), cap (max expansions) } -> [{x,y,z}...] or null
  W3.navPath = function (sx, sy, sz, gx, gy, gz, opts) {
    const D = W3.data; if (!D) return null;
    const C = 24, rN = opts.r || 8, blocked = opts.blocked, cap = opts.cap || 2200, W = D.w, Hh = D.h;
    const cell = (v) => Math.floor(v / C), ctr = (c) => c * C + C / 2;
    const nk = (cx, cy, z) => (cx * 512 + cy) * 64 + Math.min(63, Math.max(0, Math.round(z / 24)));
    const hF = (x, y, z) => Math.hypot(gx - x, gy - y) + Math.abs(gz - z) * .4;
    const nodes = [], heap = [], seen = new Map();
    const push = (i) => { heap.push(i); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (nodes[heap[p]].f <= nodes[heap[c]].f) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = c * 2 + 1, rr = l + 1, m = c; if (l < heap.length && nodes[heap[l]].f < nodes[heap[m]].f) m = l; if (rr < heap.length && nodes[heap[rr]].f < nodes[heap[m]].f) m = rr; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    const scx = cell(sx), scy = cell(sy);
    nodes.push({ cx: scx, cy: scy, x: sx, y: sy, z: sz, g: 0, f: hF(sx, sy, sz), par: -1 }); seen.set(nk(scx, scy, sz), 0); push(0);
    let bestI = 0, bestH = nodes[0].f, exp = 0, goalI = -1;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (heap.length && exp < cap) {
      const i = pop(), n = nodes[i]; exp++;
      if (Math.abs(n.x - gx) < C * 1.2 && Math.abs(n.y - gy) < C * 1.2 && Math.abs(n.z - gz) < 48) { goalI = i; break; }
      const hh = hF(n.x, n.y, n.z); if (hh < bestH) { bestH = hh; bestI = i; }
      for (const [dx, dy] of DIRS) {
        const cx = n.cx + dx, cy = n.cy + dy, x = ctr(cx), y = ctr(cy);
        if (x < 40 || y < 40 || x > W - 40 || y > Hh - 40) continue;
        const z = W3.surfaceZ(x, y, n.z);
        if (z - n.z > STEP || n.z - z > STEP + 6) continue;            // can't climb a ledge, won't walk off a cliff
        const key = nk(cx, cy, z); if (seen.has(key)) continue;
        const mx = (n.x + x) / 2, my = (n.y + y) / 2, mz = Math.max(n.z, z);
        if (blocked(x, y, rN, z) || blocked(mx, my, rN, mz)) { seen.set(key, -1); continue; }
        const step = (dx && dy ? 1.414 : 1) * C * (1 + Math.abs(z - n.z) / 90), g = n.g + step;
        nodes.push({ cx, cy, x, y, z, g, f: g + hF(x, y, z), par: i }); seen.set(key, nodes.length - 1); push(nodes.length - 1);
      }
    }
    const end = goalI >= 0 ? goalI : bestI; if (end === 0) return null;
    const out = []; for (let i = end; i > 0; i = nodes[i].par) out.push({ x: nodes[i].x, y: nodes[i].y, z: nodes[i].z });
    out.reverse(); out.complete = goalI >= 0; return out;
  };

  // ====================================================== COLLISION (player + monsters)
  const circleRect = (x, y, r, w) => { const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h), dx = x - cx, dy = y - cy; return dx * dx + dy * dy < r * r; };
  W3.blockedZ = function (x, y, r, z) {
    const D = W3.data; if (!D) return false;
    if (D.iP && idxAny(D.iP, x, y, r, (p) => !(z + BODY <= p.z0 || z >= p.z1 - 6) && circleRect(x, y, r, p))) return true;
    if (D.iS && idxAny(D.iS, x, y, r, (s) => {
      if (!circleRect(x, y, r, s)) return false;
      // walking into the raised side of a staircase from below / the side
      return heightOf(s, clamp(x, s.x, s.x + s.w), clamp(y, s.y, s.y + s.h)) > z + STEP;
    })) return true;
    return false;
  };

  // 2D wall list + the 3D prisms/stairs, for AI path-finding (same rules the player collides with)
  W3.wallsBlocked = function (walls, x, y, r, z) {
    if (!walls._wi || walls._wn !== walls.length) { walls._wi = buildIdx(walls); walls._wn = walls.length; }
    if (idxAny(walls._wi, x, y, r, (w) => !(z !== undefined && w.top !== undefined && z > w.top - 6) && circleRect(x, y, r, w))) return true;
    return z === undefined ? false : W3.blockedZ(x, y, r, z);
  };

  // ====================================================== BULLETS
  W3.muzzleZ = function (p) { return (p.z || 0) + EYE - 4; };
  // true if the segment (x0,y0,z0)->(x1,y1,z1) is stopped by terrain / floors / upper walls
  W3.bulletBlocked = function (x0, y0, z0, x1, y1, z1) {
    const D = W3.data; if (!D) return false;
    for (let s = 1; s <= 3; s++) {   // sub-sample so thin rails can't be tunnelled
      const t = s / 3, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      if (z < W3.terrain(x, y) - 1) return true;
      for (const p of D.prisms) { if (z < p.z0 || z > p.z1) continue; if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true; }
    }
    for (const S of D.surfaces) {
      const inside1 = inRect(x1, y1, S);
      if (!inside1) continue;
      if (S.holes) { let ih = false; for (const h of S.holes) if (inRect(x1, y1, h)) { ih = true; break; } if (ih) continue; }
      const h1 = heightOf(S, x1, y1);
      if (S.k === 'stair') { if (z1 < h1) return true; continue; }
      const h0 = heightOf(S, clamp(x0, S.x, S.x + S.w), clamp(y0, S.y, S.y + S.h));
      if ((z0 >= h0 && z1 < h1) || (z0 <= h0 && z1 > h1)) return true;
    }
    return false;
  };
  // does a bullet at height z overlap something standing on the ground at (ex,ey) with radius er?
  W3.hitsZ = function (z, ex, ey, er, baseZ) {
    if (z === undefined) return true;
    const gz = baseZ !== undefined ? baseZ : W3.terrain(ex, ey);
    return z >= gz - 10 && z <= gz + (er || 16) * 2 + 36;
  };
  W3.muzzleVz = function (speed, pitch) { return -Math.tan(clamp(pitch || 0, -1.25, 1.25)) * speed; };
})(window);

/* =====================================================================
   render3d.js — Monster Arena 3D scene renderer (core)
   Consumes a per-frame description built by the bridge in pve16.js.
   Entities / VFX live in render3d_fx.js which extends this object.
   ===================================================================== */
(function (G) {
  'use strict';
  const { M, Prog, Geo, Mesh, makeRT, freeRT, texFromImage, inflateSprite } = G.GL3D;
  const S = G.SH3D;

  const R = { ok: false, gl: null, canvas: null, F: null, time: 0 };
  G.Render3D = R;

  // quality presets (user selectable via settings -> R.setQuality)
  const QUALITY = {
    low: { shadow: 0, shadowSize: 1024, bloom: 0, msaa: 0, scale: 0.75, parts: 0.4, grid: 36, maxLights: 4 },
    medium: { shadow: 1, shadowSize: 1024, bloom: 1, msaa: 0, scale: 1, parts: 0.7, grid: 48, maxLights: 6 },
    high: { shadow: 1, shadowSize: 2048, bloom: 1, msaa: 1, scale: 1, parts: 1, grid: 64, maxLights: 8 },
    ultra: { shadow: 1, shadowSize: 2048, bloom: 1, msaa: 1, scale: 1.25, parts: 1.4, grid: 80, maxLights: 10 }
  };
  R.QUALITY = QUALITY; R.qName = 'high'; R.q = Object.assign({}, QUALITY.high);

  // ---- per-theme look ----------------------------------------------------
  const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const THEME = {
    1: { sun: norm3([-.5, .78, -.38]), sunCol: [.78, .7, .55], skyTop: [.18, .36, .74], skyHor: [.5, .64, .78], ground: [.08, .15, .07], fog: [.4, .55, .7], fogDen: .00013, exp: .72, bloom: .2, tint: [1, 1.02, .98], sat: 1.15, vig: .66 },
    2: { sun: norm3([-.42, .66, -.55]), sunCol: [.72, .58, .38], skyTop: [.3, .42, .66], skyHor: [.78, .55, .32], ground: [.16, .1, .05], fog: [.55, .38, .22], fogDen: .00016, exp: .68, bloom: .2, tint: [1.03, 1, .95], sat: 1.1, vig: .68 },
    3: { sun: norm3([-.35, .6, -.5]), sunCol: [.55, .72, 1.0], skyTop: [.08, .18, .36], skyHor: [.22, .42, .62], ground: [.05, .1, .18], fog: [.1, .22, .36], fogDen: .00017, exp: .8, bloom: .3, tint: [.96, 1., 1.04], sat: 1.05, vig: .66 },
    4: { sun: norm3([-.3, .5, -.6]), sunCol: [.85, .38, .22], skyTop: [.1, .03, .03], skyHor: [.42, .1, .04], ground: [.12, .04, .03], fog: [.2, .05, .04], fogDen: .0002, exp: .72, bloom: .3, tint: [1.04, .98, .95], sat: 1.1, vig: .76 },
    5: { sun: norm3([-.4, .62, -.45]), sunCol: [.36, .28, .72], skyTop: [.04, .02, .12], skyHor: [.15, .06, .28], ground: [.04, .02, .09], fog: [.05, .03, .11], fogDen: .0002, exp: .72, bloom: .4, tint: [1, .97, 1.06], sat: 1.15, vig: .76 }
  };
  R.THEME = THEME;
  const PAL = {
    1: { wall: [.46, .44, .4], rock: [.36, .35, .32], accent: [.49, 1, .64], bush: [.1, .3, .1], trunk: [.25, .16, .09] },
    2: { wall: [.62, .47, .28], rock: [.58, .43, .25], accent: [1, .82, .4], bush: [.3, .45, .15], trunk: [.35, .24, .12] },
    3: { wall: [.45, .62, .8], rock: [.5, .66, .84], accent: [.62, .89, 1], bush: [.7, .85, 1], trunk: [.5, .6, .7] },
    4: { wall: [.2, .13, .13], rock: [.19, .12, .12], accent: [1, .4, .25], bush: [.3, .08, .05], trunk: [.12, .08, .08] },
    5: { wall: [.2, .14, .36], rock: [.17, .12, .3], accent: [.82, .4, 1], bush: [.5, .2, .9], trunk: [.12, .08, .22] }
  };
  R.PAL = PAL;

  // ---- tiny deterministic rng -------------------------------------------
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  R.rng = rng;
  const hexRGB = (h) => { if (Array.isArray(h)) return h; h = String(h || '#fff').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h.slice(0, 6), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  R.hexRGB = hexRGB;

  // ---- matrix pool (zero GC model matrices) ------------------------------
  const POOL = []; for (let i = 0; i < 4096; i++) POOL.push(new Float32Array(16));
  let poolI = 0;
  R._zOv = null;   // absolute height override (the local player may stand on a bridge / upper floor)
  R.groundY = (x, z) => R._zOv !== null ? R._zOv : (window.W3 && W3.enabled && W3.data ? W3.terrain(x, z) : 0);
  R.mm = (x, y, z, ry, sx, sy, sz, rx, rz) => M.trs(POOL[poolI++ & 4095], x, y + R.groundY(x, z), z, ry || 0, sx === undefined ? 1 : sx, sy, sz, rx, rz);
  R.GL3D = G.GL3D;

  // ====================================================================== INIT
  R.init = function (canvas) {
    try {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL2 unavailable');
      R.gl = gl; R.canvas = canvas;
      R.extFloat = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('EXT_color_buffer_half_float'); gl.getExtension('OES_texture_float_linear');
      R.progs = {
        lit: new Prog(gl, S.LIT_VS, S.LIT_FS, 'lit'), depth: new Prog(gl, S.DEPTH_VS, S.DEPTH_FS, 'depth'),
        ground: new Prog(gl, S.GROUND_VS, S.GROUND_FS, 'ground'), haz: new Prog(gl, S.HAZ_VS, S.HAZ_FS, 'haz'),
        part: new Prog(gl, S.PART_VS, S.PART_FS, 'part'), rib: new Prog(gl, S.RIB_VS, S.RIB_FS, 'rib'),
        sky: new Prog(gl, S.SKY_VS, S.SKY_FS, 'sky'), pre: new Prog(gl, S.FS_VS, S.PRE_FS, 'pre'),
        down: new Prog(gl, S.FS_VS, S.DOWN_FS, 'down'), up: new Prog(gl, S.FS_VS, S.UP_FS, 'up'), comp: new Prog(gl, S.FS_VS, S.COMP_FS, 'comp')
      };
      R.emptyVAO = gl.createVertexArray();
      // 1x1 white textures
      R.white = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, R.white);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      // dummy depth texture so sampler2DShadow is always valid (shadows disabled)
      R.dummyShadow = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, R.dummyShadow);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 1, 1, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, new Uint32Array([0xffffffff]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      // unit meshes
      const mk = (g) => new Mesh(gl, g);
      R.unit = {
        sphere: mk(Geo.sphere(28, 18)), sphereLo: mk(Geo.sphere(10, 7)), box: mk(Geo.box(1, 1, 1)), cyl: mk(Geo.cyl(1, 1, 1, 24)), cone: mk(Geo.cyl(0, 1, 1, 16)),
        torus: mk(Geo.torus(1, .08, 48, 10)), torusThick: mk(Geo.torus(1, .2, 32, 12)), hexRing: mk(Geo.torus(1, .06, 6, 6)), disc: mk(Geo.disc(1, 48)), plane: mk(Geo.plane(1, 1)),
        rock: mk(Geo.rock(7, 2)), rock2: mk(Geo.rock(23, 2)), rock3: mk(Geo.rock(91, 1)),
        octa: mk(Geo.sphere(4, 2)), tube: mk(Geo.cyl(1, 1, 1, 12, [1, 1, 1, 0], false))
      };
      R.quads = { add: new QuadBatch(gl, 24000), alpha: new QuadBatch(gl, 8000) };
      R.hazQuad = new Mesh(gl, Geo.plane(1, 1));
      R.rib = new RibbonBatch(gl, 6000);
      R.applyQuality(R.qName);
      // ground plane (built per-world)
      R.sprites = new WeakMap();
      R.ok = true;
      console.log('[Render3D] ready — WebGL2, floatRT=' + R.extFloat);
      return true;
    } catch (e) { console.warn('[Render3D] init failed:', e); R.ok = false; return false; }
  };

  R.setQuality = function (name) { if (!QUALITY[name]) return; R.qName = name; if (R.ok) R.applyQuality(name); };
  R.applyQuality = function (name) {
    const gl = R.gl; R.q = Object.assign({}, QUALITY[name] || QUALITY.high); R.qName = name;
    // shadow RT
    if (R.shadowRT) freeRT(gl, R.shadowRT);
    R.shadowRT = R.q.shadow ? makeRT(gl, R.q.shadowSize, R.q.shadowSize, { depthOnly: true }) : null;
    R.spriteCache = new Map(); // meshes depend on grid resolution
    R.sizeKey = ''; R.resize(R.cw || 0, R.ch || 0);
  };

  // ============================================================== RESIZE / RT
  R.resize = function (cssW, cssH, dpr) {
    const gl = R.gl; if (!gl) return;
    if (cssW) {
  R.cw = cssW;
  R.ch = cssH;
  R.dpr = dpr || R.dpr || 1;
} else {
  cssW = R.canvas.clientWidth || window.innerWidth;
  cssH = R.canvas.clientHeight || window.innerHeight;
}

if (!Number.isFinite(cssW) || !Number.isFinite(cssH) || cssH > 10000) {
  cssW = window.innerWidth;
  cssH = window.innerHeight;
}

const sc = R.q.scale * (R.dpr || 1) * (R.dynScale || 1);
    const w = Math.min(8192, Math.max(64, Math.floor(cssW * sc)));
    const h = Math.min(8192, Math.max(64, Math.floor(cssH * sc)));
    const key = w + 'x' + h + R.qName;
    if (key === R.sizeKey) return; R.sizeKey = key;
    R.canvas.width = w; R.canvas.height = h; R.W = w; R.H = h; R.aspect = w / h;
    for (const k of ['hdr', 'ms', 'bl']) { if (k === 'bl') { (R.bl || []).forEach(r => freeRT(gl, r)); } else freeRT(gl, R[k]); }
    const flt = R.extFloat;
    R.hdr = makeRT(gl, w, h, { float: flt, depth: true });
    R.ms = null;
    if (R.q.msaa && flt) {
      try {
        const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
        const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA16F, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
        const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) R.ms = { fbo, c, d };
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } catch (e) { R.ms = null; }
    }
    R.bl = []; let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < 6 && bw > 8 && bh > 8; i++) { R.bl.push(makeRT(gl, bw, bh, { float: flt })); bw >>= 1; bh >>= 1; }
    R.fxaa = R.ms ? 0 : 1;
  };

  // ====================================================================== BATCHES
  class QuadBatch {
    constructor(gl, max) {
      this.gl = gl; this.max = max; this.n = 0; this.data = new Float32Array(max * 12);
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(4 + k); gl.vertexAttribPointer(4 + k, 4, gl.FLOAT, false, 48, k * 16); gl.vertexAttribDivisor(4 + k, 1); }
      gl.bindVertexArray(null);
    }
    push(x, y, z, size, r, g, b, a, rot, kind, param, orient) {
      if (this.n >= this.max) return; const d = this.data, o = this.n++ * 12;
      d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size; d[o + 4] = r; d[o + 5] = g; d[o + 6] = b; d[o + 7] = a;
      d[o + 8] = rot || 0; d[o + 9] = kind || 0; d[o + 10] = param || 0; d[o + 11] = orient || 0;
    }
    flush() {
      if (!this.n) return; const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 12);
      gl.bindVertexArray(this.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.n); this.n = 0;
    }
  }
  class RibbonBatch {
    constructor(gl, maxQuads) {
      this.gl = gl; this.max = maxQuads; this.n = 0; this.data = new Float32Array(maxQuads * 6 * 9);
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 36, 20);
      gl.bindVertexArray(null);
    }
    _v(x, y, z, u, v, r, g, b, a) { const d = this.data, o = this.vn++ * 9; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = u; d[o + 4] = v; d[o + 5] = r; d[o + 6] = g; d[o + 7] = b; d[o + 8] = a; }
    // pts: flat [x,y,z,...]; widths w0->w1 taper; colour rgba
    line(pts, w0, w1, r, g, b, a) {
      const n = pts.length / 3; if (n < 2) return; if (!this.vn) this.vn = 0;
      if ((this.vn / 6) + n >= this.max) return;
      const e = R.eye, side = [];
      for (let i = 0; i < n; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        let tx = pts[i1 * 3] - pts[i0 * 3], ty = pts[i1 * 3 + 1] - pts[i0 * 3 + 1], tz = pts[i1 * 3 + 2] - pts[i0 * 3 + 2];
        const vx = e[0] - pts[i * 3], vy = e[1] - pts[i * 3 + 1], vz = e[2] - pts[i * 3 + 2];
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx; const l = Math.hypot(sx, sy, sz) || 1;
        const w = (w0 + (w1 - w0) * (i / (n - 1))) * .5; side.push(sx / l * w, sy / l * w, sz / l * w);
      }
      for (let i = 0; i < n - 1; i++) {
        const a = i * 3, b = (i + 1) * 3, ua = i / (n - 1), ub = (i + 1) / (n - 1);
        const fa = 1 - ua * .0, fb = 1 - ub * .0;
        const ax1 = pts[a] + side[a], ay1 = pts[a + 1] + side[a + 1], az1 = pts[a + 2] + side[a + 2];
        const ax2 = pts[a] - side[a], ay2 = pts[a + 1] - side[a + 1], az2 = pts[a + 2] - side[a + 2];
        const bx1 = pts[b] + side[b], by1 = pts[b + 1] + side[b + 1], bz1 = pts[b + 2] + side[b + 2];
        const bx2 = pts[b] - side[b], by2 = pts[b + 1] - side[b + 1], bz2 = pts[b + 2] - side[b + 2];
        this._v(ax1, ay1, az1, ua, 0, r, g, b, a * fa); this._v(ax2, ay2, az2, ua, 1, r, g, b, a * fa); this._v(bx1, by1, bz1, ub, 0, r, g, b, a * fb);
        this._v(bx1, by1, bz1, ub, 0, r, g, b, a * fb); this._v(ax2, ay2, az2, ua, 1, r, g, b, a * fa); this._v(bx2, by2, bz2, ub, 1, r, g, b, a * fb);
      }
    }
    flush() {
      const gl = this.gl; if (!this.vn) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.vn * 9);
      gl.bindVertexArray(this.vao); gl.drawArrays(gl.TRIANGLES, 0, this.vn); this.vn = 0;
    }
  }

  // convenience wrappers used by fx code
  R.glow = (x, y, z, size, r, g, b, a, kind) => R.quads.add.push(x, y + R.groundY(x, z), z, size, r, g, b, a, 0, kind || 0, 0, 0);
  R.glowA = (x, y, z, size, r, g, b, a, kind, rot, param) => R.quads.alpha.push(x, y, z, size, r, g, b, a, rot || 0, kind || 0, param || 0, 0);
  R.decal = (x, z, size, r, g, b, a, kind, param, rot, add, y) => (add === false ? R.quads.alpha : R.quads.add).push(x, (y === undefined ? 1.6 : y) + R.groundY(x, z), z, size, r, g, b, a, rot || 0, kind, param || 0, 1);
  R.streak = (x, y, z, ang, size, len, r, g, b, a) => R.quads.add.push(x, y + R.groundY(x, z), z, size, r, g, b, a, ang, 4, len, 2);

  // ====================================================== MATERIAL / DRAW LIST
  const DEFMAT = { color: [1, 1, 1], emissive: [0, 0, 0], rough: .6, metal: 0, alpha: 1, tex: null, emis: null, emisK: 1, flash: null, rim: 0, rimCol: [1, 1, 1], shadow: true, mode: 0 };
  R.opaque = []; R.blend = []; R.lights = [];
  R.draw = function (mesh, m, mat) {
    mat = mat || DEFMAT; (mat.alpha < .995 ? R.blend : R.opaque).push(mesh, m, mat);
  };
  R.light = function (x, y, z, radius, r, g, b, k) {
    R.lights.push({ x, y, z: (z === undefined ? 30 : z) + R.groundY(x, y), rad: radius, r: r * (k || 1), g: g * (k || 1), b: b * (k || 1), d2: 0 });
  };
  R.mat = function (color, o) { return Object.assign({}, DEFMAT, { color: color }, o || {}); };

  function setMat(p, m, gl) {
    p.f3('uColor', m.color[0], m.color[1], m.color[2]);
    p.f3('uEmissive', m.emissive[0], m.emissive[1], m.emissive[2]);
    p.f1('uRough', m.rough); p.f1('uMetal', m.metal); p.f1('uAlpha', m.alpha); p.f1('uEmisK', m.emisK);
    p.i1('uMode', m.mode || 0);
    const fl = m.flash; p.f3('uFlash', fl ? fl[0] : 0, fl ? fl[1] : 0, fl ? fl[2] : 0);
    p.f1('uRimK', m.rim || 0); if (m.rim) p.f3('uRimCol', m.rimCol[0], m.rimCol[1], m.rimCol[2]);
    if (m.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, m.emis || R.white); p.i1('uHasTex', 1); }
    else { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.white); p.i1('uHasTex', 0); }
  }

  // =========================================================== SPRITE -> 3D
  R._alt = new WeakMap();   // original img -> CORS-enabled reload
  R.spriteMesh = function (img, opt) {
    if (!img || !(img.complete !== false) || !(img.naturalWidth || img.width)) return null;
    const key = img; let e = R.sprites.get(key); const gridKey = (opt && opt.grid) || R.q.grid;
    if (e && e.fail) return null;
    if (e && e.gridKey === gridKey) return e;
    try {
      const res = inflateSprite(img, Object.assign({ grid: gridKey }, opt || {}));
      const gl = R.gl;
      e = { mesh: new Mesh(gl, res.geo), tex: texFromImage(gl, res.albedo), emis: texFromImage(gl, res.emis), aspect: res.aspect, gridKey };
    } catch (err) {
      // Opening index.html straight from disk (file://) taints images, so pixels can't be read.
      R.sprites.set(key, { fail: true });
      if (!R._warnedTaint) { R._warnedTaint = true; console.warn('[Render3D] cannot read sprite pixels (' + (err && err.name) + '). Using procedural 3D models. Serve the game over http://localhost (npm start in /server) for the full painted monsters.'); }
      return null;
    }
    R.sprites.set(key, e); return e;
  };

  // ===================================================================== WORLD
  let yOff = 0;
  function addBox(g, x0, y0, z0, x1, y1, z1, c, mat) {
    y0 += yOff; y1 += yOff;
    const col = [c[0], c[1], c[2], mat || 0];
    const hx = (x1 - x0), hy = (y1 - y0), hz = (z1 - z0);
    g.append(R._box, M.trs(M._tmp || (M._tmp = new Float32Array(16)), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, hx, hy, hz), col);
  }
  R._box = Geo.box(1, 1, 1);
  const _rock = [Geo.rock(7, 2), Geo.rock(23, 2), Geo.rock(91, 1), Geo.rock(5, 2)];
  const _cone = Geo.cyl(0, 1, 1, 7), _cyl = Geo.cyl(1, 1, 1, 8), _oct = Geo.sphere(5, 3), _pyr = Geo.cyl(0, 1, 1, 4), _torus = Geo.torus(1, .08, 48, 10);
  function addPyr(g, x, y, z, rx, h, rz, col, mat, rot) { g.append(_pyr, M.trs(M._tmp || (M._tmp = new Float32Array(16)), x, y + yOff, z, rot === undefined ? Math.PI / 4 : rot, rx, h, rz), [col[0], col[1], col[2], mat || 0]); }
  function addRock(g, x, y, z, rx, ry, rz, seed, col, mat) {
    g.append(_rock[seed & 3], M.trs(M._tmp || (M._tmp = new Float32Array(16)), x, y + yOff, z, (seed % 628) / 100, rx, ry, rz), [col[0], col[1], col[2], mat === undefined ? 2 : mat]);
  }
  function addCone(g, x, y, z, r, h, col, mat, rot) { g.append(_cone, M.trs(M._tmp || (M._tmp = new Float32Array(16)), x, y + yOff, z, rot || 0, r, h, r), [col[0], col[1], col[2], mat || 0]); }
  function addCyl(g, x, y, z, r, h, col, mat) { g.append(_cyl, M.trs(M._tmp || (M._tmp = new Float32Array(16)), x, y + yOff, z, 0, r, h, r), [col[0], col[1], col[2], mat || 0]); }
  function tint(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function _hex(h){ h=(''+h).replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); const n=parseInt(h,16)||0; return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }

  R.worldKeyOf = function (F) {
    const w = F.world; const b = w.buildings; const s = w.solids; const h = w.hazards;
    const fb = b[0] ? (b[0].x + ',' + b[0].y) : '', fs = s[4] ? (s[4].x + ',' + s[4].y) : '';
    return [F.theme.id, w.w, w.h, b.length, s.length, h.length, fb, fs, w.walls.length].join('|');
  };

  R.buildWorld = function (F) {
    const gl = R.gl, w = F.world, tid = F.theme.id, pal = PAL[tid] || PAL[1];
    if (R.world) { R.world.meshes.forEach(m => m.mesh.dispose()); R.world.roofs.forEach(r => r.mesh.dispose()); if (R.world.ground) R.world.ground.dispose(); }
    const W = { meshes: [], roofs: [], key: R.worldKeyOf(F), w: w.w, h: w.h, tid, buildingRects: [] };
    const rnd = rng((w.w * 31 + w.h * 17 + tid * 7919 + w.buildings.length * 131 + w.solids.length) | 0);
    const G0 = new Geo(); // static opaque, proc materials
    const isBorder = (s) => s.x <= 1 || s.y <= 1 || s.x + s.w >= w.w - 1 || s.y + s.h >= w.h - 1;
    const acc = pal.accent;

    // ---- border walls: tall carved barrier w/ buttress pillars + glowing rune band
    for (const s of w.solids) {
      if (!isBorder(s)) continue;
      const H = 210;
      addBox(G0, s.x, 0, s.y, s.x + s.w, H, s.y + s.h, pal.wall, 1);
      // cap + glowing rune line along inner face
      addBox(G0, s.x - 4, H, s.y - 4, s.x + s.w + 4, H + 14, s.y + s.h + 4, tint(pal.wall, .8), 4);
      const horiz = s.w > s.h;
      const len = horiz ? s.w : s.h;
      for (let a = 80; a < len; a += 180) {
        const px = horiz ? s.x + a : s.x + s.w / 2, pz = horiz ? s.y + s.h / 2 : s.y + a;
        addBox(G0, px - 26, 0, pz - 26, px + 26, H + 44, pz + 26, tint(pal.wall, 1.1), 1);
        addBox(G0, px - 14, H + 44, pz - 14, px + 14, H + 60, pz + 14, acc, 5);
      }
      if (horiz) { const inner = s.y < w.h / 2 ? s.y + s.h : s.y - 6; addBox(G0, s.x, 96, inner, s.x + s.w, 106, inner + 6, acc, 5); }
      else { const inner = s.x < w.w / 2 ? s.x + s.w : s.x - 6; addBox(G0, inner, 96, s.y, inner + 6, 106, s.y + s.h, acc, 5); }
    }

    // ---- solids: rock formations / forests / crates
    for (const s of w.solids) {
      if (isBorder(s)) continue;
      const sd = (s.x * 73856093) ^ (s.y * 19349663), r = rng(sd | 0);
      const small = s.w <= 66 && s.h <= 58;
      const cx = s.x + s.w / 2, cz = s.y + s.h / 2;
      if (small) {
        if (r() < .55 || tid === 5) { // crate / crystal
          if (tid === 5) { for (let i = 0; i < 3; i++) addCone(G0, s.x + s.w * (.25 + .25 * i), 0, cz + (r() - .5) * 14, 11 + r() * 8, 50 + r() * 50, [.55, .25, 1], 5, r() * 3); }
          else { const hh = 34 + r() * 16; addBox(G0, s.x + 2, 0, s.y + 2, s.x + s.w - 2, hh, s.y + s.h - 2, tid === 4 ? [.26, .18, .16] : [.5, .34, .18], 3); addBox(G0, s.x, hh - 5, s.y, s.x + s.w, hh, s.y + s.h, tint(pal.wall, .7), 4); }
        } else addRock(G0, cx, 0, cz, s.w * .56, 36 + r() * 24, s.h * .56, sd, pal.rock);
        continue;
      }
      const forest = (tid === 1 || tid === 2) && r() < .5;
      addBox(G0, s.x + 4, 0, s.y + 4, s.x + s.w - 4, 16, s.y + s.h - 4, tint(pal.rock, .8), 2);
      if (forest) {
        const n = Math.max(3, Math.round(s.w * s.h / 2600));
        for (let i = 0; i < n; i++) {
          const px = s.x + 22 + r() * (s.w - 44), pz = s.y + 22 + r() * (s.h - 44), hh = 70 + r() * 70;
          if (tid === 1) { addCyl(G0, px, 0, pz, 5, hh * .35, pal.trunk, 3); for (let k = 0; k < 3; k++) addCone(G0, px, hh * (.22 + k * .22), pz, 26 - k * 6, hh * .5, tint(pal.bush, .8 + r() * .5), 0, r() * 3); }
          else { addCyl(G0, px, 0, pz, 7, hh * .8, [.3, .5, .2], 0); addCyl(G0, px + 10, hh * .35, pz, 4, hh * .4, [.3, .5, .2], 0); }
        }
      } else {
        const cols = Math.max(1, Math.round(s.w / 70)), rows = Math.max(1, Math.round(s.h / 70));
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const px = s.x + (i + .5) * s.w / cols + (r() - .5) * 14, pz = s.y + (j + .5) * s.h / rows + (r() - .5) * 14;
          const rr = Math.max(s.w / cols, s.h / rows) * .62, hh = 54 + r() * 80;
          addRock(G0, px, hh * .12, pz, rr * (s.w / cols / Math.max(s.w / cols, s.h / rows)) + 10, hh, rr * (s.h / rows / Math.max(s.w / cols, s.h / rows)) + 10, (sd + i * 31 + j * 17) | 0, pal.rock);
        }
        if (tid === 3 || tid === 4 || tid === 5) { // crystal / obsidian spikes
          const n = 3 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) addCone(G0, s.x + 14 + r() * (s.w - 28), 30, s.y + 14 + r() * (s.h - 28), 9 + r() * 9, 70 + r() * 90, tid === 3 ? [.7, .92, 1] : tid === 4 ? [.9, .25, .1] : [.6, .25, 1], 5, r() * 3);
        }
      }
    }

    // ---- buildings: up to 3 floors, stairs inside, windows, bridges between houses
    const D3 = window.W3 ? W3.ensure(w, tid) : null, FHh = 128, SLB = 12;
    W.d3 = D3;
    const floorCol = tid === 3 ? [.62, .78, .9] : tid === 4 ? [.22, .15, .13] : tid === 5 ? [.17, .12, .32] : tid === 2 ? [.66, .53, .34] : [.52, .39, .25];
    const winCol = tid === 3 ? [.8, .97, 1] : tid === 4 ? [1, .55, .2] : tid === 5 ? [.85, .45, 1] : tid === 2 ? [1, .78, .4] : [1, .84, .5];
    w.buildings.forEach((b, bi) => {
      const meta = D3 && D3.buildings[bi], nF = meta ? meta.n : 1, WH = FHh, t = b.t || 18, H3 = nF * FHh,
        _bt = (window.getBuildingType ? window.getBuildingType(b, tid) : null) || b._type,
        _bAcc = _bt && _bt.accent ? _hex(_bt.accent) : acc;
      W.buildingRects.push(b);
      const ix0 = b.x + t, iz0 = b.y + t, ix1 = b.x + b.w - t, iz1 = b.y + b.h - t;
      addBox(G0, ix0 - 2, 0, iz0 - 2, ix1 + 2, .8, iz1 + 2, floorCol, 6);
      // THEMED LANDMARK — a completely unique 3D shape (pyramid / temple / tent /
      // igloo / domed vault / forge / shrine / obelisk / ruin / peaked cottage).
      // No normal walls, windows, pillars or flat roof are drawn on top of it.
      if (_bt) {
        const a3 = _bAcc, cx = b.x + b.w / 2, cz = b.y + b.h / 2, sw = b.w, sh = b.h, s = _bt.shape;
        // Wall height fits the 84-tall doors; ruin stays lower. Themed walls are vividly
        // archetype-coloured with glowing seams + a sigil stripe — nothing like normal stone.
        const WALL = s === 'ruin' ? 92 : 128, ry = WALL + 8;
        let topY = ry + 52;
        // glowing ground outline + glowing base trim around the footprint
        addBox(G0, b.x - 4, 4, b.y - 4, b.x + b.w + 4, 8, b.y + b.h + 4, a3, 5);
        addBox(G0, b.x - 2, 0, b.y - 2, b.x + b.w + 2, 6, b.y + b.h + 2, a3, 5);
        // Themed perimeter walls — drawn from the REAL wall segments (w.walls) so they line
        // up with collision and door gaps stay passable. Body is coloured archetype stone
        // with a glowing emissive top seam, a base trim and a vertical sigil stripe.
        for (const ws of w.walls) {
          if (ws.x < b.x - 1 || ws.y < b.y - 1 || ws.x + ws.w > b.x + b.w + 1 || ws.y + ws.h > b.y + b.h + 1) continue;
          addBox(G0, ws.x, 0, ws.y, ws.x + ws.w, WALL, ws.y + ws.h, tint(a3, .4), 1);
          addBox(G0, ws.x - 2, WALL, ws.y - 2, ws.x + ws.w + 2, WALL + 10, ws.y + ws.h + 2, a3, 5);
          if (ws.w > ws.h) addBox(G0, ws.x + ws.w / 2 - 3, 18, ws.y - 1, ws.x + ws.w / 2 + 3, WALL - 14, ws.y + ws.h + 1, a3, 5);
          else addBox(G0, ws.x - 1, 18, ws.y + ws.h / 2 - 3, ws.x + ws.w + 1, WALL - 14, ws.y + ws.h / 2 + 3, a3, 5);
        }
        // themed door lintels + glowing frames, sized to the wall height (door opening 0..84)
        for (const d of b.doors) {
          addBox(G0, d.x, 84, d.y, d.x + d.w, WALL, d.y + d.h, tint(a3, .5), 1);
          if (d.side === 'top' || d.side === 'bottom') {
            addBox(G0, d.x - 5, 0, d.y - 2, d.x, WALL + 8, d.y + d.h + 2, a3, 5);
            addBox(G0, d.x + d.w, 0, d.y - 2, d.x + d.w + 5, WALL + 8, d.y + d.h + 2, a3, 5);
            addBox(G0, d.x - 5, WALL + 8, d.y - 2, d.x + d.w + 5, WALL + 14, d.y + d.h + 2, a3, 5);
          } else {
            addBox(G0, d.x - 2, 0, d.y - 5, d.x + d.w + 2, WALL + 8, d.y, a3, 5);
            addBox(G0, d.x - 2, 0, d.y + d.h, d.x + d.w + 2, WALL + 8, d.y + d.h + 5, a3, 5);
            addBox(G0, d.x - 2, WALL + 8, d.y - 5, d.x + d.w + 2, WALL + 14, d.y + d.h + 5, a3, 5);
          }
        }
        // themed roof / landmark silhouette on top of the walls — every archetype
        // gets its OWN distinct 3D shape so no two themed buildings (even across
        // maps) look alike. Sigil metadata (kind/count/colour) drives the floating
        // crystal sigil in render3d_fx.js, also unique per archetype.
        const finial = (y, h) => { addBox(G0, cx - 5, y, cz - 5, cx + 5, y + h, cz + 5, [1, 1, 1], 5); };
        const towers = (th, ch) => { for (const [px, pz] of [[b.x+10,b.y+10],[b.x+b.w-10,b.y+10],[b.x+10,b.y+b.h-10],[b.x+b.w-10,b.y+b.h-10]]) { addCyl(G0, px, ry, pz, 13, th, tint(a3, .4), 1); addCone(G0, px, ry + th, pz, 15, ch, a3, 5, 0); } };
        let sigilKind = 'ring', sigilCount = 4;
        if (s === 'cottage') {                        // Meadow: hip roof + chimney + hearth glow
          addPyr(G0, cx, ry, cz, sw / 2, 46, sh / 2, tint(a3, .7), 1);
          addBox(G0, cx + sw * .2, ry + 30, cz + sh * .2, cx + sw * .3, ry + 70, cz + sh * .3, tint(a3, .5), 1);
          addBox(G0, cx + sw * .2 - 2, ry + 66, cz + sh * .2 - 2, cx + sw * .3 + 2, ry + 72, cz + sh * .3 + 2, a3, 5);
          finial(ry + 42, 10); topY = ry + 72; sigilKind = 'hearth';
        } else if (s === 'barn') {                     // Meadow: gambrel double-ridge barn
          addPyr(G0, cx, ry, cz, sw / 2, 40, sh / 2, tint(a3, .65), 1);
          addBox(G0, cx - sw * .12, ry + 30, cz - sh * .12, cx + sw * .12, ry + 64, cz + sh * .12, tint(a3, .55), 1);
          addBox(G0, cx - sw * .13, ry + 30, cz - sh * .13, cx + sw * .13, ry + 64, cz + sh * .13, a3, 5);
          finial(ry + 60, 8); topY = ry + 68; sigilKind = 'ring'; sigilCount = 3;
        } else if (s === 'hut') {                       // Meadow: conical thatch hut
          addCone(G0, cx, ry, cz, Math.max(sw, sh) * .56, 64, a3, 1, 0);
          addCone(G0, cx, ry + 58, cz, Math.max(sw, sh) * .14, 14, [1, 1, 1], 5, 0);
          topY = ry + 72; sigilKind = 'leaf'; sigilCount = 5;
        } else if (s === 'pyramid') {                   // Desert: stepped stone pyramid
          const tiers = 4, tH = 22;
          for (let i = 0; i < tiers; i++) { const f = i / tiers, tw = sw * (1 - f * .7), th = sh * (1 - f * .7), ty = ry + i * tH;
            addBox(G0, cx - tw/2, ty, cz - th/2, cx + tw/2, ty + tH, cz + th/2, i % 2 ? tint(a3, .5) : tint(a3, .32), 1);
            addBox(G0, cx - tw/2, ty + tH - 3, cz - th/2, cx + tw/2, ty + tH, cz + th/2, a3, 5); }
          addPyr(G0, cx, ry + tiers * tH, cz, sw * .14, 30, sh * .14, a3, 5);
          topY = ry + tiers * tH + 30; sigilKind = 'eye';
        } else if (s === 'temple') {                    // Desert: columned slab + hip + sun disk
          addBox(G0, b.x - 4, ry, b.y - 4, b.x + b.w + 4, ry + 14, b.y + b.h + 4, tint(a3, .4), 1);
          addBox(G0, b.x - 2, ry + 14, b.y - 2, b.x + b.w + 2, ry + 18, b.y + b.h + 2, a3, 5);
          addPyr(G0, cx, ry + 18, cz, sw / 2 + 2, 36, sh / 2 + 2, tint(a3, .7), 1);
          G0.append(_oct, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry + 56, cz, 0, 14, 5, 14), [a3[0], a3[1], a3[2], 5]);
          topY = ry + 62; sigilKind = 'sun'; sigilCount = 8;
        } else if (s === 'tent') {                     // Desert: cloth ridge tent
          const tH = Math.max(sw, sh) * .5;
          addPyr(G0, cx, ry, cz, sw / 2, tH, sh / 2, tint(a3, .65), 1);
          addBox(G0, cx - 2, ry, cz - 2, cx + 2, ry + tH, cz + 2, a3, 5);
          addBox(G0, cx - 4, ry + tH - 3, cz - 4, cx + 4, ry + tH + 4, cz + 4, a3, 5);
          topY = ry + tH + 4; sigilKind = 'star'; sigilCount = 3;
        } else if (s === 'ruin') {                      // Desert: broken walls + glowing altar
          addBox(G0, cx - 12, 0, cz - 12, cx + 12, 16, cz + 12, tint(a3, .4), 1);
          addBox(G0, cx - 13, 14, cz - 13, cx + 13, 18, cz + 13, a3, 5);
          topY = 70; sigilKind = 'skull'; sigilCount = 2;
        } else if (s === 'igloo') {                     // Ice: dome + entrance tunnel
          G0.append(_oct, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry, cz, 0, sw * .46, sh * .4, sh * .46), [a3[0], a3[1], a3[2], 1]);
          addBox(G0, cx - 6, ry + sh * .36, cz - 6, cx + 6, ry + sh * .36 + 12, cz + 6, [1, 1, 1], 5);
          topY = ry + sh * .4 + 12; sigilKind = 'snowflake'; sigilCount = 6;
        } else if (s === 'vault_i') {                   // Ice: corner towers + dome + crown crystal
          towers(40, 26);
          G0.append(_oct, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry, cz, 0, sw * .3, sh * .34, sh * .3), [a3[0], a3[1], a3[2], 1]);
          addCone(G0, cx, ry + sh * .34, cz, 10, 40, [1, 1, 1], 5, 0);
          topY = ry + sh * .34 + 40; sigilKind = 'crystal'; sigilCount = 6;
        } else if (s === 'shrine_i') {                  // Ice: hip roof + frost finial + icicle spikes
          addPyr(G0, cx, ry, cz, sw / 2 + 2, 38, sh / 2 + 2, tint(a3, .7), 1);
          for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; addCone(G0, cx + Math.cos(a) * sw * .3, ry + 34, cz + Math.sin(a) * sh * .3, 4, 22, [1, 1, 1], 5, 0); }
          finial(ry + 34, 12); topY = ry + 46; sigilKind = 'frost'; sigilCount = 5;
        } else if (s === 'forge') {                     // Lava: chimney + glowing forge cap
          addBox(G0, cx - 14, ry, cz - 14, cx + 14, ry + 30, cz + 14, tint(a3, .4), 1);
          addBox(G0, cx - 9, ry + 30, cz - 9, cx + 9, ry + 58, cz + 9, tint(a3, .35), 1);
          addBox(G0, cx - 10, ry + 54, cz - 10, cx + 10, ry + 62, cz + 10, a3, 5);
          topY = ry + 62; sigilKind = 'flame'; sigilCount = 5;
        } else if (s === 'bastion') {                   // Lava: corner towers + jagged obsidian spikes (no dome)
          towers(46, 18);
          for (let i = 0; i < 5; i++) { const a = i * (Math.PI * 2 / 5); addCone(G0, cx + Math.cos(a) * sw * .22, ry, cz + Math.sin(a) * sh * .22, 7, 40 + (i % 2) * 16, tint(a3, .5), 1, a); }
          addBox(G0, cx - 8, ry + 30, cz - 8, cx + 8, ry + 40, cz + 8, a3, 5);
          topY = ry + 70; sigilKind = 'spike'; sigilCount = 5;
        } else if (s === 'chapel') {                    // Lava: slab + hip + cross spire
          addBox(G0, b.x - 4, ry, b.y - 4, b.x + b.w + 4, ry + 14, b.y + b.h + 4, tint(a3, .4), 1);
          addPyr(G0, cx, ry + 14, cz, sw / 2 + 2, 34, sh / 2 + 2, tint(a3, .7), 1);
          addBox(G0, cx - 2, ry + 48, cz - 2, cx + 2, ry + 96, cz + 2, tint(a3, .6), 1);
          addBox(G0, cx - 10, ry + 70, cz - 2, cx + 10, ry + 76, cz + 2, a3, 5);
          addBox(G0, cx - 2, ry + 70, cz - 10, cx + 2, ry + 76, cz + 10, a3, 5);
          topY = ry + 96; sigilKind = 'cross'; sigilCount = 4;
        } else if (s === 'shrine_v') {                  // Void: hip roof + void finial + floating ring
          addPyr(G0, cx, ry, cz, sw / 2 + 2, 38, sh / 2 + 2, tint(a3, .7), 1);
          G0.append(_torus, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry + 52, cz, 0, sw * .22, sw * .22, sw * .22), [a3[0], a3[1], a3[2], 5]);
          finial(ry + 34, 14); topY = ry + 64; sigilKind = 'voidring'; sigilCount = 7;
        } else if (s === 'obelisk') {                   // Void: tall spire
          addBox(G0, cx - sw * .14, ry, cz - sh * .14, cx + sw * .14, ry + 18, cz + sh * .14, tint(a3, .4), 1);
          addBox(G0, cx - sw * .1, ry + 18, cz - sh * .1, cx + sw * .1, ry + 168, cz + sh * .1, tint(a3, .5), 1);
          addBox(G0, cx - sw * .11, ry + 18, cz - sh * .11, cx + sw * .11, ry + 168, cz + sh * .11, a3, 5);
          addPyr(G0, cx, ry + 168, cz, sw * .1, 28, sh * .1, a3, 5);
          addBox(G0, cx - 5, ry + 196, cz - 5, cx + 5, ry + 204, cz + 5, [1, 1, 1], 5);
          topY = ry + 204; sigilKind = 'spire'; sigilCount = 3;
        } else if (s === 'sanctum') {                   // Void: corner towers + dome + phase ring
          towers(40, 22);
          G0.append(_oct, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry, cz, 0, sw * .3, sh * .34, sh * .3), [a3[0], a3[1], a3[2], 1]);
          G0.append(_torus, M.trs(M._tmp || (M._tmp = new Float32Array(16)), cx, ry + sh * .34 + 24, cz, R.time || 0, sw * .26, sw * .26, sw * .26, Math.PI / 2, 0), [a3[0], a3[1], a3[2], 5]);
          topY = ry + sh * .34 + 50; sigilKind = 'phase'; sigilCount = 8;
        } else {                                        // fallback: hip roof
          addPyr(G0, cx, ry, cz, sw / 2, 46, sh / 2, tint(a3, .7), 1);
          finial(ry + 42, 10); topY = ry + 52; sigilKind = 'ring'; sigilCount = 4;
        }
        // tag for the animated magical sigil drawn each frame in render3d_fx.js
        b._themed = true; b._sigilY = topY; b._sigilAcc = a3; b._sigilKind = sigilKind; b._sigilCount = sigilCount;
        W.roofs.push({ mesh: new Mesh(gl, new Geo()), b, alpha: 1 });
        return;
      }
      // ground-floor wall segments (with doors) belonging to this building
      for (const s of w.walls) {
        if (s.x < b.x - 1 || s.y < b.y - 1 || s.x + s.w > b.x + b.w + 1 || s.y + s.h > b.y + b.h + 1) continue;
        addBox(G0, s.x, 0, s.y, s.x + s.w, WH, s.y + s.h, pal.wall, 1);
        addBox(G0, s.x - 2, WH, s.y - 2, s.x + s.w + 2, WH + 8, s.y + s.h + 2, tint(pal.wall, .75), 4);
        if (s.w > s.h) { addBox(G0, s.x, WH - 22, s.y - 1, s.x + s.w, WH - 18, s.y + s.h + 1, acc, 5); } else { addBox(G0, s.x - 1, WH - 22, s.y, s.x + s.w + 1, WH - 18, s.y + s.h, acc, 5); }
      }
      // door lintels + frames
      for (const d of b.doors) {
        addBox(G0, d.x, 84, d.y, d.x + d.w, WH, d.y + d.h, tint(pal.wall, .9), 1);
        if (d.side === 'top' || d.side === 'bottom') { addBox(G0, d.x - 5, 0, d.y - 2, d.x, 90, d.y + d.h + 2, acc, 7); addBox(G0, d.x + d.w, 0, d.y - 2, d.x + d.w + 5, 90, d.y + d.h + 2, acc, 7); }
        else { addBox(G0, d.x - 2, 0, d.y - 5, d.x + d.w + 2, 90, d.y, acc, 7); addBox(G0, d.x - 2, 0, d.y + d.h, d.x + d.w + 2, 90, d.y + d.h + 5, acc, 7); }
      }
      if (meta) {
        for (let k = 1; k < nF; k++) {
          const y0 = k * FHh, sl = meta.slabs[k - 1], hole = sl.holes[0];
          // floor / ceiling slab with a stairwell opening
          if (hole) {
            addBox(G0, ix0, y0 - SLB, iz0, ix1, y0, hole.y, floorCol, 6);
            addBox(G0, ix0, y0 - SLB, hole.y + hole.h, ix1, y0, iz1, floorCol, 6);
            addBox(G0, ix0, y0 - SLB, hole.y, hole.x, y0, hole.y + hole.h, floorCol, 6);
            addBox(G0, hole.x + hole.w, y0 - SLB, hole.y, ix1, y0, hole.y + hole.h, floorCol, 6);
          } else addBox(G0, ix0, y0 - SLB, iz0, ix1, y0, iz1, floorCol, 6);
          // outline walls of this storey (gaps where bridges attach)
          for (const pr of D3.prisms) {
            if (!pr.wall || pr.b !== bi || pr.level !== k) continue;
            addBox(G0, pr.x, y0, pr.y, pr.x + pr.w, y0 + FHh, pr.y + pr.h, pal.wall, 1);
            addBox(G0, pr.x - 2, y0 + FHh, pr.y - 2, pr.x + pr.w + 2, y0 + FHh + 8, pr.y + pr.h + 2, tint(pal.wall, .75), 4);
            if (pr.w > pr.h) addBox(G0, pr.x, y0 + FHh - 22, pr.y - 1, pr.x + pr.w, y0 + FHh - 18, pr.y + pr.h + 1, acc, 5); else addBox(G0, pr.x - 1, y0 + FHh - 22, pr.y, pr.x + pr.w + 1, y0 + FHh - 18, pr.y + pr.h, acc, 5);
          }
          // exterior floor ledge
          addBox(G0, b.x - 4, y0 - 10, b.y - 4, b.x + b.w + 4, y0 - 2, b.y + b.h + 4, tint(pal.wall, .7), 4);
          addBox(G0, b.x - 4, y0 - 5, b.y - 4, b.x + b.w + 4, y0 - 3, b.y + b.h + 4, acc, 5);
        }
        // stairs (stepped look; the walking surface is a smooth ramp of the same slope)
        for (const st of meta.stairs) {
          const N = 9;
          for (let i = 0; i < N; i++) {
            const u0 = i / N, u1 = (i + 1) / N, top = st.z0 + (st.z1 - st.z0) * ((i + .5) / N), cc = tint(floorCol, i & 1 ? 1 : .86);
            if (st.ax === 'x') { const xa = st.dir > 0 ? st.x + st.w * u0 : st.x + st.w * (1 - u1), xb = st.dir > 0 ? st.x + st.w * u1 : st.x + st.w * (1 - u0); addBox(G0, xa, st.z0 - SLB, st.y, xb, top, st.y + st.h, cc, 6); }
            else { const za = st.dir > 0 ? st.y + st.h * u0 : st.y + st.h * (1 - u1), zb = st.dir > 0 ? st.y + st.h * u1 : st.y + st.h * (1 - u0); addBox(G0, st.x, st.z0 - SLB, za, st.x + st.w, top, zb, cc, 6); }
          }
        }
        // bridge openings: lintel + glowing posts
        for (const g of meta.gaps) {
          const y0 = g.k * FHh, o = 44; let x0, z0, x1, z1;
          if (g.side === 'top') { x0 = g.c - o; x1 = g.c + o; z0 = b.y; z1 = b.y + t; } else if (g.side === 'bottom') { x0 = g.c - o; x1 = g.c + o; z0 = b.y + b.h - t; z1 = b.y + b.h; }
          else if (g.side === 'left') { x0 = b.x; x1 = b.x + t; z0 = g.c - o; z1 = g.c + o; } else { x0 = b.x + b.w - t; x1 = b.x + b.w; z0 = g.c - o; z1 = g.c + o; }
          addBox(G0, x0, y0 + 84, z0, x1, y0 + FHh, z1, tint(pal.wall, .9), 1);
          if (g.side === 'top' || g.side === 'bottom') { addBox(G0, x0 - 5, y0, z0 - 2, x0, y0 + 90, z1 + 2, acc, 7); addBox(G0, x1, y0, z0 - 2, x1 + 5, y0 + 90, z1 + 2, acc, 7); }
          else { addBox(G0, x0 - 2, y0, z0 - 5, x1 + 2, y0 + 90, z0, acc, 7); addBox(G0, x0 - 2, y0, z1, x1 + 2, y0 + 90, z1 + 5, acc, 7); }
        }
      }
      // windows on every storey
      { const wr = rng((b.x * 31 + b.y * 17 + 5) | 0);
        for (let k = 0; k < nF; k++) {
          const wy0 = k * FHh + 52, wy1 = wy0 + 40;
          for (const side of ['top', 'bottom', 'left', 'right']) {
            const horiz = side === 'top' || side === 'bottom', len = horiz ? b.w : b.h, nW = Math.max(1, Math.floor((len - 70) / 78));
            for (let i = 0; i < nW; i++) {
              const c = 35 + (i + .5) * (len - 70) / nW, px = horiz ? b.x + c : (side === 'left' ? b.x : b.x + b.w), pz = horiz ? (side === 'top' ? b.y : b.y + b.h) : b.y + c;
              const pr = horiz ? { x: px - 15, y: pz - 3, w: 30, h: 6 } : { x: px - 3, y: pz - 15, w: 6, h: 30 };
              let skip = false;
              if (k === 0) for (const d of b.doors) if (!(pr.x + pr.w < d.x - 8 || d.x + d.w + 8 < pr.x || pr.y + pr.h < d.y - 8 || d.y + d.h + 8 < pr.y)) { skip = true; break; }
              if (meta) for (const g of meta.gaps) if (g.k === k && g.side === side && Math.abs(g.c - (horiz ? px : pz)) < 44 + 20) { skip = true; break; }
              if (skip) continue;
              const lit = wr() < .45, col = lit ? winCol : [.04, .07, .11];
              if (horiz) { const o0 = side === 'top' ? pz - 1.7 : pz - .3, o1 = side === 'top' ? pz + .3 : pz + 1.7; addBox(G0, px - 14, wy0, o0, px + 14, wy1, o1, col, lit ? 5 : 1); }
              else { const o0 = side === 'left' ? px - 1.7 : px - .3, o1 = side === 'left' ? px + .3 : px + 1.7; addBox(G0, o0, wy0, pz - 14, o1, wy1, pz + 14, col, lit ? 5 : 1); }
            }
          }
        } }
      // corner pillars (full height)
      for (const [px, pz] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
        addBox(G0, px - 14, 0, pz - 14, px + 14, H3 + 22, pz + 14, tint(pal.wall, 1.15), 4);
        addBox(G0, px - 9, H3 + 22, pz - 9, px + 9, H3 + 34, pz + 9, _bAcc, 5);
      }
      // roof (separate mesh for fade) — themed landmarks get a vividly coloured
      // glowing roof + a tall spire so they read as special against normal buildings
      const RG = new Geo(), ry = H3 + 8;
      addBox(RG, b.x - 8, ry, b.y - 8, b.x + b.w + 8, ry + 14, b.y + b.h + 8, tint(pal.wall, .65), 4);
      addBox(RG, b.x + 8, ry + 14, b.y + 8, b.x + b.w - 8, ry + 22, b.y + b.h - 8, tint(pal.wall, .85), 4);
      addBox(RG, b.x - 8, ry + 6, b.y - 8, b.x + b.w + 8, ry + 10, b.y + b.h + 8, _bAcc, 5);
      const rr = rng((b.x * 13 + b.y * 7) | 0);
      for (let i = 0; i < 2; i++) addBox(RG, b.x + 24 + rr() * (b.w - 80), ry + 22, b.y + 24 + rr() * (b.h - 80), b.x + 24 + rr() * 10 + 30, ry + 36, b.y + 24 + 30, tint(pal.wall, 1.2), 4);
      W.roofs.push({ mesh: new Mesh(gl, RG), b, alpha: 1 });
    });

    // ---- bridges (style follows the map)
    if (D3) for (const br of D3.bridges) {
      const d = br.deck, ax = br.axis, L = ax === 'y' ? d.h : d.w, Wd = ax === 'y' ? d.w : d.h, cx = d.x + d.w / 2, cz = d.y + d.h / 2;
      const zA = br.zP, zB = br.zQ, midY = (zA + zB) / 2, sl = Math.atan2(zB - zA, L), ca = Math.cos(sl), sa = Math.sin(sl), T = new Float32Array(16);
      const surf = (u) => midY + u * Math.tan(sl);
      const place = (u, v, h, su, sv, sh, col, mat) => {
        const al = ax === 'y' ? [0, sa, ca] : [ca, sa, 0], cr = ax === 'y' ? [1, 0, 0] : [0, 0, 1], up = ax === 'y' ? [0, ca, -sa] : [-sa, ca, 0];
        const px = cx + al[0] * u + cr[0] * v + up[0] * h, py = midY + al[1] * u + cr[1] * v + up[1] * h, pz = cz + al[2] * u + cr[2] * v + up[2] * h;
        const X = ax === 'y' ? cr.map(q => q * sv) : al.map(q => q * su), Y = up.map(q => q * sh), Z = ax === 'y' ? al.map(q => q * su) : cr.map(q => q * sv);
        T.set([X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, px, py, pz, 1]);
        G0.append(R._box, T, [col[0], col[1], col[2], mat || 0]);
      };
      const worldAt = (u, v) => { const al = ax === 'y' ? [0, 0, 1] : [1, 0, 0], cr = ax === 'y' ? [1, 0, 0] : [0, 0, 1]; return [cx + al[0] * u + cr[0] * v, cz + al[2] * u + cr[2] * v]; };
      const half = L / 2, edge = Wd / 2, tb = (br.len / 2);   // tb = free span outside the buildings
      const pylon = (u, v, rad, col, mat) => { const [x, z] = worldAt(u, v), gy = W3.terrain(x, z), top = surf(u) - 8; if (top - gy > 14) addCyl(G0, x, gy, z, rad, top - gy, col, mat); };
      const plank = [[.46, .31, .17], [.4, .27, .14]];
      if (tid === 1) {          // rope-and-timber bridge
        place(0, 0, -4, L, Wd, 8, [.32, .21, .11], 3);
        for (let u = -half + 7; u < half; u += 14) place(u, 0, 1, 11, Wd - 3, 3, plank[(u / 14 | 0) & 1], 3);
        for (let u = -tb; u <= tb + .1; u += 40) for (const v of [-edge - 3, edge + 3]) place(u, v, 18, 5, 5, 38, [.35, .23, .12], 3);
        for (const v of [-edge - 3, edge + 3]) { place(0, v, 30, L, 2.4, 2.4, [.8, .7, .45], 0); place(0, v, 15, L, 2, 2, [.75, .65, .4], 0); }
        for (let u = -tb + 20; u < tb; u += 120) for (const v of [-edge + 8, edge - 8]) pylon(u, v, 4.5, [.33, .22, .12], 3);
      } else if (tid === 2) {   // carved sandstone span
        place(0, 0, -6, L, Wd, 12, [.64, .5, .3], 1);
        for (const v of [-edge - 3, edge + 3]) place(0, v, 14, L, 7, 28, [.58, .45, .26], 1);
        for (let u = -tb; u <= tb + .1; u += 70) for (const v of [-edge - 3, edge + 3]) place(u, v, 32, 12, 11, 8, [.7, .56, .33], 4);
        for (let u = -tb + 30; u < tb; u += 130) { const [x, z] = worldAt(u, 0), gy = W3.terrain(x, z), top = surf(u) - 10; if (top - gy > 14) { addBox(G0, x - 15, gy, z - Wd * .3, x + 15, top, z + Wd * .3, [.6, .47, .28], 1); } }
      } else if (tid === 3) {   // frozen causeway on crystal pillars
        place(0, 0, -5, L, Wd, 10, [.64, .86, .97], 4);
        place(0, 0, -11, L * .96, Wd * .7, 3, [.4, .8, 1], 5);
        for (let u = -tb + 12; u <= tb; u += 34) for (const v of [-edge - 2, edge + 2]) { const [x, z] = worldAt(u, v); addCone(G0, x, surf(u), z, 5.5, 34 + ((u * 7) % 14 + 14), [.72, .94, 1], 5, u); }
        for (let u = -tb + 30; u < tb; u += 120) for (const v of [-edge + 10, edge - 10]) pylon(u, v, 9, [.72, .9, 1], 1);
      } else if (tid === 4) {   // obsidian span with lava seams
        place(0, 0, -6, L, Wd, 12, [.1, .08, .09], 4);
        for (const v of [-edge + 4, edge - 4]) place(0, v, 1, L, 4, 2.5, [1, .42, .1], 5);
        for (let u = -tb; u <= tb + .1; u += 36) for (const v of [-edge - 3, edge + 3]) { place(u, v, 15, 5, 5, 32, [.14, .11, .11], 4); place(u, v, 33, 7, 7, 4, [1, .45, .12], 5); }
        for (const v of [-edge - 3, edge + 3]) place(0, v, 23, L, 2.2, 2.2, [.22, .19, .19], 4);
        for (let u = -tb + 24; u < tb; u += 120) { const [x, z] = worldAt(u, 0), gy = W3.terrain(x, z), top = surf(u) - 10; if (top - gy > 14) { addBox(G0, x - 12, gy, z - 12, x + 12, top, z + 12, [.13, .1, .1], 2); addBox(G0, x - 14, top - 14, z - 14, x + 14, top - 10, z + 14, [1, .4, .1], 5); } }
      } else {                  // neon void: floating hologram span
        place(0, 0, -2, L, Wd, 4, [.5, .25, 1], 5);
        for (const v of [-edge, edge]) { place(0, v, 3, L, 2.4, 3, [.4, .9, 1], 5); place(0, v, 30, L, 1.6, 1.6, [.4, .9, 1], 5); }
        for (let u = -tb; u <= tb + .1; u += 60) for (const v of [-edge, edge]) place(u, v, 15, 1.8, 1.8, 30, [.7, .4, 1], 5);
        for (let u = -tb + 30; u < tb; u += 90) { const [x, z] = worldAt(u, 0); addCone(G0, x, surf(u) - 70, z, 8, 50, [.6, .25, 1], 5, u); }
      }
    }

    // ---- ambient props: a varied kit per map, laid out as patches, lines, rings and singles so the floor has real pattern
    const areaK = Math.max(1, Math.min(2, (w.w * w.h) / (4000 * 2800))), hz = w.hazards, TAU = Math.PI * 2;
    const clear = (x, z, r) => { if (w.isBlocked && w.isBlocked(x, z, r + 6)) return false; for (const h of hz) if (x > h.x - 70 && x < h.x + h.w + 70 && z > h.y - 70 && z < h.y + h.h + 70) return false; return true; };
    const TMP = () => (M._tmp || (M._tmp = new Float32Array(16)));
    const blob = (x, y, z, rx, ry, rz, c, mat) => G0.append(_oct, M.trs(TMP(), x, y + yOff, z, 0, rx, ry, rz), [c[0], c[1], c[2], mat || 0]);
    const slab = (x, y, z, lx, ly, lz, c, mat, ry, rx, rz) => G0.append(R._box, M.trs(TMP(), x, y + yOff, z, ry || 0, lx, ly, lz, rx || 0, rz || 0), [c[0], c[1], c[2], mat || 0]);
    const jc = (c, k) => tint(c, 1 - k * .5 + rnd() * k), pick = (a) => a[Math.floor(rnd() * a.length)], sd = () => (rnd() * 1e6) | 0;
    const bone = [.9, .87, .78];
    const bonesAt = (x, z, col) => { const a = rnd() * TAU, ca = Math.cos(a), sa = Math.sin(a); slab(x, 1.3, z, 26, 1.8, 2.4, col, 0, a); for (let i = -2; i <= 2; i++) { slab(x + ca * i * 5 - sa * 0, 1.8, z + sa * i * 5, 1.3, 2.2, 15 - Math.abs(i) * 2.6, col, 0, a); } blob(x + ca * 17, 3, z + sa * 17, 4.6, 3.6, 4.2, col, 0); };
    const bush3 = (x, z, base) => { for (let i = 0; i < 3; i++) blob(x + (rnd() - .5) * 11, 5, z + (rnd() - .5) * 11, 7 + rnd() * 3, 5 + rnd() * 2, 7 + rnd() * 3, jc(base, .4), 0); };
    const mk = {
      1: {
        rock: (x, z, s) => { addRock(G0, x, 0, z, s, s * .7, s, sd(), tint(pal.rock, .9)); if (rnd() < .5) addRock(G0, x + s * 1.1, 0, z + s * .4, s * .5, s * .4, s * .5, sd(), tint(pal.rock, 1.05)); },
        tuft: (x, z) => { for (let a = 0; a < 5; a++) addCone(G0, x + (rnd() - .5) * 10, 0, z + (rnd() - .5) * 10, 1.6, 10 + rnd() * 9, [.18, .4, .12], 0, 0); },
        tall: (x, z) => { for (let a = 0; a < 7; a++) addCone(G0, x + (rnd() - .5) * 12, 0, z + (rnd() - .5) * 12, 1.2, 18 + rnd() * 14, jc([.3, .5, .16], .3), 0, 0); },
        shroom: (x, z) => { const cap = pick([[.8, .15, .12], [.9, .5, .15], [.55, .25, .7], [.85, .8, .7]]), n = 1 + ((rnd() * 3) | 0); for (let i = 0; i < n; i++) { const ox = (rnd() - .5) * 14, oz = (rnd() - .5) * 14, h = 5 + rnd() * 7; addCyl(G0, x + ox, 0, z + oz, 1.5, h, [.9, .85, .7], 0); blob(x + ox, h, z + oz, 3.2 + h * .25, 2.2, 3.2 + h * .25, cap, 0); if (rnd() < .5) blob(x + ox + 1, h + 1.6, z + oz, .8, .5, .8, [1, 1, 1], 0); } },
        flower: (x, z) => { const hc = pick([[1, .5, .7], [1, .9, .3], [.6, .7, 1], [1, 1, 1]]); for (let i = 0; i < 5; i++) { const ox = (rnd() - .5) * 14, oz = (rnd() - .5) * 14, h = 6 + rnd() * 5; addCyl(G0, x + ox, 0, z + oz, .6, h, [.2, .45, .15], 0); blob(x + ox, h + 1, z + oz, 2.4, 1.6, 2.4, hc, 0); } },
        log: (x, z) => { const a = rnd() * TAU, L = 26 + rnd() * 18; slab(x, 4, z, L, 7, 7, [.3, .2, .11], 0, a); slab(x, 7.6, z, L * .9, .8, 6, [.18, .34, .12], 0, a); },
        stump: (x, z) => { const h = 8 + rnd() * 6; addCyl(G0, x, 0, z, 7 + rnd() * 3, h, [.28, .18, .1], 0); addCyl(G0, x, h, z, 6, .6, [.58, .44, .26], 0); },
        bush: (x, z) => bush3(x, z, [.12, .34, .1]),
        step: (x, z) => { slab(x, .8, z, 12 + rnd() * 5, 1.6, 10 + rnd() * 5, jc(tint(pal.rock, 1.1), .3), 2, rnd() * 3); }
      },
      2: {
        rock: (x, z, s) => { addRock(G0, x, 0, z, s, s * .5, s, sd(), pal.rock); },
        cactus: (x, z) => { const h = 26 + rnd() * 22, c = [.3, .5, .22]; addCyl(G0, x, 0, z, 3.2, h, c, 0); blob(x, h, z, 3.2, 3, 3.2, c, 0); const na = (rnd() * 3) | 0; for (let i = 0; i < na; i++) { const sg = rnd() < .5 ? -1 : 1, ah = 10 + rnd() * 10, yb = h * .3 + rnd() * h * .3; slab(x + sg * 5.2, yb, z, 7, 2.6, 2.6, c, 0); addCyl(G0, x + sg * 8.4, yb - 1.3, z, 2.2, ah, c, 0); blob(x + sg * 8.4, yb - 1.3 + ah, z, 2.2, 2, 2.2, c, 0); } },
        bones: (x, z) => bonesAt(x, z, bone),
        shrub: (x, z) => { for (let a = 0; a < 7; a++) addCone(G0, x + (rnd() - .5) * 9, 0, z + (rnd() - .5) * 9, 1.1, 8 + rnd() * 8, jc([.5, .38, .2], .3), 0, 0); },
        slab: (x, z) => { const a = rnd() * 3, lx = 18 + rnd() * 14, lz = 14 + rnd() * 10; slab(x, 2.5, z, lx, 5, lz, [.64, .5, .32], 2, a); slab(x + 2, 6.4, z - 1, lx * .55, 3.4, lz * .55, [.7, .56, .36], 2, a + .4); },
        ruin: (x, z) => { const h = 14 + rnd() * 22; slab(x, 1.5, z, 17, 3, 17, [.6, .46, .28], 2); addCyl(G0, x, 3, z, 6, h, [.7, .58, .38], 2); addRock(G0, x, 3 + h, z, 5, 2.5, 5, sd(), [.66, .52, .33]); },
        dgrass: (x, z) => { for (let a = 0; a < 6; a++) addCone(G0, x + (rnd() - .5) * 12, 0, z + (rnd() - .5) * 12, 1, 14 + rnd() * 10, jc([.62, .55, .28], .3), 0, 0); },
        pebbles: (x, z) => { for (let a = 0; a < 4; a++) addRock(G0, x + (rnd() - .5) * 18, 0, z + (rnd() - .5) * 18, 2 + rnd() * 2.5, 1.6 + rnd() * 1.5, 2 + rnd() * 2.5, sd(), jc(pal.rock, .3)); }
      },
      3: {
        spikes: (x, z) => { for (let a = 0; a < 3; a++) addCone(G0, x + (rnd() - .5) * 14, 0, z + (rnd() - .5) * 14, 3 + rnd() * 4, 14 + rnd() * 30, [.75, .93, 1], 5, 0); },
        crystal: (x, z) => { const c = pick([[.5, .85, 1], [.62, .75, 1], [.45, .95, .95]]); addCone(G0, x, 0, z, 4 + rnd() * 2, 28 + rnd() * 40, c, 5, rnd() * 3); for (let i = 0; i < 2; i++) addCone(G0, x + (rnd() - .5) * 14, 0, z + (rnd() - .5) * 14, 2.5 + rnd() * 2, 12 + rnd() * 18, c, 5, rnd() * 3); },
        drift: (x, z) => { blob(x, 2, z, 16 + rnd() * 10, 4 + rnd() * 2, 12 + rnd() * 8, [.9, .96, 1], 0); blob(x + 9, 1.5, z + 5, 9, 3, 8, [.94, .98, 1], 0); },
        frozen: (x, z, s) => { addRock(G0, x, 0, z, s, s * .75, s, sd(), pal.rock); blob(x, s * .62, z, s * .7, s * .22, s * .7, [.92, .98, 1], 0); },
        icicles: (x, z) => { for (let a = 0; a < 5; a++) addCone(G0, x + (rnd() - .5) * 9, 0, z + (rnd() - .5) * 9, 1.5, 20 + rnd() * 14, [.8, .95, 1], 0, 0); },
        frost: (x, z) => { const r = 14 + rnd() * 14; addCyl(G0, x, .3, z, r, .5, [.8, .92, 1], 0); addCyl(G0, x, .6, z, r * .6, .5, [.9, .97, 1], 0); },
        dead: (x, z) => { for (let a = 0; a < 6; a++) addCone(G0, x + (rnd() - .5) * 8, 0, z + (rnd() - .5) * 8, .9, 10 + rnd() * 12, [.6, .72, .82], 0, 0); },
        mound: (x, z) => { blob(x, 3, z, 8 + rnd() * 6, 6 + rnd() * 2, 8 + rnd() * 6, [.93, .98, 1], 0); }
      },
      4: {
        spike: (x, z) => { addCone(G0, x, 0, z, 4 + rnd() * 4, 16 + rnd() * 28, [.12, .06, .06], 0, rnd() * 3); },
        rock: (x, z, s) => { addRock(G0, x, 0, z, s, s * .6, s, sd(), [.17, .1, .09], 2); },
        fissure: (x, z) => { let a = rnd() * TAU, px = x, pz = z; const n = 4 + ((rnd() * 4) | 0); for (let i = 0; i < n; i++) { const len = 14 + rnd() * 14; slab(px + Math.cos(a) * len / 2, .5, pz + Math.sin(a) * len / 2, len, .7, 2.4 + rnd() * 1.6, [1, .38, .06], 5, a); px += Math.cos(a) * len; pz += Math.sin(a) * len; a += (rnd() - .5) * 1.1; } },
        vent: (x, z) => { addCone(G0, x, 0, z, 6, 7, [.1, .06, .06], 0, 0); addCone(G0, x, 6.5, z, 2.6, 3.5, [1, .45, .08], 5, 0); },
        pool: (x, z) => { const r = 10 + rnd() * 12; addCyl(G0, x, 0, z, r + 3, 1.6, [.08, .05, .05], 0); addCyl(G0, x, 1.2, z, r, .7, [1, .4, .07], 5); },
        basalt: (x, z) => { const n = 4 + ((rnd() * 4) | 0); for (let i = 0; i < n; i++) addCyl(G0, x + (rnd() - .5) * 20, 0, z + (rnd() - .5) * 20, 4 + rnd() * 2, 10 + rnd() * 28, jc([.14, .1, .11], .3), 0); },
        ash: (x, z) => { blob(x, 2, z, 14 + rnd() * 8, 3, 11 + rnd() * 6, [.21, .19, .19], 0); },
        bones: (x, z) => bonesAt(x, z, [.55, .5, .42]),
        charred: (x, z) => { const h = 20 + rnd() * 14; addCyl(G0, x, 0, z, 2, h, [.07, .05, .05], 0); for (let i = 0; i < 2; i++) slab(x + (i ? 4 : -4), h * (.55 + i * .15), z, 11, 1.4, 1.4, [.07, .05, .05], 0, rnd() * 3, 0, i ? .7 : -.7); }
      },
      5: {
        cone: (x, z) => { for (let a = 0; a < 2; a++) addCone(G0, x + (rnd() - .5) * 10, 6 + rnd() * 10, z + (rnd() - .5) * 10, 2.5 + rnd() * 2.5, 10 + rnd() * 22, [.6, .3, 1], 5, 0); },
        cube: (x, z) => { const s = 4 + rnd() * 4, c = pick([[.2, .9, 1], [1, .3, .9], [.6, .3, 1]]); slab(x, 14 + rnd() * 26, z, s, s, s, c, 5, rnd() * 3, rnd(), rnd()); },
        pillar: (x, z) => { const h = 24 + rnd() * 46, c = pick([[.2, .9, 1], [1, .3, .9], [.7, .4, 1]]); slab(x, h / 2, z, 5, h, 5, [.12, .08, .22], 0); slab(x, h / 2, z, .8, h, 5.4, c, 5); slab(x, h + 1, z, 6, 2, 6, c, 5); },
        pad: (x, z) => { const c = pick([[.2, .9, 1], [1, .3, .9], [.7, .4, 1]]), y = 1 + rnd() * 7; addCyl(G0, x, y, z, 16, .6, c, 5); addCyl(G0, x, y + .05, z, 14.2, .8, [.08, .05, .15], 0); },
        shard: (x, z) => { const c = pick([[.2, .9, 1], [1, .3, .9], [.7, .4, 1]]); for (let i = 0; i < 3; i++) slab(x + (rnd() - .5) * 10, 10, z + (rnd() - .5) * 10, 1.4, 16 + rnd() * 14, 6, c, 5, rnd() * 3, 0, (rnd() - .5) * .8); },
        glitch: (x, z) => { const a = rnd() * 1.5, lx = 16 + rnd() * 14, lz = 10 + rnd() * 8, c = pick([[.2, .9, 1], [1, .3, .9]]); slab(x, 3, z, lx, 6, lz, [.1, .07, .2], 0, a); slab(x, 6.2, z, lx, .6, lz, c, 5, a); },
        orb: (x, z) => { addCyl(G0, x, 0, z, 5, 5, [.1, .07, .2], 0); blob(x, 14, z, 5, 5, 5, pick([[.2, .9, 1], [1, .3, .9], [.7, .4, 1]]), 5); },
        tuft: (x, z) => { for (let a = 0; a < 6; a++) addCone(G0, x + (rnd() - .5) * 10, 0, z + (rnd() - .5) * 10, 1, 8 + rnd() * 6, [.2, .9, .8], 5, 0); },
        rock: (x, z, s) => { addRock(G0, x, 0, z, s, s * .7, s, sd(), pal.rock, 2); }
      }
    };
    const KITS = {
      1: { single: [[.2, 'rock'], [.2, 'tuft'], [.12, 'shroom'], [.14, 'flower'], [.1, 'bush'], [.06, 'stump'], [.06, 'log'], [.1, 'tall']],
        patch: [['flower', 'tuft', 'tall'], ['bush', 'stump', 'shroom', 'log'], ['rock', 'rock', 'tuft'], ['shroom', 'tuft', 'shroom']], line: ['step', 'bush', 'tall'], ring: [['shroom', 'flower'], ['rock', 'tuft']] },
      2: { single: [[.2, 'rock'], [.16, 'cactus'], [.2, 'shrub'], [.06, 'bones'], [.12, 'slab'], [.06, 'ruin'], [.14, 'dgrass'], [.1, 'pebbles']],
        patch: [['shrub', 'dgrass', 'pebbles'], ['cactus', 'cactus', 'shrub', 'rock'], ['slab', 'pebbles', 'rock'], ['bones', 'bones', 'shrub', 'pebbles']], line: ['dgrass', 'pebbles', 'ruin'], ring: [['rock', 'cactus'], ['ruin', 'bones']] },
      3: { single: [[.2, 'spikes'], [.08, 'crystal'], [.18, 'drift'], [.16, 'frozen'], [.1, 'icicles'], [.12, 'frost'], [.08, 'dead'], [.08, 'mound']],
        patch: [['drift', 'mound', 'frost'], ['crystal', 'icicles', 'spikes'], ['frozen', 'drift', 'dead']], line: ['icicles', 'spikes', 'mound'], ring: [['icicles', 'crystal'], ['frozen', 'frost']] },
      4: { single: [[.16, 'spike'], [.16, 'rock'], [.12, 'fissure'], [.08, 'vent'], [.06, 'pool'], [.1, 'basalt'], [.12, 'ash'], [.05, 'bones'], [.08, 'charred']],
        patch: [['fissure', 'vent', 'ash'], ['basalt', 'rock', 'spike'], ['charred', 'ash', 'bones'], ['pool', 'vent', 'rock']], line: ['fissure', 'spike', 'basalt'], ring: [['rock', 'pool'], ['spike', 'vent'], ['basalt', 'pool']] },
      5: { single: [[.16, 'cone'], [.12, 'cube'], [.1, 'pillar'], [.1, 'pad'], [.12, 'shard'], [.14, 'glitch'], [.06, 'orb'], [.14, 'tuft'], [.06, 'rock']],
        patch: [['cube', 'shard', 'orb'], ['glitch', 'pad', 'tuft'], ['pillar', 'shard', 'cone'], ['tuft', 'cone', 'cube']], line: ['pillar', 'glitch', 'cube'], ring: [['pillar', 'orb'], ['shard', 'pad']] }
    };
    {
      const kit = KITS[tid] || KITS[1], fns = mk[tid] || mk[1], sz = () => 5 + rnd() * 12;
      const wpick = (list) => { let t = 0; for (const e of list) t += e[0]; let u = rnd() * t; for (const e of list) { u -= e[0]; if (u <= 0) return e[1]; } return list[0][1]; };
      const put = (name, x, z, s, r) => { if (x < 60 || z < 60 || x > w.w - 60 || z > w.h - 60) return; if (!clear(x, z, r || 12)) return; yOff = D3 ? W3.terrain(x, z) : 0; fns[name](x, z, s); };
      const rx = () => 70 + rnd() * (w.w - 140), rz = () => 70 + rnd() * (w.h - 140);
      for (let i = 0, n = Math.round(150 * areaK); i < n; i++) put(wpick(kit.single), rx(), rz(), sz(), 18);                                   // scattered singles
      for (let i = 0, n = Math.round(15 * areaK); i < n; i++) {                                                                                  // themed patches
        const set = kit.patch[(rnd() * kit.patch.length) | 0], cx = rx(), cz = rz(), rad = 80 + rnd() * 150, cnt = 7 + ((rnd() * 9) | 0);
        for (let j = 0; j < cnt; j++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * rad; put(set[(rnd() * set.length) | 0], cx + Math.cos(a) * d, cz + Math.sin(a) * d, sz(), 14); }
      }
      for (let i = 0, n = Math.round(7 * areaK); i < n; i++) {                                                                                   // lines: trails, rows, crack lines
        const name = kit.line[(rnd() * kit.line.length) | 0], x0 = rx(), z0 = rz(), a = rnd() * TAU, len = 5 + ((rnd() * 5) | 0), st = 34 + rnd() * 26;
        for (let j = 0; j < len; j++) put(name, x0 + Math.cos(a) * st * j + (rnd() - .5) * 10, z0 + Math.sin(a) * st * j + (rnd() - .5) * 10, sz(), 12);
      }
      for (let i = 0, n = Math.round(7 * areaK); i < n; i++) {                                                                                   // rings with a centrepiece
        const ring = kit.ring[(rnd() * kit.ring.length) | 0], cx = rx(), cz = rz(), rad = 26 + rnd() * 36, cnt = 6 + ((rnd() * 5) | 0);
        if (!clear(cx, cz, rad + 16)) continue;
        for (let j = 0; j < cnt; j++) { const a = j / cnt * TAU; put(ring[0], cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, sz() * .8, 8); }
        if (ring[1]) put(ring[1], cx, cz, sz() * 1.2, 8);
      }
    }
    yOff = 0;
    // ---- distant framing silhouettes outside the arena
    for (let i = 0; i < 90; i++) {
      const side = i & 3, u = rnd();
      let x, z; const off = 120 + rnd() * 900;
      if (side === 0) { x = u * w.w; z = -off; } else if (side === 1) { x = u * w.w; z = w.h + off; } else if (side === 2) { x = -off; z = u * w.h; } else { x = w.w + off; z = u * w.h; }
      const hh = 160 + rnd() * 520, rr = 70 + rnd() * 160;
      if (tid === 3 || tid === 5 || rnd() < .4) addCone(G0, x, -20, z, rr * .8, hh * 1.2, tid === 5 ? [.28, .12, .5] : tid === 3 ? [.55, .75, .95] : tid === 4 ? [.2, .1, .1] : tint(pal.rock, .8), tid === 3 || tid === 5 ? 5 : 2, rnd() * 3);
      else addRock(G0, x, 0, z, rr, hh * .7, rr, (rnd() * 1e6) | 0, tint(pal.rock, .75));
    }
    W.meshes.push({ mesh: new Mesh(gl, G0), mat: R.mat([1, 1, 1], { mode: 1, rough: .85 }) });

    // ---- ground: a real heightfield (hills) inside the arena, flat plane beyond it
    const big = 9000;
    const GG = new Geo();
    if (D3 && D3.grid) {
      const g = D3.grid, cs = g.CELL, gxn = g.gx, gyn = g.gy, Hh = g.H, X1 = (gxn - 1) * cs, Z1 = (gyn - 1) * cs;
      const hAt = (i, j) => Hh[Math.max(0, Math.min(gyn - 1, j)) * gxn + Math.max(0, Math.min(gxn - 1, i))];
      for (let j = 0; j < gyn; j++) for (let i = 0; i < gxn; i++) {
        let nx = (hAt(i - 1, j) - hAt(i + 1, j)) / (2 * cs), nz = (hAt(i, j - 1) - hAt(i, j + 1)) / (2 * cs); const nl = Math.hypot(nx, 1, nz);
        GG.vert(i * cs, hAt(i, j), j * cs, nx / nl, 1 / nl, nz / nl, 0, 0, 1, 1, 1, 0);
      }
      for (let j = 0; j < gyn - 1; j++) for (let i = 0; i < gxn - 1; i++) { const a = j * gxn + i; GG.quad(a, a + 1, a + gxn + 1, a + gxn); }
      const strip = (x0, z0, x1, z1) => { const a = GG.vert(x0, 0, z0, 0, 1, 0, 0, 0, 1, 1, 1, 0), b = GG.vert(x1, 0, z0, 0, 1, 0, 0, 0, 1, 1, 1, 0), c = GG.vert(x1, 0, z1, 0, 1, 0, 0, 0, 1, 1, 1, 0), d = GG.vert(x0, 0, z1, 0, 1, 0, 0, 0, 1, 1, 1, 0); GG.quad(a, b, c, d); };
      strip(-big, -big, 0, Z1 + big); strip(X1, -big, X1 + big, Z1 + big); strip(0, -big, X1, 0); strip(0, Z1, X1, Z1 + big);
    } else {
      const gg = Geo.plane(w.w + big, w.h + big, [1, 1, 1, 0], 1, 1), gm = M.trs(new Float32Array(16), w.w / 2, 0, w.h / 2, 0, 1, 1, 1);
      GG.append(gg, gm);
    }
    W.ground = new Mesh(gl, GG);
    R.world = W; R.worldRef = w;
  };

  // ============================================================== CAMERA
  R.cam = { yaw: 0, pitch: 57 * Math.PI / 180, dist: 1320, zoom: 1, fov: 40 * Math.PI / 180, fx: 0, fy: 0, kick: 0,
    mode: 'tps', fp: true, ffov: 80 * Math.PI / 180, tyaw: -Math.PI / 2, tpitch: 0.30, tdist: 330, tcur: 330, shoulder: 72, tfov: 60 * Math.PI / 180 };
  R.eye = [0, 500, 500];
  R.vp = new Float32Array(16); R.ivp = new Float32Array(16); R.view = new Float32Array(16); R.proj = new Float32Array(16);
  function wallHit(walls, x, z, m) { for (let i = 0; i < walls.length; i++) { const w = walls[i]; if (x > w.x - m && x < w.x + w.w + m && z > w.y - m && z < w.y + w.h + m) return true; } return false; }
  R.updateCamera = function (F) {
    const c = R.cam, t = R.time;
    R.isTps = c.mode === 'tps' && !F.idle;
    if (R.isTps && c.fp) {   // ---- FIRST PERSON: eye at the player's head
      const me = F.me, px = me.x, pz = me.y;
      c.tpitch = Math.max(-1.45, Math.min(1.45, c.tpitch));
      const fx = Math.cos(c.tyaw), fz = Math.sin(c.tyaw), cp = Math.cos(c.tpitch), sp = Math.sin(c.tpitch);
      const ex = px + fx * 6 + (F.cam.sx || 0) * .6, ey = (me.z || 0) + 38, ez = pz + fz * 6 + (F.cam.sy || 0) * .6;
      R.eye[0] = ex; R.eye[1] = ey; R.eye[2] = ez;
      M.lookAt(R.view, R.eye, [ex + fx * cp * 100, ey - sp * 100, ez + fz * cp * 100], [0, 1, 0]);
      { const zf = R.adsZoom ? R.adsZoom() : 1; M.persp(R.proj, 2 * Math.atan(Math.tan(c.ffov / 2) / zf) * (1 + c.kick * .035), R.aspect || 1.6, 4, 9000); }
      M.mul(R.vp, R.proj, R.view); M.inv(R.ivp, R.vp);
      R.focus = [px, pz]; R.right = [R.view[0], R.view[4], R.view[8]]; R.up = [R.view[1], R.view[5], R.view[9]];
      return;
    }
    if (R.isTps) {
      const dt = Math.min(.05, F.dt || .016), me = F.me, px = me.x, pz = me.y;
      c.tpitch = Math.max(-0.12, Math.min(0.95, c.tpitch));
      const fx = Math.cos(c.tyaw), fz = Math.sin(c.tyaw), rx = -fz, rz = fx, cp = Math.cos(c.tpitch), sp = Math.sin(c.tpitch);
      const want = c.tdist * c.zoom, sx = c.shoulder, walls = F.world.walls || [];
      let dist = want;
      for (let s = 1; s <= 14; s++) { const d = want * s / 14, k = d / want; if (wallHit(walls, px - fx * cp * d + rx * sx * k, pz - fz * cp * d + rz * sx * k, 9)) { dist = want * (s - 1) / 14; break; } }
      c.tcur = dist < c.tcur ? dist : c.tcur + (dist - c.tcur) * Math.min(1, dt * 5);
      const d = Math.max(26, c.tcur), k = d / want;
      const ex = px - fx * cp * d + rx * sx * k + (F.cam.sx || 0) * .6, ey = (me.z || 0) + 34 + sp * d + 6, ez = pz - fz * cp * d + rz * sx * k + (F.cam.sy || 0) * .6;
      R.eye[0] = ex; R.eye[1] = ey; R.eye[2] = ez;
      const lp = c.tpitch * 0.92, ld = [fx * Math.cos(lp), -Math.sin(lp), fz * Math.cos(lp)];
      M.lookAt(R.view, R.eye, [ex + ld[0] * 100, ey + ld[1] * 100, ez + ld[2] * 100], [0, 1, 0]);
      M.persp(R.proj, c.tfov * (1 + c.kick * .035), R.aspect || 1.6, 6, 9000);
      M.mul(R.vp, R.proj, R.view); M.inv(R.ivp, R.vp);
      R.focus = [px, pz]; R.right = [R.view[0], R.view[4], R.view[8]]; R.up = [R.view[1], R.view[5], R.view[9]];
      return;
    }
    const sh = F.cam.shake || 0, sx = (F.cam.sx || 0) * .9, sy = (F.cam.sy || 0) * .9;
    const tx = F.cam.x + sx, tz = F.cam.y + sy;
    const d = c.dist * c.zoom;
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const tzv = (F.me && F.me.z) || 0;
    const ex = tx + Math.sin(c.yaw) * cp * d, ey = tzv + sp * d, ez = tz + Math.cos(c.yaw) * cp * d;
    R.eye[0] = ex; R.eye[1] = ey; R.eye[2] = ez;
    M.lookAt(R.view, R.eye, [tx, tzv, tz], [0, 1, 0]);
    // subtle roll/fov kick on shake
    const fov = c.fov * (1 + c.kick * .035);
    M.persp(R.proj, fov, R.aspect || 1.6, 40, 9000);
    M.mul(R.vp, R.proj, R.view); M.inv(R.ivp, R.vp);
    R.focus = [tx, tz];
    // camera basis for billboards
    R.right = [R.view[0], R.view[4], R.view[8]]; R.up = [R.view[1], R.view[5], R.view[9]];
  };
  // point the crosshair (screen centre) is aiming at, on the arena plane; falls back to a far point along the view yaw
  R.crosshairWorld = function (px, py) {
    const c = R.cam;
    if (c.fp && R.isTps) return { x: px + Math.cos(c.tyaw) * 900, y: py + Math.sin(c.tyaw) * 900 };   // first person: aim straight along view yaw
    const w = R.screenToWorld(R.cw / 2, R.ch / 2, 12);
    if (w) { const d = Math.hypot(w.x - px, w.y - py); if (d > 90 && d < 2400) return w; }
    return { x: px + Math.cos(c.tyaw) * 900, y: py + Math.sin(c.tyaw) * 900 };
  };
  // screen (css px relative to canvas) -> world {x,y} on plane y=planeY
  R.screenToWorld = function (sx, sy, planeY) {
    if (!R.ok || !R.cw) return null; planeY = planeY === undefined ? 12 : planeY;
    const nx = (sx / R.cw) * 2 - 1, ny = 1 - (sy / R.ch) * 2, iv = R.ivp;
    const unp = (z) => { const x = iv[0] * nx + iv[4] * ny + iv[8] * z + iv[12], y = iv[1] * nx + iv[5] * ny + iv[9] * z + iv[13], zz = iv[2] * nx + iv[6] * ny + iv[10] * z + iv[14], w = iv[3] * nx + iv[7] * ny + iv[11] * z + iv[15]; return [x / w, y / w, zz / w]; };
    const a = unp(-1), b = unp(1); const dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return null;
    const t = (planeY - a[1]) / dy; if (t < 0) return null; return { x: a[0] + (b[0] - a[0]) * t, y: a[2] + (b[2] - a[2]) * t };
  };
  R.w2s = function (gx, gy, h) { const m = R.vp, X = gx, Y = h || 0, Z = gy; const cx = m[0] * X + m[4] * Y + m[8] * Z + m[12], cy = m[1] * X + m[5] * Y + m[9] * Z + m[13], cw = m[3] * X + m[7] * Y + m[11] * Z + m[15]; if (cw <= 0) return null; return { x: (cx / cw * .5 + .5) * R.cw, y: (1 - (cy / cw * .5 + .5)) * R.ch, w: cw }; };

  // ======================================================== LIGHT UNIFORMS
  const _plPos = new Float32Array(40), _plCol = new Float32Array(30);
  function setLightUniforms(p, th) {
    const gl = R.gl;
    p.f3('uEye', R.eye[0], R.eye[1], R.eye[2]);
    p.f3('uSunDir', th.sun[0], th.sun[1], th.sun[2]); p.f3('uSunCol', th.sunCol[0], th.sunCol[1], th.sunCol[2]);
    p.f3('uSkyTop', th.skyTop[0], th.skyTop[1], th.skyTop[2]); p.f3('uSkyHor', th.skyHor[0], th.skyHor[1], th.skyHor[2]);
    p.f3('uGroundCol', th.ground[0], th.ground[1], th.ground[2]); p.f3('uFogCol', th.fog[0], th.fog[1], th.fog[2]); p.f1('uFogDen', th.fogDen);
    p.f1('uTime', R.time); p.i1('uNPL', R.nl); p.v4('uPL', _plPos); p.v3('uPLC', _plCol);
    p.m4('uLightVP', R.lightVP); p.f1('uShadowOn', R.shadowRT ? 1 : 0);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, R.shadowRT ? R.shadowRT.depthTex : R.dummyShadow); p.i1('uShadow', 5);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.white); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.white); // never leave the HDR target bound (feedback loop)
    p.i1('uAlbedo', 0); p.i1('uEmis', 1);
    p.i1('uTheme', R.themeId);
  }
  R.lightVP = new Float32Array(16);

  // ================================================================= FRAME
  R.frame = function (F) {
    if (!R.ok) return false;
    const gl = R.gl; R.F = F; R.time = F.t; poolI = 0;
    const th = THEME[F.theme.id] || THEME[1]; R.th = th; R.themeId = F.theme.id;
    const key = R.worldKeyOf(F);
    if (!R.world || R.world.key !== key) R.buildWorld(F);
    R.updateCamera(F);

    // -------- collect dynamic content (entities, fx) from the extension module
    R.opaque.length = 0; R.blend.length = 0; R.lights.length = 0;
    R.quads.add.n = 0; R.quads.alpha.n = 0; R.rib.vn = 0;
    if (R.collect) R.collect(F, th);

    // -------- lights: choose nearest N
    const fx = R.focus[0], fz = R.focus[1];
    for (const l of R.lights) l.d2 = ((l.x - fx) ** 2 + (l.z === undefined ? 0 : 0) + (l.y - fz) ** 2) / (l.rad * l.rad + 1);
    R.lights.sort((a, b) => a.d2 - b.d2);
    R.nl = Math.min(R.lights.length, R.q.maxLights);
    for (let i = 0; i < R.nl; i++) { const l = R.lights[i]; _plPos[i * 4] = l.x; _plPos[i * 4 + 1] = l.z === undefined ? 30 : l.z; _plPos[i * 4 + 2] = l.y; _plPos[i * 4 + 3] = l.rad; _plCol[i * 3] = l.r; _plCol[i * 3 + 1] = l.g; _plCol[i * 3 + 2] = l.b; }

    // -------- shadow pass
    const D = 1250;
    if (R.shadowRT) {
      const sd = th.sun, texel = 2 * D / R.shadowRT.w;
      const cx = Math.round(fx / texel) * texel, cz = Math.round(fz / texel) * texel;
      const lv = M.lookAt(R._lvM || (R._lvM = new Float32Array(16)), [cx + sd[0] * 2400, sd[1] * 2400, cz + sd[2] * 2400], [cx, 0, cz], [0, 1, 0]);
      const lp = M.ortho(R._lpM || (R._lpM = new Float32Array(16)), -D, D, -D, D, 100, 5400);
      M.mul(R.lightVP, lp, lv);
      gl.bindFramebuffer(gl.FRAMEBUFFER, R.shadowRT.fbo); gl.viewport(0, 0, R.shadowRT.w, R.shadowRT.h);
      gl.colorMask(false, false, false, false); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4); gl.disable(gl.CULL_FACE);
      const dp = R.progs.depth.use(); dp.m4('uLightVP', R.lightVP); dp.i1('uAlbedo', 0);
      const ID = R._idM || (R._idM = new Float32Array(16)); M.ident(ID);
      for (const sm of R.world.meshes) { dp.m4('uModel', ID); dp.i1('uHasTex', 0); sm.mesh.draw(); }
      for (const rf of R.world.roofs) { if (rf.alpha > .98) { dp.m4('uModel', ID); dp.i1('uHasTex', 0); rf.mesh.draw(); } }
      const L = R.opaque;
      for (let i = 0; i < L.length; i += 3) {
        const mat = L[i + 2]; if (!mat.shadow) continue;
        dp.m4('uModel', L[i + 1]);
        if (mat.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex); dp.i1('uHasTex', 1); } else dp.i1('uHasTex', 0);
        L[i].draw();
      }
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
    } else { M.ident(R.lightVP); }

    // -------- main pass
    const target = R.ms ? R.ms.fbo : R.hdr.fbo;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, R.W, R.H);
    gl.clearColor(th.fog[0], th.fog[1], th.fog[2], 1); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    // sky
    gl.disable(gl.CULL_FACE); gl.depthMask(false);
    { const p = R.progs.sky.use(); p.m4('uInvVP', R.ivp); p.f3('uEye', R.eye[0], R.eye[1], R.eye[2]); p.f3('uSkyTop', ...th.skyTop); p.f3('uSkyHor', ...th.skyHor); p.f3('uFogCol', ...th.fog); p.f3('uSunDir', ...th.sun); p.f3('uSunCol', ...th.sunCol); p.f1('uTime', R.time); p.i1('uTheme', R.themeId); gl.bindVertexArray(R.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); }
    gl.depthMask(true);
    // ground
    { const p = R.progs.ground.use(); p.m4('uVP', R.vp); setLightUniforms(p, th); p.f2('uWorld', R.world.w, R.world.h); R.world.ground.draw(); }
    // hazards
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    { const p = R.progs.haz.use(); p.m4('uVP', R.vp); setLightUniforms(p, th); p.f1('uY', 0.4);
      const hz = F.world.hazards || []; const kinds = { sand: 0, ice: 1, lava: 2, void: 3 };
      for (let i = 0; i < hz.length; i++) { const h = hz[i]; p.f4('uRect', h.x, h.y, h.w, h.h); p.i1('uKind', kinds[h.type] ?? 0); p.f1('uSeed', i * 7.3);
        const ph = h.phase === 'warn' ? 1 : h.phase === 'erupt' ? 2 : h.phase === 'after' ? 3 : 0; p.f1('uPhase', ph); p.f1('uPhaseK', h.phaseT || 0);
        R.hazQuad.draw(); } }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // opaque
    const lp = R.progs.lit.use(); lp.m4('uVP', R.vp); setLightUniforms(lp, th); lp.f1('uTime', R.time);
    const ID = R._idM || (R._idM = new Float32Array(16)); M.ident(ID);
    for (const sm of R.world.meshes) { lp.m4('uModel', ID); setMat(lp, sm.mat, gl); sm.mesh.draw(); }
    for (const rf of R.world.roofs) { if (rf.alpha > .98) { lp.m4('uModel', ID); setMat(lp, R.mat([1, 1, 1], { mode: 1, rough: .7 }), gl); rf.mesh.draw(); } }
    for (let i = 0; i < R.opaque.length; i += 3) {
      const mat = R.opaque[i + 2];
      lp.m4('uModel', R.opaque[i + 1]); setMat(lp, mat, gl); R.opaque[i].draw();
    }
    // blended meshes (roof fade, shields, domes) — back-to-front
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    for (const rf of R.world.roofs) if (rf.alpha <= .98 && rf.alpha > .01) { lp.m4('uModel', ID); setMat(lp, R.mat([1, 1, 1], { mode: 1, rough: .7, alpha: rf.alpha }), gl); rf.mesh.draw(); }
    const bl = R.blend, items = (bl.length / 3) | 0;
    const di = R._bIdx || (R._bIdx = []); di.length = items;
    const dd = R._bDist || (R._bDist = []); dd.length = items;
    for (let k = 0; k < items; k++) { const m = bl[k * 3 + 1]; dd[k] = (m[12] - R.eye[0]) ** 2 + (m[13] - R.eye[1]) ** 2 + (m[14] - R.eye[2]) ** 2; di[k] = k; }
    di.sort((a, b) => dd[b] - dd[a]);
    for (let q = 0; q < items; q++) { const i = di[q] * 3; lp.m4('uModel', bl[i + 1]); setMat(lp, bl[i + 2], gl); bl[i].draw(); }
    // particles + ribbons
    gl.disable(gl.CULL_FACE);
    const pp = R.progs.part.use(); pp.m4('uVP', R.vp); pp.f3('uRight', ...R.right); pp.f3('uUp', ...R.up); pp.f3('uEye', ...R.eye); pp.f1('uTime', R.time);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); pp.f1('uAdd', 0); R.quads.alpha.flush();
    gl.blendFunc(gl.ONE, gl.ONE); pp.f1('uAdd', 1); R.quads.add.flush();
    const rp = R.progs.rib.use(); rp.m4('uVP', R.vp); gl.blendFunc(gl.ONE, gl.ONE); R.rib.flush();
    gl.disable(gl.BLEND); gl.depthMask(true);

    // -------- first-person viewmodel: own projection, fresh depth so the gun never clips into walls
    if (R.vmList && R.vmList.length && R.isTps && R.cam.fp) {
      M.persp(R._vmProj || (R._vmProj = new Float32Array(16)), 62 * Math.PI / 180, R.aspect || 1.6, 1, 600);
      M.mul(R._vmVP || (R._vmVP = new Float32Array(16)), R._vmProj, R.view);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
      const vl = R.progs.lit.use(); vl.m4('uVP', R._vmVP); setLightUniforms(vl, th); vl.f1('uTime', R.time);
      const VL = R.vmList;
      for (let i = 0; i < VL.length; i += 3) { vl.m4('uModel', VL[i + 1]); setMat(vl, VL[i + 2], gl); VL[i].draw(); }
    }
    // -------- resolve MSAA
    if (R.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, R.ms.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, R.hdr.fbo);
      gl.blitFramebuffer(0, 0, R.W, R.H, 0, 0, R.W, R.H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    }
    // -------- bloom
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.bindVertexArray(R.emptyVAO);
    const bl0 = R.bl; const useBloom = R.q.bloom && bl0.length >= 3;
    if (useBloom) {
      let p = R.progs.pre.use(); gl.bindFramebuffer(gl.FRAMEBUFFER, bl0[0].fbo); gl.viewport(0, 0, bl0[0].w, bl0[0].h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.hdr.tex); p.i1('uTex', 0); p.f2('uTexel', 1 / R.W, 1 / R.H); p.f1('uThresh', 1.0); gl.drawArrays(gl.TRIANGLES, 0, 3);
      p = R.progs.down.use(); p.i1('uTex', 0);
      for (let i = 1; i < bl0.length; i++) { gl.bindFramebuffer(gl.FRAMEBUFFER, bl0[i].fbo); gl.viewport(0, 0, bl0[i].w, bl0[i].h); gl.bindTexture(gl.TEXTURE_2D, bl0[i - 1].tex); p.f2('uTexel', .5 / bl0[i - 1].w, .5 / bl0[i - 1].h); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      p = R.progs.up.use(); p.i1('uTex', 0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = bl0.length - 1; i > 0; i--) { gl.bindFramebuffer(gl.FRAMEBUFFER, bl0[i - 1].fbo); gl.viewport(0, 0, bl0[i - 1].w, bl0[i - 1].h); gl.bindTexture(gl.TEXTURE_2D, bl0[i].tex); p.f2('uTexel', 1 / bl0[i].w, 1 / bl0[i].h); p.f1('uK', 1); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.disable(gl.BLEND);
    }
    // -------- composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.W, R.H);
    const cp = R.progs.comp.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, R.hdr.tex); cp.i1('uScene', 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, useBloom ? bl0[0].tex : R.white); cp.i1('uBloom', 1);
    const fxv = R.fxState || (R.fxState = { hurt: 0, flash: 0, flashCol: [1, 1, 1], low: 0 });
    cp.f2('uRes', R.W, R.H); cp.f1('uBloomK', useBloom ? th.bloom * (F.bloomMul || 1) : 0); cp.f1('uExposure', th.exp); cp.f1('uTime', R.time);
    cp.f1('uHurt', fxv.hurt); cp.f1('uLow', fxv.low); cp.f1('uFXAA', R.fxaa ? 1 : 0); cp.f1('uGrain', .035); cp.f1('uVig', th.vig);
    cp.f3('uTint', ...th.tint); cp.f1('uSat', th.sat); cp.f1('uContrast', 1.06); cp.f1('uFlash', fxv.flash); cp.f3('uFlashCol', ...fxv.flashCol); cp.f1('uAber', .012 + fxv.hurt * .02);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return true;
  };

  R.QuadBatch = QuadBatch;
})(window);
