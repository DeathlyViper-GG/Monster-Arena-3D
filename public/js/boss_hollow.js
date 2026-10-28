// ============================================================
// Monster Arena — THE HOLLOW (final boss, 10 stages)
// A towering cosmic-horror entity: a dark, smoke-trailing shroud
// wrapped around a blazing soul-core, ringed by the five recovered
// soul-shards. Uses the official Hollow sprite (horizontal cosmic
// artwork with a central void and five orbiting relic-shards).
//
// TEN STAGES — each 10% of HP. Every stage has a distinct attack
// pool, damage scales up, recovery shortens, dodge sharpens, and a
// signature "Eternal Silence" twin-beam unlocks at stage 9. Stage
// 10 forces dual-casting (two attacks chained) and the shards
// converge into a white-hot core. A stage-transition flash + cutscene
// fires on every threshold so all ten stages are felt.
// ============================================================
(function () {
  'use strict';

  const ACCENT = '#e0c6ff';   // pale void-violet
  const CORE = '#fff6e8';     // blazing soul-core
  const RIFT = '#ff3a6a';
  const RIFT_C = '#3afeff';
  const SHARD_COLS = ['#7dffa3', '#ffd166', '#9fe3ff', '#ff7a66', '#d066ff'];

  const SPRITE_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/367bae923_CosmicVoidEntitywithOrbitingShards.png';
  const MORPH_SRC = 'https://media.base44.com/images/public/6ad27d6995813fb4230b1b65/192aa7940_VOIDEVOLUTION.png';
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = SPRITE_SRC;
  let ready = false;
  img.onload = () => { ready = true; };
  img.onerror = () => { ready = false; };
  // metamorphosed form — the armoured, shard-devouring version
  const imgMorph = new Image();
  imgMorph.crossOrigin = 'anonymous';
  imgMorph.src = MORPH_SRC;
  let morphReady = false;
  imgMorph.onload = () => { morphReady = true; };
  imgMorph.onerror = () => { morphReady = false; };
  let morphedFlag = false;   // true once the mid-fight metamorphosis completes (used by death cutscene)
  const MORPH_SHARDS = ['#00ff40', '#ffcc00', '#00ccff', '#ff0000', '#8000ff'];

  let env = null;
  function E() { return env; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (l2 < 1e-6) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ---- shield warning ----
  let warnEl = null, warnInjected = false;
  function injectShieldWarn() {
    if (warnInjected) return; warnInjected = true;
    if (typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = `#hollowShieldWarn{position:fixed;top:100px;left:50%;transform:translateX(-50%);z-index:46;
      padding:11px 24px;border-radius:999px;pointer-events:none;display:none;font-size:14px;letter-spacing:.1em;
      text-transform:uppercase;font-weight:800;color:#f0e6ff;background:rgba(8,4,16,.86);border:1px solid #e0c6ff;
      text-shadow:0 0 12px rgba(224,198,255,.6);white-space:nowrap;animation:hollowWarnPulse 1.6s ease-in-out infinite;}
      @keyframes hollowWarnPulse{0%,100%{box-shadow:0 0 22px rgba(224,198,255,.4)}50%{box-shadow:0 0 38px rgba(224,198,255,.8)}}`;
    document.head.appendChild(s);
    warnEl = document.createElement('div');
    warnEl.id = 'hollowShieldWarn';
    warnEl.textContent = '🛡️ The Hollow is sealed — clear its Wardens first!';
    document.body.appendChild(warnEl);
  }
  function setShieldWarn(on) { if (warnEl) warnEl.style.display = on ? 'block' : 'none'; }
  function hideShieldWarn() { if (warnEl) warnEl.style.display = 'none'; }

  // ============================================================
  // SEVEN ATTACKS (6 base + 1 stage-9/10 signature)
  // ============================================================
  const ATTACKS = {
    pulse: {
      name: 'Void Pulse', windup: 0.4, tele: 0.6, active: 1.1, recover: 0.4,
      build(e, c) {
        c.cx = e.x; c.cy = e.y; c.r = 0; c.maxR = 1600; c.band = 44; c.dmg = 42; c.spd = 1100;
        // gap on a RANDOM bearing (not the player's), so the ring actually
        // threatens a stationary player instead of always opening toward them
        c.gap = 0.7; c.gapAng = env.rand(0, Math.PI * 2);
      },
      tick(e, c, dt) {
        const pl = env.player; c.r += c.spd * dt; if (c.r > c.maxR) return;
        const d = Math.hypot(pl.x - c.cx, pl.y - c.cy);
        if (Math.abs(d - c.r) < c.band + pl.r) {
          const a = Math.atan2(pl.y - c.cy, pl.x - c.cx);
          const diff = Math.abs(((a - c.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > c.gap / 2) env.hurtPlayer(c.dmg * dt * 3.2);
        }
      }
    },
    beam: {
      name: 'Soul Beam', windup: 0.45, tele: 0.6, active: 2.3, recover: 0.4,
      build(e, c) {
        const pl = env.player; c.cx = e.x; c.cy = e.y;
        c.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.7; c.sweep = 1.4;
        c.len = 1800; c.thick = 38; c.dmg = 38;
      },
      tick(e, c, dt) {
        const pl = env.player; const p = Math.min(1, c.t / c.phases.active);
        const ang = c.ang0 + c.sweep * p;
        const tx = c.cx + Math.cos(ang) * c.len, ty = c.cy + Math.sin(ang) * c.len;
        if (pSeg(pl.x, pl.y, c.cx, c.cy, tx, ty) < c.thick + pl.r) env.hurtPlayer(c.dmg * dt * 2.8);
      }
    },
    rift: {
      name: 'Void Rift', windup: 0.4, tele: 0.65, active: 1.8, recover: 0.4,
      build(e, c) {
        c.zones = [];
        const n = 4 + Math.min(4, Math.floor((e._hb ? e._hb.stage : 1) / 3));
        // spawn rift zones around the PLAYER, not the boss, so they actually threaten
        const pl = env.player;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 6.28 + env.rand(0, 1), d = 80 + env.rand(0, 360);
          c.zones.push({ x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, r: 95, erupt: i * 0.18 });
        }
        c.dmg = 46;
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const z of c.zones) {
          const loc = c.t - z.erupt; if (loc < 0 || loc > 1.4) continue;
          if (env.dist2(pl.x, pl.y, z.x, z.y) < (z.r + pl.r) * (z.r + pl.r)) env.hurtPlayer(c.dmg * dt * 3.0);
        }
      }
    },
    shards: {
      name: 'Void Shards', windup: 0.35, tele: 0.5, active: 1.8, recover: 0.35,
      build(e, c) {
        c.proj = [];
        const n = 12 + Math.min(8, Math.floor((e._hb ? e._hb.stage : 1) / 2));
        // aim shards toward the player, not just outward in a circle
        const pl = env.player;
        const baseAng = Math.atan2(pl.y - e.y, pl.x - e.x);
        for (let i = 0; i < n; i++) {
          const a = baseAng + (i / n - 0.5) * 2.4 + env.rand(0, 0.3);
          const sp = 360 + env.rand(0, 120);
          c.proj.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 12, dmg: 34 });
        }
      },
      tick(e, c, dt) {
        const pl = env.player;
        for (const p of c.proj) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (env.dist2(pl.x, pl.y, p.x, p.y) < (p.r + pl.r) * (p.r + pl.r)) env.hurtPlayer(p.dmg * dt * 4.0);
        }
      }
    },
    chains: {
      name: 'Void Chains', windup: 0.45, tele: 0.65, active: 2.4, recover: 0.4,
      build(e, c) {
        const pl = env.player; c.cx = pl.x; c.cy = pl.y; c.r0 = 620; c.gap = 0.85; c.dmg = 38;
        c.gapAng = Math.atan2(pl.y - e.y, pl.x - e.x);
      },
      tick(e, c, dt) {
        const pl = env.player; const p = Math.min(1, c.t / c.phases.active);
        const r = c.r0 * (1 - p * 0.76);
        const d = Math.hypot(pl.x - c.cx, pl.y - c.cy);
        if (Math.abs(d - r) < 38 + pl.r) {
          const a = Math.atan2(pl.y - c.cy, pl.x - c.cx);
          const diff = Math.abs(((a - c.gapAng + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (diff > c.gap / 2) env.hurtPlayer(c.dmg * dt * 2.8);
        }
      }
    },
    collapse: {
      name: 'Singularity Collapse', windup: 0.8, tele: 1.0, active: 2.0, recover: 0.6,
      build(e, c) { c.cx = e.x; c.cy = e.y; c.maxR = 1600; c.dmg = 52; },
      tick(e, c, dt) {
        const pl = env.player; const p = Math.min(1, c.t / c.phases.active);
        if (p < 0.85) {
          const r = c.maxR * (1 - p * 0.88);
          const d = Math.hypot(pl.x - c.cx, pl.y - c.cy);
          if (d < r) env.hurtPlayer(c.dmg * dt * 2.5);
        }
      }
    },
    // 7. SIGNATURE — twin beams sweeping from opposite sides (stage 9+)
    silence: {
      name: 'Eternal Silence', windup: 0.8, tele: 1.0, active: 2.8, recover: 0.6,
      build(e, c) {
        const pl = env.player; c.cx = e.x; c.cy = e.y;
        c.ang0 = Math.atan2(pl.y - e.y, pl.x - e.x) - 0.8;
        c.sweep = 1.6; c.len = 2000; c.thick = 36; c.dmg = 48;
      },
      tick(e, c, dt) {
        const pl = env.player; const p = Math.min(1, c.t / c.phases.active);
        const ang = c.ang0 + c.sweep * p;
        for (const off of [0, Math.PI]) {
          const a = ang + off;
          const tx = c.cx + Math.cos(a) * c.len, ty = c.cy + Math.sin(a) * c.len;
          if (pSeg(pl.x, pl.y, c.cx, c.cy, tx, ty) < c.thick + pl.r) env.hurtPlayer(c.dmg * dt * 2.5);
        }
      }
    }
  };
  const ALL_KEYS = ['pulse', 'shards', 'beam', 'rift', 'chains', 'collapse', 'silence'];

  // ---- 10-stage attack progression ----
  function poolFor(stage) {
    switch (stage) {
      case 1: return ['shards', 'pulse'];
      case 2: return ['shards', 'pulse', 'beam'];
      case 3: return ['shards', 'beam', 'pulse', 'rift'];
      case 4: return ['shards', 'beam', 'rift', 'pulse', 'chains'];
      case 5: return ['shards', 'beam', 'rift', 'chains', 'pulse', 'collapse'];
      case 6: return ['shards', 'beam', 'rift', 'chains', 'collapse', 'pulse'];
      case 7: return ['shards', 'beam', 'rift', 'chains', 'collapse'];
      case 8: return ['shards', 'beam', 'rift', 'chains', 'collapse', 'silence'];
      case 9: return ['beam', 'rift', 'chains', 'collapse', 'silence', 'shards'];
      case 10: return ['beam', 'rift', 'chains', 'collapse', 'silence', 'shards', 'pulse'];
      default: return ALL_KEYS;
    }
  }
  function dmgMult(stage) { return 1.0 + (stage - 1) * 0.12; }   // 1.00x → 2.08x
  function idleFor(stage) { return Math.max(0.2, 0.9 - stage * 0.07); } // 0.83s → 0.20s

  // ---- stage logic: 10 stages, one per 10% of HP ----
  function stageFor(e) {
    const r = (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1);
    return Math.min(10, Math.max(1, Math.floor((1 - r) * 10) + 1));
  }

  function startAttack(e, key) {
    const A = ATTACKS[key];
    e._hb.cur = { key, name: A.name, phase: 'windup', t: 0, phases: { windup: A.windup, tele: A.tele, active: A.active, recover: A.recover } };
  }

  function tick(e, dt) {
    if (!env) return;
    if (!e._hb) e._hb = { stage: 1, cur: null, last: null, idle: 1.4, hitFlash: 0, intro: 2.0, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5, dual: false };
    const hb = e._hb;
    hb.hitFlash = Math.max(0, hb.hitFlash - dt);
    hb.dodgeCD = Math.max(0, (hb.dodgeCD || 0) - dt);
    if (hb.intro > 0) { hb.intro -= dt; e.vx = 0; e.vy = 0; return; }
    // mid-fight metamorphosis cutscene freezes the boss while it plays
    if (hb.morphing) { e.vx = 0; e.vy = 0; return; }

    if (e.absorbing) { hb.cur = null; setShieldWarn(true); return; }
    setShieldWarn(false);

    if (hb.phaseAnim) {
      hb.phaseAnim.t += dt;
      const pa = hb.phaseAnim;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 8 * (1 - pa.t / pa.dur));
      e.vx *= 0.7; e.vy *= 0.7;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (pa.t >= pa.dur) { hb.phaseAnim = null; hb.idle = 0.4; hb.cur = null; }
      return;
    }

    // ---- stage transition: fires on EVERY 10% threshold → all 10 stages felt ----
    const ns = stageFor(e);
    if (ns !== hb.stage) {
      // SECRET METAMORPHOSIS at half health (stage 6): the Hollow devours its
      // soul-shards and re-forges into the armoured form. Fires once.
      if (ns >= 6 && !hb.morphStarted) {
        hb.morphStarted = true;
        hb.morphing = true;
        hb.stage = 6;
        hb.cur = null;
        window._HOLLOW_METAMORPHOSIS_ACTIVE = true;
        window._GAUNTLET_INTRO = true;     // freeze the engine during the cutscene
        if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 18);
        if (window.HollowMetamorphosis) {
          HollowMetamorphosis.play({
            onDone: function () {
              hb.morphed = true; morphedFlag = true;
              hb.morphing = false;
              window._HOLLOW_METAMORPHOSIS_ACTIVE = false;
              window._GAUNTLET_INTRO = false;
              hb.idle = 0.0;
              if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 14);
              if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.4, ACCENT);
            }
          });
        } else {
          hb.morphed = true; morphedFlag = true; hb.morphing = false;
          window._HOLLOW_METAMORPHOSIS_ACTIVE = false; window._GAUNTLET_INTRO = false;
        }
        return;
      }
      const old = hb.stage; hb.stage = ns; hb.cur = null;
      hb.phaseAnim = { t: 0, dur: 1.5, from: old, to: ns };
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 16);
      if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 1.0, ACCENT);
      hb.dual = ns >= 8;   // dual-cast from stage 8 onward
      if (window.BossStageCutscene) window.BossStageCutscene.play({ theme: 'void', accent: ACCENT, name: 'The Hollow', from: old, to: ns });
      return;
    }

    // reactive dodge — sharpens with stage
    if (hb.dodgeCD <= 0 && !hb.cur && env.ents && env.ents.bullets) {
      const chance = 0.12 + hb.stage * 0.03;
      for (const b of env.ents.bullets) {
        if (!b || b.dmg == null) continue;
        const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
        if (d > 360 || d < 6) continue;
        const spd = Math.hypot(b.vx || 0, b.vy || 0) || 1;
        if ((dx * (b.vx || 0) + dy * (b.vy || 0)) / spd <= 0) continue;
        if (env.rand(0, 1) > chance) { hb.dodgeCD = 0.8; break; }
        let nx = -dy / spd, ny = dx / spd;
        if ((nx * dx + ny * dy) < 0) { nx = -nx; ny = -ny; }
        const dashSp = e.speed * (2.0 + hb.stage * 0.12);
        hb.dodgeVx = nx * dashSp; hb.dodgeVy = ny * dashSp; hb.dodgeT = 0.22; hb.dodgeCD = 1.5;
        if (env.addEffect) env.addEffect(e.x, e.y, 'pop', 0.4, ACCENT);
        return;
      }
    }

    const pl = env.player;
    if (hb.dodgeT > 0) {
      hb.dodgeT -= dt; e.vx = hb.dodgeVx; e.vy = hb.dodgeVy; hb.dodgeVx *= 0.86; hb.dodgeVy *= 0.86;
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
      if (hb.dodgeT <= 0) { e.vx = 0; e.vy = 0; }
      return;
    }
    const d2p = env.dist2(e.x, e.y, pl.x, pl.y);
    if (d2p > 280 * 280) {
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      const sp = e.speed * (0.7 + hb.stage * 0.04);
      e.vx = env.lerp(e.vx || 0, Math.cos(a) * sp, 0.15);
      e.vy = env.lerp(e.vy || 0, Math.sin(a) * sp, 0.15);
      if (env.moveWithCollide) env.moveWithCollide(e, e.vx * dt, e.vy * dt);
    } else { e.vx *= 0.8; e.vy *= 0.8; }

    // pick / advance attacks
    if (!hb.cur) {
      hb.idle -= dt;
      if (hb.idle <= 0) {
        const pool = poolFor(hb.stage);
        let opts = pool; if (hb.last && pool.length > 1) opts = pool.filter(k => k !== hb.last);
        const key = opts[Math.floor(env.rand(0, opts.length))];
        startAttack(e, key); hb.last = key;
        // dual-cast: chain a second attack right after the first
        const dualChance = hb.stage >= 10 ? 1.0 : hb.stage >= 8 ? 0.55 : 0;
        if (hb.dual && env.rand(0, 1) < dualChance) {
          hb.cur.onDone = function () {
            const p2 = pool.filter(k => k !== key);
            const k2 = p2[Math.floor(env.rand(0, p2.length))];
            startAttack(e, k2);
          };
        }
      }
      return;
    }
    const c = hb.cur;
    const P = c.phases;
    const su = (c.phase === 'windup' || c.phase === 'recover') ? Math.max(0.6, 1.6 - hb.stage * 0.05) : 1;
    c.t += dt * su;
    if (c.phase === 'windup' && c.t >= P.windup) { c.phase = 'tele'; c.t = 0; }
    else if (c.phase === 'tele' && c.t >= P.tele) {
      c.phase = 'active'; c.t = 0;
      ATTACKS[c.key].build(e, c);
      const m = dmgMult(hb.stage);
      if (c.dmg) c.dmg *= m;
      if (c.proj) for (const p of c.proj) p.dmg *= m;
      if (env.cam) env.cam.shake = Math.max(env.cam.shake || 0, 6);
    }
    else if (c.phase === 'active' && c.t >= P.active) { c.phase = 'recover'; c.t = 0; c.zones = null; c.proj = null; }
    else if (c.phase === 'recover' && c.t >= P.recover) {
      const onDone = c.onDone;
      hb.cur = null;
      hb.idle = idleFor(hb.stage);
      if (typeof onDone === 'function') { onDone(); }
      return;
    }
    if (c.phase === 'active') ATTACKS[c.key].tick(e, c, dt);
  }

  // ============================================================
  // 2D RENDERING
  // ============================================================
  function draw2D(e, ctx, cx, cy, t) {
    if (!env) return;
    const rr = e.r || 52;
    const hb = e._hb || {};
    const stage = hb.stage || 1;
    const fl = e._float;
    const floatOff = fl ? (Math.sin(t * 1.1) * fl.amp + fl.base) : 0;
    // ground shadow (stays on the ground; smaller & softer when floating high)
    ctx.fillStyle = fl ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.ellipse(cx, cy + rr * 0.75, rr * (fl ? 0.82 : 1.1), rr * (fl ? 0.3 : 0.5), 0, 0, Math.PI * 2); ctx.fill();
    // a faint tether from the floating body down to its ground shadow
    if (fl) { ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#e0c6ff'; ctx.lineWidth = 2; ctx.setLineDash([4, 8]); ctx.beginPath(); ctx.moveTo(cx, cy - floatOff); ctx.lineTo(cx, cy + rr * 0.75); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
    // shift the body up so it reads as floating in the sky
    cy = cy - floatOff;
    // gravitational aura — grows with stage
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const auraR = rr * (2.0 + stage * 0.05);
    const ag = ctx.createRadialGradient(cx, cy, rr * 0.3, cx, cy, auraR);
    ag.addColorStop(0, 'rgba(224,198,255,' + (0.18 + stage * 0.012) + ')'); ag.addColorStop(0.5, 'rgba(120,60,200,0.08)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- body: official Hollow sprite (or the armoured morph form), slow cosmic spin ----
    ctx.save(); ctx.translate(cx, cy);
    // no continuous spin — the body holds still; life comes from the core
    // pulse and the orbiting soul-shards
    const useMorph = hb.morphed && morphReady && imgMorph.width;
    const src = useMorph ? imgMorph : (ready && img.width ? img : null);
    if (src) {
      const iw = src.width, ih = src.height;
      const w = rr * (useMorph ? 3.0 : 3.4), h = w * (ih / iw);
      ctx.drawImage(src, -w / 2, -h / 2, w, h);
    } else {
      // fallback: dark tapering monolith
      const bg = ctx.createLinearGradient(0, -rr * 1.2, 0, rr * 1.2);
      bg.addColorStop(0, '#1a0e26'); bg.addColorStop(0.5, '#0a0414'); bg.addColorStop(1, '#05020a');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-rr * 0.6, -rr * 1.0); ctx.lineTo(rr * 0.6, -rr * 1.0);
      ctx.lineTo(rr * 0.95, rr * 1.0); ctx.lineTo(-rr * 0.95, rr * 1.0); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(224,198,255,' + (0.4 + 0.3 * Math.sin(t * 2)) + ')'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    ctx.restore();

    // blazing core — intensifies with stage; white-hot at stage 10
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const pulse = 0.7 + 0.3 * Math.sin(t * 3) + stage * 0.02;
    const coreR = rr * 0.55 * pulse;
    const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, coreR);
    const hot = stage >= 10;
    cg.addColorStop(0, hot ? 'rgba(255,255,255,' + Math.min(1, pulse) + ')' : 'rgba(255,246,232,' + (0.95 * pulse) + ')');
    cg.addColorStop(0.4, hot ? 'rgba(255,220,180,0.8)' : 'rgba(255,180,120,' + (0.6 * pulse) + ')');
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // five orbiting soul-shards — converge toward the core at stage 10
    const conv = stage >= 10 ? 0.35 : stage >= 7 ? 0.12 : 0;
    const orbitR = rr * (1.15 - conv);
    const shardCols = hb.morphed ? MORPH_SHARDS : SHARD_COLS;
    for (let i = 0; i < 5; i++) {
      const a = t * 0.5 + i * (Math.PI * 2 / 5);
      const ox = cx + Math.cos(a) * orbitR, oy = cy + Math.sin(a) * orbitR;
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(a + Math.PI / 2);
      const sc = shardCols[i], s = rr * 0.22;
      const fg = ctx.createLinearGradient(0, -s, 0, s);
      fg.addColorStop(0, '#fff'); fg.addColorStop(0.5, sc); fg.addColorStop(1, '#0a0218');
      ctx.fillStyle = fg; ctx.strokeStyle = sc; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.5, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // chromatic aberration fracture lines — more present at high stages
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const riftA = 0.28 + stage * 0.04;
    ctx.strokeStyle = 'rgba(255,58,106,' + riftA + ')'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(cx - rr * 0.3, cy - rr * 0.6); ctx.lineTo(cx + rr * 0.25, cy + rr * 0.4); ctx.stroke();
    ctx.strokeStyle = 'rgba(58,254,255,' + riftA + ')';
    ctx.beginPath(); ctx.moveTo(cx - rr * 0.3 + 2, cy - rr * 0.6); ctx.lineTo(cx + rr * 0.25 + 2, cy + rr * 0.4); ctx.stroke();
    ctx.restore();

    if (hb.hitFlash > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = hb.hitFlash;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (e.absorbing) drawAbsorb2D(ctx, cx, cy, rr, t);
    if (hb.cur) drawTelegraph2D(ctx, hb.cur, t);
    if (hb.phaseAnim) drawPhaseAnim2D(ctx, e, hb.phaseAnim, t);

    // HP ring
    const hpR = Math.max(0, (e.hp || 0) / Math.max(1, e.maxhp || e.hp || 1));
    ctx.strokeStyle = '#000a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, rr + 8, -Math.PI / 2, -Math.PI / 2 + hpR * 2 * Math.PI); ctx.stroke();
  }

  function drawAbsorb2D(ctx, cx, cy, rr, t) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const shR = rr * 1.9 + Math.sin(t * 3) * 4;
    const sg = ctx.createRadialGradient(cx, cy, rr * 0.6, cx, cy, shR);
    sg.addColorStop(0, 'rgba(224,198,255,0)'); sg.addColorStop(0.7, 'rgba(224,198,255,0.18)'); sg.addColorStop(1, 'rgba(224,198,255,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, shR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(224,198,255,0.85)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40;
    ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(t * 3));
    ctx.beginPath(); ctx.arc(cx, cy, rr * 1.5, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  function drawPhaseAnim2D(ctx, e, pa, t) {
    const cam = env.cam, sx = (x) => x - cam.x - cam.sx, sy = (y) => y - cam.y - cam.sy;
    const p = Math.min(1, pa.t / pa.dur), cx = sx(e.x), cy = sy(e.y), rr = e.r || 52;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const ringR = rr + p * 560;
    ctx.strokeStyle = 'rgba(224,198,255,' + (0.9 * (1 - p)) + ')'; ctx.lineWidth = 12 * (1 - p) + 2;
    ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2); ctx.stroke();
    const fg = ctx.createRadialGradient(cx, cy, 2, cx, cy, rr * 2.6);
    fg.addColorStop(0, 'rgba(255,246,232,' + (0.85 * (1 - p)) + ')'); fg.addColorStop(0.5, 'rgba(224,198,255,' + (0.5 * (1 - p)) + ')'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx, cy, rr * 2.6, 0, Math.PI * 2); ctx.fill();
    // stage number flash
    ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - p)) + ')';
    ctx.font = '700 ' + (rr * 0.9) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pa.to + ' / 10', cx, cy);
    ctx.setLineDash([]); ctx.restore();
  }

  function drawTelegraph2D(ctx, cur, t) {
    if (!env) return;
    const cam = env.cam, sx = (x) => x - cam.x - cam.sx, sy = (y) => y - cam.y - cam.sy;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const tele = cur.phase === 'tele', tp = tele ? cur.t / cur.phases.tele : 1;
    if (cur.phase !== 'tele' && cur.phase !== 'active') { ctx.restore(); return; }
    if (cur.key === 'pulse') {
      if (cur.phase === 'active' && cur.r !== undefined) {
        ctx.strokeStyle = 'rgba(224,198,255,0.9)'; ctx.lineWidth = cur.band || 6;
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, cur.r), cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2); ctx.stroke();
      } else if (cur.cx !== undefined) {
        ctx.fillStyle = 'rgba(224,198,255,' + (0.3 * tp) + ')'; ctx.strokeStyle = 'rgba(224,198,255,0.9)'; ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), 80 * tp, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (cur.key === 'beam' || cur.key === 'silence') {
      const prog = tele ? tp : Math.min(1, cur.t / cur.phases.active);
      const offs = cur.key === 'silence' ? [0, Math.PI] : [0];
      for (const off of offs) {
        const a1 = cur.ang0 + cur.sweep * (tele ? 1 : prog) + off;
        const x0 = sx(cur.cx), y0 = sy(cur.cy), x1 = sx(cur.cx + Math.cos(a1) * cur.len), y1 = sy(cur.cy + Math.sin(a1) * cur.len);
        ctx.strokeStyle = 'rgba(224,198,255,' + (tele ? 0.5 * tp : 0.8) + ')'; ctx.lineWidth = cur.thick * 0.7;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    } else if (cur.key === 'rift' && cur.zones) {
      for (const z of cur.zones) {
        ctx.fillStyle = 'rgba(224,198,255,' + (0.3 * tp) + ')'; ctx.strokeStyle = 'rgba(224,198,255,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx(z.x), sy(z.y), z.r * (tele ? tp : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (cur.key === 'chains') {
      const p = tele ? 0 : Math.min(1, cur.t / cur.phases.active);
      const r = Math.max(1, cur.r0 * (1 - p * 0.76));
      ctx.strokeStyle = 'rgba(224,198,255,' + (tele ? 0.6 * tp : 0.9) + ')'; ctx.lineWidth = 6; ctx.setLineDash([14, 8]);
      ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), r, cur.gapAng + cur.gap / 2, cur.gapAng - cur.gap / 2 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    } else if (cur.key === 'shards' && cur.proj) {
      for (const p of cur.proj) { ctx.fillStyle = 'rgba(224,198,255,0.8)'; ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r, 0, Math.PI * 2); ctx.fill(); }
    } else if (cur.key === 'collapse') {
      if (cur.phase === 'active' && cur.maxR !== undefined) {
        const p = Math.min(1, cur.t / cur.phases.active), r = cur.maxR * (1 - p * 0.85);
        ctx.strokeStyle = 'rgba(224,198,255,0.9)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
      } else { ctx.fillStyle = 'rgba(224,198,255,' + (0.25 * tp) + ')'; ctx.beginPath(); ctx.arc(sx(cur.cx), sy(cur.cy), 90 * tp, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  // ============================================================
  // 3D RENDERING
  // ============================================================
  function draw3D(R, e, tt) {
    if (!R || !R.ok || !env) return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const hb = e._hb || {};
    const stage = hb.stage || 1;
    const rr = e.r || 52, x = e.x, z = e.y;
    const hb2 = rr * 1.3 + Math.sin(tt * 2.4) * 3;
    const fl = e._float;
    const floatOff = fl ? (Math.sin(tt * 1.1) * fl.amp + fl.base) : 0;
    const by = hb2 + floatOff;          // body floats in the sky when _float is set
    const AC = R.hexRGB(ACCENT);
    const ang = Math.atan2(env.player.y - e.y, env.player.x - e.x);

    R.quads.alpha.push(x, 1.2, z, rr * 2.6, 0, 0, 0, 0.4, 0, 11, 0, 1);

    if (ready || (hb.morphed && morphReady)) {
      // inflated sprite mesh — the Hollow cosmic entity (or its armoured morph form)
      const srcImg = (hb.morphed && morphReady) ? imgMorph : img;
      const sp = R.spriteMesh(srcImg, { depth: 0.6, power: 0.5 });
      if (sp) {
        const size = (rr + 20) * 2.8;
        const tps = R.isTps;
        const tilt = 1.2;
        if (tps) {
          const c = Math.cos(R.cam.tyaw), sn = Math.sin(R.cam.tyaw), ux = -sn, uz = c;
          const _t1 = new Float32Array(16), o = new Float32Array(16);
          R.GL3D.M.trs(_t1, 0, 0, 0, ang, size * 1.1, size * 0.55, size * 1.1);
          const co = Math.cos(tilt), si = Math.sin(tilt), tT = 1 - co; o.fill(0); o[15] = 1;
          o[0] = co + tT * ux * ux; o[1] = si * uz; o[2] = tT * ux * uz;
          o[4] = -si * uz; o[5] = co; o[6] = si * ux;
          o[8] = tT * ux * uz; o[9] = -si * ux; o[10] = co + tT * uz * uz;
          const out = mm(0, 0, 0, 0, 1, 1, 1); R.GL3D.M.mul(out, o, _t1);
          out[12] = x; out[13] = by + size * 0.44 + R.groundY(x, z); out[14] = z;
          R.draw(sp.mesh, out, mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        } else {
          R.draw(sp.mesh, mm(x, by, z, ang, size, size * 1.35, size), mat([1, 1, 1], { tex: sp.tex, emis: sp.emis, emisK: 0.35, rough: 0.6, metal: 0, emissive: [0, 0, 0], rim: 0.2, rimCol: AC }));
        }
      }
    } else {
      // fallback: dark monolith
      const rk = mat([0.06, 0.03, 0.12], { rough: 0.55, metal: 0.3, emissive: [0.1, 0.05, 0.18], emisK: 1.4, rim: 1.5, rimCol: AC });
      R.draw(U.rock3, mm(x, by, z, tt * 0.2, rr * 0.7, rr * 2.4, rr * 0.7, 0.3), rk);
    }

    // blazing soul-core — white-hot at stage 10
    const hot = stage >= 10;
    const cc = hot ? [1, 1, 1] : [1, 0.9, 0.7];
    R.draw(U.sphere, mm(x, by, z, tt * 0.5, rr * 0.26, rr * 0.26, rr * 0.26), mat(cc, { emissive: hot ? [2.6, 2.4, 2.2] : [2.2, 1.6, 0.9], emisK: 2.6, shadow: false, rim: 2.0, rimCol: cc }));
    R.glow(x, by, z, rr * (1.5 + stage * 0.05), cc[0], cc[1], cc[2], 0.7 + 0.2 * Math.sin(tt * 3), 0);
    R.light(x, z, by, 240, cc[0], cc[1], cc[2], 0.7);

    // five orbiting soul-shards — converge at stage 10
    const conv = stage >= 10 ? 0.35 : stage >= 7 ? 0.12 : 0;
    const d = rr * (1.6 - conv);
    const shardCols3 = hb.morphed ? MORPH_SHARDS : SHARD_COLS;
    for (let i = 0; i < 5; i++) {
      const a = tt * 0.5 + i * (Math.PI * 2 / 5);
      const sxp = x + Math.cos(a) * d, szp = z + Math.sin(a) * d, sy2 = by + Math.sin(tt * 2 + i) * 4;
      const scc = R.hexRGB(shardCols3[i]);
      R.draw(U.octa, mm(sxp, sy2, szp, a + Math.PI / 2, rr * 0.18, rr * 0.34, rr * 0.18), mat([scc[0] * 0.4, scc[1] * 0.4, scc[2] * 0.4], { rough: 0.3, metal: 0.4, emissive: [scc[0] * 0.8, scc[1] * 0.8, scc[2] * 0.8], emisK: 1.8, rim: 1.4, rimCol: scc }));
      R.glow(sxp, sy2, szp, rr * 0.5, scc[0], scc[1], scc[2], 0.5 + 0.2 * Math.sin(tt * 3 + i), 0);
    }

    // void particle stream — denser at high stages
    const pn = 8 + Math.min(8, stage);
    for (let i = 0; i < pn; i++) {
      if (Math.random() < 0.6 * (R.q.parts || 1)) {
        const a = Math.random() * 6.28, dd = rr * (1 + Math.random() * 1.4);
        R.emit({ x: x + Math.cos(a) * dd, y: by + Math.random() * rr, z: z + Math.sin(a) * dd, vx: -Math.cos(a) * 14, vy: 5 + Math.random() * 14, vz: -Math.sin(a) * 14, life: 1.4, age: 0, s0: 4, s1: 1, col: AC, a: 0.6, kind: 0, drag: 0.8 });
      }
    }
    R.decal(x, z, rr * 2.6, AC[0], AC[1], AC[2], 0.3 + 0.1 * Math.sin(tt * 2), 9, tt * 0.5, 0, true, 1.4);

    if (e.absorbing) {
      const pul = 0.5 + 0.5 * Math.sin(tt * 2.4), shR = rr * 2.2;
      R.draw(U.sphere, mm(x, by + shR * 0.55, z, tt * 0.3, shR, shR * 1.15, shR), mat(AC, { alpha: 0.10 + 0.05 * pul, emissive: [AC[0] * 0.4, AC[1] * 0.4, AC[2] * 0.4], rim: 1.6, rimCol: AC, shadow: false, rough: 0.2, metal: 0.2 }));
      R.draw(U.torus, mm(x, by + 4, z, tt * 0.8, shR * 0.95, shR * 0.95, shR * 0.95, 0.12), mat([1, 1, 1], { emissive: AC, alpha: 0.5 + 0.2 * pul, shadow: false }));
      R.glow(x, by + shR * 0.5, z, shR * 1.4, AC[0], AC[1], AC[2], 0.35 + 0.15 * pul, 0);
    }
    if (hb.cur) drawTelegraph3D(R, hb.cur, tt);
    if (hb.phaseAnim) drawPhaseAnim3D(R, e, hb.phaseAnim, tt, hb2);
  }

  function drawPhaseAnim3D(R, e, pa, tt, hb2) {
    const U = R.unit, mm = R.mm, mat = R.mat;
    const x = e.x, z = e.y, rr = e.r || 52;
    const p = Math.min(1, pa.t / pa.dur), fade = 1 - p, ringR = rr + p * 540;
    const AC = R.hexRGB(ACCENT);
    R.draw(U.torus, mm(x, 4, z, tt * 1.5, ringR, 2 + 10 * fade, ringR, 0.18), mat([1.2, 1.0, 1.4], { emissive: [1.8, 1.4, 2.2], emisK: 2.4, alpha: 0.9 * fade, shadow: false }));
    R.glow(x, hb2, z, rr * (1.4 + p * 1.2), AC[0], AC[1], AC[2], 0.9 * fade, 0);
    R.light(x, z, hb2 + 20, 340 + p * 280, AC[0], AC[1], AC[2], 0.9 * fade);
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.85) {
        const a = Math.random() * Math.PI * 2, dd = rr * (0.4 + Math.random() * 1.8);
        R.emit({ x: x + Math.cos(a) * dd, y: 2 + Math.random() * 10, z: z + Math.sin(a) * dd, vx: Math.cos(a) * (24 + 50 * fade), vy: 70 + Math.random() * 90, vz: Math.sin(a) * (24 + 50 * fade), life: 1.0, age: 0, s0: 10, s1: 2, col: AC, a: 0.9 * fade, kind: 0, drag: 0.6 });
      }
    }
    R.cameraKick = Math.max(R.cameraKick || 0, 0.45 * fade);
  }

  function drawTelegraph3D(R, cur, tt) {
    if (!env) return;
    if (cur.phase !== 'tele' && cur.phase !== 'active') return;
    const U = R.unit, mm = R.mm, mat = R.mat;
    const AC = R.hexRGB(ACCENT);
    if (cur.key === 'pulse' && cur.cx !== undefined) {
      voidSigil3D(R, cur.cx, cur.cy, 80, AC, tt);
      if (cur.phase === 'active' && cur.r !== undefined) {
        const n = 24;
        for (let i = 0; i < n; i++) {
          const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
          const rx = cur.cx + Math.cos(a) * cur.r, rz = cur.cy + Math.sin(a) * cur.r;
          R.draw(U.rock3, mm(rx, 10, rz, a * 2 + i, 6, 14, 6, i * 0.2), mat([0.1, 0.05, 0.15], { rough: 0.5, metal: 0.3, emissive: [AC[0] * 0.8, AC[1] * 0.8, AC[2] * 0.8], emisK: 1.8 }));
        }
      }
    } else if (cur.key === 'beam' || cur.key === 'silence') {
      const prog = cur.phase === 'tele' ? (cur.t / cur.phases.tele) : Math.min(1, cur.t / cur.phases.active);
      const offs = cur.key === 'silence' ? [0, Math.PI] : [0];
      for (const off of offs) {
        const ang = cur.ang0 + cur.sweep * (cur.phase === 'tele' ? 1 : prog) + off;
        const ex = cur.cx + Math.cos(ang) * cur.len, ez = cur.cy + Math.sin(ang) * cur.len;
        const mx = (cur.cx + ex) / 2, mz = (cur.cy + ez) / 2;
        R.draw(U.cyl, mm(mx, 26, mz, ang, cur.thick * 0.4, 26, cur.thick * 0.4), mat([1.2, 1.0, 1.4], { emissive: [1.8, 1.4, 2.2], emisK: 2.4, rough: 0.2, shadow: false, rim: 2.0, rimCol: AC }));
        R.glow(ex, 26, ez, cur.thick * 2, AC[0], AC[1], AC[2], 0.7, 0);
      }
    } else if (cur.key === 'rift' && cur.zones) {
      for (const z of cur.zones) { voidSigil3D(R, z.x, z.y, z.r, AC, tt); R.glow(z.x, 4, z.y, z.r, AC[0], AC[1], AC[2], 0.5, 0); }
    } else if (cur.key === 'shards' && cur.proj) {
      for (const p of cur.proj) { R.draw(U.octa, mm(p.x, 20, p.y, tt * 3, p.r * 0.8, p.r * 1.2, p.r * 0.8), mat([1.2, 1.0, 1.4], { emissive: [1.8, 1.4, 2.2], emisK: 2.2, shadow: false, rim: 1.8, rimCol: AC })); R.glow(p.x, 20, p.y, p.r * 3, AC[0], AC[1], AC[2], 0.6, 0); }
    } else if (cur.key === 'chains') {
      const p = cur.phase === 'tele' ? 0 : Math.min(1, cur.t / cur.phases.active);
      const r = Math.max(8, cur.r0 * (1 - p * 0.76)), n = 20;
      for (let i = 0; i < n; i++) {
        const a = cur.gapAng + cur.gap / 2 + (i / n) * (Math.PI * 2 - cur.gap);
        const rx = cur.cx + Math.cos(a) * r, rz = cur.cy + Math.sin(a) * r;
        R.draw(U.torus, mm(rx, 16, rz, a, 4, 2, 4, 0.18), mat([0.3, 0.2, 0.4], { rough: 0.4, metal: 0.6, emissive: [AC[0] * 0.5, AC[1] * 0.5, AC[2] * 0.5], emisK: 1.5, rim: 1.0, rimCol: AC }));
      }
    } else if (cur.key === 'collapse' && cur.phase === 'active' && cur.maxR !== undefined) {
      const p = Math.min(1, cur.t / cur.phases.active), r = cur.maxR * (1 - p * 0.85);
      R.draw(U.torus, mm(cur.cx, 10, cur.cy, tt * 2, Math.max(1, r), 3, Math.max(1, r), 0.15), mat([1.3, 1.0, 1.4], { emissive: [2.0, 1.4, 2.4], emisK: 2.6, shadow: false, rim: 2.0, rimCol: AC }));
      R.glow(cur.cx, 10, cur.cy, r, AC[0], AC[1], AC[2], 0.7, 0);
    }
  }

  function voidSigil3D(R, x, z, r, col, tt) {
    if (r < 2) return;
    R.decal(x, z, r, col[0], col[1], col[2], 0.5, 9, tt * 0.6, 0, true, 1.4);
    R.decal(x, z, r * 0.66, col[0], col[1], col[2], 0.7, 6, -tt * 0.84, 0, true, 1.6);
    R.decal(x, z, r * 0.34, Math.min(1, col[0] * 1.3), Math.min(1, col[1] * 1.3), Math.min(1, col[2] * 1.3), 0.9, 12, tt * 1.2, 0, true, 1.8);
  }

  // ---- spawn init ----
  function initEnemy(e) {
    e.r = 52; e.hp = e.maxhp = 16000; e.speed = 175; e.cd = 99; e.detectR = 1400;
    e.absorbing = true;
    e._hb = { stage: 1, cur: null, last: null, idle: 0.0, hitFlash: 0, intro: 2.0, phaseAnim: null, dodgeT: 0, dodgeVx: 0, dodgeVy: 0, dodgeCD: 1.5, dual: false, morphed: false, morphStarted: false, morphing: false };
    injectShieldWarn();
  }
  function onHit(e, dmg) {
    if (!e._hb) return;
    e._hb.hitFlash = Math.min(1, (e._hb.hitFlash || 0) + Math.min(0.5, dmg / 60));
  }

  window.HollowBoss = {
    setEnv(_env) { env = _env; },
    initEnemy, tick, draw2D, draw3D, onHit, hideShieldWarn, ACCENT,
    get sprite() { return morphedFlag && morphReady ? imgMorph : (ready ? img : null); }
  };
})();
