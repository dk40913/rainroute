import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { backendBaseUrl?: string };

export const BACKEND_BASE_URL: string = extra.backendBaseUrl ?? "http://localhost:8000";
