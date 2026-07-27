import { useEffect, useRef, useState } from "react";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { RainLegend } from "./components/RainLegend";
import { VerdictBanner } from "./components/VerdictBanner";
import { motionSummary } from "./animate";
import { planRoute, checkRain, fetchOverlay } from "./api";
import { loadHistory, saveHistory, type HistoryEntry } from "./history";
import type { RouteResult, RainResult, GeocodeCandidate, Overlay } from "./types";
import "./MainScreen.css";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simT, setSimT] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdRef = useRef<number | null>(null);

  const PLAYBACK_WALL_MS = 10_000;

  function stopPlayback() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (holdRef.current != null) window.clearTimeout(holdRef.current);
    rafRef.current = null;
    holdRef.current = null;
    setSimT(null);
  }

  useEffect(() => stopPlayback, []);

  function playForecast() {
    if (!route) return;
    stopPlayback();
    const durS = route.durationS;
    const start = performance.now();
    const tick = (now: number) => {
      const frac = (now - start) / PLAYBACK_WALL_MS;
      if (frac >= 1) {
        setSimT(durS);
        rafRef.current = null;
        holdRef.current = window.setTimeout(() => setSimT(null), 1500);
        return;
      }
      setSimT(frac * durS);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function onSubmit(origin: GeocodeCandidate, destination: GeocodeCandidate) {
    if (loading) return;
    stopPlayback();
    setRoute(null);
    setRain(null);
    setOverlay(null);
    setError(null);
    setLoading(true);
    try {
      const r = await planRoute({ lat: origin.lat, lng: origin.lng }, { lat: destination.lat, lng: destination.lng });
      setRoute(r);
      setHistory(saveHistory({ origin, destination }));
      setRain(await checkRain(r.polyline, r.durationS));
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onShowRadar() {
    if (loading) return;
    stopPlayback();
    setRoute(null);
    setRain(null);
    setOverlay(null);
    setError(null);
    setLoading(true);
    try {
      setOverlay(await fetchOverlay());
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rr-root">
      <VerdictBanner result={rain} />
      <RouteSearch onSubmit={onSubmit} onShowRadar={onShowRadar} history={history} disabled={loading} />
      {error && <div className="rr-error">{error}</div>}
      <div className="rr-map-wrap">
        <RainMap
          route={route}
          overlay={rain?.overlay ?? overlay}
          motion={rain?.motion ?? null}
          durationS={route?.durationS ?? null}
          simT={simT}
        />
        <RainLegend />
        {route && rain && !loading && (
          <div className="rr-play-stack">
            {simT == null ? (
              <button className="rr-play" onClick={playForecast}>▶ 播放預測</button>
            ) : (
              <div className="rr-play rr-play-label">出發後 +{Math.round(simT / 60)} 分</div>
            )}
            <div className="rr-motion-note">{motionSummary(rain.motion)}</div>
          </div>
        )}
        {loading && <div className="rr-loading">讀取中…</div>}
      </div>
    </div>
  );
}
