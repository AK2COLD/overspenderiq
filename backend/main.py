import sys
import os
import io
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.db import get_db, engine
from backend.models import UserFeature, CohortBenchmark
from ml.predict import get_feature_importances, predict, get_feature_names

# MCC → spending bucket map (mirrors feature_engineering.py)
BUCKET_MAP = {
    "Eating Places and Restaurants": "dining",
    "Drinking Places (Alcoholic Beverages)": "dining",
    "Fast Food Restaurants": "dining",
    "Passenger Railways": "travel", "Railroad Passenger Transport": "travel",
    "Local and Suburban Commuter Transportation": "travel",
    "Taxicabs and Limousines": "travel", "Bus Lines": "travel",
    "Motor Freight Carriers and Trucking": "travel", "Cruise Lines": "travel",
    "Airlines": "travel", "Travel Agencies": "travel",
    "Tolls and Bridge Fees": "travel", "Lodging - Hotels, Motels, Resorts": "travel",
    "Digital Goods - Media, Books, Apps": "entertainment",
    "Digital Goods - Games": "entertainment",
    "Athletic Fields, Commercial Sports": "entertainment",
    "Recreational Sports, Clubs": "entertainment",
    "Motion Picture Theaters": "entertainment", "Theatrical Producers": "entertainment",
    "Betting (including Lottery Tickets, Casinos)": "entertainment",
    "Amusement Parks, Carnivals, Circuses": "entertainment",
    "Music Stores - Musical Instruments": "entertainment", "Book Stores": "entertainment",
    "Grocery Stores, Supermarkets": "essentials", "Miscellaneous Food Stores": "essentials",
    "Drug Stores and Pharmacies": "essentials", "Service Stations": "essentials",
    "Utilities - Electric, Gas, Water, Sanitary": "essentials",
    "Telecommunication Services": "essentials",
    "Cable, Satellite, and Other Pay Television Services": "essentials",
    "Insurance Sales, Underwriting": "essentials", "Laundry Services": "essentials",
    "Cleaning and Maintenance Services": "essentials",
    "Postal Services - Government Only": "essentials",
    "Doctors, Physicians": "essentials", "Dentists and Orthodontists": "essentials",
    "Chiropractors": "essentials", "Optometrists, Optical Goods and Eyeglasses": "essentials",
    "Podiatrists": "essentials", "Hospitals": "essentials", "Medical Services": "essentials",
    "Tax Preparation Services": "essentials",
    "Wholesale Clubs": "retail", "Discount Stores": "retail", "Department Stores": "retail",
    "Women's Ready-To-Wear Stores": "retail", "Family Clothing Stores": "retail",
    "Sports Apparel, Riding Apparel Stores": "retail", "Shoe Stores": "retail",
    "Furniture, Home Furnishings, and Equipment Stores": "retail",
    "Miscellaneous Home Furnishing Stores": "retail", "Household Appliance Stores": "retail",
    "Electronics Stores": "retail", "Automotive Parts and Accessories Stores": "retail",
    "Cosmetic Stores": "retail", "Gift, Card, Novelty Stores": "retail",
    "Antique Shops": "retail", "Artist Supply Stores, Craft Shops": "retail",
    "Sporting Goods Stores": "retail", "Florists Supplies, Nursery Stock and Flowers": "retail",
    "Computers, Computer Peripheral Equipment": "retail", "Precious Stones and Metals": "retail",
    "Books, Periodicals, Newspapers": "retail", "Lumber and Building Materials": "retail",
    "Hardware Stores": "retail", "Lawn and Garden Supply Stores": "retail",
    "Package Stores, Beer, Wine, Liquor": "retail",
}

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
# POST /predict/upload  — classify a new user from a CSV upload
# ---------------------------------------------------------------------------
@app.post("/predict/upload")
async def predict_from_csv(
    file: UploadFile = File(...),
    cohort: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    # 1. Parse CSV
    content = await file.read()
    try:
        df = pd.read_csv(io.StringIO(content.decode("utf-8-sig")))
    except Exception:
        raise HTTPException(400, "Could not parse file — ensure it is a valid CSV.")

    df.columns = df.columns.str.lower().str.strip()
    missing = {"date", "amount", "mcc"} - set(df.columns)
    if missing:
        raise HTTPException(400, f"CSV is missing required columns: {missing}")

    # 2. Clean
    df["amount"] = (
        df["amount"].astype(str).str.replace(r"[\$,]", "", regex=True)
    )
    df["amount"] = pd.to_numeric(df["amount"], errors="coerce").fillna(0)
    df["date"]   = pd.to_datetime(df["date"], errors="coerce")
    df["mcc"]    = pd.to_numeric(df["mcc"],   errors="coerce")
    df = df.dropna(subset=["date", "mcc"])

    if len(df) < 3:
        raise HTTPException(400, "CSV must contain at least 3 valid transactions.")

    # 3. Map MCC codes → descriptions
    mcc_df  = pd.read_sql("SELECT code, description FROM mcc_codes", engine)
    mcc_map = dict(zip(mcc_df["code"], mcc_df["description"]))
    df["mcc_name"] = df["mcc"].map(mcc_map)
    df = df.dropna(subset=["mcc_name"])

    if df.empty:
        raise HTTPException(400, "No transactions matched known MCC codes.")

    # 4. Compute model features
    total_spend  = df["amount"].sum()
    if total_spend == 0:
        raise HTTPException(400, "Total spend is zero — check amount values.")

    mcc_spend  = df.groupby("mcc_name")["amount"].sum()
    mcc_ratios = (mcc_spend / total_spend).to_dict()

    df["month"]        = df["date"].dt.to_period("M")
    monthly_spend      = df.groupby("month")["amount"].sum()
    mean_monthly       = float(monthly_spend.mean())
    std_monthly        = float(monthly_spend.std(ddof=0))
    cv_monthly         = std_monthly / mean_monthly if mean_monthly else 0
    num_months         = len(monthly_spend)
    avg_trans_per_month = len(df) / num_months

    feature_names = get_feature_names()
    feature_vector = {f: mcc_ratios.get(f, 0.0) for f in feature_names}
    feature_vector["cv_monthly_spend"]          = cv_monthly
    feature_vector["avg_transactions_per_month"] = avg_trans_per_month

    # 5. Predict
    result = predict(feature_vector)
    prob   = result["overspend_probability"]  # 0–1

    # 6. Bucketed spend for charts
    buckets = ["essentials", "dining", "entertainment", "travel", "retail", "other"]
    spending_breakdown = {}
    for bucket in buckets:
        ratio = sum(v for k, v in mcc_ratios.items() if BUCKET_MAP.get(k, "other") == bucket)
        monthly_amt = ratio * mean_monthly
        spending_breakdown[bucket] = {
            "monthly_avg":  round(monthly_amt, 2),
            "pct_of_total": round(ratio * 100, 1),
        }

    # 7. Recommendations (if cohort provided)
    recommendations = []
    if cohort:
        bench = db.query(CohortBenchmark).filter(CohortBenchmark.cohort == cohort).first()
        if bench:
            for cat in DISCRETIONARY:
                current  = spending_breakdown.get(cat, {}).get("monthly_avg", 0)
                median   = getattr(bench, f"median_spend_{cat}") or 0
                rec_cap  = median + (current - median) * (1 - prob) if current > median else current
                savings  = max(0.0, current - rec_cap)
                recommendations.append({
                    "category":          cat,
                    "current_spend":     round(current, 2),
                    "cohort_median":     round(median, 2),
                    "recommended_cap":   round(rec_cap, 2),
                    "estimated_savings": round(savings, 2),
                    "over_median":       current > median * 1.20,
                    "progress_pct":      round(
                        min(100, median / current * 100) if current > 0 else 100, 1
                    ),
                })

    return {
        "overspend_probability":    round(prob * 100, 1),
        "is_overspender":           result["is_overspender"],
        "cohort":                   cohort,
        "num_transactions":         len(df),
        "num_months":               num_months,
        "mean_monthly_spend":       round(mean_monthly, 2),
        "cv_monthly_spend":         round(cv_monthly, 3),
        "avg_transactions_per_month": round(avg_trans_per_month, 1),
        "spending_breakdown":       spending_breakdown,
        "recommendations":          recommendations,
    }


# ---------------------------------------------------------------------------
# GET /demo-data/{filename}  — serve sample CSV files for demo
# ---------------------------------------------------------------------------
@app.get("/demo-data/{filename}")
def get_demo_file(filename: str):
    safe = filename.replace("..", "").replace("/", "")
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "data", "demo", safe)
    if not os.path.exists(path):
        raise HTTPException(404, "Demo file not found")
    return FileResponse(path, media_type="text/csv", filename=safe)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    return {"status": "ok"}
