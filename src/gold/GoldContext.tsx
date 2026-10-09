import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { GoldSnapshot, REFRESH_EVERY_MS, isIranBusinessTime } from "../../shared/gold";
import { fetchGold, loadCachedSnapshot, saveCachedSnapshot } from "./goldService";
import { coinItemsFromSnapshot, onCoinPrices } from "../arbitrage/engine";

interface GoldState {
  snapshot: GoldSnapshot | null;
  source: "direct" | "cache" | null;
  loading: boolean; // nothing to show yet
  refreshing: boolean; // pull-to-refresh spinner
  syncing: boolean; // quiet background refresh
  error: string | null;
  lastFetchAt: number | null;
  refresh: (manual: boolean) => Promise<void>;
}

const Ctx = createContext<GoldState | null>(null);

export function useGold(): GoldState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGold must be used inside <GoldProvider>");
  return v;
}

export function GoldProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<GoldSnapshot | null>(null);
  const [source, setSource] = useState<GoldState["source"]>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchAt, setLastFetchAt] = useState<number | null>(null);

  const snapRef = useRef<GoldSnapshot | null>(null);
  const inFlight = useRef(false);
  const lastFetch = useRef(0);

  const refresh = useCallback(async (manual: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setRefreshing(true);
    else setSyncing(true);
    try {
      const snap = await fetchGold(snapRef.current);
      snapRef.current = snap;
      setSnapshot(snap);
      setSource("direct");
      setError(null);
      lastFetch.current = Date.now();
      setLastFetchAt(lastFetch.current);
      saveCachedSnapshot(snap);
      onCoinPrices(coinItemsFromSnapshot(snap)).catch(() => {}); // save prices + swap alerts
    } catch (e: any) {
      setError(e?.message ?? "Could not refresh gold prices");
    } finally {
      inFlight.current = false;
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    }
  }, []);

  // On start: show the cached snapshot instantly, then refresh quietly.
  useEffect(() => {
    (async () => {
      const cached = await loadCachedSnapshot();
      if (cached) {
        snapRef.current = cached;
        setSnapshot(cached);
        setSource("cache");
        setLoading(false);
      }
      refresh(false);
    })();
  }, [refresh]);

  // Every 30 min while the app is open - only in Iranian business hours.
  useEffect(() => {
    const due = () => isIranBusinessTime(new Date()) && Date.now() - lastFetch.current >= REFRESH_EVERY_MS;
    const timer = setInterval(() => {
      if (due()) refresh(false);
    }, 60 * 1000);
    // JS timers freeze while the app is in the background, so also check on return.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && due()) refresh(false);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  return (
    <Ctx.Provider value={{ snapshot, source, loading, refreshing, syncing, error, lastFetchAt, refresh }}>
      {children}
    </Ctx.Provider>
  );
}
