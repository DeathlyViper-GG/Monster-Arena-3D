// ============================================================
// Monster Arena — BOSS DEATH CUTSCENE
// A Zelda-style boss death whose mid-phase is ELEMENT-SPECIFIC:
//   meadow  → EMBER  : flames consume it, it chars to ash, embers rise
//   dunes   → GLASS  : it crystallizes into glass, refracts, then shatters
//   glacial → FREEZE : ice creeps over it, it freezes solid, then shatters
// The accent/glyph (passed from each boss module) already encode the
// element's colour, so the glow, soul and shockwave differ per boss too.
// Full-screen cinematic overlay; reuses the real boss sprite art.
// ============================================================
(function () {
  'use strict';
  const T_TREMBLE = 1.35;   // freeze + tremble + element creep
  const T_ERUPT = 2.25;     // element mid-phase (burn / crystallize / freeze)
  const T_SHATTER = 4.30;   // sprite bursts into themed fragments + soul rises
  const T_FADE = 5.40;      // lingering embers, darken, done

  const STYLE_OF = { meadow: 'ember', dunes: 'glass', glacial: 'freeze', cinder: 'magma', void: 'void' };

  let inst = null;
  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }

  function ensure() {
    if (inst) return inst;
    const style = document.createElement('style');
    style.textContent = `
#overlayBossDeath{position:fixed;inset:0;z-index:60;display:none;background:#03050b;}
#overlayBossDeath canvas{position:absolute;inset:0;width:100%;height:100%;display:block;}
#bdName{position:absolute;left:50%;top:13%;transform:translateX(-50%);z-index:3;
  font-size:clamp(16px,2.6vw,30px);letter-spacing:.18em;text-transform:uppercase;font-weight:800;
  color:#fff;text-shadow:0 0 18px var(--bd-accent,#7dffa3),0 2px 6px #000;opacity:0;transition:opacity .6s ease;text-align:center;}
#bdName.show{opacity:.95;}
#bdSkip{position:absolute;top:24px;right:26px;z-index:4;cursor:pointer;
  border:1px solid var(--bd-accent,#7dffa3)66;background:rgba(8,16,30,.7);color:#dff2ff;
  padding:10px 18px;border-radius:10px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;
  transition:transform .12s ease,background .12s ease;}
#bdSkip:hover{transform:translateY(-1px);background:rgba(18,36,60,.85);}`;
    document.head.appendChild(style);
    const ov = document.createElement('div');
    ov.id = 'overlayBossDeath';
    const cv = document.createElement('canvas');
    const nm = document.createElement('div'); nm.id = 'bdName';
    const sk = document.createElement('button'); sk.id = 'bdSkip'; sk.textContent = 'Skip ▸';
    ov.appendChild(cv); ov.appendChild(nm); ov.appendChild(sk);
    document.body.appendChild(ov);
    sk.addEventListener('click', () => done());
    window.addEventListener('resize', resize);
    inst = { ov, cv, ctx: cv.getContext('2d'), nm, sk, cur: null, raf: 0 };
    return inst;
  }

  function resize() {
    if (!inst) return;
    const d = dpr();
    inst.cv.width = Math.floor(window.innerWidth * d);
    inst.cv.height = Math.floor(window.innerHeight * d);
    inst.ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  // ---- themed fragments -------------------------------------------------
  function makeFragments(theme, W, H, size) {
    const frags = [];
    const cx = W / 2, cy = H * 0.46;
    const n = theme === 'dunes' ? 54 : theme === 'glacial' ? 50 : 46;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = Math.random() * size * 0.7;
      const sp = 260 + Math.random() * 560;
      const up = -120 - Math.random() * 260;
      let col, shape, sz;
      if (theme === 'dunes') {
        col = Math.random() < 0.5 ? '#ffd98a' : (Math.random() < 0.5 ? '#e3b749' : '#fff2cf');
        shape = 'glass'; sz = 7 + Math.random() * 20;
      } else if (theme === 'glacial') {
        col = Math.random() < 0.5 ? '#cdeeff' : (Math.random() < 0.5 ? '#9fe3ff' : '#eaf9ff');
        shape = 'ice'; sz = 7 + Math.random() * 18;
      } else if (theme === 'cinder') { // obsidian shards + molten embers
        const roll = Math.random();
        col = roll < 0.4 ? '#ff6a2a' : roll < 0.7 ? '#ffd700' : roll < 0.85 ? '#3d3d3d' : '#ff4500';
        shape = roll < 0.6 ? 'ember' : 'slag'; sz = 6 + Math.random() * 18;
      } else if (theme === 'void') { // violet obsidian shards + chromatic motes
        const roll = Math.random();
        col = roll < 0.4 ? '#c88aff' : roll < 0.7 ? '#7dffa3' : roll < 0.85 ? '#1a0828' : '#ff3a6a';
        shape = 'glass'; sz = 7 + Math.random() * 18;
      } else { // meadow — ash + embers
        const roll = Math.random();
        col = roll < 0.4 ? '#7dffa3' : roll < 0.7 ? '#ff8a3a' : roll < 0.85 ? '#ffb347' : '#3a2a1a';
        shape = roll < 0.7 ? 'spore' : 'ash'; sz = 5 + Math.random() * 16;
      }
      frags.push({
        x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0,
        vx: Math.cos(a) * sp + (Math.random() - 0.5) * 120,
        vy: Math.sin(a) * sp + up,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 7,
        sz, col, shape, a: 1, grav: 0.5 + Math.random() * 0.4, life: 2.0 + Math.random() * 1.2, age: 0
      });
    }
    return frags;
  }

  function drawFrag(c, f, theme) {
    c.save(); c.translate(f.x, f.y); c.rotate(f.rot);
    c.globalAlpha = Math.max(0, f.a);
    c.globalCompositeOperation = 'lighter';
    if (f.shape === 'glass' || f.shape === 'ice') {
      const gg = c.createLinearGradient(0, -f.sz, 0, f.sz);
      gg.addColorStop(0, f.col); gg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); gg.addColorStop(1, f.col);
      c.fillStyle = gg; c.strokeStyle = f.col; c.lineWidth = 1; c.shadowColor = f.col; c.shadowBlur = 12;
      c.beginPath(); c.moveTo(0, -f.sz); c.lineTo(f.sz * 0.42, 0); c.lineTo(0, f.sz); c.lineTo(-f.sz * 0.42, 0); c.closePath(); c.fill(); c.stroke();
    } else if (f.shape === 'ash' || f.shape === 'slag') {
      c.fillStyle = f.col; c.strokeStyle = '#1a0e06'; c.lineWidth = 1;
      const n = 6; c.beginPath();
      for (let k = 0; k < n; k++) { const aa = (k / n) * 6.28; const rr = f.sz * (0.6 + 0.4 * ((k * 37) % 3) / 2); c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      c.closePath(); c.fill(); c.stroke();
    } else { // spore / ember mote
      const gg = c.createRadialGradient(0, 0, 0, 0, 0, f.sz);
      gg.addColorStop(0, f.col); gg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gg; c.beginPath(); c.arc(0, 0, f.sz, 0, 6.28); c.fill();
    }
    c.restore();
  }

  // ---- cracks growing from the boss core ---------------------------------
  function makeCracks(n) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + Math.random() * 0.4;
      const segs = 3 + Math.floor(Math.random() * 3);
      const seg = [];
      let ang = a;
      for (let k = 0; k < segs; k++) { seg.push({ off: (Math.random() - 0.5) * 0.5 }); ang += (Math.random() - 0.5) * 0.5; }
      arr.push({ a, segs, seg, grow: 0.2 + Math.random() * 0.5 });
    }
    return arr;
  }
  function drawCracks(c, cx, cy, cracks, prog, maxLen, color) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 14; c.lineWidth = 2;
    for (const cr of cracks) {
      const len = maxLen * Math.min(1, prog * cr.grow);
      let ang = cr.a, x = cx, y = cy;
      c.beginPath(); c.moveTo(x, y);
      const step = len / cr.segs;
      for (let k = 0; k < cr.segs; k++) {
        ang += cr.seg[k].off; x += Math.cos(ang) * step; y += Math.sin(ang) * step;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();
  }

  // ---- the soul / essence that rises ------------------------------------
  function drawSoul(c, W, H, t, accent, glyph, size) {
    const rise = Math.max(0, (t - T_ERUPT) / (T_FADE - T_ERUPT));
    const y = H * 0.46 - rise * H * 0.7;
    const a = Math.max(0, 1 - rise);
    if (a <= 0) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const bg = c.createLinearGradient(W / 2, H * 0.46, W / 2, y);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, glyph);
    c.globalAlpha = 0.4 * a; c.fillStyle = bg; c.fillRect(W / 2 - size * 0.5, y, size, H * 0.46 - y);
    c.globalAlpha = a;
    const og = c.createRadialGradient(W / 2, y, 1, W / 2, y, size * 1.4);
    og.addColorStop(0, '#ffffff'); og.addColorStop(0.4, glyph); og.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = og; c.beginPath(); c.arc(W / 2, y, size * 1.4, 0, 6.28); c.fill();
    c.fillStyle = `rgba(255,255,255,${a})`; c.font = `bold ${size * 0.7}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = accent; c.shadowBlur = 24; c.fillText('✦', W / 2, y);
    c.restore();
  }

  // ---- element-specific mid-phase --------------------------------------
  // EMBER (meadow): flame tongues lick up the sprite, it chars dark, warm flare.
  function drawEmberMid(c, cx, cy, size, t, amt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const flames = 7;
    for (let i = 0; i < flames; i++) {
      const fx = cx + (i - (flames - 1) / 2) * size * 0.32;
      const h = size * (0.5 + 0.6 * amt) * (0.7 + 0.3 * Math.sin(t * 9 + i * 1.7));
      const flick = Math.sin(t * 14 + i) * 6;
      const g = c.createLinearGradient(fx, cy + size * 0.5, fx, cy + size * 0.5 - h);
      g.addColorStop(0, 'rgba(255,120,30,0.0)');
      g.addColorStop(0.4, hexA('#ff8a3a', 0.5 * amt));
      g.addColorStop(0.8, hexA('#ffd98a', 0.7 * amt));
      g.addColorStop(1, 'rgba(255,255,210,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(fx - size * 0.12, cy + size * 0.5);
      c.quadraticCurveTo(fx - size * 0.04 + flick, cy + size * 0.5 - h * 0.5, fx, cy + size * 0.5 - h);
      c.quadraticCurveTo(fx + size * 0.04 + flick, cy + size * 0.5 - h * 0.5, fx + size * 0.12, cy + size * 0.5);
      c.closePath(); c.fill();
    }
    c.restore();
    // char darkening overlay over the sprite core
    c.save(); c.globalCompositeOperation = 'multiply';
    c.globalAlpha = amt * 0.65;
    const cg = c.createRadialGradient(cx, cy, size * 0.1, cx, cy, size);
    cg.addColorStop(0, 'rgba(40,20,8,0)'); cg.addColorStop(1, 'rgba(20,10,4,1)');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, size, 0, 6.28); c.fill();
    c.restore();
  }

  // GLASS (dunes): prismatic facets cover it, light refracts, glassy tint.
  function drawGlassMid(c, cx, cy, size, t, amt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const facets = 9;
    for (let i = 0; i < facets; i++) {
      const a = (i / facets) * 6.28 + t * 0.3;
      const r = size * (0.4 + 0.5 * amt);
      const hue = ['#ffd98a', '#fff2cf', '#e3b749', '#ffe7a0'][i % 4];
      c.fillStyle = hexA(hue, 0.10 + 0.16 * amt);
      c.strokeStyle = hexA('#fff2cf', 0.25 * amt); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      c.lineTo(cx + Math.cos(a + 6.28 / facets) * r, cy + Math.sin(a + 6.28 / facets) * r);
      c.closePath(); c.fill(); c.stroke();
    }
    // prismatic refraction rays fanning out
    const rays = 6;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * 6.28 + t * 0.5;
      const len = size * (1.4 + 0.8 * amt);
      const col = ['#ffd98a', '#fff', '#e3b749'][i % 3];
      c.strokeStyle = hexA(col, 0.25 * amt); c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); c.stroke();
    }
    c.restore();
  }

  // MAGMA (cinder): molten rock cracks widen, core flares blinding, obsidian crust cracks & splits.
  function drawMagmaMid(c, cx, cy, size, t, amt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    // molten fissures widening across the body — bright lava veins
    const veins = 9;
    for (let i = 0; i < veins; i++) {
      const a = (i / veins) * 6.28 + t * 0.2;
      const r0 = size * 0.2, r1 = size * (0.6 + 0.4 * amt);
      const g = c.createLinearGradient(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.addColorStop(0, hexA('#ffffff', 0.0));
      g.addColorStop(0.5, hexA('#ffd700', 0.7 * amt));
      g.addColorStop(1, hexA('#ff4500', 0.9 * amt));
      c.strokeStyle = g; c.lineWidth = 3 + 3 * amt; c.shadowColor = '#ff6a2a'; c.shadowBlur = 16;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
    }
    // blinding core flare
    const cg = c.createRadialGradient(cx, cy, 2, cx, cy, size * (0.5 + 0.5 * amt));
    cg.addColorStop(0, hexA('#ffffff', 0.9 * amt)); cg.addColorStop(0.4, hexA('#ffd700', 0.6 * amt)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, size * (0.5 + 0.5 * amt), 0, 6.28); c.fill();
    c.restore();
    // dark obsidian crust cracking over it
    c.save(); c.globalCompositeOperation = 'multiply';
    c.globalAlpha = amt * 0.6;
    const og = c.createRadialGradient(cx, cy, size * 0.1, cx, cy, size);
    og.addColorStop(0, 'rgba(30,18,10,0)'); og.addColorStop(1, 'rgba(10,6,4,1)');
    c.fillStyle = og; c.beginPath(); c.arc(cx, cy, size, 0, 6.28); c.fill();
    c.restore();
  }

  // FREEZE (glacial): ice casing grows over it, frost crystals rim it, rigid.
  function drawFreezeMid(c, cx, cy, size, t, amt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    // icy casing — faceted ice shell
    const facets = 7;
    for (let i = 0; i < facets; i++) {
      const a = (i / facets) * 6.28 - Math.PI / 2;
      const r = size * (0.55 + 0.4 * amt);
      c.fillStyle = hexA(i % 2 ? '#9fe3ff' : '#cdeeff', 0.08 + 0.14 * amt);
      c.strokeStyle = hexA('#eaf9ff', 0.3 * amt); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      c.lineTo(cx + Math.cos(a + 6.28 / facets) * r, cy + Math.sin(a + 6.28 / facets) * r);
      c.closePath(); c.fill(); c.stroke();
    }
    // frost crystal spikes rimming the boss
    const spikes = 14;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * 6.28 + t * 0.2;
      const inner = size * 0.85, outer = size * (0.95 + 0.35 * amt);
      c.strokeStyle = hexA('#eaf9ff', 0.6 * amt); c.lineWidth = 2; c.shadowColor = '#9fe3ff'; c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      c.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      c.stroke();
    }
    c.restore();
    // cold blue wash over the sprite
    c.save(); c.globalCompositeOperation = 'screen';
    c.globalAlpha = amt * 0.5;
    const cg = c.createRadialGradient(cx, cy, size * 0.2, cx, cy, size);
    cg.addColorStop(0, 'rgba(180,235,255,0.0)'); cg.addColorStop(1, 'rgba(120,200,255,0.6)');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, size, 0, 6.28); c.fill();
    c.restore();
  }

  // VOID (void): chromatic-aberration fracture lines + collapsing violet singularity.
  function drawVoidMid(c, cx, cy, size, t, amt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.28 + t * 0.3;
      const r0 = size * 0.15, r1 = size * (0.5 + 0.5 * amt);
      c.strokeStyle = `rgba(255,58,106,${0.3 * amt})`; c.lineWidth = 2; c.shadowColor = '#ff3a6a'; c.shadowBlur = 10;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.stroke();
      c.strokeStyle = `rgba(58,254,200,${0.3 * amt})`;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * r0 + 2, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * r1 + 2, cy + Math.sin(a) * r1); c.stroke();
    }
    const sg = c.createRadialGradient(cx, cy, 2, cx, cy, size * (0.4 + 0.4 * amt));
    sg.addColorStop(0, `rgba(255,255,255,${0.6 * amt})`); sg.addColorStop(0.5, `rgba(200,138,255,${0.5 * amt})`); sg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, size * (0.4 + 0.4 * amt), 0, 6.28); c.fill();
    c.restore();
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = amt * 0.6;
    const og = c.createRadialGradient(cx, cy, size * 0.1, cx, cy, size);
    og.addColorStop(0, 'rgba(10,2,20,0)'); og.addColorStop(1, 'rgba(4,0,10,1)');
    c.fillStyle = og; c.beginPath(); c.arc(cx, cy, size, 0, 6.28); c.fill();
    c.restore();
  }

  // ---- ambient particles during tremble / mid-phase -------------------
  function spawnAmbient(cur, cx, cy, size, dt) {
    if (cur.t > T_ERUPT + 0.1) return;
    const rate = cur.style === 'ember' ? 3 : cur.style === 'freeze' ? 2 : cur.style === 'magma' ? 3 : 1.5;
    if (Math.random() > rate * dt * 20) return;
    if (cur.style === 'ember') {
      cur.ambient.push({ x: cx + (Math.random() - 0.5) * size * 0.9, y: cy + (Math.random() - 0.5) * size * 0.6,
        vx: (Math.random() - 0.5) * 20, vy: -60 - Math.random() * 90, r: 1.5 + Math.random() * 2.5,
        col: Math.random() < 0.5 ? '#ff8a3a' : '#ffd98a', life: 0.8 + Math.random() * 0.8, age: 0, kind: 'ember' });
    } else if (cur.style === 'glass') {
      cur.ambient.push({ x: cx + (Math.random() - 0.5) * size, y: cy + (Math.random() - 0.5) * size,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, r: 1 + Math.random() * 2,
        col: Math.random() < 0.5 ? '#fff2cf' : '#ffd98a', life: 0.5 + Math.random() * 0.5, age: 0, kind: 'glint' });
    } else if (cur.style === 'magma') {
      cur.ambient.push({ x: cx + (Math.random() - 0.5) * size * 0.9, y: cy + (Math.random() - 0.5) * size * 0.6,
        vx: (Math.random() - 0.5) * 24, vy: -70 - Math.random() * 100, r: 1.5 + Math.random() * 3,
        col: Math.random() < 0.5 ? '#ff6a2a' : '#ffd700', life: 0.9 + Math.random() * 0.8, age: 0, kind: 'ember' });
    } else if (cur.style === 'void') {
      cur.ambient.push({ x: cx + (Math.random() - 0.5) * size * 0.9, y: cy + (Math.random() - 0.5) * size * 0.6,
        vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 80, r: 1.5 + Math.random() * 2.5,
        col: Math.random() < 0.5 ? '#c88aff' : '#7dffa3', life: 1.0 + Math.random() * 0.8, age: 0, kind: 'ember' });
    } else { // freeze
      cur.ambient.push({ x: cx + (Math.random() - 0.5) * size * 1.2, y: cy + size * 0.4 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 30, r: 1.5 + Math.random() * 3,
        col: Math.random() < 0.5 ? '#cdeeff' : '#eaf9ff', life: 1.0 + Math.random() * 1.0, age: 0, kind: 'frost' });
    }
  }
  function drawAmbient(c, cur, dt) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (const p of cur.ambient) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'ember') { p.vy -= 20 * dt; }
      const k = Math.max(0, 1 - p.age / p.life);
      c.globalAlpha = k * 0.9;
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      g.addColorStop(0, p.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r * 2.5, 0, 6.28); c.fill();
    }
    cur.ambient = cur.ambient.filter(p => p.age < p.life);
    c.restore();
  }

  function play(cfg) {
    const I = ensure();
    if (I.cur) done();
    const sprite = cfg.sprite;
    const accent = cfg.accent || '#7dffa3';
    const glyph = cfg.glyph || accent;
    const theme = cfg.theme || 'meadow';
    const style = STYLE_OF[theme] || 'ember';
    I.ov.style.setProperty('--bd-accent', accent);
    I.nm.textContent = cfg.name || 'Boss';
    resize();
    I.cur = {
      t: 0, last: 0, sprite, accent, glyph, theme, style,
      onDone: cfg.onDone || function () {},
      frags: null, ambient: [], cracks: makeCracks(8), spawned: false,
      shake: 0, flash: 0
    };
    I.nm.classList.add('show');
    I.ov.style.display = 'block';
    window._BOSS_DEATH_ACTIVE = true;   // silence combat music while the death cutscene plays
    if (!I.raf) I.raf = requestAnimationFrame(loop);
  }

  function loop(ts) {
    const I = inst; if (!I || !I.cur) { I.raf = 0; return; }
    I.raf = requestAnimationFrame(loop);
    const W = window.innerWidth, H = window.innerHeight;
    const c = I.ctx;
    const cur = I.cur;
    if (!cur.last) cur.last = ts;
    const dt = Math.min(0.05, (ts - cur.last) / 1000); cur.last = ts;
    cur.t += dt;

    const size = Math.min(W, H) * 0.30;
    const cx = W / 2, cy = H * 0.46;

    // phase timing
    const trembleAmt = cur.t < T_TREMBLE ? (cur.t / T_TREMBLE) : 1;
    const eruptAmt = Math.max(0, Math.min(1, (cur.t - T_TREMBLE) / (T_ERUPT - T_TREMBLE)));
    const shatterAmt = Math.max(0, Math.min(1, (cur.t - T_ERUPT) / (T_SHATTER - T_ERUPT)));
    const fadeAmt = Math.max(0, Math.min(1, (cur.t - T_SHATTER) / (T_FADE - T_SHATTER)));

    // freeze makes the boss rigid — damp tremble as it freezes
    const rigid = cur.style === 'freeze' ? eruptAmt : 0;
    const trembleScale = 1 - rigid * 0.85;

    // shake amplitude
    let shake = 0;
    if (cur.t < T_TREMBLE) shake = 2 + trembleAmt * 8;
    else if (cur.t < T_ERUPT) shake = (10 + eruptAmt * 16) * trembleScale + rigid * 2;
    else shake = Math.max(0, 26 - shatterAmt * 26);
    cur.shake = shake;

    // flash — tinted per element
    const flashCol = cur.style === 'ember' ? [255, 170, 90]
      : cur.style === 'glass' ? [255, 225, 140]
      : cur.style === 'magma' ? [255, 140, 50]
      : cur.style === 'void' ? [200, 138, 255]
      : [180, 235, 255];
    if (cur.t > T_TREMBLE) cur.flash = Math.max(cur.flash, 0.10 + eruptAmt * 0.5);
    if (cur.t > T_ERUPT && cur.t < T_ERUPT + 0.18) cur.flash = 0.95;
    if (cur.t > T_ERUPT + 0.18) cur.flash = Math.max(0, cur.flash - dt * 1.6);

    // spawn fragments at shatter moment
    if (cur.t >= T_ERUPT && !cur.spawned) { cur.frags = makeFragments(cur.theme, W, H, size); cur.spawned = true; }

    // ---- draw ----
    const bgTint = cur.theme === 'dunes' ? 'rgba(40,20,8,1)' : cur.theme === 'glacial' ? 'rgba(8,20,38,1)' : cur.theme === 'cinder' ? 'rgba(24,8,4,1)' : cur.theme === 'void' ? 'rgba(6,2,14,1)' : 'rgba(6,14,10,1)';
    c.fillStyle = bgTint; c.fillRect(0, 0, W, H);
    const vg = c.createRadialGradient(cx, cy, size * 0.5, cx, cy, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);

    let ox = (Math.random() - 0.5) * shake, oy = (Math.random() - 0.5) * shake;
    c.save(); c.translate(ox, oy);

    // rising light column (builds during erupt)
    if (cur.t > T_TREMBLE) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const col = c.createLinearGradient(0, cy - H, 0, cy + size);
      const ci = Math.min(1, eruptAmt + shatterAmt * 0.4);
      col.addColorStop(0, 'rgba(0,0,0,0)'); col.addColorStop(0.7, hexA(cur.glyph, 0.18 * ci)); col.addColorStop(1, hexA(cur.accent, 0.35 * ci));
      c.fillStyle = col; c.fillRect(cx - size * 1.4, 0, size * 2.8, cy + size);
      c.restore();
    }

    // ground halo / core glow building
    c.save(); c.globalCompositeOperation = 'lighter';
    const corePulse = 0.5 + 0.5 * Math.sin(cur.t * 9);
    const coreI = Math.min(1, trembleAmt * 0.6 + eruptAmt + shatterAmt * 0.5);
    const cg = c.createRadialGradient(cx, cy, 2, cx, cy, size * (1.4 + coreI * 1.6));
    cg.addColorStop(0, hexA('#ffffff', 0.5 * coreI)); cg.addColorStop(0.35, hexA(cur.glyph, 0.5 * coreI * corePulse)); cg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = cg; c.beginPath(); c.arc(cx, cy, size * (1.4 + coreI * 1.6), 0, 6.28); c.fill();
    c.restore();

    // ambient element particles
    spawnAmbient(cur, cx, cy, size, dt);
    drawAmbient(c, cur, dt);

    // boss sprite (until it shatters) — rotated 90° clockwise so it stands upright
    if (cur.sprite && cur.t < T_ERUPT + 0.16) {
      const tremble = (Math.random() - 0.5) * 4 * trembleAmt * trembleScale;
      const drawSz = size * 2.0 * (1 + eruptAmt * 0.06);
      const alpha = cur.t < T_ERUPT ? 1 : Math.max(0, 1 - (cur.t - T_ERUPT) / 0.16);
      c.save();
      c.globalAlpha = alpha;
      c.translate(cx + tremble, cy + tremble * 0.5);
      c.rotate(Math.PI / 2); // 90° clockwise — sprite art faces sideways
      c.scale(1 + Math.sin(cur.t * 30) * 0.01 * trembleAmt * trembleScale, 1 - Math.sin(cur.t * 30) * 0.01 * trembleAmt * trembleScale);
      try { c.drawImage(cur.sprite, -drawSz / 2, -drawSz / 2, drawSz, drawSz); } catch (e) {}
      // element white-out / tint overlay during erupt
      if (eruptAmt > 0) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = alpha * eruptAmt * 0.9;
        const wg = c.createRadialGradient(0, 0, 2, 0, 0, drawSz * 0.7);
        wg.addColorStop(0, 'rgba(255,255,255,0.95)'); wg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = wg; c.beginPath(); c.arc(0, 0, drawSz * 0.7, 0, 6.28); c.fill();
      }
      c.restore();
    }

    // element-specific mid-phase (burn / crystallize / freeze)
    if (eruptAmt > 0.02 && cur.t < T_ERUPT + 0.16) {
      if (cur.style === 'ember') drawEmberMid(c, cx, cy, size, cur.t, eruptAmt);
      else if (cur.style === 'glass') drawGlassMid(c, cx, cy, size, cur.t, eruptAmt);
      else if (cur.style === 'magma') drawMagmaMid(c, cx, cy, size, cur.t, eruptAmt);
      else if (cur.style === 'void') drawVoidMid(c, cx, cy, size, cur.t, eruptAmt);
      else drawFreezeMid(c, cx, cy, size, cur.t, eruptAmt);
    }

    // cracks over the sprite
    const crackProg = trembleAmt * 0.4 + eruptAmt * 0.6 + shatterAmt;
    if (crackProg > 0.05 && cur.t < T_ERUPT + 0.2) {
      drawCracks(c, cx, cy, cur.cracks, crackProg, size * 1.0, cur.glyph);
    }

    // shockwave ring at shatter
    if (cur.t > T_ERUPT) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const ringP = Math.min(1, (cur.t - T_ERUPT) / 1.2);
      const rr = size * (0.8 + ringP * 4.5);
      c.strokeStyle = hexA(cur.glyph, 0.8 * (1 - ringP)); c.lineWidth = 10 * (1 - ringP) + 2; c.shadowColor = cur.glyph; c.shadowBlur = 30;
      c.beginPath(); c.arc(cx, cy, rr, 0, 6.28); c.stroke();
      c.strokeStyle = hexA(cur.accent, 0.5 * (1 - ringP)); c.lineWidth = 6 * (1 - ringP) + 1;
      c.beginPath(); c.arc(cx, cy, rr * 0.74, 0, 6.28); c.stroke();
      c.restore();
    }

    // fragments
    if (cur.frags) {
      for (const f of cur.frags) {
        f.age += dt;
        f.vy += f.grav * 220 * dt;
        f.vx *= (1 - 0.4 * dt); f.vy *= (1 - 0.2 * dt);
        f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
        f.a = Math.max(0, 1 - f.age / f.life);
        drawFrag(c, f, cur.theme);
      }
    }

    // soul essence rising
    drawSoul(c, W, H, cur.t, cur.accent, cur.glyph, size * 0.5);

    c.restore(); // shake

    // screen flash (element-tinted)
    if (cur.flash > 0) {
      c.fillStyle = `rgba(${flashCol[0]},${flashCol[1]},${flashCol[2]},${cur.flash})`; c.fillRect(0, 0, W, H);
    }
    // final darken
    if (fadeAmt > 0) {
      c.fillStyle = `rgba(2,4,10,${fadeAmt})`; c.fillRect(0, 0, W, H);
      I.nm.style.opacity = String(Math.max(0, 1 - fadeAmt * 1.4));
    }

    if (cur.t >= T_FADE) done();
  }

  function hexA(hex, a) {
    if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function done() {
    const I = inst; if (!I) return;
    if (!I.cur) { I.ov.style.display = 'none'; return; }
    const cb = I.cur.onDone; I.cur = null;
    if (I.raf) cancelAnimationFrame(I.raf); I.raf = 0;
    I.ov.style.display = 'none';
    I.nm.classList.remove('show');
    window._BOSS_DEATH_ACTIVE = false;
    if (typeof cb === 'function') cb();
  }

  window.BossDeathScene = { play, done: () => { if (inst && inst.cur) done(); } };
})();
