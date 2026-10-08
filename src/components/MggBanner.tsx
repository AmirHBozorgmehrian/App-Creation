import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import { useGold } from "../gold/GoldContext";
import { arrow, fmtInt, fmtPct, fmtUsd, trendColor } from "../utils/format";

export default function MggBanner() {
  const { snapshot, loading } = useGold();
  const mgg = snapshot?.mgg ?? null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.label}>MGG · 1 milligram of world gold</Text>
        {mgg?.stale ? <Text style={styles.stale}>stale</Text> : null}
      </View>
      {!mgg ? (
        <Text style={styles.muted}>{loading ? "Loading…" : "World gold price unavailable"}</Text>
      ) : (
        <View style={styles.valuesRow}>
          <View style={styles.col}>
            <Text style={styles.value}>{fmtUsd(mgg.usd)}</Text>
            <Text style={styles.unit}>USD</Text>
            <Text style={[styles.trend, { color: trendColor(mgg.usdChange?.pct) }]}>
              {arrow(mgg.usdChange?.pct)} {fmtPct(mgg.usdChange?.pct)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.col}>
            <Text style={styles.value}>{fmtInt(mgg.rial)}</Text>
            <Text style={styles.unit}>IRR (rial)</Text>
            <Text style={[styles.trend, { color: trendColor(mgg.rialChange?.pct) }]}>
              {arrow(mgg.rialChange?.pct)} {fmtPct(mgg.rialChange?.pct)}
            </Text>
          </View>
        </View>
      )}
      {snapshot?.ons ? (
        <Text style={styles.foot}>
          Ounce ${snapshot.ons.usd.toFixed(2)}
          {snapshot.usdRate ? ` · USD rate ${fmtInt(snapshot.usdRate.rial)} IRR` : ""} · trend vs last business-day close
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  stale: { color: colors.negative, fontSize: 11, fontWeight: "700" },
  valuesRow: { flexDirection: "row", alignItems: "center" },
  col: { flex: 1 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 12 },
  value: { color: colors.text, fontSize: 22, fontWeight: "700" },
  unit: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  trend: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  muted: { color: colors.textMuted },
  foot: { color: colors.textMuted, fontSize: 11, marginTop: 10 },
});
