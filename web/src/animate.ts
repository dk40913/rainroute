// Pure helpers for the forecast playback animation: the ride is replayed at
// constant speed along the route while the radar overlay translates along the
// estimated rain-field motion — literally rendering the nowcast model.
import type { MotionVector } from "./types";

const EARTH_R = 6_371_000;

export function haversineM(a: [number, number], b: [number, number]): number {
  const [lat1, lon1] = a.map((v) => (v * Math.PI) / 180);
  const [lat2, lon2] = b.map((v) => (v * Math.PI) / 180);
  const h =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function cumulativeMeters(polyline: [number, number][]): number[] {
  const cum = [0];
  for (let i = 1; i < polyline.length; i++) {
    cum.push(cum[i - 1] + haversineM(polyline[i - 1], polyline[i]));
  }
  return cum;
}

/** Route prefix travelled after `frac` (0..1) of the total distance; the head
 * point is interpolated so the line grows smoothly. Always ≥ 2 points so the
 * result stays a valid LineString. */
export function slicePolyline(
  polyline: [number, number][],
  cum: number[],
  frac: number,
): [number, number][] {
  if (polyline.length < 2) return polyline;
  const total = cum[cum.length - 1];
  if (frac >= 1 || total === 0) return polyline;
  const target = Math.max(0, frac) * total;
  let i = 0;
  while (i + 1 < cum.length && cum[i + 1] <= target) i++;
  const segLen = cum[i + 1] - cum[i];
  const f = segLen > 0 ? (target - cum[i]) / segLen : 0;
  const head: [number, number] = [
    polyline[i][0] + (polyline[i + 1][0] - polyline[i][0]) * f,
    polyline[i][1] + (polyline[i + 1][1] - polyline[i][1]) * f,
  ];
  return [...polyline.slice(0, i + 1), head];
}

const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

/** Human-readable summary of the rain-field motion for the playback UI. */
export function motionSummary(motion: MotionVector | null | undefined): string {
  if (!motion) return "雨區移動向量暖機中（約 10 分鐘）";
  const vNorth = motion.dlatPerS * 111.0 * 3600;
  const vEast = motion.dlngPerS * 111.0 * Math.cos((23.5 * Math.PI) / 180) * 3600;
  const speed = Math.hypot(vNorth, vEast);
  if (speed < 1) return "雨區目前接近靜止";
  const bearing = ((Math.atan2(vEast, vNorth) * 180) / Math.PI + 360) % 360;
  const arrow = ARROWS[Math.round(bearing / 45) % 8];
  return `雨區以 ${speed.toFixed(speed < 10 ? 1 : 0)} km/h ${arrow} 移動`;
}

/** Overlay bbox translated along the motion vector after `tS` seconds. */
export function shiftedBbox(
  bbox: [number, number, number, number],
  motion: MotionVector,
  tS: number,
): [number, number, number, number] {
  const [w, s, e, n] = bbox;
  const dlng = motion.dlngPerS * tS;
  const dlat = motion.dlatPerS * tS;
  return [w + dlng, s + dlat, e + dlng, n + dlat];
}
