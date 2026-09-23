import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Stock } from "../types";
import { fetchAllStocks } from "../api/tsetmc";
import { loadFollowings, saveFollowings } from "../storage/followings";

type Tab = "all" | "followings";

export default function StockListScreen() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [followings, setFollowings] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("all");

  const load = useCallback(async () => {
    try {
      setError(null);
      const [data, savedFollowings] = await Promise.all([
        fetchAllStocks(),
        loadFollowings(),
      ]);
      setStocks(data);
      setFollowings(savedFollowings);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load stock list");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggleFollow = async (insCode: string) => {
    const next = new Set(followings);
    if (next.has(insCode)) {
      next.delete(insCode);
    } else {
      next.add(insCode);
    }
    setFollowings(next);
    await saveFollowings(next);
  };

  const visibleStocks = useMemo(() => {
    const base = tab === "followings"
      ? stocks.filter((s) => followings.has(s.insCode))
      : stocks;

    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q)
    );
  }, [stocks, followings, tab, query]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>TSE Stock App</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "all" && styles.tabButtonActive]}
          onPress={() => setTab("all")}
        >
          <Text style={[styles.tabText, tab === "all" && styles.tabTextActive]}>
            All Stocks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "followings" && styles.tabButtonActive]}
          onPress={() => setTab("followings")}
        >
          <Text
            style={[styles.tabText, tab === "followings" && styles.tabTextActive]}
          >
            Followings ({followings.size})
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search symbol or company name..."
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleStocks}
          keyExtractor={(item) => item.insCode}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {tab === "followings"
                  ? "No stocks followed yet. Tap a stock in All Stocks to add it here."
                  : "No stocks match your search."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isFollowing = followings.has(item.insCode);
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggleFollow(item.insCode)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                </View>
                {item.lastPrice !== null && (
                  <Text style={styles.price}>{item.lastPrice.toLocaleString()}</Text>
                )}
                <View
                  style={[
                    styles.followBadge,
                    isFollowing && styles.followBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.followBadgeText,
                      isFollowing && styles.followBadgeTextActive,
                    ]}
                  >
                    {isFollowing ? "✓" : "+"}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingTop: 50, paddingHorizontal: 16 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  tabRow: { flexDirection: "row", marginBottom: 12, gap: 8 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: "#1a73e8" },
  tabText: { fontWeight: "600", color: "#333" },
  tabTextActive: { color: "#fff" },
  search: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  symbol: { fontSize: 16, fontWeight: "700" },
  name: { fontSize: 13, color: "#666", marginTop: 2 },
  price: { fontSize: 14, color: "#333", marginRight: 12 },
  followBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1a73e8",
    alignItems: "center",
    justifyContent: "center",
  },
  followBadgeActive: { backgroundColor: "#1a73e8" },
  followBadgeText: { color: "#1a73e8", fontWeight: "700" },
  followBadgeTextActive: { color: "#fff" },
  center: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
  errorText: { color: "#c0392b", textAlign: "center", marginBottom: 12 },
  retryButton: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontWeight: "600" },
  emptyText: { color: "#888", textAlign: "center" },
});
