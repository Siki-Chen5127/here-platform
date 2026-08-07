from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StaffUser, StudentUser
from ..schemas import (
    MobileLoginRequest,
    MobileRegisterRequest,
    StaffLoginRequest,
    StaffRegistrationRequest,
    TokenResponse,
    UserView,
)
from ..security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/auth", tags=["authentication"])


def _staff_token(staff: StaffUser) -> TokenResponse:
    token, expires_in = create_access_token(staff.id, "staff", staff.role)
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


@router.post("/staff/login", response_model=TokenResponse)
def staff_login(payload: StaffLoginRequest, session: Session = Depends(get_db)) -> TokenResponse:
    staff = session.scalar(select(StaffUser).where(StaffUser.email == payload.email))
    if staff is None or not verify_password(payload.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号或密码错误",
        )
    if staff.account_status == "suspended" or (
        staff.account_status == "active" and not staff.is_active
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已停用")
    return _staff_token(staff)


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
    if session.scalar(select(StudentUser.id).where(StudentUser.phone == phone)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册")

    student = StudentUser(
        phone=phone,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name.strip(),
    )
    session.add(student)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已注册") from None
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
