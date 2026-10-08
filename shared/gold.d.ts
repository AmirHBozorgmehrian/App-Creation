export interface Change { abs: number; pct: number; since: number }

export interface GoldItem {
  id: string;
  title: string;
  buy: number | null;
  sell: number | null;
  siteChange: string | null; // raw text of the site's own "change" cell
  chartUrl: string | null; // the site's own chart link, if one was found
  chartImage: string | null; // chart picture used by the site, if it is a plain image
  change: Change | null; // change since the last Iranian business day close
}

export interface GoldSection { title: string; siteTime: string | null; items: GoldItem[] }

export interface UsdRate { buy: number | null; sell: number | null; toman: number; rial: number; stale: boolean }

export interface Mgg {
  usd: number;
  rial: number | null;
  usdChange: Change | null;
  rialChange: Change | null;
  stale: boolean;
}

export interface GoldSnapshot {
  v: number;
  generatedAt: string;
  source: "action" | "direct";
  unit: "toman";
  sarafi: { ok: boolean; rows: number; error: string | null; lastOkAt: string | null };
  onsError: string | null;
  ons: { usd: number; source: string; stale: boolean } | null;
  usdRate: UsdRate | null;
  mgg: Mgg | null;
  sections: GoldSection[];
  currencySections: GoldSection[];
}

export interface GoldHistory {
  v: number;
  keys: string[];
  points: [number, number | null, number | null, (number | null)[]][];
}

export const SITE_URL: string;
export const MG_PER_TROY_OUNCE: number;
export const REFRESH_EVERY_MS: number;
export function isIranBusinessTime(date: Date | number): boolean;
export function iranDayStart(ms: number): number;
export function fetchWithTimeout(url: string, opts?: RequestInit, ms?: number): Promise<Response>;
export function fetchOunceUsd(): Promise<{ usd: number; source: string; stale: boolean }>;
export function emptyHistory(): GoldHistory;
export function buildSnapshot(args: {
  html?: string | null;
  htmlError?: string | null;
  ons?: { usd: number; source: string } | null;
  onsError?: string | null;
  prev?: GoldSnapshot | null;
  history?: GoldHistory | null;
  nowMs: number;
  source?: "action" | "direct";
}): { snapshot: GoldSnapshot; history: GoldHistory };
