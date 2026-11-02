"""add work order business numbers

Revision ID: b1e8c7d6a5f4
Revises: f7d3a9c4e1b2
Create Date: 2026-09-01 09:00:00

"""
from collections import defaultdict
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b1e8c7d6a5f4"
down_revision: Union[str, Sequence[str], None] = "f7d3a9c4e1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _day_key(value: object) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y%m%d")
    return str(value)[:10].replace("-", "")


def upgrade() -> None:
    op.add_column(
        "work_orders",
        sa.Column("business_number", sa.String(length=32), nullable=True),
    )

    connection = op.get_bind()
    rows = list(
        connection.execute(
            sa.text("SELECT id, created_at FROM work_orders ORDER BY created_at, id")
        ).mappings()
    )
    counters: dict[str, int] = defaultdict(int)
    for row in rows:
        day = _day_key(row["created_at"])
        counters[day] += 1
        connection.execute(
            sa.text(
                "UPDATE work_orders SET business_number = :number WHERE id = :id"
            ),
            {
                "id": row["id"],
                "number": f"WO-{day}-{counters[day]:06d}",
            },
        )

    op.alter_column(
        "work_orders",
        "business_number",
        existing_type=sa.String(length=32),
        nullable=False,
    )
    op.create_index(
        "ix_work_orders_business_number",
        "work_orders",
        ["business_number"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_work_orders_business_number", table_name="work_orders")
    op.drop_column("work_orders", "business_number")
