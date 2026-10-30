import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────────
   THE GLACIAL ARCHIVE — the whole cutscene in a single file.

     1. the rendering kit (noise, textures, PBR materials, sky,
        terrain, snow, fog, ice, runes, figures, shader pass)
     2. the three scenes (winter shrine, the Rime Oracle, the vault)
     3. the engine (renderer, bloom, cinematic pass, scene swaps)
     4. the React canvas and the cutscene UI
   ───────────────────────────────────────────────────────────────── */

/* ═════════════════════════════════════════════════════════════════
   1 · THE RENDERING KIT
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const rand = (min, max) => min + Math.random() * (max - min);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smoothstep = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/* ── value noise on the CPU (geometry displacement) ────────── */

const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm2(x, y, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise2(fx, fy);
    fx *= 2.02;
    fy *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

function ridged2(x, y, octaves = 4) {
  let value = 0;
  let amplitude = 0.5;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(fx, fy) * 2 - 1);
    value += amplitude * n * n;
    fx *= 2.05;
    fy *= 1.97;
    amplitude *= 0.5;
  }
  return value;
}

/* ── procedural textures ──────────────────────────────────── */

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/** Tileable grayscale fbm — roughness / bump detail. */
function noiseTexture(size = 256, scale = 6) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm2((x / size) * scale, (y / size) * scale, 5);
      const value = Math.floor(THREE.MathUtils.clamp(n, 0, 1) * 255);
      const i = (y * size + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Normal map derived from the same fbm field. */
function normalTexture(size = 256, strength = 2.4, scale = 7) {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = fbm2((x / size) * scale, (y / size) * scale, 5);
    }
  }
  const at = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = ((-dx / length) * 0.5 + 0.5) * 255;
      image.data[i + 1] = ((-dy / length) * 0.5 + 0.5) * 255;
      image.data[i + 2] = (1 / length) * 0.5 * 255 + 127;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function glowTexture(size = 128, rgb = "255,255,255") {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.18, `rgba(${rgb},0.62)`);
  gradient.addColorStop(0.48, `rgba(${rgb},0.14)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A cold moon: maria, crater rims and limb darkening. */
function moonTexture(size = 512) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  const base = ctx.createRadialGradient(c * 0.86, c * 0.8, c * 0.1, c, c, c);
  base.addColorStop(0, "#f2f8ff");
  base.addColorStop(0.55, "#cfdff0");
  base.addColorStop(1, "#7e94a8");
  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, c - 1, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 140; i++) {
    const angle = Math.random() * TAU;
    const radius = Math.pow(Math.random(), 0.6) * c;
    const x = c + Math.cos(angle) * radius;
    const y = c + Math.sin(angle) * radius;
    const r = 2 + Math.pow(Math.random(), 2.4) * 44;
    const shade = Math.random();
    ctx.fillStyle =
      shade > 0.7 ? "rgba(255,255,255,0.16)" : `rgba(88,108,128,${0.08 + Math.random() * 0.22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    if (r > 10) {
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x - r * 0.12, y - r * 0.12, r * 0.94, 0, TAU);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = "rgba(96,116,138,0.24)";
    ctx.beginPath();
    ctx.ellipse(rand(c * 0.4, c * 1.6), rand(c * 0.4, c * 1.6), rand(30, 90), rand(20, 60), rand(0, 3), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Soft vertical streak used as a motion trail. */
function streakTexture(size = 128) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "rgba(200,240,255,0)");
  gradient.addColorStop(0.45, "rgba(210,245,255,0.85)");
  gradient.addColorStop(1, "rgba(190,235,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Angular carved glyphs on a transparent strip. */
function runeTexture(glyphCount = 6) {
  const width = 96;
  const height = 480;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(190,245,255,0.92)";
  const cell = height / glyphCount;
  for (let g = 0; g < glyphCount; g++) {
    const top = g * cell + 12;
    const bottom = top + cell - 24;
    const strokes = 3 + Math.floor(Math.random() * 3);
    ctx.lineWidth = 2;
    for (let s = 0; s < strokes; s++) {
      ctx.beginPath();
      ctx.moveTo(rand(14, width - 14), rand(top, bottom));
      ctx.lineTo(rand(14, width - 14), rand(top, bottom));
      ctx.stroke();
    }
    if (Math.random() > 0.45) {
      ctx.beginPath();
      ctx.moveTo(width / 2, top);
      ctx.lineTo(width / 2, bottom);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ── environment lighting ─────────────────────────────────── */

function createEnvMap(renderer, { top = 0x0a1a28, horizon = 0x2f5a74, ground = 0x04090f } = {}) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(60, 32, 24);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uGround: { value: new THREE.Color(ground) },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGround;
      varying vec3 vDirection;
      void main() {
        float h = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uGround, uHorizon, smoothstep(0.36, 0.5, h));
        color = mix(color, uTop, smoothstep(0.5, 0.95, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(geometry, material));
  const target = pmrem.fromScene(envScene, 0.02);
  pmrem.dispose();
  geometry.dispose();
  material.dispose();
  return target.texture;
}

/* ── material library (all PBR) ───────────────────────────── */

function createMaterialLibrary() {
  const rockNormal = normalTexture(256, 3.4, 6);
  rockNormal.repeat.set(3, 3);
  const iceNormal = normalTexture(256, 1.2, 5);
  iceNormal.repeat.set(2, 2);

  return {
    snow: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0xdcebf7,
        roughness: 0.66,
        metalness: 0.06,
        normalMap: iceNormal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        envMapIntensity: 0.85,
        ...opts,
      }),
    stone: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0x3a4f61,
        roughness: 0.86,
        metalness: 0.1,
        normalMap: rockNormal,
        normalScale: new THREE.Vector2(1.1, 1.1),
        envMapIntensity: 0.55,
        ...opts,
      }),
    ice: (opts = {}) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xa9dcef,
        roughness: 0.09,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.92,
        envMapIntensity: 2.1,
        ...opts,
      }),
    cloth: (opts = {}) =>
      new THREE.MeshPhysicalMaterial({
        color: 0x101f2a,
        roughness: 0.92,
        metalness: 0.02,
        sheen: 1,
        sheenRoughness: 0.7,
        sheenColor: new THREE.Color(0x74b8d8),
        envMapIntensity: 0.5,
        ...opts,
      }),
    emissive: (color, intensity = 2) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      material.color.multiplyScalar(intensity);
      return material;
    },
  };
}

/* ── sky dome ─────────────────────────────────────────────── */

function createSky({
  top = 0x030a14,
  horizon = 0x14405b,
  glow = 0x9fd6ff,
  aurora = 0x2ea4b8,
  moonDir = new THREE.Vector3(-0.45, 0.35, -0.82),
  auroraAmount = 0.5,
} = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uTop: { value: new THREE.Color(top) },
    uHorizon: { value: new THREE.Color(horizon) },
    uGlow: { value: new THREE.Color(glow) },
    uAurora: { value: new THREE.Color(aurora) },
    uMoonDir: { value: moonDir.clone().normalize() },
    uAuroraAmount: { value: auroraAmount },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAuroraAmount;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uGlow;
      uniform vec3 uAurora;
      uniform vec3 uMoonDir;
      varying vec3 vDirection;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDirection);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uHorizon, uTop, smoothstep(0.47, 0.98, h));

        float band = exp(-pow((h - 0.53) * 7.5, 2.0));
        color += uGlow * band * 0.34;

        float stars = pow(hash(floor(dir.xz * 340.0)), 62.0);
        stars *= smoothstep(0.56, 0.82, h);
        color += vec3(0.78, 0.9, 1.0) * stars * 1.1;

        float ribbons = fbm(vec2(dir.x * 2.1 + uTime * 0.012, dir.z * 2.6 - uTime * 0.006));
        float aurora = smoothstep(0.52, 0.92, ribbons) * smoothstep(0.6, 0.98, h) * uAuroraAmount;
        color += uAurora * aurora * 0.5;

        float md = max(dot(dir, normalize(uMoonDir)), 0.0);
        color += uGlow * pow(md, 12.0) * 0.16;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(620, 48, 30), material);
  mesh.frustumCulled = false;
  return {
    mesh,
    uniforms,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}

/* ── terrain ──────────────────────────────────────────────── */

function createTerrain({
  size = 400,
  segments = 220,
  heightFn,
  colors = { snow: 0xe6f2fb, rock: 0x2a3f52, shadow: 0x0c1720 },
  material,
}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const count = position.count;
  const heights = new Float32Array(count);
  const row = segments + 1;

  for (let i = 0; i < count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = heightFn(x, z);
    heights[i] = y;
    position.setY(i, y);
  }

  const snow = new THREE.Color(colors.snow);
  const rock = new THREE.Color(colors.rock);
  const shadow = new THREE.Color(colors.shadow);
  const vertexColors = new Float32Array(count * 3);
  const mixed = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = Math.floor(i % row);
    const z = Math.floor(i / row);
    const cx = Math.min(row - 1, Math.max(0, x));
    const cz = Math.min(row - 1, Math.max(0, z));
    const hL = heights[cz * row + Math.max(0, cx - 1)];
    const hR = heights[cz * row + Math.min(row - 1, cx + 1)];
    const hD = heights[Math.max(0, cz - 1) * row + cx];
    const hU = heights[Math.min(row - 1, cz + 1) * row + cx];
    const slope = Math.hypot(hR - hL, hU - hD) / (size / segments);

    const height01 = clamp01((heights[i] - (colors.base ?? 0)) / 90);
    const snowy = clamp01(1 - slope * 2.4) * (0.45 + height01 * 0.55);
    mixed.copy(rock).lerp(shadow, clamp01(slope * 0.6));
    mixed.lerp(snow, snowy);
    vertexColors[i * 3] = mixed.r;
    vertexColors[i * 3 + 1] = mixed.g;
    vertexColors[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/* ── GPU snowfall ─────────────────────────────────────────── */

function createSnow({
  count = 6000,
  area = 150,
  height = 80,
  size = 2.0,
  speed = 1,
  color = 0xe8f5ff,
  opacity = 0.8,
} = {}) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-area / 2, area / 2);
    positions[i * 3 + 1] = rand(0, height);
    positions[i * 3 + 2] = rand(-area / 2, area / 2);
    sizes[i] = rand(0.9, 3.4) * size;
    speeds[i] = rand(0.55, 1.7) * speed;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uHeight: { value: height },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.8) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uHeight;
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aSpeed;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        float fall = mod(p.y - uTime * aSpeed * 2.6, uHeight);
        p.y = fall;
        p.x += sin(uTime * 0.55 + aSeed * 6.2831) * 2.6 + sin(uTime * 0.17 + aSeed * 3.1) * 4.2;
        p.z += cos(uTime * 0.43 + aSeed * 5.2) * 2.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = aSize * uPixelRatio * (460.0 / max(dist, 1.0));
        vFade = smoothstep(0.0, 7.0, dist) * (1.0 - smoothstep(uHeight * 0.8, uHeight * 1.3, dist));
        vFade *= 0.35 + 0.65 * smoothstep(-2.0, 5.0, p.y);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.06, d);
        if (alpha * vFade < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha * vFade * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    mesh: points,
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}

/* ── drifting ground fog (shader plane) ───────────────────── */

function createGroundFog({ size = 220, color = 0x8fc4de, density = 0.45, y = 0.6 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uDensity: { value: density },
    uScale: { value: 1 / size },
  };
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec2 vPlane;
      void main() {
        vPlane = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDensity;
      uniform vec3 uColor;
      varying vec2 vPlane;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vPlane * 0.16;
        float drift = uTime * 0.03;
        float fog = fbm(p + vec2(drift, -drift * 0.6)) * fbm(p * 1.8 - vec2(drift * 0.7, drift * 0.4));
        float radius = length(vPlane) / 105.0;
        float fade = 1.0 - smoothstep(0.25, 1.0, radius);
        float alpha = smoothstep(0.1, 0.72, fog) * fade * uDensity;
        gl_FragColor = vec4(uColor * (0.65 + fog * 0.9), alpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.renderOrder = 2;
  return {
    mesh,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}

/* ── ice fissures glowing on the ground ───────────────────── */

function createCracks({ count = 26, start = 2, radius = 44, color = 0x6fdcff, y = 0.1 } = {}) {
  const positions = [];
  const colors = [];
  const base = new THREE.Color(color);

  for (let i = 0; i < count; i++) {
    let angle = Math.random() * TAU;
    let distance = start + Math.random() * 3;
    let x = Math.cos(angle) * distance;
    let z = Math.sin(angle) * distance;
    const steps = 16 + Math.floor(Math.random() * 22);
    for (let s = 0; s < steps && distance < radius; s++) {
      angle += rand(-0.34, 0.34);
      distance += rand(0.6, 2.1);
      const nx = Math.cos(angle) * distance;
      const nz = Math.sin(angle) * distance;
      positions.push(x, y, z, nx, y, nz);
      const fade = 1 - s / steps;
      colors.push(base.r * fade, base.g * fade, base.b * fade, base.r * fade, base.g * fade, base.b * fade);
      x = nx;
      z = nz;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 1;
  return lines;
}

/* ── displaced ice and rock ───────────────────────────────── */

function createIceSpike({ height = 8, radius = 1.1, segments = 7, material, seed = 0 } = {}) {
  const geometry = new THREE.ConeGeometry(radius, height, segments, 7, false);
  const position = geometry.attributes.position;
  const yAttr = height / 2;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (y + yAttr) / height;
    const n = fbm2(x * 1.6 + seed, z * 1.6 + y * 0.7, 3);
    const wobble = 1 + (n - 0.5) * 0.5 * (1 - t * 0.6);
    position.setX(i, x * wobble);
    position.setZ(i, z * wobble);
    position.setY(i, y + (n - 0.5) * height * 0.04);
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function createRock({ radius = 1.4, detail = 2, material, seed = 0 } = {}) {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n = fbm2(x * 0.9 + seed, z * 0.9 + y * 0.8, 4);
    const scale = 0.55 + n * 0.9;
    position.setXYZ(i, x * scale, y * scale * 0.82, z * scale);
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/* ── carved rune circles ──────────────────────────────────── */

function runeRingTexture(size = 512, { rings = 2, glyphs = 36 } = {}) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext("2d");
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = "round";
  for (let r = 0; r < rings; r++) {
    const radius = c * (0.66 + r * 0.14);
    ctx.strokeStyle = `rgba(180,235,255,${0.9 - r * 0.28})`;
    ctx.lineWidth = size * 0.0042;
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, radius * 0.962, 0, TAU);
    ctx.stroke();
    for (let g = 0; g < glyphs; g++) {
      const a = (g / glyphs) * TAU;
      ctx.save();
      ctx.translate(c + Math.cos(a) * radius, c + Math.sin(a) * radius);
      ctx.rotate(a + Math.PI / 2);
      ctx.strokeStyle = `rgba(150,225,255,${0.5 + Math.random() * 0.45})`;
      ctx.lineWidth = size * 0.0026;
      const unit = size * 0.014;
      ctx.beginPath();
      const strokes = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < strokes; s++) {
        ctx.moveTo(rand(-unit, unit), rand(-unit, unit));
        ctx.lineTo(rand(-unit, unit), rand(-unit, unit));
      }
      ctx.stroke();
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRuneCircle({
  radius = 8,
  size = 512,
  color = 0x8fe6ff,
  opacity = 0.5,
  y = 0.06,
  rings = 2,
  glyphs = 36,
} = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: runeRingTexture(size, { rings, glyphs }),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 1;
  return mesh;
}

/* ── hanging icicles ──────────────────────────────────────── */

function createIcicleCluster({ count = 9, spread = 0.9, length = 2.4, material, seed = 0 } = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const h = rand(length * 0.28, length);
    const spike = createIceSpike({
      height: h,
      radius: rand(0.07, 0.26) * (0.6 + h / length),
      segments: 5,
      material,
      seed: seed + i * 2.7,
    });
    spike.rotation.x = Math.PI;
    spike.position.set(rand(-spread, spread), -rand(0, length * 0.22), rand(-spread, spread));
    spike.rotation.z = rand(-0.16, 0.16);
    group.add(spike);
  }
  return group;
}

/* ── frozen hooded figures ────────────────────────────────── */

const FIGURE_PROFILE = [
  [0.0, 0.0],
  [0.5, 0.01],
  [0.53, 0.08],
  [0.49, 0.22],
  [0.44, 0.38],
  [0.38, 0.54],
  [0.33, 0.68],
  [0.29, 0.78],
  [0.27, 0.84],
  [0.31, 0.87],
  [0.35, 0.91],
  [0.28, 0.98],
  [0.15, 1.02],
  [0.0, 1.03],
];

function createHoodedFigure({ height = 4, material, voidMaterial, seed = 0 } = {}) {
  const group = new THREE.Group();
  const s = height;

  const geometry = new THREE.LatheGeometry(
    FIGURE_PROFILE.map(([r, y]) => new THREE.Vector2(r * s * 0.62, y * s)),
    54,
  );
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = fbm2(Math.cos(angle) * 3.1 + seed, Math.sin(angle) * 3.1 + y * 0.5, 3) - 0.5;
    const scale = 1 + fold * 0.14;
    position.setXYZ(i, x * scale, y, z * scale);
  }
  geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry, material));

  const hood = new THREE.Mesh(new THREE.ConeGeometry(s * 0.3, s * 0.44, 22, 4, true), material);
  hood.position.y = s * 0.86;
  group.add(hood);

  const voidMaterialFinal = voidMaterial || new THREE.MeshBasicMaterial({ color: 0x000306 });
  const hoodVoid = new THREE.Mesh(new THREE.SphereGeometry(s * 0.16, 16, 12), voidMaterialFinal);
  hoodVoid.position.set(0, s * 0.83, s * 0.06);
  group.add(hoodVoid);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(s * 0.05, s * 0.4, 4, 8), material);
    arm.position.set(side * s * 0.24, s * 0.45, s * 0.06);
    arm.rotation.z = side * 0.2;
    arm.rotation.x = 0.12;
    group.add(arm);
  }

  return group;
}

/* ── dead, frozen trees ───────────────────────────────────── */

function createDeadTree({ height = 7, material, detail = 2 } = {}) {
  const group = new THREE.Group();

  const grow = (start, direction, length, radius, depth) => {
    const end = start.clone().addScaledVector(direction, length);
    const mid = start
      .clone()
      .lerp(end, 0.5)
      .add(new THREE.Vector3(rand(-0.28, 0.28), rand(-0.18, 0.18), rand(-0.28, 0.28)));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const branch = new THREE.Mesh(
      new THREE.TubeGeometry(curve, depth === 0 ? 7 : 5, radius, depth === 0 ? 7 : 5, false),
      material,
    );
    group.add(branch);

    if (depth > 0) {
      const children = depth === detail ? 4 : 3;
      for (let i = 0; i < children; i++) {
        const tilt = rand(0.4, 1.0);
        const spin = rand(0, TAU);
        const dir = direction
          .clone()
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.cos(spin) * tilt)
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(spin) * tilt)
          .normalize();
        grow(end, dir, length * rand(0.52, 0.74), radius * 0.62, depth - 1);
      }
    }
  };

  grow(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(rand(-0.12, 0.12), 1, rand(-0.12, 0.12)).normalize(),
    height * 0.46,
    height * 0.045,
    detail,
  );
  return group;
}

/* ── cinematic finishing pass ─────────────────────────────── */

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1 },
    uGrain: { value: 0.032 },
    uAberration: { value: 0.0011 },
    uFlash: { value: 0 },
    uTint: { value: new THREE.Color(0x2f8fb8) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uFlash;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

    void main() {
      vec2 centre = vUv - 0.5;
      float radius = length(centre);
      vec2 shift = centre * uAberration * (0.6 + radius * 2.4);

      vec3 color;
      color.r = texture2D(tDiffuse, vUv + shift).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - shift).b;

      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, 0.93);
      color += uTint * 0.045 * (1.0 - smoothstep(0.0, 0.5, luma));

      float vig = 1.0 - smoothstep(0.26, 0.95, radius * uVignette);
      color *= mix(0.22, 1.0, vig);

      float grain = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 71.3) - 0.5;
      color += grain * uGrain;

      color *= 1.0 + uFlash * 0.6;

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

/* ═════════════════════════════════════════════════════════════════
   2 · SCENE ONE — THE FROZEN SHRINE
   ═════════════════════════════════════════════════════════════════ */

function roughen(geometry, amount = 0.2) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const n = fbm2(x * 0.9 + y * 0.45, z * 0.9 - y * 0.55, 3) - 0.5;
    position.setXYZ(i, x + n * amount, y + n * amount * 0.4, z + n * amount);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createWinterScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1a26, 0.0135);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1600);
  camera.position.set(0, 7.2, 42);

  scene.environment = createEnvMap(renderer, { top: 0x08141f, horizon: 0x2b546b, ground: 0x040a0f });
  const lib = createMaterialLibrary();

  const sky = createSky({
    top: 0x02080f,
    horizon: 0x123a52,
    glow: 0x9ed9ff,
    aurora: 0x2aa2ac,
    auroraAmount: 0.6,
    moonDir: new THREE.Vector3(-0.5, 0.26, -0.82),
  });
  scene.add(sky.mesh);

  /* moon low over the ridge */
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(19, 48, 32),
    new THREE.MeshBasicMaterial({ map: moonTexture(512), color: 0xe8f3ff, fog: false }),
  );
  moon.position.set(-250, 148, -540);
  scene.add(moon);

  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "176,216,255"),
      color: 0x8fd2ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  moonHalo.scale.setScalar(330);
  moonHalo.position.copy(moon.position);
  scene.add(moonHalo);

  /* lighting */
  scene.add(new THREE.HemisphereLight(0x2c5e78, 0x04090e, 0.5));

  const moonLight = new THREE.DirectionalLight(0xc9e2ff, 1.0);
  moonLight.position.set(-90, 120, 60);
  scene.add(moonLight);

  const rimLight = new THREE.DirectionalLight(0x86d4f5, 2.6);
  rimLight.position.set(10, 26, -70);
  scene.add(rimLight);

  const bounce = new THREE.PointLight(0x3d7f9e, 9, 34, 2);
  bounce.position.set(0, 1.6, 8);
  scene.add(bounce);

  /* terrain: snowfield rising into distant ridges */
  const heightFn = (x, z) => {
    const distance = Math.hypot(x, z);
    const near = smoothstep(9, 40, distance);
    const dunes = (fbm2(x * 0.013, z * 0.013, 4) - 0.5) * 2.1;
    const detail = (fbm2(x * 0.075, z * 0.075, 3) - 0.5) * 0.4;
    const swell = smoothstep(75, 400, distance);
    const ridges = ridged2(x * 0.0052, z * 0.0052, 5);
    const peaks = smoothstep(0.24, 0.92, ridges) * 165 - 34;
    return (dunes + detail) * near + swell * peaks;
  };

  const terrain = createTerrain({
    size: 950,
    segments: 300,
    heightFn,
    colors: { snow: 0xe9f4fd, rock: 0x2b4053, shadow: 0x0b1620 },
    material: lib.snow({ vertexColors: true, roughness: 0.72, metalness: 0.04 }),
  });
  scene.add(terrain);

  /* fissures and boulders */
  scene.add(createCracks({ count: 30, start: 6, radius: 42, color: 0x6fdcff, y: 0.05 }));
  scene.add(createCracks({ count: 14, start: 14, radius: 70, color: 0x3f8fb0, y: 0.04 }));

  for (let i = 0; i < 9; i++) {
    const angle = rand(0, TAU);
    const distance = rand(22, 46);
    const rock = createRock({
      radius: rand(0.9, 2.6),
      detail: 2,
      material: lib.stone({ color: 0x2d4152, roughness: 0.92 }),
      seed: i * 3.7,
    });
    rock.position.set(Math.cos(angle) * distance, rand(-0.4, 0.2), Math.sin(angle) * distance);
    rock.rotation.set(rand(0, 0.4), rand(0, TAU), rand(0, 0.4));
    scene.add(rock);
  }

  /* rune circles cut into the ice around the shrine */
  scene.add(createRuneCircle({ radius: 10.5, color: 0x9fe9ff, opacity: 0.34, y: 0.07, rings: 2, glyphs: 48 }));

  /* the frozen congregation facing the shard */
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 2 + 1.15 + (i / 4) * (TAU - 2.3);
    const distance = rand(21, 28);
    const figure = createHoodedFigure({
      height: rand(3.2, 4.8),
      material: lib.stone({
        color: 0x64889b,
        roughness: 0.86,
        emissive: 0x0a2029,
        emissiveIntensity: 0.7,
      }),
      seed: i * 3.1,
    });
    figure.position.set(Math.cos(angle) * distance, -0.6, Math.sin(angle) * distance);
    figure.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    figure.rotation.z = rand(-0.08, 0.08);
    scene.add(figure);
  }

  /* dead trees riming at the edge of the shrine */
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + 0.95 + (i / 3) * (TAU - 1.9);
    const distance = rand(30, 40);
    const tree = createDeadTree({
      height: rand(7, 12),
      material: lib.stone({ color: 0x263845, roughness: 0.94 }),
      detail: 2,
    });
    tree.position.set(Math.cos(angle) * distance, -0.4, Math.sin(angle) * distance);
    tree.rotation.y = rand(0, TAU);
    scene.add(tree);
  }

  /* the shrine */
  const shrine = new THREE.Group();
  scene.add(shrine);

  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6 - i * 1.5, 7.9 - i * 1.5, 0.7, 6, 1),
      lib.stone({ color: i === 2 ? 0x3b5064 : 0x33485a, roughness: 0.88 }),
    );
    step.position.y = 0.35 + i * 0.68;
    step.rotation.y = i * 0.09;
    shrine.add(step);
  }

  /* monolith ring — a gap is left toward the camera so the shard stays framed */
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 2 + 0.68 + (i / 8) * (TAU - 1.36);
    const distance = 16.5 + rand(-1.1, 1.1);
    const height = rand(9.5, 15.5);
    const geometry = roughen(
      new THREE.BoxGeometry(rand(1.5, 2.3), height, rand(1.0, 1.7), 3, 10, 3),
      0.26,
    );
    const slab = new THREE.Mesh(geometry, lib.stone({ color: i % 3 === 0 ? 0x2b3f51 : 0x35495c }));
    slab.position.set(Math.cos(angle) * distance, height / 2 - 0.6, Math.sin(angle) * distance);
    slab.rotation.y = -angle + rand(-0.12, 0.12);
    slab.rotation.z = rand(-0.045, 0.045);
    shrine.add(slab);

    const rune = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, height * 0.5),
      new THREE.MeshBasicMaterial({
        map: runeTexture(7),
        color: 0x8fe6ff,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    rune.position.set(Math.cos(angle) * (distance + 0.98), height * 0.46, Math.sin(angle) * (distance + 0.98));
    rune.lookAt(Math.cos(angle) * 60, rune.position.y, Math.sin(angle) * 60);
    shrine.add(rune);
  }

  /* broken arch behind the shard */
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(7.4, 0.62, 10, 44, Math.PI * 0.92),
    lib.stone({ color: 0x2f4456 }),
  );
  arch.position.set(0, 1.1, -13);
  arch.rotation.z = 0.16;
  shrine.add(arch);

  const archFragment = new THREE.Mesh(
    new THREE.TorusGeometry(7.4, 0.6, 8, 16, Math.PI * 0.22),
    lib.stone({ color: 0x2a3d4e }),
  );
  archFragment.position.set(-3.4, 1.0, -12.4);
  archFragment.rotation.z = 0.5;
  shrine.add(archFragment);

  /* icicles slung under the broken arch */
  for (const side of [-1, 1]) {
    const icicles = createIcicleCluster({
      count: 8,
      spread: 0.8,
      length: 2.6,
      material: lib.ice({ color: 0xc6ecf8, emissive: 0x166a84, emissiveIntensity: 0.85, opacity: 0.9 }),
      seed: side * 4.7,
    });
    icicles.position.set(side * 4.6, 6.2, -12.6);
    shrine.add(icicles);
  }

  /* the frozen third shard */
  const shardGeometry = new THREE.OctahedronGeometry(1.3, 0);
  shardGeometry.scale(1, 3.1, 1);
  const shardMaterial = lib.ice({
    color: 0xd8f5ff,
    emissive: 0x27a8d8,
    emissiveIntensity: 2.6,
    opacity: 0.95,
  });
  const shard = new THREE.Mesh(shardGeometry, shardMaterial);
  shard.position.set(0, 8.7, 0);
  shrine.add(shard);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), lib.emissive(0xd9f8ff, 4.5));
  core.scale.set(1, 2.6, 1);
  shard.add(core);

  const shardHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "150,222,255"),
      color: 0x7fe0ff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shardHalo.scale.setScalar(11);
  shard.add(shardHalo);

  const shardLight = new THREE.PointLight(0x76e2ff, 38, 60, 2);
  shardLight.position.set(0, 8.7, 0);
  scene.add(shardLight);

  /* splinters orbiting the shard */
  const splinters = [];
  for (let i = 0; i < 14; i++) {
    const splinter = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(0.09, 0.26), 0),
      lib.ice({ color: 0xd6f6ff, emissive: 0x3aa9cf, emissiveIntensity: 1.6, opacity: 0.9 }),
    );
    splinter.scale.set(1, rand(2, 3.6), 1);
    scene.add(splinter);
    splinters.push({
      mesh: splinter,
      radius: rand(1.9, 4.6),
      speed: rand(0.12, 0.34) * (i % 2 === 0 ? 1 : -1),
      phase: rand(0, TAU),
      y: rand(6.6, 11.4),
      bob: rand(0.3, 1.0),
    });
  }

  /* atmosphere */
  const snow = createSnow({ count: 7000, area: 170, height: 90, size: 1.5, speed: 1.15, opacity: 0.8 });
  scene.add(snow.mesh);

  const fog = createGroundFog({ size: 280, color: 0x9ccfe6, density: 0.5, y: 0.7 });
  scene.add(fog.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    snow.update(time);
    fog.update(time);

    shard.rotation.y = time * 0.32;
    shard.position.y = 8.7 + Math.sin(time * 0.7) * 0.2;
    core.rotation.y = -time * 0.55;
    shardLight.intensity = 36 + Math.sin(time * 1.4) * 9 + Math.sin(time * 3.2) * 3;
    shardHalo.material.opacity = 0.42 + Math.sin(time * 1.1) * 0.1;
    arch.rotation.z = 0.16 + Math.sin(time * 0.21) * 0.004;

    for (const splinter of splinters) {
      const a = time * splinter.speed + splinter.phase;
      splinter.mesh.position.set(
        Math.cos(a) * splinter.radius,
        splinter.y + Math.sin(time * 0.7 + splinter.phase) * splinter.bob,
        Math.sin(a) * splinter.radius,
      );
      splinter.mesh.rotation.set(time * 1.2 + splinter.phase, time * 1.7, time * 0.9);
    }

    const intro = clamp01(time / 9);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 1.6 + Math.sin(time * 0.13) * 0.9 + Math.sin(time * 0.9) * 0.03,
      7.4 - eased * 2.2 + Math.sin(time * 0.29) * 0.14 + Math.cos(time * 4.1) * 0.014,
      43 - eased * 15.5,
    );
    camera.lookAt(px * 0.7, 6.7 + Math.sin(time * 0.22) * 0.18, 0);
  };

  return { scene, camera, baseFov: 40, update };
}

/* ═════════════════════════════════════════════════════════════════
   3 · SCENE TWO — THE RIME ORACLE
   A nine-foot husk in a frozen shroud, bone hands hanging open,
   a skull face burning inside its cowl.
   ═════════════════════════════════════════════════════════════════ */

const ROBE_PROFILE = [
  [0.0, 0.0],
  [2.56, 0.04],
  [2.58, 0.44],
  [2.5, 0.92],
  [2.38, 1.5],
  [2.24, 2.1],
  [2.08, 2.7],
  [1.92, 3.3],
  [1.76, 3.9],
  [1.62, 4.5],
  [1.5, 5.05],
  [1.4, 5.55],
  [1.33, 6.0],
  [1.32, 6.4],
  [1.24, 6.72],
  [1.06, 6.92],
  [0.84, 7.02],
].map(([r, y]) => new THREE.Vector2(r, y));

function buildRobe(lib) {
  const group = new THREE.Group();

  const geometry = new THREE.LatheGeometry(ROBE_PROFILE, 168);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = fbm2(Math.cos(angle) * 2.6 + 4.7, Math.sin(angle) * 2.6 + y * 0.34, 4) - 0.5;
    const ripple = Math.sin(angle * 11 + y * 1.05) * 0.03 + Math.sin(angle * 23 - y * 2.2) * 0.011;
    const scale = 1 + fold * 0.17 + ripple;
    const hem = y < 0.55 ? (fbm2(angle * 2.2, y * 6, 3) - 0.5) * 0.34 : 0;
    position.setXYZ(i, x * scale, y + hem, z * scale);
  }
  geometry.computeVertexNormals();

  group.add(
    new THREE.Mesh(
      geometry,
      lib.cloth({
        color: 0x0c1c25,
        sheenColor: new THREE.Color(0x8fd8ff),
        sheen: 1,
        sheenRoughness: 0.55,
        roughness: 0.93,
        emissive: 0x08303f,
        emissiveIntensity: 0.5,
        envMapIntensity: 0.75,
      }),
    ),
  );

  /* the mantle: a heavier shroud over the shoulders, torn at its edge */
  const mantleProfile = [
    [2.2, 5.5],
    [2.08, 5.76],
    [1.92, 6.0],
    [1.72, 6.2],
    [1.5, 6.34],
    [1.26, 6.44],
    [1.0, 6.5],
    [0.78, 6.54],
  ].map(([r, y]) => new THREE.Vector2(r, y));

  const mantleGeometry = new THREE.LatheGeometry(mantleProfile, 132);
  const mp = mantleGeometry.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i);
    const y = mp.getY(i);
    const z = mp.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = fbm2(Math.cos(angle) * 3.4 + 12.1, y * 0.9, 3) - 0.5;
    const scale = 1 + fold * 0.2;
    const torn = y < 5.95 ? (fbm2(angle * 3.1, 8.3, 3) - 0.5) * 0.55 : 0;
    mp.setXYZ(i, x * scale, y + torn, z * scale);
  }
  mantleGeometry.computeVertexNormals();

  group.add(
    new THREE.Mesh(
      mantleGeometry,
      lib.cloth({
        color: 0x091620,
        side: THREE.DoubleSide,
        roughness: 0.96,
        sheenColor: new THREE.Color(0x5fa8c6),
        sheen: 1,
        emissive: 0x061f2a,
        emissiveIntensity: 0.6,
        envMapIntensity: 0.6,
      }),
    ),
  );

  /* hanging rags off the mantle edge */
  const ragMaterial = lib.cloth({
    color: 0x0a1a22,
    side: THREE.DoubleSide,
    roughness: 0.98,
    emissive: 0x061c26,
    emissiveIntensity: 0.55,
  });

  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * TAU + rand(-0.05, 0.05);
    const length = rand(1.1, 3.4);
    const width = rand(0.24, 0.5);
    const geometryRag = new THREE.PlaneGeometry(width, length, 2, 8);
    const rp = geometryRag.attributes.position;
    for (let v = 0; v < rp.count; v++) {
      const x = rp.getX(v);
      const y = rp.getY(v);
      const t = (y + length / 2) / length; // 0 = tip, 1 = top
      const taper = 0.35 + t * 0.75;
      rp.setXYZ(v, x * taper, y, Math.sin(t * 5.2 + i) * 0.09 * (1 - t));
    }
    geometryRag.computeVertexNormals();

    const rag = new THREE.Mesh(geometryRag, ragMaterial);
    const radius = rand(1.92, 2.14);
    rag.position.set(Math.cos(angle) * radius, rand(4.3, 5.9), Math.sin(angle) * radius);
    rag.rotation.y = -angle + Math.PI / 2;
    rag.rotation.z = rand(-0.09, 0.09);
    group.add(rag);
  }

  /* a frozen veil trailing behind the figure */
  const veilGeometry = new THREE.PlaneGeometry(7, 10, 16, 16);
  const vp = veilGeometry.attributes.position;
  for (let i = 0; i < vp.count; i++) {
    const x = vp.getX(i);
    const y = vp.getY(i);
    const n = fbm2(x * 0.42 + 3, y * 0.36, 4) - 0.5;
    vp.setXYZ(i, x + n * 1.4, y, n * 3.1 + Math.sin(y * 0.9) * 0.5);
  }
  veilGeometry.computeVertexNormals();
  const veil = new THREE.Mesh(
    veilGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0x0a1a24,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      roughness: 0.95,
      sheen: 1,
      sheenColor: new THREE.Color(0x74c3e0),
      emissive: 0x07202b,
      emissiveIntensity: 0.55,
      depthWrite: false,
    }),
  );
  veil.position.set(0, 5.4, -1.9);
  veil.rotation.x = 0.12;
  group.add(veil);

  /* frost and ice clawing up the hem */
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * TAU + rand(-0.1, 0.1);
    const height = rand(0.5, 1.9);
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(rand(0.08, 0.19), height, 4),
      lib.ice({ color: 0xa9dcef, emissive: 0x1c6d8a, emissiveIntensity: 0.85, opacity: 0.86 }),
    );
    blade.position.set(
      Math.cos(angle) * rand(2.2, 2.5),
      rand(0.2, 0.7) + height * 0.18,
      Math.sin(angle) * rand(2.2, 2.5),
    );
    blade.rotation.x = rand(-0.25, -0.05);
    blade.rotation.z = rand(-0.14, 0.14);
    group.add(blade);
  }

  return { group, veil };
}

/* ── bone hands ───────────────────────────────────────────── */

function buildHand(side, lib) {
  const hand = new THREE.Group();
  const bone = lib.stone({
    color: 0x9db3c0,
    roughness: 0.58,
    metalness: 0.04,
    emissive: 0x0a1f27,
    emissiveIntensity: 0.75,
  });
  const clawMaterial = lib.ice({ color: 0xe1f7ff, emissive: 0x3fb2d6, emissiveIntensity: 1.6, opacity: 0.92 });

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), bone);
  palm.scale.set(1.05, 1.3, 0.6);
  hand.add(palm);

  for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * 0.16;
    const length = 0.55 + (1 - Math.abs(i - 2) / 2.2) * 0.34;
    const points = [];
    const segments = 6;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      points.push(new THREE.Vector3(spread * t * 1.7, t * length, -Math.pow(t, 2) * 0.52));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    hand.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.042, 6, false), bone));

    const tip = points[segments];
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.05, length * 0.72, 5), clawMaterial);
    claw.position.set(tip.x, tip.y + length * 0.24, tip.z - length * 0.2);
    claw.rotation.x = 0.95;
    hand.add(claw);
  }

  hand.rotation.z = side * 0.18;
  return hand;
}

function buildArm(side, lib) {
  const arm = new THREE.Group();

  const sleeve = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.92, 5.86, 0.02),
        new THREE.Vector3(side * 1.68, 5.4, 0.36),
        new THREE.Vector3(side * 2.06, 4.72, 0.95),
        new THREE.Vector3(side * 1.98, 4.02, 1.52),
      ]),
      44,
      0.23,
      12,
      false,
    ),
    lib.cloth({
      color: 0x0a1a23,
      emissive: 0x082c3a,
      emissiveIntensity: 0.65,
      sheenColor: new THREE.Color(0x7fd0ee),
      roughness: 0.94,
    }),
  );
  arm.add(sleeve);

  /* ragged cuff */
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * TAU;
    const rag = new THREE.Mesh(
      new THREE.PlaneGeometry(rand(0.14, 0.26), rand(0.5, 1.15), 1, 5),
      lib.cloth({ color: 0x091620, side: THREE.DoubleSide, roughness: 0.98 }),
    );
    rag.position.set(
      side * 1.99 + Math.cos(angle) * 0.24,
      3.86 + rand(-0.2, 0.1),
      1.54 + Math.sin(angle) * 0.24,
    );
    rag.rotation.set(rand(-0.2, 0.2), angle, rand(-0.15, 0.15));
    arm.add(rag);
  }

  /* skeletal forearm emerging from the sleeve */
  const bone = lib.stone({
    color: 0x9db3c0,
    roughness: 0.58,
    metalness: 0.04,
    emissive: 0x0a1f27,
    emissiveIntensity: 0.75,
  });
  const wrist = new THREE.Vector3(side * 1.94, 4.05, 1.56);
  const forearm = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 1.98, 4.22, 1.44),
        new THREE.Vector3(side * 1.92, 3.86, 1.62),
        wrist.clone(),
      ]),
      16,
      0.072,
      8,
      false,
    ),
    bone,
  );
  arm.add(forearm);

  const hand = buildHand(side, lib);
  hand.position.copy(wrist).add(new THREE.Vector3(0, -0.3, 0.16));
  hand.rotation.x = 2.46;
  hand.rotation.y = side * 0.12;
  arm.add(hand);

  return { arm, hand };
}

/* ── skull face ───────────────────────────────────────────── */

function buildSkull(lib) {
  const head = new THREE.Group();
  const bone = lib.stone({
    color: 0xa6bac6,
    roughness: 0.6,
    metalness: 0.03,
    emissive: 0x0d2630,
    emissiveIntensity: 0.8,
  });
  const voidMaterial = new THREE.MeshBasicMaterial({ color: 0x000306 });

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.74, 44, 32), bone);
  cranium.scale.set(0.84, 1.06, 0.88);
  cranium.position.y = 0.12;
  const cp = cranium.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const z = cp.getZ(i);
    const n = fbm2(x * 2.1 + 5, z * 2.1 + y * 1.4, 3) - 0.5;
    cp.setXYZ(i, x * (1 + n * 0.06), y * (1 + n * 0.06), z * (1 + n * 0.08));
  }
  cranium.geometry.computeVertexNormals();
  head.add(cranium);

  /* heavy brow */
  for (const side of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.13, 0.2), bone);
    brow.position.set(side * 0.26, 0.22, 0.56);
    brow.rotation.z = side * -0.18;
    brow.rotation.x = 0.2;
    head.add(brow);
  }

  /* cheekbones */
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), bone);
    cheek.position.set(side * 0.4, -0.16, 0.42);
    cheek.scale.set(0.9, 0.62, 1.1);
    head.add(cheek);
  }

  /* sunken sockets — dark pits with a burning pinpoint */
  const sockets = [];
  const pupils = [];
  const pupilMaterial = lib.emissive(0xa8f4ff, 7);
  for (const side of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.235, 20, 16), voidMaterial);
    socket.position.set(side * 0.265, 0.02, 0.47);
    socket.scale.set(1, 1.05, 0.7);
    head.add(socket);
    sockets.push(socket);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), pupilMaterial);
    pupil.position.set(side * 0.265, 0.0, 0.62);
    head.add(pupil);
    pupils.push(pupil);
  }

  const faceGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "150,235,255"),
      color: 0x7fe8ff,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  faceGlow.scale.setScalar(2.4);
  faceGlow.position.set(0, 0.02, 0.66);
  head.add(faceGlow);

  /* nasal void */
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 3), voidMaterial);
  nose.position.set(0, -0.2, 0.62);
  nose.rotation.x = Math.PI;
  head.add(nose);

  /* teeth and a glowing maw */
  const toothMaterial = lib.stone({ color: 0xc3d6de, roughness: 0.42, emissive: 0x123039, emissiveIntensity: 0.9 });

  const upperTeeth = new THREE.Group();
  upperTeeth.position.set(0, -0.34, 0.44);
  for (let i = 0; i < 9; i++) {
    const a = -0.62 + (i / 8) * 1.24;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.032, rand(0.1, 0.17), 4), toothMaterial);
    tooth.position.set(Math.sin(a) * 0.26, -0.03, Math.cos(a) * 0.26);
    tooth.rotation.x = Math.PI;
    tooth.rotation.z = Math.sin(a) * 0.2;
    upperTeeth.add(tooth);
  }
  head.add(upperTeeth);

  const jaw = new THREE.Group();
  jaw.position.set(0, -0.36, 0.06);
  const jawBone = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.2, 0.42), bone);
  jawBone.position.set(0, -0.24, 0.34);
  jawBone.rotation.x = 0.08;
  jaw.add(jawBone);

  for (let i = 0; i < 9; i++) {
    const a = -0.6 + (i / 8) * 1.2;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, rand(0.09, 0.15), 4), toothMaterial);
    tooth.position.set(Math.sin(a) * 0.24, -0.11, 0.34 + Math.cos(a) * 0.22);
    tooth.rotation.z = Math.sin(a) * 0.2;
    jaw.add(tooth);
  }

  const maw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), lib.emissive(0x5fd8f5, 2.4));
  maw.position.set(0, -0.3, 0.36);
  maw.scale.set(1, 0.62, 0.6);
  jaw.add(maw);
  head.add(jaw);

  return { head, jaw, pupils, pupilMaterial, faceGlow, sockets };
}

/* ── the oracle ───────────────────────────────────────────── */

function buildOracle(lib) {
  const group = new THREE.Group();

  const robe = buildRobe(lib);
  group.add(robe.group);

  /* collar of frozen spines */
  for (let i = 0; i < 13; i++) {
    const angle = (i / 13) * TAU;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(rand(0.07, 0.14), rand(0.5, 1.5), 5),
      lib.ice({ color: 0xcdeeff, emissive: 0x2f9fc4, emissiveIntensity: 1.3, opacity: 0.94 }),
    );
    const radius = rand(1.0, 1.3);
    spike.position.set(Math.cos(angle) * radius, rand(6.35, 6.6), Math.sin(angle) * radius);
    spike.rotation.z = Math.cos(angle) * 0.5;
    spike.rotation.x = -Math.sin(angle) * 0.5;
    group.add(spike);
  }

  /* withering arms */
  const right = buildArm(1, lib);
  const left = buildArm(-1, lib);
  group.add(right.arm, left.arm);

  /* neck */
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 0.6, 10),
    lib.stone({ color: 0x0c1c24, roughness: 0.9 }),
  );
  neck.position.y = 6.92;
  group.add(neck);

  const skull = buildSkull(lib);
  skull.head.position.y = 7.42;
  group.add(skull.head);

  /* the cowl — open at the front so the skull burns out of the dark */
  const hoodGeometry = new THREE.ConeGeometry(1.62, 3.24, 40, 7, true, 0.66, TAU - 1.32);
  const hp = hoodGeometry.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i);
    const y = hp.getY(i);
    const z = hp.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = fbm2(Math.cos(angle) * 2.3 + 7.7, Math.sin(angle) * 2.3 + y * 0.45, 3) - 0.5;
    const scale = 1 + fold * 0.17;
    hp.setXYZ(i, x * scale, y + fold * 0.14, z * scale);
  }
  hoodGeometry.computeVertexNormals();

  const hood = new THREE.Mesh(
    hoodGeometry,
    lib.cloth({
      color: 0x081620,
      side: THREE.DoubleSide,
      roughness: 0.96,
      emissive: 0x06202a,
      emissiveIntensity: 0.55,
      sheenColor: new THREE.Color(0x63b6d2),
      sheen: 1,
    }),
  );
  hood.position.set(0, 8.5, -0.05);
  hood.rotation.x = -0.12;
  group.add(hood);

  /* the crown of antlers */
  const crown = new THREE.Group();
  crown.position.y = 8.1;
  group.add(crown);
  const antlerMaterial = lib.ice({
    color: 0xd4f3ff,
    emissive: 0x2ea6cc,
    emissiveIntensity: 1.5,
    opacity: 0.96,
  });
  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * TAU;
    const height = rand(0.9, 2.5);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(rand(0.08, 0.16), height, 5), antlerMaterial);
    spike.position.set(Math.cos(angle) * 1.05, rand(0, 0.2) + height * 0.3, Math.sin(angle) * 1.05);
    spike.rotation.z = -Math.cos(angle) * 0.35;
    spike.rotation.x = Math.sin(angle) * 0.35;
    crown.add(spike);

    if (i % 2 === 0) {
      const barb = new THREE.Mesh(new THREE.ConeGeometry(0.055, height * 0.42, 4), antlerMaterial);
      barb.position.set(Math.cos(angle) * 1.24, height * 0.52, Math.sin(angle) * 1.24);
      barb.rotation.z = -Math.cos(angle) * (0.9 + rand(0, 0.3));
      barb.rotation.x = Math.sin(angle) * (0.9 + rand(0, 0.3));
      crown.add(barb);
    }
  }

  /* shroud flags hanging from the hood */
  for (let i = 0; i < 6; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(rand(0.4, 0.7), rand(1.6, 3.2), 2, 8),
      lib.cloth({
        color: 0x08161f,
        side: THREE.DoubleSide,
        roughness: 0.98,
        emissive: 0x05181f,
        emissiveIntensity: 0.5,
      }),
    );
    flag.position.set(side * rand(0.85, 1.25), 6.85, rand(-0.5, 0.5));
    flag.rotation.set(rand(-0.1, 0.1), rand(-0.4, 0.4), side * rand(0.05, 0.2));
    group.add(flag);
  }

  /* ice growing through the shroud */
  for (let i = 0; i < 10; i++) {
    const angle = rand(0, TAU);
    const y = rand(4.2, 6.6);
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(rand(0.05, 0.12), rand(0.5, 1.4), 4),
      lib.ice({ color: 0xbfe7f5, emissive: 0x1d7c9c, emissiveIntensity: 1.1, opacity: 0.9 }),
    );
    spike.position.set(Math.cos(angle) * rand(1.4, 1.9), y, Math.sin(angle) * rand(1.4, 1.9));
    spike.rotation.z = Math.cos(angle) * 1.1;
    spike.rotation.x = -Math.sin(angle) * 1.1;
    group.add(spike);
  }

  return { group, skull, hood, crown, veil: robe.veil, hands: [right.hand, left.hand] };
}

function createOracleScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081a24, 0.019);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 900);
  camera.position.set(0, 3.6, 30);

  scene.environment = createEnvMap(renderer, { top: 0x061520, horizon: 0x1f4d63, ground: 0x03070c });
  const lib = createMaterialLibrary();

  const sky = createSky({
    top: 0x01060c,
    horizon: 0x0d3145,
    glow: 0x8fd4f5,
    aurora: 0x1c7f93,
    auroraAmount: 0.35,
    moonDir: new THREE.Vector3(0.2, 0.3, -0.9),
  });
  scene.add(sky.mesh);

  /* lighting */
  scene.add(new THREE.HemisphereLight(0x1c4356, 0x02060a, 0.5));

  const keyLight = new THREE.DirectionalLight(0xa8d2e8, 0.6);
  keyLight.position.set(-24, 26, 28);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x9df0ff, 3.8);
  rimLight.position.set(8, 18, -32);
  scene.add(rimLight);

  const coreLight = new THREE.PointLight(0x74e4ff, 58, 46, 2);
  coreLight.position.set(0, 7.2, 1.6);
  scene.add(coreLight);

  const eyeLight = new THREE.PointLight(0xa9f6ff, 14, 14, 2);
  eyeLight.position.set(0, 8.4, 1.4);
  scene.add(eyeLight);

  const groundLight = new THREE.PointLight(0x2f8fb0, 22, 30, 2);
  groundLight.position.set(0, 0.9, 2);
  scene.add(groundLight);

  /* the frozen crater */
  const heightFn = (x, z) => {
    const distance = Math.hypot(x, z);
    const rim = Math.exp(-Math.pow((distance - 27) / 10, 2)) * 11;
    const floorDetail = (fbm2(x * 0.055, z * 0.055, 3) - 0.5) * 0.8;
    const outer = smoothstep(30, 95, distance) * (fbm2(x * 0.02, z * 0.02, 4) - 0.3) * 16;
    const flat = smoothstep(3, 12, distance);
    return rim + floorDetail * flat + outer;
  };

  const terrain = createTerrain({
    size: 420,
    segments: 240,
    heightFn,
    colors: { snow: 0xdcecf8, rock: 0x24384a, shadow: 0x0a141d },
    material: lib.snow({ vertexColors: true, roughness: 0.7, metalness: 0.05 }),
  });
  scene.add(terrain);

  scene.add(createCracks({ count: 44, start: 2.5, radius: 52, color: 0x8cecff, y: 0.08 }));
  scene.add(createCracks({ count: 18, start: 18, radius: 70, color: 0x4f9fbe, y: 0.06 }));

  /* rune circles carved into the ice */
  const innerRing = createRuneCircle({ radius: 7.2, color: 0x9fe9ff, opacity: 0.42, y: 0.1, rings: 2, glyphs: 44 });
  scene.add(innerRing);

  /* ice colonnade around the crater — kept clear of the camera's corridor */
  for (let i = 0; i < 17; i++) {
    let angle = (i / 17) * TAU + 0.16;
    let distance = rand(20, 36);
    let guard = 0;
    while (Math.abs(Math.cos(angle) * distance) < 8 && Math.sin(angle) * distance > 4 && guard < 10) {
      angle += 0.34;
      distance = rand(20, 36);
      guard++;
    }
    const height = rand(9, 24);
    const spike = createIceSpike({
      height,
      radius: rand(0.9, 1.9),
      segments: 7,
      material: lib.ice({
        color: 0x89c6dc,
        emissive: 0x0d5066,
        emissiveIntensity: 0.75,
        opacity: 0.88,
      }),
      seed: i * 4.3,
    });
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    spike.position.set(x, heightFn(x, z) + height / 2 - 0.7, z);
    spike.rotation.z = rand(-0.09, 0.09);
    scene.add(spike);
  }

  /* broken colonnade closer in */
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + 0.55;
    const distance = rand(11, 17);
    if (Math.sin(angle) * distance > 3 && Math.abs(Math.cos(angle) * distance) < 9) continue;
    const height = rand(5, 12);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(rand(0.62, 1.0), rand(0.85, 1.25), height, 16, 4),
      lib.stone({ color: 0x2f4657, roughness: 0.9 }),
    );
    const cx = Math.cos(angle) * distance;
    const cz = Math.sin(angle) * distance;
    const baseY = heightFn(cx, cz) - 1.1;
    column.position.set(cx, baseY + height / 2, cz);
    column.rotation.z = rand(-0.16, 0.16);
    column.rotation.x = rand(-0.1, 0.1);
    scene.add(column);

    const snowCap = new THREE.Mesh(
      new THREE.CylinderGeometry(rand(0.72, 1.15), rand(0.85, 1.3), 0.3, 16),
      lib.snow({ color: 0xd6eaf7, roughness: 0.75 }),
    );
    snowCap.position.set(cx, baseY + height + 0.1, cz);
    snowCap.rotation.z = column.rotation.z;
    scene.add(snowCap);

    if (i % 2 === 0) {
      const icicles = createIcicleCluster({
        count: 7,
        spread: 0.7,
        length: 2.1,
        material: lib.ice({ color: 0xbfe7f5, emissive: 0x146079, emissiveIntensity: 0.8, opacity: 0.9 }),
        seed: i * 3.3,
      });
      icicles.position.set(cx, baseY + height - 0.2, cz);
      scene.add(icicles);
    }
  }

  /* a congregation of frozen worshippers */
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU + 0.35;
    const distance = rand(19, 26);
    if (Math.sin(angle) * distance > 6 && Math.abs(Math.cos(angle) * distance) < 10) continue;
    const figure = createHoodedFigure({
      height: rand(3.6, 5.6),
      material: lib.stone({
        color: 0x5d7f91,
        roughness: 0.86,
        emissive: 0x0a1f28,
        emissiveIntensity: 0.8,
        envMapIntensity: 0.9,
      }),
      seed: i * 2.7,
    });
    const fx = Math.cos(angle) * distance;
    const fz = Math.sin(angle) * distance;
    figure.position.set(fx, heightFn(fx, fz) - 0.75, fz);
    figure.rotation.y = Math.atan2(-Math.cos(angle), -Math.sin(angle));
    figure.rotation.z = rand(-0.09, 0.09);
    scene.add(figure);
  }

  /* the dais */
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.9, 1.1, 8),
    lib.ice({ color: 0x7fb6cb, emissive: 0x0b3f52, emissiveIntensity: 0.9, opacity: 0.95 }),
  );
  dais.position.y = 0.45;
  scene.add(dais);

  const daisRing = createRuneCircle({ radius: 4.1, color: 0x9fe9ff, opacity: 0.5, y: 1.02, rings: 1, glyphs: 30 });
  daisRing.rotation.x = -Math.PI / 2;
  scene.add(daisRing);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + 0.2;
    const spike = new THREE.Mesh(
      new THREE.ConeGeometry(rand(0.1, 0.22), rand(0.7, 2.1), 5),
      lib.ice({ color: 0xcdeeff, emissive: 0x2f9fc4, emissiveIntensity: 1.1, opacity: 0.92 }),
    );
    spike.position.set(Math.cos(angle) * 4.3, 1.2, Math.sin(angle) * 4.3);
    spike.rotation.z = Math.cos(angle) * 0.35;
    spike.rotation.x = -Math.sin(angle) * 0.35;
    scene.add(spike);
  }

  const oracle = buildOracle(lib);
  oracle.group.position.y = 1.05;
  scene.add(oracle.group);

  /* ichor mist pooling around the hem */
  const breath = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "150,235,255"),
      color: 0x9fe8ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  breath.scale.set(5.4, 3.4, 1);
  breath.position.set(0, 7.9, 1.1);
  oracle.group.add(breath);

  /* shard volley */
  const volley = [];
  const shardGeometry = new THREE.OctahedronGeometry(0.3, 0);
  shardGeometry.scale(1, 2.6, 1);
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(
      shardGeometry,
      lib.ice({ color: 0xcdf4ff, emissive: 0x36b4dd, emissiveIntensity: 1.7, opacity: 0.92 }),
    );
    const trail = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: streakTexture(),
        color: 0x8fe4ff,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    trail.scale.set(0.6, 5.2, 1);
    scene.add(mesh, trail);
    volley.push({
      mesh,
      trail,
      offset: i / 14,
      side: i % 2 === 0 ? 1 : -1,
      speed: rand(0.09, 0.16),
      sway: rand(1.8, 3.6),
    });
  }

  /* broken shards orbiting the oracle like a halo of knives */
  const halo = [];
  for (let i = 0; i < 16; i++) {
    const shard = new THREE.Mesh(
      new THREE.OctahedronGeometry(rand(0.1, 0.26), 0),
      lib.ice({ color: 0xd6f6ff, emissive: 0x3aa9cf, emissiveIntensity: 1.8, opacity: 0.9 }),
    );
    shard.scale.set(1, rand(2.2, 3.8), 1);
    scene.add(shard);
    halo.push({
      mesh: shard,
      radius: rand(2.6, 5.4),
      speed: rand(0.1, 0.28) * (i % 2 === 0 ? 1 : -1),
      phase: rand(0, TAU),
      y: rand(2.4, 10.2),
      bob: rand(0.3, 1.1),
    });
  }

  /* atmosphere */
  const snow = createSnow({ count: 6000, area: 140, height: 72, size: 1.25, speed: 1.05, opacity: 0.75 });
  scene.add(snow.mesh);

  const fog = createGroundFog({ size: 190, color: 0x8ec4dc, density: 0.62, y: 0.55 });
  scene.add(fog.mesh);

  const update = (time, delta, pointer) => {
    sky.update(time);
    snow.update(time);
    fog.update(time);

    /* the figure breathes, twitches and looms */
    const breathScale = 1 + Math.sin(time * 1.05) * 0.008;
    oracle.group.scale.set(1, breathScale, 1);

    const twitch = Math.max(0, Math.sin(time * 0.83) - 0.93) * 8;
    const lean = Math.sin(time * 0.19) * 0.04;
    oracle.group.rotation.y = lean + (pointer?.x ?? 0) * 0.05 + twitch * 0.02;
    oracle.group.rotation.z = Math.sin(time * 0.31) * 0.008;

    oracle.skull.head.rotation.y = Math.sin(time * 0.41) * 0.14 - (pointer?.x ?? 0) * 0.16 + twitch * 0.1;
    oracle.skull.head.rotation.x = Math.sin(time * 0.53) * 0.05 + twitch * 0.03;
    oracle.skull.head.rotation.z = Math.sin(time * 0.29) * 0.06;

    const jawOpen = 0.12 + Math.max(0, Math.sin(time * 0.7)) * 0.18 + twitch * 0.22;
    oracle.skull.jaw.rotation.x = jawOpen;
    oracle.skull.jaw.position.y = -0.36 - jawOpen * 0.06;

    const flicker = 0.8 + Math.sin(time * 2.7) * 0.12 + Math.sin(time * 7.3) * 0.06 + twitch * 0.3;
    eyeLight.intensity = 15 * flicker;
    oracle.skull.faceGlow.material.opacity = 0.24 * flicker;
    oracle.skull.pupilMaterial.color.setRGB(0.66 * flicker * 6, 0.96 * flicker * 6, flicker * 6);

    oracle.crown.rotation.y = time * 0.1;
    oracle.crown.position.y = 8.1 + Math.sin(time * 0.8) * 0.05;
    oracle.veil.rotation.x = 0.12 + Math.sin(time * 0.44) * 0.05;
    oracle.veil.rotation.z = Math.sin(time * 0.31) * 0.03;

    breath.material.opacity = 0.1 + Math.max(0, Math.sin(time * 0.7)) * 0.13;
    breath.scale.set(5.2 + Math.sin(time * 0.7) * 0.7, 3.2 + Math.sin(time * 0.7) * 0.5, 1);

    for (const hand of oracle.hands) {
      hand.rotation.x = 2.46 + Math.sin(time * 0.9 + hand.position.x) * 0.08 + twitch * 0.15;
      hand.rotation.z = Math.sign(hand.position.x || 1) * 0.18;
    }

    coreLight.intensity = 52 + Math.sin(time * 1.6) * 8;
    groundLight.intensity = 20 + Math.sin(time * 1.2) * 5;
    innerRing.material.opacity = 0.34 + Math.sin(time * 1.4) * 0.1;
    daisRing.rotation.z = time * 0.04;

    /* shards scream past the camera */
    for (const shard of volley) {
      const p = (time * shard.speed + shard.offset) % 1;
      const z = -20 + p * 56;
      const x = shard.side * (1.6 + Math.sin(p * 3.4 + shard.offset * 6) * shard.sway) * (0.35 + p * 1.2);
      const y = 8.2 - p * 5.4 + Math.sin(p * 5.2 + shard.offset * 7) * 0.7;
      shard.mesh.position.set(x, y, z);
      shard.mesh.rotation.set(time * 2.4 + shard.offset * 4, time * 1.7, time * 1.1);
      shard.mesh.visible = p > 0.04;
      shard.trail.position.set(x, y + 1.1, z - 3.2);
      shard.trail.material.opacity = 0.34 * Math.sin(p * Math.PI);
    }

    for (const item of halo) {
      const a = time * item.speed + item.phase;
      item.mesh.position.set(
        Math.cos(a) * item.radius,
        item.y + Math.sin(time * 0.6 + item.phase) * item.bob,
        Math.sin(a) * item.radius,
      );
      item.mesh.rotation.set(time * 1.1 + item.phase, time * 1.6, time * 0.8);
    }

    const intro = clamp01(time / 9);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 1.3 + Math.sin(time * 0.21) * 0.42 + Math.sin(time * 1.7) * 0.02,
      3.3 + eased * 2.9 + Math.sin(time * 0.34) * 0.09 + Math.cos(time * 5.1) * 0.012,
      30 - eased * 13.5,
    );
    camera.lookAt(px * 0.5, 6.4 + eased * 1.5 + Math.sin(time * 0.24) * 0.12, 0);
  };

  return { scene, camera, baseFov: 44, update };
}

/* ── what the player module consumes ──────────────────────── */

export {
  CinematicShader,
  TAU,
  clamp01,
  createCracks,
  createDeadTree,
  createEnvMap,
  createGroundFog,
  createHoodedFigure,
  createIceSpike,
  createIcicleCluster,
  createMaterialLibrary,
  createOracleScene,
  createRock,
  createRuneCircle,
  createSky,
  createSnow,
  createTerrain,
  createWinterScene,
  fbm2,
  glowTexture,
  rand,
  runeTexture,
  smoothstep,
};