import { describe, expect, it } from "vitest";
import { primaryName, secondaryName } from "./RouteSearch";

describe("primaryName", () => {
  it("takes the first comma-separated segment", () => {
    expect(primaryName("台北車站, 中正區, 台北市, 100")).toBe("台北車站");
  });

  it("trims whitespace and handles no comma", () => {
    expect(primaryName("  台北101  ")).toBe("台北101");
  });
});

describe("secondaryName", () => {
  it("joins up to 3 non-numeric trailing segments with a middle dot", () => {
    expect(secondaryName("台北車站, 中正區, 台北市, 100")).toBe("中正區 · 台北市");
  });

  it("drops purely numeric segments (postal codes)", () => {
    expect(secondaryName("台北101, 信義區, 台北市, 110")).toBe("信義區 · 台北市");
  });

  it("returns empty string when there is nothing after the primary name", () => {
    expect(secondaryName("台北101")).toBe("");
  });

  it("caps at 3 segments", () => {
    expect(secondaryName("A, B, C, D, E")).toBe("B · C · D");
  });
});
