// ============================================================
// Monster Arena — The Hollow Gauntlet
// Orchestrates the final encounter after the player steps
// through the Soul Doorway. A combined-biome map hosts all
// five realm Wardens at once; an intro cutscene spawns each
// Warden in its biome doing a cosmetic attack, then reveals
// the shielded Hollow above with the demand "DEFEAT MY WARDENS".
// Once every Warden falls, the Hollow's shield drops and its
// 10-stage finale begins. Dying returns the player to the Soul
// Doorway so they can enter again. Fully offline — reads the
// live combat engine through the window._Gauntlet API.
// ============================================================
(function () {
  'use strict';

  const WARDEN_TYPES = ['hearth_warden', 'pharaoh_glass', 'rime_oracle', 'magma_titan', 'void'];

  let state = null;       // { phase, raf, dead }
  let hudEl = null, hudInjected = false;
  let skyCanvas = null, skyCtx = null, skyRaf = 0;

  function injectHUD() {
    if (hudInjected) return; hudInjected = true;
    const s = document.createElement('style');
    s.textContent = `#hollowHud{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:44;
      padding:8px 18px;border-radius:999px;pointer-events:none;display:none;font-size:13px;letter-spacing:.14em;
      text-transform:uppercase;font-weight:800;color:#f0e6ff;background:rgba(8,4,16,.82);
      border:1px solid #e0c6ff;text-shadow:0 0 12px rgba(224,198,255,.6);white-space:nowrap;}
      #hollowHud .hhTag{color:#e0c6ff;margin-right:8px;}
      #hollowHud .hhVal{color:#fff;}
      #hollowDoorReturn{position:fixed;inset:0;z-index:62;display:none;place-items:center;background:rgba(4,5,10,.96);}
      #hollowDoorReturn .card{width:min(620px,94vw);padding:30px;text-align:center;background:rgba(10,13,22,.94);
        border:1px solid #c066ff;border-radius:20px;box-shadow:0 0 50px rgba(192,102,255,.35);}
      #hollowDoorReturn h2{margin:0 0 8px;letter-spacing:.06em;text-transform:uppercase;font-size:22px;color:#fff;text-shadow:0 0 20px #c066ff;}
      #hollowDoorReturn p{opacity:.85;margin:0 0 18px;color:#e6d6ff;font-size:14px;line-height:1.45;}`;
    document.head.appendChild(s);
    hudEl = document.createElement('div');
    hudEl.id = 'hollowHud';
    hudEl.innerHTML = '<span class="hhTag">Gauntlet</span><span class="hhVal" id="hhVal">0 / 5 Wardens</span>';
    document.body.appendChild(hudEl);

    const ret = document.createElement('div');
    ret.id = 'hollowDoorReturn';
    ret.className = 'overlay';
    ret.innerHTML = '<div class="card"><h2>You Fell in the Void</h2>' +
      '<p id="hdSub">Your soul scatters back to the doorway. The Wardens rise again beyond it.</p>' +
      '<div class="row" style="justify-content:center;">' +
      '<button class="btn bigBtn" id="hdReenter">🔮 Re-enter the Doorway</button>' +
      '<button class="btn" id="hdHub">📖 Return to Hub</button></div></div>';
    document.body.appendChild(ret);
  }

  function injectSky() {
    if (skyCanvas) return;
    skyCanvas = document.createElement('canvas'); skyCanvas.id = 'hollowSky';
    skyCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2;';
    skyCtx = skyCanvas.getContext('2d');
    document.body.appendChild(skyCanvas);
    const r = () => { if (!skyCanvas) return; skyCanvas.width = window.innerWidth; skyCanvas.height = window.innerHeight; };
    r(); window._hollowSkyResize = r; window.addEventListener('resize', r);
  }
  function drawSky(now) {
    if (!skyCtx) return;
    const W = skyCanvas.width, H = skyCanvas.height;
    skyCtx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H * 0.16, r = Math.min(W, H) * 0.14;
    const pulse = 0.5 + 0.5 * Math.sin(now / 900);
    skyCtx.save();
    skyCtx.globalCompositeOperation = 'screen';
    const g = skyCtx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 2.2);
    g.addColorStop(0, 'rgba(200,140,255,' + (0.22 + 0.08 * pulse) + ')');
    g.addColorStop(0.5, 'rgba(120,70,200,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    skyCtx.fillStyle = g; skyCtx.beginPath(); skyCtx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); skyCtx.fill();
    skyCtx.globalCompositeOperation = 'source-over';
    const bg = skyCtx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    bg.addColorStop(0, 'rgba(20,8,32,0.85)'); bg.addColorStop(0.7, 'rgba(8,2,16,0.7)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    skyCtx.fillStyle = bg; skyCtx.beginPath(); skyCtx.arc(cx, cy, r, 0, Math.PI * 2); skyCtx.fill();
    skyCtx.strokeStyle = 'rgba(220,170,255,' + (0.4 + 0.3 * pulse) + ')'; skyCtx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + now / 4000; skyCtx.beginPath(); skyCtx.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2); skyCtx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); skyCtx.stroke(); }
    skyCtx.fillStyle = 'rgba(255,80,80,' + (0.6 + 0.4 * pulse) + ')';
    skyCtx.beginPath(); skyCtx.arc(cx - r * 0.22, cy - r * 0.05, r * 0.06, 0, Math.PI * 2); skyCtx.fill();
    skyCtx.beginPath(); skyCtx.arc(cx + r * 0.22, cy - r * 0.05, r * 0.06, 0, Math.PI * 2); skyCtx.fill();
    skyCtx.restore();
  }
  function skyLoop() {
    if (!skyCanvas) return;
    drawSky(performance.now());
    skyRaf = requestAnimationFrame(skyLoop);
  }
  function startSky() { injectSky(); skyCanvas.style.display = 'block'; if (!skyRaf) skyRaf = requestAnimationFrame(skyLoop); }
  function stopSky() { if (skyRaf) { cancelAnimationFrame(skyRaf); skyRaf = 0; } if (skyCanvas) skyCanvas.style.display = 'none'; }

  function showHUD(text) { injectHUD(); hudEl.style.display = 'block'; const v = document.getElementById('hhVal'); if (v) v.textContent = text; }
  function hideHUD() { if (hudEl) hudEl.style.display = 'none'; }

  function setFlags(on) {
    window.HOLLOW_GAUNTLET_ACTIVE = on;
    window.STORY_ACTIVE = false;     // suppress per-warden chapter-end hook
    window.PVP_MODE = false;
    window.BOTS_ENABLED = false;
    if (!on) { window._GAUNTLET_INTRO = false; window._GAUNTLET_INTRO_CAM = null; window._HOLLOW_METAMORPHOSIS_ACTIVE = false; }
  }

  // ---- per-frame poll ----
  function poll() {
    if (!state) return;
    const G = window._Gauntlet;
    if (!G) { state.raf = requestAnimationFrame(poll); return; }
    const p = G.player;
    if (p && p.hp <= 0 && !state.dead) { returnToDoorway(true); return; }

    if (state.phase === 'wardens') {
      const remaining = G.enemies.filter(function (e) { return WARDEN_TYPES.indexOf(e.type) >= 0; }).length;
      // a Warden (or more) just died → queue a glyph reward for each kill
      if (remaining < state.lastRemaining) {
        state.rewardQueue += (state.lastRemaining - remaining);
        state.lastRemaining = remaining;
      }
      const fallen = 5 - remaining;
      showHUD(fallen + ' / 5 Wardens fallen');
      // serve pending rewards one at a time; the fight freezes while one is open
      if (state.rewardQueue > 0 && !state.glyphRewardOpen) {
        state.glyphRewardOpen = true;
        state.rewardQueue--;
        window.openGauntletGlyphReward(function () { state.glyphRewardOpen = false; });
        state.raf = requestAnimationFrame(poll);
        return;
      }
      // Safety net: once no glyph reward is open, make absolutely sure the
      // gauntlet's freeze flags are cleared so the player is never left
      // "stuck" after the reward overlay closes.
      if (!state.glyphRewardOpen && window._GAUNTLET_INTRO) {
        window._GAUNTLET_INTRO = false;
        window._GAUNTLET_INTRO_CAM = null;
        const s = window.__dbg && window.__dbg.state;
        if (s && s.phase === 'glyph') s.phase = 'combat';
      }
      // only once every reward is claimed AND every Warden is down → the Hollow breaks free
      if (remaining === 0 && state.rewardQueue === 0 && !state.glyphRewardOpen) {
        state.phase = 'transition';
        // keep the shielded Hollow (spawned during the intro) so it can shatter free
        playHollowBreakFree(function () {
          state.phase = 'hollow';
          const h = G.enemies.find(function (e) { return e.type === 'hollow'; });
          if (h) {
            h.absorbing = false;
            if (h._hb) { h._hb.cur = null; h._hb.idle = 0.5; h._hb.intro = 0; }
            // Reposition the Hollow from the sky (where it loomed during the
            // intro) to a fighting distance from the player, so its attacks
            // can actually reach. Lower the float so it hovers just above the
            // ground rather than 300 units in the air.
            const p = G.player;
            const a = Math.atan2(h.y - p.y, h.x - p.x);
            h.x = p.x + Math.cos(a) * 420;
            h.y = p.y + Math.sin(a) * 420;
            if (h._float) h._float = { base: 50, amp: 8 };
          } else { spawnHollow(); }
          if (G.camShake) G.camShake(20);
          showHUD('The Hollow — Stage 1 / 10');
        });
      }
    } else if (state.phase === 'hollow') {
      // guarantee the combat freeze flag is clear so the engine's boss-tick
      // gate (pve16: !window._GAUNTLET_INTRO) actually calls HollowBoss.tick —
      // but NOT during the Hollow's mid-fight metamorphosis cutscene, which
      // intentionally freezes combat while it plays.
      if (window._GAUNTLET_INTRO && !window._HOLLOW_METAMORPHOSIS_ACTIVE) window._GAUNTLET_INTRO = false;
      const h = G.enemies.find(function (e) { return e.type === 'hollow'; });
      if (!h) { state.phase = 'victory'; showVictory(); return; }
      // remember the Hollow's last position so the death cinematic can stage
      // the banishment there even though the boss is already gone by the time
      // showVictory() runs.
      state.hollowX = h.x; state.hollowY = h.y;
      const stage = (h._hb && h._hb.stage) || 1;
      showHUD('The Hollow — Stage ' + stage + ' / 10');
    }
    state.raf = requestAnimationFrame(poll);
  }

  function spawnHollow() {
    const G = window._Gauntlet; if (!G) return;
    const p = G.player, w = G.world;
    let x = w.w / 2, y = w.h * 0.14;   // high in the sky, above everything
    G.spawnBoss('hollow', x, y);
    const last = G.enemies[G.enemies.length - 1];
    if (last) { last.absorbing = false; last._addsSeen = true; last._float = { base: 300, amp: 16 }; }
    if (G.camShake) G.camShake(20);
  }

  // ---- cinematic bridge: the Hollow breaks its shield in 3D, descends,
  //      speaks, and demonstrates an attack — then the 10-stage fight begins
  function playHollowBreakFree(onDone) {
    stopSky();                       // the Hollow is now in the 3D scene, not a sky silhouette
    if (window.HollowBreakFree) HollowBreakFree.play({ onDone: onDone });
    else onDone();
  }

  // ---- death: return the player to the Soul Doorway ----
  function returnToDoorway(died) {
    if (!state) return;
    state.dead = true;
    setFlags(false);
    cancelAnimationFrame(state.raf);
    if (window._hardStopGame) window._hardStopGame();
    if (window.hideDeathOverlay) window.hideDeathOverlay();
    if (window.HollowBoss && window.HollowBoss.hideShieldWarn) window.HollowBoss.hideShieldWarn();
    if (window.VoidBoss && window.VoidBoss.hideShieldWarn) window.VoidBoss.hideShieldWarn();
    if (window.HollowMetamorphosis) window.HollowMetamorphosis.done();
    hideHUD(); stopSky();
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    if (died) {
      injectHUD();
      const ret = document.getElementById('hollowDoorReturn');
      if (ret) ret.style.display = 'grid';
    } else {
      if (window.Story && Story.showHub) Story.showHub();
    }
    state = null;
  }

  // ---- victory: the heroic 3D banishment, then the fate choice ----
  // The Hollow is already removed from the world the frame it dies, so the
  // cinematic stages a pure-VFX banishment at its last recorded position
  // (state.hollowX/Y) while the Neon Void arena keeps rendering. The game is
  // only hard-stopped once the cinematic finishes — that's when the fate
  // choice (or hub) is shown.
  function showVictory() {
    const W = window._Gauntlet;
    const hx = (state && state.hollowX != null) ? state.hollowX : (W && W.world ? W.world.w / 2 : 0);
    const hy = (state && state.hollowY != null) ? state.hollowY : (W && W.world ? W.world.h * 0.5 : 0);
    if (window.HollowBoss && window.HollowBoss.hideShieldWarn) window.HollowBoss.hideShieldWarn();
    hideHUD(); stopSky();
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    if (window.HollowDeath) { HollowDeath.play({ x: hx, y: hy, onDone: finishVictory }); }
    else { finishVictory(); }
  }
  function finishVictory() {
    if (!state) return;
    cancelAnimationFrame(state.raf);
    // Keep the game engine alive (frozen) so the 3D ending cutscenes can
    // hijack Render3D. The game is hard-stopped only after the chosen
    // ending cutscene finishes (see HollowGauntlet.finishEnding).
    window._GAUNTLET_INTRO = true;
    if (window.HollowMetamorphosis) window.HollowMetamorphosis.done();
    hideHUD(); stopSky();
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    state = null;
    try { if (window.RS) RS.awardHollow(); } catch (_) {}
    if (window.Story && Story.showFateChoice) Story.showFateChoice();
    else { if (window._hardStopGame) window._hardStopGame(); if (window.Story && Story.showHub) Story.showHub(); }
  }

  // ---- entry point ----
  function start() {
    if (state) return;
    injectHUD();
    state = { phase: 'intro', raf: 0, dead: false, lastRemaining: 5, rewardQueue: 0, glyphRewardOpen: false };
    setFlags(true);
    state.origShowDeath = window.showDeathOverlay;
    window.showDeathOverlay = function () { returnToDoorway(true); };

    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });

    const G = window._Gauntlet;
    if (G && G.setThemeById) G.setThemeById(5);   // Neon Void map (not divided)
    if (G && G.restart) G.restart();               // builds the Neon Void world + player

    // Strip every building + interior clutter crate from the gauntlet arena so
    // the Wardens never get stuck inside structures during the fight. Keep only
    // the four arena-boundary walls, then rebuild the wall collision list.
    const w = G && G.world;
    if (w) {
      if (Array.isArray(w.buildings)) w.buildings.length = 0;
      if (Array.isArray(w.chests)) w.chests.length = 0;
      if (Array.isArray(w.hazards)) w.hazards.length = 0;   // remove void pits from the Neon Void arena
      if (Array.isArray(w.solids) && w.solids.length > 4) w.solids.splice(4);
      if (typeof w.rebuildWalls === 'function') w.rebuildWalls();
    }

    // intro cutscene spawns the five wardens (void in form 2) + the shielded Hollow, then hands off
    state.phase = 'intro';
    if (window.GauntletIntro) {
      GauntletIntro.play({ onDone: beginWardenPhase });
      state.raf = requestAnimationFrame(poll);
    } else {
      beginWardenPhase();
    }
  }

  function beginWardenPhase() {
    if (!state) return;
    state.phase = 'wardens';
    startSky();              // the Hollow now looms in the sky for the whole fight
    showHUD('0 / 5 Wardens fallen');
    if (!state.raf) state.raf = requestAnimationFrame(poll);
  }

  function isActive() { return !!state; }

  function wireReturn() {
    injectHUD();
    const re = document.getElementById('hdReenter');
    const hub = document.getElementById('hdHub');
    if (re) re.addEventListener('click', function () {
      const ret = document.getElementById('hollowDoorReturn'); if (ret) ret.style.display = 'none';
      start();
    });
    if (hub) hub.addEventListener('click', function () {
      const ret = document.getElementById('hollowDoorReturn'); if (ret) ret.style.display = 'none';
      if (window.Story && Story.showHub) Story.showHub();
    });

    // During the gauntlet, the Restart buttons must return to the doorway
    // choice (cutting off the fight / glyph screen), not run pve16's in-game
    // restart. Capture-phase listeners fire before pve16's own handlers.
    const onRestart = function (e) {
      if (!window.HOLLOW_GAUNTLET_ACTIVE) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (window.HollowGauntlet && window.HollowGauntlet.restart) window.HollowGauntlet.restart();
    };
    ['btnRestart', 'restartBtn2'].forEach(function (id) {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', onRestart, true);
    });
  }

  // Voluntary Restart during the gauntlet: cut off everything (combat, glyph
  // reward overlay, cutscenes) and send the player back to the doorway choice
  // instead of pve16's in-game restart (which restarts the wave and makes a
  // mess of the gauntlet state).
  function restartGauntlet() {
    if (!state) return;
    setFlags(false);
    cancelAnimationFrame(state.raf);
    if (window._hardStopGame) window._hardStopGame();
    if (window.hideDeathOverlay) window.hideDeathOverlay();
    if (window.HollowBoss && window.HollowBoss.hideShieldWarn) window.HollowBoss.hideShieldWarn();
    if (window.VoidBoss && window.VoidBoss.hideShieldWarn) window.VoidBoss.hideShieldWarn();
    window._GAUNTLET_INTRO = false;
    window._HOLLOW_METAMORPHOSIS_ACTIVE = false;
    if (window.HollowMetamorphosis) window.HollowMetamorphosis.done();
    const gs = window.__dbg && window.__dbg.state; if (gs) gs.phase = 'combat';
    const go = document.getElementById('overlayGlyphs'); if (go) go.style.display = 'none';
    hideHUD(); stopSky();
    document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
    injectHUD();
    const ret = document.getElementById('hollowDoorReturn');
    if (ret) {
      const h = ret.querySelector('h2'); if (h) h.textContent = 'Return to the Doorway';
      const sub = document.getElementById('hdSub'); if (sub) sub.textContent = 'The gauntlet resets. Step back through when you are ready to face the Wardens again.';
      ret.style.display = 'grid';
    }
    state = null;
  }

  window.HollowGauntlet = { start, isActive, end: function () { returnToDoorway(false); }, restart: restartGauntlet,
    finishEnding: function () {
      setFlags(false);
      if (window._hardStopGame) window._hardStopGame();
      if (window.HollowMetamorphosis) window.HollowMetamorphosis.done();
      hideHUD(); stopSky();
      document.querySelectorAll('.overlay').forEach(function (o) { o.style.display = 'none'; });
      if (window.Story && Story.showHub) Story.showHub();
    } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireReturn);
  else wireReturn();
})();
