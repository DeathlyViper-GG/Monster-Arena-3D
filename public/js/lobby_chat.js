// ============================================================
// Monster Arena — multiplayer roster, chat room and objective HUD.
// Chat rides the authoritative lobby state (game_server `chat` op) so it
// works for anonymous players with no extra backend or entity access.
// Also draws the Teams / CTF objective readout (titants, flag score, your
// side) as a DOM overlay so it shows in both the 2D and 3D renderers.
// ============================================================
(function () {
  'use strict';

  const TEAM_NAME = ['BLUE', 'RED'];

  const lobbyFeed = document.getElementById('mpChatFeed');
  const lobbyInput = document.getElementById('mpChatInput');
  const lobbySend = document.getElementById('mpChatSend');
  const rosterEl = document.getElementById('mpRoster');
  const hud = document.getElementById('chatHud');
  const chatFeed = document.getElementById('chatFeed');
  const chatInput = document.getElementById('chatInput');
  const chatToggle = document.getElementById('chatToggle');
  const objectiveEl = document.getElementById('netObjective');

  let lastMsgT = 0;
  let rendered = [];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function net() { return (window.Net && window.Net.state) || null; }
  function snap() { return net() ? window.Net.state.snapshot : null; }
  function myId() { return net() ? window.Net.state.peerId : null; }

  function myTeam() {
    const s = snap();
    if (!s || !Array.isArray(s.players)) return null;
    const me = s.players.find((p) => p.id === myId());
    return me && (me.team === 0 || me.team === 1) ? me.team : null;
  }

  // ------------------------------------------------------------- chat
  function appendMessage(m) {
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = '<b>' + esc(m.name || 'Player') + '</b> ' + esc(m.text || '');
    return line;
  }

  function renderChat(list) {
    if (lobbyFeed) {
      lobbyFeed.innerHTML = '';
      for (const m of list) lobbyFeed.appendChild(appendMessage(m));
      lobbyFeed.scrollTop = lobbyFeed.scrollHeight;
    }
    if (chatFeed) {
      chatFeed.innerHTML = '';
      for (const m of list.slice(-7)) chatFeed.appendChild(appendMessage(m));
    }
  }

  function send(text) {
    const body = String(text || '').trim();
    if (!body || !net()) return;
    window.Net.sendChat(body);
  }

  // ------------------------------------------------------------- roster
  function renderRoster(s) {
    if (!rosterEl) return;
    if (!s || !Array.isArray(s.players)) {
      rosterEl.textContent = 'Join a lobby to see the roster.';
      return;
    }
    const counts = [0, 1].map((t) => s.players.filter((p) => p.team === t).length);
    const botCounts = [0, 1].map((t) => (s.bots || []).filter((b) => b && b.team === t).length);
    const teamMode = s.mode === 'teams' || s.mode === 'ctf';
    let html = '';
    if (teamMode) {
      html += '<div class="mp-roster-line mp-roster-head">';
      html += '<span class="mp-side mp-side--blue">BLUE ' + counts[0] + ' humans · ' + botCounts[0] + ' bots</span>';
      html += '<span class="mp-side mp-side--red">RED ' + counts[1] + ' humans · ' + botCounts[1] + ' bots</span>';
      html += '</div>';
    }
    for (const p of s.players) {
      const tag = teamMode && (p.team === 0 || p.team === 1)
        ? '<span class="mp-side ' + (p.team === 0 ? 'mp-side--blue' : 'mp-side--red') + '">' + TEAM_NAME[p.team] + '</span>'
        : '';
      html += '<div class="mp-roster-line">' + esc(p.name || p.id)
        + (p.id === myId() ? ' <b>(YOU)</b>' : '') + ' ' + tag + '</div>';
    }
    rosterEl.innerHTML = html;
  }

  // ------------------------------------------------------------- objectives
  function renderObjective(s) {
    if (!objectiveEl) return;
    // The lobby's mode decides which objective readout exists: a Teams match
    // shows titans only, a CTF match shows the flag score only. Anything else
    // means a stale payload from a previous mode reached us — ignore it.
    const mode = String(s?.mode || s?.meta?.mode || window.Net?.state?.meta?.mode || localStorage.getItem('arenaMode') || 'pve').toLowerCase();
    const teams = mode === 'teams' ? s.teams : null;
    const ctf = mode === 'ctf' ? s.ctf : null;
    if (!teams && !ctf) { objectiveEl.style.display = 'none'; return; }
    const mine = myTeam();
    const mineLabel = mine == null ? 'SPECTATOR' : TEAM_NAME[mine];
    let html = '<div class="obj-mine">YOU · <b class="' + (mine === 0 ? 'mp-blue' : 'mp-red') + '">' + mineLabel + '</b></div>';

    if (teams && teams.giants) {
      for (const g of teams.giants) {
        const pct = Math.max(0, Math.min(1, g.hp / (g.maxhp || 1)));
        html += '<div class="obj-giant ' + (g.team === 0 ? 'obj-blue' : 'obj-red') + '">'
          + '<span>' + esc(g.name || TEAM_NAME[g.team] + ' TITAN') + '</span>'
          + '<span class="obj-bar"><span style="width:' + (pct * 100).toFixed(1) + '%"></span></span>'
          + '</div>';
      }
    }
    if (ctf) {
      html += '<div class="obj-score"><span class="mp-blue">BLUE ' + ctf.scores[0] + '</span>'
        + '<span class="obj-dash">—</span>'
        + '<span class="mp-red">' + ctf.scores[1] + ' RED</span>'
        + '<span class="obj-target">first to 5</span></div>';
      const enemyFlag = ctf.flags ? ctf.flags.find((f) => f.team !== mine) : null;
      if (enemyFlag) {
        const where = enemyFlag.state === 'carried' ? 'CARRIED' : enemyFlag.state === 'dropped' ? 'DROPPED' : 'AT BASE';
        html += '<div class="obj-flag">Enemy flag: ' + where + '</div>';
      }
    }
    if (ctf && ctf.over) {
      html += '<div class="obj-over">' + (ctf.winner === mine ? 'VICTORY' : 'DEFEAT') + '</div>';
    } else if (teams && teams.over) {
      html += '<div class="obj-over">' + (teams.winner === mine ? 'VICTORY' : 'DEFEAT') + '</div>';
    }
    objectiveEl.innerHTML = html;
    objectiveEl.style.display = 'block';
  }

  // ------------------------------------------------------------- events
  window.addEventListener('net:snapshot', (ev) => {
    const s = ev.detail || snap();
    if (!s) return;
    renderRoster(s);
    renderObjective(s);
    const list = Array.isArray(s.chat) ? s.chat : [];
    if (list.length && list[list.length - 1].t !== lastMsgT) {
      lastMsgT = list[list.length - 1].t;
      rendered = list;
      renderChat(rendered);
    }
  });

  window.addEventListener('net:meta', () => {
    renderRoster(snap());
    renderObjective(snap());
  });

  function wire(input, button) {
    if (button) button.addEventListener('click', () => { if (input) { send(input.value); input.value = ''; } });
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      // Never let chat keystrokes reach the game's global key handlers.
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); send(input.value); input.value = ''; }
      if (e.key === 'Escape') { e.preventDefault(); input.blur(); if (input === chatInput) toggleHud(false); }
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
    input.addEventListener('keypress', (e) => e.stopPropagation());
  }

  wire(lobbyInput, lobbySend);
  wire(chatInput, null);

  function toggleHud(force) {
    if (!hud) return;
    const open = force != null ? force : hud.style.display === 'none';
    hud.style.display = open ? 'flex' : 'none';
    if (open && chatInput) setTimeout(() => chatInput.focus(), 10);
    if (!open && chatInput) chatInput.blur();
  }

  if (chatToggle) chatToggle.addEventListener('click', () => toggleHud());

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!net() || !net().lobbyId) return;
    e.preventDefault();
    toggleHud(true);
  }, true);

  window.LobbyChat = { toggle: toggleHud, send };
})();
