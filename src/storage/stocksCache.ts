import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stock } from "../types";

const KEY = "stocks:cache";

interface CachePayload {
  data: Stock[];
  updatedAt: number; // ms since epoch
}

export async function loadStocksCache(): Promise<CachePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }
}

export async function saveStocksCache(data: Stock[]): Promise<void> {
  const payload: CachePayload = { data, updatedAt: Date.now() };
  await AsyncStorage.setItem(KEY, JSON.stringify(payload));
}
