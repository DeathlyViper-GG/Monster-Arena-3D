/* =====================================================================
   abyss_bg.js — Ethereal Abyss background for the singleplayer level
   select screen (#overlaySingle). Layers (back→front):
     plate → haze → three.js arcane rings+embers → vignette → grain →
     cursed ambience (veil + heroic aura + particles)
   Plus an ornamental rune divider inserted between the level cards and
   the footer text to fill that band. The level cards themselves are
   untouched. The three.js scene mounts lazily on first show and pauses
   when the overlay/tab is hidden so it stays cheap on a menu screen.
   ===================================================================== */
(function () {
  'use strict';

  var ABYSS_PLATE = 'https://media.base44.com/images/public/6adf8398193f67df67797a91/65c285c59_generated_94bbef03.png';

  /* ---------------- particle fields (deterministic) ---------------- */
  function makeParticleField(count, seed) {
    var arr = [];
    for (var i = 0; i < count; i++) {
      arr.push({
        left: ((i * 61 + seed * 7) % 1000) / 10,
        top: ((i * 37 + seed * 11) % 1000) / 10,
        size: 2 + (((i * 47 + seed) % 100) / 100) * 5.5,
        delay: (((i * 29 + seed * 5) % 100) / 100) * 8,
        duration: 5 + (((i * 17 + seed) % 100) / 100) * 8,
        drift: (((i * 41 + seed) % 15) - 7) * 14
      });
    }
    return arr;
  }
  var PARTICLE_FIELDS = {
    ember: makeParticleField(72, 3),
    wisp: makeParticleField(26, 13),
    drip: makeParticleField(20, 29),
    spark: makeParticleField(16, 41)
  };

  function buildCursedAmbience(host) {
    var amb = document.createElement('div');
    amb.className = 'cursed-ambience';
    var veil = document.createElement('div'); veil.className = 'cursed-veil'; amb.appendChild(veil);
    var aura = document.createElement('div'); aura.className = 'heroic-aura'; amb.appendChild(aura);
    ['ember', 'wisp', 'drip', 'spark'].forEach(function (kind) {
      PARTICLE_FIELDS[kind].forEach(function (p) {
        var s = document.createElement('span');
        s.className = 'cursed-particle cursed-' + kind;
        s.style.left = p.left + '%';
        s.style.top = p.top + '%';
        s.style.width = p.size + 'px';
        s.style.height = p.size + 'px';
        s.style.animationDelay = p.delay + 's';
        s.style.animationDuration = p.duration + 's';
        s.style.setProperty('--drift', p.drift + 'px');
        amb.appendChild(s);
      });
    });
    host.appendChild(amb);
  }

  /* ---------------- three.js arcane rings + embers ---------------- */
  var RINGS = [
    { z: -7.5, size: 30, spin: 0.05, opacity: 0.2, color: 0x3fd8ff },
    { z: -5.5, size: 18, spin: 0.11, opacity: 0.4, color: 0x7ef9ff },
    { z: -3.2, size: 11.5, spin: -0.17, opacity: 0.3, color: 0xa78bfa }
  ];

  function radialTexture(stops) {
    var size = 160;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    var g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    var t = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function runeTexture() {
    var size = 512;
    var canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    var c = size / 2;
    ctx.strokeStyle = '#9ff9ff';
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 1.5;
    [0.97, 0.88, 0.72, 0.46].forEach(function (ratio, i) {
      ctx.globalAlpha = i % 2 === 0 ? 0.55 : 0.3;
      ctx.beginPath(); ctx.arc(c, c, c * ratio, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.globalAlpha = 0.5;
    for (var i = 0; i < 54; i++) {
      var a = (i / 54) * Math.PI * 2;
      var inner = c * (i % 3 === 0 ? 0.72 : 0.8);
      var outer = c * 0.88;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner);
      ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    for (var j = 0; j < 12; j++) {
      var ang = (j / 12) * Math.PI * 2;
      var rad = c * 0.81;
      ctx.save();
      ctx.translate(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(6, 3);
      ctx.moveTo(-6, 4); ctx.lineTo(7, -7);
      ctx.moveTo(0, -13); ctx.lineTo(0, 10);
      ctx.stroke();
      ctx.restore();
    }
    var t = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  function initWebGL(host) {
    if (!window.THREE) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    var W = function () { return Math.max(host.clientWidth, 1); };
    var H = function () { return Math.max(host.clientHeight, 1); };
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    host.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(58, W() / H(), 0.1, 120);
    camera.position.set(0, 0, 13);

    var disposables = [];

    var portalTexture = radialTexture([
      [0, 'rgba(150,100,255,0.6)'],
      [0.35, 'rgba(60,30,120,0.32)'],
      [1, 'rgba(0,0,0,0)']
    ]);
    var portalGeo = new THREE.PlaneGeometry(64, 40);
    var portalMat = new THREE.MeshBasicMaterial({ map: portalTexture, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
    var portal = new THREE.Mesh(portalGeo, portalMat);
    portal.position.set(0, 0, -11); scene.add(portal);
    disposables.push(portalTexture, portalGeo, portalMat);

    var ringTex = runeTexture(); disposables.push(ringTex);
    var rings = RINGS.map(function (cfg) {
      var g = new THREE.PlaneGeometry(cfg.size, cfg.size);
      var m = new THREE.MeshBasicMaterial({ map: ringTex, color: cfg.color, transparent: true, opacity: cfg.opacity, depthWrite: false, blending: THREE.AdditiveBlending });
      var mesh = new THREE.Mesh(g, m);
      mesh.position.set(0, 0.4, cfg.z);
      mesh.userData = { spin: cfg.spin, opacity: cfg.opacity };
      scene.add(mesh); disposables.push(g, m);
      return mesh;
    });

    var count = reduced ? 240 : 720;
    var positions = new Float32Array(count * 3);
    var sizes = new Float32Array(count);
    var seeds = new Float32Array(count);
    var mixes = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 19;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 14;
      sizes[i] = 0.45 + Math.random() * 1.35;
      seeds[i] = Math.random();
      mixes[i] = Math.random();
    }
    var emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    emberGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    emberGeo.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1));

    var emberMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uEmber: { value: new THREE.Color(0xff9a4d) },
        uSpectral: { value: new THREE.Color(0x6ff3ff) }
      },
      vertexShader: [
        'attribute float aSize;', 'attribute float aSeed;', 'attribute float aMix;',
        'uniform float uTime;', 'uniform float uPixelRatio;',
        'varying float vAlpha;', 'varying float vMix;',
        'void main(){',
        '  vec3 p = position;',
        '  p.y += sin(uTime*(0.16+aSeed*0.22)+aSeed*12.0)*1.6;',
        '  p.x += cos(uTime*(0.11+aSeed*0.18)+position.z)*1.15;',
        '  vec4 mv = modelViewMatrix*vec4(p,1.0);',
        '  gl_PointSize = clamp(aSize*uPixelRatio*(70.0/-mv.z),1.0,32.0);',
        '  gl_Position = projectionMatrix*mv;',
        '  vAlpha = 0.14+0.5*abs(sin(uTime*(0.45+aSeed)+aSeed*20.0));',
        '  vMix = aMix;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uEmber;', 'uniform vec3 uSpectral;',
        'varying float vAlpha;', 'varying float vMix;',
        'void main(){',
        '  float dist = distance(gl_PointCoord, vec2(0.5));',
        '  float glow = smoothstep(0.5,0.0,dist);',
        '  vec3 tint = mix(uEmber,uSpectral,vMix);',
        '  gl_FragColor = vec4(tint, glow*glow*vAlpha);',
        '}'
      ].join('\n')
    });
    var embers = new THREE.Points(emberGeo, emberMat);
    scene.add(embers); disposables.push(emberGeo, emberMat);

    var pointer = { x: 0, y: 0 };
    function onPointerMove(e) { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = (e.clientY / window.innerHeight) * 2 - 1; }
    window.addEventListener('pointermove', onPointerMove);

    function resize() {
      if (!host.clientWidth) return;
      camera.aspect = W() / H(); camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W(), H());
      emberMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    }
    var ro = new ResizeObserver(resize); ro.observe(host);

    var clock = new THREE.Clock();
    var frameId = 0, running = false;
    function tick() {
      if (!running) { frameId = 0; return; }
      frameId = requestAnimationFrame(tick);
      var t = clock.getElapsedTime();
      emberMat.uniforms.uTime.value = t;
      camera.position.x += (pointer.x * 1.9 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 1.15 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      rings.forEach(function (r, i) { r.rotation.z = t * r.userData.spin; r.material.opacity = r.userData.opacity * (0.75 + 0.25 * Math.sin(t * 0.6 + i)); });
      portalMat.opacity = 0.44 + Math.sin(t * 0.35) * 0.12;
      portal.rotation.z = Math.sin(t * 0.05) * 0.06;
      embers.rotation.z = Math.sin(t * 0.03) * 0.05;
      renderer.render(scene, camera);
    }
    function start() { if (running) return; running = true; if (!frameId) tick(); }
    function stop() { running = false; if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } }

    return {
      start: start, stop: stop,
      dispose: function () {
        stop();
        window.removeEventListener('pointermove', onPointerMove);
        ro.disconnect();
        disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
        try { renderer.dispose(); } catch (e) {}
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      }
    };
  }

  /* ---------------- ornamental rune divider ---------------- */
  function ensureDivider() {
    var card = document.querySelector('#overlaySingle .card');
    if (!card || card.querySelector('.abyss-divider')) return;
    var info = card.querySelector('.single-info');
    if (!info) return;
    var d = document.createElement('div');
    d.className = 'abyss-divider';
    d.innerHTML = '<span class="ad-line"></span><span class="ad-sigil"><span class="ad-core"></span></span><span class="ad-line"></span>';
    card.insertBefore(d, info);
  }

  /* ---------------- assemble + lifecycle ---------------- */
  // Mounts the Abyss background into one overlay. The rune divider is
  // single-player-only; the rest (plate, haze, webgl rings+embers,
  // vignette, grain, cursed ambience) is shared so the Offline and
  // Singleplayer level-select screens read as the same surface.
  function mountOverlay(ov, withDivider) {
    if (!ov || ov.querySelector('.abyss-bg')) return;

    var bg = document.createElement('div');
    bg.className = 'abyss-bg';
    ov.insertBefore(bg, ov.firstChild);

    // plate (back)
    var plate = document.createElement('img');
    plate.className = 'abyss-plate';
    plate.src = ABYSS_PLATE; plate.alt = '';
    plate.onerror = function () { plate.style.display = 'none'; };
    bg.appendChild(plate);

    // haze
    var haze = document.createElement('div'); haze.className = 'abyss-haze'; bg.appendChild(haze);

    // webgl host (lazy-filled on first show)
    var webglHost = document.createElement('div'); webglHost.className = 'abyss-webgl-host'; bg.appendChild(webglHost);

    // vignette + grain
    var vig = document.createElement('div'); vig.className = 'abyss-vignette'; bg.appendChild(vig);
    var grain = document.createElement('div'); grain.className = 'abyss-grain'; bg.appendChild(grain);

    // cursed ambience (front)
    buildCursedAmbience(bg);

    if (withDivider) ensureDivider();

    var webgl = null;
    function ensureWebGL() {
      if (webgl || !window.THREE) return;
      webgl = initWebGL(webglHost);
    }
    function sync() {
      if (document.hidden || ov.style.display === 'none') { if (webgl) webgl.stop(); }
      else { ensureWebGL(); if (webgl) webgl.start(); }
    }
    document.addEventListener('visibilitychange', sync);
    new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['style'] });
    sync();
  }

  function init() {
    // Singleplayer keeps its ornamental rune divider; Offline shares
    // the same sigil + particle backdrop without the divider.
    mountOverlay(document.getElementById('overlaySingle'), true);
    mountOverlay(document.getElementById('overlayOffline'), false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('game:ready', init);
})();
