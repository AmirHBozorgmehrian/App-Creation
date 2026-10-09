import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { CategoryPair, CoinCategory, PriceSample, Swap, SwapDirection, SwapItem, SwapTrend, splitSwaps, swapTone, swapTrend } from "../../shared/gold";
import { ArbSettings } from "../arbitrage/settings";
import { ensurePermission, sendTestNotification } from "../arbitrage/notify";
import { fmtInt } from "../utils/format";
import type { Side } from "./DraggableTab";

const W = Dimensions.get("window").width;
const PANEL_W = Math.min(W * 0.92, 460);

const CATEGORIES: { id: CoinCategory; label: string }[] = [
  { id: "emami86", label: "تمام ۸۶" },
  { id: "bahar", label: "بهار آزادی" },
  { id: "pre86", label: "قبل ۸۶" },
  { id: "gram", label: "سکه یک گرمی" },
];
const labelOf = (c: CoinCategory | null) => CATEGORIES.find((x) => x.id === c)?.label ?? "";

const signed = (n: number) => (n < 0 ? "-" : n > 0 ? "+" : "") + fmtInt(Math.abs(n));
const signedPct = (p: number) => (p < 0 ? "-" : p > 0 ? "+" : "") + Math.abs(p).toFixed(2) + "%";

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

/** − [ value ] + control for a percentage. */
function PctInput({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => setTxt(String(value)), [value]);
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(",", "."));
    const v = Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : value;
    onCommit(v);
    setTxt(String(v));
  };
  const step = (d: number) => commit(String(Math.round((value + d) * 10) / 10));
  return (
    <View style={styles.thrRow}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => step(-0.5)}><Text style={styles.stepTxt}>−</Text></TouchableOpacity>
      <TextInput style={styles.thrInput} value={txt} onChangeText={setTxt} onEndEditing={(e) => commit(e.nativeEvent.text)} keyboardType="decimal-pad" selectTextOnFocus />
      <Text style={styles.pct}>%</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => step(0.5)}><Text style={styles.stepTxt}>+</Text></TouchableOpacity>
    </View>
  );
}

const DIR_STYLE: Record<SwapDirection, { text: string; color: string }> = {
  up: { text: "▲ UP", color: colors.positive },
  down: { text: "▼ DOWN", color: "#f5a524" },
  same: { text: "↔ SAME SIZE", color: colors.textMuted },
};

const TONE_COLOR = { green: colors.positive, red: colors.negative, grey: colors.textMuted } as const;

function TrendMark({ t }: { t: SwapTrend | null }) {
  if (!t) return <Text style={{ color: colors.textMuted }}>–</Text>;
  if (t.dir === 0) return <Text style={{ color: colors.textMuted }}>▬</Text>;
  return t.dir > 0 ? <Text style={{ color: colors.positive }}>▲</Text> : <Text style={{ color: colors.negative }}>▼</Text>;
}

/** Green = gain of 0.5% or more, red = loss of 0.5% or more, grey = in between. */
export function SwapCard({ s, trend }: { s: Swap; trend: SwapTrend | null }) {
  const tone = TONE_COLOR[swapTone(s.pct)];
  const d = DIR_STYLE[s.dir];
  return (
    <View style={[styles.card, { borderColor: tone }]}>
      <View style={styles.cardHead}>
        <Text style={[styles.profit, { color: tone, flex: 1 }]}>
          {signed(s.profit)} Toman · {signedPct(s.pct)} (<TrendMark t={trend} />)
        </Text>
        <View style={[styles.dirTag, { borderColor: d.color }]}>
          <Text style={[styles.dirTagText, { color: d.color }]}>{d.text}</Text>
        </View>
      </View>
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
  history,
  side,
}: {
  visible: boolean;
  onClose: () => void;
  settings: ArbSettings;
  update: (p: Partial<ArbSettings>) => void;
  coins: SwapItem[];
  swaps: Swap[]; // every have x want option (type filter applied), best first
  history: PriceSample[]; // saved coin prices, for the 2 h trend
  side: Side; // the panel opens from the side the tab sits on
}) {
  const from = side === "right" ? PANEL_W : -PANEL_W;
  const x = useRef(new Animated.Value(from)).current;
  const [picking, setPicking] = useState<{ i: number; slot: 0 | 1 } | null>(null);
  const [mode, setMode] = useState<"up" | "down">("up");

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

  useEffect(() => {
    if (visible) {
      x.setValue(from);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible, x, from]);

  const close = () => Animated.timing(x, { toValue: from, duration: 180, useNativeDriver: true }).start(() => onClose());

  const toggleAlerts = async (on: boolean) => {
    if (on) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert("Notifications are off", "Allow notifications for this app in Android settings to get swap alerts.");
        return;
      }
      update({ enabled: true });
      sendTestNotification().catch(() => {});
    } else {
      update({ enabled: false });
    }
  };

  const trendOf = (sw: Swap) => swapTrend(sw, history, Date.now());
  const split = useMemo(() => splitSwaps(swaps, { minProfitPct: settings.thresholdPct, maxLossPct: settings.maxLossPct }), [swaps, settings.thresholdPct, settings.maxLossPct]);
  const ready = settings.have.length > 0 && settings.want.length > 0;

  const isUp = mode === "up";
  const shown = isUp ? split.up : split.down;
  const closest = swaps.filter((s) => (isUp ? s.dir !== "down" : s.dir === "down") && !shown.includes(s)).slice(0, 3);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.overlay, { flexDirection: side === "right" ? "row" : "row-reverse" }]}>
        <TouchableWithoutFeedback onPress={close}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <Animated.View
          style={[styles.panel, { width: PANEL_W, transform: [{ translateX: x }] }, side === "right" ? { borderLeftWidth: 1 } : { borderRightWidth: 1 }]}
        >
          <View style={styles.head}>
            <Text style={styles.title}>Coin swaps</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.intro}>
              Sell one kind of coin and buy another with the same amount of gold. If the prices don't line up, the difference is your profit (or loss).
            </Text>

            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.h2}>Notify me</Text>
                <Text style={styles.hint}>Checked on every price refresh: about every 30 min in Iran business hours, also when the app is closed.</Text>
              </View>
              <Switch value={settings.enabled} onValueChange={toggleAlerts} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>

            <CoinList title="Coins I have" hint="Ones I'm willing to sell." coins={coins} picked={settings.have} onPick={(id) => update({ have: toggle(settings.have, id) })} />
            <CoinList title="Coins I'd buy" hint="Ones I'm willing to hold instead." coins={coins} picked={settings.want} onPick={(id) => update({ want: toggle(settings.want, id) })} />

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

            {/* upward / downward */}
            <View style={styles.segRow}>
              <TouchableOpacity style={[styles.seg, isUp && styles.segOn]} onPress={() => setMode("up")} activeOpacity={0.7}>
                <Text style={[styles.segText, isUp && { color: colors.text }]}>▲ Upward ({split.up.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.seg, !isUp && styles.segOn]} onPress={() => setMode("down")} activeOpacity={0.7}>
                <Text style={[styles.segText, !isUp && { color: colors.text }]}>▼ Downward ({split.down.length})</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.block, { marginTop: 14 }]}>
              <Text style={styles.h2}>{isUp ? "Minimum profit" : "Maximum loss"}</Text>
              <Text style={styles.hint}>
                {isUp
                  ? "Sell smaller coins to buy a bigger one (also same-size swaps). Only swaps that earn at least this much, as a share of the money you receive."
                  : "Sell a bigger coin to buy smaller ones. Shows swaps that lose at most this much (a swap that earns something always shows)."}
              </Text>
              {isUp ? (
                <PctInput value={settings.thresholdPct} min={0.1} max={100} onCommit={(v) => update({ thresholdPct: v })} />
              ) : (
                <PctInput value={settings.maxLossPct} min={0} max={50} onCommit={(v) => update({ maxLossPct: v })} />
              )}
              <View style={[styles.rowBetween, { marginTop: 12, marginBottom: 0 }]}>
                <Text style={[styles.hint, { flex: 1, marginTop: 0 }]}>Notify me about {isUp ? "upward" : "downward"} swaps</Text>
                <Switch
                  value={isUp ? settings.notifyUp : settings.notifyDown}
                  onValueChange={(v) => update(isUp ? { notifyUp: v } : { notifyDown: v })}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>
            </View>

            <View style={styles.block}>
              <Text style={styles.h2}>{isUp ? "Upward options" : "Downward options"}</Text>
              {!ready ? (
                <Text style={styles.hint}>Pick at least one coin you have and one you'd buy.</Text>
              ) : shown.length ? (
                shown.map((x) => <SwapCard key={x.key} s={x} trend={trendOf(x)} />)
              ) : (
                <>
                  <Text style={styles.hint}>
                    {isUp ? `Nothing earns ${settings.thresholdPct}% or more right now.` : `Nothing loses ${settings.maxLossPct}% or less right now.`}
                  </Text>
                  {closest.length ? <Text style={[styles.hint, { marginTop: 8 }]}>Closest options:</Text> : null}
                  {closest.map((x) => <SwapCard key={x.key} s={x} trend={trendOf(x)} />)}
                </>
              )}
              <Text style={styles.foot}>
                Card colour: green = gain of 0.5% or more, red = loss of 0.5% or more, grey = in between. The arrow in brackets compares this swap with about 2 hours ago (– means no saved price from around then yet). Prices: you receive the site's "Buy" price when you sell, and pay its "Sell" price when you buy, so the spread is already counted. Coins with no whole-number match in gold weight (e.g. the 1 g coin) are skipped.
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  backdrop: { flex: 1 },
  panel: { backgroundColor: colors.background, borderColor: colors.border, paddingTop: 44, paddingHorizontal: 16 },
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
  segRow: { flexDirection: "row", marginTop: 4 },
  seg: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: -1 },
  segOn: { backgroundColor: colors.primaryMuted, borderColor: colors.primary, zIndex: 1 },
  segText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  groupHead: { fontSize: 12, fontWeight: "700", marginTop: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  dirTag: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, marginLeft: 8 },
  dirTagText: { fontSize: 11, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, marginTop: 8 },
  profit: { fontSize: 14, fontWeight: "700" },
  legTag: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 6 },
  legName: { color: colors.text, fontSize: 14, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  legPrice: { color: colors.textMuted, fontSize: 12, textAlign: "right" },
});
