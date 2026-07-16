"""add ai_insights_enabled to users

Revision ID: c266e517ce5f
Revises: a1f3c9e2b6d4
Create Date: 2026-07-11 13:16:22.182932

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c266e517ce5f'
down_revision: Union[str, None] = 'a1f3c9e2b6d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
