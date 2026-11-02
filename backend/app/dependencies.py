from __future__ import annotations

from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import StaffUser, StudentUser
from .security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedActor:
    id: str
    actor_type: str
    role: str
    auth_version: int


def get_current_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthenticatedActor:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少登录凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
        subject = str(payload["sub"])
        actor_type = str(payload["actor_type"])
        role = str(payload["role"])
        auth_version = int(payload.get("auth_version", 0))
    except (jwt.InvalidTokenError, KeyError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    return AuthenticatedActor(
        id=subject,
        actor_type=actor_type,
        role=role,
        auth_version=auth_version,
    )


def get_current_staff_account(
    actor: AuthenticatedActor = Depends(get_current_actor),
    session: Session = Depends(get_db),
) -> StaffUser:
    if actor.actor_type != "staff":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅工作人员可访问")
    staff = session.get(StaffUser, actor.id)
    if staff is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="工作人员账号不存在")
    if actor.auth_version != staff.auth_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录状态已失效，请重新登录")
    return staff


def get_current_staff(
    staff: StaffUser = Depends(get_current_staff_account),
) -> StaffUser:
    if not staff.is_active or staff.account_status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="工作人员账号尚未启用")
    return staff


def get_current_student(
    actor: AuthenticatedActor = Depends(get_current_actor),
    session: Session = Depends(get_db),
) -> StudentUser:
    if actor.actor_type != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅学生账号可访问")
    student = session.get(StudentUser, actor.id)
    if student is None or student.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="学生账号不可用")
    return student


def require_staff_roles(*roles: str):
    def dependency(staff: StaffUser = Depends(get_current_staff)) -> StaffUser:
        if staff.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前角色无权执行此操作")
        return staff

    return dependency
