// ============================================================
// Monster Arena — Shop gun preview (real 3D, three.js WebGL)
// Each shop card mounts a small PBR three.js scene showing the weapon
// as a detailed, lit, turning 3D model: cylindrical barrels, scopes,
// drum mags, metallic gunmetal with environment reflections, soft
// contact shadow. Falls back to a styled 2D glyph if three.js failed
// to load. Exposes window.ShopGunPreview.mount(canvas, kind) -> {dispose}.
// ============================================================
(function () {
  'use strict';

  // ---- palette / materials ---------------------------------------------
  // Matches the in-game gun art (render3d_fx.js fallbackGun): gunmetal
  // metal, dark polymer, steel sights and a cyan glow accent — blocky
  // primitives, no per-kind colors.
  function hex(c) { return parseInt(c.replace('#', ''), 16); }

  function mats() {
    const std = (color, metal, rough) => new THREE.MeshStandardMaterial({ color: hex(color), metalness: metal, roughness: rough });
    const polymer = std('#1f2630', 0.35, 0.6);
    return {
      metal: std('#2e3348', 0.70, 0.30),
      metalD: std('#262b3a', 0.60, 0.40),
      steel: std('#aab4c0', 0.90, 0.20),
      black: std('#10151b', 0.35, 0.55),
      polymer: polymer,
      wood: polymer,                 // in-game has no wood — crossbow reads as polymer
      accentOf: () => new THREE.MeshStandardMaterial({ color: 0x4de6ff, emissive: 0x4de6ff, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.35 })
    };
  }

  // ---- geometry helpers (gun local frame: +X forward, +Y up, +Z side) --
  function box(g, x, y, z, sx, sy, sz, m, rx, ry, rz) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2), m);
    mesh.position.set(x, y, z); if (rx || ry || rz) mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  }
  function cyl(g, x, y, z, len, r, m, axis) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 28, 1), m);
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); return mesh;
  }
  // tapered cylinder (muzzle brake / suppressor)
  function cone(g, x, y, z, len, r1, r2, m, axis) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 28, 1), m);
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true; g.add(mesh); return mesh;
  }
  function torus(g, x, y, z, r, tube, m, axis) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 28), m);
    mesh.position.set(x, y, z);
    if (axis === 'y') mesh.rotation.x = Math.PI / 2;
    else if (axis === 'z') mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true; g.add(mesh); return mesh;
  }

  // ---- gun definitions --------------------------------------------------
  function buildGun(kind) {
    const g = new THREE.Group();
    const M = mats();
    const A = M.accentOf();
    const gripRake = -0.14;
    switch (kind) {
      case 'smg':
        box(g, 0.35, -1.15, 0, 0.55, 1.35, 0.78, M.polymer, 0, 0, gripRake);     // grip
        box(g, 0.25, 0.12, 0, 1.7, 0.92, 0.82, M.metal);                        // receiver
        cyl(g, 1.75, 0.30, 0, 1.7, 0.30, M.metal, 'x');                         // barrel
        cone(g, 2.7, 0.30, 0, 0.5, 0.42, 0.34, M.metalD, 'x');                   // muzzle brake
        box(g, 0.05, -1.55, 0, 0.6, 1.45, 0.62, M.polymer, 0, 0, gripRake * 0.4); // mag
        box(g, -1.55, 0.05, 0, 0.7, 0.86, 0.62, M.polymer);                      // stock
        box(g, 2.15, 0.92, 0, 0.14, 0.34, 0.18, M.steel);                       // front sight
        box(g, 0.7, 0.92, 0, 0.16, 0.28, 0.42, M.steel);                         // rear sight
        torus(g, 0.95, -0.55, 0, 0.32, 0.07, M.metalD, 'y');                    // trigger guard
        box(g, 0.55, 0.58, 0, 1.15, 0.1, 0.32, A);                              // accent rail
        break;
      case 'burst':
        box(g, 0.4, -1.2, 0, 0.58, 1.4, 0.86, M.polymer, 0, 0, gripRake);        // grip
        box(g, 0.5, 0.18, 0, 2.5, 0.98, 0.86, M.metal);                        // receiver
        cyl(g, 2.0, 0.35, 0, 2.6, 0.40, M.metal, 'x');                         // barrel
        cone(g, 3.4, 0.35, 0, 0.6, 0.50, 0.40, M.metalD, 'x');                 // muzzle device
        box(g, 1.9, -0.05, 0, 2.2, 0.74, 0.74, M.polymer);                      // handguard
        box(g, 0.45, -1.7, 0, 0.7, 1.5, 0.66, M.polymer, 0, 0, gripRake * 0.5); // mag
        box(g, -1.85, -0.1, 0, 1.4, 1.0, 0.78, M.polymer);                     // stock
        torus(g, 1.0, -0.6, 0, 0.34, 0.07, M.metalD, 'y');                     // trigger guard
        cyl(g, 0.7, 1.35, 0, 1.9, 0.42, M.steel, 'x');                         // scope tube
        cyl(g, 1.78, 1.35, 0, 0.14, 0.46, A, 'x');                             // lens
        box(g, 0.7, 0.92, 0, 0.5, 0.1, 0.5, M.metalD);                         // scope mount
        box(g, 2.5, 0.6, 0, 0.9, 0.08, 0.3, A);                                // accent rail
        break;
      case 'marksman':
        box(g, 0.3, -1.2, 0, 0.58, 1.4, 0.82, M.polymer, 0, 0, gripRake);         // grip
        box(g, 0.7, 0.2, 0, 2.9, 0.95, 0.8, M.metal);                          // receiver
        cyl(g, 2.7, 0.28, 0, 3.6, 0.34, M.metal, 'x');                         // long barrel
        cone(g, 4.6, 0.28, 0, 0.6, 0.56, 0.34, M.metalD, 'x');                 // muzzle brake
        box(g, 0.0, -1.55, 0, 0.66, 1.2, 0.56, M.polymer, 0, 0, gripRake * 0.4); // mag
        box(g, -2.4, -0.05, 0, 1.9, 1.05, 0.74, M.polymer);                    // stock
        torus(g, 0.85, -0.6, 0, 0.34, 0.07, M.metalD, 'y');                    // trigger guard
        cyl(g, 0.9, 1.45, 0, 2.4, 0.46, M.steel, 'x');                         // scope
        cyl(g, 2.2, 1.45, 0, 0.12, 0.50, A, 'x');                             // lens glow
        box(g, 0.9, 0.95, 0, 0.55, 0.1, 0.5, M.metalD);                        // mount
        box(g, 4.0, 0.8, 0, 0.16, 0.42, 0.22, M.steel);                       // front sight tower
        break;
      case 'crossbow':
        box(g, -1.9, -0.05, 0, 2.1, 0.92, 0.74, M.wood);                       // stock
        box(g, 0.6, 0.5, 0, 2.7, 0.38, 0.46, M.metal);                        // rail
        box(g, 2.3, 0.5, 1.35, 0.3, 0.28, 1.8, M.polymer);                    // limb +z
        box(g, 2.3, 0.5, -1.35, 0.3, 0.28, 1.8, M.polymer);                   // limb -z
        box(g, 2.3, 0.9, 0, 0.22, 1.8, 0.1, M.steel);                         // string
        box(g, 0.4, -1.25, 0, 0.58, 1.3, 0.78, M.polymer, 0, 0, gripRake);     // grip
        cyl(g, 2.3, 0.5, 0, 0.6, 0.4, M.steel, 'x');                          // bolt head
        box(g, 1.1, 0.5, 0, 0.55, 0.28, 0.5, A);                              // gold riser
        box(g, -1.6, -0.95, 0, 0.5, 0.28, 0.68, M.polymer);                   // foregrip
        break;
      case 'lmg':
        box(g, 0.35, -1.2, 0, 0.6, 1.45, 0.9, M.polymer, 0, 0, gripRake);       // grip
        box(g, 0.9, 0.25, 0, 3.0, 1.18, 0.92, M.metal);                       // receiver
        cyl(g, 2.7, 0.35, 0, 2.9, 0.5, M.metal, 'x');                         // barrel
        cone(g, 4.25, 0.35, 0, 0.55, 0.62, 0.5, M.metalD, 'x');               // muzzle
        box(g, 2.4, -0.1, 0, 2.0, 0.86, 0.86, M.polymer);                      // handguard
        cyl(g, 0.7, -1.85, 0, 0.8, 1.18, M.polymer, 'z');                      // drum mag (disc)
        cyl(g, 0.7, -1.85, 0, 0.3, 0.7, M.metalD, 'z');                       // drum hub
        box(g, -2.0, 0.0, 0, 1.7, 1.0, 0.8, M.polymer);                        // stock
        box(g, 3.9, 0.95, 0, 0.16, 0.4, 0.22, M.steel);                       // front sight
        torus(g, 0.95, -0.65, 0, 0.36, 0.08, M.metalD, 'y');                  // trigger guard
        box(g, 2.0, 0.55, 0, 1.1, 0.1, 0.34, A);                              // accent rail
        break;
      case 'flamethrower':
        box(g, 0.3, -1.2, 0, 0.6, 1.4, 0.9, M.polymer, 0, 0, gripRake);        // grip
        box(g, 0.7, 0.35, 0, 2.3, 1.15, 1.05, M.metal);                       // body
        cyl(g, 0.8, 1.05, 0, 2.7, 0.66, M.steel, 'x');                        // fuel tank
        cyl(g, 0.8, -0.55, 0, 2.3, 0.5, M.metalD, 'x');                       // lower tank
        cyl(g, 2.55, 0.3, 0, 1.3, 0.48, M.metal, 'x');                         // nozzle
        cone(g, 3.3, 0.3, 0, 0.4, 0.34, 0.5, M.metalD, 'x');                  // nozzle tip
        cyl(g, 3.6, 0.3, 0, 0.3, 0.16, A, 'x');                               // pilot light
        box(g, 0.6, -1.5, 0, 0.66, 1.1, 0.66, M.polymer);                     // tank grip
        torus(g, 0.9, -0.6, 0, 0.34, 0.07, M.metalD, 'y');                    // trigger guard
        box(g, 0.7, 0.6, 0, 0.9, 0.1, 0.34, A);                              // accent
        break;
      default:
        box(g, 0, 0, 0, 3, 0.9, 0.8, M.metal);
    }
    return g;
  }

  // ---- environment (for metallic reflections) --------------------------
  function makeEnv(renderer) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#9ec0ff'); grd.addColorStop(0.5, '#2a3548'); grd.addColorStop(1, '#15191f');
    x.fillStyle = grd; x.fillRect(0, 0, 256, 128);
    x.fillStyle = 'rgba(255,242,214,0.9)'; x.beginPath(); x.ellipse(180, 36, 34, 20, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(180,210,255,0.5)'; x.beginPath(); x.ellipse(70, 60, 28, 16, 0, 0, Math.PI * 2); x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose(); pmrem.dispose();
    return rt.texture;
  }

  // ---- shared renderer for static snapshots -----------------------------
  // All static preview snapshots reuse ONE offscreen three.js renderer for the
  // whole session. Previously every shop/customize card spun up its own
  // WebGLRenderer (a fresh WebGL context) just to render one frame, then
  // disposed it — opening the Shop or Customize Guns tab burned 6+ contexts in
  // a burst, which breached the browser's ~16 active-context limit and made
  // it evict the main game's context ("Too many active WebGL contexts" /
  // "Context Lost"). Reusing a single renderer keeps us at 1 context no matter
  // how many cards mount.
  let shared = null;
  function getShared() {
    if (shared) return shared;
    try {
      const c = document.createElement('canvas');
      const renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      const env = makeEnv(renderer);
      shared = { renderer: renderer, canvas: c, env: env };
    } catch (e) { shared = null; }
    return shared;
  }

  // ---- scene builder (shared by static + live previews) ----------------
  // Builds the lit gun scene onto a given renderer. Caller disposes the
  // scene geometry (disposeScene) but NOT the renderer when reusing the shared
  // one; createScene() below owns its own renderer for the live hover card.
  function buildScene(renderer, kind, env, resizeCanvas) {
    const scene = new THREE.Scene();
    scene.environment = env;

    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    cam.position.set(0, 0.5, 9.2);
    cam.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x14181f, 0.55); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(5, 7, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.6); rim.position.set(-6, 3, -5); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe6c0, 0.25); fill.position.set(-4, -2, 5); scene.add(fill);

    const gun = buildGun(kind);
    scene.add(gun);

    const box3 = new THREE.Box3().setFromObject(gun);
    const size = box3.getSize(new THREE.Vector3());
    const center = box3.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.6 / maxDim;
    gun.scale.setScalar(scale);
    gun.position.sub(center.multiplyScalar(scale));

    const bottom = (box3.min.y - center.y) * scale;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.38 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = bottom - 0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    gun.rotation.y = -0.5;
    gun.rotation.x = 0.06;

    function resize() {
      const r = resizeCanvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      renderer.setSize(w, h, false);
      cam.aspect = w / h; cam.updateProjectionMatrix();
    }

    // Dispose only the scene's GPU resources (geometry/materials). The renderer
    // and env stay alive — the shared one is reused by every other card.
    function disposeScene() {
      scene.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach(function (m) { m.dispose(); }); else o.material.dispose(); }
      });
    }

    return { renderer: renderer, scene: scene, cam: cam, gun: gun, resize: resize, disposeScene: disposeScene };
  }

  // Live hover card: its own renderer (one at a time, disposed on mouseleave).
  function createScene(canvas, kind) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const env = makeEnv(renderer);
    const s = buildScene(renderer, kind, env, canvas);
    function dispose() {
      renderer.setAnimationLoop(null);
      try { env.dispose(); } catch (e) {}
      s.disposeScene();
      try { renderer.dispose(); } catch (e) {}
    }
    return { renderer: renderer, scene: s.scene, cam: s.cam, gun: s.gun, resize: s.resize, dispose: dispose };
  }

  // ---- preview mount ---------------------------------------------------
  // Render one static frame per card and keep it as a background image so no
  // WebGL context stays alive while the shop is idle. Only the card under the
  // mouse spins up a live renderer (one at a time), disposed on mouseleave.
  function mount(canvas, kind) {
    if (!window.THREE) { return fallback(canvas, kind); }

    let live = null;
    let ro = null;

    function paintStatic() {
      const sh = getShared();
      if (!sh) { fallback(canvas, kind); return; }
      const s = buildScene(sh.renderer, kind, sh.env, canvas);
      s.resize();
      sh.renderer.render(s.scene, s.cam);
      try {
        // Capture from the shared offscreen canvas — the display canvas itself
        // was never given a WebGL context, so it can be reused for any card.
        const url = sh.canvas.toDataURL('image/png');
        canvas.style.backgroundImage = 'url("' + url + '")';
        canvas.style.backgroundSize = 'cover';
        canvas.style.backgroundPosition = 'center';
      } catch (e) {}
      s.disposeScene();
    }

    function startLive() {
      if (live) return;
      const s = createScene(canvas, kind);
      if (!s) return;
      live = s;
      s.resize();
      ro = new ResizeObserver(s.resize); ro.observe(canvas);
      const t0 = performance.now();
      s.renderer.setAnimationLoop(function () {
        const t = (performance.now() - t0) / 1000;
        s.gun.rotation.y = -0.5 + Math.sin(t * 0.5) * 0.55;
        s.gun.rotation.x = 0.06 + Math.sin(t * 0.35) * 0.04;
        s.renderer.render(s.scene, s.cam);
      });
    }
    function stopLive() {
      if (!live) return;
      if (ro) { ro.disconnect(); ro = null; }
      live.dispose();
      live = null;
    }

    paintStatic();
    canvas.addEventListener('mouseenter', startLive);
    canvas.addEventListener('mouseleave', stopLive);

    function dispose() {
      stopLive();
      canvas.removeEventListener('mouseenter', startLive);
      canvas.removeEventListener('mouseleave', stopLive);
    }
    return { dispose: dispose };
  }

  // ---- fallback (no three.js) -----------------------------------------
  function fallback(canvas, kind) {
    const ctx = canvas.getContext('2d');
    function paint() {
      const W = canvas.width, H = canvas.height;
      if (!ctx || W < 2) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,250,255,0.85)';
      ctx.font = 'bold ' + Math.round(H * 0.5) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔫', W / 2, H / 2);
    }
    const ro = new ResizeObserver(function () {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr)); paint();
    });
    ro.observe(canvas);
    return { dispose: function () { ro.disconnect(); } };
  }

  window.ShopGunPreview = { mount: mount };
})();
