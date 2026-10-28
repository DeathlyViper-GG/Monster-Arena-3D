import React, { useEffect, useRef, useState } from "react";

// The three closing lines the old canvas finale spoke over the casket, with the
// same typewriter + Continue pacing. Sits above the 3D crypt; the Continue button
// is the only thing that advances dialogue (clicking the crypt behind still feeds
// souls). The final Continue ends the cutscene.
const BEATS = [
  {
    who: "The Last Scribe",
    text: "Five soul-shards — five pieces of me — rise from the Casket and merge into a single doorway of light.",
  },
  {
    who: "The Hollow",
    text: "Your soul is whole again, little Scribe. The doorway opens to my guardians — and to me.",
  },
  {
    who: "The Archivist",
    text: "Step through, and face all five Wardens reborn at once. The Hollow watches from above. This is the gauntlet you forged.",
  },
];

const TYPE_RATE = 1.3; // chars per frame, matches the old cutscene
const BLINK_MS = 500;

export default function CasketDialogue({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [char, setChar] = useState(0);
  const [typing, setTyping] = useState(true);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  // typewriter
  useEffect(() => {
    if (!typing) return undefined;
    const full = BEATS[idx].text;
    let c = 0;
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      c += TYPE_RATE;
      if (c >= full.length) {
        setChar(full.length);
        setTyping(false);
        return;
      }
      setChar(c);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [idx, typing]);

  const beat = BEATS[idx];
  const shown = typing ? beat.text.slice(0, Math.floor(char)) : beat.text;
  const isLast = idx >= BEATS.length - 1;

  const advance = () => {
    if (typing) {
      setChar(beat.text.length);
      setTyping(false);
      return;
    }
    if (isLast) {
      doneRef.current?.();
      return;
    }
    setIdx((i) => i + 1);
    setChar(0);
    setTyping(true);
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-[101] pointer-events-none"
      style={{
        padding: "42px 44px 40px",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(4,2,10,0.55) 35%, rgba(1,1,6,0.96) 100%)",
        textAlign: "center",
      }}
    >
      <div
        className="mb-2.5 text-[13px] font-bold uppercase"
        style={{ letterSpacing: "0.24em", color: "#cdb6e8", textShadow: "0 0 18px rgba(180,120,235,0.5)" }}
      >
        {beat.who}
      </div>
      <div
        className="mx-auto max-w-[920px] min-h-[1.5em] font-normal"
        style={{
          fontSize: "clamp(17px, 2.1vw, 27px)",
          lineHeight: 1.5,
          letterSpacing: "0.005em",
          color: "#ede2fa",
          textShadow: "0 2px 22px rgba(0,0,0,0.96)",
        }}
      >
        {shown}
        {typing && (
          <span
            className="inline-block"
            style={{ width: "0.4ch", color: "#cdb6e8", animation: `${BLINK_MS}ms steps(2) infinite ucBlink` }}
          >
            ▋
          </span>
        )}
      </div>
      <div className="mt-4 flex justify-center">
        <button
          onClick={advance}
          className="pointer-events-auto cursor-pointer rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition hover:bg-white/10"
          style={{
            display: typing ? "none" : "inline-block",
            borderColor: "rgba(180,120,235,0.3)",
            background: "rgba(12,6,20,0.7)",
            color: "#e6d8f5",
            animation: "ucPulse 1.4s ease-in-out infinite",
          }}
        >
          {isLast ? "Continue ▸" : "Continue ▸"}
        </button>
      </div>
      <style>{`@keyframes ucBlink{50%{opacity:0}}@keyframes ucPulse{0%,100%{box-shadow:0 0 0 rgba(180,120,235,0)}50%{box-shadow:0 0 28px rgba(180,120,235,0.45)}}`}</style>
    </div>
  );
}