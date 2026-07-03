"""add google oauth fields to users

Revision ID: a1f3c9e2b6d4
Revises: 9d6e9954cd77
Create Date: 2026-06-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f3c9e2b6d4'
down_revision: Union[str, None] = '9d6e9954cd77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_id', sa.String(), nullable=True))
    op.add_column('users', sa.Column('avatar_url', sa.String(), nullable=True))
    op.create_index(op.f('ix_users_google_id'), 'users', ['google_id'], unique=True)
    op.alter_column('users', 'password', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'password', existing_type=sa.String(), nullable=False)
    op.drop_index(op.f('ix_users_google_id'), table_name='users')
    op.drop_column('users', 'avatar_url')
    op.drop_column('users', 'google_id')