// Soul Fragments: The Hearth Warden
// The entire cutscene — scene, shaders, warden, overlay and page — lives in this one file.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AnimatePresence, motion } from 'framer-motion';

// --- maths helpers ---------------------------------------------------------
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOut = (v) => 1 - Math.pow(1 - v, 3);
const easeInOut = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

// --- generated textures ----------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGlowTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.72, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlyphTextures(count = 6) {
  const textures = [];
  for (let i = 0; i < count; i++) {
    const random = mulberry32(9241 + i * 431);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.96)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const nodes = [];
    const nodeCount = 3 + Math.floor(random() * 3);
    for (let n = 0; n < nodeCount; n++) {
      nodes.push([18 + random() * 92, 18 + random() * 92]);
    }

    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let n = 0; n < nodes.length - 1; n++) {
      ctx.moveTo(nodes[n][0], nodes[n][1]);
      ctx.lineTo(nodes[n + 1][0], nodes[n + 1][1]);
    }
    ctx.stroke();

    if (random() > 0.45) {
      ctx.beginPath();
      ctx.arc(nodes[0][0], nodes[0][1], 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (random() > 0.5) {
      ctx.lineWidth = 4;
      const start = random() * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 24 + random() * 10, start, start + 2.2);
      ctx.stroke();
    }
    if (random() > 0.6) {
      ctx.lineWidth = 5;
      const bx = nodes[nodes.length - 1][0];
      const by = nodes[nodes.length - 1][1];
      ctx.beginPath();
      ctx.moveTo(bx - 9, by);
      ctx.lineTo(bx + 9, by);
      ctx.moveTo(bx, by - 9);
      ctx.lineTo(bx, by + 9);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
  }
  return textures;
}

// --- materials -------------------------------------------------------------
// writhing, wet flesh for the arms
function makeFleshMaterial({ time, agitate } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: time || { value: 0 },
      uAgitate: agitate || { value: 0 },
      uFade: { value: 1 },
      uMeat: { value: new THREE.Color(0x7d332c) },
      uRot: { value: new THREE.Color(0x2b0d12) },
      uBruise: { value: new THREE.Color(0x35203f) },
      uVein: { value: new THREE.Color(0x120811) },
      uGlow: { value: new THREE.Color(0x4dffa0) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uAgitate;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      void main() {
        vLocal = position;
        vec3 p = position;

        // something is moving underneath the skin
        float writhing = sin(p.y * 7.0 - uTime * 3.4 + p.x * 5.0)
                       * sin(p.z * 6.0 + uTime * 2.6 - p.y * 2.0);
        float knots = sin(p.y * 19.0 + uTime * 1.7 + p.x * 11.0)
                    * sin(p.z * 17.0 - uTime * 1.3);
        float band = smoothstep(0.45, 1.0, sin(p.y * 3.6 - uTime * 3.0) * 0.5 + 0.5);
        float amp = 0.028 + uAgitate * 0.05;
        p += normal * (writhing * amp + knots * amp * 0.55 + band * 0.045);

        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAgitate;
      uniform vec3 uMeat;
      uniform vec3 uRot;
      uniform vec3 uBruise;
      uniform vec3 uVein;
      uniform vec3 uGlow;
      uniform float uFade;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int k = 0; k < 4; k++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vec2(
          dot(vLocal, vec3(1.9, 1.1, 2.7)),
          dot(vLocal, vec3(-1.3, 2.3, 0.9))
        );

        float n1 = fbm(uv * 1.6 + vec2(uTime * 0.09, -uTime * 0.05));
        float n2 = fbm(uv * 4.1 - vec2(uTime * 0.16, uTime * 0.11));
        float n3 = fbm(uv * 9.0 + vec2(uTime * 0.3, 0.0));

        // mottled, half-rotted muscle
        vec3 col = mix(uMeat, uRot, smoothstep(0.33, 0.78, n1));
        col = mix(col, uBruise, smoothstep(0.52, 0.92, n2) * 0.78);
        col *= 0.7 + n3 * 0.65;

        // raised veins branching under the skin
        float ridge = abs(fbm(uv * 3.2 + vec2(0.0, uTime * 0.06)) - 0.5);
        float vein = 1.0 - smoothstep(0.0, 0.055, ridge);
        float veinCore = 1.0 - smoothstep(0.0, 0.018, ridge);
        col = mix(col, uVein, vein * 0.65);
        col += uGlow * veinCore * (0.3 + uAgitate * 1.2);

        vec3 normalW = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 lightDir = normalize(vec3(0.25, 0.5, 1.0));

        // wet, slick highlights
        vec3 halfV = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normalW, halfV), 0.0), 40.0);
        float fresnel = pow(1.0 - max(dot(normalW, viewDir), 0.0), 2.2);
        float slime = smoothstep(0.55, 1.0, fbm(uv * 5.5 + vec2(-uTime * 0.35, uTime * 0.2)));
        col += vec3(0.5, 0.66, 0.58) * spec * (0.55 + slime * 1.5);
        col += uGlow * fresnel * 0.28;

        // muscle contracting in waves
        float pulse = sin(vLocal.y * 3.2 - uTime * 3.6 + n1 * 5.0) * 0.5 + 0.5;
        col *= 0.66 + pulse * 0.6;

        gl_FragColor = vec4(col, uFade);
      }
    `,
  });
}

// bark, moss and running blood for the body
function makeHideMaterial({ time, reveal, agitate, folds = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: time || { value: 0 },
      uReveal: reveal || { value: 4.9 },
      uAgitate: agitate || { value: 0 },
      uFolds: { value: folds },
      uBarkDark: { value: new THREE.Color(0x130e0b) },
      uBarkLight: { value: new THREE.Color(0x3b2a1d) },
      uMoss: { value: new THREE.Color(0x2f4d1f) },
      uBloodDark: { value: new THREE.Color(0x2b0609) },
      uBloodWet: { value: new THREE.Color(0x801a13) },
      uRim: { value: new THREE.Color(0x63ffb8) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uAgitate;
      uniform float uFolds;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying float vAngle;

      void main() {
        vLocal = position;
        vAngle = atan(position.x, position.z);

        float cloth = sin(position.y * 3.1 - uTime * 0.8 + position.x * 2.2)
                    * sin(position.z * 2.4 + uTime * 0.55);
        vec3 p = position + normal * cloth * (0.007 + uAgitate * 0.02);

        float angle = vAngle;
        float ridge = (sin(angle * 6.0 + position.y * 0.5) * 0.5 + 0.5)
                    * (sin(angle * 11.0 - position.y * 1.3) * 0.5 + 0.5);
        float hunchFade = 1.0 - smoothstep(2.85, 3.8, p.y);
        p += normal * (ridge * 0.07 + sin(position.y * 5.2 + angle * 2.0) * 0.02) * uFolds * (0.4 + hunchFade * 0.6);
        p.z += sin(clamp(p.y / 4.7, 0.0, 1.0) * 3.14159) * 0.2 * uFolds * hunchFade;

        // slow, heavy heave of something breathing under the bark, roots crawling
        float heave = sin(p.y * 1.7 - uTime * 0.75 + p.x * 0.9) * sin(p.z * 1.4 + uTime * 0.5);
        float crawl = sin(p.y * 6.0 + angle * 3.0 - uTime * 1.1) * sin(angle * 5.0 - uTime * 0.6);
        float swell = smoothstep(0.4, 1.0, sin(p.y * 2.1 + uTime * 1.2) * 0.5 + 0.5);
        p += normal * (heave * 0.035 + crawl * 0.018 + swell * 0.03 * uAgitate);

        vec4 worldPosition = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPosition.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uReveal;
      uniform float uAgitate;
      uniform vec3 uBarkDark;
      uniform vec3 uBarkLight;
      uniform vec3 uMoss;
      uniform vec3 uBloodDark;
      uniform vec3 uBloodWet;
      uniform vec3 uRim;
      varying vec3 vLocal;
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying float vAngle;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int k = 0; k < 4; k++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float fray = noise(vec2(vLocal.x * 9.0, vLocal.y * 7.0 - uTime * 0.4)) * 0.12;
        float dissolve = vLocal.y + sin(vLocal.y * 14.0 + uTime * 2.4 + vLocal.x * 8.0) * 0.11 + fray;
        if (dissolve > uReveal) discard;
        float edge = smoothstep(uReveal - 0.2, uReveal, dissolve);

        // bark: fibrous grooves running down the hide
        float fibre = fbm(vec2(vAngle * 7.0, vLocal.y * 1.2));
        float groove = pow(abs(sin(vAngle * 26.0 + fibre * 5.0 + vLocal.y * 0.6)), 0.6);
        float bark = fbm(vec2(vAngle * 4.0, vLocal.y * 3.0 + uTime * 0.05));

        vec3 col = mix(uBarkDark, uBarkLight, bark);
        col = mix(col, uBarkDark, groove * 0.55);

        // moss and lichen creeping up from the ground
        float mossMask = smoothstep(0.45, 0.85, fbm(vec2(vAngle * 5.0, vLocal.y * 2.2 - uTime * 0.03)))
                       * (1.0 - smoothstep(1.5, 3.9, vLocal.y));
        col = mix(col, uMoss, mossMask * 0.85);
        col += uMoss * mossMask * 0.06 * (sin(uTime * 1.3 + vLocal.y * 3.0) * 0.5 + 0.5);

        // blood welling out of the wood and running down in streaks
        float streak = fbm(vec2(vAngle * 9.0, vLocal.y * 1.1 - uTime * 0.42));
        float bloodMask = smoothstep(0.52, 0.86, streak + groove * 0.25);
        float seep = smoothstep(0.5, 0.95, fbm(vec2(vAngle * 3.0, vLocal.y * 4.0 - uTime * 0.55)));
        vec3 blood = mix(uBloodDark, uBloodWet, smoothstep(0.2, 0.9, bark + seep * 0.4));
        col = mix(col, blood, clamp(bloodMask * 0.85 + seep * 0.3, 0.0, 1.0));

        vec3 normalW = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 lightDir = normalize(vec3(0.2, 0.55, 0.9));
        vec3 halfV = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normalW, halfV), 0.0), 34.0);
        float wet = clamp(bloodMask + seep * 0.45, 0.0, 1.0);

        col += vec3(0.42, 0.28, 0.26) * spec * (0.25 + wet * 1.6);
        col += uBloodWet * wet * (0.05 + uAgitate * 0.22);

        float fresnel = pow(1.0 - max(dot(normalW, viewDir), 0.0), 3.0);
        col += uRim * fresnel * (0.1 + uAgitate * 0.12);

        float breath = sin(vLocal.y * 1.9 - uTime * 1.1) * 0.5 + 0.5;
        col *= 0.82 + breath * 0.3;

        col += uRim * edge * 0.85;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// cracked bone with blood pulsing in the seams, for the face and antlers
function makeBoneMaterial({ time, agitate } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: time || { value: 0 },
      uAgitate: agitate || { value: 0 },
      uBone: { value: new THREE.Color(0x9a9a86) },
      uBoneDark: { value: new THREE.Color(0x2f2f28) },
      uBlood: { value: new THREE.Color(0x6d0f0c) },
      uMoss: { value: new THREE.Color(0x2c4a20) },
      uRim: { value: new THREE.Color(0x9fd8c0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPosition.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uAgitate;
      uniform vec3 uBone;
      uniform vec3 uBoneDark;
      uniform vec3 uBlood;
      uniform vec3 uMoss;
      uniform vec3 uRim;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int k = 0; k < 4; k++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // world space, so the pattern runs unbroken across every bone of the face
        vec2 uv = vec2(
          dot(vWorldPos, vec3(1.7, 1.1, 2.3)),
          dot(vWorldPos, vec3(-1.2, 2.1, 0.8))
        ) * 5.0;

        float grain = fbm(uv * 1.1 + vec2(uTime * 0.04, 0.0));
        vec3 col = mix(uBoneDark, uBone, grain);

        // dry, splitting bone
        float ridge = abs(fbm(uv * 1.9) - 0.5);
        float crack = 1.0 - smoothstep(0.0, 0.035, ridge);
        col = mix(col, uBoneDark * 0.55, crack * 0.9);

        // blood seeping through the cracks, pulsing behind the face
        float pulse = 0.5 + 0.5 * sin(uTime * 2.4 + grain * 7.0);
        col += uBlood * crack * (0.3 + pulse * 0.55 + uAgitate * 0.7);

        // rot and moss where the wet runs off
        float low = clamp(0.55 - (vWorldPos.y - 3.15) * 0.9, 0.0, 1.0);
        float rot = smoothstep(0.5, 0.9, fbm(uv * 2.3)) * low;
        col = mix(col, uMoss, rot * 0.55);
        col += uMoss * rot * 0.05;

        vec3 normalW = normalize(vNormalW);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 lightDir = normalize(vec3(0.35, 0.5, 0.85));
        vec3 halfV = normalize(lightDir + viewDir);

        float ndl = max(dot(normalW, lightDir), 0.0);
        float spec = pow(max(dot(normalW, halfV), 0.0), 24.0);
        float fresnel = pow(1.0 - max(dot(normalW, viewDir), 0.0), 2.6);

        col *= 0.4 + ndl * 0.85;
        col += vec3(0.5, 0.55, 0.5) * spec * (0.3 + crack * 0.9);
        col += uRim * fresnel * 0.28;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// the caged heart
function makeHeartMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uCorrupt: { value: 0 },
      uColorA: { value: new THREE.Color(0x9fe9ff) },
      uColorB: { value: new THREE.Color(0x3affa6) },
      uColorC: { value: new THREE.Color(0xc44bff) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPulse;
      varying vec3 vNormalV;
      varying float vNoise;

      void main() {
        vec3 p = position;
        float n = sin(p.x * 3.1 + uTime * 2.2)
                * sin(p.y * 2.6 + uTime * 1.7)
                * sin(p.z * 3.4 + uTime * 1.9);
        n += 0.5 * sin(p.y * 6.0 - uTime * 3.1) * sin(p.x * 5.2 + uTime * 1.4);
        vNoise = n;
        p += normal * n * (0.1 + uPulse * 0.34);
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform float uCorrupt;
      uniform float uPulse;
      varying vec3 vNormalV;
      varying float vNoise;

      void main() {
        vec3 color = mix(uColorA, uColorB, smoothstep(-0.7, 0.9, vNoise));
        color = mix(color, uColorC, uCorrupt * 0.65 * smoothstep(0.0, 1.0, vNoise));
        float rim = pow(1.0 - abs(vNormalV.z), 1.7);
        vec3 finalColor = color * (0.5 + uPulse * 0.62) + color * rim * 0.9;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

// --- the soul shard --------------------------------------------------------
function createSoulShard({ position }) {
  const group = new THREE.Group();
  const basePosition = position.clone();
  group.position.copy(basePosition);

  const crystalMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4f2ff,
    emissive: 0x74d8ff,
    emissiveIntensity: 2.6,
    roughness: 0.1,
    metalness: 0.4,
    transparent: true,
    opacity: 0.95,
    flatShading: true,
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), crystalMaterial);
  crystal.scale.set(0.82, 1.55, 0.82);
  group.add(crystal);

  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xf2feff });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), coreMaterial);
  group.add(core);

  const glowTexture = makeGlowTexture();
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x8fe0ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.setScalar(2.9);
  group.add(halo);

  const light = new THREE.PointLight(0x8fd8ff, 34, 18, 2);
  group.add(light);

  const prisonMaterial = new THREE.MeshStandardMaterial({
    color: 0x18321f,
    emissive: 0x2dff88,
    emissiveIntensity: 1.25,
    roughness: 0.5,
    metalness: 0.1,
  });

  const prisonVines = [];
  for (let i = 0; i < 8; i++) {
    const points = [];
    const turns = 1.3 + (i % 3) * 0.35;
    const direction = i % 2 === 0 ? 1 : -1;
    const startAngle = (i / 8) * Math.PI * 2;
    const radiusBase = 0.58 + (i % 3) * 0.06;
    const height = 1.15 + (i % 4) * 0.14;

    for (let s = 0; s <= 12; s++) {
      const f = s / 12;
      const angle = startAngle + f * turns * Math.PI * 2 * direction;
      const radius = radiusBase * (1 - Math.sin(f * Math.PI) * 0.28) + Math.sin(f * 9) * 0.035;
      points.push(
        new THREE.Vector3(Math.cos(angle) * radius, -height / 2 + f * height, Math.sin(angle) * radius)
      );
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 90, 0.026, 6, false);
    const mesh = new THREE.Mesh(geometry, prisonMaterial);
    prisonVines.push(mesh);
    group.add(mesh);
  }

  const glyphTextures = makeGlyphTextures(7);
  const glyphs = [];
  for (let i = 0; i < 18; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glyphTextures[i % glyphTextures.length],
        color: 0xa8ffcd,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    const angle = (i / 18) * Math.PI * 2;
    const radius = 0.92 + (i % 5) * 0.09;
    const y = ((i % 6) / 5 - 0.5) * 1.5;
    sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    sprite.scale.setScalar(0.26 + (i % 4) * 0.05);
    sprite.userData = { angle, radius, baseY: y, phase: i * 0.7 };
    glyphs.push(sprite);
    group.add(sprite);
  }

  const escapeOffset = new THREE.Vector3();
  const fromVector = new THREE.Vector3();
  const shakeVector = new THREE.Vector3();

  function update({ time, delta, drain, absorb, heartWorld }) {
    crystal.rotation.y += delta * (0.55 + drain * 2.4);
    crystal.rotation.z = Math.sin(time * 0.7) * 0.1 + drain * Math.sin(time * 24) * 0.08;
    core.rotation.x -= delta * 1.3;
    core.rotation.y += delta * 0.9;

    const pulse = 1 + Math.sin(time * 4.2) * 0.1 * (0.35 + drain);
    core.scale.setScalar(pulse);
    crystalMaterial.emissiveIntensity = 2.6 * (1 - drain * 0.78) * (1 + Math.sin(time * 3.1) * 0.07);
    halo.material.opacity = Math.max(0.05, 0.85 * (1 - drain * 0.62) + Math.sin(time * 5) * 0.04);
    light.intensity = 34 * (1 - drain * 0.72);

    shakeVector.set(
      Math.sin(time * 27) * 0.02 * drain,
      Math.sin(time * 0.9) * 0.07 + Math.sin(time * 31) * 0.015 * drain,
      Math.cos(time * 23) * 0.02 * drain
    );
    fromVector.copy(basePosition).add(shakeVector);

    if (absorb > 0) {
      escapeOffset.copy(fromVector).lerp(heartWorld, absorb);
      escapeOffset.y += Math.sin(absorb * Math.PI) * 0.3;
      group.position.copy(escapeOffset);
      const scale = Math.max(0.001, 1 - absorb * 0.9);
      group.scale.setScalar(scale);
      group.visible = absorb < 0.995;
    } else {
      group.position.copy(fromVector);
      group.scale.setScalar(1);
      group.visible = true;
    }

    prisonMaterial.emissiveIntensity = 0.8 + Math.sin(time * 2.2) * 0.3 + drain * 0.9;

    for (const glyph of glyphs) {
      const { angle, radius, baseY, phase } = glyph.userData;
      const spin = angle + time * (0.34 + drain * 1.5);
      glyph.position.set(
        Math.cos(spin) * radius,
        baseY + Math.sin(time * 1.4 + phase) * 0.09,
        Math.sin(spin) * radius
      );
      glyph.material.opacity =
        (0.35 + 0.55 * (0.5 + 0.5 * Math.sin(time * 1.9 + phase))) * (0.4 + drain * 0.9);
    }
  }

  return { group, update, basePosition };
}

// --- the meadow ------------------------------------------------------------
function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const waves =
    Math.sin(x * 0.34) * Math.cos(z * 0.41) * 0.34 +
    Math.sin(x * 0.11 + z * 0.19) * 0.52 +
    Math.sin(x * 0.7 - z * 0.55) * 0.08;
  const crater = -1.05 * Math.exp(-(r * r) / 10.5);
  const rim = Math.max(0, r - 8) * 0.1;
  return waves + crater + rim;
}

function buildGround() {
  const geometry = new THREE.PlaneGeometry(90, 90, 120, 120);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = [];
  const inner = new THREE.Color(0x061510);
  const outer = new THREE.Color(0x000102);
  const scratch = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, terrainHeight(x, z));
    const r = Math.hypot(x, z);
    scratch.copy(outer).lerp(inner, Math.max(0, 1 - r / 15));
    colors.push(scratch.r, scratch.g, scratch.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.05,
    flatShading: true,
  });
  return new THREE.Mesh(geometry, material);
}

function buildGrass(shardPosition) {
  const count = 3200;
  const segments = 4;
  const positions = [];
  const heights = [];
  const phases = [];
  const tints = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.pow(Math.random(), 0.62) * 17;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const baseY = terrainHeight(x, z);
    const bladeHeight = 0.62 + Math.random() * 1.25;
    const bladeWidth = 0.035 + Math.random() * 0.03;
    const rotation = Math.random() * Math.PI * 2;
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const phase = Math.random();
    const tint = Math.random();

    const pushVertex = (lx, ly) => {
      positions.push(x + lx * cosR, baseY + ly, z + lx * sinR);
      heights.push(ly / bladeHeight);
      phases.push(phase);
      tints.push(tint);
    };

    for (let s = 0; s < segments; s++) {
      const y0 = (s / segments) * bladeHeight;
      const y1 = ((s + 1) / segments) * bladeHeight;
      const w0 = bladeWidth * (1 - (s / segments) * 0.82);
      const w1 = bladeWidth * (1 - ((s + 1) / segments) * 0.82);

      pushVertex(-w0, y0);
      pushVertex(w0, y0);
      pushVertex(w1, y1);

      pushVertex(-w0, y0);
      pushVertex(w1, y1);
      pushVertex(-w1, y1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(tints, 1));

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uCorrupt: { value: 0.2 },
      uShard: { value: shardPosition.clone() },
      uFogColor: { value: new THREE.Color(0x03080c) },
      uFogDensity: { value: 0.064 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uCorrupt;
      uniform vec3 uShard;
      attribute float aHeight;
      attribute float aPhase;
      attribute float aTint;
      varying float vHeight;
      varying float vTint;
      varying float vDistance;

      void main() {
        vec3 p = position;
        float bend = aHeight * aHeight;
        float phase = aPhase * 6.2831853;

        float sway = sin(uTime * 0.9 + phase + p.x * 0.32) * 0.16
                   + sin(uTime * 0.43 + phase * 2.3 + p.z * 0.48) * 0.09;
        p.x += sway * bend * (0.7 + uCorrupt * 1.7);
        p.z += cos(uTime * 0.78 + phase * 1.7) * 0.1 * bend * (0.7 + uCorrupt * 1.2);
        p.y += sin(uTime * 1.5 + phase * 3.0) * 0.035 * bend * uCorrupt;

        vec2 toShard = normalize(uShard.xz - p.xz + vec2(0.0001));
        p.xz += toShard * bend * (0.02 + uCorrupt * 0.42);

        vec4 viewPosition = viewMatrix * vec4(p, 1.0);
        vDistance = -viewPosition.z;
        vHeight = aHeight;
        vTint = aTint;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCorrupt;
      uniform vec3 uShard;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      varying float vHeight;
      varying float vTint;
      varying float vDistance;

      void main() {
        vec3 base = mix(vec3(0.006, 0.017, 0.012), vec3(0.022, 0.062, 0.038), vTint);
        vec3 color = base * (0.55 + vHeight * 0.85);

        float glow = pow(vHeight, 3.4);
        color += vec3(0.18, 0.72, 0.36) * glow * (0.04 + uCorrupt * 0.38);

        // withered, ash-grey tips
        color += vec3(0.12, 0.14, 0.11) * pow(vHeight, 6.0) * 0.35;

        float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vDistance * vDistance);
        color = mix(color, uFogColor, clamp(fogFactor, 0.0, 1.0));

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  return new THREE.Mesh(geometry, material);
}

function makeVineCurve(random) {
  const angle = random() * Math.PI * 2;
  const startRadius = 1.6 + random() * 4.2;
  const startX = Math.cos(angle) * startRadius;
  const startZ = Math.sin(angle) * startRadius;
  const points = [];
  const steps = 9;
  const topY = 1.0 + random() * 1.5;
  const wobble = random() * Math.PI * 2;

  for (let s = 0; s < steps; s++) {
    const f = s / (steps - 1);
    const swing = Math.sin(f * 5.2 + wobble) * 0.55 * f;
    const radius = startRadius * (1 - f * 0.72);
    const x = Math.cos(angle + swing) * radius;
    const z = Math.sin(angle + swing) * radius;
    const y = terrainHeight(startX, startZ) + 0.05 + Math.pow(f, 0.8) * (topY + 0.9);
    points.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(points);
}

function buildSwarmVines() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x16301f,
    emissive: 0x35ff92,
    emissiveIntensity: 1.0,
    roughness: 0.55,
    metalness: 0.05,
  });

  const vines = [];
  for (let i = 0; i < 14; i++) {
    const seed = i * 137.13;
    const random = () => {
      const v = Math.sin(seed + i * 12.9898 + vines.length * 7.13) * 43758.5453;
      return v - Math.floor(v);
    };
    const curve = makeVineCurve(random);
    const geometry = new THREE.TubeGeometry(curve, 70, 0.032 + (i % 3) * 0.012, 6, false);
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    vines.push({
      mesh,
      indexCount: geometry.index ? geometry.index.count : 0,
      offset: i * 1.7,
      cycle: 7 + (i % 5) * 1.6,
      seed: 0.4 + (i % 7) * 0.18,
    });
  }

  return { group, vines, material };
}

function buildMotes(shardPosition) {
  const count = 420;
  const positions = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.5 + Math.pow(Math.random(), 0.7) * 12;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random() * 8;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    rands[i] = Math.random();
    sizes[i] = 6 + Math.random() * 16;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rands, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uCorrupt: { value: 0.2 },
      uShard: { value: shardPosition.clone() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uCorrupt;
      attribute float aRand;
      attribute float aSize;
      varying float vAlpha;
      varying float vRand;

      void main() {
        vec3 p = position;
        float t = uTime * (0.22 + aRand * 0.3) + aRand * 12.0;
        p.y = mod(p.y + uTime * (0.18 + aRand * 0.32), 8.0);
        p.x += sin(t * 1.7) * (0.5 + uCorrupt * 1.4);
        p.z += cos(t * 1.4) * (0.5 + uCorrupt * 1.4);

        vec4 viewPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = aSize * (14.0 / max(-viewPosition.z, 0.1)) * (1.0 + uCorrupt * 0.7);

        vAlpha = smoothstep(0.0, 1.2, p.y) * (1.0 - smoothstep(5.0, 8.0, p.y));
        vRand = aRand;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uCorrupt;
      varying float vAlpha;
      varying float vRand;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float falloff = pow(1.0 - d * 2.0, 2.0);
        vec3 warm = vec3(0.35, 1.0, 0.55);
        vec3 cool = vec3(0.55, 0.85, 1.0);
        vec3 color = mix(cool, warm, uCorrupt * (0.4 + vRand * 0.6));
        gl_FragColor = vec4(color, falloff * vAlpha * (0.35 + uCorrupt * 0.5));
      }
    `,
  });

  return new THREE.Points(geometry, material);
}

function buildDeadTrees() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0x010406 });

  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * Math.PI * 2 + 0.55;
    const radius = (i % 3 === 0 ? 17 : 10.5) + ((i * 7) % 5) * 0.65;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 5.4 + ((i * 3) % 6) * 1.2;
    const lean = (i % 2 ? 1 : -1) * (0.06 + ((i * 5) % 4) * 0.04);

    const trunkGeo = new THREE.CylinderGeometry(0.05, 0.3, height, 5, 1);
    const trunk = new THREE.Mesh(trunkGeo, material);
    trunk.position.set(x, terrainHeight(x, z) + height / 2, z);
    trunk.rotation.z = lean;
    trunk.rotation.x = Math.cos(angle) * lean * 0.7;
    group.add(trunk);

    for (let b = 0; b < 5; b++) {
      const branchHeight = height * (0.32 + b * 0.14);
      const branchGeo = new THREE.CylinderGeometry(0.014, 0.06, height * 0.52, 4, 1);
      const branch = new THREE.Mesh(branchGeo, material);
      const spin = angle + b * 1.7 + i * 0.6;
      branch.position.set(
        x + Math.cos(spin) * height * 0.15,
        terrainHeight(x, z) + branchHeight,
        z + Math.sin(spin) * height * 0.15
      );
      branch.rotation.z = Math.cos(spin) * 1.05;
      branch.rotation.x = Math.sin(spin) * 1.05;
      group.add(branch);
    }
  }
  return group;
}

function buildSky() {
  const geometry = new THREE.SphereGeometry(70, 32, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x000205) },
      uBottom: { value: new THREE.Color(0x061a13) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      varying vec3 vPosition;
      void main() {
        float h = clamp(vPosition.y / 70.0 * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(uBottom, uTop, pow(h, 0.75));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geometry, material);
}

function buildGroundFog() {
  const geometry = new THREE.PlaneGeometry(70, 70, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCorrupt: { value: 0.2 },
      uColor: { value: new THREE.Color(0x07231a) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vPlane;
      void main() {
        vPlane = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uCorrupt;
      uniform vec3 uColor;
      varying vec2 vPlane;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
          value += amplitude * noise(p);
          p *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 p = vPlane * 0.16;
        float drift = uTime * 0.035;
        float fog = fbm(p + vec2(drift, -drift * 0.7)) * fbm(p * 1.7 - vec2(drift * 0.6, drift));
        float radius = length(vPlane) / 35.0;
        float fade = 1.0 - smoothstep(0.3, 1.0, radius);
        float alpha = smoothstep(0.14, 0.78, fog) * fade * (0.52 + uCorrupt * 0.34);
        gl_FragColor = vec4(uColor * (0.7 + fog * 0.9), alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.32;
  return mesh;
}

function createMeadow({ shardPosition }) {
  const group = new THREE.Group();
  const ground = buildGround();
  const grass = buildGrass(shardPosition);
  const sky = buildSky();
  const trees = buildDeadTrees();
  const swarm = buildSwarmVines();
  const motes = buildMotes(shardPosition);
  const groundFog = buildGroundFog();

  group.add(sky, ground, grass, trees, swarm.group, groundFog, motes);

  const glowTexture = makeGlowTexture(128);
  const horizonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x2effa2,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  horizonGlow.scale.set(34, 14, 1);
  horizonGlow.position.set(0, 1.4, -18);
  group.add(horizonGlow);

  // a dead cold moon, fogged out of reach, that everything silhouettes against
  const moonDisc = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x9fb6c4,
      transparent: true,
      opacity: 0.12,
      fog: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  moonDisc.scale.set(15, 15, 1);
  moonDisc.position.set(-6, 15, -34);
  group.add(moonDisc);

  function update(time, corrupt) {
    grass.material.uniforms.uTime.value = time;
    grass.material.uniforms.uCorrupt.value = corrupt;
    motes.material.uniforms.uTime.value = time;
    motes.material.uniforms.uCorrupt.value = corrupt;
    groundFog.material.uniforms.uTime.value = time;
    groundFog.material.uniforms.uCorrupt.value = corrupt;
    swarm.material.emissiveIntensity = 0.34 + Math.sin(time * 1.9) * 0.14 + corrupt * 0.6;

    for (const vine of swarm.vines) {
      const cyclePosition = ((time + vine.offset) % vine.cycle) / vine.cycle;
      let growth;
      if (cyclePosition < 0.36) growth = cyclePosition / 0.36;
      else if (cyclePosition < 0.82) growth = 1;
      else growth = Math.max(0, 1 - (cyclePosition - 0.82) / 0.18);

      const amount = Math.min(1, growth * (0.45 + corrupt * 0.9) * vine.seed + 0.06);
      const count = Math.floor((vine.indexCount * amount) / 3) * 3;
      vine.mesh.geometry.setDrawRange(0, count);
    }
  }

  return { group, update };
}

// --- the Hearth Warden -----------------------------------------------------
const HEART_LOCAL = new THREE.Vector3(0, 1.95, 0.95);
const UP = new THREE.Vector3(0, 1, 0);
const TENDRIL_SEGMENTS = 26;
const TENDRIL_RING = 8;

function heartbeat(time) {
  const p = (time * 1.15) % 1;
  return Math.exp(-p * 9) + Math.exp(-Math.max(0, p - 0.26) * 12) * 0.6;
}

// a smooth, tapered limb tube whose vertices are rewritten every frame
function createTendrilGeometry() {
  const vertexCount = (TENDRIL_SEGMENTS + 1) * (TENDRIL_RING + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = [];
  for (let i = 0; i < TENDRIL_SEGMENTS; i++) {
    for (let j = 0; j < TENDRIL_RING; j++) {
      const a = i * (TENDRIL_RING + 1) + j;
      const b = a + TENDRIL_RING + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

const tendrilSample = new THREE.Vector3();
const tendrilSampleNext = new THREE.Vector3();
const tendrilTangent = new THREE.Vector3();
const tendrilSide = new THREE.Vector3();
const tendrilUpBasis = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function updateTendrilGeometry(geometry, curve, thickness) {
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;

  for (let i = 0; i <= TENDRIL_SEGMENTS; i++) {
    const f = i / TENDRIL_SEGMENTS;
    curve.getPoint(f, tendrilSample);
    curve.getPoint(Math.min(1, f + 0.012), tendrilSampleNext);
    tendrilTangent.subVectors(tendrilSampleNext, tendrilSample);
    if (tendrilTangent.lengthSq() < 1e-8) tendrilTangent.set(0, 1, 0);
    else tendrilTangent.normalize();

    tendrilSide.crossVectors(tendrilTangent, WORLD_UP);
    if (tendrilSide.lengthSq() < 1e-6) tendrilSide.set(1, 0, 0);
    else tendrilSide.normalize();
    tendrilUpBasis.crossVectors(tendrilSide, tendrilTangent).normalize();

    const radius = (0.13 * Math.pow(1 - f, 0.85) + 0.014) * thickness;

    for (let j = 0; j <= TENDRIL_RING; j++) {
      const angle = (j / TENDRIL_RING) * Math.PI * 2;
      const cs = Math.cos(angle);
      const sn = Math.sin(angle);
      const nx = tendrilSide.x * cs + tendrilUpBasis.x * sn;
      const ny = tendrilSide.y * cs + tendrilUpBasis.y * sn;
      const nz = tendrilSide.z * cs + tendrilUpBasis.z * sn;

      const index = (i * (TENDRIL_RING + 1) + j) * 3;
      positions[index] = tendrilSample.x + nx * radius;
      positions[index + 1] = tendrilSample.y + ny * radius;
      positions[index + 2] = tendrilSample.z + nz * radius;
      normals[index] = nx;
      normals[index + 1] = ny;
      normals[index + 2] = nz;
    }
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
}

function createWarden() {
  const group = new THREE.Group();
  group.position.set(0, 0.1, -2.45);
  group.visible = false;

  const timeUniform = { value: 0 };
  const revealUniform = { value: 0 };
  const agitateUniform = { value: 0 };
  const glowTexture = makeGlowTexture();

  const boneMaterial = makeBoneMaterial({ time: timeUniform, agitate: agitateUniform });
  const socketMaterial = new THREE.MeshStandardMaterial({
    color: 0x030604,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // --- hunched, folded hide ---------------------------------------------
  const profile = [
    [0.02, 0.0],
    [0.96, 0.02],
    [1.07, 0.6],
    [1.0, 1.35],
    [0.86, 2.1],
    [0.71, 2.62],
    [0.68, 3.1],
    [0.6, 3.5],
    [0.5, 3.9],
    [0.37, 4.25],
    [0.18, 4.55],
    [0.02, 4.68],
  ];
  const bodyGeometry = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    64
  );

  // wrench the hide out of round: crooked shoulders, twisted spine, leaning belly
  {
    const pos = bodyGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const radius = Math.hypot(x, z);
      const angle = Math.atan2(x, z);
      const lump =
        Math.sin(angle * 3.0 + y * 1.4) * 0.5 +
        Math.sin(angle * 5.0 - y * 2.2) * 0.3 +
        Math.sin(angle * 8.0 + y * 0.6) * 0.2;
      const crownFade = 1.0 - THREE.MathUtils.smoothstep(y, 2.9, 4.0);
      const bulge = 1 + lump * 0.17 * crownFade;
      const twist = y * 0.1;
      const lean = Math.sin((y / 4.7) * Math.PI) * 0.27;
      pos.setXYZ(
        i,
        Math.sin(angle + twist) * radius * bulge + lean,
        y + Math.sin(angle * 2.0 + y) * 0.07 * crownFade,
        Math.cos(angle + twist) * radius * bulge
      );
    }
    pos.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
  }
  const hideMaterial = makeHideMaterial({
    time: timeUniform,
    reveal: revealUniform,
    agitate: agitateUniform,
    folds: 1,
  });
  const body = new THREE.Mesh(bodyGeometry, hideMaterial);
  body.rotation.x = 0.05;
  group.add(body);

  const tatterMaterial = hideMaterial;
  const tatters = [];
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const geometry = new THREE.ConeGeometry(0.1 + (i % 3) * 0.035, 1.0 + (i % 5) * 0.36, 4, 1, true);
    const mesh = new THREE.Mesh(geometry, tatterMaterial);
    mesh.position.set(Math.cos(angle) * 0.88, 0.1, Math.sin(angle) * 0.88);
    mesh.rotation.x = Math.PI;
    mesh.userData = { angle, phase: i * 0.8 };
    tatters.push(mesh);
    group.add(mesh);
  }

  // --- branching antlers -------------------------------------------------
  const antlerSegment = new THREE.ConeGeometry(1, 1, 5);

  function buildAntler(dir) {
    const antler = new THREE.Group();
    const nodes = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const f = i / (count - 1);
      nodes.push(
        new THREE.Vector3(
          dir * (0.15 + Math.pow(f, 1.15) * 0.6),
          3.72 + f * 1.72 - f * f * 0.22,
          -0.16 - f * 0.48 + Math.sin(f * 3.1) * 0.1
        )
      );
    }
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const vector = new THREE.Vector3().subVectors(b, a);
      const len = vector.length();
      vector.normalize();
      const radius = 0.082 * (1 - i / nodes.length) + 0.012;
      const mesh = new THREE.Mesh(antlerSegment, boneMaterial);
      mesh.position.copy(a).addScaledVector(vector, len * 0.5);
      mesh.quaternion.setFromUnitVectors(UP, vector);
      mesh.scale.set(radius, len, radius);
      antler.add(mesh);
    }
    for (const t of [0.42, 0.66, 0.86]) {
      const base = nodes[Math.round(t * (count - 1))];
      const vector = new THREE.Vector3(dir * 0.55, 0.5, -0.62).normalize();
      const len = 0.62 - t * 0.28;
      const mesh = new THREE.Mesh(antlerSegment, boneMaterial);
      mesh.position.copy(base).addScaledVector(vector, len * 0.5);
      mesh.quaternion.setFromUnitVectors(UP, vector);
      mesh.scale.set(0.036, len, 0.036);
      antler.add(mesh);
    }
    return antler;
  }
  group.add(buildAntler(-1), buildAntler(1));

  // --- the face ----------------------------------------------------------
  // pushed clear of the cowl so it is never swallowed by the robe
  const head = new THREE.Group();
  head.position.set(0, 3.34, 0.66);
  head.rotation.x = 0.1;
  group.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), boneMaterial);
  skull.scale.set(0.94, 1.16, 0.96);
  head.add(skull);

  for (const dir of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.2), boneMaterial);
    brow.position.set(dir * 0.15, 0.19, 0.26);
    brow.rotation.z = dir * 0.32;
    brow.rotation.y = dir * -0.34;
    head.add(brow);
  }

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9ffab });
  const eyes = [];
  const socketTunnel = new THREE.CylinderGeometry(0.158, 0.026, 0.34, 20, 1, true);
  const orbitRim = new THREE.TorusGeometry(0.18, 0.052, 12, 24);
  const socketVoid = new THREE.SphereGeometry(0.11, 16, 12);

  for (const dir of [-1, 1]) {
    // a cone bored into the skull: wide at the bone, bottomless black behind
    const socket = new THREE.Mesh(socketTunnel, socketMaterial);
    socket.position.set(dir * 0.16, 0.02, 0.21);
    socket.rotation.x = Math.PI / 2;
    head.add(socket);

    const hollow = new THREE.Mesh(socketVoid, socketMaterial);
    hollow.position.set(dir * 0.16, 0.02, 0.1);
    head.add(hollow);

    const rim = new THREE.Mesh(orbitRim, boneMaterial);
    rim.position.set(dir * 0.16, 0.03, 0.375);
    rim.scale.set(1, 0.92, 1);
    rim.rotation.z = dir * 0.06;
    head.add(rim);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), eyeMaterial);
    eye.position.set(dir * 0.16, 0.02, 0.185);
    head.add(eye);

    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xc8ff9a,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    flare.position.copy(eye.position);
    flare.scale.setScalar(0.1);
    head.add(flare);
    eyes.push({ flare });

    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), boneMaterial);
    cheek.position.set(dir * 0.245, -0.14, 0.2);
    cheek.scale.set(1, 0.78, 0.7);
    head.add(cheek);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.18, 4), boneMaterial);
  nose.position.set(0, -0.08, 0.35);
  nose.rotation.x = 0.22;
  head.add(nose);

  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.2, 0.06);
  head.add(jawPivot);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.28), boneMaterial);
  jaw.position.set(0, -0.1, 0.12);
  jawPivot.add(jaw);

  const chin = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.17, 4), boneMaterial);
  chin.position.set(0, -0.18, 0.21);
  chin.rotation.x = Math.PI;
  jawPivot.add(chin);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.15), socketMaterial);
  mouth.position.set(0, -0.02, 0.2);
  jawPivot.add(mouth);

  const teethMaterial = new THREE.MeshBasicMaterial({ color: 0xcfe0cf, transparent: true, opacity: 0 });
  for (let i = 0; i < 9; i++) {
    const f = i / 8;
    const x = -0.125 + f * 0.25;
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.11 + (i % 2) * 0.05, 4), teethMaterial);
    tooth.position.set(x, 0.01, 0.26 - Math.abs(x) * 0.28);
    tooth.rotation.x = Math.PI;
    jawPivot.add(tooth);
  }

  const faceLight = new THREE.PointLight(0xc2d8ff, 0, 16, 2);
  faceLight.position.set(0.55, 3.95, 2.85);
  group.add(faceLight);

  // --- long tapered tendrils with bone claws -----------------------------
  const fleshMaterial = makeFleshMaterial({ time: timeUniform, agitate: agitateUniform });
  const clawGeometry = new THREE.ConeGeometry(0.075, 0.44, 5);
  const limbs = [];
  for (let i = 0; i < 7; i++) {
    const count = 20;
    const points = [];
    for (let j = 0; j < count; j++) points.push(new THREE.Vector3());

    const geometry = createTendrilGeometry();
    const mesh = new THREE.Mesh(geometry, fleshMaterial);
    mesh.frustumCulled = false;
    group.add(mesh);

    const claw = new THREE.Mesh(clawGeometry, boneMaterial);
    group.add(claw);

    limbs.push({
      mesh,
      curve: new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5),
      points,
      claw,
      angle: (i / 7) * Math.PI * 2 + 0.42,
      phase: i * 1.37,
      reach: 1.45 + (i % 4) * 0.45,
      speed: 0.42 + (i % 3) * 0.24,
      height: 2.4 + (i % 5) * 0.34,
    });
  }

  // --- caged heart -------------------------------------------------------
  const heartGroup = new THREE.Group();
  heartGroup.position.copy(HEART_LOCAL);
  group.add(heartGroup);

  const heartMaterial = makeHeartMaterial();
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.33, 44, 30), heartMaterial);
  heart.scale.setScalar(0.001);
  heartGroup.add(heart);

  const heartGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0x7dffc0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  heartGlow.scale.setScalar(1.6);
  heartGroup.add(heartGlow);

  const heartLight = new THREE.PointLight(0x5affaa, 0, 14, 2);
  heartGroup.add(heartLight);

  const ribMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d3a26,
    emissive: 0x39ff9d,
    emissiveIntensity: 1.1,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0,
  });
  const ribs = [];
  for (let i = 0; i < 7; i++) {
    const startAngle = (i / 7) * Math.PI * 2;
    const curvePoints = [];
    for (let s = 0; s <= 9; s++) {
      const f = s / 9;
      const angle = startAngle + f * 1.6;
      const radius = 0.44 + Math.sin(f * Math.PI) * 0.14;
      curvePoints.push(
        new THREE.Vector3(Math.cos(angle) * radius, -0.42 + f * 0.84, Math.sin(angle) * radius)
      );
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePoints), 26, 0.021, 5, false);
    const mesh = new THREE.Mesh(geometry, ribMaterial);
    ribs.push(mesh);
    heartGroup.add(mesh);
  }

  const worldPosition = new THREE.Vector3();
  const heartWorld = new THREE.Vector3();
  const tipDirection = new THREE.Vector3();

  function update(time, { appear, drain, absorb, morph, lunge }) {
    group.visible = appear > 0.001;
    if (!group.visible) return;

    timeUniform.value = time;
    revealUniform.value = appear * 4.9;
    agitateUniform.value = appear * 0.1 + drain * 0.5 + absorb * 0.8 + lunge * 0.5;
    fleshMaterial.uniforms.uFade.value = clamp01((appear - 0.3) / 0.5);

    const growth = 0.8 + appear * 0.2 + drain * 0.06 + absorb * 0.16 + lunge * 0.12;
    const breath = Math.sin(time * 0.9) * 0.01;
    group.scale.set(growth + breath, growth - breath * 1.4, growth + breath);
    group.position.y = 0.1 + Math.sin(time * 0.62) * 0.05;
    // it throws itself at the viewer
    group.position.z = -2.45 + lunge * 3.15;
    group.rotation.y = Math.sin(time * 0.24) * 0.05 + drain * 0.12;
    group.rotation.z = Math.sin(time * 0.5) * 0.012 + absorb * Math.sin(time * 3.4) * 0.025;
    group.rotation.x = 0.08 + drain * 0.06 + lunge * 0.16;

    const headIn = clamp01((appear - 0.5) / 0.5);
    head.visible = headIn > 0.01;
    head.scale.setScalar((0.35 + headIn * 0.65) * (1 + Math.sin(time * 1.35) * 0.013));
    head.position.z = 0.66 + lunge * 0.55;
    head.position.y = 3.34 + lunge * 0.18;
    head.rotation.x = 0.1 + lunge * 0.22;
    faceLight.intensity = headIn * (20 + drain * 8 + lunge * 12);
    faceLight.position.z = 2.85 + lunge * 0.6;

    for (const tatter of tatters) {
      const { angle, phase } = tatter.userData;
      tatter.position.x = Math.cos(angle + time * 0.2) * 0.88;
      tatter.position.z = Math.sin(angle + time * 0.2) * 0.88 + lunge * 0.5;
      tatter.position.y = 0.1 + Math.sin(time * 1.4 + phase) * 0.14;
      tatter.rotation.z = Math.sin(time * 1.1 + phase) * 0.3;
    }

    const burn = 0.6 + drain * 1.0 + absorb * 0.8 + lunge * 0.6 + Math.sin(time * 2.3) * 0.08;
    eyeMaterial.color.setRGB(0.85 * burn, 1.0 * burn, 0.62 * burn);
    for (const { flare } of eyes) {
      flare.material.opacity = clamp01(0.3 + burn * 0.34);
      flare.scale.setScalar(0.11 + burn * 0.07);
    }

    jawPivot.rotation.x =
      0.06 + drain * 0.5 + lunge * 0.5 + Math.sin(time * 7.3) * 0.03 * Math.max(drain, lunge);
    teethMaterial.opacity = clamp01((drain - 0.05) * 1.8 + absorb * 0.6 + lunge * 0.9);

    const reachBoost = drain * 0.8 + absorb * 0.55 + lunge * 0.5;
    for (const limb of limbs) {
      const count = limb.points.length;
      for (let j = 0; j < count; j++) {
        const f = j / (count - 1);
        const angle =
          limb.angle +
          Math.sin(time * limb.speed + limb.phase + f * 2.6) * 0.5 * f +
          f * (0.95 + reachBoost * 0.45);
        const radius = 0.55 + f * limb.reach * (1 + reachBoost * 0.55);
        const y =
          limb.height -
          f * f * (1.35 + reachBoost * 1.9) +
          Math.sin(time * 1.25 + limb.phase + f * 5.0) * 0.16;

        const point = limb.points[j];
        point.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);

        // tips sweep forward, straight at the camera
        if (lunge > 0.001) {
          const w = f * f * lunge * 0.95;
          point.x += -point.x * w * 0.92;
          point.y += (3.1 - point.y) * w * 0.88;
          point.z += (3.6 - point.z) * w;
        }
      }

      limb.curve.points = limb.points;
      updateTendrilGeometry(limb.mesh.geometry, limb.curve, 1 + reachBoost * 0.2);

      const tip = limb.points[count - 1];
      const before = limb.points[count - 2];
      tipDirection.subVectors(tip, before);
      if (tipDirection.lengthSq() < 1e-8) tipDirection.set(0, -1, 0);
      tipDirection.normalize();
      limb.claw.position.copy(tip).addScaledVector(tipDirection, 0.18);
      limb.claw.quaternion.setFromUnitVectors(UP, tipDirection);
      limb.claw.scale.setScalar(0.85 + reachBoost * 0.45);
    }

    const beat = morph > 0 ? heartbeat(time) * (0.35 + morph * 0.9) : 0;
    heartMaterial.uniforms.uTime.value = time;
    heartMaterial.uniforms.uPulse.value = beat;
    heartMaterial.uniforms.uCorrupt.value = morph;

    const heartScale = morph > 0.001 ? 0.62 + morph * 0.78 + beat * 0.16 : 0.001;
    heart.scale.setScalar(heartScale);
    heart.rotation.y = time * 0.8;
    heart.rotation.z = Math.sin(time * 0.7) * 0.45 * morph;
    heart.rotation.x = Math.cos(time * 0.5) * 0.3 * morph;

    heartGlow.material.opacity = morph * (0.2 + beat * 0.26);
    heartGlow.scale.setScalar(1.3 + morph * 1.1 + beat * 0.4);
    heartLight.intensity = morph * (12 + beat * 20);

    ribMaterial.opacity = clamp01(absorb * 1.4);
    const openAmount = easeInOut(clamp01(morph));
    for (let i = 0; i < ribs.length; i++) {
      const rib = ribs[i];
      const spin = i * 0.4 + time * 0.35;
      rib.rotation.z = Math.sin(spin) * 0.1 * openAmount;
      rib.rotation.x = Math.cos(spin) * 0.1 * openAmount;
      rib.scale.setScalar(1 + openAmount * 0.18);
    }
  }

  function getHeartWorldPosition(target) {
    group.updateMatrixWorld(true);
    heartGroup.getWorldPosition(worldPosition);
    heartWorld.copy(worldPosition);
    return target ? target.copy(heartWorld) : heartWorld;
  }

  return { group, update, getHeartWorldPosition };
}

// --- cinematic finishing pass ---------------------------------------------
// Full-screen pass: cold grade, heavy vignette, film grain and edge chromatic
// aberration so the cutscene reads like found footage.
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.028 },
    uAberration: { value: 0.0014 },
    uTint: { value: new THREE.Color(0x63ffb0) },
    uFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uFlash;
    uniform vec3 uTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 centre = vUv - 0.5;
      float radius = length(centre);

      vec2 shift = centre * uAberration * (0.7 + radius * 2.6);
      vec3 color;
      color.r = texture2D(tDiffuse, vUv + shift).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv - shift).b;

      // drained, sickly grade: desaturate, then lift the shadows toward emerald
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(color, vec3(luma), 0.24);
      color += uTint * 0.035 * (1.0 - smoothstep(0.0, 0.5, luma));

      float vig = 1.0 - smoothstep(0.24, 0.92, radius * uVignette);
      color *= mix(0.14, 1.0, vig);

      float grain = hash(vUv * vec2(1024.0, 1024.0) + fract(uTime) * 97.3) - 0.5;
      color += grain * uGrain;

      color *= 1.0 + uFlash * 0.4;

      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

// --- the cutscene ----------------------------------------------------------
const CAMERA_KEYS = {
  a: { position: new THREE.Vector3(0, 2.42, 9.9), look: new THREE.Vector3(0, 1.5, 0) },
  b: { position: new THREE.Vector3(0.8, 2.38, 8.4), look: new THREE.Vector3(0, 2.75, -1.05) },
  c: { position: new THREE.Vector3(0.32, 2.9, 6.95), look: new THREE.Vector3(0, 3.0, -1.7) },
};

function disposeScene(scene) {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
      ? [object.material]
      : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function createCutscene({ canvas, container }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x010308, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02060a, 0.068);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 220);
  camera.position.copy(CAMERA_KEYS.a.position);

  const hemisphere = new THREE.HemisphereLight(0x0e2c22, 0x000000, 0.34);
  scene.add(hemisphere);

  const moon = new THREE.DirectionalLight(0x9cb8ff, 0.26);
  moon.position.set(-7, 10, -9);
  scene.add(moon);

  // distant storm flashes that briefly carve the dead trees out of the dark
  const storm = new THREE.DirectionalLight(0xc3d8ff, 0);
  storm.position.set(-9, 14, -12);
  scene.add(storm);

  const wardenRim = new THREE.PointLight(0x2bff95, 38, 26, 2);
  wardenRim.position.set(0, 4.6, -7.5);
  scene.add(wardenRim);

  const shardPosition = new THREE.Vector3(0, 1.45, 0);
  const meadow = createMeadow({ shardPosition });
  const shard = createSoulShard({ position: shardPosition });
  const warden = createWarden();
  scene.add(meadow.group, shard.group, warden.group);

  // const composer = new EffectComposer(renderer);
  // composer.addPass(new RenderPass(scene, camera));
  // const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.62, 0.72);
  // composer.addPass(bloom);
  // const cinematic = new ShaderPass(CinematicShader);
  // composer.addPass(cinematic);

  const state = { stage: 0, time: 0, stageTime: 0, flash: 0 };
  const clock = new THREE.Clock();
  const heartWorld = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraLook = new THREE.Vector3();

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    if (width === 0 || height === 0) return;
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = aspect < 1.15 ? Math.min(76, 46 / Math.max(aspect, 0.6)) : 46;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    // composer.setSize(width, height);
    // bloom.setSize(width, height);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function updateCamera(time, p1, p2) {
    const e1 = easeInOut(clamp01(p1));
    const e2 = easeInOut(clamp01(p2));

    cameraPosition.copy(CAMERA_KEYS.a.position).lerp(CAMERA_KEYS.b.position, e1).lerp(CAMERA_KEYS.c.position, e2);
    cameraLook.copy(CAMERA_KEYS.a.look).lerp(CAMERA_KEYS.b.look, e1).lerp(CAMERA_KEYS.c.look, e2);

    // slow drift plus a permanent handheld tremble so nothing ever sits still
    const tremble = 0.013 + state.flash * 0.05;
    cameraPosition.x += Math.sin(time * 0.21) * 0.14 * (1 - e2) + Math.sin(time * 2.1) * 0.03;
    cameraPosition.y += Math.sin(time * 0.34) * 0.07 + Math.cos(time * 5.7) * tremble;
    cameraPosition.x += Math.sin(time * 7.3) * tremble;
    cameraLook.x += Math.sin(time * 3.9) * tremble * 0.8;

    const shake = state.flash * 1.6;
    if (shake > 0.001) {
      cameraPosition.x += (Math.random() - 0.5) * shake * 0.42;
      cameraPosition.y += (Math.random() - 0.5) * shake * 0.34;
      cameraLook.x += (Math.random() - 0.5) * shake * 0.28;
    }

    camera.position.copy(cameraPosition);
    camera.lookAt(cameraLook);
  }

  function frame() {
    const delta = Math.min(clock.getDelta(), 0.05);
    state.time += delta;
    state.stageTime += delta;

    const time = state.time;
    const stage = state.stage;
    const stageTime = state.stageTime;

    const p1 = stage >= 1 ? (stage === 1 ? clamp01(stageTime / 9) : 1) : 0;
    const p2 = stage >= 2 ? clamp01(stageTime / 8) : 0;
    const appear = stage >= 1 ? easeOut(clamp01(stageTime / 3.2)) : 0;
    const drain = stage >= 1 ? clamp01((stageTime - 2.2) / 6) : 0;
    const absorb = stage >= 2 ? easeInOut(clamp01(stageTime / 2)) : 0;
    const morph = stage >= 2 ? clamp01((stageTime - 1.2) / 6.5) : 0;
    const lunge = stage >= 2 ? easeOut(clamp01(stageTime / 1.5)) : 0;

    if (state.flash > 0) state.flash = Math.max(0, state.flash - delta * 0.7);

    // spiked, irregular stormlight
    const lightning = Math.pow(
      Math.max(0, Math.sin(time * 0.37) * Math.sin(time * 1.13) * Math.sin(time * 0.61)),
      14
    );
    storm.intensity = lightning * 3.4;
    hemisphere.intensity = 0.3 + lightning * 0.45 + drain * 0.04;

    warden.update(time, { appear, drain, absorb, morph, lunge });
    if (appear > 0) warden.getHeartWorldPosition(heartWorld);

    shard.update({ time, delta, drain, absorb, heartWorld });
    meadow.update(time, 0.18 + drain * 0.82);

    updateCamera(time, p1, p2);

    bloom.strength = 0.6 + state.flash * 1.3 + morph * 0.18;
    renderer.toneMappingExposure = 1.06 + state.flash * 0.4;

    cinematic.uniforms.uTime.value = time;
    cinematic.uniforms.uFlash.value = state.flash * 0.6;
    cinematic.uniforms.uVignette.value = 0.9 + morph * 0.12;
    cinematic.uniforms.uAberration.value = 0.0013 + state.flash * 0.006 + morph * 0.0012;
    cinematic.uniforms.uGrain.value = 0.028 + state.flash * 0.04;

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(frame);

  function setStage(nextStage) {
    state.stage = nextStage;
    state.stageTime = 0;
    if (nextStage === 0) state.flash = 0;
    if (nextStage === 1) state.flash = 0.5;
    if (nextStage === 2) state.flash = 1;
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    disposeScene(scene);
    bloom.dispose();
    cinematic.dispose();
    composer.dispose();
    renderer.dispose();
  }

  return { setStage, dispose };
}

// --- the canvas stage ------------------------------------------------------
function CutsceneCanvas({ stage, onAdvance }) {
  const containerRef = useRef(null);
  const cutsceneRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // each scene gets its own canvas so a remount never reuses a disposed context
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full';
    container.appendChild(canvas);

    const cutscene = createCutscene({ canvas, container });
    cutsceneRef.current = cutscene;

    return () => {
      cutscene.dispose();
      cutsceneRef.current = null;
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    cutsceneRef.current?.setStage(stage);
  }, [stage]);

  return (
    <div
      ref={containerRef}
      onClick={onAdvance}
      className="absolute inset-0 cursor-pointer select-none"
      role="presentation"
    />
  );
}

// --- narrative overlay -----------------------------------------------------
const HINTS = {
  0: 'Click to begin',
  1: 'Click to continue',
  2: 'Click to witness it again',
};

function NarrativeOverlay({ stage, ready }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end px-6 pb-6 sm:px-12 sm:pb-8">
      <div className="relative mx-auto min-h-[8.5rem] w-full max-w-3xl text-center sm:min-h-[10rem]">
        <AnimatePresence mode="wait">
          {stage === 0 && (
            <motion.div
              key="lore"
              className="absolute inset-x-0 bottom-0"
              initial={{ opacity: 0, y: 16, filter: 'blur(12px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{
                opacity: 0,
                y: 8,
                filter: 'blur(16px)',
                transition: { duration: 1.3, ease: 'easeIn' },
              }}
              transition={{ duration: 2.6, delay: 0.5, ease: 'easeOut' }}
            >
              <p className="font-rune text-[9px] uppercase tracking-[0.62em] text-emerald-200/40 sm:text-[10px]">
                The Meadow of First Light
              </p>
              <p
                className="mt-3 font-tale text-base leading-relaxed text-[#d7f0e4] sm:text-2xl"
                style={{ textShadow: '0 0 30px rgba(46,255,160,0.32), 0 2px 16px rgba(0,0,0,0.95)' }}
              >
                The Hollow shattered my soul into five.
              </p>
              <p
                className="mt-2 font-tale text-sm leading-relaxed text-[#a4c4b6] sm:text-lg"
                style={{ textShadow: '0 0 24px rgba(46,255,160,0.22), 0 2px 14px rgba(0,0,0,0.95)' }}
              >
                The first shard was given to the Hearth Warden, here in the Meadow of First Light.
              </p>
            </motion.div>
          )}

          {stage === 1 && (
            <motion.div
              key="warden-lore"
              className="absolute inset-x-0 bottom-0"
              initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{
                opacity: 0,
                y: 8,
                filter: 'blur(16px)',
                transition: { duration: 1.2, ease: 'easeIn' },
              }}
              transition={{ duration: 2.2, delay: 1.6, ease: 'easeOut' }}
            >
              <p className="font-rune text-[9px] uppercase tracking-[0.62em] text-emerald-200/40 sm:text-[10px]">
                The Second Truth
              </p>
              <p
                className="mt-3 font-tale text-base leading-relaxed text-[#d7f0e4] sm:text-2xl"
                style={{ textShadow: '0 0 30px rgba(46,255,160,0.32), 0 2px 16px rgba(0,0,0,0.95)' }}
              >
                The Warden was born from my courage.
              </p>
              <p
                className="mt-2 font-tale text-sm leading-relaxed text-[#a4c4b6] sm:text-lg"
                style={{ textShadow: '0 0 24px rgba(46,255,160,0.22), 0 2px 14px rgba(0,0,0,0.95)' }}
              >
                To defeat it is to take that courage back — and learn what lies buried beneath.
              </p>
            </motion.div>
          )}

          {stage === 2 && (
            <motion.div
              key="first-shard"
              className="absolute inset-x-0 bottom-0"
              initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{
                opacity: 0,
                y: 8,
                filter: 'blur(16px)',
                transition: { duration: 1.2, ease: 'easeIn' },
              }}
              transition={{ duration: 2.2, delay: 0.7, ease: 'easeOut' }}
            >
              <p className="font-rune text-[9px] uppercase tracking-[0.62em] text-emerald-200/40 sm:text-[10px]">
                The First Shard
              </p>
              <p
                className="mt-3 font-tale text-base leading-relaxed text-[#d7f0e4] sm:text-2xl"
                style={{ textShadow: '0 0 30px rgba(46,255,160,0.32), 0 2px 16px rgba(0,0,0,0.95)' }}
              >
                Break the Warden.
              </p>
              <p
                className="mt-2 font-tale text-sm leading-relaxed text-[#a4c4b6] sm:text-lg"
                style={{ textShadow: '0 0 24px rgba(46,255,160,0.22), 0 2px 14px rgba(0,0,0,0.95)' }}
              >
                Recover the first shard of my soul.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative mt-6 flex h-6 items-end justify-center">
        <AnimatePresence mode="wait">
          {ready && HINTS[stage] && (
            <motion.span
              key={`hint-${stage}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.2, 0.62, 0.2] }}
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              className="font-rune text-[9px] uppercase tracking-[0.5em] text-emerald-100/55 sm:text-[10px]"
            >
              {HINTS[stage]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- the page --------------------------------------------------------------
export default function Home() {
  const [stage, setStage] = useState(0);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    if (stage === 0) {
      setReady(true);
      return undefined;
    }
    setReady(false);
    const delay = stage === 1 ? 6400 : 9200;
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const advance = useCallback(() => {
    if (!ready) return;
    setStage((current) => (current === 0 ? 1 : current === 1 ? 2 : 2));
  }, [ready]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black">
      <CutsceneCanvas stage={stage} onAdvance={advance} />
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(0,0,0,0) 26%, rgba(0,0,0,0.5) 70%, rgba(0,0,0,0.94) 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-black/85 to-transparent" />
      <NarrativeOverlay stage={stage} ready={ready} />
    </div>
  );
}