// network_http.js — retargeted to the Base44 `game_server` backend function.
// Same-origin, anonymous (no Base44 login). Single endpoint, op-based dispatch.
// Preserves the original window.Net API the game (pve16.js) calls unchanged.
(() => {
  const ENDPOINT = "/functions/game_server";
  const post = (body) =>
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then((r) => r.json())
      .catch(() => null);

  function appearance() {
    try {
      const s = JSON.parse(localStorage.getItem("arenaSettings") || "{}");
      return {
        design: Number.isInteger(s.design) ? s.design : 0,
        color: Number.isInteger(s.color) ? s.color : 0
      };
    } catch {
      return { design: 0, color: 0 };
    }
  }

  const Net = {
    state: { lobbyId: null, peerId: null, myId: null, snapshot: null, meta: null },

    setSignalUrl(_) { /* same-origin; ignored */ },
    setNickname(nick) { try { localStorage.setItem("arenaNick", nick); } catch {} },

    async connect({ mode = "pve", nickname = null } = {}) {
      return this.join(mode, nickname);
    },

    async join(mode = "pve", nickname = null, team = null, opts = {}) {
      const nick = nickname || localStorage.getItem("arenaNick") || "Player";
      const urlLobby = new URLSearchParams(location.search).get("lobby");
      const code = (opts.lobbyId || urlLobby || "").trim().toUpperCase();
      const res = await post({
        op: "join", mode, name: nick,
        team: (team === 0 || team === 1) ? team : undefined,
        lobbyId: code || undefined,
        create: opts.create === true ? true : undefined
      });
      if (!res || res.error) throw new Error(res?.error || "join failed");
      this.state.lobbyId = res.lobbyId;
      this.state.peerId = res.peerId;
      this.state.myId = res.peerId;
      this.state.team = (res.team === 0 || res.team === 1) ? res.team : null;
      this.state.isHost = !!res.isHost;
      this.state.meta = {
        lobbyId: res.lobbyId,
        mode: res.mode,
        isHost: !!res.isHost,
        team: this.state.team,
        joinDeadline: res.startTime,
        levelId: res.levelId ?? null,
        mapSeed: res.mapSeed ?? null,
        worldKey: res.worldKey ?? null
      };
      // sync appearance immediately so the server knows our skin
      const a = appearance();
      this.setColor(a.color);
      this.setDesign(a.design);
      window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
      this.poll();
      return res;
    },

    async setLevel(levelId) {
      if (!this.state.lobbyId) throw new Error("Not joined");
      const j = await post({ op: "setLevel", lobbyId: this.state.lobbyId, peerId: this.state.peerId, levelId });
      if (j && j.lobbyId && j.lobbyId !== this.state.lobbyId) this.state.lobbyId = j.lobbyId;
      this.state.meta = { ...(this.state.meta || {}), ...j };
      window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
      return j;
    },

    // Host-only: launch the lobby the creator is sharing.
    // Host-only: switch the lobby's mode (pre-start).
    async setMode(mode) {
      if (!this.state.lobbyId || !this.state.peerId) return { ok:false };
      const j = await post({ op: "setMode", lobbyId: this.state.lobbyId, peerId: this.state.peerId, mode });
      if (j && j.mode) this.state.meta = { ...(this.state.meta || {}), mode: j.mode };
      return j;
    },

    async start(levelId) {
      if (!this.state.lobbyId || !this.state.peerId) return { ok:false };
      return post({ op: "start", lobbyId: this.state.lobbyId, peerId: this.state.peerId, levelId });
    },

    async openChest(chestId) {
      if (!this.state.lobbyId) return { ok: false };
      return post({ op: "chestOpen", lobbyId: this.state.lobbyId, peerId: this.state.peerId, chestId });
    },

    async setGuns(guns) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      await post({ op: "setGuns", lobbyId: this.state.lobbyId, peerId: this.state.peerId, guns });
    },
    async setDesign(design) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      await post({ op: "setDesign", lobbyId: this.state.lobbyId, peerId: this.state.peerId, design });
    },
    async setColor(color) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      await post({ op: "setColor", lobbyId: this.state.lobbyId, peerId: this.state.peerId, color });
    },

    async leave() {
      if (!this.state.lobbyId || !this.state.peerId) return;
      const lid = this.state.lobbyId, pid = this.state.peerId;
      this.state.lobbyId = null;
      this.state.peerId = null;
      this.state.snapshot = null;
      try { await post({ op: "leave", lobbyId: lid, peerId: pid }); } catch {}
    },

    async poll() {
      while (this.state.lobbyId) {
        try {
          const since = this.state.snapshot?.t ?? 0;
          const snap = await post({
            op: "poll",
            lobbyId: this.state.lobbyId,
            peerId: this.state.peerId,
            since,
            worldKey: this.state.meta?.worldKey ?? ""
          });
          if (!snap) { await new Promise((r) => setTimeout(r, 250)); continue; }
          if (snap.noChange) { await new Promise((r) => setTimeout(r, 60)); continue; }
          this.state.snapshot = snap;
          window.dispatchEvent(new CustomEvent("net:snapshot", { detail: snap }));
          if (snap.meta) {
            if (JSON.stringify(this.state.meta || {}) !== JSON.stringify(snap.meta)) {
              this.state.meta = snap.meta;
              window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
            }
          }
        } catch {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    },

    async setWorld(walls, hazards, worldKey) {
      if (!this.state.lobbyId) throw new Error("Not joined");
      await post({ op: "setWorld", lobbyId: this.state.lobbyId, walls, hazards, worldKey });
    },

    sendInput(ix, iy, ang, x, y, weapon) {
      const t = performance.now();
      if (this._lastInputAt && t - this._lastInputAt < 100) return;
      this._lastInputAt = t;
      if (!this.state.lobbyId || !this.state.peerId) return;
      post({ op: "input", lobbyId: this.state.lobbyId, peerId: this.state.peerId, ix, iy, ang, x, y, weapon });
    },

    sendShoot(x, y, ang, speed, dmg) {
      post({ op: "shoot", lobbyId: this.state.lobbyId, peerId: this.state.peerId, x, y, ang, speed, dmg });
    },

    async setGlyphPath(path) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      return post({ op: "glyphPath", lobbyId: this.state.lobbyId, peerId: this.state.peerId, path });
    },
    async unlockGlyph(path, key) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      return post({ op: "glyphUnlock", lobbyId: this.state.lobbyId, peerId: this.state.peerId, path, key });
    },

    sendChat(text) {
      if (!this.state.lobbyId || !this.state.peerId) return;
      const body = String(text || "").slice(0, 140);
      if (!body.trim()) return;
      post({ op: "chat", lobbyId: this.state.lobbyId, peerId: this.state.peerId, text: body });
    },

    sendHit(target, x, y, dmg, kind = "") {
      post({ op: "hit", lobbyId: this.state.lobbyId, peerId: this.state.peerId, target, x, y, dmg, kind });
    }
  };

  window.Net = Net;
})();
