import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme";
import MiniChart from "../components/MiniChart";
import { GoldHistory, GoldItem, REFRESH_EVERY_MS } from "../../shared/gold";
import { getHistory } from "../gold/goldService";
import { arrow, fmtInt, fmtPct, trendColor } from "../utils/format";

const RANGES = [
  { label: "1D", ms: 24 * 3600e3 },
  { label: "1W", ms: 7 * 24 * 3600e3 },
  { label: "1M", ms: 30 * 24 * 3600e3 },
  { label: "All", ms: Infinity },
];

export default function GoldDetailScreen({ item, sectionTitle, onBack }: { item: GoldItem; sectionTitle: string; onBack: () => void }) {
  const [history, setHistory] = useState<GoldHistory | null>(null);
  const [loadingHist, setLoadingHist] = useState(true);
  const [range, setRange] = useState(1);
  const [showSite, setShowSite] = useState(false);

  useEffect(() => {
    getHistory().then((h) => { setHistory(h); setLoadingHist(false); }).catch(() => setLoadingHist(false));
  }, []);

  const values = useMemo(() => {
    if (!history) return [];
    const i = history.keys.indexOf(item.id);
    if (i < 0) return [];
    const from = Date.now() - RANGES[range].ms;
    const out: number[] = [];
    for (const p of history.points) {
      const v = p[3][i];
      if (p[0] >= from && v !== null && v !== undefined) out.push(v);
    }
    return out;
  }, [history, range, item.id]);

  const pct = item.change?.pct ?? null;
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.header} numberOfLines={2}>{item.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <Text style={styles.section}>{sectionTitle} · prices in Toman</Text>

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
          <Text style={styles.small}>vs last business-day close{item.siteChange ? ` · site shows: ${item.siteChange}` : ""}</Text>
        </View>

        <View style={styles.rangeRow}>
          {RANGES.map((r, i) => (
            <TouchableOpacity key={r.label} style={[styles.chip, i === range && styles.chipOn]} onPress={() => setRange(i)}>
              <Text style={[styles.chipText, i === range && { color: colors.text }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loadingHist ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : values.length >= 2 ? (
          <MiniChart values={values} />
        ) : (
          <Text style={styles.small}>
            Not enough history yet for this range. The monitor adds one point every 30 min in business hours, so charts fill in over the next days.
          </Text>
        )}

        {item.chartImage ? (
          <View style={{ marginTop: 18 }}>
            <Text style={styles.small}>Sarafiyaran's chart (reloaded every 30 min)</Text>
            <Image
              source={{ uri: `${item.chartImage}${item.chartImage.includes("?") ? "&" : "?"}t=${Math.floor(Date.now() / REFRESH_EVERY_MS)}` }}
              style={styles.siteImg}
              resizeMode="contain"
            />
          </View>
        ) : null}

        {item.chartUrl ? (
          <TouchableOpacity style={styles.siteBtn} onPress={() => setShowSite(true)}>
            <Text style={styles.siteBtnText}>Open Sarafiyaran's own chart</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={showSite} animationType="slide" onRequestClose={() => setShowSite(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 40 }}>
          <TouchableOpacity onPress={() => setShowSite(false)} style={{ padding: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
          {item.chartUrl ? <WebView source={{ uri: item.chartUrl }} startInLoadingState /> : null}
        </View>
      </Modal>
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
  small: { color: colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  rangeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: "600", fontSize: 12 },
  siteImg: { width: "100%", height: 220, marginTop: 6, backgroundColor: colors.surface, borderRadius: 12 },
  siteBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  siteBtnText: { color: colors.white, fontWeight: "700" },
});
