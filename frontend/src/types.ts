export type LatLng = { lat: number; lng: number };
export type GeocodeCandidate = { name: string; lat: number; lng: number; approximate?: boolean };
export type RouteResult = { polyline: [number, number][]; distanceM: number; durationS: number };
export type WetSegment = { index: number; lat: number; lng: number; level: string };
export type Overlay = { imageUrl: string; bbox: [number, number, number, number] };
export type RainResult = {
  verdict: "raincoat_recommended" | "no_raincoat_needed";
  maxLevel: string;
  wetSegments: WetSegment[];
  radarTime: string;
  overlay: Overlay;
};
