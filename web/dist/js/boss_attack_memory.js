// ============================================================
// Monster Arena — BOSS ATTACK MEMORY
// Tracks how much damage each distinct boss attack actually deals
// to the player during the first four realm boss fights. Persists
// the top-two attacks per realm to localStorage so the Void boss
// can echo the deadliest moves it "remembers".
// ============================================================
(function () {
  'use strict';
  const KEY = 'arena_boss_attack_memory_v1';
  // realmId (1-4) -> { attackKey -> { key, name, damage, hits } }
  let memory = {};

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) memory = JSON.parse(raw) || {}; } catch (_) { memory = {}; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (_) {} }

  load();

  function record(realmId, attackKey, attackName, damage) {
    if (!realmId || !attackKey || damage <= 0) return;
    if (!memory[realmId]) memory[realmId] = {};
    const entry = memory[realmId][attackKey] || { key: attackKey, name: attackName || attackKey, damage: 0, hits: 0 };
    entry.damage += damage;
    entry.hits += 1;
    memory[realmId][attackKey] = entry;
  }

  // Returns the top-two attacks for a realm, ranked by total damage.
  // Falls back to sensible defaults if no data was recorded.
  function getTopTwo(realmId) {
    const realm = memory[realmId];
    if (!realm) return DEFAULTS[realmId] || [];
    const arr = Object.values(realm).sort((a, b) => b.damage - a.damage);
    const top = arr.slice(0, 2).map(a => ({ key: a.key, name: a.name }));
    if (top.length < 2 && DEFAULTS[realmId]) {
      for (const d of DEFAULTS[realmId]) {
        if (!top.some(t => t.key === d.key)) top.push(d);
        if (top.length >= 2) break;
      }
    }
    return top;
  }

  // Default attacks per realm if no damage data exists (first-time playthrough)
  const DEFAULTS = {
    1: [{ key: 'hearthquake', name: 'Hearthquake' }, { key: 'thornCage', name: 'Thorn Cage' }],
    2: [{ key: 'refractionBeam', name: 'Refraction Beam' }, { key: 'shatteredHalo', name: 'Shattered Halo' }],
    3: [{ key: 'frostCross', name: 'Frost Cross' }, { key: 'fateCascade', name: 'Fate Cascade' }],
    4: [{ key: 'anvilfall', name: 'Anvilfall' }, { key: 'worldForgingBlow', name: 'World-Forging Blow' }]
  };

  function reset() { memory = {}; save(); }
  function getRaw() { return memory; }

  window.BossAttackMemory = { record, getTopTwo, reset, getRaw, save };
})();
