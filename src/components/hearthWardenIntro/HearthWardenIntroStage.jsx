import React, { useEffect, useState } from 'react';
import HearthWardenIntro from './HearthWardenIntro';

// Wraps the looping Hearth Warden cinematic (rendered by the bundled
// HearthWardenIntro component) so it can be used as the realm-1 story
// intro. The cinematic plays full-screen — click the scene to advance its
// narrative beats — and this stage offers a "Begin the Trial" exit that
// finishes the intro and launches the arena. Rendered by Game.jsx over the
// game iframe when story.js requests it via postMessage.
export default function HearthWardenIntroStage({ onDone }) {
  const [canBegin, setCanBegin] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCanBegin(true), 11000);
    const onKey = (e) => {
      if (e.key === 'Escape' && typeof onDone === 'function') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <HearthWardenIntro />

      <button
        onClick={onDone}
        className="absolute top-5 right-5 z-[101] rounded-md border border-white/25 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 transition hover:bg-white/10"
      >
        Skip ▸
      </button>

      {canBegin && (
        <button
          onClick={onDone}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[101] rounded-md border border-emerald-300/40 bg-emerald-500/15 px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100 shadow-lg transition hover:bg-emerald-500/30"
        >
          Begin the Trial ▸
        </button>
      )}
    </div>
  );
}