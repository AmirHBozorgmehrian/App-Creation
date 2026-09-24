import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from "react-native";
import { Stock } from "../types";
import { fetchLatestStocks } from "../api/snapshot";
import { loadFollowings, saveFollowings } from "../storage/followings";
import { loadStocksCache, saveStocksCache } from "../storage/stocksCache";
import { normalizeFarsi } from "../utils/normalizeFarsi";
import { colors } from "../theme";
import { pullFollowings, pushFollowings } from "../sync/followingsSync";
import { getGithubToken, setGithubToken } from "../storage/githubToken";
import { registerForPushAlerts } from "../push/registerPush";

type Tab = "all" | "followings";

function timeAgo(ms: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function StockListScreen() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true); // full-screen loader (no data yet at all)
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh spinner
  const [syncing, setSyncing] = useState(false); // silent background refresh indicator
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [followings, setFollowings] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("all");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const hasCache = useRef(false);

  const refreshFromNetwork = useCallback(async (isManual: boolean) => {
    try {
      setError(null);
      const { stocks: data, updatedAt: serverUpdatedAt } = await fetchLatestStocks();
      setStocks(data);
      setUpdatedAt(serverUpdatedAt);
      await saveStocksCache(data, serverUpdatedAt);
    } catch (e: any) {
      // If we already have cached data on screen, a failed background
      // refresh shouldn't blank the app out - just surface a small error.
      if (!hasCache.current) {
        setError(e?.message ?? "Failed to load stock list");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setSyncing(false);
    }
  }, []);

  const init = useCallback(async () => {
    const [cache, savedFollowings] = await Promise.all([
      loadStocksCache(),
      loadFollowings(),
    ]);
    setFollowings(savedFollowings);

    // Pull whatever the other phone last saved to GitHub. If it succeeds,
    // that becomes the source of truth for this open; if it fails (no
    // token yet, offline, file doesn't exist), just keep what's local.
    const remote = await pullFollowings();
    if (remote) {
      setFollowings(remote);
      await saveFollowings(remote);
    }

    if (cache && cache.data.length > 0) {
      // Show the last known list immediately, no spinner, then sync quietly.
      hasCache.current = true;
      setStocks(cache.data);
      setUpdatedAt(cache.updatedAt);
      setLoading(false);
      setSyncing(true);
      refreshFromNetwork(false);
    } else {
      // Nothing cached yet - this is the only case with a full-screen spinner.
      await refreshFromNetwork(false);
    }
  }, [refreshFromNetwork]);

  useEffect(() => {
    init();
    registerForPushAlerts();
  }, [init]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshFromNetwork(true);
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
    const synced = await pushFollowings(next);
    if (!synced) {
      const token = await getGithubToken();
      if (!token) {
        Alert.alert(
          "Not synced to your other phone",
          "Add a GitHub token in Settings to keep both phones in sync.",
        );
      }
    }
  };

  const openSettings = async () => {
    const existing = await getGithubToken();
    setTokenInput(existing ?? "");
    setSettingsVisible(true);
  };

  const saveToken = async () => {
    await setGithubToken(tokenInput);
    setSettingsVisible(false);
  };

  const visibleStocks = useMemo(() => {
    const base = tab === "followings"
      ? stocks.filter((s) => followings.has(s.insCode))
      : stocks;

    const q = normalizeFarsi(query);
    if (!q) return base;
    return base.filter(
      (s) =>
        normalizeFarsi(s.symbol).includes(q) ||
        normalizeFarsi(s.name).includes(q)
    );
  }, [stocks, followings, tab, query]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>TSE Stock App</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {syncing && <ActivityIndicator size="small" color={colors.textMuted} />}
          <TouchableOpacity onPress={openSettings}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>
      {updatedAt !== null && (
        <Text style={styles.updatedText}>Updated {timeAgo(updatedAt)}</Text>
      )}

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

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.search}
          placeholder="Search symbol or company name..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refreshFromNetwork(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleStocks}
          keyExtractor={(item) => item.insCode}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
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
            const changeColor =
              item.priceChangePercent === null
                ? colors.textMuted
                : item.priceChangePercent > 0
                ? colors.positive
                : item.priceChangePercent < 0
                ? colors.negative
                : colors.textMuted;

            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => toggleFollow(item.insCode)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                </View>

                {item.lastPrice !== null && (
                  <View style={styles.priceBlock}>
                    <Text style={styles.price}>{item.lastPrice.toLocaleString()}</Text>
                    {item.priceChangePercent !== null && (
                      <Text style={[styles.change, { color: changeColor }]}>
                        {item.priceChangePercent > 0 ? "+" : ""}
                        {item.priceChangePercent.toFixed(2)}%
                      </Text>
                    )}
                  </View>
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

      <Modal visible={settingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sync Settings</Text>
            <Text style={styles.modalBody}>
              Paste a GitHub personal access token (fine-grained, scoped only
              to this repo, with Contents: Read and write permission). This
              lets Followings sync between your phones.
            </Text>
            <TextInput
              style={styles.tokenInput}
              placeholder="github_pat_..."
              placeholderTextColor={colors.textMuted}
              value={tokenInput}
              onChangeText={setTokenInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={saveToken}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 50, paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  header: { fontSize: 22, fontWeight: "700", color: colors.text },
  updatedText: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 10 },
  tabRow: { flexDirection: "row", marginBottom: 12, gap: 8 },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButtonActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  tabText: { fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.text },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8, opacity: 0.6 },
  search: {
    flex: 1,
    paddingVertical: 10,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  symbol: { fontSize: 16, fontWeight: "700", color: colors.text },
  name: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  priceBlock: { alignItems: "flex-end", marginRight: 12 },
  price: { fontSize: 14, color: colors.text, fontWeight: "600" },
  change: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  followBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  followBadgeActive: { backgroundColor: colors.primary },
  followBadgeText: { color: colors.primary, fontWeight: "700" },
  followBadgeTextActive: { color: colors.white },
  center: { alignItems: "center", marginTop: 40, paddingHorizontal: 20 },
  errorText: { color: colors.negative, textAlign: "center", marginBottom: 12 },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: colors.white, fontWeight: "600" },
  emptyText: { color: colors.textMuted, textAlign: "center" },
  settingsIcon: { fontSize: 20, color: colors.textMuted },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
  modalBody: { fontSize: 13, color: colors.textMuted, marginBottom: 14, lineHeight: 18 },
  tokenInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalButtonText: { color: colors.white, fontWeight: "600" },
});
