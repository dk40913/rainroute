// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteSearch } from "./RouteSearch";
import { geocode } from "../api";
import type { GeocodeCandidate } from "../types";

vi.mock("../api", () => ({
  geocode: vi.fn(),
}));

const mockedGeocode = vi.mocked(geocode);

const candidates: GeocodeCandidate[] = [
  { name: "台北車站, 中正區, 台北市, 100", lat: 25.0478, lng: 121.517 },
  { name: "台北101, 信義區, 台北市, 110", lat: 25.033, lng: 121.5645 },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mockedGeocode.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("RouteSearch dropdown", () => {
  it("type -> blur shows the mocked candidates as two-line rows", async () => {
    mockedGeocode.mockResolvedValue(candidates);
    const user = userEvent.setup();
    render(<RouteSearch onSubmit={vi.fn()} />);

    const origin = screen.getByPlaceholderText("出發地");
    await user.type(origin, "台北車站");
    await user.tab();

    await screen.findByText("台北車站");
    expect(screen.getByText("中正區 · 台北市")).toBeTruthy();
    expect(screen.getByText("台北101")).toBeTruthy();
    expect(screen.getByText("信義區 · 台北市")).toBeTruthy();
  });

  it("survives the blur-before-click race: mousedown+click still selects the candidate", async () => {
    mockedGeocode.mockResolvedValue(candidates);
    render(<RouteSearch onSubmit={vi.fn()} />);

    const origin = screen.getByPlaceholderText("出發地");
    const destination = screen.getByPlaceholderText("目的地");

    fireEvent.change(origin, { target: { value: "台北車站" } });
    fireEvent.blur(origin);
    const originOption = await screen.findByText("台北車站");

    // Simulate the browser race: mousedown on the option fires first (and is
    // the event the component relies on via preventDefault), then click.
    fireEvent.mouseDown(originOption);
    fireEvent.click(originOption);

    expect(origin).toHaveProperty("value", "台北車站");

    fireEvent.change(destination, { target: { value: "台北101" } });
    fireEvent.blur(destination);
    const destOption = await screen.findByText("台北101");
    fireEvent.mouseDown(destOption);
    fireEvent.click(destOption);

    expect(destination).toHaveProperty("value", "台北101");

    const submit = screen.getByRole("button", { name: "查詢路線" });
    expect(submit).toHaveProperty("disabled", false);
  });

  it("stale-response guard: editing text before an in-flight geocode resolves clears the 搜尋中… hint instead of getting stuck", async () => {
    const pending = deferred<GeocodeCandidate[]>();
    mockedGeocode.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<RouteSearch onSubmit={vi.fn()} />);

    const origin = screen.getByPlaceholderText("出發地");
    await user.type(origin, "台北車站");
    await user.tab();

    expect(screen.getByText("搜尋中…")).toBeTruthy();

    // Edit the text while the geocode call for the previous text is still in flight.
    await user.click(origin);
    await user.type(origin, "2");

    pending.resolve(candidates);

    await waitFor(() => {
      expect(screen.queryByText("搜尋中…")).toBeNull();
    });
  });

  it("re-editing a selected field disables the submit button again", async () => {
    mockedGeocode.mockResolvedValue(candidates);
    const user = userEvent.setup();
    render(<RouteSearch onSubmit={vi.fn()} />);

    const origin = screen.getByPlaceholderText("出發地");
    const destination = screen.getByPlaceholderText("目的地");

    await user.type(origin, "台北車站");
    await user.tab();
    const originOption = await screen.findByText("台北車站");
    fireEvent.mouseDown(originOption);
    fireEvent.click(originOption);

    await user.type(destination, "台北101");
    await user.tab();
    const destOption = await screen.findByText("台北101");
    fireEvent.mouseDown(destOption);
    fireEvent.click(destOption);

    const submit = screen.getByRole("button", { name: "查詢路線" });
    expect(submit).toHaveProperty("disabled", false);

    await user.click(origin);
    await user.type(origin, "!");

    expect(submit).toHaveProperty("disabled", true);
  });
});
