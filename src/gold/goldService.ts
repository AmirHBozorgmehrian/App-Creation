import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COIN_CATEGORY_ID,
  CatalogItem,
  SwapItem,
  DayPoint,
  DayRef,
  GoldHistory,
  GoldSnapshot,
  USD_ITEM_ID,
  buildSnapshot,
  dayRefFromHistory,
  emptyHistory,
  fetchCatalog,
  fetchHistory,
  fetchOunceUsd,
  fetchOunceCloseRatio,
  fetchPrices,
  iranYmd,
} from "../../shared/gold";

const SNAPSHOT_KEY = "gold:snapshot2";
const HISTORY_KEY = "gold:mggHistory";
const CATALOG_KEY = "gold:catalog";
const REFS_KEY = "gold:dayRefs2"; // v2: refs now carry a buy/sell midpoint
const DAY = 24 * 3600 * 1000;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* caches are best-effort */
  }
}

export const loadCachedSnapshot = () => readJson<GoldSnapshot>(SNAPSHOT_KEY);
export const saveCachedSnapshot = (s: GoldSnapshot) => writeJson(SNAPSHOT_KEY, s);

// The item list (names, ids, boxes) hardly ever changes: refresh it once a day.
async function getCatalog(nowMs: number): Promise<CatalogItem[]> {
  const cached = await readJson<{ at: number; items: CatalogItem[] }>(CATALOG_KEY);
  if (cached && nowMs - cached.at < DAY) return cached.items;
  try {
    const items = await fetchCatalog();
    await writeJson(CATALOG_KEY, { at: nowMs, items });
    return items;
  } catch (e) {
    if (cached) return cached.items; // stale list is better than none
    throw e;
  }
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  });
  await Promise.all(workers);
}

// "Change today" needs yesterday's price for each coin. We read the site's own
// history once per day per item and keep just that one number.
async function getDayRefs(ids: number[], nowMs: number): Promise<Record<number, DayRef | null>> {
  const today = iranYmd(nowMs);
  let store = await readJson<{ ymd: number; refs: Record<number, DayRef | null> }>(REFS_KEY);
  if (!store || store.ymd !== today) store = { ymd: today, refs: {} };
  const missing = ids.filter((id) => !(id in store!.refs));
  if (missing.length) {
    await pool(missing, 6, async (id) => {
      try {
        const pts = await fetchHistory(id, nowMs - 10 * DAY, nowMs);
        store!.refs[id] = dayRefFromHistory(pts, nowMs);
      } catch {
        /* leave it out; it is retried on the next refresh */
      }
    });
    await writeJson(REFS_KEY, store);
  }
  return store.refs;
}

/** Everything the Gold screen and the MGG banner need, fetched by the phone itself. */
export async function fetchGold(prev: GoldSnapshot | null): Promise<GoldSnapshot> {
  const nowMs = Date.now();
  const [catRes, priceRes, onsRes, closeRes] = await Promise.allSettled([getCatalog(nowMs), fetchPrices(), fetchOunceUsd(), fetchOunceCloseRatio()]);

  const catalog = catRes.status === "fulfilled" ? catRes.value : null;
  const prices = priceRes.status === "fulfilled" ? priceRes.value : null;
  const ons = onsRes.status === "fulfilled" ? onsRes.value : null;
  const ounceClose = closeRes.status === "fulfilled" ? closeRes.value : null;
  const msg = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? String((r.reason as any)?.message ?? r.reason) : null);

  if (!prices && !ons) throw new Error(msg(priceRes) ?? msg(onsRes) ?? "Could not load gold prices");

  let dayRefs: Record<number, DayRef | null> = {};
  if (catalog && prices) {
    const wanted = new Set<number>([USD_ITEM_ID]);
    const priced = new Set(prices.filter((p) => p.buy !== null || p.sell !== null).map((p) => p.itemId));
    catalog.forEach((c) => priced.has(c.itemId) && wanted.add(c.itemId));
    dayRefs = await getDayRefs([...wanted], nowMs);
  }

  const { snapshot, history } = buildSnapshot({
    catalog,
    prices,
    catalogError: msg(catRes),
    pricesError: msg(priceRes),
    ons,
    onsError: msg(onsRes),
    ounceClose,
    prev,
    history: (await readJson<GoldHistory>(HISTORY_KEY)) ?? emptyHistory(),
    dayRefs,
    nowMs,
  });
  await writeJson(HISTORY_KEY, history);
  return snapshot;
}

// Chart data for one item and range, cached for 20 minutes.
const memo = new Map<string, { at: number; pts: DayPoint[] }>();
export async function getItemHistory(itemId: number, days: number): Promise<DayPoint[]> {
  const key = `${itemId}:${days}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 20 * 60 * 1000) return hit.pts;
  const now = Date.now();
  const pts = await fetchHistory(itemId, now - days * DAY, now);
  memo.set(key, { at: now, pts });
  return pts;
}

// Light fetch for the background swap check: only the bank-coin prices.
export async function fetchCoinItems(): Promise<SwapItem[]> {
  const nowMs = Date.now();
  const [catalog, prices] = await Promise.all([getCatalog(nowMs), fetchPrices()]);
  const byId = new Map(prices.map((p) => [p.itemId, p]));
  return catalog
    .filter((c) => c.categoryId === COIN_CATEGORY_ID && byId.has(c.itemId))
    .map((c) => ({ id: String(c.itemId), title: c.title, buy: byId.get(c.itemId)!.buy, sell: byId.get(c.itemId)!.sell }));
}
