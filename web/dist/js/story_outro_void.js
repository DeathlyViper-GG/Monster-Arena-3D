// ============================================================
// VOID OUTRO (Realm 5) — the Echo COLLAPSES into a singularity.
// A black reality-fracture. The four recovered fragments (green,
// amber, ice, ember) are dragged on decaying orbits into a
// swelling black hole ringed by a lensed accretion disc; space
// tears with chromatic-aberration glitch bands and fracture
// lines, debris stretches toward the core (spaghettification),
// then the singularity detonates into the final five-colour
// fragment. Vast, cold, terrifying.
// ============================================================
(function () {
  'use strict';
  const E = window.OutroEngine;
  if (!E) return;
  const ease = E.ease, clamp = E.clamp;
  const COLS = ['#7dffa3', '#ffd166', '#9fe3ff', '#ff7a66'];
  let orbs = [], debris = [], stars = [], tears = [];

  const scene = {
    id: 'vo', accent: '#c88aff', speaker: '#d6a8ff', text: '#e8dcf4',
    init(W, H, S) {
      orbs = COLS.map((col, i) => ({ col, a: (i / 4) * 6.28, r: 0.38 + (i % 2) * 0.05, w: 0.7 + i * 0.08, in: 1.0 + i * 0.7 }));
      debris = []; for (let i = 0; i < 220; i++) debris.push({ a: Math.random() * 6.28, r: 0.15 + Math.random() * 0.6, w: 0.4 + Math.random() * 1.4, s: 0.8 + Math.random() * 2.4, hue: COLS[i % 4], t0: Math.random() * 3 });
      stars = []; for (let i = 0; i < 160; i++) stars.push({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.2, a: 0.2 + Math.random() * 0.6, ph: Math.random() * 6.28 });
      tears = []; for (let i = 0; i < 10; i++) { const pts = []; let x = Math.random(), y = Math.random(), a = Math.random() * 6.28; for (let k = 0; k < 9; k++) { pts.push([x, y]); a += (Math.random() - 0.5) * 1.1; x += Math.cos(a) * 0.05; y += Math.sin(a) * 0.05; } tears.push({ pts, born: 1 + Math.random() * 4 }); }
    },
    backdrop(c, W, H) {
      c.fillStyle = '#010003'; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W / 2, H * 0.48, 10, W / 2, H * 0.48, W * 0.7);
      g.addColorStop(0, 'rgba(70,20,110,0.35)'); g.addColorStop(0.5, 'rgba(25,8,50,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    },
    draw(c, W, H, t, S) {
      const cx = W * 0.5, cy = H * 0.46, U = Math.min(W, H);
      const grow = ease((t - 0.6) / 5.5), det = ease((t - 8.2) / 0.5), after = ease((t - 8.6) / 2.4);

      // stars, gravitationally lensed (pulled toward the core)
      c.save();
      for (const s of stars) {
        let x = s.x * W, y = s.y * H, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) + 1, pull = grow * U * 0.9 / (d * 0.02 + 8);
        x -= dx / d * pull * Math.min(d, 200) * 0.04; y -= dy / d * pull * Math.min(d, 200) * 0.04;
        c.globalAlpha = s.a * (0.5 + 0.5 * Math.sin(t * 1.4 + s.ph)) * (1 - det); c.fillStyle = '#d8d0ff'; c.beginPath(); c.arc(x, y, s.r, 0, 6.28); c.fill();
      }
      c.restore();

      // fractures in space
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
      for (const tr of tears) {
        const p = clamp((t - tr.born) / 1.2, 0, 1) * (1 - det); if (p <= 0) continue;
        const n = Math.max(2, Math.floor(tr.pts.length * p));
        c.strokeStyle = 'rgba(255,60,120,0.5)'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < n; i++) { const q = tr.pts[i]; i ? c.lineTo(q[0] * W - 2, q[1] * H) : c.moveTo(q[0] * W - 2, q[1] * H); } c.stroke();
        c.strokeStyle = 'rgba(60,200,255,0.5)'; c.beginPath(); for (let i = 0; i < n; i++) { const q = tr.pts[i]; i ? c.lineTo(q[0] * W + 2, q[1] * H) : c.moveTo(q[0] * W + 2, q[1] * H); } c.stroke();
        c.strokeStyle = 'rgba(240,220,255,0.7)'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i < n; i++) { const q = tr.pts[i]; i ? c.lineTo(q[0] * W, q[1] * H) : c.moveTo(q[0] * W, q[1] * H); } c.stroke();
      }
      c.restore();

      // accretion disc (back half), then core, then front half → real lensed look
      const coreR = U * (0.012 + 0.07 * grow) * (1 - det);
      if (coreR > 1) {
        disc(c, cx, cy, coreR, t, grow, false);
        c.fillStyle = '#000'; c.beginPath(); c.arc(cx, cy, coreR, 0, 6.28); c.fill();
        // photon ring
        c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = `rgba(210,130,255,${0.22 * grow})`; c.lineWidth = 9;
        c.beginPath(); c.arc(cx, cy, coreR * 1.08, 0, 6.28); c.stroke();
        c.strokeStyle = `rgba(255,230,255,${0.8 * grow})`; c.lineWidth = 2.2;
        c.beginPath(); c.arc(cx, cy, coreR * 1.08, 0, 6.28); c.stroke(); c.restore();
        disc(c, cx, cy, coreR, t, grow, true);
      }

      // debris stretched into streaks as it's pulled in
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const d of debris) {
        const lt = t - d.t0; if (lt < 0) continue;
        const r = Math.max(0.01, d.r * (1 - ease(lt / 8.2) * 0.97)), ang = d.a + lt * d.w * (1 + (0.6 / (r + 0.06)));
        const x = cx + Math.cos(ang) * r * U, y = cy + Math.sin(ang) * r * U * 0.55;
        const sp = (0.6 / (r + 0.06)) * 6, tx = -Math.sin(ang), ty = Math.cos(ang) * 0.55;
        const a = (1 - det) * clamp(r * 5, 0, 1) * 0.8; if (a < 0.02) continue;
        c.strokeStyle = d.hue; c.globalAlpha = a; c.lineWidth = d.s * 0.7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(x - tx * sp * 4, y - ty * sp * 4); c.stroke();
      }
      c.restore();

      // the four fragments on decaying orbits, tidally stretched
      for (const o of orbs) {
        const lt = t - 0.4, k = ease(lt / (o.in + 5.5)), r = o.r * (1 - k * 0.96), ang = o.a + lt * o.w * (1 + k * 4);
        const x = cx + Math.cos(ang) * r * U, y = cy + Math.sin(ang) * r * U * 0.55;
        const a = (1 - ease((t - o.in - 5.6) / 0.8)) * (1 - det); if (a <= 0.01) continue;
        const stretch = 1 + k * 5;
        c.save(); c.translate(x, y); c.rotate(Math.atan2(-Math.cos(ang) * 0.55, -Math.sin(ang)) + Math.PI / 2);
        c.globalCompositeOperation = 'lighter';
        const z = 28 * (1 - k * 0.4); c.globalAlpha = 0.8 * a; c.scale(1, stretch);
        c.drawImage(S.tint('vo-' + o.col, S.spr.white, o.col), -z, -z, z * 2, z * 2);
        c.globalAlpha = a; c.fillStyle = o.col;
        c.beginPath(); c.moveTo(0, -9); c.lineTo(5, 0); c.lineTo(0, 9); c.lineTo(-5, 0); c.closePath(); c.fill();
        c.restore();
      }

      // detonation & the final five-colour fragment
      if (det > 0) {
        c.save(); c.globalCompositeOperation = 'lighter';
        const fl = Math.max(0, 1 - (t - 8.2) * 1.4) * 0.9; if (fl > 0) { c.fillStyle = `rgba(245,230,255,${fl})`; c.fillRect(0, 0, W, H); }
        const rr = (t - 8.2) * W * 0.55; c.strokeStyle = `rgba(230,190,255,${0.7 * Math.max(0, 1 - (t - 8.2) / 1.8)})`; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, rr, 0, 6.28); c.stroke();
        c.restore();
      }
      if (after > 0) fragment(c, cx, cy, U, t, after, S);

      // glitch bands (RGB tear) intensify toward the detonation
      const gi = grow * (1 - det);
      if (gi > 0.1 && Math.random() < 0.1 + gi * 0.25) {
        const y = Math.random() * H, h = 4 + Math.random() * 26, off = (Math.random() - 0.5) * 40 * gi;
        c.save(); c.globalCompositeOperation = 'lighter';
        c.fillStyle = off > 0 ? 'rgba(255,40,120,0.16)' : 'rgba(60,200,255,0.16)'; c.fillRect(Math.max(0, off), y, W, h);
        c.fillStyle = 'rgba(255,40,120,0.08)'; c.fillRect(0, y, W, h); c.restore();
      }
    },
    shake(t) { return (t > 5 && t < 8.2) ? 2 + (t - 5) * 2.2 : (t >= 8.2 && t < 9.4 ? (9.4 - t) * 22 : 0); }
  };

  function disc(c, cx, cy, coreR, t, grow, front) {
    c.save(); c.translate(cx, cy); c.scale(1, 0.28);
    const R0 = coreR * 1.5, R1 = coreR * (3.2 + 1.2 * grow);
    c.beginPath();
    if (front) c.rect(-R1 * 2, 0, R1 * 4, R1 * 4); else c.rect(-R1 * 2, -R1 * 4, R1 * 4, R1 * 4);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    // two gradient layers (visually identical stack, half the gradient work)
    for (let i = 0; i < 4; i += 2) {
      const g = c.createRadialGradient(0, 0, R0 * (1 + i * 0.18), 0, 0, R1 * (0.7 + i * 0.12));
      g.addColorStop(0, `rgba(255,${200 - i * 30},${120 + i * 30},0)`);
      g.addColorStop(0.4, `rgba(255,${160 - i * 25},${90 + i * 40},${0.6 * grow})`);
      g.addColorStop(1, 'rgba(120,40,200,0)');
      c.fillStyle = g; c.rotate(Math.sin(t * 0.5 + i) * 0.04);
      c.beginPath(); c.arc(0, 0, R1 * (0.7 + i * 0.12), 0, 6.28); c.fill();
    }
    // streaming hot arcs
    for (let k = 0; k < 14; k++) {
      const a0 = t * (0.9 + (k % 4) * 0.25) + k * 0.9, rr = R0 + (R1 - R0) * ((k * 0.17) % 1);
      c.strokeStyle = `rgba(255,${190 - (k % 3) * 30},120,${0.28 * grow})`; c.lineWidth = 2.5;
      c.beginPath(); c.arc(0, 0, rr, a0, a0 + 0.8 + (k % 3) * 0.25); c.stroke();
    }
    c.restore();
  }

  function fragment(c, cx, cy, U, t, p, S) {
    const s = U * 0.075 * p;
    c.save(); c.globalCompositeOperation = 'lighter';
    const z = s * 8;
    c.globalAlpha = 0.6 * p; c.drawImage(S.tint('vo-fr', S.spr.soft, '#d9a8ff'), cx - z, cy - z, z * 2, z * 2);
    COLS.forEach((col, i) => { const a = t * 0.7 + (i / 4) * 6.28; c.globalAlpha = 0.5 * p; const zz = s * 3; c.drawImage(S.tint('vo-r' + col, S.spr.soft, col), cx + Math.cos(a) * s * 1.4 - zz, cy + Math.sin(a) * s * 1.4 - zz, zz * 2, zz * 2); });
    c.restore();
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.4) * 0.14);
    const F = [[[0, -s * 1.15], [s * 0.6, -s * 0.3], [0, s * 0.1]], [[0, -s * 1.15], [0, s * 0.1], [-s * 0.6, -s * 0.3]], [[s * 0.6, -s * 0.3], [s * 0.4, s * 0.95], [0, s * 0.1]], [[-s * 0.6, -s * 0.3], [0, s * 0.1], [-s * 0.4, s * 0.95]], [[0, s * 0.1], [s * 0.4, s * 0.95], [-s * 0.4, s * 0.95]]];
    const shade = [1, 0.5, 0.8, 0.35, 0.6];
    F.forEach((f, i) => { const col = COLS[i % 4], k = shade[i]; c.fillStyle = col; c.globalAlpha = 0.55 + 0.4 * k; c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill(); c.fillStyle = `rgba(0,0,0,${0.45 * (1 - k)})`; c.fill(); });
    c.globalAlpha = 1; c.strokeStyle = 'rgba(245,230,255,0.8)'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(0, -s * 1.15); c.lineTo(s * 0.6, -s * 0.3); c.lineTo(s * 0.4, s * 0.95); c.lineTo(-s * 0.4, s * 0.95); c.lineTo(-s * 0.6, -s * 0.3); c.closePath(); c.stroke();
    c.restore();
  }

  window.VoidOutroCutscene = E.create(scene);
})();
