"""add staff onboarding and knowledge domains

Revision ID: e4a1c9b7d2f0
Revises: c7f4a91d2e80
Create Date: 2026-08-06 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a1c9b7d2f0"
down_revision: Union[str, Sequence[str], None] = "c7f4a91d2e80"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "staff_users",
        sa.Column("account_status", sa.String(length=32), nullable=False, server_default="active"),
    )
    op.add_column(
        "staff_users",
        sa.Column("review_scopes", sa.String(length=100), nullable=False, server_default=""),
    )
    op.create_index("ix_staff_users_account_status", "staff_users", ["account_status"])
    op.execute("UPDATE staff_users SET review_scopes = 'psychology' WHERE role = 'center_director'")

    op.create_table(
        "staff_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("staff_user_id", sa.String(length=36), nullable=False),
        sa.Column("real_name", sa.Unicode(length=100), nullable=False),
        sa.Column("display_name", sa.Unicode(length=100), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("organization", sa.Unicode(length=150), nullable=False),
        sa.Column("department", sa.Unicode(length=100), nullable=False),
        sa.Column("college", sa.Unicode(length=100), nullable=True),
        sa.Column("employee_number", sa.String(length=64), nullable=False),
        sa.Column("id_number_hash", sa.String(length=64), nullable=True),
        sa.Column("id_number_last4", sa.String(length=4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["staff_user_id"], ["staff_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("staff_user_id", name="uq_staff_profiles_staff_user_id"),
        sa.UniqueConstraint("phone", name="uq_staff_profiles_phone"),
    )
    op.create_index("ix_staff_profiles_employee_number", "staff_profiles", ["employee_number"])
    op.create_index("ix_staff_profiles_phone", "staff_profiles", ["phone"])
    op.create_index(
        "ux_staff_profiles_id_number_hash_not_null",
        "staff_profiles",
        ["id_number_hash"],
        unique=True,
        mssql_where=sa.text("id_number_hash IS NOT NULL"),
    )

    op.create_table(
        "staff_applications",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("staff_user_id", sa.String(length=36), nullable=False),
        sa.Column("requested_role", sa.String(length=32), nullable=False),
        sa.Column("application_type", sa.String(length=32), nullable=False),
        sa.Column("profile_data", sa.UnicodeText(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending_review"),
        sa.Column("review_note", sa.UnicodeText(), nullable=True),
        sa.Column("reviewer_id", sa.String(length=36), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["reviewer_id"], ["staff_users.id"]),
        sa.ForeignKeyConstraint(["staff_user_id"], ["staff_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_applications_staff_user_id", "staff_applications", ["staff_user_id"])
    op.create_index("ix_staff_applications_status", "staff_applications", ["status"])
    op.create_index("ix_staff_applications_requested_role", "staff_applications", ["requested_role"])
    op.create_index("ix_staff_applications_application_type", "staff_applications", ["application_type"])

    op.create_table(
        "staff_credentials",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("staff_user_id", sa.String(length=36), nullable=False),
        sa.Column("application_id", sa.String(length=36), nullable=False),
        sa.Column("credential_type", sa.String(length=50), nullable=False, server_default="role_proof"),
        sa.Column("original_name", sa.Unicode(length=255), nullable=False),
        sa.Column("storage_path", sa.Unicode(length=500), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["staff_applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["staff_user_id"], ["staff_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_staff_credentials_application_id", "staff_credentials", ["application_id"])
    op.create_index("ix_staff_credentials_staff_user_id", "staff_credentials", ["staff_user_id"])

    op.add_column(
        "knowledge_documents",
        sa.Column("domain", sa.String(length=32), nullable=False, server_default="psychology"),
    )
    op.create_index("ix_knowledge_documents_domain", "knowledge_documents", ["domain"])
    op.execute(
        "UPDATE knowledge_documents SET domain = 'student_affairs' "
        "WHERE name LIKE N'%学籍%' OR category LIKE N'%学生工作%'"
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_documents_domain", table_name="knowledge_documents")
    op.drop_column("knowledge_documents", "domain")
    op.drop_index("ix_staff_credentials_staff_user_id", table_name="staff_credentials")
    op.drop_index("ix_staff_credentials_application_id", table_name="staff_credentials")
    op.drop_table("staff_credentials")
    op.drop_index("ix_staff_applications_application_type", table_name="staff_applications")
    op.drop_index("ix_staff_applications_requested_role", table_name="staff_applications")
    op.drop_index("ix_staff_applications_status", table_name="staff_applications")
    op.drop_index("ix_staff_applications_staff_user_id", table_name="staff_applications")
    op.drop_table("staff_applications")
    op.drop_index("ux_staff_profiles_id_number_hash_not_null", table_name="staff_profiles")
    op.drop_index("ix_staff_profiles_phone", table_name="staff_profiles")
    op.drop_index("ix_staff_profiles_employee_number", table_name="staff_profiles")
    op.drop_table("staff_profiles")
    op.drop_index("ix_staff_users_account_status", table_name="staff_users")
    op.drop_column("staff_users", "review_scopes")
    op.drop_column("staff_users", "account_status")
