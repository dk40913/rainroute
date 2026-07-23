import "./RainLegend.css";

// Representative subset of app/palette.py PALETTE anchors, in dBZ order,
// grouped by RainLevel band (LIGHT | MODERATE | HEAVY).
const BANDS: { colors: string[]; label: string }[] = [
  {
    label: "小雨",
    colors: ["#00DAFF", "#00A0FF", "#005BFF", "#0000FF"],
  },
  {
    label: "中雨",
    colors: ["#009600", "#00C800", "#00FF00", "#CCEA00", "#FFFF00"],
  },
  {
    label: "大雨",
    colors: ["#FF9800", "#FF6000", "#FF0000", "#D600D6"],
  },
];

export function RainLegend() {
  const allColors = BANDS.flatMap((band) => band.colors);
  return (
    <div className="rr-legend">
      <div className="rr-legend-strip">
        {allColors.map((color, i) => (
          <div
            key={`${color}-${i}`}
            className="rr-legend-block"
            style={{
              backgroundColor: color,
              borderTopLeftRadius: i === 0 ? 4 : 0,
              borderBottomLeftRadius: i === 0 ? 4 : 0,
              borderTopRightRadius: i === allColors.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === allColors.length - 1 ? 4 : 0,
            }}
          />
        ))}
      </div>
      <div className="rr-legend-labels">
        {BANDS.map((band) => (
          <div key={band.label} className="rr-legend-label" style={{ flex: band.colors.length }}>
            {band.label}
          </div>
        ))}
      </div>
    </div>
  );
}
