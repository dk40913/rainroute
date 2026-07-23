import { afterEach, describe, expect, it, vi } from "vitest";
import { checkRain, geocode, planRoute, resolveUrl } from "./api";

function mockFetchOnce(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("geocode", () => {
  it("returns candidates from the wire response", async () => {
    mockFetchOnce({ candidates: [{ name: "台北車站", lat: 25.0478, lng: 121.517 }] });
    const result = await geocode("台北車站");
    expect(result).toEqual([{ name: "台北車站", lat: 25.0478, lng: 121.517 }]);
  });
});

describe("planRoute", () => {
  it("maps snake_case wire fields to camelCase", async () => {
    mockFetchOnce({
      polyline: [[25.0, 121.5]],
      distance_m: 1200,
      duration_s: 300,
    });
    const result = await planRoute({ lat: 25.0, lng: 121.5 }, { lat: 25.1, lng: 121.6 });
    expect(result).toEqual({ polyline: [[25.0, 121.5]], distanceM: 1200, durationS: 300 });
  });
});

describe("checkRain", () => {
  it("maps snake_case wire fields (including nested overlay) to camelCase", async () => {
    mockFetchOnce({
      verdict: "raincoat_recommended",
      max_level: "HEAVY",
      wet_segments: [{ index: 0, lat: 25.0, lng: 121.5, level: "HEAVY" }],
      radar_time: "2026-07-23T00:00:00Z",
      overlay: { image_url: "/radar.png", bbox: [120, 21, 122, 25] },
    });
    const result = await checkRain([[25.0, 121.5]]);
    expect(result).toEqual({
      verdict: "raincoat_recommended",
      maxLevel: "HEAVY",
      wetSegments: [{ index: 0, lat: 25.0, lng: 121.5, level: "HEAVY" }],
      radarTime: "2026-07-23T00:00:00Z",
      overlay: { imageUrl: "/radar.png", bbox: [120, 21, 122, 25] },
    });
  });
});

describe("resolveUrl", () => {
  it("leaves absolute URLs untouched", () => {
    expect(resolveUrl("http://example.com/radar.png")).toBe("http://example.com/radar.png");
  });

  it("prefixes relative paths with the backend base URL", () => {
    expect(resolveUrl("/radar.png")).toBe("http://localhost:8000/radar.png");
  });
});
