// ============================================================
// CTF-mode minimap overlay.
// pve16.js's drawMinimap() is a huge IIFE we can't grow, so this
// file draws the CTF bases + flags (+ carrier dots) on top of the
// shared #mini canvas each frame, recomputing the same world→minimap
// transform drawMinimap uses (CSS-pixel space, centred, uniform scale).
// ============================================================
(function () {
  'use strict';

  function draw() {
    if (!window.CTF_MODE || !window.CTF) return;
    const mini = document.getElementById('mini');
    if (!mini) return;
    const world = (window.__dbg && window.__dbg.world) || (window.CTF.getWorld && window.CTF.getWorld());
    if (!world) return;
    const snap = window.CTF.snapshot();
    if (!snap) return;
    const ctx = mini.getContext('2d');
    const dpr = mini.width / (mini.clientWidth || mini.width);
    const mw = mini.clientWidth || (mini.width / dpr);
    const mh = mini.clientHeight || (mini.height / dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(mw / world.w, mh / world.h);
    const offsetX = (mw - world.w * scale) * 0.5;
    const offsetY = (mh - world.h * scale) * 0.5;
    const tx = x => offsetX + x * scale;
    const ty = y => offsetY + y * scale;
    const my = snap.playerTeam;
    const col = t => (t === my) ? '#3aa6ff' : '#ff4a4a';
    const now = performance.now();

    // bases
    for (const base of snap.bases) {
      const c = col(base.team);
      ctx.save();
      ctx.fillStyle = c; ctx.globalAlpha = 0.18;
      ctx.beginPath(); ctx.arc(tx(base.x), ty(base.y), Math.max(3, base.r * scale), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.shadowColor = c; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(tx(base.x), ty(base.y), Math.max(3, base.r * scale), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // flags
    for (const f of snap.flags) {
      const c = col(f.team);
      const x = tx(f.x), y = ty(f.y);
      if (f.state === 'carried') {
        // pulsing dot so a carried flag is still visible on the map
        ctx.save(); ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(x, y, 3 + Math.sin(now / 150) * 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else {
        ctx.save(); ctx.fillStyle = c; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.shadowColor = c; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (f.state === 'dropped') {
          ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 120);
          ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    // carriers: a bright ring around the carrying bot/player
    const mark = (x, y, team) => {
      const c = col(team);
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.shadowColor = c; ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 120);
      ctx.beginPath(); ctx.arc(tx(x), ty(y), 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    };
    if (snap.playerCarrying && window.__dbg && window.__dbg.player) mark(window.__dbg.player.x, window.__dbg.player.y, 0);
    if (window.__BOTS__ && window.__BOTS__.SP_BOTS) for (const b of window.__BOTS__.SP_BOTS) if (b.hp > 0 && b._ctfCarrying) mark(b.x, b.y, b.team);
  }

  function loop() { try { draw(); } catch (_) {} requestAnimationFrame(loop); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loop);
  else loop();
})();
