import { BACKEND_BASE_URL } from "./config";
import { GeocodeCandidate, LatLng, RouteResult, RainResult } from "./types";

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

export async function checkRain(polyline: [number, number][]): Promise<RainResult> {
  const d = await post<any>("/rain", { polyline });
  return {
    verdict: d.verdict, maxLevel: d.max_level,
    wetSegments: d.wet_segments, radarTime: d.radar_time,
    overlay: { imageUrl: d.overlay.image_url, bbox: d.overlay.bbox },
  };
}

export function resolveUrl(path: string): string {
  return path.startsWith("http") ? path : `${BACKEND_BASE_URL}${path}`;
}
