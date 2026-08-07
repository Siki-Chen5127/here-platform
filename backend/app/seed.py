from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import StaffUser
from .security import hash_password


def seed_bootstrap_admin(session: Session) -> None:
    settings = get_settings()
    existing = session.scalar(
        select(StaffUser).where(StaffUser.email == settings.bootstrap_admin_email)
    )
    if existing:
        return

    session.add(
        StaffUser(
            email=settings.bootstrap_admin_email,
            password_hash=hash_password(settings.bootstrap_admin_password),
            name=settings.bootstrap_admin_name,
            role="admin",
            is_active=True,
            account_status="active",
            review_scopes="",
        )
    )
    session.commit()
