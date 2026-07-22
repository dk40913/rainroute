import React from "react";
import { View, Text, StyleSheet } from "react-native";

// Representative subset of app/palette.py PALETTE anchors, in dBZ order,
// grouped by RainLevel band (LIGHT | MODERATE | HEAVY).
const BANDS: { colors: string[]; label: string }[] = [
  {
    label: "小雨",
    colors: ["#00DAFF", "#00A0FF", "#005BFF", "#0000FF"],
  },
  {
    label: "中雨",
    colors: ["#009600", "#00C800", "#00FF00", "#CCEA00", "#FFFF00"],
  },
  {
    label: "大雨",
    colors: ["#FF9800", "#FF6000", "#FF0000", "#D600D6"],
  },
];

export function RainLegend() {
  return (
    <View style={styles.card} pointerEvents="none">
      <View style={styles.strip}>
        {BANDS.flatMap((band) => band.colors).map((color, i, all) => (
          <View
            key={`${color}-${i}`}
            style={[
              styles.block,
              { backgroundColor: color },
              i === 0 && styles.blockStart,
              i === all.length - 1 && styles.blockEnd,
            ]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {BANDS.map((band) => (
          <Text key={band.label} style={[styles.label, { flex: band.colors.length }]}>
            {band.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    bottom: 24,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 8,
    width: 160,
  },
  strip: { flexDirection: "row", height: 9 },
  block: { flex: 1 },
  blockStart: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  blockEnd: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  labels: { flexDirection: "row", marginTop: 4 },
  label: { fontSize: 12, color: "#222", textAlign: "center" },
});
