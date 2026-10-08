import React from "react";
import { View, Text, Modal, SectionList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "../theme";
import MggBanner from "../components/MggBanner";
import { useGold } from "../gold/GoldContext";
import { GoldItem, SITE_URL } from "../../shared/gold";
import { arrow, fmtInt, fmtPct, timeAgo, trendColor } from "../utils/format";

export default function GoldScreen({ onOpenItem, onBack }: { onOpenItem: (item: GoldItem, section: string) => void; onBack: () => void }) {
  const { snapshot, loading, refreshing, syncing, refresh, error, source, lastFetchAt } = useGold();
  const [showSite, setShowSite] = React.useState(false);
  const sections = (snapshot?.sections ?? []).map((s) => ({ title: s.title, siteTime: s.siteTime, data: s.items }));

  const header = (
    <View>
      <MggBanner />
      {snapshot && !snapshot.sarafi.ok ? (
        <Text style={styles.warn}>Sarafiyaran data is stale: {snapshot.sarafi.error}</Text>
      ) : null}
      {error ? <Text style={styles.warn}>Couldn't refresh: {error}</Text> : null}
      <TouchableOpacity style={styles.siteBtn} onPress={() => setShowSite(true)}>
        <Text style={styles.siteBtnText}>📊 Open Sarafiyaran's charts</Text>
      </TouchableOpacity>
      <Text style={styles.meta}>
        Prices in Toman
        {lastFetchAt ? ` · updated ${timeAgo(lastFetchAt)}` : ""}
        {source === "cache" ? " · saved copy" : ""}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Gold</Text>
        {syncing && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginLeft: 10 }} />}
      </View>

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
              {section.siteTime ? <Text style={styles.siteTime}>{section.siteTime}</Text> : null}
            </View>
          )}
          renderItem={({ item, section }) => {
            const pct = item.change?.pct ?? null;
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => onOpenItem(item, section.title)}>
                <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
                <View style={styles.prices}>
                  <Text style={styles.price}><Text style={styles.tag}>Sell </Text>{fmtInt(item.sell)}</Text>
                  <Text style={styles.priceBuy}><Text style={styles.tag}>Buy </Text>{fmtInt(item.buy)}</Text>
                </View>
                <View style={styles.trendBox}>
                  <Text style={[styles.trend, { color: trendColor(pct) }]}>{arrow(pct)}</Text>
                  <Text style={[styles.trendPct, { color: trendColor(pct) }]}>{fmtPct(pct)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <Modal visible={showSite} animationType="slide" onRequestClose={() => setShowSite(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 40 }}>
          <TouchableOpacity onPress={() => setShowSite(false)} style={{ padding: 12 }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
          <WebView source={{ uri: SITE_URL }} startInLoadingState pullToRefreshEnabled />
        </View>
      </Modal>
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
  name: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600", marginRight: 8 },
  prices: { alignItems: "flex-end", marginRight: 10 },
  price: { color: colors.text, fontSize: 13, fontWeight: "700" },
  priceBuy: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: { color: colors.textMuted, fontWeight: "400", fontSize: 11 },
  trendBox: { width: 58, alignItems: "flex-end" },
  trend: { fontSize: 13, fontWeight: "700" },
  trendPct: { fontSize: 12, fontWeight: "700", marginTop: 1 },
});
