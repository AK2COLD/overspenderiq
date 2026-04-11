#!/usr/bin/env python3
"""
Import transactions-fraud-datasets into overspender_db (PostgreSQL).

Tables created (in dependency order):
  mcc_codes  <- lookup
  users
  cards      -> users
  transactions -> users, cards, mcc_codes
  fraud_labels -> transactions
"""

import json
import getpass
from io import StringIO

import pandas as pd
import psycopg2

DATASET_PATH = (
    "/home/alexk/.cache/kagglehub/datasets/"
    "computingvictor/transactions-fraud-datasets/versions/1"
)
CHUNK_SIZE = 100_000

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

DROP_AND_CREATE = """
DROP TABLE IF EXISTS fraud_labels   CASCADE;
DROP TABLE IF EXISTS transactions   CASCADE;
DROP TABLE IF EXISTS cards          CASCADE;
DROP TABLE IF EXISTS users          CASCADE;
DROP TABLE IF EXISTS mcc_codes      CASCADE;

CREATE TABLE mcc_codes (
    code        INTEGER PRIMARY KEY,
    description TEXT    NOT NULL
);

CREATE TABLE users (
    id                INTEGER PRIMARY KEY,
    current_age       INTEGER,
    retirement_age    INTEGER,
    birth_year        INTEGER,
    birth_month       INTEGER,
    gender            VARCHAR(10),
    address           TEXT,
    latitude          NUMERIC(9,6),
    longitude         NUMERIC(9,6),
    per_capita_income INTEGER,
    yearly_income     INTEGER,
    total_debt        INTEGER,
    credit_score      INTEGER,
    num_credit_cards  INTEGER
);

CREATE TABLE cards (
    id                    INTEGER PRIMARY KEY,
    client_id             INTEGER     REFERENCES users(id),
    card_brand            VARCHAR(20),
    card_type             VARCHAR(20),
    card_number           VARCHAR(20),
    expires               VARCHAR(7),
    cvv                   VARCHAR(4),
    has_chip              BOOLEAN,
    num_cards_issued      INTEGER,
    credit_limit          INTEGER,
    acct_open_date        VARCHAR(7),
    year_pin_last_changed INTEGER,
    card_on_dark_web      BOOLEAN
);

CREATE TABLE transactions (
    id              BIGINT PRIMARY KEY,
    date            TIMESTAMP,
    client_id       INTEGER      REFERENCES users(id),
    card_id         INTEGER      REFERENCES cards(id),
    amount          NUMERIC(12,2),
    use_chip        VARCHAR(30),
    merchant_id     INTEGER,
    merchant_city   VARCHAR(100),
    merchant_state  VARCHAR(50),
    zip             VARCHAR(10),
    mcc             INTEGER      REFERENCES mcc_codes(code),
    errors          TEXT
);

CREATE TABLE fraud_labels (
    transaction_id  BIGINT  PRIMARY KEY REFERENCES transactions(id),
    is_fraud        BOOLEAN NOT NULL
);
"""

INDEXES = """
CREATE INDEX idx_cards_client_id         ON cards(client_id);
CREATE INDEX idx_transactions_client_id  ON transactions(client_id);
CREATE INDEX idx_transactions_card_id    ON transactions(card_id);
CREATE INDEX idx_transactions_mcc        ON transactions(mcc);
CREATE INDEX idx_transactions_date       ON transactions(date);
CREATE INDEX idx_fraud_labels_is_fraud   ON fraud_labels(is_fraud);
"""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_dollar(series):
    """'$24,295' -> 24295  (returns numeric series)"""
    return (
        series.astype(str)
        .str.replace(r'[\$,]', '', regex=True)
        .replace('nan', None)
        .pipe(pd.to_numeric, errors='coerce')
    )

def yn_to_bool(series):
    """'YES'/'Yes'/'NO'/'No' -> True/False"""
    upper = series.str.upper()
    return upper.map({'YES': True, 'NO': False})

def clean_zip(series):
    """'52722.0' -> '52722'"""
    return (
        series.astype(str)
        .str.split('.').str[0]
        .replace('nan', None)
    )

def to_csv_buf(df):
    buf = StringIO()
    df.to_csv(buf, index=False, header=False, na_rep='')
    buf.seek(0)
    return buf

def copy_df(cur, df, table, columns):
    buf = to_csv_buf(df)
    cur.copy_expert(
        f"COPY {table} ({','.join(columns)}) FROM STDIN WITH (FORMAT CSV, NULL '')",
        buf,
    )

# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------

def load_mcc_codes(cur):
    print("Loading mcc_codes...", flush=True)
    with open(f"{DATASET_PATH}/mcc_codes.json") as f:
        mcc = json.load(f)
    buf = StringIO()
    for code, desc in mcc.items():
        escaped = desc.replace('\t', ' ')
        buf.write(f"{code}\t{escaped}\n")
    buf.seek(0)
    cur.copy_from(buf, 'mcc_codes', columns=('code', 'description'))
    print(f"  {len(mcc)} rows")


def load_users(cur):
    print("Loading users...", flush=True)
    df = pd.read_csv(f"{DATASET_PATH}/users_data.csv")
    for col in ['per_capita_income', 'yearly_income', 'total_debt']:
        df[col] = strip_dollar(df[col])
    copy_df(cur, df, 'users', list(df.columns))
    print(f"  {len(df)} rows")


def load_cards(cur):
    print("Loading cards...", flush=True)
    df = pd.read_csv(f"{DATASET_PATH}/cards_data.csv")
    df['has_chip']         = yn_to_bool(df['has_chip'])
    df['card_on_dark_web'] = yn_to_bool(df['card_on_dark_web'])
    df['credit_limit']     = strip_dollar(df['credit_limit'])
    copy_df(cur, df, 'cards', list(df.columns))
    print(f"  {len(df)} rows")


def load_transactions(cur, conn):
    print("Loading transactions (13M rows — a few minutes)...", flush=True)
    cols = ['id','date','client_id','card_id','amount','use_chip',
            'merchant_id','merchant_city','merchant_state','zip','mcc','errors']
    total = 0
    for chunk in pd.read_csv(f"{DATASET_PATH}/transactions_data.csv",
                              chunksize=CHUNK_SIZE):
        chunk['amount'] = strip_dollar(chunk['amount'])
        chunk['zip']    = clean_zip(chunk['zip'])
        copy_df(cur, chunk, 'transactions', cols)
        conn.commit()
        total += len(chunk)
        print(f"  {total:,} / ~13,300,000\r", end='', flush=True)
    print(f"\n  {total:,} rows")


def load_fraud_labels(cur):
    print("Loading fraud_labels...", flush=True)
    with open(f"{DATASET_PATH}/train_fraud_labels.json") as f:
        data = json.load(f)
    labels = data['target']   # {transaction_id_str: "Yes"/"No"}
    buf = StringIO()
    for txn_id, label in labels.items():
        buf.write(f"{txn_id}\t{'t' if label == 'Yes' else 'f'}\n")
    buf.seek(0)
    cur.copy_from(buf, 'fraud_labels', columns=('transaction_id', 'is_fraud'))
    print(f"  {len(labels):,} rows")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    password = getpass.getpass("PostgreSQL password for postgres@localhost: ")
    conn = psycopg2.connect(
        host="localhost",
        dbname="overspender_db",
        user="postgres",
        password=password,
    )
    cur = conn.cursor()

    print("\nCreating schema...")
    cur.execute(DROP_AND_CREATE)
    conn.commit()

    load_mcc_codes(cur);  conn.commit()
    load_users(cur);      conn.commit()
    load_cards(cur);      conn.commit()
    load_transactions(cur, conn)   # commits per chunk
    load_fraud_labels(cur);  conn.commit()

    print("\nBuilding indexes...")
    cur.execute(INDEXES)
    conn.commit()

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
