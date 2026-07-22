import React, { useState } from "react";
import { View, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { RainLegend } from "./components/RainLegend";
import { VerdictBanner } from "./components/VerdictBanner";
import { planRoute, checkRain } from "./api";
import { RouteResult, RainResult, GeocodeCandidate } from "./types";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(origin: GeocodeCandidate, destination: GeocodeCandidate) {
    if (loading) return;
    setRoute(null);
    setRain(null);
    setLoading(true);
    try {
      const r = await planRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng });
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
      <RouteSearch onSubmit={onSubmit} disabled={loading} />
      <View style={styles.map}>
        <RainMap route={route} rain={rain} />
        <RainLegend />
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
});
