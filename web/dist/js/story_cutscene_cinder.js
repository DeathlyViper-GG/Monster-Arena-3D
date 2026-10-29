// ============================================================
// Monster Arena — Cinder Cutscene (Realm 4 intro)
// Signature: serious, industrial forge-cathedral. A vast obsidian
// temple where the Hollow was sealed. Perspective floor of lava
// channels, receding molten pillars, hanging chains, volumetric
// god-rays through smoke, a chained colossus (the Magma Titan) with
// a blazing core and molten cracks, and a suspended shard of the
// Scribe's will held by chains. Deep ember grade + heavy grain.
// Movie-like: Ken-Burns drift, letterbox, cross-dissolves.
// ============================================================
(function () {
  'use strict';
  let embers = [];
  const EMBER_COLORS = ['#ff8a3a', '#ffd07a', '#ff5a1a'];
  let emberSprites = null;
  function makeEmberSprites() {
    emberSprites = EMBER_COLORS.map(col => {
      const s = 48, cv = document.createElement('canvas'); cv.width = cv.height = s;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, col); g.addColorStop(0.5, col + '80'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
      return cv;
    });
  }

  // ---- a single interlocking chain link (metallic, molten rim) --------
  function drawChainLink(c, x, y, ang, linkLen, linkW, glow, hot) {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    const g = c.createLinearGradient(0, -linkW, 0, linkW);
    g.addColorStop(0, '#7a5a36');
    g.addColorStop(0.42, '#2a1608');
    g.addColorStop(0.58, '#1a0c04');
    g.addColorStop(1, '#4a3218');
    c.beginPath();
    c.ellipse(0, 0, linkLen * 0.5, linkW * 0.52, 0, 0, Math.PI * 2);
    c.ellipse(0, 0, linkLen * 0.34, linkW * 0.34, 0, 0, Math.PI * 2, true);
    c.fillStyle = g;
    c.fill('evenodd');
    c.strokeStyle = glow;
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 0, linkLen * 0.5, linkW * 0.52, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = 'rgba(255,200,120,0.7)';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(0, 0, linkLen * 0.5, linkW * 0.52, 0, 0, Math.PI * 2);
    c.stroke();
    if (hot) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(255,150,60,0.3)';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(0, 0, linkLen * 0.42, linkW * 0.42, 0, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = 'rgba(255,180,80,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, 0, linkLen * 0.42, linkW * 0.42, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  // ---- interlocking links along a straight segment -------------------
  function drawChainSegment(c, x0, y0, x1, y1, linkLen, linkW, glow, hot) {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const ang = Math.atan2(dy, dx);
    const n = Math.max(1, Math.floor(len / (linkLen * 0.85)));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      const px = x0 + dx * f, py = y0 + dy * f;
      drawChainLink(c, px, py, ang + (i % 2 ? Math.PI / 2 : 0), linkLen, linkW, glow, hot);
    }
  }

  function spawnEmber(init) {
    return {
      x: Math.random(), y: init ? Math.random() : 1.04,
      vx: (Math.random() - 0.5) * 0.05, vy: -(0.05 + Math.random() * 0.16),
      r: 0.5 + Math.random() * 2.4, life: 1.4 + Math.random() * 2.4,
      age: init ? Math.random() * 2 : 0, ci: Math.floor(Math.random() * 3),
      flick: Math.random() * 6.28
    };
  }
  function makeEmbers() { embers = []; for (let i = 0; i < 240; i++) embers.push(spawnEmber(true)); }

  function drawEmbers(c, W, H, t) {
    if (!emberSprites) makeEmberSprites();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      e.age += 0.016;
      e.x += e.vx * 0.016 + Math.sin(t * 1.5 + e.flick) * 0.0006;
      e.y += e.vy * 0.016;
      if (e.y < -0.06 || e.age > e.life) { Object.assign(e, spawnEmber(false)); continue; }
      const k = Math.max(0, 1 - e.age / e.life);
      const fl = 0.55 + 0.45 * Math.sin(t * 7 + e.flick);
      c.globalAlpha = k * fl * 0.9;
      const r = e.r * 3.2;
      c.drawImage(emberSprites[e.ci], e.x * W - r, e.y * H - r, r * 2, r * 2);
    }
    c.restore();
  }

  function drawGodRays(c, W, H, t, mul) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = W * (0.08 + i / n * 0.84) + Math.sin(t * 0.2 + i) * W * 0.02;
      c.save(); c.translate(x, 0); c.rotate(0.07 + Math.sin(t * 0.1 + i) * 0.02);
      const rg = c.createLinearGradient(0, 0, 0, H * 0.95);
      const fl = 0.6 + 0.4 * Math.sin(t * 0.5 + i);
      rg.addColorStop(0, 'rgba(255,150,60,' + (0.05 * mul * fl) + ')');
      rg.addColorStop(0.55, 'rgba(255,110,40,' + (0.02 * mul) + ')');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(-W * 0.03, 0, W * 0.06, H); c.restore();
    }
    c.restore();
  }

  function drawSmoke(c, W, H, t) {
    c.save();
    for (let i = 0; i < 5; i++) {
      const x = W * (0.12 + i * 0.19) + Math.sin(t * 0.3 + i) * W * 0.025;
      const baseY = H * 0.82;
      const h = H * 0.5 * (0.55 + 0.45 * Math.sin(t * 0.18 + i));
      const sg = c.createLinearGradient(x, baseY, x, baseY - h);
      sg.addColorStop(0, 'rgba(28,16,10,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = sg;
      c.beginPath(); c.moveTo(x - W * 0.05, baseY);
      for (let y = 0; y <= h; y += 12) {
        const wob = Math.sin(t * 0.6 + i + y * 0.02) * W * 0.04 - (y / h) * W * 0.07;
        c.lineTo(x + wob, baseY - y);
      }
      for (let y = h; y >= 0; y -= 12) {
        const wob = Math.sin(t * 0.6 + i + y * 0.02) * W * 0.04 - (y / h) * W * 0.07 + W * 0.06 * (1 - y / h);
        c.lineTo(x + wob, baseY - y);
      }
      c.closePath(); c.fill();
    }
    c.restore();
  }

  function drawHeatShimmer(c, W, H, t) {
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5;
    for (let i = 0; i < 30; i++) {
      const y = H * 0.6 + i * H * 0.012;
      const off = Math.sin(t * 2 + i * 0.5) * W * 0.01;
      c.strokeStyle = 'rgba(255,120,40,0.04)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, y + off); c.lineTo(W, y - off); c.stroke();
    }
    c.restore();
  }

  // ---- the static forge-cathedral backdrop ---------------------------
  function buildBackdrop(c, W, H) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070302'); g.addColorStop(0.32, '#0c0604'); g.addColorStop(0.55, '#150a05'); g.addColorStop(0.8, '#1e0c05'); g.addColorStop(1, '#2c1307');
    c.fillStyle = g; c.fillRect(0, 0, W, H);

    const vpx = W / 2, vpy = H * 0.40;

    // distant forge glow at the vanishing point
    c.save(); c.globalCompositeOperation = 'lighter';
    const dg = c.createRadialGradient(vpx, vpy, 8, vpx, vpy, Math.max(W, H) * 0.55);
    dg.addColorStop(0, 'rgba(255,150,50,0.55)'); dg.addColorStop(0.22, 'rgba(255,90,25,0.22)'); dg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = dg; c.fillRect(0, 0, W, H);
    c.restore();

    // perspective lava channels converging to the vanishing point
    c.save(); c.globalCompositeOperation = 'lighter';
    const channels = 11;
    for (let i = 0; i < channels; i++) {
      const a = -0.7 + (i / (channels - 1)) * 1.4;
      const bx = W / 2 + Math.tan(a) * H * 0.75;
      const lg = c.createLinearGradient(vpx, vpy, bx, H);
      lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.5, 'rgba(255,90,25,0.28)'); lg.addColorStop(1, 'rgba(255,150,55,0.62)');
      c.strokeStyle = lg; c.lineWidth = 3 + 2 * Math.abs(Math.cos(a));
      c.beginPath(); c.moveTo(vpx, vpy); c.lineTo(bx, H); c.stroke();
    }
    c.restore();

    // perspective floor grooves (horizontal)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let k = 1; k <= 12; k++) {
      const f = k / 12; const y = vpy + (H - vpy) * f * f;
      c.strokeStyle = 'rgba(255,120,40,' + (0.03 + 0.10 * f) + ')'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
    c.restore();

    // receding obsidian colonnade on both sides
    const drawColonnade = (side) => {
      const nP = 6;
      for (let i = 0; i < nP; i++) {
        const f = i / (nP - 1);
        const baseX = side ? W * (1 - 0.03 - f * 0.42) : W * (0.03 + f * 0.42);
        const pw = W * (0.11 * (1 - f * 0.72));
        const topY = H * 0.08, botY = H * 0.82;
        const pg = c.createLinearGradient(baseX - pw, 0, baseX + pw, 0);
        pg.addColorStop(0, '#070302'); pg.addColorStop(0.5, '#241208'); pg.addColorStop(1, '#040101');
        c.fillStyle = pg;
        c.beginPath();
        c.moveTo(baseX - pw * 0.5, botY); c.lineTo(baseX - pw * 0.5, topY);
        c.lineTo(baseX + pw * 0.5, topY); c.lineTo(baseX + pw * 0.5, botY); c.closePath(); c.fill();
        // molten seam down the pillar
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(255,90,30,' + (0.5 * (1 - f * 0.7)) + ')'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(baseX, topY); c.lineTo(baseX, botY); c.stroke();
        // capital glow
        const cg = c.createRadialGradient(baseX, topY, 2, baseX, topY, pw * 0.9);
        cg.addColorStop(0, 'rgba(255,120,40,' + (0.32 * (1 - f * 0.6)) + ')'); cg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = cg; c.beginPath(); c.arc(baseX, topY, pw * 0.9, 0, 6.28); c.fill();
        c.restore();
      }
    };
    drawColonnade(0); drawColonnade(1);

    // vaulted ceiling ribs
    c.save(); c.globalAlpha = 0.8;
    for (let i = 0; i < 7; i++) {
      const x = W * (0.08 + i * 0.14);
      c.strokeStyle = '#0a0503'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(x - W * 0.02, 0); c.quadraticCurveTo(x, H * 0.14, x + W * 0.02, 0); c.stroke();
    }
    c.restore();

    // hanging chains from the vault
    for (let i = 0; i < 5; i++) {
      const x = W * (0.18 + i * 0.16);
      drawChainSegment(c, x, 0, x, H * 0.18, 15, 13, 'rgba(255,120,40,0.45)', true);
    }

    // vignette
    const v = c.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.84)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
  }

  // ---- the Magma Titan: a chained colossus --------------------------
  const CRACKS = [
    [[0, -0.9], [0.08, -0.4], [0.02, 0.0], [0.1, 0.45]],
    [[0, -0.9], [-0.07, -0.4], [-0.03, 0.0], [-0.09, 0.45]],
    [[0.04, 0.0], [0.22, 0.08], [0.34, 0.02], [0.46, 0.06]],
    [[-0.04, 0.0], [-0.22, 0.08], [-0.34, 0.02], [-0.46, 0.06]],
    [[0, 0.04], [0.06, 0.34], [-0.02, 0.62], [0.04, 0.85]],
    [[0, -0.4], [-0.16, -0.2], [-0.26, -0.3]],
    [[0, -0.4], [0.16, -0.2], [0.26, -0.3]]
  ];
  let titanCache = null, titanKey = '';
  function buildTitanCache(W, H) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const cx = W / 2, headY = H * 0.22, shY = H * 0.34, feetY = H * 0.82, sw = W * 0.40;
    const tg = c.createLinearGradient(0, headY, 0, feetY);
    tg.addColorStop(0, '#1a0c06'); tg.addColorStop(0.4, '#2c1408'); tg.addColorStop(0.55, '#3c1c0a'); tg.addColorStop(1, '#0a0402');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(cx - sw, shY);
    c.quadraticCurveTo(cx - sw * 1.12, shY - H * 0.02, cx - sw * 0.7, headY);
    c.lineTo(cx - W * 0.10, headY);
    c.lineTo(cx - W * 0.10, headY - H * 0.02);
    c.lineTo(cx - W * 0.04, headY - H * 0.07);
    c.lineTo(cx, headY - H * 0.02);
    c.lineTo(cx + W * 0.04, headY - H * 0.07);
    c.lineTo(cx + W * 0.10, headY - H * 0.02);
    c.lineTo(cx + W * 0.10, headY);
    c.lineTo(cx + sw * 0.7, headY);
    c.quadraticCurveTo(cx + sw * 1.12, shY - H * 0.02, cx + sw, shY);
    c.quadraticCurveTo(cx + sw * 0.78, feetY - H * 0.08, cx + W * 0.13, feetY);
    c.lineTo(cx - W * 0.13, feetY);
    c.quadraticCurveTo(cx - sw * 0.78, feetY - H * 0.08, cx - sw, shY);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,120,50,0.55)'; c.lineWidth = 2; c.stroke();
    // binding chains (static) baked into the cache
    drawChainSegment(c, cx - sw * 1.05, shY, cx + W * 0.22, feetY - H * 0.05, 22, 20, 'rgba(255,120,40,0.75)', true);
    drawChainSegment(c, cx + sw * 1.05, shY, cx - W * 0.22, feetY - H * 0.05, 22, 20, 'rgba(255,120,40,0.75)', true);
    drawChainSegment(c, cx - sw * 0.9, H * 0.52, cx + sw * 0.5, H * 0.52, 20, 18, 'rgba(255,140,50,0.6)', true);
    return cv;
  }
  function drawTitan(c, W, H, t, dim) {
    const key = W + 'x' + H;
    if (!titanCache || titanKey !== key) { titanCache = buildTitanCache(W, H); titanKey = key; }
    c.save();
    if (dim) c.globalAlpha = 0.42;
    c.drawImage(titanCache, 0, 0);
    c.restore();

    const cx = W / 2, headY = H * 0.22, coreY = H * 0.52, feetY = H * 0.82, sw = W * 0.40;
    c.save();
    if (dim) c.globalAlpha = 0.42;
    // molten cracks (animated flicker)
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let ci = 0; ci < CRACKS.length; ci++) {
      const cr = CRACKS[ci];
      const fl = 0.55 + 0.45 * Math.sin(t * 5 + ci * 1.7);
      c.strokeStyle = 'rgba(255,150,60,' + (fl * 0.3) + ')';
      c.lineWidth = 6;
      c.beginPath();
      for (let k = 0; k < cr.length; k++) {
        const px = cx + cr[k][0] * sw, py = coreY + cr[k][1] * (feetY - headY);
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      c.strokeStyle = 'rgba(255,200,110,' + fl + ')';
      c.lineWidth = 2;
      c.beginPath();
      for (let k = 0; k < cr.length; k++) {
        const px = cx + cr[k][0] * sw, py = coreY + cr[k][1] * (feetY - headY);
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
    }
    c.restore();

    // blazing core (animated pulse)
    c.save(); c.globalCompositeOperation = 'lighter';
    const pulse = 0.72 + 0.28 * Math.sin(t * 3);
    const cg = c.createRadialGradient(cx, coreY, 4, cx, coreY, W * 0.20 * pulse);
    cg.addColorStop(0, 'rgba(255,255,225,' + (0.95 * pulse) + ')');
    cg.addColorStop(0.3, 'rgba(255,170,60,' + (0.7 * pulse) + ')');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, coreY, W * 0.20 * pulse, 0, 6.28); c.fill();
    c.restore();

    // burning eye-vents (animated)
    c.save(); c.globalCompositeOperation = 'lighter';
    const ef = 0.6 + 0.4 * Math.sin(t * 4);
    for (const dx of [-W * 0.05, W * 0.05]) {
      const eg = c.createRadialGradient(cx + dx, headY + H * 0.012, 1, cx + dx, headY + H * 0.012, W * 0.05);
      eg.addColorStop(0, 'rgba(255,240,200,' + ef + ')'); eg.addColorStop(0.4, 'rgba(255,120,40,' + (0.7 * ef) + ')'); eg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = eg; c.beginPath(); c.ellipse(cx + dx, headY + H * 0.012, W * 0.028, W * 0.013, 0, 0, 6.28); c.fill();
    }
    c.restore();
    c.restore();
  }

  // ---- the suspended shard of the Scribe's will --------------------
  let shardChainCache = null, shardChainKey = '';
  function drawShard(c, W, H, t) {
    drawTitan(c, W, H, t, true);
    const sx = W * 0.5, sy = H * 0.44, s = Math.min(W, H) * 0.10;
    const key = W + 'x' + H;
    if (!shardChainCache || shardChainKey !== key) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cc = cv.getContext('2d');
      drawChainSegment(cc, W * 0.08, 0, sx, sy, 18, 16, 'rgba(255,120,40,0.6)', true);
      drawChainSegment(cc, W * 0.92, 0, sx, sy, 18, 16, 'rgba(255,120,40,0.6)', true);
      drawChainSegment(cc, W * 0.26, 0, sx, sy, 16, 14, 'rgba(255,140,50,0.5)', true);
      drawChainSegment(cc, W * 0.74, 0, sx, sy, 16, 14, 'rgba(255,140,50,0.5)', true);
      shardChainCache = cv; shardChainKey = key;
    }
    c.drawImage(shardChainCache, 0, 0);

    const pulse = 0.72 + 0.28 * Math.sin(t * 2.5);
    // halo
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(sx, sy);
    const hg = c.createRadialGradient(0, 0, 2, 0, 0, s * 4.2);
    hg.addColorStop(0, 'rgba(255,205,130,' + (0.6 * pulse) + ')');
    hg.addColorStop(0.3, 'rgba(255,120,40,' + (0.3 * pulse) + ')');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(0, 0, s * 4.2, 0, 6.28); c.fill();
    c.restore();

    // faceted crystal shard
    const facets = [
      { pts: [[0, -s * 1.7], [s * 0.55, -s * 0.3], [0, s * 1.5]], cols: ['#ffe9b0', '#ff8a3a', '#5a1808'] },
      { pts: [[0, -s * 1.7], [-s * 0.55, -s * 0.3], [0, s * 1.5]], cols: ['#ffcf7a', '#ff6a2a', '#3a0e04'] }
    ];
    c.save(); c.translate(sx, sy);
    for (const f of facets) {
      const fg = c.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[2][0], f.pts[2][1]);
      fg.addColorStop(0, f.cols[0]); fg.addColorStop(0.5, f.cols[1]); fg.addColorStop(1, f.cols[2]);
      c.fillStyle = fg; c.strokeStyle = 'rgba(255,220,160,0.85)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(f.pts[0][0], f.pts[0][1]); c.lineTo(f.pts[1][0], f.pts[1][1]); c.lineTo(f.pts[2][0], f.pts[2][1]); c.closePath(); c.fill(); c.stroke();
    }
    if (emberSprites) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.5 * pulse;
      c.drawImage(emberSprites[1], sx - s * 2, sy - s * 2, s * 4, s * 4); c.globalAlpha = 1; c.restore(); }
    c.strokeStyle = 'rgba(255,255,225,0.9)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -s * 1.7); c.lineTo(0, s * 1.5); c.stroke();
    c.restore();
  }

  function render(ctx, scene, W, H, t, env) {
    const k = Math.min(1, env.sceneT / 8);
    if (scene === 0) {
      env.cam(1 + 0.22 * k, 0, H * 0.04 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawGodRays(ctx, W, H, t, 1);
      drawSmoke(ctx, W, H, t);
      drawHeatShimmer(ctx, W, H, t);
      drawEmbers(ctx, W, H, t);
    } else if (scene === 1) {
      env.cam(1.34 + 0.12 * k, 0, -H * 0.05 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawGodRays(ctx, W, H, t, 0.7);
      drawTitan(ctx, W, H, t, false);
      drawHeatShimmer(ctx, W, H, t);
      drawEmbers(ctx, W, H, t);
    } else {
      env.cam(1.5 + 0.10 * k, 0, -H * 0.06 * k);
      ctx.drawImage(env.bgCanvas, 0, 0, W, H);
      drawGodRays(ctx, W, H, t, 0.6);
      drawShard(ctx, W, H, t);
      drawEmbers(ctx, W, H, t);
    }
    ctx.restore();
  }

  function post(ctx, W, H, t, env) {
    env.grade('rgba(255,120,40,1)', 0.18, 'soft-light');
    env.grade('rgba(18,7,4,1)', 0.16, 'multiply');
    env.grain(0.07);
  }

  function play(script, opts) {
    makeEmbers();
    Cinematic.play({
      prefix: 'Cinder', accent: '#ff8a3a',
      beats: script, beatScenes: [0, 1, 2],
      buildBackdrop, render, post, onDone: (opts && opts.onDone) || function () {}
    });
  }
  window.CinderCutscene = { play, done: () => Cinematic.done() };
})();
