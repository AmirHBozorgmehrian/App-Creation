import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORIES, COIN_CATEGORY_ID, GoldSnapshot, PriceSample, Swap, SwapItem, findSwaps, splitSwaps } from "../../shared/gold";
import { ArbSettings, loadSettings } from "./settings";
import { sendSummaryNotification, sendSwapNotification } from "./notify";

const NOTIFIED_KEY = "arb:notified";
const RENOTIFY_MS = 3 * 60 * 60 * 1000; // same swap: remind at most every 3 h...
const RENOTIFY_GAIN_PCT = 1; // ...unless it got 1 percentage point better
const MAX_INDIVIDUAL = 3;

type Notified = Record<string, { pct: number; at: number }>;

/** The bank-coin rows of a snapshot, in the shape the swap finder needs. */
export function coinItemsFromSnapshot(snap: GoldSnapshot | null): SwapItem[] {
  if (!snap) return [];
  const title = CATEGORIES[COIN_CATEGORY_ID].title;
  const sec = snap.sections.find((s) => s.title === title);
  return (sec?.items ?? []).map((i) => ({ id: i.id, title: i.title, buy: i.buy, sell: i.sell }));
}

async function readNotified(): Promise<Notified> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    return raw ? (JSON.parse(raw) as Notified) : {};
  } catch {
    return {};
  }
}

/**
 * Finds swaps above the threshold and notifies about the new ones.
 * A swap that disappears is forgotten, so it notifies again if it comes back.
 */
export async function checkAndNotify(items: SwapItem[], settings?: ArbSettings): Promise<Swap[]> {
  const s = settings ?? (await loadSettings());
  if (!s.enabled || !s.have.length || !s.want.length) return [];

  const all = findSwaps(items, { have: s.have, want: s.want, pairs: s.pairs });
  const { up, down } = splitSwaps(all, { minProfitPct: s.thresholdPct, maxLossPct: s.maxLossPct });
  const hits = [...(s.notifyUp ? up : []), ...(s.notifyDown ? down : [])].sort((a, b) => b.pct - a.pct);
  const prev = await readNotified();
  const now = Date.now();
  const next: Notified = {};
  const fresh: Swap[] = [];

  for (const h of hits) {
    const p = prev[h.key];
    if (!p || now - p.at >= RENOTIFY_MS || h.pct >= p.pct + RENOTIFY_GAIN_PCT) {
      fresh.push(h);
      next[h.key] = { pct: h.pct, at: now };
    } else {
      next[h.key] = p;
    }
  }
  try {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(next));
  } catch {
    /* best effort */
  }

  if (fresh.length > MAX_INDIVIDUAL) await sendSummaryNotification(fresh.length, fresh[0]);
  else for (const f of fresh) await sendSwapNotification(f);
  return hits;
}

// ---- saved coin prices, so each swap can show its trend vs ~2 h ago ----
const HISTORY_KEY = "arb:coinHistory";
const HISTORY_KEEP_MS = 6 * 60 * 60 * 1000;
const HISTORY_MIN_GAP_MS = 10 * 60 * 1000;

export async function loadPriceHistory(): Promise<PriceSample[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as PriceSample[]) : [];
  } catch {
    return [];
  }
}

export async function recordCoinPrices(items: SwapItem[]): Promise<void> {
  if (!items.length) return;
  const hist = await loadPriceHistory();
  const now = Date.now();
  const last = hist[hist.length - 1];
  if (last && now - last.t < HISTORY_MIN_GAP_MS) return;
  const p: PriceSample["p"] = {};
  items.forEach((i) => (p[i.id] = [i.buy, i.sell]));
  const next = [...hist, { t: now, p }].filter((h) => now - h.t <= HISTORY_KEEP_MS).slice(-48);
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* best effort */
  }
}

/** Call with fresh coin prices (app refresh or background run): saves them, then checks for swaps. */
export async function onCoinPrices(items: SwapItem[]): Promise<Swap[]> {
  await recordCoinPrices(items).catch(() => {});
  return checkAndNotify(items);
}
