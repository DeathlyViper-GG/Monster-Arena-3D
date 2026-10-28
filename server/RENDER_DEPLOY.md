# Deploy Monster Arena to Render (identical to the Base44 link)

The game is 100% static files (`public/`) + one Node/Express server
(`base44/_orig_server/`). The server now exposes the **same
`POST /functions/game_server` op-endpoint** your Base44 backend function
uses, so the unchanged client (`public/js/network_http.js`) works on
both hosts. No client edits, no protocol differences.

---

## 1. Folder layout to upload to Render

Create a repo (or zip) with this exact shape:

```
monster-arena/
├─ server/
│  ├─ package.json            ← from base44/_orig_server/package.json
│  ├─ signaling_http.js       ← from base44/_orig_server/signaling_http.js
│  ├─ bots.js                 ← from base44/_orig_server/bots.js
│  └─ glyph.js                ← from base44/_orig_server/glyph.js
└─ client/
   └─ (everything inside public/)   ← game.html, js/, css/, sw.js, etc.
```

Steps:
1. Copy the **3 files** `signaling_http.js`, `bots.js`, `glyph.js` and the
   new `package.json` from `base44/_orig_server/` into `server/`.
2. Copy the **entire contents** of `public/` into `client/`.
   (game.html, js/, css/, sw.js, three.min.js, google*.html, everything.)
3. Do NOT copy `src/`, `base44/`, `node_modules/`, `package.json` (root),
   `vite.config.js`, etc. — Render only needs `server/` + `client/`.

---

## 2. Create the Render Web Service

- **New → Web Service → connect your repo (or "Deploy from zip").**
- **Runtime:** Node
- **Build Command:** `cd server && npm install`
- **Start Command:** `cd server && npm start`
- **Plan:** Free works (lobbies are in-memory and reset on sleep; for
  persistent lobbies use a paid plan).
- **Environment:** none required. The server reads `process.env.PORT`
  automatically (Render sets it).

The server listens on `0.0.0.0:$PORT`, serves `client/` statically
with `game.html` as the default index, and handles multiplayer at
`/functions/game_server`.

---

## 3. Play

Open `https://<your-service>.onrender.com/` → the game loads.
Multiplayer: choose Multiplayer → join → it posts to the same origin's
`/functions/game_server`. Works exactly like the Base44 link.

---

## 4. Two parallel deployments, zero divergence

- Base44 link → uses the Base44 backend function (`entry.ts`).
- Render link → uses this standalone server (`signaling_http.js`).

Same client file (`network_http.js`), same `game.html`, same ops.
Lobbies are separate per host (a Base44 player can't join a Render
lobby and vice-versa) — that's expected.

> Note: Base44 multiplayer is currently offline until Integration
> credits reset on 2026-11-01 (workspace billing limit, not a bug).
> The Render link has no such dependency and works immediately.

---

## Gotchas

- **In-memory lobbies:** the server keeps lobbies in RAM. On Render's
  free tier the service sleeps after ~15 min idle and lobbies reset —
  fine for casual play. For always-on lobbies, use a paid Render plan.
- **`client/` must sit next to `server/`** (the server serves
  `../client`). Keep that relative layout.
- If you change game files later, just re-copy `public/` into
  `client/` and redeploy. If you change server logic, copy the
  `base44/_orig_server/` files into `server/`.