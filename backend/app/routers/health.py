from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..schemas import HealthResponse


router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(session: Session = Depends(get_db)) -> HealthResponse:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="数据库不可用",
        ) from None
    settings = get_settings()
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        database=session.bind.dialect.name if session.bind else "unknown",
    )
