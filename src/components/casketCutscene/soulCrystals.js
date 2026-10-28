import * as THREE from 'three';

// ── textures ─────────────────────────────────────────────────────────
const canvasTex = (canvas) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

let cachedGlow = null;
const glowTexture = () => {
  if (cachedGlow) return cachedGlow;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.52, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cachedGlow = canvasTex(canvas);
  return cachedGlow;
};

let cachedEmber = null;
const emberTexture = () => {
  if (cachedEmber) return cachedEmber;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,232,176,0.9)');
  g.addColorStop(0.52, 'rgba(255,140,56,0.36)');
  g.addColorStop(1, 'rgba(255,86,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cachedEmber = canvasTex(canvas);
  return cachedEmber;
};

// ── the five souls: emerald, sand, frost, magma, void ────────────────
export const SOUL_SPECS = [
  { element: 'verdant', color: 0x2ce08a, startAngle: 0.5, startRadius: 3.4, startY: 3.5 },
  { element: 'sand', color: 0xe8c07a, startAngle: 1.78, startRadius: 3.15, startY: 3.78 },
  { element: 'frost', color: 0x9fe8ff, startAngle: 3.02, startRadius: 3.5, startY: 3.58 },
  { element: 'magma', color: 0xff6420, startAngle: 4.24, startRadius: 3.1, startY: 3.92 },
  { element: 'void', color: 0x8b5cff, startAngle: 5.46, startRadius: 3.42, startY: 3.68 },
];

const SWARM_SIZE = { verdant: 0.062, sand: 0.046, frost: 0.055, magma: 0.082, void: 0.05 };

function makeSwarm(element, color) {
  const count = element === 'magma' ? 116 : 92;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = [];
  const white = new THREE.Color(0xffffff);
  const base = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const c = base.clone().lerp(white, Math.random() * (element === 'void' ? 0.12 : 0.34));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    params.push({
      seed: Math.random() * Math.PI * 2,
      phase: Math.random(),
      angle: Math.random() * Math.PI * 2,
      radius: 0.04 + Math.random() * 0.18,
      y: (Math.random() - 0.5) * 0.36,
      speed: 0.5 + Math.random() * 0.9,
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: SWARM_SIZE[element] || 0.055,
    map: element === 'magma' ? emberTexture() : glowTexture(),
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material, attr: geometry.attributes.position, params };
}

function updateSwarm(swarm, element, time, fade, yank) {
  const boost = 1 + yank * 1.8;
  swarm.params.forEach((p, i) => {
    let x;
    let y;
    let z;
    if (element === 'verdant') {
      // spores lifting in a slow spiral
      const k = (p.phase + time * p.speed * 0.16) % 1;
      const r = p.radius * (0.5 + k * 0.9);
      const a = p.angle + k * 2.4;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = -0.18 + k * 0.66 + Math.sin(time * 1.7 + p.seed) * 0.03;
    } else if (element === 'sand') {
      // grains caught in a whirling dust devil
      const k = (p.phase + time * p.speed * 0.5) % 1;
      const a = p.angle + time * (1.4 + p.speed);
      const r = p.radius * (0.75 + Math.sin(time + p.seed) * 0.2);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = p.y + 0.18 - k * 0.4;
    } else if (element === 'frost') {
      // snow drifting down and glittering
      const k = (p.phase + time * p.speed * 0.22) % 1;
      x = p.radius * Math.sin(p.seed + k * 6) + Math.sin(time * 0.7 + p.seed) * 0.03;
      z = p.radius * Math.cos(p.seed * 1.7 + k * 5);
      y = 0.32 - k * 0.6;
    } else if (element === 'magma') {
      // sparks and fire spewing off the shard, arcing back down
      const k = (p.phase + time * p.speed * 0.55 * boost) % 1;
      const spread = p.radius * (1 + k * 1.7);
      const a = p.angle + k * 1.2;
      x = Math.cos(a) * spread;
      z = Math.sin(a) * spread;
      y = -0.22 + k * 1.1 - k * k * 0.6;
    } else {
      // void motes spiral inward and are eaten
      const k = (p.phase + time * p.speed * 0.3) % 1;
      const r = p.radius * (1.6 - k * 1.5) * (1 - yank * 0.3);
      const a = p.angle + k * 5.2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      y = p.y * (1 - k) + Math.sin(time * 2 + p.seed) * 0.02;
    }
    swarm.attr.setXYZ(i, x, y, z);
  });
  swarm.attr.needsUpdate = true;
  swarm.material.opacity = fade * (element === 'void' ? 0.78 : 0.92);
  if (element === 'magma') swarm.material.size = 0.082 + Math.sin(time * 9) * 0.014 + yank * 0.03;
}

export function buildSoul(spec) {
  const group = new THREE.Group();
  const glow = glowTexture();
  const element = spec.element || 'void';
  const color = new THREE.Color(spec.color);
  const rim = new THREE.Color(spec.color).lerp(new THREE.Color(0xffffff), 0.6);
  const shards = new THREE.Group();
  const fadeMats = [];
  const addFade = (mat, base) => {
    mat.opacity = base;
    mat.transparent = true;
    fadeMats.push({ mat, base });
    return mat;
  };

  const crystalMat = new THREE.MeshStandardMaterial({
    color: element === 'void' ? new THREE.Color(0x150b26) : color,
    emissive: color,
    emissiveIntensity: element === 'void' ? 1.7 : 1.3,
    metalness: element === 'sand' ? 0.18 : 0.5,
    roughness: element === 'sand' ? 0.34 : 0.06,
    transparent: true,
    opacity: 0.92,
    flatShading: true,
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: rim,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const facet = (geo, parent) => {
    parent.add(new THREE.Mesh(geo, crystalMat));
    parent.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  };

  // the main spine, a slightly different silhouette per element
  const spineGeo = new THREE.OctahedronGeometry(0.1, 0);
  spineGeo.scale(1, element === 'sand' ? 2.2 : 2.7, 1);
  facet(spineGeo, shards);
  if (element === 'magma') {
    // molten cracks glowing just above the facets
    const lavaMat = addFade(
      new THREE.LineBasicMaterial({
        color: 0xffd28a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.8
    );
    const cracks = new THREE.LineSegments(new THREE.EdgesGeometry(spineGeo), lavaMat);
    cracks.scale.setScalar(1.03);
    shards.add(cracks);
  }

  const fragments = [];
  for (let i = 0; i < 4; i++) {
    const node = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.03 + Math.random() * 0.028, 0);
    geo.scale(0.9, 1.7, 0.9);
    facet(geo, node);
    const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.6;
    const orbit = 0.12 + Math.random() * 0.09;
    node.position.set(Math.cos(angle) * orbit, (Math.random() - 0.5) * 0.24, Math.sin(angle) * orbit);
    shards.add(node);
    fragments.push({
      node,
      angle,
      orbit,
      y: node.position.y,
      spin: (Math.random() - 0.5) * 4.2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // signature ornament, unique to each element
  const decor = new THREE.Group();
  shards.add(decor);
  const flames = [];

  if (element === 'verdant') {
    // thorns growing up the spine and translucent leaves circling it
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.OctahedronGeometry(0.014, 0);
      geo.scale(0.7, 3.4, 0.7);
      const node = new THREE.Group();
      facet(geo, node);
      const a = (i / 7) * Math.PI * 2;
      node.position.set(Math.cos(a) * 0.062, -0.17 + (i % 3) * 0.16, Math.sin(a) * 0.062);
      node.rotation.z = -Math.cos(a) * 0.85;
      node.rotation.x = Math.sin(a) * 0.85;
      decor.add(node);
    }
    const leafMat = addFade(
      new THREE.MeshBasicMaterial({
        color: 0x7dffb4,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.24
    );
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.24), leafMat);
      const a = (i / 3) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.1, -0.05 + i * 0.05, Math.sin(a) * 0.1);
      leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
      decor.add(leaf);
    }
  }

  if (element === 'sand') {
    // a twin blade crossing the spine, banded by two thin rings of dust
    const twinGeo = new THREE.OctahedronGeometry(0.06, 0);
    twinGeo.scale(0.9, 2.4, 0.9);
    const twin = new THREE.Group();
    facet(twinGeo, twin);
    twin.rotation.set(0.5, 0, 0.7);
    decor.add(twin);
    const bandMat = addFade(
      new THREE.MeshBasicMaterial({
        color: 0xffe3a8,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.45
    );
    const bandGeo = new THREE.TorusGeometry(0.15, 0.0035, 4, 40);
    for (let i = 0; i < 2; i++) {
      const band = new THREE.Mesh(bandGeo, bandMat);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = i * 0.4;
      band.position.y = -0.08 + i * 0.16;
      band.scale.setScalar(0.9 + i * 0.28);
      decor.add(band);
    }
  }

  if (element === 'frost') {
    // a radiating star of needles and two thin wings of ice
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.OctahedronGeometry(0.012, 0);
      geo.scale(0.6, 4.6, 0.6);
      const node = new THREE.Group();
      facet(geo, node);
      const a = (i / 6) * Math.PI * 2;
      node.position.set(Math.cos(a) * 0.07, 0.02, Math.sin(a) * 0.07);
      node.rotation.z = -Math.cos(a) * 1.1;
      node.rotation.x = Math.sin(a) * 1.1;
      decor.add(node);
    }
    const wingMat = addFade(
      new THREE.MeshBasicMaterial({
        color: 0xdcf7ff,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.18
    );
    [-1, 1].forEach((s) => {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.36), wingMat);
      wing.position.set(s * 0.11, -0.02, 0);
      wing.rotation.set(0.15, s * 0.5, s * 0.6);
      decor.add(wing);
    });
  }

  if (element === 'magma') {
    // a molten core inside basalt plates, and fire licking off the base
    const coreMat = addFade(
      new THREE.MeshBasicMaterial({
        color: 0xffe0a8,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.9
    );
    decor.add(new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 10), coreMat));
    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1b0b06,
      roughness: 0.5,
      metalness: 0.7,
      emissive: 0x5a1400,
      emissiveIntensity: 1.1,
    });
    for (let i = 0; i < 5; i++) {
      const plate = new THREE.Mesh(new THREE.TetrahedronGeometry(0.03 + Math.random() * 0.02, 0), plateMat);
      const a = (i / 5) * Math.PI * 2;
      plate.position.set(Math.cos(a) * 0.085, -0.16 + Math.random() * 0.34, Math.sin(a) * 0.085);
      plate.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      decor.add(plate);
    }
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.SpriteMaterial({
        map: emberTexture(),
        color: 0xffa347,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const a = (i / 3) * Math.PI * 2;
      sprite.position.set(Math.cos(a) * 0.05, -0.2, Math.sin(a) * 0.05);
      decor.add(sprite);
      flames.push({ sprite, mat, seed: Math.random(), base: 0.16 + Math.random() * 0.1 });
    }
  }

  if (element === 'void') {
    // a counter-turning cage of black shards around a hungry core
    const ring = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x08040f,
      roughness: 0.3,
      metalness: 0.9,
      emissive: 0x2a0c4a,
      emissiveIntensity: 0.7,
    });
    const darkEdge = addFade(
      new THREE.LineBasicMaterial({
        color: 0xb98bff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      0.85
    );
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.OctahedronGeometry(0.026, 0);
      geo.scale(0.7, 2.1, 0.7);
      const node = new THREE.Group();
      node.add(new THREE.Mesh(geo, darkMat));
      node.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), darkEdge));
      const a = (i / 6) * Math.PI * 2;
      node.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
      node.rotation.set(0.4, a, 0.9);
      ring.add(node);
    }
    decor.add(ring);
    decor.userData.ring = ring;
    decor.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 12), new THREE.MeshBasicMaterial({ color: 0x030106 }))
    );
  }

  group.add(shards);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.setScalar(1.1);
  group.add(halo);
  // wide enough to wash the casket in the element's colour as the soul closes in
  const light = new THREE.PointLight(spec.color, 3.2, 10, 2);
  group.add(light);
  const swarm = makeSwarm(element, spec.color);
  group.add(swarm.points);
  const trailCount = 46;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
  const trail = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.11,
      map: glow,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })
  );
  trail.frustumCulled = false;
  trail.visible = false;
  return {
    group,
    element,
    shards,
    decor,
    flames,
    fadeMats,
    swarm,
    crystalMat,
    edgeMat,
    fragments,
    halo,
    light,
    trail,
    trailCount,
    color,
  };
}

export function updateSoul(soul, index, time, dt, fade, yank) {
  const { shards, decor, flames, fadeMats, crystalMat, edgeMat, fragments, halo, light, swarm } = soul;
  halo.material.opacity = 0.92 * fade;
  halo.scale.setScalar(1.05 + Math.sin(time * 5.5 + index) * 0.09 - yank * 0.45);

  // the crystal tumbles, its splinters orbiting, then it is dragged long and thin into the casket
  shards.rotation.y = time * (1.5 + index * 0.22) + yank * 7;
  shards.rotation.x = Math.sin(time * 1.8 + index) * 0.42 + yank * 2.6;
  shards.rotation.z = Math.cos(time * 1.45 + index * 0.7) * 0.32;
  const flare = 1 + yank * 0.32;
  shards.scale.set(flare, flare * (1 + yank * 2.4), flare);
  crystalMat.opacity = fade * 0.94;
  crystalMat.emissiveIntensity = 1.2 + yank * 2.2 + Math.sin(time * 6 + index) * 0.22;
  edgeMat.opacity = fade * (0.5 + yank * 0.5);
  fragments.forEach((f) => {
    f.angle += dt * (0.8 + yank * 4);
    f.node.rotation.y += f.spin * dt * (1 + yank * 2);
    f.node.rotation.x += f.spin * dt * 0.6;
    const r = f.orbit * (1 + Math.sin(time * 2.1 + f.phase) * 0.14) * (1 - yank * 0.5);
    f.node.position.set(
      Math.cos(f.angle) * r,
      f.y + Math.sin(time * 1.6 + f.phase) * 0.05,
      Math.sin(f.angle) * r
    );
  });

  decor.rotation.y = -time * 0.8 - yank * 3;
  if (decor.userData.ring) decor.userData.ring.rotation.y = time * 2.8;
  fadeMats.forEach(({ mat, base }) => {
    mat.opacity = base * fade;
  });
  flames.forEach((f) => {
    const k = (time * 0.85 + f.seed) % 1;
    f.sprite.position.y = -0.24 + k * 0.56;
    f.mat.opacity = fade * (1 - k) * 0.85;
    const s = f.base * (0.7 + k * 0.95);
    f.sprite.scale.set(s, s * 1.7, 1);
  });

  updateSwarm(swarm, soul.element, time, fade, yank);
  light.intensity = fade * (3.6 + Math.sin(time * 7 + index) * 0.5) + yank * 2.6;

  for (let j = soul.history.length - 1; j > 0; j--) {
    soul.history[j].copy(soul.history[j - 1]);
  }
  soul.history[0].copy(soul.group.position);
  const posAttr = soul.trail.geometry.attributes.position;
  const colAttr = soul.trail.geometry.attributes.color;
  const length = soul.history.length;
  for (let j = 0; j < length; j++) {
    const v = soul.history[j];
    posAttr.setXYZ(j, v.x, v.y, v.z);
    const k = Math.pow(1 - j / length, 1.7) * fade;
    colAttr.setXYZ(j, soul.color.r * k, soul.color.g * k, soul.color.b * k);
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  soul.trail.visible = true;
}