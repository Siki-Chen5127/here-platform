import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_staff_account
from ..email_service import send_password_reset_email
from ..models import (
    AuditLog,
    StaffPasswordReset,
    StaffProfile,
    StaffUser,
    StudentProfile,
    StudentUser,
)
from ..schemas import (
    MobileLoginRequest,
    MobileRegisterRequest,
    StaffLoginRequest,
    StaffPasswordChangeRequest,
    StaffPasswordResetConfirmRequest,
    StaffPasswordResetRequest,
    StaffRegistrationRequest,
    TokenResponse,
    UserView,
)
from ..security import (
    create_access_token,
    create_password_reset_token,
    hash_password,
    hash_password_reset_token,
    verify_password,
)
from ..config import get_settings


router = APIRouter(prefix="/auth", tags=["authentication"])
logger = logging.getLogger(__name__)


def _deliver_password_reset_email(email: str, token: str, staff_id: str) -> None:
    try:
        send_password_reset_email(email, token)
    except Exception:
        logger.exception("Password reset email delivery failed for staff_id=%s", staff_id)


def _staff_token(staff: StaffUser) -> TokenResponse:
    token, expires_in = create_access_token(
        staff.id,
        "staff",
        staff.role,
        extra_claims={"auth_version": staff.auth_version},
    )
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserView(
            id=staff.id,
            email=staff.email,
            name=staff.name,
            role=staff.role,
            accountStatus=staff.account_status,
            reviewScopes=[item for item in staff.review_scopes.split(",") if item],
        ),
    )


def _student_token(student: StudentUser) -> TokenResponse:
    token, expires_in = create_access_token(student.id, "student", "student")
    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=UserView(
            id=student.id,
            phone=student.phone,
            name=student.display_name or student.phone,
            role="student",
        ),
    )


@router.get("/mobile/registration-colleges")
def get_mobile_registration_colleges(
    session: Session = Depends(get_db),
) -> dict[str, list[str]]:
    colleges = session.scalars(
        select(StaffProfile.college)
        .join(StaffUser, StaffProfile.staff_user_id == StaffUser.id)
        .where(
            StaffUser.role == "counselor",
            StaffUser.is_active == 1,
            StaffUser.account_status == "active",
            StaffProfile.college.is_not(None),
        )
        .distinct()
        .order_by(StaffProfile.college)
    )
    return {"colleges": [college.strip() for college in colleges if college and college.strip()]}


@router.post("/staff/login", response_model=TokenResponse)
def staff_login(payload: StaffLoginRequest, session: Session = Depends(get_db)) -> TokenResponse:
    staff = session.scalar(select(StaffUser).where(StaffUser.email == payload.email))
    if staff is None or not verify_password(payload.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
        )
    if staff.account_status in {"suspended", "closed"} or (
        staff.account_status == "active" and not staff.is_active
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已停用")
    return _staff_token(staff)


@router.post("/staff/password/change")
def change_staff_password(
    payload: StaffPasswordChangeRequest,
    staff: StaffUser = Depends(get_current_staff_account),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    if staff.account_status in {"suspended", "closed"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号不可修改密码")
    if not verify_password(payload.current_password, staff.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前密码不正确")
    if verify_password(payload.new_password, staff.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码不能与当前密码相同")
    staff.password_hash = hash_password(payload.new_password)
    staff.auth_version += 1
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=staff.id,
            action="staff.password.change",
            resource_type="staff_user",
            resource_id=staff.id,
        )
    )
    session.commit()
    return {"status": "changed", "message": "密码已修改，请重新登录"}


@router.post("/staff/password-reset/request")
def request_staff_password_reset(
    payload: StaffPasswordResetRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_db),
) -> dict[str, str | None]:
    generic_message = "如果该邮箱已注册，系统会发送密码重置说明"
    staff = session.scalar(select(StaffUser).where(StaffUser.email == payload.email))
    debug_token: str | None = None
    if staff is not None and staff.account_status != "closed":
        now = datetime.now(timezone.utc)
        existing = list(
            session.scalars(
                select(StaffPasswordReset).where(
                    StaffPasswordReset.staff_user_id == staff.id,
                    StaffPasswordReset.used_at.is_(None),
                )
            )
        )
        for item in existing:
            item.used_at = now
        token, token_hash = create_password_reset_token()
        session.add(
            StaffPasswordReset(
                staff_user_id=staff.id,
                token_hash=token_hash,
                expires_at=now + timedelta(minutes=30),
            )
        )
        session.commit()
        background_tasks.add_task(_deliver_password_reset_email, staff.email, token, staff.id)
        if get_settings().environment.lower() == "development":
            debug_token = token
    return {
        "status": "accepted",
        "message": generic_message,
        "debugToken": debug_token,
    }


@router.post("/staff/password-reset/confirm")
def confirm_staff_password_reset(
    payload: StaffPasswordResetConfirmRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    reset = session.scalar(
        select(StaffPasswordReset).where(
            StaffPasswordReset.token_hash == hash_password_reset_token(payload.token),
            StaffPasswordReset.used_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    if reset is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="重置链接无效或已使用")
    expires_at = reset.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        reset.used_at = now
        session.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="重置链接已过期，请重新申请")
    staff = session.get(StaffUser, reset.staff_user_id)
    if staff is None or staff.account_status == "closed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="重置链接无效或已使用")
    if verify_password(payload.new_password, staff.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="新密码不能与原密码相同")
    staff.password_hash = hash_password(payload.new_password)
    staff.auth_version += 1
    reset.used_at = now
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=staff.id,
            action="staff.password.reset",
            resource_type="staff_user",
            resource_id=staff.id,
        )
    )
    session.commit()
    return {"status": "changed", "message": "密码已重置，请使用新密码登录"}


@router.post("/staff/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def staff_register(
    payload: StaffRegistrationRequest,
    session: Session = Depends(get_db),
) -> TokenResponse:
    if session.scalar(select(StaffUser.id).where(StaffUser.email == payload.email)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该工作邮箱已注册")

    staff = StaffUser(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role=payload.requested_role,
        is_active=False,
        account_status="profile_incomplete",
        review_scopes="psychology" if payload.requested_role == "center_director" else "",
    )
    session.add(staff)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该工作邮箱已注册") from None
    session.refresh(staff)
    return _staff_token(staff)


@router.post("/mobile/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def mobile_register(
    payload: MobileRegisterRequest,
    session: Session = Depends(get_db),
) -> TokenResponse:
    phone = payload.phone.strip()
    college = payload.college.strip()
    if not college:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="请选择所属学院")
    if session.scalar(select(StudentUser.id).where(StudentUser.phone == phone)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册")
    if not session.scalar(
        select(StaffUser.id)
        .join(StaffProfile, StaffProfile.staff_user_id == StaffUser.id)
        .where(
            StaffUser.role == "counselor",
            StaffUser.is_active == 1,
            StaffUser.account_status == "active",
            StaffProfile.college == college,
        )
        .limit(1)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该学院暂未配置可接收预警的辅导员，请联系学校管理员",
        )

    student = StudentUser(
        phone=phone,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    try:
        session.add(student)
        session.flush()
        session.add(
            StudentProfile(
                student_id=student.id,
                college=college,
                counselor_id=None,
            )
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        if session.scalar(select(StudentUser.id).where(StudentUser.phone == phone)):
            detail = "该手机号已注册"
        else:
            detail = "学生档案创建失败，请刷新学院列表后重试"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from None
    session.refresh(student)
    return _student_token(student)


@router.post("/mobile/login", response_model=TokenResponse)
def mobile_login(payload: MobileLoginRequest, session: Session = Depends(get_db)) -> TokenResponse:
    phone = payload.phone.strip()
    student = session.scalar(select(StudentUser).where(StudentUser.phone == phone))
    if student is None or student.status != "active" or not verify_password(
        payload.password,
        student.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
        )
    return _student_token(student)
