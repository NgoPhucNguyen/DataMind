"""add first_upload_at to users

Revision ID: c7d2a91f4e10
Revises: f1cd3e429521
Create Date: 2026-10-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d2a91f4e10'
down_revision: Union[str, None] = 'f1cd3e429521'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('first_upload_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'first_upload_at')