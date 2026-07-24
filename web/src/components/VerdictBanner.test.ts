import { describe, expect, it } from "vitest";
import { rainWindowText } from "./VerdictBanner";
import type { RainResult } from "../types";

const base: RainResult = {
  verdict: "raincoat_recommended",
  maxLevel: "heavy",
  wetSegments: [],
  radarTime: "t",
  overlay: { imageUrl: "/radar.png", bbox: [115, 17.75, 126.5, 29.25] },
};

describe("rainWindowText", () => {
  it("returns null without a rain window", () => {
    expect(rainWindowText(base)).toBeNull();
  });

  it("describes a mid-ride window, marking nowcast", () => {
    expect(rainWindowText({ ...base, nowcast: true, rainStartMin: 5, rainEndMin: 18 })).toBe(
      "出發後第 5~18 分鐘會遇雨（含雨區移動預測）",
    );
  });

  it("describes rain from departure without the nowcast suffix", () => {
    expect(rainWindowText({ ...base, nowcast: false, rainStartMin: 0, rainEndMin: 12 })).toBe(
      "出發就會遇雨，約持續到第 12 分鐘",
    );
  });

  it("collapses a single-minute window", () => {
    expect(rainWindowText({ ...base, rainStartMin: 9, rainEndMin: 9 })).toBe(
      "出發後約第 9 分鐘會遇雨",
    );
  });
});
