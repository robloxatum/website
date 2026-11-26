// Stand-in for the browsers' push services (Apple/Google/Mozilla/Windows)
// during end-to-end tests. Devices are saved with real push-service URLs
// (https://fcm.googleapis.com/...), as the database requires; E2E builds only
// (E2E_PUSH_SERVICE) deliver them here instead, by path. Tests read what
// arrived from GET /received?path=<endpoint path>.
import { createServer } from "node:http";

/** path → messages received, oldest first. */
const received = new Map();

createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/health") return res.writeHead(200).end("ok");
  if (req.method === "GET" && url.pathname === "/received") {
    const list = received.get(url.searchParams.get("path") ?? "") ?? [];
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(list));
  }
  if (req.method !== "POST") return res.writeHead(405).end();
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const list = received.get(url.pathname) ?? [];
    list.push({ path: url.pathname, headers: req.headers, body: Buffer.concat(chunks).toString("base64") });
    received.set(url.pathname, list);
    // A device that's gone (notifications turned off, app deleted).
    res.writeHead(url.pathname.includes("/e2e-gone-") ? 410 : 201).end();
  });
}).listen(3298, "127.0.0.1");
