import { base44 } from "@/api/base44Client";

// Every localStorage key that makes up a player's full Monster Arena progress.
// The game iframe and this React parent share localStorage (same origin), so the
// parent can read/write these directly to hydrate from the cloud or upload to it.
export const PROGRESS_KEYS = [
  "arena_runestones",            // RuneStone balance
  "arena_rune_unlocks",          // owned weapons (JSON array)
  "arena_loadout",               // equipped weapon loadout (JSON)
  "arena_story_progress",        // story realm unlocks / completions (JSON)
  "arenaSettings",               // design, color, gun/melee skins, gfx & audio (JSON)
  "arenaBest",                   // best wave reached
  "arenaNick",                   // multiplayer nickname
  "arena_discovered_buildings"   // building codex (JSON)
];

// Snapshot all progress keys into a plain object (values are raw localStorage strings).
export function bundleProgress() {
  const out = {};
  for (const k of PROGRESS_KEYS) {
    try { const v = localStorage.getItem(k); if (v != null) out[k] = v; } catch (_) {}
  }
  return out;
}

// Write a cloud save back into shared localStorage. Returns true if anything was written.
export function hydrateProgress(gp) {
  if (!gp || typeof gp !== "object") return false;
  let wrote = false;
  for (const k of PROGRESS_KEYS) {
    if (gp[k] != null) {
      try { localStorage.setItem(k, gp[k]); wrote = true; } catch (_) {}
    }
  }
  return wrote;
}

// Persist the current local progress onto the signed-in user's record.
// Non-fatal: if the call fails (e.g. network / credits), the next cycle retries.
export async function uploadProgress(extra = {}) {
  try {
    await base44.auth.updateMe({ gameProgress: bundleProgress(), ...extra });
  } catch (_) {
    // silent — cloud save is best-effort; local progress is unaffected
  }
}