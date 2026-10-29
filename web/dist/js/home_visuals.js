/* =====================================================================
   home_visuals.js — Monster Arena home screen visuals (vanilla port)
   Ported from the React "Home" component. Uses the global THREE already
   loaded by game.html (js/three.min.js). All work is scoped to #overlayIntro
   and is purely decorative — no game buttons or logic are touched.
   ===================================================================== */
(function () {
  'use strict';

  var RUNES = [
    'M5 2 V22 M5 8 H15 M5 15 H12',
    'M12 2 L22 12 L12 22 L2 12 Z M12 2 V22',
    'M12 22 V4 M5 11 L12 4 L19 11',
    'M4 4 L20 20 M20 4 L4 20 M12 2 V22',
    'M12 3 V21 M6 9 H18 M6 15 H18'
  ];

  var EMBERS = [[255, 60, 40], [255, 20, 70], [255, 120, 40], [255, 0, 90]];
  var MOTES = [[34, 230, 255], [126, 244, 255], [70, 140, 255], [176, 96, 255], [205, 250, 255]];
  var HEROIC = [[255, 255, 255], [255, 240, 198], [255, 214, 120], [196, 240, 255]];

  var FEATHERS = [-80, -66, -52, -38, -24, -10];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /* ---------------- ParticleField (canvas) ---------------- */
  function initParticles(canvas, count) {
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, raf = 0, last = 0;

    function resize() {
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function make(seed) {
      var roll = Math.random();
      var hero = roll > 0.94;
      var streak = !hero && roll > 0.85;
      var ember = !hero && !streak && roll < 0.4;
      return {
        x: rand(0, w),
        y: seed ? rand(0, h) : h + rand(0, 120),
        r: hero ? rand(1.5, 2.8) : ember ? rand(0.8, 2.6) : streak ? rand(1.6, 3) : rand(1.6, 4.4),
        speed: (hero ? rand(26, 62) : ember ? rand(70, 210) : streak ? rand(320, 560) : rand(45, 130)) / 1000,
        wobble: rand(10, 46),
        sway: rand(0.5, 1.7),
        phase: rand(0, Math.PI * 2),
        twinkle: rand(0.9, 3),
        alpha: hero ? rand(0.75, 1) : ember ? rand(0.62, 1) : streak ? rand(0.6, 0.95) : rand(0.3, 0.8),
        hero: hero, streak: streak,
        rgb: hero ? pick(HEROIC) : streak ? pick(MOTES) : ember ? pick(EMBERS) : pick(MOTES)
      };
    }

    resize();
    var parts = [];
    for (var i = 0; i < count; i++) parts.push(make(true));

    function frame(now) {
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        p.y -= p.speed * dt * 1000;
        p.phase += dt * p.sway;
        if (p.y < -40) { parts[k] = make(false); continue; }
        var x = p.x + Math.sin(p.phase) * p.wobble;
        var flicker = 0.62 + 0.38 * Math.sin((now / 620) * p.twinkle + p.phase);
        var a = Math.max(0, p.alpha * flicker);
        var rgb = p.rgb;

        if (p.streak) {
          var tail = p.r * 18;
          var trail = ctx.createLinearGradient(x, p.y, x, p.y + tail);
          trail.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')');
          trail.addColorStop(0.4, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a * 0.25) + ')');
          trail.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = trail;
          ctx.lineWidth = p.r * 0.9;
          ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + tail); ctx.stroke();
        }
        if (p.hero) {
          var flare = p.r * 26;
          var armH = ctx.createLinearGradient(x - flare, p.y, x + flare, p.y);
          armH.addColorStop(0, 'rgba(0,0,0,0)');
          armH.addColorStop(0.5, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a * 0.9) + ')');
          armH.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = armH; ctx.lineWidth = p.r * 0.55;
          ctx.beginPath(); ctx.moveTo(x - flare, p.y); ctx.lineTo(x + flare, p.y); ctx.stroke();
          var armV = ctx.createLinearGradient(x, p.y - flare, x, p.y + flare);
          armV.addColorStop(0, 'rgba(0,0,0,0)');
          armV.addColorStop(0.5, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a * 0.9) + ')');
          armV.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.strokeStyle = armV; ctx.lineWidth = p.r * 0.55;
          ctx.beginPath(); ctx.moveTo(x, p.y - flare); ctx.lineTo(x, p.y + flare); ctx.stroke();
        }
        var halo = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r * 7);
        halo.addColorStop(0, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')');
        halo.addColorStop(0.35, 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (a * 0.34) + ')');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(x, p.y, p.r * 7, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.6) + ')';
        ctx.beginPath(); ctx.arc(x, p.y, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    return function () { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }

  /* ---------------- Arena3D (three.js rune rings) ---------------- */
  function initArena3D(mount) {
    if (!window.THREE) return;
    var NEON = 0x2fe8ff, ICE = 0xa8f8ff, VIOLET = 0x8a6bff, BLOOD = 0xff1f4b;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
    camera.position.set(0, 0, 9.5);

    var disposables = [];
    var group = new THREE.Group();
    scene.add(group);

    function addRing(radius, tube, color, opacity, tilt) {
      var g = new THREE.Group(); g.rotation.x = tilt; group.add(g);
      var geo = new THREE.TorusGeometry(radius, tube, 6, 260);
      var mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      disposables.push(geo, mat);
      g.add(new THREE.Mesh(geo, mat));
      return { g: g, mat: mat };
    }

    var seal = addRing(5.4, 0.015, NEON, 0.55, -1.02);
    var mid = addRing(6.02, 0.009, VIOLET, 0.45, 1.14);
    var outer = addRing(6.35, 0.008, ICE, 0.4, -0.62);
    var blood = addRing(7.0, 0.006, BLOOD, 0.3, 0.78);

    var runeMat = new THREE.MeshBasicMaterial({ color: NEON, wireframe: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    var runeGeo = new THREE.OctahedronGeometry(0.13);
    disposables.push(runeGeo, runeMat);
    var runes = [];
    for (var i = 0; i < 26; i++) {
      var a = (i / 26) * Math.PI * 2;
      var m = new THREE.Mesh(runeGeo, runeMat);
      m.position.set(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 0);
      seal.g.add(m); runes.push(m);
    }

    var coreMat = new THREE.MeshBasicMaterial({ color: ICE, wireframe: true, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
    var coreGeo = new THREE.IcosahedronGeometry(1.85, 0);
    disposables.push(coreGeo, coreMat);
    var core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    function makeDust(count, spread, color, size, opacity) {
      var pos = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        var r = spread * (0.45 + Math.random() * 0.75);
        var t = Math.random() * Math.PI * 2;
        var p = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(p) * Math.cos(t) * 1.45;
        pos[i * 3 + 1] = r * Math.cos(p) * 0.7;
        pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      var mt = new THREE.PointsMaterial({ color: color, size: size, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
      disposables.push(g, mt);
      var pts = new THREE.Points(g, mt); group.add(pts); return pts;
    }
    var dustBlue = makeDust(800, 7.4, NEON, 0.07, 0.95);
    var dustViolet = makeDust(500, 8.6, VIOLET, 0.085, 0.75);
    var dustEmber = makeDust(200, 6.4, 0xff7a1c, 0.06, 0.85);

    var px = 0, py = 0, cx = 0, cy = 0;
    function onMove(e) { px = (e.clientX / window.innerWidth - 0.5) * 2; py = (e.clientY / window.innerHeight - 0.5) * 2; }
    window.addEventListener('mousemove', onMove, { passive: true });

    function resize() {
      var w = mount.clientWidth || window.innerWidth;
      var h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      group.scale.setScalar(Math.max(0.34, Math.min(1, w / h / 1.75)));
    }
    resize();
    var ro = new ResizeObserver(resize); ro.observe(mount);

    var clock = new THREE.Clock(); var raf = 0;
    function tick() {
      var t = clock.getElapsedTime();
      group.rotation.z = t * 0.12;
      group.rotation.x = Math.sin(t * 0.23) * 0.05 + Math.sin(t * 0.91) * 0.014;
      group.rotation.y = Math.sin(t * 0.17) * 0.06;
      seal.g.rotation.z = t * 0.09; mid.g.rotation.z = -t * 0.13;
      outer.g.rotation.z = t * 0.17; blood.g.rotation.z = -t * 0.075;
      core.rotation.x = t * 0.42; core.rotation.y = -t * 0.33;
      var beat = 1 + 0.13 * Math.sin(t * 2.1) + 0.05 * Math.sin(t * 5.3); core.scale.setScalar(beat);
      dustBlue.rotation.y = t * 0.11; dustViolet.rotation.y = -t * 0.08;
      dustViolet.rotation.x = Math.sin(t * 0.3) * 0.14;
      dustEmber.rotation.y = t * 0.14; dustEmber.rotation.z = Math.sin(t * 0.4) * 0.1;
      for (var i = 0; i < runes.length; i++) { runes[i].rotation.x = t * 1.5 + i; runes[i].rotation.y = t * 1.1; }
      seal.mat.opacity = 0.34 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6));
      blood.mat.opacity = 0.16 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.1 + 1.4));
      cx += (px * 0.6 - cx) * 0.05; cy += (-py * 0.5 - cy) * 0.05;
      camera.position.x = cx; camera.position.y = cy; camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return function () {
      cancelAnimationFrame(raf); window.removeEventListener('mousemove', onMove);
      ro.disconnect(); disposables.forEach(function (d) { d.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }

  /* ---------------- Cursor glow ---------------- */
  function initCursor(el) {
    var raf = 0, x = window.innerWidth / 2, y = window.innerHeight / 2, tx = x, ty = y;
    function onMove(e) { tx = e.clientX; ty = e.clientY; }
    function loop() {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      el.style.transform = 'translate3d(' + (x - 230) + 'px,' + (y - 230) + 'px,0)';
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return function () { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }

  /* ---------------- Rune seal eye tracking ---------------- */
  function initSealEye(eye) {
    var seal = eye.closest('.hv-seal');
    if (!seal) return;
    var raf = 0, x = 0, y = 0, s = 1, tx = 0, ty = 0, ts = 1;
    function onMove(e) {
      var r = seal.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1;
      tx = (dx / d) * Math.min(13, d / 18);
      ty = (dy / d) * Math.min(6.5, d / 30);
      ts = 1 - Math.min(0.34, 300 / (d + 300));
    }
    function loop() {
      x += (tx - x) * 0.1; y += (ty - y) * 0.1; s += (ts - s) * 0.07;
      eye.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + s.toFixed(3) + ')';
      raf = requestAnimationFrame(loop);
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return function () { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); };
  }

  /* ---------------- Cursed runes (inject glyphs) ---------------- */
  function injectRunes(host, count) {
    var html = '';
    for (var i = 0; i < count; i++) {
      var left = (i * 8.7 + 5) % 92;
      var size = 14 + (i % 4) * 5;
      html += '<span class="hv-rune-glyph" style="left:' + left + '%;animation-delay:' + (i * 1.7) +
        's;animation-duration:' + (14 + (i % 5) * 3.5) + 's">' +
        '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '">' +
        '<path d="' + RUNES[i % RUNES.length] + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>';
    }
    host.innerHTML = html;
  }

  /* ---------------- Heroic crest wings (inject SVG) ---------------- */
  function wingSVG(id, mirrored) {
    var paths = '<path d="M0 0 Q 34 -30 74 -58" stroke-width="1.4" opacity="0.6"/>';
    for (var i = 0; i < FEATHERS.length; i++) {
      var a = FEATHERS[i];
      paths += '<path d="M0 0 Q 19 -11 40 1 Q 19 11 0 0 Z" stroke-width="2.2" transform="rotate(' + a + ') scale(' + (1 - i * 0.07).toFixed(2) + ')" opacity="' + (0.94 - i * 0.05).toFixed(2) + '"/>';
    }
    var inner = '<g transform="translate(12 76)" stroke="url(#' + id + ')" stroke-linecap="round">' + paths + '</g>';
    if (mirrored) inner = '<g transform="translate(150 0) scale(-1 1)">' + inner + '</g>';
    return '<svg viewBox="0 0 150 84" fill="none"><defs><linearGradient id="' + id + '" x1="0" y1="1" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#fff6d8"/><stop offset="35%" stop-color="#ffe39a"/><stop offset="70%" stop-color="#f5b542"/><stop offset="100%" stop-color="#b8741f"/>' +
      '</linearGradient></defs>' + inner + '</svg>';
  }
  function injectWings() {
    var l = document.querySelector('.hv-wing.l'); var r = document.querySelector('.hv-wing.r');
    if (l) l.innerHTML = wingSVG('hvWingL', false);
    if (r) r.innerHTML = wingSVG('hvWingR', true);
  }

  /* ---------------- Mode buttons: tilt + shock + strike ---------------- */
  function initModeButtons() {
    var btns = document.querySelectorAll('#overlayIntro .portal-btn');
    btns.forEach(function (btn, idx) {
      if (btn.dataset.hvInit) return;
      btn.dataset.hvInit = '1';
      var ring = document.createElement('span');
      ring.className = 'shock-ring';
      btn.appendChild(ring);
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        btn.style.transform = 'translateY(-5px) scale(1.035) rotateX(' + (-ny * 18).toFixed(2) + 'deg) rotateY(' + (nx * 22).toFixed(2) + 'deg)';
      });
      btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
      btn.addEventListener('click', function () {
        ring.classList.remove('fire'); void ring.offsetWidth; ring.classList.add('fire');
        window.dispatchEvent(new CustomEvent('arena-strike'));
      });
    });
  }

  /* ---------------- Strike: shake card + flash ---------------- */
  function initStrike() {
    var card = document.querySelector('#overlayIntro .intro-card');
    var flash = document.getElementById('hvStrike');
    window.addEventListener('arena-strike', function () {
      if (card) { card.classList.remove('arena-shake'); void card.offsetWidth; card.classList.add('arena-shake'); }
      if (flash) { flash.classList.remove('arena-strike'); void flash.offsetWidth; flash.classList.add('arena-strike'); }
    });
  }

  /* ---------------- Init ---------------- */
  var started = false;
  var cleanups = [];
  function start() {
    if (started) return;
    var intro = document.getElementById('overlayIntro');
    if (!intro) return;
    started = true;

    var arena = document.getElementById('hvArena3D');
    if (arena) { var c1 = initArena3D(arena); if (c1) cleanups.push(c1); }

    var pBack = document.getElementById('hvParticles');
    if (pBack) cleanups.push(initParticles(pBack, 230));

    var pInt = document.getElementById('hvParticlesInt');
    if (pInt) cleanups.push(initParticles(pInt, 90));

    var cursor = document.getElementById('hvCursor');
    if (cursor) cleanups.push(initCursor(cursor));

    var eye = document.getElementById('hvSealEye');
    if (eye) cleanups.push(initSealEye(eye));

    var runes = document.querySelector('#overlayIntro .hv-runes');
    if (runes) injectRunes(runes, 12);

    injectWings();
    initModeButtons();
    initStrike();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // The intro DOM is present at load, but re-run once the game signals readiness
  // in case the script beat the rest of the page.
  window.addEventListener('game:ready', start);
})();
