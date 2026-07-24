import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { RainLegend } from "./components/RainLegend";
import { VerdictBanner } from "./components/VerdictBanner";
import { planRoute, checkRain, fetchOverlay } from "./api";
import { loadHistory, saveHistory, HistoryEntry } from "./history";
import { RouteResult, RainResult, GeocodeCandidate, Overlay } from "./types";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  async function onSubmit(origin: GeocodeCandidate, destination: GeocodeCandidate) {
    if (loading) return;
    setRoute(null);
    setRain(null);
    setOverlay(null);
    setLoading(true);
    try {
      const r = await planRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng });
      setRoute(r);
      setHistory(await saveHistory({ origin, destination }));
      setRain(await checkRain(r.polyline, r.durationS));
    } catch (e: any) {
      Alert.alert("查詢失敗", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onShowRadar() {
    if (loading) return;
    setRoute(null);
    setRain(null);
    setOverlay(null);
    setLoading(true);
    try {
      setOverlay(await fetchOverlay());
    } catch (e: any) {
      Alert.alert("查詢失敗", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <VerdictBanner result={rain} />
      <RouteSearch onSubmit={onSubmit} onShowRadar={onShowRadar} history={history} disabled={loading} />
      <View style={styles.map}>
        <RainMap route={route} overlay={rain?.overlay ?? overlay} />
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
