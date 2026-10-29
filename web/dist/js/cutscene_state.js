// ============================================================
// Monster Arena — CUTSCENE STATE DETECTOR
// Maintains window._CUTSCENE_ACTIVE = true while any cinematic
// cutscene overlay is on screen, so the music engines (menu_music,
// game_music) can silence the main theme and combat track during
// cutscenes. Detection is DOM-based: a cutscene is any visible,
// full-screen, position:fixed overlay with z-index in [58, 1000].
// That range covers every cinematic container (z-index 60–70) while
// excluding the menu hubs (.overlay z-index 5), the story choice
// panels (z-index 50–55), the boot screen / net-status dot
// (z-index 9998/9999), and the HUD/canvases (z-index < 10). No
// cutscene file needs editing — any new cinematic at z-index 58–
// 1000 is detected automatically. Exposes window.CutsceneState.
// ============================================================
(function () {
  'use strict';
  window._CUTSCENE_ACTIVE = false;

  function isCutsceneEl(el) {
    if (!el || el.nodeType !== 1) return false;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return false;
    const z = parseInt(cs.zIndex, 10);
    if (isNaN(z) || z < 58 || z > 1000) return false;
    const r = el.getBoundingClientRect();
    return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
  }

  function recompute() {
    const kids = document.body.children;
    for (let i = 0; i < kids.length; i++) {
      if (isCutsceneEl(kids[i])) { window._CUTSCENE_ACTIVE = true; return; }
    }
    window._CUTSCENE_ACTIVE = false;
  }

  // Recompute when overlays are added/removed (all cinematics append to body).
  if (typeof MutationObserver !== 'undefined') {
    const start = () => {
      new MutationObserver(recompute).observe(document.body, { childList: true });
      recompute();
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  }
  // Safety poll catches display style toggles the observer may race on.
  setInterval(recompute, 250);

  window.CutsceneState = { active: function () { return window._CUTSCENE_ACTIVE; }, recompute: recompute };
})();
