// ============================================================
// Monster Arena — Spectator panel.
// When a bot kills the player in practice PvP, pve16.js keeps the
// simulation running and tracks the killer (state.specTarget) with the
// camera. This panel surfaces that state to the player: who they're
// spectating, plus a Respawn (restart) and Home button.
// ============================================================
(function () {
  'use strict';
  let panel = null;

  function ensure() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'overlaySpectate';
    panel.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:55;display:none;text-align:center;pointer-events:none;';
    panel.innerHTML =
      '<div style="pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 20px;border-radius:16px;' +
        'background:linear-gradient(180deg,rgba(14,10,22,.92),rgba(8,6,16,.94));border:1px solid rgba(192,102,255,.45);' +
        'box-shadow:0 12px 40px rgba(0,0,0,.6),0 0 26px rgba(160,90,255,.3)">' +
        '<div style="font:800 13px system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#c9a9ff;text-shadow:0 0 12px #6a1aa6">' +
          '👁️ Spectating <span id="specName" style="color:#fff">Killer</span>' +
        '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center">' +
          '<button class="btn bigBtn" id="specRespawn" style="background:linear-gradient(180deg,#3a0f2a,#160a1a);border:1px solid #ff5a5a;color:#ffd0d0;box-shadow:0 0 22px rgba(255,60,60,.4)">🔄 Respawn</button>' +
          '<button class="btn" id="specHome">🏠 Home</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);
    panel.querySelector('#specRespawn').addEventListener('click', () => {
      hideSpectate();
      // CTF has auto-respawn: "Respawn" just skips the remaining countdown
      // instead of restarting the whole match (which would wipe the scores).
      if (window.CTF_REVIVE && window.CTF && typeof window.CTF.skipRevive === 'function') {
        window.CTF.skipRevive();
        return;
      }
      const b = document.getElementById('btnRestart') || document.getElementById('restartBtn2');
      if (b) b.click();
    });
    panel.querySelector('#specHome').addEventListener('click', () => {
      hideSpectate();
      const b = document.getElementById('btnHome') || document.getElementById('homeBtn2');
      if (b) b.click();
    });
    return panel;
  }

  function showSpectate(name) {
    const p = ensure();
    const n = p.querySelector('#specName');
    if (n && name) n.textContent = name;
    p.style.display = 'block';
  }
  function hideSpectate() { if (panel) panel.style.display = 'none'; }

  window.showSpectate = showSpectate;
  window.hideSpectate = hideSpectate;
})();
