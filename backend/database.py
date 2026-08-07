"""Compatibility exports. New code should import from app.database."""

from app.database import Base, SessionLocal, engine, get_db, initialize_database

__all__ = ["Base", "SessionLocal", "engine", "get_db", "initialize_database"]
