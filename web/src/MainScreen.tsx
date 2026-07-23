import { useState } from "react";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { RainLegend } from "./components/RainLegend";
import { VerdictBanner } from "./components/VerdictBanner";
import { planRoute, checkRain } from "./api";
import type { RouteResult, RainResult, GeocodeCandidate } from "./types";
import "./MainScreen.css";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(origin: GeocodeCandidate, destination: GeocodeCandidate) {
    if (loading) return;
    setRoute(null);
    setRain(null);
    setError(null);
    setLoading(true);
    try {
      const r = await planRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng });
      setRoute(r);
      setRain(await checkRain(r.polyline));
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rr-root">
      <VerdictBanner result={rain} />
      <RouteSearch onSubmit={onSubmit} disabled={loading} />
      {error && <div className="rr-error">{error}</div>}
      <div className="rr-map-wrap">
        <RainMap route={route} rain={rain} />
        <RainLegend />
        {loading && <div className="rr-loading">讀取中…</div>}
      </div>
    </div>
  );
}
