import React from "react";
import { View, Text, StyleSheet } from "react-native";

const ITEMS = [
  { color: "#1E90FF", label: "小雨" },
  { color: "#9ACD32", label: "中雨" },
  { color: "#FF4500", label: "大雨" },
];

export function RainLegend() {
  return (
    <View style={styles.card}>
      {ITEMS.map((item) => (
        <View key={item.label} style={styles.row}>
          <View style={[styles.swatch, { backgroundColor: item.color }]} />
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
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
    gap: 4,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  label: { fontSize: 12, color: "#222" },
});
