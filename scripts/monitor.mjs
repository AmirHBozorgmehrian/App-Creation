// Runs on a GitHub Actions schedule (see .github/workflows/monitor.yml).
// Fetches the current TSETMC market watch snapshot and writes it to
// data/latest.json, which the app reads directly from GitHub - no server,
// no phone/laptop needed to keep this running.
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { sendPushToTokens } from "./fcm.mjs";

const ALERT_THRESHOLD_PERCENT = -1; // notify when a followed stock drops this much or more

const MARKET_WATCH_URL =
  "https://cdn.tsetmc.com/api/ClosingPrice/GetMarketWatch" +
  "?market=0&industrialGroup=&paperTypes%5B0%5D=1&paperTypes%5B1%5D=2" +
  "&showTraded=false&withBestLimits=false&hEven=0&RefID=0";

function pick(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRow(row) {
  const insCode = pick(row, "insCode", "InsCode", "insID");
  const symbol = pick(row, "lva", "lVal18AFC", "symbol");
  const name = pick(row, "lvc", "lVal30", "name");
  if (!insCode || !symbol) return null;

  const lastPrice = toNumber(pick(row, "pDrCotVal", "pdrCotVal", "pl", "last"));
  const closingPrice = toNumber(pick(row, "pClosing", "pcl", "pc", "closing"));
  const priceYesterday = toNumber(pick(row, "priceYesterday", "py"));
  const dayMin = toNumber(pick(row, "priceMin", "pmin"));
  const dayMax = toNumber(pick(row, "priceMax", "pmax"));
  const tradeVolume = toNumber(pick(row, "qTotTran5J", "tvol", "baseVol"));

  let priceChangePercent = null;
  const basis = closingPrice ?? priceYesterday;
  if (lastPrice !== null && basis) {
    priceChangePercent = ((lastPrice - basis) / basis) * 100;
  }

  return {
    insCode: String(insCode),
    symbol: String(symbol).trim(),
    name: name ? String(name).trim() : String(symbol).trim(),
    lastPrice,
    closingPrice,
    priceChangePercent,
    dayMin,
    dayMax,
    tradeVolume,
  };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function checkAndSendAlerts(stocks) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.log("No FIREBASE_SERVICE_ACCOUNT_JSON secret set - skipping alert check.");
    return;
  }

  const followings = await readJson("data/followings.json", { insCodes: [] });
  const tokensFile = await readJson("data/push-tokens.json", { tokens: [] });
  const today = new Date().toISOString().slice(0, 10); // UTC date is fine here -
  // the whole trading window falls inside one UTC day.
  const alertState = await readJson("data/alert-state.json", { date: today, alerted: [] });
  if (alertState.date !== today) {
    alertState.date = today;
    alertState.alerted = [];
  }

  const followedSet = new Set(followings.insCodes ?? []);
  const alreadyAlerted = new Set(alertState.alerted ?? []);
  const newAlerts = [];

  for (const stock of stocks) {
    if (!followedSet.has(stock.insCode)) continue;
    if (alreadyAlerted.has(stock.insCode)) continue;
    if (
      stock.priceChangePercent !== null &&
      stock.priceChangePercent <= ALERT_THRESHOLD_PERCENT
    ) {
      newAlerts.push(stock);
    }
  }

  if (newAlerts.length > 0 && tokensFile.tokens?.length > 0) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    for (const stock of newAlerts) {
      await sendPushToTokens(serviceAccount, tokensFile.tokens, {
        title: `${stock.symbol} is down ${Math.abs(stock.priceChangePercent).toFixed(1)}%`,
        body: `${stock.name} dropped to ${stock.lastPrice?.toLocaleString() ?? "?"}`,
      });
      alertState.alerted.push(stock.insCode);
    }
    await writeFile("data/alert-state.json", JSON.stringify(alertState, null, 2));
    console.log(`Sent ${newAlerts.length} alert(s).`);
  } else if (alertState.date !== undefined) {
    // Still persist the (possibly just-reset) date so tomorrow starts clean.
    await writeFile("data/alert-state.json", JSON.stringify(alertState, null, 2));
  }
}

async function main() {
  const res = await fetch(MARKET_WATCH_URL, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`TSETMC request failed: ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json) ? json : json.marketwatch ?? json.instrumentBests ?? json.data ?? [];

  const stocks = rows.map(parseRow).filter(Boolean);
  const seen = new Set();
  const unique = stocks.filter((s) => {
    if (seen.has(s.insCode)) return false;
    seen.add(s.insCode);
    return true;
  });
  unique.sort((a, b) => a.symbol.localeCompare(b.symbol, "fa"));

  await mkdir("data", { recursive: true });
  await writeFile(
    "data/latest.json",
    JSON.stringify({ updatedAt: new Date().toISOString(), stocks: unique }, null, 2)
  );

  console.log(`Wrote ${unique.length} stocks to data/latest.json`);

  await checkAndSendAlerts(unique);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
