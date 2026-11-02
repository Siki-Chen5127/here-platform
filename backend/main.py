"""Compatibility entry point for `python main.py` and older IDE run configurations."""

import uvicorn

from app.config import get_settings
from app.main import app


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=not settings.is_production,
    )

