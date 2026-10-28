import { useEffect, useRef, useState } from 'react';
import { Image } from '@/components/ui/image';

const CSS = `
@keyframes mn-spin { to { transform: rotate(360deg); } }
@keyframes mn-spin-rev { to { transform: rotate(-360deg); } }

.mn-spin-void { animation: mn-spin 150s linear infinite; transform-origin: 50% 50%; }
.mn-spin-rite { animation: mn-spin-rev 48s linear infinite; transform-origin: 50% 50%; }
.mn-spin-slow { animation: mn-spin 26s linear infinite; transform-origin: 50% 50%; }
.mn-spin-fast { animation: mn-spin 3.2s linear infinite; transform-origin: 50% 50%; }

/* fractured title */
.mn-glitch { position: relative; }
.mn-glitch::before,
.mn-glitch::after {
  content: attr(data-text);
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: screen;
}
.mn-glitch::before { color: #00e5ff; opacity: 0; animation: mn-glitch-a 7s steps(1, end) infinite; }
.mn-glitch::after { color: #b9d4ff; opacity: 0; animation: mn-glitch-b 9s steps(1, end) infinite; }

@keyframes mn-glitch-a {
  0%, 84%, 100% { opacity: 0; transform: translate3d(0, 0, 0); }
  85% { opacity: 0.8; transform: translate3d(-6px, -3px, 0); }
  87% { opacity: 0.35; transform: translate3d(4px, 2px, 0); }
  89% { opacity: 0.7; transform: translate3d(-3px, 3px, 0); }
  92% { opacity: 0; transform: translate3d(0, 0, 0); }
}

@keyframes mn-glitch-b {
  0%, 74%, 100% { opacity: 0; transform: translate3d(0, 0, 0); }
  75% { opacity: 0.55; transform: translate3d(7px, 2px, 0); }
  78% { opacity: 0.25; transform: translate3d(-5px, -2px, 0); }
  81% { opacity: 0; transform: translate3d(0, 0, 0); }
}

@keyframes mn-flicker {
  0%, 96%, 100% { opacity: 1; }
  96.5% { opacity: 0.55; }
  97.5% { opacity: 0.95; }
  98.5% { opacity: 0.7; }
}
.mn-flicker { animation: mn-flicker 9s ease-in-out infinite; }

@keyframes mn-breathe {
  0%, 100% { opacity: 0.25; transform: scale(0.985); }
  50% { opacity: 0.8; transform: scale(1.015); }
}
.mn-breathe { animation: mn-breathe 3.6s ease-in-out infinite; }

@keyframes mn-vibrate {
  0% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0.7px, -0.6px, 0); }
  100% { transform: translate3d(-0.6px, 0.5px, 0); }
}
.mn-vibrate { animation: mn-vibrate 140ms steps(2, end) infinite; }

/* cracks drawing themselves into the glass */
.mn-crack path {
  stroke-dasharray: 1400;
  stroke-dashoffset: 1400;
  animation: mn-draw 2.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes mn-draw { to { stroke-dashoffset: 0; } }

@keyframes mn-fade-in { from { opacity: 0; } to { opacity: 1; } }
.mn-fade-in { animation: mn-fade-in 0.4s ease-out both; }

@keyframes mn-flare-core {
  0% { opacity: 0; transform: scale(0.55); }
  40% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 0.3; transform: scale(1.35); }
}
.mn-flare-core { animation: mn-flare-core 2.1s ease-out both; }

@keyframes mn-rise-in {
  0% { opacity: 0; letter-spacing: 1.2em; filter: blur(10px); }
  55% { opacity: 1; filter: blur(2px); }
  100% { opacity: 1; letter-spacing: 0.7em; filter: blur(0); }
}
.mn-rise-in { animation: mn-rise-in 1.9s cubic-bezier(0.22, 1, 0.36, 1) both; }

/* spectral drift — phantoms closing in toward the camera */
@keyframes mn-approach {
  0% { transform: translate3d(0, 8%, 0) scale(0.38); opacity: 0; filter: blur(7px); }
  24% { opacity: calc(var(--ghost-opacity, 0.28) * 0.85); filter: blur(4.5px); }
  62% { transform: translate3d(2%, -2%, 0) scale(0.95); opacity: var(--ghost-opacity, 0.28); filter: blur(2px); }
  88% { opacity: calc(var(--ghost-opacity, 0.28) * 0.8); filter: blur(2.5px); }
  100% { transform: translate3d(-1%, -9%, 0) scale(1.5); opacity: 0; filter: blur(9px); }
}
.mn-approach {
  transform-origin: 50% 100%;
  animation-name: mn-approach;
  animation-timing-function: cubic-bezier(0.36, 0, 0.58, 1);
  animation-iteration-count: infinite;
  filter: blur(1px) drop-shadow(0 0 26px rgba(0, 229, 255, 0.55)) drop-shadow(0 0 70px rgba(193, 19, 48, 0.28));
  will-change: transform, opacity, filter;
}

/* blood-blue chains hauling the soul back in */
.mn-chain {
  stroke: #2f6bff;
  filter: drop-shadow(0 0 7px rgba(47, 107, 255, 0.8)) drop-shadow(0 0 22px rgba(0, 120, 255, 0.35));
}
.mn-chain-link {
  fill: none;
  stroke-width: 3.2;
  opacity: 0.4;
  animation: mn-chain-tug 2.8s ease-in-out infinite;
}
@keyframes mn-chain-tug {
  0%, 100% { opacity: 0.22; stroke: #1b3ec8; }
  45% { opacity: 0.95; stroke: #6ea6ff; }
}
.mn-chain-strain {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: mn-chain-strain 6s ease-in-out infinite;
  will-change: transform;
}
@keyframes mn-chain-strain {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  38% { transform: translate(0, -5px) rotate(0.18deg); }
  72% { transform: translate(0, 4px) rotate(-0.14deg); }
}
.mn-soul-core {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: mn-soul-throb 3.4s ease-in-out infinite;
  will-change: transform, opacity;
}
@keyframes mn-soul-throb {
  0%, 100% { opacity: 0.4; transform: scale(0.88); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* breathing pool of spell-light */
@keyframes mn-glow-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.85; }
}
.mn-glow-pulse { animation: mn-glow-pulse 6.5s ease-in-out infinite; will-change: opacity; }

/* spectral drift — fog wisps */
@keyframes mn-wisp-drift {
  0% { transform: translate3d(0, 9%, 0) scale(0.94); opacity: 0; }
  25% { opacity: var(--wisp-opacity, 0.4); }
  50% { transform: translate3d(6%, -6%, 0) scale(1.08); opacity: calc(var(--wisp-opacity, 0.4) * 0.7); }
  78% { opacity: calc(var(--wisp-opacity, 0.4) * 0.9); }
  100% { transform: translate3d(-5%, -17%, 0) scale(1.02); opacity: 0; }
}
.mn-wisp {
  filter: blur(46px);
  animation-name: mn-wisp-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}

/* a veil of cold light sweeping across the dead */
@keyframes mn-veil-sweep {
  0% { opacity: 0; transform: translate3d(-32%, 0, 0) rotate(8deg); }
  14% { opacity: 0.4; }
  45% { opacity: 0.12; }
  100% { opacity: 0; transform: translate3d(32%, -6%, 0) rotate(8deg); }
}
.mn-veil {
  background: linear-gradient(100deg, transparent 20%, rgba(168, 251, 255, 0.09) 46%, rgba(0, 229, 255, 0.16) 54%, transparent 80%);
  animation: mn-veil-sweep 13s ease-in-out infinite;
  mix-blend-mode: screen;
  will-change: transform, opacity;
}

/* the title's lingering ghost */
@keyframes mn-echo {
  0%, 100% { opacity: 0.1; transform: scale(1); }
  50% { opacity: 0.32; transform: scale(1.04); }
}
.mn-echo { animation: mn-echo 7.5s ease-in-out infinite; will-change: transform, opacity; }

/* bleeding magic type */
.mn-letter {
  display: inline-block;
  animation: mn-letter-rise 6s ease-in-out infinite;
  will-change: transform, text-shadow;
}
@keyframes mn-letter-rise {
  0%, 100% {
    transform: translate3d(0, 0, 0);
    text-shadow: 0 0 22px rgba(0, 229, 255, 0.3), 0 0 54px rgba(193, 19, 48, 0.28);
  }
  45% {
    transform: translate3d(0, -4px, 0);
    text-shadow: 0 0 34px rgba(0, 229, 255, 0.7), 0 0 78px rgba(212, 27, 56, 0.5), 0 0 120px rgba(193, 19, 48, 0.3);
  }
}

.mn-shimmer {
  background-image: linear-gradient(100deg, rgba(219, 234, 245, 0.68) 16%, #ffffff 36%, #ffd0da 48%, #e8f6ff 62%, rgba(219, 234, 245, 0.68) 84%);
  background-size: 260% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: mn-shimmer 9s linear infinite;
}
@keyframes mn-shimmer { to { background-position: -170% 0; } }

@keyframes mn-bleed-seam {
  0%, 100% { opacity: 0.25; transform: scaleY(0.8); }
  50% { opacity: 0.75; transform: scaleY(1.08); }
}
.mn-bleed-seam {
  transform-origin: 50% 0;
  animation: mn-bleed-seam 5.5s ease-in-out infinite;
  will-change: transform, opacity;
}

/* blood running down the glass */
.mn-drip {
  transform-origin: 50% 0;
  animation-name: mn-drip;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  filter: drop-shadow(0 0 6px rgba(193, 19, 48, 0.7));
  will-change: transform, opacity;
}
@keyframes mn-drip {
  0%, 100% { transform: scaleY(0.4); opacity: 0.55; }
  50% { transform: scaleY(1); opacity: 1; }
}

.mn-drop {
  animation-name: mn-drop-fall;
  animation-timing-function: ease-in;
  animation-iteration-count: infinite;
  will-change: transform, opacity;
}
@keyframes mn-drop-fall {
  0% { transform: translate3d(-50%, -10px, 0) scaleY(0.7); opacity: 0; }
  12% { opacity: 1; }
  60% { transform: translate3d(-50%, 34vh, 0) scaleY(1.25); opacity: 0.9; }
  100% { transform: translate3d(-50%, 62vh, 0) scaleY(1.4); opacity: 0; }
}

.mn-heartbeat { animation: mn-heartbeat 3.6s ease-in-out infinite; will-change: opacity; }
@keyframes mn-heartbeat {
  0%, 100% { opacity: 0.3; }
  8% { opacity: 0.85; }
  16% { opacity: 0.42; }
  24% { opacity: 0.78; }
  42% { opacity: 0.36; }
}

/* spilled blood — breath-sick pools that swell */
.mn-stain {
  transform-origin: 50% 50%;
  animation: mn-stain-pulse 11s ease-in-out infinite;
  will-change: transform, opacity;
}
@keyframes mn-stain-pulse {
  0%, 100% { opacity: 0.55; transform: scale(0.96); }
  50% { opacity: 1; transform: scale(1.04); }
}

/* something clawed its way through */
.mn-claw path {
  stroke-dasharray: 1200;
  stroke-dashoffset: 1200;
  animation: mn-claw-tear 12s ease-out infinite;
  filter: drop-shadow(0 0 10px rgba(193, 19, 48, 0.9)) drop-shadow(0 0 34px rgba(255, 45, 85, 0.35));
}
@keyframes mn-claw-tear {
  0% { stroke-dashoffset: 1200; opacity: 0; }
  3% { opacity: 1; }
  20% { stroke-dashoffset: 0; opacity: 1; }
  68% { opacity: 0.5; }
  92%, 100% { stroke-dashoffset: 0; opacity: 0; }
}

/* something is watching from the dark */
.mn-blink { animation: mn-blink 7.5s ease-in-out infinite; will-change: opacity, transform; }
@keyframes mn-blink {
  0%, 10% { opacity: 0.9; transform: scaleY(1); }
  13%, 15% { opacity: 0; transform: scaleY(0.08); }
  18%, 58% { opacity: 0.7; transform: scaleY(1); }
  61%, 63% { opacity: 0; transform: scaleY(0.08); }
  66%, 100% { opacity: 0.92; transform: scaleY(1); }
}

/* the room closing in */
.mn-dread { animation: mn-dread 9s ease-in-out infinite; will-change: opacity; }
@keyframes mn-dread {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 0.95; }
}

/* it comes through the glass */
.mn-jumpscare {
  animation: mn-jumpscare 1.45s cubic-bezier(0.16, 1, 0.3, 1) both;
  transform-origin: 50% 46%;
  will-change: transform, opacity, filter;
}
@keyframes mn-jumpscare {
  0% { opacity: 0; transform: scale(0.7) translate3d(0, 9%, 0); filter: blur(14px) brightness(0.35); }
  5% { opacity: 1; transform: scale(1.02) translate3d(-0.8%, 0, 0); filter: blur(0) brightness(1.35); }
  8% { opacity: 0.3; }
  11% { opacity: 1; transform: scale(1.18) translate3d(1%, -1%, 0); filter: brightness(1.1); }
  20% { transform: scale(1.33) translate3d(-1.3%, 1.1%, 0); }
  30% { transform: scale(1.42) translate3d(1.2%, -0.9%, 0); }
  40% { transform: scale(1.52) translate3d(-0.9%, -0.8%, 0); }
  62% { opacity: 1; transform: scale(1.64) translate3d(0.4%, 0.4%, 0); filter: brightness(0.9); }
  100% { opacity: 0; transform: scale(2.02) translate3d(0, 0, 0); filter: blur(10px) brightness(0.55); }
}

.mn-scare-shake { animation: mn-scare-shake 70ms steps(2, end) infinite; will-change: transform; }
@keyframes mn-scare-shake {
  0% { transform: translate3d(-6px, 3px, 0) rotate(-0.25deg); }
  50% { transform: translate3d(5px, -4px, 0) rotate(0.22deg); }
  100% { transform: translate3d(-3px, -2px, 0) rotate(-0.15deg); }
}

/* the camera flash of a found-footage frame */
.mn-scare-flash { animation: mn-scare-flash 1.45s steps(1, end) both; }
@keyframes mn-scare-flash {
  0% { opacity: 1; }
  4% { opacity: 0.06; }
  7% { opacity: 0.9; }
  11% { opacity: 0; }
  100% { opacity: 0; }
}

.mn-screech { animation: mn-screech 1.45s ease-out both; }
@keyframes mn-screech {
  0%, 12% { opacity: 0; }
  18% { opacity: 1; }
  70% { opacity: 0.9; }
  100% { opacity: 0; }
}
`;

const BACKDROP =
  'https://media.base44.com/images/public/6addd1e0d1a2bb52ea88a38f/af6f0af33_generated_25cca13d.png';
const SCARE_FACE =
  'https://media.base44.com/images/public/6addd1e0d1a2bb52ea88a38f/f9f94df61_generated_image.png';

const SCARE_CHANCE = 0.02;

const rand = (min, max) => min + Math.random() * (max - min);

/* ─── soul-fire embers ─────────────────────────────────────────────── */

function EmberField({ density = 64 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frame;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (y) => ({
      x: rand(0, width),
      y,
      r: rand(1, 3),
      vy: rand(-1.3, -0.5),
      vx: rand(-0.3, 0.3),
      life: rand(0, 0.6),
      hue: Math.random() > 0.78 ? '214,247,255' : '0,229,255',
    });

    resize();
    window.addEventListener('resize', resize);
    const motes = Array.from({ length: density }, () => spawn(rand(0, height)));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (const mote of motes) {
        mote.x += mote.vx;
        mote.y += mote.vy;
        mote.life += 0.006;
        if (mote.y < -30 || mote.life > 1.5) Object.assign(mote, spawn(height + rand(0, 60)));

        const alpha = Math.sin(Math.min(mote.life, 1) * Math.PI) * 0.8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${mote.hue},${alpha})`;
        ctx.shadowColor = `rgba(${mote.hue},${alpha * 0.9})`;
        ctx.shadowBlur = 14;
        ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [density]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/* ─── drifting runes and sparks ────────────────────────────────────── */

const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ'];

const makeSprite = (inner, outer) => {
  const size = 64;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.3, outer);
  grad.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return sprite;
};

function ArcaneSparks({ sparks = 84, glyphs = 12 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cyan = makeSprite('rgba(226,253,255,1)', 'rgba(0,229,255,0.6)');
    const ice = makeSprite('rgba(255,255,255,1)', 'rgba(168,251,255,0.55)');
    let width = 0;
    let height = 0;
    let radius = 0;
    let frame;

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = Math.min(width, height) * 0.86;
    };

    resize();
    window.addEventListener('resize', resize);

    const spawnMote = () => ({
      a: rand(0, Math.PI * 2),
      r: rand(0.08, 1.05),
      spin: rand(-0.007, 0.007),
      pull: rand(-0.0013, -0.0003),
      size: rand(2, 7),
      tw: rand(0, Math.PI * 2),
      tws: rand(0.025, 0.08),
      sprite: Math.random() > 0.4 ? cyan : ice,
    });

    const spawnGlyph = () => ({
      x: rand(0.03, 0.97),
      y: rand(1.05, 1.4),
      size: rand(10, 26),
      rot: rand(0, Math.PI * 2),
      vrot: rand(-0.0022, 0.0022),
      vy: rand(0.00025, 0.0007),
      life: 0,
      glyph: RUNES[Math.floor(rand(0, RUNES.length))],
    });

    const motes = Array.from({ length: sparks }, spawnMote);
    const sigils = Array.from({ length: glyphs }, () => ({ ...spawnGlyph(), y: rand(0, 1), life: rand(0, 1) }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const cx = width / 2;
      const cy = height * 0.46;

      for (const mote of motes) {
        mote.a += mote.spin;
        mote.r += mote.pull;
        mote.tw += mote.tws;
        if (mote.r < 0.05) {
          mote.r = rand(0.88, 1.06);
          mote.a = rand(0, Math.PI * 2);
        }
        const px = cx + Math.cos(mote.a) * mote.r * radius;
        const py = cy + Math.sin(mote.a) * mote.r * radius * 0.78;
        const alpha = (0.22 + 0.78 * Math.abs(Math.sin(mote.tw))) * (1 - mote.r * 0.3);
        const size = mote.size * 4;
        ctx.globalAlpha = Math.min(alpha, 1);
        ctx.drawImage(mote.sprite, px - size / 2, py - size / 2, size, size);
      }

      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const sigil of sigils) {
        sigil.y -= sigil.vy;
        sigil.rot += sigil.vrot;
        sigil.life += 0.004;
        if (sigil.y < -0.12 || sigil.life > 1) Object.assign(sigil, spawnGlyph());
        const alpha = Math.sin(Math.min(sigil.life, 1) * Math.PI) * 0.78;
        ctx.save();
        ctx.translate(sigil.x * width, sigil.y * height);
        ctx.rotate(sigil.rot);
        ctx.font = `${sigil.size}px "Cinzel", serif`;
        ctx.fillStyle = `rgba(178,250,255,${alpha})`;
        ctx.shadowColor = 'rgba(0,229,255,0.9)';
        ctx.shadowBlur = 16;
        ctx.fillText(sigil.glyph, 0, 0);
        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [sparks, glyphs]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

/* ─── spectral mist ────────────────────────────────────────────────── */

const WISPS = [
  { left: '-10%', top: '48%', size: '38rem', delay: '0s', duration: '27s', opacity: 0.5 },
  { left: '18%', top: '62%', size: '30rem', delay: '6s', duration: '33s', opacity: 0.35 },
  { left: '46%', top: '38%', size: '44rem', delay: '12s', duration: '30s', opacity: 0.28 },
  { left: '72%', top: '56%', size: '36rem', delay: '3s', duration: '25s', opacity: 0.4 },
  { left: '86%', top: '28%', size: '28rem', delay: '9s', duration: '35s', opacity: 0.3 },
  { left: '30%', top: '10%', size: '34rem', delay: '16s', duration: '29s', opacity: 0.22 },
];

function SpectralMist() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {WISPS.map((wisp) => (
        <span
          key={`${wisp.left}-${wisp.top}`}
          className="mn-wisp absolute rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(0,229,255,0.5),rgba(0,229,255,0.12)_46%,transparent_72%)]"
          style={{
            left: wisp.left,
            top: wisp.top,
            width: wisp.size,
            height: wisp.size,
            animationDelay: wisp.delay,
            animationDuration: wisp.duration,
            '--wisp-opacity': wisp.opacity,
          }}
        />
      ))}
    </div>
  );
}

/* ─── the procession of the dead ───────────────────────────────────── */

const FIGURES = [
  { left: '2%', bottom: '-6%', height: '52vh', delay: '0s', duration: '12s', opacity: 0.6 },
  { left: '24%', bottom: '-10%', height: '44vh', delay: '4s', duration: '15s', opacity: 0.45 },
  { left: '52%', bottom: '-4%', height: '58vh', delay: '8s', duration: '10s', opacity: 0.55 },
  { left: '70%', bottom: '-8%', height: '48vh', delay: '2s', duration: '13.5s', opacity: 0.5 },
  { left: '87%', bottom: '-2%', height: '40vh', delay: '10s', duration: '16s', opacity: 0.42 },
];

function Ghost({ index }) {
  const body = `ghost-body-${index}`;
  const blur = `ghost-blur-${index}`;

  return (
    <svg viewBox="0 0 100 170" className="h-full w-full">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcfdff" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
        </linearGradient>
        <filter id={blur}>
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>
      <g filter={`url(#${blur})`} fill={`url(#${body})`}>
        <path d="M50 3C31 3 23 19 23 38c0 12 5 19 3 28-3 18-15 32-15 58 0 22 12 43 39 43s39-21 39-43c0-26-12-40-15-58-2-9 3-16 3-28C77 19 69 3 50 3z" />
      </g>
      <ellipse cx="50" cy="41" rx="12" ry="16" fill="#01040a" opacity="0.6" />
      <circle cx="44" cy="40" r="1.7" fill="#e2fdff" opacity="0.9" />
      <circle cx="56" cy="40" r="1.7" fill="#e2fdff" opacity="0.9" />
      <path d="M38 96c4 6 8 8 12 8s8-2 12-8" stroke="#bdfaff" strokeOpacity="0.25" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function GhostProcession() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {FIGURES.map((figure, index) => (
        <span
          key={figure.left}
          className="mn-approach absolute"
          style={{
            left: figure.left,
            bottom: figure.bottom,
            height: figure.height,
            width: `calc(${figure.height} * 0.6)`,
            animationDelay: figure.delay,
            animationDuration: figure.duration,
            '--ghost-opacity': figure.opacity,
          }}
        >
          <Ghost index={index} />
        </span>
      ))}
    </div>
  );
}

/* ─── chains hauling the soul back in ──────────────────────────────── */

const CHAINS = [
  { from: [30, -90], ctrl: [230, 150], to: [494, 428], links: 24, delay: 0 },
  { from: [970, -70], ctrl: [780, 160], to: [508, 442], links: 24, delay: 1.2 },
  { from: [-70, 520], ctrl: [180, 520], to: [438, 512], links: 18, delay: 2.1 },
  { from: [1070, 560], ctrl: [820, 545], to: [568, 520], links: 18, delay: 0.7 },
  { from: [470, 1090], ctrl: [500, 860], to: [504, 578], links: 20, delay: 1.7 },
];

const sampleChain = (chain) => {
  const points = [];
  for (let i = 0; i < chain.links; i += 1) {
    const t = i / (chain.links - 1);
    const mt = 1 - t;
    const x = mt * mt * chain.from[0] + 2 * mt * t * chain.ctrl[0] + t * t * chain.to[0];
    const y = mt * mt * chain.from[1] + 2 * mt * t * chain.ctrl[1] + t * t * chain.to[1];
    const dx = 2 * mt * (chain.ctrl[0] - chain.from[0]) + 2 * t * (chain.to[0] - chain.ctrl[0]);
    const dy = 2 * mt * (chain.ctrl[1] - chain.from[1]) + 2 * t * (chain.to[1] - chain.ctrl[1]);
    points.push({ x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI, t });
  }
  return points;
};

function SoulChains() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <defs>
          <radialGradient id="soul-knot">
            <stop offset="0%" stopColor="#e6feff" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#4d8bff" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0b2a6f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {CHAINS.map((chain, chainIndex) => (
          <g key={chain.from.join('-')} className="mn-chain-strain" style={{ animationDelay: `${chain.delay}s` }}>
            <g className="mn-chain">
              {sampleChain(chain).map((point, pointIndex) => {
                const rx = 6 + point.t * 5.5;
                return (
                  <ellipse
                    key={pointIndex}
                    cx={point.x}
                    cy={point.y}
                    rx={rx}
                    ry={rx * 0.58}
                    transform={`rotate(${point.angle} ${point.x} ${point.y})`}
                    className="mn-chain-link"
                    style={{ animationDelay: `${((pointIndex * 0.08 + chain.delay) % 2.8).toFixed(2)}s` }}
                  />
                );
              })}
            </g>
            <circle
              cx={chain.to[0]}
              cy={chain.to[1]}
              r={32}
              fill="url(#soul-knot)"
              className="mn-soul-core"
              style={{ animationDelay: `${chain.delay + chainIndex * 0.2}s` }}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─── blood ────────────────────────────────────────────────────────── */

const DRIPS = [
  { left: '3%', width: 7, length: 96, delay: '0s', duration: '8s' },
  { left: '9%', width: 3, length: 44, delay: '3.2s', duration: '10s' },
  { left: '17%', width: 9, length: 168, delay: '1.1s', duration: '7.2s' },
  { left: '24%', width: 4, length: 62, delay: '6.2s', duration: '11s' },
  { left: '31%', width: 7, length: 124, delay: '2.4s', duration: '8.4s' },
  { left: '39%', width: 3, length: 38, delay: '5.5s', duration: '12s' },
  { left: '46%', width: 10, length: 196, delay: '0.6s', duration: '6.8s' },
  { left: '54%', width: 5, length: 82, delay: '4.1s', duration: '9.4s' },
  { left: '61%', width: 8, length: 142, delay: '2.9s', duration: '7.8s' },
  { left: '69%', width: 3, length: 30, delay: '7.4s', duration: '13s' },
  { left: '76%', width: 6, length: 108, delay: '1.7s', duration: '8.8s' },
  { left: '84%', width: 4, length: 56, delay: '5.1s', duration: '10.5s' },
  { left: '91%', width: 9, length: 154, delay: '3.6s', duration: '7.4s' },
];

const DROPS = [
  { left: '17%', delay: '1.1s', duration: '6.5s' },
  { left: '31%', delay: '2.4s', duration: '7.5s' },
  { left: '46%', delay: '0.6s', duration: '6s' },
  { left: '61%', delay: '2.9s', duration: '7s' },
  { left: '76%', delay: '1.7s', duration: '7.8s' },
  { left: '91%', delay: '3.6s', duration: '6.8s' },
];

function Bloodfall() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(122,8,24,0.72),rgba(122,8,24,0)_82%)] blur-[3px]" />

      {DRIPS.map((drip) => (
        <span
          key={`${drip.left}-drip`}
          className="mn-drip absolute top-0 rounded-b-full bg-[linear-gradient(180deg,#8f0a1e,#c11330_58%,#5d0413)]"
          style={{
            left: drip.left,
            width: `${drip.width}px`,
            height: `${drip.length}px`,
            animationDelay: drip.delay,
            animationDuration: drip.duration,
          }}
        />
      ))}

      {DROPS.map((drop) => (
        <span
          key={`${drop.left}-drop`}
          className="mn-drop absolute top-2 h-2 w-1.5 rounded-full bg-[#d41b38] shadow-[0_0_10px_rgba(212,27,56,0.9)]"
          style={{ left: drop.left, animationDelay: drop.delay, animationDuration: drop.duration }}
        />
      ))}

      <span className="mn-glow-pulse absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(122,8,24,0.55),rgba(122,8,24,0)_70%)] blur-3xl" />
      <span className="mn-glow-pulse absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(160,10,32,0.45),rgba(160,10,32,0)_70%)] blur-3xl [animation-delay:2.4s]" />
    </div>
  );
}

const DOTS = [
  [34, 30, 4],
  [58, 22, 2.6],
  [150, 40, 3.4],
  [166, 66, 2.2],
  [22, 96, 3],
  [180, 118, 2.8],
  [70, 150, 2.4],
  [140, 158, 3.2],
  [100, 12, 2.2],
  [48, 174, 2.6],
];

function Splat({ size }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size}>
      <path
        d="M100 28c30 0 52 20 55 44 3 26-19 40-40 47-19 7-45 3-55-17-10-21 4-44 17-56 7-7 14-18 23-18z"
        fill="#8f0a1e"
      />
      <path
        d="M118 96c16 3 30 16 34 34 3 15-10 27-24 23-15-4-22-20-19-34 2-9 3-19 9-23z"
        fill="#6d0517"
      />
      {DOTS.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#a00d24" />
      ))}
    </svg>
  );
}

const SPLATS = [
  { top: '4%', left: '2%', size: 300, rotate: -14, delay: '0s', opacity: 0.5 },
  { top: '58%', left: '74%', size: 360, rotate: 26, delay: '3.5s', opacity: 0.42 },
  { top: '30%', left: '84%', size: 220, rotate: 12, delay: '6.5s', opacity: 0.34 },
  { top: '74%', left: '12%', size: 200, rotate: -32, delay: '5s', opacity: 0.38 },
];

function BloodStains() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {SPLATS.map((splat) => (
        <span
          key={`${splat.top}-${splat.left}`}
          className="mn-stain absolute blur-[1px] drop-shadow-[0_0_24px_rgba(193,19,48,0.55)]"
          style={{
            top: splat.top,
            left: splat.left,
            opacity: splat.opacity,
            animationDelay: splat.delay,
          }}
        >
          <span className="block" style={{ transform: `rotate(${splat.rotate}deg)` }}>
            <Splat size={splat.size} />
          </span>
        </span>
      ))}

      <span className="mn-glow-pulse absolute inset-x-0 bottom-0 h-[26vh] bg-[linear-gradient(0deg,rgba(109,5,23,0.85),rgba(122,8,24,0.4)_46%,transparent)] blur-md" />
      <span className="absolute inset-x-0 bottom-0 h-[9vh] bg-[linear-gradient(0deg,rgba(80,3,16,0.95),transparent)] blur-sm" />
    </div>
  );
}

/* ─── claw marks and the watcher ───────────────────────────────────── */

const CLAWS = ['M120 60 L500 520', 'M210 40 L590 500', 'M300 30 L660 470', 'M395 34 L720 452'];

function ClawMarks() {
  return (
    <svg
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      className="mn-claw pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {CLAWS.map((d, index) => (
        <g key={d}>
          <path
            d={d}
            fill="none"
            stroke="#c11330"
            strokeWidth="9"
            strokeLinecap="round"
            strokeOpacity="0.35"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
          <path
            d={d}
            fill="none"
            stroke="#ff5d75"
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{ animationDelay: `${index * 0.12}s` }}
          />
        </g>
      ))}
    </svg>
  );
}

function WatcherEyes() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[13%] flex justify-center gap-[8vw]" aria-hidden="true">
      {[0, 1].map((eye) => (
        <span
          key={eye}
          className="mn-blink block h-14 w-4 rounded-full bg-[linear-gradient(180deg,#ff6b81,#7a0818)] shadow-[0_0_26px_10px_rgba(212,27,56,0.6),0_0_100px_36px_rgba(122,8,24,0.5)]"
          style={{ animationDelay: `${eye * 0.18}s` }}
        />
      ))}
    </div>
  );
}

/* ─── the ritual circles ───────────────────────────────────────────── */

function RuneCircle({ className = '', stroke = '#00e5ff', glyphs = 24 }) {
  const angles = Array.from({ length: glyphs }, (_, i) => (i * 360) / glyphs);

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="97" fill="none" stroke={stroke} strokeOpacity="0.22" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={stroke} strokeOpacity="0.4" strokeWidth="0.6" strokeDasharray="2 6" />
      <circle cx="100" cy="100" r="63" fill="none" stroke={stroke} strokeOpacity="0.18" strokeWidth="0.5" strokeDasharray="15 9" />
      {angles.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 100 100)`}>
          <line x1="100" y1="4" x2="100" y2="15" stroke={stroke} strokeOpacity="0.55" strokeWidth="0.7" />
          <line x1="100" y1="19" x2="100" y2="25" stroke={stroke} strokeOpacity="0.28" strokeWidth="0.5" />
          <line x1="96" y1="9" x2="104" y2="9" stroke={stroke} strokeOpacity="0.2" strokeWidth="0.4" />
        </g>
      ))}
      <polygon points="100,30 160,134 40,134" fill="none" stroke={stroke} strokeOpacity="0.22" strokeWidth="0.5" />
      <polygon points="100,170 40,66 160,66" fill="none" stroke={stroke} strokeOpacity="0.22" strokeWidth="0.5" />
    </svg>
  );
}

/* ─── the glass ────────────────────────────────────────────────────── */

const CRACKS = [
  'M500 520 L452 436 L470 352 L428 268 L448 176 L420 60',
  'M500 520 L566 448 L548 362 L604 292 L586 214 L620 120',
  'M500 520 L392 560 L300 528 L212 570 L120 540 L20 578',
  'M500 520 L612 566 L706 540 L800 588 L906 560 L990 596',
  'M500 520 L520 640 L486 742 L516 846 L488 940',
  'M500 520 L436 596 L444 690 L392 760',
  'M500 520 L586 604 L572 700 L626 782',
];

function CrackedGlass() {
  return (
    <svg
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid slice"
      className="mn-crack pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="crack-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#a8fbff" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      {CRACKS.map((d, i) => (
        <g key={d}>
          <path d={d} fill="none" stroke="url(#crack-glow)" strokeWidth="1.4" strokeLinejoin="round" style={{ animationDelay: `${i * 0.13}s` }} />
          <path d={d} fill="none" stroke="#00e5ff" strokeOpacity="0.14" strokeWidth="7" style={{ animationDelay: `${i * 0.13}s` }} />
        </g>
      ))}
      <circle cx="500" cy="520" r="26" fill="none" stroke="#a8fbff" strokeOpacity="0.4" strokeWidth="1" className="mn-breathe" />
      <circle cx="500" cy="520" r="72" fill="none" stroke="#00e5ff" strokeOpacity="0.18" strokeWidth="0.8" />
    </svg>
  );
}

/* ─── the title ────────────────────────────────────────────────────── */

const WORDS = ['YOU', 'HAVE', 'FALLEN'];

const lettersBefore = (wordIndex) =>
  WORDS.slice(0, wordIndex).reduce((total, word) => total + word.length, 0);

function DeathTitle() {
  return (
    <div className="relative w-full">
      <span
        aria-hidden="true"
        className="mn-echo pointer-events-none absolute inset-0 select-none text-balance font-heading text-[clamp(2.1rem,8.4vw,6.25rem)] font-black uppercase leading-[0.98] tracking-[0.05em] text-[#c11330] blur-[9px]"
      >
        You Have Fallen
      </span>
      <span
        aria-hidden="true"
        className="mn-echo pointer-events-none absolute inset-0 select-none text-balance font-heading text-[clamp(2.1rem,8.4vw,6.25rem)] font-black uppercase leading-[0.98] tracking-[0.05em] text-[#00e5ff] blur-[7px] [animation-delay:1.6s]"
      >
        You Have Fallen
      </span>
      <h1
        data-text="YOU HAVE FALLEN"
        className="mn-glitch mn-flicker relative font-heading text-[clamp(2.1rem,8.4vw,6.25rem)] font-black uppercase leading-[0.98] tracking-[0.05em] text-[#e6f6ff]"
      >
        {WORDS.map((word, wordIndex) => (
          <span key={word}>
            <span className="inline-block whitespace-nowrap">
              {word.split('').map((letter, letterIndex) => {
                const index = lettersBefore(wordIndex) + letterIndex;
                return (
                  <span
                    key={`${letter}-${index}`}
                    className="mn-letter inline-block"
                    style={{ animationDelay: `${(index * 0.11).toFixed(2)}s` }}
                  >
                    {letter}
                  </span>
                );
              })}
            </span>
            {wordIndex < WORDS.length - 1 ? ' ' : null}
          </span>
        ))}
      </h1>
      <span
        aria-hidden="true"
        className="mn-breathe pointer-events-none absolute inset-x-0 -bottom-3 h-12 bg-[linear-gradient(180deg,rgba(0,229,255,0.2),transparent)] blur-xl"
      />
      <span
        aria-hidden="true"
        className="mn-bleed-seam pointer-events-none absolute inset-x-[14%] top-[92%] h-24 bg-[linear-gradient(180deg,rgba(193,19,48,0.4),rgba(193,19,48,0.05)_60%,transparent)] blur-lg"
      />
    </div>
  );
}

/* ─── the button and its aftermath ─────────────────────────────────── */

function RiseAgainButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex items-center justify-center rounded-full px-16 py-7 transition-transform duration-300 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbeaf5] focus-visible:ring-offset-4 focus-visible:ring-offset-[#04070d] disabled:pointer-events-none"
    >
      <span className="mn-breathe absolute inset-0 rounded-full bg-[#00e5ff]/35 blur-2xl transition-all duration-500 group-hover:bg-[#00e5ff]/55" />
      <span className="absolute inset-0 rounded-full bg-[#04070d]/60" />
      <span className="absolute inset-0 rounded-full border border-[#7ce8ff]/70 transition-colors duration-500 group-hover:border-[#e2fdff]" />
      <span className="absolute inset-[3px] rounded-full border border-dashed border-[#00e5ff]/50 mn-breathe" />
      <RuneCircle className="mn-spin-slow absolute -inset-8 opacity-35 transition-opacity duration-500 group-hover:opacity-90" stroke="#00e5ff" />
      <span className="mn-vibrate relative font-heading text-[0.78rem] font-bold uppercase tracking-[0.42em] text-[#eafdff] [text-shadow:0_0_12px_rgba(0,229,255,1),0_0_34px_rgba(0,229,255,0.75),0_0_64px_rgba(212,27,56,0.5)]">
        Rise Again
      </span>
    </button>
  );
}

function ResurrectionFlare() {
  return (
    <div className="mn-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#04070d]/95">
      <div className="mn-flare-core absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(4,7,13,0.93)_0%,rgba(4,7,13,0.86)_14%,rgba(0,229,255,0.5)_27%,rgba(0,229,255,0.12)_47%,transparent_66%)]" />
      <RuneCircle className="mn-spin-fast pointer-events-none absolute left-1/2 top-1/2 h-[125vmin] w-[125vmin] -translate-x-1/2 -translate-y-1/2 opacity-50" />
      <p className="mn-rise-in relative font-heading text-[0.7rem] uppercase tracking-[0.7em] text-[#eafcff] [text-shadow:0_0_24px_rgba(0,229,255,0.9),0_0_64px_rgba(0,229,255,0.5)]">
        The Soul Returns
      </p>
    </div>
  );
}

function playScareSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;

  const ctx = new Ctx();
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  // a shriek of torn air
  const length = Math.floor(ctx.sampleRate * 1.1);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 1.6;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 3.2;
  band.frequency.setValueAtTime(2800, now);
  band.frequency.exponentialRampToValueAtTime(380, now + 1);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.6, now + 0.03);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);
  noise.connect(band);
  band.connect(noiseGain);
  noiseGain.connect(master);

  // the hit in your chest
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(130, now);
  sub.frequency.exponentialRampToValueAtTime(32, now + 0.8);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.exponentialRampToValueAtTime(0.9, now + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  sub.connect(subGain);
  subGain.connect(master);

  // ragged throat harmonics
  [740, 1090, 1510].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.42, now + 0.9);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.13 - index * 0.03, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 1);
  });

  noise.start(now);
  noise.stop(now + 1.1);
  sub.start(now);
  sub.stop(now + 1);

  window.setTimeout(() => ctx.close(), 1700);
}

function JumpScare({ onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    playScareSound();
    const timer = setTimeout(() => doneRef.current(), 1450);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black" aria-hidden="true">
      <div className="mn-jumpscare absolute inset-0">
        <div className="mn-scare-shake h-full w-full">
          <Image src={SCARE_FACE} alt="" className="h-full w-full" fittingType="fill" />
        </div>
      </div>
      <div className="mn-scare-flash absolute inset-0 bg-[#fff4ef]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_44%,transparent_26%,rgba(88,0,12,0.7)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55),transparent_30%,transparent_70%,rgba(0,0,0,0.7))]" />
      <div className="mn-screech absolute inset-0 flex items-end justify-center pb-16">
        <span className="font-heading text-[0.7rem] uppercase tracking-[0.6em] text-[#ffdfe3] [text-shadow:0_0_18px_rgba(255,45,85,0.9)]">
          RUN
        </span>
      </div>
    </div>
  );
}

/* ─── the arena ────────────────────────────────────────────────────── */

export default function DeathScreen({ onRise, onHome }) {
  const [rising, setRising] = useState(false);
  const [scare, setScare] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!rising) return;
    const timer = setTimeout(() => {
      setRising(false);
      if (typeof onRise === 'function') onRise();
    }, 2600);
    return () => clearTimeout(timer);
  }, [rising, onRise]);

  const shift = (depth) => `translate3d(${pointer.x * depth}px, ${pointer.y * depth}px, 0)`;

  const handleRise = () => {
    if (Math.random() < SCARE_CHANCE) {
      setScare(true);
      return;
    }
    setRising(true);
  };

  return (
    <main
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: (event.clientX - rect.left) / rect.width - 0.5,
          y: (event.clientY - rect.top) / rect.height - 0.5,
        });
      }}
      className="relative min-h-screen w-full overflow-hidden bg-[#04070d] font-body text-[#dbeaf5]"
    >
      <style>{CSS}</style>

      <div
        className="pointer-events-none absolute inset-[-7%] transition-transform duration-700 ease-out"
        style={{ transform: shift(-30) }}
      >
        <Image src={BACKDROP} alt="" className="h-full w-full opacity-45 grayscale" fittingType="fill" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#04070d]/90 via-[#04070d]/60 to-[#04070d]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_36%,rgba(0,229,255,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_118%,rgba(11,42,111,0.8),transparent_66%)]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_150px_40px_rgba(1,3,7,0.85)]" />
      <div className="mn-heartbeat pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_52%,transparent_42%,rgba(122,8,24,0.72)_100%)]" />
      <div className="mn-dread pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_46%,transparent_28%,rgba(2,1,4,0.8)_100%)]" />

      <div className="pointer-events-none absolute inset-0">
        <SpectralMist />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <GhostProcession />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-75">
        <EmberField density={90} />
      </div>
      <div className="mn-veil pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0">
        <ArcaneSparks />
      </div>
      <div className="mn-glow-pulse pointer-events-none absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.24),rgba(0,229,255,0.06)_45%,transparent_72%)] blur-2xl" />

      <div className="pointer-events-none absolute inset-0">
        <SoulChains />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <Bloodfall />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <BloodStains />
      </div>

      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[132vmin] w-[132vmin] transition-transform duration-700 ease-out"
        style={{ transform: `translate(-50%, -50%) ${shift(16)}` }}
      >
        <RuneCircle className="mn-spin-void h-full w-full opacity-35" />
        <RuneCircle
          className="mn-spin-rite absolute left-1/2 top-1/2 h-[62%] w-[62%] -translate-x-1/2 -translate-y-1/2 opacity-30"
          stroke="#a8fbff"
          glyphs={16}
        />
        <RuneCircle
          className="mn-spin-slow absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 opacity-45"
          stroke="#7ce8ff"
          glyphs={12}
        />
      </div>

      <CrackedGlass />
      <div className="pointer-events-none absolute inset-0">
        <ClawMarks />
      </div>
      <div className="pointer-events-none absolute inset-0">
        <WatcherEyes />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mn-shimmer mb-9 font-heading text-[0.6rem] uppercase tracking-[0.65em]">Monster Arena</p>

        <DeathTitle />

        <div className="my-9 flex w-full items-center justify-center gap-4">
          <span className="h-px w-10 shrink bg-gradient-to-r from-transparent to-[#00e5ff]/60 sm:w-14" />
          <span className="mn-flicker whitespace-nowrap font-heading text-[0.58rem] uppercase tracking-[0.45em] text-[#ff3b5c] [text-shadow:0_0_16px_rgba(212,27,56,0.85),0_0_40px_rgba(0,229,255,0.35)]">
            The Soul Fractures
          </span>
          <span className="h-px w-10 shrink bg-gradient-to-l from-transparent to-[#00e5ff]/60 sm:w-14" />
        </div>

        <p className="mn-shimmer max-w-md text-lg leading-relaxed">
          The arena remembers every name it takes. Yours is still warm on its tongue — the runes
          have not yet closed.
        </p>

        <div className="mt-16 flex flex-col items-center gap-9">
          <RiseAgainButton onClick={handleRise} disabled={rising || scare} />
          <button
            type="button"
            onClick={onHome}
            disabled={rising || scare}
            className="mn-flicker relative cursor-pointer select-none font-heading text-[0.66rem] uppercase tracking-[0.5em] text-[#cfe6f5]/75 [text-shadow:0_0_16px_rgba(0,229,255,0.5)] transition hover:text-[#eafdff] disabled:cursor-default"
          >
            Back to Home
          </button>
        </div>
      </section>

      {scare && (
        <JumpScare
          onDone={() => {
            setScare(false);
            setRising(true);
          }}
        />
      )}
      {rising && <ResurrectionFlare />}
    </main>
  );
}