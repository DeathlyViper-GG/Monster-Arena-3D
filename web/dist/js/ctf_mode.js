// ============================================================
// Monster Arena — Capture the Flag (offline practice)
// Two teams (blue vs red). The player is always blue; bots are
// split across both teams. Each team has a base and a flag.
// Grab the enemy flag and bring it to your own base while your
// own flag is at home to score. First team to 5 captures wins.
// Carriers drop the flag on death; a dropped friendly flag can
// be returned by walking over it (or auto-returns after a timer).
// Players + bots revive on death (no game-over until a team hits 5).
//
// Hooks required in pve16.js (kept minimal, mirrors Teams mode):
//   restart()        -> CTF.init({...}) / CTF.reset()
//   updateFixed()    -> CTF.tick(dt)
//   draw() (2D)      -> CTF.draw(ctx, cam, t)   (3D path reads snapshot)
//   player death     -> CTF.onPlayerDeath() bypasses game-over
//   input freeze     -> window.CTF_REVIVE freezes movement/fire
// Hooks in bot_sp.js:
//   target selection -> CTF objective block sets bot target
//   bot filter       -> keep dead bots so revive can run
// ============================================================
(function () {
  'use strict';

  let T = null;
  const TEAM_COLORS = { 0: '#3aa6ff', 1: '#ff4a4a' }; // blue, red
  const SCORE_TARGET = 5;
  const PICKUP_R = 34;       // reach to grab / return a flag
  const CAPTURE_R = 80;      // reach your own base with the enemy flag to score
  const DROP_RETURN_T = 26;  // a dropped flag auto-returns home after this long
  const BOT_REVIVE_T = 3;    // a downed bot respawns at its base after this long
  const PLAYER_REVIVE_T = 3;
  const CARRY_SLOW = 0.82;   // carrying the enemy flag weighs you (and bots) down
  const BOT_REVIVE_MAX = 6; // hard safety: a dead bot always respawns by this long

  function safePos(cx, cy, r, spread, world) {
    for (let i = 0; i < 24; i++) {
      const x = cx + (Math.random() - 0.5) * spread;
      const y = cy + (Math.random() - 0.5) * spread;
      if (!world.isBlocked || !world.isBlocked(x, y, r)) return { x, y };
    }
    return { x: cx, y: cy };
  }

  function init(opts) {
    const world = opts.world;
    const halfW = world.w / 2;
    const b0 = safePos(360, world.h / 2, 80, 480, world);
    const b1 = safePos(world.w - 360, world.h / 2, 80, 480, world);

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
      bases: [
        { team: 0, x: b0.x, y: b0.y, r: CAPTURE_R },
        { team: 1, x: b1.x, y: b1.y, r: CAPTURE_R }
      ],
      flags: [
        { team: 0, x: b0.x, y: b0.y, homeX: b0.x, homeY: b0.y, r: 18, state: 'home', carrier: null, dropT: 0, bob: Math.random() * 6 },
        { team: 1, x: b1.x, y: b1.y, homeX: b1.x, homeY: b1.y, r: 18, state: 'home', carrier: null, dropT: 0, bob: Math.random() * 6 }
      ],
      scores: [0, 0],
      over: false,
      winner: null,
      reviveT: 0,
      playerCarrying: null,
      playerDeaths: 0,
      captureFlash: 0
    };

    // Split bots across BOTH teams (player is blue). Roles: defenders stay
    // near their own base / chase the enemy carrier; attackers push for the
    // enemy flag. Equip a role-appropriate weapon so the two sides fight
    // differently instead of all defaulting to the pistol.
    if (T.botsRef) {
      // Role distribution PER TEAM (29-slot cycle): a few defenders hold the
      // base, rushers charge the enemy flag, flankers approach via the map
      // edges, and the rest are attackers pushing the lane. Far fewer static
      // defenders than the old 50/50 split, so the base isn't crowded with
      // bots doing nothing.
      const rolePlan = ['defender','defender','defender','defender',
                        'rusher','rusher','rusher','rusher','rusher','rusher',
                        'flanker','flanker','flanker','flanker','flanker','flanker',
                        'attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker','attacker'];
      const roleWeapon = { attacker: 'rifle', defender: 'shotgun', rusher: 'shotgun', flanker: 'rifle' };
      const byTeam = { 0: [], 1: [] };
      for (let i = 0; i < T.botsRef.length; i++) {
        const b = T.botsRef[i];
        b.team = (i % 2 === 0) ? 0 : 1;                 // alternate blue / red
        byTeam[b.team].push(b);
      }
      for (const team of [0, 1]) {
        const list = byTeam[team];
        for (let j = 0; j < list.length; j++) {
          const b = list[j];
          b.role = rolePlan[j % rolePlan.length];
          b.preferredKind = roleWeapon[b.role] || 'rifle';
          const wi = T.weapons.findIndex(w => w.kind === b.preferredKind);
          if (wi >= 0) { b.weapon = wi; const w = T.weapons[wi]; b.ammo = w.ammo; b.reserve = w.reserve; }
          const myBase = T.bases[b.team];
          let bp;
          if (b.role === 'defender') {
            bp = safePos(myBase.x, myBase.y, b.r || 16, 160, world);
          } else {
            // spawn spread across this team's own half so bots don't clump
            const minX = team === 0 ? 100 : world.w * 0.5 + 60;
            const maxX = team === 0 ? world.w * 0.5 - 60 : world.w - 100;
            const cx = minX + Math.random() * Math.max(60, maxX - minX);
            const cy = 120 + Math.random() * Math.max(60, world.h - 240);
            bp = safePos(cx, cy, b.r || 16, 120, world);
          }
          b.x = bp.x; b.y = bp.y;
          b.hp = b.hpMax;
          b._ctfCarrying = false;
          b._ctfReviving = false;
          b._ctfReviveT = 0;
          b._ctfDeadT = 0;
          b._deathHandled = false;       // allow death chest to spawn on first death
          // flanker: pick a side (top/bottom edge) to approach the enemy base from
          b._flankSide = (Math.random() < 0.5 ? -1 : 1);
          b._flankWP = null;
        }
      }
    }

    // Strip guardians + themed landmark buildings so the arena is clean
    // (just geometry + the two bases and flags), same as Teams mode.
    if (T.ents && T.ents.guardians) T.ents.guardians.length = 0;
    if (world.buildings) {
      for (const b of world.buildings) { b._type = null; b.typeId = null; b._guardianSpawned = true; }
    }
    if (world.chests) {
      for (const ch of world.chests) { ch.typeId = null; ch.typeLabel = null; ch.glow = null; }
    }
  }

  function reset() { T = null; window.CTF_REVIVE = false; hideHud(); }

  // ---------------------------------------------------------------- capture
  function capture(team) {
    T.scores[team] = (T.scores[team] || 0) + 1;
    T.captureFlash = 1;
    // both flags reset to their home bases
    for (const f of T.flags) {
      f.state = 'home'; f.carrier = null; f.x = f.homeX; f.y = f.homeY; f.dropT = 0;
    }
    T.playerCarrying = null;
    for (const b of (T.botsRef || [])) b._ctfCarrying = false;
    const col = TEAM_COLORS[team];
    const base = T.bases[team];
    if (T.addEffect) T.addEffect(base.x, base.y, 'pop', 0.6, col);
    T.ents.effects.push({ type: 'pop', x: base.x, y: base.y, life: 0.7, t: 0, color: col });
    if (T.cam) T.cam.shake = Math.max(T.cam.shake || 0, 8);

    if (T.scores[team] >= SCORE_TARGET) endMatch(team);
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
      if (window.showDeathOverlay) window.showDeathOverlay('The enemy captured five flags');
      else { const ov = document.getElementById('overlayPause'); if (ov) { ov.style.display = 'grid'; const h = ov.querySelector('h2'); if (h) h.textContent = '☠️ Defeat'; } }
    }
  }

  // ------------------------------------------------------------------ tick
  function tick(dt) {
    if (!T || T.over) return;
    const { player, world, ents, botsRef } = T;

    // revive countdown: keep player safe + frozen while it runs
    if (window.CTF_REVIVE) {
      T.reviveT -= dt;
      player.hp = player.hpMax;
      if (T.reviveT <= 0) {
        window.CTF_REVIVE = false; player.shield = 60;
        // respawn: stop spectating, return the camera to the player
        const st = window.__dbg && window.__dbg.state;
        if (st) { st.spectating = false; st.specTarget = null; }
        if (window.hideSpectate) window.hideSpectate();
      }
    }

    const pickR2 = PICKUP_R * PICKUP_R;

    // ---- PLAYER flag interaction ----
    if (player.hp > 0 && !window.CTF_REVIVE) {
      const enemyFlag = T.flags[1];   // player is blue → enemy is red
      const myFlag = T.flags[0];

      // carrying the enemy flag: it follows the player
      if (T.playerCarrying) {
        T.playerCarrying.x = player.x; T.playerCarrying.y = player.y;
        // score by reaching own base while own flag is home
        const myBase = T.bases[0];
        if (T.dist2(player.x, player.y, myBase.x, myBase.y) < myBase.r * myBase.r && myFlag.state === 'home') {
          capture(0);
        }
      } else {
        // pick up the enemy flag (home or dropped)
        if ((enemyFlag.state === 'home' || enemyFlag.state === 'dropped') &&
            T.dist2(player.x, player.y, enemyFlag.x, enemyFlag.y) < pickR2) {
          enemyFlag.state = 'carried'; enemyFlag.carrier = 'player'; T.playerCarrying = enemyFlag; enemyFlag.dropT = 0;
          if (T.audio && T.audio.pickup) T.audio.pickup();
        }
      }
      // return own dropped flag by walking over it
      if (myFlag.state === 'dropped' && T.dist2(player.x, player.y, myFlag.x, myFlag.y) < pickR2) {
        myFlag.state = 'home'; myFlag.x = myFlag.homeX; myFlag.y = myFlag.homeY; myFlag.dropT = 0;
        if (T.addEffect) T.addEffect(myFlag.homeX, myFlag.homeY, 'pop', 0.4, TEAM_COLORS[0]);
      }
    }

    // ---- BOT flag interaction ----
    if (botsRef) {
      for (const b of botsRef) {
        if (b.hp <= 0) {
          // a carrier died → drop the flag where it fell
          if (b._ctfCarrying) {
            const f = T.flags[1 - b.team];
            f.state = 'dropped'; f.carrier = null; f.x = b.x; f.y = b.y; f.dropT = DROP_RETURN_T;
            b._ctfCarrying = false;
          }
          // ---- RESPAWN: one dead-timer, guaranteed to fire ----
          // Single accumulating counter (no nested reviving state that can get
          // stuck). After BOT_REVIVE_T seconds the bot always comes back at
          // its OWN base, in its own half, ready to fight again.
          b._ctfDeadT = (b._ctfDeadT || 0) + dt;
          if (b._ctfDeadT >= BOT_REVIVE_T) {
            const base = T.bases[b.team];
            const bp = safePos(base.x, base.y, b.r || 16, 240, world);
            b.hp = b.hpMax || 100; b.x = bp.x; b.y = bp.y;
            const w = T.weapons[b.weapon] || T.weapons[0];
            if (w) { b.ammo = w.ammo; b.reserve = w.reserve; }
            b._ctfDeadT = 0; b._deathHandled = false;
            b.reloading = false; b.reloadT = 0;
            b.target = null; b.targetKind = null; b.seekingChest = false; b.chestTarget = null;
            // clear every stale status so the bot doesn't spawn back frozen
            b._stunT = 0; b.stunT = 0; b.slowT = 0; b.slowMul = 1;
            b.dashCD = 0; b.dashI = 0; b.inSand = false; b.inSandT = 0;
            b._burnTarget = null; b._burnUntil = 0; b._burnAcc = 0; b._burnTickAt = 0; b._burnFxAt = 0;
            b._exitBuilding = null; b._exitDoor = null; b._path = null; b._pi = 0; b._pg = null; b._pt = 0; b._sk = 0; b._stuckN = 0;
            b._leadT = 0; b.wanderT = 0; b.state = 'idle'; b.decisionCD = 0; b.lastShot = 0;
            b.ang = Math.random() * Math.PI * 2;
            // bright revive ring so you can SEE the bot pop back in at base
            T.ents.effects.push({ type: 'pop', x: bp.x, y: bp.y, life: 0.6, t: 0, color: TEAM_COLORS[b.team] });
            if (T.addEffect) T.addEffect(bp.x, bp.y, 'pop', 0.5, TEAM_COLORS[b.team]);
          }
          continue;
        }

        const enemyFlag = T.flags[1 - b.team];
        const myFlag = T.flags[b.team];
        const myBase = T.bases[b.team];

        // carrying the enemy flag: it follows the bot
        if (b._ctfCarrying) {
          enemyFlag.x = b.x; enemyFlag.y = b.y;
          // score by reaching own base while own flag is home
          if (T.dist2(b.x, b.y, myBase.x, myBase.y) < myBase.r * myBase.r && myFlag.state === 'home') {
            capture(b.team);
          }
        } else {
          // pick up the enemy flag (home or dropped)
          if ((enemyFlag.state === 'home' || enemyFlag.state === 'dropped') &&
              T.dist2(b.x, b.y, enemyFlag.x, enemyFlag.y) < pickR2) {
            enemyFlag.state = 'carried'; enemyFlag.carrier = b; b._ctfCarrying = true; enemyFlag.dropT = 0;
          }
        }
        // return own dropped flag by walking over it
        if (myFlag.state === 'dropped' && T.dist2(b.x, b.y, myFlag.x, myFlag.y) < pickR2) {
          myFlag.state = 'home'; myFlag.x = myFlag.homeX; myFlag.y = myFlag.homeY; myFlag.dropT = 0;
          if (T.addEffect) T.addEffect(myFlag.homeX, myFlag.homeY, 'pop', 0.4, TEAM_COLORS[b.team]);
        }
      }
    }

    // ---- dropped flag auto-return ----
    for (const f of T.flags) {
      if (f.state === 'dropped') {
        f.dropT -= dt;
        if (f.dropT <= 0) {
          f.state = 'home'; f.x = f.homeX; f.y = f.homeY;
          if (T.addEffect) T.addEffect(f.homeX, f.homeY, 'pop', 0.4, TEAM_COLORS[f.team]);
        }
      }
    }

    T.captureFlash = Math.max(0, T.captureFlash - dt * 2);
    updateHud();
  }

  function onPlayerDeath() {
    if (!T) return false;
    const p = T.player;
    T.playerDeaths = (T.playerDeaths || 0) + 1;
    // drop the carried enemy flag where the player fell
    if (T.playerCarrying) {
      const f = T.playerCarrying;
      f.state = 'dropped'; f.carrier = null; f.x = p.x; f.y = p.y; f.dropT = DROP_RETURN_T;
      T.playerCarrying = null;
    }
    p.hp = p.hpMax; p.shield = 80;
    const base = T.bases[0];
    const rp = safePos(base.x, base.y, p.r || 16, 160, T.world);
    p.x = rp.x; p.y = rp.y;
    window.CTF_REVIVE = true; T.reviveT = PLAYER_REVIVE_T;
    // Spectate the action while waiting to respawn (same approach as offline
    // PvP): the camera follows the killer, or any alive bot, so you watch
    // the fight instead of staring at your empty base pad for 3 seconds.
    const st = window.__dbg && window.__dbg.state;
    if (st) {
      const killer = st.lastDamager;
      let tgt = (killer && killer.hp > 0) ? killer : null;
      if (!tgt && T.botsRef) tgt = T.botsRef.find(b => b && b.hp > 0);
      if (tgt) { st.spectating = true; st.specTarget = tgt; if (window.showSpectate) window.showSpectate(tgt.name || 'Killer'); }
    }
    return true;
  }

  // ============================ DRAW (2D) ============================
  function draw(ctx, cam, t) {
    if (!T) return;
    const col = (team) => team === T.playerTeam ? '#3aa6ff' : '#ff4a4a';

    // bases
    for (const base of T.bases) {
      const x = base.x - cam.x - cam.sx, y = base.y - cam.y - cam.sy;
      const c = col(base.team);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(x, y, base.r * 0.3, x, y, base.r);
      g.addColorStop(0, c + '33'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, base.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // ring
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = 0.6 + 0.2 * Math.sin(t * 2 + base.team);
      ctx.beginPath(); ctx.arc(x, y, base.r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      // base pad
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, base.r * 0.5, base.r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
      // team letter
      ctx.fillStyle = c; ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillText(base.team === 0 ? 'B' : 'R', x, y); ctx.shadowBlur = 0;
    }

    // flags
    for (const f of T.flags) {
      const x = f.x - cam.x - cam.sx, y = f.y - cam.y - cam.sy;
      const c = col(f.team);
      const bob = Math.sin(t * 3 + f.bob) * 4;
      // shadow on the ground (only when not carried)
      if (f.state !== 'carried') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(x, y, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      // pole
      const poleTop = y - 42 + bob;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, poleTop + 4); ctx.stroke();
      // glowing pennant
      ctx.save();
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 18;
      const sway = Math.sin(t * 2 + f.bob) * 3;
      ctx.beginPath();
      ctx.moveTo(x, poleTop);
      ctx.lineTo(x + 22 + sway, poleTop + 7);
      ctx.lineTo(x, poleTop + 15);
      ctx.lineTo(x - 3, poleTop + 7);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();

      // state cues
      if (f.state === 'carried') {
        // a bright ring around the carrier is drawn by the carrier marker below
      } else if (f.state === 'dropped') {
        // pulsing dashed ring so a dropped flag is easy to find
        ctx.save();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
        ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
        // auto-return timer ring
        const ret = T.clamp(1 - f.dropT / DROP_RETURN_T, 0, 1);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + ret * Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // carrier marker: a bright team-coloured ring + flag icon over the carrier's head
    const markCarrier = (cx, cy, team) => {
      const x = cx - cam.x - cam.sx, y = cy - cam.y - cam.sy;
      const c = col(team);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(x, y, 8, x, y, 40);
      g.addColorStop(0, c + '88'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6);
      ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      // little flag glyph above
      const top = y - 52 + Math.sin(t * 4) * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x, top); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + 14, top + 5); ctx.lineTo(x, top + 10); ctx.closePath(); ctx.fill();
    };
    if (T.playerCarrying && T.player.hp > 0) markCarrier(T.player.x, T.player.y, 0);
    if (T.botsRef) for (const b of T.botsRef) if (b.hp > 0 && b._ctfCarrying) markCarrier(b.x, b.y, b.team);
  }

  // ---- DOM HUD (score banner + revive) so it reads over the 3D canvas ----
  function ensureHud() {
    let box = document.getElementById('ctfHud');
    if (box) return box;
    box = document.createElement('div'); box.id = 'ctfHud';
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:20;pointer-events:none;display:none;';
    box.innerHTML = '<div id="ctfScore" style="position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:8px 20px;border-radius:14px;background:rgba(8,12,22,.78);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 28px rgba(0,0,0,.5);"></div>'
      + '<div id="ctfRevive" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;display:none;"></div>';
    document.body.appendChild(box);
    return box;
  }
  function updateHud() {
    const box = ensureHud();
    if (!T || T.over) { box.style.display = 'none'; return; }
    box.style.display = 'block';
    const sEl = document.getElementById('ctfScore');
    if (sEl) {
      const blue = T.scores[0], red = T.scores[1];
      const flash = T.captureFlash > 0 ? `box-shadow:0 0 24px ${TEAM_COLORS[T.winner == null ? 0 : T.winner]}aa;` : '';
      sEl.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:8px 20px;border-radius:14px;background:rgba(8,12,22,.78);border:1px solid rgba(255,255,255,.18);box-shadow:0 8px 28px rgba(0,0,0,.5);' + flash;
      sEl.innerHTML =
        '<span style="font:800 16px system-ui,sans-serif;letter-spacing:.1em;color:#3aa6ff;text-shadow:0 0 10px #3aa6ff">BLUE ' + blue + '</span>' +
        '<span style="font:800 14px system-ui,sans-serif;color:#9fb0c8">—</span>' +
        '<span style="font:800 16px system-ui,sans-serif;letter-spacing:.1em;color:#ff4a4a;text-shadow:0 0 10px #ff4a4a">' + red + ' RED</span>' +
        '<span style="font:700 11px system-ui,sans-serif;color:#7dffa3;letter-spacing:.14em;text-transform:uppercase;border-left:1px solid rgba(255,255,255,.2);padding-left:12px">First to ' + SCORE_TARGET + '</span>';
    }
    const rv = document.getElementById('ctfRevive');
    if (rv) {
      if (window.CTF_REVIVE) { rv.style.display = 'block'; rv.innerHTML = '<div style="font:800 40px system-ui,sans-serif;color:#9fe3ff;text-shadow:0 0 24px #5ad2ff;">Reviving…</div><div style="font:20px system-ui,sans-serif;color:#cfe1ff;margin-top:6px;">' + Math.ceil(T.reviveT) + 's</div>'; }
      else rv.style.display = 'none';
    }
  }
  function hideHud() { const box = document.getElementById('ctfHud'); if (box) box.style.display = 'none'; }

  function snapshot() {
    if (!T) return null;
    return { bases: T.bases, flags: T.flags, scores: T.scores, over: T.over, winner: T.winner, playerTeam: T.playerTeam, revive: window.CTF_REVIVE ? T.reviveT : 0, playerCarrying: !!T.playerCarrying };
  }

  function teamColor(team) { return team === (T && T.playerTeam) ? '#3aa6ff' : '#ff4a4a'; }
  function getBases() { return T ? T.bases : []; }
  function getFlags() { return T ? T.flags : []; }
  function getScores() { return T ? T.scores : [0, 0]; }
  // Let the spectate panel's "Respawn" button skip the remaining revive
  // countdown (instant respawn) instead of restarting the whole match.
  function skipRevive(){ if (T) T.reviveT = 0; }

  window.CTF = {
    init, reset, tick, onPlayerDeath, draw, snapshot,
    teamColor, getBases, getFlags, getScores, skipRevive,
    get playerTeam() { return T ? T.playerTeam : 0; },
    get playerCarrying() { return !!(T && T.playerCarrying); }
  };
  window.CTF_REVIVE = false;
})();
