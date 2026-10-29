// ===============================
// SINGLEPLAYER BOT MODULE (upgraded AI)
// ===============================
// This file runs as a plain <script> (no module scope), separate from the
// big pve16.js IIFE. A lot of the game's real logic (world geometry, hazard
// physics, glyph helpers, dash math, chest opening, RNG helpers...) is
// trapped inside that IIFE and is NOT reachable as a bare global. pve16.js
// calls setBotEnv({...}) once (see the BOTS_ENABLED block in startGame/boot)
// to hand us references to everything we need. Do not call those trapped
// functions as bare identifiers — always go through ENV.

let SP_BOTS = [];

let ENV = {
  world: null, ents: null, weapons: null, player: null, cam: null, audio: null,
  losBlocked: null, moveWithCollide: null,
  applyQuicksand: null, applyIceSlide: null, resolveVoid: null,
  openChest: null, applyBurn: null, applyDrench: null, stun: null,
  addEffect: null, spawnDashTrail: null, losBlocked3D: null, sweptDashDistance: null,
  dropXpOrb: null, dropPickup: null, hurtPlayer: null, setKiller: null, onBotDeath: null,
  dist2: null, clamp: null, rand: null, rint: null, pointInRect: null
};

function setBotEnv(env){
  Object.assign(ENV, env || {});
}
// Back-compat shims for older call sites.
function setBotLOS(fn){ ENV.losBlocked = fn; }
function setBotMove(fn){ ENV.moveWithCollide = fn; }

const GLYPH_PATHS = ['fire', 'lightning', 'spirit', 'water', 'earth'];

// ===== local helpers (safe fallbacks if ENV isn't wired yet) =====
function angleTo(ax, ay, bx, by){ return Math.atan2(by - ay, bx - ax); }

function lerpAngle(a, b, t){
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function aimPredict(from, target, bulletSpeed = 900){
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dist = Math.hypot(dx, dy);
  const t = dist / bulletSpeed;
  const vx = target.vx || 0;
  const vy = target.vy || 0;
  return Math.atan2((target.y + vy * t) - from.y, (target.x + vx * t) - from.x);
}

function d2Fallback(ax, ay, bx, by){ const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; }
function bDist2(ax, ay, bx, by){ return (ENV.dist2 || d2Fallback)(ax, ay, bx, by); }
function bClamp(v, a, c){ return (ENV.clamp || ((v,a,c)=>Math.max(a,Math.min(c,v))))(v, a, c); }

function glyphColor(path){
  const style = (typeof ELEM_STYLE !== 'undefined') ? ELEM_STYLE[path] : null;
  return style ? style.main : '#ffadad';
}

// ===== building / chest helpers (mirrors pve16.js's own, which we can't reach) =====
function botBuildingAt(world, x, y){
  for (const bd of (world.buildings || [])){
    if (!bd.inner) continue;
    if (x >= bd.inner.x && x <= bd.inner.x + bd.inner.w &&
        y >= bd.inner.y && y <= bd.inner.y + bd.inner.h) return bd;
  }
  return null;
}
function botDoorCenters(bd){
  const list = [];
  for (const d of (bd.doors || [])) list.push({ x: d.x + d.w/2, y: d.y + d.h/2, side: d.side, w: d.w, h: d.h });
  return list;
}
function botNearestDoor(bd, x, y){
  let best = null, bestD = Infinity;
  for (const p of botDoorCenters(bd)){
    const dx = p.x - x, dy = p.y - y, d = dx*dx + dy*dy;
    if (d < bestD){ bestD = d; best = p; }
  }
  return best;
}
// ===== 3D awareness: path-finding through doors / up stairs / over bridges, and line of sight between floors =====
let BOT_NAV_BUDGET = 3;                       // path searches allowed per frame (reset each update)
function botNavOK(){ return !!(window.W3 && W3.enabled && W3.data && typeof W3.navPath === 'function' && ENV.world); }
function botLOS(b, tx, ty, tz){
  if (botNavOK() && ENV.losBlocked3D) return ENV.losBlocked3D(b.x, b.y, (b.z || 0) + 34, tx, ty, (tz || 0) + 34);
  return ENV.losBlocked(b.x, b.y, tx, ty);
}
// Unit direction along a cached A* route to (gx,gy,gz), or null when there is no route (or no 3D data).
function botNavSteer(b, gx, gy, gz, dt){
  if (!botNavOK()) return null;
  b._pt = (b._pt || 0) - dt;
  // stuck detector: it wants to move but has barely moved for ~0.7 s -> replan now
  b._sk = (b._sk || 0) + dt;
  if (b._sk >= 0.7){ const mv = Math.hypot(b.x - (b._sx ?? b.x), b.y - (b._sy ?? b.y)); if (mv < 7 && b._path) { b._pt = 0; b._stuckN = (b._stuckN || 0) + 1; } else b._stuckN = 0; b._sx = b.x; b._sy = b.y; b._sk = 0; }
  const sameGoal = b._pg && Math.hypot(b._pg[0] - gx, b._pg[1] - gy) < 50 && Math.abs(b._pg[2] - gz) < 30;
  if ((!sameGoal || b._pt <= 0) && BOT_NAV_BUDGET > 0){
    BOT_NAV_BUDGET--; b._pt = 0.8 + Math.random() * 0.5; b._pg = [gx, gy, gz];
    b._path = W3.navPath(b.x, b.y, b.z || 0, gx, gy, gz, { r: 8, cap: 2200, blocked: (x, y, r, z) => W3.wallsBlocked(ENV.world.walls, x, y, r, z) });
    b._pi = 0;
  }
  const P = b._path; if (!P || !P.length) return null;
  while (b._pi < P.length - 1 && Math.hypot(P[b._pi].x - b.x, P[b._pi].y - b.y) < 22) b._pi++;
  const wp = P[Math.min(b._pi, P.length - 1)], dx = wp.x - b.x, dy = wp.y - b.y, d = Math.hypot(dx, dy);
  if (d < 5) return { x: 0, y: 0 };
  return { x: dx / d, y: dy / d };
}
function botBanChest(b, ch, secs){ b._chestBan = b._chestBan || {}; b._chestBan[ch.id] = performance.now() / 1000 + secs; }
// Storm damage a bot expects to take on a round trip to this chest (0 when it is inside the safe circle).
function botZoneRisk(b, ch, zone){
  if (!zone) return 0;
  const known = (zone.mode === 'wait' && zone.nextPicked), sx = known ? zone.toX : zone.cx, sy = known ? zone.toY : zone.cy, sr = known ? zone.toR : zone.r;
  const chestOut = Math.max(0, Math.hypot(ch.x - sx, ch.y - sy) - sr);
  if (chestOut <= 0) return 0;
  const botOut = Math.max(0, Math.hypot(b.x - sx, b.y - sy) - sr);
  const secs = (chestOut * 2 + botOut + 40) / Math.max(60, b.speed || 160);
  return (zone.dps || 3) * secs * 1.15;
}
const BOT_CHEST_WORTH = { common: 0, rare: 60, epic: 150, legendary: 260, death: 420 };
function findLootableChest(world, b, zone){
  const now = performance.now() / 1000, nav = botNavOK(); let best = null, bestScore = Infinity;
  for (const ch of (world.chests || []).concat(world.deathChests || [])){
    if (!ch || ch.opened) continue;
    if (b._chestBan && b._chestBan[ch.id] > now) continue;
    const cz = ch.z || 0; if (!nav && cz > 20) continue;
    const d = Math.hypot(ch.x - b.x, ch.y - b.y) + Math.abs(cz - (b.z || 0)) * 1.6;
    if (d > 2600) continue;
    const worth = BOT_CHEST_WORTH[ch.rarity] || 0, risk = botZoneRisk(b, ch, zone);
    // a chest right next to it is worth a gamble; far ones only if the storm damage on the way is affordable
    if (risk > b.hp * 0.4 * (b.bold || 1) * (d < 220 ? 1.6 : 1) + worth * 0.08) continue;
    const score = d + risk * 40 - worth * 1.2;
    if (score < bestScore){ bestScore = score; best = { chest: ch, risk }; }
  }
  return best;
}

// ===== obstacle-aware steering =====
// Tries the desired direction first; if it's blocked a few steps ahead,
// fans out to either side (alternating which side first) until it finds a
// clear heading, so bots route around walls/buildings instead of just
// grinding into them.
function steerDir(b, world, dirX, dirY){
  if (!world || typeof world.isBlocked !== 'function') return { x: dirX, y: dirY };
  const probe = 46;
  if (!world.isBlocked(b.x + dirX*probe, b.y + dirY*probe, b.r)) return { x: dirX, y: dirY };

  const baseAng = Math.atan2(dirY, dirX);
  const offsets = [0.35, 0.7, 1.1, 1.6, 2.2]; // radians
  for (const off of offsets){
    for (const sign of [b.avoidSign, -b.avoidSign]){
      const a = baseAng + off * sign;
      const nx = Math.cos(a), ny = Math.sin(a);
      if (!world.isBlocked(b.x + nx*probe, b.y + ny*probe, b.r)) return { x: nx, y: ny };
    }
  }
  // boxed in on every heading we tried — flip our preferred side for next
  // time and just back off so we don't sit grinding into geometry.
  b.avoidSign *= -1;
  return { x: -dirX, y: -dirY };
}

// Probes a short distance ahead in the travel direction; if a LETHAL hazard
// (erupting lava / void) is there, blend the heading sideways around it so
// the bot routes around danger instead of walking in and dying. Non-lethal
// hazards (sand/ice) are handled by applyBotHazards once entered.
function hazardAvoidBias(b, world, dirX, dirY){
  if (!world || typeof world.getHazardAt !== 'function') return { x: dirX, y: dirY };
  const probe = 78;
  const hz = world.getHazardAt(b.x + dirX * probe, b.y + dirY * probe, b.r);
  if (!hz) return { x: dirX, y: dirY };
  if (hz.type !== 'lava' && hz.type !== 'void') return { x: dirX, y: dirY };
  // already inside lava that isn't erupting: don't dodge, the hazard handler moves us
  if (hz.type === 'lava' && hz.phase !== 'erupt' && hz.phase !== 'pre') return { x: dirX, y: dirY };
  const perpX = -dirY, perpY = dirX;
  const sign = b.avoidSign || 1;
  return { x: dirX * 0.25 + perpX * sign * 0.75, y: dirY * 0.25 + perpY * sign * 0.75 };
}

// ===== doorway funnel steering =====
// Heading straight at a door's center works fine from a distance, but up
// close a shallow approach angle lets the bot's circle clip the door FRAME
// (the wall either side of the gap) even though the doorway itself is
// open. steerDir's generic obstacle-avoidance then reads that clip as
// "blocked ahead" and fans the bot out sideways to dodge it, which swings
// it further off-axis and trips the same probe again next frame — that
// back-and-forth is the in-place jitter. This lines the bot up with the
// opening along the wall first (a pure sideways slide, no fan-out needed),
// then only pushes straight through once it's actually lined up.
function steerToDoor(b, world, door, speedMul, dt, doMove){
  if (!door) return false;
  const cx = door.x, cy = door.y; // botNearestDoor/botDoorCenters give the center point
  const horizontal = (door.side === 'top' || door.side === 'bottom'); // door gap runs along x
  const tangent = horizontal ? (b.x - cx) : (b.y - cy);
  const span = (horizontal ? (door.w || 60) : (door.h || 60)) / 2;
  const clearance = Math.max(4, span - b.r - 8);

  let dirX, dirY;
  if (Math.abs(tangent) > clearance){
    // Not lined up yet — slide along the wall toward the opening, with a
    // little forward pull blended in so it arcs toward the door instead of
    // pacing the wall forever.
    const alongX = horizontal ? (tangent > 0 ? -1 : 1) : 0;
    const alongY = horizontal ? 0 : (tangent > 0 ? -1 : 1);
    const dx = cx - b.x, dy = cy - b.y;
    const d = Math.hypot(dx, dy) || 1;
    dirX = alongX * 0.75 + (dx / d) * 0.25;
    dirY = alongY * 0.75 + (dy / d) * 0.25;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len; dirY /= len;
  } else {
    const dx = cx - b.x, dy = cy - b.y;
    const d = Math.hypot(dx, dy) || 1;
    dirX = dx / d; dirY = dy / d;
  }

  const steered = steerDir(b, world, dirX, dirY);
  doMove(b, steered.x * b.speed * speedMul * dt, steered.y * b.speed * speedMul * dt);
  b.ang = lerpAngle(b.ang || 0, Math.atan2(cy - b.y, cx - b.x), 0.15);
  return true;
}

// ===== dash =====
function botDash(b, weapons, world, ax, ay){
  if (b.dashCD > 0) return false;
  const w = weapons[b.weapon] || weapons[0];
  const dashDist = w.dash || 380;
  const ox = b.x, oy = b.y;

  const safeDist = ENV.sweptDashDistance
    ? ENV.sweptDashDistance(ox, oy, ax, ay, dashDist, b.r)
    : dashDist;

  b.x = ox + ax * safeDist;
  b.y = oy + ay * safeDist;

  if (world){
    b.x = bClamp(b.x, 60, world.w - 60);
    b.y = bClamp(b.y, 60, world.h - 60);
  }

  b.dashCD = 1.4;
  b.dashI = 0.15;

  if (ENV.spawnDashTrail) ENV.spawnDashTrail(ox, oy, b.x, b.y, glyphColor(b.glyphPath));
  if (ENV.audio && ENV.audio.dash) ENV.audio.dash();
  return true;
}

// ===== hazards (sand / ice / lava / void) =====
// Mirrors the player's own hazard handling. Crucially tracks how long a bot
// has been stuck in quicksand so it can dash itself free, same as a player
// mashing the dash key to escape a sand pit.
function applyBotHazards(b, world, dt){
  b.inSand = false;
  if (!world || typeof world.getHazardAt !== 'function') return;

  const hz = world.getHazardAt(b.x, b.y, b.r * 0.9);
  if (!hz) { b.inSandT = 0; return; }

  if (hz.type === 'sand'){
    if (ENV.applyQuicksand) ENV.applyQuicksand(b, hz, dt, { isPlayer: false });
    if (b.inSand){
      b.inSandT = (b.inSandT || 0) + dt;
      // Stuck for too long -> strategic escape dash, straight out along the
      // radial direction away from the pit's centre.
      if (b.inSandT > 0.9 && b.dashCD <= 0){
        const cx = hz.x + hz.w/2, cy = hz.y + hz.h/2;
        const dx = b.x - cx, dy = b.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        botDash(b, ENV.weapons || [], world, dx/d, dy/d);
        b.inSandT = 0;
      }
    }
  } else if (hz.type === 'ice'){
    if (ENV.applyIceSlide) ENV.applyIceSlide(b, hz, dt);
    b.inSandT = 0;
  } else if (hz.type === 'lava'){
    b.inSandT = 0;
    if (hz.phase === 'erupt') b.hp = 0;
    else if (hz.phase === 'after') b.hp -= 30 * dt;
  } else if (hz.type === 'void'){
    b.inSandT = 0;
    if (ENV.resolveVoid){
      const res = ENV.resolveVoid(b, hz, dt, false);
      if (res && res.done && res.killed) b.hp = 0;
    }
  } else {
    b.inSandT = 0;
  }
}

// ===== weapons =====
function botSetWeapon(b, weapons, idx){
  if (!weapons[idx]) return;
  b.weapon = idx;
  const w = weapons[idx];
  if (b.ammo > w.ammo) b.ammo = w.ammo; // mirrors player setWeapon() clamp behaviour
}

function chooseBotWeapon(b, weapons, distToTarget){
  let pistolI = -1, rifleI = -1, shotI = -1;
  for (let i = 0; i < weapons.length; i++){
    if (weapons[i].kind === 'pistol')  pistolI = i;
    if (weapons[i].kind === 'rifle')   rifleI  = i;
    if (weapons[i].kind === 'shotgun') shotI   = i;
  }

  // Role-based weapon preference: each role favours a specific weapon and
  // sticks with it (so bots actually use different guns), only switching by
  // distance when no preference is set.
  const pref = b.preferredKind;
  let want = (pistolI >= 0) ? pistolI : 0;
  if (pref === 'rifle' && rifleI >= 0) want = rifleI;
  else if (pref === 'shotgun' && shotI >= 0) want = shotI;
  else if (pref === 'pistol' && pistolI >= 0) want = pistolI;
  else {
    if (distToTarget < 190 && shotI >= 0) want = shotI;
    else if (distToTarget < 540 && rifleI >= 0) want = rifleI;
    else if (pistolI >= 0) want = pistolI;
  }

  if (want !== b.weapon && !b.reloading) botSetWeapon(b, weapons, want);
}

function botTryReload(b, w){
  if (b.reloading || b.ammo >= w.ammo || b.reserve <= 0) return;
  b.reloading = true;
  b.reloadT = w.reload;
}

// Pushes one of the game's existing "elemBurst" VFX (fire explosion, water
// splash, lightning bolts, earth burst, spirit glow — see pve16.js's effect
// renderer) at a target, keyed by element. This is how a bot's glyph proc
// actually becomes visible on whoever it's affecting, instead of only ever
// showing on the bot's own ambient ring.
function botGlyphBurstFx(x, y, el, r = 55, life = 0.45){
  if (!ENV.ents || !ENV.ents.effects || !el) return;
  ENV.ents.effects.push({ type: 'elemBurst', kind: el, x, y, r, life, t: 0 });
}

// ===== glyph upgrades (bots spend essence at every glyph screen, picking randomly) =====
const BOT_GLYPH_MAX = 5, BOT_PERKS = ['potency', 'reach', 'haste'];
function botGlyphCost(b){ return 4 + 3 * (b.glyphTier | 0); }
// potency = stronger procs/damage, reach = bigger bursts/longer slows, haste = more frequent procs
function botGlyphPower(b){
  const t = b.glyphTier | 0, gp = b.glyphPerks || {};
  return { tier: t, pot: 1 + 0.14 * t + 0.25 * (gp.potency | 0), reach: 1 + 0.12 * t + 0.3 * (gp.reach | 0), haste: 1 + 0.1 * t + 0.2 * (gp.haste | 0) };
}
function botGlyphUpgradeRound(){
  if (!window.BOTS_ENABLED || typeof SP_BOTS === 'undefined') return 0;
  let total = 0;
  for (const b of SP_BOTS){
    if (b.hp <= 0) continue;
    let n = 0;
    while ((b.glyphTier | 0) < BOT_GLYPH_MAX && Math.floor(b.essence || 0) >= botGlyphCost(b) && n < 3){
      b.essence -= botGlyphCost(b);
      b.glyphTier = (b.glyphTier | 0) + 1;
      b.glyphPerks = b.glyphPerks || { potency: 0, reach: 0, haste: 0 };
      b.glyphPerks[BOT_PERKS[Math.floor(Math.random() * BOT_PERKS.length)]]++;   // random pick
      n++; total++;
      b.glyphUpFlash = 1.2;
      botGlyphBurstFx(b.x, b.y, b.glyphPath, 90 + 12 * b.glyphTier, 0.8);
      if (ENV.addEffect) ENV.addEffect(b.x, b.y, 'pop', 0.5, glyphColor(b.glyphPath));
    }
  }
  return total;
}
window.botGlyphUpgradeRound = botGlyphUpgradeRound;
// Expose the live bot roster + bot env (weapons/world/ents/etc.) so external
// mode modules (CTF minimap, renderer) can read them without patching pve16.
window.__BOTS__ = { get SP_BOTS(){ return SP_BOTS; }, get ENV(){ return ENV; } };

// ===== glyph effects (independent bot loadout — never touches the player's) =====
// Bot glyph bookkeeping lives entirely on the attacking bot object (never on
// the victim) so we never need to add new fields to the sealed `player`
// object. Only existing, already-declared player fields (hp, slowT) are
// ever mutated.
function applyBotGlyphOnEnemyHit(b, e){
  const el = b.glyphPath;
  if (!el || !e) return;
  if (el === 'fire' && ENV.applyBurn){
    ENV.applyBurn(e, 1, 2.6);
    botGlyphBurstFx(e.x, e.y, 'fire');
  } else if (el === 'water' && ENV.applyDrench){
    ENV.applyDrench(e, 1, 3.2);
    botGlyphBurstFx(e.x, e.y, 'water');
  } else if (el === 'lightning' && ENV.stun && Math.random() < 0.35){
    ENV.stun(e, 0.3);
    botGlyphBurstFx(e.x, e.y, 'lightning', 60);
  } else if (el === 'spirit'){
    b.hp = Math.min(b.hpMax || 100, b.hp + 1.5);
    botGlyphBurstFx(b.x, b.y, 'spirit', 40, 0.55);
  }
}

// victim is the player object or another bot. Returns { extra } — bonus damage the caller adds on top of the bullet.
function applyBotGlyphOnHostileHit(b, victim, dmg){
  const el = b.glyphPath, out = { extra: 0 };
  if (!el || !victim) return out;
  const g = botGlyphPower(b), isPlayer = victim === ENV.player, shake = (v) => { if (isPlayer && ENV.cam) ENV.cam.shake = Math.max(ENV.cam.shake || 0, v); };

  if (el === 'water'){
    victim.slowT = Math.max(victim.slowT || 0, Math.min(3.5, 1.2 + 0.35 * g.tier + 0.4 * (g.pot - 1)));
    botGlyphBurstFx(victim.x, victim.y, 'water', 55 * g.reach);
    shake(2);
  } else if (el === 'lightning'){
    if (Math.random() < Math.min(0.85, 0.32 + 0.06 * g.tier + 0.1 * (g.haste - 1))){
      out.extra = 3 * g.pot + 1.5 * g.tier;                                   // shock arc damage
      if (isPlayer) victim.slowT = Math.max(victim.slowT || 0, 0.35 + 0.05 * g.tier);   // stagger (the player has no stun field)
      else victim._stunT = Math.max(victim._stunT || 0, 0.3 + 0.05 * g.tier);
      botGlyphBurstFx(victim.x, victim.y, 'lightning', 70 * g.reach);
      shake(4);
    }
  } else if (el === 'fire'){
    b._burnTarget = victim;
    b._burnUntil = (performance.now() / 1000) + 3.0 * (1 + 0.1 * (g.haste - 1));
    b._burnDmgPerSec = (4 + 1.6 * g.tier) * g.pot;
    b._burnFxAt = 0;                                                          // the DoT tick shows periodic flame bursts
    botGlyphBurstFx(victim.x, victim.y, 'fire', 50 * g.reach);
    shake(2);
  } else if (el === 'earth'){
    if (Math.random() < Math.min(0.8, 0.25 + 0.05 * g.tier + 0.08 * (g.haste - 1))){
      out.extra = 2 * g.pot;
      victim.slowT = Math.max(victim.slowT || 0, 0.7 + 0.1 * g.tier);         // rooting shards
      botGlyphBurstFx(victim.x, victim.y, 'earth', 60 * g.reach);
      shake(3);
    }
  } else if (el === 'spirit'){
    b.hp = Math.min(b.hpMax || 100, b.hp + dmg * (0.2 + 0.04 * g.tier) * g.pot);
    botGlyphBurstFx(b.x, b.y, 'spirit', 40 * g.reach, 0.55);
    botGlyphBurstFx(victim.x, victim.y, 'spirit', 34, 0.4);
  }
  return out;
}

// Earth-path bots take reduced damage from everything, mirroring the
// player's Stone Skin passive but kept local to the bot.
function botEarthDamageMul(b){
  return (b.glyphPath === 'earth') ? Math.max(0.6, 0.85 - 0.02 * (b.glyphTier | 0)) : 1;
}

// ===== firing =====
function botFire(b, weapons, target, targetKind){
  const w = weapons[b.weapon];
  if (!w) return;

  const t = performance.now() / 1000;
  const interval = 1 / (w.rof * (b.reloading ? 0.6 : 1));
  if (t - b.lastShot < interval) return;
  if (b.reloading) return;

  if (b.ammo <= 0){ botTryReload(b, w); return; }

  // different floor than the target: don't waste ammo shooting through ceilings
  const _3d = !!(window.W3 && W3.enabled && W3.data);
  const gz = _3d ? (typeof b.z === 'number' ? b.z : W3.terrain(b.x, b.y)) : undefined;
  const tz = _3d ? (target && typeof target.z === 'number' ? target.z : (target ? W3.terrain(target.x, target.y) : gz)) : undefined;
  if (_3d && target && botLOS(b, target.x, target.y, tz)) return;      // nothing but floor / wall between them: hold fire

  b.lastShot = t;
  b.ammo--;

  const base = b.ang;
  const gdmg = w.dmg * (1 + 0.06 * (b.glyphTier | 0) + 0.08 * ((b.glyphPerks && b.glyphPerks.potency) | 0));
  const dTgt = target ? Math.hypot(target.x - b.x, target.y - b.y) : 0;
  const ebullets = ENV.ents ? ENV.ents.ebullets : null;
  if (!ebullets) return;

  for (let i = 0; i < w.shots; i++){
    const a = base + (Math.random() * 2 - 1) * w.spread;
    ebullets.push({
      x: b.x + Math.cos(a) * b.r,
      y: b.y + Math.sin(a) * b.r,
      vx: Math.cos(a) * w.speed,
      vy: Math.sin(a) * w.speed,
      r: 4,
      dmg: gdmg,
      life: 1.2,
      z: _3d ? gz + 30 : undefined,
      vz: _3d ? Math.max(-0.5, Math.min(0.5, ((tz + 30) - (gz + 30)) / Math.max(60, dTgt) )) * w.speed : undefined,
      fromBot: b.id,
      team: b.team,
      targetKind,
      glyph: b.glyphPath,
      glyphColor: glyphColor(b.glyphPath),
      ownerRef: b
    });
  }

  if (ENV.addEffect) ENV.addEffect(
    b.x + Math.cos(base) * b.r,
    b.y + Math.sin(base) * b.r,
    'muzzle', 0.1, '#fff'
  );
  if (ENV.audio){
    if (w.kind === 'shotgun' && ENV.audio.shotgun) ENV.audio.shotgun();
    else if (ENV.audio.shoot) ENV.audio.shoot();
  }
}

// ===== INIT =====
function initSPBots(player, COLORS, DESIGNS, gunSheets, spawnPoints){
  SP_BOTS = [];

  // Co-op (no PvP): every bot is on the player's side, no friendly fire.
  // Practice deathmatch (PVP_MODE): bots split into two rival squads so
  // "team vs team vs player" fights actually happen.
  const teamCount = window.PVP_MODE ? 2 : 1;

  // Bot count follows however many spawn points pve16.js handed us (see
  // pickSpreadSpawnPoints in restart()) — 15 for practice PvP, 3 for co-op —
  // falling back to sensible defaults if we were ever called without one.
  // Teams mode wants a busy arena: 59 bots + the player = 60 entities.
  const BOT_COUNT = (window.TEAMS_MODE || window.CTF_MODE)
    ? 59
    : ((spawnPoints && spawnPoints.length) ? spawnPoints.length : (window.PVP_MODE ? 15 : 3));

  for (let i = 0; i < BOT_COUNT; i++){
    const glyphPath = GLYPH_PATHS[Math.floor(Math.random() * GLYPH_PATHS.length)];

    // Use a pre-picked, spread-out map position when the caller supplies one
    // (see pickSpreadSpawnPoints in pve16.js); otherwise fall back to the
    // old "somewhere near the player" scatter.
    const sp = spawnPoints && spawnPoints[i];
    const spawnX = sp ? sp.x : player.x + (Math.random() - 0.5) * 800;
    const spawnY = sp ? sp.y : player.y + (Math.random() - 0.5) * 800;

    SP_BOTS.push({
      id: "bot_" + i,
      name: "Bot_" + (100 + i),

      x: spawnX,
      y: spawnY,
      ang: Math.random() * Math.PI * 2,

      hp: 100, hpMax: 100,
      r: 16,
      vx: 0, vy: 0,
      speed: 180,

      design: Math.floor(Math.random() * DESIGNS.length),
      color: Math.floor(Math.random() * COLORS.length),

      guns: {
        pistol: Math.floor(Math.random() * gunSheets.pistols.length),
        rifle: Math.floor(Math.random() * gunSheets.rifles.length),
        shotgun: Math.floor(Math.random() * gunSheets.shotguns.length)
      },

      weapon: 0,
      ammo: 15, reserve: 90, reloading: false, reloadT: 0, lastShot: 0,
      equip: "gun",

      team: teamCount > 1 ? (i % teamCount) : 0,

      target: null, targetKind: null,
      shootCD: 0, dodgeCD: 0, wanderT: 0,

      dashCD: 0, dashI: 0, inSand: false, inSandT: 0,

      essence: 0,

      // Independent glyph loadout — never depends on the player's path,
      // and "levels up" over the course of the match on its own timer.
      glyphPath,
      glyphTier: 0,
      glyphPerks: { potency: 0, reach: 0, haste: 0 },
      bold: 0.8 + Math.random() * 0.7,          // appetite for storm-risk when looting
      leadSkill: 0.25 + Math.random() * 0.5,    // how often it predicts your movement
      glyphUpT: 0,
      _burnTarget: null, _burnUntil: 0, _burnDmgPerSec: 0,
      _stunT: 0, slowT: 0,

      // chest looting
      seekingChest: false, chestTarget: null, chestBuilding: null, chestDoor: null,

      // building-exit recovery (see STUCK-IN-BUILDING RECOVERY in update loop)
      _exitBuilding: null, _exitDoor: null,

      state: "idle", stateT: 0, decisionCD: 0,
      side: Math.random() < 0.5 ? -1 : 1,
      avoidSign: Math.random() < 0.5 ? -1 : 1
    });
  }
}

// ===== zone (death circle) awareness =====
// Reads the same shrinking safe-circle the player sees (see initZone/
// updateZone/drawZone in pve16.js). While the zone is calmly "waiting" to
// shrink, the NEXT circle is already picked and shown to the player as a
// dashed preview ring — bots read that same telegraph so they start
// repositioning before the storm reaches them, not only once it already
// hurts.
// Returns null if the bot is comfortably inside the (upcoming) safe circle.
// Otherwise returns { x, y, urgent } — x/y is the point to walk toward,
// urgent is true if the bot is outside the LIVE circle and taking damage
// right now (vs. just outside where the circle is about to shrink to).
function zoneFleeTarget(b, zone){
  if (!zone) return null;
  const nextKnown = (zone.mode === 'wait' && zone.nextPicked);
  const safeCx = nextKnown ? zone.toX : zone.cx;
  const safeCy = nextKnown ? zone.toY : zone.cy;
  const safeR  = nextKnown ? zone.toR : zone.r;

  const margin = 60; // stay a comfortable step inside the line, not hugging it
  const distToSafeCenter = Math.hypot(b.x - safeCx, b.y - safeCy);
  if (distToSafeCenter <= safeR - margin) return null;

  const liveDx = b.x - zone.cx, liveDy = b.y - zone.cy;
  const urgent = (liveDx * liveDx + liveDy * liveDy) > zone.r * zone.r;

  return { x: safeCx, y: safeCy, urgent };
}

// ===== UPDATE =====
function updateSPBots(dt, player, ents, world, weapons, zone){
  BOT_NAV_BUDGET = 3;
  if (!window.BOTS_ENABLED) return;

  const dist2 = ENV.dist2 || d2Fallback;
  const moveWithCollide = ENV.moveWithCollide || function(o, dx, dy){ o.x += dx; o.y += dy; };
  const losBlocked = ENV.losBlocked || (() => false);
  const now = performance.now() / 1000;

  for (const b of SP_BOTS){
    if (b.hp <= 0) continue;

    // ---- status timers ----
    if (b._stunT > 0) b._stunT = Math.max(0, b._stunT - dt);
    if (b.slowT  > 0) b.slowT  = Math.max(0, b.slowT  - dt);
    if (b.dashCD > 0) b.dashCD = Math.max(0, b.dashCD - dt);
    if (b.dashI  > 0) b.dashI  = Math.max(0, b.dashI  - dt);

    // fire DoT this bot has applied to something (player or another bot)
    if (b._burnUntil > now && b._burnTarget && b._burnTarget.hp > 0){
      const dps = (b._burnDmgPerSec || 4);
      if (b._burnTarget === ENV.player && ENV.hurtPlayer){
        if (ENV.setKiller) ENV.setKiller(b);
        // burning the player: tick through the normal damage path (shields, armour, hurt sound) twice a second
        b._burnAcc = (b._burnAcc || 0) + dps * dt;
        b._burnTickAt = (b._burnTickAt || 0) - dt;
        if (b._burnTickAt <= 0){ b._burnTickAt = 0.5; ENV.hurtPlayer(b._burnAcc); b._burnAcc = 0; }
      } else {
        b._burnTarget.hp -= dps * dt;
      }
      // recurring flame bursts so the burn stays visible for its whole duration, not just when applied
      b._burnFxAt = (b._burnFxAt || 0) - dt;
      if (b._burnFxAt <= 0){
        b._burnFxAt = 0.4;
        botGlyphBurstFx(b._burnTarget.x, b._burnTarget.y, 'fire', 38 * botGlyphPower(b).reach, 0.35);
      }
    } else if (b._burnUntil <= now){
      b._burnTarget = null;
    }

    // glyph upgrades now come from spending essence at each glyph screen (botGlyphUpgradeRound).
    // Bots also earn a little essence over time on top of the orbs they pick up, so there is always something to spend.
    b.essence = (b.essence || 0) + 0.22 * dt;
    if (b.glyphUpFlash > 0) b.glyphUpFlash = Math.max(0, b.glyphUpFlash - dt);

    const speedMul = (b.slowT > 0 ? 0.7 : 1) * (b.slowMul ?? 1) * (b._ctfCarrying ? 0.82 : 1);

    if (b._stunT > 0 || b.stunT > 0 || b.freezeT > 0){
      applyBotHazards(b, world, dt);
      continue; // stunned this tick
    }

    // ==========================================================
    // STUCK-IN-BUILDING RECOVERY — highest priority short of being
    // stunned. A bot standing inside a building's walls for any reason
    // OTHER than deliberately looting that exact building's chest gets out
    // via the nearest door before it does anything else — chasing,
    // wandering, or fleeing the death zone from inside a building just
    // grinds the bot into an interior wall instead of routing through a
    // doorway, which is what was actually leaving bots standing still
    // eating storm damage instead of getting anywhere.
    // ==========================================================
    const insideBuilding = world ? botBuildingAt(world, b.x, b.y) : null;
    if (insideBuilding && !b.seekingChest && (b.z || 0) < 20){
      // Lock onto one door for this building instead of re-picking the
      // nearest one every frame, which can flip-flop between two similarly
      // close doors and make the bot jitter in place.
      if (b._exitBuilding !== insideBuilding){
        b._exitBuilding = insideBuilding;
        b._exitDoor = botNearestDoor(insideBuilding, b.x, b.y);
      }
      const door = b._exitDoor || botNearestDoor(insideBuilding, b.x, b.y);
      if (door){
        steerToDoor(b, world, door, speedMul, dt, moveWithCollide);
      }
      applyBotHazards(b, world, dt);
      continue;
    } else {
      b._exitBuilding = null;
      b._exitDoor = null;
    }

    // ==========================================================
    // TARGET SELECTION
    // ==========================================================
    let target = null, targetKind = null, bestD2 = Infinity;
    const SIGHT2 = 700 * 700;

    for (const e of (ents.enemies || [])){
      const d2 = dist2(e.x, e.y, b.x, b.y);
      if (d2 > SIGHT2) continue;
      if (botLOS(b, e.x, e.y, e.z)) continue;
      if (d2 < bestD2){ bestD2 = d2; target = e; targetKind = 'enemy'; }
    }

    if (window.PVP_MODE){
      const dP = dist2(player.x, player.y, b.x, b.y);
      const pTeam = (window.TEAMS_MODE && window.Teams && window.Teams.playerTeam != null) ? window.Teams.playerTeam
        : (window.CTF_MODE && window.CTF && window.CTF.playerTeam != null) ? window.CTF.playerTeam : -1;
      const playerIsEnemy = (!window.TEAMS_MODE && !window.CTF_MODE) || b.team !== pTeam;
      if (playerIsEnemy && player.hp > 0 && dP < bestD2 && dP < SIGHT2 && !botLOS(b, player.x, player.y, player.z)){
        bestD2 = dP; target = player; targetKind = 'player';
      }
      // Teams mode: only engage enemy bots that are actually close, so bots
      // don't stand at opposite ends of the arena trading shots forever —
      // with no close enemy they fall back to the giant (see below).
      const botFightR2 = window.TEAMS_MODE ? 460*460 : SIGHT2;
      for (const other of SP_BOTS){
        if (other === b || other.hp <= 0 || other.team === b.team) continue;
        const dO = dist2(other.x, other.y, b.x, b.y);
        if (dO < bestD2 && dO < botFightR2 && !botLOS(b, other.x, other.y, other.z)){
          bestD2 = dO; target = other; targetKind = 'bot';
        }
      }
    }

    // ---- Teams mode: golemancers activate neutral golems. Once a golem is
    // activated it marches on its own, so bots STOP shooting it and get back
    // to the real objective. Only golemancers bother with neutral golems. ----
    if (window.TEAMS_MODE && window.Teams && window.Teams.getGolems && b.role === 'golemancer'){
      for (const go of window.Teams.getGolems()){
        if (go.hp <= 0 || go.activated) continue;
        const d2 = dist2(go.x, go.y, b.x, b.y);
        if (d2 > SIGHT2) continue;
        if (botLOS(b, go.x, go.y, go.z)) continue;
        if (d2 < bestD2){ bestD2 = d2; target = go; targetKind = 'golem'; }
      }
    }

    // ---- Teams mode: DEFAULT objective. With no other target, every bot
    // pushes the enemy giant. When their OWN giant is under heavy attack,
    // nearby bots (not just defenders) fall back to defend it. ----
    if (window.TEAMS_MODE && window.Teams && window.Teams.getGiants){
      const myG = window.Teams.getGiants().find(g => g.team === b.team);
      const eg = window.Teams.getGiants().find(g => g.team !== b.team);
      const myGHit = myG && (myG.underAttackT || 0) > 0;
      const distMyG = myG ? dist2(b.x, b.y, myG.x, myG.y) : Infinity;
      if (eg && eg.hp > 0){
        const defending = (b.role === 'defender') || (myGHit && distMyG < 1200*1200);
        if (defending && myG){
          // defend: target the nearest enemy entity threatening our own giant
          let guard = null, gd2 = 540*540;
          for (const other of SP_BOTS){
            if (other.hp <= 0 || other.team === b.team) continue;
            if (dist2(other.x, other.y, myG.x, myG.y) > 900*900) continue;   // not threatening our giant
            const dB = dist2(other.x, other.y, b.x, b.y);
            if (dB < gd2){ gd2 = dB; guard = other; }
          }
          if (guard && (!target || gd2 < bestD2)){ target = guard; targetKind = 'bot'; bestD2 = gd2; }
          else if (!target){ target = eg; targetKind = 'giant'; bestD2 = dist2(eg.x, eg.y, b.x, b.y); }
        } else if (!target || dist2(eg.x, eg.y, b.x, b.y) < bestD2 * 1.4){
          // attacker roles: the enemy giant is the default — only a very
          // close enemy bot overrides it.
          target = eg; targetKind = 'giant'; bestD2 = dist2(eg.x, eg.y, b.x, b.y);
        }
      }
    }

    // ---- CTF mode: DEFAULT objective. A carrying bot runs home to score.
    // Defenders chase the enemy carrying our flag, or return our dropped
    // flag. Everyone else pushes for the enemy flag. Combat targets that are
    // close enough still win so bots defend themselves on the way. ----
    if (window.CTF_MODE && window.CTF && window.CTF.getFlags){
      const bases = window.CTF.getBases(), flags = window.CTF.getFlags();
      const myBase = bases[b.team], enemyFlag = flags[1 - b.team], myFlag = flags[b.team];
      // Resolve the carrier of our flag into an actual entity. The player is
      // stored as the literal string 'player', so without this the old chase
      // code read `c.x` on a string and silently never targeted the player.
      const myCarrier = (myFlag && myFlag.state === 'carried' && myFlag.carrier)
        ? (myFlag.carrier === 'player' ? ENV.player : myFlag.carrier) : null;

      // 1) I'm carrying the enemy flag → run home to score. Already on the
      // capture pad (waiting for our own flag to come home so the cap counts):
      // orbit the pad perimeter instead of pathing to the centre, which just
      // makes the bot spin on the point and look stuck.
      if (b._ctfCarrying && myBase){
        const inBase = dist2(b.x, b.y, myBase.x, myBase.y) < myBase.r * myBase.r;
        if (inBase){
          if (!target){
            const pa = (performance.now()/1000 * 0.6 + (b.id ? b.id.length : 0)) % (Math.PI * 2);
            target = { x: myBase.x + Math.cos(pa) * myBase.r * 0.8, y: myBase.y + Math.sin(pa) * myBase.r * 0.8 };
            targetKind = 'ctf'; bestD2 = dist2(target.x, target.y, b.x, b.y);
          }
        } else if (!target || dist2(myBase.x, myBase.y, b.x, b.y) < bestD2 * 1.4){
          target = myBase; targetKind = 'ctf'; bestD2 = dist2(myBase.x, myBase.y, b.x, b.y);
        }
      }
      // 2) Our flag is being carried by an enemy → EVERYONE on our team
      //    converges to stop the carrier, no matter how far away they are.
      //    Carrying the flag is meant to be hard: the whole enemy team
      //    hunts you down, not just nearby defenders. (Teammates of a bot
      //    carrier fall through to case 4 and escort by pathing to the
      //    carried enemy flag.)
      else if (myCarrier){
        const cd = dist2(myCarrier.x, myCarrier.y, b.x, b.y);
        if (!target || cd < bestD2){ target = myCarrier; targetKind = (myCarrier === ENV.player) ? 'player' : 'bot'; bestD2 = cd; }
      }
      // 3) Our flag is dropped → return it. Defenders always go for it; nearby
      //    attackers also help so a single defender isn't left doing it all.
      else if (myFlag && myFlag.state === 'dropped'){
        const fd = dist2(myFlag.x, myFlag.y, b.x, b.y);
        if (b.role === 'defender' || fd < 700 * 700){
          if (!target || fd < bestD2 * 1.4){ target = myFlag; targetKind = 'ctf'; bestD2 = fd; }
        }
      }
      // 4) Enemy flag is available (home/dropped) or carried by a teammate:
      //    attackers push for it (which naturally escorts a teammate who has
      //    it, since the carried flag follows them), defenders guard home.
      else if (enemyFlag){
        if (b.role === 'defender' && myBase){
          // Guard radius: defenders engage any enemy within ~560px of their
          // own base. A combat target inside that radius is KEPT (previously
          // the base-point override discarded it, so defenders ignored a
          // player standing right on their pad). Outside the radius the
          // target is dropped so they don't chase across the map.
          const guardR2 = 560*560;
          if (target && dist2(target.x, target.y, myBase.x, myBase.y) > guardR2){ target = null; targetKind = null; }
          if (!target){
            const inBase = dist2(b.x, b.y, myBase.x, myBase.y) < myBase.r * myBase.r;
            if (inBase){
              const pa = (performance.now()/1000 * 0.5 + (b.id ? b.id.length : 0)) % (Math.PI * 2);
              target = { x: myBase.x + Math.cos(pa) * myBase.r * 0.85, y: myBase.y + Math.sin(pa) * myBase.r * 0.85 };
              targetKind = 'ctf'; bestD2 = dist2(target.x, target.y, b.x, b.y);
            } else {
              target = myBase; targetKind = 'ctf'; bestD2 = dist2(myBase.x, myBase.y, b.x, b.y);
            }
          }
        } else if (b.role === 'flanker'){
          // Approach the enemy flag via a map-edge waypoint so flankers hit
          // the enemy base from the side, not head-on down the lane.
          if (!b._flankWP){
            const side = b._flankSide || (b._flankSide = (Math.random() < 0.5 ? -1 : 1));
            b._flankWP = { x: enemyFlag.x, y: Math.max(120, Math.min(world.h - 120, enemyFlag.y + side * 300)) };
          }
          const wp = b._flankWP;
          const dWp = dist2(b.x, b.y, wp.x, wp.y);
          if (dWp > 220*220){
            if (!target || dWp < bestD2 * 1.4){ target = wp; targetKind = 'ctf'; bestD2 = dWp; }
          } else {
            if (!target || dist2(enemyFlag.x, enemyFlag.y, b.x, b.y) < bestD2 * 1.4){ target = enemyFlag; targetKind = 'ctf'; bestD2 = dist2(enemyFlag.x, enemyFlag.y, b.x, b.y); }
          }
        } else {
          // attacker + rusher: push the enemy flag (rushers dash more, below).
          if (!target || dist2(enemyFlag.x, enemyFlag.y, b.x, b.y) < bestD2 * 1.4){ target = enemyFlag; targetKind = 'ctf'; bestD2 = dist2(enemyFlag.x, enemyFlag.y, b.x, b.y); }
        }
      }
    }

    // ---- team coordination: assist a teammate who's already fighting ----
    // Bots "sometimes" (70%) rally to a teammate's fight instead of always
    // piling on, so the squad doesn't read as one hive mind.
    if (!target){
      for (const ally of SP_BOTS){
        if (ally === b || ally.hp <= 0 || ally.team !== b.team) continue;
        if (!ally.target) continue;
        const dAlly = dist2(ally.x, ally.y, b.x, b.y);
        if (dAlly < 900*900 && Math.random() < 0.7){
          target = ally.target;
          targetKind = ally.targetKind;
          break;
        }
      }
    }

    b.target = target;
    b.targetKind = targetKind;

    // ==========================================================
    // DEATH ZONE — figure out (once per bot per tick) whether this bot
    // needs to be heading back toward the safe circle at all.
    // ==========================================================
    const zoneFlee = zoneFleeTarget(b, zone);

    // ==========================================================
    // DEATH ZONE (urgent) — actively taking storm damage right now. This
    // beats everything else, including a fight in progress: trading shots
    // while the zone ticks you down on top of it is a losing move, so run
    // for the circle first and only take free shots along the way.
    // ==========================================================
    if (zoneFlee && zoneFlee.urgent && !(b.seekingChest && b._commitOut && b.hp > (b.hpMax || 100) * 0.3)){
      if (b.seekingChest && b.chestTarget){ botBanChest(b, b.chestTarget, 15); b.seekingChest = false; b.chestTarget = null; b._commitOut = false; }   // don't bounce back to it
      const dx = zoneFlee.x - b.x, dy = zoneFlee.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (b.dashCD <= 0 && Math.random() < 0.35){
        botDash(b, weapons, world, dx/d, dy/d);
      }
      const want = Math.atan2(dy, dx);
      b.ang = lerpAngle(b.ang || 0, want, 0.12);
      const steered = steerDir(b, world, dx/d, dy/d);
      moveWithCollide(b, steered.x * b.speed * speedMul * dt, steered.y * b.speed * speedMul * dt);
      applyBotHazards(b, world, dt);
      if (target && Math.hypot(target.x - b.x, target.y - b.y) < 300){
        botFire(b, weapons, target, targetKind);
      }
      continue;
    }

    // ==========================================================
    // LOW HP — retreat toward the player's general area (safety in numbers)
    // ==========================================================
    if (b.hp < 28 && target){
      const distToTarget = Math.hypot(target.x - b.x, target.y - b.y);
      if (distToTarget < 260 && b.dashCD <= 0){
        const dx = b.x - target.x, dy = b.y - target.y;
        const d = Math.hypot(dx, dy) || 1;
        botDash(b, weapons, world, dx/d, dy/d);
      }
      let awayX = b.x - target.x, awayY = b.y - target.y;
      const awayLen = Math.hypot(awayX, awayY) || 1;
      awayX /= awayLen; awayY /= awayLen;
      // Don't retreat straight out of the safe circle just to put distance
      // between itself and its attacker.
      if (zoneFlee){
        const zx = zoneFlee.x - b.x, zy = zoneFlee.y - b.y;
        const zd = Math.hypot(zx, zy) || 1;
        awayX = awayX * 0.6 + (zx / zd) * 0.4;
        awayY = awayY * 0.6 + (zy / zd) * 0.4;
        const aLen = Math.hypot(awayX, awayY) || 1;
        awayX /= aLen; awayY /= aLen;
      }
      const want = Math.atan2(awayY, awayX);
      b.ang = lerpAngle(b.ang || 0, want, 0.08);
      const steered = steerDir(b, world, Math.cos(b.ang), Math.sin(b.ang));
      moveWithCollide(b, steered.x * b.speed * speedMul * dt, steered.y * b.speed * speedMul * dt);
      applyBotHazards(b, world, dt);
      continue;
    }

    // ==========================================================
    // CHEST LOOTING (no fight to focus on)
    // ==========================================================
    if (!target){
      if (b.seekingChest && b.chestTarget && b.chestTarget.opened){ b.seekingChest = false; b.chestTarget = null; b._commitOut = false; }
      if (!b.seekingChest && world && Math.random() < 0.02){
        const found = findLootableChest(world, b, zone);
        if (found){ b.seekingChest = true; b.chestTarget = found.chest; b._commitOut = found.risk > 0; b._chestStart = performance.now(); b._pathFailN = 0; }
      }
    } else if (b.seekingChest){
      // combat normally wins, but a bot already right beside a chest it committed to keeps going for it while shooting
      const nearChest = b.chestTarget && Math.hypot(b.chestTarget.x - b.x, b.chestTarget.y - b.y) < 160 && Math.abs((b.chestTarget.z || 0) - (b.z || 0)) < 50;
      if (!(b._commitOut && nearChest && b.hp > (b.hpMax || 100) * 0.4)){
        // abandon this chest for a few seconds so we don't immediately re-pick it
        // next tick and stall between "loot it" and "fight the nearby enemy"
        if (b.chestTarget) botBanChest(b, b.chestTarget, 6);
        b.seekingChest = false; b._commitOut = false; b.chestTarget = null;
      }
    }

    if (b.seekingChest && b.chestTarget && world){
      const ch = b.chestTarget, cz = ch.z || 0;
      const tooLong = (performance.now() - (b._chestStart || 0)) > 45000;
      const hurt = b._commitOut && b.hp < (b.hpMax || 100) * 0.3;
      if (tooLong || hurt){ botBanChest(b, ch, hurt ? 20 : 12); b.seekingChest = false; b.chestTarget = null; b._commitOut = false; }
      else {
        // Follow a real route to the chest: through the door, up the stairs, over the bridge — not a straight line into a wall.
        let dir = botNavSteer(b, ch.x, ch.y, cz, dt);
        if (!dir && botNavOK()){
          b._pathFailN = (b._pathFailN || 0) + 1;                                   // no route: give up on this chest for a while
          if (b._pathFailN > 2){ botBanChest(b, ch, 30); b.seekingChest = false; b.chestTarget = null; b._commitOut = false; }
        } else if (!dir){                                                           // no 3D data: plain steering
          const dx = ch.x - b.x, dy = ch.y - b.y, d = Math.hypot(dx, dy) || 1, st = steerDir(b, world, dx / d, dy / d); dir = { x: st.x, y: st.y };
        }
        if (b.seekingChest && dir){
          moveWithCollide(b, dir.x * b.speed * speedMul * dt, dir.y * b.speed * speedMul * dt);
          const hm = Math.hypot(dir.x, dir.y);
          if (target && Math.hypot(target.x - b.x, target.y - b.y) < 320){ b.ang = lerpAngle(b.ang || 0, angleTo(b.x, b.y, target.x, target.y), 0.2); botFire(b, weapons, target, targetKind); }
          else if (hm > 0.01) b.ang = lerpAngle(b.ang || 0, Math.atan2(dir.y, dir.x), 0.15);
          if (Math.hypot(ch.x - b.x, ch.y - b.y) < b.r + (ch.r || 16) + 10 && Math.abs((b.z || 0) - cz) < 50){
            if (ENV.openChest) ENV.openChest(ch);
            b.seekingChest = false; b.chestTarget = null; b._commitOut = false;
          }
        }
        applyBotHazards(b, world, dt);
        if (b.seekingChest) continue;
      }
    }

    // ==========================================================
    // STATE DECISION
    // ==========================================================
    b.decisionCD -= dt;
    if (b.decisionCD <= 0){
      b.decisionCD = 0.25 + Math.random() * 0.25;

      if (!target){
        b.state = "wander";
      } else {
        chooseBotWeapon(b, weapons, Math.hypot(target.x - b.x, target.y - b.y));
        const w = weapons[b.weapon];
        const ideal = (w.kind === 'shotgun') ? 130 : (w.kind === 'rifle') ? 380 : 260;
        const d = Math.hypot(target.x - b.x, target.y - b.y);

        if (d > ideal * 1.4) b.state = ((b.z || 0) > 60) ? "attack" : "chase";   // on high ground: stay and shoot, don't run down
        else if (d < ideal * 0.55 && w.kind !== 'shotgun') b.state = "evade";
        else b.state = "attack";
      }
    }

    // ==========================================================
    // MOVEMENT
    // ==========================================================
    if (target){
      const dx = target.x - b.x;
      const dy = target.y - b.y;
      const d = Math.hypot(dx, dy) || 1;

      let moveX = dx / d, moveY = dy / d;

      if (b.state === "evade"){
        moveX *= -0.6; moveY *= -0.6;
        moveX += (-moveY) * b.side * 0.8;
        moveY += ( moveX) * b.side * 0.8;
      } else if (b.state === "attack"){
        // strafe around the target instead of walking straight at it
        const strafeX = -moveY, strafeY = moveX;
        moveX = moveX * 0.25 + strafeX * b.side * 0.6;
        moveY = moveY * 0.25 + strafeY * b.side * 0.6;
      }
      // "chase" keeps the raw direction toward the target

      // Death-zone pull: near (but not yet past) the safe line, drift the
      // fight back toward the circle instead of trading shots right at the
      // edge — not a full panic like the "urgent" case above, just a bias.
      if (zoneFlee){
        const zx = zoneFlee.x - b.x, zy = zoneFlee.y - b.y;
        const zd = Math.hypot(zx, zy) || 1;
        const pull = 0.4;
        moveX = moveX * (1 - pull) + (zx / zd) * pull;
        moveY = moveY * (1 - pull) + (zy / zd) * pull;
        const mLen = Math.hypot(moveX, moveY) || 1;
        moveX /= mLen; moveY /= mLen;
      }

      const len = Math.hypot(moveX, moveY) || 1;
      moveX /= len; moveY /= len;

      const av = hazardAvoidBias(b, world, moveX, moveY);
      const steered = steerDir(b, world, av.x, av.y);

      const steps = 4, hm2 = ((b.z || 0) > 60) ? 0.45 : 1;     // up high a bot shuffles at its window instead of roaming
      for (let i = 0; i < steps; i++){
        moveWithCollide(b, (steered.x * b.speed * speedMul * hm2 * dt) / steps, (steered.y * b.speed * speedMul * hm2 * dt) / steps);
      }

      // ---- strategic dash: close distance when chasing a kiting target ----
      // Rushers commit harder — they dash ~3x as often to close on the enemy.
      if (b.state === "chase" && d > 420 && b.dashCD <= 0 && Math.random() < (b.role === 'rusher' ? 0.06 : 0.02) &&
          !(world && world.isBlocked && world.isBlocked(b.x + (dx/d)*200, b.y + (dy/d)*200, b.r))){
        botDash(b, weapons, world, dx/d, dy/d);
      }

      applyBotHazards(b, world, dt);

      // Lead the target only some of the time: each bot re-rolls every ~1-2 s whether it is predicting or just aiming at where you are.
      b._leadT = (b._leadT || 0) - dt;
      if (b._leadT <= 0){ b._leadT = 0.8 + Math.random() * 1.2; b._leadOn = Math.random() < (b.leadSkill ?? 0.4); }
      let aim = b._leadOn ? aimPredict(b, target, weapons[b.weapon] ? weapons[b.weapon].speed : 900) : angleTo(b.x, b.y, target.x, target.y);
      aim += (Math.random() - 0.5) * (b._leadOn ? 0.08 : 0.14);
      b.ang = lerpAngle(b.ang || 0, aim, 0.18);
    } else {
      applyBotHazards(b, world, dt);
    }

    // ==========================================================
    // SHOOTING
    // ==========================================================
    if (target){
      botFire(b, weapons, target, targetKind);
    }

    // ==========================================================
    // DODGE — evasive dash/strafe away from a close incoming bullet.
    // Checks both ents.ebullets (monster/other-bot fire) AND ents.bullets
    // (the actual player's gunfire) — previously bots only ever reacted to
    // ebullets, so a player's own shots walked straight through them.
    // ==========================================================
    b.dodgeCD -= dt;
    if (b.dodgeCD <= 0){
      let threat = null, threatD2 = Infinity;
      const scanForThreat = (list, isOwnList) => {
        if (!list) return;
        for (const proj of list){
          if (!proj) continue;
          if (isOwnList && proj.fromBot === b.id) continue; // ignore our own shots
          const vx = proj.vx || 0, vy = proj.vy || 0;
          const dx = b.x - proj.x, dy = b.y - proj.y;
          const d2raw = dx*dx + dy*dy;
          if (d2raw > 260*260) continue;
          const spd2 = vx*vx + vy*vy;
          if (spd2 < 1) continue;
          // time (seconds) until this bullet's closest approach to us
          const t = -(dx*vx + dy*vy) / spd2;
          if (t < 0 || t > 0.5) continue;
          const cx = proj.x + vx*t, cy = proj.y + vy*t;
          const missDx = b.x - cx, missDy = b.y - cy;
          const dangerR = (b.r || 16) + 50;
          if (missDx*missDx + missDy*missDy > dangerR*dangerR) continue;
          if (d2raw < threatD2){ threatD2 = d2raw; threat = proj; }
        }
      };
      scanForThreat(ents.ebullets, true);
      scanForThreat(ents.bullets, false);

      if (threat){
        b.dodgeCD = 0.7 + Math.random() * 0.3;
        if (b.dashCD <= 0 && Math.random() < 0.5){
          const perp = Math.atan2(threat.vy || 0, threat.vx || 0) + Math.PI/2 * (Math.random() < 0.5 ? 1 : -1);
          botDash(b, weapons, world, Math.cos(perp), Math.sin(perp));
        } else {
          b.ang = lerpAngle(b.ang || 0, (b.ang || 0) + Math.PI/2, 0.2);
        }
      }
    }

    // ==========================================================
    // WANDER
    // ==========================================================
    if (!target && !b.seekingChest){
      b.wanderT -= dt;
      if (b.wanderT <= 0){
        b.wanderT = 2 + Math.random() * 2;
        // With nothing to fight and nothing to loot, a bot near the zone
        // edge wanders generally toward safety instead of a pure random
        // heading, same as a player would just walking back in.
        const want = zoneFlee
          ? Math.atan2(zoneFlee.y - b.y, zoneFlee.x - b.x) + (Math.random() - 0.5) * 0.9
          : Math.random() * Math.PI * 2;
        b.ang = lerpAngle(b.ang || 0, want, 0.08);
      }
      const wdir = hazardAvoidBias(b, world, Math.cos(b.ang), Math.sin(b.ang));
      const steered = steerDir(b, world, wdir.x, wdir.y);
      moveWithCollide(b, steered.x * b.speed * 0.6 * speedMul * dt, steered.y * b.speed * 0.6 * speedMul * dt);
    }

    // ==========================================================
    // SEPARATION — stop bots from stacking on top of each
    // other. A small push away from any teammate inside ~38px
    // keeps the squad spread out instead of one clump.
    // ==========================================================
    {
      let sepX = 0, sepY = 0, n = 0;
      for (const o of SP_BOTS){
        if (o === b || o.hp <= 0) continue;
        if (window.TEAMS_MODE && o.team !== b.team) continue;       // only push off teammates in teams mode
        else if (!window.TEAMS_MODE && o.team !== b.team) continue;  // same-team only (co-op is all team 0)
        const dx = b.x - o.x, dy = b.y - o.y, d2 = dx*dx + dy*dy;
        if (d2 > 38*38 || d2 < 1) continue;
        const d = Math.sqrt(d2);
        sepX += (dx / d) * (38 - d); sepY += (dy / d) * (38 - d); n++;
      }
      if (n > 0 && world){
        const st = steerDir(b, world, sepX, sepY);
        moveWithCollide(b, st.x * b.speed * 0.8 * speedMul * dt, st.y * b.speed * 0.8 * speedMul * dt);
      }
    }

    // ==========================================================
    // RELOAD
    // ==========================================================
    const w = weapons[b.weapon];
    if (w){
      if (b.ammo <= 0 && !b.reloading) botTryReload(b, w);
      if (b.reloading){
        b.reloadT -= dt;
        if (b.reloadT <= 0){
          b.reloading = false;
          const need = Math.max(0, Math.min(w.ammo - b.ammo, b.reserve));
          b.ammo += need;
          b.reserve -= need;
        }
      }
      // No passive ammo trickle: bots have a finite reserve and must loot
      // ammo pickups / chests to refill, same as the player.
    }

    // ==========================================================
    // PICKUPS (ammo/health/xp on the ground)
    // ==========================================================
    for (let i = (ents.pickups || []).length - 1; i >= 0; i--){
      const p = ents.pickups[i];
      if ((p.z || 0) > 20) continue;                   // loot dropped on an upper floor
      const dx = p.x - b.x, dy = p.y - b.y;
      const d = Math.hypot(dx, dy);

      // Bots run dry now (no passive ammo), so when low on ammo or health they
      // actively seek out the relevant pickup from farther away — otherwise
      // they only grab one that happens to be right next to them.
      const lowAmmo = (b.ammo + b.reserve) < 40;
      const lowHp = b.hp < (b.hpMax || 100) * 0.5;
      const wantIt = !target && (lowAmmo || lowHp || p.type === 'xp');
      const seekR = (lowAmmo && p.type === 'ammo') ? 460 : (lowHp && p.type === 'health') ? 360 : 200;
      if (d < seekR && wantIt){
        const a = Math.atan2(dy, dx);
        const steered = steerDir(b, world, Math.cos(a), Math.sin(a));
        moveWithCollide(b, steered.x * b.speed * speedMul * dt, steered.y * b.speed * speedMul * dt);
      }

      if (d < 20){
        if (p.type === "xp") b.essence++;
        else if (p.type === "ammo") b.reserve += 20;
        else if (p.type === "health") b.hp = Math.min(b.hpMax, b.hp + 20);
        ents.pickups.splice(i, 1);
      }
    }

    // ==========================================================
    // DEATH CHESTS — bots auto-loot a fallen bot's cache by
    // walking over it (same as the player does), so the loot
    // from kills actually gets collected instead of sitting
    // untouched while bots crowd around fighting.
    // ==========================================================
    if (world.deathChests && ENV.openChest){
      for (let i = world.deathChests.length - 1; i >= 0; i--){
        const ch = world.deathChests[i];
        if (ch.opened) continue;
        const rr = (b.r || 16) + (ch.r || 20) + 6;
        if (dist2(b.x, b.y, ch.x, ch.y) < rr * rr){
          ENV.openChest(ch);
        }
      }
    }
  }

  // ==============================================================
  // BOT BULLETS vs PvE ENEMIES — bot-fired shots (ents.ebullets tagged
  // with fromBot) also need to be able to hurt monsters, not just the
  // player/other bots (that half is handled by pve16.js's own collision
  // loop, which we can't reach from here).
  // ==============================================================
  if (ents.ebullets && ents.enemies && ents.enemies.length){
    for (let i = ents.ebullets.length - 1; i >= 0; i--){
      const eb = ents.ebullets[i];
      if (!eb || !eb.fromBot) continue;

      for (let j = 0; j < ents.enemies.length; j++){
        const e = ents.enemies[j];
        const rr = (e.r || 16) + (eb.r || 4);
        if (dist2(eb.x, eb.y, e.x, e.y) < rr*rr){
          e.hp -= eb.dmg;
          if (eb.ownerRef) applyBotGlyphOnEnemyHit(eb.ownerRef, e);
          if (ENV.addEffect) ENV.addEffect(eb.x, eb.y, 'hit', 0.12, '#fff');

          if (e.hp <= 0){
            if (ENV.dropXpOrb) ENV.dropXpOrb(e.x, e.y, 1);
            ents.enemies.splice(j, 1);
          }
          ents.ebullets.splice(i, 1);
          break;
        }
      }
    }
  }

  for (const b of SP_BOTS) if (b.hp <= 0 && !b._deathHandled){ b._deathHandled = true; if (ENV.onBotDeath) ENV.onBotDeath(b); }   // a fallen bot leaves a cache
  // In teams mode bots revive at their titan (Teams.tick), so keep dead bots
  // in the array — the revive logic resets hp and _deathHandled. Without this
  // the filter would discard them before revive ever ran.
  if (!window.TEAMS_MODE && !window.CTF_MODE) SP_BOTS = SP_BOTS.filter(b => b.hp > 0);
}

// ===== DRAW =====
function drawSPBots(ctx, cam, COLORS, drawDesign, weapons, gunSheets){
  for (const b of SP_BOTS){
    const px = b.x - cam.x - cam.sx;
    const py = b.y - cam.y - cam.sy;

    // Glyph aura — visual tell for the bot's independent glyph path/tier
    if (b.glyphPath){
      const col = glyphColor(b.glyphPath);
      ctx.save();
      ctx.globalAlpha = 0.25 + b.glyphTier * 0.08;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 + b.glyphTier;
      ctx.beginPath();
      ctx.arc(px, py, 26 + b.glyphTier * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(b.ang);

    drawDesign(
      b.design,
      COLORS[b.color].c,
      performance.now() / 1000,
      16
    );

    const w = weapons[b.weapon];
    let img = null;
    if (w){
      if (w.kind === 'pistol')  img = gunSheets.pistols[b.guns.pistol];
      if (w.kind === 'rifle')   img = gunSheets.rifles[b.guns.rifle];
      if (w.kind === 'shotgun') img = gunSheets.shotguns[b.guns.shotgun];
    }
    if (img) ctx.drawImage(img, 14, -6, 36, 24);

    ctx.restore();

    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.arc(px, py, 22, 0, Math.PI*2);
    ctx.stroke();

    ctx.strokeStyle = (b.hp / b.hpMax) > 0.3 ? "#66ff66" : "#ff6666";
    ctx.beginPath();
    ctx.arc(px, py, 22, -Math.PI/2, -Math.PI/2 + (b.hp/b.hpMax)*Math.PI*2);
    ctx.stroke();

    if (b.reloading){
      ctx.fillStyle = "#ffd76a";
      ctx.beginPath();
      ctx.arc(px, py - 30, 3, 0, Math.PI*2);
      ctx.fill();
    }

    // Teams mode: a tall team-coloured pennant on a thin pole that bobs
    // above the bot's head — big and bright enough to read as a "mark"
    // tracking each unit across the arena, not a tiny diamond you lose
    // in the clutter.
    if (window.TEAMS_MODE && window.Teams) {
      const tc = window.Teams.teamColor(b.team);
      const t = performance.now() / 1000;
      const bob = Math.sin(t * 3 + (b.id || '').length) * 2.5;
      const sway = Math.sin(t * 2 + (b.id || '').length) * 3;
      const poleTop = py - 46 + bob;
      ctx.save();
      // pole
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - 20); ctx.lineTo(px, poleTop + 4); ctx.stroke();
      // glowing pennant (follows the bot — anchored to its head position)
      ctx.globalAlpha = 1;
      ctx.fillStyle = tc;
      ctx.shadowColor = tc; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(px, poleTop);
      ctx.lineTo(px + 20 + sway, poleTop + 6);
      ctx.lineTo(px, poleTop + 13);
      ctx.lineTo(px - 2, poleTop + 6);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2;
      ctx.stroke();
      // team letter
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.team === 0 ? 'B' : 'R', px + 7, poleTop + 6.5);
      ctx.restore();
    }
  }
}
