from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


StaffRole = Literal[
    "counselor",
    "psychologist",
    "supervisor",
    "center_director",
    "admin",
]
ApplicantRole = Literal["counselor", "psychologist", "center_director"]
KnowledgeDomain = Literal["psychology", "student_affairs"]
AlertSeverity = Literal["low", "medium", "high", "critical"]


class StaffLoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("请输入有效邮箱")
        return normalized


class StaffCreateRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    role: StaffRole
    department: str | None = Field(default=None, max_length=100)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("请输入有效邮箱")
        return normalized

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class StaffRegistrationRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    requested_role: ApplicantRole

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized:
            raise ValueError("请输入有效邮箱")
        return normalized

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class StaffStatusUpdateRequest(BaseModel):
    is_active: bool


class StaffApplicationReviewRequest(BaseModel):
    action: Literal["approve", "request_changes", "reject"]
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else ""
        return normalized or None


class StaffReviewScopesRequest(BaseModel):
    scopes: list[KnowledgeDomain] = Field(max_length=2)


class KnowledgeSubmissionUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=100)
    domain: KnowledgeDomain = "psychology"
    description: str | None = Field(default=None, max_length=4000)
    source_url: str | None = Field(default=None, max_length=500)

    @field_validator("name", "category")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("description", "source_url")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else ""
        return normalized or None


class KnowledgeAdminBatchRequest(BaseModel):
    document_ids: list[str] = Field(min_length=1, max_length=100)
    action: Literal["archive", "restore", "graph_retry"]

    @field_validator("document_ids")
    @classmethod
    def normalize_document_ids(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not normalized:
            raise ValueError("请至少选择一份资料")
        return normalized


class KnowledgeReviewRequest(BaseModel):
    action: Literal["approve", "request_changes", "reject"]
    note: str | None = Field(default=None, max_length=4000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else ""
        return normalized or None


class MobileRegisterRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=100)


class MobileLoginRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=32)
    password: str = Field(min_length=8, max_length=128)


class UserView(BaseModel):
    id: str
    name: str
    role: str
    email: str | None = None
    phone: str | None = None
    accountStatus: str = "active"
    reviewScopes: list[str] = Field(default_factory=list)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserView


class LocationEventCreate(BaseModel):
    client_event_id: str = Field(min_length=1, max_length=64)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    address: str | None = Field(default=None, max_length=500)
    recorded_at: datetime


class AlertCreate(BaseModel):
    client_event_id: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=50)
    severity: AlertSeverity
    description: str | None = Field(default=None, max_length=4000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class WorkOrderResolveRequest(BaseModel):
    note: str = Field(default="", max_length=4000)


class WorkOrderView(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    level: str
    levelText: str
    time: str
    source: str
    student: str
    summary: str
    details: str
    status: str


class HealthResponse(BaseModel):
    status: str
    environment: str
    database: str
