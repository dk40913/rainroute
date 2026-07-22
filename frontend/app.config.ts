import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "RainRoute",
  slug: "rainroute",
  version: "0.1.0",
  orientation: "portrait",
  ios: {
    bundleIdentifier: "com.rainroute.app",
    infoPlist: {
      // The backend is plain http on a LAN/Tailscale IP (no TLS); ATS blocks
      // http by default on real devices, so allow it for this self-hosted app.
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
    },
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
