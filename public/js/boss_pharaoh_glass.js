// ============================================================
// Monster Arena — THE PHARAOH OF GLASS (Story Realm 2 Boss)
// An ancient skeletal pharaoh wielding sand, glass, mirages,
// and reflection. A 4-stage HP-based state machine that STACKS
// attacks as health drops, with realistic 3D physical telegraphs.
//
// Stage 1 (100–75%): Glass Lance, Dune Wake
// Stage 2 (75–50%):  + Mirror Doubles, Shattered Halo
// Stage 3 (50–25%):  + Burial Spiral, Refraction Beam
// Stage 4 (25–0%):   + Sandfall Cataclysm, King's Reflection
// Earlier attacks remain available in every later stage.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#e3b749';     // gold / amber
  const GLYPH = '#f7c036';       // glowing amber core
  const GLASS = '#d4af37';       // crystalline gold
  const SAND = '#c2b280';        // desert sand
  const GLOW = '#ffcc44';        // inner skull light

  let env = null;
  function E() { return env; }

  // ---- shield warning banner ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `
      #pgShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
        padding:11px 24px;border-radius:999px;pointer-events:none;display:none;
        font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;
        color:#fff5d6;background:rgba(16,12,6,.84);
        border:1px solid #e3b749;text-shadow:0 0 12px rgba(227,183,73,.6);
        white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;
        animation:pgWarnPulse 1.6s ease-in-out infinite;}
      @keyframes pgWarnPulse{0%,100%{box-shadow:0 0 22px rgba(227,183,73,.4),inset 0 0 12px rgba(227,183,73,.14)}
        50%{box-shadow:0 0 38px rgba(227,183,73,.8),inset 0 0 20px rgba(227,183,73,.3)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'pgShieldWarn';
    warnEl.textContent = "🛡️ The Pharaoh's tomb is sealed — clear all monsters first!";
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  // ---- boss sprite ----
  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/aa4797139_Designer2.png';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = SPRITE_SRC;
  let imgReady = false;
  img.onload = () => { imgReady = true; };
  img.onerror = () => { imgReady = false; };

  // ---- attack definitions ----
  const ATTACKS = {
    glassLance: {
      name: 'Glass Lance', minStage: 1, windup: 0.6, tele: 0.7, active: 0.5, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.ang = Math.atan2(pl.y - e.y, pl.x - e.x);
        cur.zones = [];
        // a narrow bright shard line
        const len = 900, n = 9;
        for (let i = 1; i <= n; i++) {
          const d = (i / n) * len;
          cur.zones.push({ x: e.x + Math.cos(cur.ang) * d, y: e.y + Math.sin(cur.ang) * d, r: 24 });
        }
        cur.dmg = 18;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 1.8);
            break;
          }
        }
      }
    },
    duneWake: {
      name: 'Dune Wake', minStage: 1, windup: 0.5, tele: 0.6, active: 2.4, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.ang = Math.atan2(pl.y - e.y, pl.x - e.x);
        cur.zones = [];
        const n = 6;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 90;
          cur.zones.push({
            x: pl.x + Math.cos(cur.ang + Math.PI / 2) * off,
            y: pl.y + Math.sin(cur.ang + Math.PI / 2) * off,
            r: 60,
            delay: i * 0.18
          });
        }
        cur.dmg = 10;
        cur.slowT = 1.2;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const z of cur.zones) {
          if (age < z.delay) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt);
            pl.slowT = Math.max(pl.slowT || 0, cur.slowT);
            break;
          }
        }
      }
    },
    mirrorDoubles: {
      name: 'Mirror Doubles', minStage: 2, windup: 0.7, tele: 0.5, active: 3.5, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.doubles = [];
        const a = Math.atan2(pl.y - e.y, pl.x - e.x);
        for (let i = 0; i < 2; i++) {
          const off = (i === 0 ? 1 : -1) * 220;
          const dx = e.x + Math.cos(a + Math.PI / 2) * off;
          const dy = e.y + Math.sin(a + Math.PI / 2) * off;
          cur.doubles.push({ x: dx, y: dy, r: 40, hp: 60, fakeAng: a, shootT: 0.8 + i * 0.4 });
        }
        cur.dmg = 12;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const d of cur.doubles) {
          if (d.hp <= 0) continue;
          d.shootT -= dt;
          // the double periodically fires a weak shard toward the player
          if (d.shootT <= 0 && env.ents && env.ents.ebullets) {
            d.shootT = 1.1;
            const sa = Math.atan2(pl.y - d.y, pl.x - d.x);
            env.ents.ebullets.push({
              x: d.x, y: d.y, vx: Math.cos(sa) * 320, vy: Math.sin(sa) * 320,
              r: 5, dmg: cur.dmg, life: 2.0, kind: 'enemy', glyphColor: '#ffcc44'
            });
          }
          // player can destroy a double by walking into it (it's fragile)
          if (env.dist2(pl.x, pl.y, d.x, d.y) < (d.r + pl.r) * (d.r + pl.r)) {
            d.hp = 0;
            if (env.addEffect) env.addEffect(d.x, d.y, 'pop', 0.5, GLASS);
          }
        }
      }
    },
    shatteredHalo: {
      name: 'Shattered Halo', minStage: 2, windup: 0.6, tele: 0.5, active: 0.8, recover: 0.7,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.shards = [];
        const n = 12; cur.n = n;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          cur.shards.push({ ang: a, r: 0, maxR: 520, dmg: 16 });
        }
        cur.gap = 2; // 2 shards worth of gap
        cur.gapAng = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        cur.dmg = 16;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        for (const s of cur.shards) {
          s.r = s.maxR * p;
          const sx = cur.cx + Math.cos(s.ang) * s.r;
          const sy = cur.cy + Math.sin(s.ang) * s.r;
          let diff = Math.abs(((s.ang - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff < cur.gap / cur.n * Math.PI) continue; // gap lane
          if (env.dist2(pl.x, pl.y, sx, sy) < (20 + pl.r) * (20 + pl.r)) {
            env.hurtPlayer(s.dmg * dt * 2);
            break;
          }
        }
      }
    },
    burialSpiral: {
      name: 'Burial Spiral', minStage: 3, windup: 0.8, tele: 0.6, active: 3.0, recover: 0.9,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.zones = [];
        // a spiral of moving sand zones
        const arms = 2, perArm = 8;
        for (let a = 0; a < arms; a++) {
          for (let i = 0; i < perArm; i++) {
            const ang = (i / perArm) * Math.PI * 2 + a * Math.PI;
            const d = 80 + i * 55;
            cur.zones.push({ ang, d, r: 42, phase: i * 0.1 });
          }
        }
        cur.dmg = 12;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const z of cur.zones) {
          const a = z.ang + age * 0.8 + z.phase;
          const d = z.d;
          const sx = cur.cx + Math.cos(a) * d;
          const sy = cur.cy + Math.sin(a) * d;
          if (env.dist2(pl.x, pl.y, sx, sy) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt);
            pl.slowT = Math.max(pl.slowT || 0, 0.5);
            break;
          }
        }
      }
    },
    refractionBeam: {
      name: 'Refraction Beam', minStage: 3, windup: 0.9, tele: 1.0, active: 1.4, recover: 0.8,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        cur.sweep = 0; // radians to sweep
        cur.sweepDir = 1;
        cur.dmg = 20;
        cur.len = 800;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        // sweep slowly
        cur.ang += cur.sweepDir * 0.4 * dt;
        if (Math.abs(cur.ang - Math.atan2(env.player.y - e.y, env.player.x - e.x)) > 0.9) {
          cur.sweepDir *= -1;
        }
        // damage along the beam line
        const ax = cur.cx, ay = cur.cy;
        for (let d = 40; d < cur.len; d += 20) {
          const sx = ax + Math.cos(cur.ang) * d;
          const sy = ay + Math.sin(cur.ang) * d;
          if (env.dist2(pl.x, pl.y, sx, sy) < (30 + pl.r) * (30 + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 2.5);
            break;
          }
        }
      }
    },
    sandfallCataclysm: {
      name: 'Sandfall Cataclysm', minStage: 4, windup: 1.2, tele: 1.4, active: 1.2, recover: 1.2,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.zones = [];
        // most of the arena is marked; a few safe corridors
        const n = 6;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const x = (i + 0.5) / n * env.world.w;
            const y = (j + 0.5) / n * env.world.h;
            // skip cells that fall in a safe corridor
            const inCorridor = (Math.abs(x - cur.cx) < 160) || (Math.abs(y - cur.cy) < 160);
            if (!inCorridor) cur.zones.push({ x, y, r: 80, dmg: 18 });
          }
        }
        cur.dmg = 22;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 2);
            break;
          }
        }
      }
    },
    kingsReflection: {
      name: "King's Reflection", minStage: 4, windup: 1.0, tele: 0.6, active: 4.0, recover: 1.0,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        // mirror position on the opposite side of the player
        cur.refX = pl.x + (pl.x - e.x);
        cur.refY = pl.y + (pl.y - e.y);
        cur.r = 40;
        cur.shootT = 1.0;
        cur.dmg = 14;
        cur.beams = [];
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.shootT -= dt;
        if (cur.shootT <= 0 && env.ents && env.ents.ebullets) {
          cur.shootT = 1.3;
          // both real and reflection fire at the player
          for (const src of [{ x: cur.cx, y: cur.cy }, { x: cur.refX, y: cur.refY }]) {
            const sa = Math.atan2(pl.y - src.y, pl.x - src.x);
            env.ents.ebullets.push({
              x: src.x, y: src.y, vx: Math.cos(sa) * 380, vy: Math.sin(sa) * 380,
              r: 5, dmg: cur.dmg, life: 2.0, kind: 'enemy', glyphColor: '#ffcc44'
            });
          }
        }
        // touching the reflection damages
        if (env.dist2(pl.x, pl.y, cur.refX, cur.refY) < (cur.r + pl.r) * (cur.r + pl.r)) {
          env.hurtPlayer(cur.dmg * dt);
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
    const s = e._pg.stage;
    const pool = availableAttacks(s);
    let opts = pool;
    if (e._pg.last && pool.length > 1) opts = pool.filter(k => k !== e._pg.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    e._pg.last = k;
    return k;
  }

  function startAttack(e, key) {
    const A = ATTACKS[key];
    const cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
    e._pg.cur = cur;
  }

  function tick(e, dt) {
    if (!env) return;
    if (!e._pg) {
      e._pg = { stage: 1, cur: null, last: null, idle: 0.8, hitFlash: 0, intro: 1.4, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5 };
    }
    const pg = e._pg;
    pg.hitFlash = Math.max(0, pg.hitFlash - dt);
    pg.dodgeCD = Math.max(0, (pg.dodgeCD || 0) - dt);
    if (pg.intro > 0) { pg.intro -= dt; e.vx = 0; e.vy = 0; return; }

    // ---- dodge burst ----
    if (pg.dodgeT > 0) {
      pg.dodgeT -= dt;
      e.vx = pg.dodgeVx; e.vy = pg.dodgeVy;
      pg.dodgeVx *= 0.86; pg.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pg.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      if (env.addEffect && Math.random() < 0.4) env.addEffect(e.x, e.y, 'pop', 0.3, SAND);
      return;
    }

    // ---- absorbing (shield phase) ----
    if (e.absorbing) {
      pg.cur = null;
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

    // ---- phase transition animation ----
    if (pg.phaseAnim) {
      pg.phaseAnim.t += dt;
      const pa = pg.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { pg.phaseAnim = null; pg.idle = 0.5; pg.cur = null; }
      return;
    }

    // stage transitions
    const ns = stageFor(e);
    if (ns !== pg.stage) {
      const old = pg.stage;
      pg.stage = ns;
      pg.cur = null;
      pg.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'dunes', accent: ACCENT, name: 'The Pharaoh of Glass', from: old, to: ns });
      return;
    }

    // ---- reactive dodge ----
    if (pg.dodgeCD <= 0 && !pg.cur && env.ents && env.ents.bullets) {
      const dodgeChance = [0, 0.20, 0.32, 0.48, 0.62][pg.stage] || 0.3;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 380 || d < 6) continue;
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        const closing = (dx * (b.vx || 0) + dy * (b.vy || 0)) / spd;
        if (closing <= 0) continue;
        if (env.rand(0, 1) > dodgeChance) { pg.dodgeCD = 0.8; break; }
        const bvnx = (b.vx || 0) / spd, bvny = (b.vy || 0) / spd;
        let nx = -bvny, ny = bvnx;
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.6 + pg.stage * 0.25);
        pg.dodgeVx = nx * dashSp; pg.dodgeVy = ny * dashSp;
        pg.dodgeT = 0.28; pg.dodgeCD = 1.6 - pg.stage * 0.15;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, SAND);
        return;
      }
    }

    // movement
    const pl = env.player;
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    let moving = true;
    if (pg.cur) {
      const c = pg.cur;
      if (c.phase === 'windup' || c.phase === 'active') moving = (c.key === 'glassLance' || c.key === 'duneWake');
    }
    if (moving && d2p > 160 * 160) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 1.1;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.18);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.18);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    // attack state machine
    if (!pg.cur) {
      pg.idle -= dt;
      if (pg.idle <= 0) startAttack(e, pickNext(e));
      return;
    }
    const c = pg.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.4 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      ATTACKS[c.key].build(e, c);
      if (c.dmg) c.dmg *= 3.0;
      if (c.shards) for (const s of c.shards) s.dmg *= 3.0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
    }
    else if (c.phase === 'active' && c.t >= P.active) { c.phase = 'recover'; c.t = 0; c.zones = null; }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      pg.cur = null;
      pg.idle = stageInterval(pg.stage);
      return;
    }
    if (c.phase === 'active' && c.zones !== undefined) {
      ATTACKS[c.key].tick(e, c, dt);
    } else if (c.phase === 'active' && (c.key === 'refractionBeam' || c.key === 'shatteredHalo' || c.key === 'burialSpiral' || c.key === 'sandfallCataclysm' || c.key === 'mirrorDoubles' || c.key === 'kingsReflection')) {
      if (c.zones !== null) ATTACKS[c.key].tick(e, c, dt);
    }
  }

  // ---- 2D rendering ----
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 40;
    const pg = e._pg || {};
    const stage = pg.stage || 1;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rr * 0.7, rr * 0.95, rr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // stage aura (golden, hotter with stage)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (1.6 + stage * 0.18);
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 + stage));
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.4, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(255,200,80,' + (0.18 + 0.05 * stage) + ')');
    ag.addColorStop(0.6, 'rgba(227,183,73,' + (0.12 * pulse) + ')');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // sprite — rotate to face the player, identical to every other monster
    const ang = env.angleTo ? env.angleTo(e.x, e.y, env.player.x, env.player.y) : Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    if (imgReady) {
      const dR = rr + 16;
      ctx.drawImage(img, -dR, -dR, dR * 2, dR * 2);
    } else {
      ctx.fillStyle = '#8a6d2a';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    }
    // hit flash
    if (pg.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = pg.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // skull core glow (brighter with stage)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const gI = 0.6 + 0.3 * Math.sin(t * 3) + (stage - 1) * 0.12;
    const gg = ctx.createRadialGradient(cx, cy - rr * 0.1, 2, cx, cy - rr * 0.1, rr * 0.7);
    gg.addColorStop(0, 'rgba(255,220,140,' + Math.min(1, gI) + ')');
    gg.addColorStop(0.5, 'rgba(247,192,54,' + (0.4 * gI) + ')');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy - rr * 0.1, rr * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // warding shield
    if (e.absorbing) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const shR = rr * 1.7 + Math.sin(t * 3) * 4;
      const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
      sg.addColorStop(0, 'rgba(227,183,73,0)');
      sg.addColorStop(0.7, 'rgba(227,183,73,0.18)');
      sg.addColorStop(1, 'rgba(227,183,73,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(227,183,73,0.85)';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (pg.cur) drawTelegraph2D(ctx, pg.cur, t);
    if (pg.phaseAnim) drawPhaseAnim2D(ctx, e, pg.phaseAnim, t);

    // HP ring
    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e3b749';
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
    ctx.strokeStyle = 'rgba(255,220,140,' + (0.9 * (1 - p)) + ')';
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(227,183,73,' + (0.7 * (1 - p)) + ')';
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.78, 0, Math.PI * 2); ctx.stroke();
    const flash = 1 - p;
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.4);
    fg.addColorStop(0, 'rgba(255,240,200,' + (0.85 * flash) + ')');
    fg.addColorStop(0.5, 'rgba(247,192,54,' + (0.5 * flash) + ')');
    fg.addColorStop(1, 'rgba(227,183,73,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 2.4, 0, Math.PI * 2); ctx.fill();
    const n = 3;
    for (let i = 0; i < n; i++) {
      const rr2 = rr * (1.2 + i * 0.5) * (0.5 + 0.5 * p);
      ctx.strokeStyle = 'rgba(247,192,54,' + (0.6 * (1 - p)) + ')';
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
    ctx.globalAlpha = 1.6;
    if (cur.phase === 'tele' || cur.phase === 'active') {
      const showZones = cur.zones && cur.zones.length;
      if (cur.key === 'glassLance' && showZones) {
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(212,175,55,0.4)';
          ctx.strokeStyle = 'rgba(255,220,140,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'duneWake' && showZones) {
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(194,178,128,0.3)';
          ctx.strokeStyle = 'rgba(227,183,73,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'mirrorDoubles' && cur.doubles) {
        for (const d of cur.doubles) {
          if (d.hp <= 0) continue;
          ctx.fillStyle = 'rgba(212,175,55,0.18)';
          ctx.strokeStyle = 'rgba(255,220,140,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(d.x), sy(d.y), d.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'shatteredHalo' && cur.shards) {
        for (const s of cur.shards) {
          let diff = Math.abs(((s.ang - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const inGap = diff < cur.gap / 12 * Math.PI;
          ctx.strokeStyle = inGap ? 'rgba(125,255,163,0.6)' : 'rgba(212,175,55,0.8)';
          ctx.lineWidth = 3;
          const sxp = cur.cx + Math.cos(s.ang) * s.r;
          const syp = cur.cy + Math.sin(s.ang) * s.r;
          ctx.beginPath(); ctx.moveTo(sx(cur.cx), sy(cur.cy)); ctx.lineTo(sx(sxp), sy(syp)); ctx.stroke();
        }
      } else if (cur.key === 'burialSpiral' && cur.zones) {
        const age = cur.t;
        for (const z of cur.zones) {
          const a = z.ang + age * 0.8 + z.phase;
          const d = z.d;
          const zx = cur.cx + Math.cos(a) * d;
          const zy = cur.cy + Math.sin(a) * d;
          ctx.fillStyle = 'rgba(194,178,128,0.3)';
          ctx.strokeStyle = 'rgba(227,183,73,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(zx), sy(zy), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'refractionBeam') {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : 1;
        ctx.strokeStyle = 'rgba(255,220,140,' + (0.8 * prog) + ')';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(sx(cur.cx), sy(cur.cy));
        ctx.lineTo(sx(cur.cx) + Math.cos(cur.ang) * cur.len * prog, sy(cur.cy) + Math.sin(cur.ang) * cur.len * prog);
        ctx.stroke();
      } else if (cur.key === 'sandfallCataclysm' && cur.zones) {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : 1;
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(194,178,128,' + (0.18 * prog) + ')';
          ctx.strokeStyle = 'rgba(227,183,73,' + (0.6 * prog) + ')';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'kingsReflection') {
        ctx.fillStyle = 'rgba(212,175,55,0.2)';
        ctx.strokeStyle = 'rgba(255,220,140,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(cur.refX), sy(cur.refY), cur.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- 3D rendering ----
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const pg = e._pg || {};
    const stage = pg.stage || 1;
    const rr = e.r || 40;
    const x = e.x, z = e.y;
    const hb = rr * 1.2 + Math.sin(tt * 2.4) * 3;

    // ground contact shadow
    R.quads.alpha.push(x, 1.2, z, rr * 2.4, 0, 0, 0, 0.35, 0, 11, 0, 1);

    // inflated sprite mesh (the Pharaoh)
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

    // warding shield dome
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

    // skull core glow + point light
    const gI = 0.7 + 0.3 * Math.sin(tt * 3) + (stage - 1) * 0.12;
    R.glow(x, hb, z, rr * 1.6, 1.0, 0.85, 0.3, Math.min(1, gI) * 0.8, 0);
    R.light(x, z, hb + 10, 160 + stage * 40, 1.2, 0.95, 0.35, 0.6 + 0.2 * Math.sin(tt * 3));

    // stage aura ring
    const ringC = R.hexRGB(ACCENT);
    R.decal(x, z, rr * (2 + stage * 0.25), ringC[0], ringC[1], ringC[2], 0.25 + 0.1 * Math.sin(tt * 2), 9, tt * 0.6, 0, true, 1.4);

    // ambient floating glass shards
    const moteN = 1 + stage;
    for (let i = 0; i < moteN; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.6 + Math.random() * 0.8);
        R.emit({
          x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 10, vy: 26 + Math.random() * 24, vz: (Math.random() - 0.5) * 10,
          life: 1.1 + Math.random() * 0.6, age: 0, s0: 6, s1: 1,
          col: Math.random() < 0.5 ? R.hexRGB(GLASS) : R.hexRGB(ACCENT), a: 0.8, kind: 0, drag: 0.7
        });
      }
    }

    if (pg.cur) drawTelegraph3D(R, pg.cur, tt);
    if (pg.phaseAnim) drawPhaseAnim3D(R, e, pg.phaseAnim, tt, hb);
  }

  function drawPhaseAnim3D(R, e, pa, tt, hb) {
    if (!env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 42;
    const p = Math.min(1, pa.t / pa.dur);
    const fade = 1 - p;
    const ringR = rr + p * 520;
    const A = R.hexRGB(ACCENT), G = R.hexRGB(GLYPH);
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 8 * fade, ringR, 0.18), mat([1.6, 1.1, 0.3], { emissive: [2.0, 1.3, 0.3], emisK: 2.2, alpha: 0.9 * fade, shadow: false }));
    R.draw(U.torus, mm(x, 6, z, -tt * 1.2, ringR * 0.78, 2 + 6 * fade, ringR * 0.78, 0.14), mat([0.9, 0.75, 0.25], { emissive: [1.1, 0.85, 0.2], emisK: 2.0, alpha: 0.8 * fade, shadow: false }));
    R.glow(x, hb, z, rr * (1.4 + p * 1.2), 1.0, 0.85, 0.3, 0.9 * fade, 0);
    R.light(x, z, hb + 20, 320 + p * 260, 1.6, 1.1, 0.3, 0.9 * fade);
    sigil(R, x, z, ringR * 0.9, [1.4, 1.0, 0.3], 0.7 * fade, tt, 0.8);
    sigil(R, x, z, ringR * 0.55, A, 0.6 * fade, tt, -0.6);
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.4 + Math.random() * 1.6);
        R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (20 + 40 * fade), vy: 60 + Math.random() * 80, vz: Math.sin(a) * (20 + 40 * fade), life: 1.0 + Math.random() * 0.6, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? R.hexRGB(GLASS) : G, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.4 * fade);
  }

  // golden hieroglyphic sigil
  function sigil(R, x, z, r, col, intensity, tt, spin) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5 * intensity, 9, tt * (spin || 0.6), 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7 * intensity, 6, -tt * (spin || 0.6) * 1.4, 0, true, 1.6);
    R.decal(x, z, r * 0.34, col[0] * 1.3, col[1] * 1.3, col[2] * 1.3, 0.9 * intensity, 12, tt * (spin || 0.6) * 2, 0, true, 1.8);
  }

  // faceted glass crystal shard
  function glassSpike(R, x, z, baseR, h, col, emiCol, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    R.draw(U.rock3, mm(x, h * 0.5, z, seed * 2.3, baseR, h, baseR, seed * 0.2), mat(col, { rough: 0.2, metal: 0.4, emissive: emiCol, emisK: 1.6, rim: 1.4, rimCol: R.hexRGB(GLASS) }));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      const tx = x + Math.cos(a) * baseR * 0.7, tz = z + Math.sin(a) * baseR * 0.7;
      const th = h * (0.5 + 0.18 * ((seed * 7 + i) % 3));
      R.draw(U.cone, mm(tx, th * 0.5, tz, a + Math.PI / 2, baseR * 0.26, th, baseR * 0.26, 0, Math.PI / 2 - 0.5), mat(col, { rough: 0.15, metal: 0.5, emissive: emiCol, emisK: 1.4, rim: 1.2, rimCol: R.hexRGB(GLASS) }));
    }
    R.glow(x, h, z, baseR * 1.6, emiCol[0], emiCol[1], emiCol[2], 0.6, 0);
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const A = R.hexRGB(ACCENT);
    const GLASSC = R.hexRGB(GLASS);
    const GLYPHC = R.hexRGB(GLYPH);
    const SANDC = [0.76, 0.70, 0.50];
    const active = cur.phase === 'active';
    const tele = cur.phase === 'tele';
    const tprog = tele ? cur.t / cur.phases.tele : 1;
    const aprog = active ? Math.min(1, cur.t / cur.phases.active) : 0;

    // shared sand mist
    if (Math.random() < 0.5) {
      const cx = cur.cx != null ? cur.cx : (cur.zones && cur.zones[0] ? cur.zones[0].x : 0);
      const cz = cur.cy != null ? cur.cy : (cur.zones && cur.zones[0] ? cur.zones[0].y : 0);
      R.emit({ x: cx + (Math.random() - .5) * 60, y: 2, z: cz + (Math.random() - .5) * 60, vx: (Math.random() - .5) * 8, vy: 14 + Math.random() * 10, vz: (Math.random() - .5) * 8, life: 1.6, age: 0, s0: 9, s1: 3, col: [0.85, 0.78, 0.55], a: 0.18, kind: 0, drag: 0.9 });
    }

    if (cur.key === 'glassLance' && cur.zones) {
      const emi = [0.5, 0.4, 0.1];
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const h = z.r * (2.0 + 0.4 * Math.sin(tt * 6 + i)) * tprog;
        if (h > 2) glassSpike(R, z.x, z.y, z.r * 0.7, h, [0.85, 0.7, 0.2], emi, tt, i * 1.7 + 0.3);
        sigil(R, z.x, z.y, z.r * 1.2, A, 0.4 + 0.3 * tprog, tt, 0.5);
        R.light(z.x, z.y, h * 0.6, 90 + 40 * tprog, 0.7, 0.55, 0.15, 0.4 + 0.3 * tprog);
      }
      if (cur.zones.length > 1) {
        const a = Math.atan2(cur.zones[cur.zones.length - 1].y - cur.zones[0].y, cur.zones[cur.zones.length - 1].x - cur.zones[0].x);
        const mx = (cur.zones[0].x + cur.zones[cur.zones.length - 1].x) / 2, mz = (cur.zones[0].y + cur.zones[cur.zones.length - 1].y) / 2;
        R.decal(mx, mz, 40, 0.6, 0.45, 0.12, 0.5 * tprog, 12, a, 0, true, 4.0);
      }
      if (active && Math.random() < 0.7) {
        const z = cur.zones[Math.floor(Math.random() * cur.zones.length)];
        R.emit({ x: z.x + (Math.random() - .5) * z.r, y: z.r * 0.8, z: z.y + (Math.random() - .5) * z.r, vx: (Math.random() - .5) * 30, vy: 50 + Math.random() * 40, vz: (Math.random() - .5) * 30, life: .7, age: 0, s0: 6, s1: 1, col: [0.85, 0.7, 0.25], a: .8, kind: 0, drag: .7 });
      }
    } else if (cur.key === 'duneWake' && cur.zones) {
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const age = active ? cur.t : 0;
        if (age < z.delay && active) continue;
        const h = z.r * (1.2 + 0.3 * Math.sin(tt * 5 + i)) * tprog;
        if (h > 2) {
          R.draw(U.rock3, mm(z.x, h * 0.5, z.y, i * 2.1 + 0.4, z.r * 0.7, h, z.r * 0.7, i * 0.2), mat(SANDC, { rough: 0.9, metal: 0.05, emissive: [0.5, 0.42, 0.2], emisK: 1.2 }));
          R.glow(z.x, h, z.y, z.r * 1.0, 0.85, 0.72, 0.35, 0.3 * tprog, 0);
          R.light(z.x, z.y, h * 0.6, 80, 0.85, 0.72, 0.35, 0.3);
        }
        sigil(R, z.x, z.y, z.r * 1.1, A, 0.3 * tprog, tt, 0.3);
        if (Math.random() < 0.4) R.emit({ x: z.x + (Math.random() - .5) * z.r, y: 2, z: z.y + (Math.random() - .5) * z.r, vx: 0, vy: 18 + Math.random() * 16, vz: 0, life: 1.4, age: 0, s0: 7, s1: 2, col: [0.85, 0.78, 0.55], a: 0.5, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'mirrorDoubles' && cur.doubles) {
      for (let i = 0; i < cur.doubles.length; i++) {
        const d = cur.doubles[i];
        if (d.hp <= 0) {
          // shatter effect
          if (Math.random() < 0.8) R.emit({ x: d.x, y: d.r * 0.5, z: d.y, vx: (Math.random() - .5) * 40, vy: 40 + Math.random() * 30, vz: (Math.random() - .5) * 40, life: 0.8, age: 0, s0: 8, s1: 2, col: GLASSC, a: 0.9, kind: 0, drag: 0.6 });
          continue;
        }
        const h = d.r * 1.8;
        // crystalline mirror double — faceted, translucent
        R.draw(U.rock3, mm(d.x, h * 0.5, d.y, tt * 2 + i, d.r * 0.9, h, d.r * 0.9, 0.2), mat([0.85, 0.7, 0.25], { rough: 0.1, metal: 0.7, emissive: [0.5, 0.4, 0.12], emisK: 1.8, rim: 1.8, rimCol: GLASSC, alpha: 0.6 }));
        R.glow(d.x, h, d.y, d.r * 1.5, 0.9, 0.7, 0.25, 0.4, 0);
        R.light(d.x, d.y, h, 120, 0.9, 0.7, 0.25, 0.4);
        for (let k = 0; k < 4; k++) {
          const a = k * Math.PI / 2 + tt * 0.6;
          R.draw(U.cone, mm(d.x + Math.cos(a) * d.r * 0.7, h * 0.1, d.y + Math.sin(a) * d.r * 0.7, a, d.r * 0.18, d.r * 0.5, d.r * 0.18, 0, a), mat([0.7, 0.6, 0.2], { rough: 0.15, metal: 0.6, emissive: [0.4, 0.3, 0.08], emisK: 1.4, rim: 1.2, rimCol: GLASSC }));
        }
        sigil(R, d.x, d.y, d.r * 1.3, GLASSC, 0.35, tt, 0.4);
        for (let p = 0; p < 3; p++) {
          if (Math.random() < 0.6) R.emit({ x: d.x + (Math.random() - .5) * d.r, y: 2 + Math.random() * 8, z: d.y + (Math.random() - .5) * d.r, vx: (Math.random() - .5) * 16, vy: 14 + Math.random() * 20, vz: (Math.random() - .5) * 16, life: 1.4, age: 0, s0: 8, s1: 3, col: GLASSC, a: 0.55, kind: 0, drag: 0.85 });
        }
      }
    } else if (cur.key === 'shatteredHalo' && cur.shards) {
      for (let i = 0; i < cur.shards.length; i++) {
        const s = cur.shards[i];
        let diff = Math.abs(((s.ang - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const inGap = diff < cur.gap / 12 * Math.PI;
        const rr2 = s.r * (active ? Math.min(1, aprog) : tprog);
        const sx = cur.cx + Math.cos(s.ang) * rr2, sz = cur.cy + Math.sin(s.ang) * rr2;
        if (rr2 < 2) continue;
        const h = (28 + 8 * Math.sin(tt * 5 + i)) * (inGap ? 0.3 : 1) * (1 - i / 14);
        if (h > 2) {
          glassSpike(R, sx, sz, 7, h, [0.85, 0.7, 0.25], inGap ? [0.1, 0.2, 0.08] : [0.5, 0.4, 0.1], tt, i * 1.3);
          if (i % 2 === 0) R.glow(sx, h, sz, 10, 0.9, 0.7, 0.25, inGap ? 0.2 : 0.5, 0);
        }
        if (Math.random() < 0.5) {
          R.emit({ x: sx, y: 2, z: sz, vx: Math.cos(s.ang) * 10, vy: 40 + Math.random() * 40, vz: Math.sin(s.ang) * 10, life: 1.0, age: 0, s0: 7, s1: 2, col: inGap ? [0.3, 0.6, 0.3] : GLASSC, a: 0.6, kind: 0, drag: 0.7 });
        }
      }
      R.glow(cur.cx, 24, cur.cy, cur.r * 0.7 * tprog, 0.9, 0.7, 0.2, 0.5 * tprog, 0);
      R.light(cur.cx, cur.cy, 28, 320, 0.9, 0.7, 0.2, 0.6 + 0.2 * Math.sin(tt * 3));
    } else if (cur.key === 'burialSpiral' && cur.zones) {
      const age = active ? cur.t : 0;
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const a = z.ang + age * 0.8 + z.phase;
        const d = z.d;
        const sx = cur.cx + Math.cos(a) * d, sz = cur.cy + Math.sin(a) * d;
        const h = z.r * 1.6 * tprog * (1 + 0.08 * Math.sin(tt * 6 + i));
        if (h > 2) {
          R.draw(U.rock3, mm(sx, h * 0.5, sz, a + i, z.r * 0.5, h, z.r * 0.5, i * 0.2), mat(SANDC, { rough: 0.85, metal: 0.05, emissive: [0.5, 0.42, 0.2], emisK: 1.3, rim: 0.8, rimCol: GLASSC }));
          R.glow(sx, h, sz, z.r * 1.0, 0.85, 0.72, 0.35, 0.35 * tprog, 0);
          R.light(sx, sz, h * 0.6, 80, 0.85, 0.72, 0.35, 0.35);
        }
        if (Math.random() < 0.4) R.emit({ x: sx + (Math.random() - .5) * z.r, y: 2, z: sz + (Math.random() - .5) * z.r, vx: 0, vy: 18 + Math.random() * 16, vz: 0, life: 1.4, age: 0, s0: 7, s1: 2, col: [0.85, 0.78, 0.55], a: 0.4, kind: 0, drag: 0.9 });
      }
      sigil(R, cur.cx, cur.cy, 200, A, 0.3 * tprog, tt, 0.5);
    } else if (cur.key === 'refractionBeam') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.3 * aprog : 0.15 * tprog);
      const len = cur.len * (active ? Math.min(1, aprog) : tprog);
      // beam as a long glowing cylinder
      const beamH = 20;
      const ex = cur.cx + Math.cos(cur.ang) * len, ez = cur.cy + Math.sin(cur.ang) * len;
      // glowing beam cylinder
      for (let d = 40; d < len; d += 80) {
        const bx = cur.cx + Math.cos(cur.ang) * d, bz = cur.cy + Math.sin(cur.ang) * d;
        R.draw(U.cyl, mm(bx, beamH * 0.5, bz, cur.ang, 14, beamH, 14), mat([1.8, 1.4, 0.4], { emissive: [2.4, 1.8, 0.5], emisK: 2.6, rough: 0.1, metal: 0.3, shadow: false, rim: 1.8, rimCol: GLYPHC }));
        R.glow(bx, beamH, bz, 30, 1.6, 1.2, 0.4, 0.7, 0);
      }
      R.light(ex, ez, beamH, 400, 1.8, 1.2, 0.4, 0.9);
      sigil(R, cur.cx, cur.cy, 120, [1.6, 1.2, 0.35], 0.6, tt, 0.8);
      for (let p = 0; p < 6; p++) {
        if (Math.random() < 0.85) {
          const d = Math.random() * len;
          const bx = cur.cx + Math.cos(cur.ang) * d, bz = cur.cy + Math.sin(cur.ang) * d;
          R.emit({ x: bx, y: 2, z: bz, vx: Math.cos(cur.ang) * 20, vy: 40 + Math.random() * 50, vz: Math.sin(cur.ang) * 20, life: 0.7, age: 0, s0: 9, s1: 2, col: [1.6, 1.2, 0.35], a: 0.9, kind: 0, drag: 0.5 });
        }
      }
      R.decal(cur.cx, cur.cy, len * 0.3, 0.6, 0.45, 0.12, 0.5, 12, cur.ang, 0, true, 4.0);
    } else if (cur.key === 'sandfallCataclysm' && cur.zones) {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.35 * aprog : 0.18 * tprog);
      sigil(R, cur.cx, cur.cy, cur.r * tprog, A, 0.5, tt, 0.4);
      R.decal(cur.cx, cur.cy, cur.r * tprog * 0.5, GLYPHC[0], GLYPHC[1], GLYPHC[2], 0.4 * tprog, 12, -tt * 0.8, 0, true, 1.6);
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const h = (50 + 10 * Math.sin(tt * 4 + i)) * tprog;
        if (h > 2) {
          R.draw(U.rock3, mm(z.x, h * 0.5, z.y, i * 1.7, z.r * 0.5, h, z.r * 0.5, i * 0.2), mat(SANDC, { rough: 0.85, metal: 0.05, emissive: [0.5, 0.42, 0.2], emisK: 1.4 }));
          R.glow(z.x, h, z.y, z.r * 0.8, 0.85, 0.72, 0.35, 0.5 * tprog, 0);
        }
        // falling glass shards from above
        if (Math.random() < 0.7) {
          R.emit({ x: z.x + (Math.random() - .5) * z.r, y: 120 + Math.random() * 40, z: z.y + (Math.random() - .5) * z.r, vx: 0, vy: -120, vz: 0, life: 1.0, age: 0, s0: 8, s1: 3, col: Math.random() < 0.4 ? GLYPHC : GLASSC, a: 0.9, kind: 0, drag: 0.3 });
        }
      }
      R.glow(cur.cx, 24, cur.cy, cur.r * 0.7 * tprog, 0.9, 0.7, 0.2, 0.5 * tprog, 0);
      R.light(cur.cx, cur.cy, 28, 320, 0.9, 0.7, 0.2, 0.6 + 0.2 * Math.sin(tt * 3));
    } else if (cur.key === 'kingsReflection') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.25 * aprog : 0.12 * tprog);
      // the mirror reflection — a translucent crystalline copy
      const h = cur.r * 1.8;
      R.draw(U.rock3, mm(cur.refX, h * 0.5, cur.refY, tt * 2, cur.r * 0.9, h, cur.r * 0.9, 0.2), mat([0.85, 0.7, 0.25], { rough: 0.1, metal: 0.7, emissive: [0.5, 0.4, 0.12], emisK: 1.8, rim: 1.8, rimCol: GLASSC, alpha: 0.7 }));
      R.glow(cur.refX, h, cur.refY, cur.r * 1.5, 0.9, 0.7, 0.25, 0.5, 0);
      R.light(cur.refX, cur.refY, h, 120, 0.9, 0.7, 0.25, 0.5);
      sigil(R, cur.refX, cur.refY, cur.r * 1.3, GLASSC, 0.4 * tprog, tt, 0.5);
      // tether beam between real and reflection
      const mx = (cur.cx + cur.refX) / 2, mz = (cur.cy + cur.refY) / 2;
      const ta = Math.atan2(cur.refY - cur.cy, cur.refX - cur.cx);
      R.draw(U.cyl, mm(mx, 14, mz, ta, 4, 28, 4), mat([1.6, 1.2, 0.35], { emissive: [2.0, 1.5, 0.4], emisK: 2.2, rough: 0.1, metal: 0.3, shadow: false, rim: 1.6, rimCol: GLYPHC }));
      for (let p = 0; p < 4; p++) {
        if (Math.random() < 0.7) {
          const d = Math.random();
          const bx = cur.cx + (cur.refX - cur.cx) * d, bz = cur.cy + (cur.refY - cur.cy) * d;
          R.emit({ x: bx, y: 4, z: bz, vx: (Math.random() - .5) * 20, vy: 30 + Math.random() * 30, vz: (Math.random() - .5) * 20, life: 0.8, age: 0, s0: 8, s1: 2, col: GLASSC, a: 0.7, kind: 0, drag: 0.6 });
        }
      }
    }
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 42; e.hp = e.maxhp = 2400; e.speed = 104; e.cd = 99; e.detectR = 1200;
    e.absorbing = true;
    e._pg = { stage: 1, cur: null, last: null, idle: 1.0, hitFlash: 0, intro: 1.4 };
    injectShieldWarn();
  }

  function onHit(e, dmg) {
    if (!e._pg) return;
    e._pg.hitFlash = Math.min(1, (e._pg.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  // ---- public API ----
  window.PharaohGlass = {
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
