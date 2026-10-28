// ============================================================
// Monster Arena — THE RIME ORACLE (Story Realm 3 Boss)
// An icebound seer whose power is FORESIGHT. Every attack predicts
// or controls the player's future position. Mechanically and
// visually distinct from every other boss — no line-lances, no
// mirror-clones, no radial-shard-halos, no falling-sand zones.
//
// Stage 1 (100–75%): Prophet Strike, Frost Cross
// Stage 2 (75–50%):  + Oracle Gaze, Memory Missiles
// Stage 3 (50–25%):  + Inverted Freeze, Rime Vents
// Stage 4 (25–0%):   + Blizzard Veil, Fate Cascade
// Earlier attacks remain available in every later stage.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#9fe3ff';     // frost cyan
  const GLYPH = '#7fd4ff';       // glowing chest sigil
  const ICE = '#bfe9ff';         // ice crystal
  const FROST = '#eaf6ff';       // frost white
  const WARM = '#ffd9a0';        // warm safe-spot glow (inverted freeze)

  let env = null;
  function E() { return env; }

  // ---- shield warning banner ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `
      #roShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
        padding:11px 24px;border-radius:999px;pointer-events:none;display:none;
        font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;
        color:#eaf6ff;background:rgba(6,14,26,.84);
        border:1px solid #9fe3ff;text-shadow:0 0 12px rgba(159,227,255,.6);
        white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;
        animation:roWarnPulse 1.6s ease-in-out infinite;}
      @keyframes roWarnPulse{0%,100%{box-shadow:0 0 22px rgba(159,227,255,.4),inset 0 0 12px rgba(159,227,255,.14)}
        50%{box-shadow:0 0 38px rgba(159,227,255,.8),inset 0 0 20px rgba(159,227,255,.3)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'roShieldWarn';
    warnEl.textContent = "🛡️ The Archive is frozen — clear all monsters first!";
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  // ---- boss sprite ----
  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/b5c3af675_Designer3.png';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = SPRITE_SRC;
  let imgReady = false;
  img.onload = () => { imgReady = true; };
  img.onerror = () => { imgReady = false; };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / l2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ---- attack definitions ------------------------------------------------
  // Each: { name, minStage, windup, tele, active, recover, build(e,cur), tick(e,cur,dt) }
  // build() runs once at the tele→active transition. tick() runs every frame
  // during active. The Oracle's signature: attacks PREDICT or CONTROL movement.
  const ATTACKS = {
    // 1. A rune-circle that HOMES onto the player during telegraph, then locks
    //    and a single colossal icicle impales that spot. No other boss tracks
    //    you during the windup.
    prophetStrike: {
      name: 'Prophet Strike', minStage: 1, windup: 0.5, tele: 0.9, active: 0.7, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.x = pl.x; cur.y = pl.y;      // locked at the moment of strike
        cur.r = 72; cur.dmg = 22;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if (env.dist2(pl.x, pl.y, cur.x, cur.y) < (cur.r + pl.r) * (cur.r + pl.r)) {
          env.hurtPlayer(cur.dmg * dt * 2.2);
        }
      }
    },
    // 2. Two perpendicular ice beams from the boss that ROTATE together as a
    //    cross. Stay between the arms. (Pharaoh's Refraction Beam is a single
    //    beam; this is a spinning plus-sign.)
    frostCross: {
      name: 'Frost Cross', minStage: 1, windup: 0.55, tele: 0.7, active: 2.2, recover: 0.6,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        cur.spin = 0.9; cur.len = 640; cur.thick = 44; cur.dmg = 16;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.ang += cur.spin * dt;
        const arms = [cur.ang, cur.ang + Math.PI / 2];
        for (const a of arms) {
          const ex = cur.cx + Math.cos(a) * cur.len, ey = cur.cy + Math.sin(a) * cur.len;
          if (pSeg(pl.x, pl.y, cur.cx, cur.cy, ex, ey) < cur.thick + pl.r) {
            env.hurtPlayer(cur.dmg * dt * 1.8); break;
          }
        }
      }
    },
    // 3. A floating Oracle Eye anchors away from the boss and sweeps a wide
    //    CONE of freezing gaze. Caught in the cone = deep freeze + damage.
    //    No other boss uses a sweeping cone.
    oracleGaze: {
      name: 'Oracle Gaze', minStage: 2, windup: 0.6, tele: 0.7, active: 3.0, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        const a = Math.atan2(pl.y - e.y, pl.x - e.x);
        cur.ex = clamp(e.x + Math.cos(a) * 360, 80, env.world.w - 80);
        cur.ey = clamp(e.y + Math.sin(a) * 360, 80, env.world.h - 80);
        cur.sweep = a + Math.PI;            // start facing back toward boss
        cur.spin = 0.7; cur.half = 0.42; cur.range = 1000; cur.dmg = 12; cur.slowT = 1.6;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.sweep += cur.spin * dt;
        const d = Math.hypot(pl.x - cur.ex, pl.y - cur.ey);
        if (d < cur.range) {
          const a = Math.atan2(pl.y - cur.ey, pl.x - cur.ex);
          let diff = Math.abs(((a - cur.sweep + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < cur.half) { env.hurtPlayer(cur.dmg * dt * 1.6); pl.slowT = Math.max(pl.slowT || 0, cur.slowT); }
        }
      }
    },
    // 4. Seeking memory shards: a volley of slow crystals that gently HOME on
    //    the player for a short window, then commit to a straight path. Other
    //    bosses fire straight bullets; these curve.
    memoryMissiles: {
      name: 'Memory Missiles', minStage: 2, windup: 0.6, tele: 0.5, active: 2.6, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.missiles = [];
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const sx = e.x + Math.cos(a) * 50, sy = e.y + Math.sin(a) * 50;
          const sa = Math.atan2(pl.y - sy, pl.x - sx);
          cur.missiles.push({
            x: sx, y: sy, vx: Math.cos(sa) * 150, vy: Math.sin(sa) * 150,
            homing: 0.7, r: 9, dmg: 12, life: 2.6
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const m of cur.missiles) {
          m.life -= dt;
          if (m.homing > 0) {
            m.homing -= dt;
            const sa = Math.atan2(pl.y - m.y, pl.x - m.x);
            const tvx = Math.cos(sa) * 220, tvy = Math.sin(sa) * 220;
            m.vx = env.lerp(m.vx, tvx, 0.06); m.vy = env.lerp(m.vy, tvy, 0.06);
          }
          m.x += m.vx * dt; m.y += m.vy * dt;
          if (env.dist2(pl.x, pl.y, m.x, m.y) < (m.r + pl.r) * (m.r + pl.r)) {
            env.hurtPlayer(m.dmg * dt * 4); m.life = 0;
          }
        }
        cur.missiles = cur.missiles.filter(m => m.life > 0 && m.x > -80 && m.x < env.world.w + 80 && m.y > -80 && m.y < env.world.h + 80);
      }
    },
    // 5. INVERTED safe-zone: the whole floor becomes a freezing DOT; only a few
    //    small WARM circles (that drift) are safe. Cataclysm uses lanes; this
    //    uses moving point-safe-spots covering the whole arena.
    invertedFreeze: {
      name: 'Inverted Freeze', minStage: 3, windup: 0.7, tele: 0.8, active: 3.2, recover: 0.8,
      build(e, cur) {
        cur.safe = [];
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + env.rand(0, 0.6);
          const d = 200 + env.rand(0, 220);
          cur.safe.push({
            x: clamp(e.x + Math.cos(a) * d, 100, env.world.w - 100),
            y: clamp(e.y + Math.sin(a) * d, 100, env.world.h - 100),
            vx: env.rand(-60, 60), vy: env.rand(-60, 60), r: 78
          });
        }
        cur.dmg = 11; cur.slowT = 1.0;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        let safe = false;
        for (const s of cur.safe) {
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x < 90 || s.x > env.world.w - 90) s.vx *= -1;
          if (s.y < 90 || s.y > env.world.h - 90) s.vy *= -1;
          if (env.dist2(pl.x, pl.y, s.x, s.y) < (s.r + pl.r) * (s.r + pl.r)) safe = true;
        }
        if (!safe) { env.hurtPlayer(cur.dmg * dt); pl.slowT = Math.max(pl.slowT || 0, cur.slowT); }
      }
    },
    // 6. A RANK of ice geysers erupts in SEQUENCE along a line. Cross the rank
    //    between eruptions. (Falling Glaciers/Dune Wake are scattered delayed
    //    falls; this is a marching line you must dart through.)
    rimeVents: {
      name: 'Rime Vents', minStage: 3, windup: 0.7, tele: 0.8, active: 3.0, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.dir = Math.atan2(pl.y - e.y, pl.x - e.x) + Math.PI / 2; // rank runs perpendicular to player
        cur.n = 7; cur.spacing = 116; cur.colR = 46; cur.upT = 0.9; cur.step = 0.22; cur.dmg = 18;
        cur.cols = [];
        for (let i = 0; i < cur.n; i++) {
          const off = (i - (cur.n - 1) / 2) * cur.spacing;
          cur.cols.push({
            x: cur.cx + Math.cos(cur.dir) * off,
            y: cur.cy + Math.sin(cur.dir) * off,
            fire: i * cur.step, up: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const c of cur.cols) {
          if (!c.up && age >= c.fire) c.up = true;
          if (c.up && age < c.fire + cur.upT) {
            if (env.dist2(pl.x, pl.y, c.x, c.y) < (cur.colR + pl.r) * (cur.colR + pl.r)) {
              env.hurtPlayer(cur.dmg * dt * 1.6); pl.slowT = Math.max(pl.slowT || 0, 0.8);
            }
          }
        }
      }
    },
    // 7. SURVIVAL veil: a blizzard drops visibility and spawns slow homing
    //    snow clouds that drift toward the player. Outlast them. (No damage
    //    zones on the floor — pure pursuit pressure, distinct from everything.)
    blizzardVeil: {
      name: 'Blizzard Veil', minStage: 4, windup: 0.8, tele: 0.6, active: 4.0, recover: 1.0,
      build(e, cur) {
        cur.clouds = [];
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          cur.clouds.push({
            x: e.x + Math.cos(a) * 240, y: e.y + Math.sin(a) * 240,
            r: 52, dmg: 10, slowT: 1.4, life: 4.0
          });
        }
        cur.dmg = 10;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const c of cur.clouds) {
          c.life -= dt;
          const sa = Math.atan2(pl.y - c.y, pl.x - c.x);
          const sp = 90;
          c.x += Math.cos(sa) * sp * dt; c.y += Math.sin(sa) * sp * dt;
          if (env.dist2(pl.x, pl.y, c.x, c.y) < (c.r + pl.r) * (c.r + pl.r)) {
            env.hurtPlayer(c.dmg * dt * 1.4); pl.slowT = Math.max(pl.slowT || 0, c.slowT);
          }
        }
        cur.clouds = cur.clouds.filter(c => c.life > 0);
      }
    },
    // 8. FATE CASCADE: the Oracle reads the player's VELOCITY and marks 5
    //    future positions along the predicted path, striking each in sequence.
    //    Break your trajectory to avoid. (Unique: uses player velocity to
    //    extrapolate, not a fixed pattern.)
    fateCascade: {
      name: 'Fate Cascade', minStage: 4, windup: 0.9, tele: 0.7, active: 2.8, recover: 0.9,
      build(e, cur) {
        const pl = env.player;
        const pvx = pl.vx || 0, pvy = pl.vy || 0;
        const sp = Math.hypot(pvx, pvy);
        const fx = sp > 1 ? pvx / sp : Math.cos(Math.atan2(pl.y - e.y, pl.x - e.x));
        const fy = sp > 1 ? pvy / sp : Math.sin(Math.atan2(pl.y - e.y, pl.x - e.x));
        cur.strikes = [];
        const n = 5;
        const lead = 140;
        for (let i = 0; i < n; i++) {
          const d = lead + i * 150;
          cur.strikes.push({
            x: clamp(pl.x + fx * d, 60, env.world.w - 60),
            y: clamp(pl.y + fy * d, 60, env.world.h - 60),
            r: 62, dmg: 20, delay: i * 0.28, land: 0.5, done: false
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const s of cur.strikes) {
          if (age < s.delay) continue;
          const local = age - s.delay;
          if (local < s.land && !s.done) {
            if (env.dist2(pl.x, pl.y, s.x, s.y) < (s.r + pl.r) * (s.r + pl.r)) {
              env.hurtPlayer(s.dmg * dt * 2.0);
            }
          } else if (local >= s.land) s.done = true;
        }
      }
    }
  };

  function stageInterval(stage) { return [1.3, 1.0, 0.7, 0.45][stage - 1] || 0.45; }

  function stageFor(e) {
    const r = (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1);
    if (r > 0.75) return 1;
    if (r > 0.50) return 2;
    if (r > 0.25) return 3;
    return 4;
  }

  function availableAttacks(stage) {
    const out = [];
    for (const k in ATTACKS) if (ATTACKS[k].minStage <= stage) out.push(k);
    return out;
  }

  function pickNext(e) {
    const s = e._ro.stage;
    const pool = availableAttacks(s);
    let opts = pool;
    if (e._ro.last && pool.length > 1) opts = pool.filter(k => k !== e._ro.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    e._ro.last = k;
    return k;
  }

  function startAttack(e, key) {
    const A = ATTACKS[key];
    const cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
    e._ro.cur = cur;
  }

  function tick(e, dt) {
    if (!env) return;
    if (!e._ro) {
      e._ro = { stage: 1, cur: null, last: null, idle: 0.8, hitFlash: 0, intro: 1.4, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5 };
    }
    const ro = e._ro;
    ro.hitFlash = Math.max(0, ro.hitFlash - dt);
    ro.dodgeCD = Math.max(0, (ro.dodgeCD || 0) - dt);
    if (ro.intro > 0) { ro.intro -= dt; e.vx = 0; e.vy = 0; return; }

    if (ro.dodgeT > 0) {
      ro.dodgeT -= dt;
      e.vx = ro.dodgeVx; e.vy = ro.dodgeVy;
      ro.dodgeVx *= 0.86; ro.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (ro.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      if (env.addEffect && Math.random() < 0.4) env.addEffect(e.x, e.y, 'pop', 0.3, FROST);
      return;
    }

    if (e.absorbing) {
      ro.cur = null;
      const pl = env.player;
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 0.45;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.10);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.10);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      setShieldWarn(true);
      return;
    }
    setShieldWarn(false);

    if (ro.phaseAnim) {
      ro.phaseAnim.t += dt;
      const pa = ro.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { ro.phaseAnim = null; ro.idle = 0.5; ro.cur = null; }
      return;
    }

    const ns = stageFor(e);
    if (ns !== ro.stage) {
      const old = ro.stage;
      ro.stage = ns;
      ro.cur = null;
      ro.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'glacial', accent: ACCENT, name: 'The Rime Oracle', from: old, to: ns });
      return;
    }

    if (ro.dodgeCD <= 0 && !ro.cur && env.ents && env.ents.bullets) {
      const dodgeChance = [0, 0.20, 0.32, 0.48, 0.62][ro.stage] || 0.3;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 380 || d < 6) continue;
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        const closing = (dx * (b.vx || 0) + dy * (b.vy || 0)) / spd;
        if (closing <= 0) continue;
        if (env.rand(0, 1) > dodgeChance) { ro.dodgeCD = 0.8; break; }
        const bvnx = (b.vx || 0) / spd, bvny = (b.vy || 0) / spd;
        let nx = -bvny, ny = bvnx;
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.6 + ro.stage * 0.25);
        ro.dodgeVx = nx * dashSp; ro.dodgeVy = ny * dashSp;
        ro.dodgeT = 0.28; ro.dodgeCD = 1.6 - ro.stage * 0.15;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, FROST);
        return;
      }
    }

    const pl = env.player;
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    let moving = true;
    if (ro.cur) {
      const c = ro.cur;
      if (c.phase === 'windup' || c.phase === 'active') moving = (c.key === 'prophetStrike' || c.key === 'frostCross');
    }
    if (moving && d2p > 160 * 160) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 1.1;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.18);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.18);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    if (!ro.cur) {
      ro.idle -= dt;
      if (ro.idle <= 0) startAttack(e, pickNext(e));
      return;
    }
    const c = ro.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.4 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      ATTACKS[c.key].build(e, c);
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
    }
    else if (c.phase === 'active' && c.t >= P.active) {
      c.phase = 'recover'; c.t = 0;
      c.zones = null; c.shards = null; c.missiles = null; c.safe = null; c.cols = null; c.clouds = null; c.strikes = null;
    }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      ro.cur = null;
      ro.idle = stageInterval(ro.stage);
      return;
    }
    if (c.phase === 'active') ATTACKS[c.key].tick(e, c, dt);
  }

  // ---- 2D rendering ----
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 40;
    const ro = e._ro || {};
    const stage = ro.stage || 1;

    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rr * 0.7, rr * 0.95, rr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (1.6 + stage * 0.18);
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 + stage));
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.4, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(159,227,255,' + (0.18 + 0.05 * stage) + ')');
    ag.addColorStop(0.6, 'rgba(127,212,255,' + (0.12 * pulse) + ')');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const ang = env.angleTo ? env.angleTo(e.x, e.y, env.player.x, env.player.y) : Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    if (imgReady) {
      const dR = rr + 16;
      ctx.drawImage(img, -dR, -dR, dR * 2, dR * 2);
    } else {
      ctx.fillStyle = '#3a6a8a';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    }
    if (ro.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = ro.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gI = 0.6 + 0.3 * Math.sin(t * 3) + (stage - 1) * 0.12;
    const gg = ctx.createRadialGradient(cx, cy - rr * 0.1, 2, cx, cy - rr * 0.1, rr * 0.7);
    gg.addColorStop(0, 'rgba(220,245,255,' + Math.min(1, gI) + ')');
    gg.addColorStop(0.5, 'rgba(127,212,255,' + (0.4 * gI) + ')');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy - rr * 0.1, rr * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (e.absorbing) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const shR = rr * 1.7 + Math.sin(t * 3) * 4;
      const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
      sg.addColorStop(0, 'rgba(159,227,255,0)');
      sg.addColorStop(0.7, 'rgba(159,227,255,0.18)');
      sg.addColorStop(1, 'rgba(159,227,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(159,227,255,0.85)';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (ro.cur) drawTelegraph2D(ctx, ro.cur, t);
    if (ro.phaseAnim) drawPhaseAnim2D(ctx, e, ro.phaseAnim, t);

    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#9fe3ff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, -Math.PI / 2, -Math.PI / 2 + hpR * 2 * Math.PI); ctx.stroke();
  }

  function drawPhaseAnim2D(ctx, e, pa, t) {
    if (!env) return;
    const cam = env.cam;
    const sx = (x) => x - cam.x - cam.sx;
    const sy = (y) => y - cam.y - cam.sy;
    const p = Math.min(1, pa.t / pa.dur);
    const cx = sx(e.x), cy = sy(e.y);
    const rr = e.r || 42;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ringR = rr + p * 520;
    ctx.strokeStyle = 'rgba(220,245,255,' + (0.9 * (1 - p)) + ')';
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(159,227,255,' + (0.7 * (1 - p)) + ')';
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.78, 0, Math.PI * 2); ctx.stroke();
    const flash = 1 - p;
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.4);
    fg.addColorStop(0, 'rgba(230,250,255,' + (0.85 * flash) + ')');
    fg.addColorStop(0.5, 'rgba(127,212,255,' + (0.5 * flash) + ')');
    fg.addColorStop(1, 'rgba(159,227,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 2.4, 0, Math.PI * 2); ctx.fill();
    const n = 3;
    for (let i = 0; i < n; i++) {
      const rr2 = rr * (1.2 + i * 0.5) * (0.5 + 0.5 * p);
      ctx.strokeStyle = 'rgba(127,212,255,' + (0.6 * (1 - p)) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -t * 60 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawTelegraph2D(ctx, cur, t) {
    if (!env) return;
    const cam = env.cam;
    const sx = (x) => x - cam.x - cam.sx;
    const sy = (y) => y - cam.y - cam.sy;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    if (cur.phase === 'tele' || cur.phase === 'active') {
      const tele = cur.phase === 'tele';
      const tp = tele ? cur.t / cur.phases.tele : 1;

      if (cur.key === 'prophetStrike') {
        // homing rune during tele: follows the live player; locks at active
        const pl = env.player;
        const hx = tele ? pl.x : cur.x, hy = tele ? pl.y : cur.y;
        const r = (tele ? 0.5 + 0.5 * tp : 1) * cur.r;
        ctx.strokeStyle = 'rgba(220,245,255,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 50;
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(159,227,255,0.18)';
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), r, 0, Math.PI * 2); ctx.fill();
        // inner locking glyph
        ctx.strokeStyle = 'rgba(127,212,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), r * 0.5, t * 2, t * 2 + Math.PI * 1.6); ctx.stroke();
      } else if (cur.key === 'frostCross') {
        const prog = tele ? tp : Math.min(1, cur.t / cur.phases.active);
        const arms = [cur.ang, cur.ang + Math.PI / 2];
        for (const a of arms) {
          const ex = cur.cx + Math.cos(a) * cur.len * prog, ey = cur.cy + Math.sin(a) * cur.len * prog;
          ctx.strokeStyle = 'rgba(159,227,255,' + (tele ? 0.5 * tp : 0.8) + ')';
          ctx.lineWidth = cur.thick * 0.6;
          ctx.beginPath(); ctx.moveTo(sx(cur.cx), sy(cur.cy)); ctx.lineTo(sx(ex), sy(ey)); ctx.stroke();
          ctx.strokeStyle = 'rgba(220,245,255,0.9)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(sx(cur.cx), sy(cur.cy)); ctx.lineTo(sx(ex), sy(ey)); ctx.stroke();
        }
      } else if (cur.key === 'oracleGaze') {
        // floating eye + sweeping cone
        ctx.fillStyle = 'rgba(159,227,255,0.3)';
        ctx.strokeStyle = 'rgba(220,245,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(cur.ex), sy(cur.ey), 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const a0 = cur.sweep - cur.half, a1 = cur.sweep + cur.half;
        ctx.fillStyle = 'rgba(127,212,255,' + (tele ? 0.1 * tp : 0.18) + ')';
        ctx.beginPath();
        ctx.moveTo(sx(cur.ex), sy(cur.ey));
        ctx.arc(sx(cur.ex), sy(cur.ey), cur.range, a0, a1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(220,245,255,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx(cur.ex), sy(cur.ey)); ctx.lineTo(sx(cur.ex) + Math.cos(a0) * cur.range, sy(cur.ey) + Math.sin(a0) * cur.range); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx(cur.ex), sy(cur.ey)); ctx.lineTo(sx(cur.ex) + Math.cos(a1) * cur.range, sy(cur.ey) + Math.sin(a1) * cur.range); ctx.stroke();
      } else if (cur.key === 'memoryMissiles' && cur.missiles) {
        for (const m of cur.missiles) {
          ctx.fillStyle = 'rgba(220,245,255,0.85)';
          ctx.strokeStyle = 'rgba(127,212,255,0.9)';
          ctx.lineWidth = 2;
          const sa = Math.atan2(m.vy, m.vx);
          ctx.save(); ctx.translate(sx(m.x), sy(m.y)); ctx.rotate(sa);
          ctx.beginPath(); ctx.moveTo(m.r * 1.6, 0); ctx.lineTo(0, m.r); ctx.lineTo(-m.r * 1.1, 0); ctx.lineTo(0, -m.r); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      } else if (cur.key === 'invertedFreeze' && cur.safe) {
        // whole-arena frost tint
        ctx.fillStyle = 'rgba(120,180,255,' + (tele ? 0.12 * tp : 0.22) + ')';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // warm safe circles
        for (const s of cur.safe) {
          const sg = ctx.createRadialGradient(sx(s.x), sy(s.y), 4, sx(s.x), sy(s.y), s.r);
          sg.addColorStop(0, 'rgba(255,235,190,0.5)');
          sg.addColorStop(0.7, 'rgba(255,210,150,0.25)');
          sg.addColorStop(1, 'rgba(255,210,150,0)');
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), s.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,225,170,0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30;
          ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), s.r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (cur.key === 'rimeVents' && cur.cols) {
        // rank guideline
        const dx = Math.cos(cur.dir), dy = Math.sin(cur.dir);
        const half = (cur.n - 1) / 2 * cur.spacing;
        ctx.strokeStyle = 'rgba(159,227,255,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(sx(cur.cx - dx * half), sy(cur.cy - dy * half)); ctx.lineTo(sx(cur.cx + dx * half), sy(cur.cy + dy * half)); ctx.stroke();
        ctx.setLineDash([]);
        for (const c of cur.cols) {
          const local = cur.t - c.fire;
          const up = local >= 0 && local < cur.upT;
          const rr2 = cur.colR * (up ? 1 : (tele ? tp * 0.6 : 0.6));
          ctx.fillStyle = up ? 'rgba(159,227,255,0.35)' : 'rgba(127,212,255,0.15)';
          ctx.strokeStyle = 'rgba(220,245,255,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y), rr2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'blizzardVeil' && cur.clouds) {
        for (const c of cur.clouds) {
          const cg = ctx.createRadialGradient(sx(c.x), sy(c.y), 4, sx(c.x), sy(c.y), c.r);
          cg.addColorStop(0, 'rgba(240,250,255,0.6)');
          cg.addColorStop(1, 'rgba(200,230,255,0)');
          ctx.fillStyle = cg;
          ctx.beginPath(); ctx.arc(sx(c.x), sy(c.y), c.r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (cur.key === 'fateCascade' && cur.strikes) {
        for (let i = 0; i < cur.strikes.length; i++) {
          const s = cur.strikes[i];
          const armed = cur.t >= s.delay;
          ctx.strokeStyle = armed ? 'rgba(255,210,160,0.9)' : 'rgba(159,227,255,0.6)';
          ctx.lineWidth = armed ? 3 : 2;
          ctx.setLineDash(armed ? [] : [8, 6]);
          ctx.beginPath(); ctx.arc(sx(s.x), sy(s.y), s.r, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          // path link
          if (i > 0) {
            const p = cur.strikes[i - 1];
            ctx.strokeStyle = 'rgba(159,227,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(sx(p.x), sy(p.y)); ctx.lineTo(sx(s.x), sy(s.y)); ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  // ---- 3D rendering ----
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const ro = e._ro || {};
    const stage = ro.stage || 1;
    const rr = e.r || 40;
    const x = e.x, z = e.y;
    const hb = rr * 1.2 + Math.sin(tt * 2.4) * 3;

    R.quads.alpha.push(x, 1.2, z, rr * 2.4, 0, 0, 0, 0.35, 0, 11, 0, 1);

    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const size = (rr + 18) * 2.4;
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
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        } else {
          R.draw(sp.mesh, mm(x, hb, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        }
      }
    }

    if (e.absorbing) {
      const pul = 0.5 + 0.5 * Math.sin(tt * 2.4);
      const shR = rr * 2.1;
      const sc = R.hexRGB(ACCENT);
      R.draw(U.sphere, mm(x, hb + shR * 0.55, z, tt * 0.3, shR, shR * 1.15, shR), mat(sc, { alpha: 0.10 + 0.05 * pul, emissive: [sc[0] * 0.4, sc[1] * 0.4, sc[2] * 0.4], rim: 1.6, rimCol: sc, shadow: false, rough: 0.2, metal: 0.2 }));
      R.draw(U.torus, mm(x, hb + 4, z, tt * 0.8, shR * 0.95, shR * 0.95, shR * 0.95, 0.12), mat([1, 1, 1], { emissive: sc, alpha: 0.5 + 0.2 * pul, shadow: false }));
      R.draw(U.torus, mm(x, hb + shR * 0.9, z, -tt * 0.6 + 1.2, shR * 0.7, shR * 0.7, shR * 0.7, 0.1), mat([1, 1, 1], { emissive: sc, alpha: 0.45, shadow: false }));
      R.glow(x, hb + shR * 0.5, z, shR * 1.4, sc[0], sc[1], sc[2], 0.35 + 0.15 * pul, 0);
      R.light(x, z, hb + shR, 320, sc[0], sc[1], sc[2], 0.7);
    }

    const gI = 0.7 + 0.3 * Math.sin(tt * 3) + (stage - 1) * 0.12;
    R.glow(x, hb, z, rr * 1.6, 0.5, 0.8, 1.0, Math.min(1, gI) * 0.8, 0);
    R.light(x, z, hb + 10, 160 + stage * 40, 0.4, 0.75, 1.1, 0.6 + 0.2 * Math.sin(tt * 3));

    const ringC = R.hexRGB(ACCENT);
    R.decal(x, z, rr * (2 + stage * 0.25), ringC[0], ringC[1], ringC[2], 0.25 + 0.1 * Math.sin(tt * 2), 9, tt * 0.6, 0, true, 1.4);

    const moteN = 1 + stage;
    for (let i = 0; i < moteN; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.6 + Math.random() * 0.8);
        R.emit({
          x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 10, vy: 26 + Math.random() * 24, vz: (Math.random() - 0.5) * 10,
          life: 1.1 + Math.random() * 0.6, age: 0, s0: 6, s1: 1,
          col: Math.random() < 0.5 ? R.hexRGB(ICE) : R.hexRGB(ACCENT), a: 0.8, kind: 0, drag: 0.7
        });
      }
    }

    if (ro.cur) drawTelegraph3D(R, ro.cur, tt);
    if (ro.phaseAnim) drawPhaseAnim3D(R, e, ro.phaseAnim, tt, hb);
  }

  function drawPhaseAnim3D(R, e, pa, tt, hb) {
    if (!env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 42;
    const p = Math.min(1, pa.t / pa.dur);
    const fade = 1 - p;
    const ringR = rr + p * 520;
    const A = R.hexRGB(ACCENT), G = R.hexRGB(GLYPH);
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 8 * fade, ringR, 0.18), mat([0.6, 0.85, 1.3], { emissive: [0.5, 0.9, 1.6], emisK: 2.2, alpha: 0.9 * fade, shadow: false }));
    R.draw(U.torus, mm(x, 6, z, -tt * 1.2, ringR * 0.78, 2 + 6 * fade, ringR * 0.78, 0.14), mat([0.4, 0.7, 1.1], { emissive: [0.3, 0.7, 1.2], emisK: 2.0, alpha: 0.8 * fade, shadow: false }));
    R.glow(x, hb, z, rr * (1.4 + p * 1.2), 0.5, 0.8, 1.2, 0.9 * fade, 0);
    R.light(x, z, hb + 20, 320 + p * 260, 0.5, 0.85, 1.3, 0.9 * fade);
    sigil(R, x, z, ringR * 0.9, [0.5, 0.85, 1.3], 0.7 * fade, tt, 0.8);
    sigil(R, x, z, ringR * 0.55, A, 0.6 * fade, tt, -0.6);
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.4 + Math.random() * 1.6);
        R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (20 + 40 * fade), vy: 60 + Math.random() * 80, vz: Math.sin(a) * (20 + 40 * fade), life: 1.0 + Math.random() * 0.6, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? R.hexRGB(ICE) : G, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.4 * fade);
  }

  function sigil(R, x, z, r, col, intensity, tt, spin) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5 * intensity, 9, tt * (spin || 0.6), 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7 * intensity, 6, -tt * (spin || 0.6) * 1.4, 0, true, 1.6);
    R.decal(x, z, r * 0.34, col[0] * 1.3, col[1] * 1.3, col[2] * 1.3, 0.9 * intensity, 12, tt * (spin || 0.6) * 2, 0, true, 1.8);
  }

  function iceSpike(R, x, z, baseR, h, col, emiCol, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    R.draw(U.rock3, mm(x, h * 0.5, z, seed * 2.3, baseR, h, baseR, seed * 0.2), mat(col, { rough: 0.15, metal: 0.35, emissive: emiCol, emisK: 1.6, rim: 1.6, rimCol: R.hexRGB(ICE) }));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      const tx = x + Math.cos(a) * baseR * 0.7, tz = z + Math.sin(a) * baseR * 0.7;
      const th = h * (0.5 + 0.18 * ((seed * 7 + i) % 3));
      R.draw(U.cone, mm(tx, th * 0.5, tz, a + Math.PI / 2, baseR * 0.26, th, baseR * 0.26, 0, Math.PI / 2 - 0.5), mat(col, { rough: 0.1, metal: 0.45, emissive: emiCol, emisK: 1.4, rim: 1.4, rimCol: R.hexRGB(ICE) }));
    }
    R.glow(x, h, z, baseR * 1.6, emiCol[0], emiCol[1], emiCol[2], 0.6, 0);
  }

  // long thin ice beam between two points (a row of stacked crystals)
  function iceBeam(R, ax, az, bx, bz, thick, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const ang = Math.atan2(dz, dx);
    const steps = Math.max(2, Math.floor(len / 70));
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const px = ax + dx * f, pz = az + dz * f;
      const h = thick * 2.4 * (0.7 + 0.3 * Math.sin(tt * 4 + i + seed));
      R.draw(U.rock3, mm(px, h * 0.5, pz, ang + i * 0.5 + seed, thick * 0.5, h, thick * 0.5, i * 0.1), mat([0.7, 0.9, 1.1], { rough: 0.1, metal: 0.4, emissive: [0.35, 0.6, 0.95], emisK: 1.8, rim: 1.5, rimCol: R.hexRGB(ICE) }));
      if (i % 2 === 0) R.glow(px, h, pz, thick * 1.4, 0.5, 0.8, 1.2, 0.5, 0);
    }
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const A = R.hexRGB(ACCENT);
    const ICEC = R.hexRGB(ICE);
    const GLYPHC = R.hexRGB(GLYPH);
    const WARMC = R.hexRGB(WARM);
    const active = cur.phase === 'active';
    const tele = cur.phase === 'tele';
    const tprog = tele ? cur.t / cur.phases.tele : 1;
    const aprog = active ? Math.min(1, cur.t / cur.phases.active) : 0;

    if (cur.key === 'prophetStrike') {
      const pl = env.player;
      const hx = tele ? pl.x : cur.x, hz = tele ? pl.y : cur.y;
      const r = (tele ? 0.5 + 0.5 * tprog : 1) * cur.r;
      sigil(R, hx, hz, r * 1.4, A, 0.6 * tprog + 0.4, tt, 0.6);
      if (active) {
        const h = 220 * Math.min(1, cur.t * 6);
        iceSpike(R, hx, hz, r * 0.7, h, [0.8, 0.95, 1.1], [0.6, 0.85, 1.2], tt, 0.3);
        R.glow(hx, h, hz, r * 2.0, 0.7, 0.9, 1.3, 0.9, 0);
        R.light(hx, hz, h, 360, 0.6, 0.85, 1.2, 0.9);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.2 * Math.min(1, cur.t * 5));
        if (Math.random() < 0.8) {
          const a = Math.random() * Math.PI * 2;
          R.emit({ x: hx + Math.cos(a) * r, y: h * Math.random(), z: hz + Math.sin(a) * r, vx: Math.cos(a) * 30, vy: 60 + Math.random() * 40, vz: Math.sin(a) * 30, life: 0.8, age: 0, s0: 8, s1: 2, col: ICEC, a: 0.8, kind: 0, drag: 0.6 });
        }
      } else {
        R.glow(hx, 4, hz, r * 1.2, 0.5, 0.8, 1.1, 0.4 * tprog, 0);
        R.decal(hx, hz, r * 0.5, GLYPHC[0], GLYPHC[1], GLYPHC[2], 0.5 * tprog, 12, -tt * 0.8, 0, true, 1.6);
      }
    } else if (cur.key === 'frostCross') {
      const prog = tele ? tprog : Math.min(1, cur.t / cur.phases.active);
      const arms = [cur.ang, cur.ang + Math.PI / 2];
      for (let ai = 0; ai < arms.length; ai++) {
        const a = arms[ai];
        const ex = cur.cx + Math.cos(a) * cur.len * prog, ez = cur.cy + Math.sin(a) * cur.len * prog;
        iceBeam(R, cur.cx, cur.cy, ex, ez, cur.thick * 0.4, tt, ai * 3.1);
      }
      R.glow(cur.cx, 24, cur.cy, cur.thick * 1.5, 0.5, 0.8, 1.2, 0.6, 0);
      R.light(cur.cx, cur.cy, 28, 260, 0.5, 0.8, 1.2, 0.6 + 0.2 * Math.sin(tt * 3));
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.12 * aprog : 0.05 * tprog);
    } else if (cur.key === 'oracleGaze') {
      // floating eye
      const ePul = 0.7 + 0.3 * Math.sin(tt * 4);
      R.draw(U.sphere, mm(cur.ex, 40, cur.ey, tt * 0.5, 18, 18, 18), mat([1.2, 1.4, 1.6], { emissive: [0.6, 0.9, 1.3], emisK: 2.0, rim: 1.8, rimCol: ICEC, shadow: false }));
      R.glow(cur.ex, 40, cur.ey, 60, 0.7, 0.9, 1.3, 0.8 * ePul, 0);
      R.light(cur.ex, cur.ey, 50, 200, 0.6, 0.85, 1.2, 0.8);
      // cone — fan of emissive planes + edge beams
      const a0 = cur.sweep - cur.half, a1 = cur.sweep + cur.half;
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        const ex = cur.ex + Math.cos(a) * cur.range * tprog, ez = cur.ey + Math.sin(a) * cur.range * tprog;
        if (i % 2 === 0) R.decal((cur.ex + ex) / 2, (cur.ey + ez) / 2, 26, 0.5, 0.8, 1.2, 0.25 * tprog, 8, a, 0, true, 6.0);
      }
      iceBeam(R, cur.ex, cur.ey, cur.ex + Math.cos(a0) * cur.range * tprog, cur.ey + Math.sin(a0) * cur.range * tprog, 4, tt, 1.1);
      iceBeam(R, cur.ex, cur.ey, cur.ex + Math.cos(a1) * cur.range * tprog, cur.ey + Math.sin(a1) * cur.range * tprog, 4, tt, 2.7);
      if (Math.random() < 0.5) {
        const a = cur.sweep + (Math.random() - 0.5) * cur.half * 2;
        R.emit({ x: cur.ex + Math.cos(a) * 40, y: 38, z: cur.ey + Math.sin(a) * 40, vx: Math.cos(a) * 60, vy: 10, vz: Math.sin(a) * 60, life: 1.2, age: 0, s0: 8, s1: 2, col: ICEC, a: 0.5, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'memoryMissiles' && cur.missiles) {
      for (const m of cur.missiles) {
        const sa = Math.atan2(m.vy, m.vx);
        R.draw(U.rock3, mm(m.x, 30, m.y, sa, m.r * 0.7, m.r * 2.2, m.r * 0.7, sa), mat([0.85, 0.95, 1.1], { rough: 0.1, metal: 0.5, emissive: [0.5, 0.8, 1.2], emisK: 1.8, rim: 1.6, rimCol: ICEC }));
        R.glow(m.x, 30, m.y, m.r * 2.2, 0.6, 0.85, 1.2, 0.7, 0);
        if (Math.random() < 0.6) R.emit({ x: m.x - Math.cos(sa) * 10, y: 30, z: m.y - Math.sin(sa) * 10, vx: -Math.cos(sa) * 8, vy: 6, vz: -Math.sin(sa) * 8, life: 0.7, age: 0, s0: 7, s1: 2, col: ICEC, a: 0.5, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'invertedFreeze' && cur.safe) {
      // floor-wide frost glow
      const W = env.world.w, H = env.world.h;
      R.decal(W / 2, H / 2, Math.hypot(W, H) * 0.6, 0.45, 0.7, 1.1, 0.22 * tprog, 11, tt * 0.1, 0, true, 8.0);
      R.light(W / 2, H / 2, 80, Math.hypot(W, H), 0.4, 0.65, 1.0, 0.3 * tprog);
      // warm safe domes
      for (const s of cur.safe) {
        R.draw(U.sphere, mm(s.x, s.r * 0.6, s.y, tt * 0.4, s.r, s.r * 0.8, s.r), mat([1.3, 1.0, 0.6], { emissive: [1.0, 0.7, 0.3], emisK: 1.4, alpha: 0.18, rim: 1.6, rimCol: WARMC, shadow: false, rough: 0.3 }));
        R.glow(s.x, s.r * 0.6, s.y, s.r * 1.8, 1.0, 0.75, 0.4, 0.5, 0);
        R.light(s.x, s.y, s.r, 200, 1.2, 0.85, 0.4, 0.6);
        sigil(R, s.x, s.y, s.r * 1.1, WARMC, 0.5, tt, 0.4);
      }
    } else if (cur.key === 'rimeVents' && cur.cols) {
      for (const c of cur.cols) {
        const local = cur.t - c.fire;
        const up = local >= 0 && local < cur.upT;
        if (up) {
          const rise = Math.min(1, local * 5);
          const h = cur.colR * 3.2 * rise;
          iceSpike(R, c.x, c.y, cur.colR * 0.7, h, [0.8, 0.95, 1.15], [0.5, 0.85, 1.3], tt, c.fire * 3 + 0.2);
          R.glow(c.x, h, c.y, cur.colR * 2.0, 0.6, 0.9, 1.3, 0.7 * rise, 0);
          R.light(c.x, c.y, h, 220, 0.55, 0.85, 1.2, 0.7);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.1 * rise);
        } else if (tele) {
          R.decal(c.x, c.y, cur.colR * tprog, 0.5, 0.8, 1.2, 0.4 * tprog, 8, tt * 0.3 + c.fire, 0, true, 1.6);
        }
      }
    } else if (cur.key === 'blizzardVeil' && cur.clouds) {
      for (const c of cur.clouds) {
        R.draw(U.sphere, mm(c.x, c.r * 0.7, c.y, tt * 0.3, c.r, c.r * 0.8, c.r), mat([1.1, 1.2, 1.3], { emissive: [0.7, 0.85, 1.0], emisK: 1.2, alpha: 0.4, rim: 1.4, rimCol: ICEC, shadow: false, rough: 0.6 }));
        R.glow(c.x, c.r * 0.7, c.y, c.r * 1.8, 0.85, 0.92, 1.0, 0.5, 0);
        for (let k = 0; k < 3; k++) {
          if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2, d = c.r * (0.5 + Math.random() * 0.8);
            R.emit({ x: c.x + Math.cos(a) * d, y: c.r * 0.7 + Math.random() * 20, z: c.y + Math.sin(a) * d, vx: (Math.random() - 0.5) * 14, vy: 10 + Math.random() * 14, vz: (Math.random() - 0.5) * 14, life: 1.4, age: 0, s0: 9, s1: 3, col: ICEC, a: 0.5, kind: 0, drag: 0.9 });
          }
        }
      }
    } else if (cur.key === 'fateCascade' && cur.strikes) {
      for (let i = 0; i < cur.strikes.length; i++) {
        const s = cur.strikes[i];
        const armed = cur.t >= s.delay;
        const local = cur.t - s.delay;
        if (armed && local < s.land) {
          const rise = Math.min(1, local * 6);
          const h = s.r * 3.0 * rise;
          iceSpike(R, s.x, s.y, s.r * 0.6, h, [1.0, 0.85, 0.6], [1.2, 0.7, 0.3], tt, i * 1.7 + 0.4);
          R.glow(s.x, h, s.y, s.r * 2.2, 1.2, 0.8, 0.4, 0.8 * rise, 0);
          R.light(s.x, s.y, h, 300, 1.3, 0.8, 0.4, 0.8);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.12 * rise);
        } else {
          const col = armed ? WARMC : A;
          sigil(R, s.x, s.y, s.r * 1.2, col, armed ? 0.7 : 0.4 * tprog, tt, 0.6 + i * 0.2);
          if (i > 0) {
            const pp = cur.strikes[i - 1];
            R.decal((pp.x + s.x) / 2, (pp.y + s.y) / 2, 22, 0.6, 0.8, 1.1, 0.3, 12, Math.atan2(s.y - pp.y, s.x - pp.x), 0, true, 4.0);
          }
        }
      }
    }
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 42; e.hp = e.maxhp = 2600; e.speed = 100; e.cd = 99; e.detectR = 1200;
    e.absorbing = true;
    e._ro = { stage: 1, cur: null, last: null, idle: 1.0, hitFlash: 0, intro: 1.4 };
    injectShieldWarn();
  }

  function onHit(e, dmg) {
    if (!e._ro) return;
    e._ro.hitFlash = Math.min(1, (e._ro.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  // ---- public API ----
  window.RimeOracle = {
    setEnv(_env) { env = _env; },
    initEnemy,
    tick,
    draw2D,
    draw3D,
    onHit,
    hideShieldWarn,
    get sprite() { return imgReady ? img : null; },
    ACCENT, GLYPH
  };
})();
