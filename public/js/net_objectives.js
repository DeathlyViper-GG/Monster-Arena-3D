// ============================================================
// Monster Arena — online Teams / Capture the Flag rendering bridge.
// The offline modes feed Teams.snapshot() / CTF.snapshot() into the renderer;
// in multiplayer the authoritative lobby snapshot carries the same shapes
// (giants, golems, bases, flags), so this module hands them to the 3D frame
// and draws a compact 2D version when the game runs without 3D.
// ============================================================
(function () {
  'use strict';

  function snapRaw() { return window.Net?.state?.snapshot || null; }

  function myTeam() {
    const s = snapRaw();
    const id = window.Net?.state?.peerId;
    if (!s || !Array.isArray(s.players)) return null;
    const me = s.players.find((p) => p.id === id);
    return me && (me.team === 0 || me.team === 1) ? me.team : null;
  }

  function frame(F, snap) {
    const s = snap !== undefined ? snap : snapRaw();
    const mine = myTeam();

    // Team markers for remote players (the 3D renderer tags remotes by team).
    if (F.remotes && s && Array.isArray(s.players)) {
      const byId = new Map(s.players.map((p) => [p.id, p]));
      for (const r of F.remotes) {
        const p = byId.get(r.id);
        r.team = p && (p.team === 0 || p.team === 1) ? p.team : null;
      }
    }

    F.teams = (window.TEAMS_MODE && window.Teams) ? window.Teams.snapshot() : null;
    if (!F.teams && s && s.teams) {
      F.teams = s.teams;
      F.teams.playerTeam = mine == null ? 0 : mine;
    }

    F.ctf = (window.CTF_MODE && window.CTF) ? window.CTF.snapshot() : null;
    if (!F.ctf && s && s.ctf) {
      F.ctf = s.ctf;
      F.ctf.playerTeam = mine == null ? 0 : mine;
      const id = window.Net?.state?.peerId;
      const me = (s.players || []).find((p) => p.id === id);
      F.ctf.playerCarrying = !!(me && me.carrying);
    }
  }

  function draw2D(ctx, cam) {
    const s = snapRaw();
    if (!s || (!s.teams && !s.ctf)) return;
    const t = performance.now() / 1000;
    const mine = myTeam() == null ? 0 : myTeam();
    const col = (team) => (team === mine ? '#3aa6ff' : '#ff4a4a');
    const toS = (x, y) => ({ x: x - cam.x - cam.sx, y: y - cam.y - cam.sy });

    if (s.teams && Array.isArray(s.teams.giants)) {
      for (const g of s.teams.giants) {
        const p = toS(g.x, g.y), c = col(g.team);
        ctx.save();
        const grd = ctx.createRadialGradient(p.x, p.y, g.r * 0.2, p.x, p.y, g.r);
        grd.addColorStop(0, c + 'cc'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2 + g.team);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(p.x, p.y, g.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, g.r, 0, Math.PI * 2); ctx.stroke();
        const pct = Math.max(0, Math.min(1, g.hp / (g.maxhp || 1)));
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(p.x - 60, p.y - g.r - 18, 120, 8);
        ctx.fillStyle = c; ctx.fillRect(p.x - 60, p.y - g.r - 18, 120 * pct, 8);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(g.name || '', p.x, p.y - g.r - 24);
        ctx.restore();
      }
      for (const go of (s.teams.golems || [])) {
        const p = toS(go.x, go.y), c = go.activated ? col(go.team) : '#e6e8ee';
        ctx.save();
        ctx.fillStyle = 'rgba(40,44,56,.85)'; ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, go.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (!go.activated) {
          const lead = Math.max((go.dmg && go.dmg[0]) || 0, (go.dmg && go.dmg[1]) || 0) / (go.threshold || 1);
          ctx.strokeStyle = '#ffd7a3'; ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, go.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, lead));
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (s.ctf) {
      for (const b of (s.ctf.bases || [])) {
        const p = toS(b.x, b.y), c = col(b.team);
        ctx.save(); ctx.strokeStyle = c; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(p.x, p.y, b.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      for (const f of (s.ctf.flags || [])) {
        const p = toS(f.x, f.y), c = col(f.team);
        ctx.save(); ctx.strokeStyle = '#cfd6e4'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 30); ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath();
        ctx.moveTo(p.x, p.y - 30); ctx.lineTo(p.x + 18, p.y - 22); ctx.lineTo(p.x, p.y - 14);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  // Team modes respawn their players: a dead player must wait for the server
  // instead of triggering the single-player game-over screen.
  function isRespawnMode() {
    const mode = window.Net?.state?.meta?.mode;
    return !!(window.Net?.state?.lobbyId && (mode === 'teams' || mode === 'ctf'));
  }

  function respawnWait() {
    if (!isRespawnMode()) return false;
    const s = snapRaw();
    if (!s || !Array.isArray(s.players)) return false;
    const me = s.players.find((p) => p.id === window.Net?.state?.peerId);
    return !!me && typeof me.hp === 'number' && me.hp <= 0;
  }

  window.NetObjectives = { frame, draw2D, isRespawnMode, respawnWait };
})();
