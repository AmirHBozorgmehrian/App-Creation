import React, { useState } from "react";
import { View, Text, StyleSheet, LayoutChangeEvent } from "react-native";
import Svg, { Polyline, Line } from "react-native-svg";
import { colors } from "../theme";
import { fmtInt } from "../utils/format";

export interface Series { values: (number | null)[]; color: string }

export default function MiniChart({
  series,
  startLabel,
  endLabel,
  height = 206,
}: {
  series: Series[];
  startLabel?: string;
  endLabel?: string;
  height?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const padX = 8;
  const padTop = 18;
  const padBottom = 38; // room under the lowest gridline for the min label + dates
  const x = (i: number) => padX + (i / Math.max(1, n - 1)) * Math.max(0, w - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (height - padTop - padBottom);

  return (
    <View onLayout={onLayout} style={[styles.box, { height }]}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {[0, 0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={w} y1={y(min + span * f)} y2={y(min + span * f)} stroke={colors.border} strokeWidth={1} />
          ))}
          {series.map((s, si) => (
            <Polyline
              key={si}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              points={s.values
                .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
                .filter(Boolean)
                .join(" ")}
            />
          ))}
        </Svg>
      )}
      <Text style={[styles.lbl, { top: 2, left: 8 }]}>{fmtInt(max)}</Text>
      <Text style={[styles.lbl, { top: height - padBottom + 3, left: 8 }]}>{fmtInt(min)}</Text>
      {startLabel ? <Text style={[styles.lbl, { bottom: 3, left: 8 }]}>{startLabel}</Text> : null}
      {endLabel ? <Text style={[styles.lbl, { bottom: 3, right: 8 }]}>{endLabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  lbl: { position: "absolute", fontSize: 10, color: colors.textMuted },
});
