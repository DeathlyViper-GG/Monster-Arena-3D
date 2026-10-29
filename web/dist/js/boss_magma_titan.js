// ============================================================
// Monster Arena — THE MAGMA TITAN (Story Realm 4 Boss)
// The Scribe's stolen will, forged into a volcanic Warden. Its
// signature is FORGE MANIPULATION: heavy committed movement,
// arena-reshaping eruptions, chains, and temporary lava channels.
// Mechanically and visually distinct from every other boss — no
// aimed shots, no rotating beams, no homing projectiles, no
// scattered floor circles. Every attack telegraphs clearly and
// leaves a survivable route.
//
// Stage 1 (100–75%): Anvilfall, Chain Drag
// Stage 2 (75–50%):  + Forge Vent, Molten Brand
// Stage 3 (50–25%):  + Chain Snare, Foundry Collapse
// Stage 4 (25–0%):   + Corebreak Quench, World-Forging Blow
// Earlier attacks remain available in every later stage.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#ff6a2a';     // molten orange
  const GLYPH = '#ffd700';       // blazing core (white-yellow)
  const LAVA = '#ff4500';        // lava flow
  const EMBER = '#ff8c00';       // dark orange ember
  const ASH = '#3d3d3d';         // charcoal / obsidian
  const CHAIN = '#8a6a4a';       // rusted iron chain

  let env = null;
  function E() { return env; }

  // ---- shield warning banner ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `
      #mtShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
        padding:11px 24px;border-radius:999px;pointer-events:none;display:none;
        font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;
        color:#ffe6c4;background:rgba(16,8,4,.84);
        border:1px solid #ff6a2a;text-shadow:0 0 12px rgba(255,106,42,.6);
        white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;
        animation:mtWarnPulse 1.6s ease-in-out infinite;}
      @keyframes mtWarnPulse{0%,100%{box-shadow:0 0 22px rgba(255,106,42,.4),inset 0 0 12px rgba(255,106,42,.14)}
        50%{box-shadow:0 0 38px rgba(255,106,42,.8),inset 0 0 20px rgba(255,106,42,.3)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'mtShieldWarn';
    warnEl.textContent = "🛡️ The Titan is chained — clear all monsters first!";
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  // ---- boss sprite (loaded once) ----
  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/108f063f3_Designer4.png';
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
  const ATTACKS = {
    // 1. ANVILFALL: a fist impact that tracks the player during telegraph,
    //    locks, then slams down and sends a single fast-expanding shockwave
    //    ring outward. Dodge off the ring radius. No other boss uses a
    //    locked-impact expanding ring.
    anvilfall: {
      name: 'Anvilfall', minStage: 1, windup: 0.5, tele: 0.95, active: 0.9, recover: 0.7,
      build(e, cur) {
        if (!cur.locked) { cur.x = env.player.x; cur.y = env.player.y; }   // lock once at tele start, never re-track
        cur.r = 0; cur.maxR = 520; cur.band = 34; cur.dmg = 18; cur.spd = 580;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        cur.r += cur.spd * dt;
        const d = Math.hypot(pl.x - cur.x, pl.y - cur.y);
        if (Math.abs(d - cur.r) < cur.band + pl.r) env.hurtPlayer(cur.dmg * dt * 2.0);
      }
    },
    // 2. CHAIN DRAG: the Titan hurls a chain and sweeps it in a slow arc.
    //    The chain is a moving line segment (rotating tip). Cross behind the
    //    Titan or slip through the open end. No other boss uses a sweeping
    //    segment.
    chainDrag: {
      name: 'Chain Drag', minStage: 1, windup: 0.55, tele: 0.8, active: 2.4, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.7;
        cur.sweep = 1.6; cur.len = 700; cur.thick = 30; cur.dmg = 16;
        cur.tip = null;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        const ang = cur.ang0 + cur.sweep * p;
        const tx = cur.cx + Math.cos(ang) * cur.len, ty = cur.cy + Math.sin(ang) * cur.len;
        cur.tip = { x: tx, y: ty, ang };
        if (pSeg(pl.x, pl.y, cur.cx, cur.cy, tx, ty) < cur.thick + pl.r) {
          env.hurtPlayer(cur.dmg * dt * 1.8);
        }
      }
    },
    // 3. FORGE VENT: three vents open side by side and each fires a forward-
    //    moving lava surge in sequence. Gaps between the lanes stay safe.
    //    Distinct from Dune Wake (static delayed zones): these are advancing
    //    rectangular fronts.
    forgeVent: {
      name: 'Forge Vent', minStage: 2, windup: 0.6, tele: 0.7, active: 3.0, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.dir = Math.atan2(pl.y - e.y, pl.x - e.x);
        cur.n = 3; cur.spacing = 150; cur.surgeW = 70; cur.surgeLen = 760; cur.step = 0.45;
        cur.dmg = 14; cur.slowT = 1.0;
        cur.vents = [];
        for (let i = 0; i < cur.n; i++) {
          const off = (i - (cur.n - 1) / 2) * cur.spacing;
          cur.vents.push({
            x: e.x + Math.cos(cur.dir + Math.PI / 2) * off,
            y: e.y + Math.sin(cur.dir + Math.PI / 2) * off,
            fire: i * cur.step, len: 0
          });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const v of cur.ents = cur.vents) {
          const local = age - v.fire;
          if (local > 0) v.len = Math.min(cur.surgeLen, v.len + 460 * dt);
          if (v.len <= 0) continue;
          // rectangle from vent along cur.dir, width cur.surgeW
          for (let s = 0; s <= v.len; s += 40) {
            const sx = v.x + Math.cos(cur.dir) * s, sy = v.y + Math.sin(cur.dir) * s;
            if (env.dist2(pl.x, pl.y, sx, sy) < (cur.surgeW + pl.r) * (cur.surgeW + pl.r)) {
              env.hurtPlayer(cur.dmg * dt); pl.slowT = Math.max(pl.slowT || 0, cur.slowT); break;
            }
          }
        }
      }
    },
    // 4. MOLTEN BRAND: a fiery rune follows the player during telegraph, then
    //    locks and erupts after a short delay. Move the mark away from safe
    //    ground, then leave before it bursts. Distinct: a delayed personal
    //    trap planted under the player's old position.
    moltenBrand: {
      name: 'Molten Brand', minStage: 2, windup: 0.5, tele: 1.0, active: 1.0, recover: 0.6,
      build(e, cur) {
        cur.x = env.player.x; cur.y = env.player.y;   // locked at active start
        cur.r = 96; cur.dmg = 20; cur.burstAt = 0.45;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        if (cur.t < cur.burstAt) return; // winding up at the locked spot
        const burst = (cur.t - cur.burstAt) / (cur.phases.active - cur.burstAt);
        if (burst < 0.5) return; // eruption window
        if (env.dist2(pl.x, pl.y, cur.x, cur.y) < (cur.r + pl.r) * (cur.r + pl.r)) {
          env.hurtPlayer(cur.dmg * dt * 2.2);
        }
      }
    },
    // 5. CHAIN SNARE: chains anchor at two points and sweep inward as a
    //    closing barrier, leaving one marked gap open. Escape through the
    //    gap before the chains meet. Distinct from Thorn Cage (push from a
    //    full ring): this is a closing arc with a visible escape gap.
    chainSnare: {
      name: 'Chain Snare', minStage: 3, windup: 0.6, tele: 0.8, active: 2.6, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.cx = pl.x; cur.cy = pl.y;
        cur.r0 = 360; cur.gap = 0.9; cur.dmg = 16;
        cur.gapAng = Math.atan2(pl.y - e.y, pl.x - e.x); // gap toward player's escape
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = Math.min(1, cur.t / cur.phases.active);
        const r = cur.r0 * (1 - p * 0.78);   // closes inward
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (Math.abs(d - r) < 30 + pl.r) {
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          let diff = Math.abs(((a - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > cur.gap / 2) env.hurtPlayer(cur.dmg * dt * 1.8);
        }
      }
    },
    // 6. FOUNDRY COLLAPSE: the Titan tears a pillar and hurls it to an
    //    indicated landing zone; on impact it bursts into a ring of debris
    //    with a gap. Pass through the gap. Distinct: a thrown projectile
    //    that becomes a partial ring with a safe lane.
    foundryCollapse: {
      name: 'Foundry Collapse', minStage: 3, windup: 0.7, tele: 0.9, active: 1.4, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.x = clamp(pl.x, 80, env.world.w - 80);
        cur.y = clamp(pl.y, 80, env.world.h - 80);
        cur.r = 0; cur.maxR = 420; cur.band = 36; cur.dmg = 18;
        cur.gap = 0.95; cur.gapAng = Math.atan2(pl.y - cur.y, pl.x - cur.x);
        cur.landAt = 0.35; cur.landed = false;
      },
      tick(e, cur, dt) {
        if (cur.t < cur.landAt) return;
        if (!cur.landed) cur.landed = true;
        const pl = env.player;
        cur.r += 520 * dt;
        if (cur.r > cur.maxR) return;
        const d = Math.hypot(pl.x - cur.x, pl.y - cur.y);
        if (Math.abs(d - cur.r) < cur.band + pl.r) {
          const a = Math.atan2(pl.y - cur.y, pl.x - cur.x);
          let diff = Math.abs(((a - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > cur.gap / 2) env.hurtPlayer(cur.dmg * dt * 2.0);
        }
      }
    },
    // 7. COREBREAK QUENCH: the Titan kneels and exposes its blazing core; the
    //    arena darkens and, after a long warning, releases a full-arena heat
    //    wave. Shelter behind the Titan (a safe cone opposite the core's
    //    facing) or a surviving pillar. The exposed core leaves the Titan
    //    vulnerable afterward (long recover). Distinct: a directional
    //    shelter mechanic, not a dodge pattern.
    corebreakQuench: {
      name: 'Corebreak Quench', minStage: 4, windup: 1.4, tele: 1.6, active: 0.6, recover: 1.6,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        cur.faceAng = Math.atan2(pl.y - e.y, pl.x - e.x); // core faces player
        cur.safeAng = cur.faceAng + Math.PI;             // shelter behind Titan
        cur.safeHalf = 0.62;                            // cone half-angle
        cur.pulseAt = 0.0;                               // pulse fires at active start
        cur.dmg = 26;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        // pulse fires immediately at active start; damage persists briefly
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
        let diff = Math.abs(((a - cur.safeAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (diff < cur.safeHalf) return; // sheltered behind Titan
        env.hurtPlayer(cur.dmg * dt * 1.6);
      }
    },
    // 8. WORLD-FORGING BLOW: a slow two-fist windup, then a ground slam that
    //    sends three staggered shockwave rings across the arena. Dodge or
    //    jump each wave; the Titan is vulnerable while recovering. Distinct
    //    from Hearthquake (two rings): three time-staggered waves from a
    //    committed slam.
    worldForgingBlow: {
      name: 'World-Forging Blow', minStage: 4, windup: 1.3, tele: 0.5, active: 1.8, recover: 1.3,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.waves = [
          { r: 0, fire: 0.0, max: 560, band: 32, dmg: 20 },
          { r: 0, fire: 0.45, max: 560, band: 32, dmg: 18 },
          { r: 0, fire: 0.9, max: 560, band: 32, dmg: 18 }
        ];
        cur.spd = 520;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t;
        for (const w of cur.waves) {
          if (age < w.fire) continue;
          w.r += cur.spd * dt;
          if (w.r > w.max) continue;
          const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
          if (Math.abs(d - w.r) < w.band + pl.r) env.hurtPlayer(w.dmg * dt * 2.0);
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
    const s = e._mt.stage;
    const pool = availableAttacks(s);
    let opts = pool;
    if (e._mt.last && pool.length > 1) opts = pool.filter(k => k !== e._mt.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    e._mt.last = k;
    return k;
  }

  function startAttack(e, key) {
    const A = ATTACKS[key];
    const cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
    e._mt.cur = cur;
  }

  function tick(e, dt) {
    if (!env) return;
    if (!e._mt) {
      e._mt = { stage: 1, cur: null, last: null, idle: 0.8, hitFlash: 0, intro: 1.4, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5 };
    }
    const mt = e._mt;
    mt.hitFlash = Math.max(0, mt.hitFlash - dt);
    mt.dodgeCD = Math.max(0, (mt.dodgeCD || 0) - dt);
    if (mt.intro > 0) { mt.intro -= dt; e.vx = 0; e.vy = 0; return; }

    if (mt.dodgeT > 0) {
      mt.dodgeT -= dt;
      e.vx = mt.dodgeVx; e.vy = mt.dodgeVy;
      mt.dodgeVx *= 0.86; mt.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (mt.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      if (env.addEffect && Math.random() < 0.4) env.addEffect(e.x, e.y, 'pop', 0.3, EMBER);
      return;
    }

    if (e.absorbing) {
      mt.cur = null;
      const pl = env.player;
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 0.4;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.10);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.10);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      setShieldWarn(true);
      return;
    }
    setShieldWarn(false);

    if (mt.phaseAnim) {
      mt.phaseAnim.t += dt;
      const pa = mt.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { mt.phaseAnim = null; mt.idle = 0.5; mt.cur = null; }
      return;
    }

    const ns = stageFor(e);
    if (ns !== mt.stage) {
      const old = mt.stage;
      mt.stage = ns;
      mt.cur = null;
      mt.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'cinder', accent: ACCENT, name: 'The Magma Titan', from: old, to: ns });
      return;
    }

    // reactive dodge (heavy Titan dodges less — it's slow and committed)
    if (mt.dodgeCD <= 0 && !mt.cur && env.ents && env.ents.bullets) {
      const dodgeChance = [0, 0.10, 0.18, 0.28, 0.40][mt.stage] || 0.2;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 360 || d < 6) continue;
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        const closing = (dx * (b.vx || 0) + dy * (b.vy || 0)) / spd;
        if (closing <= 0) continue;
        if (env.rand(0, 1) > dodgeChance) { mt.dodgeCD = 0.8; break; }
        const bvnx = (b.vx || 0) / spd, bvny = (b.vy || 0) / spd;
        let nx = -bvny, ny = bvnx;
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.0 + mt.stage * 0.2);
        mt.dodgeVx = nx * dashSp; mt.dodgeVy = ny * dashSp;
        mt.dodgeT = 0.26; mt.dodgeCD = 1.8 - mt.stage * 0.1;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, EMBER);
        return;
      }
    }

    const pl = env.player;
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    let moving = true;
    if (mt.cur) {
      const c = mt.cur;
      // the Titan commits and stands still for most attacks
      if (c.phase === 'windup' || c.phase === 'active') moving = (c.key === 'chainDrag');
    }
    if (moving && d2p > 170 * 170) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 0.95;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.12);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.12);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    if (!mt.cur) {
      mt.idle -= dt;
      if (mt.idle <= 0) startAttack(e, pickNext(e));
      return;
    }
    const c = mt.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.4 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) {
      c.phase = 'tele'; c.t = 0;
      if (c.key === 'anvilfall') { c.x = env.player.x; c.y = env.player.y; c.locked = true; }
      else if (c.key === 'chainDrag') { const pl = env.player; c.cx = e.x; c.cy = e.y; c.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.7; c.sweep = 1.6; c.len = 700; c.thick = 30; }
      else if (c.key === 'chainSnare') { const pl = env.player; c.cx = pl.x; c.cy = pl.y; c.r0 = 360; c.gap = 0.9; c.gapAng = Math.atan2(pl.y - e.y, pl.x - e.x); }
    }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      ATTACKS[c.key].build(e, c);
      if (c.dmg) c.dmg *= 3.0;
      if (c.waves) for (const w of c.waves) w.dmg *= 3.0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
    }
    else if (c.phase === 'active' && c.t >= P.active) { c.phase = 'recover'; c.t = 0; c.zones = null; c.vents = null; c.tip = null; }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      mt.cur = null;
      mt.idle = stageInterval(mt.stage);
      return;
    }
    if (c.phase === 'active') ATTACKS[c.key].tick(e, c, dt);
  }

  // ---- 2D rendering ----
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 44;
    const mt = e._mt || {};
    const stage = mt.stage || 1;

    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rr * 0.7, rr * 1.0, rr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (1.7 + stage * 0.2);
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 + stage));
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.4, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(255,120,40,' + (0.20 + 0.06 * stage) + ')');
    ag.addColorStop(0.6, 'rgba(255,69,0,' + (0.14 * pulse) + ')');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    const ang = env.angleTo ? env.angleTo(e.x, e.y, env.player.x, env.player.y) : Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    if (imgReady) {
      const dR = rr + 18;
      ctx.drawImage(img, -dR, -dR, dR * 2, dR * 2);
    } else {
      ctx.fillStyle = '#2a1a14';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    }
    if (mt.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = mt.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // blazing core glow (chest)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const coreBoost = (mt.cur && mt.cur.key === 'corebreakQuench' && (mt.cur.phase === 'windup' || mt.cur.phase === 'tele')) ? (mt.cur.t / (mt.cur.phases.windup + mt.cur.phases.tele)) : 0;
    const gI = 0.6 + 0.3 * Math.sin(t * 3) + coreBoost * 1.4 + (stage - 1) * 0.12;
    const gg = ctx.createRadialGradient(cx, cy - rr * 0.1, 2, cx, cy - rr * 0.1, rr * 0.75);
    gg.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, gI) + ')');
    gg.addColorStop(0.4, 'rgba(255,215,0,' + (0.6 * gI) + ')');
    gg.addColorStop(0.8, 'rgba(255,69,0,' + (0.3 * gI) + ')');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy - rr * 0.1, rr * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    if (e.absorbing) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const shR = rr * 1.8 + Math.sin(t * 3) * 4;
      const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
      sg.addColorStop(0, 'rgba(255,106,42,0)');
      sg.addColorStop(0.7, 'rgba(255,106,42,0.18)');
      sg.addColorStop(1, 'rgba(255,106,42,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,106,42,0.85)';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (mt.cur) drawTelegraph2D(ctx, mt.cur, t);
    if (mt.phaseAnim) drawPhaseAnim2D(ctx, e, mt.phaseAnim, t);

    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ff6a2a';
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
    const rr = e.r || 44;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const ringR = rr + p * 540;
    ctx.strokeStyle = 'rgba(255,140,40,' + (0.9 * (1 - p)) + ')';
    ctx.lineWidth = 12 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,69,0,' + (0.7 * (1 - p)) + ')';
    ctx.lineWidth = 7 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.78, 0, Math.PI * 2); ctx.stroke();
    const flash = 1 - p;
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.4);
    fg.addColorStop(0, 'rgba(255,255,220,' + (0.85 * flash) + ')');
    fg.addColorStop(0.5, 'rgba(255,140,40,' + (0.5 * flash) + ')');
    fg.addColorStop(1, 'rgba(255,69,0,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 2.4, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const rr2 = rr * (1.2 + i * 0.5) * (0.5 + 0.5 * p);
      ctx.strokeStyle = 'rgba(255,180,80,' + (0.6 * (1 - p)) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -t * 60 * (i % 2 ? -1 : 1);
      ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Realistic interlocking chain links drawn along an arc (top-down view).
  function drawChainArc(ctx, sx, sy, cx, cy, radius, a0, a1, linkLen, linkW, glow, t) {
    const span = a1 - a0;
    if (Math.abs(span) < 0.02 || radius < 4) return;
    const step = (linkLen * 0.85) / radius;
    const n = Math.max(2, Math.floor(span / step));
    const da = span / n;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = a0 + da * i;
      const x = cx + Math.cos(a) * radius, y = cy + Math.sin(a) * radius;
      if (prev) {
        const mx = (prev.x + x) / 2, my = (prev.y + y) / 2;
        const ang = Math.atan2(y - prev.y, x - prev.x);
        ctx.save();
        ctx.translate(sx(mx), sy(my));
        ctx.rotate(ang + (i % 2 ? Math.PI / 2 : 0));
        const g = ctx.createLinearGradient(0, -linkW, 0, linkW);
        g.addColorStop(0, '#7a5a3a');
        g.addColorStop(0.45, '#3a2410');
        g.addColorStop(0.55, '#2a1a0a');
        g.addColorStop(1, '#5a3e22');
        ctx.beginPath();
        ctx.ellipse(0, 0, linkLen * 0.5, linkW * 0.52, 0, 0, Math.PI * 2);
        ctx.ellipse(0, 0, linkLen * 0.34, linkW * 0.34, 0, 0, Math.PI * 2, true);
        ctx.fillStyle = g;
        ctx.fill('evenodd');
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = glow; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, 0, linkLen * 0.5, linkW * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      prev = { x, y };
    }
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

      if (cur.key === 'anvilfall') {
        const hx = cur.x, hy = cur.y;   // locked at tele start — no longer tracks the player
        const r = (tele ? 0.5 + 0.5 * tp : 1) * 80;
        ctx.strokeStyle = 'rgba(255,170,60,1)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 6]); ctx.lineDashOffset = -t * 50;
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), r, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,69,0,0.42)';
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), r, 0, Math.PI * 2); ctx.fill();
        if (cur.phase === 'active') {
          ctx.strokeStyle = 'rgba(255,180,80,0.9)';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(sx(cur.x), sy(cur.y), Math.max(1, cur.r), 0, Math.PI * 2); ctx.stroke();
        }
      } else if (cur.key === 'chainDrag') {
        const prog = tele ? tp : Math.min(1, cur.t / cur.phases.active);
        const a0 = cur.ang0, a1 = cur.ang0 + cur.sweep * (tele ? 1 : prog);
        drawChainArc(ctx, sx, sy, cur.cx, cur.cy, cur.len, a0, a1, 26, cur.thick * 0.92, 'rgba(255,120,40,' + (tele ? 0.8 * tp : 1) + ')', t);
        if (cur.tip && !tele) {
          ctx.fillStyle = 'rgba(255,215,0,1)';
          ctx.shadowColor = '#ff8a3a'; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.arc(sx(cur.tip.x), sy(cur.tip.y), cur.thick * 0.7, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else if (cur.key === 'forgeVent' && cur.vents) {
        for (const v of cur.vents) {
          ctx.fillStyle = 'rgba(255,69,0,0.48)';
          ctx.strokeStyle = 'rgba(255,170,60,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(sx(v.x), sy(v.y), 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (v.len > 0) {
            const ex = v.x + Math.cos(cur.dir) * v.len, ey = v.y + Math.sin(cur.dir) * v.len;
            ctx.strokeStyle = 'rgba(255,90,20,0.85)';
            ctx.lineWidth = cur.surgeW * 0.9;
            ctx.beginPath(); ctx.moveTo(sx(v.x), sy(v.y)); ctx.lineTo(sx(ex), sy(ey)); ctx.stroke();
          }
        }
      } else if (cur.key === 'moltenBrand') {
        const pl = env.player;
        const hx = tele ? pl.x : cur.x, hy = tele ? pl.y : cur.y;
        const grow = tele ? tp : 1;
        ctx.strokeStyle = 'rgba(255,170,60,1)';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 50;
        ctx.beginPath(); ctx.arc(sx(hx), sy(hy), cur.r * grow, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        if (cur.phase === 'active' && cur.t > cur.burstAt) {
          ctx.fillStyle = 'rgba(255,69,0,0.5)';
          ctx.beginPath(); ctx.arc(sx(cur.x), sy(cur.y), cur.r, 0, Math.PI * 2); ctx.fill();
        }
      } else if (cur.key === 'chainSnare') {
        const p = tele ? 0 : Math.min(1, cur.t / cur.phases.active);
        const r = cur.r0 * (1 - p * 0.78);
        drawChainArc(ctx, sx, sy, cur.cx, cur.cy, Math.max(1, r), cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2, 30, 28, 'rgba(255,120,40,' + (tele ? 0.7 : 1) + ')', t);
      } else if (cur.key === 'foundryCollapse') {
        const lx = cur.x, ly = cur.y;
        if (cur.t < cur.landAt) {
          ctx.fillStyle = 'rgba(255,140,40,' + (0.5 * (cur.t / cur.landAt)) + ')';
          ctx.strokeStyle = 'rgba(255,90,20,0.95)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(sx(lx), sy(ly), 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else if (cur.r < cur.maxR) {
          ctx.strokeStyle = 'rgba(255,170,60,1)';
          ctx.lineWidth = cur.band;
          ctx.beginPath(); ctx.arc(sx(lx), sy(ly), Math.max(1, cur.r), cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2); ctx.stroke();
        }
      } else if (cur.key === 'corebreakQuench') {
        // darken arena + show safe cone behind Titan
        ctx.fillStyle = 'rgba(10,4,2,' + (0.3 * tp) + ')';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = 'rgba(125,255,163,0.24)';
        ctx.beginPath();
        ctx.moveTo(sx(cur.cx), sy(cur.cy));
        ctx.arc(sx(cur.cx), sy(cur.cy), 900, cur.safeAng - cur.safeHalf, cur.safeAng + cur.safeHalf);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(125,255,163,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx(cur.cx), sy(cur.cy));
        ctx.lineTo(sx(cur.cx) + Math.cos(cur.safeAng - cur.safeHalf) * 900, sy(cur.cy) + Math.sin(cur.safeAng - cur.safeHalf) * 900);
        ctx.moveTo(sx(cur.cx), sy(cur.cy));
        ctx.lineTo(sx(cur.cx) + Math.cos(cur.safeAng + cur.safeHalf) * 900, sy(cur.cy) + Math.sin(cur.safeAng + cur.safeHalf) * 900);
        ctx.stroke();
      } else if (cur.key === 'worldForgingBlow') {
        for (const w of cur.waves) {
          if (cur.t < w.fire) continue;
          if (w.r > w.max) continue;
          ctx.strokeStyle = 'rgba(255,170,60,1)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, w.r), 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ---- 3D rendering ----
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const mt = e._mt || {};
    const stage = mt.stage || 1;
    const rr = e.r || 44;
    const x = e.x, z = e.y;
    const hb = rr * 1.2 + Math.sin(tt * 2.4) * 3;

    R.quads.alpha.push(x, 1.2, z, rr * 2.6, 0, 0, 0, 0.4, 0, 11, 0, 1);

    // inflated sprite mesh (the Magma Titan) — heavy, upright
    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.6, power: 0.5 });
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
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        } else {
          R.draw(sp.mesh, mm(x, hb, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        }
      }
    }

    // dangling broken chains — rusted iron links around shoulders/arms
    drawChains(R, x, hb, z, rr, tt, stage);

    // warding shield dome
    if (e.absorbing) {
      const pul = 0.5 + 0.5 * Math.sin(tt * 2.4);
      const shR = rr * 2.2;
      const sc = R.hexRGB(ACCENT);
      R.draw(U.sphere, mm(x, hb + shR * 0.55, z, tt * 0.3, shR, shR * 1.15, shR), mat(sc, { alpha: 0.10 + 0.05 * pul, emissive: [sc[0] * 0.4, sc[1] * 0.4, sc[2] * 0.4], rim: 1.6, rimCol: sc, shadow: false, rough: 0.2, metal: 0.2 }));
      R.draw(U.torus, mm(x, hb + 4, z, tt * 0.8, shR * 0.95, shR * 0.95, shR * 0.95, 0.12), mat([1, 1, 1], { emissive: sc, alpha: 0.5 + 0.2 * pul, shadow: false }));
      R.draw(U.torus, mm(x, hb + shR * 0.9, z, -tt * 0.6 + 1.2, shR * 0.7, shR * 0.7, shR * 0.7, 0.1), mat([1, 1, 1], { emissive: sc, alpha: 0.45, shadow: false }));
      R.glow(x, hb + shR * 0.5, z, shR * 1.4, sc[0], sc[1], sc[2], 0.35 + 0.15 * pul, 0);
      R.light(x, z, hb + shR, 320, sc[0], sc[1], sc[2], 0.7);
    }

    // blazing chest core — blinding white-yellow sphere + glow + light
    const coreBoost = (mt.cur && mt.cur.key === 'corebreakQuench' && (mt.cur.phase === 'windup' || mt.cur.phase === 'tele')) ? (mt.cur.t / (mt.cur.phases.windup + mt.cur.phases.tele)) : 0;
    const gI = 0.7 + 0.3 * Math.sin(tt * 3) + coreBoost * 1.6 + (stage - 1) * 0.12;
    const coreR = rr * 0.28 * (1 + coreBoost * 0.8);
    R.draw(U.sphere, mm(x, hb + rr * 0.1, z, tt * 0.4, coreR, coreR, coreR), mat([1.6, 1.4, 0.9], { emissive: [2.2, 1.8, 0.8], emisK: 2.6 + coreBoost * 1.5, rough: 0.2, metal: 0.3, shadow: false, rim: 1.8, rimCol: R.hexRGB(GLYPH) }));
    R.glow(x, hb + rr * 0.1, z, rr * (1.4 + coreBoost * 1.0), 1.0, 0.8, 0.3, Math.min(1, gI) * 0.9, 0);
    R.light(x, z, hb + 10, 180 + stage * 50 + coreBoost * 200, 1.3, 0.9, 0.35, 0.6 + 0.2 * Math.sin(tt * 3));

    // molten ground aura ring
    const ringC = R.hexRGB(ACCENT);
    R.decal(x, z, rr * (2 + stage * 0.25), ringC[0], ringC[1], ringC[2], 0.28 + 0.1 * Math.sin(tt * 2), 9, tt * 0.6, 0, true, 1.4);

    // rising embers + falling ash (more in later stages)
    const moteN = 2 + stage;
    for (let i = 0; i < moteN; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.6 + Math.random() * 0.9);
        const rising = Math.random() < 0.7;
        if (rising) {
          R.emit({ x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d, vx: (Math.random() - 0.5) * 8, vy: 30 + Math.random() * 30, vz: (Math.random() - 0.5) * 8, life: 1.2 + Math.random() * 0.7, age: 0, s0: 6, s1: 1, col: Math.random() < 0.5 ? R.hexRGB(EMBER) : R.hexRGB(LAVA), a: 0.85, kind: 0, drag: 0.7 });
        } else {
          R.emit({ x: x + Math.cos(a) * d * 1.4, y: hb + rr * 1.5 + Math.random() * 60, z: z + Math.sin(a) * d * 1.4, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 12, vz: (Math.random() - 0.5) * 6, life: 2.0 + Math.random(), age: 0, s0: 4, s1: 2, col: R.hexRGB(ASH), a: 0.5, kind: 0, drag: 0.95 });
        }
      }
    }

    if (mt.cur) drawTelegraph3D(R, mt.cur, tt);
    if (mt.phaseAnim) drawPhaseAnim3D(R, e, mt.phaseAnim, tt, hb);
  }

  // dangling broken chains — rusted iron links + spear tips
  function drawChains(R, x, hb, z, rr, tt, stage) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const chainC = R.hexRGB(CHAIN);
    const n = 4 + stage;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + tt * 0.1;
      const sx = x + Math.cos(a) * rr * 0.9, sz = z + Math.sin(a) * rr * 0.9;
      const sway = Math.sin(tt * 1.6 + i) * 6;
      const len = rr * (1.2 + 0.4 * Math.sin(tt * 1.2 + i * 1.7));
      // chain links as a short stack of toruses
      const steps = 3;
      for (let k = 0; k < steps; k++) {
        const fy = hb + rr * 0.6 - k * 8;
        const fx = sx + sway * (k / steps), fz = sz;
        R.draw(U.torus, mm(fx, fy, fz, a + k * 0.4, 5, 2, 5, 0.18), mat(chainC, { rough: 0.6, metal: 0.5, emissive: [0.12, 0.07, 0.03], emisK: 1.2, rim: 0.8, rimCol: R.hexRGB(LAVA) }));
      }
      // spear tip
      const tipY = hb + rr * 0.6 - steps * 8 - len * 0.5;
      R.draw(U.cone, mm(sx + sway, tipY, sz, 0, 3.5, len, 3.5, 0, Math.PI), mat(chainC, { rough: 0.5, metal: 0.6, emissive: [0.18, 0.10, 0.04], emisK: 1.4, rim: 1.0, rimCol: R.hexRGB(EMBER) }));
      R.glow(sx + sway, tipY, sz, 8, 0.6, 0.3, 0.1, 0.3, 0);
    }
  }

  function drawPhaseAnim3D(R, e, pa, tt, hb) {
    if (!env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 44;
    const p = Math.min(1, pa.t / pa.dur);
    const fade = 1 - p;
    const ringR = rr + p * 540;
    const A = R.hexRGB(ACCENT), G = R.hexRGB(GLYPH);
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 10 * fade, ringR, 0.18), mat([1.8, 0.6, 0.15], { emissive: [2.4, 0.8, 0.15], emisK: 2.4, alpha: 0.9 * fade, shadow: false }));
    R.draw(U.torus, mm(x, 6, z, -tt * 1.2, ringR * 0.78, 2 + 7 * fade, ringR * 0.78, 0.14), mat([1.2, 0.35, 0.08], { emissive: [1.6, 0.5, 0.1], emisK: 2.0, alpha: 0.8 * fade, shadow: false }));
    R.glow(x, hb, z, rr * (1.4 + p * 1.2), 1.0, 0.6, 0.2, 0.9 * fade, 0);
    R.light(x, z, hb + 20, 340 + p * 280, 1.6, 0.7, 0.2, 0.9 * fade);
    sigil(R, x, z, ringR * 0.9, [1.6, 0.6, 0.15], 0.7 * fade, tt, 0.8);
    sigil(R, x, z, ringR * 0.55, A, 0.6 * fade, tt, -0.6);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.85) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.4 + Math.random() * 1.8);
        R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (24 + 50 * fade), vy: 70 + Math.random() * 90, vz: Math.sin(a) * (24 + 50 * fade), life: 1.0 + Math.random() * 0.7, age: 0, s0: 10, s1: 2, col: Math.random() < 0.5 ? R.hexRGB(EMBER) : G, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.45 * fade);
  }

  function sigil(R, x, z, r, col, intensity, tt, spin) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5 * intensity, 9, tt * (spin || 0.6), 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7 * intensity, 6, -tt * (spin || 0.6) * 1.4, 0, true, 1.6);
    R.decal(x, z, r * 0.34, col[0] * 1.3, col[1] * 1.3, col[2] * 1.3, 0.9 * intensity, 12, tt * (spin || 0.6) * 2, 0, true, 1.8);
  }

  // jagged volcanic rock pillar — faceted obsidian trunk + glowing fissures
  function lavaPillar(R, x, z, baseR, h, col, emiCol, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    R.draw(U.rock3, mm(x, h * 0.5, z, seed * 2.3, baseR, h, baseR, seed * 0.2), mat(col, { rough: 0.7, metal: 0.15, emissive: emiCol, emisK: 1.8, rim: 1.2, rimCol: R.hexRGB(LAVA) }));
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      const tx = x + Math.cos(a) * baseR * 0.7, tz = z + Math.sin(a) * baseR * 0.7;
      const th = h * (0.5 + 0.2 * ((seed * 7 + i) % 3));
      R.draw(U.cone, mm(tx, th * 0.5, tz, a + Math.PI / 2, baseR * 0.22, th, baseR * 0.22, 0, Math.PI / 2 - 0.4), mat(col, { rough: 0.6, metal: 0.25, emissive: emiCol, emisK: 1.6, rim: 1.0, rimCol: R.hexRGB(EMBER) }));
    }
    R.glow(x, h, z, baseR * 1.7, emiCol[0], emiCol[1], emiCol[2], 0.65, 0);
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const A = R.hexRGB(ACCENT);
    const LAVAC = R.hexRGB(LAVA);
    const GLYPHC = R.hexRGB(GLYPH);
    const EMBERC = R.hexRGB(EMBER);
    const ASHC = R.hexRGB(ASH);
    const active = cur.phase === 'active';
    const tele = cur.phase === 'tele';
    const tprog = tele ? cur.t / cur.phases.tele : 1;
    const aprog = active ? Math.min(1, cur.t / cur.phases.active) : 0;

    if (cur.key === 'anvilfall') {
      const pl = env.player;
      const hx = tele ? pl.x : cur.x, hz = tele ? pl.y : cur.y;
      sigil(R, hx, hz, 80 * 1.4, A, 0.6 * tprog + 0.4, tt, 0.6);
      if (active) {
        const r = Math.max(1, cur.r);
        // expanding shockwave — a ring of jagged rock + glow
        const n = 26;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + tt * 0.5;
          const rx = cur.x + Math.cos(a) * r, rz = cur.y + Math.sin(a) * r;
          const h = 16 + Math.sin(tt * 6 + i) * 6;
          R.draw(U.rock3, mm(rx, h * 0.5, rz, a * 2 + i, 7, h, 7, i * 0.2), mat([0.3, 0.14, 0.06], { rough: 0.7, metal: 0.15, emissive: [1.4, 0.4, 0.08], emisK: 1.6 }));
        }
        R.glow(cur.x, 18, cur.y, r * 0.8, 1.0, 0.4, 0.1, 0.5, 0);
        R.light(cur.x, cur.y, 24, 220 + r, 1.2, 0.45, 0.1, 0.6);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.2 * Math.min(1, cur.t * 4));
        if (Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2;
          R.emit({ x: cur.x + Math.cos(a) * r, y: 2, z: cur.y + Math.sin(a) * r, vx: Math.cos(a) * 24, vy: 60 + Math.random() * 50, vz: Math.sin(a) * 24, life: 0.8, age: 0, s0: 8, s1: 2, col: EMBERC, a: 0.8, kind: 0, drag: 0.6 });
        }
      } else {
        R.glow(hx, 4, hz, 80 * 1.2, 1.0, 0.5, 0.12, 0.5 * tprog, 0);
        R.decal(hx, hz, 40, GLYPHC[0], GLYPHC[1], GLYPHC[2], 0.5 * tprog, 12, -tt * 0.8, 0, true, 1.6);
      }
    } else if (cur.key === 'chainDrag') {
      const prog = tele ? tprog : Math.min(1, cur.t / cur.phases.active);
      const a0 = cur.ang0, a1 = cur.ang0 + cur.sweep * (tele ? 1 : prog);
      // arc telegraph on ground
      const n = 18;
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        const rx = cur.cx + Math.cos(a) * cur.len, rz = cur.cy + Math.sin(a) * cur.len;
        R.decal(rx, rz, 14, 0.6, 0.3, 0.08, 0.4 * tprog, 8, a, 0, true, 6.0);
      }
      if (cur.tip) {
        // the chain itself — a long rusted cylinder with links
        const tx = cur.tip.x, tz = cur.tip.y;
        const mx = (cur.cx + tx) / 2, mz = (cur.cy + tz) / 2;
        const len = Math.hypot(tx - cur.cx, tz - cur.cy);
        const ang = Math.atan2(tz - cur.cy, tx - cur.cx);
        const ch = 26;
        R.draw(U.cyl, mm(mx, ch, mz, ang, cur.thick * 0.4, ch, cur.thick * 0.4), mat(R.hexRGB(CHAIN), { rough: 0.55, metal: 0.6, emissive: [0.18, 0.10, 0.04], emisK: 1.4, rim: 1.0, rimCol: EMBERC }));
        // glowing hot tip
        R.draw(U.sphere, mm(tx, ch, tz, tt * 2, cur.thick * 0.4, cur.thick * 0.4, cur.thick * 0.4), mat([1.4, 0.5, 0.1], { emissive: [1.8, 0.7, 0.15], emisK: 2.2, rough: 0.3, metal: 0.3, shadow: false, rim: 1.6, rimCol: LAVAC }));
        R.glow(tx, ch, tz, cur.thick * 2, 1.2, 0.5, 0.1, 0.7, 0);
        R.light(tx, tz, ch, 160, 1.2, 0.5, 0.1, 0.7);
        if (Math.random() < 0.6) R.emit({ x: tx, y: ch, z: tz, vx: (Math.random() - .5) * 20, vy: 30 + Math.random() * 30, vz: (Math.random() - .5) * 20, life: 0.7, age: 0, s0: 7, s1: 2, col: EMBERC, a: 0.8, kind: 0, drag: 0.6 });
      }
    } else if (cur.key === 'forgeVent' && cur.vents) {
      for (let i = 0; i < cur.vents.length; i++) {
        const v = cur.vents[i];
        // vent mouth — a glowing crack in the ground
        R.decal(v.x, v.y, 26, 1.0, 0.3, 0.05, 0.5 + 0.3 * Math.sin(tt * 4 + i), 8, cur.dir, 0, true, 4.0);
        R.glow(v.x, 4, v.y, 30, 1.2, 0.4, 0.08, 0.6, 0);
        R.light(v.x, v.y, 16, 120, 1.2, 0.4, 0.1, 0.6);
        if (v.len > 0) {
          // advancing lava surge — a glowing molten rectangle
          const steps = Math.max(2, Math.floor(v.len / 50));
          for (let s = 0; s <= steps; s++) {
            const f = s / steps;
            const px = v.x + Math.cos(cur.dir) * v.len * f, pz = v.y + Math.sin(cur.dir) * v.len * f;
            const h = 14 + Math.sin(tt * 6 + s + i) * 6;
            R.draw(U.rock3, mm(px, h * 0.5, pz, cur.dir + s * 0.5 + i, cur.surgeW * 0.5, h, cur.surgeW * 0.5, s * 0.2), mat([0.5, 0.14, 0.04], { rough: 0.4, metal: 0.2, emissive: [1.6, 0.45, 0.08], emisK: 2.0, rim: 1.0, rimCol: LAVAC }));
          }
          const ex = v.x + Math.cos(cur.dir) * v.len, ez = v.y + Math.sin(cur.dir) * v.len;
          R.glow(ex, 16, ez, cur.surgeW * 1.4, 1.4, 0.5, 0.1, 0.7, 0);
          R.light(ex, ez, 20, 180, 1.4, 0.5, 0.1, 0.7);
          if (Math.random() < 0.7) R.emit({ x: ex + (Math.random() - .5) * cur.surgeW, y: 4, z: ez + (Math.random() - .5) * cur.surgeW, vx: Math.cos(cur.dir) * 30, vy: 50 + Math.random() * 50, vz: Math.sin(cur.dir) * 30, life: 0.8, age: 0, s0: 8, s1: 2, col: EMBERC, a: 0.85, kind: 0, drag: 0.5 });
        }
      }
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.12 * aprog : 0.05 * tprog);
    } else if (cur.key === 'moltenBrand') {
      const pl = env.player;
      const hx = tele ? pl.x : cur.x, hz = tele ? pl.y : cur.y;
      const grow = tele ? tprog : 1;
      sigil(R, hx, hz, cur.r * 1.2 * grow, A, 0.5 * grow, tt, 0.6);
      R.glow(hx, 4, hz, cur.r * 1.1 * grow, 1.2, 0.5, 0.1, 0.5 * grow, 0);
      R.light(hx, hz, 14, 120 * grow, 1.2, 0.5, 0.1, 0.6);
      if (active && cur.t > cur.burstAt) {
        // eruption — a burst of lava spires
        const burst = (cur.t - cur.burstAt) / (cur.phases.active - cur.burstAt);
        if (burst < 0.6) {
          lavaPillar(R, cur.x, cur.y, cur.r * 0.4, cur.r * 1.8 * Math.min(1, burst * 3), [0.4, 0.14, 0.05], [1.4, 0.45, 0.08], tt, 0.6);
          R.glow(cur.x, cur.r * 1.8, cur.y, cur.r * 2.2, 1.4, 0.6, 0.12, 0.8, 0);
          R.light(cur.x, cur.y, cur.r * 1.5, 280, 1.4, 0.5, 0.1, 0.8);
          R.cameraKick = Math.max(R.cameraKick || 0, 0.2);
          if (Math.random() < 0.8) {
            const a = Math.random() * Math.PI * 2;
            R.emit({ x: cur.x + Math.cos(a) * cur.r, y: cur.r * Math.random(), z: cur.y + Math.sin(a) * cur.r, vx: Math.cos(a) * 40, vy: 80 + Math.random() * 60, vz: Math.sin(a) * 40, life: 0.9, age: 0, s0: 9, s1: 2, col: EMBERC, a: 0.9, kind: 0, drag: 0.5 });
          }
        }
      }
    } else if (cur.key === 'chainSnare') {
      const p = Math.min(1, cur.t / cur.phases.active);
      const r = Math.max(8, cur.r0 * (1 - p * 0.78));
      // closing chain barrier — an arc of chain links with a gap
      const n = 24;
      for (let i = 0; i < n; i++) {
        const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
        const rx = cur.cx + Math.cos(a) * r, rz = cur.cy + Math.sin(a) * r;
        R.draw(U.torus, mm(rx, 16, rz, a, 4, 2, 4, 0.18), mat(R.hexRGB(CHAIN), { rough: 0.55, metal: 0.6, emissive: [0.2, 0.12, 0.05], emisK: 1.5, rim: 1.0, rimCol: EMBERC }));
        if (i % 3 === 0) R.glow(rx, 18, rz, 7, 0.6, 0.3, 0.08, 0.35, 0);
      }
      sigil(R, cur.cx, cur.cy, r * 0.5, A, 0.4 * tprog, tt, 0.5);
      R.glow(cur.cx, 14, cur.cy, r * 0.7, 0.8, 0.4, 0.1, 0.4, 0);
      if (Math.random() < 0.5) {
        const a = cur.gapAng + (Math.random() - 0.5) * (Math.PI * 2 - cur.gap) + cur.gap / 2;
        R.emit({ x: cur.cx + Math.cos(a) * r, y: 16, z: cur.cy + Math.sin(a) * r, vx: 0, vy: 20 + Math.random() * 20, vz: 0, life: 1.2, age: 0, s0: 6, s1: 2, col: EMBERC, a: 0.5, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'foundryCollapse') {
      if (cur.t < cur.landAt) {
        // thrown pillar descending
        const fall = cur.t / cur.landAt;
        const fy = 220 * (1 - fall) + 8;
        lavaPillar(R, cur.x, cur.y, 26, 90, [0.35, 0.12, 0.05], [1.2, 0.4, 0.08], tt, 0.4);
        R.draw(U.rock3, mm(cur.x, fy, cur.y, tt * 3, 22, 60, 22, 0.2), mat([0.35, 0.12, 0.05], { rough: 0.6, metal: 0.2, emissive: [1.2, 0.4, 0.08], emisK: 1.6, rim: 1.0, rimCol: EMBERC }));
        R.glow(cur.x, fy, cur.y, 40, 1.0, 0.4, 0.1, 0.6, 0);
        sigil(R, cur.x, cur.y, 56 * (0.3 + 0.7 * fall), A, 0.5 * fall, tt, 0.6);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.1 * fall);
      } else if (cur.r < cur.maxR) {
        // debris ring with a gap
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
          const rx = cur.x + Math.cos(a) * cur.r, rz = cur.y + Math.sin(a) * cur.r;
          const h = 18 + Math.sin(tt * 5 + i) * 8;
          R.draw(U.rock3, mm(rx, h * 0.5, rz, a * 2 + i, 9, h, 9, i * 0.2), mat([0.35, 0.12, 0.05], { rough: 0.6, metal: 0.2, emissive: [1.3, 0.4, 0.08], emisK: 1.6 }));
          if (i % 2 === 0) R.glow(rx, h, rz, 10, 1.0, 0.4, 0.1, 0.5, 0);
        }
        R.glow(cur.x, 18, cur.y, cur.r * 0.8, 1.2, 0.5, 0.12, 0.5, 0);
        R.light(cur.x, cur.y, 22, 220 + cur.r, 1.2, 0.45, 0.1, 0.6);
        R.cameraKick = Math.max(R.cameraKick || 0, 0.15);
        if (Math.random() < 0.7) {
          const a = cur.gapAng + cur.gap / 2 + Math.random() * (Math.PI * 2 - cur.gap);
          R.emit({ x: cur.x + Math.cos(a) * cur.r, y: 2, z: cur.y + Math.sin(a) * cur.r, vx: Math.cos(a) * 30, vy: 60 + Math.random() * 50, vz: Math.sin(a) * 30, life: 0.9, age: 0, s0: 9, s1: 2, col: EMBERC, a: 0.85, kind: 0, drag: 0.5 });
        }
      }
    } else if (cur.key === 'corebreakQuench') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.25 * aprog : 0.12 * tprog);
      // arena darkening via a big dark decal + heat wave building
      const W = env.world.w, H = env.world.h;
      R.decal(W / 2, H / 2, Math.hypot(W, H) * 0.6, 0.1, 0.04, 0.02, 0.4 * tprog, 11, tt * 0.1, 0, true, 8.0);
      // the exposed core — blinding pillar of light
      const coreH = 240 * tprog;
      R.draw(U.cyl, mm(cur.cx, coreH * 0.5, cur.cy, 0, 26, coreH, 26), mat([1.8, 1.5, 0.9], { emissive: [2.8, 2.2, 1.0], emisK: 3.0, rough: 0.1, metal: 0.4, shadow: false, rim: 2.0, rimCol: GLYPHC }));
      R.glow(cur.cx, coreH * 0.5, cur.cy, 120 * tprog, 1.4, 1.1, 0.5, 0.9 * tprog, 0);
      R.light(cur.cx, cur.cy, coreH, 500, 1.6, 1.2, 0.5, 0.9 * tprog);
      // safe cone marker (shelter behind Titan)
      for (let i = 0; i < 5; i++) {
        const a = cur.safeAng + (i / 4 - 0.5) * cur.safeHalf * 2;
        const len = 900 * tprog;
        R.decal(cur.cx + Math.cos(a) * len * 0.5, cur.cy + Math.sin(a) * len * 0.5, 26, 0.3, 0.7, 0.4, 0.25 * tprog, 8, a, 0, true, 8.0);
      }
      if (active) {
        // heat wave burst — full arena ring of fire
        const n = 40;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rx = cur.cx + Math.cos(a) * 300, rz = cur.cy + Math.sin(a) * 300;
          R.draw(U.cone, mm(rx, 60, rz, a, 14, 120, 14, 0, a), mat([1.6, 0.5, 0.1], { emissive: [2.2, 0.8, 0.15], emisK: 2.6, rough: 0.2, metal: 0.3, shadow: false, rim: 1.8, rimCol: LAVAC }));
        }
        R.glow(cur.cx, 60, cur.cy, 400, 1.6, 0.7, 0.2, 0.9, 0);
        R.light(cur.cx, cur.cy, 80, 600, 1.6, 0.7, 0.2, 0.9);
        for (let p = 0; p < 8; p++) {
          if (Math.random() < 0.9) {
            const a = Math.random() * Math.PI * 2;
            R.emit({ x: cur.cx + Math.cos(a) * 200, y: 4, z: cur.cy + Math.sin(a) * 200, vx: Math.cos(a) * 60, vy: 80 + Math.random() * 80, vz: Math.sin(a) * 60, life: 1.0, age: 0, s0: 11, s1: 2, col: EMBERC, a: 0.95, kind: 0, drag: 0.4 });
          }
        }
      }
    } else if (cur.key === 'worldForgingBlow') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.3 * aprog : 0.15 * tprog);
      for (let wi = 0; wi < cur.waves.length; wi++) {
        const w = cur.waves[wi];
        if (cur.t < w.fire) continue;
        if (w.r > w.max) continue;
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + tt * 0.3 * (wi % 2 ? -1 : 1);
          const rx = cur.cx + Math.cos(a) * w.r, rz = cur.cy + Math.sin(a) * w.r;
          const h = 18 + Math.sin(tt * 5 + i + wi) * 7;
          R.draw(U.rock3, mm(rx, h * 0.5, rz, a * 2 + i + wi, 8, h, 8, i * 0.2), mat([0.32, 0.14, 0.06], { rough: 0.7, metal: 0.15, emissive: [1.5, 0.45, 0.1], emisK: 1.6 }));
          if (i % 2 === 0) R.draw(U.cone, mm(rx, h + 2, rz, a, 3, 9, 3), mat([1.4, 0.5, 0.12], { emissive: [1.8, 0.7, 0.15], emisK: 2.0, shadow: false }));
        }
        R.glow(cur.cx, 18, cur.cy, w.r * 0.8, 1.0, 0.4, 0.1, 0.5, 0);
        R.light(cur.cx, cur.cy, 22, 220 + w.r, 1.0, 0.4, 0.1, 0.6);
        sigil(R, cur.cx, cur.cy, w.r, [1.0, 0.4, 0.12], 0.3 + 0.2 * tprog, tt, -0.6);
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          R.emit({ x: cur.cx + Math.cos(a) * w.r, y: 2, z: cur.cy + Math.sin(a) * w.r, vx: (Math.random() - .5) * 30, vy: 50 + Math.random() * 60, vz: (Math.random() - .5) * 30, life: 1.0, age: 0, s0: 8, s1: 2, col: Math.random() < 0.4 ? [1.4, 0.5, 0.12] : ASHC, a: 0.8, kind: 0, drag: 0.6 });
        }
      }
    }
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 44; e.hp = e.maxhp = 3000; e.speed = 92; e.cd = 99; e.detectR = 1200;
    e.absorbing = true;
    e._mt = { stage: 1, cur: null, last: null, idle: 1.0, hitFlash: 0, intro: 1.6 };
    injectShieldWarn();
  }

  function onHit(e, dmg) {
    if (!e._mt) return;
    e._mt.hitFlash = Math.min(1, (e._mt.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  // ---- public API ----
  window.MagmaTitan = {
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
