// Stand-in for Roblox's public APIs during end-to-end tests (the app only uses
// it in E2E builds, via E2E_ROBLOX_API). Known users: builderman, e2e_player.
import { createServer } from "node:http";

const USERS = {
  builderman: { id: 156, name: "builderman", displayName: "Builderman" },
  e2e_player: { id: 4242, name: "e2e_player", displayName: "E2E Player" },
};

createServer((req, res) => {
  const send = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/users/v1/usernames/users") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const { usernames = [] } = JSON.parse(raw || "{}");
      const data = usernames
        .map((u) => USERS[String(u).toLowerCase()] && { requestedUsername: u, ...USERS[String(u).toLowerCase()] })
        .filter(Boolean);
      send(200, { data });
    });
    return;
  }
  if (url.pathname === "/thumbnails/v1/users/avatar-headshot") {
    const ids = (url.searchParams.get("userIds") ?? "").split(",").filter(Boolean).map(Number);
    return send(200, { data: ids.map((id) => ({ targetId: id, state: "Completed", imageUrl: `https://tr.rbxcdn.com/e2e/${id}.webp` })) });
  }
  if (url.pathname === "/health") return send(200, { ok: true });
  send(404, {});
}).listen(3299, "127.0.0.1");
