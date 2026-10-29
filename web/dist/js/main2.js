// main2.js
// Boots Monster Arena with REAL asset loading progress
// Supports PvE, PvP, offline
// Requires overlayBoot + progress bar in HTML

(() => {
  let MAIN_MODE = "single";   // single / offline / multi
  let GAME_TYPE = "pve";      // pve / pvp

  window.BOTS_ENABLED = false;
  window.PVP_MODE = false;
  // --------------------------------------------------
  // Boot UI elements
  // --------------------------------------------------
  const bootText = document.getElementById('bootText');
  const bootFill = document.getElementById('bootProgressFill');

  let ASSETS_TOTAL = 0;
  let ASSETS_LOADED = 0;

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  window.setMainMode = function(mode){

    MAIN_MODE = mode;
    window.MENU_CONTEXT = mode;

    if (mode === "single"){
      GAME_TYPE = "pve";
      showOverlay('overlaySingle');
      moveLevelsToSingle();
    }

    else if (mode === "offline"){
      showOverlay('overlayOffline');
    }

    else if (mode === "multi"){
      showOverlay('overlayHome');
    }
  }


  window.setOfflineMode = function(type){
    GAME_TYPE = type;
  }

  function updateProgress(label) {
    ASSETS_LOADED++;
    const pct = Math.round((ASSETS_LOADED / ASSETS_TOTAL) * 100);
    if (bootFill) bootFill.style.width = pct + '%';
    if (bootText) bootText.textContent = label;
  }

  function track(promise, label) {
    ASSETS_TOTAL++;
    return promise.then(() => updateProgress(label));
  }

  // --------------------------------------------------
  // URL params / settings
  // --------------------------------------------------
  const params = new URLSearchParams(location.search);
  const mode = 'menu'; // mode is chosen later by UI

  const nickname =
    params.get('nickname') ||
    localStorage.getItem('arenaNick') ||
    'Player';

  const offline =
    params.get('offline') === '1' ||
    params.get('offline') === 'true';

  const signalingUrl =
    params.get('signal') ||
    window.SIGNAL_URL ||
    undefined;

  localStorage.setItem('arenaNick', nickname);

  const BASE = 'js/';

  // --------------------------------------------------
  // Script loader (ordered, safe)
  // --------------------------------------------------
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const already = Array.from(document.scripts)
        .some(s => (s.src || '').includes(src));
      if (already) return resolve();

      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  // --------------------------------------------------
  // Load ALL assets with REAL progress
  // --------------------------------------------------
  async function loadAssets() {
    const A = window.__ASSETS__;
    if (!A || !A.loadImages || !A.loadGunImages || !A.loadMelee) {
      throw new Error('Asset loaders not registered');
    }

    // Don't block boot on any sprites. The intro menu needs none, and the
    // assets are large (~51 MB; some PNGs ~1 MB+). They stream in the
    // background and render the moment they arrive (3D meshes build lazily
    // per frame, 2D redraws each frame), so any fallback self-corrects.
    track(A.loadImages(), 'Loading monsters…');
    track(A.loadGunImages(), 'Loading weapons…');
    track(A.loadMelee(), 'Loading melee gear…');
    track(A.loadGlyphImages ? A.loadGlyphImages() : Promise.resolve(), 'Loading glyphs…');
  }

  // --------------------------------------------------
  // Boot sequence
  // --------------------------------------------------
  async function boot() {
    try {
      if (bootText) bootText.textContent = 'Initializing…';

      // 1) Networking layer
      if (!offline && !window.Net) {
        if (bootText) bootText.textContent = 'Connecting network…';
        await loadScript(BASE + 'network_http.js');
        if (signalingUrl) Net.setSignalUrl(signalingUrl);
        Net.setNickname(nickname);
      }

      // 2) Load game code
      if (bootText) bootText.textContent = 'Preparing arena…';

      // 3) REAL asset loading — gate game:ready on sprites so monsters are
      // ready before the menu opens. Without this the 3D renderer hits
      // unloaded sprites and falls back to procedural models.
      if (bootFill) bootFill.style.width = '40%';
      // Kick off all sprite loading in the background — do NOT await. Boot
      // clears immediately so the menu shows at once; sprites stream in and
      // appear the moment each arrives (no cap that aborts the load).
      loadAssets();

      // 4) Finish
      if (bootText) bootText.textContent = 'Ready!';
      if (bootFill) bootFill.style.width = '100%';

      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('game:ready'));
      });

    } catch (err) {
      console.error(err);
      if (bootText) bootText.textContent = 'Failed to load';
    }
}

  // --------------------------------------------------
  // Start when DOM is ready
  // --------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();