/* ============================================================
   realm_cards.js — Realm-card level select for the Offline +
   Singleplayer overlays. Exposes:
     window.REALM_META       — per-realm image/accent/deep/icon
     window.buildRealmCard(theme) — returns a configured card
     window.selectRealm(theme)   — highlight + footer + accent
   buildHome() in pve16.js calls these so the same grid powers
   both overlays (and Multi, where it simply reflows).
   ============================================================ */
(function () {
  'use strict';

  var REALM_META = {
    1: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/1ead5fb8f_generated_image.png', accent: '#5ee08f', deep: '#06251a', icon: '🌱' },
    2: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/cfd1a0d8b_generated_image.png', accent: '#e9c574', deep: '#2a1d08', icon: '🌪️' },
    3: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/c59d83b7c_generated_image.png', accent: '#7fd0ff', deep: '#092234', icon: '❄️' },
    4: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/63511e23b_generated_image.png', accent: '#ff8354', deep: '#2d0b06', icon: '🔥' },
    5: { image: 'https://media.base44.com/images/public/6ae1ee3d9864dd82cfe0783a/b56c2b090_generated_image.png', accent: '#b492ff', deep: '#1a0f33', icon: '🌀' }
  };
  window.REALM_META = REALM_META;

  function overlayOf(grid) { return grid ? grid.closest('.realm-overlay') : null; }

  function setRailAccent(grid, accent) {
    var ov = overlayOf(grid); if (ov) ov.style.setProperty('--rail-accent', accent);
  }

  window.buildRealmCard = function (theme) {
    var m = REALM_META[theme.id] || {};
    var accent = m.accent || theme.accent || '#7dffa3';
    var deep = m.deep || '#0a0c14';
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'realm-card';
    card.dataset.level = theme.id;
    card.setAttribute('aria-label', theme.id + '. ' + theme.name + ' — ' + (theme.badge || ''));
    card.style.setProperty('--accent', accent);
    card.style.setProperty('--deep', deep);
    card.innerHTML =
      '<span class="realm-shadow" aria-hidden="true"></span>' +
      '<div class="realm-card-inner">' +
        '<div class="realm-media">' +
          '<img class="realm-img" src="' + (m.image || '') + '" alt="' + theme.name + '" loading="lazy">' +
          '<div class="realm-tint"></div>' +
          '<div class="realm-fade"></div>' +
          '<div class="realm-spot"></div>' +
          '<div class="realm-icon">' + (m.icon || '') + '</div>' +
          '<div class="realm-badge"><span class="realm-badge-dot"></span>' + ((theme.badge || '').toUpperCase()) + '</div>' +
          '<div class="realm-orb"><span class="realm-orb-glow"></span><span class="realm-orb-core"></span></div>' +
          '<span class="realm-sheen"></span>' +
        '</div>' +
        '<div class="realm-body">' +
          '<div class="realm-head"><span class="realm-idx">0' + theme.id + '</span><h3 class="realm-name">' + theme.name + '</h3></div>' +
          '<p class="realm-caption">' + (theme.desc || '') + '</p>' +
          '<div class="realm-bar"><span class="realm-bar-fill"></span></div>' +
        '</div>' +
      '</div>';

    // 3D tilt + cursor spotlight
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--rx', (-y * 12).toFixed(2) + 'deg');
      card.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      card.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerenter', function () {
      setRailAccent(document.getElementById('levelsGrid'), accent);
    });
    card.addEventListener('pointerleave', function () {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      // restore rail accent to the currently-selected realm
      var sel = document.querySelector('#levelsGrid .realm-card.is-selected');
      if (sel) setRailAccent(document.getElementById('levelsGrid'), sel.style.getPropertyValue('--accent') || accent);
    });
    return card;
  };

  window.selectRealm = function (theme) {
    var grid = document.getElementById('levelsGrid'); if (!grid) return;
    var m = REALM_META[theme.id] || {};
    var accent = m.accent || theme.accent || '#7dffa3';
    var nodes = grid.querySelectorAll('.realm-card');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.toggle('is-selected', String(nodes[i].dataset.level) === String(theme.id));
    }
    var ov = overlayOf(grid);
    if (ov) { ov.style.setProperty('--rail-accent', accent); ov.style.setProperty('--sel-accent', accent); }
    var set = function (n, b) {
      var N = document.getElementById(n), B = document.getElementById(b);
      if (N) N.textContent = theme.id + '. ' + theme.name;
      if (B) B.textContent = theme.badge || '';
    };
    set('offlineSelectedName', 'offlineSelectedBadge');
    set('singleSelectedName', 'singleSelectedBadge');
  };

  // Offline mode-rail active state + label
  function initModeRail() {
    var rail = document.getElementById('offlineModeRail');
    if (!rail || rail.dataset.init) return;
    rail.dataset.init = '1';
    var label = document.getElementById('offlineModeLabel');
    var setActive = function (btn) {
      var all = rail.querySelectorAll('.realm-mode');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
      if (btn) { btn.classList.add('is-active'); if (label) label.textContent = (btn.textContent || '').trim(); }
    };
    rail.addEventListener('click', function (e) {
      var b = e.target.closest('.realm-mode'); if (b) setActive(b);
    });
    // default matches OFFLINE_MODE_TYPE = "pve"
    var def = rail.querySelector('[data-mode="pve"]') || rail.querySelector('.realm-mode');
    if (def) setActive(def);
  }

  function init() { initModeRail(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('game:ready', init);
})();
