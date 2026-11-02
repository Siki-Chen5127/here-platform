"""add password reset and account closure support

Revision ID: f7d3a9c4e1b2
Revises: e4a1c9b7d2f0
Create Date: 2026-08-24 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f7d3a9c4e1b2"
down_revision: Union[str, Sequence[str], None] = "e4a1c9b7d2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "staff_users",
        sa.Column("auth_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "staff_password_resets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("staff_user_id", sa.String(length=36), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["staff_user_id"], ["staff_users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_staff_password_resets_staff_user_id",
        "staff_password_resets",
        ["staff_user_id"],
    )
    op.create_index(
        "ix_staff_password_resets_token_hash",
        "staff_password_resets",
        ["token_hash"],
        unique=True,
    )
    op.create_index(
        "ix_staff_password_resets_expires_at",
        "staff_password_resets",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_staff_password_resets_expires_at", table_name="staff_password_resets")
    op.drop_index("ix_staff_password_resets_token_hash", table_name="staff_password_resets")
    op.drop_index("ix_staff_password_resets_staff_user_id", table_name="staff_password_resets")
    op.drop_table("staff_password_resets")
    op.drop_column("staff_users", "auth_version")
