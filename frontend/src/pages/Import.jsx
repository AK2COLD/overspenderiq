import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { getCohortBenchmarks, getFeatureImportances } from "../api";
import HealthScoreGauge from "../components/HealthScoreGauge";
import SpendingBreakdownChart from "../components/SpendingBreakdownChart";
import RecommendationsPanel from "../components/RecommendationsPanel";
import FeatureImportanceChart from "../components/FeatureImportanceChart";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const COHORT_OPTIONS = [
  { value: "",         label: "— Skip (no recommendations) —" },
  { value: "low",      label: "Low  (under ~$35k/yr)" },
  { value: "mid_low",  label: "Mid-Low  (~$35k – $55k/yr)" },
  { value: "mid_high", label: "Mid-High  (~$55k – $80k/yr)" },
  { value: "high",     label: "High  (above ~$80k/yr)" },
];

const COHORT_LABEL = {
  low: "Low Income", mid_low: "Mid-Low Income",
  mid_high: "Mid-High Income", high: "High Income",
};

function downloadDemo(filename) {
  window.open(`${API}/demo-data/${filename}`, "_blank");
}

function downloadTemplate() {
  const rows = [
    "date,amount,mcc",
    "2024-01-05,45.20,5812",
    "2024-01-08,120.00,5411",
    "2024-01-12,28.50,5814",
    "2024-01-15,85.00,5732",
    "2024-01-20,200.00,5311",
    "2024-01-22,55.75,5812",
    "2024-01-25,320.00,4511",
    "2024-02-01,42.00,5814",
    "2024-02-05,95.00,5411",
    "2024-02-10,18.99,5816",
  ].join("\n");
  const blob = new Blob([rows], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "transaction_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function Import() {
  const navigate = useNavigate();
  const inputRef  = useRef();
  const [dragging, setDragging]   = useState(false);
  const [file, setFile]           = useState(null);
  const [cohort, setCohort]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [result, setResult]       = useState(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.endsWith(".csv")) { setFile(dropped); setError(null); }
    else setError("Please drop a .csv file.");
  }, []);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setError(null); setResult(null); }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const form = new FormData();
    form.append("file", file);
    if (cohort) form.append("cohort", cohort);
    try {
      const [{ data }, benchmarks, importances] = await Promise.all([
        axios.post(`${API}/predict/upload`, form),
        getCohortBenchmarks(),
        getFeatureImportances(),
      ]);
      setResult({ ...data, benchmarks, importances });
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed — check your CSV format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-slate-600 transition-colors">
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
        <span className="text-sm text-slate-500 font-medium">New User Analysis</span>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {!result ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-800">Analyze Your Spending</h1>
              <p className="text-slate-500 mt-1 text-sm">
                Upload a transaction CSV to get your budget risk score and personalized recommendations.
              </p>
            </div>

            {/* Demo downloads */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-blue-800 mb-2">Demo Files — try these to see the model in action:</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { file: "demo_overspender.csv",    label: "High risk (~99%)",     color: "red" },
                  { file: "demo_moderate_high.csv",  label: "Moderate-high (~51%)", color: "amber" },
                  { file: "demo_moderate_low.csv",   label: "Moderate-low (~43%)",  color: "amber" },
                  { file: "demo_saver.csv",          label: "Low risk (~3%)",       color: "green" },
                ].map(({ file, label }) => (
                  <button key={file} onClick={() => downloadDemo(file)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-blue-600">
                  CSV format: <code className="bg-blue-100 px-1 rounded">date, amount, mcc</code> — one row per transaction.
                </p>
                <button onClick={downloadTemplate}
                  className="flex items-center gap-1 text-xs text-blue-700 font-medium hover:text-blue-900 transition-colors whitespace-nowrap ml-3">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Blank Template
                </button>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors mb-5
                ${dragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"}
                ${file ? "border-emerald-300 bg-emerald-50" : ""}`}
            >
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-slate-600">Drop your CSV here or click to browse</p>
                  <p className="text-xs">Requires columns: <code className="bg-slate-100 px-1 rounded">date, amount, mcc</code></p>
                </div>
              )}
            </div>

            {/* Income cohort selector */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Income Range <span className="text-slate-400 font-normal">(optional — enables personalized recommendations)</span>
              </label>
              <select value={cohort} onChange={e => setCohort(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700
                           bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {COHORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={!file || loading}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
                         hover:bg-blue-700 active:bg-blue-800 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analyzing...</>
                : "Analyze Spending →"}
            </button>
          </>
        ) : (
          <Results result={result} onReset={() => { setResult(null); setFile(null); }} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Results({ result, onReset }) {
  const [tab, setTab] = useState("overview");
  const fmt = n => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const pct = n => `${Number(n).toFixed(1)}%`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Your Results</h1>
        <button onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Analyze another file
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        {[["overview","Overview"],["recommendations","Recommendations"],["insights","Model Insights"],["cohorts","Cohort View"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gauge */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
              <div className="flex items-center gap-1.5 mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Budget Risk Score</h3>
                <div className="group relative">
                  <svg className="w-3.5 h-3.5 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-relaxed">
                    The percentage of the model's 100 decision trees that voted this spending profile as an overspender. Higher = greater confidence the user overspends relative to their income.
                  </div>
                </div>
              </div>
              <HealthScoreGauge probability={result.overspend_probability} />
              <p className="mt-4 text-center text-sm text-slate-500 max-w-[200px]">
                {result.overspend_probability < 30
                  ? "Your spending patterns align well with savers in your income group."
                  : result.overspend_probability < 60
                  ? "Some spending categories may benefit from a closer look."
                  : "Several spending patterns suggest an opportunity to adjust toward saver norms."}
              </p>
              <p className="mt-2 text-center text-xs text-slate-400 max-w-[200px]">
                {result.overspend_probability}% of model trees voted overspender
              </p>
            </div>

            {/* Stats */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Spending Profile</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Transactions"        value={result.num_transactions.toLocaleString()} />
                <StatCard label="Months of Data"      value={result.num_months} />
                <StatCard label="Avg Monthly Spend"   value={fmt(result.mean_monthly_spend)} />
                <StatCard label="Spend Volatility (CV)" value={pct(result.cv_monthly_spend * 100)}
                  sub={result.cv_monthly_spend > 0.20 ? "High variability" : "Consistent spending"} />
                <StatCard label="Avg Transactions/Mo" value={Math.round(result.avg_transactions_per_month)} />
                {result.cohort && <StatCard label="Income Cohort" value={COHORT_LABEL[result.cohort]} />}
              </div>
            </div>
          </div>

          {/* Spending chart */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Monthly Spending Breakdown{result.cohort ? " vs. Cohort Median" : ""}
            </h3>
            <SpendingBreakdownChart
              breakdown={result.spending_breakdown}
              benchmarks={result.benchmarks}
              cohort={result.cohort}
            />
          </div>
        </div>
      )}

      {/* RECOMMENDATIONS */}
      {tab === "recommendations" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {result.recommendations?.length > 0 ? (
            <>
              <div className="mb-4">
                <h3 className="font-semibold text-slate-800">Personalized Budget Adjustments</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Based on saver medians within your{result.cohort ? ` ${COHORT_LABEL[result.cohort]}` : ""} income group
                  and your {result.overspend_probability}% risk score.
                </p>
              </div>
              <RecommendationsPanel recommendations={result.recommendations} />
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">Select an income range on the upload screen to unlock personalized recommendations.</p>
            </div>
          )}
        </div>
      )}

      {/* MODEL INSIGHTS */}
      {tab === "insights" && result.importances && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Key Predictive Factors</h3>
            <p className="text-sm text-slate-500 mt-1">
              Top 20 features our Random Forest model weighted most heavily when predicting budget risk.
            </p>
          </div>
          <FeatureImportanceChart importances={result.importances} />
        </div>
      )}

      {/* COHORT VIEW */}
      {tab === "cohorts" && result.benchmarks && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 overflow-x-auto">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Cohort Spending Benchmarks</h3>
            <p className="text-sm text-slate-500 mt-1">
              Median monthly spend for saver-aligned users within each income cohort.
              {result.cohort && <span className="ml-1 font-medium text-blue-600">Highlighted row = your cohort.</span>}
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
              {result.benchmarks.map(b => (
                <tr key={b.cohort} className={`border-b border-slate-50 ${b.cohort === result.cohort ? "bg-blue-50" : ""}`}>
                  <td className="py-3 pr-4 font-medium text-slate-700">
                    {COHORT_LABEL[b.cohort] || b.cohort}
                    {b.cohort === result.cohort && <span className="ml-2 text-xs text-blue-600 font-medium">← you</span>}
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
  );
}
