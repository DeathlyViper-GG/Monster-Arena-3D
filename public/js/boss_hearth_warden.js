// ============================================================
// Monster Arena — THE HEARTH WARDEN (Story Realm 1 Boss)
// A custom boss with its own sprite, a 4-stage HP-based attack
// state machine that STACKS attacks as health drops, and a
// dedicated 3D presentation (inflated sprite mesh + emissive
// chest glyph + point light + particle aura + screen shake).
//
// Stage 1 (100–75%): Rootline, Spore Pods
// Stage 2 (75–50%):  + Grasping Roots, Spore Bloom
// Stage 3 (50–25%):  + Hearthquake, Thorn Cage
// Stage 4 (25–0%):   + Verdant Cataclysm, Heartflare
// Earlier attacks remain available in every later stage.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#7dffa3';      // moss / nature
  const GLYPH = '#ffb347';       // amber chest glyph
  const SPORE = '#aeeb60';       // bioluminescent mushrooms
  const ROOT = '#6a793a';        // root line

  // ---- engine refs (handed in via setEnv) ----
  let env = null;
  function E() { return env; }

  // ---- shield warning banner (shown while the warding shield holds) ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `
      #hwShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
        padding:11px 24px;border-radius:999px;pointer-events:none;display:none;
        font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;
        color:#eafff0;background:rgba(8,16,12,.84);
        border:1px solid #7dffa3;text-shadow:0 0 12px rgba(125,255,163,.6);
        white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis;
        animation:hwWarnPulse 1.6s ease-in-out infinite;}
      @keyframes hwWarnPulse{0%,100%{box-shadow:0 0 22px rgba(125,255,163,.4),inset 0 0 12px rgba(125,255,163,.14)}
        50%{box-shadow:0 0 38px rgba(125,255,163,.8),inset 0 0 20px rgba(125,255,163,.3)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'hwShieldWarn';
    warnEl.textContent = "🛡️ The Warden's shield holds — clear all monsters first!";
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  // ---- boss sprite (loaded once) ----
  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/04b6a0d36_Designer1.png';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = SPRITE_SRC;
  let imgReady = false;
  img.onload = () => { imgReady = true; };
  img.onerror = () => { imgReady = false; };

  // ---- attack definitions ----
  // Each: { name, minStage, windup, tele, active, recover, build(ctx,e,cur), tick(ctx,e,cur,dt) }
  // build() runs once at the start of the telegraph phase to lay out hazard zones.
  // tick() runs every frame during active phase to apply damage/knockback.
  const ATTACKS = {
    rootline: {
      name: 'Rootline', minStage: 1, windup: 0.55, tele: 0.85, active: 0.45, recover: 0.8,
      build(e, cur) {
        const pl = env.player;
        const a = Math.atan2(pl.y - e.y, pl.x - e.x);
        cur.ang = a;
        cur.zones = [];
        const len = 740, n = 7;
        for (let i = 1; i <= n; i++) {
          const d = (i / n) * len;
          cur.zones.push({ x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d, r: 46 });
        }
        cur.dmg = 16;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        for (const z of cur.zones) {
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt * 1.6);
            break;
          }
        }
      }
    },
    sporePods: {
      name: 'Spore Pods', minStage: 1, windup: 0.4, tele: 0.5, active: 3.0, recover: 0.6,
      build(e, cur) {
        const pl = env.player;
        cur.zones = [];
        const n = 3;
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 180;
          const a = Math.atan2(pl.y - e.y, pl.x - e.x);
          const tx = pl.x + Math.cos(a + Math.PI / 2) * off, ty = pl.y + Math.sin(a + Math.PI / 2) * off;
          cur.zones.push({ x: tx, y: ty, r: 70, land: 0.5 + i * 0.12 });
        }
        cur.dmg = 7; // dps while inside a cloud
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const age = cur.t; // time since active phase began
        for (const z of cur.zones) {
          if (age < z.land) continue; // still in flight
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt);
            pl.slowT = Math.max(pl.slowT || 0, 0.6);
            break;
          }
        }
      }
    },
    graspingRoots: {
      name: 'Grasping Roots', minStage: 2, windup: 0.5, tele: 0.7, active: 0.6, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.zones = [];
        const n = 5;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + env.rand(0, 0.5);
          const d = 90 + env.rand(0, 120);
          cur.zones.push({ x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, r: 44 });
        }
        cur.dmg = 10;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        let snared = false;
        for (const z of cur.zones) {
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) {
            env.hurtPlayer(cur.dmg * dt);
            snared = true;
          }
        }
        if (snared) pl.slowT = Math.max(pl.slowT || 0, 1.4);
      }
    },
    sporeBloom: {
      name: 'Spore Bloom', minStage: 2, windup: 0.5, tele: 0.6, active: 0.6, recover: 0.6,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.r = 300;
        cur.gap = 0.5; // radians of safe gap
        cur.gapAng = Math.atan2(env.player.y - e.y, env.player.x - e.x) + Math.PI; // gap opposite player? no — gap toward player so they can stay
        // Actually put the gap AT the player's angle so there's a safe lane toward the boss
        cur.gapAng = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        cur.dmg = 14;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (d > cur.r * 0.55 && d < cur.r) {
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          let diff = Math.abs(((a - cur.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > cur.gap / 2) env.hurtPlayer(cur.dmg * dt);
        }
      }
    },
    hearthquake: {
      name: 'Hearthquake', minStage: 3, windup: 0.8, tele: 0.5, active: 0.9, recover: 1.0,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.rings = [{ r: 0, max: 260, dmg: 18 }, { r: 0, max: 460, dmg: 14 }];
        cur.dmg = 16;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = (cur.t - cur.phases.tele - cur.phases.active * 0) / cur.phases.active; // 0..1 over active
        for (const r of cur.rings) {
          r.r = r.max * Math.min(1, p);
          const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
          // ring band ~ width 36
          if (Math.abs(d - r.r) < 34 + pl.r) env.hurtPlayer(r.dmg * dt * 1.8);
        }
      }
    },
    thornCage: {
      name: 'Thorn Cage', minStage: 3, windup: 0.5, tele: 0.8, active: 0.7, recover: 0.7,
      build(e, cur) {
        const pl = env.player;
        cur.cx = pl.x; cur.cy = pl.y;
        cur.r = 150;
        cur.dmg = 8;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (d > cur.r - 20) {
          // push back toward centre
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          const push = (d - (cur.r - 20)) * 0.5;
          pl.x -= Math.cos(a) * push;
          pl.y -= Math.sin(a) * push;
          env.hurtPlayer(cur.dmg * dt);
        }
      }
    },
    cataclysm: {
      name: 'Verdant Cataclysm', minStage: 4, windup: 1.0, tele: 1.2, active: 1.0, recover: 1.2,
      build(e, cur) {
        const pl = env.player;
        cur.cx = e.x; cur.cy = e.y;
        // three safe lanes radiating out; everything else damages
        cur.lanes = 3;
        cur.laneAng = Math.atan2(pl.y - e.y, pl.x - e.x); // one lane toward player
        cur.r = 520;
        cur.dmg = 20;
        // also a couple of root lines
        cur.zones = [];
        const a = Math.atan2(pl.y - e.y, pl.x - e.x);
        for (let i = 1; i <= 5; i++) {
          const d = (i / 5) * 560;
          cur.zones.push({ x: e.x + Math.cos(a + 0.4) * d, y: e.y + Math.sin(a + 0.4) * d, r: 40 });
        }
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (d < cur.r) {
          const a = Math.atan2(pl.y - cur.cy, pl.x - cur.cx);
          let inLane = false;
          for (let i = 0; i < cur.lanes; i++) {
            const la = cur.laneAng + (i - (cur.lanes - 1) / 2) * (Math.PI * 2 / cur.lanes);
            let diff = Math.abs(((a - la + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (diff < 0.42) { inLane = true; break; }
          }
          if (!inLane) env.hurtPlayer(cur.dmg * dt);
        }
        for (const z of cur.zones) {
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) { env.hurtPlayer(cur.dmg * dt * 0.8); break; }
        }
      }
    },
    heartflare: {
      name: 'Heartflare', minStage: 4, windup: 0.9, tele: 0.5, active: 0.5, recover: 0.9,
      build(e, cur) {
        cur.cx = e.x; cur.cy = e.y;
        cur.r = 360;
        cur.dmg = 22;
      },
      tick(e, cur, dt) {
        const pl = env.player;
        const p = (cur.t - cur.phases.tele) / cur.phases.active;
        const r = cur.r * Math.min(1, p);
        const d = Math.hypot(pl.x - cur.cx, pl.y - cur.cy);
        if (Math.abs(d - r) < 30 + pl.r) env.hurtPlayer(cur.dmg * dt * 2);
      }
    }
  };

  // stage interval (s) between attacks — shrinks as HP drops
  function stageInterval(stage) { return [1.2, 0.9, 0.65, 0.4][stage - 1] || 0.4; }

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
    const s = e._hw.stage;
    const pool = availableAttacks(s);
    // avoid immediately repeating the same attack
    let opts = pool;
    if (e._hw.last && pool.length > 1) opts = pool.filter(k => k !== e._hw.last);
    const k = opts[Math.floor(env.rand(0, opts.length))];
    e._hw.last = k;
    return k;
  }

  function startAttack(e, key) {
    const A = ATTACKS[key];
    const cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
    e._hw.cur = cur;
  }

  // ---- per-frame update (called from enemyBehavior) ----
  function tick(e, dt) {
    if (!env) return;
    if (!e._hw) {
      e._hw = { stage: 1, cur: null, last: null, idle: 0.6, hitFlash: 0, intro: 1.2, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5 };
    }
    const hw = e._hw;
    hw.hitFlash = Math.max(0, hw.hitFlash - dt);
    hw.dodgeCD = Math.max(0, (hw.dodgeCD || 0) - dt);
    if (hw.intro > 0) { hw.intro -= dt; e.vx = 0; e.vy = 0; return; }

    // ---- active dodge burst: apply dash velocity, decaying ----
    if (hw.dodgeT > 0) {
      hw.dodgeT -= dt;
      e.vx = hw.dodgeVx; e.vy = hw.dodgeVy;
      // decay the dash so it eases out
      hw.dodgeVx *= 0.86; hw.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (hw.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      // while dodging, skip the rest of the AI so the dash reads cleanly
      if (env.addEffect && Math.random() < 0.4) env.addEffect(e.x, e.y, 'pop', 0.3, SPORE);
      return;
    }

    // While the warding shield holds (surrounding monsters still alive) the
    // Warden is immune and cannot attack — it only drifts toward the player.
    if (e.absorbing) {
      hw.cur = null;
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

    // ---- phase transition animation: boss locks down + shockwave ----
    if (hw.phaseAnim) {
      hw.phaseAnim.t += dt;
      const pa = hw.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { hw.phaseAnim = null; hw.idle = 0.4; hw.cur = null; }
      return;
    }

    // stage transitions -> trigger a dramatic phase-change animation
    const ns = stageFor(e);
    if (ns !== hw.stage) {
      const old = hw.stage;
      hw.stage = ns;
      hw.cur = null;
      hw.phaseAnim = { t: 0, dur: 1.6, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'meadow', accent: ACCENT, name: 'The Hearth Warden', from: old, to: ns });
      return;
    }

    // ---- reactive dodge: strafe away from an incoming player bullet ----
    if (hw.dodgeCD <= 0 && !hw.cur && env.ents && env.ents.bullets) {
      const dodgeChance = [0, 0.22, 0.34, 0.5, 0.65][hw.stage] || 0.3;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 360 || d < 6) continue;
        // is the bullet heading roughly toward us?
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        const closing = (dx * (b.vx || 0) + dy * (b.vy || 0)) / spd; // >0 means approaching
        if (closing <= 0) continue;
        if (env.rand(0, 1) > dodgeChance) { hw.dodgeCD = 0.8; break; }
        // dash perpendicular to the bullet's velocity (strafe), away from its path
        const bvnx = (b.vx || 0) / spd, bvny = (b.vy || 0) / spd;
        let nx = -bvny, ny = bvnx;
        // pick the side that moves us farther from the bullet line
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.6 + hw.stage * 0.25);
        hw.dodgeVx = nx * dashSp; hw.dodgeVy = ny * dashSp;
        hw.dodgeT = 0.28; hw.dodgeCD = 1.6 - hw.stage * 0.15;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, SPORE);
        return;
      }
    }

    // movement: drift toward player when idle, hold still during windup/active of big attacks
    const pl = env.player;
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    let moving = true;
    if (hw.cur) {
      const c = hw.cur;
      if (c.phase === 'windup' || c.phase === 'active') moving = (c.key === 'sporePods' || c.key === 'rootline'); // light attacks allow movement
    }
    if (moving && d2p > 140 * 140) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * 1.15;
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.18);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.18);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    // attack state machine
    if (!hw.cur) {
      hw.idle -= dt;
      if (hw.idle <= 0) {
        startAttack(e, pickNext(e));
      }
      return;
    }
    const c = hw.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? 2.4 : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      // build zones at the moment the telegraph ends / active begins
      ATTACKS[c.key].build(e, c);
      if (c.dmg) c.dmg *= 3.0;
      if (c.rings) for (const r of c.rings) r.dmg *= 3.0;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 4);
    }
    else if (c.phase === 'active' && c.t >= P.active) { c.phase = 'recover'; c.t = 0; c.zones = null; }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      hw.cur = null;
      hw.idle = stageInterval(hw.stage);
      return;
    }
    // apply damage during active
    if (c.phase === 'active' && c.zones !== undefined) {
      ATTACKS[c.key].tick(e, c, dt);
    } else if (c.phase === 'active' && (c.key === 'hearthquake' || c.key === 'heartflare' || c.key === 'sporeBloom' || c.key === 'thornCage' || c.key === 'cataclysm')) {
      // these build zones in build(); zones may be null after recover reset — re-guard
      if (c.zones !== null) ATTACKS[c.key].tick(e, c, dt);
    }
  }

  // ---- 2D rendering (drawn INSTEAD of the default enemy sprite) ----
  // ctx already translated to (cx,cy) and rotated to face the player? No —
  // we call this before the translate/rotate in the main loop, passing raw cx,cy.
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 40;
    const hw = e._hw || {};
    const stage = hw.stage || 1;

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + rr * 0.7, rr * 0.95, rr * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // stage aura (bigger + hotter as stage rises)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (1.6 + stage * 0.18);
    const pulse = 0.5 + 0.5 * Math.sin(t * (2 + stage));
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.4, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(255,180,80,' + (0.18 + 0.05 * stage) + ')');
    ag.addColorStop(0.6, 'rgba(125,255,163,' + (0.12 * pulse) + ')');
    ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // sprite — rotate to face the player, identical to every other monster.
    const ang = env.angleTo ? env.angleTo(e.x, e.y, env.player.x, env.player.y) : Math.atan2(env.player.y - e.y, env.player.x - e.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    if (imgReady) {
      const dR = rr + 16;
      ctx.drawImage(img, -dR, -dR, dR * 2, dR * 2);
    } else {
      ctx.fillStyle = '#3B3224';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    }
    // hit flash
    if (hw.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = hw.hitFlash;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // chest glyph glow (always bright, brighter with stage / during heartflare windup)
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const glyphBoost = (hw.cur && hw.cur.key === 'heartflare' && hw.cur.phase === 'windup') ? (hw.cur.t / hw.cur.phases.windup) : 0;
    const gI = 0.6 + 0.3 * Math.sin(t * 3) + glyphBoost * 1.2 + (stage - 1) * 0.12;
    const gg = ctx.createRadialGradient(cx, cy - rr * 0.1, 2, cx, cy - rr * 0.1, rr * 0.7);
    gg.addColorStop(0, 'rgba(255,220,140,' + Math.min(1, gI) + ')');
    gg.addColorStop(0.5, 'rgba(255,150,60,' + (0.4 * gI) + ')');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(cx, cy - rr * 0.1, rr * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // warding shield (while absorbing)
    if (e.absorbing) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const shR = rr * 1.7 + Math.sin(t * 3) * 4;
      const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
      sg.addColorStop(0, 'rgba(125,255,163,0)');
      sg.addColorStop(0.7, 'rgba(125,255,163,0.18)');
      sg.addColorStop(1, 'rgba(125,255,163,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(125,255,163,0.85)';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // telegraphs for the current attack
    if (hw.cur) drawTelegraph2D(ctx, hw.cur, t);

    // phase transition shockwave + sigil bloom
    if (hw.phaseAnim) drawPhaseAnim2D(ctx, e, hw.phaseAnim, t);

    // HP ring (thick, on top)
    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#7dffa3';
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
    // expanding shockwave ring
    const ringR = rr + p * 520;
    ctx.strokeStyle = 'rgba(255,200,120,' + (0.9 * (1 - p)) + ')';
    ctx.lineWidth = 10 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    // secondary moss ring
    ctx.strokeStyle = 'rgba(125,255,163,' + (0.7 * (1 - p)) + ')';
    ctx.lineWidth = 6 * (1 - p) + 1;
    ctx.beginPath(); ctx.arc(cx, cy, ringR * 0.78, 0, Math.PI * 2); ctx.stroke();
    // bright core flash at the boss
    const flash = 1 - p;
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.4);
    fg.addColorStop(0, 'rgba(255,240,200,' + (0.85 * flash) + ')');
    fg.addColorStop(0.5, 'rgba(255,160,70,' + (0.5 * flash) + ')');
    fg.addColorStop(1, 'rgba(125,255,163,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, rr * 2.4, 0, Math.PI * 2); ctx.fill();
    // rotating runic sigil rings on the ground
    const n = 3;
    for (let i = 0; i < n; i++) {
      const rr2 = rr * (1.2 + i * 0.5) * (0.5 + 0.5 * p);
      ctx.strokeStyle = 'rgba(255,200,120,' + (0.6 * (1 - p)) + ')';
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
      if (cur.key === 'rootline' && showZones) {
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(106,121,58,0.4)';
          ctx.strokeStyle = 'rgba(125,255,163,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'sporePods' && showZones) {
        for (const z of cur.zones) {
          const age = cur.phase === 'active' ? cur.t : 0;
          if (age < z.land && cur.phase === 'active') {
            // in-flight lob marker
            ctx.fillStyle = 'rgba(174,235,96,0.7)';
            ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y) - 30 * (1 - age / z.land), 8, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(174,235,96,0.18)';
            ctx.strokeStyle = 'rgba(174,235,96,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        }
      } else if (cur.key === 'graspingRoots' && showZones) {
        for (const z of cur.zones) {
          ctx.fillStyle = 'rgba(90,110,50,0.35)';
          ctx.strokeStyle = 'rgba(125,255,163,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      } else if (cur.key === 'sporeBloom') {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : 1;
        ctx.strokeStyle = 'rgba(174,235,96,' + (0.6 * prog) + ')';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(sx(cur.cx), sy(cur.cy), cur.r * (0.4 + 0.6 * prog), 0, Math.PI * 2);
        ctx.stroke();
      } else if (cur.key === 'hearthquake') {
        for (const r of (cur.rings || [])) {
          ctx.strokeStyle = 'rgba(255,180,80,0.8)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, r.r), 0, Math.PI * 2); ctx.stroke();
        }
      } else if (cur.key === 'thornCage') {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : 1;
        ctx.strokeStyle = 'rgba(106,121,58,' + (0.7 * prog) + ')';
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 8]);
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), cur.r * (0.5 + 0.5 * prog), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      } else if (cur.key === 'cataclysm') {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : 1;
        ctx.fillStyle = 'rgba(125,255,163,0.10)';
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), cur.r * prog, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,180,80,0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < cur.lanes; i++) {
          const la = cur.laneAng + (i - (cur.lanes - 1) / 2) * (Math.PI * 2 / cur.lanes);
          ctx.beginPath();
          ctx.moveTo(sx(cur.cx), sy(cur.cy));
          ctx.lineTo(sx(cur.cx) + Math.cos(la) * cur.r * prog, sy(cur.cy) + Math.sin(la) * cur.r * prog);
          ctx.stroke();
        }
      } else if (cur.key === 'heartflare') {
        const prog = cur.phase === 'tele' ? cur.t / cur.phases.tele : (cur.t / cur.phases.active);
        const r = cur.r * (cur.phase === 'active' ? Math.min(1, cur.t / cur.phases.active) : prog);
        ctx.strokeStyle = 'rgba(255,150,60,0.9)';
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- 3D rendering (called from render3d_fx drawEnemies) ----
  // R = Render3D, e = enemy, tt = time
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const hw = e._hw || {};
    const stage = hw.stage || 1;
    const rr = e.r || 40;
    const x = e.x, z = e.y;
    const hb = rr * 1.2 + Math.sin(tt * 2.4) * 3;

    // ground contact shadow
    R.quads.alpha.push(x, 1.2, z, rr * 2.4, 0, 0, 0, 0.35, 0, 11, 0, 1);

    // inflated sprite mesh (the Hearth Warden)
    if (imgReady) {
      const sp = R.spriteMesh(img, { depth: 0.5, power: 0.45 });
      if (sp) {
        const size = (rr + 18) * 2.4;
        const tps = R.isTps;
        const tilt = 1.2;
        // rotate to face the player, exactly like other monsters (render3d_fx line 261/269)
        const ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);
        if (tps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), t = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + t * ux * ux; o[1] = si * uz; o[2] = t * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = t * ux * uz; o[9] = -si * ux; o[10] = co + t * uz * uz;
          const out = mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = hb + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        } else {
          R.draw(sp.mesh, mm(x, hb, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.3, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: R.hexRGB(ACCENT) }));
        }
      }
    }

    // 3D warding shield dome while the shield holds
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

    // chest glyph — bright emissive plane + point light (brighter with stage & during heartflare)
    const glyphBoost = (hw.cur && hw.cur.key === 'heartflare' && hw.cur.phase === 'windup') ? (hw.cur.t / hw.cur.phases.windup) : 0;
    const gI = 0.7 + 0.3 * Math.sin(tt * 3) + glyphBoost * 1.5 + (stage - 1) * 0.12;
    R.glow(x, hb, z, rr * 1.6, 1.0, 0.7, 0.3, Math.min(1, gI) * 0.8, 0);
    R.light(x, z, hb + 10, 160 + stage * 40 + glyphBoost * 120, 1.2, 0.8, 0.35, 0.6 + 0.2 * Math.sin(tt * 3));

    // stage aura ring on the ground
    const ringC = R.hexRGB(ACCENT);
    R.decal(x, z, rr * (2 + stage * 0.25), ringC[0], ringC[1], ringC[2], 0.25 + 0.1 * Math.sin(tt * 2), 9, tt * 0.6, 0, true, 1.4);

    // ambient spore motes rising (more in later stages)
    const moteN = 1 + stage;
    for (let i = 0; i < moteN; i++) {
      if (Math.random() < 0.5 * (R.q.parts || 1)) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.6 + Math.random() * 0.8);
        R.emit({
          x: x + Math.cos(a) * d, y: hb + Math.random() * rr, z: z + Math.sin(a) * d,
          vx: (Math.random() - 0.5) * 10, vy: 26 + Math.random() * 24, vz: (Math.random() - 0.5) * 10,
          life: 1.1 + Math.random() * 0.6, age: 0, s0: 6, s1: 1,
          col: Math.random() < 0.5 ? R.hexRGB(SPORE) : R.hexRGB(ACCENT), a: 0.8, kind: 0, drag: 0.7
        });
      }
    }

    // telegraph 3D visuals
    if (hw.cur) drawTelegraph3D(R, hw.cur, tt);

    // phase transition shockwave (3D)
    if (hw.phaseAnim) drawPhaseAnim3D(R, e, hw.phaseAnim, tt, hb);
  }

  // ---- phase transition animation (3D) ----
  function drawPhaseAnim3D(R, e, pa, tt, hb) {
    if (!env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 42;
    const p = Math.min(1, pa.t / pa.dur);
    const fade = 1 - p;
    const ringR = rr + p * 520;
    const A = R.hexRGB(ACCENT), G = R.hexRGB(GLYPH);
    // ground shockwave rings (toruses lying flat, rising)
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 8 * fade, ringR, 0.18), mat([1.6, 0.9, 0.3], { emissive: [2.0, 1.1, 0.3], emisK: 2.2, alpha: 0.9 * fade, shadow: false }));
    R.draw(U.torus, mm(x, 6, z, -tt * 1.2, ringR * 0.78, 2 + 6 * fade, ringR * 0.78, 0.14), mat([0.5, 1.0, 0.4], { emissive: [0.4, 1.1, 0.3], emisK: 2.0, alpha: 0.8 * fade, shadow: false }));
    // bright glow pillar at the boss
    R.glow(x, hb, z, rr * (1.4 + p * 1.2), 1.0, 0.7, 0.3, 0.9 * fade, 0);
    R.light(x, z, hb + 20, 320 + p * 260, 1.6, 0.9, 0.3, 0.9 * fade);
    // rotating runic ground decals
    sigil(R, x, z, ringR * 0.9, [1.4, 0.9, 0.25], 0.7 * fade, tt, 0.8);
    sigil(R, x, z, ringR * 0.55, A, 0.6 * fade, tt, -0.6);
    // rising spore burst particles
    for (let i = 0; i < 6; i++) {
      if (Math.random() < 0.8) {
        const a = Math.random() * Math.PI * 2, d = rr * (0.4 + Math.random() * 1.6);
        R.emit({ x: x + Math.cos(a) * d, y: 2 + Math.random() * 10, z: z + Math.sin(a) * d, vx: Math.cos(a) * (20 + 40 * fade), vy: 60 + Math.random() * 80, vz: Math.sin(a) * (20 + 40 * fade), life: 1.0 + Math.random() * 0.6, age: 0, s0: 9, s1: 2, col: Math.random() < 0.5 ? R.hexRGB(SPORE) : G, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    // camera kick during the burst
    R.cameraKick = Math.max(R.cameraKick || 0, 0.4 * fade);
  }

  // cursed ground sigil — layered rotating runic decals
  function sigil(R, x, z, r, col, intensity, tt, spin) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5 * intensity, 9, tt * (spin || 0.6), 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7 * intensity, 6, -tt * (spin || 0.6) * 1.4, 0, true, 1.6);
    R.decal(x, z, r * 0.34, col[0] * 1.3, col[1] * 1.3, col[2] * 1.3, 0.9 * intensity, 12, tt * (spin || 0.6) * 2, 0, true, 1.8);
  }
  // jagged thorn spike — faceted rock trunk + angled thorns + tip glow
  function thornSpike(R, x, z, baseR, h, col, emiCol, tt, seed) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    R.draw(U.rock3, mm(x, h * 0.5, z, seed * 2.3, baseR, h, baseR, seed * 0.2), mat(col, { rough: 0.85, metal: 0.05, emissive: emiCol, emisK: 1.4 }));
    const n = 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      const tx = x + Math.cos(a) * baseR * 0.7, tz = z + Math.sin(a) * baseR * 0.7;
      const th = h * (0.5 + 0.18 * ((seed * 7 + i) % 3));
      R.draw(U.cone, mm(tx, th * 0.5, tz, a + Math.PI / 2, baseR * 0.26, th, baseR * 0.26, 0, Math.PI / 2 - 0.5), mat(col, { rough: 0.8, emissive: emiCol, emisK: 1.2 }));
    }
    R.glow(x, h, z, baseR * 1.6, emiCol[0], emiCol[1], emiCol[2], 0.6, 0);
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const A = R.hexRGB(ACCENT);
    const SPOREC = R.hexRGB(SPORE);
    const GLYPHC = R.hexRGB(GLYPH);
    const ROOTC = [0.30, 0.36, 0.18];
    const THORNC = [0.22, 0.28, 0.14];
    const active = cur.phase === 'active';
    const tele = cur.phase === 'tele';
    const tprog = tele ? cur.t / cur.phases.tele : 1;
    const aprog = active ? Math.min(1, cur.t / cur.phases.active) : 0;

    // shared cursed mist
    if (Math.random() < 0.5) {
      const cx = cur.cx != null ? cur.cx : (cur.zones && cur.zones[0] ? cur.zones[0].x : 0);
      const cz = cur.cy != null ? cur.cy : (cur.zones && cur.zones[0] ? cur.zones[0].y : 0);
      R.emit({ x: cx + (Math.random() - .5) * 60, y: 2, z: cz + (Math.random() - .5) * 60, vx: (Math.random() - .5) * 8, vy: 14 + Math.random() * 10, vz: (Math.random() - .5) * 8, life: 1.6, age: 0, s0: 9, s1: 3, col: [0.5, 0.7, 0.45], a: 0.18, kind: 0, drag: 0.9 });
    }

    if (cur.key === 'rootline' && cur.zones) {
      const emi = [0.10, 0.30, 0.08];
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const h = z.r * (1.6 + 0.4 * Math.sin(tt * 6 + i)) * tprog;
        if (h > 2) thornSpike(R, z.x, z.y, z.r * 0.9, h, ROOTC, emi, tt, i * 1.7 + 0.3);
        sigil(R, z.x, z.y, z.r * 1.2, A, 0.4 + 0.3 * tprog, tt, 0.5);
        R.light(z.x, z.y, h * 0.6, 90 + 40 * tprog, 0.3, 0.7, 0.2, 0.4 + 0.3 * tprog);
      }
      if (cur.zones.length > 1) {
        const a = Math.atan2(cur.zones[cur.zones.length - 1].y - cur.zones[0].y, cur.zones[cur.zones.length - 1].x - cur.zones[0].x);
        const mx = (cur.zones[0].x + cur.zones[cur.zones.length - 1].x) / 2, mz = (cur.zones[0].y + cur.zones[cur.zones.length - 1].y) / 2;
        R.decal(mx, mz, 40, 0.2, 0.35, 0.12, 0.5 * tprog, 12, a, 0, true, 4.0);
      }
      if (active && Math.random() < 0.7) {
        const z = cur.zones[Math.floor(Math.random() * cur.zones.length)];
        R.emit({ x: z.x + (Math.random() - .5) * z.r, y: z.r * 0.8, z: z.y + (Math.random() - .5) * z.r, vx: (Math.random() - .5) * 30, vy: 50 + Math.random() * 40, vz: (Math.random() - .5) * 30, life: .7, age: 0, s0: 6, s1: 1, col: [0.4, 0.6, 0.25], a: .8, kind: 0, drag: .7 });
      }
    } else if (cur.key === 'sporePods' && cur.zones) {
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const age = active ? cur.t : 0;
        if (age < z.land && active) {
          const fall = age / z.land, yh = 110 * (1 - fall) + 6;
          R.draw(U.sphere, mm(z.x, yh, z.y, tt * 3, z.r * 0.5, z.r * 0.5, z.r * 0.5), mat([0.5, 0.9, 0.35], { emissive: [0.5, 1.0, 0.2], emisK: 2.0, rough: 0.4, shadow: false, rim: 1.4, rimCol: SPOREC }));
          R.glow(z.x, yh, z.y, z.r * 1.0, 0.55, 0.95, 0.3, 0.9, 0);
          R.light(z.x, z.y, yh, 120, 0.5, 1.0, 0.25, 0.7);
          R.emit({ x: z.x, y: yh, z: z.y, vx: (Math.random() - .5) * 6, vy: -10, vz: (Math.random() - .5) * 6, life: .8, age: 0, s0: 6, s1: 2, col: SPOREC, a: .6, kind: 0, drag: .9 });
          R.decal(z.x, z.y, z.r * (0.3 + 0.7 * fall), 0.5, 0.9, 0.3, 0.4, 8, tt * 0.3, 0, true, 1.6);
        } else if (active) {
          const cap = z.r;
          R.draw(U.cone, mm(z.x, cap * 0.3, z.y, 0, cap * 1.1, cap * 0.6, cap * 1.1, Math.PI), mat([0.35, 0.7, 0.25], { rough: 0.55, emissive: [0.3, 0.7, 0.15], emisK: 1.8, rim: 1.0, rimCol: SPOREC }));
          R.draw(U.cyl, mm(z.x, cap * 0.15, z.y, 0, cap * 0.4, cap * 0.3, cap * 0.4), mat([0.6, 0.85, 0.4], { emissive: [0.25, 0.6, 0.12], emisK: 1.6 }));
          R.glow(z.x, cap * 0.45, z.y, cap * 2.0, 0.45, 0.95, 0.3, 0.5, 0);
          R.light(z.x, z.y, cap * 0.5, 160, 0.45, 1.0, 0.3, 0.6);
          for (let k = 0; k < 4; k++) {
            const a = k * Math.PI / 2 + tt * 0.4;
            R.draw(U.cone, mm(z.x + Math.cos(a) * cap * 0.7, cap * 0.1, z.y + Math.sin(a) * cap * 0.7, a, cap * 0.12, cap * 0.5, cap * 0.12, 0, a), mat(ROOTC, { rough: 0.8, emissive: [0.1, 0.25, 0.06] }));
          }
          for (let p = 0; p < 3; p++) {
            if (Math.random() < 0.6) R.emit({ x: z.x + (Math.random() - .5) * z.r, y: 2 + Math.random() * 8, z: z.y + (Math.random() - .5) * z.r, vx: (Math.random() - .5) * 16, vy: 14 + Math.random() * 20, vz: (Math.random() - .5) * 16, life: 1.4, age: 0, s0: 8, s1: 3, col: SPOREC, a: 0.55, kind: 0, drag: 0.85 });
          }
          sigil(R, z.x, z.y, z.r * 1.3, SPOREC, 0.35, tt, 0.3);
        } else {
          R.decal(z.x, z.y, z.r, 0.5, 0.9, 0.3, 0.35, 8, tt * 0.2, 0, true, 1.6);
        }
      }
    } else if (cur.key === 'graspingRoots' && cur.zones) {
      for (let i = 0; i < cur.zones.length; i++) {
        const z = cur.zones[i];
        const h = z.r * 2.2 * tprog * (1 + 0.08 * Math.sin(tt * 8 + i));
        if (h > 2) {
          R.draw(U.rock3, mm(z.x, h * 0.5, z.y, i * 2.1 + 0.4, z.r * 0.55, h, z.r * 0.55, i * 0.2), mat(THORNC, { rough: 0.8, emissive: [0.08, 0.18, 0.05], emisK: 1.3 }));
          const n = 5;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2 + i + tt * 0.3;
            const cl = z.r * (0.7 + 0.15 * ((i + k) % 2));
            R.draw(U.cone, mm(z.x + Math.cos(a) * z.r * 0.3, h * 0.85, z.y + Math.sin(a) * z.r * 0.3, a + Math.PI / 2, cl * 0.18, cl, cl * 0.18, 0, Math.PI / 2 - 0.7), mat(THORNC, { rough: 0.75, emissive: [0.12, 0.22, 0.06], emisK: 1.4 }));
          }
          R.glow(z.x, h, z.y, z.r * 1.0, 0.35, 0.65, 0.18, 0.45 * tprog, 0);
          R.light(z.x, z.y, h * 0.7, 80, 0.3, 0.6, 0.18, 0.4);
        }
        sigil(R, z.x, z.y, z.r * 1.1, A, 0.4 * tprog, tt, 0.4);
        if (Math.random() < 0.4) R.emit({ x: z.x + (Math.random() - .5) * z.r, y: 2, z: z.y + (Math.random() - .5) * z.r, vx: 0, vy: 18 + Math.random() * 16, vz: 0, life: 1.4, age: 0, s0: 7, s1: 2, col: [0.25, 0.4, 0.2], a: 0.4, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'sporeBloom') {
      const r = cur.r * (0.4 + 0.6 * tprog);
      R.draw(U.sphere, mm(cur.cx, 0, cur.cy, 0, r, r * 0.7, r), mat([0.45, 0.95, 0.3], { emissive: [0.3, 0.7, 0.15], emisK: 1.6, alpha: 0.18 * tprog, rim: 1.6, rimCol: SPOREC, shadow: false, rough: 0.4 }));
      R.draw(U.torus, mm(cur.cx, 2, cur.cy, tt * 0.5, r, 2, r, r * 0.05), mat([0.55, 1.0, 0.3], { emissive: [0.35, 0.8, 0.15], emisK: 1.8, alpha: 0.8, shadow: false }));
      R.draw(U.torus, mm(cur.cx, 2, cur.cy, -tt * 0.8, r * 0.7, 2, r * 0.7, r * 0.04), mat([0.5, 0.95, 0.3], { emissive: [0.3, 0.7, 0.12], emisK: 1.6, alpha: 0.6, shadow: false }));
      R.glow(cur.cx, r * 0.4, cur.cy, r * 1.2, 0.5, 1.0, 0.3, 0.45 * tprog, 0);
      R.light(cur.cx, cur.cy, r * 0.5, 200 + 60 * tprog, 0.45, 1.0, 0.3, 0.5 + 0.2 * Math.sin(tt * 3));
      sigil(R, cur.cx, cur.cy, r * 1.1, SPOREC, 0.4 * tprog, tt, 0.5);
      for (let p = 0; p < 4; p++) {
        if (Math.random() < 0.7) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r;
          R.emit({ x: cur.cx + Math.cos(a) * d, y: 2 + Math.random() * 10, z: cur.cy + Math.sin(a) * d, vx: Math.cos(a) * 8, vy: 24 + Math.random() * 30, vz: Math.sin(a) * 8, life: 1.3, age: 0, s0: 8, s1: 3, col: SPOREC, a: 0.6, kind: 0, drag: 0.85 });
        }
      }
    } else if (cur.key === 'hearthquake') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.25 * aprog : 0.12 * tprog);
      for (let ri = 0; ri < (cur.rings || []).length; ri++) {
        const r = cur.rings[ri];
        const rr = r.r * (active ? Math.min(1, aprog) : tprog);
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + tt * 0.3 * (ri % 2 ? -1 : 1);
          const rx = cur.cx + Math.cos(a) * rr, rz = cur.cy + Math.sin(a) * rr;
          const h = 14 + Math.sin(tt * 5 + i * 1.7) * 6 + (active ? 8 : 0);
          R.draw(U.rock3, mm(rx, h * 0.5, rz, a * 2 + i, 8, h, 8, i * 0.2), mat([0.32, 0.26, 0.18], { rough: 0.9, emissive: [0.5, 0.18, 0.04], emisK: 1.4 }));
          if (i % 2 === 0) R.draw(U.cone, mm(rx, h + 2, rz, a, 3, 8, 3), mat([1.2, 0.4, 0.1], { emissive: [1.6, 0.5, 0.1], emisK: 2, shadow: false }));
        }
        R.glow(cur.cx, 16, cur.cy, rr * 0.8, 1.0, 0.4, 0.1, 0.4 + 0.2 * Math.sin(tt * 4), 0);
        R.light(cur.cx, cur.cy, 20, 220 + rr, 1.0, 0.35, 0.08, 0.6 + 0.2 * Math.sin(tt * 4));
        sigil(R, cur.cx, cur.cy, rr, [1.0, 0.4, 0.12], 0.3 + 0.2 * tprog, tt, -0.6);
        for (let p = 0; p < 3; p++) {
          if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            R.emit({ x: cur.cx + Math.cos(a) * rr, y: 2, z: cur.cy + Math.sin(a) * rr, vx: (Math.random() - .5) * 30, vy: 50 + Math.random() * 60, vz: (Math.random() - .5) * 30, life: 1.0, age: 0, s0: 7, s1: 2, col: Math.random() < 0.4 ? [1.4, 0.5, 0.12] : [0.35, 0.28, 0.22], a: 0.8, kind: 0, drag: 0.7 });
          }
        }
      }
    } else if (cur.key === 'thornCage') {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rx = cur.cx + Math.cos(a) * cur.r, rz = cur.cy + Math.sin(a) * cur.r;
        const h = cur.r * 1.0 * tprog * (1 + 0.05 * Math.sin(tt * 4 + i));
        if (h > 2) {
          R.draw(U.cyl, mm(rx, h * 0.5, rz, a, 3.0, h, 3.0), mat(THORNC, { rough: 0.8, emissive: [0.08, 0.18, 0.05], emisK: 1.3 }));
          R.draw(U.cone, mm(rx, h + 4, rz, a, 3.0, 10 * tprog, 3.0), mat([0.35, 0.45, 0.2], { rough: 0.7, emissive: [0.15, 0.3, 0.07], emisK: 1.5 }));
          for (let b = 0; b < 3; b++) {
            const by = h * (0.3 + b * 0.25);
            const ba = a + b * 0.7;
            R.draw(U.cone, mm(rx, by, rz, ba, 1.6, 4, 1.6, 0, ba + Math.PI / 2), mat(THORNC, { rough: 0.75, emissive: [0.1, 0.2, 0.05] }));
          }
          R.glow(rx, h * 0.7, rz, 8, 0.4, 0.7, 0.2, 0.4, 0);
        }
      }
      R.draw(U.torus, mm(cur.cx, cur.r * 0.95, cur.cy, tt * 0.2, cur.r, 2, cur.r, 0.06), mat(THORNC, { rough: 0.8, emissive: [0.1, 0.22, 0.06], emisK: 1.4, alpha: tprog }));
      R.draw(U.torus, mm(cur.cx, cur.r * 0.5, cur.cy, -tt * 0.3, cur.r * 0.98, 1.5, cur.r * 0.98, 0.05), mat(THORNC, { rough: 0.8, emissive: [0.08, 0.18, 0.04], emisK: 1.3, alpha: tprog }));
      sigil(R, cur.cx, cur.cy, cur.r * 0.9, A, 0.4 * tprog, tt, 0.5);
      R.glow(cur.cx, cur.r * 0.5, cur.cy, cur.r * 0.7, 0.4, 0.75, 0.22, 0.4 * tprog, 0);
      R.light(cur.cx, cur.cy, cur.r * 0.6, 140, 0.35, 0.7, 0.2, 0.4);
      if (Math.random() < 0.5) {
        const a = Math.random() * Math.PI * 2;
        R.emit({ x: cur.cx + Math.cos(a) * cur.r, y: cur.r * 0.5, z: cur.cy + Math.sin(a) * cur.r, vx: -Math.sin(a) * 12, vy: 10, vz: Math.cos(a) * 12, life: 1.2, age: 0, s0: 6, s1: 2, col: [0.3, 0.5, 0.2], a: 0.5, kind: 0, drag: 0.9 });
      }
    } else if (cur.key === 'cataclysm') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.3 * aprog : 0.15 * tprog);
      sigil(R, cur.cx, cur.cy, cur.r * tprog, A, 0.5, tt, 0.4);
      R.decal(cur.cx, cur.cy, cur.r * tprog * 0.5, GLYPHC[0], GLYPHC[1], GLYPHC[2], 0.4 * tprog, 12, -tt * 0.8, 0, true, 1.6);
      for (let i = 0; i < cur.lanes; i++) {
        const la = cur.laneAng + (i - (cur.lanes - 1) / 2) * (Math.PI * 2 / cur.lanes);
        const wa = la + (Math.PI / cur.lanes);
        for (let j = 1; j <= 8; j++) {
          const d = (j / 8) * cur.r * tprog;
          const wx = cur.cx + Math.cos(wa) * d, wz = cur.cy + Math.sin(wa) * d;
          const h = (22 + 6 * Math.sin(tt * 5 + j)) * (1 - j / 14) * tprog;
          if (h > 2) {
            thornSpike(R, wx, wz, 6, h, ROOTC, [0.12, 0.28, 0.06], tt, j * 1.3 + i);
            if (j % 2 === 0) R.glow(wx, h, wz, 10, 0.4, 0.8, 0.2, 0.5, 0);
          }
        }
        if (Math.random() < 0.6) {
          const d = Math.random() * cur.r * tprog;
          const wx = cur.cx + Math.cos(wa) * d, wz = cur.cy + Math.sin(wa) * d;
          R.emit({ x: wx, y: 2, z: wz, vx: Math.cos(wa) * 10, vy: 40 + Math.random() * 40, vz: Math.sin(wa) * 10, life: 1.0, age: 0, s0: 7, s1: 2, col: Math.random() < 0.3 ? GLYPHC : A, a: 0.7, kind: 0, drag: 0.7 });
        }
      }
      R.glow(cur.cx, 24, cur.cy, cur.r * 0.7 * tprog, 0.7, 0.5, 0.15, 0.5 * tprog, 0);
      R.light(cur.cx, cur.cy, 28, 320, 0.7, 0.5, 0.15, 0.6 + 0.2 * Math.sin(tt * 3));
    } else if (cur.key === 'heartflare') {
      R.cameraKick = Math.max(R.cameraKick || 0, active ? 0.35 * aprog : 0.18 * tprog);
      const r = cur.r * (active ? Math.min(1, aprog) : tprog);
      R.draw(U.torusThick, mm(cur.cx, 16, cur.cy, tt, r, 18, r, 0.22), mat([1.6, 0.5, 0.1], { emissive: [2.0, 0.8, 0.15], emisK: 2.2, alpha: 0.9, shadow: false, rough: 0.3 }));
      R.draw(U.torus, mm(cur.cx, 16, cur.cy, -tt * 1.5, r * 0.85, 10, r * 0.85, 0.14), mat([1.8, 0.7, 0.2], { emissive: [2.4, 1.0, 0.2], emisK: 2.4, alpha: 0.7, shadow: false }));
      R.glow(cur.cx, 16, cur.cy, r * 0.9, 1.6, 0.7, 0.2, 0.7, 0);
      R.light(cur.cx, cur.cy, 24, 360, 1.6, 0.7, 0.2, 0.9 + 0.1 * Math.sin(tt * 6));
      sigil(R, cur.cx, cur.cy, r * 1.1, [1.4, 0.5, 0.12], 0.6, tt, 0.8);
      for (let p = 0; p < 6; p++) {
        if (Math.random() < 0.85) {
          const a = Math.random() * Math.PI * 2;
          R.emit({ x: cur.cx + Math.cos(a) * r, y: 4, z: cur.cy + Math.sin(a) * r, vx: Math.cos(a) * 24, vy: 50 + Math.random() * 60, vz: Math.sin(a) * 24, life: .9, age: 0, s0: 11, s1: 2, col: Math.random() < 0.4 ? [1.8, 0.9, 0.3] : [1.4, 0.4, 0.1], a: 0.95, kind: 0, drag: 0.5 });
        }
      }
      R.decal(cur.cx, cur.cy, r * 1.2, 0.5, 0.2, 0.05, 0.6, 10, tt, 0, true, 1.6);
    }
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 42; e.hp = e.maxhp = 2200; e.speed = 108; e.cd = 99; e.detectR = 1200;
    e.absorbing = true; // invincible + passive until all surrounding monsters are cleared
    e._hw = { stage: 1, cur: null, last: null, idle: 1.0, hitFlash: 0, intro: 1.4 };
    injectShieldWarn();
  }

  // mark a hit (for the white flash)
  function onHit(e, dmg) {
    if (!e._hw) return;
    e._hw.hitFlash = Math.min(1, (e._hw.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  // ---- public API ----
  window.HearthWarden = {
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
