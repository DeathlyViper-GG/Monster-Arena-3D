// ============================================================
// Monster Arena — GAME MUSIC (loading countdown + combat tracks)
//
// Three real audio files drive the in-game soundtrack:
//   • loading.mp4 (short) — plays during the "Preparing match"
//     countdown, from the moment it starts until the player is put
//     into the game.
//   • combat.mp4 (long, looped) — plays during regular (non-story)
//     fights, but NOT during the glyph upgrade screen or cutscenes.
//   • story combat track (looped) — plays during actual story-mode
//     fights only, NOT during cutscenes or the glyph upgrade screen.
//
// The menu music (menu_music.js) still owns the title/menu hubs.
// pve16's audio.startMusic()/stopMusic() now delegate here, so all
// the existing call sites keep working. Respects the Music setting
// (localStorage 'music'). Exposes window.GameMusic.
// ============================================================
(function () {
  'use strict';

  const LOADING_SRC = 'audio/loading.mp4';
  const COMBAT_SRC = 'audio/combat.mp4';
  // combat.mp4 begins with ~1s of silence — skip it so the track kicks in
  // right away, and restart from this offset every time a new match starts.
  const COMBAT_LEAD_IN = 1.0;
  // Story-mode combat uses a separate custom track (no lead-in silence).
  const STORY_COMBAT_SRC = 'https://media.base44.com/videos/public/6ad27d6995813fb4230b1b65/b09a17008_2026-10-2413-34-46.mp4';
  const STORY_COMBAT_LEAD_IN = 0;
  const COMBAT_VOL = 0.45;
  const STORY_COMBAT_VOL = 0.45;
  const COMBAT_FADE_MS = 1200;

  const LOADING_ID = 'overlayLoading';

  let loadingEl = null, combatEl = null, storyCombatEl = null;
  let loadingWant = false, combatWant = false;
  let combatPlaying = false;
  let pausedWithinMatch = false;
  let combatRaf = null;

  function musicOn() {
    try { return localStorage.getItem('music') !== '0'; } catch (_) { return true; }
  }

  // Returns true when a story-mode realm fight is the active match.
  function storyActive() { return !!(window.STORY_ACTIVE && !window.HOLLOW_GAUNTLET_ACTIVE); }

  function makeLoopEl(src, leadIn, vol) {
    const el = document.createElement('audio');
    el.src = src;
    el.loop = true;
    el.preload = 'auto';
    el.volume = vol;
    el.style.display = 'none';
    el.addEventListener('ended', function () {
      if (combatWant && musicOn()) { try { el.currentTime = leadIn; } catch (_) {} const p = el.play(); if (p && p.catch) p.catch(function () {}); }
    });
    if (leadIn > 0) {
      el.addEventListener('timeupdate', function () {
        if (!el.paused && el.currentTime > 0.05 && el.currentTime < leadIn) {
          try { el.currentTime = leadIn; } catch (_) {}
        }
      });
    }
    document.body.appendChild(el);
    return el;
  }

  function ensure() {
    if (!loadingEl) {
      loadingEl = document.createElement('audio');
      loadingEl.src = LOADING_SRC;
      loadingEl.loop = true;
      loadingEl.preload = 'auto';
      loadingEl.volume = 0.5;
      loadingEl.style.display = 'none';
      document.body.appendChild(loadingEl);
    }
    if (!combatEl) combatEl = makeLoopEl(COMBAT_SRC, COMBAT_LEAD_IN, 0.45);
    if (!storyCombatEl) storyCombatEl = makeLoopEl(STORY_COMBAT_SRC, STORY_COMBAT_LEAD_IN, 0.45);
  }

  function playSafe(el, reset) {
    if (reset) { try { el.currentTime = 0; } catch (_) {} }
    if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function pauseSafe(el) { if (!el.paused) { try { el.pause(); } catch (_) {} } }
  // Volume ramp used to fade combat music back in after a glyph screen / cutscene.
  function fadeTo(el, toVol, ms) {
    if (combatRaf) cancelAnimationFrame(combatRaf);
    const start = el.volume;
    const t0 = performance.now();
    const step = function () {
      const t = Math.min(1, (performance.now() - t0) / ms);
      el.volume = start + (toVol - start) * t;
      if (t < 1) combatRaf = requestAnimationFrame(step); else combatRaf = null;
    };
    step();
  }

  function apply() {
    ensure();
    const on = musicOn();
    const matchRunning = typeof window.__pveMatchRunning === 'function' && window.__pveMatchRunning();
    // Loading countdown takes priority over combat.
    if (loadingWant && on) {
      pauseSafe(combatEl);
      pauseSafe(storyCombatEl);
      playSafe(loadingEl, true);
      combatPlaying = false;
    } else {
      pauseSafe(loadingEl);
      if (combatWant && on && !window._CUTSCENE_ACTIVE) {
        const useStory = storyActive();
        const active = useStory ? storyCombatEl : combatEl;
        const other = useStory ? combatEl : storyCombatEl;
        const vol = useStory ? STORY_COMBAT_VOL : COMBAT_VOL;
        pauseSafe(other);
        if (!combatPlaying) {
          if (pausedWithinMatch && matchRunning) {
            // Resuming after a glyph upgrade screen / cutscene within the
            // same match: keep the playback position and fade back in —
            // do not restart the track from the beginning.
            active.volume = 0;
            fadeTo(active, vol, COMBAT_FADE_MS);
          } else {
            // Fresh match: start the track from the top (past any lead-in).
            try { active.currentTime = useStory ? STORY_COMBAT_LEAD_IN : COMBAT_LEAD_IN; } catch (_) {}
            active.volume = vol;
          }
          combatPlaying = true;
          pausedWithinMatch = false;
        }
        playSafe(active, false);
      } else {
        if (combatPlaying) {
          // Paused mid-match (glyph screen / cutscene): remember so the next
          // resume continues from the same position. Match over = fresh start.
          pausedWithinMatch = !!matchRunning;
        }
        pauseSafe(combatEl);
        pauseSafe(storyCombatEl);
        combatPlaying = false;
      }
    }
  }

  // ---- public controls (called by pve16 + the loading observer) ----
  function startLoading() { loadingWant = true; apply(); }
  function stopLoading() { loadingWant = false; apply(); }
  function setCombat(on) { combatWant = !!on; apply(); }

  // ---- loading countdown: follow the Preparing-match overlay ----
  function isLoadingShown() {
    const e = document.getElementById(LOADING_ID);
    return !!(e && e.style.display === 'grid');
  }
  function syncLoading() { if (isLoadingShown()) startLoading(); else stopLoading(); }

  function observeLoading() {
    const t = document.getElementById(LOADING_ID);
    if (t) {
      new MutationObserver(syncLoading).observe(t, { attributes: true, attributeFilter: ['style'] });
    } else {
      // overlay not in the DOM yet — retry shortly
      setTimeout(observeLoading, 200);
    }
    syncLoading();
  }

  // ---- combat track: follow live game state via pve16's helper ----
  // pve16 exposes window.__pveCombatMusic() === true when a match is
  // running and not on the glyph screen or in a cutscene.
  function syncCombat() {
    if (typeof window.__pveCombatMusic === 'function') {
      setCombat(window.__pveCombatMusic());
    }
  }
  setInterval(syncCombat, 200);

  // ---- music setting toggle ----
  function wireSettings() {
    const sel = document.getElementById('selMusic');
    if (sel) sel.addEventListener('change', apply);
    const close = document.getElementById('closeSettings');
    if (close) close.addEventListener('click', function () { setTimeout(apply, 50); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { observeLoading(); wireSettings(); });
  else { observeLoading(); wireSettings(); }

  // ---- autoplay unlock ----
  const unlock = function () {
    ensure();
    apply();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  window.GameMusic = { startLoading, stopLoading, setCombat, syncLoading, syncCombat };
})();
