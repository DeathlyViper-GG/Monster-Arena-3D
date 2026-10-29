// ============================================================
// Monster Arena — CUTSCENE MUSIC
// Plays the dedicated cutscene track during cinematics. Fades in
// when a cutscene begins, loops (so longer cutscenes repeat it),
// keeps playing across back-to-back cutscenes (a short grace
// period prevents a stop/fade between two consecutive scenes), and
// fades out when no cutscene follows. Triggered by the shared
// window._CUTSCENE_ACTIVE flag (set by cutscene_state.js for iframe
// overlays) and window._EXTERNAL_CUTSCENE (the React Hearth Warden
// intro). Respects the Music setting. Exposes window.CutsceneMusic.
// ============================================================
(function () {
  'use strict';

  const SRC = 'https://media.base44.com/videos/public/6ad27d6995813fb4230b1b65/c287bfedd_2026-10-2418-02-01.mp4';
  const TARGET_VOL = 0.4;
  const FADE_MS = 1500;
  const GAP_GRACE_MS = 800; // continue playing if another cutscene starts within this window

  let el = null, raf = null, fadeTimer = null, active = false;

  function musicOn() { try { return localStorage.getItem('music') !== '0'; } catch (_) { return true; } }
  function isActive() { return !!(window._CUTSCENE_ACTIVE || window._EXTERNAL_CUTSCENE); }

  function ensure() {
    if (el) return el;
    el = document.createElement('audio');
    el.src = SRC;
    el.loop = true; // repeat for cutscenes longer than the track
    el.preload = 'auto';
    el.volume = 0;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  function stopRaf() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function clearFade() { if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; } }

  function ramp(toVol, ms, done) {
    stopRaf();
    const a = ensure();
    const start = a.volume;
    if (Math.abs(toVol - start) < 0.001) { if (done) done(); return; }
    const t0 = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - t0) / ms);
      a.volume = start + (toVol - start) * t;
      if (t < 1) raf = requestAnimationFrame(step);
      else { raf = null; if (done) done(); }
    };
    step();
  }

  function fadeIn() {
    clearFade();
    const a = ensure();
    if (a.paused) {
      try { a.currentTime = 0; } catch (_) {}
      const p = a.play(); if (p && p.catch) p.catch(function () {});
    }
    ramp(TARGET_VOL, FADE_MS);
  }

  function fadeOut() {
    ramp(0, FADE_MS, function () { if (el && !el.paused) { try { el.pause(); } catch (_) {} } });
  }

  function recompute() {
    const want = musicOn() && isActive();
    if (want) {
      if (!active) {
        // entering (or re-entering during the grace window) — keep/continue
        active = true;
        fadeIn();
      } else if (fadeTimer) {
        // already active; a stray fade was pending — cancel it
        clearFade();
        ramp(TARGET_VOL, 300);
      }
    } else if (active) {
      active = false;
      clearFade();
      // grace: if another cutscene starts shortly, the music keeps going
      fadeTimer = setTimeout(fadeOut, GAP_GRACE_MS);
    }
  }

  setInterval(recompute, 200);

  function wireSettings() {
    const sel = document.getElementById('selMusic');
    if (sel) sel.addEventListener('change', recompute);
    const close = document.getElementById('closeSettings');
    if (close) close.addEventListener('click', function () { setTimeout(recompute, 50); });
  }

  const unlock = function () { recompute(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireSettings);
  else wireSettings();

  window.CutsceneMusic = { recompute };
})();
