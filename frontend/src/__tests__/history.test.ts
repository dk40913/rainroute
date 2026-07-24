jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadHistory, saveHistory } from "../history";

const TAIPEI = { name: "台北車站, 中正區, 台北市", lat: 25.0478, lng: 121.517 };
const TAMSUI = { name: "淡水, 新北市", lat: 25.17, lng: 121.44 };

beforeEach(async () => {
  await AsyncStorage.clear();
});

test("starts empty and round-trips a saved entry", async () => {
  expect(await loadHistory()).toEqual([]);
  await saveHistory({ origin: TAIPEI, destination: TAMSUI });
  expect(await loadHistory()).toEqual([{ origin: TAIPEI, destination: TAMSUI }]);
});

test("moves a repeated pair to the front instead of duplicating it", async () => {
  await saveHistory({ origin: TAIPEI, destination: TAMSUI });
  await saveHistory({ origin: TAMSUI, destination: TAIPEI });
  const out = await saveHistory({ origin: TAIPEI, destination: TAMSUI });
  expect(out).toHaveLength(2);
  expect(out[0]).toEqual({ origin: TAIPEI, destination: TAMSUI });
});

test("dedupes 目前位置 pairs by name, keeping the newest coordinates", async () => {
  await saveHistory({ origin: { name: "目前位置", lat: 25.01, lng: 121.5 }, destination: TAMSUI });
  const out = await saveHistory({ origin: { name: "目前位置", lat: 25.02, lng: 121.5 }, destination: TAMSUI });
  expect(out).toHaveLength(1);
  expect(out[0].origin.lat).toBe(25.02);
});

test("caps the list at 5 entries", async () => {
  for (let i = 0; i < 7; i++) {
    await saveHistory({ origin: { ...TAIPEI, name: `起點${i}` }, destination: TAMSUI });
  }
  const out = await loadHistory();
  expect(out).toHaveLength(5);
  expect(out[0].origin.name).toBe("起點6");
});

test("ignores corrupt stored data", async () => {
  await AsyncStorage.setItem("rainroute.history", "not json");
  expect(await loadHistory()).toEqual([]);
  await AsyncStorage.setItem("rainroute.history", JSON.stringify([{ bogus: true }]));
  expect(await loadHistory()).toEqual([]);
});
