export interface Stock {
  insCode: string;
  symbol: string; // short ticker, e.g. فملی
  name: string; // full company name
  lastPrice: number | null; // most recent trade price
  closingPrice: number | null; // official closing price
  priceChangePercent: number | null; // % change vs previous close
  dayMin: number | null;
  dayMax: number | null;
  tradeVolume: number | null; // number of shares traded today
}
