import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CategoryPair, CoinCategory } from "../../shared/gold";

export interface ArbSettings {
  enabled: boolean; // send notifications
  have: string[]; // coin ids I can sell
  want: string[]; // coin ids I would buy
  thresholdPct: number; // minimum profit, % of the money received
  pairs: CategoryPair[]; // allowed swap types, either direction; unfinished/empty = no restriction
}

const CATS: CoinCategory[] = ["emami86", "bahar", "pre86", "gram"];
const cleanCat = (x: any): CoinCategory | null => (CATS.includes(x) ? x : null);

export const DEFAULT_SETTINGS: ArbSettings = { enabled: false, have: [], want: [], thresholdPct: 5, pairs: [[null, null]] };
const KEY = "arb:settings";

export async function loadSettings(): Promise<ArbSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const j = JSON.parse(raw);
    return {
      enabled: !!j.enabled,
      have: Array.isArray(j.have) ? j.have.map(String) : [],
      want: Array.isArray(j.want) ? j.want.map(String) : [],
      thresholdPct: Number.isFinite(j.thresholdPct) && j.thresholdPct > 0 ? j.thresholdPct : DEFAULT_SETTINGS.thresholdPct,
      pairs: Array.isArray(j.pairs) && j.pairs.length ? j.pairs.map((p: any) => [cleanCat(p?.[0]), cleanCat(p?.[1])] as CategoryPair) : DEFAULT_SETTINGS.pairs,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: ArbSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* best effort */
  }
}

export function useArbSettings() {
  const [settings, setSettings] = useState<ArbSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const ref = useRef<ArbSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then((s) => {
      ref.current = s;
      setSettings(s);
      setReady(true);
    });
  }, []);

  const update = useCallback((patch: Partial<ArbSettings>) => {
    const next = { ...ref.current, ...patch };
    ref.current = next;
    setSettings(next);
    saveSettings(next);
  }, []);

  return { settings, update, ready };
}
