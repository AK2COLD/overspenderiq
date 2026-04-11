#!/usr/bin/env python3
"""
Feature engineering for OverspenderIQ (Option A — existing trained model).

Reads raw data from overspender_db, replicates the notebook's feature
pipeline exactly, runs the pre-trained Random Forest, and writes two tables:
  - user_features       (one row per valid user)
  - cohort_benchmarks   (one row per income cohort)
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL  = os.getenv("DATABASE_URL")
MODEL_PATH    = os.getenv("MODEL_PATH",    "ml/model.pkl")
FEATURES_PATH = os.getenv("FEATURES_PATH", "ml/model_features.joblib")
ZEROS_PATH    = "data/zeros.csv"

# ---------------------------------------------------------------------------
# MCC category bucket mapping (for dashboard spend breakdown charts)
# ---------------------------------------------------------------------------
BUCKET_MAP = {
    # DINING
    "Eating Places and Restaurants":          "dining",
    "Drinking Places (Alcoholic Beverages)":  "dining",
    "Fast Food Restaurants":                  "dining",

    # TRAVEL
    "Passenger Railways":                         "travel",
    "Railroad Passenger Transport":               "travel",
    "Local and Suburban Commuter Transportation": "travel",
    "Taxicabs and Limousines":                    "travel",
    "Bus Lines":                                  "travel",
    "Motor Freight Carriers and Trucking":        "travel",
    "Cruise Lines":                               "travel",
    "Airlines":                                   "travel",
    "Travel Agencies":                            "travel",
    "Tolls and Bridge Fees":                      "travel",
    "Lodging - Hotels, Motels, Resorts":          "travel",

    # ENTERTAINMENT
    "Digital Goods - Media, Books, Apps":                "entertainment",
    "Digital Goods - Games":                             "entertainment",
    "Athletic Fields, Commercial Sports":                "entertainment",
    "Recreational Sports, Clubs":                        "entertainment",
    "Motion Picture Theaters":                           "entertainment",
    "Theatrical Producers":                              "entertainment",
    "Betting (including Lottery Tickets, Casinos)":      "entertainment",
    "Amusement Parks, Carnivals, Circuses":              "entertainment",
    "Music Stores - Musical Instruments":                "entertainment",
    "Book Stores":                                       "entertainment",

    # ESSENTIALS
    "Grocery Stores, Supermarkets":                        "essentials",
    "Miscellaneous Food Stores":                           "essentials",
    "Drug Stores and Pharmacies":                          "essentials",
    "Service Stations":                                    "essentials",
    "Utilities - Electric, Gas, Water, Sanitary":          "essentials",
    "Telecommunication Services":                          "essentials",
    "Cable, Satellite, and Other Pay Television Services": "essentials",
    "Insurance Sales, Underwriting":                       "essentials",
    "Laundry Services":                                    "essentials",
    "Cleaning and Maintenance Services":                   "essentials",
    "Postal Services - Government Only":                   "essentials",
    "Doctors, Physicians":                                 "essentials",
    "Dentists and Orthodontists":                          "essentials",
    "Chiropractors":                                       "essentials",
    "Optometrists, Optical Goods and Eyeglasses":          "essentials",
    "Podiatrists":                                         "essentials",
    "Hospitals":                                           "essentials",
    "Medical Services":                                    "essentials",
    "Tax Preparation Services":                            "essentials",

    # RETAIL
    "Wholesale Clubs":                                      "retail",
    "Discount Stores":                                      "retail",
    "Department Stores":                                    "retail",
    "Women's Ready-To-Wear Stores":                         "retail",
    "Family Clothing Stores":                               "retail",
    "Sports Apparel, Riding Apparel Stores":                "retail",
    "Shoe Stores":                                          "retail",
    "Furniture, Home Furnishings, and Equipment Stores":    "retail",
    "Miscellaneous Home Furnishing Stores":                 "retail",
    "Household Appliance Stores":                           "retail",
    "Electronics Stores":                                   "retail",
    "Automotive Parts and Accessories Stores":              "retail",
    "Cosmetic Stores":                                      "retail",
    "Gift, Card, Novelty Stores":                           "retail",
    "Antique Shops":                                        "retail",
    "Artist Supply Stores, Craft Shops":                    "retail",
    "Sporting Goods Stores":                                "retail",
    "Florists Supplies, Nursery Stock and Flowers":         "retail",
    "Computers, Computer Peripheral Equipment":             "retail",
    "Precious Stones and Metals":                           "retail",
    "Books, Periodicals, Newspapers":                       "retail",
    "Lumber and Building Materials":                        "retail",
    "Hardware Stores":                                      "retail",
    "Lawn and Garden Supply Stores":                        "retail",
    "Package Stores, Beer, Wine, Liquor":                   "retail",
}
BUCKETS = ["essentials", "dining", "entertainment", "travel", "retail", "other"]


def main():
    if not DATABASE_URL:
        sys.exit("DATABASE_URL not set — check your .env file.")

    engine = create_engine(DATABASE_URL)

    # ------------------------------------------------------------------
    # 1. Load model artifacts
    # ------------------------------------------------------------------
    print("Loading model and feature list...")
    model         = joblib.load(MODEL_PATH)
    feature_names = joblib.load(FEATURES_PATH)   # list of 111 feature names

    # ------------------------------------------------------------------
    # 2. Load excluded (zero-income) client IDs
    # ------------------------------------------------------------------
    print("Loading excluded users (zeros.csv)...")
    zeros_df     = pd.read_csv(ZEROS_PATH, encoding="utf-8-sig")
    excluded_ids = zeros_df["client_id"].tolist()
    excl_str     = ",".join(str(x) for x in excluded_ids)
    print(f"  Excluding {len(excluded_ids)} users")

    # ------------------------------------------------------------------
    # 3. Aggregate MCC spend per user from the database
    #    (replicates notebook groupby ['client_id','mcc'] + pivot)
    # ------------------------------------------------------------------
    print("Querying MCC spend per user (aggregated in SQL)...")
    mcc_q = f"""
        SELECT t.client_id,
               m.description AS mcc_name,
               SUM(t.amount) AS mcc_spend
        FROM   transactions t
        JOIN   mcc_codes m ON t.mcc = m.code
        WHERE  t.client_id NOT IN ({excl_str})
        GROUP  BY t.client_id, m.description
    """
    df_mcc = pd.read_sql(mcc_q, engine)
    print(f"  {len(df_mcc):,} client-MCC rows")

    # ------------------------------------------------------------------
    # 4. Monthly stats per user
    # ------------------------------------------------------------------
    print("Querying monthly stats per user...")
    monthly_q = f"""
        WITH monthly AS (
            SELECT client_id,
                   DATE_TRUNC('month', date) AS month,
                   SUM(amount)               AS monthly_spend,
                   COUNT(*)                  AS monthly_count
            FROM   transactions
            WHERE  client_id NOT IN ({excl_str})
            GROUP  BY client_id, DATE_TRUNC('month', date)
        )
        SELECT client_id,
               SUM(monthly_spend)  AS total_spend_10yr,
               AVG(monthly_spend)  AS mean_monthly_spend,
               STDDEV(monthly_spend) AS std_monthly_spend,
               COUNT(*)            AS num_months,
               SUM(monthly_count)  AS total_transactions
        FROM   monthly
        GROUP  BY client_id
    """
    df_monthly = pd.read_sql(monthly_q, engine)
    df_monthly["cv_monthly_spend"] = (
        df_monthly["std_monthly_spend"] / df_monthly["mean_monthly_spend"]
    ).fillna(0)
    df_monthly["avg_transactions_per_month"] = (
        df_monthly["total_transactions"] / df_monthly["num_months"]
    )
    print(f"  {len(df_monthly):,} users with transaction history")

    # ------------------------------------------------------------------
    # 5. Pivot MCC spend → one column per MCC name, then compute ratios
    # ------------------------------------------------------------------
    print("Pivoting MCC data and computing spend ratios...")
    df_pivot = (
        df_mcc.pivot(index="client_id", columns="mcc_name", values="mcc_spend")
        .fillna(0)
        .reset_index()
    )
    df_pivot = df_pivot.merge(
        df_monthly[["client_id", "total_spend_10yr"]], on="client_id"
    )
    mcc_cols = [c for c in df_pivot.columns if c not in ("client_id", "total_spend_10yr")]
    # Divide raw MCC amounts by total spend → ratios (matches notebook exactly)
    df_pivot[mcc_cols] = df_pivot[mcc_cols].div(
        df_pivot["total_spend_10yr"], axis=0
    ).fillna(0)

    # ------------------------------------------------------------------
    # 6. Build the 111-feature matrix the model expects
    # ------------------------------------------------------------------
    print("Building model feature matrix...")
    df_features = df_pivot[["client_id"] + mcc_cols].merge(
        df_monthly[
            ["client_id", "cv_monthly_spend", "avg_transactions_per_month",
             "total_spend_10yr", "mean_monthly_spend", "std_monthly_spend",
             "num_months"]
        ],
        on="client_id",
    )
    # Fill any MCC columns the model expects but that aren't in this dataset
    for feat in feature_names:
        if feat not in df_features.columns:
            df_features[feat] = 0.0

    X = df_features[feature_names].values

    # ------------------------------------------------------------------
    # 7. Run model predictions
    # ------------------------------------------------------------------
    print("Running model predictions...")
    proba = model.predict_proba(X)[:, 1]
    df_features["overspend_probability"] = proba

    # ------------------------------------------------------------------
    # 8. Load user + card profile data
    # ------------------------------------------------------------------
    print("Loading user and card profile data...")
    df_users = pd.read_sql(
        """SELECT id AS client_id, current_age AS age,
                  yearly_income, per_capita_income,
                  total_debt, credit_score, num_credit_cards
           FROM   users""",
        engine,
    )
    df_cards = pd.read_sql(
        """SELECT client_id,
                  AVG(credit_limit) AS avg_credit_limit,
                  SUM(credit_limit) AS total_credit_limit
           FROM   cards
           GROUP  BY client_id""",
        engine,
    )

    df_all = (
        df_features
        .merge(df_users, on="client_id", how="left")
        .merge(df_cards,  on="client_id", how="left")
    )

    # ------------------------------------------------------------------
    # 9. Derived financial / display metrics
    # ------------------------------------------------------------------
    df_all["debt_to_income_ratio"] = (
        df_all["total_debt"] / df_all["yearly_income"].replace(0, np.nan)
    ).fillna(0).clip(0, 10)

    df_all["total_monthly_spend"]    = df_all["mean_monthly_spend"]
    df_all["spending_volatility"]    = df_all["std_monthly_spend"]
    df_all["credit_utilization_rate"] = (
        df_all["mean_monthly_spend"]
        / df_all["total_credit_limit"].replace(0, np.nan)
    ).fillna(0).clip(0, 5)

    # is_overspender: avg yearly spend > yearly income (matches Classification.csv logic)
    df_all["average_yearly_spend"] = df_all["total_spend_10yr"] / 10
    df_all["is_overspender"] = (
        df_all["average_yearly_spend"] > df_all["yearly_income"]
    ).astype(int)

    # ------------------------------------------------------------------
    # 10. Cohort assignment (per-capita income quartiles)
    # ------------------------------------------------------------------
    q25, q50, q75 = df_all["per_capita_income"].quantile([0.25, 0.5, 0.75])

    def assign_cohort(inc):
        if inc <= q25:   return "low"
        elif inc <= q50: return "mid_low"
        elif inc <= q75: return "mid_high"
        else:            return "high"

    df_all["cohort"] = df_all["per_capita_income"].apply(assign_cohort)

    # ------------------------------------------------------------------
    # 11. Bucketed monthly spend in $ (for dashboard charts)
    #     bucket_$ = sum(mcc_ratios_in_bucket) * mean_monthly_spend
    # ------------------------------------------------------------------
    print("Computing bucketed category spend...")
    for bucket in BUCKETS:
        cols = [c for c in mcc_cols if BUCKET_MAP.get(c, "other") == bucket]
        if cols:
            df_all[f"spend_{bucket}"] = (
                df_all[cols].sum(axis=1) * df_all["mean_monthly_spend"]
            )
        else:
            df_all[f"spend_{bucket}"] = 0.0

    spend_total = sum(df_all[f"spend_{b}"] for b in BUCKETS)
    for bucket in BUCKETS:
        df_all[f"pct_spend_{bucket}"] = (
            df_all[f"spend_{bucket}"] / spend_total.replace(0, np.nan)
        ).fillna(0)

    # ------------------------------------------------------------------
    # 12. Write user_features table
    # ------------------------------------------------------------------
    print("Writing user_features table to database...")
    keep_cols = [
        "client_id", "age", "yearly_income", "per_capita_income",
        "total_debt", "credit_score", "num_credit_cards",
        "avg_credit_limit", "total_credit_limit",
        "debt_to_income_ratio", "total_monthly_spend",
        "spending_volatility", "credit_utilization_rate",
        "spend_essentials", "spend_dining", "spend_entertainment",
        "spend_travel", "spend_retail", "spend_other",
        "pct_spend_essentials", "pct_spend_dining", "pct_spend_entertainment",
        "pct_spend_travel", "pct_spend_retail", "pct_spend_other",
        "overspend_probability", "is_overspender", "cohort",
    ]
    df_out = df_all[keep_cols].copy()

    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS user_features CASCADE"))
    df_out.to_sql("user_features", engine, if_exists="replace", index=False)

    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE user_features ADD PRIMARY KEY (client_id)"
        ))
    print(f"  Wrote {len(df_out):,} rows to user_features")

    # ------------------------------------------------------------------
    # 13. Write cohort_benchmarks table
    #     Medians computed over SAVERS only (is_overspender == 0) so
    #     recommendations point toward realistic saver behaviour.
    # ------------------------------------------------------------------
    print("Computing cohort benchmarks (saver medians)...")
    savers = df_all[df_all["is_overspender"] == 0]
    bench_rows = []
    for cohort_name, grp in savers.groupby("cohort"):
        row = {"cohort": cohort_name}
        row["median_total_monthly_spend"]   = grp["total_monthly_spend"].median()
        for bucket in BUCKETS:
            row[f"median_spend_{bucket}"]   = grp[f"spend_{bucket}"].median()
            row[f"median_pct_{bucket}"]     = grp[f"pct_spend_{bucket}"].median()
        row["user_count"] = len(grp)
        bench_rows.append(row)

    df_bench = pd.DataFrame(bench_rows)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS cohort_benchmarks CASCADE"))
    df_bench.to_sql("cohort_benchmarks", engine, if_exists="replace", index=False)

    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE cohort_benchmarks ADD PRIMARY KEY (cohort)"
        ))
    print(f"  Wrote {len(df_bench)} cohort rows to cohort_benchmarks")
    print("\nFeature engineering complete.")


if __name__ == "__main__":
    main()
