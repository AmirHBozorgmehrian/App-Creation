import { colors } from "../theme";

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtUsd(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return "$" + n.toFixed(digits);
}

export function fmtPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return "—";
  return (p > 0 ? "+" : "") + p.toFixed(2) + "%";
}

export function trendColor(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p) || Math.abs(p) < 0.005) return colors.textMuted;
  return p > 0 ? colors.positive : colors.negative;
}

export function arrow(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p) || Math.abs(p) < 0.005) return "–";
  return p > 0 ? "▲" : "▼";
}

export function timeAgo(ms: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
