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
