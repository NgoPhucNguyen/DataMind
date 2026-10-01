"""add tier to users

Revision ID: abcdef123456
Revises: 45f6ed945d9b
Create Date: 2026-08-03 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'abcdef123456'
down_revision: Union[str, None] = '45f6ed945d9b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default="free" safely applies to all existing rows
    op.add_column('users', sa.Column('tier', sa.String(), server_default='free', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'tier')
