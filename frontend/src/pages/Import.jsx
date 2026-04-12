import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import HealthScoreGauge from "../components/HealthScoreGauge";
import SpendingBreakdownChart from "../components/SpendingBreakdownChart";
import RecommendationsPanel from "../components/RecommendationsPanel";

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
      const { data } = await axios.post(`${API}/predict/upload`, form);
      setResult(data);
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
                <button onClick={() => downloadDemo("demo_overspender.csv")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  demo_overspender.csv
                </button>
                <button onClick={() => downloadDemo("demo_saver.csv")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs text-blue-700 font-medium hover:bg-blue-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  demo_saver.csv
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                CSV format: <code className="bg-blue-100 px-1 rounded">date, amount, mcc</code> — one row per transaction.
              </p>
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

function Results({ result, onReset }) {
  const fmt = n => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Your Results</h1>
        <button onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          ← Analyze another file
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Transactions", result.num_transactions.toLocaleString()],
          ["Months of Data", result.num_months],
          ["Avg Monthly Spend", fmt(result.mean_monthly_spend)],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-slate-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Gauge */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col items-center">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Budget Risk Score</h3>
        <HealthScoreGauge probability={result.overspend_probability} />
        {result.cohort && (
          <p className="mt-3 text-sm text-slate-500">
            Compared against <span className="font-medium text-slate-700">{COHORT_LABEL[result.cohort]}</span> cohort benchmarks
          </p>
        )}
      </div>

      {/* Spending breakdown */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Monthly Spending Breakdown
        </h3>
        <SpendingBreakdownChart
          breakdown={result.spending_breakdown}
          benchmarks={null}
          cohort={null}
        />
      </div>

      {/* Recommendations */}
      {result.recommendations?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-800">Personalized Budget Adjustments</h3>
            <p className="text-sm text-slate-500 mt-1">
              Based on saver medians within your income group and your {result.overspend_probability}% risk score.
            </p>
          </div>
          <RecommendationsPanel recommendations={result.recommendations} />
        </div>
      )}
    </div>
  );
}
