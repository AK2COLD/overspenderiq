import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUserProfile, getUserRecommendations, getFeatureImportances, getCohortBenchmarks } from "../api";
import HealthScoreGauge from "../components/HealthScoreGauge";
import SpendingBreakdownChart from "../components/SpendingBreakdownChart";
import RecommendationsPanel from "../components/RecommendationsPanel";
import FeatureImportanceChart from "../components/FeatureImportanceChart";

const COHORT_LABEL = {
  low: "Low Income", mid_low: "Mid-Low Income",
  mid_high: "Mid-High Income", high: "High Income",
};

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { userId } = useParams();
  const navigate   = useNavigate();
  const [tab, setTab]         = useState("overview");
  const [profile, setProfile] = useState(null);
  const [recs, setRecs]       = useState(null);
  const [importances, setImportances] = useState(null);
  const [benchmarks, setBenchmarks]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getUserProfile(userId),
      getUserRecommendations(userId),
      getFeatureImportances(),
      getCohortBenchmarks(),
    ])
      .then(([p, r, imp, bench]) => {
        setProfile(p); setRecs(r); setImportances(imp); setBenchmarks(bench);
      })
      .catch(() => setError("Could not load user data."))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-red-500">{error}</div>
  );

  const fmt = (n) => n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = (n) => n == null ? "—" : `${Number(n).toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-800">OverspenderIQ</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">User {profile.client_id}</span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
            {COHORT_LABEL[profile.cohort]}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {[["overview","Overview"],["recommendations","Recommendations"],["insights","Model Insights"],["cohorts","Cohort View"]].map(([k,label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gauge panel */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
                <div className="flex items-center gap-1.5 mb-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                    Budget Risk Score
                  </h3>
                  <div className="group relative">
                    <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-relaxed">
                      The percentage of the model's 100 decision trees that voted this spending profile as an overspender. Higher = greater confidence the user overspends relative to their income.
                    </div>
                  </div>
                </div>
                <HealthScoreGauge probability={profile.overspend_probability} />
                <p className="mt-4 text-center text-sm text-slate-500 max-w-[200px]">
                  {profile.overspend_probability < 30
                    ? "Your spending patterns align well with savers in your income group."
                    : profile.overspend_probability < 60
                    ? "Some spending categories may benefit from a closer look."
                    : "Several spending patterns suggest an opportunity to adjust toward saver norms."}
                </p>
                <p className="mt-2 text-center text-xs text-slate-400 max-w-[200px]">
                  {profile.overspend_probability}% of model trees voted overspender
                </p>
              </div>

              {/* Financial profile */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  Financial Profile
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Yearly Income"     value={fmt(profile.yearly_income)} />
                  <StatCard label="Total Debt"         value={fmt(profile.total_debt)} />
                  <StatCard label="Debt-to-Income"     value={pct(profile.debt_to_income_ratio * 100)}
                    sub={profile.debt_to_income_ratio > 0.36 ? "Above 36% threshold" : "Within healthy range"} />
                  <StatCard label="Credit Score"       value={profile.credit_score} />
                  <StatCard label="Credit Utilization" value={pct(profile.credit_utilization_rate * 100)} />
                  <StatCard label="Avg Monthly Spend"  value={fmt(profile.total_monthly_spend)} />
                </div>
              </div>
            </div>

            {/* Spending breakdown */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Monthly Spending Breakdown vs. Cohort Median
              </h3>
              <SpendingBreakdownChart
                breakdown={profile.spending_breakdown}
                benchmarks={benchmarks}
                cohort={profile.cohort}
              />
            </div>

            {/* Savings preview */}
            {recs && <SavingsPreview recommendations={recs.recommendations} onViewAll={() => setTab("recommendations")} />}
          </div>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {tab === "recommendations" && recs && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800">Personalized Budget Adjustments</h3>
              <p className="text-sm text-slate-500 mt-1">
                Recommendations are calibrated to saver medians within your income cohort
                ({COHORT_LABEL[profile.cohort]}), weighted by your {profile.overspend_probability}% risk score.
              </p>
            </div>
            <RecommendationsPanel recommendations={recs.recommendations} />
          </div>
        )}

        {/* ── MODEL INSIGHTS TAB ── */}
        {tab === "insights" && importances && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800">Key Predictive Factors</h3>
              <p className="text-sm text-slate-500 mt-1">
                These are the top 20 features our Random Forest model weighted most heavily
                when predicting budget risk. Higher importance = more influential in the classification.
              </p>
            </div>
            <FeatureImportanceChart importances={importances} />
          </div>
        )}

        {/* ── COHORT VIEW TAB ── */}
        {tab === "cohorts" && benchmarks && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-x-auto">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800">Cohort Spending Benchmarks</h3>
              <p className="text-sm text-slate-500 mt-1">
                Median monthly spend for saver-aligned users within each income cohort.
                <span className="ml-1 font-medium text-blue-600">Highlighted row</span> = your cohort.
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 pr-4 font-medium">Cohort</th>
                  <th className="pb-2 pr-4 font-medium text-right">Monthly Total</th>
                  {["essentials","dining","entertainment","travel","retail","other"].map(c => (
                    <th key={c} className="pb-2 pr-4 font-medium text-right capitalize">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {benchmarks.map(b => (
                  <tr key={b.cohort}
                    className={`border-b border-slate-50 ${b.cohort === profile.cohort ? "bg-blue-50" : ""}`}>
                    <td className="py-3 pr-4 font-medium text-slate-700">
                      {COHORT_LABEL[b.cohort]}
                      {b.cohort === profile.cohort && (
                        <span className="ml-2 text-xs text-blue-600 font-medium">← you</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-600">
                      {fmt(b.median_total_monthly_spend)}
                    </td>
                    {["essentials","dining","entertainment","travel","retail","other"].map(c => (
                      <td key={c} className="py-3 pr-4 text-right text-slate-600">
                        {fmt(b.spending[c]?.median_monthly)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const CAT_ICON  = { dining: "🍽️", entertainment: "🎬", travel: "✈️", retail: "🛍️" };
const CAT_LABEL_REC = { dining: "Dining", entertainment: "Entertainment", travel: "Travel", retail: "Retail" };

function SavingsPreview({ recommendations, onViewAll }) {
  if (!recommendations?.length) return null;

  const fmt = n => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  const flagged = recommendations
    .filter(r => r.over_median && r.estimated_savings > 0)
    .sort((a, b) => b.estimated_savings - a.estimated_savings);

  if (!flagged.length) return null;

  const totalSavings = flagged.reduce((sum, r) => sum + r.estimated_savings, 0);
  const preview = flagged.slice(0, 3);
  const extra   = flagged.length - preview.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            Savings Opportunities
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Up to {fmt(totalSavings)}/month across {flagged.length} {flagged.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <button onClick={onViewAll}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          Full breakdown →
        </button>
      </div>

      <div className="space-y-2">
        {preview.map(rec => {
          const overPct = Math.round((rec.current_spend / rec.cohort_median - 1) * 100);
          return (
            <div key={rec.category}
              className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <span className="text-xl">{CAT_ICON[rec.category]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-700">
                    {CAT_LABEL_REC[rec.category]}
                  </span>
                  <span className="text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-medium">
                    {overPct}% over cohort median
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fmt(rec.current_spend)}/mo &rarr; suggested cap {fmt(rec.recommended_cap)}/mo
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-emerald-600">~{fmt(rec.estimated_savings)}/mo</p>
                <p className="text-xs text-slate-400">potential</p>
              </div>
            </div>
          );
        })}
        {extra > 0 && (
          <button onClick={onViewAll}
            className="w-full text-center text-xs text-blue-600 font-medium py-2 hover:text-blue-800 transition-colors">
            +{extra} more {extra === 1 ? "category" : "categories"} — view full recommendations →
          </button>
        )}
      </div>
    </div>
  );
}
