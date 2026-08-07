from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Unicode,
    UnicodeText,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class StudentUser(TimestampMixin, Base):
    __tablename__ = "student_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(Unicode(100), default="")
    status: Mapped[str] = mapped_column(String(32), default="active", index=True)

    profile: Mapped["StudentProfile | None"] = relationship(
        back_populates="student",
        uselist=False,
        cascade="all, delete-orphan",
    )


class StaffUser(TimestampMixin, Base):
    __tablename__ = "staff_users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(Unicode(100))
    role: Mapped[str] = mapped_column(String(32), index=True)
    department: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    account_status: Mapped[str] = mapped_column(String(32), default="active", index=True)
    review_scopes: Mapped[str] = mapped_column(String(100), default="")


class StaffProfile(TimestampMixin, Base):
    __tablename__ = "staff_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    staff_user_id: Mapped[str] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    real_name: Mapped[str] = mapped_column(Unicode(100))
    display_name: Mapped[str] = mapped_column(Unicode(100))
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    organization: Mapped[str] = mapped_column(Unicode(150))
    department: Mapped[str] = mapped_column(Unicode(100))
    college: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    employee_number: Mapped[str] = mapped_column(String(64), index=True)
    id_number_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    id_number_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)


class StaffApplication(TimestampMixin, Base):
    __tablename__ = "staff_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    staff_user_id: Mapped[str] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"),
        index=True,
    )
    requested_role: Mapped[str] = mapped_column(String(32), index=True)
    application_type: Mapped[str] = mapped_column(String(32), index=True)
    profile_data: Mapped[str] = mapped_column(UnicodeText)
    status: Mapped[str] = mapped_column(String(32), default="pending_review", index=True)
    review_note: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    reviewer_id: Mapped[str | None] = mapped_column(
        ForeignKey("staff_users.id"),
        nullable=True,
    )
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StaffCredential(Base):
    __tablename__ = "staff_credentials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    staff_user_id: Mapped[str] = mapped_column(
        ForeignKey("staff_users.id"),
        index=True,
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("staff_applications.id", ondelete="CASCADE"),
        index=True,
    )
    credential_type: Mapped[str] = mapped_column(String(50), default="role_proof")
    original_name: Mapped[str] = mapped_column(Unicode(255))
    storage_path: Mapped[str] = mapped_column(Unicode(500))
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StudentProfile(TimestampMixin, Base):
    __tablename__ = "student_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(
        ForeignKey("student_users.id", ondelete="CASCADE"),
        unique=True,
    )
    student_number: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    college: Mapped[str | None] = mapped_column(Unicode(100), nullable=True, index=True)
    major: Mapped[str | None] = mapped_column(Unicode(100), nullable=True)
    class_name: Mapped[str | None] = mapped_column(Unicode(100), nullable=True, index=True)
    counselor_id: Mapped[str | None] = mapped_column(
        ForeignKey("staff_users.id"),
        nullable=True,
        index=True,
    )

    student: Mapped[StudentUser] = relationship(back_populates="profile")


class LocationEvent(Base):
    __tablename__ = "location_events"
    __table_args__ = (
        UniqueConstraint("student_id", "client_event_id", name="uq_location_client_event"),
        Index("ix_location_student_recorded", "student_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("student_users.id"), index=True)
    client_event_id: Mapped[str] = mapped_column(String(64))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Alert(TimestampMixin, Base):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint("student_id", "client_event_id", name="uq_alert_client_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(ForeignKey("student_users.id"), index=True)
    client_event_id: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    source: Mapped[str] = mapped_column(Unicode(100), default="mobile")
    description: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)


class WorkOrder(TimestampMixin, Base):
    __tablename__ = "work_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"), unique=True, index=True)
    assignee_id: Mapped[str | None] = mapped_column(ForeignKey("staff_users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    priority: Mapped[str] = mapped_column(String(20), index=True)
    summary: Mapped[str] = mapped_column(Unicode(500))
    resolution_note: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Intervention(Base):
    __tablename__ = "interventions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    work_order_id: Mapped[str] = mapped_column(ForeignKey("work_orders.id"), index=True)
    staff_user_id: Mapped[str] = mapped_column(ForeignKey("staff_users.id"), index=True)
    action_type: Mapped[str] = mapped_column(String(50))
    note: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class ConsultationAssignment(TimestampMixin, Base):
    __tablename__ = "consultation_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    student_id: Mapped[str] = mapped_column(ForeignKey("student_users.id"), index=True)
    psychologist_id: Mapped[str] = mapped_column(ForeignKey("staff_users.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="assigned", index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class KnowledgeDocument(TimestampMixin, Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(Unicode(255))
    storage_path: Mapped[str] = mapped_column(Unicode(500))
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    node_count: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    category: Mapped[str | None] = mapped_column(Unicode(100), nullable=True, index=True)
    domain: Mapped[str] = mapped_column(String(32), default="psychology", index=True)
    source_url: Mapped[str | None] = mapped_column(Unicode(500), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    graph_status: Mapped[str] = mapped_column(String(32), default="not_started", index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("staff_users.id"))
    reviewer_id: Mapped[str | None] = mapped_column(
        ForeignKey("staff_users.id"),
        nullable=True,
    )
    published_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("staff_users.id"),
        nullable=True,
    )
    review_note: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_actor_created", "actor_id", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    actor_type: Mapped[str] = mapped_column(String(20))
    actor_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    detail: Mapped[str | None] = mapped_column(UnicodeText, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
