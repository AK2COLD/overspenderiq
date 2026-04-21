import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsers, getUserRecommendations } from "../api";

const COHORT_LABEL = {
  low:      "Low Income",
  mid_low:  "Mid-Low Income",
  mid_high: "Mid-High Income",
  high:     "High Income",
};

const CAT_LABEL = {
  dining: "dining", entertainment: "entertainment", travel: "travel", retail: "retail",
};

export default function Home() {
  const [users, setUsers]       = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [topRec, setTopRec]     = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const navigate = useNavigate();

  const fetchUsers = () => {
    setLoading(true);
    setLoadError(null);
    getUsers()
      .then(setUsers)
      .catch(() => setLoadError("Could not connect to the server. Railway may be waking up — try again in a moment."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const selectedUser = users.find(u => String(u.client_id) === selected);

  // Fetch top recommendation when a high-risk user is selected
  useEffect(() => {
    if (!selectedUser || selectedUser.overspend_probability < 60) {
      setTopRec(null);
      return;
    }
    setRecLoading(true);
    getUserRecommendations(selectedUser.client_id)
      .then(data => {
        const best = (data.recommendations || [])
          .filter(r => r.estimated_savings > 0)
          .sort((a, b) => b.estimated_savings - a.estimated_savings)[0] || null;
        setTopRec(best);
      })
      .catch(() => setTopRec(null))
      .finally(() => setRecLoading(false));
  }, [selected]);

  const handleGo = () => {
    if (selected) navigate(`/dashboard/${selected}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">OverspenderIQ</h1>
          </div>
          <p className="text-slate-400 text-sm">
            AI-powered spending analysis &amp; personalized budget insights
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-1">Select a User Profile</h2>
          <p className="text-sm text-slate-500 mb-6">
            Choose a user from the dataset to view their budget risk score and personalized recommendations.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : loadError ? (
            <div className="py-4 text-center">
              <p className="text-sm text-red-600 mb-3">{loadError}</p>
              <button onClick={fetchUsers}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                Retry
              </button>
            </div>
          ) : (
            <>
              <select
                value={selected}
                onChange={e => { setSelected(e.target.value); setTopRec(null); }}
                className="w-full border border-slate-200 rounded-lg px-4 py-3 text-slate-700 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           bg-slate-50 mb-4"
              >
                <option value="">— Choose a user ID —</option>
                {users.map(u => (
                  <option key={u.client_id} value={u.client_id}>
                    User {u.client_id} · {COHORT_LABEL[u.cohort] || u.cohort} · {u.overspend_probability}% risk
                  </option>
                ))}
              </select>

              {/* High-risk alert card */}
              {selectedUser?.overspend_probability >= 60 && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">⚠️</span>
                    <span className="text-sm font-bold text-red-700">High Risk Detected</span>
                    <span className="ml-auto text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                      {selectedUser.overspend_probability}%
                    </span>
                  </div>
                  {recLoading ? (
                    <p className="text-xs text-red-500 mt-1">Loading top insight…</p>
                  ) : topRec ? (
                    <p className="text-sm text-red-700 mt-1">
                      Top opportunity: reduce{" "}
                      <span className="font-semibold">{CAT_LABEL[topRec.category] || topRec.category}</span> by{" "}
                      <span className="font-semibold">
                        ~${Math.round(topRec.estimated_savings).toLocaleString()}/month
                      </span>{" "}
                      to align with your income cohort's saver norms.
                    </p>
                  ) : (
                    <p className="text-xs text-red-600 mt-1">
                      Multiple spending categories exceed cohort saver norms.
                    </p>
                  )}
                </div>
              )}

              {/* Neutral preview badge for lower-risk users */}
              {selectedUser && selectedUser.overspend_probability < 60 && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center gap-3 text-sm">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    selectedUser.overspend_probability < 30 ? "bg-emerald-400" : "bg-amber-400"
                  }`} />
                  <span className="text-slate-600">
                    <span className="font-medium">{COHORT_LABEL[selectedUser.cohort]}</span> cohort ·{" "}
                    {selectedUser.overspend_probability}% budget risk ·{" "}
                    {selectedUser.is_overspender ? "Overspend pattern detected" : "Saver-aligned pattern"}
                  </span>
                </div>
              )}

              <button
                onClick={handleGo}
                disabled={!selected}
                className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold text-sm
                           hover:bg-blue-700 active:bg-blue-800 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                View Dashboard →
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs text-slate-400">
                  <span className="bg-white px-2">or</span>
                </div>
              </div>

              <button
                onClick={() => navigate("/import")}
                className="w-full py-3 rounded-lg border border-slate-200 text-slate-600 font-semibold text-sm
                           hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                Analyze a New User → Upload CSV
              </button>
            </>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Academic prototype · {users.length} user profiles · Random Forest classifier
        </p>
      </div>
    </div>
  );
}
