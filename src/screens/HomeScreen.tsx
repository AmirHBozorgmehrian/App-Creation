import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { colors } from "../theme";
import MggBanner from "../components/MggBanner";
import { useGold } from "../gold/GoldContext";
import { timeAgo } from "../utils/format";

export type HomeTarget = "stock" | "gold" | "currencies" | "crypto";

const CARDS: { key: HomeTarget; title: string; icon: string; sub: string; soon?: boolean }[] = [
  { key: "stock", title: "Stock", icon: "📈", sub: "TSE & Fara Bourse" },
  { key: "gold", title: "Gold", icon: "🪙", sub: "Coins, bars, melted" },
  { key: "currencies", title: "Currencies", icon: "💱", sub: "Coming soon", soon: true },
  { key: "crypto", title: "Crypto", icon: "₿", sub: "Coming soon", soon: true },
];

export default function HomeScreen({ onOpen }: { onOpen: (t: HomeTarget) => void }) {
  const { refreshing, refresh, lastFetchAt, syncing } = useGold();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 30 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={colors.primary} />}
    >
      <MggBanner />
      <Text style={styles.updated}>
        {syncing ? "Updating…" : lastFetchAt ? `Updated ${timeAgo(lastFetchAt)} · pull down to refresh` : "Pull down to refresh"}
      </Text>
      <View style={styles.grid}>
        {CARDS.map((c) => (
          <TouchableOpacity key={c.key} style={[styles.card, c.soon && { opacity: 0.6 }]} activeOpacity={0.7} onPress={() => onOpen(c.key)}>
            <Text style={styles.icon}>{c.icon}</Text>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.sub}>{c.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: 16 },
  updated: { color: colors.textMuted, fontSize: 12, marginBottom: 12, marginTop: -4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.5%",
    aspectRatio: 1.15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    justifyContent: "flex-end",
  },
  icon: { fontSize: 30, marginBottom: 10 },
  title: { color: colors.text, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
