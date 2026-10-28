import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LogOut } from "lucide-react";

const SPEED = 240;
const PLAYER_R = 16;
const FIRE_INTERVAL = 170;

function hitsBuilding(x, y, r, buildings) {
  for (const b of buildings || []) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

function selfOf(snap, id) {
  if (!snap || !snap.players) return null;
  return snap.players.find((p) => p.id === id) || null;
}

const PLAYER_HUES = [210, 140, 40, 280, 340, 100, 25];

export default function ArenaCanvas({ lobbyId, peerId, world, buildings, onLeave }) {
  const canvasRef = useRef(null);
  const snapRef = useRef(null);
  const localRef = useRef({ x: world.w / 2, y: world.h / 2, ang: 0 });
  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const shootRef = useRef({ down: false, last: 0 });
  const rafRef = useRef(0);
  const lastFrameRef = useRef(performance.now());
  const [hud, setHud] = useState({ hp: 100, hpMax: 100, wave: 0, kills: 0, players: 0, dead: false, respawn: 0 });

  const invoke = (p) =>
    base44.functions.invoke("game_server", { ...p, lobbyId, peerId })
      .then((r) => r.data).catch(() => null);

  // canvas sizing
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // input listeners
  useEffect(() => {
    const block = new Set(["w", "a", "s", "d", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
    const kd = (e) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (block.has(k)) e.preventDefault();
    };
    const ku = (e) => { keysRef.current[e.key.toLowerCase()] = false; };
    const mm = (e) => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const md = (e) => { if (e.button === 0) shootRef.current.down = true; };
    const mu = (e) => { if (e.button === 0) shootRef.current.down = false; };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
    };
  }, []);

  // network loop (~16Hz): send input when alive, poll when dead
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      const self = selfOf(snapRef.current, peerId);
      const dead = !self || self.hp <= 0;
      if (dead) {
        const res = await invoke({ op: "poll" });
        if (res && !res.noChange) snapRef.current = res;
        const s2 = selfOf(snapRef.current, peerId);
        if (s2 && s2.hp > 0) { localRef.current.x = s2.x; localRef.current.y = s2.y; }
      } else {
        const k = keysRef.current;
        let ix = (k.a || k.arrowleft ? -1 : 0) + (k.d || k.arrowright ? 1 : 0);
        let iy = (k.w || k.arrowup ? -1 : 0) + (k.s || k.arrowdown ? 1 : 0);
        const len = Math.hypot(ix, iy) || 1; ix /= len; iy /= len;
        const ang = localRef.current.ang;
        const res = await invoke({ op: "input", x: localRef.current.x, y: localRef.current.y, ang, ix, iy, weapon: 0 });
        if (res && !res.noChange) snapRef.current = res;
        const t = performance.now();
        if (shootRef.current.down && t - shootRef.current.last > FIRE_INTERVAL) {
          shootRef.current.last = t;
          invoke({
            op: "shoot",
            x: localRef.current.x + Math.cos(ang) * PLAYER_R,
            y: localRef.current.y + Math.sin(ang) * PLAYER_R,
            ang, speed: 820, dmg: 14
          });
        }
      }
      // update HUD
      const s3 = selfOf(snapRef.current, peerId);
      if (s3) {
        setHud({
          hp: s3.hp, hpMax: s3.hpMax, wave: snapRef.current?.wave || 0,
          kills: snapRef.current?.scores?.[peerId] || 0,
          players: snapRef.current?.players?.length || 0,
          dead: s3.hp <= 0, respawn: s3.hp <= 0 ? 4 : 0
        });
      }
    };
    tick();
    const id = setInterval(tick, 62);
    return () => { stopped = true; clearInterval(id); };
  }, [lobbyId, peerId]);

  // render loop
  useEffect(() => {
    const render = (t) => {
      const c = canvasRef.current;
      rafRef.current = requestAnimationFrame(render);
      if (!c) return;
      const ctx = c.getContext("2d");
      const dt = Math.min(0.05, (t - lastFrameRef.current) / 1000);
      lastFrameRef.current = t;
      const W = c.width, H = c.height;

      const snap = snapRef.current;
      const self = selfOf(snap, peerId);
      const dead = !self || self.hp <= 0;

      // local movement (client-authoritative)
      if (!dead) {
        const k = keysRef.current;
        let ix = (k.a || k.arrowleft ? -1 : 0) + (k.d || k.arrowright ? 1 : 0);
        let iy = (k.w || k.arrowup ? -1 : 0) + (k.s || k.arrowdown ? 1 : 0);
        const len = Math.hypot(ix, iy) || 1; ix /= len; iy /= len;
        const nx = localRef.current.x + ix * SPEED * dt;
        const ny = localRef.current.y + iy * SPEED * dt;
        if (!hitsBuilding(nx, localRef.current.y, PLAYER_R, buildings)) localRef.current.x = Math.max(20, Math.min(world.w - 20, nx));
        if (!hitsBuilding(localRef.current.x, ny, PLAYER_R, buildings)) localRef.current.y = Math.max(20, Math.min(world.h - 20, ny));
        localRef.current.ang = Math.atan2(mouseRef.current.y - H / 2, mouseRef.current.x - W / 2);
      }

      const camX = localRef.current.x - W / 2;
      const camY = localRef.current.y - H / 2;

      // background
      ctx.fillStyle = "#080a10";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(-camX, -camY);

      // world bounds
      ctx.strokeStyle = "#1c2a44";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, world.w, world.h);

      // grid
      ctx.strokeStyle = "rgba(60,90,140,0.12)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx <= world.w; gx += 200) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, world.h); ctx.stroke(); }
      for (let gy = 0; gy <= world.h; gy += 200) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(world.w, gy); ctx.stroke(); }

      // buildings
      for (const b of buildings || []) {
        ctx.fillStyle = "#101a2e";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = "#2436566";
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }

      // pickups
      for (const p of snap?.pickups || []) {
        ctx.beginPath();
        ctx.fillStyle = "#5ad2ff";
        ctx.shadowColor = "#5ad2ff";
        ctx.shadowBlur = 12;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // bullets
      for (const b of snap?.bullets || []) {
        ctx.beginPath();
        ctx.fillStyle = "#ffd166";
        ctx.shadowColor = "#ffd166";
        ctx.shadowBlur = 8;
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // enemies
      for (const e of snap?.enemies || []) {
        const isTank = e.type === "tank";
        ctx.beginPath();
        ctx.fillStyle = isTank ? "#b06dff" : "#ff5a5a";
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        // hp bar
        if (e.hp < e.maxhp) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(e.x - 18, e.y - e.r - 10, 36, 5);
          ctx.fillStyle = "#7dffa3";
          ctx.fillRect(e.x - 18, e.y - e.r - 10, 36 * (e.hp / e.maxhp), 5);
        }
      }

      // players
      for (const p of snap?.players || []) {
        const isLocal = p.id === peerId;
        const hue = PLAYER_HUES[p.color % PLAYER_HUES.length];
        ctx.beginPath();
        ctx.fillStyle = p.dead ? "#555" : `hsl(${hue},70%,60%)`;
        ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        if (isLocal) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        // aim line
        if (!p.dead) {
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(p.ang) * 26, p.y + Math.sin(p.ang) * 26);
          ctx.stroke();
        }
        // name
        ctx.fillStyle = "#e8eefb";
        ctx.font = "12px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x, p.y - PLAYER_R - 14);
        // hp bar
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(p.x - 22, p.y + PLAYER_R + 4, 44, 5);
        ctx.fillStyle = p.dead ? "#666" : "#7dffa3";
        ctx.fillRect(p.x - 22, p.y + PLAYER_R + 4, 44 * (p.hp / p.hpMax), 5);
      }

      ctx.restore();

      // ----- HUD (screen space) -----
      ctx.textAlign = "left";
      // hp bar
      ctx.fillStyle = "rgba(10,14,22,0.8)";
      ctx.fillRect(16, 16, 220, 26);
      ctx.fillStyle = hud.dead ? "#666" : "#7dffa3";
      ctx.fillRect(20, 20, 208 * (hud.hp / hud.hpMax), 18);
      ctx.fillStyle = "#0a0e16";
      ctx.font = "bold 13px ui-monospace, monospace";
      ctx.fillText(`HP ${Math.max(0, hud.hp)}/${hud.hpMax}`, 28, 34);

      // stats
      ctx.fillStyle = "#9fd2ff";
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.fillText(`WAVE ${hud.wave}`, 16, 64);
      ctx.fillStyle = "#ffd166";
      ctx.fillText(`KILLS ${hud.kills}`, 16, 86);
      ctx.fillStyle = "#e8eefb";
      ctx.fillText(`PLAYERS ${hud.players}`, 16, 108);

      // controls hint
      ctx.fillStyle = "rgba(232,238,251,0.5)";
      ctx.font = "12px ui-monospace, monospace";
      ctx.fillText("WASD move · mouse aim · click shoot", 16, H - 16);

      // death overlay
      if (hud.dead) {
        ctx.fillStyle = "rgba(120,0,0,0.45)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ff6b6b";
        ctx.font = "bold 40px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("YOU DIED", W / 2, H / 2 - 10);
        ctx.fillStyle = "#e8eefb";
        ctx.font = "16px ui-monospace, monospace";
        ctx.fillText("respawning…", W / 2, H / 2 + 24);
      }
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [world, buildings, peerId]);

  return (
    <div className="fixed inset-0 bg-[#080a10]">
      <canvas ref={canvasRef} className="block" />
      <button
        onClick={onLeave}
        className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0e1322]/80 border border-[#273059] text-[#e8eefb] text-sm hover:bg-[#1b2340]"
      >
        <LogOut className="w-4 h-4" /> Leave
      </button>
    </div>
  );
}