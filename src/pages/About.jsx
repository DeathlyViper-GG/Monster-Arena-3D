import React from "react";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to game
        </Link>
        <h1 className="text-4xl font-heading font-bold mt-6 mb-6">About Monster Arena</h1>
        <div className="space-y-4 text-lg leading-relaxed text-muted-foreground font-body">
          <p>
            Monster Arena is an intense fantasy action survival game where you master
            magical glyphs to outlast escalating waves of intelligent enemies. Across five
            themed realms — from the verdant Heartwood to the cursed Sunken Dunes and beyond —
            you explore buildings, uncover hidden chests, and adapt as the arena itself turns
            lethal with quicksand, lava, void, and ice hazards. Death is punishing: it strips
            your powerful enchantments, forcing you to earn your magic back every time you
            respawn.
          </p>
          <p>
            The game is built for action fans who enjoy skill-based combat, deep upgrade
            systems, and replayable runs. Play offline against AI bots, tackle singleplayer
            waves at your own pace, or join a multiplayer lobby for co-op PvE survival or
            free-for-all PvP. A full plot-driven Story mode weaves cinematic cutscenes, mid-
            combat villain dialogue, and branching endings through every realm.
          </p>
          <p>
            Monster Arena is developed and published on the Base44 platform, which provides
            the hosting, authentication, and backend services that power multiplayer lobbies
            and persistent progress. Have feedback or a bug to report? Visit our{" "}
            <Link to="/contact" className="underline text-foreground hover:opacity-80">
              Contact page
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}