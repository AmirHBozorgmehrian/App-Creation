import React, { useEffect, useMemo, useState } from "react";
import { View, Text, SectionList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { colors } from "../theme";
import MggBanner from "../components/MggBanner";
import { useGold } from "../gold/GoldContext";
import { GoldItem, PriceSample, findSwaps, formatJalaliIso, splitSwaps, swapTone } from "../../shared/gold";
import SwapPanel from "../components/SwapPanel";
import DraggableTab, { Side } from "../components/DraggableTab";
import { useArbSettings } from "../arbitrage/settings";
import { coinItemsFromSnapshot, loadPriceHistory } from "../arbitrage/engine";
import { arrow, fmtInt, fmtPct, trendColor } from "../utils/format";

export default function GoldScreen({ onOpenItem, onBack }: { onOpenItem: (item: GoldItem, section: string) => void; onBack: () => void }) {
  const { snapshot, loading, refreshing, syncing, refresh, error, source } = useGold();
  const sections = (snapshot?.sections ?? []).map((s) => ({ title: s.title, data: s.items }));

  // coin swaps (side panel)
  const { settings: arb, update: updateArb } = useArbSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const coins = useMemo(() => coinItemsFromSnapshot(snapshot), [snapshot]);
  const swaps = useMemo(() => findSwaps(coins, { have: arb.have, want: arb.want, pairs: arb.pairs }), [coins, arb.have, arb.want, arb.pairs]);
  const [history, setHistory] = useState<PriceSample[]>([]);
  useEffect(() => {
    loadPriceHistory().then(setHistory);
  }, [snapshot, panelOpen]);
  const [tabSide, setTabSide] = useState<Side>("right");
  const [box, setBox] = useState({ w: 0, h: 0 });
  // badge = swaps inside your limits that are worth acting on (green ones)
  const swapHits = useMemo(() => {
    const { up, down } = splitSwaps(swaps, { minProfitPct: arb.thresholdPct, maxLossPct: arb.maxLossPct });
    return [...up, ...down].filter((x) => swapTone(x.pct) === "green").length;
  }, [swaps, arb.thresholdPct, arb.maxLossPct]);

  const header = (
    <View>
      <MggBanner />
      {snapshot && !snapshot.sarafi.ok ? (
        <Text style={styles.warn}>Sarafiyaran data is stale: {snapshot.sarafi.error}</Text>
      ) : null}
      {error ? <Text style={styles.warn}>Couldn't refresh: {error}</Text> : null}
      <Text style={styles.meta}>
        Prices in Toman
        {snapshot?.sarafi.priceTime ? ` · site prices ${formatJalaliIso(snapshot.sarafi.priceTime)}` : ""}{source === "cache" ? " · saved copy" : ""}
      </Text>
    </View>
  );

  return (
    <View style={styles.container} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Gold</Text>
        {syncing && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginLeft: 10 }} />}
      </View>
      <SwapPanel visible={panelOpen} onClose={() => setPanelOpen(false)} settings={arb} update={updateArb} coins={coins} swaps={swaps} history={history} side={tabSide} />

      {/* movable tab that opens the swap side panel (hold to drag) */}
      {box.w > 0 ? <DraggableTab width={box.w} height={box.h} count={swapHits} onPress={() => setPanelOpen(true)} onSideChange={setTabSide} /> : null}

      {loading && !snapshot ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(it) => it.id}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No gold prices yet. Pull down to refresh.</Text>}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, section }) => {
            const pct = item.change?.pct ?? null;
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onOpenItem(item, section.title)}>
                <View style={styles.trendBox}>
                  <Text style={[styles.trend, { color: trendColor(pct) }]}>{arrow(pct)}</Text>
                  <Text style={[styles.trendPct, { color: trendColor(pct) }]}>{fmtPct(pct)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.prices}>
                  <Text style={styles.price}><Text style={styles.tag}>Sell </Text>{fmtInt(item.sell)}</Text>
                  <Text style={styles.priceBuy}><Text style={styles.tag}>Buy </Text>{fmtInt(item.buy)}</Text>
                </View>
                <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  back: { color: colors.text, fontSize: 34, lineHeight: 34, marginRight: 12 },
  header: { fontSize: 22, fontWeight: "700", color: colors.text },
  siteBtn: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center", marginBottom: 10 },
  siteBtnText: { color: colors.text, fontWeight: "700" },
  meta: { color: colors.textMuted, fontSize: 12, marginBottom: 6, marginTop: -4 },
  warn: { color: colors.negative, fontSize: 12, marginBottom: 6 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 30 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", backgroundColor: colors.background, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  siteTime: { color: colors.textMuted, fontSize: 11 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600", textAlign: "right", writingDirection: "rtl", marginLeft: 10 },
  prices: { alignItems: "flex-end" },
  price: { color: colors.text, fontSize: 13, fontWeight: "700" },
  priceBuy: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: { color: colors.textMuted, fontWeight: "400", fontSize: 11 },
  trendBox: { width: 48, alignItems: "flex-start" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border, opacity: 0.6, marginHorizontal: 8 },
  trend: { fontSize: 13, fontWeight: "700" },
  trendPct: { fontSize: 12, fontWeight: "700", marginTop: 1 },
});
