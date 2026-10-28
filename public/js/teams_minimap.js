// ============================================================
// Teams-mode minimap overlay.
// pve16.js's drawMinimap() is buried inside a huge IIFE we can't grow, so
// this file draws the giant + activated-golem markers on top of the shared
// #mini canvas each frame instead. It recomputes the same world→minimap
// transform drawMinimap uses (CSS-pixel space, centred, uniform scale) from
// the live canvas dimensions, so the icons line up exactly with the arena
// border and buildings the base minimap already drew.
// ============================================================
(function () {
  'use strict';

  function draw() {
    if (!window.TEAMS_MODE || !window.Teams || !window.Teams.getGiants) return;
    const mini = document.getElementById('mini');
    if (!mini) return;
    const ctx = mini.getContext('2d');
    const world = window.Teams.getWorld ? window.Teams.getWorld() : null;
    if (!world) return;

    const dpr = mini.width / (mini.clientWidth || mini.width);
    const mw = mini.clientWidth || (mini.width / dpr);
    const mh = mini.clientHeight || (mini.height / dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(mw / world.w, mh / world.h);
    const offsetX = (mw - world.w * scale) * 0.5;
    const offsetY = (mh - world.h * scale) * 0.5;
    const tx = x => offsetX + x * scale;
    const ty = y => offsetY + y * scale;

    const now = performance.now();

    // giants
    const gs = window.Teams.getGiants();
    for (const g of gs) {
      const col = (g.team === 0) ? '#3aa6ff' : '#ff4a4a';
      ctx.save();
      ctx.fillStyle = col; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(tx(g.x), ty(g.y), 6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(tx(g.x), ty(g.y), 9, 0, Math.PI * 2); ctx.stroke();
      if ((g.underAttackT || 0) > 0) {
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 120);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tx(g.x), ty(g.y), 12, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // activated golems
    const gos = window.Teams.getGolems ? window.Teams.getGolems() : [];
    for (const go of gos) {
      if (!go.activated) continue;
      ctx.fillStyle = (go.team === 0) ? '#3aa6ff' : '#ff4a4a';
      ctx.beginPath(); ctx.arc(tx(go.x), ty(go.y), 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop() { draw(); requestAnimationFrame(loop); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loop);
  else loop();
})();
