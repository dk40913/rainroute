import React from "react";
import { Map, Camera, GeoJSONSource, ImageSource, Layer } from "@maplibre/maplibre-react-native";
import { RouteResult, RainResult } from "../types";
import { resolveUrl } from "../api";

// Free, key-less vector style.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function RainMap({ route, rain }: { route: RouteResult | null; rain: RainResult | null }) {
  const lineGeoJSON = route && {
    type: "Feature" as const,
    geometry: { type: "LineString" as const, coordinates: route.polyline.map(([lat, lng]) => [lng, lat]) },
    properties: {},
  };

  // route.polyline is [lat, lng] pairs -> bounds as [west, south, east, north]
  const routeBounds = route && (() => {
    const lats = route.polyline.map(([lat]) => lat);
    const lngs = route.polyline.map(([, lng]) => lng);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] as [
      number,
      number,
      number,
      number,
    ];
  })();

  // bbox = [west, south, east, north] -> 4 corners clockwise from top-left
  const corners = rain && (() => {
    const [w, s, e, n] = rain.overlay.bbox;
    return [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];
  })();

  // Origin/destination pins at the route endpoints (green start, red end).
  const endpointsGeoJSON = route && {
    type: "FeatureCollection" as const,
    features: [
      { kind: "origin", point: route.polyline[0] },
      { kind: "destination", point: route.polyline[route.polyline.length - 1] },
    ].map(({ kind, point: [lat, lng] }) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lng, lat] },
      properties: { kind },
    })),
  };

  return (
    <Map style={{ flex: 1 }} mapStyle={STYLE_URL}>
      {routeBounds ? (
        <Camera bounds={routeBounds} padding={{ top: 50, right: 50, bottom: 50, left: 50 }} />
      ) : (
        <Camera initialViewState={{ center: [121.0, 23.7], zoom: 6.5 }} />
      )}

      {corners && (
        <ImageSource id="radar" coordinates={corners} url={resolveUrl(rain!.overlay.imageUrl)}>
          <Layer type="raster" id="radar-layer" paint={{ "raster-opacity": 0.5 }} />
        </ImageSource>
      )}

      {lineGeoJSON && (
        <GeoJSONSource id="route" data={lineGeoJSON}>
          <Layer type="line" id="route-line" paint={{ "line-color": "#1565c0", "line-width": 4 }} />
        </GeoJSONSource>
      )}

      {endpointsGeoJSON && (
        <GeoJSONSource id="route-endpoints" data={endpointsGeoJSON}>
          <Layer
            type="circle"
            id="route-endpoint-dots"
            paint={{
              "circle-radius": 8,
              "circle-color": ["match", ["get", "kind"], "origin", "#2e9e5b", "#d64545"],
              "circle-stroke-width": 2.5,
              "circle-stroke-color": "#ffffff",
            }}
          />
        </GeoJSONSource>
      )}
    </Map>
  );
}
