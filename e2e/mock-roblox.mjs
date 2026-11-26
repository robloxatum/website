// Stand-in for Roblox's public APIs during end-to-end tests (the app only uses
// it in E2E builds, via E2E_ROBLOX_API). Known users: builderman, e2e_player and
// three of the four founders.
import { createServer } from "node:http";

const USERS = {
  builderman: { id: 156, name: "builderman", displayName: "Builderman" },
  e2e_player: { id: 4242, name: "e2e_player", displayName: "E2E Player" },
  // Founders on /about (src/content/founders.ts). noblemaxx is left out on
  // purpose: an unknown user, so the page's initials fallback is tested.
  vaillex: { id: 9001, name: "vaillex", displayName: "vaillex" },
  yayy_drpepper: { id: 9002, name: "yayy_drpepper", displayName: "yayy_drpepper" },
  finestbuilds: { id: 9003, name: "FinestBuilds", displayName: "FinestBuilds" },
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
  // Headshots and full-body avatars (".../full/<id>.webp", so tests can tell them apart).
  if (url.pathname === "/thumbnails/v1/users/avatar-headshot" || url.pathname === "/thumbnails/v1/users/avatar") {
    const kind = url.pathname.endsWith("/avatar") ? "full/" : "";
    const ids = (url.searchParams.get("userIds") ?? "").split(",").filter(Boolean).map(Number);
    return send(200, { data: ids.map((id) => ({ targetId: id, state: "Completed", imageUrl: `https://tr.rbxcdn.com/e2e/${kind}${id}.webp` })) });
  }
  if (url.pathname === "/health") return send(200, { ok: true });
  send(404, {});
}).listen(3299, "127.0.0.1");
