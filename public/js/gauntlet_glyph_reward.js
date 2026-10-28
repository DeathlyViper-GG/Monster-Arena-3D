// ============================================================
// Monster Arena — Gauntlet Warden-death Glyph Reward
// When a Warden dies in the Hollow Gauntlet, freeze the fight
// and show the REAL glyph upgrade overlay (the same one used
// between waves, with the actual glyph images + pentagon UI from
// pve16). The player picks an element and presses Enchant → the
// ENTIRE element tree is unlocked (all 9 node flags on the live
// player object) + 100 reserve ammo, then the overlay closes and
// the fight resumes.
// Reuses window.GlyphUI.pentagon (drawGlyphPentagonUI) from pve16
// so the chooser is identical to the normal glyph upgrade screen.
// Exposes window.openGauntletGlyphReward(onDone).
// ============================================================
(function () {
  'use strict';

  let raf = 0, selected = null, onDoneCb = null, prevGlyphPath = null;
  let canvas, gctx, ov, titleEl, descEl, btn, costEl, timerRow, essenceChip;

  function init() {
    canvas = document.getElementById('glyphCanvas');
    gctx = canvas && canvas.getContext('2d');
    ov = document.getElementById('overlayGlyphs');
    titleEl = document.getElementById('glyphTitle');
    descEl = document.getElementById('glyphDesc');
    btn = document.getElementById('glyphEnchant');
    costEl = document.getElementById('glyphCost');
    const tEl = document.getElementById('glyphTimer');
    timerRow = tEl ? tEl.parentElement : null;
    essenceChip = document.querySelector('.glyph-essence');
  }

  function dbgState() { return window.__dbg && window.__dbg.state; }
  function livePlayer() { return (window._Gauntlet && window._Gauntlet.player) || (window.__dbg && window.__dbg.player); }

  function draw() {
    if (!ov || ov.style.display !== 'grid') return;
    const UI = window.GlyphUI;
    if (!UI || typeof UI.pentagon !== 'function') return;
    const W = canvas.width, H = canvas.height;
    gctx.clearRect(0, 0, W, H);
    const t = performance.now() / 1000;
    // soft elemental wash tinted to the current selection
    if (typeof UI.rgba === 'function') {
      const cx = W / 2, cy = H / 2;
      const st = (selected && UI.style[selected]) ? UI.style[selected] : UI.style.lightning;
      const g = gctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6);
      g.addColorStop(0, UI.rgba(st.main, 0.06)); g.addColorStop(1, 'rgba(0,0,0,0)');
      gctx.fillStyle = g; gctx.fillRect(0, 0, W, H);
    }
    // the real glyph-image pentagon (drawGlyphPentagonUI from pve16)
    try { UI.pentagon(gctx, t); } catch (_) {}
    raf = requestAnimationFrame(draw);
  }

  function onClick(ev) {
    const UI = window.GlyphUI; if (!UI || !UI.layout) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const cx = canvas.width * 0.5, cy = canvas.height * 0.5 + 40, R = 140;
    const nodes = UI.layout(cx, cy, R);
    for (const n of nodes) {
      const dx = mx - n.x, dy = my - n.y;
      if (dx * dx + dy * dy <= (n.r + 10) * (n.r + 10)) {
        selected = n.g;
        const p = livePlayer();
        if (p) p.glyphPath = n.g;   // drawGlyphPentagonUI highlights this node
        if (UI.core && UI.core[n.g]) {
          if (titleEl) titleEl.textContent = UI.core[n.g].name;
          if (descEl) descEl.textContent = 'Enchant to unlock the entire ' + UI.core[n.g].name + ' glyph tree and gain 100 reserve ammo.';
        }
        if (costEl) costEl.textContent = 'FREE';
        if (btn) btn.disabled = false;
        return;
      }
    }
  }

  function applyEnchant() {
    if (!selected) return;
    const UI = window.GlyphUI; if (!UI || !UI.keys) return;
    const el = selected;
    const p = livePlayer();
    if (p) {
      if (!p.glyph) p.glyph = {};
      if (!p.glyph[el]) p.glyph[el] = {};
      for (const branch of UI.keys[el]) for (const k of branch) p.glyph[el][k] = true;
      p.glyphPath = el;
      p.glyphTier = 3;
      p.completedGlyphs = p.completedGlyphs || {};
      p.completedGlyphs[el] = true;
      p.reserve = (p.reserve || 0) + 100;
    }
    const s = dbgState();
    if (s) { s.path = el; s.tier = 3; if (!s.completed) s.completed = {}; s.completed[el] = true; }
    close(true);
  }

  function close(enchanted) {
    cancelAnimationFrame(raf); raf = 0;
    if (canvas) canvas.onclick = null;
    if (btn) btn.onclick = null;
    if (timerRow) timerRow.style.display = '';
    if (essenceChip) essenceChip.style.display = '';
    if (ov) ov.style.display = 'none';
    // Definitively release every freeze the gauntlet reward holds: the intro
    // flag (player input + warden AI + firing), the stuck cinematic camera
    // pin, and the glyph-phase bullet/player lock. Without all three the
    // player stays "stuck" after the overlay vanishes.
    window._GAUNTLET_INTRO = false;
    window._GAUNTLET_INTRO_CAM = null;
    const s = dbgState(); if (s) s.phase = 'combat';
    // Clear any latched movement/fire inputs so the next frame starts clean.
    if (window.__dbg && window.__dbg.player) {
      const p = window.__dbg.player;
      if (p && p.vx !== undefined) { p.vx = 0; p.vy = 0; }
    }
    // if the player backed out without enchanting, restore the prior path
    if (!enchanted) { const p = livePlayer(); if (p && prevGlyphPath !== undefined) p.glyphPath = prevGlyphPath; }
    selected = null;
    const cb = onDoneCb; onDoneCb = null;
    if (typeof cb === 'function') cb();
  }

  function open(onDone) {
    init();
    if (!ov || !canvas || !gctx || !window.GlyphUI) { if (typeof onDone === 'function') onDone(); return; }
    window._GAUNTLET_INTRO = true;          // freeze warden AI + player firing
    const s = dbgState(); if (s) s.phase = 'glyph';   // freeze bullets via glyphFrozen()
    selected = null; onDoneCb = onDone;
    const p = livePlayer(); prevGlyphPath = p ? p.glyphPath : null;
    if (timerRow) timerRow.style.display = 'none';
    if (essenceChip) essenceChip.style.display = 'none';
    if (titleEl) titleEl.textContent = 'CLAIM A GLYPH PATH';
    if (descEl) descEl.textContent = 'A Warden falls. Choose an element — its entire glyph tree will be enchanted, and you gain 100 reserve ammo.';
    if (costEl) costEl.textContent = 'FREE';
    if (btn) { btn.disabled = true; btn.textContent = 'ENCHANT'; btn.onclick = applyEnchant; }
    canvas.onclick = onClick;
    ov.style.display = 'grid';
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  window.openGauntletGlyphReward = open;
})();
