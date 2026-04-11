import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function FeatureImportanceChart({ importances }) {
  if (!importances?.length) return null;

  const data = importances.slice(0, 20).map(d => ({
    name:       d.feature.length > 34 ? d.feature.slice(0, 32) + "…" : d.feature,
    fullName:   d.feature,
    importance: d.importance,
    pct:        `${(d.importance * 100).toFixed(2)}%`,
  }));

  const max = data[0]?.importance || 1;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm max-w-xs">
        <p className="font-semibold text-slate-700 mb-1">{payload[0].payload.fullName}</p>
        <p className="text-blue-600">Importance: {payload[0].payload.pct}</p>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={520}>
      <BarChart data={data} layout="vertical" margin={{ left: 220, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tickFormatter={v => `${(v * 100).toFixed(1)}%`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          width={220}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="importance" radius={[0, 4, 4, 0]} maxBarSize={16}>
          {data.map((entry, i) => (
            <Cell
              key={i}
              fill={`rgba(59,130,246,${0.3 + 0.7 * (entry.importance / max)})`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
