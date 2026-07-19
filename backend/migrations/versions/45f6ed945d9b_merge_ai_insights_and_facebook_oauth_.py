"""merge ai_insights and facebook oauth branches

Revision ID: 45f6ed945d9b
Revises: b2e4d0f7c8a1, 805d61d053bc
Create Date: 2026-07-16 15:29:27.463319

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '45f6ed945d9b'
down_revision: Union[str, None] = ('b2e4d0f7c8a1', '805d61d053bc')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
