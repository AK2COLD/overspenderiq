// SVG arc-based semicircle gauge
export default function HealthScoreGauge({ probability }) {
  const score  = Math.round(probability);
  const capped = Math.min(100, Math.max(0, probability));

  // Arc geometry (semicircle, left to right)
  const R   = 80;
  const cx  = 100;
  const cy  = 100;
  // Start at 180° (left), end at 0° (right)
  const toRad   = (deg) => (deg * Math.PI) / 180;
  const angleDeg = 180 - capped * 1.8;          // 180° → 0° as score 0→100
  const x   = cx + R * Math.cos(toRad(angleDeg));
  const y   = cy - R * Math.sin(toRad(angleDeg));

  const color =
    score < 30 ? "#10b981" :
    score < 60 ? "#f59e0b" : "#ef4444";

  const label =
    score < 30 ? "Low Risk" :
    score < 60 ? "Moderate Risk" : "Elevated Risk";

  const trackPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  // filled arc
  const filled = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${x} ${y}`;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 20 200 110" className="w-52">
        {/* Track */}
        <path d={trackPath} fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
        {/* Filled arc */}
        <path d={filled} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" />
        {/* Needle dot */}
        <circle cx={x} cy={y} r="7" fill={color} />
        {/* Score text */}
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="32" fontWeight="700" fill="#1e293b">
          {score}
        </text>
        <text x={cx} y={cy + 28} textAnchor="middle" fontSize="10" fill="#94a3b8">
          out of 100
        </text>
      </svg>
      <span className="text-sm font-semibold mt-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}
