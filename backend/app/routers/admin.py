from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_staff, require_staff_roles
from ..models import (
    Alert,
    AuditLog,
    ConsultationAssignment,
    Intervention,
    KnowledgeDocument,
    StaffApplication,
    StaffProfile,
    StaffUser,
    StudentProfile,
    StudentUser,
    WorkOrder,
)
from ..schemas import (
    StaffCreateRequest,
    StaffReviewScopesRequest,
    StaffStatusUpdateRequest,
    WorkOrderResolveRequest,
    WorkOrderView,
)
from ..security import hash_password


router = APIRouter(tags=["staff"])

LEVEL_TEXT = {
    "low": "低风险",
    "medium": "一般预警",
    "high": "高风险",
    "critical": "紧急预警",
}

AUDIT_ACTION_LABELS = {
    "staff.create": "创建工作人员账号",
    "staff.activate": "启用工作人员账号",
    "staff.deactivate": "停用工作人员账号",
    "work_order.resolve": "完成预警工单",
    "knowledge.create": "新建知识资料草稿",
    "knowledge.update": "修改知识资料",
    "knowledge.file_replace": "替换知识资料文件",
    "knowledge.delete": "删除知识资料草稿",
    "knowledge.submit": "提交知识资料审核",
    "knowledge.review.approve": "审核通过知识资料",
    "knowledge.review.request_changes": "退回知识资料修改",
    "knowledge.review.reject": "拒绝知识资料",
    "knowledge.publish": "发布知识资料",
    "knowledge.admin.create": "管理员导入知识资料",
    "knowledge.admin.update": "管理员修改知识资料",
    "knowledge.admin.file_replace": "管理员替换知识资料文件",
    "knowledge.admin.archive": "管理员下架知识资料",
    "knowledge.admin.restore": "管理员恢复知识资料",
    "knowledge.admin.graph_retry": "重新处理知识图谱",
    "knowledge.admin.delete": "管理员永久删除知识资料",
    "staff.application.submit": "提交工作人员入驻申请",
    "staff.application.approve": "通过工作人员入驻申请",
    "staff.application.request_changes": "退回工作人员入驻申请",
    "staff.application.reject": "拒绝工作人员入驻申请",
    "staff.review_scopes.update": "修改知识审核范围",
}

AUDIT_RESOURCE_LABELS = {
    "staff_user": "工作人员账号",
    "work_order": "预警工单",
    "knowledge_document": "知识资料",
    "staff_application": "入驻申请",
}


def _work_order_scope(statement, staff: StaffUser):
    if staff.role == "supervisor":
        return statement
    if staff.role == "counselor":
        return statement.outerjoin(
            StudentProfile,
            StudentProfile.student_id == Alert.student_id,
        ).where(
            (WorkOrder.assignee_id == staff.id)
            | (
                WorkOrder.assignee_id.is_(None)
                & (StudentProfile.counselor_id == staff.id)
            )
        )
    if staff.role == "psychologist":
        return statement.where(WorkOrder.assignee_id == staff.id)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="系统管理员不读取学生个案，请使用账号与审计管理功能",
    )


@router.get("/workorders", response_model=list[WorkOrderView])
def get_workorders(
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> list[WorkOrderView]:
    statement = (
        select(WorkOrder, Alert, StudentUser)
        .join(Alert, WorkOrder.alert_id == Alert.id)
        .join(StudentUser, Alert.student_id == StudentUser.id)
        .order_by(WorkOrder.created_at.desc())
    )
    rows = session.execute(_work_order_scope(statement, staff)).all()
    return [
        WorkOrderView(
            id=work_order.id,
            level=work_order.priority,
            levelText=LEVEL_TEXT.get(work_order.priority, work_order.priority),
            time=work_order.created_at.isoformat(),
            source=alert.source,
            student=student.display_name or student.phone,
            summary=work_order.summary,
            details=alert.description or "",
            status=work_order.status,
        )
        for work_order, alert, student in rows
    ]


@router.post("/workorders/{order_id}/resolve")
def resolve_work_order(
    order_id: str,
    payload: WorkOrderResolveRequest,
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    statement = (
        select(WorkOrder)
        .join(Alert, WorkOrder.alert_id == Alert.id)
        .where(WorkOrder.id == order_id)
    )
    work_order = session.scalar(_work_order_scope(statement, staff))
    if work_order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工单不存在或无权处理")

    work_order.status = "resolved"
    work_order.resolution_note = payload.note.strip() or None
    work_order.resolved_at = datetime.now(timezone.utc)
    session.add(
        Intervention(
            work_order_id=work_order.id,
            staff_user_id=staff.id,
            action_type="resolve",
            note=work_order.resolution_note,
        )
    )
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=staff.id,
            action="work_order.resolve",
            resource_type="work_order",
            resource_id=work_order.id,
        )
    )
    session.commit()
    return {"status": "success"}


@router.get("/dashboard")
@router.get("/heatmap")
def get_dashboard(
    range: str = "7days",
    staff: StaffUser = Depends(get_current_staff),
    session: Session = Depends(get_db),
) -> dict:
    if staff.role == "admin":
        active_staff = session.scalar(
            select(func.count()).select_from(StaffUser).where(StaffUser.is_active == 1)
        )
        counselors = session.scalar(
            select(func.count()).select_from(StaffUser).where(
                StaffUser.role == "counselor",
                StaffUser.is_active == 1,
            )
        )
        psychologists = session.scalar(
            select(func.count()).select_from(StaffUser).where(
                StaffUser.role == "psychologist",
                StaffUser.is_active == 1,
            )
        )
        audit_events = session.scalar(select(func.count()).select_from(AuditLog))
        return {
            "range": range,
            "role": staff.role,
            "metrics": [
                {"key": "activeStaff", "label": "启用工作人员", "value": active_staff or 0, "unit": "人"},
                {"key": "counselors", "label": "辅导员账号", "value": counselors or 0, "unit": "人"},
                {"key": "psychologists", "label": "心理咨询师账号", "value": psychologists or 0, "unit": "人"},
                {"key": "auditEvents", "label": "审计事件", "value": audit_events or 0, "unit": "条"},
            ],
        }

    if staff.role == "counselor":
        assigned_students = session.scalar(
            select(func.count()).select_from(StudentProfile).where(
                StudentProfile.counselor_id == staff.id
            )
        )
        open_alerts = session.scalar(
            select(func.count())
            .select_from(Alert)
            .join(StudentProfile, StudentProfile.student_id == Alert.student_id)
            .where(
                StudentProfile.counselor_id == staff.id,
                Alert.status == "open",
            )
        )
        scoped_orders = _work_order_scope(
            select(func.count(func.distinct(WorkOrder.id)))
            .select_from(WorkOrder)
            .join(Alert, WorkOrder.alert_id == Alert.id)
            .where(WorkOrder.status != "resolved"),
            staff,
        )
        pending_orders = session.scalar(scoped_orders)
        interventions = session.scalar(
            select(func.count()).select_from(Intervention).where(
                Intervention.staff_user_id == staff.id
            )
        )
        return {
            "range": range,
            "role": staff.role,
            "metrics": [
                {"key": "assignedStudents", "label": "负责学生", "value": assigned_students or 0, "unit": "人"},
                {"key": "openAlerts", "label": "未关闭预警", "value": open_alerts or 0, "unit": "件"},
                {"key": "pendingOrders", "label": "待处理工单", "value": pending_orders or 0, "unit": "件"},
                {"key": "interventions", "label": "我的干预记录", "value": interventions or 0, "unit": "条"},
            ],
        }

    if staff.role == "psychologist":
        active_cases = session.scalar(
            select(func.count()).select_from(ConsultationAssignment).where(
                ConsultationAssignment.psychologist_id == staff.id,
                ConsultationAssignment.status.in_(("assigned", "scheduled", "active")),
            )
        )
        consented_cases = session.scalar(
            select(func.count()).select_from(ConsultationAssignment).where(
                ConsultationAssignment.psychologist_id == staff.id,
                ConsultationAssignment.consent_granted_at.is_not(None),
            )
        )
        open_orders = session.scalar(
            select(func.count()).select_from(WorkOrder).where(
                WorkOrder.assignee_id == staff.id,
                WorkOrder.status != "resolved",
            )
        )
        interventions = session.scalar(
            select(func.count()).select_from(Intervention).where(
                Intervention.staff_user_id == staff.id
            )
        )
        return {
            "range": range,
            "role": staff.role,
            "metrics": [
                {"key": "activeCases", "label": "进行中个案", "value": active_cases or 0, "unit": "例"},
                {"key": "consentedCases", "label": "已授权个案", "value": consented_cases or 0, "unit": "例"},
                {"key": "pendingOrders", "label": "待处理转介", "value": open_orders or 0, "unit": "件"},
                {"key": "interventions", "label": "我的服务记录", "value": interventions or 0, "unit": "条"},
            ],
        }

    if staff.role == "center_director":
        pending_reviews = session.scalar(
            select(func.count()).select_from(KnowledgeDocument).where(
                KnowledgeDocument.status == "submitted"
            )
        )
        active_cases = session.scalar(
            select(func.count()).select_from(ConsultationAssignment).where(
                ConsultationAssignment.status.in_(("assigned", "scheduled", "active"))
            )
        )
        active_psychologists = session.scalar(
            select(func.count()).select_from(StaffUser).where(
                StaffUser.role == "psychologist",
                StaffUser.is_active == 1,
            )
        )
        published_documents = session.scalar(
            select(func.count()).select_from(KnowledgeDocument).where(
                KnowledgeDocument.status == "published"
            )
        )
        return {
            "range": range,
            "role": staff.role,
            "metrics": [
                {"key": "pendingReviews", "label": "待审核资料", "value": pending_reviews or 0, "unit": "份"},
                {"key": "activeCases", "label": "进行中个案", "value": active_cases or 0, "unit": "例"},
                {"key": "psychologists", "label": "在岗咨询师", "value": active_psychologists or 0, "unit": "人"},
                {"key": "publishedDocuments", "label": "已发布知识", "value": published_documents or 0, "unit": "份"},
            ],
        }

    if staff.role == "supervisor":
        open_orders = session.scalar(
            select(func.count()).select_from(WorkOrder).where(WorkOrder.status != "resolved")
        )
        active_cases = session.scalar(
            select(func.count()).select_from(ConsultationAssignment).where(
                ConsultationAssignment.status.in_(("assigned", "scheduled", "active"))
            )
        )
        return {
            "range": range,
            "role": staff.role,
            "metrics": [
                {"key": "pendingOrders", "label": "待处理工单", "value": open_orders or 0, "unit": "件"},
                {"key": "activeCases", "label": "进行中个案", "value": active_cases or 0, "unit": "例"},
            ],
        }

    return {
        "range": range,
        "role": staff.role,
        "metrics": [],
    }


@router.get("/students")
def get_students(
    staff: StaffUser = Depends(require_staff_roles("counselor", "supervisor")),
    session: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(StudentUser, StudentProfile)
        .join(StudentProfile, StudentProfile.student_id == StudentUser.id)
        .order_by(StudentProfile.class_name, StudentProfile.student_number)
    )
    if staff.role == "counselor":
        statement = statement.where(StudentProfile.counselor_id == staff.id)
    rows = session.execute(statement).all()
    return [
        {
            "id": student.id,
            "name": student.display_name or "未填写姓名",
            "phone": student.phone,
            "status": student.status,
            "studentNumber": profile.student_number,
            "college": profile.college,
            "major": profile.major,
            "className": profile.class_name,
        }
        for student, profile in rows
    ]


@router.get("/consultations")
def get_consultations(
    staff: StaffUser = Depends(require_staff_roles("psychologist", "supervisor")),
    session: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(ConsultationAssignment, StudentUser, StudentProfile)
        .join(StudentUser, ConsultationAssignment.student_id == StudentUser.id)
        .outerjoin(StudentProfile, StudentProfile.student_id == StudentUser.id)
        .order_by(ConsultationAssignment.updated_at.desc())
    )
    if staff.role == "psychologist":
        statement = statement.where(ConsultationAssignment.psychologist_id == staff.id)
    rows = session.execute(statement).all()
    return [
        {
            "id": assignment.id,
            "studentId": student.id,
            "student": student.display_name or "未填写姓名",
            "studentNumber": profile.student_number if profile else None,
            "college": profile.college if profile else None,
            "className": profile.class_name if profile else None,
            "status": assignment.status,
            "scheduledAt": assignment.scheduled_at.isoformat() if assignment.scheduled_at else None,
            "consentGranted": assignment.consent_granted_at is not None,
            "updatedAt": assignment.updated_at.isoformat(),
        }
        for assignment, student, profile in rows
    ]


@router.get("/intervention-archives")
def get_intervention_archives(
    staff: StaffUser = Depends(
        require_staff_roles("counselor", "psychologist", "supervisor")
    ),
    session: Session = Depends(get_db),
) -> list[dict]:
    statement = (
        select(Intervention, WorkOrder, Alert, StudentUser, StaffUser)
        .join(WorkOrder, Intervention.work_order_id == WorkOrder.id)
        .join(Alert, WorkOrder.alert_id == Alert.id)
        .join(StudentUser, Alert.student_id == StudentUser.id)
        .join(StaffUser, Intervention.staff_user_id == StaffUser.id)
        .order_by(Intervention.created_at.desc())
    )
    if staff.role != "supervisor":
        statement = statement.where(Intervention.staff_user_id == staff.id)
    rows = session.execute(statement).all()
    return [
        {
            "id": intervention.id,
            "workOrderId": work_order.id,
            "student": student.display_name or student.phone,
            "staff": author.name,
            "actionType": intervention.action_type,
            "note": intervention.note,
            "createdAt": intervention.created_at.isoformat(),
        }
        for intervention, work_order, _alert, student, author in rows
    ]


@router.get("/staff/me")
def get_staff_profile(staff: StaffUser = Depends(get_current_staff)) -> dict[str, str | None]:
    return {
        "id": staff.id,
        "email": staff.email,
        "name": staff.name,
        "role": staff.role,
        "department": staff.department,
    }


@router.get("/admin/staff")
def get_staff_accounts(
    _staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> list[dict]:
    rows = list(session.scalars(select(StaffUser).order_by(StaffUser.created_at.desc())))
    profiles = {
        profile.staff_user_id: profile
        for profile in session.scalars(
            select(StaffProfile).where(StaffProfile.staff_user_id.in_([row.id for row in rows]))
        )
    } if rows else {}
    return [
        {
            "id": row.id,
            "email": row.email,
            "name": row.name,
            "role": row.role,
            "department": row.department,
            "isActive": row.is_active,
            "accountStatus": row.account_status,
            "reviewScopes": [item for item in row.review_scopes.split(",") if item],
            "phone": profiles[row.id].phone if row.id in profiles else None,
            "organization": profiles[row.id].organization if row.id in profiles else None,
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/admin/staff", status_code=status.HTTP_201_CREATED)
def create_staff_account(
    payload: StaffCreateRequest,
    admin: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    staff = StaffUser(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        role=payload.role,
        department=payload.department.strip() if payload.department else None,
        is_active=True,
        account_status="active",
        review_scopes="psychology" if payload.role == "center_director" else "",
    )
    session.add(staff)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该邮箱已存在",
        ) from None
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=admin.id,
            action="staff.create",
            resource_type="staff_user",
            resource_id=staff.id,
            detail=f"role={staff.role}",
        )
    )
    session.commit()
    return {"id": staff.id, "status": "created"}


@router.patch("/admin/staff/{staff_id}/status")
def update_staff_status(
    staff_id: str,
    payload: StaffStatusUpdateRequest,
    admin: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    target = session.get(StaffUser, staff_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作人员不存在")
    if target.id == admin.id and not payload.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能停用当前登录账号")
    if target.account_status not in {"active", "suspended"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="待审核账号不能在这里启用")
    target.is_active = payload.is_active
    target.account_status = "active" if payload.is_active else "suspended"
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=admin.id,
            action="staff.activate" if payload.is_active else "staff.deactivate",
            resource_type="staff_user",
            resource_id=target.id,
        )
    )
    session.commit()
    return {"status": "updated"}


@router.patch("/admin/staff/{staff_id}/review-scopes")
def update_staff_review_scopes(
    staff_id: str,
    payload: StaffReviewScopesRequest,
    admin: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> dict[str, str | list[str]]:
    target = session.get(StaffUser, staff_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作人员不存在")
    if target.account_status != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="只能为已启用账号设置审核范围")
    target.review_scopes = ",".join(dict.fromkeys(payload.scopes))
    session.add(
        AuditLog(
            actor_type="staff",
            actor_id=admin.id,
            action="staff.review_scopes.update",
            resource_type="staff_user",
            resource_id=target.id,
            detail=target.review_scopes or "none",
        )
    )
    session.commit()
    return {"status": "updated", "reviewScopes": payload.scopes}


@router.get("/audit-logs")
def get_audit_logs(
    _staff: StaffUser = Depends(require_staff_roles("admin")),
    session: Session = Depends(get_db),
) -> list[dict]:
    rows = list(
        session.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200))
    )
    staff_ids = {
        row.actor_id for row in rows if row.actor_type == "staff"
    } | {
        row.resource_id
        for row in rows
        if row.resource_type == "staff_user" and row.resource_id
    }
    student_ids = {row.actor_id for row in rows if row.actor_type == "student"}
    knowledge_ids = {
        row.resource_id
        for row in rows
        if row.resource_type == "knowledge_document" and row.resource_id
    }
    work_order_ids = {
        row.resource_id
        for row in rows
        if row.resource_type == "work_order" and row.resource_id
    }
    application_ids = {
        row.resource_id
        for row in rows
        if row.resource_type == "staff_application" and row.resource_id
    }

    staff_by_id = {
        item.id: item
        for item in session.scalars(select(StaffUser).where(StaffUser.id.in_(staff_ids)))
    } if staff_ids else {}
    student_by_id = {
        item.id: item
        for item in session.scalars(select(StudentUser).where(StudentUser.id.in_(student_ids)))
    } if student_ids else {}
    knowledge_by_id = {
        item.id: item
        for item in session.scalars(
            select(KnowledgeDocument).where(KnowledgeDocument.id.in_(knowledge_ids))
        )
    } if knowledge_ids else {}
    work_order_by_id = {
        item.id: item
        for item in session.scalars(select(WorkOrder).where(WorkOrder.id.in_(work_order_ids)))
    } if work_order_ids else {}
    application_by_id = {
        item.id: item
        for item in session.scalars(
            select(StaffApplication).where(StaffApplication.id.in_(application_ids))
        )
    } if application_ids else {}

    def actor_view(row: AuditLog) -> tuple[str, str | None]:
        if row.actor_type == "staff":
            actor = staff_by_id.get(row.actor_id)
            return (
                actor.name if actor else "已删除的工作人员",
                actor.email if actor else None,
            )
        if row.actor_type == "student":
            actor = student_by_id.get(row.actor_id)
            return (
                (actor.display_name or "学生用户") if actor else "已删除的学生用户",
                actor.phone if actor else None,
            )
        return ("系统", None)

    def resource_name(row: AuditLog) -> str:
        if row.resource_type == "staff_user":
            resource = staff_by_id.get(row.resource_id)
            return f"{resource.name}（{resource.email}）" if resource else "已删除的工作人员账号"
        if row.resource_type == "knowledge_document":
            resource = knowledge_by_id.get(row.resource_id)
            if resource:
                return resource.name
            if row.detail and row.detail.startswith("name="):
                return row.detail.removeprefix("name=")
            return "已删除的知识资料"
        if row.resource_type == "work_order":
            resource = work_order_by_id.get(row.resource_id)
            return f"{resource.id} · {resource.summary}" if resource else (row.resource_id or "未知工单")
        if row.resource_type == "staff_application":
            resource = application_by_id.get(row.resource_id)
            applicant = staff_by_id.get(resource.staff_user_id) if resource else None
            return f"{applicant.name}（{applicant.email}）" if applicant else "工作人员入驻申请"
        return row.resource_id or "-"

    return [
        {
            "id": row.id,
            "actorType": row.actor_type,
            "actorId": row.actor_id,
            "actorName": actor_view(row)[0],
            "actorAccount": actor_view(row)[1],
            "action": row.action,
            "actionLabel": AUDIT_ACTION_LABELS.get(row.action, row.action),
            "resourceType": row.resource_type,
            "resourceTypeLabel": AUDIT_RESOURCE_LABELS.get(row.resource_type, row.resource_type),
            "resourceId": row.resource_id,
            "resourceName": resource_name(row),
            "detail": row.detail,
            "createdAt": row.created_at.isoformat(),
        }
        for row in rows
    ]
