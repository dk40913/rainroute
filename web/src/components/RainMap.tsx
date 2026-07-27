import { useEffect, useRef, useState } from "react";
import { MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource, type ImageSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// Vite doesn't emit maplibre's tile-parsing worker on its own, and the worker
// file imports a sibling module (./maplibre-gl-shared.mjs) — so a plain ?url
// asset would 404 its dependency inside the worker. ?worker&url makes Vite
// bundle the worker WITH its imports into one standalone file and return its URL.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(maplibreWorkerUrl);
import type { MotionVector, Overlay, RouteResult } from "../types";
import { cumulativeMeters, slicePolyline, shiftedBbox } from "../animate";
import { resolveUrl } from "../api";

type GeoJSONLineFeature = {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: Record<string, never>;
};

// Free, key-less vector style.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const ROUTE_SOURCE_ID = "route";
const ROUTE_LAYER_ID = "route-line";
const RADAR_SOURCE_ID = "radar";
const RADAR_LAYER_ID = "radar-layer";

function lineFeature(coords: [number, number][]): GeoJSONLineFeature {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords.map(([lat, lng]) => [lng, lat]) },
    properties: {},
  };
}

export function RainMap({
  route,
  overlay,
  motion,
  durationS,
  simT,
}: {
  route: RouteResult | null;
  overlay: Overlay | null;
  motion?: MotionVector | null;
  durationS?: number | null;
  simT?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const originMarkerRef = useRef<Marker | null>(null);
  const destMarkerRef = useRef<Marker | null>(null);
  const riderMarkerRef = useRef<Marker | null>(null);
  const cumRef = useRef<number[]>([]);
  const [ready, setReady] = useState(false);

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [121.0, 23.7],
      zoom: 6.5,
    });
    mapRef.current = map;
    map.on("load", () => setReady(true));

    // MapLibre only re-syncs its canvas on the browser's own `resize` event;
    // it doesn't notice container-only size changes (e.g. flex layout
    // shifting when the error banner or loading overlay appears/disappears
    // after submitting a route). Without this the canvas keeps its stale
    // drawing-buffer size, producing washed-out/misaligned tiles or making
    // the map appear to vanish.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Route line + camera fit.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!route) {
      if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      return;
    }

    cumRef.current = cumulativeMeters(route.polyline);
    const lineGeoJSON = lineFeature(route.polyline);

    const existingSource = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(lineGeoJSON);
    } else {
      map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data: lineGeoJSON });
      map.addLayer({
        id: ROUTE_LAYER_ID,
        type: "line",
        source: ROUTE_SOURCE_ID,
        paint: { "line-color": "#1565c0", "line-width": 4 },
      });
    }

    // Origin (green) and destination (red) pins at the route endpoints.
    const [oLat, oLng] = route.polyline[0];
    const [dLat, dLng] = route.polyline[route.polyline.length - 1];
    if (!originMarkerRef.current) {
      originMarkerRef.current = new Marker({ color: "#2e9e5b" }).setLngLat([oLng, oLat]).addTo(map);
    } else {
      originMarkerRef.current.setLngLat([oLng, oLat]);
    }
    if (!destMarkerRef.current) {
      destMarkerRef.current = new Marker({ color: "#d64545" }).setLngLat([dLng, dLat]).addTo(map);
    } else {
      destMarkerRef.current.setLngLat([dLng, dLat]);
    }

    // route.polyline is [lat, lng] pairs -> bounds as [west, south, east, north]
    const lats = route.polyline.map(([lat]) => lat);
    const lngs = route.polyline.map(([, lng]) => lng);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 60 });
  }, [route, ready]);

  // Radar overlay image.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!overlay) {
      if (map.getLayer(RADAR_LAYER_ID)) map.removeLayer(RADAR_LAYER_ID);
      if (map.getSource(RADAR_SOURCE_ID)) map.removeSource(RADAR_SOURCE_ID);
      return;
    }

    // bbox = [west, south, east, north] -> 4 corners clockwise from top-left
    const [w, s, e, n] = overlay.bbox;
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [
      [w, n],
      [e, n],
      [e, s],
      [w, s],
    ];
    const url = resolveUrl(overlay.imageUrl);

    const existingSource = map.getSource(RADAR_SOURCE_ID) as ImageSource | undefined;
    if (existingSource) {
      existingSource.updateImage({ url, coordinates });
    } else {
      map.addSource(RADAR_SOURCE_ID, { type: "image", url, coordinates });
      // Keep the route line rendered above the radar overlay regardless of
      // which of the two was added to the map first.
      const beforeId = map.getLayer(ROUTE_LAYER_ID) ? ROUTE_LAYER_ID : undefined;
      map.addLayer(
        { id: RADAR_LAYER_ID, type: "raster", source: RADAR_SOURCE_ID, paint: { "raster-opacity": 0.5 } },
        beforeId,
      );
    }
  }, [overlay, ready]);

  // Forecast playback: grow the route line to the rider's simulated position
  // and translate the radar overlay along the estimated motion vector.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const routeSource = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;
    const radarSource = map.getSource(RADAR_SOURCE_ID) as ImageSource | undefined;

    const cornersFor = (bbox: [number, number, number, number]) => {
      const [w, s, e, n] = bbox;
      return [[w, n], [e, n], [e, s], [w, s]] as [
        [number, number], [number, number], [number, number], [number, number],
      ];
    };

    if (simT == null || !route) {
      // Playback finished/cancelled — restore the live view.
      if (route && routeSource) routeSource.setData(lineFeature(route.polyline));
      if (overlay && radarSource) radarSource.setCoordinates(cornersFor(overlay.bbox));
      riderMarkerRef.current?.remove();
      riderMarkerRef.current = null;
      return;
    }

    const frac = durationS ? Math.min(1, simT / durationS) : 0;
    const sliced = slicePolyline(route.polyline, cumRef.current, frac);
    if (routeSource) routeSource.setData(lineFeature(sliced));

    const [headLat, headLng] = sliced[sliced.length - 1];
    if (!riderMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "rr-rider";
      el.textContent = "🛵";
      riderMarkerRef.current = new Marker({ element: el }).setLngLat([headLng, headLat]).addTo(map);
    } else {
      riderMarkerRef.current.setLngLat([headLng, headLat]);
    }

    if (overlay && motion && radarSource) {
      radarSource.setCoordinates(cornersFor(shiftedBbox(overlay.bbox, motion, simT)));
    }
  }, [simT, route, overlay, motion, durationS, ready]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
