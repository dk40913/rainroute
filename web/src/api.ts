import { BACKEND_BASE_URL } from "./config";
import type { GeocodeCandidate, LatLng, OverlayResult, RouteResult, RainResult, WetSegment } from "./types";

type RainWire = {
  verdict: "raincoat_recommended" | "no_raincoat_needed";
  max_level: string;
  wet_segments: WetSegment[];
  radar_time: string;
  overlay: { image_url: string; bbox: [number, number, number, number] };
  nowcast?: boolean;
  rain_start_min?: number | null;
  rain_end_min?: number | null;
  rain_nearby?: boolean;
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${path} failed: ${resp.status}`);
  return (await resp.json()) as T;
}

export async function geocode(query: string): Promise<GeocodeCandidate[]> {
  const data = await post<{ candidates: GeocodeCandidate[] }>("/geocode", { query });
  return data.candidates;
}

export async function planRoute(origin: LatLng, destination: LatLng): Promise<RouteResult> {
  const d = await post<{ polyline: [number, number][]; distance_m: number; duration_s: number }>(
    "/route", { origin, destination });
  return { polyline: d.polyline, distanceM: d.distance_m, durationS: d.duration_s };
}

export async function checkRain(polyline: [number, number][], durationS?: number): Promise<RainResult> {
  const d = await post<RainWire>("/rain", { polyline, duration_s: durationS ?? null });
  return {
    verdict: d.verdict, maxLevel: d.max_level,
    wetSegments: d.wet_segments, radarTime: d.radar_time,
    overlay: { imageUrl: d.overlay.image_url, bbox: d.overlay.bbox },
    nowcast: d.nowcast ?? false,
    rainStartMin: d.rain_start_min ?? null,
    rainEndMin: d.rain_end_min ?? null,
    rainNearby: d.rain_nearby ?? false,
  };
}

export async function fetchOverlay(): Promise<OverlayResult> {
  const resp = await fetch(`${BACKEND_BASE_URL}/overlay`);
  if (!resp.ok) throw new Error(`/overlay failed: ${resp.status}`);
  const d = (await resp.json()) as { image_url: string; bbox: [number, number, number, number]; radar_time: string };
  return { imageUrl: d.image_url, bbox: d.bbox, radarTime: d.radar_time };
}

export function resolveUrl(path: string): string {
  return path.startsWith("http") ? path : `${BACKEND_BASE_URL}${path}`;
}
