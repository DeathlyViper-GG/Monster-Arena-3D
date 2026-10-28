// ============================================================
// GLACIAL OUTRO (Realm 3) — the Archive CRACKS and drowns in dark.
// A vast black ice cavern lit only by a dying aurora. The frozen
// monolith holding the Oracle's memory splits with deep structural
// cracks (branching fracture lines with refracted blue light),
// ice shards fall and shatter into snow-bursts, frozen memories
// escape as pale spectral wisps, and breath-fog rolls across the
// floor. Cold, hushed, ominous.
// ============================================================
(function () {
  'use strict';
  const E = window.OutroEngine;
  if (!E) return;
  const ease = E.ease, clamp = E.clamp;
  let cracks = [], shards = [], wisps = [], snow = [], fog = [], bursts = [], lastBurst = 0;

  function branch(x, y, ang, len, depth, out) {
    const pts = [[x, y]]; let px = x, py = y, a = ang;
    const n = 7 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      a += (Math.random() - 0.5) * 0.7; px += Math.cos(a) * len / n; py += Math.sin(a) * len / n; pts.push([px, py]);
      if (depth < 3 && Math.random() < 0.35) branch(px, py, a + (Math.random() < 0.5 ? 0.8 : -0.8), len * 0.5, depth + 1, out);
    }
    out.push({ pts, depth });
  }

  const scene = {
    id: 'go', accent: '#8fd0ff', speaker: '#9fc8e8', text: '#dce8f2',
    init(W, H, S) {
      cracks = []; const cx = 0.5, cy = 0.46;
      for (let i = 0; i < 6; i++) branch(cx, cy, -Math.PI / 2 + (i - 2.5) * 0.9 + (Math.random() - 0.5) * 0.3, 0.34, 0, cracks);
      cracks.forEach((c, i) => c.born = 0.8 + Math.random() * 2.2);
      shards = []; for (let i = 0; i < 46; i++) shards.push({ x: 0.3 + Math.random() * 0.4, y: -0.1 - Math.random() * 0.3, vy: 0.2 + Math.random() * 0.4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4, s: 8 + Math.random() * 26, t0: 2.0 + Math.random() * 5, hit: false });
      wisps = []; for (let i = 0; i < 18; i++) wisps.push({ a: Math.random() * 6.28, d: 0.02 + Math.random() * 0.06, t0: 2.5 + Math.random() * 4, sp: 0.4 + Math.random() * 0.6, ph: Math.random() * 6.28, len: 18 + Math.random() * 30 });
      snow = []; for (let i = 0; i < 160; i++) snow.push({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.8, vy: 0.02 + Math.random() * 0.05, vx: -0.004 - Math.random() * 0.008, ph: Math.random() * 6.28, a: 0.2 + Math.random() * 0.6 });
      fog = []; for (let i = 0; i < 24; i++) fog.push({ x: Math.random(), y: 0.74 + Math.random() * 0.2, sz: 0.3 + Math.random() * 0.4, vx: 0.004 + Math.random() * 0.006, rot: Math.random() * 6.28, a: 0.2 + Math.random() * 0.3 });
      bursts = []; lastBurst = 0;
    },
    backdrop(c, W, H) {
      let g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#01040a'); g.addColorStop(0.5, '#05101c'); g.addColorStop(0.8, '#0a2234'); g.addColorStop(1, '#02070d');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // ice pillars & icicles
      c.fillStyle = '#030a12';
      for (let i = 0; i < 22; i++) {
        const sx = (i + Math.random() * 0.7) / 22 * W, len = H * (0.06 + Math.random() * 0.3), wd = 10 + Math.random() * 38;
        c.beginPath(); c.moveTo(sx - wd, -4); c.lineTo(sx + wd, -4); c.lineTo(sx + (Math.random() - 0.5) * 10, len); c.closePath(); c.fill();
      }
      // far ice walls with faceted highlights
      for (let layer = 0; layer < 2; layer++) {
        c.fillStyle = layer ? '#06121e' : '#0a1c2c'; c.beginPath(); c.moveTo(0, H * 0.74);
        for (let x = 0; x <= W + 30; x += 26) c.lineTo(x, H * 0.74 - (Math.sin(x * 0.009 + layer * 4) * 0.5 + 0.5) * H * (0.22 - layer * 0.07) - Math.random() * 10);
        c.lineTo(W, H * 0.74); c.closePath(); c.fill();
      }
      // frozen floor with faint reflection sheen
      g = c.createLinearGradient(0, H * 0.74, 0, H); g.addColorStop(0, '#0d2a40'); g.addColorStop(1, '#03090f');
      c.fillStyle = g; c.fillRect(0, H * 0.74, W, H * 0.26);
    },
    draw(c, W, H, t, S) {
      const aur = 1 - ease((t - 5.5) / 5.0) * 0.8;      // aurora dying
      // dying aurora curtains
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const y0 = H * (0.12 + k * 0.06);
        const g = c.createLinearGradient(0, y0 - 70, 0, y0 + 110);
        g.addColorStop(0, 'rgba(60,200,180,0)'); g.addColorStop(0.5, `rgba(${60 + k * 30},${190 - k * 20},${200 + k * 12},${0.17 * aur})`); g.addColorStop(1, 'rgba(60,120,220,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, y0);
        for (let x = 0; x <= W; x += 40) c.lineTo(x, y0 + Math.sin(x * 0.006 + t * 0.35 + k * 1.7) * 38 + Math.sin(x * 0.017 + t * 0.7) * 11);
        c.lineTo(W, y0 + 160); c.lineTo(0, y0 + 160); c.closePath(); c.fill();
      }
      c.restore();

      const mono = { x: W * 0.5, y: H * 0.46, w: Math.min(W, H) * 0.2, h: Math.min(W, H) * 0.46 };
      drawMonolith(c, W, H, t, mono, S);

      // falling shards that shatter into snow-bursts
      const hy = H * 0.76;
      for (const s of shards) {
        const lt = t - s.t0; if (lt < 0 || s.hit) continue;
        const y = (s.y + s.vy * lt * lt * 0.9) * H, x = s.x * W + Math.sin(lt * 2 + s.rot) * 6;
        if (y >= hy) { s.hit = true; for (let i = 0; i < 12; i++) bursts.push({ x, y: hy, vx: (Math.random() - 0.5) * 240, vy: -60 - Math.random() * 200, life: 0.7 + Math.random() * 0.9, age: 0, r: 1 + Math.random() * 2.4 }); continue; }
        c.save(); c.translate(x, y); c.rotate(s.rot + lt * s.vr);
        const g = c.createLinearGradient(-s.s * 0.3, -s.s, s.s * 0.3, s.s);
        g.addColorStop(0, 'rgba(200,235,255,0.95)'); g.addColorStop(0.5, 'rgba(70,140,200,0.85)'); g.addColorStop(1, 'rgba(10,30,60,0.9)');
        c.fillStyle = g; c.strokeStyle = 'rgba(220,245,255,0.7)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(0, -s.s); c.lineTo(s.s * 0.35, 0); c.lineTo(0, s.s); c.lineTo(-s.s * 0.35, 0); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.age += 1 / 60; if (b.age > b.life) { bursts.splice(i, 1); continue; }
        b.vy += 420 / 60; b.x += b.vx / 60; b.y += b.vy / 60;
        c.globalAlpha = 1 - b.age / b.life; const z = b.r * 3;
        c.drawImage(S.tint('go-b', S.spr.white, '#cfeaff'), b.x - z, b.y - z, z * 2, z * 2);
      }
      c.restore();

      // spectral memory wisps rising out of the monolith
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const w of wisps) {
        const lt = t - w.t0; if (lt < 0) continue;
        const rise = lt * w.sp * 60, a = ease(lt / 1.2) * (1 - ease((lt - 3) / 3));
        if (a < 0.02) continue;
        const bx = mono.x + Math.cos(w.a) * W * w.d, by = mono.y - rise;
        c.beginPath(); c.moveTo(bx, by);
        for (let k = 1; k <= 8; k++) c.lineTo(bx + Math.sin(lt * 2 + w.ph + k * 0.8) * 10 * k * 0.3, by + k * w.len / 8);
        c.strokeStyle = `rgba(150,210,255,${0.14 * a})`; c.lineWidth = 7; c.stroke();
        c.strokeStyle = `rgba(190,230,255,${0.5 * a})`; c.lineWidth = 2; c.stroke();
        const z = 16; c.globalAlpha = a * 0.7; c.drawImage(S.tint('go-w', S.spr.white, '#bfe6ff'), bx - z, by - z, z * 2, z * 2); c.globalAlpha = 1;
      }
      c.restore();

      // ground fog
      c.save();
      for (const f of fog) {
        f.x += f.vx * 0.016; if (f.x > 1.3) f.x = -0.3;
        const sz = f.sz * Math.min(W, H) * 1.6; c.globalAlpha = f.a * 0.6;
        c.save(); c.translate(f.x * W, f.y * H); c.rotate(f.rot);
        c.drawImage(S.tint('go-f', S.spr.smoke, '#9cc8e8'), -sz / 2, -sz / 2, sz, sz); c.restore();
      }
      c.restore();
      // snow
      c.save();
      for (const s of snow) {
        s.y += s.vy * 0.016; s.x += s.vx * 0.016 + Math.sin(t * 0.5 + s.ph) * 0.0004;
        if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); } if (s.x < -0.02) s.x = 1.02;
        c.globalAlpha = s.a * 0.7; c.fillStyle = '#dff0ff'; c.beginPath(); c.arc(s.x * W, s.y * H, s.r, 0, 6.28); c.fill();
      }
      c.restore();

      drawFragment(c, W, H, t, S);
    },
    shake(t) { return (t > 1.0 && t < 4.5) ? 2.5 + Math.sin(t * 30) * 1.5 : 0; }
  };

  function drawMonolith(c, W, H, t, m, S) {
    const crackA = ease((t - 0.8) / 3.0), melt = ease((t - 4.5) / 5.0), x0 = m.x - m.w / 2, y0 = m.y - m.h / 2;
    c.save();
    // body: layered translucent ice w/ internal light
    const g = c.createLinearGradient(x0, y0, x0 + m.w, y0 + m.h);
    g.addColorStop(0, `rgba(80,150,200,${0.9 - melt * 0.35})`); g.addColorStop(0.5, `rgba(20,60,100,${0.92 - melt * 0.4})`); g.addColorStop(1, `rgba(6,20,40,${0.95 - melt * 0.4})`);
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x0 + m.w * 0.18, y0); c.lineTo(x0 + m.w * 0.82, y0 + m.h * 0.04); c.lineTo(x0 + m.w, y0 + m.h); c.lineTo(x0, y0 + m.h); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(180,225,255,0.55)'; c.lineWidth = 1.5; c.stroke();
    // internal light of the sealed memory (pulsing, then flickering out)
    c.globalCompositeOperation = 'lighter';
    const core = (0.6 + 0.4 * Math.sin(t * 2.2)) * (1 - melt * 0.8) * (1 - 0.3 * crackA * Math.sin(t * 17));
    const cg = c.createRadialGradient(m.x, m.y, 4, m.x, m.y, m.w * 1.1);
    cg.addColorStop(0, `rgba(180,230,255,${0.6 * core})`); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.fillRect(x0 - m.w, y0, m.w * 3, m.h);
    // fractures: branching lines w/ refracted light
    c.lineJoin = 'round';
    for (const cr of cracks) {
      const p = clamp((t - cr.born) / 1.4, 0, 1); if (p <= 0) continue;
      const n = Math.max(2, Math.floor(cr.pts.length * p));
      const lw = Math.max(0.8, 3 - cr.depth * 0.8);
      c.beginPath(); for (let i = 0; i < n; i++) { const q = cr.pts[i]; i ? c.lineTo(q[0] * W, q[1] * H) : c.moveTo(q[0] * W, q[1] * H); }
      c.globalAlpha = 0.22; c.strokeStyle = 'rgba(150,215,255,1)'; c.lineWidth = lw + 5; c.stroke();
      c.globalAlpha = 0.9; c.strokeStyle = 'rgba(210,240,255,0.85)'; c.lineWidth = lw; c.stroke();
    }
    c.restore();
  }

  function drawFragment(c, W, H, t, S) {
    const form = ease((t - 5.0) / 2.4); if (form <= 0) return;
    const cx = W * 0.5, cy = H * 0.4 + Math.sin(t * 0.8) * 5, s = Math.min(W, H) * 0.06 * form;
    c.save(); c.globalCompositeOperation = 'lighter';
    const z = s * 7; c.globalAlpha = 0.55 * form; c.drawImage(S.tint('go-fr', S.spr.soft, '#8fd0ff'), cx - z, cy - z, z * 2, z * 2); c.restore();
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.4) * 0.14);
    const F = [[[0, -s * 1.15], [s * 0.6, -s * 0.3], [0, s * 0.1], 1], [[0, -s * 1.15], [0, s * 0.1], [-s * 0.6, -s * 0.3], 0.5], [[s * 0.6, -s * 0.3], [s * 0.4, s * 0.95], [0, s * 0.1], 0.8], [[-s * 0.6, -s * 0.3], [0, s * 0.1], [-s * 0.4, s * 0.95], 0.3], [[0, s * 0.1], [s * 0.4, s * 0.95], [-s * 0.4, s * 0.95], 0.6]];
    for (const f of F) { const k = f[3]; c.fillStyle = `rgba(${Math.floor(40 + 140 * k)},${Math.floor(90 + 140 * k)},${Math.floor(140 + 110 * k)},0.96)`; c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(220,245,255,0.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -s * 1.15); c.lineTo(s * 0.6, -s * 0.3); c.lineTo(s * 0.4, s * 0.95); c.lineTo(-s * 0.4, s * 0.95); c.lineTo(-s * 0.6, -s * 0.3); c.closePath(); c.stroke();
    c.restore();
  }

  window.GlacialOutroCutscene = E.create(scene);
})();
