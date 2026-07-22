import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RainResult } from "../types";

export function VerdictBanner({ result }: { result: RainResult | null }) {
  if (!result) return null;
  const recommend = result.verdict === "raincoat_recommended";
  return (
    <View style={[styles.banner, { backgroundColor: recommend ? "#d64545" : "#2e9e5b" }]}>
      <Text style={styles.text}>{recommend ? "建議穿雨衣 ☔" : "不需要穿雨衣 ☀"}</Text>
      {recommend && result.wetSegments.length > 0 && (
        <Text style={styles.sub}>沿途約 {result.wetSegments.length} 個點有雨</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, alignItems: "center" },
  text: { color: "white", fontSize: 20, fontWeight: "700" },
  sub: { color: "white", fontSize: 13, marginTop: 4 },
});
