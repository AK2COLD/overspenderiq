from sqlalchemy import Column, Integer, Float, String, Boolean
from backend.db import Base


class UserFeature(Base):
    __tablename__ = "user_features"

    client_id               = Column(Integer, primary_key=True)
    age                     = Column(Integer)
    yearly_income           = Column(Integer)
    per_capita_income       = Column(Integer)
    total_debt              = Column(Integer)
    credit_score            = Column(Integer)
    num_credit_cards        = Column(Integer)
    avg_credit_limit        = Column(Float)
    total_credit_limit      = Column(Float)
    debt_to_income_ratio    = Column(Float)
    total_monthly_spend     = Column(Float)
    spending_volatility     = Column(Float)
    credit_utilization_rate = Column(Float)
    spend_essentials        = Column(Float)
    spend_dining            = Column(Float)
    spend_entertainment     = Column(Float)
    spend_travel            = Column(Float)
    spend_retail            = Column(Float)
    spend_other             = Column(Float)
    pct_spend_essentials    = Column(Float)
    pct_spend_dining        = Column(Float)
    pct_spend_entertainment = Column(Float)
    pct_spend_travel        = Column(Float)
    pct_spend_retail        = Column(Float)
    pct_spend_other         = Column(Float)
    overspend_probability   = Column(Float)
    is_overspender          = Column(Integer)
    cohort                  = Column(String)


class CohortBenchmark(Base):
    __tablename__ = "cohort_benchmarks"

    cohort                       = Column(String, primary_key=True)
    median_total_monthly_spend   = Column(Float)
    median_spend_essentials      = Column(Float)
    median_spend_dining          = Column(Float)
    median_spend_entertainment   = Column(Float)
    median_spend_travel          = Column(Float)
    median_spend_retail          = Column(Float)
    median_spend_other           = Column(Float)
    median_pct_essentials        = Column(Float)
    median_pct_dining            = Column(Float)
    median_pct_entertainment     = Column(Float)
    median_pct_travel            = Column(Float)
    median_pct_retail            = Column(Float)
    median_pct_other             = Column(Float)
    user_count                   = Column(Integer)
