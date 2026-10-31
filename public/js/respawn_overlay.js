// ============================================================
// Monster Arena — online respawn screen.
// In server-run Teams / Capture the Flag a fallen player is not out of the
// match: the lobby revives them on their side's spawn after a short wait.
// This module owns that whole moment:
//   • freezes movement / fire while down (the engine already honours the
//     TEAMS_REVIVE / CTF_REVIVE freeze flags),
//   • covers the arena with a team-coloured countdown screen,
//   • snaps the player onto the spawn the lobby revived them at.
// Outside a respawn lobby it stays completely dormant.
// ============================================================
(function () {
  'use strict';

  const TEAM = {
    0: { name: 'BLUE TEAM', glow: '#3aa6ff', deep: '#0a2f6b', text: '#dff0ff' },
    1: { name: 'RED TEAM', glow: '#c1121f', deep: '#3d070c', text: '#ffdada' }
  };
  const WAIT = 4;               // seconds the lobby keeps a fallen player down

  let host = null, ring = null, countEl = null, btn = null, teamLabel = null, subEl = null, flashEl = null;
  let dead = false, deadline = 0, team = 0, poll = 0, raf = 0;

  function ensure() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'netRespawn';
    host.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:58', 'display:none',
      'align-items:center', 'justify-content:center', 'pointer-events:auto',
      'overscroll-behavior:none', 'backdrop-filter:blur(7px)',
      'background:radial-gradient(ellipse at 50% 45%, rgba(6,8,16,.6), rgba(3,4,8,.93) 72%)',
      'font-family:system-ui,-apple-system,"Segoe UI",sans-serif'
    ].join(';');

    host.innerHTML =
      '<div style="position:relative;text-align:center;padding:28px 24px;max-width:92vw">' +
        '<div id="nrTeam" style="font:800 12px/1 system-ui,sans-serif;letter-spacing:.42em;text-transform:uppercase;opacity:.9"></div>' +
        '<h2 style="margin:14px 0 4px;font:900 clamp(30px,8vw,64px)/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#f2f7ff;text-shadow:0 0 34px rgba(90,160,255,.45)">You Are Down</h2>' +
        '<p id="nrSub" style="margin:6px 0 22px;font:600 12px/1.5 system-ui,sans-serif;letter-spacing:.28em;text-transform:uppercase;opacity:.62;color:#cfe1ff">Returning to your spawn</p>' +
        '<div style="position:relative;width:min(210px,52vw);aspect-ratio:1;margin:0 auto">' +
          '<svg viewBox="0 0 120 120" style="position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)">' +
            '<circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="4"/>' +
            '<circle id="nrRing" cx="60" cy="60" r="54" fill="none" stroke="#3aa6ff" stroke-width="4" stroke-linecap="round" stroke-dasharray="339.3" stroke-dashoffset="0" style="filter:drop-shadow(0 0 10px currentColor)"/>' +
          '</svg>' +
          '<div id="nrCount" style="position:absolute;inset:0;display:grid;place-items:center;font:900 clamp(44px,13vw,76px)/1 system-ui,sans-serif;color:#fff;text-shadow:0 0 26px rgba(120,180,255,.6)">4</div>' +
        '</div>' +
        '<button id="nrBtn" type="button" disabled style="margin-top:24px;padding:14px 40px;border-radius:999px;font:900 13px/1 system-ui,sans-serif;letter-spacing:.3em;text-transform:uppercase;cursor:not-allowed;color:#eaf6ff;background:rgba(10,16,30,.75);border:1px solid rgba(140,190,255,.35);transition:box-shadow .25s ease,border-color .25s ease">Respawning</button>' +
      '</div>' +
      '<div id="nrFlash" style="position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .5s ease"></div>';

    document.body.appendChild(host);
    ring = host.querySelector('#nrRing');
    countEl = host.querySelector('#nrCount');
    btn = host.querySelector('#nrBtn');
    teamLabel = host.querySelector('#nrTeam');
    subEl = host.querySelector('#nrSub');
    flashEl = host.querySelector('#nrFlash');

    btn.addEventListener('click', function () {
      // The lobby owns the revive; this just clears the veil once the wait has
      // elapsed so the player can see the arena they are about to enter.
      if (dead && Date.now() >= deadline) hide();
    });
  }

  function me() {
    const s = window.Net && window.Net.state && window.Net.state.snapshot;
    if (!s || !Array.isArray(s.players)) return null;
    const id = window.Net.state.peerId;
    return s.players.find(function (p) { return p && p.id === id; }) || null;
  }

  function inRespawnMode() {
    return !!(window.NetObjectives && window.NetObjectives.isRespawnMode && window.NetObjectives.isRespawnMode());
  }

  function freeze(on) {
    // The engine's existing revive flags already lock movement and firing.
    if (on) {
      if (window.CTF_MODE) window.CTF_REVIVE = true; else window.TEAMS_REVIVE = true;
    } else {
      window.TEAMS_REVIVE = false;
      window.CTF_REVIVE = false;
    }
  }

  function paint(frac) {
    if (ring) ring.setAttribute('stroke-dashoffset', String(339.3 * (1 - Math.max(0, Math.min(1, frac)))));
  }

  function frame() {
    if (!dead) return;
    const left = Math.max(0, (deadline - Date.now()) / 1000);
    if (countEl) countEl.textContent = left > 0 ? String(Math.ceil(left)) : '✓';
    paint(left / WAIT);
    if (left <= 0 && btn && btn.disabled) {
      btn.disabled = false;
      btn.style.cursor = 'pointer';
      btn.style.boxShadow = '0 0 28px ' + TEAM[team].glow;
      btn.style.borderColor = TEAM[team].glow;
      if (subEl) subEl.textContent = 'Your lane is clear';
    }
    raf = requestAnimationFrame(frame);
  }

  function show(teamIdx) {
    ensure();
    team = (teamIdx === 0 || teamIdx === 1) ? teamIdx : 0;
    const look = TEAM[team];
    teamLabel.textContent = look.name;
    teamLabel.style.color = look.glow;
    if (ring) { ring.setAttribute('stroke', look.glow); ring.style.color = look.glow; }
    if (countEl) countEl.style.textShadow = '0 0 30px ' + look.glow;
    host.style.background = 'radial-gradient(ellipse at 50% 45%, ' + look.deep + 'cc, rgba(3,4,8,.94) 72%)';
    if (subEl) subEl.textContent = 'Returning to your spawn';
    btn.disabled = true;
    btn.style.cursor = 'not-allowed';
    btn.style.boxShadow = 'none';
    btn.style.borderColor = 'rgba(140,190,255,.35)';
    btn.textContent = 'Respawning';
    host.style.display = 'flex';
    deadline = Date.now() + WAIT * 1000;
    cancelAnimationFrame(raf);
    frame();
  }

  function hide() {
    if (!dead && !host) return;
    dead = false;
    cancelAnimationFrame(raf);
    if (host) host.style.display = 'none';
  }

  function revive(snap) {
    hide();
    freeze(false);
    // Back on the spawn the lobby placed us at.
    const p = (typeof window.__pvePlayer === 'function') ? window.__pvePlayer() : null;
    if (p && snap && typeof snap.x === 'number' && typeof snap.y === 'number') {
      p.x = snap.x;
      p.y = snap.y;
    }
    // A short team-coloured arrival flash so the return reads clearly.
    if (flashEl && host && host.style.display !== 'none') { /* overlay already hidden */ }
    if (host) {
      flashEl.style.background = 'radial-gradient(circle at 50% 50%, ' + TEAM[team].glow + '55, transparent 62%)';
      host.style.display = 'flex';
      flashEl.style.transition = 'none';
      flashEl.style.opacity = '1';
      requestAnimationFrame(function () {
        flashEl.style.transition = 'opacity .45s ease';
        flashEl.style.opacity = '0';
      });
      setTimeout(function () { if (!dead && host) host.style.display = 'none'; }, 470);
    }
  }

  function pollOnce() {
    if (!inRespawnMode()) {
      if (dead) { hide(); freeze(false); }
      return;
    }
    const snap = me();
    if (!snap) {
      if (dead) { hide(); freeze(false); }
      return;
    }
    const down = typeof snap.hp === 'number' && snap.hp <= 0;
    if (down && !dead) {
      dead = true;
      freeze(true);
      show(snap.team);
    } else if (!down && dead) {
      revive(snap);
    }
  }

  ensure();
  setInterval(pollOnce, 120);
  window.NetRespawn = { get visible() { return dead; }, hide: hide, team: function () { return team; } };
  window.NET_DEAD = false;
})();
