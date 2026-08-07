from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_staff_account, require_staff_roles
from ..models import (
    AuditLog,
    StaffApplication,
    StaffCredential,
    StaffProfile,
    StaffUser,
)
from ..schemas import ApplicantRole, StaffApplicationReviewRequest
from ..security import hash_sensitive_identifier


router = APIRouter(tags=["staff profiles"])
ALLOWED_PROOF_SUFFIXES = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_PROOF_SIZE = 10 * 1024 * 1024


def _profile_view(profile: StaffProfile | None) -> dict | None:
    if profile is None:
        return None
    return {
        "realName": profile.real_name,
        "displayName": profile.display_name,
        "phone": profile.phone,
        "organization": profile.organization,
        "department": profile.department,
        "college": profile.college,
        "employeeNumber": profile.employee_number,
        "idNumberMasked": f"**************{profile.id_number_last4}"
        if profile.id_number_last4
        else None,
    }


def _public_profile_data(profile_data: dict) -> dict:
    result = {
        "realName": profile_data["real_name"],
        "displayName": profile_data["display_name"],
        "phone": profile_data["phone"],
        "organization": profile_data["organization"],
        "department": profile_data["department"],
        "college": profile_data.get("college"),
        "employeeNumber": profile_data["employee_number"],
        "idNumberMasked": f"**************{profile_data['id_number_last4']}"
        if profile_data.get("id_number_last4")
        else None,
    }
    return result


def _credential_view(credential: StaffCredential) -> dict:
    return {
        "id": credential.id,
        "type": credential.credential_type,
        "name": credential.original_name,
        "sizeBytes": credential.size_bytes,
        "createdAt": credential.created_at.isoformat(),
    }


def _application_view(application: StaffApplication, session: Session) -> dict:
    applicant = session.get(StaffUser, application.staff_user_id)
    reviewer = session.get(StaffUser, application.reviewer_id) if application.reviewer_id else None
    credentials = list(
        session.scalars(
            select(StaffCredential)
            .where(StaffCredential.application_id == application.id)
            .order_by(StaffCredential.created_at)
        )
    )
    return {
        "id": application.id,
        "applicantId": application.staff_user_id,
        "applicantName": applicant.name if applicant else "已删除用户",
        "applicantEmail": applicant.email if applicant else None,
        "requestedRole": application.requested_role,
        "applicationType": application.application_type,
        "status": application.status,
        "profile": _public_profile_data(json.loads(application.profile_data)),
        "credentials": [_credential_view(item) for item in credentials],
        "reviewNote": application.review_note,
        "reviewer": reviewer.name if reviewer else None,
        "submittedAt": application.submitted_at.isoformat(),
        "reviewedAt": application.reviewed_at.isoformat() if application.reviewed_at else None,
    }


def _latest_application(staff_id: str, session: Session) -> StaffApplication | None:
    return session.scalar(
        select(StaffApplication)
        .where(StaffApplication.staff_user_id == staff_id)
        .order_by(StaffApplication.created_at.desc())
    )


async def _store_proof(file: UploadFile) -> tuple[str, str, int, str | None]:
    original_name = Path(file.filename or "").name
    suffix = Path(original_name).suffix.lower()
    if not original_name or suffix not in ALLOWED_PROOF_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="证明文件仅支持 PDF、JPG 和 PNG",
        )
    target_dir = get_settings().upload_dir / "staff-proofs"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{uuid.uuid4()}{suffix}"
    size = 0
    try:
        with target.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_PROOF_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="单个证明文件不能超过 10MB",
                    )
                output.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return original_name, str(target), size, file.content_type


@router.get("/staff/profile")
def get_staff_profile_details(
    staff: StaffUser = Depends(get_current_staff_account),
    session: Session = Depends(get_db),
) -> dict:
    profile = session.scalar(
        select(StaffProfile).where(StaffProfile.staff_user_id == staff.id)
    )
    application = _latest_application(staff.id, session)
    return {
        "account": {
            "id": staff.id,
            "email": staff.email,
            "name": staff.name,
            "role": staff.role,
            "accountStatus": staff.account_status,
        },
        "profile": _profile_view(profile),
        "latestApplication": _application_view(application, session) if application else None,
    }


@router.post("/staff/applications", status_code=status.HTTP_201_CREATED)
async def submit_staff_application(
    real_name: str = Form(..., min_length=1, max_length=100),
    display_name: str = Form(..., min_length=1, max_length=100),
    phone: str = Form(..., min_length=6, max_length=32),
    organization: str = Form(..., min_length=1, max_length=150),
    department: str = Form(..., min_length=1, max_length=100),
    college: str | None = Form(default=None, max_length=100),
    employee_number: str = Form(..., min_length=1, max_length=64),
    requested_role: ApplicantRole = Form(...),
    id_number: str | None = Form(default=None, max_length=32),
    proofs: list[UploadFile] | None = File(default=None),
    staff: StaffUser = Depends(get_current_staff_account),
    session: Session = Depends(get_db),
) -> dict:
    latest = _latest_application(staff.id, session)
    if latest and latest.status == "pending_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已有申请正在审核中")

    profile = session.scalar(
        select(StaffProfile).where(StaffProfile.staff_user_id == staff.id)
    )
    is_registration = profile is None and staff.account_status != "active"
    uploaded_files = proofs or []
    if profile is None and not uploaded_files:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="首次申请必须上传任职或资质证明")

    normalized_phone = phone.strip()
    duplicate_phone = session.scalar(
        select(StaffProfile.id).where(
            StaffProfile.phone == normalized_phone,
            StaffProfile.staff_user_id != staff.id,
        )
    )
    if duplicate_phone:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该手机号已用于其他工作人员资料")

    normalized_id = "".join(id_number.upper().split()) if id_number else ""
    if normalized_id and (len(normalized_id) not in {15, 18} or not normalized_id[:-1].isdigit()):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="身份证号格式不正确")
    id_hash = hash_sensitive_identifier(normalized_id) if normalized_id else (
        profile.id_number_hash if profile else None
    )
    id_last4 = normalized_id[-4:] if normalized_id else (
        profile.id_number_last4 if profile else None
    )
    if id_hash:
        duplicate_id = session.scalar(
            select(StaffProfile.id).where(
                StaffProfile.id_number_hash == id_hash,
                StaffProfile.staff_user_id != staff.id,
            )
        )
        if duplicate_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该身份证信息已用于其他工作人员资料")

    profile_data = {
        "real_name": real_name.strip(),
        "display_name": display_name.strip(),
        "phone": normalized_phone,
        "organization": organization.strip(),
        "department": department.strip(),
        "college": college.strip() if college else None,
        "employee_number": employee_number.strip(),
        "id_number_hash": id_hash,
        "id_number_last4": id_last4,
    }
    application = StaffApplication(
        staff_user_id=staff.id,
        requested_role=requested_role,
        application_type="registration" if is_registration else "profile_update",
        profile_data=json.dumps(profile_data, ensure_ascii=False),
        status="pending_review",
    )
    session.add(application)
    session.flush()

    stored_paths: list[str] = []
    try:
        for proof in uploaded_files:
            original_name, storage_path, size, content_type = await _store_proof(proof)
            stored_paths.append(storage_path)
            session.add(
                StaffCredential(
                    staff_user_id=staff.id,
                    application_id=application.id,
                    original_name=original_name,
                    storage_path=storage_path,
                    content_type=content_type,
                    size_bytes=size,
                )
            )
        if is_registration:
            staff.account_status = "pending_review"
            staff.is_active = False
        session.add(
            AuditLog(
                actor_type="staff",
                actor_id=staff.id,
                action="staff.application.submit",
                resource_type="staff_application",
                resource_id=application.id,
            )
        )
        session.commit()
    except Exception:
        session.rollback()
        for storage_path in stored_paths:
            Path(storage_path).unlink(missing_ok=True)
        raise
    return _application_view(application, session)


@router.get("/staff/applications/{application_id}/proofs/{credential_id}")
def download_staff_proof(
    application_id: str,
    credential_id: str,
    staff: StaffUser = Depends(get_current_staff_account),
    session: Session = Depends(get_db),
):
    credential = session.get(StaffCredential, credential_id)
    if credential is None or credential.application_id != application_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="证明文件不存在")
    if credential.staff_user_id != staff.id and staff.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权查看该证明文件")
    target = Path(credential.storage_path)
    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="证明文件不存在")
    return FileResponse(
        target,
        media_type=credential.content_type or "application/octet-stream",
        filename=credential.original_name,
    )


@router.get("/admin/staff-applications")
def get_staff_applications(
    status_filter: str = "pending_review",
    _admin: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> list[dict]:
    statement = select(StaffApplication).order_by(StaffApplication.submitted_at.desc())
    if status_filter != "all":
        statement = statement.where(StaffApplication.status == status_filter)
    return [_application_view(item, session) for item in session.scalars(statement)]


@router.post("/admin/staff-applications/{application_id}/review")
def review_staff_application(
    application_id: str,
    payload: StaffApplicationReviewRequest,
    admin: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    application = session.get(StaffApplication, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请不存在")
    if application.status != "pending_review":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="该申请已经处理")
    if payload.action != "approve" and not payload.note:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="退回或拒绝时必须填写原因")

    applicant = session.get(StaffUser, application.staff_user_id)
    if applicant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="申请账号不存在")
    now = datetime.now(timezone.utc)
    status_map = {
        "approve": "approved",
        "request_changes": "changes_requested",
        "reject": "rejected",
    }
    application.status = status_map[payload.action]
    application.review_note = payload.note
    application.reviewer_id = admin.id
    application.reviewed_at = now

    if payload.action == "approve":
        data = json.loads(application.profile_data)
        duplicate_profile = session.scalar(
            select(StaffProfile).where(
                StaffProfile.staff_user_id != applicant.id,
                or_(
                    StaffProfile.phone == data["phone"],
                    StaffProfile.id_number_hash == data.get("id_number_hash")
                    if data.get("id_number_hash")
                    else False,
                ),
            )
        )
        if duplicate_profile:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号或身份证信息已被其他账号使用")
        profile = session.scalar(
            select(StaffProfile).where(StaffProfile.staff_user_id == applicant.id)
        )
        if profile is None:
            profile = StaffProfile(staff_user_id=applicant.id)
            session.add(profile)
        profile.real_name = data["real_name"]
        profile.display_name = data["display_name"]
        profile.phone = data["phone"]
        profile.organization = data["organization"]
        profile.department = data["department"]
        profile.college = data.get("college")
        profile.employee_number = data["employee_number"]
        profile.id_number_hash = data.get("id_number_hash")
        profile.id_number_last4 = data.get("id_number_last4")
        applicant.name = data["display_name"]
        applicant.department = data["department"]
        applicant.role = application.requested_role
        applicant.account_status = "active"
        applicant.is_active = True
        if applicant.role == "center_director" and not applicant.review_scopes:
            applicant.review_scopes = "psychology"
    elif application.application_type == "registration":
        applicant.account_status = status_map[payload.action]
        applicant.is_active = False

    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=admin.id,
            action=f"staff.application.{payload.action}",
            resource_type="staff_application",
            resource_id=application.id,
            detail=payload.note,
        )
    )
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号或身份证信息已被其他账号使用") from None
    return _application_view(application, session)
