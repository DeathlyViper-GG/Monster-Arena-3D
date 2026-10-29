// ============================================================
// Monster Arena — Cursed Death Overlay
// A full-screen animated "death" sequence: spreading cracks,
// pulsing dark vignette, rotating cursed runes, rising embers,
// a screaming skull and blood drips — feels properly cursed.
// Exposes showDeathOverlay()/hideDeathOverlay(); pve16.js calls
// these from showGameOver() and handleAuthoritativeDeath().
// ============================================================
(function () {
  'use strict';
  let overlay = document.getElementById('overlayDeath');
  let canvas, ctx, raf = 0, t0 = 0, running = false;

  function ensure() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'overlayDeath';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:#05030a;overscroll-behavior:none;';
    overlay.innerHTML =
      '<canvas id="deathCanvas" style="position:absolute;inset:0;width:100%;height:100%;display:block"></canvas>' +
      '<div style="position:relative;z-index:2;text-align:center;color:#f4e9ff;pointer-events:none;padding:24px;max-width:92vw">' +
        '<div id="deathSkull" style="font-size:clamp(60px,16vw,150px);line-height:1;filter:drop-shadow(0 0 24px #c066ff) drop-shadow(0 0 8px #ff3a3a);transform:translateY(0)">💀</div>' +
        '<h2 id="deathTitle" style="margin:8px 0 4px;font-size:clamp(34px,9vw,82px);font-weight:900;letter-spacing:.14em;text-transform:uppercase;background:linear-gradient(180deg,#fff,#ff8a8a 60%,#7a1a1a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 40px rgba(200,40,40,.5)">You Died</h2>' +
        '<p id="deathSub" style="margin:0 0 18px;font-size:clamp(13px,3.4vw,18px);letter-spacing:.18em;text-transform:uppercase;color:#c9a9ff;opacity:.85;text-shadow:0 0 12px #6a1aa6">Your enchantments are stripped away…</p>' +
        '<div id="deathStats" style="font-size:clamp(12px,3vw,15px);color:#b9a9d6;margin-bottom:22px;letter-spacing:.06em"></div>' +
        '<div style="pointer-events:auto;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn bigBtn" id="deathRestart" style="background:linear-gradient(180deg,#3a0f2a,#160a1a);border:1px solid #ff5a5a;color:#ffd0d0;box-shadow:0 0 22px rgba(255,60,60,.4)">🔄 Rise Again</button>' +
          '<button class="btn" id="deathHome">🏠 Home</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('#deathCanvas');
    ctx = canvas.getContext('2d');
    overlay.querySelector('#deathRestart').addEventListener('click', () => { hideDeathOverlay(); const b = document.getElementById('btnRestart') || document.getElementById('restartBtn2'); if (b) b.click(); });
    overlay.querySelector('#deathHome').addEventListener('click', () => { hideDeathOverlay(); const b = document.getElementById('btnHome') || document.getElementById('homeBtn2'); if (b) b.click(); });
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // stable pseudo-random
  function rnd(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  let cracks = [], embers = [], drips = [], runes = [];
  function initVfx() {
    const W = window.innerWidth, H = window.innerHeight;
    const r = rnd((Date.now() & 0xffffff) | 1);
    cracks = []; for (let i = 0; i < 9; i++) cracks.push(mkCrack(r() * W, r() * H, r() * Math.PI * 2, 40 + r() * 60, r));
    embers = []; for (let i = 0; i < 60; i++) embers.push({ x: r() * W, y: H + r() * 200, vy: -20 - r() * 40, vx: (r() - .5) * 14, life: r(), r: .6 + r() * 2, seed: r() * 1000 });
    drips = []; for (let i = 0; i < 14; i++) drips.push({ x: r() * W, y: -20 - r() * 200, len: 0, v: 60 + r() * 120, max: 60 + r() * 180, seed: r() * 1000 });
    runes = []; for (let i = 0; i < 7; i++) runes.push({ x: r() * W, y: r() * H, a: r() * Math.PI * 2, sz: 16 + r() * 26, sp: (r() - .5) * .8, ch: ['☥','♱','✶','☠','⧫','✦','⊗'][(r() * 7) | 0] });
  }
  function mkCrack(x, y, a, len, r) {
    const pts = [{ x, y }];
    let cx = x, cy = y, ang = a;
    for (let i = 0; i < len; i++) { ang += (r() - .5) * .7; cx += Math.cos(ang) * 14; cy += Math.sin(ang) * 14; pts.push({ x: cx, y: cy }); if (r() < .25) { pts.push({ fork: true, x: cx, y: cy, a: ang + (r() < .5 ? .8 : -.8), len: 4 + (r() * 8) | 0, pts: (function(){let pp=[{x:cx,y:cy}],ax=ang+(r()<.5?.8:-.8),px=cx,py=cy;for(let k=0;k<6;k++){ax+=(r()-.5)*.7;px+=Math.cos(ax)*10;py+=Math.sin(ax)*10;pp.push({x:px,y:py});}return pp;})() }); } }
    return pts;
  }

  function drawCracks(t, W, H) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const c of cracks) {
      const grow = Math.min(1, t * 1.4);
      ctx.strokeStyle = 'rgba(255,60,40,' + (0.5 * (1 - Math.min(1, t * .6))) + ')';
      ctx.lineWidth = 3; ctx.shadowColor = '#ff3a20'; ctx.shadowBlur = 14;
      ctx.beginPath();
      const n = Math.max(2, Math.floor(c.length * grow));
      ctx.moveTo(c[0].x, c[0].y);
      for (let i = 1; i < n; i++) { const p = c[i]; if (p.fork) continue; ctx.lineTo(p.x, p.y); }
      ctx.stroke();
      for (let i = 0; i < n; i++) { const p = c[i]; if (p.fork && p.pts) { ctx.beginPath(); ctx.moveTo(p.pts[0].x, p.pts[0].y); for (let k = 1; k < p.pts.length; k++) ctx.lineTo(p.pts[k].x, p.pts[k].y); ctx.lineWidth = 1.5; ctx.stroke(); } }
    }
    ctx.restore();
  }

  function frame() {
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    const W = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);
    // deep cursed background wash
    const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, Math.max(W, H) * 0.75);
    bg.addColorStop(0, 'rgba(40,8,30,' + (0.55 + 0.2 * Math.sin(t * 1.5)) + ')');
    bg.addColorStop(0.6, 'rgba(12,4,16,0.85)');
    bg.addColorStop(1, '#05030a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // rotating cursed runes
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const rn of runes) { rn.a += rn.sp * 0.02; const fl = 0.4 + 0.4 * Math.sin(t * 2 + rn.seed); ctx.globalAlpha = 0.18 * fl; ctx.fillStyle = '#c066ff'; ctx.font = 'bold ' + rn.sz + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = '#c066ff'; ctx.shadowBlur = 16; ctx.translate(rn.x, rn.y); ctx.rotate(rn.a); ctx.fillText(rn.ch, 0, 0); ctx.setTransform(Math.max(1, window.devicePixelRatio || 1), 0, 0, Math.max(1, window.devicePixelRatio || 1), 0, 0); }
    ctx.restore();
    // spreading cracks
    drawCracks(t, W, H);
    // rising embers
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const e of embers) { e.y += e.vy * 0.016; e.x += e.vx * 0.016; e.life += 0.016; if (e.y < -20) { e.y = H + 20; e.x = Math.random() * W; } const fl = 0.5 + 0.5 * Math.sin(t * 6 + e.seed); ctx.globalAlpha = 0.6 * fl; ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // blood drips from top
    ctx.save();
    for (const d of drips) { d.len = Math.min(d.max, d.len + d.v * 0.016); const grad = ctx.createLinearGradient(d.x, 0, d.x, d.len); grad.addColorStop(0, 'rgba(120,0,8,0)'); grad.addColorStop(0.3, 'rgba(150,0,10,.7)'); grad.addColorStop(1, 'rgba(90,0,6,0)'); ctx.fillStyle = grad; ctx.fillRect(d.x - 1.5, 0, 3, d.len); ctx.fillStyle = '#7a0008'; ctx.beginPath(); ctx.arc(d.x, d.len, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // pulsing vignette
    const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,' + (0.6 + 0.2 * Math.sin(t * 3)) + ')');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    // skull shake
    const sk = document.getElementById('deathSkull');
    if (sk) { const sh = Math.sin(t * 18) * 3 * Math.max(0, 1 - t * 0.4); const ty = Math.sin(t * 2) * 6; sk.style.transform = 'translate(' + sh + 'px,' + ty + 'px) scale(' + (1 + 0.04 * Math.sin(t * 4)) + ')'; }
    raf = requestAnimationFrame(frame);
  }

  function showDeathOverlay(stats) {
    // The cursed death screen is a React component in the parent document.
    // Hand off to it via postMessage; the parent renders DeathScreen over the
    // iframe and posts 'death-restart' / 'death-home' back here.
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'player-died', stats: stats || '' }, '*'); } catch (e) {}
      return;
    }
    // Fallback (no parent): the original canvas overlay.
    ensure(); resize(); initVfx();
    if (stats) { const s = document.getElementById('deathStats'); if (s) s.textContent = stats; }
    overlay.style.display = 'flex';
    t0 = performance.now(); running = true;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function hideDeathOverlay() { running = false; cancelAnimationFrame(raf); if (overlay) overlay.style.display = 'none'; }
  window.addEventListener('resize', () => { if (running) resize(); });

  // React death-screen actions come back through here.
  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d) return;
    if (d.type === 'death-restart') {
      hideDeathOverlay();
      var b = document.getElementById('btnRestart') || document.getElementById('restartBtn2');
      if (b) b.click();
    }
    if (d.type === 'death-home') {
      hideDeathOverlay();
      var h = document.getElementById('btnHome') || document.getElementById('homeBtn2');
      if (h) h.click();
    }
  });

  window.showDeathOverlay = showDeathOverlay;
  window.hideDeathOverlay = hideDeathOverlay;
})();
