from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine_options: dict = {"pool_pre_ping": True}

if settings.database_url.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
    if ":memory:" in settings.database_url:
        engine_options["poolclass"] = StaticPool

engine = create_engine(settings.database_url, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def initialize_database() -> None:
    from . import models  # noqa: F401
    from .seed import seed_bootstrap_admin

    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)

    if settings.bootstrap_admin:
        with SessionLocal() as session:
            seed_bootstrap_admin(session)
