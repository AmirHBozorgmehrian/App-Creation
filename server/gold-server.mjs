// Tiny always-on server for an Iranian VPS (e.g. ArvanCloud). No dependencies.
//   - every 30 min during Iranian business hours it fetches sarafiyaran.com +
//     the world gold price, builds the snapshot (shared/gold.js) and saves it
//   - serves  /gold.json  /gold-history.json  /health  for the phone app
// Run:  node server/gold-server.mjs      (Node 18+)
import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import gold from "../shared/gold.js";

const { buildSnapshot, fetchOunceUsd, fetchWithTimeout, isIranBusinessTime, SITE_URL, REFRESH_EVERY_MS } = gold;

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), "data");
const SNAP = join(DATA_DIR, "gold.json");
const HIST = join(DATA_DIR, "gold-history.json");

let lastRun = 0;
let running = false;

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function runOnce() {
  if (running) return;
  running = true;
  const nowMs = Date.now();
  try {
    let html = null, htmlError = null, ons = null, onsError = null;
    try {
      const res = await fetchWithTimeout(
        SITE_URL,
        { headers: { "User-Agent": "gold-server/1.0 (personal use, 1 request / 30 min)", Accept: "text/html" } },
        25000
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      htmlError = String(e?.message ?? e);
    }
    try {
      ons = await fetchOunceUsd();
    } catch (e) {
      onsError = String(e?.message ?? e);
    }
    if (!html && !ons) {
      console.error(new Date().toISOString(), "nothing fetched:", htmlError, "|", onsError);
      return;
    }
    const prev = await readJson(SNAP, null);
    const history = await readJson(HIST, null);
    const r = buildSnapshot({ html, htmlError, ons, onsError, prev, history, nowMs, source: "action" });
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SNAP, JSON.stringify(r.snapshot));
    await writeFile(HIST, JSON.stringify(r.history));
    if (html && r.snapshot.sarafi.rows === 0) await writeFile(join(DATA_DIR, "sarafiyaran-last.html"), html);
    lastRun = nowMs;
    console.log(
      new Date().toISOString(),
      `sarafi=${r.snapshot.sarafi.ok}(${r.snapshot.sarafi.rows}) ons=${r.snapshot.ons?.usd ?? "n/a"} points=${r.history.points.length}`,
      onsError ? `| ons error: ${onsError}` : "",
      htmlError ? `| site error: ${htmlError}` : ""
    );
  } finally {
    running = false;
  }
}

// Check every minute; fetch when due and inside business hours.
setInterval(() => {
  if (isIranBusinessTime(new Date()) && Date.now() - lastRun >= REFRESH_EVERY_MS - 30000) runOnce();
}, 60 * 1000);
runOnce(); // once at startup so there is always a file to serve

http
  .createServer(async (req, res) => {
    const path = (req.url || "/").split("?")[0];
    const files = { "/gold.json": SNAP, "/gold-history.json": HIST };
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (path === "/health") {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({ ok: true, lastRun: lastRun ? new Date(lastRun).toISOString() : null }));
    }
    if (files[path]) {
      try {
        const body = await readFile(files[path]);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.end(body);
      } catch {
        res.statusCode = 503;
        return res.end("no data yet");
      }
    }
    res.statusCode = 404;
    res.end("not found");
  })
  .listen(PORT, () => console.log("gold-server listening on", PORT));
