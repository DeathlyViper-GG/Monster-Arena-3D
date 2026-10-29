// ============================================================
// Monster Arena — Gauntlet Combined-Biome Map
// Renders the Soul Doorway arena as five clearly-distinct vertical
// biome bands (Meadow → Dunes → Glacial → Cinder → Void) inside a
// single normal-size PvE map. Each band has its own themed floor
// texture, a strong accent-tinted gradient, a glowing top edge, and
// a biome name label, with bright dividers between them. Installed
// as window._gauntletFloorHook by HollowGauntlet.start().
// Exposes window.GauntletMap = { drawFloor, install, remove }.
// ============================================================
(function () {
  'use strict';

  const LABELS = ['MEADOW', 'DUNES', 'GLACIAL', 'CINDER', 'VOID'];

  function drawFloor(ctx, W, H, cam) {
    const G = window._Gauntlet; if (!G || !G.LEVELS || !G.getThemeTile || !G.world) return;
    const themes = [1, 2, 3, 4, 5].map(function (id) { return G.LEVELS.find(function (l) { return l.id === id; }) || G.LEVELS[0]; });
    const w = G.world;
    const bw = w.w / 5;
    const wx0 = -cam.x - cam.sx, wy0 = -cam.y - cam.sy;

    for (let i = 0; i < 5; i++) {
      const th = themes[i];
      const x0 = i * bw, x1 = (i + 1) * bw;
      const sx0 = wx0 + x0, sx1 = wx0 + x1;
      if (sx1 < 0 || sx0 > W) continue;
      const cx0 = Math.max(0, sx0), cw = Math.min(W, sx1) - cx0;
      if (cw <= 0) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx0, 0, cw, H); ctx.clip();

      // base gradient: accent-tinted top → dark floor bottom (clearly distinct per biome)
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, th.accent + '26');       // accent tint at top
      g.addColorStop(0.35, th.floor.c1);
      g.addColorStop(1, th.floor.c2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // themed texture tile, scrolling with the world
      const tile = G.getThemeTile(th);
      if (tile && tile.width) {
        const pat = ctx.createPattern(tile, 'repeat');
        const btx = -((cam.x + cam.sx) % tile.width);
        const bty = -((cam.y + cam.sy) % tile.height);
        ctx.save(); ctx.translate(btx, bty); ctx.fillStyle = pat; ctx.fillRect(-btx, -bty, W, H); ctx.restore();
      }

      // glowing top edge in the biome accent
      const tg = ctx.createLinearGradient(0, 0, 0, H * 0.22);
      tg.addColorStop(0, th.accent + '55'); tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = tg; ctx.fillRect(0, 0, W, H * 0.22); ctx.restore();

      ctx.restore();

      // biome name label at the top of the band
      const labelX = wx0 + (i + 0.5) * bw;
      if (labelX > -40 && labelX < W + 40) {
        ctx.save();
        ctx.font = '700 13px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = th.accent; ctx.globalAlpha = 0.85;
        ctx.shadowColor = th.accent; ctx.shadowBlur = 12;
        ctx.fillText(LABELS[i], labelX, 12);
        ctx.restore();
      }
    }

    // bright glowing dividers between biomes
    for (let i = 1; i < 5; i++) {
      const sx = wx0 + i * bw;
      if (sx < -12 || sx > W + 12) continue;
      const acc = themes[i].accent;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createLinearGradient(sx - 9, 0, sx + 9, 0);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.5, acc + '66');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(sx - 9, 0, 18, H);
      ctx.fillStyle = acc + 'cc'; ctx.fillRect(sx - 1, 0, 2, H);
      ctx.restore();
    }
  }

  function install() { window._gauntletFloorHook = drawFloor; window._GAUNTLET_MAP = true; }
  function remove() { delete window._gauntletFloorHook; window._GAUNTLET_MAP = false; }

  window.GauntletMap = { drawFloor, install, remove };
})();
