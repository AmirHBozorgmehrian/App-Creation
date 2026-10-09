import AsyncStorage from "@react-native-async-storage/async-storage";
import { CATEGORIES, COIN_CATEGORY_ID, GoldSnapshot, Swap, SwapItem, findSwaps } from "../../shared/gold";
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

  const hits = findSwaps(items, { have: s.have, want: s.want, pairs: s.pairs }).filter((x) => x.pct >= s.thresholdPct);
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
