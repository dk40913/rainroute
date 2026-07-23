import type { RainResult } from "../types";
import "./VerdictBanner.css";

export function VerdictBanner({ result }: { result: RainResult | null }) {
  if (!result) return null;
  const recommend = result.verdict === "raincoat_recommended";
  return (
    <div className="rr-banner" style={{ backgroundColor: recommend ? "#d64545" : "#2e9e5b" }}>
      <div className="rr-banner-text">{recommend ? "建議穿雨衣 ☔" : "不需要穿雨衣 ☀"}</div>
      {recommend && result.wetSegments.length > 0 && (
        <div className="rr-banner-sub">沿途約 {result.wetSegments.length} 個點有雨</div>
      )}
    </div>
  );
}
