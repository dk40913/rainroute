import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHistory, saveHistory } from "./history";

const TAIPEI = { name: "台北車站, 中正區, 台北市", lat: 25.0478, lng: 121.517 };
const TAMSUI = { name: "淡水, 新北市", lat: 25.17, lng: 121.44 };
const HERE = (lat: number) => ({ name: "目前位置", lat, lng: 121.5 });

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

describe("history", () => {
  it("starts empty and round-trips a saved entry", () => {
    expect(loadHistory()).toEqual([]);
    saveHistory({ origin: TAIPEI, destination: TAMSUI });
    expect(loadHistory()).toEqual([{ origin: TAIPEI, destination: TAMSUI }]);
  });

  it("moves a repeated pair to the front instead of duplicating it", () => {
    saveHistory({ origin: TAIPEI, destination: TAMSUI });
    saveHistory({ origin: TAMSUI, destination: TAIPEI });
    const out = saveHistory({ origin: TAIPEI, destination: TAMSUI });
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ origin: TAIPEI, destination: TAMSUI });
  });

  it("dedupes 目前位置 pairs by name, keeping the newest coordinates", () => {
    saveHistory({ origin: HERE(25.01), destination: TAMSUI });
    const out = saveHistory({ origin: HERE(25.02), destination: TAMSUI });
    expect(out).toHaveLength(1);
    expect(out[0].origin.lat).toBe(25.02);
  });

  it("caps the list at 5 entries", () => {
    for (let i = 0; i < 7; i++) {
      saveHistory({ origin: { ...TAIPEI, name: `起點${i}` }, destination: TAMSUI });
    }
    const out = loadHistory();
    expect(out).toHaveLength(5);
    expect(out[0].origin.name).toBe("起點6");
  });

  it("ignores corrupt stored data", () => {
    localStorage.setItem("rainroute.history", "not json");
    expect(loadHistory()).toEqual([]);
    localStorage.setItem("rainroute.history", JSON.stringify([{ bogus: true }]));
    expect(loadHistory()).toEqual([]);
  });
});
