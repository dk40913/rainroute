import React, { useState } from "react";
import { View, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { VerdictBanner } from "./components/VerdictBanner";
import { geocode, planRoute, checkRain } from "./api";
import { RouteResult, RainResult } from "./types";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(originText: string, destText: string) {
    setLoading(true);
    try {
      const [o, d] = await Promise.all([geocode(originText), geocode(destText)]);
      if (!o.length || !d.length) throw new Error("找不到地點");
      const r = await planRoute({ lat: o[0].lat, lng: o[0].lng }, { lat: d[0].lat, lng: d[0].lng });
      setRoute(r);
      setRain(await checkRain(r.polyline));
    } catch (e: any) {
      Alert.alert("查詢失敗", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <VerdictBanner result={rain} />
      <RouteSearch onSubmit={onSubmit} />
      <View style={styles.map}>
        <RainMap route={route} rain={rain} />
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
});
