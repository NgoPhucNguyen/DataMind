"""create ai_usage_records table

Revision ID: b3c4d5e6f7a8
Revises: 9f1a2b3c4d5e
Create Date: 2026-10-23 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = '9f1a2b3c4d5e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ai_usage_records',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('feature', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_usage_records_user_id'), 'ai_usage_records', ['user_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_records_feature'), 'ai_usage_records', ['feature'], unique=False)
    op.create_index(op.f('ix_ai_usage_records_created_at'), 'ai_usage_records', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_ai_usage_records_created_at'), table_name='ai_usage_records')
    op.drop_index(op.f('ix_ai_usage_records_feature'), table_name='ai_usage_records')
    op.drop_index(op.f('ix_ai_usage_records_user_id'), table_name='ai_usage_records')
    op.drop_table('ai_usage_records')
