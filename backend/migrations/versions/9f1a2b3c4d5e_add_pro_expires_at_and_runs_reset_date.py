"""add pro_expires_at and runs_reset_date to user_ai_usage

Revision ID: 9f1a2b3c4d5e
Revises: 8d4b85caaeb2
Create Date: 2026-10-19 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9f1a2b3c4d5e'
down_revision: Union[str, None] = '8d4b85caaeb2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_ai_usage', sa.Column('pro_expires_at', sa.DateTime(), nullable=True))
    op.add_column('user_ai_usage', sa.Column('runs_reset_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('user_ai_usage', 'runs_reset_date')
    op.drop_column('user_ai_usage', 'pro_expires_at')
