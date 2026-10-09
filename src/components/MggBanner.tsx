import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";
import { useGold } from "../gold/GoldContext";
import { TOMAN_TO_RIAL } from "../../shared/gold";
import { arrow, fmtInt, fmtPct, fmtUsd, trendColor } from "../utils/format";

export default function MggBanner() {
  const { snapshot, loading } = useGold();
  const mgg = snapshot?.mgg ?? null;
  const toman = mgg?.rial != null ? mgg.rial / TOMAN_TO_RIAL : null;

  return (
    <View style={styles.card}>
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
      {snapshot?.ons ? (
        <Text style={styles.foot}>
          Ounce ${snapshot.ons.usd.toFixed(2)}
          {snapshot.usdRate ? ` · Sarafiyaran USD ${fmtInt(snapshot.usdRate.toman)}` : ""}
          {mgg?.stale ? " · stale" : ""}
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
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  valuesRow: { flexDirection: "row", alignItems: "center" },
  col: { flex: 1 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, marginHorizontal: 10 },
  value: { color: colors.text, fontSize: 18, fontWeight: "700" },
  unit: { color: colors.textMuted, fontSize: 12, fontWeight: "400" },
  trend: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  muted: { color: colors.textMuted },
  foot: { color: colors.textMuted, fontSize: 10, marginTop: 5 },
});
