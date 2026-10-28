// ============================================================
// Monster Arena — MENU MUSIC
// Streams the title-screen track on the main menus (intro +
// Single/Multi/Offline hubs and their aux screens) and stops it
// the moment the player enters a match (overlayLoading → game),
// handing audio back to pve16's in-game procedural music. Respects
// the existing Music setting (localStorage 'music'). Exposes
// window.MenuMusic. No overlap: sets window.MENU_MUSIC_PLAYING,
// which pve16's audio.startMusic() checks before starting.
// ============================================================
(function () {
  'use strict';

  // Default: we start in the menu, so claim the audio slot before pve16's
  // loadSettings() can start its procedural music at boot.
  window.MENU_MUSIC_PLAYING = true;

  // The user-supplied track lives inside an .mp4 container; browsers play
  // its audio track fine through a plain <audio> element.
  const SRC = 'https://media.base44.com/videos/public/6ad27d6995813fb4230b1b65/b9479361c_2026-10-2321-22-26.mp4';
  // The track opens with ~2s of silence before the music actually begins.
  // Skip it so the menu theme is audible the moment you land back on a hub
  // (e.g. after dying and returning home) — and again on every loop wrap.
  const LEAD_IN = 2.0;

  // Hub overlays = "still in the menu". Showing any of these clears the
  // "entered a game" latch so music can resume after a match ends.
  const HUB_IDS = ['overlayIntro', 'overlayHome', 'overlaySingle', 'overlayOffline'];
  const LOADING_ID = 'overlayLoading';

  let el = null;
  let enteredGame = false;

  function musicOn() {
    try { return localStorage.getItem('music') !== '0'; } catch (_) { return true; }
  }

  function ensure() {
    if (el) return el;
    el = document.createElement('audio');
    el.id = 'menuMusic';
    el.src = SRC;
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0.45;
    el.style.display = 'none';
    // Skip the silent lead-in whenever playback (re)starts or loops to 0.
    el.addEventListener('timeupdate', function () {
      if (!el.paused && el.currentTime > 0.05 && el.currentTime < LEAD_IN) {
        try { el.currentTime = LEAD_IN; } catch (_) {}
      }
    });
    el.addEventListener('play', function () {
      if (el.currentTime < LEAD_IN) { try { el.currentTime = LEAD_IN; } catch (_) {} }
    });
    document.body.appendChild(el);
    return el;
  }

  function isLoading() {
    const e = document.getElementById(LOADING_ID);
    return !!(e && e.style.display === 'grid');
  }

  function recompute() {
    const a = ensure();
    const want = musicOn() && !enteredGame && !isLoading() && !window._CUTSCENE_ACTIVE && !window._EXTERNAL_CUTSCENE && !window.STORY_ACTIVE;
    if (want) {
      window.MENU_MUSIC_PLAYING = true;
      if (window.__pveStopMusic) { try { window.__pveStopMusic(); } catch (_) {} }
      if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
    } else {
      window.MENU_MUSIC_PLAYING = false;
      if (!a.paused) { try { a.pause(); } catch (_) {} }
    }
  }

  function onMutation() {
    const load = document.getElementById(LOADING_ID);
    if (load && load.style.display === 'grid') enteredGame = true;
    for (const id of HUB_IDS) {
      const e = document.getElementById(id);
      if (e && e.style.display === 'grid') { enteredGame = false; break; }
    }
    recompute();
  }

  function observe() {
    const obs = new MutationObserver(onMutation);
    const ids = HUB_IDS.concat([LOADING_ID]);
    for (const id of ids) {
      const t = document.getElementById(id);
      if (t) obs.observe(t, { attributes: true, attributeFilter: ['style'] });
    }
    // Settings: Music dropdown + Save button (defer so saveSettings writes first)
    const sel = document.getElementById('selMusic');
    if (sel) sel.addEventListener('change', recompute);
    const close = document.getElementById('closeSettings');
    if (close) close.addEventListener('click', () => setTimeout(recompute, 50));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
  // The hub/loading MutationObserver above can't see cinematic cutscene
  // overlays coming and going, so poll the shared cutscene flag too.
  setInterval(recompute, 250);

  window.addEventListener('game:ready', () => { enteredGame = false; recompute(); });

  // Autoplay unlock: some browsers block play() until a user gesture.
  const unlock = () => {
    recompute();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  window.MenuMusic = { recompute };
})();
