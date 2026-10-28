// ============================================================
// Monster Arena — RuneStones currency + weapon unlock shop
// Offline-first: balance and owned weapons persist in localStorage.
// Earned from wave milestones (singleplayer/offline/story), PvP
// placement, story Warden defeats, and the Hollow defeat. Spent in
// the Shop to unlock new weapon types (sidegrades, not upgrades).
// Loaded before pve16.js so the game engine can read RS.NEW_WEAPONS
// and RS.owns() at init/runtime. Exposes window.RS.
// ============================================================
(function () {
  'use strict';

  // The Rune Stone sprite — used wherever a RuneStone number appears (menu
  // badge, reward toast, shop balance, shop item cost).
  const SPRITE_URL = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/d1b75cdc8_ElectricBlueArcaneRuneMedallion1.png';
  const KEY_BAL = 'arena_runestones';
  const KEY_UNLOCK = 'arena_rune_unlocks';
  const BASE_KINDS = ['pistol', 'rifle', 'shotgun'];

  // ---- New weapon archetypes (appended to pve16's weapons array) ----
  // All sidegrades: each trades something for something else. gunLen/gunH/
  // gunColor feed the canvas fallback so they render distinctly with no sprite.
  const NEW_WEAPONS = [
    { name: 'SMG',         kind: 'smg',         cost: 40,  dmg: 9,  rof: 16,  spread: 0.030, speed: 1000, ammo: 30, reserve: 120, reload: 1.1, recoil: 0.30, shots: 1, pierce: 0, dash: 400, gunLen: 20, gunH: 6, gunColor: '#2a3a4a', desc: 'Fast fire, light damage. Strong up close, weak at range.' },
    { name: 'Burst Rifle', kind: 'burst',       cost: 60,  dmg: 7,  rof: 5,   spread: 0.025, speed: 1300, ammo: 24, reserve: 96,  reload: 1.2, recoil: 0.35, shots: 3, pierce: 1, dash: 410, gunLen: 28, gunH: 5, gunColor: '#1e3a2e', desc: 'Tight 3-round bursts. Accurate, punishes missed shots.' },
    { name: 'Marksman',    kind: 'marksman',    cost: 80,  dmg: 45, rof: 1.5, spread: 0.005, speed: 1700, ammo: 8,  reserve: 32,  reload: 1.6, recoil: 1.00, shots: 1, pierce: 2, dash: 380, gunLen: 34, gunH: 5, gunColor: '#3a2a1e', desc: 'High damage, slow precision. Punches through two enemies.' },
    { name: 'Crossbow',    kind: 'crossbow',    cost: 70,  dmg: 55, rof: 0.9, spread: 0.010, speed: 1500, ammo: 1,  reserve: 20,  reload: 1.8, recoil: 1.20, shots: 1, pierce: 3, dash: 380, gunLen: 24, gunH: 8, gunColor: '#3a2e1e', desc: 'Heavy single bolt, slow reload. Pierces three foes.' },
    { name: 'LMG',         kind: 'lmg',         cost: 100, dmg: 10, rof: 12,  spread: 0.040, speed: 1200, ammo: 60, reserve: 240, reload: 2.2, recoil: 0.40, shots: 1, pierce: 1, dash: 340, gunLen: 32, gunH: 7, gunColor: '#2a2a3a', desc: 'Huge magazine, sustained fire. Slow reload and dash.' },
    { name: 'Flamethrower', kind: 'flamethrower', cost: 120, dmg: 2, rof: 10, spread: 0.240, speed: 600,  ammo: 50, reserve: 200, reload: 2.0, recoil: 0.20, shots: 6, pierce: 0, dash: 340, gunLen: 22, gunH: 9, gunColor: '#3a1e1e', desc: 'Short-range cone of flame. Sets monsters on fire.' }
  ];
  const CATALOG = NEW_WEAPONS.map(w => ({ kind: w.kind, name: w.name, cost: w.cost, desc: w.desc }));
  CATALOG.forEach(c => { const w = NEW_WEAPONS.find(x => x.kind === c.kind); c.icon = iconFor(c.kind); });

  function iconFor(kind) {
    switch (kind) {
      case 'smg': return '💨';
      case 'burst': return '💥';
      case 'marksman': return '🎯';
      case 'crossbow': return '🏹';
      case 'lmg': return '🔥';
      case 'flamethrower': return '🌋';
      default: return '🔫';
    }
  }

  // ---- Persistence -------------------------------------------------------
  // [TEST] unlimited RuneStones so every shop weapon can be unlocked instantly.
  function balance() { return 999999; }
  function saveBal(n) { try { localStorage.setItem(KEY_BAL, String(Math.max(0, Math.floor(n)))); } catch (_) {} refreshBadge(); }
  function ownedKinds() {
    let arr;
    try { arr = JSON.parse(localStorage.getItem(KEY_UNLOCK) || '[]'); } catch (_) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    return BASE_KINDS.concat(arr.filter(k => BASE_KINDS.indexOf(k) < 0));
  }
  function owns(kind) { return ownedKinds().indexOf(kind) >= 0; }
  function addUnlock(kind) {
    if (BASE_KINDS.indexOf(kind) >= 0) return;
    const arr = ownedKinds().filter(k => k !== kind && BASE_KINDS.indexOf(k) < 0);
    arr.push(kind);
    try { localStorage.setItem(KEY_UNLOCK, JSON.stringify(arr)); } catch (_) {}
  }

  let _listeners = [];
  function add(n, reason) {
    if (!n || n <= 0) return;
    const b = balance() + Math.floor(n);
    saveBal(b);
    toast('+' + Math.floor(n) + ' RuneStones', reason || '');
    _listeners.forEach(fn => { try { fn(b, n, reason); } catch (_) {} });
  }
  function spend(n) {
    const b = balance();
    if (b < n) return false;
    saveBal(b - n);
    return true;
  }
  function unlock(kind) {
    const c = CATALOG.find(x => x.kind === kind);
    if (!c || owns(kind)) return false;
    if (!spend(c.cost)) return false;
    addUnlock(kind);
    toast('Unlocked: ' + c.name, '');
    buildShop();
    return true;
  }

  // ---- Per-run milestone tracking --------------------------------------
  // Milestones are claimed once per run so restarting Wave 1 cannot farm them.
  let claimed = new Set();
  let runStartBest = 0;
  function resetRun(bestAtStart) { claimed = new Set(); runStartBest = bestAtStart || 0; }

  const MILESTONES = { 5: 5, 10: 8, 15: 12, 20: 18, 25: 25, 30: 30 };
  const PER_WAVE = 2;          // RuneStones per wave reached (wave >= 2)
  const FIRST_WAVE = 2;        // first wave that pays out
  const PB_BONUS = 10;         // new personal best

  function onWaveStart(n) {
    if (!n || n < FIRST_WAVE) return;
    if (claimed.has(n)) return;
    claimed.add(n);
    let amt = PER_WAVE;
    if (MILESTONES[n]) amt += MILESTONES[n];
    add(amt, 'Wave ' + n + ' reached');
  }

  function onGameOver(finalWave) {
    // Personal-best bonus: final wave beats the best that existed at run start.
    if (finalWave && finalWave > runStartBest) add(PB_BONUS, 'New personal best');
  }

  // PvP placement reward (offline bot-PvP). 1st = highest.
  const PVP_REWARDS = [25, 18, 12, 8]; // 1st..4th; 5th+ = 4
  function awardPvpPlacement(placement, total) {
    let amt;
    if (placement === 1) amt = PVP_REWARDS[0];
    else if (placement >= 2 && placement <= 4) amt = PVP_REWARDS[placement - 1];
    else amt = 4;
    add(amt, 'PvP #' + placement + ' / ' + (total || '?'));
  }

  function awardWarden() { add(15, 'Warden defeated'); }
  function awardHollow() { add(60, 'The Hollow defeated'); }

  // ---- Toast ------------------------------------------------------------
  let toastEl = null, toastTimer = null;
  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.id = 'runeToast';
    toastEl.style.cssText = 'position:fixed;left:50%;top:78px;transform:translate(-50%,-8px);z-index:60;' +
      'display:none;align-items:center;gap:10px;padding:10px 16px;border-radius:14px;' +
      'background:linear-gradient(180deg,rgba(10,18,30,.92),rgba(6,12,22,.9));' +
      'border:1px solid rgba(0,250,255,.55);box-shadow:0 8px 26px rgba(0,0,0,.5),0 0 24px rgba(0,250,255,.35);' +
      'color:#eafcff;font-weight:800;letter-spacing:.04em;pointer-events:none;backdrop-filter:blur(4px);';
    toastEl.innerHTML = '<img src="' + SPRITE_URL + '" style="width:26px;height:26px;border-radius:50%;mix-blend-mode:screen;box-shadow:0 0 12px rgba(0,250,255,.7)"/>' +
      '<span id="runeToastAmt"></span><span id="runeToastReason" style="opacity:.7;font-weight:500;font-size:12px"></span>';
    document.body.appendChild(toastEl);
    return toastEl;
  }
  function toast(amt, reason) {
    ensureToast();
    const a = document.getElementById('runeToastAmt');
    const r = document.getElementById('runeToastReason');
    if (a) a.textContent = amt;
    if (r) r.textContent = reason ? ('· ' + reason) : '';
    toastEl.style.display = 'flex';
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.transition = 'opacity .5s ease';
      toastEl.style.opacity = '0';
      setTimeout(() => { if (toastEl) toastEl.style.display = 'none'; }, 520);
    }, 2200);
  }

  // ---- Intro-hub balance badge ----------------------------------------
  let badge = null;
  function ensureBadge() {
    if (badge) return badge;
    badge = document.createElement('span');
    badge.id = 'runeBalanceBadge';
    badge.style.cssText = 'display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;' +
      'background:linear-gradient(180deg,rgba(10,18,30,.85),rgba(6,12,22,.8));' +
      'border:1px solid rgba(0,250,255,.5);box-shadow:0 0 14px rgba(0,250,255,.25);' +
      'color:#eafcff;font-weight:900;letter-spacing:.06em;font-size:13px;cursor:pointer;';
    badge.title = 'Open the RuneStone Shop';
    badge.innerHTML = '<img src="' + SPRITE_URL + '" style="width:22px;height:22px;border-radius:50%;mix-blend-mode:screen;box-shadow:0 0 10px rgba(0,250,255,.7)"/>' +
      '<span id="runeBalanceNum">0</span> RuneStones';
    badge.addEventListener('click', openShop);
    // Attach to the intro hub aux row when it exists.
    const attach = () => {
      const row = document.querySelector('#overlayIntro .arena-aux');
      if (row && !document.getElementById('runeBalanceBadge')) row.appendChild(badge);
    };
    attach();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    return badge;
  }
  function refreshBadge() {
    const num = document.getElementById('runeBalanceNum');
    if (num) num.textContent = String(balance());
  }

  // ---- Shop overlay -----------------------------------------------------
  let shopInjected = false;
  let shopPreviews = [];
  function disposeShopPreviews() { shopPreviews.forEach(function (h) { try { h.dispose(); } catch (e) {} }); shopPreviews = []; }
  function injectShop() {
    if (shopInjected) return; shopInjected = true;
    const css = document.createElement('style');
    css.textContent = `
      @property --shopHue { syntax:'<angle>'; inherits:false; initial-value:0deg; }
      @property --siHue { syntax:'<angle>'; inherits:false; initial-value:0deg; }
      #overlayShop{position:fixed;inset:0;z-index:52;display:none;place-items:center;overflow:hidden;
        background:radial-gradient(1100px 600px at 50% -10%,rgba(0,170,200,.14),rgba(4,8,14,.96) 70%);}
      #overlayShop::before{content:"";position:absolute;inset:-10%;pointer-events:none;
        background:radial-gradient(40% 30% at 30% 30%,rgba(0,250,255,.16),transparent 60%),
          radial-gradient(45% 35% at 70% 65%,rgba(192,102,255,.14),transparent 60%),
          radial-gradient(35% 25% at 50% 90%,rgba(255,120,60,.12),transparent 60%);
        filter:blur(10px);animation:shopFog 18s ease-in-out infinite alternate;}
      @keyframes shopFog{0%{transform:translate(0,0) scale(1)}50%{transform:translate(3%,-2%) scale(1.06)}100%{transform:translate(-3%,2%) scale(1.04)}}
      #shopCard{position:relative;width:min(1080px,95vw);max-height:92vh;overflow:auto;padding:30px 34px 26px;
        background:rgba(8,14,22,.93);border:1px solid rgba(0,250,255,.22);border-radius:24px;
        box-shadow:0 24px 70px rgba(0,0,0,.6),0 0 50px rgba(0,250,255,.12);}
      #shopCard::before{content:"";position:absolute;inset:0;border-radius:24px;padding:2px;pointer-events:none;
        background:conic-gradient(from var(--shopHue),#00faff,#c066ff,#ff6a2a,#7dffa3,#00faff);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;mask-composite:exclude;opacity:.6;
        animation:shopBorderSpin 9s linear infinite;}
      @keyframes shopBorderSpin{to{--shopHue:360deg;--siHue:360deg;}}
      #shopHead{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:6px;position:relative;z-index:2;}
      #shopHead h2{margin:0;letter-spacing:.06em;text-transform:uppercase;font-size:24px;
        background:linear-gradient(90deg,#fff,#9fe3ff 45%,#c066ff 80%,#00faff);-webkit-background-clip:text;background-clip:text;color:transparent;
        text-shadow:0 0 24px rgba(0,250,255,.35);animation:shopTitleGlow 3.4s ease-in-out infinite;}
      @keyframes shopTitleGlow{0%,100%{filter:drop-shadow(0 0 10px rgba(0,250,255,.4))}50%{filter:drop-shadow(0 0 18px rgba(192,102,255,.6))}}
      #shopBal{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;
        background:linear-gradient(180deg,rgba(0,40,60,.7),rgba(0,20,40,.6));border:1px solid rgba(0,250,255,.55);
        box-shadow:0 0 18px rgba(0,250,255,.4),inset 0 0 10px rgba(0,250,255,.12);color:#eafcff;font-weight:900;letter-spacing:.05em;
        animation:shopBalPulse 3s ease-in-out infinite;}
      @keyframes shopBalPulse{0%,100%{box-shadow:0 0 14px rgba(0,250,255,.35),inset 0 0 10px rgba(0,250,255,.1)}50%{box-shadow:0 0 24px rgba(0,250,255,.6),inset 0 0 14px rgba(0,250,255,.18)}}
      #shopBal img{width:24px;height:24px;border-radius:50%;mix-blend-mode:screen;box-shadow:0 0 12px rgba(0,250,255,.8);animation:shopBalSpin 8s linear infinite;}
      @keyframes shopBalSpin{to{transform:rotate(360deg)}}
      #shopSub{opacity:.85;margin:0 0 18px;font-size:13px;line-height:1.5;color:#bfe6ff;position:relative;z-index:2;}
      .shopGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px;position:relative;z-index:2;}
      .shopItem{position:relative;border-radius:16px;padding:16px;overflow:hidden;
        background:linear-gradient(180deg,rgba(18,28,42,.9),rgba(10,16,26,.8));
        border:1px solid rgba(0,250,255,.16);box-shadow:0 10px 26px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,250,255,.04);
        transition:transform .16s cubic-bezier(.22,1,.36,1),box-shadow .25s ease,border-color .25s ease,filter .25s ease;}
      .shopItem::before{content:"";position:absolute;inset:0;border-radius:16px;padding:1px;pointer-events:none;
        background:conic-gradient(from var(--siHue),#00faff,#c066ff,#ff6a2a,#00faff);
        -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
        -webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .25s ease;
        animation:shopBorderSpin 7s linear infinite;}
      .shopItem::after{content:"";position:absolute;inset:0;border-radius:16px;pointer-events:none;
        background:radial-gradient(120% 80% at 50% -10%,rgba(0,250,255,.12),transparent 60%);opacity:.6;}
      .shopItem:hover{transform:translateY(-4px);border-color:rgba(0,250,255,.6);box-shadow:0 18px 40px rgba(0,0,0,.55),0 0 28px rgba(0,250,255,.35),inset 0 0 14px rgba(0,250,255,.12);filter:brightness(1.06);}
      .shopItem:hover::before{opacity:1;}
      .shopItem.owned{border-color:rgba(125,255,163,.5);}
      .shopItem.owned::before{background:conic-gradient(from var(--siHue),#7dffa3,#9fe3ff,#7dffa3);}
      .shopItem.locked{opacity:.66;filter:grayscale(.3);}
      .shopItem .siIcon{font-size:30px;text-shadow:0 0 16px rgba(0,250,255,.5);}
      .shopItem .siGun3d{width:100%;height:130px;display:block;margin:2px auto 6px;border-radius:12px;position:relative;z-index:1;
        background:radial-gradient(circle at 50% 42%,rgba(0,40,60,.45),rgba(4,10,18,.7) 70%),linear-gradient(180deg,rgba(0,30,50,.3),rgba(2,8,16,.5));
        box-shadow:inset 0 0 22px rgba(0,250,255,.14),inset 0 0 0 1px rgba(0,250,255,.08);}
      .shopItem .siName{font-size:17px;font-weight:800;color:#eaf4ff;margin:6px 0 2px;text-shadow:0 0 12px rgba(0,250,255,.25);position:relative;z-index:1;}
      .shopItem .siDesc{font-size:12px;line-height:1.4;color:#bfe6ff;opacity:.85;margin:4px 0 10px;position:relative;z-index:1;}
      .shopItem .siStats{font-size:11px;letter-spacing:.04em;color:#9fd8e6;margin-bottom:12px;position:relative;z-index:1;}
      .shopItem .siCost{display:inline-flex;align-items:center;gap:6px;font-weight:900;color:#eafcff;position:relative;z-index:1;}
      .shopItem .siCost img{width:16px;height:16px;border-radius:50%;mix-blend-mode:screen;box-shadow:0 0 8px rgba(0,250,255,.7);}
      .shopBuy{width:100%;margin-top:10px;padding:11px;border-radius:11px;cursor:pointer;font-weight:800;letter-spacing:.06em;
        text-transform:uppercase;font-size:13px;transition:transform .12s ease,box-shadow .2s ease,filter .15s ease;position:relative;z-index:1;}
      .shopBuy.afford{background:linear-gradient(180deg,#0a3a4a,#062a3a);border:1px solid rgba(0,250,255,.65);color:#eafcff;
        box-shadow:0 0 16px rgba(0,250,255,.3),inset 0 0 10px rgba(0,250,255,.12);}
      .shopBuy.afford:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,250,255,.5),0 0 22px rgba(0,250,255,.45),inset 0 0 14px rgba(0,250,255,.2);filter:brightness(1.1);}
      .shopBuy.locked{background:#262a36;border:1px solid #3a3f50;color:#8a90a0;cursor:not-allowed;}
      .shopBuy.owned{background:linear-gradient(180deg,#143022,#0c2418);border:1px solid rgba(125,255,163,.55);color:#7dffa3;cursor:default;box-shadow:0 0 12px rgba(125,255,163,.25);}
      #shopClose{margin-top:18px;position:relative;z-index:2;}`;
    document.head.appendChild(css);
    const ov = document.createElement('div');
    ov.id = 'overlayShop';
    ov.className = 'overlay';
    ov.innerHTML = `
      <div id="shopCard">
        <div id="shopHead">
          <h2>🛒 RuneStone Shop</h2>
          <span id="shopBal"><img src="${SPRITE_URL}"/><span id="shopBalNum">0</span> RuneStones</span>
        </div>
        <p id="shopSub">Spend RuneStones to unlock new weapon types. All weapons are sidegrades — different strengths, not straight upgrades. Once unlocked, cycle to them in a match with Q/E.</p>
        <div class="shopGrid" id="shopGrid"></div>
        <div class="row" style="margin-top:18px;justify-content:center;">
          <button class="btn" id="shopClose">Close</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    document.getElementById('shopClose').addEventListener('click', () => { ov.style.display = 'none'; disposeShopPreviews(); revealMenu(); });
  }
  function revealMenu() {
    // Return to whichever hub was open before the shop.
    const hubs = ['overlayIntro', 'overlayHome', 'overlaySingle', 'overlayOffline'];
    let shown = null;
    for (const id of hubs) { const e = document.getElementById(id); if (e && e.style.display === 'grid') { shown = id; break; } }
    if (!shown) { const e = document.getElementById('overlayIntro'); if (e) e.style.display = 'grid'; }
  }
  function statLine(w) {
    const dps = Math.round((w.dmg * w.shots * w.rof) * 10) / 10;
    return 'DMG ' + w.dmg + (w.shots > 1 ? '×' + w.shots : '') + ' · ROF ' + w.rof + ' · MAG ' + w.ammo + ' · ~' + dps + ' DPS';
  }
  function buildShop() {
    injectShop();
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    disposeShopPreviews();
    grid.innerHTML = '';
    const bal = balance();
    const balNum = document.getElementById('shopBalNum');
    if (balNum) balNum.textContent = String(bal);
    NEW_WEAPONS.forEach(w => {
      const ownsIt = owns(w.kind);
      const afford = bal >= w.cost;
      const card = document.createElement('div');
      card.className = 'shopItem ' + (ownsIt ? 'owned' : afford ? '' : 'locked');
      card.innerHTML = `
        <canvas class="siGun3d" data-kind="${w.kind}" aria-label="${w.name}"></canvas>
        <div class="siName">${w.name}</div>
        <div class="siDesc">${w.desc}</div>
        <div class="siStats">${statLine(w)}</div>
        <div class="siCost"><img src="${SPRITE_URL}"/> ${w.cost} RuneStones</div>
        <button class="shopBuy ${ownsIt ? 'owned' : afford ? 'afford' : 'locked'}" data-kind="${w.kind}">
          ${ownsIt ? '✓ Owned' : afford ? 'Unlock' : 'Need ' + w.cost}
        </button>`;
      const btn = card.querySelector('.shopBuy');
      if (!ownsIt && afford) {
        btn.addEventListener('click', () => { unlock(w.kind); });
      }
      grid.appendChild(card);
      const cv = card.querySelector('.siGun3d');
      if (cv && window.ShopGunPreview) shopPreviews.push(window.ShopGunPreview.mount(cv, w.kind));
    });
  }
  function openShop() {
    injectShop();
    document.querySelectorAll('.overlay').forEach(o => { if (o.id !== 'overlayShop') o.style.display = 'none'; });
    buildShop();
    document.getElementById('overlayShop').style.display = 'grid';
  }

  // ---- Init ------------------------------------------------------------
  function init() {
    ensureBadge();
    refreshBadge();
    const b = document.getElementById('introShop');
    if (b) b.addEventListener('click', openShop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  // Badge may attach after the intro hub is (re)shown; re-attach on a timer briefly.
  setInterval(() => { if (!document.getElementById('runeBalanceBadge')) ensureBadge(); refreshBadge(); }, 1000);

  window.RS = {
    SPRITE_URL, NEW_WEAPONS, CATALOG, BASE_KINDS,
    balance, owns, ownedKinds, unlock, add, spend,
    onWaveStart, onGameOver, awardPvpPlacement, awardWarden, awardHollow, resetRun,
    openShop, buildShop, refreshBadge
  };
})();
