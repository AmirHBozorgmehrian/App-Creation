import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoldHistory,
  GoldSnapshot,
  SITE_URL,
  buildSnapshot,
  emptyHistory,
  fetchOunceUsd,
  fetchWithTimeout,
} from "../../shared/gold";

const SNAPSHOT_KEY = "gold:snapshot";
const HISTORY_KEY = "gold:localHistory";

export async function loadCachedSnapshot(): Promise<GoldSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as GoldSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveCachedSnapshot(s: GoldSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* cache is best-effort */
  }
}

export async function getHistory(): Promise<GoldHistory> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GoldHistory) : emptyHistory();
  } catch {
    return emptyHistory();
  }
}

/**
 * Everything is fetched by the phone itself: sarafiyaran.com for the gold
 * list + USD rate, and a public JSON API for the world gold price. History
 * (for trends and charts) is kept on the phone, so it only grows while the
 * app is being used. Whatever fails keeps its last value, flagged stale.
 */
export async function fetchGold(prev: GoldSnapshot | null): Promise<GoldSnapshot> {
  const [htmlRes, onsRes] = await Promise.allSettled([
    (async () => {
      const res = await fetchWithTimeout(SITE_URL, { headers: { Accept: "text/html" } }, 20000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    })(),
    fetchOunceUsd(),
  ]);

  const html = htmlRes.status === "fulfilled" ? htmlRes.value : null;
  const htmlError = htmlRes.status === "rejected" ? String((htmlRes.reason as any)?.message ?? htmlRes.reason) : null;
  const ons = onsRes.status === "fulfilled" ? onsRes.value : null;
  const onsError = onsRes.status === "rejected" ? String((onsRes.reason as any)?.message ?? onsRes.reason) : null;

  if (!html && !ons) throw new Error(htmlError ?? onsError ?? "Could not load gold prices");

  const { snapshot, history } = buildSnapshot({
    html,
    htmlError,
    ons,
    onsError,
    prev,
    history: await getHistory(),
    nowMs: Date.now(),
    source: "direct",
  });
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
  return snapshot;
}
