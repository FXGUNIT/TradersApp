"""baseline schema marker

Revision ID: 20260415_000001
Revises:
Create Date: 2026-04-15 00:00:01
"""

from __future__ import annotations

# revision identifiers, used by Alembic.
revision = "20260415_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Baseline only: existing environments are stamped at this revision.
    pass


def downgrade() -> None:
    pass
