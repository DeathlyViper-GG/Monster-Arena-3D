/* realm_select.js — Cursed-realms level cards for the Offline + Singleplayer
   level-select overlays. Renders image-based realm cards (Cinzel/Sora/JetBrains
   Mono design from realm_select.css) into the shared #levelsGrid and tracks
   the selected card + footer accent. Exposes window.RealmSelect.render(). */
(function () {
  'use strict';

  var REALM_ART = {
    1: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/1ead5fb8f_generated_image.png', icon: '🌱', deep: '#06251a' },
    2: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/cfd1a0d8b_generated_image.png', icon: '🌪️', deep: '#2a1d08' },
    3: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/c59d83b7c_generated_image.png', icon: '❄️', deep: '#092234' },
    4: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/63511e23b_generated_image.png', icon: '🔥', deep: '#2d0b06' },
    5: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/b56c2b090_generated_image.png', icon: '🌀', deep: '#1a0f33' }
  };

  function selectRealm(grid, theme) {
    var art = REALM_ART[theme.id] || {};
    var accent = theme.accent, deep = art.deep || '#0a0c14';
    var nodes = grid.querySelectorAll('.realm-card');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('is-selected', String(nodes[i].dataset.level) === String(theme.id));
    }
    var ov = grid.closest('.realm-select');
    if (ov) ov.style.setProperty('--rs-accent', accent);
    var set = function (n, b) { var N = document.getElementById(n), B = document.getElementById(b); if (N) N.textContent = theme.id + '. ' + theme.name; if (B) B.textContent = theme.badge || ''; };
    set('offlineSelectedName', 'offlineSelectedBadge');
    set('singleSelectedName', 'singleSelectedBadge');
    [document.getElementById('offlineSelectedName'), document.getElementById('singleSelectedName')].forEach(function (nm) { if (nm) nm.style.color = accent; });
    [document.getElementById('offlineSelectedBadge'), document.getElementById('singleSelectedBadge')].forEach(function (bd) { if (bd) { bd.style.borderColor = accent + '55'; bd.style.color = accent; bd.style.background = accent + '14'; } });
  }

  function buildCard(theme) {
    var art = REALM_ART[theme.id] || {};
    var card = document.createElement('button');
    card.type = 'button'; card.className = 'realm-card'; card.dataset.level = theme.id;
    card.style.setProperty('--accent', theme.accent);
    card.style.setProperty('--deep', art.deep || '#0a0c14');
    card.setAttribute('aria-label', theme.id + '. ' + theme.name + ' — ' + (theme.badge || ''));
    card.innerHTML =
      '<span class="rs-shadow" aria-hidden="true"></span>' +
      '<div class="rs-inner">' +
        '<div class="rs-media">' +
          '<img class="rs-img" src="' + (art.image || '') + '" alt="' + theme.name + '" loading="lazy">' +
          '<div class="rs-tint"></div><div class="rs-fade"></div><div class="rs-spot"></div>' +
          '<div class="rs-icon">' + (art.icon || '') + '</div>' +
          '<div class="rs-badge"><span class="rs-dot"></span>' + ((theme.badge || '').toUpperCase()) + '</div>' +
          '<div class="rs-orb"><div class="rs-orb-glow"></div><div class="rs-orb-core"></div></div>' +
          '<span class="rs-sheen"></span>' +
        '</div>' +
        '<div class="rs-body">' +
          '<div class="rs-head"><span class="rs-idx">0' + theme.id + '</span><h3 class="rs-name">' + theme.name + '</h3></div>' +
          '<p class="rs-caption">' + (theme.desc || '') + '</p>' +
          '<div class="rs-bar"><span class="rs-bar-fill"></span></div>' +
        '</div>' +
      '</div>';
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      card.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', function () { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
    return card;
  }

  window.RealmSelect = {
    REALM_ART: REALM_ART,
    render: function (grid, levels, onSelect) {
      if (!grid) return;
      grid.innerHTML = '';
      levels.forEach(function (theme) {
        var card = buildCard(theme);
        card.addEventListener('click', function () { onSelect(theme); });
        grid.appendChild(card);
      });
      selectRealm(grid, levels[0]);
    }
  };
})();
