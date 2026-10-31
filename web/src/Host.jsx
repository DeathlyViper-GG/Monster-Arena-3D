// Standalone React host for the Render deploy.
// Mirrors src/pages/Game.jsx (Base44) with the auth/cloud-save layer removed:
// the game runs as a guest (localStorage-only, which game.html already
// supports). The game iframe posts the three cinematic cutscene triggers;
// this host overlays the identical React + three.js cutscenes so Story mode
// and the death screen play exactly as they do on the Base44 link.
import { useEffect, useRef, useState, useCallback } from 'react';
import CursedCasketScene from '@/components/casketCutscene/CasketScene';
import CasketDialogue from '@/components/casketCutscene/CasketDialogue';
import HearthWardenIntroStage from '@/components/hearthWardenIntro/HearthWardenIntroStage';
import GlacialArchiveStage from '@/components/glacialArchive/GlacialArchiveStage';
import DeathScreen from '@/components/deathScreen/DeathScreen';

export default function Host() {
  const iframeRef = useRef(null);
  const [casketPlaying, setCasketPlaying] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [hearthIntroPlaying, setHearthIntroPlaying] = useState(false);
  const [glacialPlaying, setGlacialPlaying] = useState(false);
  const [deathPlaying, setDeathPlaying] = useState(false);

  useEffect(() => { document.title = 'Monster Arena'; }, []);

  const postToGame = useCallback((payload) => {
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage(payload, '*');
  }, []);

  // Tell the game intro this is a guest (no Base44 auth on a standalone host).
  useEffect(() => {
    postToGame({ type: 'auth:user', isAuthenticated: false, username: '', email: '' });
  }, [postToGame]);

  useEffect(() => {
    const onMessage = (e) => {
      const data = e.data || {};
      if (data.type === 'casket-cutscene-start') {
        setRestartToken((t) => t + 1);
        setCasketPlaying(true);
      }
      if (data.type === 'hearth-warden-intro-start') setHearthIntroPlaying(true);
      if (data.type === 'glacial-archive-start') {
        setGlacialPlaying(true);
        // Acknowledge at once so the game plays this 3D cutscene instead of
        // falling back to its 2D canvas version.
        postToGame({ type: 'glacial-archive-ack' });
      }
      if (data.type === 'player-died') setDeathPlaying(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postToGame]);

  const handleLoop = useCallback(() => {
    setCasketPlaying(false);
    postToGame({ type: 'casket-cutscene-done' });
  }, [postToGame]);

  const handleHearthIntroDone = useCallback(() => {
    setHearthIntroPlaying(false);
    postToGame({ type: 'hearth-warden-intro-done' });
  }, [postToGame]);

  const handleGlacialDone = useCallback(() => {
    setGlacialPlaying(false);
    postToGame({ type: 'glacial-archive-done' });
  }, [postToGame]);

  const handleDeathRise = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: 'death-restart' });
  }, [postToGame]);

  const handleDeathHome = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: 'death-home' });
  }, [postToGame]);

  const qs = window.location.search || '';

  return (
    <>
      <iframe
        ref={iframeRef}
        src={`/game.html${qs}`}
        title="Monster Arena"
        className="fixed inset-0 w-full h-full"
        style={{ border: 0 }}
        allow="autoplay; fullscreen; gamepad"
      />
      {casketPlaying && (
        <div className="fixed inset-0 z-[100] bg-black">
          <CursedCasketScene playing restartToken={restartToken} onLoop={handleLoop} />
          <button
            onClick={() => handleLoop()}
            className="absolute top-5 right-5 z-[101] rounded-md border border-white/25 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 transition hover:bg-white/10"
          >
            Skip ▸
          </button>
          <p className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-[101] text-center text-xs uppercase tracking-[0.2em] text-white/55">
            Tap the crypt to feed each soul ▸ the fifth seal opens the casket
          </p>
          <CasketDialogue onDone={handleLoop} />
        </div>
      )}
      {hearthIntroPlaying && <HearthWardenIntroStage onDone={handleHearthIntroDone} />}
      {glacialPlaying && <GlacialArchiveStage onDone={handleGlacialDone} />}
      {deathPlaying && (
        <div className="fixed inset-0 z-[110] bg-black">
          <DeathScreen onRise={handleDeathRise} onHome={handleDeathHome} />
        </div>
      )}
    </>
  );
}