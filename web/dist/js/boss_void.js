// ============================================================
// Monster Arena — THE VOID BOSS (Story Realm 5)
// Two forms. FORM 1 ("Obsidian Void-Crystal Sentinel"): a compact
// hovering obsidian cluster around a black gravitational core,
// ringed by a violet accretion disc. Four stages, each echoing the
// two deadliest attacks the player suffered from the corresponding
// realm boss — reimagined with void visuals. FORM 2 ("VOID
// EVOLUTION"): after a secret metamorphosis cutscene, the boss
// stretches into a vast horizontal singularity with multi-coloured
// crystal wings and orbiting sigil rings, and uses five entirely
// new void-themed attacks. Serious, cursed, cosmic-horror tone.
//
// Visual identity: dark obsidian glass, violet glow (#c88aff),
// chromatic-aberration fracture lines (red/cyan offset), gravitating
// star-field, RGB-glitch tear bands. Upright posture. Immune to
// all environmental hazards. No shadowBlur (stroke-pair glow).
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#c88aff';   // void violet
  const CORE = '#1a0828';     // deep void black-purple
  const RIFT = '#ff3a6a';     // chromatic aberration red
  const RIFT_C = '#3afe3a';   // chromatic aberration cyan
  const FRAGMENT_COLS = ['#7dffa3', '#ffd166', '#9fe3ff', '#ff7a66']; // recovered shards

  let env = null;
  function E() { return env; }

  // ---- Form-1 sprite (Obsidian Void-Crystal Sentinel) ----
  // Horizontal sprite, core/front on the LEFT, trailing arms on the right.
  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/198cfad76_ObsidianVoidCrystalSentinel.png';
  const f1Img = new Image();
  f1Img.crossOrigin = 'anonymous';
  f1Img.src = SPRITE_SRC;
  let f1Ready = false;
  f1Img.onload = () => { f1Ready = true; };
  f1Img.onerror = () => { f1Ready = false; };

  // ---- Form-2 sprite (Void Evolution) ----
  // Horizontal sprite, crystal spine on the RIGHT (front), core/rings on the left.
  const SPRITE2_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/c377492cb_VOIDEVOLUTION.png';
  const f2Img = new Image();
  f2Img.crossOrigin = 'anonymous';
  f2Img.src = SPRITE2_SRC;
  let f2Ready = false;
  f2Img.onload = () => { f2Ready = true; };
  f2Img.onerror = () => { f2Ready = false; };

  // ---- shield warning banner ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `
      #voidShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
        padding:11px 24px;border-radius:999px;pointer-events:none;display:none;
        font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;
        color:#e8dcf4;background:rgba(8,4,16,.86);
        border:1px solid #c88aff;text-shadow:0 0 12px rgba(200,138,255,.6);
        white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;
        animation:voidWarnPulse 1.6s ease-in-out infinite;}
      @keyframes voidWarnPulse{0%,100%{box-shadow:0 0 22px rgba(200,138,255,.4),inset 0 0 12px rgba(200,138,255,.14)}
        50%{box-shadow:0 0 38px rgba(200,138,255,.8),inset 0 0 20px rgba(200,138,255,.3)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'voidShieldWarn';
    warnEl.textContent = "🛡️ The Void is sealed — clear all monsters first!";
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return Math.hypot(px - ax, py - ay);
    let t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ============================================================
  // ECHO ATTACK ARCHETYPES
  // Each realm boss attack maps to one of these void archetypes.
  // The Void boss reads the top-2 deadliest attacks from memory
  // and plays the matching archetype with the original attack's
  // name displayed in the telegraph.
  // ============================================================

  // Maps each realm's attack keys to an archetype
  const ECHO_MAP = {
    // Realm 1 — Hearth Warden
    rootline: 'voidShards', sporePods: 'voidShards', graspingRoots: 'voidChains', sporeBloom: 'voidRift',
    hearthquake: 'voidPulse', thornCage: 'voidChains', cataclysm: 'voidPulse', heartflare: 'voidField',
    // Realm 2 — Pharaoh of Glass
    glassLance: 'voidBeam', duneWake: 'voidRift', mirrorDoubles: 'voidShards', shatteredHalo: 'voidPulse',
    burialSpiral: 'voidChains', refractionBeam: 'voidBeam', sandfallCataclysm: 'voidField', kingsReflection: 'voidShards',
    // Realm 3 — Rime Oracle
    prophetStrike: 'voidBeam', frostCross: 'voidBeam', oracleGaze: 'voidField', memoryMissiles: 'voidShards',
    invertedFreeze: 'voidField', rimeVents: 'voidRift', blizzardVeil: 'voidField', fateCascade: 'voidPulse',
    // Realm 4 — Magma Titan
    anvilfall: 'voidPulse', chainDrag: 'voidChains', forgeVent: 'voidRift', moltenBrand: 'voidRift',
    chainSnare: 'voidChains', foundryCollapse: 'voidPulse', corebreakQuench: 'voidField', worldForgingBlow: 'voidPulse'
  };

  const ECHO_ATTACKS = {
    // VOID PULSE — expanding shockwave ring with a gap (echoes anvilfall, hearthquake, etc.)
    voidPulse: {
      name: 'Void Pulse', windup: 0.55, tele: 0.85, active: 0.9, recover: 0.6,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y; cur.r = 0; cur.maxR = 560; cur.band = 36; cur.dmg = 20; cur.spd = 600;
        cur.gap = 1.0; cur.gapAng = Math.atan2(env.player.y - e.y, env.player.x - e.x);
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.r += cur.spd * dt;
        if (cur.r > cur.maxR) return;
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (Math.abs(d - cur.r) < cur.band + pl.r) {
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          let diff = Math.abs(((a - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > cur.gap / 2) env.hurtPlayer(cur.dmg * dt * 2.0);
        }
      }
    },
    // VOID BEAM — sweeping beam that the player must flank (echoes glassLance, refractionBeam, etc.)
    voidBeam: {
      name: 'Void Beam', windup: 0.6, tele: 0.8, active: 2.2, recover: 0.5,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.65;
        cur.sweep = 1.3; cur.len = 780; cur.thick = 32; cur.dmg = 18;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        const ang = cur.ang0 + cur.sweep * p;
        const tx = cur.cx + Math.cos(ang) * cur.len, ty = cur.cy + Math.sin(ang) * cur.len;
        if (pSeg(pl.x, pl.y, cur.cx, cur.cy, tx, ty) < cur.thick + pl.r) env.hurtPlayer(cur.dmg * dt * 1.8);
      }
    },
    // VOID RIFT — ground zones that erupt after a delay (echoes duneWake, moltenBrand, etc.)
    voidRift: {
      name: 'Void Rift', windup: 0.5, tele: 0.9, active: 1.6, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.zones = [];
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * 6.28 + env.rand(0, 1), d = 120 + env.rand(0, 300);
          cur.zones.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 80, erupt: i * 0.25 });
        }
        cur.dmg = 22;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          const local = cur.t - z.erupt;
          if (local < 0 || local > 1.2) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) env.hurtPlayer(cur.dmg * dt * 2.0);
        }
      }
    },
    // VOID CHAINS — closing arc barrier with a gap (echoes chainDrag, thornCage, etc.)
    voidChains: {
      name: 'Void Chains', windup: 0.6, tele: 0.8, active: 2.4, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.cx = pl.x; cur.cy = pl.y; cur.r0 = 380; cur.gap = 0.9; cur.dmg = 18;
        cur.gapAng = Math.atan2(pl.y - e.y, pl.x - e.x);
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        const r = cur.r0 * (1 - p * 0.76);
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (Math.abs(d - r) < 32 + pl.r) {
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          let diff = Math.abs(((a - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > cur.gap / 2) env.hurtPlayer(cur.dmg * dt * 1.8);
        }
      }
    },
    // VOID SHARDS — projectile barrage (echoes memoryMissiles, sporePods, etc.)
    voidShards: {
      name: 'Void Shards', windup: 0.5, tele: 0.7, active: 1.5, recover: 0.5,
      build(e, cur) {
        cur.proj = [];
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.28 + env.rand(0, 0.4);
          cur.proj.push({ a, x: e.x, y: e.y, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280, r: 10, dmg: 16 });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const p of cur.proj) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (env.dist2(pl.x, pl.y, p.x, p.y) < (p.r + pl.r) * (p.r + pl.r)) env.hurtPlayer(p.dmg * dt * 3.0);
        }
      }
    },
    // VOID FIELD — full-arena field with a safe cone (echoes corebreakQuench, blizzardVeil, etc.)
    voidField: {
      name: 'Void Field', windup: 1.0, tele: 1.4, active: 0.5, recover: 1.0,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.safeAng = Math.atan2(pl.y - e.y, pl.x - e.x); cur.safeHalf = 0.7; cur.dmg = 24;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
        let diff = Math.abs(((a - cur.safeAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < cur.safeHalf) return;
        env.hurtPlayer(cur.dmg * dt * 1.6);
      }
    }
  };

  // ============================================================
  // EVOLVED FORM ATTACKS — five entirely new void attacks
  // ============================================================
  const EVOLVED_ATTACKS = {
    // 1. EVENT-HORIZON SWEEP — thick violet beam sweeps a lane; safe gap behind it
    eventHorizon: {
      name: 'Event Horizon', windup: 0.7, tele: 0.9, active: 2.6, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.8;
        cur.sweep = 1.6; cur.len = 900; cur.thick = 42; cur.dmg = 24;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        const ang = cur.ang0 + cur.sweep * p;
        const tx = cur.cx + Math.cos(ang) * cur.len, ty = cur.cy + Math.sin(ang) * cur.len;
        if (pSeg(pl.x, pl.y, cur.cx, cur.cy, tx, ty) < cur.thick + pl.r) env.hurtPlayer(cur.dmg * dt * 2.0);
      }
    },
    // 2. FRACTURE LATTICE — grid of strikes with open safe cells
    fractureLattice: {
      name: 'Fracture Lattice', windup: 0.8, tele: 1.0, active: 1.4, recover: 0.7,
      build(e, cur) {
        cur.cells = [];
        const n = 6, spacing = 180;
        const off = -(n - 1) * spacing / 2;
        cur.safeCol = Math.floor(env.rand(0, n));
        cur.safeRow = Math.floor(env.rand(0, n));
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          cur.cells.push({ x: e.x + off + c * spacing, y: e.y + off + r * spacing, r: 70, safe: (r === cur.safeRow || c === cur.safeCol), fire: (r + c) * 0.04 });
        }
        cur.dmg = 26;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const cell of cur.cells) {
          if (cell.safe) continue;
          const local = cur.t - cell.fire;
          if (local < 0 || local > 0.8) continue;
          if (env.dist2(pl.x, pl.y, cell.x, cell.y) < (cell.r + pl.r) * (cell.r + pl.r)) env.hurtPlayer(cur.dmg * dt * 2.2);
        }
      }
    },
    // 3. GRAVITATIONAL UNDERTOW — pulls player toward core while debris falls
    gravityUndertow: {
      name: 'Gravitational Undertow', windup: 0.6, tele: 1.0, active: 3.0, recover: 0.6,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y; cur.pullR = 700; cur.dmg = 16;
        cur.debris = [];
        for (let i = 0; i < 12; i++) {
          const a = env.rand(0, 6.28), d = 200 + env.rand(0, 400);
          cur.debris.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 50, fall: i * 0.2 });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (d < cur.pullR && d > 10) {
          const pull = 120 * dt;
          if (env.moveWithCollide) env.moveWithCollide(pl, (cur.cx - pl.x) / d * pull, (cur.cy - pl.y) / d * pull);
        }
        if (d < 60 + pl.r) env.hurtPlayer(cur.dmg * dt * 2.0);
        for (const db of cur.debris) {
          const local = cur.t - db.fall;
          if (local < 0 || local > 0.6) continue;
          if (env.dist2(pl.x, pl.y, db.x, db.y) < (db.r + pl.r) * (db.r + pl.r)) env.hurtPlayer(cur.dmg * dt * 2.5);
        }
      }
    },
    // 4. RIFT-NEEDLE BARRAGE — portals fire fast crystal needles along lines
    riftNeedle: {
      name: 'Rift-Needle Barrage', windup: 0.6, tele: 0.9, active: 2.4, recover: 0.5,
      build(e, cur) {
        cur.portals = [];
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.28 + env.rand(0, 0.5), d = 350;
          cur.portals.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, fire: i * 0.25, shots: [] });
        }
        cur.dmg = 18;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const p of cur.portals) {
          const local = cur.t - p.fire;
          if (local > 0 && local < 0.1 && p.shots.length === 0) {
            for (let s = 0; s < 3; s++) {
              const a = Math.atan2(pl.y - p.y, pl.x - p.x) + (s - 1) * 0.15;
              p.shots.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 8 });
            }
          }
          for (const sh of p.shots) {
            sh.x += sh.vx * dt; sh.y += sh.vy * dt;
            if (env.dist2(pl.x, pl.y, sh.x, sh.y) < (sh.r + pl.r) * (sh.r + pl.r)) env.hurtPlayer(cur.dmg * dt * 3.0);
          }
        }
      }
    },
    // 5. SINGULARITY COLLAPSE — large field contracts in stages; safe at edges, then core exposed
    singularityCollapse: {
      name: 'Singularity Collapse', windup: 1.2, tele: 1.5, active: 2.0, recover: 1.2,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y; cur.maxR = 700; cur.dmg = 28; cur.exposed = false;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        if (p < 0.8) {
          const r = cur.maxR * (1 - p * 0.85);
          const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
          if (d < r) env.hurtPlayer(cur.dmg * dt * 2.0);
        } else { cur.exposed = true; }
      }
    }
  };

  // ---- stage logic ----
  function stageFor(e) {
    const vb = e._vb;
    if (vb.form === 2) return 6; // evolved form is one continuous stage
    const r = (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1);
    if (r > 0.75) return 1;
    if (r > 0.50) return 2;
    if (r > 0.25) return 3;
    return 4;
  }

  function availableAttacks(e) {
    const vb = e._vb;
    if (vb.form === 2) return Object.keys(EVOLVED_ATTACKS);
    const stage = vb.stage;
    const realm = stage; // stages 1-4 map to realms 1-4
    if (!vb.echoCache[realm]) {
      const top2 = (window.BossAttackMemory ? BossAttackMemory.getTopTwo(realm) : null) || [];
      vb.echoCache[realm] = top2.map(t => ({
        echoKey: t.key, echoName: t.name,
        archetype: ECHO_MAP[t.key] || 'voidPulse'
      }));
    }
    return vb.echoCache[realm];
  }

  const FALLBACK_PICK = { echoKey: null, echoName: 'Void Pulse', archetype: 'voidPulse' };
  function pickNext(e) {
    const vb = e._vb;
    let pool = availableAttacks(e);
    if (!pool || pool.length === 0) pool = [FALLBACK_PICK];
    let opts = pool;
    if (vb.last && pool.length > 1) {
      opts = pool.filter(a => a.archetype !== vb.last && a.echoKey !== vb.lastEcho);
      if (opts.length === 0) opts = pool;
    }
    const pick = opts[Math.floor(env.rand(0, opts.length))];
    vb.last = pick.archetype; vb.lastEcho = pick.echoKey;
    return pick;
  }

  function startAttack(e, pick) {
    const vb = e._vb;
    let A, key;
    if (vb.form === 2) {
      key = pick; A = EVOLVED_ATTACKS[key];
    } else {
      key = pick.archetype; A = ECHO_ATTACKS[key];
    }
    const cur = { key, name: pick.name || A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
    vb.cur = cur;
  }

  function tick(e, dt) {
    if (!env) return;
    if (!e._vb) {
      e._vb = { form: 1, stage: 1, cur: null, last: null, lastEcho: null, idle: 0.8, hitFlash: 0, intro: 1.6, echoCache: {}, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5, morphed: false };
    }
    const vb = e._vb;
    // TEST SEQUENCE (BOSS_INSTAKILL): death(form1) → metamorphosis → death(form2) → continue
    if (window.BOSS_INSTAKILL && window.STORY_ACTIVE && !vb.testSeq && vb.form === 1) {
      vb.testSeq = 'run'; startTestSequence(e); return;
    }
    if (vb.testSeq && vb.testSeq !== 'done') { e.vx = 0; e.vy = 0; e.hp = e.maxhp; return; }
    vb.hitFlash = Math.max(0, vb.hitFlash - dt);
    vb.dodgeCD = Math.max(0, (vb.dodgeCD || 0) - dt);
    if (vb.intro > 0) { vb.intro -= dt; e.vx = 0; e.vy = 0; return; }

    if (vb.dodgeT > 0) {
      vb.dodgeT -= dt; e.vx = vb.dodgeVx; e.vy = vb.dodgeVy;
      vb.dodgeVx *= 0.86; vb.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (vb.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      if (env.addEffect && Math.random() < 0.4) env.addEffect(e.x, e.y, 'pop', 0.3, ACCENT);
      return;
    }

    if (e.absorbing) {
      vb.cur = null;
      const pl = env.player, a = Math.atan2(pl.y - e.y, pl.x - e.x), sp = e.speed * 0.35;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.10);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.10);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      setShieldWarn(true);
      return;
    }
    setShieldWarn(false);

    if (vb.phaseAnim) {
      vb.phaseAnim.t += dt;
      const pa = vb.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { vb.phaseAnim = null; vb.idle = 0.4; vb.cur = null; }
      return;
    }

    // form 1: check for stage transitions or metamorphosis
    if (vb.form === 1) {
      const ns = stageFor(e);
      if (ns !== vb.stage && ns <= 4) {
        const old = vb.stage; vb.stage = ns; vb.cur = null;
        vb.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
        if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
        if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'void', accent: ACCENT, name: 'The Void', from: old, to: ns });
        return;
      }
      // metamorphosis trigger: reached stage 4 at 0 HP threshold (25% → 0%)
      if (ns === 4 && (e.hp / Math.max(1, e.maxhp)) <= 0.001 && !vb.morphed) {
        vb.morphed = true;
        vb.cur = null;
        triggerMetamorphosis(e);
        return;
      }
    }

    // reactive dodge
    if (vb.dodgeCD <= 0 && !vb.cur && env.ents && env.ents.bullets) {
      const dodgeChance = vb.form === 2 ? 0.4 : [0, 0.15, 0.22, 0.30, 0.38][vb.stage] || 0.2;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 380 || d < 6) continue;
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        if ((dx * (b.vx || 0) + dy * (b.vy || 0)) / spd <= 0) continue;
        if (env.rand(0, 1) > dodgeChance) { vb.dodgeCD = 0.8; break; }
        const bvnx = (b.vx || 0) / spd, bvny = (b.vy || 0) / spd;
        let nx = -bvny, ny = bvnx;
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.2 + (vb.form === 2 ? 0.6 : vb.stage * 0.15));
        vb.dodgeVx = nx * dashSp; vb.dodgeVy = ny * dashSp;
        vb.dodgeT = 0.24; vb.dodgeCD = 1.6;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, ACCENT);
        return;
      }
    }

    const pl = env.player;
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    if (d2p > 170 * 170) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * (vb.form === 2 ? 0.7 : 0.9);
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.12);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.12);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    if (!vb.cur) {
      vb.idle -= dt;
      if (vb.idle <= 0) startAttack(e, pickNext(e));
      return;
    }
    const c = vb.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.0 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      const A = vb.form === 2 ? EVOLVED_ATTACKS[c.key] : ECHO_ATTACKS[c.key];
      A.build(e, c);
      if (c.dmg) c.dmg *= 3.0;
      if (c.proj) for (const p of c.proj) p.dmg *= 3.0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
    }
    else if (c.phase === 'active' && c.t >= P.active) { c.phase = 'recover'; c.t = 0; c.zones = null; c.proj = null; c.portals = null; }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      vb.cur = null;
      vb.idle = vb.form === 2 ? 0.5 : [1.3, 1.0, 0.8, 0.6][vb.stage - 1] || 0.6;
      return;
    }
    if (c.phase === 'active') {
      const A = vb.form === 2 ? EVOLVED_ATTACKS[c.key] : ECHO_ATTACKS[c.key];
      A.tick(e, c, dt);
    }
  }

  // ---- metamorphosis ----
  function triggerMetamorphosis(e) {
    const vb = e._vb;
    if (window.VoidMetamorphosisCutscene) {
      const beats = [
        { who: 'The Void', text: 'You remember them all — the deadliest blows you suffered. I remember them too.' },
        { who: 'The Void', text: 'Every wound you endured... feeds me. Every death you narrowly escaped... shaped me.' },
        { who: 'The Void', text: 'Now witness my true form. The echo ends. The singularity begins.' }
      ];
      VoidMetamorphosisCutscene.play(beats, {
        onDone: function () {
          // transform: refill HP for form 2, switch form
          vb.form = 2;
          e.maxhp = Math.round((e.maxhp || 3000) * 0.8);
          e.hp = e.maxhp;
          e.r = 56;
          e.speed = 70;
          vb.cur = null;
          vb.idle = 1.0;
          if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 20);
          if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.5, ACCENT);
        }
      });
    } else {
      vb.form = 2; e.hp = e.maxhp; vb.cur = null; vb.idle = 1.0;
    }
  }

  // ---- scripted test sequence (BOSS_INSTAKILL): two deaths + metamorphosis ----
  function startTestSequence(e) {
    const vb = e._vb;
    const beats = [
      { who: 'The Void', text: 'You remember them all — the deadliest blows you suffered. I remember them too.' },
      { who: 'The Void', text: 'Every wound you endured... feeds me. Every death you narrowly escaped... shaped me.' },
      { who: 'The Void', text: 'Now witness my true form. The echo ends. The singularity begins.' }
    ];
    const playForm1Death = () => {
      if (window.BossDeathScene) {
        BossDeathScene.play({ sprite: (f1Ready ? f1Img : null), accent: ACCENT, glyph: ACCENT, theme: 'void', name: 'The Void', onDone: playMorph });
      } else { playMorph(); }
    };
    const playMorph = () => {
      if (window.VoidMetamorphosisCutscene) {
        VoidMetamorphosisCutscene.play(beats, { onDone: transformToForm2 });
      } else { transformToForm2(); }
    };
    const transformToForm2 = () => {
      vb.form = 2; vb.morphed = true;
      e.maxhp = Math.round((e.maxhp || 3000) * 0.8); e.hp = e.maxhp; e.r = 56; e.speed = 70;
      vb.cur = null; vb.idle = 1.0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 20);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.5, ACCENT);
      setTimeout(playForm2Death, 450);
    };
    const playForm2Death = () => {
      if (window.BossDeathScene) {
        BossDeathScene.play({ sprite: (f2Ready ? f2Img : null), accent: ACCENT, glyph: ACCENT, theme: 'void', name: 'The Void Evolution', onDone: finishSeq });
      } else { finishSeq(); }
    };
    const finishSeq = () => {
      vb.testSeq = 'done';
      e.hp = 0; e.absorbing = false;
    };
    playForm1Death();
  }

  // ============================================================
  // 2D RENDERING
  // ============================================================
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 44;
    const vb = e._vb || {};
    const form = vb.form || 1;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy + rr * 0.7, rr * 1.0, rr * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    // gravitational aura
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (form === 2 ? 2.4 : 1.8);
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.3, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(200,138,255,0.22)'); ag.addColorStop(0.5, 'rgba(120,40,200,0.10)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (form === 1) drawForm1_2D(e, ctx, cx, cy, rr, t, vb);
    else drawForm2_2D(e, ctx, cx, cy, rr, t, vb);

    if (vb.hitFlash > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = vb.hitFlash;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    if (e.absorbing) drawAbsorb2D(ctx, cx, cy, rr, t);
    if (vb.cur) drawTelegraph2D(ctx, vb.cur, t);
    if (vb.phaseAnim) drawPhaseAnim2D(ctx, e, vb.phaseAnim, t);

    // HP ring
    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, -Math.PI / 2, -Math.PI / 2 + hpR * 2 * Math.PI); ctx.stroke();
  }

  function drawForm1_2D(e, ctx, cx, cy, rr, t, vb) {
    const a = Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save(); ctx.translate(cx, cy);
    if (f1Ready && f1Img.width) {
      // sprite faces LEFT (core on -X); mirror horizontally so the core points
      // at the player without flipping the sprite upside down
      const iw = f1Img.width, ih = f1Img.height;
      const w = rr * 3.0, h = w * (ih / iw);
      ctx.rotate(a);
      ctx.scale(-1, 1);
      ctx.drawImage(f1Img, -w / 2, -h / 2, w, h);
    } else {
      // fallback: procedural obsidian cluster
      ctx.rotate(Math.sin(t * 0.4) * 0.04);
      const F = [
        { pts: [[0, -rr * 1.1], [rr * 0.6, -rr * 0.2], [0, rr * 0.7]], sh: 1 },
        { pts: [[0, -rr * 1.1], [-rr * 0.6, -rr * 0.2], [0, rr * 0.7]], sh: 0.5 },
        { pts: [[rr * 0.6, -rr * 0.2], [rr * 0.35, rr], [0, rr * 0.7]], sh: 0.8 },
        { pts: [[-rr * 0.6, -rr * 0.2], [0, rr * 0.7], [-rr * 0.35, rr]], sh: 0.3 }
      ];
      for (const f of F) {
        const g = ctx.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[2][0], f.pts[2][1]);
        const sh = f.sh;
        g.addColorStop(0, 'rgba(' + Math.floor(42 * sh) + ',' + Math.floor(16 * sh) + ',' + Math.floor(56 * sh) + ',1)');
        g.addColorStop(1, '#05010a');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(200,138,255,0.4)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]); ctx.lineTo(f.pts[1][0], f.pts[1][1]); ctx.lineTo(f.pts[2][0], f.pts[2][1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    // pulsing accretion ring over the core (kept for the "alive" feel)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(200,138,255,' + (0.7 + 0.3 * Math.sin(t * 3)) + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, rr * 0.32, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // chromatic aberration fracture lines
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255,58,106,0.30)'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(-rr * 0.3, -rr * 0.5); ctx.lineTo(rr * 0.2, rr * 0.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(58,254,200,0.30)'; ctx.beginPath();
    ctx.moveTo(-rr * 0.3 + 2, -rr * 0.5); ctx.lineTo(rr * 0.2 + 2, rr * 0.3); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawForm2_2D(e, ctx, cx, cy, rr, t, vb) {
    const a = Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save(); ctx.translate(cx, cy);
    if (f2Ready && f2Img.width) {
      // sprite spine points RIGHT (+X); rotate so the spine points at the player
      const iw = f2Img.width, ih = f2Img.height;
      const w = rr * 3.2, h = w * (ih / iw);
      ctx.rotate(a);
      ctx.drawImage(f2Img, -w / 2, -h / 2, w, h);
    } else {
      // fallback: segmented crystal wings
      for (const side of [-1, 1]) {
        ctx.save(); ctx.scale(side, 1);
        const segs = 5;
        for (let i = 0; i < segs; i++) {
          const f = i / segs, w = rr * (2.2 - f * 1.6), h = rr * (0.4 - f * 0.28) * (1 + Math.sin(t * 2 + i) * 0.1);
          const col = FRAGMENT_COLS[i % 4];
          const g = ctx.createLinearGradient(0, -h, 0, h);
          g.addColorStop(0, col + 'aa'); g.addColorStop(0.5, '#0a0218'); g.addColorStop(1, col + '66');
          ctx.fillStyle = g; ctx.strokeStyle = 'rgba(200,138,255,0.5)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(rr * 0.25, -h); ctx.lineTo(rr * 0.25 + w, -h * 0.3); ctx.lineTo(rr * 0.25 + w * 0.85, h); ctx.lineTo(rr * 0.25, h); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      // orbiting sigil rings
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ringR = rr * (0.8 + i * 0.3), rot = t * (0.5 + i * 0.3) + i * 1.3;
        ctx.strokeStyle = FRAGMENT_COLS[i % 4] + 'aa'; ctx.lineWidth = 2; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -rot * 40;
        ctx.beginPath(); ctx.ellipse(0, 0, ringR, ringR * 0.3, rot, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.setLineDash([]); ctx.restore();
      // event horizon
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.42, rr * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    }
    // event-horizon glow ring over the core (alive feel)
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(200,138,255,' + (0.8 + 0.2 * Math.sin(t * 3)) + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, rr * 0.46, rr * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawAbsorb2D(ctx, cx, cy, rr, t) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const shR = rr * 1.9 + Math.sin(t * 3) * 4;
    const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
    sg.addColorStop(0, 'rgba(200,138,255,0)'); sg.addColorStop(0.7, 'rgba(200,138,255,0.18)'); sg.addColorStop(1, 'rgba(200,138,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,138,255,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
    ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
    ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  function drawPhaseAnim2D(ctx, e, pa, t) {
    const cam = env.cam, sx = (x) => x - cam.x - cam.sx, sy = (y) => y - cam.y - cam.sy;
    const p = Math.min(1, pa.t / pa.dur), cx = sx(e.x), cy = sy(e.y), rr = e.r || 44;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const ringR = rr + p * 540;
    ctx.strokeStyle = 'rgba(200,138,255,' + (0.9 * (1 - p)) + ')'; ctx.lineWidth = 12 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.4);
    fg.addColorStop(0, 'rgba(220,180,255,' + (0.85 * (1 - p)) + ')'); fg.addColorStop(0.5, 'rgba(200,138,255,' + (0.5 * (1 - p)) + ')'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, rr * 2.4, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const rr2 = rr * (1.2 + i * 0.5) * (0.5 + 0.5 * p);
      ctx.strokeStyle = 'rgba(200,138,255,' + (0.6 * (1 - p)) + ')'; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 60 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.restore();
  }

  function drawTelegraph2D(ctx, cur, t) {
    if (!env) return;
    const cam = env.cam, sx = (x) => x - cam.x - cam.sx, sy = (y) => y - cam.y - cam.sy;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    if (cur.phase === 'tele' || cur.phase === 'active') {
      const tele = cur.phase === 'tele', tp = tele ? cur.t / cur.phases.tele : 1;
      // generic telegraph per attack key
      if (cur.key === 'voidPulse' || cur.key === 'eventHorizon') {
        if (cur.phase === 'active' && cur.r !== undefined) {
          ctx.strokeStyle = 'rgba(200,138,255,0.9)'; ctx.lineWidth = cur.band || 6;
          ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, cur.r), cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2); ctx.stroke();
        } else if (cur.cx !== undefined) {
          ctx.fillStyle = 'rgba(200,138,255,' + (0.3 * tp) + ')'; ctx.strokeStyle = 'rgba(200,138,255,0.9)'; ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), 80 * tp, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        }
      } else if (cur.key === 'voidBeam' || cur.key === 'eventHorizon') {
        const prog = tele ? tp : Math.min(1, cur.t / cur.phases.active);
        const a0 = cur.ang0, a1 = cur.ang0 + cur.sweep * (tele ? 1 : prog);
        const x0 = sx(cur.cx), y0 = sy(cur.cy);
        const x1 = sx(cur.cx + Math.cos(a1) * cur.len), y1 = sy(cur.cy + Math.sin(a1) * cur.len);
        ctx.strokeStyle = 'rgba(200,138,255,' + (tele ? 0.5 * tp : 0.8) + ')'; ctx.lineWidth = cur.thick * 0.7;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      } else if (cur.key === 'voidRift' && cur.zones) {
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(200,138,255,' + (0.3 * tp) + ')'; ctx.strokeStyle = 'rgba(200,138,255,0.9)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r * (tele ? tp : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'voidChains') {
        const p = tele ? 0 : Math.min(1, cur.t / cur.phases.active);
        const r = Math.max(1, cur.r0 * (1 - p * 0.76));
        ctx.strokeStyle = 'rgba(200,138,255,' + (tele ? 0.6 * tp : 0.9) + ')'; ctx.lineWidth = 6;
        ctx.setLineDash([14, 8]); ctx.beginPath();
        ctx.arc(sx(cur.cx), sy(cur.cy), r, cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      } else if (cur.key === 'voidShards' && cur.proj) {
        for (const p of cur.proj) {
          ctx.fillStyle = 'rgba(200,138,255,0.8)'; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (cur.key === 'voidField' || cur.key === 'singularityCollapse') {
        if (cur.safeAng !== undefined) {
          ctx.fillStyle = 'rgba(125,255,163,0.18)';
          ctx.beginPath(); ctx.moveTo(sx(cur.cx), sy(cur.cy));
          ctx.arc(sx(cur.cx), sy(cur.cy), 900, cur.safeAng - cur.safeHalf, cur.safeAng + cur.safeHalf); ctx.closePath(); ctx.fill();
        }
        if (cur.phase === 'active' && cur.maxR !== undefined && cur.key === 'singularityCollapse') {
          const p = Math.min(1, cur.t / cur.phases.active), r = cur.maxR * (1 - p * 0.85);
          ctx.strokeStyle = 'rgba(200,138,255,0.9)'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
        }
      } else if (cur.key === 'fractureLattice' && cur.cells) {
        for (const cell of cur.cells) {
          if (cell.safe) { ctx.fillStyle = 'rgba(125,255,163,0.15)'; }
          else { ctx.fillStyle = 'rgba(200,138,255,' + (0.25 * tp) + ')'; }
          ctx.strokeStyle = cell.safe ? 'rgba(125,255,163,0.6)' : 'rgba(200,138,255,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(cell.x), sy(cell.y), cell.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'gravityUndertow') {
        ctx.strokeStyle = 'rgba(200,138,255,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), cur.pullR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        if (cur.debris) for (const db of cur.debris) {
          ctx.fillStyle = 'rgba(200,138,255,0.3)'; ctx.beginPath(); ctx.arc(sx(db.x), sy(db.y), db.r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (cur.key === 'riftNeedle' && cur.portals) {
        for (const p of cur.portals) {
          ctx.fillStyle = 'rgba(200,138,255,0.6)'; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          for (const sh of p.shots) { ctx.fillStyle = '#c88aff'; ctx.beginPath(); ctx.arc(sx(sh.x), sy(sh.y), sh.r, 0, Math.PI * 2); ctx.fill(); }
        }
      }
    }
    ctx.restore();
  }

  // ============================================================
  // 3D RENDERING — cursed, serious, non-cartoonish
  // ============================================================
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const vb = e._vb || {};
    const form = vb.form || 1;
    const rr = e.r || 44;
    const x = e.x, z = e.y;
    const hb = rr * 1.2 + Math.sin(tt * 2.4) * 3;
    const AC = R.hexRGB(ACCENT);

    R.quads.alpha.push(x, 1.2, z, rr * 2.6, 0, 0, 0, 0.4, 0, 11, 0, 1);

    if (form === 1) drawForm1_3D(R, e, tt, x, z, hb, rr, AC);
    else drawForm2_3D(R, e, tt, x, z, hb, rr, AC);

    // warding shield dome
    if (e.absorbing) {
      const pul = 0.5 + 0.5 * Math.sin(tt * 2.4), shR = rr * 2.2;
      R.draw(U.sphere, mm(x, hb + shR * 0.55, z, tt * 0.3, shR, shR * 1.15, shR), mat(AC, { alpha: 0.10 + 0.05 * pul, emissive: [AC[0] * 0.4, AC[1] * 0.4, AC[2] * 0.4], rim: 1.6, rimCol: AC, shadow: false, rough: 0.2, metal: 0.2 }));
      R.draw(U.torus, mm(x, hb + 4, z, tt * 0.8, shR * 0.95, shR * 0.95, shR * 0.95, 0.12), mat([1, 1, 1], { emissive: AC, alpha: 0.5 + 0.2 * pul, shadow: false }));
      R.glow(x, hb + shR * 0.5, z, shR * 1.4, AC[0], AC[1], AC[2], 0.35 + 0.15 * pul, 0);
      R.light(x, z, hb + shR, 320, AC[0], AC[1], AC[2], 0.7);
    }

    if (vb.cur) drawTelegraph3D(R, vb.cur, tt);
    if (vb.phaseAnim) drawPhaseAnim3D(R, e, vb.phaseAnim, tt, hb);
  }

  function drawForm1_3D(R, e, tt, x, z, hb, rr, AC) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    if (f1Ready) {
      // inflated sprite mesh — the Obsidian Void-Crystal Sentinel
      const sp = R.spriteMesh(f1Img, { depth: 0.6, power: 0.5 });
      if (sp) {
        const size = (rr + 20) * 2.6;
        const tps = R.isTps;
        const tilt = 1.2;
        const ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        if (tps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = hb + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        } else {
          R.draw(sp.mesh, mm(x, hb, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        }
      }
    } else {
      // fallback: dark obsidian crystal cluster — faceted, jagged, serious
      const rk = mat([0.08, 0.04, 0.14], { rough: 0.6, metal: 0.3, emissive: [0.12, 0.06, 0.2], emisK: 1.4, rim: 1.4, rimCol: AC });
      R.draw(U.rock3, mm(x, hb, z, tt * 0.2, rr * 0.8, rr * 1.6, rr * 0.8, 0.3), rk);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.28 + tt * 0.1;
        const sx = x + Math.cos(a) * rr * 0.5, sz = z + Math.sin(a) * rr * 0.5;
        const sh = rr * (1.0 + 0.3 * Math.sin(tt * 1.5 + i));
        R.draw(U.cone, mm(sx, hb + sh * 0.3, sz, a + Math.PI / 2, rr * 0.18, sh, rr * 0.18, 0, Math.PI / 2 - 0.3), rk);
      }
    }
    // black event-horizon core
    R.draw(U.sphere, mm(x, hb, z, tt * 0.5, rr * 0.22, rr * 0.22, rr * 0.22), mat([0.02, 0.01, 0.04], { rough: 0.1, metal: 0.1, emissive: [0, 0, 0], shadow: false }));
    // accretion ring
    R.draw(U.torus, mm(x, hb, z, tt * 1.2, rr * 0.32, rr * 0.32, rr * 0.1, 0.06), mat([1.2, 0.7, 1.8], { emissive: [1.5, 0.8, 2.2], emisK: 2.4, shadow: false, rim: 2.0, rimCol: AC }));
    R.glow(x, hb, z, rr * 1.4, AC[0], AC[1], AC[2], 0.7 + 0.2 * Math.sin(tt * 3), 0);
    R.light(x, z, hb, 200, AC[0], AC[1], AC[2], 0.6);
    // gravitating void motes
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * 6.28, d = rr * (0.8 + Math.random() * 0.8);
        R.emit({ x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d, vx: -Math.cos(a) * 20, vy: 10 + Math.random() * 20, vz: -Math.sin(a) * 20, life: 1.2, age: 0, s0: 5, s1: 1, col: AC, a: 0.7, kind: 0, drag: 0.7 });
      }
    }
    // ground aura
    R.decal(x, z, rr * 2.2, AC[0], AC[1], AC[2], 0.28 + 0.1 * Math.sin(tt * 2), 9, tt * 0.6, 0, true, 1.4);
  }

  function drawForm2_3D(R, e, tt, x, z, hb, rr, AC) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    if (f2Ready) {
      // inflated sprite mesh — the Void Evolution
      const sp = R.spriteMesh(f2Img, { depth: 0.6, power: 0.5 });
      if (sp) {
        const size = (rr + 20) * 2.6;
        const tps = R.isTps;
        const tilt = 1.2;
        const ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        if (tps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = hb + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        } else {
          R.draw(sp.mesh, mm(x, hb, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        }
      }
    } else {
      // fallback: segmented crystal wings + sigil rings
      const rk = mat([0.06, 0.03, 0.12], { rough: 0.55, metal: 0.35, emissive: [0.1, 0.05, 0.18], emisK: 1.6, rim: 1.6, rimCol: AC });
      for (const side of [-1, 1]) {
        const segs = 6;
        for (let i = 0; i < segs; i++) {
          const f = i / segs;
          const w = rr * (2.5 - f * 1.8), h = rr * (0.5 - f * 0.35) * (1 + Math.sin(tt * 2 + i) * 0.1);
          const sx = x + side * (rr * 0.3 + w * 0.5), sz = z;
          const col = FRAGMENT_COLS[i % 4];
          const cc = R.hexRGB(col);
          R.draw(U.rock3, mm(sx, hb + Math.sin(tt * 1.5 + i) * 4, sz, tt * 0.1 + i * 0.5, w * 0.4, h * 1.2, w * 0.3, i * 0.2), mat([cc[0] * 0.3, cc[1] * 0.3, cc[2] * 0.3], { rough: 0.4, metal: 0.4, emissive: [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5], emisK: 1.8, rim: 1.4, rimCol: cc }));
          R.glow(sx, hb, sz, w * 0.3, cc[0], cc[1], cc[2], 0.3 + 0.1 * Math.sin(tt * 3 + i), 0);
        }
      }
      for (let i = 0; i < 4; i++) {
        const ringR = rr * (0.8 + i * 0.3), rot = tt * (0.5 + i * 0.3) + i * 1.3;
        const col = FRAGMENT_COLS[i % 4], cc = R.hexRGB(col);
        R.draw(U.torus, mm(x, hb, z, rot, ringR, 1.5, ringR, 0.08, rot), mat(cc, { emissive: [cc[0] * 1.5, cc[1] * 1.5, cc[2] * 1.5], emisK: 2.0, shadow: false, rim: 1.8, rimCol: cc }));
      }
    }
    // event horizon — solid black disc with bright accretion ring
    R.draw(U.sphere, mm(x, hb, z, 0, rr * 0.4, rr * 0.16, rr * 0.4), mat([0.01, 0.01, 0.02], { rough: 0.05, metal: 0.1, emissive: [0, 0, 0], shadow: false }));
    R.draw(U.torus, mm(x, hb, z, tt * 2, rr * 0.44, rr * 0.44, rr * 0.12, 0.05), mat([1.5, 0.8, 2.2], { emissive: [2.0, 1.0, 2.8], emisK: 2.6, shadow: false, rim: 2.2, rimCol: AC }));
    R.glow(x, hb, z, rr * 2.8, AC[0], AC[1], AC[2], 0.8 + 0.2 * Math.sin(tt * 3), 0);
    R.light(x, z, hb, 400, AC[0], AC[1], AC[2], 0.9);
    // floating mini-singularities
    for (let i = 0; i < 5; i++) {
      const a = tt * 0.4 + i * 1.26, d = rr * (2.2 + Math.sin(tt + i) * 0.3);
      const mx = x + Math.cos(a) * d, mz = z + Math.sin(a) * d;
      R.draw(U.sphere, mm(mx, hb + Math.sin(tt * 2 + i) * 6, mz, 0, 3, 3, 3), mat([0.02, 0.01, 0.03], { rough: 0.1, shadow: false }));
      R.draw(U.torus, mm(mx, hb + Math.sin(tt * 2 + i) * 6, mz, tt * 3, 4, 4, 4, 0.1), mat([1.5, 0.8, 2.2], { emissive: [2.0, 1.0, 2.8], emisK: 2.4, shadow: false }));
      R.glow(mx, hb, mz, 8, AC[0], AC[1], AC[2], 0.6, 0);
    }
    // void particle stream
    for (let i = 0; i < 12; i++) {
      if (Math.random() < 0.6 * (R.q.parts || 1)) {
        const a = Math.random() * 6.28, d = rr * (1 + Math.random() * 1.5);
        R.emit({ x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d, vx: -Math.cos(a) * 15, vy: 5 + Math.random() * 15, vz: -Math.sin(a) * 15, life: 1.5, age: 0, s0: 4, s1: 1, col: AC, a: 0.6, kind: 0, drag: 0.8 });
      }
    }
    R.decal(x, z, rr * 3, AC[0], AC[1], AC[2], 0.3 + 0.1 * Math.sin(tt * 2), 9, tt * 0.5, 0, true, 1.4);
  }

  function drawPhaseAnim3D(R, e, pa, tt, hb) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 44;
    const p = Math.min(1, pa.t / pa.dur), fade = 1 - p, ringR = rr + p * 540;
    const AC = R.hexRGB(ACCENT);
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 10 * fade, ringR, 0.18), mat([1.2, 0.7, 1.8], { emissive: [1.8, 1.0, 2.6], emisK: 2.4, alpha: 0.9 * fade, shadow: false }));
    R.glow(x, hb, z, rr * (1.4 + p * 1.2), AC[0], AC[1], AC[2], 0.9 * fade, 0);
    R.light(x, z, hb + 20, 340 + p * 280, AC[0], AC[1], AC[2], 0.9 * fade);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.85) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.4 + Math.random() * 1.8);
        R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (24 + 50 * fade), vy: 70 + Math.random() * 90, vz: Math.sin(a) * (24 + 50 * fade), life: 1.0, age: 0, s0: 10, s1: 2, col: AC, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.45 * fade);
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const AC = R.hexRGB(ACCENT);
    const active = cur.phase === 'active', tele = cur.phase === 'tele';
    const tp = tele ? cur.t / cur.phases.tele : 1;

    if ((cur.key === 'voidPulse') && cur.cx !== undefined) {
      voidSigil3D(R, cur.cx, cur.cy, 80, AC, tp, tt);
      if (active && cur.r !== undefined) {
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
          const rx = cur.cx + Math.cos(a) * cur.r, rz = cur.cy + Math.sin(a) * cur.r;
          R.draw(U.rock3, mm(rx, 10, rz, a * 2 + i, 6, 14, 6, i * 0.2), mat([0.1, 0.05, 0.15], { rough: 0.5, metal: 0.3, emissive: [AC[0] * 0.8, AC[1] * 0.8, AC[2] * 0.8], emisK: 1.8 }));
        }
        R.glow(cur.cx, 12, cur.cy, cur.r * 0.6, AC[0], AC[1], AC[2], 0.5, 0);
      }
    } else if ((cur.key === 'voidBeam' || cur.key === 'eventHorizon')) {
      const prog = tele ? tp : Math.min(1, cur.t / cur.phases.active);
      const ang = cur.ang0 + cur.sweep * (tele ? 1 : prog);
      const ex = cur.cx + Math.cos(ang) * cur.len, ez = cur.cy + Math.sin(ang) * cur.len;
      const mx = (cur.cx + ex) / 2, mz = (cur.cy + ez) / 2;
      R.draw(U.cyl, mm(mx, 26, mz, ang, cur.thick * 0.4, 26, cur.thick * 0.4), mat([1.2, 0.7, 1.8], { emissive: [1.8, 1.0, 2.6], emisK: 2.4, rough: 0.2, shadow: false, rim: 2.0, rimCol: AC }));
      R.glow(ex, 26, ez, cur.thick * 2, AC[0], AC[1], AC[2], 0.7, 0);
      R.light(ex, ez, 26, 160, AC[0], AC[1], AC[2], 0.7);
    } else if (cur.key === 'voidRift' && cur.zones) {
      for (const z of cur.zones) {
        voidSigil3D(R, z.x, z.y, z.r, AC, tp, tt);
        R.glow(z.x, 4, z.y, z.r, AC[0], AC[1], AC[2], 0.5 * tp, 0);
      }
    } else if (cur.key === 'voidChains') {
      const p = tele ? 0 : Math.min(1, cur.t / cur.phases.active);
      const r = Math.max(8, cur.r0 * (1 - p * 0.76));
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
        const rx = cur.cx + Math.cos(a) * r, rz = cur.cy + Math.sin(a) * r;
        R.draw(U.torus, mm(rx, 16, rz, a, 4, 2, 4, 0.18), mat([0.3, 0.15, 0.4], { rough: 0.4, metal: 0.6, emissive: [AC[0] * 0.5, AC[1] * 0.5, AC[2] * 0.5], emisK: 1.5, rim: 1.0, rimCol: AC }));
      }
    } else if (cur.key === 'voidShards' && cur.proj) {
      for (const p of cur.proj) {
        R.draw(U.octa, mm(p.x, 20, p.y, tt * 3, p.r * 0.8, p.r * 1.2, p.r * 0.8), mat([1.2, 0.7, 1.8], { emissive: [1.8, 1.0, 2.6], emisK: 2.2, shadow: false, rim: 1.8, rimCol: AC }));
        R.glow(p.x, 20, p.y, p.r * 3, AC[0], AC[1], AC[2], 0.6, 0);
      }
    } else if (cur.key === 'voidField' || cur.key === 'singularityCollapse') {
      if (cur.safeAng !== undefined) {
        for (let i = 0; i < 5; i++) {
          const a = cur.safeAng + (i / 4 - 0.5) * cur.safeHalf * 2;
          const len = 900 * tp;
          R.decal(cur.cx + Math.cos(a) * len * 0.5, cur.cy + Math.sin(a) * len * 0.5, 26, 0.3, 0.7, 0.4, 0.25 * tp, 8, a, 0, true, 8.0);
        }
      }
      if (active && cur.maxR !== undefined && cur.key === 'singularityCollapse') {
        const p = Math.min(1, cur.t / cur.phases.active), r = cur.maxR * (1 - p * 0.85);
        R.draw(U.torus, mm(cur.cx, 10, cur.cy, tt * 2, Math.max(1, r), 3, Math.max(1, r), 0.15), mat([1.5, 0.8, 2.2], { emissive: [2.0, 1.0, 2.8], emisK: 2.6, shadow: false, rim: 2.0, rimCol: AC }));
        R.glow(cur.cx, 10, cur.cy, r, AC[0], AC[1], AC[2], 0.7, 0);
      }
    } else if (cur.key === 'fractureLattice' && cur.cells) {
      for (const cell of cur.cells) {
        const safe = cell.safe;
        const c = safe ? [0.3, 0.7, 0.4] : AC;
        R.decal(cell.x, cell.y, cell.r, c[0], c[1], c[2], (safe ? 0.2 : 0.4) * tp, 8, tt, 0, true, 1.5);
        if (!safe) R.glow(cell.x, 4, cell.y, cell.r, c[0], c[1], c[2], 0.4 * tp, 0);
      }
    } else if (cur.key === 'gravityUndertow') {
      R.decal(cur.cx, cur.cy, cur.pullR, AC[0], AC[1], AC[2], 0.15 * tp, 9, tt, 0, true, 1.4);
      if (cur.debris) for (const db of cur.debris) {
        R.draw(U.rock3, mm(db.x, 40, db.y, tt * 2, db.r * 0.5, 40, db.r * 0.5, 0.2), mat([0.1, 0.05, 0.15], { rough: 0.5, metal: 0.3, emissive: [AC[0] * 0.5, AC[1] * 0.5, AC[2] * 0.5], emisK: 1.6 }));
        R.glow(db.x, 4, db.y, db.r, AC[0], AC[1], AC[2], 0.3 * tp, 0);
      }
    } else if (cur.key === 'riftNeedle' && cur.portals) {
      for (const p of cur.portals) {
        R.draw(U.torus, mm(p.x, 20, p.y, tt * 3, 14, 14, 14, 0.1), mat([1.5, 0.8, 2.2], { emissive: [2.0, 1.0, 2.8], emisK: 2.4, shadow: false, rim: 2.0, rimCol: AC }));
        R.glow(p.x, 20, p.y, 20, AC[0], AC[1], AC[2], 0.6, 0);
        for (const sh of p.shots) {
          R.draw(U.octa, mm(sh.x, 20, sh.y, tt * 5, sh.r * 0.8, sh.r * 1.5, sh.r * 0.8), mat([1.2, 0.7, 1.8], { emissive: [1.8, 1.0, 2.6], emisK: 2.2, shadow: false }));
          R.glow(sh.x, 20, sh.y, sh.r * 3, AC[0], AC[1], AC[2], 0.5, 0);
        }
      }
    }
  }

  function voidSigil3D(R, x, z, r, col, intensity, tt) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5 * intensity, 9, tt * 0.6, 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7 * intensity, 6, -tt * 0.6 * 1.4, 0, true, 1.6);
    R.decal(x, z, r * 0.34, Math.min(1, col[0] * 1.3), Math.min(1, col[1] * 1.3), Math.min(1, col[2] * 1.3), 0.9 * intensity, 12, tt * 0.6 * 2, 0, true, 1.8);
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 48; e.hp = e.maxhp = 3400; e.speed = 88; e.cd = 99; e.detectR = 1200;
    e.absorbing = true;
    e._vb = { form: 1, stage: 1, cur: null, last: null, lastEcho: null, idle: 1.0, hitFlash: 0, intro: 1.8, echoCache: {}, phaseAnim: null, morphed: false };
    injectShieldWarn();
  }

  function onHit(e, dmg) {
    if (!e._vb) return;
    e._vb.hitFlash = Math.min(1, (e._vb.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  // ---- public API ----
  window.VoidBoss = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    hideShieldWarn,
    get form() { return 0; },
    ACCENT
  };
})();
