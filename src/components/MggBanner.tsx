import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import { useGold } from "../gold/GoldContext";
import { TOMAN_TO_RIAL } from "../../shared/gold";
import { arrow, fmtInt, fmtPct, fmtUsd, timeAgo, trendColor } from "../utils/format";

export default function MggBanner() {
  const { snapshot, loading, lastFetchAt, syncing } = useGold();
  const mgg = snapshot?.mgg ?? null;
  const toman = mgg?.rial != null ? mgg.rial / TOMAN_TO_RIAL : null;

  // re-render every 30 s so "updated 5m ago" keeps counting
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const updated = syncing ? "Updating…" : lastFetchAt ? `Updated ${timeAgo(lastFetchAt)}` : "";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>1 Milligram Gold</Text>
      {!mgg ? (
        <Text style={styles.muted}>{loading ? "Loading…" : "World gold price unavailable"}</Text>
      ) : (
        <View style={styles.valuesRow}>
          <View style={styles.col}>
            <Text style={styles.value}>
              {fmtUsd(mgg.usd)}
              <Text style={styles.unit}> USD</Text>
            </Text>
            <Text style={[styles.trend, { color: trendColor(mgg.usdChange?.pct) }]}>
              {arrow(mgg.usdChange?.pct)} {fmtPct(mgg.usdChange?.pct)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.col}>
            <Text style={styles.value}>
              {fmtInt(toman)}
              <Text style={styles.unit}> Toman</Text>
            </Text>
            <Text style={[styles.trend, { color: trendColor(mgg.rialChange?.pct) }]}>
              {arrow(mgg.rialChange?.pct)} {fmtPct(mgg.rialChange?.pct)}
            </Text>
          </View>
        </View>
      )}
      <View style={styles.footRow}>
        <Text style={[styles.foot, styles.footLeft]} numberOfLines={1}>
          {snapshot?.ons ? `Ounce $${snapshot.ons.usd.toFixed(2)}` : ""}
          {snapshot?.usdRate ? ` · Sarafiyaran USD ${fmtInt(snapshot.usdRate.toman)}` : ""}
          {mgg?.stale ? " · stale" : ""}
        </Text>
        <Text style={styles.foot}>{updated}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  title: { color: colors.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.5, marginBottom: 4 },
  valuesRow: { flexDirection: "row", alignItems: "center" },
  col: { flex: 1 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 10 },
  value: { color: colors.text, fontSize: 18, fontWeight: "700" },
  unit: { color: colors.textMuted, fontSize: 12, fontWeight: "400" },
  trend: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  muted: { color: colors.textMuted },
  footRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
  foot: { color: colors.textMuted, fontSize: 10 },
  footLeft: { flexShrink: 1, marginRight: 8 },
});
