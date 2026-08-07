"""add knowledge review workflow

Revision ID: c7f4a91d2e80
Revises: baa146808cc9
Create Date: 2026-07-29 12:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7f4a91d2e80"
down_revision: Union[str, Sequence[str], None] = "baa146808cc9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("knowledge_documents", sa.Column("description", sa.UnicodeText(), nullable=True))
    op.add_column("knowledge_documents", sa.Column("category", sa.Unicode(length=100), nullable=True))
    op.add_column("knowledge_documents", sa.Column("source_url", sa.Unicode(length=500), nullable=True))
    op.add_column(
        "knowledge_documents",
        sa.Column(
            "graph_status",
            sa.String(length=32),
            nullable=False,
            server_default="not_started",
        ),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("knowledge_documents", sa.Column("reviewer_id", sa.String(length=36), nullable=True))
    op.add_column(
        "knowledge_documents",
        sa.Column("published_by_id", sa.String(length=36), nullable=True),
    )
    op.add_column("knowledge_documents", sa.Column("review_note", sa.UnicodeText(), nullable=True))
    op.add_column(
        "knowledge_documents",
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "knowledge_documents",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_knowledge_documents_reviewer",
        "knowledge_documents",
        "staff_users",
        ["reviewer_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_knowledge_documents_publisher",
        "knowledge_documents",
        "staff_users",
        ["published_by_id"],
        ["id"],
    )
    op.create_index(
        "ix_knowledge_documents_category",
        "knowledge_documents",
        ["category"],
        unique=False,
    )
    op.create_index(
        "ix_knowledge_documents_graph_status",
        "knowledge_documents",
        ["graph_status"],
        unique=False,
    )
    op.execute(
        "UPDATE knowledge_documents "
        "SET status = 'published', "
        "graph_status = CASE WHEN node_count > 0 THEN 'ready' ELSE 'not_started' END, "
        "category = N'历史导入'"
    )


def downgrade() -> None:
    op.drop_index("ix_knowledge_documents_graph_status", table_name="knowledge_documents")
    op.drop_index("ix_knowledge_documents_category", table_name="knowledge_documents")
    op.drop_constraint(
        "fk_knowledge_documents_publisher",
        "knowledge_documents",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_knowledge_documents_reviewer",
        "knowledge_documents",
        type_="foreignkey",
    )
    op.drop_column("knowledge_documents", "published_at")
    op.drop_column("knowledge_documents", "reviewed_at")
    op.drop_column("knowledge_documents", "submitted_at")
    op.drop_column("knowledge_documents", "review_note")
    op.drop_column("knowledge_documents", "published_by_id")
    op.drop_column("knowledge_documents", "reviewer_id")
    op.drop_column("knowledge_documents", "version")
    op.drop_column("knowledge_documents", "graph_status")
    op.drop_column("knowledge_documents", "source_url")
    op.drop_column("knowledge_documents", "category")
    op.drop_column("knowledge_documents", "description")
