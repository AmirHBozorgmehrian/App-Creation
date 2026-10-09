import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { colors } from "../theme";
import { CategoryPair, CoinCategory, Swap, SwapItem } from "../../shared/gold";
import { ArbSettings } from "../arbitrage/settings";
import { ensurePermission, sendTestNotification } from "../arbitrage/notify";
import { syncBackgroundCheck } from "../arbitrage/backgroundTask";
import { fmtInt } from "../utils/format";

const W = Dimensions.get("window").width;
const PANEL_W = Math.min(W * 0.92, 460);

const CATEGORIES: { id: CoinCategory; label: string }[] = [
  { id: "emami86", label: "تمام ۸۶" },
  { id: "bahar", label: "بهار آزادی" },
  { id: "pre86", label: "قبل ۸۶" },
  { id: "gram", label: "سکه یک گرمی" },
];
const labelOf = (c: CoinCategory | null) => CATEGORIES.find((x) => x.id === c)?.label ?? "";

function Slot({ cat, active, onPress }: { cat: CoinCategory | null; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.slot, cat ? styles.slotFilled : styles.slotEmpty, active && styles.slotActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={cat ? styles.slotText : styles.slotPlaceholder} numberOfLines={1}>{cat ? labelOf(cat) : "Choose"}</Text>
    </TouchableOpacity>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function CoinList({ title, hint, coins, picked, onPick }: { title: string; hint: string; coins: SwapItem[]; picked: string[]; onPick: (id: string) => void }) {
  return (
    <View style={styles.block}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.hint}>{hint}</Text>
      {coins.length === 0 ? <Text style={styles.hint}>No coins loaded yet.</Text> : null}
      {coins.map((c) => {
        const on = picked.includes(c.id);
        return (
          <TouchableOpacity key={c.id} style={[styles.coinRow, on && styles.coinRowOn]} onPress={() => onPick(c.id)} activeOpacity={0.7}>
            <View style={[styles.box, on && styles.boxOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
            <Text style={styles.coinName} numberOfLines={1}>{c.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SwapCard({ s, good }: { s: Swap; good: boolean }) {
  const c = good ? colors.positive : s.profit >= 0 ? colors.textMuted : colors.negative;
  return (
    <View style={[styles.card, good && { borderColor: colors.positive }]}>
      <Text style={[styles.profit, { color: c }]}>
        {s.profit > 0 ? "+" : ""}{fmtInt(s.profit)} Toman · {s.pct > 0 ? "+" : ""}{s.pct.toFixed(2)}%
      </Text>
      <Text style={styles.legTag}>SELL {s.sellCount}×</Text>
      <Text style={styles.legName}>{s.sellTitle}</Text>
      <Text style={styles.legPrice}>{fmtInt(s.sellUnit)} each = {fmtInt(s.proceeds)}</Text>
      <Text style={styles.legTag}>BUY {s.buyCount}×</Text>
      <Text style={styles.legName}>{s.buyTitle}</Text>
      <Text style={styles.legPrice}>{fmtInt(s.buyUnit)} each = {fmtInt(s.cost)}</Text>
    </View>
  );
}

export default function SwapPanel({
  visible,
  onClose,
  settings,
  update,
  coins,
  swaps,
}: {
  visible: boolean;
  onClose: () => void;
  settings: ArbSettings;
  update: (p: Partial<ArbSettings>) => void;
  coins: SwapItem[];
  swaps: Swap[]; // every have x want option, best first
}) {
  const x = useRef(new Animated.Value(PANEL_W)).current;
  const [thr, setThr] = useState(String(settings.thresholdPct));
  const [picking, setPicking] = useState<{ i: number; slot: 0 | 1 } | null>(null);

  const setPairs = (pairs: CategoryPair[]) => update({ pairs: pairs.length ? pairs : [[null, null]] });
  const choose = (cat: CoinCategory) => {
    if (!picking) return;
    const cur = settings.pairs[picking.i][picking.slot];
    setPairs(settings.pairs.map((p, i) => (i === picking.i ? (picking.slot === 0 ? [cur === cat ? null : cat, p[1]] : [p[0], cur === cat ? null : cat]) : p) as CategoryPair));
    setPicking(null);
  };
  const removePair = (i: number) => {
    setPicking(null);
    setPairs(settings.pairs.filter((_, k) => k !== i));
  };
  const filterOn = settings.pairs.some((p) => p[0] && p[1]);

  useEffect(() => {
    if (visible) {
      x.setValue(PANEL_W);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, x]);
  useEffect(() => setThr(String(settings.thresholdPct)), [settings.thresholdPct]);

  const close = () => Animated.timing(x, { toValue: PANEL_W, duration: 180, useNativeDriver: true }).start(() => onClose());

  const commitThr = (raw: string) => {
    const n = parseFloat(raw.replace(",", "."));
    const v = Number.isFinite(n) ? Math.min(100, Math.max(0.1, n)) : settings.thresholdPct;
    update({ thresholdPct: v });
    setThr(String(v));
  };
  const step = (d: number) => commitThr(String(Math.round((settings.thresholdPct + d) * 10) / 10));

  const toggleAlerts = async (on: boolean) => {
    if (on) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert("Notifications are off", "Allow notifications for this app in Android settings to get swap alerts.");
        return;
      }
      update({ enabled: true });
      await syncBackgroundCheck(true);
      sendTestNotification().catch(() => {});
    } else {
      update({ enabled: false });
      await syncBackgroundCheck(false);
    }
  };

  const hits = swaps.filter((s) => s.pct >= settings.thresholdPct);
  const nearMiss = swaps.filter((s) => s.pct < settings.thresholdPct).slice(0, 3);
  const ready = settings.have.length > 0 && settings.want.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <Animated.View style={[styles.panel, { width: PANEL_W, transform: [{ translateX: x }] }]}>
          <View style={styles.head}>
            <Text style={styles.title}>Coin swaps</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.intro}>
              Sell one kind of coin and buy another with the same amount of gold. If the prices don't line up, you keep the difference in Toman.
            </Text>

            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.h2}>Notify me</Text>
                <Text style={styles.hint}>Checks with every price refresh, and about every 15 min in the background (Iran business hours).</Text>
              </View>
              <Switch value={settings.enabled} onValueChange={toggleAlerts} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>

            <View style={styles.block}>
              <Text style={styles.h2}>Minimum profit</Text>
              <Text style={styles.hint}>Share of the money you receive. Smaller swaps are ignored.</Text>
              <View style={styles.thrRow}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => step(-0.5)}><Text style={styles.stepTxt}>−</Text></TouchableOpacity>
                <TextInput
                  style={styles.thrInput}
                  value={thr}
                  onChangeText={setThr}
                  onEndEditing={(e) => commitThr(e.nativeEvent.text)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Text style={styles.pct}>%</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => step(0.5)}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
              </View>
            </View>

            <CoinList
              title="Coins I have"
              hint="Ones I'm willing to sell."
              coins={coins}
              picked={settings.have}
              onPick={(id) => update({ have: toggle(settings.have, id) })}
            />
            <CoinList
              title="Coins I'd buy"
              hint="Ones I'm willing to hold instead."
              coins={coins}
              picked={settings.want}
              onPick={(id) => update({ want: toggle(settings.want, id) })}
            />

            <View style={styles.block}>
              <Text style={styles.h2}>Swap types</Text>
              <Text style={styles.hint}>
                Only allow swaps between these groups (works both ways). Fill both spots of a card. Leave it empty to allow everything.
              </Text>
              {settings.pairs.map((p, i) => {
                const open = picking?.i === i;
                return (
                  <View key={i} style={styles.pairCard}>
                    <View style={styles.pairRow}>
                      <Slot cat={p[0]} active={open && picking!.slot === 0} onPress={() => setPicking(open && picking!.slot === 0 ? null : { i, slot: 0 })} />
                      <Text style={styles.swapSym}>⇄</Text>
                      <Slot cat={p[1]} active={open && picking!.slot === 1} onPress={() => setPicking(open && picking!.slot === 1 ? null : { i, slot: 1 })} />
                      <TouchableOpacity onPress={() => removePair(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 8 }}>
                        <Text style={styles.pairX}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {open ? (
                      <View style={styles.chipRow}>
                        {CATEGORIES.map((c) => {
                          const sel = p[picking!.slot] === c.id;
                          return (
                            <TouchableOpacity key={c.id} style={[styles.catChip, sel && styles.catChipOn]} onPress={() => choose(c.id)} activeOpacity={0.7}>
                              <Text style={styles.catChipText}>{c.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                    {(p[0] === "gram" || p[1] === "gram") && p[0] && p[1] ? (
                      <Text style={styles.warnTxt}>The 1 g coin has no whole-number match in gold weight with the others, so this pair finds nothing.</Text>
                    ) : null}
                  </View>
                );
              })}
              <TouchableOpacity style={styles.addPair} onPress={() => setPairs([...settings.pairs, [null, null]])} activeOpacity={0.7}>
                <Text style={styles.addPairText}>+ Add another swap type</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.block}>
              <Text style={styles.h2}>Right now{filterOn ? " (filtered)" : ""}</Text>
              {!ready ? (
                <Text style={styles.hint}>Pick at least one coin you have and one you'd buy.</Text>
              ) : hits.length ? (
                hits.map((s) => <SwapCard key={s.key} s={s} good />)
              ) : (
                <>
                  <Text style={styles.hint}>Nothing above {settings.thresholdPct}% at the moment.</Text>
                  {nearMiss.length ? <Text style={[styles.hint, { marginTop: 8 }]}>Closest options:</Text> : null}
                  {nearMiss.map((s) => <SwapCard key={s.key} s={s} good={false} />)}
                </>
              )}
              <Text style={styles.foot}>
                Prices: you receive the site's "Buy" price when you sell, and pay its "Sell" price when you buy, so the spread is already counted. Coins with no whole-number match in gold weight (e.g. the 1 g coin) are skipped.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.55)" },
  backdrop: { flex: 1 },
  panel: { backgroundColor: colors.background, borderLeftWidth: 1, borderLeftColor: colors.border, paddingTop: 44, paddingHorizontal: 16 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  close: { color: colors.textMuted, fontSize: 20 },
  intro: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 14 },
  rowBetween: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  block: { marginBottom: 18 },
  h2: { color: colors.text, fontSize: 15, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 2, marginBottom: 6 },
  foot: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 10 },
  thrRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepTxt: { color: colors.text, fontSize: 20, fontWeight: "700" },
  thrInput: { minWidth: 64, height: 40, marginHorizontal: 8, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  pct: { color: colors.textMuted, fontSize: 16, marginRight: 8 },
  coinRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginTop: 6 },
  coinRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: "center", justifyContent: "center", marginRight: 10 },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.white, fontSize: 13, fontWeight: "700", lineHeight: 15 },
  coinName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  pairCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginTop: 8 },
  pairRow: { flexDirection: "row", alignItems: "center" },
  slot: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  slotEmpty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.textMuted },
  slotFilled: { backgroundColor: colors.primaryMuted, borderWidth: 1, borderColor: colors.primary },
  slotActive: { borderColor: colors.white },
  slotText: { color: colors.text, fontSize: 14, fontWeight: "700", writingDirection: "rtl" },
  slotPlaceholder: { color: colors.textMuted, fontSize: 13 },
  swapSym: { color: colors.text, fontSize: 22, fontWeight: "700", marginHorizontal: 10 },
  pairX: { color: colors.textMuted, fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  catChip: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 },
  catChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  catChipText: { color: colors.text, fontSize: 13, fontWeight: "600", writingDirection: "rtl" },
  warnTxt: { color: colors.negative, fontSize: 11, marginTop: 6 },
  addPair: { marginTop: 10, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  addPairText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginTop: 8 },
  profit: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  legTag: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 6 },
  legName: { color: colors.text, fontSize: 14, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  legPrice: { color: colors.textMuted, fontSize: 12, textAlign: "right" },
});
