import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "RainRoute",
  slug: "rainroute",
  version: "0.1.0",
  orientation: "portrait",
  ios: {
    bundleIdentifier: "com.rainroute.app",
  },
  android: {
    package: "com.rainroute.app",
  },
  plugins: ["@maplibre/maplibre-react-native"],
  extra: {
    // Override per-device; for the NUC use the Tailscale IP, e.g. http://100.x.x.x:8000
    backendBaseUrl: process.env.RAINROUTE_BACKEND_URL ?? "http://localhost:8000",
  },
};

export default config;
