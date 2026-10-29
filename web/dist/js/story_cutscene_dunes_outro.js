// ============================================================
// DUNES OUTRO (Realm 2) — the Pharaoh of Glass SHATTERS.
// A blood-orange sandstorm dusk over a buried city. A towering
// glass sarcophagus-mask hangs in the storm; it fractures with
// bright crack-lines, detonates into razor shards that tumble and
// catch the low sun, sand pours in sheets across the dunes, the
// buried obelisks lurch up through the dust, and a cold wind
// scours everything. Heavy, ancient, dangerous.
// ============================================================
(function () {
  'use strict';
  const E = window.OutroEngine;
  if (!E) return;
  const ease = E.ease, clamp = E.clamp;
  let sand = [], streaks = [], shards = [], obelisks = [], cracks = [], dunes = [], stars = [];

  const scene = {
    id: 'do', accent: '#e8a050', speaker: '#e8b878', text: '#efe0cc',
    init(W, H, S) {
      sand = []; for (let i = 0; i < 260; i++) sand.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, vx: 0.08 + Math.random() * 0.22, vy: (Math.random() - 0.5) * 0.01, a: 0.15 + Math.random() * 0.5, ph: Math.random() * 6.28 });
      streaks = []; for (let i = 0; i < 30; i++) streaks.push({ x: Math.random(), y: 0.2 + Math.random() * 0.75, len: 0.08 + Math.random() * 0.25, vx: 0.25 + Math.random() * 0.4, a: 0.05 + Math.random() * 0.12 });
      shards = [];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * 6.28, sp = 0.15 + Math.random() * 0.9;
        shards.push({ a, sp, s: 6 + Math.random() * 28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 7, tilt: Math.random() * 6.28, born: 2.0 });
      }
      obelisks = []; for (let i = 0; i < 9; i++) obelisks.push({ x: 0.06 + (i / 8) * 0.88 + (Math.random() - 0.5) * 0.03, h: 0.1 + Math.random() * 0.2, w: 0.012 + Math.random() * 0.016, delay: 2.5 + i * 0.25 + Math.random() * 0.5, tilt: (Math.random() - 0.5) * 0.15 });
      cracks = []; for (let i = 0; i < 12; i++) {
        const pts = [[0, 0]]; let a = (i / 12) * 6.28 + (Math.random() - 0.5) * 0.3, x = 0, y = 0;
        for (let k = 0; k < 8; k++) { a += (Math.random() - 0.5) * 0.6; x += Math.cos(a) * 0.1; y += Math.sin(a) * 0.1; pts.push([x, y]); }
        cracks.push({ pts, born: 0.6 + Math.random() * 1.3 });
      }
      dunes = []; stars = [];
    },
    backdrop(c, W, H) {
      let g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0c0610'); g.addColorStop(0.35, '#2a1018'); g.addColorStop(0.58, '#7a3418'); g.addColorStop(0.72, '#c0662a'); g.addColorStop(1, '#2a1208');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // low swollen sun, half-buried in dust
      const sx = W * 0.5, sy = H * 0.6, sr = Math.min(W, H) * 0.2;
      g = c.createRadialGradient(sx, sy, 4, sx, sy, sr * 3.2);
      g.addColorStop(0, 'rgba(255,200,120,0.95)'); g.addColorStop(0.15, 'rgba(255,150,70,0.6)'); g.addColorStop(0.5, 'rgba(200,80,30,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // layered dunes with sharp wind-carved crests
      const cols = ['#5a2410', '#3c1608', '#220c04', '#0e0402'];
      for (let l = 0; l < 4; l++) {
        c.fillStyle = cols[l]; c.beginPath(); const by = H * (0.64 + l * 0.07); c.moveTo(0, H);
        for (let x = 0; x <= W + 20; x += 14) {
          const crest = Math.pow(Math.abs(Math.sin(x * 0.0045 + l * 2.2)), 0.7) * H * (0.07 - l * 0.012) + Math.sin(x * 0.02 + l) * 3;
          c.lineTo(x, by - crest);
        }
        c.lineTo(W, H); c.closePath(); c.fill();
        // rim-light on the sun-facing slope
        c.strokeStyle = `rgba(255,170,90,${0.22 - l * 0.05})`; c.lineWidth = 1.6; c.beginPath();
        for (let x = 0; x <= W + 20; x += 14) { const crest = Math.pow(Math.abs(Math.sin(x * 0.0045 + l * 2.2)), 0.7) * H * (0.07 - l * 0.012) + Math.sin(x * 0.02 + l) * 3; x ? c.lineTo(x, by - crest) : c.moveTo(x, by - crest); }
        c.stroke();
      }
    },
    draw(c, W, H, t, S) {
      const cx = W * 0.5, cy = H * 0.38, R = Math.min(W, H) * 0.17;
      const shatter = ease((t - 2.0) / 0.25);          // detonation moment at t=2.0
      const storm = 0.5 + 0.5 * ease((t - 2) / 2);

      // buried obelisks lurching up through the dust
      for (const o of obelisks) {
        const rise = ease((t - o.delay) / 2.2); if (rise <= 0) continue;
        const ox = o.x * W, oh = o.h * H * rise, ow = o.w * W, by = H * 0.72;
        c.save(); c.translate(ox, by); c.rotate(o.tilt * (1 - rise * 0.6));
        const g = c.createLinearGradient(-ow, 0, ow, 0);
        g.addColorStop(0, '#1a0a05'); g.addColorStop(0.55, '#4a2410'); g.addColorStop(1, '#8a4818');
        c.fillStyle = g; c.beginPath(); c.moveTo(-ow, 0); c.lineTo(-ow * 0.7, -oh); c.lineTo(0, -oh - ow * 1.2); c.lineTo(ow * 0.7, -oh); c.lineTo(ow, 0); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1;
        for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(-ow * 0.6, -oh * k / 6); c.lineTo(ow * 0.6, -oh * k / 6); c.stroke(); }
        c.restore();
      }

      // the glass mask: intact, cracking, then gone
      if (t < 2.05) {
        c.save(); c.translate(cx, cy);
        const tremble = (t > 0.6 ? Math.sin(t * 60) * (t - 0.6) * 1.6 : 0);
        c.translate(tremble, 0);
        // inner light behind the glass
        c.globalCompositeOperation = 'lighter';
        const ig = c.createRadialGradient(0, 0, 4, 0, 0, R * 1.8);
        ig.addColorStop(0, `rgba(255,210,140,${0.45 + 0.35 * clamp(t / 2, 0, 1)})`); ig.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = ig; c.fillRect(-R * 2, -R * 2, R * 4, R * 4);
        c.globalCompositeOperation = 'source-over';
        // mask body: elongated tapering face in smoked amber glass
        const g = c.createLinearGradient(-R, -R, R, R);
        g.addColorStop(0, 'rgba(255,215,150,0.85)'); g.addColorStop(0.45, 'rgba(180,90,40,0.8)'); g.addColorStop(1, 'rgba(50,16,8,0.92)');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, -R * 1.25); c.bezierCurveTo(R * 0.95, -R * 1.0, R * 0.95, R * 0.4, R * 0.3, R * 1.3); c.lineTo(-R * 0.3, R * 1.3);
        c.bezierCurveTo(-R * 0.95, R * 0.4, -R * 0.95, -R * 1.0, 0, -R * 1.25); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,230,180,0.7)'; c.lineWidth = 1.6; c.stroke();
        // eye slits & brow
        c.fillStyle = 'rgba(20,6,2,0.95)';
        c.beginPath(); c.moveTo(-R * 0.55, -R * 0.2); c.lineTo(-R * 0.12, -R * 0.1); c.lineTo(-R * 0.5, R * 0.05); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(R * 0.55, -R * 0.2); c.lineTo(R * 0.12, -R * 0.1); c.lineTo(R * 0.5, R * 0.05); c.closePath(); c.fill();
        // fracture lines racing across the glass, bright as they open
        c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round';
        for (const cr of cracks) {
          const p = clamp((t - cr.born) / 0.9, 0, 1); if (p <= 0) continue;
          const n = Math.max(2, Math.floor(cr.pts.length * p));
          const fa = 0.55 + 0.45 * Math.sin(t * 20);
          c.beginPath(); for (let i = 0; i < n; i++) { const q = cr.pts[i]; i ? c.lineTo(q[0] * R * 2, q[1] * R * 2) : c.moveTo(q[0] * R * 2, q[1] * R * 2); }
          c.strokeStyle = `rgba(255,190,110,${fa * 0.2})`; c.lineWidth = 6; c.stroke();
          c.strokeStyle = `rgba(255,235,190,${fa})`; c.lineWidth = 1.8; c.stroke();
        }
        c.restore();
      }

      // detonation: white flash + shockwave ring + razor shards
      if (t >= 2.0) {
        const lt = t - 2.0;
        c.save(); c.globalCompositeOperation = 'lighter';
        const fl = Math.max(0, 1 - lt * 2.2); if (fl > 0) { c.fillStyle = `rgba(255,225,170,${0.7 * fl})`; c.fillRect(0, 0, W, H); }
        const ringR = lt * W * 0.65;
        c.strokeStyle = `rgba(255,200,130,${0.7 * Math.max(0, 1 - lt / 1.6)})`; c.lineWidth = 8 * Math.max(0.1, 1 - lt / 1.6);
        c.beginPath(); c.arc(cx, cy, ringR, 0, 6.28); c.stroke();
        c.restore();
        c.save();
        for (const s of shards) {
          const d = s.sp * W * 0.55 * Math.pow(Math.min(lt, 3), 0.7), grav = lt * lt * 38;
          const x = cx + Math.cos(s.a) * d, y = cy + Math.sin(s.a) * d * 0.8 + grav;
          if (y > H * 0.78) continue;
          const flick = 0.5 + 0.5 * Math.sin(lt * 9 + s.rot * 3);
          c.save(); c.translate(x, y); c.rotate(s.rot + lt * s.vr); c.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(s.tilt + lt * 2)));
          c.fillStyle = `rgba(${Math.floor(200 + 55 * flick)},${Math.floor(120 + 90 * flick)},${Math.floor(50 + 70 * flick)},0.92)`;
          c.strokeStyle = 'rgba(255,240,200,0.8)'; c.lineWidth = 1;
          c.beginPath(); c.moveTo(0, -s.s); c.lineTo(s.s * 0.3, s.s * 0.2); c.lineTo(-s.s * 0.18, s.s); c.closePath(); c.fill(); c.stroke();
          c.restore();
        }
        c.restore();
      }

      // sheets of sand on the wind + streaks
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const s of streaks) {
        s.x += s.vx * 0.016 * storm; if (s.x > 1.3) s.x = -0.3;
        c.strokeStyle = `rgba(255,170,100,${s.a * storm * 0.6})`; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x * W, s.y * H); c.lineTo((s.x - s.len) * W, s.y * H + 6); c.stroke();
      }
      c.restore();
      c.save();
      for (const p of sand) {
        p.x += p.vx * 0.016 * storm; p.y += p.vy * 0.016; p.ph += 0.05;
        if (p.x > 1.02) { p.x = -0.02; p.y = Math.random(); }
        c.globalAlpha = p.a * storm * (0.5 + 0.5 * Math.sin(p.ph)); c.fillStyle = '#e8a868';
        c.beginPath(); c.arc(p.x * W, p.y * H, p.r, 0, 6.28); c.fill();
      }
      c.restore();
      // thick dust bank rolling over the ground
      c.save();
      for (let i = 0; i < 8; i++) {
        const x = ((t * 0.04 + i * 0.17) % 1.4 - 0.2) * W, sz = Math.min(W, H) * (0.8 + (i % 3) * 0.3);
        c.globalAlpha = 0.28 * storm; c.drawImage(S.tint('do-d', S.spr.smoke, '#b06a38'), x - sz / 2, H * 0.62 - sz * 0.3, sz, sz * 0.7);
      }
      c.restore();

      drawFragment(c, W, H, t, S);
    },
    shake(t) { return (t >= 2 && t < 3.2) ? (3.2 - t) * 18 : (t > 0.6 && t < 2 ? (t - 0.6) * 2 : 0); }
  };

  function drawFragment(c, W, H, t, S) {
    const form = ease((t - 4.5) / 2.4); if (form <= 0) return;
    const cx = W * 0.5, cy = H * 0.42 + Math.sin(t * 0.8) * 5, s = Math.min(W, H) * 0.06 * form;
    c.save(); c.globalCompositeOperation = 'lighter';
    const z = s * 7; c.globalAlpha = 0.6 * form; c.drawImage(S.tint('do-fr', S.spr.soft, '#ffb860'), cx - z, cy - z, z * 2, z * 2); c.restore();
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.4) * 0.14);
    const F = [[[0, -s * 1.15], [s * 0.6, -s * 0.3], [0, s * 0.1], 1], [[0, -s * 1.15], [0, s * 0.1], [-s * 0.6, -s * 0.3], 0.5], [[s * 0.6, -s * 0.3], [s * 0.4, s * 0.95], [0, s * 0.1], 0.8], [[-s * 0.6, -s * 0.3], [0, s * 0.1], [-s * 0.4, s * 0.95], 0.3], [[0, s * 0.1], [s * 0.4, s * 0.95], [-s * 0.4, s * 0.95], 0.6]];
    for (const f of F) { const k = f[3]; c.fillStyle = `rgba(${Math.floor(110 + 145 * k)},${Math.floor(60 + 140 * k)},${Math.floor(20 + 70 * k)},0.96)`; c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill(); }
    c.strokeStyle = 'rgba(255,230,170,0.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -s * 1.15); c.lineTo(s * 0.6, -s * 0.3); c.lineTo(s * 0.4, s * 0.95); c.lineTo(-s * 0.4, s * 0.95); c.lineTo(-s * 0.6, -s * 0.3); c.closePath(); c.stroke();
    c.restore();
  }

  window.DunesOutroCutscene = E.create(scene);
})();
