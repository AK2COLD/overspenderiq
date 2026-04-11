const CAT_LABEL = {
  dining: "Dining", entertainment: "Entertainment",
  travel: "Travel", retail: "Retail",
};

const CAT_ICON = {
  dining: "🍽️", entertainment: "🎬", travel: "✈️", retail: "🛍️",
};

export default function RecommendationsPanel({ recommendations }) {
  if (!recommendations?.length) return <p className="text-slate-400 text-sm">No recommendations.</p>;

  const fmt = n => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-4">
      {recommendations.map(rec => {
        const hasOpportunity = rec.current_spend > rec.cohort_median;
        const progressWidth  = Math.min(100, rec.progress_pct);

        return (
          <div key={rec.category}
            className={`rounded-xl border p-5 ${rec.over_median ? "border-amber-200 bg-amber-50/50" : "border-slate-100 bg-white"}`}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{CAT_ICON[rec.category]}</span>
                <span className="font-semibold text-slate-800">{CAT_LABEL[rec.category]}</span>
                {rec.over_median && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                    Opportunity to adjust
                  </span>
                )}
              </div>
              {rec.estimated_savings > 0 && (
                <span className="text-sm font-semibold text-emerald-600 whitespace-nowrap">
                  ~{fmt(rec.estimated_savings)}/mo potential
                </span>
              )}
            </div>

            {/* Spend comparison */}
            <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Current Avg</p>
                <p className="font-semibold text-slate-700">{fmt(rec.current_spend)}<span className="text-slate-400 font-normal">/mo</span></p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Cohort Median</p>
                <p className="font-semibold text-slate-500">{fmt(rec.cohort_median)}<span className="text-slate-400 font-normal">/mo</span></p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-0.5">Suggested Cap</p>
                <p className="font-semibold text-blue-600">{fmt(rec.recommended_cap)}<span className="text-slate-400 font-normal">/mo</span></p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress toward cohort saver norms</span>
                <span>{Math.round(progressWidth)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${progressWidth >= 90 ? "bg-emerald-400" : progressWidth >= 60 ? "bg-blue-400" : "bg-amber-400"}`}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
            </div>

            {hasOpportunity && (
              <p className="text-xs text-slate-500 mt-2">
                Adjusting {CAT_LABEL[rec.category].toLowerCase()} from{" "}
                <span className="font-medium">{fmt(rec.current_spend)}</span> to{" "}
                <span className="font-medium text-blue-600">{fmt(rec.recommended_cap)}</span> could save approximately{" "}
                <span className="font-medium text-emerald-600">{fmt(rec.estimated_savings)}/month</span> compared to peers in your income group.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
