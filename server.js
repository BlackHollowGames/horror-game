// THE SEEKER multiplayer room server
// Requires Node.js and the "ws" package. This is a prototype relay server,
// not a production anti-cheat or secure matchmaking service.
const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml"
};
const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  const fullPath = path.normalize(path.join(ROOT, pathname));
  if (!fullPath.startsWith(ROOT)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404, {"Content-Type":"text/plain"}); res.end("Not found"); return; }
    res.writeHead(200, {"Content-Type": MIME[path.extname(fullPath)] || "application/octet-stream", "Cache-Control":"no-cache"});
    res.end(data);
  });
});
const wss = new WebSocket.Server({ server });
const rooms = new Map();
const clients = new Map();

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function roomPlayers(room) {
  const members = rooms.get(room) || new Set();
  return [...members].map(ws => {
    const c = clients.get(ws);
    return c ? { id: c.id, name: c.name } : null;
  }).filter(Boolean);
}
function broadcastRoom(room, payload, except = null) {
  for (const ws of rooms.get(room) || []) if (ws !== except) send(ws, payload);
}
function leave(ws) {
  const client = clients.get(ws);
  if (!client) return;
  const members = rooms.get(client.room);
  if (members) {
    members.delete(ws);
    broadcastRoom(client.room, { type: "player-left", id: client.id });
    broadcastRoom(client.room, { type: "players", players: roomPlayers(client.room) });
    if (!members.size) rooms.delete(client.room);
  }
  clients.delete(ws);
}
wss.on("connection", ws => {
  clients.set(ws, { id: "", name: "Player", room: "" });
  send(ws, { type: "notice", message: "Connected to THE SEEKER room server." });
  ws.on("message", raw => {
    if (raw.length > 4096) return;
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    const client = clients.get(ws);
    if (!client) return;
    if (msg.type === "join") {
      leave(ws);
      const room = String(msg.room || "NIGHT").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,8) || "NIGHT";
      client.id = String(msg.id || Math.random().toString(36).slice(2));
      client.name = String(msg.name || "Player").replace(/[<>]/g, "").slice(0,18) || "Player";
      client.room = room;
      if (!rooms.has(room)) rooms.set(room, new Set());
      const members = rooms.get(room);
      if (members.size >= 8) { send(ws, { type:"error", message:"That room is full (8 players maximum)." }); client.room = ""; return; }
      members.add(ws);
      send(ws, { type: "joined", room, players: roomPlayers(room) });
      broadcastRoom(room, { type: "players", players: roomPlayers(room) });
      broadcastRoom(room, { type: "notice", message: `${client.name} entered the facility.` }, ws);
    } else if (msg.type === "state") {
      if (!client.room || msg.room !== client.room || !msg.state) return;
      const s = msg.state;
      if (![s.x,s.z,s.yaw].every(Number.isFinite)) return;
      broadcastRoom(client.room, { type:"state", id:client.id, state:{x:s.x,z:s.z,yaw:s.yaw} }, ws);
    }
  });
  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});
server.listen(PORT, "0.0.0.0", () => {
  console.log(`THE SEEKER server running at http://localhost:${PORT}`);
  console.log(`Room server supports up to 8 players per room.`);
});
