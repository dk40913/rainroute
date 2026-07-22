import React from "react";
import { render } from "@testing-library/react-native";
import { RainLegend } from "../components/RainLegend";

test("renders the three rain intensity labels", async () => {
  const { getByText } = await render(<RainLegend />);
  expect(getByText("小雨")).toBeTruthy();
  expect(getByText("中雨")).toBeTruthy();
  expect(getByText("大雨")).toBeTruthy();
});

test("lets map gestures pass through by disabling pointer events on the root", async () => {
  const { toJSON } = await render(<RainLegend />);
  expect(toJSON()?.props.pointerEvents).toBe("none");
});
