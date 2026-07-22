import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { act } from "react";
import { RouteSearch } from "../components/RouteSearch";

test("submits both fields", async () => {
  const onSubmit = jest.fn();
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={onSubmit} />);
  await act(async () => {
    fireEvent.changeText(getByPlaceholderText("出發地"), "台北車站");
    fireEvent.changeText(getByPlaceholderText("目的地"), "淡水");
  });
  await act(async () => {
    fireEvent.press(getByText("查詢路線"));
  });
  expect(onSubmit).toHaveBeenCalledWith("台北車站", "淡水");
});
