// ============================================================
// Monster Arena — TEAMS mode (offline practice)
// Two giants (blue vs red). Bots are all red; the player is blue.
// Goal: destroy the enemy (red) giant. Giants lob magical fireballs
// at each other across the map but cannot hurt players. Neutral
// white golems dot the arena; deal enough damage to one and it
// activates to your team's colour, then marches on the enemy giant
// and detonates a kill circle around it. Golems chase nearby enemy
// players instead of the giant while that player stays in range.
// Players revive on death but lose a chunk of max ammo each time
// (floored at 1). Giants periodically pulse, clearing enemy golems
// inside their radius (never players).
//
// Hooks required in pve16.js (kept minimal):
//   restart()        -> Teams.init({...}) / Teams.reset()
//   updateFixed()   -> Teams.tick(dt)
//   draw() (2D)     -> Teams.draw(ctx, cam, t)   (3D path skipped)
//   player death    -> Teams.onPlayerDeath() bypasses game-over
//   input freeze     -> window.TEAMS_REVIVE freezes movement/fire
// ============================================================
(function () {
  'use strict';

  let T = null;
  const TEAM_COLORS = { 0: '#3aa6ff', 1: '#ff4a4a' }; // blue, red
  const NEUTRAL = '#e6e8ee';

  // Find a non-blocked spot near (cx,cy) so giants/bots/players never spawn inside a wall, building or obstacle.
  function safePos(cx, cy, r, spread, world) {
    for (let i = 0; i < 24; i++) {
      const x = cx + (Math.random() - 0.5) * spread;
      const y = cy + (Math.random() - 0.5) * spread;
      if (!world.isBlocked || !world.isBlocked(x, y, r)) return { x, y };
    }
    return { x: cx, y: cy };
  }

  // Obstacle-aware steering for golems. Big golems can't fit through doorways
  // or narrow gaps, so when the direct heading is blocked this fans out to
  // either side (preferring the side it last dodged toward) until it finds a
  // clear line, routing the golem AROUND buildings instead of into them.
  function goSteer(go, world, dirX, dirY) {
    if (!world || typeof world.isBlocked !== 'function') return { x: dirX, y: dirY };
    const probe = go.r + 34;
    if (!world.isBlocked(go.x + dirX * probe, go.y + dirY * probe, go.r)) return { x: dirX, y: dirY };
    const baseAng = Math.atan2(dirY, dirX);
    const offsets = [0.45, 0.9, 1.35, 1.8, 2.4];
    const sign = go.avoidSign || 1;
    for (const off of offsets) {
      for (const s of [sign, -sign]) {
        const a = baseAng + off * s;
        const nx = Math.cos(a), ny = Math.sin(a);
        if (!world.isBlocked(go.x + nx * probe, go.y + ny * probe, go.r)) return { x: nx, y: ny };
      }
    }
    go.avoidSign = -sign; // boxed in everywhere we tried — back off + flip side
    return { x: -dirX, y: -dirY };
  }

  function init(opts) {
    const world = opts.world;
    const g0p = safePos(360, world.h / 2, 92, 520, world);
    const g1p = safePos(world.w - 360, world.h / 2, 92, 520, world);
    T = {
      player: opts.player,
      world,
      ents: opts.ents,
      cam: opts.cam,
      weapons: opts.weapons,
      audio: opts.audio,
      addEffect: opts.addEffect,
      moveWithCollide: opts.moveWithCollide,
      dist2: opts.dist2,
      clamp: opts.clamp,
      rand: opts.rand,
      rint: opts.rint,
      botsRef: opts.SP_BOTS,
      playerTeam: 0,
      giants: [
        { team: 0, x: g0p.x, y: g0p.y, r: 92, hp: 18000, maxhp: 18000, fireT: 3.0, clearT: 8, name: 'BLUE TITAN' },
        { team: 1, x: g1p.x, y: g1p.y, r: 92, hp: 18000, maxhp: 18000, fireT: 3.6, clearT: 9, name: 'RED TITAN' }
      ],
      golems: [],
      fireballs: [],
      over: false,
      winner: null,
      reviveT: 0
    };

    // Split bots across BOTH teams so the player has teammates. Roles:
    //   defender  — stays near own giant, intercepts attackers
    //   attacker  — pushes toward the enemy giant
    //   golemancer— seeks neutral golems to activate + kills enemy golems
    if (T.botsRef) {
      // Expanded roster of roles so a team isn't three flavours of the same
      // bot. Each role is paired with a preferred weapon so bots actually
      // fight with different guns instead of all defaulting to the pistol.
      const roles = ['attacker', 'defender', 'golemancer', 'sniper', 'rusher', 'skirmisher', 'warden'];
      const roleWeapon = { attacker: 'rifle', defender: 'shotgun', golemancer: 'pistol', sniper: 'rifle', rusher: 'shotgun', skirmisher: 'pistol', warden: 'rifle' };
      for (let i = 0; i < T.botsRef.length; i++) {
        const b = T.botsRef[i];
        b.team = (i % 2 === 0) ? 0 : 1;                 // alternate blue / red
        b.role = roles[i % roles.length];
        b.preferredKind = roleWeapon[b.role] || 'rifle';
        // equip the role's preferred weapon and give it a fresh mag/reserve
        const wi = T.weapons.findIndex(w => w.kind === b.preferredKind);
        if (wi >= 0) { b.weapon = wi; const w = T.weapons[wi]; b.ammo = w.ammo; b.reserve = w.reserve; }
        const myG = T.giants[b.team];
        const bp = safePos(myG.x, myG.y, b.r || 16, 760, world);
        b.x = bp.x; b.y = bp.y;
        b.hp = b.hpMax;
        b._teamsReviving = false;
        b._teamsReviveT = 0;
        b.homeX = myG.x; b.homeY = myG.y;              // role anchor (own giant)
        b.leash = b.role === 'defender' ? 520 : 1400;
      }
    }
    // NOTE: the player object is Object.seal()'d in pve16.js, so we can't
    // attach team/death counters to it. Keep them on T instead.
    T.playerDeaths = 0;

    // Teams mode: strip guardians and themed/special landmark buildings so
    // the arena is just plain geometry + the titans and golems. _onWorldBuilt
    // (building_catalog.js) and Guardians.spawn (guardians.js) already ran in
    // buildWorld before us, so we just clear what they produced.
    if (T.ents && T.ents.guardians) T.ents.guardians.length = 0;
    if (world.buildings) {
      for (const b of world.buildings) {
        b._type = null; b.typeId = null; b._guardianSpawned = true; // prevent re-spawn
      }
    }
    if (world.chests) {
      for (const ch of world.chests) { ch.typeId = null; ch.typeLabel = null; ch.glow = null; }
    }

    // Scatter neutral golems of three sizes through the arena. We probe
    // with a smaller radius than the golem's body (walls are thin) so the
    // spawn search doesn't reject almost every spot in a busy arena and
    // leave no golems on the field.
    const NG = 20;
    for (let i = 0; i < NG; i++) {
      const size = i < 4 ? 'small' : i < 8 ? 'medium' : 'large';
      const r = size === 'small' ? 28 : size === 'medium' ? 42 : 60;
      const threshold = size === 'small' ? 70 : size === 'medium' ? 160 : 280;
      const hp = size === 'small' ? 220 : size === 'medium' ? 460 : 780;
      const killR = r * 2.4;
      const killDmg = size === 'small' ? 45 : size === 'medium' ? 80 : 140;
      let x = world.w / 2, y = world.h / 2, tries = 0, clear = false;
      const probe = Math.max(14, r * 0.5);
      while (tries < 60) {
        x = opts.rand(700, world.w - 700);
        y = opts.rand(600, world.h - 600);
        tries++;
        if (!world.isBlocked || !world.isBlocked(x, y, probe)) { clear = true; break; }
      }
      // spawn regardless — even if every spot touched a wall, a golem
      // sitting near a wall is better than no golems at all.
      void clear;
      T.golems.push({
        x, y, r, size, threshold,
        dmg: { 0: 0, 1: 0 },
        activated: false, team: null,
        hp, maxhp: hp,
        killR, killDmg,
        speed: 64 + (size === 'small' ? 18 : size === 'medium' ? 0 : -10),
        state: 'idle', killT: 0,
        dPhase: 'idle', dT: 0, _dead: false,
        targetGiant: null, aggroT: 0,
        wobble: Math.random() * Math.PI * 2
      });
    }
  }

  function reset() { T = null; window.TEAMS_REVIVE = false; hideHud(); }

  function spawnGolemDeath(go) {
    if (!T) return;
    T.addEffect(go.x, go.y, 'pop', 0.5, go.activated ? TEAM_COLORS[go.team] : NEUTRAL);
    T.ents.effects.push({ type: 'triBurst', x: go.x, y: go.y, shards: makeShards(go), life: 0.7, t: 0 });
  }
  function makeShards(go) {
    const col = go.activated ? TEAM_COLORS[go.team] : NEUTRAL;
    const out = [];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 260;
      out.push({ x: go.x, y: go.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, r1: 4 + Math.random() * 5, r2: 4, r3: 4, a: 1, col });
    }
    return out;
  }

  function hurtPlayerTeams(dmg) {
    const p = T.player;
    let left = dmg;
    if (p.shield > 0) { const u = Math.min(p.shield, left * 0.8); p.shield -= u; left -= u; }
    p.hp -= left; if (p.hp < 0) p.hp = 0;
  }

  function endMatch(winner) {
    if (!T || T.over) return;
    T.over = true; T.winner = winner;
    const st = window.__dbg && window.__dbg.state; if (st) st.running = false;
    hideHud();
    if (winner === T.playerTeam) {
      const ov = document.getElementById('overlayVictory');
      if (ov) ov.style.display = 'grid';
      try { if (window.RS) window.RS.awardPvpPlacement(1, 2); } catch (_) {}
    } else {
      if (window.showDeathOverlay) window.showDeathOverlay('Your Titan was destroyed');
      else { const ov = document.getElementById('overlayPause'); if (ov) { ov.style.display = 'grid'; const h = ov.querySelector('h2'); if (h) h.textContent = '☠️ Defeat'; } }
    }
  }

  function damageGolem(go, dmg, team, source) {
    if (go.activated) {
      // Activated golems can only be destroyed by the boss (giant), the
      // player, or another golem — bots cannot kill them.
      if (source === 'bot') return false;
      if (team === go.team && source !== 'golem') return false;  // friendly fire off (golems ignore teams)
      go.hp -= dmg;
      if (go.hp <= 0) { spawnGolemDeath(go); return true; }
    } else {
      go.dmg[team] = (go.dmg[team] || 0) + dmg;
      if (go.dmg[team] >= go.threshold) {
        go.activated = true; go.team = team; go.state = 'march';
        go.targetGiant = T.giants.find(o => o.team !== team);
        T.ents.effects.push({ type: 'pop', x: go.x, y: go.y, life: 0.6, t: 0, color: TEAM_COLORS[team] });
        T.addEffect(go.x, go.y, 'pop', 0.5, TEAM_COLORS[team]);
      }
    }
    return false;
  }

  function tick(dt) {
    if (!T) return;
    if (T.over) return;
    const { player, world, ents, giants, golems, botsRef } = T;

    // ---- revive countdown: keep player safe + frozen ----
    if (window.TEAMS_REVIVE) {
      T.reviveT -= dt;
      player.hp = player.hpMax;                 // invulnerable while reviving
      if (T.reviveT <= 0) { window.TEAMS_REVIVE = false; player.shield = 60; }
    }

    // ---- giants: fireballs + periodic clear pulse ----
    for (const g of giants) {
      if (g.hp <= 0) { endMatch(g.team === 0 ? 1 : 0); return; }
      // face the enemy giant
      const enemyG = giants.find(o => o.team !== g.team);
      g.ang = Math.atan2((enemyG ? enemyG.y : g.y) - g.y, (enemyG ? enemyG.x : g.x) - g.x);
      // under-attack telegraph: set whenever hp dropped this tick, decays over time
      if (g._prevHp != null && g.hp < g._prevHp - 1) g.underAttackT = 6;
      g._prevHp = g.hp;
      if (g.underAttackT > 0) g.underAttackT = Math.max(0, g.underAttackT - dt);
      g.fireT -= dt;
      if (g.fireT <= 0) {
        g.fireT = 2.6 + Math.random() * 1.6;
        const enemy = giants.find(o => o.team !== g.team);
        const D = Math.hypot(enemy.x - g.x, enemy.y - g.y) || 1;
        const speed = 460;
        T.fireballs.push({ sx: g.x, sy: g.y, x: g.x, y: g.y, z: g.r * 0.6, sz: g.r * 0.6, tx: enemy.x, ty: enemy.y, target: enemy, t: 0, dur: D / speed, r: 16, dmg: 60, team: g.team, peak: 260 + D * 0.22 });
        if (T.audio && T.audio.shoot) T.audio.shoot();
      }
      g.clearT -= dt;
      if (g.clearT <= 0) {
        g.clearT = 7 + Math.random() * 3;
        const R = 380;
        for (let i = golems.length - 1; i >= 0; i--) {
          const go = golems[i];
          if (go.team === g.team) continue;     // only clear enemy golems
          if (T.dist2(go.x, go.y, g.x, g.y) < R * R) { spawnGolemDeath(go); golems.splice(i, 1); }
        }
        T.ents.effects.push({ type: 'pop', x: g.x, y: g.y, life: 0.6, t: 0, color: TEAM_COLORS[g.team] });
        if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 10);
      }
    }

    // ---- fireballs arc across the sky and strike the enemy giant (never players) ----
    for (let i = T.fireballs.length - 1; i >= 0; i--) {
      const f = T.fireballs[i];
      f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      f.x = f.sx + (f.tx - f.sx) * u;
      f.y = f.sy + (f.ty - f.sy) * u;
      f.z = f.sz + Math.sin(u * Math.PI) * f.peak;   // parabolic arc high above the arena
      if (u >= 1) {
        f.target.hp -= f.dmg;                          // guaranteed impact → giant HP actually drops
        T.addEffect(f.tx, f.ty, 'hit', 0.5, '#ff9a3c');
        T.ents.effects.push({ type: 'pop', x: f.tx, y: f.ty, life: 0.5, t: 0, color: '#ff9a3c' });
        if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 9);
        T.fireballs.splice(i, 1);
      }
    }

    // ---- player bullets vs golems + enemy titan (team 0 fires) ----
    for (let i = ents.bullets.length - 1; i >= 0; i--) {
      const b = ents.bullets[i];
      let hit = false;
      for (let j = 0; j < golems.length; j++) {
        const go = golems[j];
        if (T.dist2(b.x, b.y, go.x, go.y) < (b.r + go.r) * (b.r + go.r)) {
          const dead = damageGolem(go, b.dmg, 0, 'player');
          if (dead) golems.splice(j, 1);
          hit = true; break;
        }
      }
      if (!hit) {
        const eg = giants[1]; // enemy (red) titan
        if (T.dist2(b.x, b.y, eg.x, eg.y) < (b.r + eg.r) * (b.r + eg.r)) {
          eg.hp -= b.dmg; hit = true;
          T.addEffect(b.x, b.y, 'hit', 0.25, '#ffd24a');
          if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 2);
        }
      }
      if (hit) { ents.bullets.splice(i, 1); T.addEffect(b.x, b.y, 'hit', 0.15, '#fff'); }
    }
    // ---- bot bullets vs golems + enemy titan ----
    for (let i = ents.ebullets.length - 1; i >= 0; i--) {
      const b = ents.ebullets[i];
      if (b.kind === 'fireball' || !b.fromBot) continue;
      let hit = false;
      for (let j = 0; j < golems.length; j++) {
        const go = golems[j];
        if (T.dist2(b.x, b.y, go.x, go.y) < (b.r + go.r) * (b.r + go.r)) {
          // Bots can only ACTIVATE neutral golems; they cannot destroy
          // activated ones (only boss/player/golems can kill those).
          if (!go.activated) {
            const dead = damageGolem(go, b.dmg || 10, b.team, 'bot');
            if (dead) golems.splice(j, 1);
          }
          hit = true; break;
        }
      }
      if (!hit) {
        const eg = giants.find(g => g.team !== b.team);
        if (eg && T.dist2(b.x, b.y, eg.x, eg.y) < (b.r + eg.r) * (b.r + eg.r)) {
          eg.hp -= (b.dmg || 10); hit = true;
          T.addEffect(b.x, b.y, 'hit', 0.25, '#ffd24a');
          if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 2);
        }
      }
      if (hit) { ents.ebullets.splice(i, 1); T.addEffect(b.x, b.y, 'hit', 0.15, '#fff'); }
    }

    // ---- golem AI ----
    for (const go of golems) {
      if (!go.activated) continue;
      go.wobble += dt * 3;
      const enemyTeam = go.team === 0 ? 1 : 0;

      // chase a nearby enemy player if one is in range
      let chase = null;
      if (enemyTeam === 0 && !window.TEAMS_REVIVE) {
        if (T.dist2(go.x, go.y, player.x, player.y) < 440 * 440) chase = player;
      } else if (enemyTeam === 1 && botsRef) {
        for (const b of botsRef) {
          if (b.hp <= 0) continue;
          if (T.dist2(go.x, go.y, b.x, b.y) < 440 * 440) { chase = b; break; }
        }
      }
      let tx, ty;
      if (chase) { tx = chase.x; ty = chase.y; go.aggroT = 2.5; }
      else if (go.aggroT > 0) { go.aggroT -= dt; tx = go.targetGiant.x; ty = go.targetGiant.y; }
      else { tx = go.targetGiant.x; ty = go.targetGiant.y; }

      const dx = tx - go.x, dy = ty - go.y, d = Math.hypot(dx, dy) || 1;
      if (d > go.r + go.targetGiant.r + 6) {
        go._inRange = false;
        go.dPhase = 'idle'; go.dT = 0;     // reset telegraph if the target moves away
        const step = go.speed * dt;
        const st = goSteer(go, world, dx / d, dy / d);
        go.x += st.x * step; go.y += st.y * step;
      } else {
        // in detonation range — warn (ring grows), charge (holds), then detonate
        go._inRange = true;
        go.dT -= dt;
        if (go.dPhase === 'idle' || !go.dPhase) {
          go.dPhase = 'warn'; go.dT = 1.2;
        } else if (go.dPhase === 'warn' && go.dT <= 0) {
          go.dPhase = 'charge'; go.dT = 0.5;
        } else if (go.dPhase === 'charge' && go.dT <= 0) {
          go.dPhase = 'detonate';
          const R = go.killR;
          // Anything inside the glowing kill circle dies: the enemy titan takes
          // a big hit, enemy bots are slain outright, an enemy player is downed,
          // and rival golems caught in the blast are destroyed too.
          if (T.dist2(go.x, go.y, go.targetGiant.x, go.targetGiant.y) < R * R) {
            go.targetGiant.hp -= go.killDmg * 2;
            go.targetGiant.underAttackT = 6;
            T.addEffect(go.x, go.y, 'hit', 0.45, TEAM_COLORS[go.team]);
          }
          if (enemyTeam === 0 && !window.TEAMS_REVIVE && T.dist2(go.x, go.y, player.x, player.y) < R * R) hurtPlayerTeams(9999);
          if (botsRef) for (const b of botsRef) {
            if (b.hp <= 0 || b.team === go.team) continue;
            if (T.dist2(go.x, go.y, b.x, b.y) < R * R) b.hp = 0;
          }
          // golems destroy rival golems caught in the blast
          for (let k = golems.length - 1; k >= 0; k--) {
            const go2 = golems[k]; if (go2 === go || go2.team === go.team) continue;
            if (T.dist2(go.x, go.y, go2.x, go2.y) < R * R) { spawnGolemDeath(go2); golems.splice(k, 1); }
          }
          T.ents.effects.push({ type: 'killCircle', x: go.x, y: go.y, r: R, life: 0.9, t: 0, color: TEAM_COLORS[go.team] });
          if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 7);
          spawnGolemDeath(go); go._dead = true;   // the golem is consumed by its own blast
        }
      }
    }
    // remove golems that detonated
    for (let i = golems.length - 1; i >= 0; i--) if (golems[i]._dead) golems.splice(i, 1);

    // ---- bot revives (red team respawns at the red giant) ----
    if (botsRef) {
      for (const b of botsRef) {
        if (b.hp <= 0 && !b._teamsReviving) { b._teamsReviving = true; b._teamsReviveT = 4; }
        if (b._teamsReviving) {
          b._teamsReviveT -= dt;
          if (b._teamsReviveT <= 0) {
            const halfW = world.w / 2;
            const isBlue = b.team === 0;
            const br = safePos(
              isBlue ? T.rand(140, halfW - 110) : T.rand(halfW + 110, world.w - 140),
              T.rand(140, world.h - 140),
              b.r || 16, 140, world
            );
            b.hp = b.hpMax; b.x = br.x; b.y = br.y;
            // respawn with a fresh loadout so a bot that bled dry isn't useless
            const w = T.weapons[b.weapon] || T.weapons[0];
            if (w) { b.ammo = w.ammo; b.reserve = w.reserve; }
            b._teamsReviving = false;
            b._deathHandled = false;   // allow next death to drop a cache again
            b.target = null; b.seekingChest = false; b.chestTarget = null;
            b.reloading = false; b.reloadT = 0;
          }
        }
      }
    }
    updateHud();
  }

  function onPlayerDeath() {
    if (!T) return false;
    const p = T.player;
    T.playerDeaths = (T.playerDeaths || 0) + 1;
    p.ammo = Math.max(1, p.ammo - 2);
    p.reserve = Math.max(1, p.reserve - 25);
    if (p.wstats) for (const k in p.wstats) { const ws = p.wstats[k]; ws.ammo = Math.max(1, ws.ammo - 2); ws.reserve = Math.max(1, ws.reserve - 25); }
    p.hp = p.hpMax; p.shield = 80;
    const rp = safePos(T.rand(150, T.world.w/2 - 120), T.rand(150, T.world.h - 150), p.r || 16, 140, T.world);
    p.x = rp.x; p.y = rp.y;
    window.TEAMS_REVIVE = true; T.reviveT = 3;
    return true;
  }

  // ============================ DRAW ============================
  function draw(ctx, cam, t) {
    if (!T) return;

    // golems
    for (const go of T.golems) {
      const x = go.x - cam.x - cam.sx, y = go.y - cam.y - cam.sy;
      const col = go.activated ? teamColor(go.team) : NEUTRAL;
      const bob = Math.sin(go.wobble) * 3;
      ctx.save();
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(x, y + go.r * 0.6, go.r * 0.9, go.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.translate(x, y + bob);
      const grad = ctx.createRadialGradient(0, -go.r * 0.3, 2, 0, 0, go.r);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, col); grad.addColorStop(1, '#2a2a33');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(0, 0, go.r, 0, Math.PI * 2); ctx.fill();
      // rocky facets
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = i * (Math.PI * 2 / 5) + go.wobble * 0.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * go.r, Math.sin(a) * go.r); ctx.stroke(); }
      ctx.restore();
      // activation progress ring (neutral)
      if (!go.activated) {
        const lead = Math.max(go.dmg[0] || 0, go.dmg[1] || 0) / go.threshold;
        ctx.strokeStyle = lead > 0 ? (go.dmg[1] > go.dmg[0] ? teamColor(1) : teamColor(0)) : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y + bob, go.r + 6, -Math.PI / 2, -Math.PI / 2 + lead * Math.PI * 2); ctx.stroke();
      } else {
        // hp ring
        ctx.strokeStyle = '#000a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y + bob, go.r + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + bob, go.r + 5, -Math.PI / 2, -Math.PI / 2 + Math.max(0, go.hp / go.maxhp) * Math.PI * 2); ctx.stroke();
      }
      // detonation telegraph: warn (ring grows + pulses), charge (brightens),
      // then the killCircle effect plays on detonation itself.
      if (go.activated && go._inRange && go.dPhase && go.dPhase !== 'idle') {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const warn = go.dPhase === 'warn';
        const grow = warn ? (1 - Math.max(0, go.dT) / 1.2) : 1;
        const Rr = go.killR * (warn ? (0.5 + 0.5 * grow) : (0.92 - 0.08 * (1 - Math.max(0, go.dT) / 0.5)));
        const pulse = warn ? (0.3 + 0.25 * Math.sin(t * 10)) : (0.6 + 0.3 * Math.sin(t * 18));
        ctx.globalAlpha = 0.35 + pulse;
        ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = warn ? 14 : 24; ctx.lineWidth = warn ? 3 : 5;
        ctx.beginPath(); ctx.arc(x, y + bob, Rr, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = warn ? 0.08 : 0.16; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y + bob, Rr, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // kill circles — a glowing team-coloured pulse that expands and fades
    for (const e of T.ents.effects) {
      if (e.type !== 'killCircle') continue;
      const p = e.t / e.life, x = e.x - cam.x - cam.sx, y = e.y - cam.y - cam.sy;
      const R = e.r * (0.35 + 0.65 * p);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55 * (1 - p);
      const g = ctx.createRadialGradient(x, y, R * 0.25, x, y, R);
      g.addColorStop(0, e.color); g.addColorStop(0.7, e.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.95 * (1 - p); ctx.strokeStyle = e.color; ctx.shadowColor = e.color; ctx.shadowBlur = 26; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // fireballs (arcing across the sky)
    for (const f of T.fireballs) {
      const gx = f.x - cam.x - cam.sx, gy = f.y - cam.y - cam.sy;
      const h = (f.z || 0) * 0.5;                         // lift the sprite by its arc altitude
      ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(gx, gy, f.r * 1.1, f.r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const fx = gx, fy = gy - h;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.r * 2.4);
      g.addColorStop(0, 'rgba(255,220,160,0.95)'); g.addColorStop(0.5, 'rgba(255,130,40,0.6)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, f.r * 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.fill();
    }

    // giants
    for (const g of T.giants) {
      const x = g.x - cam.x - cam.sx, y = g.y - cam.y - cam.sy;
      const col = teamColor(g.team);
      const pulse = 1 + 0.04 * Math.sin(t * 2 + g.team);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(x, y + g.r * 0.7, g.r * 1.1, g.r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.translate(x, y);
      // aura
      ctx.globalCompositeOperation = 'screen';
      const ag = ctx.createRadialGradient(0, 0, g.r * 0.4, 0, 0, g.r * 1.8);
      ag.addColorStop(0, col + '55'); ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, 0, g.r * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // body
      const bg = ctx.createRadialGradient(0, -g.r * 0.3, g.r * 0.2, 0, 0, g.r * pulse);
      bg.addColorStop(0, '#fff'); bg.addColorStop(0.4, col); bg.addColorStop(1, '#1a1020');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, g.r * pulse, 0, Math.PI * 2); ctx.fill();
      // runic ring
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, g.r * 0.7, t * (g.team ? -1 : 1), t * (g.team ? -1 : 1) + Math.PI * 1.4); ctx.stroke();
      ctx.globalAlpha = 1;
      // eye (faces the enemy giant)
      const ex = Math.cos(g.ang || 0) * g.r * 0.28, ey = Math.sin(g.ang || 0) * g.r * 0.28 - g.r * 0.05;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, g.r * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, g.r * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

  }

  // ---- DOM HUD (giant HP bars + revive) so it reads over the 3D canvas ----
  function ensureHud() {
    let box = document.getElementById('teamsHud');
    if (box) return box;
    box = document.createElement('div'); box.id = 'teamsHud';
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:20;pointer-events:none;display:none;';
    box.innerHTML = '<div id="teamsBarL" style="position:absolute;left:24px;top:16px;width:min(420px,32vw);"></div>'
      + '<div id="teamsBarR" style="position:absolute;right:24px;top:16px;width:min(420px,32vw);"></div>'
      + '<div id="teamsRevive" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;display:none;"></div>';
    document.body.appendChild(box);
    return box;
  }
  function barHtml(g, align) {
    const ratio = Math.max(0, g.hp / g.maxhp);
    const col = g.team === 0 ? '#3aa6ff' : '#ff4a4a';
    return '<div style="font:800 12px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:' + col + ';text-shadow:0 0 10px ' + col + ';margin-bottom:4px;' + (align === 'right' ? 'text-align:right;' : '') + '">' + g.name + '</div>'
      + '<div style="height:16px;border-radius:8px;background:rgba(0,0,0,.5);border:1px solid ' + col + ';box-shadow:0 0 16px ' + col + '66;overflow:hidden;"><div style="height:100%;width:' + (ratio * 100) + '%;background:' + col + ';box-shadow:0 0 12px ' + col + ';transition:width .12s linear;"></div></div>'
      + '<div style="font:800 10px system-ui,sans-serif;color:#fff;text-align:center;margin-top:2px;">' + Math.ceil(g.hp) + ' / ' + g.maxhp + '</div>';
  }
  function updateHud() {
    const box = ensureHud();
    if (!T || T.over) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const L = document.getElementById('teamsBarL'); if (L) L.innerHTML = barHtml(T.giants[0], 'left');
    const Rr = document.getElementById('teamsBarR'); if (Rr) Rr.innerHTML = barHtml(T.giants[1], 'right');
    const rv = document.getElementById('teamsRevive');
    if (rv) {
      if (window.TEAMS_REVIVE) { rv.style.display = 'block'; rv.innerHTML = '<div style="font:800 40px system-ui,sans-serif;color:#9fe3ff;text-shadow:0 0 24px #5ad2ff;">Reviving…</div><div style="font:20px system-ui,sans-serif;color:#cfe1ff;margin-top:6px;">' + Math.ceil(T.reviveT) + 's</div>'; }
      else rv.style.display = 'none';
    }
  }
  function hideHud() { const box = document.getElementById('teamsHud'); if (box) box.style.display = 'none'; }

  function snapshot() {
    if (!T) return null;
    return { giants: T.giants, golems: T.golems, fireballs: T.fireballs, effects: T.ents.effects, revive: window.TEAMS_REVIVE ? T.reviveT : 0, over: T.over, winner: T.winner, playerTeam: T.playerTeam };
  }

  function drawGiantHud(ctx) {
    const W = ctx.canvas.width;
    const barW = Math.min(420, W * 0.32);
    const bars = [
      { g: T.giants[0], side: 'left', color: TEAM_COLORS[0] },
      { g: T.giants[1], side: 'right', color: TEAM_COLORS[1] }
    ];
    for (const b of bars) {
      const x0 = b.side === 'left' ? 24 : W - 24 - barW;
      const y0 = 16;
      ctx.save();
      ctx.fillStyle = 'rgba(6,10,20,0.8)'; ctx.fillRect(x0 - 6, y0 - 6, barW + 12, 46);
      ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(x0 - 6, y0 - 6, barW + 12, 46);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = b.side === 'left' ? 'left' : 'right';
      ctx.fillText(b.g.name, b.side === 'left' ? x0 : x0 + barW, y0 + 8);
      // track
      ctx.fillStyle = '#0a0f1c'; ctx.fillRect(x0, y0 + 14, barW, 16);
      const ratio = Math.max(0, b.g.hp / b.g.maxhp);
      ctx.fillStyle = b.color; ctx.fillRect(x0, y0 + 14, barW * ratio, 16);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(b.g.hp) + ' / ' + b.g.maxhp, x0 + barW / 2, y0 + 26);
      ctx.restore();
    }
  }

  function teamColor(team){ return team === (T && T.playerTeam) ? '#3aa6ff' : '#ff4a4a'; }
  function getGolems(){ return T ? T.golems : []; }
  function getGiants(){ return T ? T.giants : []; }
  function getWorld(){ return T ? T.world : null; }
  window.Teams = { init, reset, tick, onPlayerDeath, draw, snapshot, teamColor, getGolems, getGiants, getWorld, get playerTeam(){ return T ? T.playerTeam : 0; } };
  window.TEAMS_REVIVE = false;
})();
