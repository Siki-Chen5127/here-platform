from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_staff, require_staff_roles
from ..models import AuditLog, KnowledgeDocument, StaffUser
from ..schemas import (
    KnowledgeAdminBatchRequest,
    KnowledgeReviewRequest,
    KnowledgeSubmissionUpdateRequest,
)


router = APIRouter(prefix="/knowledge", tags=["knowledge"])
ALLOWED_SUFFIXES = {".pdf", ".doc", ".docx", ".txt"}
MAX_FILE_SIZE = 20 * 1024 * 1024
CONTRIBUTOR_ROLES = {"counselor", "psychologist"}
REVIEWER_ROLES = {"center_director", "supervisor"}
EDITABLE_STATUSES = {"draft", "changes_requested"}
ADMIN_MANAGED_STATUSES = {"published", "archived"}


def _document_view(document: KnowledgeDocument, session: Session) -> dict:
    uploader = session.get(StaffUser, document.uploaded_by_id)
    reviewer = session.get(StaffUser, document.reviewer_id) if document.reviewer_id else None
    publisher = (
        session.get(StaffUser, document.published_by_id)
        if document.published_by_id
        else None
    )
    file_available = (
        not document.storage_path.startswith("legacy://")
        and Path(document.storage_path).is_file()
    )
    return {
        "id": document.id,
        "name": document.name,
        "description": document.description,
        "category": document.category,
        "domain": document.domain,
        "sourceUrl": document.source_url,
        "nodes": document.node_count,
        "sizeBytes": document.size_bytes,
        "contentType": document.content_type,
        "fileAvailable": file_available,
        "status": document.status,
        "graphStatus": document.graph_status,
        "version": document.version,
        "uploader": uploader.name if uploader else "未知用户",
        "uploaderRole": uploader.role if uploader else None,
        "reviewer": reviewer.name if reviewer else None,
        "publisher": publisher.name if publisher else None,
        "reviewNote": document.review_note,
        "createdAt": document.created_at.isoformat(),
        "updatedAt": document.updated_at.isoformat(),
        "submittedAt": document.submitted_at.isoformat() if document.submitted_at else None,
        "reviewedAt": document.reviewed_at.isoformat() if document.reviewed_at else None,
        "publishedAt": document.published_at.isoformat() if document.published_at else None,
    }


def _audit(
    session: Session,
    staff: StaffUser,
    action: str,
    document: KnowledgeDocument,
    detail: str | None = None,
) -> None:
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=staff.id,
            action=action,
            resource_type="knowledge_document",
            resource_id=document.id,
            detail=detail,
        )
    )


def _editable_owned_document(
    document_id: str,
    staff: StaffUser,
    session: Session,
) -> KnowledgeDocument:
    document = session.get(KnowledgeDocument, document_id)
    if document is None or document.uploaded_by_id != staff.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    if document.status not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="资料已提交审核，当前状态不能修改",
        )
    return document


def _admin_managed_document(
    document_id: str,
    session: Session,
) -> KnowledgeDocument:
    document = session.get(KnowledgeDocument, document_id)
    if document is None or document.status not in ADMIN_MANAGED_STATUSES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识资料不存在")
    return document


def _review_scopes(staff: StaffUser) -> set[str]:
    if staff.role == "admin":
        return {"psychology", "student_affairs"}
    scopes = {item for item in staff.review_scopes.split(",") if item}
    if not scopes and staff.role in REVIEWER_ROLES:
        scopes.add("psychology")
    return scopes


def _ensure_can_review(staff: StaffUser, document: KnowledgeDocument) -> None:
    if document.domain not in _review_scopes(staff):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号不负责该领域资料审核")
    if document.uploaded_by_id == staff.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="不能审核自己提交的资料")


async def _store_file(file: UploadFile) -> tuple[str, int, str | None]:
    original_name = Path(file.filename or "").name
    suffix = Path(original_name).suffix.lower()
    if not original_name or suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅支持 PDF、Word 和 TXT",
        )

    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    target = settings.upload_dir / f"{uuid.uuid4()}{suffix}"
    size = 0
    try:
        with target.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="文件不能超过 20MB",
                    )
                output.write(chunk)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return str(target), size, file.content_type


def _delete_local_file(storage_path: str) -> None:
    if storage_path.startswith("legacy://"):
        return
    settings = get_settings()
    upload_root = settings.upload_dir.resolve()
    target = Path(storage_path).resolve()
    if target == upload_root or upload_root not in target.parents:
        return
    target.unlink(missing_ok=True)


@router.get("/published")
@router.get("/docs")
def get_published_documents(
    _staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> list[dict]:
    documents = session.scalars(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.status == "published")
        .order_by(KnowledgeDocument.published_at.desc(), KnowledgeDocument.created_at.desc())
    )
    return [_document_view(document, session) for document in documents]


@router.get("/documents/{document_id}/file")
def download_document_file(
    document_id: str,
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
):
    document = session.get(KnowledgeDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    can_read = (
        document.status == "published"
        or document.uploaded_by_id == staff.id
        or document.domain in _review_scopes(staff)
        or staff.role == "admin"
    )
    if not can_read:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    if document.storage_path.startswith("legacy://"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="历史资料未保留原始文件",
        )
    target = Path(document.storage_path)
    if not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    suffix = target.suffix
    download_name = document.name if Path(document.name).suffix else f"{document.name}{suffix}"
    return FileResponse(
        path=target,
        media_type=document.content_type or "application/octet-stream",
        filename=download_name,
    )


@router.get("/submissions")
def get_submissions(
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> list[dict]:
    statement = select(KnowledgeDocument).order_by(KnowledgeDocument.updated_at.desc())
    scopes = _review_scopes(staff)
    if staff.role in CONTRIBUTOR_ROLES:
        statement = statement.where(
            or_(
                KnowledgeDocument.uploaded_by_id == staff.id,
                KnowledgeDocument.domain.in_(scopes) if scopes else False,
            )
        )
    elif scopes:
        statement = statement.where(KnowledgeDocument.domain.in_(scopes))
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号没有资料管理权限")
    documents = session.scalars(statement)
    return [_document_view(document, session) for document in documents]


@router.get("/submissions/{document_id}")
def get_submission(
    document_id: str,
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> dict:
    document = session.get(KnowledgeDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    if document.uploaded_by_id != staff.id and document.domain not in _review_scopes(staff):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    return _document_view(document, session)


@router.post("/submissions", status_code=status.HTTP_201_CREATED)
async def create_submission(
    name: str = Form(...),
    category: str = Form(...),
    domain: str = Form(default="psychology"),
    description: str | None = Form(default=None),
    source_url: str | None = Form(default=None),
    file: UploadFile = File(...),
    staff: StaffUser = Depends(require_staff_roles("counselor", "psychologist")),
    session: Session = Depends(get_db),
) -> dict:
    metadata = KnowledgeSubmissionUpdateRequest(
        name=name,
        category=category,
        domain=domain,
        description=description,
        source_url=source_url,
    )
    storage_path, size, content_type = await _store_file(file)
    document = KnowledgeDocument(
        name=metadata.name,
        description=metadata.description,
        category=metadata.category,
        domain=metadata.domain,
        source_url=metadata.source_url,
        storage_path=storage_path,
        content_type=content_type,
        size_bytes=size,
        uploaded_by_id=staff.id,
        status="draft",
        graph_status="not_started",
    )
    session.add(document)
    session.flush()
    _audit(session, staff, "knowledge.create", document)
    session.commit()
    return _document_view(document, session)


@router.patch("/submissions/{document_id}")
def update_submission(
    document_id: str,
    payload: KnowledgeSubmissionUpdateRequest,
    staff: StaffUser = Depends(require_staff_roles("counselor", "psychologist")),
    session: Session = Depends(get_db),
) -> dict:
    document = _editable_owned_document(document_id, staff, session)
    document.name = payload.name
    document.category = payload.category
    document.domain = payload.domain
    document.description = payload.description
    document.source_url = payload.source_url
    document.review_note = None
    if document.status == "changes_requested":
        document.status = "draft"
    _audit(session, staff, "knowledge.update", document)
    session.commit()
    return _document_view(document, session)


@router.put("/submissions/{document_id}/file")
async def replace_submission_file(
    document_id: str,
    file: UploadFile = File(...),
    staff: StaffUser = Depends(require_staff_roles("counselor", "psychologist")),
    session: Session = Depends(get_db),
) -> dict:
    document = _editable_owned_document(document_id, staff, session)
    previous_path = document.storage_path
    storage_path, size, content_type = await _store_file(file)
    document.storage_path = storage_path
    document.size_bytes = size
    document.content_type = content_type
    document.node_count = 0
    document.graph_status = "not_started"
    document.review_note = None
    if document.status == "changes_requested":
        document.status = "draft"
    _audit(session, staff, "knowledge.file_replace", document)
    session.commit()
    _delete_local_file(previous_path)
    return _document_view(document, session)


@router.delete(
    "/submissions/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_submission(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("counselor", "psychologist")),
    session: Session = Depends(get_db),
):
    document = _editable_owned_document(document_id, staff, session)
    storage_path = document.storage_path
    _audit(session, staff, "knowledge.delete", document)
    session.delete(document)
    session.commit()
    _delete_local_file(storage_path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/submissions/{document_id}/submit")
def submit_for_review(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("counselor", "psychologist")),
    session: Session = Depends(get_db),
) -> dict:
    document = _editable_owned_document(document_id, staff, session)
    document.status = "submitted"
    document.submitted_at = datetime.now(timezone.utc)
    document.review_note = None
    _audit(session, staff, "knowledge.submit", document)
    session.commit()
    return _document_view(document, session)


@router.post("/submissions/{document_id}/review")
def review_submission(
    document_id: str,
    payload: KnowledgeReviewRequest,
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> dict:
    document = session.get(KnowledgeDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    if document.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="只有待审核资料可以执行审核",
        )
    _ensure_can_review(staff, document)
    if payload.action in {"request_changes", "reject"} and not payload.note:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="退回或拒绝时必须填写审核意见",
        )

    status_map = {
        "approve": "approved",
        "request_changes": "changes_requested",
        "reject": "rejected",
    }
    document.status = status_map[payload.action]
    document.review_note = payload.note
    document.reviewer_id = staff.id
    document.reviewed_at = datetime.now(timezone.utc)
    _audit(
        session,
        staff,
        f"knowledge.review.{payload.action}",
        document,
        detail=payload.note,
    )
    session.commit()
    return _document_view(document, session)


@router.post("/submissions/{document_id}/publish")
def publish_submission(
    document_id: str,
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> dict:
    document = session.get(KnowledgeDocument, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="资料不存在")
    if document.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="资料审核通过后才能发布",
        )
    _ensure_can_review(staff, document)
    document.status = "published"
    document.published_by_id = staff.id
    document.published_at = datetime.now(timezone.utc)
    document.graph_status = "ready" if document.node_count > 0 else "queued"
    _audit(session, staff, "knowledge.publish", document)
    session.commit()
    return _document_view(document, session)


@router.get("/admin/documents")
def get_admin_documents(
    _staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> list[dict]:
    documents = session.scalars(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.status.in_(ADMIN_MANAGED_STATUSES))
        .order_by(KnowledgeDocument.updated_at.desc())
    )
    return [_document_view(document, session) for document in documents]


@router.post("/admin/documents", status_code=status.HTTP_201_CREATED)
async def create_admin_document(
    name: str = Form(...),
    category: str = Form(...),
    domain: str = Form(default="psychology"),
    description: str | None = Form(default=None),
    source_url: str | None = Form(default=None),
    file: UploadFile = File(...),
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    metadata = KnowledgeSubmissionUpdateRequest(
        name=name,
        category=category,
        domain=domain,
        description=description,
        source_url=source_url,
    )
    storage_path, size, content_type = await _store_file(file)
    now = datetime.now(timezone.utc)
    document = KnowledgeDocument(
        name=metadata.name,
        description=metadata.description,
        category=metadata.category,
        domain=metadata.domain,
        source_url=metadata.source_url,
        storage_path=storage_path,
        content_type=content_type,
        size_bytes=size,
        uploaded_by_id=staff.id,
        published_by_id=staff.id,
        status="published",
        graph_status="queued",
        published_at=now,
    )
    session.add(document)
    session.flush()
    _audit(session, staff, "knowledge.admin.create", document)
    session.commit()
    return _document_view(document, session)


@router.post("/admin/documents/batch")
def batch_admin_documents(
    payload: KnowledgeAdminBatchRequest,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict[str, int | str]:
    documents = list(
        session.scalars(
            select(KnowledgeDocument).where(
                KnowledgeDocument.id.in_(payload.document_ids),
                KnowledgeDocument.status.in_(ADMIN_MANAGED_STATUSES),
            )
        )
    )
    if len(documents) != len(payload.document_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="部分知识资料不存在或已不在管理范围内，请刷新后重试",
        )

    required_status = {
        "archive": "published",
        "restore": "archived",
        "graph_retry": "published",
    }[payload.action]
    if any(document.status != required_status for document in documents):
        status_label = "已发布" if required_status == "published" else "已下架"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"该批量操作只能处理{status_label}资料",
        )

    for document in documents:
        if payload.action == "archive":
            document.status = "archived"
        elif payload.action == "restore":
            document.status = "published"
            if document.graph_status != "ready":
                document.graph_status = "queued"
        else:
            document.node_count = 0
            document.graph_status = "queued"

        _audit(
            session,
            staff,
            f"knowledge.admin.{payload.action}",
            document,
            detail="batch=true",
        )

    session.commit()
    return {"status": "success", "processed": len(documents)}


@router.patch("/admin/documents/{document_id}")
def update_admin_document(
    document_id: str,
    payload: KnowledgeSubmissionUpdateRequest,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    document = _admin_managed_document(document_id, session)
    document.name = payload.name
    document.category = payload.category
    document.domain = payload.domain
    document.description = payload.description
    document.source_url = payload.source_url
    _audit(session, staff, "knowledge.admin.update", document)
    session.commit()
    return _document_view(document, session)


@router.put("/admin/documents/{document_id}/file")
async def replace_admin_document_file(
    document_id: str,
    file: UploadFile = File(...),
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    document = _admin_managed_document(document_id, session)
    previous_path = document.storage_path
    storage_path, size, content_type = await _store_file(file)
    document.storage_path = storage_path
    document.size_bytes = size
    document.content_type = content_type
    document.node_count = 0
    document.graph_status = "queued" if document.status == "published" else "not_started"
    document.version += 1
    _audit(
        session,
        staff,
        "knowledge.admin.file_replace",
        document,
        detail=f"version={document.version}",
    )
    session.commit()
    _delete_local_file(previous_path)
    return _document_view(document, session)


@router.post("/admin/documents/{document_id}/archive")
def archive_admin_document(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    document = _admin_managed_document(document_id, session)
    if document.status != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="只有已发布资料可以下架")
    document.status = "archived"
    _audit(session, staff, "knowledge.admin.archive", document)
    session.commit()
    return _document_view(document, session)


@router.post("/admin/documents/{document_id}/restore")
def restore_admin_document(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    document = _admin_managed_document(document_id, session)
    if document.status != "archived":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="只有已下架资料可以恢复")
    document.status = "published"
    if document.graph_status != "ready":
        document.graph_status = "queued"
    _audit(session, staff, "knowledge.admin.restore", document)
    session.commit()
    return _document_view(document, session)


@router.post("/admin/documents/{document_id}/graph/retry")
def retry_admin_document_graph(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict:
    document = _admin_managed_document(document_id, session)
    if document.status != "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="已下架资料不能处理知识图谱")
    document.node_count = 0
    document.graph_status = "queued"
    _audit(session, staff, "knowledge.admin.graph_retry", document)
    session.commit()
    return _document_view(document, session)


@router.delete(
    "/admin/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_admin_document(
    document_id: str,
    staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
):
    document = _admin_managed_document(document_id, session)
    if document.status != "archived":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="资料下架后才能永久删除")
    storage_path = document.storage_path
    _audit(
        session,
        staff,
        "knowledge.admin.delete",
        document,
        detail=f"name={document.name}",
    )
    session.delete(document)
    session.commit()
    _delete_local_file(storage_path)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/upload", deprecated=True)
def legacy_upload_disabled(
    _staff: StaffUser = Depends(get_current_staff),
) -> None:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="旧上传入口已停用，请使用资料提交与审核流程",
    )
