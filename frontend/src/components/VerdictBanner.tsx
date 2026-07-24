import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RainResult } from "../types";

export function rainWindowText(result: RainResult): string | null {
  const start = result.rainStartMin;
  const end = result.rainEndMin;
  if (start == null || end == null) return null;
  const base =
    start === 0
      ? end === 0
        ? "出發時就會遇雨"
        : `出發就會遇雨，約持續到第 ${end} 分鐘`
      : start === end
        ? `出發後約第 ${start} 分鐘會遇雨`
        : `出發後第 ${start}~${end} 分鐘會遇雨`;
  return result.nowcast ? `${base}（含雨區移動預測）` : base;
}

export function VerdictBanner({ result }: { result: RainResult | null }) {
  if (!result) return null;
  const recommend = result.verdict === "raincoat_recommended";
  const windowText = result.wetSegments.length > 0 ? rainWindowText(result) : null;
  const sub =
    windowText ??
    (result.wetSegments.length > 0
      ? recommend
        ? `沿途約 ${result.wetSegments.length} 個點有雨`
        : null
      : result.nowcast
        ? "全程預計無雨（含雨區移動預測）"
        : "目前雷達顯示全程無雨");
  return (
    <View style={[styles.banner, { backgroundColor: recommend ? "#d64545" : "#2e9e5b" }]}>
      <Text style={styles.text}>{recommend ? "建議穿雨衣 ☔" : "不需要穿雨衣 ☀"}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, alignItems: "center" },
  text: { color: "white", fontSize: 20, fontWeight: "700" },
  sub: { color: "white", fontSize: 13, marginTop: 4 },
});
