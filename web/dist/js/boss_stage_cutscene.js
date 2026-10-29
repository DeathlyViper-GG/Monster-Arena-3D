// ============================================================
// Monster Arena — BOSS STAGE TRANSITION CUTSCENES
// When a boss crosses an HP threshold, the world freezes (player
// can't move or attack) and a short magical transformation plays.
// Each REALM has a distinct palette/motif, and within one boss each
// successive stage ESCALATES on the last: taller beacon, more sigil
// rings, more expanding shockwaves, denser particles, and a bigger
// finish. So Stage II → III is visibly more intense than I → II.
//
//   meadow  — green/amber, rising spores, sun-shaft, root runes
//   dunes   — amber/glass, sandstorm pillar, glaring sun, hieroglyphs
//   glacial — cyan/aurora, frost eruption, aurora curtain, ice runes
//
// Exposes: BossStageCutscene.play({ theme, accent, name, from, to, onDone })
// Sets window.STAGE_CUTSCENE_ACTIVE = true while playing.
// ============================================================
(function () {
  'use strict';

  let overlay = null, canvas = null, ctx = null, titleEl = null;
  let injected = false;
  let raf = 0, started = 0, dur = 3600, parts = [], motif = [], onDoneCb = null;
  let active = false, lvl = 0;

  const THEMES = {
    meadow: {
      accent: '#7dffa3', glyph: '#ffb347',
      bg0: '#06120a', bg1: '#0c2414', bg2: '#164a22',
      beacon: '#7dffa3', beam: '#bff5d0',
      title: 'The Hearth Warden Awakens', motif: 'roots'
    },
    dunes: {
      accent: '#ffd166', glyph: '#ff8a3a',
      bg0: '#1a0b02', bg1: '#3a1a0c', bg2: '#7a3a14',
      beacon: '#ffd166', beam: '#fff0c4',
      title: 'The Pharaoh of Glass Rises', motif: 'sand'
    },
    glacial: {
      accent: '#9fe3ff', glyph: '#7fd4ff',
      bg0: '#020a12', bg1: '#08203a', bg2: '#0d3a5a',
      beacon: '#9fe3ff', beam: '#eaf6ff',
      title: 'The Rime Oracle Transcends', motif: 'ice'
    },
    cinder: {
      accent: '#ff6a2a', glyph: '#ffd700',
      bg0: '#14040a', bg1: '#2e0a06', bg2: '#6a1a08',
      beacon: '#ff6a2a', beam: '#ffd98a',
      title: 'The Magma Titan Awakens', motif: 'ember'
    },
    void: {
      accent: '#c88aff', glyph: '#9fe3ff',
      bg0: '#020008', bg1: '#0a0218', bg2: '#1a0838',
      beacon: '#c88aff', beam: '#e8dcff',
      title: 'The Void Stirs', motif: 'void'
    }
  };
  const STAGE_NAME = ['Surge', 'Cataclysm', 'Ascension'];

  function inject() {
    if (injected) return; injected = true;
    const s = document.createElement('style');
    s.textContent = `
      #bscOverlay{position:fixed;inset:0;z-index:60;display:none;place-items:center;
        background:rgba(2,4,8,.0);pointer-events:none;overflow:hidden;}
      #bscCanvas{position:absolute;inset:0;width:100%;height:100%;}
      #bscTitle{position:absolute;top:14%;left:50%;transform:translateX(-50%);
        text-align:center;opacity:0;transition:opacity .5s ease;pointer-events:none;}
      #bscTitle h2{margin:0;font-size:clamp(20px,3.4vw,40px);letter-spacing:.1em;text-transform:uppercase;
        font-weight:900;color:#fff;text-shadow:0 0 26px var(--bsc-accent,#fff),0 4px 14px rgba(0,0,0,.9);}
      #bscTitle p{margin:6px 0 0;font-size:clamp(12px,1.6vw,16px);letter-spacing:.16em;text-transform:uppercase;
        font-weight:700;color:var(--bsc-accent,#fff);opacity:.92;}`;
    document.head.appendChild(s);
    overlay = document.createElement('div');
    overlay.id = 'bscOverlay';
    overlay.innerHTML = `<canvas id="bscCanvas"></canvas>
      <div id="bscTitle"><h2 id="bscH"></h2><p id="bscSub"></p></div>`;
    document.body.appendChild(overlay);
    canvas = document.getElementById('bscCanvas');
    ctx = canvas.getContext('2d');
    titleEl = document.getElementById('bscTitle');
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildParticles(theme) {
    parts = []; motif = [];
    const W = window.innerWidth, H = window.innerHeight;
    const cx = W / 2, cy = H * 0.74;
    const sparks = 160 + lvl * 140;
    for (let i = 0; i < sparks; i++) parts.push({
      x: cx + (Math.random() - .5) * (240 + lvl * 80), y: cy + Math.random() * 40,
      vx: (Math.random() - .5) * (30 + lvl * 30), vy: -60 - Math.random() * (200 + lvl * 120),
      r: 1 + Math.random() * (3 + lvl), life: 1 + Math.random() * 1.6, age: Math.random() * 1.2,
      col: Math.random() < 0.5 ? theme.beacon : theme.glyph, kind: 'spark'
    });
    if (theme.motif === 'roots') {
      for (let i = 0; i < 24 + lvl * 14; i++) motif.push({
        x: cx + (Math.random() - .5) * W * .8, y: H * (0.5 + Math.random() * .4),
        len: 60 + Math.random() * (140 + lvl * 60), a: 0.15 + Math.random() * 0.3, ph: Math.random() * 6.28
      });
    } else if (theme.motif === 'sand') {
      for (let i = 0; i < 160 + lvl * 120; i++) motif.push({
        x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4,
        vx: 40 + Math.random() * (120 + lvl * 60), vy: (Math.random() - .5) * 30, a: 0.2 + Math.random() * 0.5, ph: Math.random() * 6.28
      });
    } else if (theme.motif === 'ember') {
      for (let i = 0; i < 160 + lvl * 120; i++) motif.push({
        x: Math.random() * W, y: H * (0.4 + Math.random() * 0.6), r: 1 + Math.random() * 3,
        vx: (Math.random() - .5) * 24, vy: -40 - Math.random() * (140 + lvl * 80), a: 0.4 + Math.random() * 0.5, ph: Math.random() * 6.28,
        ember: true
      });
      for (let i = 0; i < 80 + lvl * 60; i++) motif.push({
        x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.4,
        vx: 30 + Math.random() * 80, vy: (Math.random() - .5) * 20, a: 0.2 + Math.random() * 0.4, ph: Math.random() * 6.28,
        ash: true
      });
    } else if (theme.motif === 'void') {
      for (let i = 0; i < 140 + lvl * 100; i++) motif.push({
        x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3,
        vx: (Math.random() - .5) * 14, vy: (Math.random() - .5) * 14, a: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28,
        voidMote: true
      });
      for (let i = 0; i < 6 + lvl * 2; i++) motif.push({ band: true, y: H * (0.14 + i * 0.07), ph: Math.random() * 6.28, w: 0.5 + Math.random() * 0.4 });
    } else {
      for (let i = 0; i < 140 + lvl * 100; i++) motif.push({
        x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3,
        vx: (Math.random() - .5) * 14, vy: 30 + Math.random() * 60, a: 0.3 + Math.random() * 0.5, ph: Math.random() * 6.28
      });
      for (let i = 0; i < 4 + lvl; i++) motif.push({ band: true, y: H * (0.14 + i * 0.07), ph: Math.random() * 6.28, w: 0.5 + Math.random() * 0.4 });
    }
  }

  function drawBackdrop(theme, W, H, p) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.bg0); g.addColorStop(0.5, theme.bg1); g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const dim = Math.min(0.86 + lvl * 0.04, 0.96, p < 0.12 ? p / 0.12 : (p > 0.82 ? (1 - (p - 0.82) / 0.18) : 1)) ;
    ctx.fillStyle = `rgba(2,4,8,${dim})`; ctx.fillRect(0, 0, W, H);
  }

  function drawBeacon(theme, W, H, t, p) {
    const cx = W / 2, baseY = H * 0.74;
    const rise = Math.min(1, Math.max(0, (p - 0.1) / 0.45));
    const heightMul = 0.72 + lvl * 0.16;
    const beamH = H * 0.92 * rise * heightMul;
    const beamW = 120 + lvl * 40;
    const gg = ctx.createRadialGradient(cx, baseY, 10, cx, baseY, W * (0.5 + lvl * 0.08));
    gg.addColorStop(0, hexA(theme.beacon, 0.6 * rise));
    gg.addColorStop(0.4, hexA(theme.beacon, 0.22 * rise));
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bg = ctx.createLinearGradient(cx - beamW, 0, cx + beamW, 0);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.5, hexA(theme.beacon, 0.55 * rise)); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(cx - beamW, baseY - beamH, beamW * 2, beamH);
    const core = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0);
    core.addColorStop(0, 'rgba(0,0,0,0)'); core.addColorStop(0.5, hexA(theme.beam, 0.95 * rise)); core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core; ctx.fillRect(cx - 22, baseY - beamH, 44, beamH);
    const tb = ctx.createRadialGradient(cx, baseY - beamH, 4, cx, baseY - beamH, 180 + lvl * 50);
    tb.addColorStop(0, hexA(theme.beam, 0.85 * rise)); tb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tb; ctx.beginPath(); ctx.arc(cx, baseY - beamH, 180 + lvl * 50, 0, 6.28); ctx.fill();
    ctx.restore();
    // escalating shockwave rings — one per stage level, expanding outward
    const rings = 1 + lvl;
    for (let i = 0; i < rings; i++) {
      const off = i * 0.18;
      const rp = Math.min(1, Math.max(0, (p - 0.2 - off) / 0.6));
      if (rp <= 0) continue;
      const rr = rp * W * (0.45 + i * 0.12);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(i % 2 ? theme.glyph : theme.beacon, 0.6 * (1 - rp));
      ctx.lineWidth = (6 - i) * (1 - rp) + 1;
      ctx.beginPath(); ctx.arc(cx, baseY, rr, 0, 6.28); ctx.stroke();
      ctx.restore();
    }
    // a second offset beacon appears from stage III onward
    if (lvl >= 2) {
      const cx2 = cx + W * 0.16, bh2 = beamH * 0.7;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const bg2 = ctx.createLinearGradient(cx2 - 60, 0, cx2 + 60, 0);
      bg2.addColorStop(0, 'rgba(0,0,0,0)'); bg2.addColorStop(0.5, hexA(theme.glyph, 0.45 * rise)); bg2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg2; ctx.fillRect(cx2 - 60, baseY - bh2, 120, bh2);
      ctx.restore();
    }
    drawSigil(theme, cx, baseY, (90 + lvl * 26) * rise, t, p);
  }

  function drawSigil(theme, x, y, r, t, p) {
    if (r < 2) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rings = 3 + lvl;
    for (let i = 0; i < rings; i++) {
      const rr = r * (0.5 + i * 0.22);
      ctx.strokeStyle = hexA(i % 2 ? theme.glyph : theme.beacon, 0.7);
      ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.28); ctx.stroke();
    }
    ctx.setLineDash([]);
    const n = 8 + lvl * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + t * 0.6;
      ctx.strokeStyle = hexA(theme.glyph, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(theme, W, H, dt, p) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const m of motif) {
      if (theme.motif === 'roots') {
        m.ph += dt * 1.2;
        const grow = Math.min(1, Math.max(0, (p - 0.15) * 2)) * (0.6 + 0.4 * Math.sin(m.ph));
        ctx.strokeStyle = hexA(theme.beacon, m.a * grow);
        ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.quadraticCurveTo(m.x + Math.cos(m.ph) * m.len * 0.5, m.y - m.len * 0.4 * grow, m.x + Math.sin(m.ph * 1.3) * m.len * 0.3, m.y - m.len * grow);
        ctx.stroke();
      } else if (theme.motif === 'sand') {
        m.x += m.vx * dt; m.ph += dt * 2;
        if (m.x > W + 20) m.x = -20;
        ctx.fillStyle = hexA(theme.beacon, m.a * (0.6 + 0.4 * Math.sin(m.ph)));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      } else if (m.band) {
        m.ph += dt * 0.6;
        const a = 0.25 * (0.5 + 0.5 * Math.sin(m.ph)) * Math.min(1, p * 2);
        const bg = ctx.createLinearGradient(0, m.y - 60, 0, m.y + 60);
        bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.5, hexA(theme.beacon, a)); bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, m.y + Math.sin(x * 0.01 + m.ph) * 26 * m.w);
        ctx.lineTo(W, m.y + 80); ctx.lineTo(0, m.y + 80); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, m.y + Math.sin(x * 0.01 + m.ph) * 26 * m.w);
        ctx.lineTo(W, m.y - 80); ctx.lineTo(0, m.y - 80); ctx.closePath(); ctx.fill();
      } else if (m.ember) {
        m.x += m.vx * dt; m.y += m.vy * dt; m.vy -= 20 * dt; m.ph += dt * 2;
        const k = Math.max(0, 1 - (H - m.y) / H);
        const fl = 0.6 + 0.4 * Math.sin(m.ph);
        ctx.fillStyle = hexA(Math.random() < 0.5 ? theme.beacon : theme.glyph, m.a * fl);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      } else if (m.ash) {
        m.x += m.vx * dt; m.ph += dt * 2;
        if (m.x > W + 20) m.x = -20;
        ctx.fillStyle = hexA('#6a5a4a', m.a * (0.5 + 0.5 * Math.sin(m.ph)));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      } else if (m.voidMote) {
        const cx = W / 2, cy = H * 0.74;
        const dx = cx - m.x, dy = cy - m.y, d = Math.hypot(dx, dy) + 1;
        m.x += dx / d * 14 * dt + Math.sin(m.ph) * 0.3; m.y += dy / d * 14 * dt;
        m.ph += dt * 3;
        ctx.fillStyle = hexA(theme.beacon, m.a * (0.5 + 0.5 * Math.sin(m.ph)));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      } else {
        m.y += m.vy * dt; m.x += m.vx * dt; m.ph += dt * 2;
        if (m.y > H + 10) m.y = -10;
        ctx.fillStyle = hexA(theme.beam, m.a * (0.6 + 0.4 * Math.sin(m.ph)));
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.28); ctx.fill();
      }
    }
    for (const s of parts) {
      s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt;
      const k = Math.max(0, 1 - s.age / s.life);
      ctx.fillStyle = hexA(s.col, 0.8 * k);
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.5 + k), 0, 6.28); ctx.fill();
    }
    parts = parts.filter(s => s.age < s.life);
    ctx.restore();
  }

  function drawFlourish(theme, W, H, t, p) {
    const cx = W / 2;
    if (theme.motif === 'roots') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createLinearGradient(cx, 0, cx, H * 0.5);
      sg.addColorStop(0, hexA(theme.glyph, 0.3 * Math.min(1, p * 2))); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(cx - (160 + lvl*40), 0); ctx.lineTo(cx + (160 + lvl*40), 0); ctx.lineTo(cx + 40, H * 0.5); ctx.lineTo(cx - 40, H * 0.5); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (theme.motif === 'sand') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const sy = H * 0.22, fl = 0.6 + 0.4 * Math.sin(t * 3);
      const rg = ctx.createRadialGradient(cx, sy, 10, cx, sy, 220 + lvl * 60);
      rg.addColorStop(0, hexA(theme.beam, 0.8 * fl)); rg.addColorStop(0.4, hexA(theme.beacon, 0.3 * fl)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, sy, 220 + lvl * 60, 0, 6.28); ctx.fill();
      const rays = 12 + lvl * 6;
      for (let i = 0; i < rays; i++) { const a = i / rays * 6.28 + t; ctx.strokeStyle = hexA(theme.glyph, 0.4 * fl); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 60, sy + Math.sin(a) * 60); ctx.lineTo(cx + Math.cos(a) * (200 + lvl*40), sy + Math.sin(a) * (200 + lvl*40)); ctx.stroke(); }
      ctx.restore();
    } else if (theme.motif === 'ember') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // a roaring forge flare at the base, erupting upward
      const baseY = H * 0.74, fl = 0.7 + 0.3 * Math.sin(t * 5);
      const rg = ctx.createRadialGradient(cx, baseY, 20, cx, baseY, 260 + lvl * 70);
      rg.addColorStop(0, hexA('#ffffff', 0.5 * fl)); rg.addColorStop(0.3, hexA(theme.beacon, 0.6 * fl)); rg.addColorStop(0.7, hexA(theme.glyph, 0.3 * fl)); rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(cx, baseY, 260 + lvl * 70, 0, 6.28); ctx.fill();
      // eruption plumes
      const plumes = 10 + lvl * 5;
      for (let i = 0; i < plumes; i++) {
        const a = -Math.PI / 2 + (i / (plumes - 1) - 0.5) * Math.PI * 1.2;
        const len = (120 + Math.sin(t * 4 + i) * 30 + lvl * 50) * Math.min(1, (p - 0.2) * 2);
        if (len < 4) continue;
        ctx.save(); ctx.translate(cx, baseY); ctx.rotate(a);
        const pg = ctx.createLinearGradient(0, 0, 0, len);
        pg.addColorStop(0, hexA(theme.beacon, 0.8)); pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = pg; ctx.strokeStyle = hexA(theme.glyph, 0.9); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, len * 0.5); ctx.lineTo(0, len); ctx.lineTo(-12, len * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    } else if (theme.motif === 'void') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const baseY = H * 0.74;
      // swirling void vortex — gravitational pull lines converging to a forming black hole
      const n = 14 + lvl * 8;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.3 + t * 0.3;
        const len = (160 + Math.sin(t * 4 + i) * 30 + lvl * 40) * Math.min(1, (p - 0.2) * 2);
        if (len < 4) continue;
        ctx.save(); ctx.translate(cx, baseY); ctx.rotate(a);
        const vg = ctx.createLinearGradient(0, 0, 0, len);
        vg.addColorStop(0, hexA(theme.beacon, 0.8)); vg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = vg; ctx.strokeStyle = hexA(theme.beam, 0.9); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, len * 0.5); ctx.lineTo(0, len); ctx.lineTo(-10, len * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      const hr = (40 + lvl * 20) * Math.min(1, (p - 0.15) * 2);
      if (hr > 2) {
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx, baseY, hr, 0, 6.28); ctx.fill();
        ctx.strokeStyle = hexA(theme.beam, 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, baseY, hr + 4, 0, 6.28); ctx.stroke();
        ctx.strokeStyle = hexA(theme.beacon, 0.6); ctx.lineWidth = 1; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 60;
        ctx.beginPath(); ctx.arc(cx, baseY, hr * 1.6, 0, 6.28); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    } else {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const baseY = H * 0.74;
      const n = 14 + lvl * 8;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.1;
        const len = (140 + Math.sin(t * 4 + i) * 30 + lvl * 40) * Math.min(1, (p - 0.2) * 2);
        if (len < 4) continue;
        ctx.save(); ctx.translate(cx, baseY); ctx.rotate(a);
        ctx.fillStyle = hexA(theme.beam, 0.7);
        ctx.strokeStyle = hexA(theme.beacon, 0.9); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, len * 0.5); ctx.lineTo(0, len); ctx.lineTo(-14, len * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    // escalating full-screen flash at the peak — bigger each stage
    const flashP = Math.max(0, 1 - Math.abs(p - 0.5) * 4);
    if (flashP > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA(theme.beam, 0.12 * flashP * (1 + lvl * 0.6));
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function hexA(hex, a) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function frame(now) {
    if (!started) started = now;
    const t = (now - started) / 1000;
    const p = Math.min(1, (now - started) / dur);
    const W = window.innerWidth, H = window.innerHeight;
    const theme = frame._theme;
    drawBackdrop(theme, W, H, p);
    drawBeacon(theme, W, H, t, p);
    drawFlourish(theme, W, H, t, p);
    drawParticles(theme, W, H, 1 / 60, p);
    titleEl.style.opacity = (p > 0.18 && p < 0.82) ? '1' : '0';
    if (p >= 1) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    cancelAnimationFrame(raf); raf = 0; started = 0;
    if (overlay) overlay.style.display = 'none';
    titleEl.style.opacity = '0';
    // Keep the world frozen for a 2s safety hold after the visuals end,
    // so any in-flight boss attack settles before combat resumes.
    const cb = onDoneCb; onDoneCb = null;
    setTimeout(() => {
      active = false;
      window.STAGE_CUTSCENE_ACTIVE = false;
      if (cb) try { cb(); } catch (e) {}
    }, 2000);
  }

  function play(opts) {
    if (active) return;
    inject(); resize();
    const theme = THEMES[opts.theme] || THEMES.glacial;
    if (opts.accent) { theme.accent = opts.accent; theme.beacon = opts.accent; }
    lvl = Math.max(0, Math.min(2, (opts.to || 1) - 2)); // 1→2 => 0, 2→3 => 1, 3→4 => 2
    dur = 3200 + lvl * 500;
    titleEl.style.setProperty('--bsc-accent', theme.beacon);
    document.getElementById('bscH').textContent = opts.name || theme.title;
    const rom = ['I', 'II', 'III', 'IV'];
    const to = opts.to || 1;
    document.getElementById('bscSub').textContent = 'Stage ' + (rom[to - 1] || to) + ' — ' + (STAGE_NAME[lvl] || 'Transformation');
    buildParticles(theme);
    onDoneCb = opts.onDone || null;
    active = true; window.STAGE_CUTSCENE_ACTIVE = true;
    overlay.style.display = 'grid';
    started = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame((now) => { frame._theme = theme; frame(now); });
  }

  window.BossStageCutscene = { play, active: () => active };
  window.addEventListener('resize', () => { if (active) resize(); });
})();
