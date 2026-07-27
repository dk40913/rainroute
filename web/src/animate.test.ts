import { describe, expect, it } from "vitest";
import { cumulativeMeters, slicePolyline, shiftedBbox } from "./animate";

// Straight north line at lng 121: 0.01° lat ≈ 1113 m per segment.
const LINE: [number, number][] = [
  [25.0, 121.0],
  [25.01, 121.0],
  [25.02, 121.0],
];

describe("slicePolyline", () => {
  const cum = cumulativeMeters(LINE);

  it("cumulative distances grow linearly on an even line", () => {
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeCloseTo(1112, 0);
    expect(cum[2]).toBeCloseTo(2224, 0);
  });

  it("frac 0.5 ends at the midpoint", () => {
    const sliced = slicePolyline(LINE, cum, 0.5);
    const head = sliced[sliced.length - 1];
    expect(head[0]).toBeCloseTo(25.01, 5);
    expect(head[1]).toBeCloseTo(121.0, 5);
  });

  it("frac 0.75 interpolates inside the second segment", () => {
    const sliced = slicePolyline(LINE, cum, 0.75);
    expect(sliced[sliced.length - 1][0]).toBeCloseTo(25.015, 5);
  });

  it("frac 0 still returns a two-point (zero-length) line", () => {
    const sliced = slicePolyline(LINE, cum, 0);
    expect(sliced).toHaveLength(2);
    expect(sliced[1]).toEqual(sliced[0]);
  });

  it("frac 1 returns the full polyline", () => {
    expect(slicePolyline(LINE, cum, 1)).toEqual(LINE);
  });
});

describe("shiftedBbox", () => {
  it("translates all four edges along the motion vector", () => {
    const shifted = shiftedBbox([118, 20.5, 124, 26.5], { dlatPerS: 0.0001, dlngPerS: 0.0002 }, 600);
    expect(shifted[0]).toBeCloseTo(118.12, 5);
    expect(shifted[1]).toBeCloseTo(20.56, 5);
    expect(shifted[2]).toBeCloseTo(124.12, 5);
    expect(shifted[3]).toBeCloseTo(26.56, 5);
  });
});
