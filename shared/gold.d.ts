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
  ref: { kind: "close" | "phone"; ymd: number | null; t: number | null } | null;
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
export interface DayRef { v: number; mid?: number; ymd: number }

export const USD_ITEM_ID: number;
export const TOMAN_TO_RIAL: number;
export const MG_PER_TROY_OUNCE: number;
export const REFRESH_EVERY_MS: number;
export function isIranBusinessTime(date: Date | number): boolean;
export function iranDayStart(ms: number): number;
export function iranYmd(ms: number): number;
export function formatJalaliYmd(ymd: number): string;
export function formatJalaliMs(ms: number): string;
export function formatJalaliIso(iso: string): string;
export function fetchWithTimeout(url: string, opts?: RequestInit, ms?: number): Promise<Response>;
export function fetchCatalog(): Promise<CatalogItem[]>;
export function fetchPrices(): Promise<PriceRow[]>;
export function fetchHistory(itemId: number, fromMs: number, toMs: number): Promise<DayPoint[]>;
export function dayRefFromHistory(points: DayPoint[], nowMs: number): DayRef | null;
export function fetchOunceCloseRatio(): Promise<{ ratio: number; source: string } | null>;
export function fetchOunceUsd(): Promise<{ usd: number; source: string; stale: boolean }>;
export function emptyHistory(): GoldHistory;
export function buildSnapshot(args: {
  catalog?: CatalogItem[] | null;
  prices?: PriceRow[] | null;
  catalogError?: string | null;
  pricesError?: string | null;
  ons?: { usd: number; source: string } | null;
  onsError?: string | null;
  ounceClose?: { ratio: number; source: string } | null;
  prev?: GoldSnapshot | null;
  history?: GoldHistory | null;
  dayRefs?: Record<number, DayRef | null>;
  nowMs: number;
}): { snapshot: GoldSnapshot; history: GoldHistory };

export interface SwapItem { id: string; title: string; buy: number | null; sell: number | null }
export interface Swap {
  key: string;
  sellId: string; sellTitle: string; sellCount: number; sellUnit: number; proceeds: number;
  buyId: string; buyTitle: string; buyCount: number; buyUnit: number; cost: number;
  profit: number; pct: number; grams: number;
  dir: SwapDirection;
}
export type SwapDirection = "up" | "down" | "same";
export type DirectionFilter = SwapDirection | "both";
export interface PriceSample { t: number; p: Record<string, [number | null, number | null]> }
export interface SwapTrend { prevPct: number; delta: number; dir: 1 | 0 | -1 }
export function swapTrend(sw: Swap, history: PriceSample[], nowMs: number): SwapTrend | null;
export const COIN_CATEGORY_ID: number;
export const COIN_GRAMS: Record<string, number>;
export const CATEGORIES: Record<number, { title: string; gold: boolean; order: number }>;
export function coinSpec(title: string): { size: string; kind: string; grams: number } | null;
export type CoinCategory = "emami86" | "bahar" | "pre86" | "gram";
export type CategoryPair = [CoinCategory | null, CoinCategory | null];
export function coinCategory(title: string): CoinCategory | null;
export function findSwaps(items: SwapItem[], opts: { have: string[]; want: string[]; pairs?: CategoryPair[]; direction?: DirectionFilter }): Swap[];
export function splitSwaps(swaps: Swap[], o: { minProfitPct: number; maxLossPct: number }): { up: Swap[]; down: Swap[] };
export function swapTone(pct: number): "green" | "red" | "grey";
