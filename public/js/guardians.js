// ============================================================
// Monster Arena — Themed Building Guardians (offline only)
// Rare landmarks are defended by EVOLVING wardens whose power,
// count, size and abilities scale with the building's rarity
// tier (1 common → 4 legendary). Each map theme gives its
// guardians a distinct elemental kit (nature / sand / frost /
// fire / void). Wardens orbit while idle, then break orbit and
// HUNT the player with ranged + special powers and real melee
// contact damage — so venturing near a landmark is dangerous.
// The game loop wires this in via Guardians.setEnv() + spawn/tick/draw.
// ============================================================
(function () {
  'use strict';
  let env = null;

  // ---- rarity tier scaling (1 common → 4 legendary/mythic) --------------
  const TIER = {
    // aggro = activation radius (enter => wake & attack); leash = give-up radius (exit => return to post). leash > aggro.
    1: { hpMul: 1.0, dmgMul: 1.0, count: 1, cdMul: 1.00, sizeMul: 1.00, spdMul: 1.00, aggro: 520, leash: 900, orbs: 1 },
    2: { hpMul: 2.4, dmgMul: 1.5, count: 2, cdMul: 0.82, sizeMul: 1.25, spdMul: 1.06, aggro: 580, leash: 980, orbs: 2 },
    3: { hpMul: 5.0, dmgMul: 2.1, count: 3, cdMul: 0.68, sizeMul: 1.55, spdMul: 1.12, aggro: 640, leash: 1080, orbs: 3 },
    4: { hpMul: 9.0, dmgMul: 3.0, count: 4, cdMul: 0.55, sizeMul: 1.90, spdMul: 1.18, aggro: 720, leash: 1200, orbs: 5 },
  };
  const EVO_PREFIX = { 1: '', 2: 'Ascended ', 3: 'Exalted ', 4: 'Mythic ' };

  // ---- per-map themed power kits ---------------------------------------
  // ranged = spammable themed projectile(s); special = scary cooldown nuke.
  const KIT = {
    1: { name: 'nature', col: '#7dffa3', ranged: 'thorn',   special: 'spore',     specialDmg: 1.8, rangedDmg: 1.0 },
    2: { name: 'sand',   col: '#ffd166', ranged: 'sanddart', special: 'sandstorm', specialDmg: 1.6, rangedDmg: 0.9 },
    3: { name: 'frost',  col: '#9fe3ff', ranged: 'iceshard', special: 'blizzard',  specialDmg: 1.7, rangedDmg: 0.95 },
    4: { name: 'fire',   col: '#ff7a66', ranged: 'firebolt', special: 'erupt',    specialDmg: 2.0, rangedDmg: 1.1 },
    5: { name: 'void',   col: '#d066ff', ranged: 'voidbolt', special: 'rift',     specialDmg: 1.9, rangedDmg: 1.05 },
  };

  function setEnv(e) { env = e || {}; }

  function spawnLoot(g) {
    if (!env || !env.dropXpOrb) return;
    const t = TIER[g.tier];
    for (let i = 0; i < t.orbs; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 22;
      env.dropXpOrb(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r, 6 + g.tier * 5);
    }
    if (env.dropPickup) for (let i = 0; i < g.tier; i++) if (Math.random() < 0.6) env.dropPickup(g.x, g.y);
  }

  function spawn() {
    if (!env) return;
    const { ents, world, isNetActive, getBuildingGuardian } = env;
    if (!ents || !world) return;
    ents.guardians = ents.guardians || [];
    ents.guardians.length = 0;
    if (window.TEAMS_MODE) return;                     // Teams mode: no building guardians
    if (isNetActive && isNetActive()) return;          // server-authoritative online
    if (!getBuildingGuardian) return;
    for (const b of world.buildings) {
      if (!b._type) continue;
      const g = getBuildingGuardian(b);
      if (!g) continue;
      const tier = Math.max(1, Math.min(4, g.rarity || 1));
      const t = TIER[tier];
      const kit = KIT[g.level || b._lvl || 1] || KIT[1];
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const baseR = 16 * t.sizeMul;
      const n = t.count;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + Math.random() * 0.3;
        ents.guardians.push({
          b, id: 'gd_' + b.x + '_' + b.y + '_' + i,
          tier, level: g.level || b._lvl || 1,
          power: g.power, col: kit.col, kitName: kit.name,
          name: EVO_PREFIX[tier] + g.name,
          x: cx + Math.cos(a0) * (Math.max(b.w, b.h) * 0.5 + 50),
          y: cy + Math.sin(a0) * (Math.max(b.w, b.h) * 0.5 + 50),
          orbitA: a0, orbitR: Math.max(b.w, b.h) * 0.5 + 50 + i * 8,
          spd: 0.6 * t.spdMul * (g.speed || 1),
          chaseSpd: (170 + tier * 38) * (g.speed || 1),
          hp: (g.hp || 140) * t.hpMul, maxhp: (g.hp || 140) * t.hpMul,
          r: baseR,
          dmg: (g.dmg || 12) * t.dmgMul,
          rangedCD: 1.0 + Math.random() * 1.2,
          specialCD: 3.5 + Math.random() * 2.0,
          healCD: 2.5, aggro: false, phaseT: 0, alive: true,
          kit, blink: 0,
        });
      }
    }
  }

  // ---- helpers ----------------------------------------------------------
  function shoot(g, ang, speed, dmg, col, opts) {
    const { ents, addEffect, w3On, W3 } = env;
    opts = opts || {};
    ents.ebullets.push({
      x: g.x, y: g.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      r: opts.r || 5, dmg, life: opts.life || 2.6, glyphColor: col,
      guardian: true, kind: opts.kind,
      z: (w3On && w3On()) ? W3.terrain(g.x, g.y) + 34 : undefined
    });
    if (addEffect) addEffect(g.x, g.y, 'pop', 0.2, col);
  }

  function tryMove(g, dx, dy) {
    const world = env.world;
    const r = g.r;
    let nx = g.x + dx, ny = g.y + dy;
    if (world && world.isBlocked) {
      if (world.isBlocked(nx, g.y, r)) nx = g.x;
      if (world.isBlocked(nx, ny, r)) ny = g.y;
    }
    nx = Math.max(20, Math.min(world.w - 20, nx));
    ny = Math.max(20, Math.min(world.h - 20, ny));
    g.x = nx; g.y = ny;
  }

  function applySpecial(g) {
    const { ents, addEffect, spawnEnemy, aoeDamage, hurtPlayer, cam, player, dist2 } = env;
    const k = g.kit;
    const dmg = g.dmg * k.specialDmg;
    const col = g.col;
    if (k.special === 'spore') {                       // nature: poison bloom + summon
      aoeDamage(g.x, g.y, 140 + g.tier * 14, dmg, { col, stun: 0.4, kind: 'earth' });
      if (dist2(g.x, g.y, player.x, player.y) < 300 * 300) player.slowT = Math.max(player.slowT, 1.8);
      addEffect(g.x, g.y, 'pop', 0.6, col); cam.shake = Math.max(cam.shake, 5);
      if (ents.enemies.length < 40 && spawnEnemy) for (let i = 0; i < g.tier; i++) spawnEnemy('chaser', g.x + (Math.random() - .5) * 40, g.y + (Math.random() - .5) * 40);
    } else if (k.special === 'sandstorm') {           // desert: blinding storm + mummy
      aoeDamage(g.x, g.y, 160 + g.tier * 16, dmg, { col, stun: 0.6, kind: 'lightning' });
      if (dist2(g.x, g.y, player.x, player.y) < 360 * 360) player.slowT = Math.max(player.slowT, 2.2);
      addEffect(g.x, g.y, 'pop', 0.7, col); cam.shake = Math.max(cam.shake, 7);
      if (ents.enemies.length < 40 && spawnEnemy) spawnEnemy('tank', g.x + (Math.random() - .5) * 30, g.y + (Math.random() - .5) * 30);
    } else if (k.special === 'blizzard') {            // ice: deep freeze AoE
      aoeDamage(g.x, g.y, 150 + g.tier * 14, dmg, { col, stun: 1.0, kind: 'water' });
      if (dist2(g.x, g.y, player.x, player.y) < 380 * 380) player.slowT = Math.max(player.slowT, 2.6);
      addEffect(g.x, g.y, 'pop', 0.7, col); cam.shake = Math.max(cam.shake, 6);
    } else if (k.special === 'erupt') {               // lava: eruption + burn
      aoeDamage(g.x, g.y, 150 + g.tier * 18, dmg, { col, burn: true, kind: 'fire' });
      addEffect(g.x, g.y, 'pop', 0.7, col); cam.shake = Math.max(cam.shake, 9);
    } else if (k.special === 'rift') {                // void: teleport ambush + void burst
      const ang = env.angleTo(g.x, g.y, player.x, player.y);
      g.x = player.x + Math.cos(ang + Math.PI) * 70; g.y = player.y + Math.sin(ang + Math.PI) * 70;
      g.phaseT = 0.45; g.blink = 0.4;
      aoeDamage(g.x, g.y, 120 + g.tier * 12, dmg, { col, stun: 0.5, kind: 'spirit' });
      addEffect(g.x, g.y, 'pop', 0.6, col); cam.shake = Math.max(cam.shake, 8);
    }
  }

  function fireRanged(g) {
    const k = g.kit;
    const ang = env.angleTo(g.x, g.y, env.player.x, env.player.y);
    const dmg = g.dmg * k.rangedDmg;
    const col = g.col;
    if (k.ranged === 'thorn') { shoot(g, ang, 560, dmg, col); }
    else if (k.ranged === 'sanddart') { for (let i = -1; i <= 1; i++) shoot(g, ang + i * 0.16, 520, dmg, col); }
    else if (k.ranged === 'iceshard') { for (let i = -1; i <= 1; i++) shoot(g, ang + i * 0.20, 500, dmg, col, { r: 6 }); }
    else if (k.ranged === 'firebolt') { shoot(g, ang, 600, dmg, col, { r: 6, life: 2.2 }); if (g.tier >= 3) shoot(g, ang + 0.12, 600, dmg * 0.6, col, { r: 5 }); }
    else if (k.ranged === 'voidbolt') { shoot(g, ang, 540, dmg, col, { r: 7 }); if (g.tier >= 2) for (let i = 1; i <= g.tier - 1; i++) { shoot(g, ang + i * 0.25, 520, dmg * 0.7, col, { r: 6 }); shoot(g, ang - i * 0.25, 520, dmg * 0.7, col, { r: 6 }); } }
    else shoot(g, ang, 520, dmg, col);
  }

  function tick(dt) {
    if (!env) return;
    const { ents, player, dist2, addEffect, cam, w3On, W3, isNetActive } = env;
    if (!ents || !ents.guardians) return;
    if (isNetActive && isNetActive()) { ents.guardians.length = 0; return; }
    for (const g of ents.guardians) {
      if (!g.alive) continue;
      const b = g.b;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const t = TIER[g.tier];
      // Activation is measured from the BUILDING (so "get close to the building" wakes them).
      // Hysteresis: wake within `aggro`, only give up the chase once the player leaves the larger `leash`.
      const d2b = dist2(cx, cy, player.x, player.y);
      if (!g.aggro) { if (d2b < t.aggro * t.aggro) g.aggro = true; }
      else { if (d2b > t.leash * t.leash) g.aggro = false; }
      if (g.blink > 0) g.blink = Math.max(0, g.blink - dt);
      if (g.phaseT > 0) g.phaseT = Math.max(0, g.phaseT - dt);

      if (g.aggro && g.phaseT <= 0) {
        // HUNT the player — chase with wall-sliding steering
        const ang = env.angleTo(g.x, g.y, player.x, player.y);
        const sp = g.chaseSpd;
        tryMove(g, Math.cos(ang) * sp * dt, Math.sin(ang) * sp * dt);
      } else {
        // return to the post, then resume orbiting the landmark
        g.orbitA += g.spd * dt;
        const tx = cx + Math.cos(g.orbitA) * g.orbitR, ty = cy + Math.sin(g.orbitA) * g.orbitR;
        const dx = tx - g.x, dy = ty - g.y, dd = Math.hypot(dx, dy) || 1;
        const retSpd = g.chaseSpd * 1.15;
        if (dd > retSpd * dt) tryMove(g, dx / dd * retSpd * dt, dy / dd * retSpd * dt);
        else { g.x = tx; g.y = ty; }
      }

      // ---- melee contact (only while hunting) ----
      if (g.aggro) {
        const d2p = dist2(g.x, g.y, player.x, player.y);
        const mr = (g.r + player.r);
        if (d2p < mr * mr) {
          env.hurtPlayer(g.dmg * dt * 2.4);
          const ang = env.angleTo(g.x, g.y, player.x, player.y);
          player.x += Math.cos(ang) * 14 * dt * 60 * 0.05;
          player.y += Math.sin(ang) * 14 * dt * 60 * 0.05;
          if (addEffect && Math.random() < dt * 6) addEffect(player.x, player.y, 'hit', 0.12, g.col);
        }
      }

      // ---- ranged power (only while hunting) ----
      g.rangedCD -= dt;
      if (g.aggro && g.rangedCD <= 0 && g.phaseT <= 0) {
        fireRanged(g);
        g.rangedCD = (1.7 + Math.random() * 0.6) * t.cdMul;
      }

      // ---- special power (only while hunting) ----
      g.specialCD -= dt;
      if (g.aggro && g.specialCD <= 0) {
        applySpecial(g);
        g.specialCD = (4.2 + Math.random() * 1.4) * t.cdMul;
      }

      // ---- heal aura (tier 3+; only while hunting) ----
      if (g.tier >= 3 && g.aggro) {
        g.healCD -= dt;
        if (g.healCD <= 0) {
          g.healCD = 2.6;
          for (const e of ents.enemies) if (dist2(e.x, e.y, g.x, g.y) < 280 * 280) e.hp = Math.min(e.maxhp || e.hp, e.hp + 8 + g.tier * 4);
          if (addEffect) addEffect(g.x, g.y, 'pop', 0.25, g.col);
        }
      }

      // ---- INVINCIBLE: player bullets are absorbed with a spark, but the guardian takes no damage and never dies.
      for (let bi = ents.bullets.length - 1; bi >= 0; bi--) {
        const bl = ents.bullets[bi];
        if (bl.fromBot) continue;
        const rr = (g.r || 16) + (bl.r || 4);
        if (dist2(g.x, g.y, bl.x, bl.y) < rr * rr) {
          g.blink = 0.12;
          if (addEffect) addEffect(bl.x, bl.y, 'hit', 0.15, g.col);
          ents.bullets.splice(bi, 1);
        }
      }
    }
    ents.guardians = ents.guardians.filter(g => g.alive);
  }

  // ---- 2D fallback renderer (only visible when 3D off) -----------------
  function draw2D(ctx) {
    if (!env || !env.ents || !env.ents.guardians) return;
    const { ents, cam } = env;
    const t = performance.now() / 1000;
    for (const g of ents.guardians) {
      const x = g.x - cam.x - cam.sx, y = g.y - cam.y - cam.sy;
      const b = g.b, cx = b.x + b.w / 2 - cam.x - cam.sx, cy = b.y + b.h / 2 - cam.y - cam.sy;
      const pulse = 0.55 + 0.45 * Math.sin(t * 4 + g.orbitA);
      ctx.save();
      // tether to landmark
      ctx.strokeStyle = g.col + '22'; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke(); ctx.setLineDash([]);
      // dark menace aura
      const ar = g.r * 2.6;
      const grd = ctx.createRadialGradient(x, y, 2, x, y, ar);
      grd.addColorStop(0, g.col); grd.addColorStop(0.5, g.col + '44'); grd.addColorStop(1, g.col + '00');
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5 * pulse;
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, ar, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      // scary body — dark core with glowing rim
      const blink = g.blink > 0;
      ctx.fillStyle = blink ? '#fff' : '#0a0a12';
      ctx.beginPath(); ctx.arc(x, y, g.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = g.col; ctx.lineWidth = 3; ctx.shadowColor = g.col; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(x, y, g.r, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      // spikes around (tier+1)
      const spikes = g.tier + 2;
      ctx.fillStyle = g.col;
      for (let i = 0; i < spikes; i++) {
        const a = i / spikes * Math.PI * 2 + t * 0.8;
        const r0 = g.r, r1 = g.r + 6 + g.tier * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a - 0.18) * r0, y + Math.sin(a - 0.18) * r0);
        ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(x + Math.cos(a + 0.18) * r0, y + Math.sin(a + 0.18) * r0);
        ctx.closePath(); ctx.fill();
      }
      // glowing eyes (tier-based — more eyes = scarier)
      const eyes = g.tier + 1;
      ctx.fillStyle = '#fff'; ctx.shadowColor = g.col; ctx.shadowBlur = 10;
      for (let i = 0; i < eyes; i++) {
        const ea = (i / eyes - 0.5) * 0.9;
        const ex = x + Math.cos(g.orbitA + ea) * g.r * 0.45, ey = y + Math.sin(g.orbitA + ea) * g.r * 0.45;
        ctx.beginPath(); ctx.arc(ex, ey, 2.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      // rotating rune rings (tier)
      for (let i = 0; i < g.tier; i++) {
        ctx.strokeStyle = g.col + 'cc'; ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * (30 + i * 20);
        ctx.beginPath(); ctx.arc(x, y, g.r + 8 + i * 5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }
      // immortal shell ring (guardians cannot be killed — no HP arc)
      ctx.strokeStyle = g.col + '55'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, g.r + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // ---- 3D renderer hook (drawn from render3d_fx.collect via F.guardians)
  function draw3D(R, F) {
    if (!env || !env.ents || !env.ents.guardians) return;
    if (!R || !R.draw || !R.unit) return;
    const tt = F.t || 0;
    for (const g of env.ents.guardians) {
      if (!g.alive) continue;
      const bob = Math.sin(tt * 2 + g.orbitA) * 5;
      const gy = (g._gy || 0);
      const y = gy + 30 + bob + g.r * 0.4;
      const col = R.hexRGB ? R.hexRGB(g.col) : [1, 1, 1];
      const em = [col[0] * 1.9, col[1] * 1.9, col[2] * 1.9];
      const dark = [col[0] * 0.18, col[1] * 0.18, col[2] * 0.22];
      const sz = g.r * 0.7;
      const blink = g.blink > 0;
      // dark menacing core
      R.draw(R.unit.sphere, R.mm(g.x, y, g.y, tt * 1.4, sz, sz, sz),
        R.mat(dark, { emissive: em, metal: 0.7, rough: 0.12, shadow: false }));
      // glowing inner eye-core (blinks white when hit)
      const eyeC = blink ? [1, 1, 1] : col;
      R.draw(R.unit.sphere, R.mm(g.x, y, g.y, tt * 3, sz * 0.5, sz * 0.5, sz * 0.5),
        R.mat(eyeC, { emissive: blink ? [1.5, 1.5, 1.5] : em, shadow: false }));
      // crown of spikes (count grows with tier)
      const spikes = g.tier + 2;
      for (let i = 0; i < spikes; i++) {
        const a = i / spikes * Math.PI * 2 + tt * 0.7;
        const px = g.x + Math.cos(a) * sz * 1.05, pz = g.y + Math.sin(a) * sz * 1.05;
        R.draw(R.unit.cone, R.mm(px, y, pz, a + tt * 2, sz * 0.4, sz * (1.0 + g.tier * 0.12), sz * 0.4),
          R.mat(col, { emissive: em, shadow: false }));
      }
      // orbiting rune rings (one per tier)
      for (let i = 0; i < g.tier; i++) {
        R.draw(R.unit.torus, R.mm(g.x, y + i * 3.5, g.y, tt * (1.4 + i * 0.5) + i, sz + 9 + i * 3, sz + 9 + i * 3, sz + 9 + i * 3),
          R.mat(col, { emissive: em, shadow: false }));
      }
      // mythic floating crown (tier 4)
      if (g.tier >= 4) {
        R.draw(R.unit.torus, R.mm(g.x, y + sz * 2.1, g.y, tt * 0.6, sz * 1.7, sz * 1.7, sz * 0.5, Math.PI / 2),
          R.mat([1, 1, 1], { emissive: col, shadow: false }));
      }
      // small orbiting eyes for higher tiers
      if (g.tier >= 3) {
        const eyes = g.tier;
        for (let i = 0; i < eyes; i++) {
          const a = i / eyes * Math.PI * 2 + tt * 1.8;
          const ex = g.x + Math.cos(a) * (sz + 14), ez = g.y + Math.sin(a) * (sz + 14);
          R.draw(R.unit.sphere, R.mm(ex, y, ez, 0, 2.6, 2.6, 2.6),
            R.mat([1, 1, 1], { emissive: em, shadow: false }));
        }
      }
      R.glow(g.x, y, g.y, sz * 3.2, col[0], col[1], col[2], 0.9, 0);
      R.light(g.x, y, g.y, 200 + g.tier * 40, col[0], col[1], col[2], 0.6 + g.tier * 0.05);
    }
  }

  function setGround() {
    if (!env || !env.ents || !env.ents.guardians) return;
    const W3 = env.W3, w3On = env.w3On;
    for (const g of env.ents.guardians) g._gy = (w3On && w3On()) ? W3.terrain(g.x, g.y) : 0;
  }

  window.Guardians = { setEnv, spawn, tick, draw2D, draw3D, setGround };
})();
