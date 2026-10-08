import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { colors } from "../theme";
import { fmtInt } from "../utils/format";

export default function MiniChart({ values, height = 170 }: { values: number[]; height?: number }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 8;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(1, values.length - 1)) * Math.max(0, w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = values[values.length - 1] >= values[0];

  return (
    <View onLayout={onLayout} style={[styles.box, { height }]}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <Polyline points={pts} fill="none" stroke={up ? colors.positive : colors.negative} strokeWidth={2} />
        </Svg>
      )}
      <Text style={[styles.lbl, { top: 2 }]}>{fmtInt(max)}</Text>
      <Text style={[styles.lbl, { bottom: 2 }]}>{fmtInt(min)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  lbl: { position: "absolute", left: 8, fontSize: 10, color: colors.textMuted },
});
