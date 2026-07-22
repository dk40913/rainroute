import React from "react";
import { render } from "@testing-library/react-native";
import { VerdictBanner } from "../components/VerdictBanner";
import { WetSegment } from "../types";

const base = { maxLevel: "heavy", wetSegments: [], radarTime: "t",
  overlay: { imageUrl: "/radar.png", bbox: [115, 17.75, 126.5, 29.25] as [number, number, number, number] } };

test("renders nothing when no result", async () => {
  const { toJSON } = await render(<VerdictBanner result={null} />);
  expect(toJSON()).toBeNull();
});

test("shows raincoat message", async () => {
  const { getByText } = await render(
    <VerdictBanner result={{ ...base, verdict: "raincoat_recommended" }} />);
  expect(getByText(/建議穿雨衣/)).toBeTruthy();
});

test("shows no-raincoat message", async () => {
  const { getByText } = await render(
    <VerdictBanner result={{ ...base, verdict: "no_raincoat_needed" }} />);
  expect(getByText(/不需要穿雨衣/)).toBeTruthy();
});

test("shows wet-segment count for raincoat verdict, hides it for no-raincoat verdict", async () => {
  const wetSegments: WetSegment[] = [
    { index: 0, lat: 25.03, lng: 121.56, level: "heavy" },
    { index: 3, lat: 25.05, lng: 121.58, level: "moderate" },
  ];

  const { getByText } = await render(
    <VerdictBanner result={{ ...base, wetSegments, verdict: "raincoat_recommended" }} />);
  expect(getByText(/2 個點有雨/)).toBeTruthy();

  const { queryByText } = await render(
    <VerdictBanner result={{ ...base, wetSegments, verdict: "no_raincoat_needed" }} />);
  expect(queryByText(/個點有雨/)).toBeNull();
});
