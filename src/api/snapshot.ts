import { Stock } from "../types";
import { fetchAllStocks } from "./tsetmc";

// The same JSON file a scheduled GitHub Action writes every ~10 minutes
// during trading hours (see .github/workflows/monitor.yml and
// scripts/monitor.mjs). Reading this is far cheaper and faster than every
// phone hitting TSETMC directly, and it keeps updating even while your own
// phone and laptop are both off - GitHub is doing the fetching, not you.
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/AmirHBozorgmehrian/App-Creation/main/data/latest.json";

interface SnapshotPayload {
  updatedAt: string;
  stocks: Stock[];
}

export async function fetchLatestStocks(): Promise<{ stocks: Stock[]; updatedAt: number }> {
  try {
    const res = await fetch(SNAPSHOT_URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Snapshot request failed: ${res.status}`);
    const json: SnapshotPayload = await res.json();
    if (!Array.isArray(json.stocks) || json.stocks.length === 0) {
      throw new Error("Snapshot was empty");
    }
    return { stocks: json.stocks, updatedAt: new Date(json.updatedAt).getTime() };
  } catch {
    // Snapshot isn't available yet (e.g. before the very first scheduled
    // run has ever completed) - fall back to asking TSETMC directly.
    const stocks = await fetchAllStocks();
    return { stocks, updatedAt: Date.now() };
  }
}
