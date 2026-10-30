import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import {
  CinematicShader,
  clamp01,
  createCracks,
  createEnvMap,
  createGroundFog,
  createHoodedFigure,
  createIceSpike,
  createIcicleCluster,
  createMaterialLibrary,
  createOracleScene,
  createRuneCircle,
  createSnow,
  createWinterScene,
  glowTexture,
  rand,
  runeTexture,
  TAU,
} from "./Cutscene";

/* ═════════════════════════════════════════════════════════════════
   THE VAULT — scene three, the engine that plays all three scenes,
   and the cutscene player itself.
   ═════════════════════════════════════════════════════════════════ */

function createVault(radius, length, radial = 44, steps = 26) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let s = 0; s <= steps; s++) {
    const z = -length / 2 + (s / steps) * length;
    for (let r = 0; r <= radial; r++) {
      const angle = (r / radial) * Math.PI;
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
      uvs.push(r / radial, s / steps);
    }
  }
  for (let s = 0; s < steps; s++) {
    for (let r = 0; r < radial; r++) {
      const a = s * (radial + 1) + r;
      const b = a + radial + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildBrazier(lib) {
  const group = new THREE.Group();

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.62, 2.6, 10),
    lib.stone({ color: 0x2c3f50, roughness: 0.9 }),
  );
  pedestal.position.y = 1.3;
  group.add(pedestal);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.5, 0.5, 12, 1, true),
    lib.stone({ color: 0x3a4f61, side: THREE.DoubleSide }),
  );
  bowl.position.y = 2.6;
  group.add(bowl);

  const coals = new THREE.Mesh(new THREE.SphereGeometry(0.64, 14, 10), lib.emissive(0x8ce6ff, 2.4));
  coals.position.y = 2.62;
  coals.scale.y = 0.5;
  group.add(coals);

  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "150,235,255"),
      color: 0x8fe8ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flame.scale.set(2.6, 3.6, 1);
  flame.position.y = 3.1;
  group.add(flame);

  const light = new THREE.PointLight(0x79d8ff, 22, 34, 2);
  light.position.y = 3.1;
  group.add(light);

  return { group, flame, light, coals };
}

function createArchiveScene({ renderer }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030a11);
  scene.fog = new THREE.FogExp2(0x061019, 0.0165);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  camera.position.set(0, 6.4, 36);

  scene.environment = createEnvMap(renderer, { top: 0x0a1a26, horizon: 0x1d4358, ground: 0x04090e });
  const lib = createMaterialLibrary();

  scene.add(new THREE.HemisphereLight(0x27485e, 0x02060a, 0.5));

  const keyLight = new THREE.DirectionalLight(0x9dcbe6, 0.9);
  keyLight.position.set(-14, 30, 26);
  scene.add(keyLight);

  /* polished floor */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(38, 210),
    lib.ice({
      color: 0x0b1a25,
      roughness: 0.16,
      metalness: 0.55,
      clearcoat: 0.8,
      transparent: false,
      opacity: 1,
      envMapIntensity: 1.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -52);
  scene.add(floor);

  scene.add(createCracks({ count: 26, start: 4, radius: 40, color: 0x5fc4e8, y: 0.05 }));

  /* vaulted nave */
  const vault = new THREE.Mesh(
    createVault(16, 200),
    lib.stone({ color: 0x182936, roughness: 0.94, side: THREE.DoubleSide, envMapIntensity: 0.35 }),
  );
  vault.position.set(0, 10, -52);
  scene.add(vault);

  const ribMaterial = lib.stone({ color: 0x263a4b, roughness: 0.88 });

  for (let i = 0; i < 13; i++) {
    const z = 34 - i * 14;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(16, 0.72, 8, 48, Math.PI), ribMaterial);
    rib.position.set(0, 10, z);
    scene.add(rib);

    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.45, 10, 14, 1),
        lib.stone({ color: 0x2b3f51 }),
      );
      column.position.set(side * 16, 5, z);
      scene.add(column);

      const capital = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.7, 3.4), ribMaterial);
      capital.position.set(side * 16, 10.05, z);
      scene.add(capital);

      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.1, 0.7, 14), ribMaterial);
      base.position.set(side * 16, 0.35, z);
      scene.add(base);
    }
  }

  /* side walls closing the hall */
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 26, 210),
      lib.stone({ color: 0x142430, roughness: 0.96 }),
    );
    wall.position.set(side * 18.6, 12, -52);
    scene.add(wall);
  }

  const endWall = new THREE.Mesh(new THREE.BoxGeometry(38, 30, 1.6), lib.stone({ color: 0x12202b }));
  endWall.position.set(0, 12, -128);
  scene.add(endWall);

  /* carved panels and hooded sentinels along both aisles */
  const reliefMaterial = new THREE.MeshBasicMaterial({
    map: runeTexture(11),
    color: 0x8fe6ff,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const sentinelMaterial = lib.stone({
    color: 0x5c7f92,
    roughness: 0.88,
    emissive: 0x0a2029,
    emissiveIntensity: 0.8,
    envMapIntensity: 0.85,
  });

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9), reliefMaterial);
      panel.position.set(side * 17.85, 8.4, 20 - i * 26);
      panel.rotation.y = (side * -Math.PI) / 2;
      scene.add(panel);

      const sentinel = createHoodedFigure({
        height: rand(4.6, 6.2),
        material: sentinelMaterial,
        seed: i * 3.4 + side,
      });
      sentinel.position.set(side * 14.6, 0, 6 - i * 26);
      sentinel.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(sentinel);

      const icicles = createIcicleCluster({
        count: 6,
        spread: 0.7,
        length: 1.9,
        material: lib.ice({ color: 0xbfe7f5, emissive: 0x146079, emissiveIntensity: 0.8, opacity: 0.9 }),
        seed: i * 5.1 + side,
      });
      icicles.position.set(side * 14.6, 7.4, 6 - i * 26);
      scene.add(icicles);
    }
  }

  /* rusted chains hanging out of the dark */
  const chainMaterial = lib.stone({ color: 0x2b3d49, roughness: 0.62, metalness: 0.55 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const links = 14 + i * 4;
      const chain = new THREE.Group();
      for (let l = 0; l < links; l++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 5, 8), chainMaterial);
        link.position.y = -l * 0.44;
        link.rotation.x = l % 2 === 0 ? 0 : Math.PI / 2;
        chain.add(link);
      }
      chain.position.set(side * rand(8, 12), 25, 16 - i * 44);
      scene.add(chain);
    }
  }

  /* icicles hanging from the vault */
  for (let i = 0; i < 40; i++) {
    const angle = rand(0.15, Math.PI - 0.15);
    const z = rand(-120, 30);
    const height = rand(0.8, 3.6);
    const icicle = new THREE.Mesh(
      new THREE.ConeGeometry(rand(0.12, 0.34), height, 5),
      lib.ice({ color: 0xa8d6e8, emissive: 0x104a60, emissiveIntensity: 0.6, opacity: 0.9 }),
    );
    icicle.position.set(Math.cos(angle) * 15.6, 10 + Math.sin(angle) * 15.6 - height / 2 - 0.1, z);
    icicle.rotation.x = Math.PI;
    scene.add(icicle);
  }

  /* dais and sarcophagus */
  const daisGroup = new THREE.Group();
  daisGroup.position.set(0, 0, -58);
  scene.add(daisGroup);

  const daisMaterial = lib.stone({ color: 0x2d4152, roughness: 0.86 });
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(18 - i * 2.4, 0.9, 20 - i * 2.4), daisMaterial);
    step.position.y = 0.45 + i * 0.86;
    daisGroup.add(step);
  }

  const tomb = new THREE.Group();
  tomb.position.y = 2.68;
  daisGroup.add(tomb);

  const base = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.9, 8.6), lib.stone({ color: 0x344a5c }));
  base.position.y = 0.95;
  tomb.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.55, 9.1), lib.stone({ color: 0x3d5468 }));
  lid.position.y = 2.15;
  tomb.add(lid);

  for (const side of [-1, 1]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.32, 9.2), daisMaterial);
    trim.position.set(side * 2.5, 2.18, 0);
    tomb.add(trim);
  }

  const lidRunes = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 7.6),
    new THREE.MeshBasicMaterial({
      map: runeTexture(9),
      color: 0x8fe6ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  lidRunes.rotation.x = -Math.PI / 2;
  lidRunes.position.y = 2.44;
  tomb.add(lidRunes);

  /* ice growing over the tomb */
  for (let i = 0; i < 9; i++) {
    const spike = createIceSpike({
      height: rand(0.9, 2.6),
      radius: rand(0.16, 0.34),
      segments: 5,
      material: lib.ice({ color: 0xbfe7f5, emissive: 0x156079, emissiveIntensity: 0.9 }),
      seed: i * 2.1,
    });
    spike.position.set(rand(-2.2, 2.2), 2.4, rand(-4.2, 4.2));
    spike.rotation.z = rand(-0.2, 0.2);
    tomb.add(spike);
  }

  /* rune circle inlaid around the dais */
  const tombRing = createRuneCircle({ radius: 10.5, color: 0x9fe9ff, opacity: 0.32, y: 0.1, rings: 2, glyphs: 60 });
  tombRing.position.set(0, 0.1, -58);
  scene.add(tombRing);

  /* the buried shard and its shaft of light */
  const shardGeometry = new THREE.OctahedronGeometry(1.5, 0);
  shardGeometry.scale(1, 2.4, 1);
  const shard = new THREE.Mesh(
    shardGeometry,
    lib.ice({ color: 0xd8f5ff, emissive: 0x2ba6d4, emissiveIntensity: 3.2, opacity: 0.95 }),
  );
  shard.position.set(0, 9.6, -58);
  scene.add(shard);

  const shardCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), lib.emissive(0xe2fbff, 5));
  shardCore.scale.set(1, 2.2, 1);
  shard.add(shardCore);

  const shardHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "160,232,255"),
      color: 0x8fe8ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  shardHalo.scale.setScalar(15);
  shard.add(shardHalo);

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x63cbe8,
    transparent: true,
    opacity: 0.06,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(6.5, 17, 40, 1, true), beamMaterial);
  beam.position.set(0, 18.5, -58);
  beam.rotation.x = Math.PI;
  scene.add(beam);

  const beamCore = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 17, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xa9f2ff,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beamCore.position.set(0, 18.5, -58);
  beamCore.rotation.x = Math.PI;
  scene.add(beamCore);

  const shardLight = new THREE.PointLight(0x7fe4ff, 130, 120, 2);
  shardLight.position.set(0, 9.6, -58);
  scene.add(shardLight);

  /* cold braziers and aisle pools */
  const braziers = [];
  for (const z of [12, -20, -50]) {
    for (const side of [-1, 1]) {
      const brazier = buildBrazier(lib);
      brazier.group.position.set(side * 11, 0, z);
      scene.add(brazier.group);
      braziers.push(brazier);
    }
  }

  for (const z of [24, -6, -36, -72]) {
    const pool = new THREE.PointLight(0x63bcdc, 34, 52, 2);
    pool.position.set(0, 8, z);
    scene.add(pool);
  }

  /* atmosphere */
  const dust = createSnow({ count: 1400, area: 26, height: 22, size: 0.55, speed: 0.06, opacity: 0.5 });
  scene.add(dust.mesh);

  const fog = createGroundFog({ size: 120, color: 0x7fb6cf, density: 0.42, y: 0.5 });
  fog.mesh.position.z = -50;
  scene.add(fog.mesh);

  const update = (time, delta, pointer) => {
    dust.update(time);
    fog.update(time);

    shard.rotation.y = -time * 0.28;
    shard.position.y = 9.6 + Math.sin(time * 0.66) * 0.24;
    shardCore.rotation.y = time * 0.5;
    shardLight.intensity = 118 + Math.sin(time * 1.5) * 18;
    shardHalo.material.opacity = 0.5 + Math.sin(time * 1.1) * 0.1;
    beamMaterial.opacity = 0.052 + Math.sin(time * 0.9) * 0.014;
    beamCore.material.opacity = 0.13 + Math.sin(time * 1.3) * 0.03;
    lidRunes.material.opacity = 0.42 + Math.sin(time * 1.6) * 0.12;
    tombRing.rotation.z = time * 0.035;
    tombRing.material.opacity = 0.26 + Math.sin(time * 0.9) * 0.08;

    braziers.forEach((brazier, index) => {
      const flicker = 0.78 + Math.sin(time * 3.1 + index * 1.7) * 0.14 + Math.sin(time * 8.7 + index) * 0.06;
      brazier.light.intensity = 22 * flicker;
      brazier.flame.material.opacity = 0.55 * flicker + 0.2;
      brazier.flame.scale.set(2.4 + flicker * 0.3, 3.4 + flicker * 0.5, 1);
    });

    const intro = clamp01(time / 10);
    const eased = intro * intro * (3 - 2 * intro);
    const px = pointer?.x ?? 0;

    camera.position.set(
      px * 1.5 + Math.sin(time * 0.11) * 0.7 + Math.sin(time * 1.1) * 0.025,
      6.6 - eased * 2.0 + Math.sin(time * 0.27) * 0.12 + Math.cos(time * 4.6) * 0.014,
      36 - eased * 46,
    );
    camera.lookAt(px * 0.6, 7.4 + Math.sin(time * 0.2) * 0.16, -58);
  };

  return { scene, camera, baseFov: 38, update };
}

/* ═════════════════════════════════════════════════════════════════
   THE ENGINE — one renderer, a bloom + cinematic stack, scene swaps
   ═════════════════════════════════════════════════════════════════ */

const BUILDERS = [createWinterScene, createOracleScene, createArchiveScene];

function disposeScene(scene) {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (!object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function createCutsceneEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Multisampled HDR buffer keeps edges clean while post-processing runs.
  const bufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const renderTarget = new THREE.WebGLRenderTarget(Math.max(1, bufferSize.x), Math.max(1, bufferSize.y), {
    type: THREE.HalfFloatType,
    samples: 4,
  });

  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  let bloom = null;
  try {
    bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.8, 0.72);
  } catch (error) {
    console.warn("Bloom unavailable, rendering without it", error);
  }
  const cinematic = new ShaderPass(CinematicShader);

  composer.addPass(renderPass);
  if (bloom) composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.addPass(cinematic);

  let current = null;
  let currentIndex = -1;
  let elapsed = 0;
  let frameId = 0;
  let flash = 0;
  let pointer = { x: 0, y: 0 };
  const clock = new THREE.Clock();

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom?.setSize(width, height);
    if (current) {
      current.camera.aspect = width / height;
      current.camera.fov = width / height < 1.1 ? 58 : current.baseFov ?? 42;
      current.camera.updateProjectionMatrix();
    }
  };

  const renderFrame = () => {
    if (!current) return;
    renderPass.scene = current.scene;
    renderPass.camera = current.camera;
    composer.render();
  };

  const setScene = (index) => {
    if (index === currentIndex) return;
    if (current) {
      disposeScene(current.scene);
      current = null;
    }
    current = BUILDERS[index]({ renderer });
    currentIndex = index;
    elapsed = 0;
    flash = 1;
    clock.getDelta();
    resize();
    current.update?.(0, 0, pointer);
    renderFrame();
  };

  const frame = () => {
    frameId = requestAnimationFrame(frame);
    const delta = Math.min(clock.getDelta(), 0.05);
    elapsed += delta;
    if (!current) return;
    if (flash > 0) flash = Math.max(0, flash - delta * 1.15);
    current.update(elapsed, delta, pointer);
    cinematic.uniforms.uTime.value = elapsed;
    cinematic.uniforms.uFlash.value = flash * 0.5;
    renderer.toneMappingExposure = 1.02 + flash * 0.16;
    renderFrame();
  };

  const onPointerMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
    };
  };

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onPointerMove);
  resize();
  frameId = requestAnimationFrame(frame);

  return {
    setScene,
    resize,
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      if (current) disposeScene(current.scene);
      current = null;
      bloom?.dispose();
      cinematic.dispose();
      composer.dispose();
      renderTarget.dispose();
      renderer.dispose();
    },
  };
}

/* ── the canvas ───────────────────────────────────────────── */

function CutsceneCanvas({ sceneIndex }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    let engine;
    try {
      engine = createCutsceneEngine(canvasRef.current);
    } catch (error) {
      console.error("Cutscene renderer unavailable", error);
      setFailed(true);
      return undefined;
    }
    engineRef.current = engine;
    engine.setScene(0);
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setScene(sceneIndex);
  }, [sceneIndex]);

  if (failed) {
    return <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,#12293a,#02050a_70%)]" />;
  }

  return <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />;
}

/* ═════════════════════════════════════════════════════════════════
   THE PLAYER
   ═════════════════════════════════════════════════════════════════ */

const SCENES = [
  {
    numeral: "I",
    caption:
      "The Glacial Archive freezes the third shard — my foresight — to keep a terrible truth unread.",
  },
  {
    numeral: "II",
    caption: "The Rime Oracle, born of foresight, strikes with killing frost and shard volleys.",
  },
  {
    numeral: "III",
    caption: "Thaw the Oracle. Recover my sight — and the truth I buried.",
  },
];

export default function Cutscene() {
  const [index, setIndex] = useState(0);
  const [veil, setVeil] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const advance = () => {
    if (veil) return;
    const next = (index + 1) % SCENES.length;
    setVeil(true);
    timers.current.push(setTimeout(() => setIndex(next), 440));
    timers.current.push(setTimeout(() => setVeil(false), 640));
  };

  const scene = SCENES[index];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Advance the cutscene"
      onClick={advance}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          advance();
        }
      }}
      className="relative h-full w-full cursor-pointer select-none overflow-hidden bg-[#02040a] outline-none"
    >
      <CutsceneCanvas sceneIndex={index} />

      {/* letterbox */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/90 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black via-black/75 to-transparent" />

      <AnimatePresence mode="wait">
        <motion.span
          key={scene.numeral}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1 }}
          className="cutscene-display pointer-events-none absolute left-6 top-7 text-[11px] tracking-[0.7em] text-white/35 md:left-12 md:top-10"
        >
          {scene.numeral}
        </motion.span>
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-16 md:pb-24">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
            transition={{ duration: 1.3, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="cutscene-serif cutscene-caption max-w-3xl text-center text-[1.35rem] leading-relaxed text-[#e7f3fb] sm:text-[1.7rem] md:text-[2.3rem] md:leading-[1.45]"
          >
            {scene.caption}
          </motion.p>
        </AnimatePresence>
      </div>

      <motion.div
        animate={{ opacity: veil ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center md:bottom-9"
      >
        <motion.span
          animate={{ opacity: [0.22, 0.7, 0.22] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          className="cutscene-display text-[9px] uppercase tracking-[0.55em] text-white/70 md:text-[10px]"
        >
          click to {index === SCENES.length - 1 ? "begin again" : "continue"}
        </motion.span>
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        animate={{ opacity: veil ? 1 : 0 }}
        transition={{ duration: veil ? 0.42 : 0.55, ease: "easeInOut" }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2.8, ease: "easeInOut" }}
      />
    </div>
  );
}