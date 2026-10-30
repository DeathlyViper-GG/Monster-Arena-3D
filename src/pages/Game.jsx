import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { appParams } from "@/lib/app-params";
import { hydrateProgress, uploadProgress } from "@/lib/cloudSync";
import CursedCasketScene from "@/components/casketCutscene/CasketScene";
import CasketDialogue from "@/components/casketCutscene/CasketDialogue";
import HearthWardenIntroStage from "@/components/hearthWardenIntro/HearthWardenIntroStage";
import GlacialArchiveStage from "@/components/glacialArchive/GlacialArchiveStage";
import DeathScreen from "@/components/deathScreen/DeathScreen";

// Hosts the real Monster Arena game (vanilla JS 3D client in /game.html) full-screen.
// The game owns its own menu, lobby, and arena. The query string is forwarded so
// shareable links (/?lobby=CODE) and offline flags reach the game's network layer.
//
// Optional cloud accounts: when a player is signed in, their full progress
// (RuneStones, weapons, skins, loadout, story) is hydrated into the shared
// localStorage before the iframe loads, and re-uploaded periodically. The game
// iframe and this parent share localStorage (same origin), so the data needs no
// postMessage — only the auth state is bridged across so the intro can show the
// username / Sign in / Log out controls.
export default function Game() {
  const iframeRef = useRef(null);
  const [casketPlaying, setCasketPlaying] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [hearthIntroPlaying, setHearthIntroPlaying] = useState(false);
  const [glacialPlaying, setGlacialPlaying] = useState(false);
  const [introRealm, setIntroRealm] = useState(1);
  const [deathPlaying, setDeathPlaying] = useState(false);
  const { user, isAuthenticated, authChecked, logout } = useAuth();

  useEffect(() => {
    document.title = "Monster Arena";
  }, []);

  const postToGame = useCallback((payload) => {
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage(payload, "*");
  }, []);

  // Hydrate cloud save into shared localStorage before the iframe (re)mounts.
  useMemo(() => {
    if (authChecked && isAuthenticated && user?.gameProgress) hydrateProgress(user.gameProgress);
  }, [authChecked, isAuthenticated, user?.id, user?.gameProgress]);

  // Brand-new account with no cloud save yet: upload whatever guest progress exists.
  useEffect(() => {
    if (authChecked && isAuthenticated && user && !user.gameProgress) uploadProgress();
  }, [authChecked, isAuthenticated, user?.id, user?.gameProgress]);

  // Periodic cloud save while signed in, plus a flush on hide / unmount.
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(() => uploadProgress(), 25000);
    const onHide = () => { if (document.visibilityState === "hidden") uploadProgress(); };
    const onUnload = () => uploadProgress();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      uploadProgress();
    };
  }, [isAuthenticated, user?.id]);

  // Tell the game intro who's signed in (so it can show username / logout).
  const postAuth = useCallback(() => {
    postToGame({
      type: "auth:user",
      isAuthenticated: !!isAuthenticated,
      username: user?.username || user?.full_name || "",
      email: user?.email || ""
    });
  }, [isAuthenticated, user, postToGame]);
  useEffect(() => { postAuth(); }, [postAuth]);

  useEffect(() => {
    const onMessage = (e) => {
      const data = e.data || {};
      if (data.type === "casket-cutscene-start") {
        setRestartToken((t) => t + 1);
        setCasketPlaying(true);
      }
      if (data.type === "hearth-warden-intro-start") {
        setIntroRealm(Number(data.realm) || 1);
        setHearthIntroPlaying(true);
      }
      if (data.type === "glacial-archive-start") {
        setGlacialPlaying(true);
        // Acknowledge immediately so the game knows the host is playing the
        // 3D cutscene instead of falling back to its 2D version.
        postToGame({ type: "glacial-archive-ack" });
      }
      if (data.type === "player-died") {
        setDeathPlaying(true);
      }
      if (data.type === "auth:logout") {
        (async () => { await uploadProgress(); logout(true); })();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [logout]);

  const handleLoop = useCallback(() => {
    setCasketPlaying(false);
    postToGame({ type: "casket-cutscene-done" });
  }, [postToGame]);

  const handleHearthIntroDone = useCallback(() => {
    setHearthIntroPlaying(false);
    // Resume the game directly in the iframe: a lost postMessage here used to
    // leave the player stuck on the cutscene with no match starting.
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(introRealm);
    // Belt and braces: the message is the game's own resume path and is
    // ignored if the direct call already started the match.
    postToGame({ type: "hearth-warden-intro-done", realm: introRealm });
  }, [introRealm, postToGame]);

  const handleGlacialDone = useCallback(() => {
    setGlacialPlaying(false);
    postToGame({ type: "glacial-archive-done" });
  }, [postToGame]);

  const handleDeathRise = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: "death-restart" });
  }, [postToGame]);

  const handleDeathHome = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: "death-home" });
  }, [postToGame]);

  const qs = window.location.search || "";
  const iframeKey = (user?.id || "guest") + (isAuthenticated && user?.gameProgress ? "-cloud" : "-local");

  // Only delay for users holding a token (so their cloud save hydrates before the
  // single iframe load). Guests mount instantly with no flash.
  if (appParams.token && !authChecked) {
    return <div className="fixed inset-0 grid place-items-center bg-black text-sm tracking-widest text-white/40">LOADING…</div>;
  }

  return (
    <>
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={`/game.html${qs}`}
        title="Monster Arena"
        className="fixed inset-0 w-full h-full"
        style={{ border: 0 }}
        allow="autoplay; fullscreen; gamepad"
        onLoad={postAuth}
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