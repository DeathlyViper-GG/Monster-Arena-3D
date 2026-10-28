import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// The web/ project is a thin React host: it iframes /game.html (the real game,
// copied from public/) and overlays the three cinematic cutscenes
// (CursedCasketScene, HearthWardenIntro, DeathScreen) on postMessage from the
// game — exactly the same setup as src/pages/Game.jsx on Base44, minus auth.
//
// `@` aliases to the repo's existing src/ so the cutscene components are
// imported from their single source of truth (no duplication). publicDir is
// the repo's public/ so Vite copies game.html + js/ + css/ into dist/ alongside
// the built React host. Express then serves web/dist as one static root.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  publicDir: path.resolve(__dirname, '../public'),
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 2000 }
});