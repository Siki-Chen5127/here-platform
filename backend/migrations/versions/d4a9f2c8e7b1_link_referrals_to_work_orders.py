"""Link consultation referrals to work orders.

Revision ID: d4a9f2c8e7b1
Revises: b1e8c7d6a5f4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d4a9f2c8e7b1"
down_revision: Union[str, Sequence[str], None] = "b1e8c7d6a5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "consultation_assignments",
        sa.Column("work_order_id", sa.String(length=36), nullable=True),
    )
    op.create_foreign_key(
        "fk_consultation_assignments_work_order_id",
        "consultation_assignments",
        "work_orders",
        ["work_order_id"],
        ["id"],
    )
    op.create_index(
        "ix_consultation_assignments_work_order_id",
        "consultation_assignments",
        ["work_order_id"],
        unique=True,
        mssql_where=sa.text("work_order_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_consultation_assignments_work_order_id", table_name="consultation_assignments")
    op.drop_constraint(
        "fk_consultation_assignments_work_order_id",
        "consultation_assignments",
        type_="foreignkey",
    )
    op.drop_column("consultation_assignments", "work_order_id")
