// ===============================
// SERVER BOT SYSTEM (AUTHORITATIVE PVE)
// ===============================

export function initBots(lobby) {
  if (!lobby.bots) lobby.bots = [];

  if (lobby.bots.length === 0) {
    for (let i = 0; i < 3; i++) {
      lobby.bots.push({
        id: "bot_" + i,
        name: "Bot_" + (100 + i),

        x: lobby.world ? lobby.world.w / 2 : 2000,
        y: lobby.world ? lobby.world.h / 2 : 1400,

        ang: 0,
        hp: 100,
        r: 16,

        shootCD: 0,
        wander: null,
        target: null
      });
    }
  }
}

export function updateBots(lobby, dt, TICK_MS, moveEnemyWithCollide) {
  if (!lobby.bots) return;

  for (const bot of lobby.bots) {

    // FIND NEAREST ENEMY
    let target = null;
    let best = Infinity;

    for (const e of lobby.enemies) {
      const dx = e.x - bot.x;
      const dy = e.y - bot.y;
      const d = dx*dx + dy*dy;

      if (d < best) {
        best = d;
        target = e;
      }
    }

    bot.target = target;

    // =====================
    // COMBAT
    // =====================
    if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const ang = Math.atan2(dy, dx);

      bot.ang = ang;

      const speed = 160;

      moveEnemyWithCollide(
        lobby,
        bot,
        Math.cos(ang) * speed * dt,
        Math.sin(ang) * speed * dt
      );

      bot.shootCD -= dt;

      if (bot.shootCD <= 0) {
        bot.shootCD = 0.6;

        lobby.bullets.push({
          owner: "BOT",
          x: bot.x,
          y: bot.y,
          vx: Math.cos(ang) * 600,
          vy: Math.sin(ang) * 600,
          r: 4,
          dmg: 10,
          life: 1.2
        });
      }
    }

    // =====================
    // WANDER
    // =====================
    else {
      if (!bot.wander || Math.random() < 0.02) {
        bot.wander = {
          x: bot.x + Math.random()*400 - 200,
          y: bot.y + Math.random()*400 - 200
        };
      }

      const dx = bot.wander.x - bot.x;
      const dy = bot.wander.y - bot.y;
      const dist = Math.hypot(dx, dy) || 1;

      moveEnemyWithCollide(
        lobby,
        bot,
        (dx/dist) * 120 * dt,
        (dy/dist) * 120 * dt
      );
    }
  }
}

export function bakeBotsSnapshot(lobby) {
  return (lobby.bots || []).map(b => ({
    id: b.id,
    name: b.name,
    x: b.x,
    y: b.y,
    ang: b.ang,
    hp: b.hp
  }));
}

// =============================================================================
// ENEMY HAZARD EFFECTS (SERVER-SIDE)
// quicksand pull, ice drift, lava phases, void teleport/kill.
// The collision / movement / world helpers are injected once at startup with
// attachHazards() (called from signaling_http.js).
// =============================================================================
let HZ = {
  WORLD: { w: 4000, h: 2800 },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  now: () => Date.now(),
  circleRectCollide: () => false,
  moveEnemyWithCollide: () => {}
};

export function attachHazards(deps) {
  HZ = Object.assign(HZ, deps || {});
}

export function hazardAt(lobby, x, y, r){
  const hz = lobby.world?.hazards || [];
  for (const h of hz){
    if (HZ.circleRectCollide(x, y, r, h)) return h;
  }
  return null;
}

// Quicksand-like pull (server version)
function applySandToEnemy(lobby, e, hz, dt){
  const cx = hz.x + hz.w / 2;
  const cy = hz.y + hz.h / 2;
  const dx = cx - e.x;
  const dy = cy - e.y;
  const dist = Math.hypot(dx, dy) + 1e-6;

  const rx = dx / dist, ry = dy / dist; // toward center
  const tx = -ry, ty = rx;              // tangential

  const maxR = Math.hypot(hz.w, hz.h) * 0.6;
  const closeness = Math.max(0, Math.min(1, 1 - dist / maxR));

  const swirl = 120 + 240 * closeness;
  const pull  =  30 + 180 * closeness;

  const vx = tx * swirl + rx * pull;
  const vy = ty * swirl + ry * pull;

  HZ.moveEnemyWithCollide(lobby, e, vx * dt, vy * dt);
}

// Ice drift (server version)
function applyIceToEnemy(lobby, e, hz, dt){
  const t = HZ.now() / 1000;
  const seed = (hz.x * 0.013 + hz.y * 0.017);
  const dir = (seed * Math.PI * 2) + Math.sin(t * 0.6 + seed) * 0.9;
  const breath = 0.85 + 0.15 * Math.sin(t * 1.1 + seed * 2.3);
  const slideSpeed = 180 * breath;

  HZ.moveEnemyWithCollide(lobby, e, Math.cos(dir) * slideSpeed * dt, Math.sin(dir) * slideSpeed * dt);
}

// Void: 50/50 teleport or kill (server authoritative)
function applyVoidToEnemy(lobby, e, hz){
  e.voidCD = Math.max(0, (e.voidCD || 0));
  if (e.voidCD > 0) return { killed:false };

  const teleport = (Math.random() < 0.5);
  if (teleport){
    const holes = (lobby.world?.hazards || []).filter(h => h.type === 'void' && h !== hz);
    if (holes.length){
      const tgt = holes[(Math.random() * holes.length) | 0];
      const cx = tgt.x + tgt.w / 2, cy = tgt.y + tgt.h / 2;
      const a = Math.random() * Math.PI * 2;
      const r = Math.min(tgt.w, tgt.h) * 0.22;
      e.x = HZ.clamp(cx + Math.cos(a) * r, e.r, HZ.WORLD.w - e.r);
      e.y = HZ.clamp(cy + Math.sin(a) * r, e.r, HZ.WORLD.h - e.r);
      e.voidCD = 0.6;
      return { killed:false };
    }
  }

  // kill if teleport not possible or 50% kill roll
  e.hp = 0;
  return { killed:true };
}

// Apply hazard effects to an enemy; return true if enemy should be removed
export function applyEnemyHazards(lobby, e, dt){
  e.voidCD = Math.max(0, (e.voidCD || 0) - dt);

  const hz = hazardAt(lobby, e.x, e.y, (e.r || 16) * 0.9);
  if (!hz) return false;

  if (hz.type === 'sand'){
    applySandToEnemy(lobby, e, hz, dt);
    return false;
  }

  if (hz.type === 'ice'){
    applyIceToEnemy(lobby, e, hz, dt);
    return false;
  }

  if (hz.type === 'lava') {

    const phase = hz.phase;

    // 🔔 Warning: no damage
    if (phase === 'warn') {
      return false;
    }

    // 🌋 Eruption: instant kill
    if (phase === 'eruption') {
      e.hp = 0;
      return true;
    }

    // 🔥 Burning ground: chip damage only
    if (phase === 'burn') {
      e.hp -= 20 * dt;
      return false;
    }

    // 🧱 Cool phase: harmless
    return false;
  }

  if (hz.type === 'void'){
    return applyVoidToEnemy(lobby, e, hz).killed;
  }

  // unknown hazard -> lethal
  e.hp = 0;
  return true;
}

// =============================================================================
// TEAMS / CAPTURE THE FLAG (SERVER AUTHORITATIVE)
// Titans, golems, flags and bot rosters for the online team modes.
// A lobby rarely fills every slot with humans, so each side is backfilled with
// bots up to TEAM_SIZE — the same rule the offline modes use.
// =============================================================================
export const TEAM_SIZE = 10;              // humans + bots per side
export const CTF_SCORE_TARGET = 5;

const GIANT_HP = 9000;
const GOLEM_COUNT = 8;
const GOLEM_ACTIVATE = 320;              // bullet damage needed to wake a golem
const GOLEM_DETONATE = 900;              // damage a golem does to an enemy titan
const BOT_SPEED = 165;
const BOT_SHOOT_CD = 0.75;
const BOT_DMG = 9;
const RESPAWN_MS = 4000;
const PICKUP_R = 34;
const CAPTURE_R = 80;
const DROP_RETURN_MS = 26000;

const tnow = () => Date.now();
const tdist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const playersArr = (lobby) => [...lobby.players.values()];

function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return tdist2(x0, y0, cx, cy) <= r * r;
  let t = ((cx - x0) * dx + (cy - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return tdist2(x0 + dx * t, y0 + dy * t, cx, cy) <= r * r;
}

export const isTeamMode = (mode) => mode === 'teams' || mode === 'ctf';

// Pick a side for a joining player. A stated preference wins while that side
// still has room (so friends can play together), otherwise the emptier side
// keeps the lobby balanced.
export function pickTeam(lobby, pref) {
  const list = playersArr(lobby);
  const count = (t) => list.filter((p) => p.team === t).length;
  const c0 = count(0), c1 = count(1);
  if ((pref === 0 || pref === 1) && count(pref) < TEAM_SIZE) return pref;
  return c0 <= c1 ? 0 : 1;
}

function worldSize(lobby) {
  return (lobby.world && lobby.world.w) ? lobby.world : { w: 4000, h: 2800 };
}

function spawnAnchor(lobby, team) {
  const w = worldSize(lobby);
  if (lobby.mode === 'ctf' && lobby.ctf) return { x: lobby.ctf.bases[team].x, y: lobby.ctf.bases[team].y };
  if (lobby.giants) return { x: lobby.giants[team].x, y: lobby.giants[team].y };
  return { x: team === 0 ? 380 : w.w - 380, y: w.h / 2 };
}

// Keep spawns out of buildings so bots/golems never appear inside walls.
function freeSpot(lobby, cx, cy, spread, r) {
  const buildings = (lobby.world && lobby.world.buildings) || [];
  const blocked = (x, y) => buildings.some((b) => b.inner &&
    x > b.inner.x - r && x < b.inner.x + b.inner.w + r &&
    y > b.inner.y - r && y < b.inner.y + b.inner.h + r);
  for (let i = 0; i < 24; i++) {
    const x = cx + (Math.random() - 0.5) * spread;
    const y = cy + (Math.random() - 0.5) * spread;
    if (!blocked(x, y)) return { x, y };
  }
  return { x: cx, y: cy };
}

function makeBot(lobby, team, index) {
  const anchor = spawnAnchor(lobby, team);
  const spot = freeSpot(lobby, anchor.x, anchor.y, 620, 20);
  const roles = lobby.mode === 'ctf' ? ['runner', 'guard', 'raider'] : ['attacker', 'defender', 'golemancer'];
  return {
    id: `bot_${team}_${index}`,
    name: `${team === 0 ? 'Blue' : 'Red'} Bot ${index + 1}`,
    team, role: roles[index % roles.length],
    x: spot.x, y: spot.y, ang: 0,
    hp: 100, hpMax: 100, r: 16,
    shootCD: Math.random() * BOT_SHOOT_CD,
    respawnAt: 0, carrying: false
  };
}

// Backfill both sides so the arena always fields TEAM_SIZE per team.
export function fillTeamsWithBots(lobby) {
  if (!isTeamMode(lobby.mode)) return;
  lobby.bots = (lobby.bots || []).filter((b) => b.team === 0 || b.team === 1);
  const list = playersArr(lobby);
  for (const team of [0, 1]) {
    const humans = list.filter((p) => p.team === team).length;
    const have = lobby.bots.filter((b) => b.team === team).length;
    const need = Math.max(0, TEAM_SIZE - humans - have);
    for (let i = 0; i < need; i++) lobby.bots.push(makeBot(lobby, team, have + i));
  }
}

// Create the mode's objectives. Called once when the lobby starts.
export function initTeamMatch(lobby) {
  const w = worldSize(lobby);
  const cy = w.h / 2;
  lobby.winner = null;
  lobby.giants = [
    { team: 0, x: 380, y: cy, r: 92, hp: GIANT_HP, maxhp: GIANT_HP, name: 'BLUE TITAN' },
    { team: 1, x: w.w - 380, y: cy, r: 92, hp: GIANT_HP, maxhp: GIANT_HP, name: 'RED TITAN' }
  ];
  lobby.golems = [];
  for (let i = 0; i < GOLEM_COUNT; i++) {
    const spot = freeSpot(lobby, 700 + Math.random() * Math.max(200, w.w - 1400), cy, 760, 30);
    lobby.golems.push({
      id: 'G' + i, x: spot.x, y: spot.y, r: 26, wobble: Math.random() * 6.28,
      activated: false, team: 0, dmg: [0, 0], threshold: GOLEM_ACTIVATE, dead: false
    });
  }
  lobby.ctf = lobby.mode === 'ctf' ? {
    bases: [{ team: 0, x: 420, y: cy, r: 80 }, { team: 1, x: w.w - 420, y: cy, r: 80 }],
    flags: [
      { team: 0, x: 420, y: cy, state: 'home', carrier: null, droppedAt: 0, bob: 0 },
      { team: 1, x: w.w - 420, y: cy, state: 'home', carrier: null, droppedAt: 0, bob: 3 }
    ],
    scores: [0, 0]
  } : null;
  lobby.enemies = [];
  fillTeamsWithBots(lobby);
}

// ---------------------------------------------------------------- units
function unitById(lobby, id) {
  return lobby.players.get(id) || (lobby.bots || []).find((b) => b.id === id) || null;
}

function nearestEnemy(lobby, unit) {
  const myTeam = unit.team;
  let best = null, bestD2 = Infinity;
  const consider = (o) => {
    if (!o || o.team === myTeam || (o.hp ?? 0) <= 0) return;
    const d = tdist2(unit.x, unit.y, o.x, o.y);
    if (d < bestD2) { bestD2 = d; best = o; }
  };
  for (const p of playersArr(lobby)) consider(p);
  for (const b of lobby.bots) if (b !== unit) consider(b);
  return best ? { unit: best, d2: bestD2 } : null;
}

function shootAt(lobby, bot, ang) {
  const SPEED = 720;
  lobby.bullets.push({
    owner: 'T:' + bot.id, team: bot.team,
    x: bot.x, y: bot.y, _x0: bot.x, _y0: bot.y,
    vx: Math.cos(ang) * SPEED, vy: Math.sin(ang) * SPEED,
    r: 4, dmg: BOT_DMG, life: 1.2
  });
}

function botThink(lobby, bot, dt, move) {
  const enemyTeam = 1 - bot.team;
  const threat = nearestEnemy(lobby, bot);

  // Chase and shoot the closest enemy when it is in range, otherwise push the
  // mode's objective (enemy titan, or the enemy flag / own base).
  if (threat && threat.d2 < 620 * 620) {
    const ang = Math.atan2(threat.unit.y - bot.y, threat.unit.x - bot.x);
    bot.ang = ang;
    bot.shootCD -= dt;
    if (bot.shootCD <= 0) { bot.shootCD = BOT_SHOOT_CD; shootAt(lobby, bot, ang); }
    move(lobby, bot, Math.cos(ang) * BOT_SPEED * dt, Math.sin(ang) * BOT_SPEED * dt);
    return;
  }

  let goal = null;
  if (lobby.mode === 'ctf' && lobby.ctf) {
    const ownFlag = lobby.ctf.flags[bot.team];
    const enemyFlag = lobby.ctf.flags[enemyTeam];
    if (bot.carrying) goal = spawnAnchor(lobby, bot.team);
    else if (enemyFlag.state === 'carried') {
      const carrier = unitById(lobby, enemyFlag.carrier);
      goal = carrier ? { x: carrier.x, y: carrier.y } : { x: ownFlag.x, y: ownFlag.y };
    } else if (ownFlag.state === 'dropped' && bot.role === 'guard') goal = { x: ownFlag.x, y: ownFlag.y };
    else goal = { x: enemyFlag.x, y: enemyFlag.y };
  } else if (lobby.giants) {
    const giant = lobby.giants[enemyTeam];
    goal = { x: giant.x, y: giant.y };
  }
  if (!goal) return;

  const dx = goal.x - bot.x, dy = goal.y - bot.y;
  const d = Math.hypot(dx, dy) || 1;
  bot.ang = Math.atan2(dy, dx);
  // bots shell the enemy titan once they are in range of it
  const enemyGiant = (lobby.mode === 'teams' && lobby.giants) ? lobby.giants[enemyTeam] : null;
  if (enemyGiant && tdist2(bot.x, bot.y, enemyGiant.x, enemyGiant.y) < 640 * 640) {
    bot.shootCD -= dt;
    if (bot.shootCD <= 0) { bot.shootCD = BOT_SHOOT_CD; shootAt(lobby, bot, Math.atan2(enemyGiant.y - bot.y, enemyGiant.x - bot.x)); }
  }
  move(lobby, bot, (dx / d) * BOT_SPEED * dt, (dy / d) * BOT_SPEED * dt);
}

// ---------------------------------------------------------------- flags
function dropFlag(lobby, unit) {
  if (!unit || !unit.carrying || !lobby.ctf) return;
  unit.carrying = false;
  const flag = lobby.ctf.flags[1 - unit.team];
  flag.state = 'dropped';
  flag.carrier = null;
  flag.droppedAt = tnow();
  flag.x = unit.x;
  flag.y = unit.y;
}

function ctfTick(lobby) {
  const ctf = lobby.ctf;
  if (!ctf) return;
  const t = tnow();

  for (const flag of ctf.flags) {
    if (flag.state === 'carried') {
      const carrier = unitById(lobby, flag.carrier);
      if (carrier) { flag.x = carrier.x; flag.y = carrier.y; }
    }
    if (flag.state === 'dropped' && t - (flag.droppedAt || 0) > DROP_RETURN_MS) {
      flag.state = 'home';
      flag.carrier = null;
      flag.x = ctf.bases[flag.team].x;
      flag.y = ctf.bases[flag.team].y;
    }
  }

  const units = [...playersArr(lobby), ...lobby.bots].filter((u) => (u.hp ?? 0) > 0);
  for (const unit of units) {
    const myTeam = unit.team;
    if (myTeam !== 0 && myTeam !== 1) continue;
    const ownFlag = ctf.flags[myTeam];
    const enemyFlag = ctf.flags[1 - myTeam];
    const base = ctf.bases[myTeam];

    if (unit.carrying) {
      if (tdist2(unit.x, unit.y, base.x, base.y) <= CAPTURE_R * CAPTURE_R && ownFlag.state === 'home') {
        ctf.scores[myTeam] += 1;
        unit.carrying = false;
        for (const f of ctf.flags) {
          f.state = 'home'; f.carrier = null;
          f.x = ctf.bases[f.team].x; f.y = ctf.bases[f.team].y;
        }
        return;
      }
      continue;
    }

    // grab the enemy flag when standing on it
    if ((enemyFlag.state === 'home' || enemyFlag.state === 'dropped') &&
        tdist2(unit.x, unit.y, enemyFlag.x, enemyFlag.y) <= PICKUP_R * PICKUP_R) {
      enemyFlag.state = 'carried';
      enemyFlag.carrier = unit.id;
      unit.carrying = true;
      continue;
    }
    // touching your own dropped flag sends it home
    if (ownFlag.state === 'dropped' && tdist2(unit.x, unit.y, ownFlag.x, ownFlag.y) <= PICKUP_R * PICKUP_R) {
      ownFlag.state = 'home';
      ownFlag.carrier = null;
      ownFlag.x = base.x; ownFlag.y = base.y;
    }
  }
}

function teamsTick(lobby, dt, move) {
  for (const golem of lobby.golems) {
    if (!golem.activated || golem.dead) continue;
    const giant = lobby.giants[1 - golem.team];
    const d = Math.hypot(giant.x - golem.x, giant.y - golem.y) || 1;
    if (d <= golem.r + giant.r) {
      giant.hp -= GOLEM_DETONATE;
      golem.dead = true;
      continue;
    }
    move(lobby, golem, ((giant.x - golem.x) / d) * 120 * dt, ((giant.y - golem.y) / d) * 120 * dt);
    golem.wobble += dt;
  }
  lobby.golems = lobby.golems.filter((g) => !g.dead);
}

// ---------------------------------------------------------------- bullets
// Resolves player/bot bullets against the enemy titan, golems and the other
// team. Runs after the generic bullet pass so wall hits are already stripped.
export function resolveTeamBullets(lobby) {
  if (!lobby.bullets || !lobby.bullets.length) return;
  for (let i = lobby.bullets.length - 1; i >= 0; i--) {
    const b = lobby.bullets[i];
    const team = (b.team === 0 || b.team === 1) ? b.team : null;
    if (team == null) continue;
    const x0 = b._x0 ?? b.x, y0 = b._y0 ?? b.y;
    let consumed = false;

    for (const giant of lobby.giants || []) {
      if (giant.team === team || giant.hp <= 0) continue;
      if (segmentHitsCircle(x0, y0, b.x, b.y, giant.x, giant.y, giant.r + (b.r ?? 4))) {
        giant.hp -= (b.dmg ?? 10);
        consumed = true;
        break;
      }
    }

    if (!consumed && lobby.mode === 'teams') {
      for (const golem of lobby.golems) {
        if (golem.activated) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, golem.x, golem.y, golem.r + (b.r ?? 4))) {
          golem.dmg[team] += (b.dmg ?? 10);
          if (golem.dmg[team] >= golem.threshold) { golem.activated = true; golem.team = team; }
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      for (const p of playersArr(lobby)) {
        if (p.team === team || (p.hp ?? 0) <= 0) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, (b.r ?? 4) + 16)) {
          p.hp = Math.max(0, (p.hp ?? 100) - (b.dmg ?? 10));
          if (p.hp <= 0) { p.respawnAt = tnow() + RESPAWN_MS; dropFlag(lobby, p); }
          consumed = true;
          break;
        }
      }
    }

    if (!consumed) {
      for (const bot of lobby.bots) {
        if (bot.team === team || (bot.hp ?? 0) <= 0) continue;
        if (segmentHitsCircle(x0, y0, b.x, b.y, bot.x, bot.y, (b.r ?? 4) + 16)) {
          bot.hp -= (b.dmg ?? 10);
          if (bot.hp <= 0) { bot.respawnAt = tnow() + RESPAWN_MS; dropFlag(lobby, bot); }
          consumed = true;
          break;
        }
      }
    }

    if (consumed) lobby.bullets.splice(i, 1);
  }
}

// ---------------------------------------------------------------- tick
export function tickTeamMatch(lobby, dt, move) {
  if (!isTeamMode(lobby.mode)) return;
  if (!lobby.giants || !lobby.giants.length) initTeamMatch(lobby);
  const t = tnow();
  fillTeamsWithBots(lobby);

  for (const p of playersArr(lobby)) {
    if (p.team !== 0 && p.team !== 1) p.team = pickTeam(lobby, null);
    if ((p.hp ?? 0) > 0) continue;
    if (!p.respawnAt) { p.respawnAt = t + RESPAWN_MS; dropFlag(lobby, p); }
    else if (t >= p.respawnAt) {
      const anchor = spawnAnchor(lobby, p.team);
      const spot = freeSpot(lobby, anchor.x, anchor.y, 260, 18);
      p.x = spot.x; p.y = spot.y; p.hp = p.hpMax ?? 100; p.respawnAt = 0;
    }
  }

  for (const bot of lobby.bots) {
    if (bot.team !== 0 && bot.team !== 1) continue;
    if ((bot.hp ?? 0) <= 0) {
      if (!bot.respawnAt) { bot.respawnAt = t + RESPAWN_MS; dropFlag(lobby, bot); }
      else if (t >= bot.respawnAt) {
        const anchor = spawnAnchor(lobby, bot.team);
        const spot = freeSpot(lobby, anchor.x, anchor.y, 620, 20);
        bot.x = spot.x; bot.y = spot.y; bot.hp = bot.hpMax ?? 100; bot.respawnAt = 0; bot.carrying = false;
      }
      continue;
    }
    botThink(lobby, bot, dt, move);
  }

  if (lobby.mode === 'teams') teamsTick(lobby, dt, move);
  else if (lobby.mode === 'ctf') ctfTick(lobby);

  if (lobby.winner == null) {
    if (lobby.mode === 'teams') {
      const dead = lobby.giants.find((g) => g.hp <= 0);
      if (dead) lobby.winner = 1 - dead.team;
    } else if (lobby.mode === 'ctf' && lobby.ctf) {
      if (lobby.ctf.scores[0] >= CTF_SCORE_TARGET) lobby.winner = 0;
      else if (lobby.ctf.scores[1] >= CTF_SCORE_TARGET) lobby.winner = 1;
    }
  }
}

// ---------------------------------------------------------------- snapshot
// Shapes match Teams.snapshot() / CTF.snapshot() in the offline modes so the
// existing 2D and 3D renderers draw the objectives with no changes.
export function bakeTeamSnapshot(lobby) {
  const out = {};
  if (lobby.giants && lobby.giants.length) {
    out.teams = {
      giants: lobby.giants.map((g) => ({
        team: g.team, x: g.x, y: g.y, r: g.r,
        hp: Math.max(0, Math.round(g.hp)), maxhp: g.maxhp, name: g.name
      })),
      golems: (lobby.golems || []).map((go) => ({
        x: go.x, y: go.y, r: go.r, wobble: go.wobble,
        activated: go.activated, team: go.team,
        dmg: go.dmg, threshold: go.threshold, dPhase: 'idle'
      })),
      fireballs: [],
      effects: [],
      over: lobby.winner != null,
      winner: lobby.winner,
      playerTeam: 0
    };
  }
  if (lobby.ctf) {
    out.ctf = {
      bases: lobby.ctf.bases.map((b) => ({ team: b.team, x: b.x, y: b.y, r: b.r })),
      flags: lobby.ctf.flags.map((f) => ({ team: f.team, x: f.x, y: f.y, state: f.state, bob: f.bob })),
      scores: lobby.ctf.scores,
      over: lobby.winner != null,
      winner: lobby.winner,
      playerTeam: 0,
      playerCarrying: false
    };
  }
  return out;
}

// Team bots need their side in the snapshot so the client colours them.
export function bakeTeamBots(lobby) {
  return (lobby.bots || []).map((b) => ({
    id: b.id,
    name: b.name,
    x: b.x,
    y: b.y,
    ang: b.ang,
    hp: b.hp,
    team: b.team
  }));
}