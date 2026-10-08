export interface Change { abs: number; pct: number; since: number | null }

export interface GoldItem {
  id: string;
  itemId: number; // the site's own id for this coin / bar / currency
  title: string;
  unit: string;
  buy: number | null;
  sell: number | null;
  change: Change | null; // vs the last recorded day before today (site history)
  modifiedOn: string | null;
}

export interface GoldSection { title: string; items: GoldItem[] }

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
  source: "direct";
  unit: "toman";
  sarafi: { ok: boolean; rows: number; error: string | null; priceTime: string | null; lastOkAt: string | null };
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

export interface CatalogItem { itemId: number; categoryId: number; title: string; unit: string; sortOrder: number }
export interface PriceRow { itemId: number; buy: number | null; sell: number | null; modifiedOn: string | null }
export interface DayPoint { ymd: number; buy: number | null; sell: number | null }
export interface DayRef { v: number; ymd: number }

export const USD_ITEM_ID: number;
export const MG_PER_TROY_OUNCE: number;
export const REFRESH_EVERY_MS: number;
export function isIranBusinessTime(date: Date | number): boolean;
export function iranDayStart(ms: number): number;
export function iranYmd(ms: number): number;
export function formatJalaliYmd(ymd: number): string;
export function formatJalaliIso(iso: string): string;
export function fetchWithTimeout(url: string, opts?: RequestInit, ms?: number): Promise<Response>;
export function fetchCatalog(): Promise<CatalogItem[]>;
export function fetchPrices(): Promise<PriceRow[]>;
export function fetchHistory(itemId: number, fromMs: number, toMs: number): Promise<DayPoint[]>;
export function dayRefFromHistory(points: DayPoint[], nowMs: number): DayRef | null;
export function fetchOunceUsd(): Promise<{ usd: number; source: string; stale: boolean }>;
export function emptyHistory(): GoldHistory;
export function buildSnapshot(args: {
  catalog?: CatalogItem[] | null;
  prices?: PriceRow[] | null;
  catalogError?: string | null;
  pricesError?: string | null;
  ons?: { usd: number; source: string } | null;
  onsError?: string | null;
  prev?: GoldSnapshot | null;
  history?: GoldHistory | null;
  dayRefs?: Record<number, DayRef | null>;
  nowMs: number;
}): { snapshot: GoldSnapshot; history: GoldHistory };
