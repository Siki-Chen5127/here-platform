from __future__ import annotations

import secrets
import sqlite3
from datetime import datetime, timezone

from sqlalchemy import select

from app.config import BASE_DIR, get_settings
from app.database import SessionLocal
from app.models import Alert, KnowledgeDocument, StaffUser, StudentUser, WorkOrder
from app.security import hash_password


LEVEL_MAP = {
    "red": "critical",
    "amber": "high",
    "yellow": "medium",
    "emerald": "low",
}


def import_legacy_data() -> None:
    legacy_path = BASE_DIR / "here.db"
    if not legacy_path.exists():
        print(f"Legacy database not found: {legacy_path}")
        return

    get_settings()
    legacy = sqlite3.connect(legacy_path)
    legacy.row_factory = sqlite3.Row

    imported_work_orders = 0
    imported_documents = 0

    with SessionLocal() as session:
        admin = session.scalar(select(StaffUser).where(StaffUser.role == "admin"))
        if admin is None:
            raise RuntimeError("Run backend initialization before importing legacy data")

        for row in legacy.execute("SELECT * FROM workorders"):
            if session.get(WorkOrder, row["id"]):
                continue

            phone = f"legacy-{row['id']}"
            student = session.scalar(select(StudentUser).where(StudentUser.phone == phone))
            if student is None:
                student = StudentUser(
                    phone=phone,
                    password_hash=hash_password(secrets.token_urlsafe(32)),
                    display_name=row["student"],
                    status="imported",
                )
                session.add(student)
                session.flush()

            priority = LEVEL_MAP.get(row["level"], "medium")
            alert = Alert(
                student_id=student.id,
                client_event_id=f"legacy-{row['id']}",
                category="legacy_alert",
                severity=priority,
                status="closed" if row["status"] == "resolved" else "open",
                source=row["source"],
                description=row["details"],
            )
            session.add(alert)
            session.flush()
            session.add(
                WorkOrder(
                    id=row["id"],
                    alert_id=alert.id,
                    business_number=f"LEGACY-{str(row['id']).replace('-', '')[:20].upper()}",
                    status=row["status"],
                    priority=priority,
                    summary=row["summary"],
                    resolved_at=(
                        datetime.now(timezone.utc)
                        if row["status"] == "resolved"
                        else None
                    ),
                )
            )
            imported_work_orders += 1

        for row in legacy.execute("SELECT * FROM knowledge_docs"):
            storage_path = f"legacy://knowledge-doc/{row['id']}"
            exists = session.scalar(
                select(KnowledgeDocument.id).where(
                    KnowledgeDocument.storage_path == storage_path
                )
            )
            if exists:
                continue
            name = row["name"]
            student_affairs_terms = (
                "学生管理",
                "学籍",
                "奖助",
                "奖学金",
                "违纪",
                "学工",
                "宿舍",
                "请假",
                "资助",
            )
            session.add(
                KnowledgeDocument(
                    name=name,
                    storage_path=storage_path,
                    node_count=row["nodes"],
                    status=row["status"],
                    domain=(
                        "student_affairs"
                        if any(term in name for term in student_affairs_terms)
                        else "psychology"
                    ),
                    uploaded_by_id=admin.id,
                )
            )
            imported_documents += 1

        session.commit()

    legacy.close()
    print(f"Imported work orders: {imported_work_orders}")
    print(f"Imported knowledge documents: {imported_documents}")


if __name__ == "__main__":
    import_legacy_data()
