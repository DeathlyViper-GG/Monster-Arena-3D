'use strict';

/*
 HTTP-only authoritative game server
 - NO WebSockets
 - Long-poll snapshots
 - PvE + PvP
*/

import express from "express";
import {
  initBots, updateBots, bakeBotsSnapshot,
  attachHazards, applyEnemyHazards,
  isTeamMode, pickTeam, fillTeamsWithBots, initTeamMatch,
  tickTeamMatch, resolveTeamBullets, bakeTeamSnapshot, bakeTeamBots,
  PVE_POINTS, INTERP_DELAY, CONTACT_LAG_MS, pvePointsForType, recordEnemyHist,
  LOOT_TYPES, spawnEnemyLoot, spawnXpOrbs, lootCountByEnemy, enemyPosAtTime, awardPvEPoint
} from "./bots.js";
import { GLYPH_KEYS, makeGlyphState, tickEnemyGlyphStatus, glyphMoveMul, applyGlyphHit, applyGlyphKill, thornmailReflect } from "./glyph.js";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors());
app.use(express.json());
// --- sanity/version endpoint (proves which code is deployed) ---
app.get('/__version', (req, res) => {
  res.json({ ok: true, file: 'signaling_http.js', t: Date.now() });
});

// --- make it obvious if client accidentally GETs these ---
app.get('/player/design', (req, res) => res.status(405).json({ ok:false, error:'POST only' }));
app.get('/player/color',  (req, res) => res.status(405).json({ ok:false, error:'POST only' }));
app.get('/player/guns',   (req, res) => res.status(405).json({ ok:false, error:'POST only' }));

// --- required: design endpoint (prevents 404 + enables appearance sync) ---
// ✅ SERVE THE GAME CLIENT

const TICK_MS = 50; // 100Hz
const LOBBY_INTERVAL = 10_000;
const WORLD = { w: 4000, h: 2800 };
const DISCONNECT_TIMEOUT = 1_000; // 0.1 seconds
// ============================
// TEST FLAGS (easy to revert)
// ============================
const TEST_FORCE_BOSS3 = false; // ✅ set false to restore normal behaviour
// ✅ Long-poll waiters per lobby
const POLL_TIMEOUT_MS = 25_000;
const WAITERS = new Map(); // lobbyId -> Set({ res, worldKey })
// structuredClone is not available on some Node runtimes (Render)
// Use a safe JSON clone for snapshots (snapshots contain only plain data)
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

function addWaiter(lobbyId, res, worldKey = '') {
  if (!WAITERS.has(lobbyId)) WAITERS.set(lobbyId, new Set());
  const entry = { res, worldKey: String(worldKey ?? '') };
  WAITERS.get(lobbyId).add(entry);

  res.on('close', () => {
    const set = WAITERS.get(lobbyId);
    if (!set) return;
    for (const it of set) {
      if (it.res === res) { set.delete(it); break; }
    }
  });
}

function flushWaiters(lobby) {
  const set = WAITERS.get(lobby.id);
  if (!set || set.size === 0) return;

  for (const { res, worldKey } of set) {
    try {
      const snap = deepClone(lobby.snapshot);

      snap.meta = snap.meta ?? {};
      snap.meta.worldKey = String(lobby.worldKey ?? '');
      snap.meta.chestVer = Number(lobby.chestVer ?? 0);

      // ✅ If this waiter doesn't have the current worldKey, force full world
      if (worldKey !== String(lobby.worldKey ?? '')) {
        snap.world = worldDelta(lobby, true);
      } else {
        snap.world = worldDelta(lobby, false);
      }

      res.json(snap);
    } catch {}
  }
  set.clear();
}
const slotNow = () => Math.floor(now() / LOBBY_INTERVAL);
const slotEndMs = (slot) => (slot + 1) * LOBBY_INTERVAL;
// -----------------------------------------------------------------------------
// Combat tuning (authoritative)
// -----------------------------------------------------------------------------
const PLAYER_SPEED = 240;

// Bullet speeds
const SPD_SHOOTER = 480;
const SPD_SNIPER  = 760;     // faster than shooter
const SPD_BOMB    = 260;     // ~half speed of bullets

// Lifetimes (range control)
const LIFE_SHOOTER = 1.6;    // ~832px at 520
const LIFE_SNIPER  = 2.0;    // ~1520px at 760 (longer, but not infinite)
const LIFE_BOMB    = 0.9;    // ~234px at 260 (short)

// Damage
const DMG_SHOOTER = 8;
const DMG_SNIPER  = 14;      // slightly more
const DMG_BOMB    = 24;      // higher than bullets
const SPLASH_BOMB = 140;     // splash radius

// Healer aura
const HEAL_AURA_R   = 260;
const HEAL_PER_SEC  = 10;

// ============================
// Boss v3 – telegraphed bomb
// ============================
const BOSS3_FIRE_INTERVAL = 2.0;   // one attack every 2 seconds
const BOSS3_WARN_TIME     = 0.5;   // half‑second ground warning
const BOSS3_BLAST_R       = 96;    // 3× player width (player width ~32)
const BOSS3_BOMB_SPEED   = 420;   // travel speed of the bomb
const BOSS3_MAX_TRAVEL   = 320;   // short travel distance cap (px)

// ✅ PvE point table (server authoritative)
// -----------------------------------------------------------------------------
// Difficulty scaling helpers
// -----------------------------------------------------------------------------
function clampInt(v, a, b){ return Math.max(a, Math.min(b, v|0)); }

function aiTierForWave(w){
  // 0: dumb chase, no strafe, no lead
  // 1: shooter strafe + bomber spacing
  // 2: sniper lead + ravener door-block + stronger coordination
  // 3: healer regroup logic + advanced coordination
  if (w < 4) return 0;
  if (w < 8) return 1;
  if (w < 12) return 2;
  return 3;
}

function removeDeadPlayers(lobby){
  for (const [pid, p] of lobby.players){
    if ((p.hp ?? 0) <= 0){
      lobby.players.delete(pid);
      lobby.inputs.delete(pid); // safety
    }
  }
}

function enemyCountForWave(w){
  // Starts small, ramps up, caps at 30
  // wave1=6, wave2~8, wave3~10, wave6~18, wave10~28, wave11+=30 cap
  const n = 6 + Math.floor(w * 2.2);
  return clampInt(n, 6, 30);
}

function weightedPick(weights){
  // weights: { type: weight, ... }
  let total = 0;
  for (const k in weights) total += Math.max(0, weights[k] || 0);
  if (total <= 0) return 'chaser';
  let r = Math.random() * total;
  for (const k in weights){
    r -= Math.max(0, weights[k] || 0);
    if (r <= 0) return k;
  }
  return Object.keys(weights)[0] || 'chaser';
}

// -----------------------------------------------------------------------------
// Hazard helpers (SERVER-SIDE) — applied to enemies too.
// They live in hazards.js; the helpers they need are injected after the shared
// world/collision helpers below (see attachHazards()).
// -----------------------------------------------------------------------------

function weightsForWave(w){
  // Difficulty composition curve
  // Keep raveners common, introduce specials gradually, higher waves mix high tiers.
  const weights = { chaser: 10, tank: 0, shooter: 0, bomber: 0, sniper: 0, healer: 0 };

  if (w >= 2) weights.tank = 2;
  if (w >= 3) weights.tank = 3;

  if (w >= 4) weights.shooter = 2;
  if (w >= 6) weights.shooter = 3;

  if (w >= 6) weights.bomber = 1;
  if (w >= 8) weights.bomber = 2;

  if (w >= 8) weights.sniper = 1;
  if (w >= 10) weights.sniper = 2;

  if (w >= 10) weights.healer = 1;
  if (w >= 14) weights.healer = 2;

  // Raveners still exist but proportionally less later
  if (w >= 10) weights.chaser = 9;
  if (w >= 14) weights.chaser = 8;
  if (w >= 18) weights.chaser = 7;

  return weights;
}

// -----------------------------------------------------------------------------
// Building/door helpers (for door blocking behaviour)
// -----------------------------------------------------------------------------
function pointInRect(px, py, r){
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function buildingAt(buildings, x, y){
  for (const b of buildings || []){
    if (b && b.inner && pointInRect(x, y, b.inner)) return b;
  }
  return null;
}

function doorCenters(b){
  const out = [];
  for (const d of (b?.doors || [])){
    out.push({ x: d.x + d.w/2, y: d.y + d.h/2 });
  }
  return out;
}

function nearestDoorPoint(b, x, y){
  let best = null, bestD2 = Infinity;
  for (const p of doorCenters(b)){
    const d2 = dist2(x, y, p.x, p.y);
    if (d2 < bestD2){ bestD2 = d2; best = p; }
  }
  return best;
}

// Contact DPS (chip vs heavy)
function touchDps(type, bossVariant=0){
  if (type === 'tank') return 42;            // lots
  if (type === 'chaser') return 9;           // chip
  if (type === 'boss') {
    if (bossVariant === 2) return 16;        // wave10 runner: not huge
    return 30;
  }
  if (type === 'bomber') return 12;
  if (type === 'sniper') return 8;
  if (type === 'shooter') return 10;
  if (type === 'healer') return 6;
  return 10;
}

// -----------------------------------------------------------------------------
// Player HP helpers (server authoritative)
// -----------------------------------------------------------------------------
function clampHp(p){
  p.hp = Math.max(0, Math.min(p.hpMax ?? 100, p.hp ?? 100));
}

function applyPlayerDamage(lobby, playerId, dmg){
  const p = lobby.players.get(playerId);
  if (!p) return;
  p.hp = (p.hp ?? 100) - dmg;
  clampHp(p);
}
function handlePvPPlayerBulletHits(lobby, b, bulletIndex){
  if (lobby.mode !== 'pvp') return false;

  if (typeof b.owner !== 'string' || !lobby.players.has(b.owner)) return false;

  const x0 = b._x0 ?? b.x;
  const y0 = b._y0 ?? b.y;

  for (const [pid, p] of lobby.players){
    if (pid === b.owner) continue;

    const rr = (b.r ?? 4) + 16;
    if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, rr)) {
      applyPlayerDamage(lobby, pid, b.dmg ?? 10);
      lobby.bullets.splice(bulletIndex, 1);
      return true;
    }
  }
  return false;
}

function explodeEnemyBomb(lobby, b){
  const splash = (b.splashR ?? SPLASH_BOMB);
  const maxDmg = (b.dmg ?? DMG_BOMB);

  for (const [pid, p] of lobby.players){
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d  = Math.hypot(dx, dy);

    // include player radius (~16) so edge matches what players feel
    const edge = splash + 16;

    if (d <= edge) {
      // falloff: 100% at centre → 25% at edge (still hurts at edge)
      const t = 1 - (d / edge);            // 1..0
      const mult = 0.25 + 0.75 * t;        // 1..0.25
      applyPlayerDamage(lobby, pid, maxDmg * mult);
    }
  }
}

// ✅ WORLD DELTA: only send the full world when it changes (worldKey/chestVer)
function worldDelta(lobby, force = false, clientWorldKey = '') {
  if (!lobby.world) {
    return { walls: [], hazards: [], solids: [], buildings: [], chests: [] };
  }

  const keyNow = `${lobby.worldKey}:${lobby.chestVer ?? 0}`;

  if (force || String(clientWorldKey) !== keyNow) {
    return lobby.world; // ✅ always give full world when client differs
  }

  return null;
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
const now = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// hazard effects live in bots.js helpers — hand them the shared functions
attachHazards({ WORLD, clamp, now, circleRectCollide, moveEnemyWithCollide });
const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
// -----------------------------------------------------------------------------
// Enemy collision helpers (SERVER-SIDE)
// -----------------------------------------------------------------------------

function circleRectCollide(x, y, r, o) {
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  const dx = x - cx;
  const dy = y - cy;
  return (dx * dx + dy * dy) < (r * r);
}

function enemyBlocked(lobby, x, y, r) {
  const walls = lobby.world?.walls || [];
  for (const w of walls) {
    if (circleRectCollide(x, y, r, w)) return true;
  }
  return false;
}
function playerBlocked(lobby, x, y, r) {
  const walls = lobby.world?.walls || [];
  for (const w of walls) {
    if (circleRectCollide(x, y, r, w)) return true;
  }
  return false;
}

function movePlayerWithCollide(lobby, p, dx, dy) {
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i < steps; i++) {
    let nx = p.x + sx;
    if (!playerBlocked(lobby, nx, p.y, 16)) p.x = nx;

    let ny = p.y + sy;
    if (!playerBlocked(lobby, p.x, ny, 16)) p.y = ny;

    p.x = clamp(p.x, 30, WORLD.w - 30);
    p.y = clamp(p.y, 30, WORLD.h - 30);
  }
}

function moveEnemyWithCollide(lobby, e, dx, dy) {
  const dist = Math.hypot(dx, dy);
  const MAX_STEP = 4;
  const steps = Math.max(1, Math.ceil(dist / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i < steps; i++) {
    // X axis
    let nx = e.x + sx;
    if (!enemyBlocked(lobby, nx, e.y, e.r)) e.x = nx;

    // Y axis
    let ny = e.y + sy;
    if (!enemyBlocked(lobby, e.x, ny, e.r)) e.y = ny;

    // bounds each micro-step
    e.x = clamp(e.x, e.r, WORLD.w - e.r);
    e.y = clamp(e.y, e.r, WORLD.h - e.r);
  }
}
// -----------------------------------------------------------------------------
// Bullet collision helpers (SERVER-SIDE)
// -----------------------------------------------------------------------------
function bulletHitsWall(lobby, x, y, r) {
  const walls = lobby.world?.walls || [];
  for (const w of walls) {
    if (circleRectCollide(x, y, r, w)) return true;
  }
  return false;
}

function bulletSegmentHitsWall(lobby, x0, y0, x1, y1, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (bulletHitsWall(lobby, x, y, r)) return true;
  }
  return false;
}
// ✅ Swept circle hit: check bullet segment against a circle (player/enemy)
function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}
const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const makeId = (n = 6) =>
  Math.random().toString(36).slice(2, 2 + n).toUpperCase();

// -----------------------------------------------------------------------------
// Deterministic map generation (SERVER-SIDE)
// Mirrors pve16.js obstacle + hazard generation using seed.
// -----------------------------------------------------------------------------
let _rngSeed = 1 >>> 0;
function srand(seed){ _rngSeed = (seed >>> 0); }
function srandom(){
  _rngSeed = ((_rngSeed * 1664525) + 1013904223) >>> 0;
  return _rngSeed / 0x100000000;
}
const rand = (a,b) => srandom() * (b - a) + a;
const rint = (a,b) => Math.floor(rand(a, b + 1));

function rectOverlap(a, b, pad = 0){
  return !(
    a.x + a.w + pad < b.x ||
    b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y ||
    b.y + b.h + pad < a.y
  );
}

// Same level hazard spec as pve16.js LEVELS
const LEVEL_SPECS = {
  1: { hazards: { kind: 'none', count: 0 } },
  2: { hazards: { kind: 'sand', count: 10 } },
  3: { hazards: { kind: 'ice',  count: 12 } },
  4: { hazards: { kind: 'lava', count: 14 } },
  5: { hazards: { kind: 'void', count: 16 } },
};

// Chest rarity tiers — mirrors client/js/pve16.js CHEST_RARITIES.
const CHEST_RARITY_WEIGHTS = {
  1: [72, 24, 4,  0],
  2: [56, 30, 11, 3],
  3: [40, 32, 20, 8],
  4: [26, 32, 28, 14],
  5: [16, 28, 34, 22],
};
const CHEST_RARITY_KEYS = ['common','rare','epic','legendary'];
function rollChestRarity(levelId, waveBonus = 0){
  const base = CHEST_RARITY_WEIGHTS[levelId] || CHEST_RARITY_WEIGHTS[1];
  const w = base.slice();
  if (waveBonus > 0){
    const shift = Math.min(waveBonus * 1.5, w[0] * 0.6);
    w[0] -= shift; w[2] += shift * 0.5; w[3] += shift * 0.5;
  }
  const total = w[0]+w[1]+w[2]+w[3];
  let r = rand(0, total);
  for (let i=0;i<4;i++){ if (r < w[i]) return CHEST_RARITY_KEYS[i]; r -= w[i]; }
  return 'common';
}
const CHEST_LOOT_TABLE = {
  common:    { n:[2,3], essence:[3,6],   bonusChance:0.00 },
  rare:      { n:[3,4], essence:[6,10],  bonusChance:0.20 },
  epic:      { n:[3,5], essence:[10,16], bonusChance:0.45 },
  legendary: { n:[4,6], essence:[18,28], bonusChance:0.75 },
};
function rollChestDropsForServer(ch){
  const cfg = CHEST_LOOT_TABLE[ch.rarity] || CHEST_LOOT_TABLE.common;
  const types = ['health','speed','shield','ammo'];
  const out = [];
  const n = rint(cfg.n[0], cfg.n[1]);
  for (let i=0;i<n;i++){
    const a = rand(0, Math.PI*2);
    const d = rand(18, 36);
    out.push({ x: ch.x + Math.cos(a)*d, y: ch.y + Math.sin(a)*d, type: types[rint(0, types.length-1)] });
  }
  const ea = rand(0, Math.PI*2), ed = rand(10, 20);
  out.push({ x: ch.x + Math.cos(ea)*ed, y: ch.y + Math.sin(ea)*ed, type:'essence', value: rint(cfg.essence[0], cfg.essence[1]) });
  if (rand(0,1) < cfg.bonusChance){
    const a2 = rand(0, Math.PI*2), d2 = rand(20, 40);
    out.push({ x: ch.x + Math.cos(a2)*d2, y: ch.y + Math.sin(a2)*d2, type: types[rint(0, types.length-1)] });
  }
  return out;
}

function makeDoors(x,y,w,h,t){
  const sides = ['top','bottom','left','right'];
  const doorCount = rint(1,3);
  const doors = [];
  for (let i=0;i<doorCount;i++){
    const side = sides[rint(0,3)];
    const len = rint(54,70);
    if (side === 'top' || side === 'bottom'){
      const px = rint(x + t + 20, x + w - t - 20 - len);
      const py = (side === 'top') ? y : y + h - t;
      doors.push({ side, x:px, y:py, w:len, h:t });
    } else {
      const py = rint(y + t + 20, y + h - t - 20 - len);
      const px = (side === 'left') ? x : x + w - t;
      doors.push({ side, x:px, y:py, w:t, h:len });
    }
  }
  return doors;
}

function rebuildWalls(solids, buildings){
  const walls = [];
  for (const s of solids) walls.push({ x:s.x, y:s.y, w:s.w, h:s.h });

  for (const b of buildings){
    const {x,y,w,h,t,doors} = b;
    const split = (a, len, holes) => {
      let segs = [[a, len]];
      for (const ho of holes){
        const hx = ho.start, hw = ho.len, newSegs = [];
        for (const [sa, sl] of segs){
          const sb = sa + sl, hb = hx + hw;
          if (hb <= sa || sb <= hx){ newSegs.push([sa, sl]); continue; }
          if (hx > sa) newSegs.push([sa, Math.max(0, hx - sa)]);
          if (hb < sb) newSegs.push([hb, Math.max(0, sb - hb)]);
        }
        segs = newSegs.filter(s => s[1] > 0);
      }
      return segs;
    };

    const holesTop  = doors.filter(d=>d.side==='top')   .map(d=>({start:d.x, len:d.w}));
    const holesBot  = doors.filter(d=>d.side==='bottom').map(d=>({start:d.x, len:d.w}));
    const holesLeft = doors.filter(d=>d.side==='left')  .map(d=>({start:d.y, len:d.h}));
    const holesRight= doors.filter(d=>d.side==='right') .map(d=>({start:d.y, len:d.h}));

    for (const [sx, sl] of split(x, w, holesTop))   walls.push({x:sx, y:y,     w:sl, h:t});
    for (const [sx, sl] of split(x, w, holesBot))   walls.push({x:sx, y:y+h-t, w:sl, h:t});
    for (const [sy, sl] of split(y, h, holesLeft))  walls.push({x:x,  y:sy,    w:t,  h:sl});
    for (const [sy, sl] of split(y, h, holesRight)) walls.push({x:x+w-t, y:sy, w:t,  h:sl});
  }
  return walls;
}
function buildChestsForWorld(buildings, hazards, levelId){
  const chests = [];
  const B = buildings.length;
  // Deeper levels dedicate a slightly larger share of buildings to loot.
  const frac = Math.min(0.75, 8/15 + ((levelId||1) - 1) * 0.03);
  const desired = Math.max(0, Math.min(B, Math.round(B * frac)));
  if (desired === 0) return chests;

  // deterministic shuffle of building indices
  const idx = [];
  for (let i=0;i<B;i++) idx.push(i);
  for (let i = idx.length - 1; i > 0; i--){
    const j = rint(0, i);
    const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
  }

  const pad = 28;
  let chestId = 0;

  for (let k=0; k<idx.length && chests.length < desired; k++){
    const bi = idx[k];
    const b = buildings[bi];
    if (!b || !b.inner) continue;

    // find a spot inside inner, avoid hazards
    let placed = false;
    for (let tries=0; tries<50 && !placed; tries++){
      const cx = rand(b.inner.x + pad, b.inner.x + b.inner.w - pad);
      const cy = rand(b.inner.y + pad, b.inner.y + b.inner.h - pad);

      let bad = false;
      for (const h of hazards){
        if (cx > h.x - 20 && cx < h.x + h.w + 20 && cy > h.y - 20 && cy < h.y + h.h + 20){
          bad = true; break;
        }
      }
      if (bad) continue;

      chests.push({
        id: chestId++,
        x: cx,
        y: cy,
        r: 16,
        opened: false,
        buildingIndex: bi,
        drops: null,
        rarity: rollChestRarity(levelId)
      });
      placed = true;
    }
  }

  return chests;
}

function buildWorld(levelId, mapSeed){
  srand(mapSeed);

  const w = WORLD.w, h = WORLD.h;
  const spec = LEVEL_SPECS[levelId] || LEVEL_SPECS[1];

  const solids = [];
  const buildings = [];
  const hazards = [];

  // Match pve16.js parameters
  const PATH_GAP = 44;
  const EDGE_GAP = 40;
  const MAX_TRIES = 120;
  const COUNT = 18 + Math.floor((levelId - 1) * 4);

  // Arena boundary solids (same as pve16.js)
  solids.push({ x:0, y:0, w:w, h:40 });
  solids.push({ x:0, y:h-40, w:w, h:40 });
  solids.push({ x:0, y:0, w:40, h:h });
  solids.push({ x:w-40, y:0, w:40, h:h });

  const avoidOverlap = (rect, pad) => {
    for (const s of solids) if (rectOverlap(rect, s, pad)) return false;
    for (const b of buildings){
      const br = { x:b.x, y:b.y, w:b.w, h:b.h };
      if (rectOverlap(rect, br, pad)) return false;
    }
    return true;
  };

  const randomRect = (wMin, wMax, hMin, hMax) => {
    const rw = rint(wMin, wMax);
    const rh = rint(hMin, hMax);
    const rx = rint(EDGE_GAP, w - EDGE_GAP - rw);
    const ry = rint(EDGE_GAP, h - EDGE_GAP - rh);
    return { x: rx, y: ry, w: rw, h: rh };
  };

  for (let i=0; i<COUNT; i++){
    const wantBuilding = (rand(0,1) < 0.6);
    let placed = false;
    for (let t=0; t<MAX_TRIES && !placed; t++){
      const r = randomRect(
        wantBuilding ? 180 : 160,
        320,
        wantBuilding ? 140 : 120,
        260
      );
      if (!avoidOverlap(r, PATH_GAP)) continue;

      if (wantBuilding){
        const tWall = 18;
        buildings.push({
          x:r.x, y:r.y, w:r.w, h:r.h, t:tWall,
          doors: makeDoors(r.x, r.y, r.w, r.h, tWall),
          inner: { x:r.x+tWall, y:r.y+tWall, w:r.w-2*tWall, h:r.h-2*tWall }
        });
      } else {
        solids.push({ x:r.x, y:r.y, w:r.w, h:r.h });
      }
      placed = true;
    }
  }

  // Clutter pass — small crates/rocks so the arena isn't just a handful of
  // sparse rectangles; density scales with level, matching the client.
  const CLUTTER_GAP = 30;
  const CLUTTER_COUNT = 8 + Math.floor((levelId - 1) * 4);
  for (let i=0; i<CLUTTER_COUNT; i++){
    for (let t=0; t<40; t++){
      const r = randomRect(36, 64, 32, 56);
      if (!avoidOverlap(r, CLUTTER_GAP)) continue;
      solids.push({ x:r.x, y:r.y, w:r.w, h:r.h });
      break;
    }
  }

  const walls = rebuildWalls(solids, buildings);

  // Hazards (same placement logic)
  const kind = spec.hazards.kind;
  const hc = spec.hazards.count || 0;
  if (kind !== 'none'){
    let tries = 0;
    while (hazards.length < hc && tries < hc * 40){
      tries++;
      const hw = rint(140,260), hh = rint(120,220);
      const hx = rint(160, w-160-hw), hy = rint(160, h-160-hh);
      const rect = { x:hx, y:hy, w:hw, h:hh, type:kind };

      // avoid center spawn and walls
      const cx = hx + hw/2, cy = hy + hh/2;
      const dx = cx - w/2, dy = cy - h/2;
      if ((dx*dx + dy*dy) < 600*600) continue;

      let bad = false;
      for (const ww of walls){
        if (rectOverlap(rect, ww, 30)){ bad = true; break; }
      }
      if (bad) continue;
      hazards.push(rect);
    }
  }

  const chests = buildChestsForWorld(buildings, hazards, levelId);
  return { walls, hazards, solids, buildings, chests };
}

function ensureWorldGenerated(lobby){
  // ✅ HARD RULE: generate world ONCE
  if (lobby.world) return;

  const { walls, hazards, solids, buildings, chests } =
    buildWorld(lobby.levelId, lobby.mapSeed);

  lobby.world = { walls, hazards, solids, buildings, chests };
  lobby.worldKey = `${lobby.levelId}:${lobby.mapSeed}`;
  lobby.chestVer = 0;
}

// -----------------------------------------------------------------------------
// Lobby state
// -----------------------------------------------------------------------------
const LOBBIES = new Map(); // id → lobby

function createLobby(mode, startTimeOverride = null) {
  const created = now();
  const startTime = (typeof startTimeOverride === 'number')
    ? startTimeOverride
    : (created + LOBBY_INTERVAL);

  return {
    gamePhase: 'combat',
    glyphTimer: 0,
    id: makeId(),
    mode,
    created,
    startTime,
    started: false,
    // A player-created lobby: joined by sharing its code, started by its host.
    custom: false,
    hostId: null,
    scores: new Map(),

    players: new Map(),
    inputs: new Map(),

    // Teams / Capture the Flag objectives (null until the match starts)
    giants: null,
    golems: [],
    ctf: null,
    winner: null,
    chat: [],

    bullets: [],
    wave: 1,
    enemies: [],
    spawnQueue: [],

    lastTick: created,

    levelId: null,
    mapSeed: null,

    pickups: [],
    pickupSeq: 1,
    pickupVer: 0,

    world: null,
    worldKey: null,
    chestVer: 0,
    worldLocked: false,

    snapshot: {
      t: now(),
      mode,
      wave: 1,
      players: [],
      enemies: [],
      bullets: [],
      pickups: [],
      phase: 'combat',
      glyphTime: 0,
      meta: {
        mode,
        joinDeadline: startTime,
        levelId: null,
        mapSeed: null,
        pickupVer: 0,
        worldKey: null
      }
    }
  };
}

function ensureLobbyForLevel(mode, levelId){
  const t = now();
  const slot = slotNow();
  const deadline = slotEndMs(slot);

  const open = [...LOBBIES.values()]
    .filter(l =>
      l.mode === mode &&          // ✅ strict mode match
      l.levelId === levelId &&
      !l.started &&
      l.startTime === deadline &&
      t < l.startTime
    )
    .sort((a,b) => b.created - a.created)[0];

  if (open) return open;

  // ✅ ALWAYS create a fresh lobby for PvP
  const l = createLobby(mode, deadline);
  l.levelId = levelId;
  l.mapSeed = Math.floor(Math.random() * 2**31);

  ensureWorldGenerated(l);
  Object.freeze(l.world.walls);
  Object.freeze(l.world.hazards);
  Object.freeze(l.world.solids);
  Object.freeze(l.world.buildings);
  console.log(
    '[WORLD CREATED]',
    l.id,
    l.world.walls.length,
    l.world.buildings.length
  );
  LOBBIES.set(l.id, l);
  return l;
}

function placePlayerInLobby(lobby, peerId, name, prevPlayer = null){
  const n = lobby.players.size;
  const R = 120;
  const a = (n * Math.PI * 2) / 8;

  lobby.players.set(peerId, {
    id: peerId,
    name: name || peerId,
    x: WORLD.w / 2 + Math.cos(a) * R,
    y: WORLD.h / 2 + Math.sin(a) * R,
    ang: 0,
    hp: 100,

    // ✅ PRESERVE APPEARANCE
    // ✅ PRESERVE APPEARANCE
    design: prevPlayer?.design ?? 0,
    color:  prevPlayer?.color  ?? 0,

    // ✅ PRESERVE GUN SKINS + CURRENT WEAPON
    guns: prevPlayer?.guns ?? { pistol: -1, rifle: -1, shotgun: -1 },
    weapon: prevPlayer?.weapon ?? 0,

    lastSeen: now()
  });
}

function ensureLobby(mode) {
  const t = now();

  // ✅ pick the newest lobby that is still in its join window
  const open = [...LOBBIES.values()]
    // never drag a stranger into a private (code) lobby
    .filter(l => l.mode === mode && !l.started && !l.custom && t < l.startTime)
    .sort((a, b) => b.created - a.created)[0];

  if (open) return open;

  const l = createLobby(mode);
  LOBBIES.set(l.id, l);
  return l;
}

// -----------------------------------------------------------------------------
// Enemy logic
// -----------------------------------------------------------------------------
function pickType(wave) {
  return weightedPick(weightsForWave(wave));
}

function spawnEnemy(type, x, y, bossVariant = 0) {
  // ✅ clamp boss variant
  const v = Math.max(1, bossVariant | 0);

  const e = {
    id: makeId(8),
    type,
    x, y,
    r: 16,
    hp: 50,
    maxhp: 50,
    speed: 160,
    vx: 0,
    vy: 0,

    // AI state
    fireCD: 0,          // ✅ start ready to fire
    bombCD: 0,          // ✅ start ready to bomb
    strafeDir: (Math.random() < 0.5 ? -1 : 1),
    underFireT: 0,

    // boss
    bossVariant: v
  };

  if (type === 'chaser') {
    e.hp = e.maxhp = 45;
    e.speed = 210;
    e.r = 16;
  }

  if (type === 'tank') {
    e.hp = e.maxhp = 220;
    e.speed = 120;
    e.r = 22;
  }

  if (type === 'shooter') {
    e.hp = e.maxhp = 70;
    e.speed = 150;
    e.r = 15;
    e.fireCD = 0;
  }

  if (type === 'sniper') {
    e.hp = e.maxhp = 60;
    e.speed = 140;
    e.r = 16;
    e.fireCD = 0;
  }

  if (type === 'bomber') {
    e.hp = e.maxhp = 55;
    e.speed = 175;
    e.r = 18;
    e.bombCD = 0;
  }

  if (type === 'healer') {
    e.hp = e.maxhp = 120;
    e.speed = 135;
    e.r = 16;
  }

  // ============================
  // ✅ BOSS VARIANTS
  // ============================
  if (type === 'boss') {
    e.r = 34;
    e.hp = e.maxhp = 900 + v * 250;

    if (v === 1) {                // wave 5: bullet boss
      e.speed = 150;
      e.fireCD = 0;               // fire immediately
      e.bombCD = Infinity;        // never bombs
    }
    else if (v === 2) {           // wave 10: runner
      e.speed = PLAYER_SPEED * 2; // 2x player speed
      e.fireCD = Infinity;        // never fires
      e.bombCD = Infinity;        // never bombs
    }
    else {                        // wave 15+: bomb boss
      e.speed = 110;
      e.fireCD = Infinity;        // never fires
      e.bombCD = 0;               // bomb immediately
    }
  }

  return e;
}

function spawnBlocked(lobby, x, y, r) {
  // blocks if inside any wall segment or hazard rect
  if (enemyBlocked(lobby, x, y, r)) return true;
  const hz = lobby.world?.hazards || [];
  for (const h of hz) {
    if (circleRectCollide(x, y, r, h)) return true;
  }
  return false;
}

function randSpawnPointAwayFromPlayers(lobby, minDist = 520, r = 20) {
  for (let tries = 0; tries < 160; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240);
    const y = 120 + Math.random() * (WORLD.h - 240);

    // away from players
    let ok = true;
    for (const p of lobby.players.values()) {
      if (dist2(x, y, p.x, p.y) < minDist * minDist) { ok = false; break; }
    }
    if (!ok) continue;

    // ✅ avoid walls/buildings/hazards
    if (spawnBlocked(lobby, x, y, r)) continue;

    return { x, y };
  }
  // fallback: try to find any free point
  for (let tries = 0; tries < 400; tries++) {
    const x = 120 + Math.random() * (WORLD.w - 240);
    const y = 120 + Math.random() * (WORLD.h - 240);
    if (!spawnBlocked(lobby, x, y, r)) return { x, y };
  }
  return { x: WORLD.w - 180, y: WORLD.h / 2 };
}
function desiredChestCount(buildings, levelId){
  const B = (buildings || []).length;
  const frac = Math.min(0.75, 8/15 + ((levelId||1) - 1) * 0.03);
  return Math.max(0, Math.min(B, Math.round(B * frac)));
}

function randomPointInInnerAvoidHazards(inner, hazards){
  const pad = 28;
  for (let tries=0; tries<60; tries++){
    const x = rand(inner.x + pad, inner.x + inner.w - pad);
    const y = rand(inner.y + pad, inner.y + inner.h - pad);

    let bad = false;
    for (const h of (hazards || [])){
      if (x > h.x - 20 && x < h.x + h.w + 20 && y > h.y - 20 && y < h.y + h.h + 20){
        bad = true; break;
      }
    }
    if (!bad) return { x, y };
  }
  return null;
}

function topUpChestsForWave(lobby){
  if (!lobby.world) return;

  const buildings = lobby.world.buildings || [];
  const hazards   = lobby.world.hazards || [];
  lobby.world.chests = lobby.world.chests || [];
  const chests = lobby.world.chests;

  const desired = desiredChestCount(buildings, lobby.levelId);
  if (desired <= 0) return;

  // buildings that already have an ACTIVE (unopened) chest
  const activeBuildings = new Set();
  for (const c of chests){
    if (c && c.opened === false) activeBuildings.add(c.buildingIndex);
  }

  let need = desired - activeBuildings.size;
  if (need <= 0) return;

  // candidate buildings: no active chest
  const candidates = [];
  for (let i=0;i<buildings.length;i++){
    const b = buildings[i];
    if (!b || !b.inner) continue;
    if (!activeBuildings.has(i)) candidates.push(i);
  }

  // ✅ deterministic shuffle (use rint, not Math.random)
  for (let i=candidates.length-1; i>0; i--){
    const j = rint(0, i);
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  // reuse opened chests if possible, else create new
  const reusable = chests.filter(c => c && c.opened === true);
  let nextId = chests.reduce((m,c)=>Math.max(m, (c && typeof c.id==='number') ? c.id : -1), -1) + 1;

  for (let k=0; k<candidates.length && need>0; k++){
    const bi = candidates[k];
    const b = buildings[bi];

    const pos = randomPointInInnerAvoidHazards(b.inner, hazards);
    if (!pos) continue;

    let chest = reusable.pop();
    if (!chest){
      chest = { id: nextId++ };
      chests.push(chest);
    }

    chest.x = pos.x;
    chest.y = pos.y;
    chest.r = 16;
    chest.opened = false;
    chest.buildingIndex = bi;
    chest.drops = null;
    chest.rarity = rollChestRarity(lobby.levelId, lobby.wave || 0);

    need--;
  }
}

function startWave(lobby, n) {
  lobby.wave = n;

  // ✅ ENSURE chests exist even on wave 1 multiplayer
  if (!lobby.world?.chests || lobby.world.chests.length === 0) {
    topUpChestsForWave(lobby);
    lobby.chestVer++;
  }
  lobby.wave = n;

  // ✅ HARD RESET: retire ALL chests so every wave is a fresh spawn set
  if (lobby.world) {
    lobby.world.chests = lobby.world.chests || [];
    for (const c of lobby.world.chests) {
      if (!c) continue;
      c.opened = true;   // make reusable
      c.drops  = null;
    }
  }

  // ✅ Refill chests for this wave (fresh unopened set)
  topUpChestsForWave(lobby);

  // ✅ ALWAYS bump chestVer so clients refresh world+chests every wave
  lobby.chestVer = (lobby.chestVer || 0) + 1;

  // --- existing wave init logic ---
  lobby.spawnQueue = [];
  lobby.nextWaveT = 2.0;

  // ✅ TEST MODE: bosses every wave, but only ONE boss at a time
  // ✅ prevents old v1 bullet bosses from continuing to shoot
  lobby.enemies = lobby.enemies.filter(e => e.type !== 'boss');

  // ✅ optional but VERY helpful: clear existing enemy bullets
  lobby.bullets = lobby.bullets.filter(
    b => !(typeof b.owner === 'string' && b.owner.startsWith('E:'))
  );

  // ✅ Boss schedule restored:
  // wave 5  → variant 1
  // wave 10 → variant 2
  // wave 15 → variant 3
  let bossVariant = 0;

  if (n === 5)  bossVariant = 1;
  if (n === 10) bossVariant = 2;
  if (n === 15) bossVariant = 3;

  if (bossVariant > 0) {
    const p = randSpawnPointAwayFromPlayers(lobby, 720, 34);
    lobby.spawnQueue.push({
      t: 1.0,
      type: 'boss',
      x: p.x,
      y: p.y,
      bossVariant
    });
  }

  const count = enemyCountForWave(n);
  for (let i = 0; i < count; i++) {
    const type = pickType(n);
    const r = (type === 'tank') ? 22 : (type === 'boss') ? 34 : 20;
    const p = randSpawnPointAwayFromPlayers(lobby, 520, r);

    lobby.spawnQueue.push({
      t: 0.5 + Math.random() * 8.0,
      type,
      x: p.x,
      y: p.y,
      wave: n
    });
  }

  lobby.spawnQueue.sort((a, b) => a.t - b.t);
}

function enemyAI(lobby, e, dt) {
  // ✅ glyph stun (Lightning "Overload") freezes the enemy entirely
  if ((e._stunT ?? 0) > 0) return;

  // pick nearest player
  let tgt = null;
  let best = Infinity;
  for (const p of lobby.players.values()) {
    const d = dist2(e.x, e.y, p.x, p.y);
    if (d < best) { best = d; tgt = p; }
  }
  if (!tgt) return;

  const dx = tgt.x - e.x;
  const dy = tgt.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const baseAng = Math.atan2(dy, dx);

  e.fireCD = Math.max(0, (e.fireCD ?? 0) - dt);
  e.bombCD = Math.max(0, (e.bombCD ?? 0) - dt);
  const wave = lobby.wave || (e.spawnWave || 1);
  const tier = aiTierForWave(wave);

  // Is player currently shooting? (set by /shoot)
  const nowT = now();
  const playerShooting = (tgt.lastShotAt && (nowT - tgt.lastShotAt) < 260);

  // Under fire behaviour timer (snipers)
  if (playerShooting && dist < 900) e.underFireT = 0.7;
  e.underFireT = Math.max(0, (e.underFireT ?? 0) - dt);
  const underFire = (e.underFireT ?? 0) > 0;

  // Find healer for regroup behaviour
  let healer = null;
  if (e.type !== 'healer') healer = lobby.enemies.find(x => x.type === 'healer');

  // Default move
  let moveAng = baseAng;
  let moveMul = 1;

  // =================================================
  // ✅ BOSS VARIANTS MUST RUN BEFORE EARLY FALLTHROUGHS
  // =================================================
  if (e.type === 'boss') {
    const v = e.bossVariant || 1;

    if (v === 1) {
      // Wave 5 – fast bullet boss
      if ((e.fireCD ?? 0) <= 0) {
        const a = baseAng + (Math.random() * 2 - 1) * 0.10;

        lobby.bullets.push({
          owner: `E:${e.id}`,
          kind: 'enemy',
          x: e.x + Math.cos(a) * (e.r + 10),
          y: e.y + Math.sin(a) * (e.r + 10),
          vx: Math.cos(a) * 1050,
          vy: Math.sin(a) * 1050,
          r: 4,
          dmg: 2,
          life: 1.1
        });

        e.fireCD = 0.33;
      }
    }

    else if (v === 2) {
      // Wave 10 – runner
      // No bullets; speed already set to 2x player
    }

    else if (v === 3) {
      // ✅ Wave 3 – telegraphed bomb boss

      e.bombCD = (e.bombCD ?? 0) - dt;

      if (e.bombCD <= 0) {
        // pick a destination near the player
        let tx = tgt.x + (Math.random() * 2 - 1) * 120;
        let ty = tgt.y + (Math.random() * 2 - 1) * 120;

        // ✅ clamp target to short travel distance from the boss
        {
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d  = Math.hypot(dx, dy) || 1;
          if (d > BOSS3_MAX_TRAVEL) {
            const s = BOSS3_MAX_TRAVEL / d;
            tx = e.x + dx * s;
            ty = e.y + dy * s;
          }
        }

        const a = angleTo(e.x, e.y, tx, ty);

        lobby.bullets.push({
          owner: `E:${e.id}`,
          kind: 'enemyBomb',

          // spawn position
          x: e.x + Math.cos(a) * (e.r + 12),
          y: e.y + Math.sin(a) * (e.r + 12),

          // movement
          vx: Math.cos(a) * BOSS3_BOMB_SPEED,
          vy: Math.sin(a) * BOSS3_BOMB_SPEED,

          r: 9,
          life: 2.0, // ✅ prevents NaN life + ensures it survives to explode

          // destination
          targetX: tx,
          targetY: ty,

          // telegraph + explosion data
          warnT: BOSS3_WARN_TIME,
          splashR: BOSS3_BLAST_R,
          dmg: 48
        });

        e.bombCD = BOSS3_FIRE_INTERVAL;
      }
    }
  }

  // ============================
  // HEALER: center + aura heal
  // ============================
  if (e.type === 'healer') {
    const cx = WORLD.w / 2, cy = WORLD.h / 2;
    const dc = Math.hypot(cx - e.x, cy - e.y);
    const a = angleTo(e.x, e.y, cx, cy);

    if (dc > 120) { moveAng = a; moveMul = 1; }
    else { moveMul = 0.2; }

    // Heal allies inside aura
    for (const ally of lobby.enemies) {
      if (ally === e) continue;
      if (dist2(e.x, e.y, ally.x, ally.y) <= HEAL_AURA_R * HEAL_AURA_R) {
        ally.hp = Math.min(ally.maxhp, ally.hp + HEAL_PER_SEC * dt);
      }
    }
  }

  // ============================
  // BOMBER: get into bomb range; bombs slow + short + splash
  // ============================
  else if (e.type === 'bomber') {
    const minRange = 220, maxRange = 420;

    if (dist < minRange) { moveAng = baseAng + Math.PI; moveMul = 0.9; }
    else if (dist > maxRange) { moveAng = baseAng; moveMul = 1.0; }
    else { moveMul = 0.55; }

    if (e.bombCD <= 0 && dist >= minRange && dist <= maxRange) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.10;
      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemyBomb',
        x: e.x + Math.cos(a) * (e.r + 8),
        y: e.y + Math.sin(a) * (e.r + 8),
        vx: Math.cos(a) * SPD_BOMB,
        vy: Math.sin(a) * SPD_BOMB,
        r: 6,
        dmg: DMG_BOMB,
        life: LIFE_BOMB,
        splashR: SPLASH_BOMB
      });
      e.bombCD = 1.15;
    }
  }

  // ============================
  // SHOOTER: shorter range, more bullets
  // ============================
  else if (e.type === 'shooter') {
    const keepMin = 220, keepMax = 650;

    // tier0: mostly hold / simple reposition
    // tier1+: strafe
    if (dist < keepMin) moveAng = baseAng + Math.PI;
    else if (dist > keepMax) moveAng = baseAng;
    else {
      moveAng = (tier >= 1)
        ? baseAng + (e.strafeDir || 1) * Math.PI / 2
        : baseAng;
    }

    // ✅ exactly 1 bullet per shot
    if (e.fireCD <= 0 && dist < 760) {
      const a = baseAng + (Math.random() * 2 - 1) * 0.12;

      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemy',
        x: e.x + Math.cos(a) * (e.r + 6),
        y: e.y + Math.sin(a) * (e.r + 6),
        vx: Math.cos(a) * SPD_SHOOTER,
        vy: Math.sin(a) * SPD_SHOOTER,
        r: 4,
        dmg: DMG_SHOOTER,
        life: LIFE_SHOOTER
      });

      // higher tiers can shoot slightly more often
      e.fireCD = (tier >= 2) ? 0.32 : 0.38;
    }
  }

  // ============================
  // SNIPER: keep far, lead aim unless under fire
  // ============================
  else if (e.type === 'sniper') {
    const keepMin = 620, keepMax = 1200;

    if (dist < keepMin) { moveAng = baseAng + Math.PI; moveMul = 0.8; }
    else if (dist > keepMax) { moveAng = baseAng; moveMul = 1.0; }
    else { moveMul = underFire ? 1.0 : 0.25; }

    // Under fire: circle player at normal speed; no prediction
    if (underFire) {
      moveAng = baseAng + (e.strafeDir || 1) * Math.PI / 2;
    }

    if (e.fireCD <= 0 && dist < 1400) {
      let aAim = baseAng;

      // Predict only when NOT under fire
      // Predict only at higher waves (tier2+) and only when NOT under fire
      if (!underFire && tier >= 2) {
        const bulletSp = SPD_SNIPER;
        const leadT = Math.min(0.55, dist / bulletSp);
        const px = tgt.x + (tgt.vx || 0) * leadT * 0.9;
        const py = tgt.y + (tgt.vy || 0) * leadT * 0.9;
        aAim = angleTo(e.x, e.y, px, py);
      }

      aAim += (Math.random() * 2 - 1) * (underFire ? 0.06 : 0.03);

      lobby.bullets.push({
        owner: `E:${e.id}`,
        kind: 'enemy',
        x: e.x + Math.cos(aAim) * (e.r + 8),
        y: e.y + Math.sin(aAim) * (e.r + 8),
        vx: Math.cos(aAim) * SPD_SNIPER,
        vy: Math.sin(aAim) * SPD_SNIPER,
        r: 4,
        dmg: DMG_SNIPER,
        life: LIFE_SNIPER
      });

      e.fireCD = underFire ? 1.35 : 1.8;
    }
  }

  // ============================
  // RAVENER (chaser): chase + distract; regroup at healer if not shot at
  // ============================
  else if (e.type === 'chaser') {
    // Predict only at higher waves (tier2+) and only when NOT under fire
    if (!underFire && tier >= 2) {
      const bulletSp = SPD_SNIPER;
      const leadT = Math.min(0.55, dist / bulletSp);
      const px = tgt.x + (tgt.vx || 0) * leadT * 0.9;
      const py = tgt.y + (tgt.vy || 0) * leadT * 0.9;
      aAim = angleTo(e.x, e.y, px, py);
    }
    // regroup at healer when not being shot at and injured
    if (healer && !playerShooting && e.hp < e.maxhp * 0.7) {
      moveAng = angleTo(e.x, e.y, healer.x, healer.y);
    } else {
      // chase
      moveAng = baseAng;

      // "distract": if there is a shooter/sniper/boss, flank to pull player
      const commander = lobby.enemies.find(x => x.type === 'shooter' || x.type === 'sniper' || x.type === 'boss');
      if (commander && dist2(commander.x, commander.y, tgt.x, tgt.y) < 1200 * 1200) {
        const flankA = baseAng + Math.PI / 2;
        const fx = tgt.x + Math.cos(flankA) * 180;
        const fy = tgt.y + Math.sin(flankA) * 180;
        moveAng = angleTo(e.x, e.y, fx, fy);
      }
    }
  }

  // Tanks: just chase
  else if (e.type === 'tank') {
    moveAng = baseAng;
  }

  // movement integration
  const sp = (e.speed ?? 160) * moveMul * glyphMoveMul(e);
  const vx = Math.cos(moveAng) * sp;
  const vy = Math.sin(moveAng) * sp;
  moveEnemyWithCollide(lobby, e, vx * dt, vy * dt);
}

// -----------------------------------------------------------------------------
// HTTP API — single Base44-compatible endpoint
// POST /functions/game_server  { op, ... }
// Mirrors base44/functions/game_server/entry.ts so the existing client
// (public/js/network_http.js) talks to this standalone server UNCHANGED.
// The legacy REST routes were removed (the Base44 client never calls them);
// every helper above (ensureLobby, placePlayerInLobby, flushWaiters,
// worldDelta, glyph, chest, enemyAI, the 50ms tick loop...) is reused as-is.
// -----------------------------------------------------------------------------
const GLYPH_NODE_COST = 1;
const LOBBY_RE_OP = /^[a-z0-9]{4,10}$/i;
const PEER_RE_OP  = /^[a-z0-9_-]{4,48}$/i;
const validLobbyOp = (s) => typeof s === 'string' && LOBBY_RE_OP.test(s);
const validPeerOp  = (s) => typeof s === 'string' && PEER_RE_OP.test(s);
const sanitizeNameOp = (s) => String(s || '').replace(/[<>&]/g, '').slice(0, 18).trim();

app.post('/functions/game_server', (req, res) => {
  try {
    const body = req.body || {};
    const op = String(body.op || '');
    const peerId = validPeerOp(body.peerId) ? body.peerId : makeId(8);
    const name = sanitizeNameOp(body.name || body.nickname) || ('Player' + String(peerId).slice(0, 4));

    if (op === 'join') {
      const rawMode = String(body.mode || '').toLowerCase();
      const mode = rawMode === 'pvp' ? 'pvp'
        : rawMode === 'teams' ? 'teams'
        : rawMode === 'ctf' ? 'ctf'
        : 'pve';
      let lobby;
      if (validLobbyOp(body.lobbyId)) {
        lobby = LOBBIES.get(body.lobbyId);
        if (!lobby) return res.status(404).json({ ok:false, error:'Lobby not found' });
      } else if (body.create === true) {
        // Host flow: always a brand new lobby that only its code can reach.
        // It never auto-starts — the host presses Start.
        lobby = createLobby(mode);
        lobby.custom = true;
        lobby.startTime = now() + 86400000;
        LOBBIES.set(lobby.id, lobby);
      } else {
        lobby = ensureLobby(mode);
      }
      if (!lobby.hostId && !lobby.players.size) lobby.hostId = peerId;
      if (!lobby.players.has(peerId)) {
        placePlayerInLobby(lobby, peerId, name);
        const p = lobby.players.get(peerId);
        p.hpMax = 100; p.essence = 0; p.glyphPath = null;
        p.glyph = makeGlyphState(); p.completedGlyphs = {};
        if (!lobby.scores) lobby.scores = new Map();
        if (!lobby.scores.has(peerId)) lobby.scores.set(peerId, 0);
      }
      // Teams / CTF: seat the player on the side they asked for (same side as
      // a friend = team up), then top both rosters up with bots.
      let team = null;
      if (isTeamMode(lobby.mode)) {
        const me = lobby.players.get(peerId);
        const pref = (body.team === 0 || body.team === 1) ? body.team : null;
        if (me) { if (me.team !== 0 && me.team !== 1) me.team = pickTeam(lobby, pref); team = me.team; }
        fillTeamsWithBots(lobby);
      }
      flushWaiters(lobby);
      return res.json({
        lobbyId: lobby.id, peerId, mode: lobby.mode, name,
        startTime: lobby.startTime, world: WORLD,
        levelId: lobby.levelId, mapSeed: lobby.mapSeed,
        worldKey: lobby.worldKey, isHost: lobby.hostId === peerId,
        team
      });
    }

    if (!validLobbyOp(body.lobbyId)) return res.status(400).json({ ok:false, error:'Bad lobby id' });
    const lobby = LOBBIES.get(body.lobbyId);
    if (!lobby) return res.status(404).json({ ok:false, error:'Lobby not found' });
    const player = lobby.players.get(peerId);

    switch (op) {
      case 'poll': {
        if (player) player.lastSeen = now();
        const since = Number(body.since || 0);
        const clientWK = String(body.worldKey ?? '');
        const curT = Number(lobby.snapshot?.t ?? 0);
        if (curT > since) {
          const snap = deepClone(lobby.snapshot);
          snap.meta = snap.meta ?? {};
          snap.meta.worldKey = String(lobby.worldKey ?? '');
          snap.meta.chestVer = Number(lobby.chestVer ?? 0);
          const keyNow = `${lobby.worldKey ?? ''}:${lobby.chestVer ?? 0}`;
          snap.world = (since === 0 || clientWK !== keyNow) ? worldDelta(lobby, true, clientWK) : worldDelta(lobby, false, clientWK);
          return res.json(snap);
        }
        return res.json({ t: curT, noChange: true });
      }
      case 'input': {
        if (!player) return res.status(403).json({ ok:false, error:'Not in lobby' });
        lobby.inputs.set(peerId, { ix:body.ix, iy:body.iy, ang:body.ang, x:body.x, y:body.y, weapon:body.weapon });
        if (typeof body.ang === 'number') player.ang = body.ang;
        if (typeof body.x === 'number' && typeof body.y === 'number') {
          player.x = clamp(body.x, 30, WORLD.w - 30);
          player.y = clamp(body.y, 30, WORLD.h - 30);
        }
        if (Number.isInteger(body.weapon) && body.weapon >= 0 && body.weapon <= 2) player.weapon = body.weapon;
        player.lastSeen = now();
        if (lobby.snapshot) { lobby.snapshot.t = now(); lobby.snapshot.wave = lobby.wave; lobby.snapshot.players = [...lobby.players.values()]; }
        flushWaiters(lobby);
        return res.json({ ok:true });
      }
      case 'shoot': {
        if (!player) return res.status(403).json({ ok:false, error:'Not in lobby' });
        const speed = Math.min(1400, Number(body.speed) || 800);
        const dmg = Math.min(80, Number(body.dmg) || 12);
        lobby.bullets.push({ owner:peerId, team:(player.team ?? null), x:Number(body.x), y:Number(body.y), _x0:Number(body.x), _y0:Number(body.y), vx:Math.cos(Number(body.ang))*speed, vy:Math.sin(Number(body.ang))*speed, r:4, dmg, life:1.2 });
        player.lastShotAt = now(); player.lastSeen = now();
        return res.json({ ok:true });
      }
      case 'hit': {
        if (!player) return res.status(403).json({ ok:false, error:'Not in lobby' });
        if ((lobby.mode === 'pvp' || isTeamMode(lobby.mode)) && body.kind === 'melee') {
          const victim = lobby.players.get(body.target);
          const friendly = isTeamMode(lobby.mode) && victim && victim.team === player.team;
          if (victim && peerId !== body.target && !friendly) {
            const RANGE = 120;
            if (dist2(player.x, player.y, victim.x, victim.y) <= (RANGE + 16) * (RANGE + 16)) {
              let dd = Math.max(0, Math.min(60, Number(body.dmg) || 0));
              victim.hp = (victim.hp ?? 100) - dd; if (victim.hp < 0) victim.hp = 0;
              if (victim.hp <= 0 && !victim.respawnAt) victim.respawnAt = now() + 4000;
            }
          }
        } else if (lobby.mode === 'pve' && body.target === 'enemy' && body.kind === 'melee') {
          const hx = Number(body.x), hy = Number(body.y);
          let dd = Math.max(0, Math.min(80, Number(body.dmg) || 0));
          let best = -1, bestD2 = 80 * 80;
          for (let i = 0; i < lobby.enemies.length; i++) {
            const d2 = dist2(hx, hy, lobby.enemies[i].x, lobby.enemies[i].y);
            if (d2 < bestD2) { bestD2 = d2; best = i; }
          }
          if (best >= 0) {
            const en = lobby.enemies[best];
            applyGlyphHit(lobby, player, en, dd, 'melee');
            if (en.hp <= 0) {
              applyGlyphKill(lobby, en, peerId);
              awardPvEPoint(lobby, peerId, en.type);
              spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
              lobby.enemies.splice(best, 1);
            }
          }
        }
        player.lastSeen = now();
        return res.json({ ok:true });
      }
      case 'setColor':
        if (player && Number.isInteger(body.color) && body.color >= 0 && body.color < 7) player.color = body.color;
        flushWaiters(lobby); return res.json({ ok:true });
      case 'setGuns': {
        if (!player) return res.json({ ok:false });
        const c = (v) => (Number.isInteger(v) && v >= -1 && v <= 4) ? v : null;
        player.guns = player.guns || { pistol:-1, rifle:-1, shotgun:-1 };
        if (c(body.guns?.pistol) != null) player.guns.pistol = c(body.guns.pistol);
        if (c(body.guns?.rifle)  != null) player.guns.rifle  = c(body.guns.rifle);
        if (c(body.guns?.shotgun) != null) player.guns.shotgun = c(body.guns.shotgun);
        if (Number.isInteger(body.guns?.weapon) && body.guns.weapon >= 0 && body.guns.weapon <= 2) player.weapon = body.guns.weapon;
        flushWaiters(lobby); return res.json({ ok:true });
      }
      case 'setDesign':
        if (player && Number.isInteger(body.design) && body.design >= 0 && body.design <= 14) player.design = body.design;
        flushWaiters(lobby); return res.json({ ok:true });
      case 'setMode': {
        // Only the host chooses the mode, and only before the match starts.
        if (lobby.hostId && lobby.hostId !== peerId) return res.status(403).json({ ok:false, error:'Only the host can change the mode' });
        if (lobby.started) return res.status(409).json({ ok:false, error:'Already started' });
        const wantMode = String(body.mode || '').toLowerCase();
        if (!['pve','pvp','teams','ctf'].includes(wantMode)) return res.status(400).json({ ok:false, error:'Bad mode' });
        if (wantMode !== lobby.mode) {
          lobby.mode = wantMode;
          if (lobby.snapshot) { lobby.snapshot.mode = wantMode; if (lobby.snapshot.meta) lobby.snapshot.meta.mode = wantMode; }
          // Wipe the old mode's state so the new one starts clean.
          lobby.winner = null;
          lobby.enemies = [];
          lobby.spawnQueue = [];
          lobby.bullets = [];
          lobby.giants = null;
          lobby.golems = [];
          lobby.ctf = null;
          lobby.bots = [];
          lobby.scores = new Map();
          let seat = 0;
          for (const p of lobby.players.values()) {
            p.team = null;
            p.hp = p.hpMax ?? 100;
            p.respawnAt = 0;
            p.carrying = false;
            lobby.scores.set(p.id, 0);
            if (isTeamMode(wantMode)) p.team = (seat++ % 2);
          }
          if (isTeamMode(wantMode)) fillTeamsWithBots(lobby);
        }
        flushWaiters(lobby);
        return res.json({ ok:true, mode: lobby.mode });
      }
      case 'start': {
        // Only the host may launch a private lobby.
        if (lobby.hostId && lobby.hostId !== peerId) return res.status(403).json({ ok:false, error:'Only the host can start' });
        if (lobby.started) return res.json({ ok:true, already:true, lobbyId: lobby.id });
        // A map must be chosen before the match can launch.
        if (lobby.levelId == null && !Number.isInteger(body.levelId)) return res.status(400).json({ ok:false, error:'Select a map before starting' });
        if (lobby.levelId == null) {
          lobby.levelId = Number.isInteger(body.levelId) ? body.levelId : 1;
          if (lobby.mapSeed == null) lobby.mapSeed = Math.floor(Math.random() * 2**31);
          ensureWorldGenerated(lobby);
          lobby.chestVer++;
        }
        lobby.startTime = now();   // the tick loop kicks the match off next pass
        flushWaiters(lobby);
        return res.json({ ok:true, lobbyId: lobby.id, levelId: lobby.levelId });
      }
      case 'setLevel': {
        if (lobby.started) return res.status(409).json({ ok:false, error:'Already started' });
        const lvl = Number.isInteger(body.levelId) ? body.levelId : null;
        // Private (code) lobbies set their map in place — the code must stay valid.
        if (lobby.custom) {
          if (lvl != null && lobby.levelId !== lvl) {
            lobby.levelId = lvl;
            lobby.mapSeed = Math.floor(Math.random() * 2**31);
            lobby.world = null;
            lobby.worldKey = null;
            ensureWorldGenerated(lobby);
            lobby.chestVer++;
          }
          flushWaiters(lobby);
          return res.json({ ok:true, lobbyId: lobby.id, levelId: lobby.levelId, mapSeed: lobby.mapSeed });
        }
        if (lobby.levelId == null && lvl != null) {
          const p = lobby.players.get(peerId);
          if (!p) return res.status(404).json({ ok:false, error:'Player not found' });
          const target = ensureLobbyForLevel(lobby.mode, lvl);
          if (target.id !== lobby.id) {
            lobby.players.delete(peerId); lobby.inputs.delete(peerId);
            placePlayerInLobby(target, peerId, p.name, p);
          }
          flushWaiters(target);
          return res.json({ ok:true, redirected: target.id !== lobby.id, lobbyId: target.id, levelId: target.levelId, mapSeed: target.mapSeed, joinDeadline: target.startTime });
        } else if (lobby.levelId !== lvl && lvl != null) {
          const p = lobby.players.get(peerId);
          if (!p) return res.status(404).json({ ok:false, error:'Player not found' });
          const target = ensureLobbyForLevel(lobby.mode, lvl);
          lobby.players.delete(peerId); lobby.inputs.delete(peerId);
          placePlayerInLobby(target, peerId, p.name, p);
          flushWaiters(target);
          return res.json({ ok:true, redirected:true, lobbyId: target.id, levelId: target.levelId, mapSeed: target.mapSeed, joinDeadline: target.startTime });
        }
        return res.json({ ok:true, redirected:false, lobbyId: lobby.id, levelId: lobby.levelId, mapSeed: lobby.mapSeed, joinDeadline: lobby.startTime });
      }
      case 'glyphPath': {
        if (!player) return res.json({ ok:false });
        if (!GLYPH_KEYS[body.path]) return res.json({ ok:false, error:'unknown path' });
        if (!player.glyphPath || player.glyphPath !== body.path) {
          if ((player.essence ?? 0) < GLYPH_NODE_COST) return res.json({ ok:false, error:'not enough essence' });
          player.essence -= GLYPH_NODE_COST;
        }
        player.glyphPath = body.path;
        flushWaiters(lobby); return res.json({ ok:true, essence: player.essence });
      }
      case 'glyphUnlock': {
        if (!player) return res.json({ ok:false });
        if (!GLYPH_KEYS[body.path] || !GLYPH_KEYS[body.path].includes(body.key)) return res.json({ ok:false, error:'unknown node' });
        if (!player.glyph) player.glyph = makeGlyphState();
        if (player.glyph[body.path][body.key]) return res.json({ ok:true, essence: player.essence });
        if ((player.essence ?? 0) < GLYPH_NODE_COST) return res.json({ ok:false, error:'not enough essence' });
        player.essence -= GLYPH_NODE_COST;
        player.glyph[body.path][body.key] = true;
        if (body.path === 'earth' && body.key === 'bulwark') {
          player.hpMax = Math.min(220, (player.hpMax ?? 100) + 25);
          player.hp = Math.min(player.hpMax, (player.hp ?? 100) + 25);
        }
        if (GLYPH_KEYS[body.path].every(k => player.glyph[body.path][k])) {
          player.completedGlyphs = player.completedGlyphs || {};
          player.completedGlyphs[body.path] = true;
        }
        flushWaiters(lobby); return res.json({ ok:true, essence: player.essence });
      }
      case 'chestOpen': {
        if (!player) return res.status(403).json({ ok:false, error:'Not in lobby' });
        if (!lobby.world) return res.json({ ok:false });
        const ch = (lobby.world.chests || []).find(c => c.id === body.chestId);
        if (!ch || ch.opened) return res.json({ ok:false });
        const b = (lobby.world.buildings || [])[ch.buildingIndex];
        if (!b || !b.inner) return res.json({ ok:false });
        const inside = player.x >= b.inner.x && player.x <= b.inner.x + b.inner.w && player.y >= b.inner.y && player.y <= b.inner.y + b.inner.h;
        if (lobby.wave > 1 && !inside) return res.json({ ok:false });
        if (dist2(player.x, player.y, ch.x, ch.y) > ((ch.r ?? 16) + 16) ** 2) return res.json({ ok:false });
        ch.opened = true;
        if (!ch.rarity) ch.rarity = 'common';
        const drops = rollChestDropsForServer(ch);
        ch.drops = drops;
        lobby.chestVer = (lobby.chestVer || 0) + 1;
        for (const d of drops) {
          if (d.type === 'essence') lobby.pickups.push({ x:d.x, y:d.y, r:10, type:'xp', v:d.value||1, bornAt:now() });
          else lobby.pickups.push({ x:d.x, y:d.y, r:14, type:d.type });
        }
        lobby.pickupVer = (lobby.pickupVer || 0) + 1;
        flushWaiters(lobby);
        return res.json({ ok:true, chestId: ch.id, drops });
      }
      case 'chat': {
        // Lobby / in-match chat: messages ride the authoritative snapshot every
        // client already polls, so anonymous players stay in sync.
        const text = String(body.text || '').replace(/[<>]/g, '').slice(0, 140).trim();
        if (text) {
          if (!Array.isArray(lobby.chat)) lobby.chat = [];
          lobby.chat.push({ t: now(), id: peerId, name: (player && player.name) || name, text });
          if (lobby.chat.length > 60) lobby.chat = lobby.chat.slice(-60);
        }
        return res.json({ ok: true });
      }
      case 'leave':
        lobby.players.delete(peerId); lobby.inputs.delete(peerId);
        if (lobby.scores) lobby.scores.delete(peerId);
        lobby.bullets = lobby.bullets.filter(b => b.owner !== peerId);
        // If the host walked out, hand the lobby to the next player.
        if (lobby.hostId === peerId) {
          const next = lobby.players.keys().next();
          lobby.hostId = next.done ? null : next.value;
        }
        return res.json({ ok:true });
      case 'setWorld':
        return res.json({ ok:true }); // world is server-generated
      default:
        return res.status(400).json({ ok:false, error:'Unknown op: ' + op });
    }
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// -----------------------------------------------------------------------------
// Main server tick
// -----------------------------------------------------------------------------
setInterval(() => {
  const t = now();

  // ✅ Store previous enemy positions for interpolation-safe contact checks
  for (const lobby of LOBBIES.values()) {
    for (const e of lobby.enemies || []) {
      e.prevX = e.x;
      e.prevY = e.y;
    }
  }

  for (const lobby of LOBBIES.values()) {
    // ✅ Disconnect cleanup
    for (const [pid, p] of lobby.players) {
      if (p.lastSeen && (now() - p.lastSeen) > DISCONNECT_TIMEOUT) {
        console.log('[DISCONNECT]', pid, 'from lobby', lobby.id);

        lobby.players.delete(pid);
        lobby.inputs.delete(pid);
        lobby.bullets = lobby.bullets.filter(b => b.owner !== pid);
      }
    }
    // Compute dt first (safe)
    // ✅ Fixed dt (prevents integration drift under load)
    const dt = TICK_MS / 1000;
    if (isTeamMode(lobby.mode)) {
      // teams / ctf only fight once the countdown has finished
      if (lobby.started) tickTeamMatch(lobby, dt, moveEnemyWithCollide);
    } else {
      updateBots(lobby, dt, TICK_MS, moveEnemyWithCollide);
    }
    lobby.lastTick = t;
    // ============================
    // GLYPH PHASE TIMER (PER LOBBY)
    // ============================
    if (lobby.gamePhase === 'glyph') {
      lobby.glyphTimer -= dt;

      if (lobby.glyphTimer <= 0) {
        lobby.gamePhase = 'combat';

        startWave(lobby, (lobby.wave || 1) + 1);

        // push phase into snapshot (authoritative) + wake long-poll clients
        lobby.snapshot.t = now();
        lobby.snapshot.phase = lobby.gamePhase;
        lobby.snapshot.glyphTime = lobby.glyphTimer;
        flushWaiters(lobby);
      }

      // freeze combat for THIS lobby only
    }

    // ✅ clear last tick's telegraphs (they are rebuilt every tick)
    lobby.pickups = (lobby.pickups || []).filter(
      p => p.type !== 'bossWarn' && p.type !== 'bossTarget'
    );

    // ---- Lava phase update ----
    if (lobby.world?.hazards) {
      for (const hz of lobby.world.hazards) {
        if (hz.type !== 'lava') continue;

        hz.phase = hz.phase ?? 'warn';
        hz.lavaT = (hz.lavaT ?? 0) + dt;

        // 🔔 warn → eruption
        if (hz.phase === 'warn' && hz.lavaT > 1.2) {
          hz.phase = 'eruption';
          hz.lavaT = 0;
          lobby.chestVer++;
        }

        // 🌋 eruption → burn
        else if (hz.phase === 'eruption' && hz.lavaT > 0.4) {
          hz.phase = 'burn';
          hz.lavaT = 0;
          lobby.chestVer++;
        }

        // 🔥 burn → cool
        else if (hz.phase === 'burn' && hz.lavaT > 6.0) {
          hz.phase = 'cool';
          hz.lavaT = 0;
          lobby.chestVer++;
        }

        // 🧱 cool → warn (REPEAT)
        else if (hz.phase === 'cool' && hz.lavaT > 3.5) {
          hz.phase = 'warn';
          hz.lavaT = 0;
          lobby.chestVer++;
        }
      }
    }

    // Start lobby when countdown ends
    // Start lobby when countdown ends
    
    if (!lobby.started && t >= lobby.startTime) {

      // ✅ WAIT FIRST
      if (lobby.levelId == null || lobby.mapSeed == null) {
        continue;
      }

      // ✅ ONLY INIT AFTER VALID WORLD
      if (isTeamMode(lobby.mode)) {
        // Teams / CTF field their own bot rosters, titans, golems and flags.
        initTeamMatch(lobby);
      } else {
        initBots(lobby);
      }

      lobby.started = true;

      if (lobby.mode === 'pve') {
        startWave(lobby, 1);
      }
    }

    // If not started, still publish a snapshot (optional, helps clients)
    // If not started, still publish a snapshot (optional, helps clients)
    
    if (!lobby.started) {

      lobby.snapshot = {

        t: now(),
        mode: lobby.mode,
        wave: lobby.wave,
        players: [...lobby.players.values()],
        enemies: [],
        bullets: [],
        chat: lobby.chat || [],
        ...bakeTeamSnapshot(lobby),
        scores: lobby.scores ? Object.fromEntries(lobby.scores.entries()) : {},
        // ✅ only send world when it changes
        world: worldDelta(lobby, true),
        meta: {
          lobbyId: lobby.id,
          mode: lobby.mode,
          joinDeadline: lobby.startTime,
          levelId: lobby.levelId,
          mapSeed: lobby.mapSeed,
          chestVer: lobby.chestVer ?? 0,
          worldKey: lobby.worldKey ?? null,
          started: !!lobby.started,
          hostId: lobby.hostId ?? null,
          custom: !!lobby.custom
        }
      };
      flushWaiters(lobby);

      continue; // ✅ critical
    }

    // ---- Players ----
    // ---- Players ----
    for (const [id, p] of lobby.players) {
      // ---- Pickups (authoritative) ----
      if (lobby.pickups && lobby.pickups.length) {
        for (let i = lobby.pickups.length - 1; i >= 0; i--) {
          const pk = lobby.pickups[i];
          // ✅ never "collect" telegraphs
          if (pk.type === 'bossWarn' || pk.type === 'bossTarget') continue;

          for (const [pid, p] of lobby.players) {
            const rr = (pk.r ?? 14) + 16;
            if (dist2(p.x, p.y, pk.x, pk.y) <= rr * rr) {

              // ✅ APPLY EFFECT
              if (pk.type === 'health') {
                p.hp = Math.min(100, (p.hp ?? 100) + 25);
              }

              if (pk.type === 'ammo') {
                p.ammo = Math.min((p.maxAmmo ?? 999), (p.ammo ?? 0) + 30);
              }

              if (pk.type === 'speed') {
                p.speedBoostT = 8.0;
              }

              if (pk.type === 'shield') {
                p.shield = Math.min(100, (p.shield ?? 0) + 40);
              }
              if (pk.type === 'xp') {
                p.essence = (p.essence || 0) + (pk.v || 1);
              }

              // ✅ REMOVE PICKUP
              lobby.pickups.splice(i, 1);
              lobby.pickupVer++;
              break;
            }
          }
        }
      }
      const inp = lobby.inputs.get(id);
      if (!inp) continue;

      // store old pos for velocity
      // store old pos + ang for authoritative velocities
      const prevX = p.x, prevY = p.y;
      const prevAng = p.ang ?? 0;

      p.ang = inp.ang;

      // trust client-collided position if provided
      if (typeof inp.x === 'number' && typeof inp.y === 'number') {
        p.x = inp.x;
        p.y = inp.y;
      } else {
        const m = Math.hypot(inp.ix, inp.iy) || 1;
        p.x += (inp.ix / m) * PLAYER_SPEED * dt;
        p.y += (inp.iy / m) * PLAYER_SPEED * dt;
      }

      p.x = clamp(p.x, 30, WORLD.w - 30);
      p.y = clamp(p.y, 30, WORLD.h - 30);

      // ✅ authoritative per-tick velocities (no guessing on client)
      const dtSafe = Math.max(1e-6, dt);
      p.vx = (p.x - prevX) / dtSafe;
      p.vy = (p.y - prevY) / dtSafe;

      // shortest-path angular velocity
      const da = ((p.ang - prevAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      p.vang = da / dtSafe;
      // ---- Lava hazard (players) ----
      if (lobby.world?.hazards) {
        for (const hz of lobby.world.hazards) {
          if (hz.type !== 'lava') continue;

          // player radius ~16
          if (!circleRectCollide(p.x, p.y, 16, hz)) continue;

          const phase = hz.phase;

          // 🔔 warn = no damage
          if (phase === 'warn') continue;

          // 🌋 eruption = instant kill
          if (phase === 'eruption') {
            p.hp = 0;
            break;
          }

          // 🔥 burn = chip damage
          if (phase === 'burn') {
            p.hp -= 20 * dt;
            clampHp(p);
          }
        }
      }

      // ✅ velocity for sniper lead aim
      p.vx = (p.x - prevX) / dt;
      p.vy = (p.y - prevY) / dt;
    }

    // ---- PvE: spawn + enemy AI ----
    // ---- PvE ONLY: spawn + enemy AI ----
    if (lobby.started && !lobby.world) {
      throw new Error(
        `WORLD MISSING: lobby=${lobby.id} level=${lobby.levelId} seed=${lobby.mapSeed}`
      );
    }
    if (lobby.mode === 'pve' && lobby.started) {
      lobby.spawnQueue = lobby.spawnQueue.filter(s => {
        s.t -= dt;
        if (s.t <= 0) {
          const en = spawnEnemy(s.type, s.x, s.y, s.bossVariant || 0);
          en.spawnWave = s.wave || lobby.wave;
          en.tier = aiTierForWave(en.spawnWave);

          if (en.type === 'chaser') {
            if (en.tier >= 2 && Math.random() < 0.35) en.role = 'blocker';
            else en.role = 'runner';
          }

          lobby.enemies.push(en);
          return false;
        }
        return true;
      });

      for (let i = lobby.enemies.length - 1; i >= 0; i--) {
        const e = lobby.enemies[i];

        // ✅ glyph DoTs (burn) / status timers — server-authoritative
        tickEnemyGlyphStatus(lobby, e, dt);

        enemyAI(lobby, e, dt);

        const killedByHazard = applyEnemyHazards(lobby, e, dt);
        if (killedByHazard || e.hp <= 0) {

          applyGlyphKill(lobby, e, e._lastHitBy);
          if (e._lastHitBy) awardPvEPoint(lobby, e._lastHitBy, e.type);

          spawnXpOrbs(
            lobby,
            e.x,
            e.y,
            Math.max(1, pvePointsForType(e.type))
          );

          lobby.enemies.splice(i, 1);
        }

      }
      // ✅ record enemy history AFTER all movement & hazards
      const tNow = now();
      for (const e of lobby.enemies) {
        recordEnemyHist(e, tNow);
      }

      // ✅ PvE enemy → player contact damage
      // (this block already exists below)

      // ✅ PvE enemy → player contact damage USING VISUAL (interpolated) positions
      // ✅ PvE enemy → player contact damage using SNAPSHOT position (matches client)
      // ✅ PvE contact damage using enemy position at client-render time (~120ms ago)
      const tTarget = now() - CONTACT_LAG_MS;

      for (const e of lobby.enemies) {
        const bossV = (e.type === 'boss') ? (e.bossVariant ?? 1) : 0;
        const dps = touchDps(e.type, bossV);

        const ep = enemyPosAtTime(e, tTarget);

        for (const [pid, p] of lobby.players) {
          const px = p.x;
          const py = p.y;

          const CONTACT_PAD = 6;
          const rr = (e.r ?? 16) + 16 - CONTACT_PAD;

          if (dist2(ep.x, ep.y, px, py) <= rr * rr) {
            const contactDmg = dps * dt * 1.4;
            applyPlayerDamage(lobby, pid, contactDmg);
            thornmailReflect(lobby, p, e, contactDmg); // ✅ Earth "Thornmail"
          }
        }
      }

      removeDeadPlayers(lobby);
      if (lobby.spawnQueue.length === 0 && lobby.enemies.length === 0) {
        if (lobby.gamePhase === 'combat') {
          lobby.gamePhase = 'glyph';
          lobby.glyphTimer = 15;

          // push phase into snapshot (authoritative) + wake long-poll clients
          lobby.snapshot.t = now();
          lobby.snapshot.phase = lobby.gamePhase;
          lobby.snapshot.glyphTime = lobby.glyphTimer;
          flushWaiters(lobby);
        }
      }
    }
    // ✅ PvP: absolutely no enemies
    if (lobby.mode === 'pvp') {
      lobby.enemies.length = 0;
      lobby.spawnQueue.length = 0;
    }

    // -----------------------------------------------------------------------------
    // Bullet collision helpers (SERVER-SIDE)
    // -----------------------------------------------------------------------------
    // ---- Bullets (move + wall collision + expire) ----
    // ---- Bullets (move + wall collision + expire + player hits) ----
    for (let i = lobby.bullets.length - 1; i >= 0; i--) {
      const b = lobby.bullets[i];

      const x0 = b.x, y0 = b.y;
      const x1 = b.x + b.vx * dt;
      const y1 = b.y + b.vy * dt;

      const hitWall = bulletSegmentHitsWall(lobby, x0, y0, x1, y1, b.r ?? 4);

      // move if not hit wall
      if (!hitWall){
        b.x = x1;
        b.y = y1;
        b._x0 = x0; b._y0 = y0;
      }

      b.life -= dt;

      // ✅ Enemy bomb: explode on wall OR when timer ends
      // ✅ Boss3 telegraphed bomb behaviour
      if (b.kind === 'enemyBomb' && b.targetX != null) {

        // Always show the target (red marker)
        lobby.pickups.push({
          x: b.targetX,
          y: b.targetY,
          r: 10,
          type: 'bossTarget'
        });

        // If bomb hits a wall, treat THAT as the destination (so it still explodes)
        if (hitWall) {
          b.targetX = b.x;
          b.targetY = b.y;
          b.vx = 0;
          b.vy = 0;
        }

        const dx = b.targetX - b.x;
        const dy = b.targetY - b.y;

        // Arrived at destination → warning phase
        if (dx * dx + dy * dy <= 20 * 20 || (b.vx === 0 && b.vy === 0)) {
          b.vx = 0;
          b.vy = 0;

          // ensure warnT exists
          b.warnT = (typeof b.warnT === 'number') ? b.warnT : BOSS3_WARN_TIME;
          b.warnT -= dt;

          // Show blast radius (0.5s warning)
          lobby.pickups.push({
            x: b.targetX,
            y: b.targetY,
            r: b.splashR,
            type: 'bossWarn'
          });

          if (b.warnT <= 0) {
            // explode exactly at the destination
            b.x = b.targetX;
            b.y = b.targetY;
            // ✅ one-shot explosion VFX marker for clients (expanding ring)
            // ✅ HARD REMOVE any previous explosion markers FIRST
            lobby.pickups = (lobby.pickups || []).filter(p => p.type !== 'bossBoom');

            // ✅ Add the NEW explosion marker
            lobby.pickups.push({
              x: b.x,
              y: b.y,
              r: b.splashR ?? BOSS3_BLAST_R,
              type: 'bossBoom',
              t0: now(),
              life: 0.35
            });

            lobby.pickupVer++;
            lobby.pickupVer++;
            explodeEnemyBomb(lobby, b);
            lobby.bullets.splice(i, 1);
          }
          continue;
        }
      }

      // normal bullets die on wall
      // normal bullets die on wall (but bombs should detonate instead)
      if (hitWall && b.kind !== 'enemyBomb'){
        lobby.bullets.splice(i, 1);
        continue;
      }


      // expire
      if (b.life <= 0){
        lobby.bullets.splice(i, 1);
        continue;
      }

      // ✅ Enemy bullets hit players
      const isEnemy = (typeof b.owner === 'string' && b.owner.startsWith('E:')) || b.kind === 'enemy';
      if (isEnemy){
        for (const [pid, p] of lobby.players){
          const rr = (b.r ?? 4) + 16;
          if (segmentHitsCircle(x0, y0, b.x, b.y, p.x, p.y, rr)) {
            applyPlayerDamage(lobby, pid, b.dmg ?? DMG_SHOOTER);
            lobby.bullets.splice(i, 1);
            break;
          }
        }
      }
      // ✅ PvP: player bullets hit other players
      if (handlePvPPlayerBulletHits(lobby, b, i)) {
        continue;
      }
    }

    // Teams / CTF: bullets vs the enemy titan, golems and the other side.
    if (isTeamMode(lobby.mode)) resolveTeamBullets(lobby);
    
    // ---- Bullet hits enemies (PvE) ----
    if (lobby.mode === 'pve') {
      for (let i = lobby.bullets.length - 1; i >= 0; i--) {
        const b = lobby.bullets[i];
        // ✅ only PLAYER bullets damage enemies
        if (!lobby.players.has(b.owner)) continue;

        let hitIndex = -1;
        for (let j = 0; j < lobby.enemies.length; j++) {
          const e = lobby.enemies[j];
          const rr = (b.r + e.r);
          if (segmentHitsCircle(b._x0 ?? b.x, b._y0 ?? b.y, b.x, b.y, e.x, e.y, rr)) { hitIndex = j; break; }
        }

        if (hitIndex >= 0) {
          const en = lobby.enemies[hitIndex];
          const shooter = lobby.players.get(b.owner);

          // ✅ glyph-aware damage (server-authoritative, so glyph bonuses
          // actually land in multiplayer instead of only visually predicting
          // on the shooter's own client)
          applyGlyphHit(lobby, shooter, en, b.dmg, 'bullet');

          // ✅ final-hit credit for PvE leaderboard
          if (en.hp <= 0) {
            applyGlyphKill(lobby, en, b.owner);
            awardPvEPoint(lobby, b.owner, en.type);
            // ✅ also drop XP orbs here (this path previously killed the
            // enemy without ever dropping any — starving players of the
            // essence needed to buy glyphs at all)
            spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
            lobby.enemies.splice(hitIndex, 1);
          }

          lobby.bullets.splice(i, 1); // consume bullet
        }
      }

      // remove dead enemies (covers secondary glyph kills too — chain
      // lightning / AoE detonate / soul-bind splash — not just the direct hit)
      for (let j = lobby.enemies.length - 1; j >= 0; j--) {
        const en = lobby.enemies[j];
        if (en.hp <= 0) {
          applyGlyphKill(lobby, en, en._lastHitBy);
          if (en._lastHitBy) awardPvEPoint(lobby, en._lastHitBy, en.type);
          spawnXpOrbs(lobby, en.x, en.y, Math.max(1, pvePointsForType(en.type)));
          lobby.enemies.splice(j, 1);
        }
      }
    }
    // Team modes respawn their players instead of dropping them from the lobby.
    if (!isTeamMode(lobby.mode)) removeDeadPlayers(lobby);

    // Snapshot
    // Snapshot
    lobby.snapshot = {
      t: now(),
      mode: lobby.mode,
      wave: lobby.wave,

      bots: isTeamMode(lobby.mode) ? bakeTeamBots(lobby) : bakeBotsSnapshot(lobby),
      
      phase: lobby.gamePhase,
      glyphTime: lobby.gamePhase === 'glyph' ? lobby.glyphTimer : 0,

      players: [...lobby.players.values()],
      enemies: lobby.mode === 'pve' ? lobby.enemies : [],
      bullets: lobby.bullets,
      pickups: lobby.pickups,

      // 💬 chat rides the snapshot so every client stays in sync
      chat: lobby.chat || [],

      // ⚔ teams / ctf objectives (titans, golems, bases, flags, scores)
      ...bakeTeamSnapshot(lobby),

      // ✅ leaderboard points (playerId -> points)
      scores: lobby.scores ? Object.fromEntries(lobby.scores.entries()) : {},

      // ✅ only send world when it changes
      world: worldDelta(lobby, false, lobby.snapshot?.meta?.worldKey),

      meta: {
        lobbyId: lobby.id,
        mode: lobby.mode,
        joinDeadline: lobby.startTime,
        levelId: lobby.levelId,
        mapSeed: lobby.mapSeed,
        pickupVer: lobby.pickupVer ?? 0,
        chestVer: lobby.chestVer ?? 0,
        worldKey: lobby.worldKey ?? null,
        started: !!lobby.started,
        hostId: lobby.hostId ?? null,
        custom: !!lobby.custom
      }
    };
    flushWaiters(lobby);
  }
}, TICK_MS);
app.use(express.static(path.join(__dirname, "../web/dist")));
['/login','/register','/forgot-password','/reset-password','/about','/contact'].forEach(p => app.get(p, (req, res) => res.redirect('/')));
const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, "0.0.0.0", () => console.log("✅ MonsterArena running on port", PORT));
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;