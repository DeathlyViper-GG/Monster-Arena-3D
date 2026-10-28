// ============================================================
// Monster Arena — Weapon Loadout
// Lets the player pick up to 3 owned weapons (base 3 + any shop
// weapons unlocked via RuneStones) to cycle in-match with Q/E.
// State persists in localStorage. Loaded after pve16.js so it can
// hook the Customize "Guns" tab. The engine reads Loadout.indices()
// in swapWeapon() and restart(). Exposes window.Loadout.
// ============================================================
(function () {
  'use strict';

  const KEY = 'arena_loadout';
  const BASE = ['pistol', 'rifle', 'shotgun'];

  // Base weapon display info (mirrors pve16's weapons array for the UI only).
  const BASE_INFO = {
    pistol:  { name: 'Pistol',  desc: 'Reliable sidearm. Balanced damage and rate.', dmg: 18, rof: 5,   ammo: 15, color: '#5a6b7a', icon: '🔫' },
    rifle:   { name: 'Rifle',   desc: 'Full-auto, accurate, punches through one foe.', dmg: 14, rof: 10,  ammo: 28, color: '#4a5a4a', icon: '🔫' },
    shotgun: { name: 'Shotgun', desc: 'Close-range 8-pellet spread. Heavy recoil.',  dmg: 8,  rof: 1.7, ammo: 6,  color: '#5a4a3a', icon: '🔫' }
  };

  function allOwnedKinds() {
    const shop = (window.RS && Array.isArray(RS.NEW_WEAPONS)) ? RS.NEW_WEAPONS.map(w => w.kind) : [];
    return BASE.concat(shop.filter(k => BASE.indexOf(k) < 0));
  }
  function isKindOwned(kind) {
    if (BASE.indexOf(kind) >= 0) return true;
    return !!(window.RS && RS.owns(kind));
  }
  function infoFor(kind) {
    if (BASE_INFO[kind]) return BASE_INFO[kind];
    if (window.RS && Array.isArray(RS.NEW_WEAPONS)) {
      const w = RS.NEW_WEAPONS.find(x => x.kind === kind);
      if (w) return { name: w.name, desc: w.desc, dmg: w.dmg, rof: w.rof, ammo: w.ammo, color: w.gunColor, icon: iconFor(kind) };
    }
    return { name: kind, desc: '', dmg: 0, rof: 0, ammo: 0, color: '#444', icon: '🔫' };
  }
  function iconFor(kind) {
    switch (kind) {
      case 'smg': return '💨';
      case 'burst': return '💥';
      case 'marksman': return '🎯';
      case 'crossbow': return '🏹';
      case 'lmg': return '🔫';
      case 'flamethrower': return '🌋';
      default: return '🔫';
    }
  }

  // ---- Unlocked RuneStone weapons in the Customize Guns tab ----
  // Each owned shop weapon renders its own section below Shotguns. Weapons
  // with a defined skin catalog (SMG) use real sprite art gated by best wave;
  // others fall back to generated gradient swatches until art exists.
  // Selection persists to localStorage under arena_skin_<kind>.
  const IMG_BASE = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/';
  const EXTRA_GUN_SKINS = {
    // SMG: Default = the 3D model preview. The five real skins (background-free)
    // unlock by wave, from most common (Metal) to rarest (Crimson Runeclad).
    // SMG art is stored upside-down → flip:true pre-flips it right-side up.
    smg: [
      { name: 'Metal',            url: IMG_BASE + 'efdd17c17_Upside-DownCyberpunkSMG.png',        wave: 0,  flip: true },
      { name: 'Toxic Camo',       url: IMG_BASE + 'a7369b0f1_Upside-DownToxicCamoSMG.png',        wave: 8,  flip: true },
      { name: 'Cryo Crystal',     url: IMG_BASE + 'ed9cb8d73_Upside-DownCryo-CrystalSMG.png',     wave: 16, flip: true },
      { name: 'Voidforged',       url: IMG_BASE + '6cafb0ee3_Upside-DownVoidforgedSci-FiRifle.png', wave: 26, flip: true },
      { name: 'Crimson Runeclad', url: IMG_BASE + '7fc76b035_CrimsonRunecladRailgun.png',        wave: 36, flip: true }
    ],
    // Burst Rifle art is stored upside-down → flip:true.
    burst: [
      { name: 'Hazardline',     url: IMG_BASE + '9474011aa_hazardline_upside_down.png',           wave: 0,  flip: true },
      { name: 'Steampunk',      url: IMG_BASE + '1a2c59fef_Upside-DownSteampunkRifleAsset.png',     wave: 12, flip: true },
      { name: 'Jade Filigree',  url: IMG_BASE + '6549c4941_Upside-DownJadeFiligreeRifle.png',       wave: 24, flip: true },
      { name: 'Neon Overdrive', url: IMG_BASE + '808bc167f_Upside-DownNeonOverdriveRifle.png',     wave: 36, flip: true },
      { name: 'Solar Halo',     url: IMG_BASE + '625461b7a_SolarHaloEnergyRifle.png',              wave: 48, flip: true }
    ],
    // Marksman: Default = the 3D model preview. Five real skins, common → rare.
    // These assets are already right-side up → flip:false.
    marksman: [
      { name: 'Weathered Industrial', url: IMG_BASE + 'e8f4f5103_WeatheredIndustrialRailgunConcept.png', wave: 0,  flip: false },
      { name: 'Desert Tactical',      url: IMG_BASE + '51c653d57_DesertTanFuturisticSniperRifle.png',   wave: 12, flip: false },
      { name: 'Emerald Arcane',        url: IMG_BASE + '328640d7e_OrnateEmeraldCrystalArcaneRifle.png',  wave: 24, flip: false },
      { name: 'Plasma Rail',           url: IMG_BASE + '6835aa0b8_IndustrialPlasmaRailCannon.png',       wave: 36, flip: false },
      { name: 'Astral Void',           url: IMG_BASE + '9a76d958d_AstralCrystalRailCannon.png',          wave: 48, flip: false }
    ],
    // Crossbow: Default = the 3D model preview. Five real skins, common → rare.
    // Assets are right-side up → flip:false.
    crossbow: [
      { name: 'Weathered Medieval', url: IMG_BASE + 'f1653b394_WeatheredMedievalCrossbowRender.png',                wave: 0,  flip: false, rot: 90 },
      { name: 'Necromantic Bone',   url: IMG_BASE + '5c0956ccb_NecromanticBoneCrossbowwithGreenGlow.png',           wave: 12, flip: false, rot: 90 },
      { name: 'Molten Siege',       url: IMG_BASE + 'a15c7b033_MoltenVolcanicSiegeCrossbow.png',                    wave: 24, flip: false, rot: 90 },
      { name: 'Gilded Dragonfire',  url: IMG_BASE + '832d1c90b_GildedDragonfireCrossbow.png',                      wave: 36, flip: false, rot: 90 },
      { name: 'Celestial Armillary', url: IMG_BASE + '426fa5a45_CelestialArmillaryEnergyCrossbow.png',             wave: 48, flip: false, rot: 90 }
    ]
  };
  let extraPreviews = [];
  function disposeExtraPreviews() { extraPreviews.forEach(h => { try { h.dispose(); } catch (e) {} }); extraPreviews = []; }

  // ---- In-game skin images for extra weapons (smg, burst, ...) ----
  // The base weapons read their skins from gunSheets (preloaded top-down
  // sprites). Extra weapons have no sheet; instead we lazy-load the player's
  // selected skin image here so the in-game renderer (3D relief + 2D fallback)
  // can show it. -1 / NaN = Default (procedural stand-in).
  // The extra-weapon skin art is stored upside-down (see the "Upside-Down"
  // asset names). The in-game 3D viewmodel maps the image's top edge to the
  // gun's up-axis, so we pre-flip each skin onto a canvas here; the 3D relief
  // + 2D fallback then read it right-side up. The Customize card flips via
  // CSS (sk.flip) instead.
  const extraGunImgs = {}; // `${kind}_${idx}` -> { img, canvas, ready }
  function getExtraGunImg(kind, idx) {
    if (idx < 0) return null;
    const skins = EXTRA_GUN_SKINS[kind];
    if (!skins || !skins[idx]) return null;
    const key = kind + '_' + idx;
    let entry = extraGunImgs[key];
    if (!entry) {
      entry = { img: new Image(), canvas: null, ready: false };
      entry.img.crossOrigin = 'anonymous';
      entry.img.onload = () => {
        const iw = entry.img.naturalWidth || entry.img.width;
        const ih = entry.img.naturalHeight || entry.img.height;
        const rot = skins[idx].rot || 0;
        const cw = rot === 90 || rot === 270 ? ih : iw;
        const ch = rot === 90 || rot === 270 ? iw : ih;
        const cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        const cx = cv.getContext('2d');
        if (rot === 90) { cx.translate(cw, 0); cx.rotate(Math.PI / 2); }
        else if (rot === 270) { cx.translate(0, ch); cx.rotate(-Math.PI / 2); }
        else if (skins[idx].flip) { cx.translate(0, ih); cx.scale(1, -1); }   // flip upside-down art right-side up
        cx.drawImage(entry.img, 0, 0);
        entry.canvas = cv; entry.ready = true;
      };
      entry.img.onerror = () => { entry.ready = false; };
      entry.img.src = skins[idx].url;
      extraGunImgs[key] = entry;
    }
    return entry.ready ? entry.canvas : null;
  }
  function selectedExtraGunImg(kind) {
    let idx = -1;
    try { idx = parseInt(localStorage.getItem('arena_skin_' + kind) || '-1', 10); if (isNaN(idx)) idx = -1; } catch (e) {}
    return getExtraGunImg(kind, idx);
  }
  const EXTRA_SKIN_PALETTE = [
    ['#5ad2ff', '#1a6bff'],
    ['#ffd76a', '#ff8a3c'],
    ['#7dffa3', '#16a34a'],
    ['#ff6ad5', '#a02ad9'],
    ['#bfe9ff', '#7c8cff']
  ];
  function bestWave() {
    try { return parseInt(localStorage.getItem('arenaBest') || '0', 10) || 0; } catch (e) { return 0; }
  }
  function skinNameTag(text) {
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:absolute;left:6px;bottom:4px;font-size:10px;font-weight:800;letter-spacing:.04em;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.85);';
    return t;
  }
  function lockBadge(req) {
    const b = document.createElement('div');
    b.className = 'lockBadge';
    b.textContent = 'Unlock @ Wave ' + req;
    return b;
  }
  function buildExtraGuns() {
    const host = document.getElementById('extraGunsHost');
    if (!host) return;
    disposeExtraPreviews();
    host.innerHTML = '';
    const owned = (window.RS && typeof RS.ownedKinds === 'function') ? RS.ownedKinds() : BASE.slice();
    const extras = owned.filter(k => BASE.indexOf(k) < 0 && isKindOwned(k));
    if (!extras.length) { host.style.display = 'none'; return; }
    host.style.display = 'block';
    const bw = bestWave();
    extras.forEach(kind => {
      const meta = (window.RS && Array.isArray(RS.NEW_WEAPONS)) ? RS.NEW_WEAPONS.find(w => w.kind === kind) : null;
      const name = meta ? meta.name : kind;
      const sec = document.createElement('div');
      sec.className = 'gunSection';
      sec.style.marginTop = '10px';
      const title = document.createElement('div');
      title.className = 'gunSectionTitle';
      title.textContent = name + 's';
      const grid = document.createElement('div');
      grid.className = 'gunSkinGrid';
      sec.appendChild(title); sec.appendChild(grid);
      host.appendChild(sec);

      const selKey = 'arena_skin_' + kind;
      const choose = (idx) => { try { localStorage.setItem(selKey, String(idx)); } catch (e) {} buildExtraGuns(); };

      const skins = EXTRA_GUN_SKINS[kind];
      if (skins) {
        // Default = 3D model preview (always available). Skins = real sprite art, wave-gated.
        let cur = -1;
        try { cur = parseInt(localStorage.getItem(selKey) || '-1', 10); if (isNaN(cur)) cur = -1; } catch (e) {}
        {
          const card = document.createElement('div');
          card.className = 'gunSkinCard defaultCard';
          if (window.ShopGunPreview) {
            const cv = document.createElement('canvas');
            cv.style.cssText = 'width:100%;height:100%;display:block;';
            card.appendChild(cv);
            try { extraPreviews.push(window.ShopGunPreview.mount(cv, kind)); } catch (e) {}
          }
          card.appendChild(skinNameTag('Default'));
          if (cur === -1) card.classList.add('selected');
          card.onclick = () => choose(-1);
          grid.appendChild(card);
        }
        skins.forEach((sk, idx) => {
          const card = document.createElement('div');
          card.className = 'gunSkinCard';
          const img = document.createElement('img');
          img.className = 'gunSkinImg';
          img.src = sk.url + '?v=1';
          img.alt = sk.name;
          // Flip the card image only when the asset is stored upside-down.
          img.style.transform = sk.flip ? 'scaleY(-1)' : 'none';
          img.style.objectFit = 'contain';
          card.appendChild(img);
          card.appendChild(skinNameTag(sk.name));
          const unlocked = bw >= sk.wave;
          if (!unlocked) {
            card.classList.add('locked');
            card.appendChild(lockBadge(sk.wave));
          } else {
            if (idx === cur) card.classList.add('selected');
            card.onclick = () => choose(idx);
          }
          grid.appendChild(card);
        });
      } else {
        // No art yet — generated gradient swatches (Default + 5).
        let cur = -1;
        try { cur = parseInt(localStorage.getItem(selKey) || '-1', 10); if (isNaN(cur)) cur = -1; } catch (e) {}
        {
          const card = document.createElement('div');
          card.className = 'gunSkinCard defaultCard';
          const lbl = document.createElement('div');
          lbl.textContent = 'Default'; lbl.style.fontWeight = '800'; lbl.style.opacity = '.9';
          card.appendChild(lbl);
          if (cur === -1) card.classList.add('selected');
          card.onclick = () => choose(-1);
          grid.appendChild(card);
        }
        for (let i = 0; i < 5; i++) {
          const card = document.createElement('div');
          card.className = 'gunSkinCard';
          const sw = document.createElement('div');
          sw.className = 'gunSkinImg';
          const pal = EXTRA_SKIN_PALETTE[i];
          sw.style.cssText = 'width:100%;height:100%;display:grid;place-items:center;' +
            'background:linear-gradient(135deg,' + pal[0] + ' 0%,' + pal[1] + ' 100%);' +
            'box-shadow:inset 0 0 18px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.18);';
          const g = document.createElement('div');
          g.textContent = '✦';
          g.style.cssText = 'font-size:30px;color:rgba(255,255,255,.85);text-shadow:0 0 12px rgba(0,0,0,.5);';
          sw.appendChild(g);
          card.appendChild(sw); card.appendChild(skinNameTag('Skin ' + (i + 1)));
          if (cur === i) card.classList.add('selected');
          card.onclick = () => choose(i);
          grid.appendChild(card);
        }
      }
    });
  }

  function loadLoadout() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(arr) && arr.length >= 1 && arr.length <= 3) {
        const uniq = arr.filter((k, i) => arr.indexOf(k) === i);
        const valid = uniq.filter(k => allOwnedKinds().indexOf(k) >= 0 && isKindOwned(k));
        if (valid.length >= 1) return valid.slice(0, 3);
      }
    } catch (e) {}
    return BASE.slice();
  }
  function saveLoadout(arr) {
    const uniq = (arr || []).filter((k, i) => (arr || []).indexOf(k) === i).filter(isKindOwned).slice(0, 3);
    try { localStorage.setItem(KEY, JSON.stringify(uniq)); } catch (e) {}
    LOADOUT = uniq.length >= 1 ? uniq : BASE.slice();
  }
  let LOADOUT = loadLoadout();

  function toggleLoadoutKind(kind) {
    if (!isKindOwned(kind)) return;
    const arr = LOADOUT.slice();
    const i = arr.indexOf(kind);
    if (i >= 0) { if (arr.length > 1) arr.splice(i, 1); }
    else { if (arr.length < 3) arr.push(kind); else arr[2] = kind; }
    saveLoadout(arr);
  }

  // Engine helpers — called from pve16.js with its `weapons` array.
  function indices(weapons) {
    return weapons.map((w, i) => i).filter(i => LOADOUT.indexOf(weapons[i].kind) >= 0 && isKindOwned(weapons[i].kind));
  }
  function firstIndex(weapons) {
    const idx = indices(weapons);
    return idx.length ? idx[0] : 0;
  }

  // ---- Customize UI -----------------------------------------------------
  let cssInjected = false;
  function injectCSS() {
    if (cssInjected) return; cssInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      #loadoutSection{margin-bottom:16px;padding:14px;border-radius:14px;
        background:linear-gradient(180deg,rgba(18,28,42,.7),rgba(10,16,26,.6));
        border:1px solid rgba(0,250,255,.18);}
      #loadoutSection .gunSectionTitle{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      #loadoutSection .loHint{font-size:12px;font-weight:500;letter-spacing:.02em;opacity:.85;color:#bfe6ff;}
      #loadoutSlots{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap;}
      .loSlot{flex:1 1 0;min-width:90px;padding:8px 10px;border-radius:10px;text-align:center;
        background:rgba(8,14,22,.7);border:1px dashed rgba(180,220,255,.25);color:#7dffa3;font-weight:800;
        font-size:13px;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;gap:6px;}
      .loSlot.empty{color:#5a6a80;border-style:dashed;}
      #loadoutGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
      .loCard{position:relative;border-radius:12px;padding:10px;cursor:pointer;overflow:hidden;
        background:linear-gradient(180deg,rgba(20,26,42,.85),rgba(10,14,24,.7));
        border:1px solid rgba(180,220,255,.14);transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;}
      .loCard:hover{transform:translateY(-1px);}
      .loCard.selected{border-color:#7dffa3;box-shadow:0 0 16px rgba(125,255,163,.3);}
      .loCard.locked{opacity:.5;cursor:not-allowed;}
      .loCard .loSwatch{height:46px;border-radius:8px;margin-bottom:6px;
        background:linear-gradient(180deg,var(--lo-c,#444),rgba(0,0,0,.35));
        display:flex;align-items:center;justify-content:center;font-size:22px;
        box-shadow:inset 0 0 12px rgba(0,0,0,.4);}
      .loCard .loName{font-size:14px;font-weight:800;color:#eaf4ff;}
      .loCard .loDesc{font-size:11px;line-height:1.35;color:#bfe6ff;opacity:.85;margin:3px 0 4px;}
      .loCard .loStats{font-size:10px;letter-spacing:.03em;color:#9fd8e6;}
      .loCard .loBadge{position:absolute;top:6px;right:8px;font-size:10px;font-weight:900;letter-spacing:.06em;
        color:#7dffa3;text-shadow:0 0 8px rgba(125,255,163,.6);}`;
    document.head.appendChild(s);
  }

  function buildUI() {
    injectCSS();
    const tab = document.getElementById('gunTab');
    if (!tab) return;
    let sec = document.getElementById('loadoutSection');
    if (!sec) {
      sec = document.createElement('div');
      sec.id = 'loadoutSection';
      sec.className = 'gunSection';
      sec.innerHTML = `
        <div class="gunSectionTitle"><span>🎒 Equip Loadout</span>
          <span class="loHint">Pick up to 3 owned weapons — cycle them in-match with Q / E.</span></div>
        <div id="loadoutSlots"></div>
        <div id="loadoutGrid"></div>`;
      tab.insertBefore(sec, tab.firstChild);
    }

    // Slots
    const slots = document.getElementById('loadoutSlots');
    slots.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const kind = LOADOUT[i];
      const info = kind ? infoFor(kind) : null;
      const el = document.createElement('div');
      el.className = 'loSlot' + (info ? '' : ' empty');
      el.innerHTML = info ? ('<span>' + info.icon + '</span> ' + info.name) : 'Empty slot';
      slots.appendChild(el);
    }

    // Grid of all owned weapons
    const grid = document.getElementById('loadoutGrid');
    grid.innerHTML = '';
    const kinds = allOwnedKinds();
    kinds.forEach(kind => {
      if (!isKindOwned(kind)) return;
      const info = infoFor(kind);
      const selected = LOADOUT.indexOf(kind) >= 0;
      const card = document.createElement('div');
      card.className = 'loCard' + (selected ? ' selected' : '');
      card.style.setProperty('--lo-c', info.color);
      card.innerHTML = `
        <div class="loSwatch">${info.icon}</div>
        <div class="loName">${info.name}</div>
        <div class="loDesc">${info.desc}</div>
        <div class="loStats">DMG ${info.dmg} · ROF ${info.rof} · MAG ${info.ammo}</div>
        ${selected ? '<div class="loBadge">✓ Equipped</div>' : ''}`;
      card.addEventListener('click', () => {
        toggleLoadoutKind(kind);
        buildUI();
      });
      grid.appendChild(card);
    });
  }

  // Hook the Guns tab so the loadout section builds when opened, and patch
  // buildGunsUI so the section is (re)built whenever the Customize overlay
  // populates the gun grids. Also build once up front so the section is
  // present even before the tab is first opened.
  function hookTab() {
    const btn = document.getElementById('tabGunsBtn');
    if (btn && !btn._loHooked) {
      btn._loHooked = true;
      const orig = btn.onclick;
      btn.onclick = function () {
        if (typeof orig === 'function') orig.apply(this, arguments);
        buildUI();
      };
    }
    if (typeof window.buildGunsUI === 'function' && !window.buildGunsUI._loHooked) {
      window.buildGunsUI._loHooked = true;
      const orig = window.buildGunsUI;
      window.buildGunsUI = function () {
        const r = orig.apply(this, arguments);
        try { buildUI(); } catch (e) {}
        try { buildExtraGuns(); } catch (e) {}
        return r;
      };
    }
    const tab = document.getElementById('gunTab');
    if (tab) buildUI();
  }

  function init() { hookTab(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // pve16.js sets tabGunsBtn.onclick / window.buildGunsUI after this script
  // may run; re-hook shortly after to be safe.
  setTimeout(init, 600);

  window.Loadout = {
    indices: indices,
    firstIndex: firstIndex,
    isKindOwned: isKindOwned,
    toggle: toggleLoadoutKind,
    buildUI: buildUI,
    gunImg: selectedExtraGunImg,
    get: function () { return LOADOUT.slice(); }
  };
})();
