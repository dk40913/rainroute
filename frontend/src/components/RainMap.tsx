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

  // bbox = [west, south, east, north] -> 4 corners clockwise from top-left
  const corners = rain && (() => {
    const [w, s, e, n] = rain.overlay.bbox;
    return [[w, n], [e, n], [e, s], [w, s]] as [[number, number], [number, number], [number, number], [number, number]];
  })();

  return (
    <Map style={{ flex: 1 }} mapStyle={STYLE_URL}>
      <Camera initialViewState={{ center: [121.0, 23.7], zoom: 6.5 }} />

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
    </Map>
  );
}
