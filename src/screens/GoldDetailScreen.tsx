import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import MiniChart from "../components/MiniChart";
import { DayPoint, GoldItem, formatJalaliYmd } from "../../shared/gold";
import { getItemHistory } from "../gold/goldService";
import { arrow, fmtInt, fmtPct, trendColor } from "../utils/format";

// Same five ranges the site offers.
const RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

export default function GoldDetailScreen({ item, sectionTitle, onBack }: { item: GoldItem; sectionTitle: string; onBack: () => void }) {
  const [range, setRange] = useState(1);
  const [pts, setPts] = useState<DayPoint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPts(null);
    setErr(null);
    getItemHistory(item.itemId, RANGES[range].days)
      .then((p) => alive && setPts(p))
      .catch((e) => alive && setErr(e?.message ?? "Could not load the chart"));
    return () => {
      alive = false;
    };
  }, [item.itemId, range]);

  const stats = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    const sells = pts.map((p) => p.sell ?? p.buy ?? 0);
    const first = sells[0];
    const last = sells[sells.length - 1];
    return { low: Math.min(...sells), high: Math.max(...sells), pct: ((last - first) / first) * 100 };
  }, [pts]);

  const pct = item.change?.pct ?? null;
  const hasBuy = !!pts && pts.some((p) => p.buy !== null);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={2}>{item.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.section}>{sectionTitle} · prices in Toman{item.unit ? ` · per ${item.unit}` : ""}</Text>

        <View style={styles.card}>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Text style={styles.k}>Sell</Text>
              <Text style={styles.v}>{fmtInt(item.sell)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.k}>Buy</Text>
              <Text style={styles.v}>{fmtInt(item.buy)}</Text>
            </View>
          </View>
          <Text style={[styles.trend, { color: trendColor(pct) }]}>
            {arrow(pct)} {fmtPct(pct)}
            {item.change ? `  (${item.change.abs > 0 ? "+" : ""}${fmtInt(item.change.abs)})` : ""}
          </Text>
          <Text style={styles.small}>vs the site's last recorded day before today</Text>
        </View>

        <View style={styles.rangeRow}>
          {RANGES.map((r, i) => (
            <TouchableOpacity key={r.label} style={[styles.chip, i === range && styles.chipOn]} onPress={() => setRange(i)}>
              <Text style={[styles.chipText, i === range && { color: colors.text }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {err ? (
          <Text style={styles.warn}>{err}</Text>
        ) : !pts ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : pts.length < 2 ? (
          <Text style={styles.small}>The site has no price history for this range.</Text>
        ) : (
          <>
            <MiniChart
              series={[
                { values: pts.map((p) => p.sell), color: colors.primary },
                ...(hasBuy ? [{ values: pts.map((p) => p.buy), color: colors.textMuted }] : []),
              ]}
              startLabel={formatJalaliYmd(pts[0].ymd)}
              endLabel={formatJalaliYmd(pts[pts.length - 1].ymd)}
            />
            <Text style={styles.small}>
              Line: sell{hasBuy ? " (blue) and buy (grey)" : ""} · closed days skipped
              {stats ? `\nRange: low ${fmtInt(stats.low)} · high ${fmtInt(stats.high)} · ${fmtPct(stats.pct)} over the period` : ""}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  back: { color: colors.text, fontSize: 34, lineHeight: 34, marginRight: 12 },
  header: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
  section: { color: colors.textMuted, fontSize: 12, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, marginBottom: 14 },
  pair: { flexDirection: "row" },
  k: { color: colors.textMuted, fontSize: 12 },
  v: { color: colors.text, fontSize: 20, fontWeight: "700", marginTop: 2 },
  trend: { fontSize: 15, fontWeight: "700", marginTop: 12 },
  small: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  warn: { color: colors.negative, fontSize: 12, marginTop: 10 },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
});
