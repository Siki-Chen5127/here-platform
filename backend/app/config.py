from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_list(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    if not value:
        return default
    return tuple(item.strip() for item in value.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    environment: str
    api_host: str
    api_port: int
    database_url: str
    cors_origins: tuple[str, ...]
    jwt_secret: str
    jwt_algorithm: str
    access_token_minutes: int
    auto_create_schema: bool
    bootstrap_admin: bool
    bootstrap_admin_email: str
    bootstrap_admin_password: str
    bootstrap_admin_name: str
    upload_dir: Path

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate(self) -> None:
        if self.is_production and len(self.jwt_secret) < 32:
            raise RuntimeError("HERE_JWT_SECRET must contain at least 32 characters in production")
        if self.is_production and self.auto_create_schema:
            raise RuntimeError("HERE_AUTO_CREATE_SCHEMA must be false in production; use Alembic migrations")
        if self.is_production and self.bootstrap_admin:
            raise RuntimeError("HERE_BOOTSTRAP_ADMIN must be false in production")


@lru_cache
def get_settings() -> Settings:
    default_sqlite = f"sqlite:///{(BASE_DIR / 'here-dev.db').as_posix()}"
    settings = Settings(
        environment=os.getenv("HERE_ENVIRONMENT", "development"),
        api_host=os.getenv("HERE_API_HOST", "127.0.0.1"),
        api_port=int(os.getenv("HERE_API_PORT", "8000")),
        database_url=os.getenv("HERE_DATABASE_URL", default_sqlite),
        cors_origins=_as_list(
            os.getenv("HERE_CORS_ORIGINS"),
            ("http://localhost:5173", "http://127.0.0.1:5173"),
        ),
        jwt_secret=os.getenv("HERE_JWT_SECRET", "development-only-change-this-secret"),
        jwt_algorithm="HS256",
        access_token_minutes=int(os.getenv("HERE_ACCESS_TOKEN_MINUTES", "60")),
        auto_create_schema=_as_bool(os.getenv("HERE_AUTO_CREATE_SCHEMA"), default=True),
        bootstrap_admin=_as_bool(os.getenv("HERE_BOOTSTRAP_ADMIN"), default=True),
        bootstrap_admin_email=os.getenv("HERE_BOOTSTRAP_ADMIN_EMAIL", "admin@here.edu").lower(),
        bootstrap_admin_password=os.getenv("HERE_BOOTSTRAP_ADMIN_PASSWORD", "ChangeMe123!"),
        bootstrap_admin_name=os.getenv("HERE_BOOTSTRAP_ADMIN_NAME", "系统管理员"),
        upload_dir=Path(os.getenv("HERE_UPLOAD_DIR", str(BASE_DIR / "uploads"))),
    )
    settings.validate()
    return settings
