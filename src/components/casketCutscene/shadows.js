import * as THREE from 'three';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

let cachedShadow = null;
const shadowTexture = () => {
  if (cachedShadow) return cachedShadow;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.96)');
  g.addColorStop(0.42, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // tear the edges so the smother never reads as a clean circle
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 44; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = size * 0.3 + Math.random() * size * 0.2;
    const rr = size * 0.05 + Math.random() * size * 0.12;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, rr);
    gg.addColorStop(0, 'rgba(0,0,0,0.8)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  cachedShadow = new THREE.CanvasTexture(canvas);
  cachedShadow.colorSpace = THREE.SRGBColorSpace;
  return cachedShadow;
};

// ── dark shadows that smother the crypt and stutter in and out ───────
export function buildShadowVeil() {
  const group = new THREE.Group();
  const map = shadowTexture();
  const veils = [];
  for (let i = 0; i < 28; i++) {
    const mat = new THREE.SpriteMaterial({
      map,
      color: 0x04030a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.24;
    const radius = 3 + Math.random() * 5.6;
    const y = 0.5 + Math.random() * 3.8;
    const scale = 1.9 + Math.random() * 2.8;
    sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    sprite.scale.set(scale, scale * (1.15 + Math.random() * 0.7), 1);
    group.add(sprite);
    veils.push({
      sprite,
      mat,
      angle,
      radius,
      y,
      scale,
      speed: (0.04 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
      seed: Math.random() * 12,
      flick: 2.2 + Math.random() * 4.4,
    });
  }
  const blobs = [];
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map,
      color: 0x030208,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    const angle = Math.random() * Math.PI * 2;
    const radius = 1.8 + Math.random() * 5.6;
    mesh.position.set(Math.cos(angle) * radius, 0.02 + Math.random() * 0.012, Math.sin(angle) * radius);
    const base = 1.7 + Math.random() * 3.4;
    mesh.scale.set(base, base * 1.15, 1);
    group.add(mesh);
    blobs.push({
      mesh,
      mat,
      base,
      seed: Math.random() * 12,
      speed: 3.4 + Math.random() * 6.2,
      drift: (Math.random() - 0.5) * 0.16,
    });
  }
  return { group, veils, blobs };
}

export function updateShadowVeil(veil, time, dt, menace) {
  const energy = 0.36 + menace * 0.34;
  veil.veils.forEach((v) => {
    v.angle += v.speed * dt;
    const breathe = Math.sin(time * v.flick + v.seed) * 0.5 + Math.sin(time * v.flick * 2.3 + v.seed * 3) * 0.3;
    const jolt = Math.sin(time * v.flick * 0.6 + v.seed * 5);
    const flick = clamp01(0.55 + breathe * 0.5 + (jolt > 0.82 ? -0.75 : 0));
    v.mat.opacity = Math.min(0.95, energy * (0.3 + flick * 0.95));
    const s = v.scale * (0.9 + flick * 0.2);
    v.sprite.scale.set(s, s * 1.35, 1);
    v.sprite.position.set(
      Math.cos(v.angle) * v.radius,
      v.y + Math.sin(time * 0.5 + v.seed) * 0.22,
      Math.sin(v.angle) * v.radius
    );
  });
  veil.blobs.forEach((b) => {
    b.mat.opacity = Math.min(0.88, (0.26 + menace * 0.34) * (0.45 + Math.sin(time * b.speed + b.seed) * 0.55));
    b.mesh.rotation.z = time * b.drift;
    const s = b.base * (0.88 + Math.sin(time * b.speed * 0.3 + b.seed) * 0.16);
    b.mesh.scale.set(s, s * 1.15, 1);
  });
}