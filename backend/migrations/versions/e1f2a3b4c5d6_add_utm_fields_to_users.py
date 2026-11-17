"""add utm fields to users

Revision ID: e1f2a3b4c5d6
Revises: b3c4d5e6f7a8
Create Date: 2026-11-17 14:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('utm_source', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('utm_medium', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('utm_campaign', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'utm_campaign')
    op.drop_column('users', 'utm_medium')
    op.drop_column('users', 'utm_source')

