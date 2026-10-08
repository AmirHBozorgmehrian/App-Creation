import { Stock } from "../types";
import { fetchAllStocks } from "./tsetmc";

// The phone asks TSETMC itself - no GitHub snapshot involved any more.
export async function fetchLatestStocks(): Promise<{ stocks: Stock[]; updatedAt: number }> {
  const stocks = await fetchAllStocks();
  return { stocks, updatedAt: Date.now() };
}
