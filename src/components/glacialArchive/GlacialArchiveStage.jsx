import { useEffect } from "react";
import GlacialArchiveCutscene from "./GlacialArchiveCutscene";

// Full-screen host for the Realm 3 (Glacial Archive) intro cutscene.
// The scene itself is a three-part three.js cinematic that loops; this stage
// owns the single exit into the realm (Continue button / Escape).
export default function GlacialArchiveStage({ onDone }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onDone?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black">
      <GlacialArchiveCutscene />
      <button
        type="button"
        onClick={() => onDone?.()}
        className="absolute right-5 top-5 z-20 rounded-md border border-white/25 bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/85 transition hover:bg-white/10"
      >
        Continue ▸
      </button>
    </div>
  );
}