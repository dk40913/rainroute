import type { GeocodeCandidate } from "./types";

export type HistoryEntry = { origin: GeocodeCandidate; destination: GeocodeCandidate };

const KEY = "rainroute.history";
const MAX = 5;

function isCandidate(c: any): c is GeocodeCandidate {
  return typeof c?.name === "string" && typeof c?.lat === "number" && typeof c?.lng === "number";
}

// Dedupe by name pair, not coordinates: 目前位置 entries get fresh coords on
// every query and would otherwise pile up as near-duplicates.
function pairKey(e: HistoryEntry): string {
  return `${e.origin.name}→${e.destination.name}`;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => isCandidate(e?.origin) && isCandidate(e?.destination)).slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((e) => pairKey(e) !== pairKey(entry))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (e.g. private mode) — history just won't persist.
  }
  return next;
}
