"""add ai_insights_enabled to users

Revision ID: ef863d9a8fcd
Revises: c266e517ce5f
Create Date: 2026-07-11 13:16:28.374419

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef863d9a8fcd'
down_revision: Union[str, None] = 'c266e517ce5f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
