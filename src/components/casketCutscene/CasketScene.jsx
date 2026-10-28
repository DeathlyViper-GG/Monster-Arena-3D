import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SOUL_SPECS, buildSoul, updateSoul } from './soulCrystals';
import { buildShadowVeil, updateShadowVeil } from './shadows';

// ── helpers ──────────────────────────────────────────────────────────
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const radial = (ctx, size, stops) => {
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  return g;
};
const canvasTex = (canvas) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

// ── procedural textures ──────────────────────────────────────────────
function makeGlowTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = radial(ctx, size, [
    [0, 'rgba(255,255,255,1)'],
    [0.2, 'rgba(255,255,255,0.6)'],
    [0.52, 'rgba(255,255,255,0.14)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  return canvasTex(canvas);
}

function makeStoneTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#221c28';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, Math.random() * 2.6 + 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = canvasTex(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function runeMark(ctx, size) {
  ctx.beginPath();
  const strokes = 2 + Math.floor(Math.random() * 3);
  for (let s = 0; s < strokes; s++) {
    const x1 = (Math.random() - 0.5) * size;
    const y1 = (Math.random() - 0.5) * size;
    const x2 = (Math.random() - 0.5) * size;
    const y2 = (Math.random() - 0.5) * size;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

function makeSmokeTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const r = size * (0.07 + Math.random() * 0.2);
    const x = size / 2 + (Math.random() - 0.5) * size * 0.55;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.55;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.17)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.06)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // feather the edges so the sprite never shows a hard square
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = radial(ctx, size, [
    [0, 'rgba(255,255,255,1)'],
    [0.62, 'rgba(255,255,255,0.65)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(0, 0, size, size);
  return canvasTex(canvas);
}

function makeRuneRingTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(216,200,255,0.9)';
  ctx.shadowColor = 'rgba(150,100,255,0.95)';
  ctx.shadowBlur = 16;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  [0.475, 0.405].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, size * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.lineWidth = 3;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const inner = size * (i % 6 === 0 ? 0.435 : 0.455);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * size * 0.475, cy + Math.sin(a) * size * 0.475);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * size * 0.44, cy + Math.sin(a) * size * 0.44);
    ctx.rotate(a + Math.PI / 2);
    runeMark(ctx, 42);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgba(200,180,255,0.55)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * size * 0.14, cy + Math.sin(a) * size * 0.14);
    ctx.lineTo(cx + Math.cos(a) * size * 0.39, cy + Math.sin(a) * size * 0.39);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2);
  ctx.stroke();
  return canvasTex(canvas);
}

function makeSigilTexture(w = 512, h = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const cx = w / 2;
  const cy = h / 2;
  const base = Math.min(w, h);
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(222,201,255,0.92)';
  ctx.shadowColor = 'rgba(160,110,255,0.95)';
  ctx.shadowBlur = 22;
  ctx.lineWidth = 4;
  [0.46, 0.37, 0.17].forEach((r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, base * r, 0, Math.PI * 2);
    ctx.stroke();
  });
  // seven-point star inside the inner ring
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2;
    const x = cx + Math.cos(a) * base * 0.17;
    const y = cy + Math.sin(a) * base * 0.17;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // runes ringing the seal
  ctx.lineWidth = 2.6;
  const count = 14;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * base * 0.415, cy + Math.sin(a) * base * 0.415);
    ctx.rotate(a + Math.PI / 2);
    runeMark(ctx, 44);
    ctx.restore();
  }
  // spine marks down the lid
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.translate(cx, h * 0.08 + i * h * 0.145 + h * 0.02);
    runeMark(ctx, 34);
    ctx.restore();
  }
  return canvasTex(canvas);
}

function makeFireTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 34; i++) {
    const r = size * (0.07 + Math.random() * 0.15);
    const x = size / 2 + (Math.random() - 0.5) * size * 0.4;
    const y = size * 0.64 + (Math.random() - 0.5) * size * 0.42;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.38, 'rgba(255,226,176,0.26)');
    g.addColorStop(1, 'rgba(255,132,48,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // taper toward the tip so the sprite reads as a flame
  ctx.globalCompositeOperation = 'destination-in';
  const taper = ctx.createLinearGradient(0, 0, 0, size);
  taper.addColorStop(0, 'rgba(255,255,255,0)');
  taper.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  taper.addColorStop(0.72, 'rgba(255,255,255,1)');
  taper.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = taper;
  ctx.fillRect(0, 0, size, size);
  return canvasTex(canvas);
}

function makeIncantationTexture(text, w = 1024, h = 192) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const spaced = text.split('').join('\u2009');
  ctx.font = `italic 600 ${Math.round(h * 0.46)}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(150,88,255,0.95)';
  ctx.shadowBlur = 58;
  ctx.fillStyle = 'rgba(176,124,255,0.55)';
  ctx.fillText(spaced, w / 2, h / 2);
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(248,240,255,0.96)';
  ctx.fillText(spaced, w / 2, h / 2);
  return canvasTex(canvas);
}

function makeHollowMawTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  ctx.fillStyle = '#030804';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = radial(ctx, size, [
    [0, 'rgba(240,255,226,0.96)'],
    [0.08, 'rgba(186,255,150,0.9)'],
    [0.24, 'rgba(96,214,98,0.7)'],
    [0.46, 'rgba(36,102,56,0.48)'],
    [0.74, 'rgba(12,32,18,0.3)'],
    [1, 'rgba(3,8,4,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  // necrotic veins crawling out of the core
  ctx.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = size * (0.18 + Math.random() * 0.3);
    ctx.strokeStyle = `rgba(${150 + Math.random() * 90},${230 + Math.random() * 25},${120 + Math.random() * 80},${0.1 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.8 + Math.random() * 2.2;
    let x = cx + Math.cos(a) * size * 0.05;
    let y = cy + Math.sin(a) * size * 0.05;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += Math.cos(a + (Math.random() - 0.5) * 0.9) * (len / 5);
      y += Math.sin(a + (Math.random() - 0.5) * 0.9) * (len / 5);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // pustules of rot inside the light
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.6) * size * 0.42;
    ctx.fillStyle = `rgba(${180 + Math.random() * 60},255,${140 + Math.random() * 60},${0.04 + Math.random() * 0.15})`;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTex(canvas);
}

function makeTeethRingTexture(size = 512, teeth = 30) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.46;
  const step = (Math.PI * 2) / teeth;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(214,255,198,0.92)';
  ctx.shadowColor = 'rgba(120,255,140,0.9)';
  ctx.shadowBlur = 16;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const inner = size * (0.3 - Math.random() * 0.09);
    const w = step * 0.44;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - w) * outer, cy + Math.sin(a - w) * outer);
    ctx.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a + w) * outer, cy + Math.sin(a + w) * outer);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(196,255,186,0.45)';
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.44, 0, Math.PI * 2);
  ctx.stroke();
  return canvasTex(canvas);
}

function makeEyeTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = radial(ctx, size, [
    [0, 'rgba(120,255,130,0.5)'],
    [0.55, 'rgba(26,132,58,0.2)'],
    [1, 'rgba(4,16,8,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  const iris = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.26);
  iris.addColorStop(0, 'rgba(226,255,208,0.98)');
  iris.addColorStop(0.42, 'rgba(112,226,120,0.92)');
  iris.addColorStop(1, 'rgba(16,68,32,0.5)');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 54; i++) {
    const a = Math.random() * Math.PI * 2;
    ctx.strokeStyle = `rgba(206,255,190,${0.1 + Math.random() * 0.4})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * size * 0.07, cy + Math.sin(a) * size * 0.07);
    ctx.lineTo(cx + Math.cos(a) * size * (0.15 + Math.random() * 0.11), cy + Math.sin(a) * size * (0.15 + Math.random() * 0.11));
    ctx.stroke();
  }
  // vertical slit pupil — opaque so it reads as a hole in the light
  ctx.fillStyle = 'rgba(2,6,3,1)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.042, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(canvas);
}

let cachedGlow = null;
const glowTexture = () => {
  if (!cachedGlow) cachedGlow = makeGlowTexture();
  return cachedGlow;
};

// ── timeline ─────────────────────────────────────────────────────────

const TIMELINE = {
  soulStart: 2.1,
  soulGap: 1.85,
  soulTravel: 3.4,
  lidStart: 13.2,
  lidEnd: 14.0,
  splitStart: 15.7,
  splitEnd: 17.7,
  fireStart: 16.4,
  fireEnd: 18.2,
  floorFireStart: 17.6,
  incantStart: 18.6,
  loop: 30,
};

// the finale no longer runs off the ritual clock — it starts the instant the last
// soul seals, so its beats are measured from that moment instead
const LAST_SEAL = TIMELINE.soulStart + 4 * TIMELINE.soulGap + TIMELINE.soulTravel;

// the rite is watched head-on from a fixed distance — no orbiting, no push-in
const CAMERA = { position: [0, 2.25, 6], target: [0, 1.05, 0] };
const FINALE = {
  lidStart: TIMELINE.lidStart - LAST_SEAL,
  lidEnd: TIMELINE.lidEnd - LAST_SEAL,
  splitStart: TIMELINE.splitStart - LAST_SEAL,
  splitEnd: TIMELINE.splitEnd - LAST_SEAL,
  fireStart: TIMELINE.fireStart - LAST_SEAL,
  fireEnd: TIMELINE.fireEnd - LAST_SEAL,
  floorFire: TIMELINE.floorFireStart - LAST_SEAL,
  incant: TIMELINE.incantStart - LAST_SEAL,
  length: TIMELINE.loop - LAST_SEAL,
};

const soulYank = (t) => clamp01((t - 0.58) / 0.42);

function soulPath(t, spec) {
  const k = clamp01(t);
  // the soul thrashes against the pull, then is torn down into the casket
  const yank = Math.pow(soulYank(t), 2.4);
  const fight = Math.sin(k * Math.PI * 11) * 0.15 * Math.sin(Math.min(1, k * 1.25) * Math.PI);
  const radiusBase = spec.startRadius * Math.pow(1 - k, 1.35);
  const radius = radiusBase * (1 - yank * 0.94) + fight * 0.6;
  const angle = spec.startAngle + k * Math.PI * 1.6 + yank * Math.PI * 4.4;
  const y =
    lerp(spec.startY, 1.04, Math.pow(k, 0.72)) +
    Math.sin(k * Math.PI * 13) * 0.11 * (1 - yank) +
    Math.sin(k * Math.PI) * 0.16 -
    yank * 0.1;
  return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
}

// ── the crypt ────────────────────────────────────────────────────────
function buildCrypt() {
  const group = new THREE.Group();
  const glow = glowTexture();
  const floorTex = makeStoneTexture();
  floorTex.repeat.set(7, 7);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(24, 64),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x2b2333, roughness: 0.96, metalness: 0.04 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.4, 0.5, 56),
    new THREE.MeshStandardMaterial({ color: 0x1b1622, roughness: 0.9, metalness: 0.08 })
  );
  plinth.position.y = 0.25;
  group.add(plinth);
  const ringTex = makeRuneRingTexture();
  const plinthRune = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 3.9),
    new THREE.MeshBasicMaterial({
      map: ringTex,
      color: 0x9d74ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  plinthRune.rotation.x = -Math.PI / 2;
  plinthRune.position.y = 0.505;
  group.add(plinthRune);
  const floorRune = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 8.6),
    new THREE.MeshBasicMaterial({
      map: ringTex,
      color: 0x7d54d8,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  floorRune.rotation.x = -Math.PI / 2;
  floorRune.position.y = 0.012;
  group.add(floorRune);
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xcabfa8, roughness: 0.86, metalness: 0.04 });
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.65 + Math.random() * 2.9;
    const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.18 + Math.random() * 0.34, 4, 8), boneMat);
    bone.position.set(Math.cos(a) * r, 0.03, Math.sin(a) * r);
    bone.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
    group.add(bone);
  }
  const socketMat = new THREE.MeshBasicMaterial({ color: 0x06030b });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.85;
    const r = 3 + Math.random() * 0.9;
    const skull = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 12), boneMat);
    cranium.scale.set(1, 1.04, 1.16);
    skull.add(cranium);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.048, 0.12), boneMat);
    jaw.position.set(0, -0.098, 0.055);
    skull.add(jaw);
    [-0.05, 0.05].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), socketMat);
      eye.position.set(x, 0.022, 0.118);
      skull.add(eye);
    });
    skull.position.set(Math.cos(a) * r, 0.13, Math.sin(a) * r);
    skull.rotation.y = a + Math.PI + (Math.random() - 0.5) * 0.8;
    group.add(skull);
  }
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x161220, roughness: 0.94 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.35;
    const h = 6.5 + Math.random() * 2.5;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.54, h, 18), pillarMat);
    pillar.position.set(Math.cos(a) * 7.6, h / 2, Math.sin(a) * 7.6);
    group.add(pillar);
  }
  const candles = [];
  const waxMat = new THREE.MeshStandardMaterial({
    color: 0xe6d9c3,
    roughness: 0.72,
    emissive: 0x2a1a08,
    emissiveIntensity: 0.5,
  });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.15;
    const r = 2.85 + (i % 3) * 0.32;
    const h = 0.34 + Math.random() * 0.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.072, h, 10), waxMat);
    candle.position.set(x, h / 2, z);
    group.add(candle);
    const flame = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: 0xffb066,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    flame.scale.setScalar(0.8);
    flame.position.set(x, h + 0.05, z);
    group.add(flame);
    if (i % 3 === 0) {
      const light = new THREE.PointLight(0xffa14d, 1.15, 6.5, 2);
      light.position.copy(flame.position);
      group.add(light);
      candles.push({ flame, light, base: 1.15, seed: Math.random() * 12 });
    } else {
      candles.push({ flame, light: null, base: 0, seed: Math.random() * 12 });
    }
  }
  return { group, candles };
}

// ── the ironbound casket ─────────────────────────────────────────────
function buildCasket() {
  const group = new THREE.Group();
  const W = 1.46;
  const H = 0.8;
  const D = 2.8;
  const wood = new THREE.MeshStandardMaterial({ color: 0x150f0d, roughness: 0.78, metalness: 0.22 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 0.34, metalness: 1 });
  // the shell is built as two halves so it can later split open along the seam
  const halves = [-1, 1].map((side) => {
    const half = new THREE.Group();
    half.position.x = (side * W) / 4;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W / 2, H, D), wood);
    shell.position.y = H / 2;
    half.add(shell);
    [-1, 0, 1].forEach((k) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W / 2 + 0.03, H * 0.94, 0.085), iron);
      band.position.set(0, H / 2, k * D * 0.33);
      half.add(band);
    });
    [-1, 1].forEach((sz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, 0.1), iron);
      post.position.set((side * W) / 4, H / 2, ((sz * D) / 2) * 0.97);
      half.add(post);
    });
    group.add(half);
    return half;
  });
  // five soul slots sunk into the front face, one for each soul
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const halfIndex = i < 2 ? 0 : 1;
    const slotSide = halfIndex === 0 ? -1 : 1;
    const slot = new THREE.Group();
    slot.position.set((i - 2) * 0.27 - (slotSide * W) / 4, H * 0.52, D / 2 + 0.004);
    slot.add(new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.015, 10, 30), iron));
    const well = new THREE.Mesh(new THREE.CircleGeometry(0.07, 26), new THREE.MeshBasicMaterial({ color: 0x08050f }));
    well.position.z = 0.003;
    slot.add(well);
    const ember = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 26),
      new THREE.MeshBasicMaterial({
        color: 0x9a6bff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ember.position.z = 0.007;
    slot.add(ember);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xa87bff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glow.scale.setScalar(0.55);
    glow.position.z = 0.03;
    slot.add(glow);
    // the slot keeps burning in its soul's colour once that soul is sealed
    const light = new THREE.PointLight(SOUL_SPECS[i].color, 0, 2.6, 2);
    light.position.set(0, 0, 0.16);
    slot.add(light);
    halves[halfIndex].add(slot);
    slots.push({ ember, glow, value: 0, light });
  }
  // rivets along the front and lid edges, riding on their own half
  for (let i = 0; i < 16; i++) {
    const x = -W / 2 + 0.06 + (i / 15) * (W - 0.12);
    const side = x < 0 ? -1 : 1;
    const half = halves[side < 0 ? 0 : 1];
    const localX = x - (side * W) / 4;
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), iron);
    rivet.position.set(localX, H * 0.9, D / 2 + 0.012);
    half.add(rivet);
    const cap = rivet.clone();
    cap.position.set(localX, H * 0.9, -D / 2 - 0.012);
    half.add(cap);
  }
  // chains draped around the base
  [0.11, 0.66].forEach((y, idx) => {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.98 + idx * 0.03, 0.028, 8, 72), iron);
    chain.rotation.x = Math.PI / 2;
    chain.scale.set(1, 1.58, 1);
    chain.position.y = y;
    group.add(chain);
  });
  // jagged obsidian spikes clawing up around the base
  const obsidian = new THREE.MeshStandardMaterial({
    color: 0x0a0712,
    roughness: 0.16,
    metalness: 0.72,
    emissive: 0x2c0f42,
    emissiveIntensity: 0.6,
  });
  const socketMat = new THREE.MeshBasicMaterial({ color: 0x06030b });
  const spikes = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + 0.1;
    const r = 1 + Math.random() * 0.5;
    const h = 0.32 + Math.random() * 0.85;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05 + Math.random() * 0.055, h, 4), obsidian);
    spike.position.set(Math.cos(a) * r, h * 0.34, Math.sin(a) * r);
    spike.rotation.set((Math.random() - 0.5) * 0.45, Math.random() * Math.PI, (Math.random() - 0.5) * 0.45);
    group.add(spike);
    spikes.push(spike);
  }
  // veins in the iron that ignite as each soul is sealed
  const veinMats = [];
  [0.33, 0.57, 0.72].forEach((y, i) => {
    const mat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xa072ff : 0x7de8a6,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const vein = new THREE.Mesh(new THREE.TorusGeometry(0.94 + i * 0.02, 0.007, 6, 84), mat);
    vein.rotation.x = Math.PI / 2;
    vein.scale.set(1, 1.62, 1);
    vein.position.y = y;
    group.add(vein);
    veinMats.push(mat);
  });
  // gothic arches burning on the far flank
  const archMat = new THREE.MeshBasicMaterial({
    color: 0x9a63ff,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const archGeo = new THREE.TorusGeometry(0.2, 0.015, 8, 26, Math.PI);
  const legGeo = new THREE.BoxGeometry(0.026, 0.34, 0.026);
  for (let i = -1; i <= 1; i++) {
    const x = i * W * 0.3;
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(x, H * 0.56, -D / 2 - 0.022);
    arch.rotation.y = Math.PI;
    group.add(arch);
    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(legGeo, archMat);
      leg.position.set(x + s * 0.2, H * 0.56 - 0.17, -D / 2 - 0.022);
      group.add(leg);
    });
  }
  veinMats.push(archMat);
  const innerLight = new THREE.PointLight(0x8b5cf6, 1.5, 5.5, 2);
  innerLight.position.set(0, H * 0.95, 0);
  group.add(innerLight);
  const lid = new THREE.Group();
  lid.position.set(0, H, -D / 2);
  lid.rotation.x = -1.62;
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(W + 0.09, 0.15, D + 0.06), wood);
  lidMesh.position.set(0, 0.075, D / 2);
  lid.add(lidMesh);
  const lidBands = [-1, 0, 1].map((k) => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.04, 0.1), iron);
    band.position.set(0, 0.155, D / 2 + k * D * 0.33);
    lid.add(band);
    return band;
  });
  const sigilMat = new THREE.MeshBasicMaterial({
    map: makeSigilTexture(),
    color: 0xb98bff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.84, D * 0.84), sigilMat);
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.set(0, 0.158, D / 2);
  lid.add(sigil);
  // a jagged crown of obsidian shards around the lid
  for (let i = 0; i < 10; i++) {
    const z = D * 0.08 + (i / 9) * D * 0.84;
    const sideSign = i % 2 === 0 ? -1 : 1;
    const h = 0.26 + Math.random() * 0.4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04 + Math.random() * 0.04, h, 4), obsidian);
    spike.position.set(sideSign * (W / 2 + 0.02), 0.16 + h * 0.3, z);
    spike.rotation.z = -sideSign * (0.24 + Math.random() * 0.28);
    spike.rotation.x = (Math.random() - 0.5) * 0.4;
    lid.add(spike);
    spikes.push(spike);
  }
  // skulls watching from the corners of the lid
  const lidBone = new THREE.MeshStandardMaterial({
    color: 0xbcb096,
    roughness: 0.88,
    emissive: 0x1a0f24,
    emissiveIntensity: 0.45,
  });
  [
    [-1, 0.16],
    [1, 0.16],
    [-1, D - 0.26],
    [1, D - 0.26],
  ].forEach(([sx, z]) => {
    const skull = new THREE.Group();
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), lidBone);
    cranium.scale.set(1, 1.05, 1.16);
    skull.add(cranium);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.03, 0.07), lidBone);
    jaw.position.set(0, -0.06, 0.032);
    skull.add(jaw);
    [-1, 1].forEach((e) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), socketMat);
      eye.position.set(e * 0.03, 0.016, 0.072);
      skull.add(eye);
    });
    skull.position.set(sx * W * 0.36, 0.19, z);
    skull.rotation.y = sx * 0.6;
    lid.add(skull);
  });
  group.add(lid);
  return { group, lid, lidBands, innerLight, sigilMat, slots, halves, spikes, veinMats };
}

// ── souls, dust, mist ────────────────────────────────────────────────

function buildParticles() {
  const glow = glowTexture();
  const dustCount = 720;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const r = Math.pow(Math.random(), 0.6) * 10;
    const a = Math.random() * Math.PI * 2;
    dustPositions[i * 3] = Math.cos(a) * r;
    dustPositions[i * 3 + 1] = Math.random() * 7;
    dustPositions[i * 3 + 2] = Math.sin(a) * r;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      size: 0.055,
      map: glow,
      color: 0xcac3ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const emberCount = 260;
  const emberPositions = new Float32Array(emberCount * 3);
  for (let i = 0; i < emberCount; i++) {
    const r = Math.pow(Math.random(), 0.5) * 2.1;
    const a = Math.random() * Math.PI * 2;
    emberPositions[i * 3] = Math.cos(a) * r;
    emberPositions[i * 3 + 1] = Math.random() * 3;
    emberPositions[i * 3 + 2] = Math.sin(a) * r;
  }
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      size: 0.075,
      map: glow,
      color: 0xffb066,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  return { dust, embers };
}

function buildMist() {
  const smoke = makeSmokeTexture();
  const group = new THREE.Group();
  const veils = [];
  for (let i = 0; i < 18; i++) {
    const material = new THREE.SpriteMaterial({
      map: smoke,
      color: i % 3 === 0 ? 0x4c3f66 : 0x241d33,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(material);
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 1.85 + Math.random() * 2.4;
    const y = 0.25 + Math.random() * 2;
    const scale = 1.5 + Math.random() * 2.2;
    sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    sprite.scale.set(scale, scale * 0.68, 1);
    group.add(sprite);
    veils.push({
      sprite,
      angle,
      radius,
      y,
      scale,
      speed: (0.07 + Math.random() * 0.13) * (Math.random() > 0.5 ? 1 : -1),
      phase: Math.random() * Math.PI * 2,
    });
  }
  // low fog sheets that turn slowly on the plinth
  const sheets = [0.14, 0.34, 0.56].map((y, i) => {
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 9.5),
      new THREE.MeshBasicMaterial({
        map: smoke,
        color: 0x2b2340,
        transparent: true,
        opacity: 0.2 - i * 0.035,
        depthWrite: false,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
      })
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = Math.random() * Math.PI;
    sheet.position.y = y;
    group.add(sheet);
    return { sheet, speed: 0.05 * (i % 2 === 0 ? 1 : -1) };
  });
  return { group, veils, sheets };
}

// ── the vortex coiling around the casket ─────────────────────────────
function buildVortex() {
  const group = new THREE.Group();
  const smoke = makeSmokeTexture();
  const shroudCount = 620;
  const shroudPositions = new Float32Array(shroudCount * 3);
  const shroudColors = new Float32Array(shroudCount * 3);
  const shroudParams = [];
  for (let i = 0; i < shroudCount; i++) {
    const tint = 0.07 + Math.random() * 0.11;
    shroudColors[i * 3] = tint * 1.7;
    shroudColors[i * 3 + 1] = tint * 1.05;
    shroudColors[i * 3 + 2] = tint * 2.4;
    shroudParams.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.7 + Math.random() * 1.8,
      y: Math.random() * 3.3,
      speed: 0.32 + Math.random() * 0.85,
      rise: 0.1 + Math.random() * 0.42,
      seed: Math.random() * 12,
    });
  }
  const shroudGeometry = new THREE.BufferGeometry();
  shroudGeometry.setAttribute('position', new THREE.BufferAttribute(shroudPositions, 3));
  shroudGeometry.setAttribute('color', new THREE.BufferAttribute(shroudColors, 3));
  const shroudMat = new THREE.PointsMaterial({
    size: 0.52,
    map: smoke,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const shroud = new THREE.Points(shroudGeometry, shroudMat);
  shroud.frustumCulled = false;
  group.add(shroud);
  const sparkCount = 320;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkColors = new Float32Array(sparkCount * 3);
  const sparkParams = [];
  for (let i = 0; i < sparkCount; i++) {
    const cold = i % 5 === 0;
    sparkColors[i * 3] = cold ? 0.36 : 0.66;
    sparkColors[i * 3 + 1] = cold ? 0.85 : 0.4;
    sparkColors[i * 3 + 2] = cold ? 0.6 : 1;
    sparkParams.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.6 + Math.random() * 2.1,
      y: Math.random() * 3.2,
      speed: 0.5 + Math.random() * 1.1,
      rise: 0.18 + Math.random() * 0.55,
      spin: 0.6 + Math.random() * 1.4,
      seed: Math.random() * 12,
    });
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.075,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);
  // heavy bands of shadow that turn around the casket
  const wisps = [];
  for (let i = 0; i < 14; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smoke,
      color: i % 3 === 0 ? 0x2a1040 : 0x0d0716,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 1.1 + Math.random() * 1.4;
    sprite.scale.set(scale, scale * 0.5, 1);
    group.add(sprite);
    wisps.push({
      sprite,
      mat,
      angle: (i / 14) * Math.PI * 2,
      radius: 1.3 + Math.random() * 1.1,
      y: 0.35 + Math.random() * 2.3,
      speed: (0.16 + Math.random() * 0.22) * (i % 2 === 0 ? 1 : -1),
      scale,
      seed: Math.random() * 12,
    });
  }
  return {
    group,
    shroudMat,
    shroudAttr: shroudGeometry.attributes.position,
    shroudParams,
    sparkMat,
    sparkAttr: sparkGeometry.attributes.position,
    sparkParams,
    wisps,
  };
}

function updateVortex(vortex, time, dt, charge) {
  const boost = 0.4 + charge * 2;
  const pull = 0.9 - charge * 0.3;
  vortex.shroudParams.forEach((p, i) => {
    p.angle += p.speed * dt * boost;
    p.y += p.rise * dt * (0.35 + charge * 1.9);
    if (p.y > 3.5) p.y -= 3.5;
    const funnel = 1 - (p.y / 3.5) * 0.34;
    const radius = p.radius * funnel * pull + Math.sin(time * 1.2 + p.seed) * 0.07;
    vortex.shroudAttr.setXYZ(i, Math.cos(p.angle) * radius, p.y, Math.sin(p.angle) * radius);
  });
  vortex.shroudAttr.needsUpdate = true;
  vortex.shroudMat.opacity = 0.6 + charge * 0.3;
  vortex.sparkParams.forEach((p, i) => {
    p.angle += p.speed * p.spin * dt * boost;
    p.y += p.rise * dt * (0.4 + charge * 2.2);
    if (p.y > 3.3) p.y -= 3.3;
    const radius = p.radius * (1 - charge * 0.24) + Math.sin(time * 2.1 + p.seed) * 0.05;
    vortex.sparkAttr.setXYZ(i, Math.cos(p.angle) * radius, p.y, Math.sin(p.angle) * radius);
  });
  vortex.sparkAttr.needsUpdate = true;
  vortex.sparkMat.opacity = 0.55 + charge * 0.45;
  vortex.sparkMat.size = 0.07 + charge * 0.04;
  vortex.wisps.forEach((w) => {
    w.angle += w.speed * dt * (1 + charge * 2.4);
    const radius = w.radius * (1 - charge * 0.18);
    w.sprite.position.set(
      Math.cos(w.angle) * radius,
      w.y + Math.sin(time * 0.5 + w.seed) * 0.16,
      Math.sin(w.angle) * radius
    );
    const breathe = 1 + Math.sin(time * 0.7 + w.seed) * 0.1;
    w.sprite.scale.set(w.scale * breathe, w.scale * 0.5 * breathe, 1);
    w.mat.opacity = 0.34 + charge * 0.24 + Math.sin(time * 0.8 + w.seed) * 0.07;
  });
}

// ── the Hollow: the necrotic maw behind the seam ─────────────────────
function buildHollow({ width = 1.46, height = 0.8 } = {}) {
  const group = new THREE.Group();
  group.visible = false;
  group.add(
    new THREE.Mesh(new THREE.PlaneGeometry(width * 1.02, height * 0.96), new THREE.MeshBasicMaterial({ color: 0x020603 }))
  );
  const mawMat = new THREE.MeshBasicMaterial({
    map: makeHollowMawTexture(),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const maw = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.15, height * 1.35), mawMat);
  maw.position.z = 0.012;
  group.add(maw);
  const eyeMat = new THREE.MeshBasicMaterial({
    map: makeEyeTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.52, height * 0.52), eyeMat);
  eye.position.z = 0.032;
  group.add(eye);
  const teethTex = makeTeethRingTexture();
  const rings = [0, 1].map((i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: teethTex,
      color: i === 0 ? 0xd6ffd0 : 0x86c98e,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * (1.32 + i * 0.46), height * (1.55 + i * 0.55)), mat);
    mesh.position.z = 0.018 + i * 0.008;
    group.add(mesh);
    return { mesh, mat, spin: i === 0 ? 0.16 : -0.1 };
  });
  const bloomMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0x6bff7a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bloom = new THREE.Sprite(bloomMat);
  bloom.scale.set(width * 2.2, height * 2.6, 1);
  bloom.position.z = 0.008;
  group.add(bloom);
  const light = new THREE.PointLight(0x93ff8a, 0, 15, 2);
  light.position.set(0, 0, 0.45);
  group.add(light);
  // necrotic mist coiling out of the gate
  const smoke = makeSmokeTexture();
  const tendrils = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smoke,
      color: i % 3 === 0 ? 0x4e8f52 : 0x152a1b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.34 + Math.random() * 0.34;
    sprite.scale.set(scale, scale * 0.72, 1);
    group.add(sprite);
    tendrils.push({
      sprite,
      mat,
      angle: (i / 16) * Math.PI * 2 + Math.random() * 0.4,
      radius: 0.34 + Math.random() * 0.36,
      y: (Math.random() - 0.5) * height * 0.9,
      scale,
      seed: Math.random() * 12,
    });
  }
  // motes dragged screaming into the void
  const moteCount = 240;
  const motePositions = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  const moteParams = [];
  for (let i = 0; i < moteCount; i++) {
    moteColors[i * 3] = 0.52 + Math.random() * 0.4;
    moteColors[i * 3 + 1] = 1;
    moteColors[i * 3 + 2] = 0.42 + Math.random() * 0.4;
    moteParams.push({
      phase: Math.random(),
      speed: 0.22 + Math.random() * 0.5,
      angle: Math.random() * Math.PI * 2,
      radius: 0.16 + Math.random() * 0.5,
      y: (Math.random() - 0.5) * height * 0.55,
      swirl: 2.4 + Math.random() * 3.6,
    });
  }
  const moteGeometry = new THREE.BufferGeometry();
  moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  moteGeometry.setAttribute('color', new THREE.BufferAttribute(moteColors, 3));
  const moteMat = new THREE.PointsMaterial({
    size: 0.06,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const motes = new THREE.Points(moteGeometry, moteMat);
  motes.frustumCulled = false;
  group.add(motes);
  return {
    group,
    maw,
    mawMat,
    eye,
    eyeMat,
    rings,
    bloom,
    bloomMat,
    light,
    tendrils,
    moteMat,
    moteAttr: moteGeometry.attributes.position,
    moteParams,
  };
}

function updateHollow(hollow, time, reveal) {
  const on = reveal > 0.001;
  hollow.group.visible = on;
  if (!on) return;
  const r = Math.min(1, reveal);
  // double-thump heartbeat, like something feeding behind the light
  const beat =
    Math.pow(Math.max(0, Math.sin(time * 2.4)), 8) +
    Math.pow(Math.max(0, Math.sin(time * 2.4 - 0.52)), 8) * 0.72;
  const grow = (0.34 + 0.66 * r) * (0.92 + Math.sin(time * 1.3) * 0.05 + beat * 0.11);
  hollow.group.scale.set(grow, grow * (1 + Math.sin(time * 0.9) * 0.04), 1);
  hollow.maw.rotation.z = time * 0.05;
  hollow.mawMat.opacity = r * (0.5 + beat * 0.42 + Math.sin(time * 7.7) * 0.06);
  hollow.eye.rotation.z = Math.sin(time * 0.4) * 0.14;
  hollow.eye.scale.set(1 + beat * 0.05, 1 - beat * 0.13, 1);
  hollow.eyeMat.opacity = r * (0.6 + beat * 0.35);
  hollow.rings.forEach((ring, i) => {
    ring.mat.opacity = r * (0.32 + Math.sin(time * 1.7 + i * 1.2) * 0.15 + beat * 0.14);
    ring.mesh.rotation.z = time * ring.spin;
    const breathe = 1 + Math.sin(time * 1.4 + i) * 0.06 + beat * 0.05;
    ring.mesh.scale.set(breathe, breathe, 1);
  });
  hollow.bloomMat.opacity = r * (0.14 + beat * 0.3);
  hollow.light.intensity = r * (2 + beat * 7 + Math.sin(time * 13.3) * 0.45);
  hollow.tendrils.forEach((t) => {
    const a = t.angle + Math.sin(time * 0.55 + t.seed) * 0.4;
    const radius = t.radius * (1 + beat * 0.14) + Math.sin(time * 0.9 + t.seed) * 0.05;
    t.sprite.position.set(
      Math.cos(a) * radius,
      t.y + Math.sin(time * 0.8 + t.seed) * 0.1,
      0.05 + Math.sin(time * 0.6 + t.seed) * 0.05
    );
    const s = t.scale * (1 + Math.sin(time * 1.5 + t.seed) * 0.12);
    t.sprite.scale.set(s, s * 0.72, 1);
    t.mat.opacity = r * (0.16 + Math.sin(time * 1.1 + t.seed) * 0.09 + beat * 0.1);
  });
  hollow.moteParams.forEach((p, i) => {
    const k = (p.phase + time * p.speed) % 1;
    const radius = p.radius * (1 - k);
    const a = p.angle + k * p.swirl;
    hollow.moteAttr.setXYZ(i, Math.cos(a) * radius, Math.sin(a) * radius + p.y * (1 - k), 0.05);
  });
  hollow.moteAttr.needsUpdate = true;
  hollow.moteMat.opacity = r * (0.6 + beat * 0.4);
}

// ── finale: fire, burst, floor fire, incantations ────────────────────
const INCANTATIONS = [
  'APERITE PORTAE',
  'IGNIS AETERNUS',
  'ANIMA VINCTA MANE',
  'MORS VINCIT OMNIA',
  'VENI AD INFEROS',
];

function buildFloorFire() {
  const group = new THREE.Group();
  group.visible = false;
  const tex = makeFireTexture();
  const flames = [];
  for (let i = 0; i < 48; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.7 + Math.random() * 6.6;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        color: i % 4 === 0 ? 0x8bff9a : 0xff8a35,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const base = 0.4 + Math.random() * 0.7;
    sprite.scale.set(base, base * 1.6, 1);
    sprite.position.set(Math.cos(angle) * radius, 0.14, Math.sin(angle) * radius);
    group.add(sprite);
    flames.push({ sprite, base, seed: Math.random() * 12, radius });
  }
  const light = new THREE.PointLight(0xff7328, 0, 18, 2);
  light.position.set(0, 0.9, 0);
  group.add(light);
  return { group, flames, light };
}

function buildIncantations() {
  const group = new THREE.Group();
  group.visible = false;
  const lines = INCANTATIONS.map((text, i) => {
    const mat = new THREE.SpriteMaterial({
      map: makeIncantationTexture(text),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const baseH = 0.4;
    const baseW = baseH * (1024 / 192);
    sprite.scale.set(baseW, baseH, 1);
    sprite.position.set(
      (i % 2 === 0 ? -1 : 1) * (0.3 + (i % 3) * 0.22),
      1.95 + i * 0.44,
      (Math.random() - 0.5) * 0.6
    );
    group.add(sprite);
    return { sprite, mat, baseW, baseH, baseY: sprite.position.y, seed: Math.random() * 10, index: i };
  });
  return { group, lines };
}

function buildFinale({ width = 1.46, height = 0.8 } = {}) {
  // the Hollow tears open between the halves
  const hollow = buildHollow({ width, height });
  const portal = hollow.group;
  // fire rushing out of the seam
  const fire = new THREE.Group();
  fire.visible = false;
  const fireTex = makeFireTexture();
  const flames = [];
  for (let i = 0; i < 16; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireTex,
        color: [0xd8ffb4, 0xff8a35, 0x8bff9a][i % 3],
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const base = 0.45 + Math.random() * 0.5;
    sprite.scale.set(base, base * 1.95, 1);
    sprite.position.set(0, 0.2, 0.2);
    fire.add(sprite);
    flames.push({
      sprite,
      seed: Math.random() * 12,
      base,
      x: (Math.random() - 0.5) * 0.34,
      y: 0.1 + Math.random() * 0.62,
      z: 0.05 + Math.random() * 0.9,
      rise: 0.5 + Math.random() * 0.8,
    });
  }
  const sparkCount = 90;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkColors = new Float32Array(sparkCount * 3);
  const sparkParams = [];
  for (let i = 0; i < sparkCount; i++) {
    const warm = Math.random() > 0.32;
    sparkColors[i * 3] = 1;
    sparkColors[i * 3 + 1] = warm ? 0.63 : 0.4;
    sparkColors[i * 3 + 2] = warm ? 0.24 : 1;
    sparkParams.push({
      phase: Math.random(),
      speed: 0.3 + Math.random() * 0.5,
      spread: (Math.random() - 0.5) * 0.5,
      depth: 0.15 + Math.random() * 1.0,
      rise: 1.1 + Math.random() * 1.5,
    });
  }
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeometry.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  const sparkMat = new THREE.PointsMaterial({
    size: 0.085,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sparks = new THREE.Points(sparkGeometry, sparkMat);
  sparks.frustumCulled = false;
  fire.add(sparks);
  const fireLight = new THREE.PointLight(0xff7a34, 0, 12, 2);
  fireLight.position.set(0, height * 0.75, 0.4);
  fire.add(fireLight);
  return {
    portal,
    hollow,
    fire,
    flames,
    sparkMat,
    sparkParams,
    sparkAttr: sparkGeometry.attributes.position,
    fireLight,
    floorFire: buildFloorFire(),
    incantations: buildIncantations(),
  };
}

function buildBurst(count = 460) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const dirs = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    dirs[i * 3] = Math.sin(phi) * Math.cos(theta);
    dirs[i * 3 + 1] = Math.abs(Math.cos(phi)) * 0.85 + 0.18;
    dirs[i * 3 + 2] = Math.sin(phi) * Math.sin(theta);
    speeds[i] = 1.3 + Math.random() * 5.2;
    const violet = Math.random() > 0.4;
    colors[i * 3] = violet ? 0.76 : 0.58;
    colors[i * 3 + 1] = violet ? 0.5 : 0.36;
    colors[i * 3 + 2] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.17,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  points.position.set(0, 1.32, 0);
  const light = new THREE.PointLight(0xd2b0ff, 0, 60, 1.7);
  light.position.set(0, 2.3, 0.6);
  return { points, light, count, dirs, speeds, attr: geometry.attributes.position, material };
}

function updateFloorFire(floorFire, time, age) {
  const spread = age * 2.1;
  const on = spread > 0;
  floorFire.group.visible = on;
  if (!on) {
    floorFire.light.intensity = 0;
    floorFire.flames.forEach((f) => {
      f.sprite.material.opacity = 0;
    });
    return;
  }
  floorFire.flames.forEach((f) => {
    const reach = clamp01((spread - (f.radius - 1.7)) / 1.15);
    const flicker = 0.66 + Math.sin(time * 8 + f.seed) * 0.24 + Math.sin(time * 17 + f.seed * 2) * 0.12;
    f.sprite.material.opacity = reach * (0.45 + flicker * 0.4);
    const s = f.base * (0.55 + reach * 0.75) * flicker;
    f.sprite.scale.set(s, s * 1.6, 1);
    f.sprite.position.y = 0.12 + Math.sin(time * 1.3 + f.seed) * 0.05 + reach * 0.06;
  });
  floorFire.light.intensity = Math.min(1, spread / 5) * (5.2 + Math.sin(time * 9) * 1.1);
}

function updateIncantations(incantations, time, age) {
  const on = age > 0;
  incantations.group.visible = on;
  if (!on) {
    incantations.lines.forEach((line) => {
      line.mat.opacity = 0;
    });
    return;
  }
  incantations.lines.forEach((line) => {
    const appear = clamp01((age - line.index * 0.9) / 1.1);
    const flicker = 0.82 + Math.sin(time * 3.1 + line.seed) * 0.18;
    const fade = 1 - clamp01((age - 9) / 8) * 0.35;
    line.mat.opacity = appear * flicker * fade;
    line.sprite.position.y = line.baseY + appear * 0.22 + Math.sin(time * 0.7 + line.seed) * 0.05;
    const s = (0.88 + appear * 0.12) * (1 + Math.sin(time * 1.6 + line.seed) * 0.02);
    line.sprite.scale.set(line.baseW * s, line.baseH * s, 1);
  });
}

function updateFinale(state, burst, { time, splitT, fireT, burstAge, floorAge, incantAge }) {
  state.portal.visible = splitT > 0.001;
  updateHollow(state.hollow, time, splitT);
  const fireOn = fireT > 0.001;
  state.fire.visible = fireOn;
  if (fireOn) {
    state.flames.forEach((flame) => {
      const flicker =
        0.72 + Math.sin(time * 7.5 + flame.seed) * 0.22 + Math.sin(time * 15 + flame.seed * 2) * 0.12;
      flame.sprite.position.set(
        flame.x + Math.sin(time * 1.7 + flame.seed) * 0.06,
        flame.y + Math.sin(time * 1.1 + flame.seed) * 0.12 * flame.rise,
        flame.z
      );
      const s = flame.base * (0.55 + fireT * 1.05) * flicker;
      flame.sprite.scale.set(s, s * 1.95, 1);
      flame.sprite.material.opacity = Math.min(1, fireT) * (0.4 + flicker * 0.45);
    });
    state.sparkParams.forEach((p, i) => {
      const k = (p.phase + time * p.speed) % 1;
      state.sparkAttr.setXYZ(i, p.spread * k, 0.15 + k * p.rise, p.depth * (0.2 + k));
    });
    state.sparkAttr.needsUpdate = true;
    state.sparkMat.opacity = Math.min(1, fireT) * 0.9;
    state.fireLight.intensity = fireT * (4.6 + Math.sin(time * 11) * 1.4);
  } else {
    state.sparkMat.opacity = 0;
    state.fireLight.intensity = 0;
  }
  const life = 3.6;
  const alive = burstAge > 0 && burstAge < life;
  burst.points.visible = alive;
  burst.light.intensity = burstAge > 0 ? Math.max(0, 1 - burstAge / 0.55) * 44 : 0;
  if (alive) {
    const d = Math.pow(burstAge, 0.68);
    for (let i = 0; i < burst.count; i++) {
      const s = burst.speeds[i] * d;
      burst.attr.setXYZ(
        i,
        burst.dirs[i * 3] * s,
        burst.dirs[i * 3 + 1] * s - burstAge * burstAge * 0.85,
        burst.dirs[i * 3 + 2] * s
      );
    }
    burst.attr.needsUpdate = true;
    burst.material.opacity = Math.pow(1 - burstAge / life, 1.5);
  }
  updateFloorFire(state.floorFire, time, floorAge);
  updateIncantations(state.incantations, time, incantAge);
}

// ── the scene ────────────────────────────────────────────────────────
export default function CursedCasketScene({ playing = true, restartToken = 0, onSeal, onLoop }) {
  const mountRef = useRef(null);
  const playingRef = useRef(playing);
  const resetRef = useRef(null);
  const stepRef = useRef(null);
  const sealRef = useRef(onSeal);
  const loopRef = useRef(onLoop);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    sealRef.current = onSeal;
    loopRef.current = onLoop;
  }, [onSeal, onLoop]);

  useEffect(() => {
    if (restartToken > 0) resetRef.current?.();
  }, [restartToken]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05030a);
    scene.fog = new THREE.FogExp2(0x05030a, 0.047);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 130);
    const lookAt = new THREE.Vector3();
    const ambient = new THREE.AmbientLight(0x3a2f52, 0.6);
    scene.add(ambient);
    const moon = new THREE.DirectionalLight(0x8b93ff, 0.4);
    moon.position.set(-5, 9, -7);
    scene.add(moon);

    const crypt = buildCrypt();
    scene.add(crypt.group);
    const casket = buildCasket();
    casket.group.position.y = 0.5;
    scene.add(casket.group);
    const finale = buildFinale({ width: 1.46, height: 0.8 });
    finale.portal.position.y = 0.4;
    casket.group.add(finale.portal);
    casket.group.add(finale.fire);
    scene.add(finale.floorFire.group);
    scene.add(finale.incantations.group);
    const burst = buildBurst();
    scene.add(burst.points);
    scene.add(burst.light);
    const souls = SOUL_SPECS.map((spec) => {
      const soul = buildSoul(spec);
      soul.group.visible = false;
      const spawn = soulPath(0, spec);
      soul.history = Array.from({ length: soul.trailCount }, () => new THREE.Vector3(spawn.x, spawn.y, spawn.z));
      soul.sealed = false;
      scene.add(soul.group);
      scene.add(soul.trail);
      return soul;
    });
    const particles = buildParticles();
    scene.add(particles.dust);
    scene.add(particles.embers);
    const mist = buildMist();
    scene.add(mist.group);
    const vortex = buildVortex();
    scene.add(vortex.group);
    const shadows = buildShadowVeil();
    scene.add(shadows.group);
    const rings = souls.map(() => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.55, 72),
        new THREE.MeshBasicMaterial({
          color: 0xa882ff,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 1.34, 0);
      scene.add(mesh);
      return { mesh, t: -1 };
    });

    let elapsed = 0;
    let flash = 0;
    let shake = 0;
    let slammed = false;
    let released = 0;
    let queued = false;
    let finaleStart = -1;
    const releases = new Array(SOUL_SPECS.length).fill(-1);
    const clock = new THREE.Clock();
    let raf = 0;

    const resetCycle = () => {
      souls.forEach((soul, i) => {
        soul.sealed = false;
        soul.group.visible = false;
        soul.trail.visible = false;
        const spawn = soulPath(0, SOUL_SPECS[i]);
        soul.history.forEach((v) => v.set(spawn.x, spawn.y, spawn.z));
      });
      rings.forEach((ring) => {
        ring.t = -1;
        ring.mesh.material.opacity = 0;
      });
      casket.slots.forEach((slot) => {
        slot.value = 0;
      });
      finale.portal.visible = false;
      finale.fire.visible = false;
      burst.points.visible = false;
      burst.light.intensity = 0;
      flash = 0;
      shake = 0;
      slammed = false;
      released = 0;
      queued = false;
      finaleStart = -1;
      releases.fill(-1);
      casket.innerLight.color.set(0x8b5cf6);
    };
    resetRef.current = () => {
      elapsed = 0;
      resetCycle();
    };
    // every tap on the crypt feeds the next soul in by hand — a tap landing while a
    // soul is still falling is held until it seals, so the descent is never muddled
    const busied = () => released > 0 && releases[released - 1] >= 0 && elapsed - releases[released - 1] < TIMELINE.soulTravel;
    stepRef.current = () => {
      if (released >= SOUL_SPECS.length) return;
      if (busied()) {
        queued = true;
        return;
      }
      releases[released] = elapsed;
      released += 1;
      queued = false;
    };

    const update = (time, dt) => {
      const finaleAge = finaleStart < 0 ? -1 : time - finaleStart;
      // the camera never turns or pushes in — it just holds the casket head-on
      const fit = Math.max(1, 1.2 / camera.aspect);
      camera.position.set(
        CAMERA.position[0],
        CAMERA.target[1] + (CAMERA.position[1] - CAMERA.target[1]) * fit,
        CAMERA.target[2] + (CAMERA.position[2] - CAMERA.target[2]) * fit
      );
      lookAt.set(CAMERA.target[0], CAMERA.target[1], CAMERA.target[2]);
      camera.lookAt(lookAt);
      if (shake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * shake * 0.24;
        camera.position.y += (Math.random() - 0.5) * shake * 0.2;
        camera.rotation.z += (Math.random() - 0.5) * shake * 0.05;
      }
      flash = Math.max(0, flash - dt * 2.1);

      const started = finaleAge >= 0;
      const closeT = started ? smoothstep(FINALE.lidStart, FINALE.lidEnd, finaleAge) : 0;
      const splitT = started ? smoothstep(FINALE.splitStart, FINALE.splitEnd, finaleAge) : 0;
      const fireT = started ? smoothstep(FINALE.fireStart, FINALE.fireEnd, finaleAge) : 0;
      const burstAge = started ? finaleAge - FINALE.lidEnd : -1;

      const wobble = closeT > 0 && closeT < 1 ? Math.sin(time * 54) * 0.022 : 0;
      casket.lid.rotation.x = -1.62 * (1 - closeT) + flash * 0.05 * Math.sin(time * 60) + wobble + splitT * 1.15;
      casket.lid.rotation.z = splitT * 0.8;
      casket.lid.position.y = 0.8 + splitT * splitT * 7.2;
      casket.lid.position.z = -1.4 - splitT * 2.4;
      casket.halves.forEach((half, i) => {
        const side = i === 0 ? -1 : 1;
        const push = splitT * (0.82 + Math.sin(time * 2.4 + i) * 0.015);
        half.position.x = (side * 1.46) / 4 + side * push;
        half.position.y = -splitT * 0.05;
        half.rotation.z = -side * splitT * 0.14;
      });

      // the casket wakes as it feeds — it trembles, its shards grow, its veins ignite
      const sealedCount = souls.reduce((n, soul) => n + (soul.sealed ? 1 : 0), 0);
      const menace = sealedCount / 5;
      const tremble = 0.004 + menace * 0.013 + flash * 0.012;
      // the capsule hums harder with every soul it swallows
      const hum = (0.0015 + menace * 0.008 + flash * 0.004) * (0.4 + 0.6 * Math.abs(Math.sin(time * 64)));
      casket.group.position.x = Math.sin(time * 37) * tremble + Math.sin(time * 97) * hum;
      casket.group.position.z = Math.cos(time * 43) * tremble + Math.cos(time * 113) * hum;
      casket.group.position.y = 0.5 + Math.sin(time * 58) * hum * 0.7;
      casket.group.rotation.y = Math.sin(time * 27) * tremble * 0.9;
      casket.group.rotation.z = Math.sin(time * 71) * hum * 0.8;
      if (finaleAge > FINALE.lidEnd && !slammed) {
        slammed = true;
        shake = 2.2;
      }
      shake = Math.max(0, shake - dt * 2);
      casket.spikes.forEach((spike, i) => {
        spike.scale.setScalar(0.62 + menace * 0.95 + Math.sin(time * 3.2 + i) * 0.05);
      });
      casket.veinMats.forEach((mat, i) => {
        mat.opacity = 0.06 + menace * 0.6 * (0.62 + Math.sin(time * (3 + i * 0.7)) * 0.38) + flash * 0.35;
      });
      // the light inside takes the colour of the element it last devoured
      let chargeTint = null;
      souls.forEach((soul) => {
        if (soul.sealed) chargeTint = soul.color;
      });
      if (chargeTint) casket.innerLight.color.lerp(chargeTint, Math.min(1, dt * 2.5));
      casket.innerLight.intensity =
        1.35 +
        Math.sin(time * 1.9) * 0.35 +
        flash * 9 +
        closeT * 0.6 +
        splitT * 3.4 +
        menace * (2.6 + Math.sin(time * (9 + menace * 12)) * 1.7);
      casket.sigilMat.opacity = 0.55 + closeT * 0.45 + flash * 0.3;

      crypt.candles.forEach((candle) => {
        const flicker =
          0.78 + Math.sin(time * 9 + candle.seed) * 0.14 + Math.sin(time * 23 + candle.seed * 2) * 0.08;
        candle.flame.scale.setScalar(0.66 + flicker * 0.22);
        if (candle.light) candle.light.intensity = candle.base * flicker;
      });

      if (queued && released < SOUL_SPECS.length && !busied()) {
        releases[released] = time;
        released += 1;
        queued = false;
      }

      souls.forEach((soul, i) => {
        const start = releases[i];
        const t = start < 0 ? -1 : (time - start) / TIMELINE.soulTravel;
        soul.trail.visible = false;
        if (t <= 0) {
          soul.group.visible = false;
          return;
        }
        if (t >= 1) {
          soul.group.visible = false;
          if (!soul.sealed) {
            soul.sealed = true;
            rings[i].t = 0;
            flash = 1;
            shake = Math.max(shake, 0.8);
            sealRef.current?.(i + 1);
            // the fifth seal is what sets the whole finale in motion
            if (i === souls.length - 1) finaleStart = time;
          }
          return;
        }
        const p = soulPath(t, SOUL_SPECS[i]);
        soul.group.position.set(p.x, p.y, p.z);
        const yank = soulYank(t);
        const fade = smoothstep(0, 0.16, t) * (1 - smoothstep(0.84, 1, t));
        soul.group.visible = fade > 0.01;
        updateSoul(soul, i, time, dt, fade, yank);
      });

      rings.forEach((ring) => {
        if (ring.t < 0) return;
        ring.t += dt;
        const k = ring.t / 1.6;
        if (k >= 1) {
          ring.mesh.material.opacity = 0;
          ring.t = -1;
          return;
        }
        ring.mesh.scale.setScalar(0.6 + k * 4.4);
        ring.mesh.material.opacity = (1 - k) * 0.85;
      });

      particles.dust.rotation.y = time * 0.018;
      particles.embers.position.y = (time * 0.22) % 3;

      casket.slots.forEach((slot, i) => {
        const target = souls[i].sealed ? 1 : 0;
        slot.value += (target - slot.value) * Math.min(1, dt * 3);
        const flicker = 0.85 + Math.sin(time * 6 + i * 1.7) * 0.15;
        slot.ember.material.opacity = Math.min(1, slot.value * flicker + flash * 0.12);
        slot.glow.material.opacity = slot.value * 0.78 * flicker;
        slot.glow.scale.setScalar(0.42 + slot.value * 0.6 + Math.sin(time * 4 + i) * 0.03);
        slot.light.intensity = slot.value * (1.8 + Math.sin(time * 7 + i * 2.1) * 0.7 + menace * 2.6);
      });

      mist.veils.forEach((veil) => {
        veil.angle += veil.speed * dt;
        veil.sprite.position.set(
          Math.cos(veil.angle) * veil.radius,
          veil.y + Math.sin(time * 0.42 + veil.phase) * 0.18,
          Math.sin(veil.angle) * veil.radius
        );
        veil.sprite.material.opacity = 0.21 + Math.sin(time * 0.55 + veil.phase) * 0.075;
        veil.sprite.material.rotation = Math.sin(time * 0.18 + veil.phase) * 0.5;
        const breathe = 1 + Math.sin(time * 0.5 + veil.phase) * 0.07;
        veil.sprite.scale.set(veil.scale * breathe, veil.scale * 0.68 * breathe, 1);
      });
      mist.sheets.forEach(({ sheet, speed }, i) => {
        sheet.rotation.z += speed * dt;
        sheet.material.opacity = 0.15 + Math.sin(time * 0.35 + i * 1.4) * 0.04;
      });

      updateVortex(vortex, time, dt, Math.min(1, sealedCount / 5) * 0.8 + splitT * 0.2);
      updateFinale(finale, burst, {
        time,
        splitT,
        fireT,
        burstAge,
        floorAge: started ? finaleAge - FINALE.floorFire : -1,
        incantAge: started ? finaleAge - FINALE.incant : -1,
      });
      // the crypt stutters between darkness and half-light, and the shadows crawl
      ambient.intensity =
        0.62 * (0.7 + Math.sin(time * 11.3) * 0.14 + Math.sin(time * 27.7) * 0.09 + flash * 0.5) * (1 - menace * 0.2);
      updateShadowVeil(shadows, time, dt, menace);
    };

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (playingRef.current && !document.hidden) elapsed += dt;
      if (finaleStart >= 0 && elapsed - finaleStart > FINALE.length) {
        resetCycle();
        loopRef.current?.();
      }
      update(elapsed, dt);
      renderer.render(scene, camera);
    };

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      resetRef.current = null;
      stepRef.current = null;
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((mat) => {
            ['map', 'emissiveMap', 'alphaMap'].forEach((key) => {
              if (mat[key]) mat[key].dispose();
            });
            mat.dispose();
          });
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      onClick={() => stepRef.current?.()}
      className="absolute inset-0 cursor-pointer"
    />
  );
}