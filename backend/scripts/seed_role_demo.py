from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import (
    Alert,
    ConsultationAssignment,
    Intervention,
    KnowledgeDocument,
    StaffUser,
    StudentProfile,
    StudentUser,
    WorkOrder,
)
from app.security import hash_password


DEMO_STAFF = (
    {
        "email": "counselor@here.edu",
        "password": "Counselor123!",
        "name": "陈老师",
        "role": "counselor",
        "department": "学生工作部",
    },
    {
        "email": "psychologist@here.edu",
        "password": "Psychologist123!",
        "name": "林老师",
        "role": "psychologist",
        "department": "心理健康教育中心",
    },
    {
        "email": "director@here.edu",
        "password": "Director123!",
        "name": "周主任",
        "role": "center_director",
        "department": "心理健康教育中心",
    },
)

COLLEGE_PROFILE_DEFAULTS = {
    "计算机学院": ("软件工程", "软工 2601 班"),
    "管理学院": ("工商管理", "工商 2601 班"),
    "机电学院": ("机械设计制造及其自动化", "机械 2601 班"),
}


def upsert_staff(session, data: dict[str, str]) -> StaffUser:
    staff = session.scalar(select(StaffUser).where(StaffUser.email == data["email"]))
    if staff is None:
        staff = StaffUser(email=data["email"], password_hash="", name="")
        session.add(staff)
    staff.password_hash = hash_password(data["password"])
    staff.name = data["name"]
    staff.role = data["role"]
    staff.department = data["department"]
    staff.is_active = True
    staff.account_status = "active"
    staff.review_scopes = "psychology" if data["role"] == "center_director" else ""
    session.flush()
    return staff


def seed_role_demo() -> None:
    now = datetime.now(timezone.utc)
    with SessionLocal() as session:
        staff_by_role = {
            data["role"]: upsert_staff(session, data)
            for data in DEMO_STAFF
        }
        counselor = staff_by_role["counselor"]
        psychologist = staff_by_role["psychologist"]

        students = list(
            session.scalars(select(StudentUser).order_by(StudentUser.created_at, StudentUser.id))
        )
        for index, student in enumerate(students, start=1):
            profile = session.scalar(
                select(StudentProfile).where(StudentProfile.student_id == student.id)
            )
            if profile is None:
                profile = StudentProfile(student_id=student.id)
                session.add(profile)

            legacy_parts = student.display_name.split(maxsplit=1)
            legacy_college = None
            if (
                student.phone.startswith("legacy-")
                and len(legacy_parts) == 2
                and legacy_parts[0].endswith("学院")
            ):
                legacy_college, student.display_name = legacy_parts

            profile.student_number = profile.student_number or f"2026{index:04d}"
            if legacy_college:
                major, class_name = COLLEGE_PROFILE_DEFAULTS.get(
                    legacy_college,
                    ("专业信息待完善", "班级信息待完善"),
                )
                profile.college = legacy_college
                profile.major = major
                profile.class_name = class_name
            else:
                profile.college = profile.college or "信息工程学院"
                profile.major = profile.major or "计算机科学与技术"
                profile.class_name = profile.class_name or "计科 2601 班"
            profile.counselor_id = counselor.id

        work_orders = list(
            session.scalars(select(WorkOrder).order_by(WorkOrder.created_at, WorkOrder.id))
        )
        for index, work_order in enumerate(work_orders):
            if index == 1:
                work_order.assignee_id = psychologist.id
                work_order.status = "pending"
                work_order.resolution_note = None
                work_order.resolved_at = None
            elif index == 2:
                work_order.assignee_id = counselor.id
                work_order.status = "resolved"
                work_order.resolution_note = "已完成电话联系与线下面谈，学生状态稳定。"
                work_order.resolved_at = work_order.resolved_at or now
                intervention = session.scalar(
                    select(Intervention).where(
                        Intervention.work_order_id == work_order.id,
                        Intervention.staff_user_id == counselor.id,
                    )
                )
                if intervention is None:
                    session.add(
                        Intervention(
                            work_order_id=work_order.id,
                            staff_user_id=counselor.id,
                            action_type="resolve",
                            note=work_order.resolution_note,
                        )
                    )
            else:
                work_order.assignee_id = counselor.id
                work_order.status = "pending"
                work_order.resolution_note = None
                work_order.resolved_at = None

            alert = session.get(Alert, work_order.alert_id)
            if alert:
                alert.status = "closed" if work_order.status == "resolved" else "open"

        for index, student in enumerate(students[:2]):
            assignment = session.scalar(
                select(ConsultationAssignment).where(
                    ConsultationAssignment.student_id == student.id,
                    ConsultationAssignment.psychologist_id == psychologist.id,
                )
            )
            if assignment is None:
                assignment = ConsultationAssignment(
                    student_id=student.id,
                    psychologist_id=psychologist.id,
                )
                session.add(assignment)
            assignment.status = "active" if index == 0 else "scheduled"
            assignment.scheduled_at = now + timedelta(days=index + 1)
            assignment.consent_granted_at = now if index == 0 else None

        upload_dir = get_settings().upload_dir
        upload_dir.mkdir(parents=True, exist_ok=True)
        demo_documents = (
            {
                "path": upload_dir / "demo-counselor-workflow.txt",
                "name": "学生危机上报流程（草稿）",
                "category": "工作流程",
                "description": "辅导员用于演示增删改查的资料草稿。",
                "domain": "student_affairs",
                "uploader": counselor,
                "status": "draft",
            },
            {
                "path": upload_dir / "demo-psychologist-ethics.txt",
                "name": "心理咨询伦理工作要点",
                "category": "伦理规范",
                "description": "心理咨询师提交，等待心理中心负责人审核。",
                "domain": "psychology",
                "uploader": psychologist,
                "status": "submitted",
            },
        )
        for data in demo_documents:
            path: Path = data["path"]
            if not path.exists():
                path.write_text(data["description"], encoding="utf-8")
            exists = session.scalar(
                select(KnowledgeDocument).where(
                    KnowledgeDocument.storage_path == str(path)
                )
            )
            if exists is None:
                session.add(
                    KnowledgeDocument(
                        name=data["name"],
                        description=data["description"],
                        category=data["category"],
                        domain=data["domain"],
                        storage_path=str(path),
                        content_type="text/plain",
                        size_bytes=path.stat().st_size,
                        uploaded_by_id=data["uploader"].id,
                        status=data["status"],
                        submitted_at=now if data["status"] == "submitted" else None,
                    )
                )
            else:
                exists.domain = data["domain"]

        session.commit()

    print("Role demo data is ready.")
    for account in DEMO_STAFF:
        print(f"- {account['role']}: {account['email']} / {account['password']}")


if __name__ == "__main__":
    seed_role_demo()
