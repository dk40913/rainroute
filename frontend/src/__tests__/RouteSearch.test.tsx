import React from "react";
import { act } from "react";
import { Keyboard } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { RouteSearch } from "../components/RouteSearch";
import { geocode } from "../api";

jest.mock("../api", () => ({ geocode: jest.fn() }));

const mockedGeocode = geocode as jest.Mock;

const TAIPEI = { name: "台北車站", lat: 25.04, lng: 121.51 };
const TAMSUI = { name: "淡水", lat: 25.17, lng: 121.44 };

beforeEach(() => {
  mockedGeocode.mockReset();
});

test("typing then ending edit shows a dropdown of candidate names", async () => {
  mockedGeocode.mockResolvedValue([TAIPEI, TAMSUI]);
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={jest.fn()} />);
  const input = getByPlaceholderText("出發地");
  await fireEvent.changeText(input, "台北");
  await fireEvent(input, "endEditing");
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
  expect(getByText("淡水")).toBeTruthy();
  expect(mockedGeocode).toHaveBeenCalledWith("台北");
});

test("tapping a candidate fills the field and enables submit once both fields are selected", async () => {
  mockedGeocode.mockResolvedValueOnce([TAIPEI]).mockResolvedValueOnce([TAMSUI]);
  const onSubmit = jest.fn();
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={onSubmit} />);

  const originInput = getByPlaceholderText("出發地");
  await fireEvent.changeText(originInput, "台北車站");
  await fireEvent(originInput, "endEditing");
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
  await fireEvent.press(getByText("台北車站"));

  const destInput = getByPlaceholderText("目的地");
  await fireEvent.changeText(destInput, "淡水");
  await fireEvent(destInput, "endEditing");
  await waitFor(() => expect(getByText("淡水")).toBeTruthy());
  await fireEvent.press(getByText("淡水"));

  await fireEvent.press(getByText("查詢路線"));
  expect(onSubmit).toHaveBeenCalledWith(TAIPEI, TAMSUI);
});

test("empty results show 找不到地點", async () => {
  mockedGeocode.mockResolvedValue([]);
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={jest.fn()} />);
  const input = getByPlaceholderText("出發地");
  await fireEvent.changeText(input, "不存在的地方");
  await fireEvent(input, "endEditing");
  await waitFor(() => expect(getByText("找不到地點")).toBeTruthy());
});

test("editing a selected field again disables submit", async () => {
  mockedGeocode.mockResolvedValueOnce([TAIPEI]).mockResolvedValueOnce([TAMSUI]);
  const onSubmit = jest.fn();
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={onSubmit} />);

  const originInput = getByPlaceholderText("出發地");
  await fireEvent.changeText(originInput, "台北車站");
  await fireEvent(originInput, "endEditing");
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
  await fireEvent.press(getByText("台北車站"));

  const destInput = getByPlaceholderText("目的地");
  await fireEvent.changeText(destInput, "淡水");
  await fireEvent(destInput, "endEditing");
  await waitFor(() => expect(getByText("淡水")).toBeTruthy());
  await fireEvent.press(getByText("淡水"));

  await fireEvent.press(getByText("查詢路線"));
  expect(onSubmit).toHaveBeenCalledTimes(1);

  await fireEvent.changeText(originInput, "台北車站2");
  await fireEvent.press(getByText("查詢路線"));
  expect(onSubmit).toHaveBeenCalledTimes(1);
});

test("a stale geocode response does not leave the field stuck on 搜尋中…", async () => {
  let resolveFirst: (candidates: (typeof TAIPEI)[]) => void = () => {};
  const pending = new Promise<(typeof TAIPEI)[]>((resolve) => {
    resolveFirst = resolve;
  });
  mockedGeocode.mockReturnValueOnce(pending);
  const { getByPlaceholderText, queryByText } = await render(<RouteSearch onSubmit={jest.fn()} />);
  const input = getByPlaceholderText("出發地");

  await fireEvent.changeText(input, "台北");
  const endEditingPromise = fireEvent(input, "endEditing");
  await waitFor(() => expect(queryByText("搜尋中…")).toBeTruthy());

  await fireEvent.changeText(input, "台北車站2");
  await act(async () => {
    resolveFirst([TAIPEI]);
    await endEditingPromise;
  });

  expect(queryByText("搜尋中…")).toBeNull();
});

test("editing back to the exact previously selected text still reopens the dropdown on blur", async () => {
  mockedGeocode.mockResolvedValue([TAIPEI]);
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={jest.fn()} />);
  const input = getByPlaceholderText("出發地");

  await fireEvent.changeText(input, "台北車站");
  await fireEvent(input, "endEditing");
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
  await fireEvent.press(getByText("台北車站"));
  expect(mockedGeocode).toHaveBeenCalledTimes(1);

  await fireEvent.changeText(input, "淡水");
  await fireEvent.changeText(input, "台北車站");
  await fireEvent(input, "endEditing");

  await waitFor(() => expect(mockedGeocode).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
});

test("dismisses the keyboard on submit once both fields are selected", async () => {
  mockedGeocode.mockResolvedValueOnce([TAIPEI]).mockResolvedValueOnce([TAMSUI]);
  const dismissSpy = jest.spyOn(Keyboard, "dismiss");
  const onSubmit = jest.fn();
  const { getByPlaceholderText, getByText } = await render(<RouteSearch onSubmit={onSubmit} />);

  const originInput = getByPlaceholderText("出發地");
  await fireEvent.changeText(originInput, "台北車站");
  await fireEvent(originInput, "endEditing");
  await waitFor(() => expect(getByText("台北車站")).toBeTruthy());
  await fireEvent.press(getByText("台北車站"));

  const destInput = getByPlaceholderText("目的地");
  await fireEvent.changeText(destInput, "淡水");
  await fireEvent(destInput, "endEditing");
  await waitFor(() => expect(getByText("淡水")).toBeTruthy());
  await fireEvent.press(getByText("淡水"));

  await fireEvent.press(getByText("查詢路線"));
  expect(dismissSpy).toHaveBeenCalled();
  expect(onSubmit).toHaveBeenCalledWith(TAIPEI, TAMSUI);
  dismissSpy.mockRestore();
});
