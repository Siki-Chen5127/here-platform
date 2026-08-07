from __future__ import annotations

import os
import re

import pyodbc
from dotenv import load_dotenv

from app.config import BASE_DIR


load_dotenv(BASE_DIR / ".env", override=False)

server = os.getenv("HERE_SQLSERVER_HOST", "localhost")
database = os.getenv("HERE_SQLSERVER_DATABASE", "HerePlatform")
driver = os.getenv("HERE_SQLSERVER_DRIVER", "ODBC Driver 17 for SQL Server")

if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,127}", database):
    raise ValueError("HERE_SQLSERVER_DATABASE must be a simple SQL Server identifier")

connection_string = (
    f"DRIVER={{{driver}}};"
    f"SERVER={server};"
    "DATABASE=master;"
    "Trusted_Connection=yes;"
    "Encrypt=no"
)

with pyodbc.connect(connection_string, autocommit=True, timeout=10) as connection:
    cursor = connection.cursor()
    exists = cursor.execute(
        "SELECT 1 FROM sys.databases WHERE name = ?",
        database,
    ).fetchone()
    if exists:
        print(f"Database already exists: {database}")
    else:
        cursor.execute(f"CREATE DATABASE [{database}]")
        print(f"Database created: {database}")
