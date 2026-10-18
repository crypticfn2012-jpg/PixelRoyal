import { DurableObject } from "cloudflare:workers";

const MODES = new Set(["br", "box"]);
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_MESSAGE = 16384;
const MAX_ROOM_PLAYERS = 16;

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "cache-control": "no-store",
      ...extra,
    },
  });
}
function code(length = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}
function send(ws, data) {
  try { ws.send(JSON.stringify(data)); } catch (_) {}
}
function attachment(ws) {
  try { return ws.deserializeAttachment() || {}; } catch (_) { return {}; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true });
    if (url.pathname === "/health") {
      return json({ ok: true, service: "pixelroyal-multiplayer", timestamp: new Date().toISOString() });
    }
    const id = env.MY_DURABLE_OBJECT.idFromName("pixelroyal-hub");
    return env.MY_DURABLE_OBJECT.get(id).fetch(request);
  },
};

export class MyDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true });

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON body." }, 400); }
      const mode = body?.mode === "box" ? "box" : body?.mode === "br" ? "br" : null;
      if (!mode) return json({ error: "Mode must be br or box." }, 400);
      let roomCode;
      for (let i = 0; i < 8; i++) {
        const candidate = code();
        if (!(await this.ctx.storage.get("room:" + candidate))) { roomCode = candidate; break; }
      }
      if (!roomCode) return json({ error: "Could not allocate a room. Try again." }, 503);
      const room = { code: roomCode, mode, private: true, createdAt: Date.now() };
      await this.ctx.storage.put("room:" + roomCode, room);
      return json(room, 201);
    }

    if (url.pathname.startsWith("/api/rooms/") && request.method === "GET") {
      const roomCode = url.pathname.split("/").pop().toUpperCase();
      const room = await this.ctx.storage.get("room:" + roomCode);
      if (!room) return json({ error: "Room not found." }, 404);
      return json({ ...room, players: this.roomSockets(roomCode).length });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return json({ error: "WebSocket upgrade required." }, 426);
      }
      const roomCode = (url.searchParams.get("room") || "").trim().toUpperCase();
      const mode = url.searchParams.get("mode");
      if (roomCode) return this.joinRoom(roomCode);
      if (!MODES.has(mode)) return json({ error: "Mode must be br or box." }, 400);
      return this.joinQueue(mode);
    }

    return json({ error: "Not found.", endpoints: ["GET /health", "POST /api/rooms", "GET /api/rooms/:code", "GET /ws?mode=br", "GET /ws?mode=box", "GET /ws?room=CODE"] }, 404);
  }

  roomSockets(roomCode) {
    return this.ctx.getWebSockets().filter((ws) => {
      const a = attachment(ws);
      return a.roomCode === roomCode && a.status === "room";
    });
  }

  createSocket(request, data) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(data);
    return new Response(null, { status: 101, webSocket: client });
  }

  async joinQueue(mode) {
    const clientId = crypto.randomUUID();
    const response = this.createSocket(null, { clientId, mode, roomCode: null, status: "waiting", lastStateAt: 0 });
    const current = this.ctx.getWebSockets().find((ws) => attachment(ws).clientId === clientId);
    if (!current) return response;

    const waiting = this.ctx.getWebSockets().find((ws) => {
      const a = attachment(ws);
      return ws !== current && a.status === "waiting" && a.mode === mode;
    });
    if (!waiting) {
      send(current, { type: "queue_waiting", playerId: clientId, mode });
      return response;
    }

    const other = attachment(waiting);
    let roomCode;
    for (let i = 0; i < 8; i++) {
      const candidate = code();
      if (!(await this.ctx.storage.get("room:" + candidate))) { roomCode = candidate; break; }
    }
    if (!roomCode) {
      send(current, { type: "error", message: "Matchmaking is busy. Please retry." });
      return response;
    }
    await this.ctx.storage.put("room:" + roomCode, { code: roomCode, mode, private: false, createdAt: Date.now() });
    current.serializeAttachment({ clientId, mode, roomCode, status: "room", lastStateAt: 0 });
    waiting.serializeAttachment({ ...other, roomCode, status: "room", lastStateAt: 0 });
    send(waiting, { type: "match_found", room: roomCode, mode, playerId: other.clientId, opponentId: clientId });
    send(current, { type: "match_found", room: roomCode, mode, playerId: clientId, opponentId: other.clientId });
    return response;
  }

  async joinRoom(roomCode) {
    const room = await this.ctx.storage.get("room:" + roomCode);
    if (!room) return json({ error: "Room not found. Check the code." }, 404);
    const sockets = this.roomSockets(roomCode);
    if (sockets.length >= MAX_ROOM_PLAYERS) return json({ error: "This room is full." }, 409);
    const clientId = crypto.randomUUID();
    const isHost = !room.hostClientId;
    if (isHost) {
      room.hostClientId = clientId;
      await this.ctx.storage.put("room:" + roomCode, room);
    }
    const response = this.createSocket(null, { clientId, mode: room.mode, roomCode, status: "room", host: isHost, lastStateAt: 0 });
    const current = this.ctx.getWebSockets().find((ws) => attachment(ws).clientId === clientId);
    if (!current) return response;
    const players = this.roomSockets(roomCode).filter((ws) => ws !== current).map((ws) => ({ playerId: attachment(ws).clientId }));
    send(current, { type: "room_joined", room: roomCode, mode: room.mode, playerId: clientId, isHost, players });
    const lobbyPlayers = this.roomSockets(roomCode).map((ws) => ({ playerId: attachment(ws).clientId }));
    for (const ws of this.roomSockets(roomCode)) {
      if (ws !== current) send(ws, { type: "player_joined", playerId: clientId, mode: room.mode });
      send(ws, { type: "lobby_update", players: lobbyPlayers });
    }
    return response;
  }

  webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > MAX_MESSAGE) {
      try { ws.close(1009, "Message too large"); } catch (_) {}
      return;
    }
    let data;
    try { data = JSON.parse(message); } catch (_) { send(ws, { type: "error", message: "Invalid message JSON." }); return; }
    const a = attachment(ws);
    if (data?.type === "ping") { send(ws, { type: "pong", at: Date.now() }); return; }
    if (!a.roomCode || a.status !== "room") return;
    if (data?.type === "start_game") {
      if (!a.host) { send(ws, { type: "error", message: "Only the host can start this match." }); return; }
      for (const peer of this.roomSockets(a.roomCode)) send(peer, { type: "game_start", room: a.roomCode, mode: a.mode });
      return;
    }
    if (!["state", "shots", "build"].includes(data?.type)) return;
    if (data.type === "state") {
      const now = Date.now();
      if (now - (a.lastStateAt || 0) < 65) return;
      a.lastStateAt = now;
      ws.serializeAttachment(a);
    }
    const packet = { ...data, from: a.clientId };
    for (const peer of this.roomSockets(a.roomCode)) {
      if (peer !== ws) send(peer, packet);
    }
  }

  webSocketClose(ws, code, reason) { this.removeSocket(ws); }
  webSocketError(ws, error) { this.removeSocket(ws); }
  removeSocket(ws) {
    const a = attachment(ws);
    if (!a.roomCode || a.status !== "room") return;
    const roomCode = a.roomCode;
    const remaining = this.roomSockets(roomCode).filter((peer) => peer !== ws);
    for (const peer of remaining) send(peer, { type: "player_left", playerId: a.clientId });
    const room = this.ctx.storage.get("room:" + roomCode);
    if (a.host && remaining.length) {
      const next = remaining[0];
      const nextData = attachment(next);
      nextData.host = true;
      next.serializeAttachment(nextData);
      send(next, { type: "host_changed", playerId: nextData.clientId });
      const currentRoom = this.ctx.storage.get("room:" + roomCode);
      Promise.resolve(currentRoom).then((saved) => {
        if (saved) { saved.hostClientId = nextData.clientId; return this.ctx.storage.put("room:" + roomCode, saved); }
      }).catch(() => {});
    }
    const players = remaining.map((peer) => ({ playerId: attachment(peer).clientId }));
    for (const peer of remaining) send(peer, { type: "lobby_update", players });
  }
}
