from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db, initialize_database
from .routers import admin, auth, health, knowledge, mobile, staff_profiles
from .schemas import StaffLoginRequest


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    yield


settings = get_settings()
app = FastAPI(
    title="HERE 校园安全与心理健康协同平台 API",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(mobile.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(staff_profiles.router, prefix="/api/v1")
app.include_router(knowledge.router, prefix="/api/v1")


@app.post("/api/v1/login", deprecated=True)
def legacy_staff_login(
    payload: StaffLoginRequest,
    session: Session = Depends(get_db),
):
    """Compatibility route retained temporarily for older PC builds."""
    return auth.staff_login(payload, session)
