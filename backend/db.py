import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "")
# Normalise scheme: postgres:// → postgresql+psycopg:// (psycopg3, no system libpq needed)
DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Add a PostgreSQL service in Railway "
        "and ensure it is linked to this service."
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
