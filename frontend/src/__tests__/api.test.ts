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
