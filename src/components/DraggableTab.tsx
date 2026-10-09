import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, Vibration, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme";

export type Side = "left" | "right";

const TAB_W = 34;
const TAB_H = 70;
const LONG_PRESS_MS = 350;
const TOP_MIN = 70; // keep clear of the status bar / header
const BOTTOM_GAP = 24;
const KEY = "gold:swapTabPos";

/**
 * Edge tab: tap = open. Press and hold = it starts following your finger; let go
 * and it sticks to the nearest side (left or right) at the height you left it.
 * The place is remembered.
 */
export default function DraggableTab({
  width,
  height,
  count,
  onPress,
  onSideChange,
}: {
  width: number;
  height: number;
  count: number;
  onPress: () => void;
  onSideChange: (s: Side) => void;
}) {
  const [side, setSide] = useState<Side>("right");
  const [dragging, setDragging] = useState(false);

  const pos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const cur = useRef({ x: 0, y: 0 });
  const dims = useRef({ w: width, h: height });
  const sideRef = useRef<Side>("right");
  const yFrac = useRef(0.3);
  const cbs = useRef({ onPress, onSideChange });
  const drag = useRef({ on: false, moved: false, startX: 0, startY: 0, baseDx: 0, baseDy: 0, dx: 0, dy: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  dims.current = { w: width, h: height };
  cbs.current = { onPress, onSideChange };

  const clampY = (y: number) => Math.min(Math.max(y, TOP_MIN), Math.max(TOP_MIN, dims.current.h - TAB_H - BOTTOM_GAP));
  const restX = (s: Side) => (s === "right" ? dims.current.w - TAB_W : 0);

  useEffect(() => {
    const id = pos.addListener((v) => (cur.current = v));
    return () => pos.removeListener(id);
  }, [pos]);

  // restore the saved place
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const j = JSON.parse(raw);
        if (j.side === "left" || j.side === "right") {
          sideRef.current = j.side;
          setSide(j.side);
          cbs.current.onSideChange(j.side);
        }
        if (Number.isFinite(j.yFrac)) yFrac.current = Math.min(1, Math.max(0, j.yFrac));
        pos.setValue({ x: restX(sideRef.current), y: clampY(yFrac.current * dims.current.h) });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // (re)place on size change
  useEffect(() => {
    if (!drag.current.on) pos.setValue({ x: restX(sideRef.current), y: clampY(yFrac.current * height) });
  }, [width, height]); // eslint-disable-line react-hooks/exhaustive-deps

  const snap = () => {
    const centerX = cur.current.x + TAB_W / 2;
    const s: Side = centerX < dims.current.w / 2 ? "left" : "right";
    const y = clampY(cur.current.y);
    yFrac.current = y / dims.current.h;
    sideRef.current = s;
    setSide(s);
    cbs.current.onSideChange(s);
    Animated.spring(pos, { toValue: { x: restX(s), y }, useNativeDriver: false, friction: 7 }).start();
    AsyncStorage.setItem(KEY, JSON.stringify({ side: s, yFrac: yFrac.current })).catch(() => {});
  };

  const finish = (allowTap: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    const d = drag.current;
    if (d.on) snap();
    else if (allowTap && !d.moved) cbs.current.onPress();
    d.on = false;
    d.moved = false;
    setDragging(false);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const d = drag.current;
        d.on = false;
        d.moved = false;
        d.dx = 0;
        d.dy = 0;
        timer.current = setTimeout(() => {
          d.on = true;
          d.startX = cur.current.x;
          d.startY = cur.current.y;
          d.baseDx = d.dx;
          d.baseDy = d.dy;
          setDragging(true);
          try {
            Vibration.vibrate(20);
          } catch {
            /* ignore */
          }
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_e, g) => {
        const d = drag.current;
        d.dx = g.dx;
        d.dy = g.dy;
        if (!d.on) {
          if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
            d.moved = true; // a swipe before the hold finished: not a tap, not a drag
            if (timer.current) clearTimeout(timer.current);
          }
          return;
        }
        const x = Math.min(Math.max(d.startX + (g.dx - d.baseDx), 0), dims.current.w - TAB_W);
        const y = Math.min(Math.max(d.startY + (g.dy - d.baseDy), 0), dims.current.h - TAB_H);
        pos.setValue({ x, y });
      },
      onPanResponderRelease: () => finish(true),
      onPanResponderTerminate: () => finish(false),
    })
  ).current;

  const shape = dragging ? styles.floating : side === "right" ? styles.dockRight : styles.dockLeft;

  return (
    <Animated.View {...pan.panHandlers} style={[styles.tab, shape, { transform: pos.getTranslateTransform() }]}>
      <Text style={styles.arrow}>{side === "right" ? "‹" : "›"}</Text>
      {count > 0 ? (
        <View style={[styles.badge, side === "right" ? { left: -8 } : { right: -8 }]}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: "absolute",
    left: 0,
    top: 0,
    width: TAB_W,
    height: TAB_H,
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.primary,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    zIndex: 10,
  },
  dockRight: { borderRightWidth: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  dockLeft: { borderLeftWidth: 0, borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  floating: { borderRadius: 14, elevation: 12, opacity: 0.95 },
  arrow: { color: colors.text, fontSize: 30, lineHeight: 34, fontWeight: "700" },
  badge: { position: "absolute", top: -8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.positive, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#02210f", fontSize: 12, fontWeight: "700" },
});
