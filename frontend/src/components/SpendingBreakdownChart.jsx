import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";

const CATEGORIES = ["essentials","dining","entertainment","travel","retail","other"];
const CAT_LABEL  = { essentials:"Essentials", dining:"Dining", entertainment:"Entertainment",
                     travel:"Travel", retail:"Retail", other:"Other" };

export default function SpendingBreakdownChart({ breakdown, benchmarks, cohort }) {
  if (!breakdown || !benchmarks) return null;

  const bench = benchmarks.find(b => b.cohort === cohort);

  const data = CATEGORIES.map(cat => ({
    name:   CAT_LABEL[cat],
    "Your Avg":      Math.round(breakdown[cat]?.monthly_avg || 0),
    "Cohort Median": Math.round(bench?.spending[cat]?.median_monthly || 0),
    pct:    `${(breakdown[cat]?.pct_of_total || 0).toFixed(1)}%`,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: ${p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 80, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tickFormatter={v => `$${v.toLocaleString()}`}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Bar dataKey="Your Avg" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={18} />
        <Bar dataKey="Cohort Median" fill="#cbd5e1" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
