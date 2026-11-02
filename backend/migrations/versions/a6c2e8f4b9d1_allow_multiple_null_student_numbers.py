"""Allow multiple student profiles without a student number.

Revision ID: a6c2e8f4b9d1
Revises: d4a9f2c8e7b1
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "a6c2e8f4b9d1"
down_revision: str | Sequence[str] | None = "d4a9f2c8e7b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "mssql":
        return

    constraint_names = bind.execute(
        sa.text(
            """
            SELECT kc.name
            FROM sys.key_constraints AS kc
            JOIN sys.index_columns AS ic
              ON ic.object_id = kc.parent_object_id
             AND ic.index_id = kc.unique_index_id
            JOIN sys.columns AS c
              ON c.object_id = ic.object_id
             AND c.column_id = ic.column_id
            WHERE kc.parent_object_id = OBJECT_ID(N'student_profiles')
              AND kc.type = 'UQ'
              AND c.name = N'student_number'
            """
        )
    ).scalars().all()
    for constraint_name in constraint_names:
        op.drop_constraint(constraint_name, "student_profiles", type_="unique")

    op.create_index(
        "ix_student_profiles_student_number",
        "student_profiles",
        ["student_number"],
        unique=True,
        mssql_where=sa.text("student_number IS NOT NULL"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "mssql":
        return

    op.drop_index("ix_student_profiles_student_number", table_name="student_profiles")
    op.create_unique_constraint(
        "uq_student_profiles_student_number",
        "student_profiles",
        ["student_number"],
    )
