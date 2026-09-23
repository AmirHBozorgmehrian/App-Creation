export interface Stock {
  insCode: string;
  symbol: string; // short ticker, e.g. فملی
  name: string; // full company name
  lastPrice: number | null;
  closingPrice: number | null;
}
