"""Legacy module retained to make stale imports fail with a clear migration target."""

from app.routers import admin, auth, health, knowledge, mobile

__all__ = ["admin", "auth", "health", "knowledge", "mobile"]
