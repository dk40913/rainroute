# RainRoute Frontend (Expo App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo (React Native) app: enter an origin and destination, draw the route on a MapLibre map, overlay the live CWA rain radar, and show a one-line "wear a raincoat or not" verdict on top.

**Architecture:** A single-screen app. Pure logic (the backend API client) is unit-tested with Jest + mocked `fetch`. Presentational components (verdict banner, search bar) get React Native Testing Library render tests. The map and the full end-to-end flow are verified manually on a device/emulator because MapLibre is a native module. The backend base URL comes from Expo config `extra`, never hard-coded.

**Tech Stack:** Expo SDK 51+ (React Native), TypeScript, `@maplibre/maplibre-react-native`, Jest + `@testing-library/react-native`.

## Global Constraints

- TypeScript throughout.
- **`BACKEND_BASE_URL` is configuration**, read from `expo-constants` `extra`, never a literal in components. Changing NUC↔cloud is a one-line config change.
- MapLibre is a **native module** → the app runs in a **custom dev build** (`expo prebuild` + `expo run:*` or EAS dev client), **not** Expo Go.
- Coordinates from the backend are `[lat, lng]`; GeoJSON needs `[lng, lat]` — swap at the boundary and nowhere else.
- Verdict copy is fixed: `raincoat_recommended` → "建議穿雨衣"; `no_raincoat_needed` → "不需要穿雨衣".
- Every task ends with a commit.

---

### Task 1: Scaffold Expo app + config + backend base URL

**Files:**
- Create: `frontend/` (via `create-expo-app`)
- Create/Modify: `frontend/app.config.ts`
- Create: `frontend/src/config.ts`
- Create: `frontend/.env.example`
- Test: `frontend/src/__tests__/config.test.ts`

**Interfaces:**
- Produces: `src/config.ts` exporting `BACKEND_BASE_URL: string` read from `Constants.expoConfig.extra.backendBaseUrl`.

- [ ] **Step 1: Scaffold**

Run:
```bash
cd frontend 2>/dev/null || (npx create-expo-app@latest frontend --template blank-typescript && cd frontend)
npm i @maplibre/maplibre-react-native expo-constants
npm i -D jest jest-expo @testing-library/react-native @types/jest
```

- [ ] **Step 2: Write `frontend/app.config.ts`**

```ts
import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "RainRoute",
  slug: "rainroute",
  version: "0.1.0",
  orientation: "portrait",
  extra: {
    // Override per-device; for the NUC use the Tailscale IP, e.g. http://100.x.x.x:8000
    backendBaseUrl: process.env.RAINROUTE_BACKEND_URL ?? "http://localhost:8000",
  },
};

export default config;
```

- [ ] **Step 3: Write `frontend/.env.example`**

```bash
# Point at the NUC over Tailscale, e.g. http://100.101.102.103:8000
RAINROUTE_BACKEND_URL=http://localhost:8000
```

- [ ] **Step 4: Write `frontend/src/config.ts`**

```ts
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { backendBaseUrl?: string };

export const BACKEND_BASE_URL: string = extra.backendBaseUrl ?? "http://localhost:8000";
```

- [ ] **Step 5: Add Jest config to `frontend/package.json`**

Add:
```json
"scripts": { "test": "jest" },
"jest": { "preset": "jest-expo" }
```

- [ ] **Step 6: Write the test `frontend/src/__tests__/config.test.ts`**

```ts
jest.mock("expo-constants", () => ({
  expoConfig: { extra: { backendBaseUrl: "http://example:8000" } },
}));

test("reads backend base url from expo config", () => {
  const { BACKEND_BASE_URL } = require("../config");
  expect(BACKEND_BASE_URL).toBe("http://example:8000");
});
```

- [ ] **Step 7: Run test**

Run: `cd frontend && npm test -- config`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): scaffold Expo app with configurable backend URL"
```

---

### Task 2: Backend API client

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/types.ts`
- Test: `frontend/src/__tests__/api.test.ts`

**Interfaces:**
- Produces `src/types.ts`: `LatLng = { lat: number; lng: number }`; `GeocodeCandidate = { name: string; lat: number; lng: number }`; `RouteResult = { polyline: [number, number][]; distanceM: number; durationS: number }`; `WetSegment = { index: number; lat: number; lng: number; level: string }`; `Overlay = { imageUrl: string; bbox: [number, number, number, number] }`; `RainResult = { verdict: "raincoat_recommended" | "no_raincoat_needed"; maxLevel: string; wetSegments: WetSegment[]; radarTime: string; overlay: Overlay }`.
- Produces `src/api.ts`: `geocode(query)`, `planRoute(origin, destination)`, `checkRain(polyline)`, each returning the mapped types above.

- [ ] **Step 1: Write `frontend/src/types.ts`**

```ts
export type LatLng = { lat: number; lng: number };
export type GeocodeCandidate = { name: string; lat: number; lng: number };
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
```

- [ ] **Step 2: Write the failing test `frontend/src/__tests__/api.test.ts`**

```ts
jest.mock("expo-constants", () => ({ expoConfig: { extra: { backendBaseUrl: "http://api" } } }));
import { geocode, planRoute, checkRain } from "../api";

function mockFetchOnce(body: unknown) {
  (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
}

test("geocode maps candidates", async () => {
  mockFetchOnce({ candidates: [{ name: "台北車站", lat: 25.04, lng: 121.51 }] });
  const out = await geocode("台北車站");
  expect(out[0].name).toBe("台北車站");
  expect((global as any).fetch).toHaveBeenCalledWith(
    "http://api/geocode",
    expect.objectContaining({ method: "POST" }),
  );
});

test("planRoute maps summary fields", async () => {
  mockFetchOnce({ polyline: [[25.0, 121.0]], distance_m: 1000, duration_s: 200 });
  const out = await planRoute({ lat: 25.0, lng: 121.0 }, { lat: 25.1, lng: 121.0 });
  expect(out.distanceM).toBe(1000);
  expect(out.polyline[0]).toEqual([25.0, 121.0]);
});

test("checkRain maps verdict and overlay", async () => {
  mockFetchOnce({
    verdict: "raincoat_recommended", max_level: "heavy", wet_segments: [],
    radar_time: "t", overlay: { image_url: "/radar.png", bbox: [115, 17.75, 126.5, 29.25] },
  });
  const out = await checkRain([[25.0, 121.0]]);
  expect(out.verdict).toBe("raincoat_recommended");
  expect(out.overlay.imageUrl).toBe("/radar.png");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend && npm test -- api`
Expected: FAIL (`../api` not found).

- [ ] **Step 4: Write `frontend/src/api.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npm test -- api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api.ts frontend/src/types.ts frontend/src/__tests__/api.test.ts
git commit -m "feat(frontend): add backend API client"
```

---

### Task 3: Verdict banner component

**Files:**
- Create: `frontend/src/components/VerdictBanner.tsx`
- Test: `frontend/src/__tests__/VerdictBanner.test.tsx`

**Interfaces:**
- Produces: `VerdictBanner({ result }: { result: RainResult | null })`. `null` → nothing (returns `null`). `raincoat_recommended` → red banner "建議穿雨衣" + wet-segment count. `no_raincoat_needed` → green banner "不需要穿雨衣".

- [ ] **Step 1: Write the failing test `frontend/src/__tests__/VerdictBanner.test.tsx`**

```tsx
import React from "react";
import { render } from "@testing-library/react-native";
import { VerdictBanner } from "../components/VerdictBanner";

const base = { maxLevel: "heavy", wetSegments: [], radarTime: "t",
  overlay: { imageUrl: "/radar.png", bbox: [115, 17.75, 126.5, 29.25] as [number, number, number, number] } };

test("renders nothing when no result", () => {
  const { toJSON } = render(<VerdictBanner result={null} />);
  expect(toJSON()).toBeNull();
});

test("shows raincoat message", () => {
  const { getByText } = render(
    <VerdictBanner result={{ ...base, verdict: "raincoat_recommended" }} />);
  expect(getByText(/建議穿雨衣/)).toBeTruthy();
});

test("shows no-raincoat message", () => {
  const { getByText } = render(
    <VerdictBanner result={{ ...base, verdict: "no_raincoat_needed" }} />);
  expect(getByText(/不需要穿雨衣/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- VerdictBanner`
Expected: FAIL (component not found).

- [ ] **Step 3: Write `frontend/src/components/VerdictBanner.tsx`**

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RainResult } from "../types";

export function VerdictBanner({ result }: { result: RainResult | null }) {
  if (!result) return null;
  const recommend = result.verdict === "raincoat_recommended";
  return (
    <View style={[styles.banner, { backgroundColor: recommend ? "#d64545" : "#2e9e5b" }]}>
      <Text style={styles.text}>{recommend ? "建議穿雨衣 ☔" : "不需要穿雨衣 ☀"}</Text>
      {recommend && result.wetSegments.length > 0 && (
        <Text style={styles.sub}>沿途約 {result.wetSegments.length} 個點有雨</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { padding: 16, alignItems: "center" },
  text: { color: "white", fontSize: 20, fontWeight: "700" },
  sub: { color: "white", fontSize: 13, marginTop: 4 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- VerdictBanner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VerdictBanner.tsx frontend/src/__tests__/VerdictBanner.test.tsx
git commit -m "feat(frontend): add verdict banner component"
```

---

### Task 4: Search inputs component

**Files:**
- Create: `frontend/src/components/RouteSearch.tsx`
- Test: `frontend/src/__tests__/RouteSearch.test.tsx`

**Interfaces:**
- Produces: `RouteSearch({ onSubmit }: { onSubmit: (origin: string, destination: string) => void })`. Two text inputs (placeholders "出發地", "目的地") and a "查詢路線" button that calls `onSubmit` with the two strings.

- [ ] **Step 1: Write the failing test `frontend/src/__tests__/RouteSearch.test.tsx`**

```tsx
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { RouteSearch } from "../components/RouteSearch";

test("submits both fields", () => {
  const onSubmit = jest.fn();
  const { getByPlaceholderText, getByText } = render(<RouteSearch onSubmit={onSubmit} />);
  fireEvent.changeText(getByPlaceholderText("出發地"), "台北車站");
  fireEvent.changeText(getByPlaceholderText("目的地"), "淡水");
  fireEvent.press(getByText("查詢路線"));
  expect(onSubmit).toHaveBeenCalledWith("台北車站", "淡水");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- RouteSearch`
Expected: FAIL.

- [ ] **Step 3: Write `frontend/src/components/RouteSearch.tsx`**

```tsx
import React, { useState } from "react";
import { View, TextInput, Button, StyleSheet } from "react-native";

export function RouteSearch({ onSubmit }: { onSubmit: (o: string, d: string) => void }) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  return (
    <View style={styles.box}>
      <TextInput style={styles.input} placeholder="出發地" value={origin} onChangeText={setOrigin} />
      <TextInput style={styles.input} placeholder="目的地" value={destination} onChangeText={setDestination} />
      <Button title="查詢路線" onPress={() => onSubmit(origin, destination)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 12, gap: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- RouteSearch`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RouteSearch.tsx frontend/src/__tests__/RouteSearch.test.tsx
git commit -m "feat(frontend): add route search inputs"
```

---

### Task 5: Map with route line + radar overlay (manual verify)

**Files:**
- Create: `frontend/src/components/RainMap.tsx`

**Interfaces:**
- Consumes: `RouteResult`, `RainResult`, `resolveUrl` from `api.ts`.
- Produces: `RainMap({ route, rain }: { route: RouteResult | null; rain: RainResult | null })`. Renders a MapLibre map centred on Taiwan. When `route` exists, draws its polyline (swap `[lat,lng]`→`[lng,lat]` for GeoJSON). When `rain` exists, draws the radar PNG as a semi-transparent image overlay positioned by `rain.overlay.bbox`.

> This is a native module; there is no Jest test. Verification is on a device (Step 3).

- [ ] **Step 1: Write `frontend/src/components/RainMap.tsx`**

```tsx
import React from "react";
import MapLibreGL from "@maplibre/maplibre-react-native";
import { RouteResult, RainResult } from "../types";
import { resolveUrl } from "../api";

MapLibreGL.setAccessToken(null);

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
    return [[w, n], [e, n], [e, s], [w, s]] as [number, number][];
  })();

  return (
    <MapLibreGL.MapView style={{ flex: 1 }} styleURL={STYLE_URL}>
      <MapLibreGL.Camera centerCoordinate={[121.0, 23.7]} zoomLevel={6.5} />

      {corners && (
        <MapLibreGL.ImageSource id="radar" coordinates={corners} url={resolveUrl(rain!.overlay.imageUrl)}>
          <MapLibreGL.RasterLayer id="radar-layer" sourceID="radar" style={{ rasterOpacity: 0.5 }} />
        </MapLibreGL.ImageSource>
      )}

      {lineGeoJSON && (
        <MapLibreGL.ShapeSource id="route" shape={lineGeoJSON}>
          <MapLibreGL.LineLayer id="route-line" style={{ lineColor: "#1565c0", lineWidth: 4 }} />
        </MapLibreGL.ShapeSource>
      )}
    </MapLibreGL.MapView>
  );
}
```

- [ ] **Step 2: Create the dev build (native module needs it)**

Run:
```bash
cd frontend
npx expo prebuild
npx expo run:android   # or: npx expo run:ios
```
Expected: app builds and launches on the emulator/device (blank map of Taiwan for now).

- [ ] **Step 3: Manual verify**

Temporarily render `<RainMap route={null} rain={null} />` as the app root; confirm the OpenFreeMap base map of Taiwan appears and is pannable. Revert the temporary root change after confirming.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/RainMap.tsx frontend/app.json frontend/android frontend/ios
git commit -m "feat(frontend): add MapLibre map with route line and radar overlay"
```

---

### Task 6: Main screen — wire the full flow (manual verify)

**Files:**
- Modify: `frontend/App.tsx`
- Create: `frontend/src/MainScreen.tsx`

**Interfaces:**
- Consumes: `geocode`, `planRoute`, `checkRain` (api), `RouteSearch`, `RainMap`, `VerdictBanner`.
- Produces: `MainScreen` — on search submit: geocode both endpoints (take first candidate each) → `planRoute` → `checkRain(route.polyline)` → store `route`+`rain` in state. Shows an error alert on failure and a loading state while fetching.

- [ ] **Step 1: Write `frontend/src/MainScreen.tsx`**

```tsx
import React, { useState } from "react";
import { View, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { RouteSearch } from "./components/RouteSearch";
import { RainMap } from "./components/RainMap";
import { VerdictBanner } from "./components/VerdictBanner";
import { geocode, planRoute, checkRain } from "./api";
import { RouteResult, RainResult } from "./types";

export function MainScreen() {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [rain, setRain] = useState<RainResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(originText: string, destText: string) {
    setLoading(true);
    try {
      const [o, d] = await Promise.all([geocode(originText), geocode(destText)]);
      if (!o.length || !d.length) throw new Error("找不到地點");
      const r = await planRoute({ lat: o[0].lat, lng: o[0].lng }, { lat: d[0].lat, lng: d[0].lng });
      setRoute(r);
      setRain(await checkRain(r.polyline));
    } catch (e: any) {
      Alert.alert("查詢失敗", e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <VerdictBanner result={rain} />
      <RouteSearch onSubmit={onSubmit} />
      <View style={styles.map}>
        <RainMap route={route} rain={rain} />
        {loading && <ActivityIndicator style={StyleSheet.absoluteFill} size="large" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
});
```

- [ ] **Step 2: Rewrite `frontend/App.tsx`**

```tsx
import React from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import { MainScreen } from "./src/MainScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.root}>
      <MainScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
```

- [ ] **Step 3: End-to-end manual verify**

Prereqs: backend running on the NUC and reachable over Tailscale; `RAINROUTE_BACKEND_URL` set to `http://<NUC-tailscale-ip>:8000`; rebuild if config changed (`npx expo run:android`).

Steps:
1. Enter "台北車站" and "淡水", tap 查詢路線.
2. Confirm: a blue route line appears; if it is raining along it, the radar overlay shows over Taiwan and the top banner reads 建議穿雨衣; on a clear day it reads 不需要穿雨衣.
3. Cross-check against the CWA radar page (https://www.cwa.gov.tw/V8/C/W/OBS_Radar.html) that the overlay matches reality.

- [ ] **Step 4: Commit**

```bash
git add frontend/App.tsx frontend/src/MainScreen.tsx
git commit -m "feat(frontend): wire main screen end-to-end flow"
```

---

## Self-Review Notes

- **Spec coverage:** search inputs (T4), route line (T5), radar overlay (T5), verdict banner (T3), configurable backend URL for NUC↔cloud (T1), Tailscale-based remote access documented in the end-to-end verify (T6).
- **Native-module reality:** MapLibre requires a dev build, flagged in constraints and T5. Pure logic (api, config) and presentational components (banner, search) are Jest-tested; map + flow are manual.
- **Coordinate order:** backend `[lat,lng]` → GeoJSON `[lng,lat]` swap isolated to `RainMap` (T5); camera uses `[lng,lat]` too.
- **Type consistency:** `RainResult`/`RouteResult` field names match `api.ts` mapping and are consumed unchanged in T3/T5/T6.
- **Dependency on backend plan:** endpoint shapes and `/radar.png` must match `2026-07-21-rainroute-backend.md`. Build the backend first (or in parallel) so T6's end-to-end verify has a live server.
```
