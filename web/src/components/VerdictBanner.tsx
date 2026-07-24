import type { RainResult } from "../types";
import "./VerdictBanner.css";

export function rainWindowText(result: RainResult): string | null {
  const start = result.rainStartMin;
  const end = result.rainEndMin;
  if (start == null || end == null) return null;
  const base =
    start === 0
      ? end === 0
        ? "出發時就會遇雨"
        : `出發就會遇雨，約持續到第 ${end} 分鐘`
      : start === end
        ? `出發後約第 ${start} 分鐘會遇雨`
        : `出發後第 ${start}~${end} 分鐘會遇雨`;
  return result.nowcast ? `${base}（含雨區移動預測）` : base;
}

export function VerdictBanner({ result }: { result: RainResult | null }) {
  if (!result) return null;
  const recommend = result.verdict === "raincoat_recommended";
  const windowText = result.wetSegments.length > 0 ? rainWindowText(result) : null;
  const sub =
    windowText ??
    (result.wetSegments.length > 0
      ? recommend
        ? `沿途約 ${result.wetSegments.length} 個點有雨`
        : null
      : result.rainNearby
        ? "路線本身無雨，但沿線 2 公里內有雨區，可能短暫飄雨"
        : result.nowcast
          ? "全程預計無雨（含雨區移動預測）"
          : "目前雷達顯示全程無雨");
  return (
    <div className="rr-banner" style={{ backgroundColor: recommend ? "#d64545" : "#2e9e5b" }}>
      <div className="rr-banner-text">{recommend ? "建議穿雨衣 ☔" : "不需要穿雨衣 ☀"}</div>
      {sub && <div className="rr-banner-sub">{sub}</div>}
    </div>
  );
}
