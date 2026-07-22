jest.mock("expo-constants", () => ({
  expoConfig: { extra: { backendBaseUrl: "http://example:8000" } },
}));

test("reads backend base url from expo config", () => {
  const { BACKEND_BASE_URL } = require("../config");
  expect(BACKEND_BASE_URL).toBe("http://example:8000");
});
