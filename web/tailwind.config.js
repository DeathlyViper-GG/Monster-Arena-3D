// Tailwind is REQUIRED by this host. Every cutscene overlay (Hearth Warden
// intro, Casket, Death screen) is positioned purely with utility classes
// (`fixed inset-0 z-[100]`, `absolute inset-0`, …). With no Tailwind pipeline
// those classes don't exist, nothing is positioned or stacked, and the overlay
// paints BEHIND the fixed full-screen game iframe — so the player hears the
// cutscene music (played inside the iframe) but never sees the cutscene.
//
// `../src/**` is scanned too because the cinematic components are imported from
// the repo's shared source through the `@` alias (see vite.config.js).
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', '../src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
};