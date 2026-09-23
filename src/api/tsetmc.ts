import { Stock } from "../types";

/**
 * TSETMC (Tehran Stock Exchange & OTC Market) does not publish an official,
 * documented public API. This URL is the same "market watch" endpoint the
 * official tsetmc.com website itself calls in the browser, and is the same
 * one several open-source community projects (pytse-client, tsetmc-api,
 * oxtapus, etc.) read from. It returns only data that is already publicly
 * displayed on the site - no login, no scraping of private data.
 *
 * If this ever stops working, open https://www.tsetmc.com/ in a browser,
 * open the Network tab, and look for a request to
 * cdn.tsetmc.com/api/ClosingPrice/GetMarketWatch - copy the new URL here.
 */
const MARKET_WATCH_URL =
  "https://cdn.tsetmc.com/api/ClosingPrice/GetMarketWatch" +
  "?market=0&industrialGroup=&paperTypes%5B0%5D=1&paperTypes%5B1%5D=2" +
  "&showTraded=false&withBestLimits=false&hEven=0&RefID=0";

// The response shape/field names are undocumented and have changed before,
// so we read several possible aliases defensively instead of assuming one.
function pick(row: any, ...keys: string[]): any {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return null;
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseRow(row: any): Stock | null {
  const insCode = pick(row, "insCode", "InsCode", "insID");
  const symbol = pick(row, "lva", "lVal18AFC", "symbol");
  const name = pick(row, "lvc", "lVal30", "name");
  if (!insCode || !symbol) return null;

  const lastPrice = toNumber(pick(row, "pDrCotVal", "pdrCotVal", "pl", "last"));
  const closingPrice = toNumber(pick(row, "pClosing", "pcl", "pc", "closing"));
  const priceFirst = toNumber(pick(row, "priceFirst", "pf"));
  const priceYesterday = toNumber(pick(row, "priceYesterday", "py"));
  const dayMin = toNumber(pick(row, "priceMin", "pmin"));
  const dayMax = toNumber(pick(row, "priceMax", "pmax"));
  const tradeVolume = toNumber(pick(row, "qTotTran5J", "tvol", "baseVol"));

  let priceChangePercent: number | null = null;
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

export async function fetchAllStocks(): Promise<Stock[]> {
  const response = await fetch(MARKET_WATCH_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`TSETMC request failed with status ${response.status}`);
  }

  const json = await response.json();

  // The endpoint has been observed returning either a bare array, or an
  // object wrapping the array under a key - handle both.
  const rows: any[] = Array.isArray(json)
    ? json
    : json.marketwatch ?? json.instrumentBests ?? json.data ?? [];

  const stocks = rows
    .map(parseRow)
    .filter((s): s is Stock => s !== null);

  // De-duplicate by insCode just in case, and sort alphabetically by symbol.
  const seen = new Set<string>();
  const unique = stocks.filter((s) => {
    if (seen.has(s.insCode)) return false;
    seen.add(s.insCode);
    return true;
  });

  unique.sort((a, b) => a.symbol.localeCompare(b.symbol, "fa"));
  return unique;
}
