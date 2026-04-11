import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional

from backend.db import get_db
from backend.models import UserFeature, CohortBenchmark
from ml.predict import get_feature_importances

app = FastAPI(title="OverspenderIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tightened before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISCRETIONARY = ["dining", "entertainment", "travel", "retail"]
COHORT_ORDER  = ["low", "mid_low", "mid_high", "high"]


# ---------------------------------------------------------------------------
# GET /users
# ---------------------------------------------------------------------------
@app.get("/users")
def list_users(db: Session = Depends(get_db)):
    rows = (
        db.query(
            UserFeature.client_id,
            UserFeature.cohort,
            UserFeature.is_overspender,
            UserFeature.overspend_probability,
        )
        .order_by(UserFeature.client_id)
        .all()
    )
    return [
        {
            "client_id":             r.client_id,
            "cohort":                r.cohort,
            "is_overspender":        bool(r.is_overspender),
            "overspend_probability": round(r.overspend_probability * 100, 1),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /users/{user_id}/profile
# ---------------------------------------------------------------------------
@app.get("/users/{user_id}/profile")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    u = db.query(UserFeature).filter(UserFeature.client_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "client_id":               u.client_id,
        "cohort":                  u.cohort,
        "age":                     u.age,
        "yearly_income":           u.yearly_income,
        "per_capita_income":       u.per_capita_income,
        "total_debt":              u.total_debt,
        "credit_score":            u.credit_score,
        "num_credit_cards":        u.num_credit_cards,
        "avg_credit_limit":        round(u.avg_credit_limit or 0, 2),
        "total_credit_limit":      round(u.total_credit_limit or 0, 2),
        "debt_to_income_ratio":    round(u.debt_to_income_ratio or 0, 3),
        "total_monthly_spend":     round(u.total_monthly_spend or 0, 2),
        "spending_volatility":     round(u.spending_volatility or 0, 2),
        "credit_utilization_rate": round(u.credit_utilization_rate or 0, 3),
        "is_overspender":          bool(u.is_overspender),
        "overspend_probability":   round((u.overspend_probability or 0) * 100, 1),
        "spending_breakdown": {
            cat: {
                "monthly_avg": round(getattr(u, f"spend_{cat}") or 0, 2),
                "pct_of_total": round((getattr(u, f"pct_spend_{cat}") or 0) * 100, 1),
            }
            for cat in ["essentials", "dining", "entertainment", "travel", "retail", "other"]
        },
    }


# ---------------------------------------------------------------------------
# GET /users/{user_id}/recommendations
# ---------------------------------------------------------------------------
@app.get("/users/{user_id}/recommendations")
def get_recommendations(user_id: int, db: Session = Depends(get_db)):
    u = db.query(UserFeature).filter(UserFeature.client_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    bench = (
        db.query(CohortBenchmark)
        .filter(CohortBenchmark.cohort == u.cohort)
        .first()
    )
    if not bench:
        raise HTTPException(status_code=404, detail="Cohort benchmark not found")

    prob  = u.overspend_probability or 0
    recs  = []

    for cat in DISCRETIONARY:
        current_spend  = getattr(u,     f"spend_{cat}")     or 0
        cohort_median  = getattr(bench, f"median_spend_{cat}") or 0

        # Recommended cap scales proportionally with risk probability.
        # At prob=0 → no change; at prob=1 → reduce to cohort saver median.
        if current_spend > cohort_median:
            recommended_cap = cohort_median + (current_spend - cohort_median) * (1 - prob)
        else:
            recommended_cap = current_spend   # already at or below median

        estimated_savings = max(0.0, current_spend - recommended_cap)
        over_median       = current_spend > cohort_median * 1.20  # >20% over

        recs.append({
            "category":          cat,
            "current_spend":     round(current_spend, 2),
            "cohort_median":     round(cohort_median, 2),
            "recommended_cap":   round(recommended_cap, 2),
            "estimated_savings": round(estimated_savings, 2),
            "over_median":       over_median,
            "progress_pct": round(
                min(100, (cohort_median / current_spend * 100)) if current_spend > 0 else 100,
                1,
            ),
        })

    return {
        "client_id":             u.client_id,
        "cohort":                u.cohort,
        "overspend_probability": round(prob * 100, 1),
        "recommendations":       recs,
    }


# ---------------------------------------------------------------------------
# GET /model/feature-importances
# ---------------------------------------------------------------------------
@app.get("/model/feature-importances")
def feature_importances():
    return get_feature_importances()[:20]   # top 20 for display


# ---------------------------------------------------------------------------
# GET /cohorts/benchmarks
# ---------------------------------------------------------------------------
@app.get("/cohorts/benchmarks")
def cohort_benchmarks(db: Session = Depends(get_db)):
    rows = db.query(CohortBenchmark).all()
    result = []
    for r in sorted(rows, key=lambda x: COHORT_ORDER.index(x.cohort)):
        result.append({
            "cohort":                     r.cohort,
            "user_count":                 r.user_count,
            "median_total_monthly_spend": round(r.median_total_monthly_spend or 0, 2),
            "spending": {
                cat: {
                    "median_monthly": round(getattr(r, f"median_spend_{cat}") or 0, 2),
                    "median_pct":     round((getattr(r, f"median_pct_{cat}") or 0) * 100, 1),
                }
                for cat in ["essentials", "dining", "entertainment", "travel", "retail", "other"]
            },
        })
    return result


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}
