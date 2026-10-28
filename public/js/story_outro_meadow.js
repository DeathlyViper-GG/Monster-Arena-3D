// ============================================================
// MEADOW OUTRO (Realm 1) — the Hearth Warden's roots DIE.
// A dim, mist-choked grove at pre-dawn. Huge gnarled roots with
// bark texture and glowing sap-veins writhe, then seize, blacken
// and wither as the life is drawn out of them; the heartwood seal
// splits with a deep shudder, spore-clouds and dead leaves fall,
// and the fragment rises out of the rot as the first cold light
// cuts through the canopy. Serious, mournful, visceral.
// ============================================================
(function () {
  'use strict';
  const E = window.OutroEngine;
  if (!E) return;
  const ease = E.ease, clamp = E.clamp;
  let roots = [], leaves = [], spores = [], mist = [], bark = null, barkPat = null, barkCtx = null;

  function makeBark() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#1a1208'; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      x.strokeStyle = `rgba(${10 + Math.random() * 50},${8 + Math.random() * 30},4,${0.2 + Math.random() * 0.5})`;
      x.lineWidth = 1 + Math.random() * 2;
      const px = Math.random() * 128, py = Math.random() * 128;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 10, py + 18 + Math.random() * 40); x.stroke();
    }
    return c;
  }

  const scene = {
    id: 'mo', accent: '#9ccf6a', speaker: '#b6d890', text: '#dfe8d4',
    init(W, H, S) {
      bark = makeBark();
      roots = [];
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? 1 : -1;
        roots.push({ x: 0.5 + side * (0.1 + (i >> 1) * 0.11 + Math.random() * 0.03), th: 26 + Math.random() * 30 - (i >> 1) * 3, ph: Math.random() * 6.28, die: 1.0 + i * 0.22, side, len: 0.42 + Math.random() * 0.2 });
      }
      leaves = []; for (let i = 0; i < 70; i++) leaves.push({ x: Math.random(), y: Math.random() * 0.8, r: 3 + Math.random() * 5, vy: 0.03 + Math.random() * 0.05, ph: Math.random() * 6.28, rot: Math.random() * 6.28 });
      spores = []; for (let i = 0; i < 90; i++) spores.push({ x: Math.random(), y: 0.55 + Math.random() * 0.45, s: 2 + Math.random() * 5, vy: 0.02 + Math.random() * 0.05, ph: Math.random() * 6.28, a: 0.3 + Math.random() * 0.6 });
      mist = []; for (let i = 0; i < 22; i++) mist.push({ x: Math.random(), y: 0.6 + Math.random() * 0.35, sz: 0.3 + Math.random() * 0.4, vx: (Math.random() - 0.5) * 0.006, rot: Math.random() * 6.28, a: 0.25 + Math.random() * 0.35 });
    },
    backdrop(c, W, H) {
      let g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#030806'); g.addColorStop(0.5, '#0a1610'); g.addColorStop(0.75, '#14241a'); g.addColorStop(1, '#050a06');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // distant trunks, layered with fog
      for (let layer = 0; layer < 3; layer++) {
        const n = 9 + layer * 4, col = ['#0b1a12', '#08120c', '#040a06'][layer];
        for (let i = 0; i < n; i++) {
          const x = (i + 0.3 + Math.random() * 0.4) / n * W, w = (14 + Math.random() * 22) * (1 + layer * 0.9);
          c.fillStyle = col; c.fillRect(x - w / 2, 0, w, H * 0.8);
        }
        const f = c.createLinearGradient(0, 0, 0, H);
        f.addColorStop(0, 'rgba(60,90,70,0)'); f.addColorStop(0.7, `rgba(60,90,70,${0.12 - layer * 0.03})`); f.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = f; c.fillRect(0, 0, W, H);
      }
      // canopy shadow
      for (let i = 0; i < 40; i++) {
        c.fillStyle = 'rgba(2,6,3,0.55)'; c.beginPath();
        c.ellipse(Math.random() * W, Math.random() * H * 0.18, 60 + Math.random() * 120, 30 + Math.random() * 50, 0, 0, 6.28); c.fill();
      }
      // forest floor
      g = c.createLinearGradient(0, H * 0.72, 0, H); g.addColorStop(0, '#0c1a10'); g.addColorStop(1, '#020503');
      c.fillStyle = g; c.fillRect(0, H * 0.72, W, H * 0.28);
    },
    draw(c, W, H, t, S) {
      const gy = H * 0.74;
      const life = 1 - ease((t - 0.8) / 6.5);           // life draining out of the roots
      const dawn = ease((t - 4.5) / 4.0);               // cold first light
      // cold dawn shafts through the canopy
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const bx = W * (0.15 + i * 0.15) + Math.sin(t * 0.2 + i) * 20, wd = 40 + i % 3 * 30;
        c.fillStyle = `rgba(190,215,200,${0.07 * dawn})`; c.beginPath(); c.moveTo(bx - wd, 0); c.lineTo(bx + wd, 0); c.lineTo(bx - 120 + wd * 2, gy); c.lineTo(bx - 120 - wd, gy); c.closePath(); c.fill();
      }
      c.restore();

      // heartwood seal at the centre (splits)
      drawSeal(c, W, H, t, life);
      // roots
      for (const r of roots) drawRoot(c, W, H, t, r, gy, life);

      // mist
      c.save();
      for (const m of mist) {
        m.x += m.vx * 0.016; if (m.x < -0.3) m.x = 1.3; if (m.x > 1.3) m.x = -0.3;
        const sz = m.sz * Math.min(W, H) * 1.5;
        c.globalAlpha = m.a * 0.55; c.save(); c.translate(m.x * W, m.y * H); c.rotate(m.rot + t * 0.02);
        c.drawImage(S.tint('mo-mist', S.spr.smoke, '#a8c8b0'), -sz / 2, -sz / 2, sz, sz); c.restore();
      }
      c.restore();

      // falling dead leaves
      c.save();
      for (const l of leaves) {
        l.y += l.vy * 0.016; l.x += Math.sin(t * 0.8 + l.ph) * 0.0006; l.rot += 0.01;
        if (l.y > 1.03) { l.y = -0.03; l.x = Math.random(); }
        c.save(); c.translate(l.x * W, l.y * H); c.rotate(l.rot);
        c.globalAlpha = 0.65; c.fillStyle = (l.ph > 3.1) ? '#4a3a14' : '#2a3a14';
        c.beginPath(); c.ellipse(0, 0, l.r, l.r * 0.45, 0, 0, 6.28); c.fill(); c.restore();
      }
      c.restore();

      // glowing spore-cloud released from the broken seal
      c.save(); c.globalCompositeOperation = 'lighter';
      const rel = ease((t - 2.4) / 1.2) * (1 - ease((t - 7) / 4));
      for (const s of spores) {
        s.y -= s.vy * 0.016; s.ph += 0.03;
        if (s.y < -0.05) { s.y = 0.75 + Math.random() * 0.25; }
        const a = s.a * rel * (0.5 + 0.5 * Math.sin(s.ph));
        if (a < 0.02) continue;
        c.globalAlpha = a; const z = s.s * 2.4;
        c.drawImage(S.tint('mo-sp', S.spr.white, '#a8e870'), (0.5 + (s.x - 0.5) * 0.7) * W - z, s.y * H - z, z * 2, z * 2);
      }
      c.restore();

      // the fragment rises from the rot
      drawFragment(c, W, H, t, S);
    },
    shake(t) { return (t > 2.3 && t < 3.0) ? (3.0 - t) * 14 : 0; }
  };

  function drawRoot(c, W, H, t, r, gy, life) {
    const dying = E.ease((t - r.die) / 2.2);                 // seizes, then goes dead
    const write = Math.sin(t * 1.4 + r.ph) * (1 - dying) * 0.35 + (dying * (1 - dying)) * Math.sin(t * 22) * 0.1;
    const retreat = ease((t - r.die - 1.2) / 3.5) * 0.45;    // slumps back into the ground
    const x0 = r.x * W, segs = 18, len = H * r.len * (1 - retreat);
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const bend = Math.sin(f * 3.1 + r.ph + t * 0.9 * (1 - dying)) * 28 * f * (1 - dying * 0.7) + r.side * f * f * 70;
      pts.push([x0 + bend + write * f * 90, gy - Math.sin(f * 1.5) * len * (0.9 - 0.4 * dying) + f * f * len * 0.5 * dying]);
    }
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // body: thick, tapering, bark-textured
    if (!barkPat || barkCtx !== c) { barkPat = c.createPattern(bark, 'repeat'); barkCtx = c; }
    c.strokeStyle = barkPat;
    for (let i = 0; i < segs; i++) {
      const f = i / segs, th = r.th * (1 - f * 0.88);
      c.lineWidth = th;
      c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke();
    }
    // shadowed underside
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = r.th * 0.3;
    c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] + 3, p[1] + 3) : c.moveTo(p[0] + 3, p[1] + 3)); c.stroke();
    // living sap-veins glow, draining to nothing
    if (life > 0.02) {
      c.globalCompositeOperation = 'lighter';
      // soft halo pass replaces shadowBlur (same glow, far cheaper)
      const sa = 0.65 * life * (0.7 + 0.3 * Math.sin(t * 5 + r.ph));
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      c.strokeStyle = `rgba(120,220,80,${sa * 0.28})`; c.lineWidth = 6; c.stroke();
      c.strokeStyle = `rgba(150,240,100,${sa})`; c.lineWidth = 2.2; c.stroke();
    }
    c.restore();
    // wilted tendril tips
    const tip = pts[pts.length - 1];
    c.save(); c.strokeStyle = '#120c06'; c.lineWidth = 3; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      c.beginPath(); c.moveTo(tip[0], tip[1]);
      c.quadraticCurveTo(tip[0] + (k - 1) * 20, tip[1] - 16 + dying * 20, tip[0] + (k - 1) * 34, tip[1] + 6 + dying * 22); c.stroke();
    }
    c.restore();
  }

  function drawSeal(c, W, H, t, life) {
    const cx = W * 0.5, cy = H * 0.5, R = Math.min(W, H) * 0.17;
    const split = ease((t - 2.2) / 0.6), open = ease((t - 2.4) / 3.0);
    c.save(); c.translate(cx, cy);
    // dark heartwood disc with rings
    const g = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#2a1c0e'); g.addColorStop(0.7, '#150d06'); g.addColorStop(1, '#070402');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, 6.28); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1.5;
    for (let i = 1; i < 7; i++) { c.beginPath(); c.arc(0, 0, R * i / 7, 0, 6.28); c.stroke(); }
    // green life-glow in the grain, fading
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = `rgba(140,230,90,${0.16 * life})`; c.lineWidth = 7;
    c.beginPath(); c.arc(0, 0, R * 0.92, 0, 6.28); c.stroke();
    c.strokeStyle = `rgba(140,230,90,${0.55 * life})`; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, R * 0.92, 0, 6.28); c.stroke();
    // the split: a jagged fissure with a pulsing pale light in it
    if (split > 0) {
      const gap = open * R * 0.22;
      c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
      c.fillStyle = '#020101'; c.beginPath();
      c.moveTo(0, -R); for (let i = 1; i <= 10; i++) c.lineTo((i % 2 ? gap : -gap) + (Math.sin(i * 2.7) * R * 0.05), -R + (i / 10) * R * 2 * split);
      for (let i = 10; i >= 1; i--) c.lineTo((i % 2 ? -gap : gap) * 0.6 - gap * 0.5, -R + (i / 10) * R * 2 * split);
      c.closePath(); c.fill();
      c.globalCompositeOperation = 'lighter';
      const lg = c.createLinearGradient(-gap * 2, 0, gap * 2, 0);
      lg.addColorStop(0, 'rgba(210,230,200,0)'); lg.addColorStop(0.5, `rgba(210,235,205,${0.55 * open})`); lg.addColorStop(1, 'rgba(210,230,200,0)');
      c.fillStyle = lg; c.fillRect(-gap * 2, -R, gap * 4, R * 2 * split);
    }
    c.shadowBlur = 0;
    c.restore();
  }

  function drawFragment(c, W, H, t, S) {
    const form = ease((t - 4.2) / 2.4); if (form <= 0) return;
    const rise = ease((t - 4.2) / 4.5);
    const cx = W * 0.5, cy = H * (0.52 - 0.14 * rise) + Math.sin(t * 0.9) * 5, s = Math.min(W, H) * 0.06 * form;
    c.save(); c.globalCompositeOperation = 'lighter';
    const z = s * 7;
    c.globalAlpha = 0.6 * form; c.drawImage(S.tint('mo-fr', S.spr.soft, '#9fe070'), cx - z, cy - z, z * 2, z * 2);
    c.restore();
    c.save(); c.translate(cx, cy); c.rotate(Math.sin(t * 0.4) * 0.15);
    const facets = [
      [[0, -s * 1.15], [s * 0.6, -s * 0.3], [0, s * 0.1], 1.0], [[0, -s * 1.15], [0, s * 0.1], [-s * 0.6, -s * 0.3], 0.55],
      [[s * 0.6, -s * 0.3], [s * 0.4, s * 0.95], [0, s * 0.1], 0.8], [[-s * 0.6, -s * 0.3], [0, s * 0.1], [-s * 0.4, s * 0.95], 0.35],
      [[0, s * 0.1], [s * 0.4, s * 0.95], [-s * 0.4, s * 0.95], 0.6]
    ];
    for (const f of facets) {
      const k = f[3];
      c.fillStyle = `rgba(${Math.floor(30 + 90 * k)},${Math.floor(70 + 170 * k)},${Math.floor(30 + 60 * k)},0.96)`;
      c.beginPath(); c.moveTo(f[0][0], f[0][1]); c.lineTo(f[1][0], f[1][1]); c.lineTo(f[2][0], f[2][1]); c.closePath(); c.fill();
    }
    c.strokeStyle = 'rgba(200,255,170,0.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, -s * 1.15); c.lineTo(s * 0.6, -s * 0.3); c.lineTo(s * 0.4, s * 0.95); c.lineTo(-s * 0.4, s * 0.95); c.lineTo(-s * 0.6, -s * 0.3); c.closePath(); c.stroke();
    c.restore();
  }

  const eng = E.create(scene);
  window.MeadowOutroCutscene = eng;
})();
