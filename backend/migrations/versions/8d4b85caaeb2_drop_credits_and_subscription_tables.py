"""drop_credits_and_subscription_tables

Revision ID: 8d4b85caaeb2
Revises: c7d2a91f4e10
Create Date: 2026-10-15 15:46:51.224008

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8d4b85caaeb2'
down_revision: Union[str, None] = 'c7d2a91f4e10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP TABLE IF EXISTS user_subscriptions")
    op.execute("DROP TABLE IF EXISTS payments")
    op.execute("DROP TABLE IF EXISTS credit_transactions")
    op.execute("DROP TABLE IF EXISTS credits_wallet")
    op.execute("DROP TABLE IF EXISTS payment_packages")

    # Never drop paymentstatus (pending_orders uses it)
    op.execute("DROP TYPE IF EXISTS transactiontype")
    op.execute("DROP TYPE IF EXISTS subscriptionstatus")

def downgrade() -> None:
    op.create_table('payment_packages',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('duration_days', sa.BigInteger(), nullable=False),
        sa.Column('is_active', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id', name='payment_packages_pkey'),
    )

    op.create_table('payments',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('package_id', sa.BigInteger(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('transaction_code', sa.String(), nullable=False),
        sa.Column('status', postgresql.ENUM('PENDING', 'COMPLETED', 'FAILED',
                  name='paymentstatus', create_type=False), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['package_id'], ['payment_packages.id'], name='payments_package_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='payments_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='payments_pkey'),
    )
    op.create_index('ix_payments_user_id', 'payments', ['user_id'], unique=False)
    op.create_index('ix_payments_transaction_code', 'payments', ['transaction_code'], unique=True)
    op.create_index('ix_payments_package_id', 'payments', ['package_id'], unique=False)

    op.create_table('credit_transactions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('type', postgresql.ENUM('CREDIT', 'DEBIT', name='transactiontype'), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='credit_transactions_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='credit_transactions_pkey'),
    )
    op.create_index('ix_credit_transactions_user_id', 'credit_transactions', ['user_id'], unique=False)

    op.create_table('user_subscriptions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('package_id', sa.BigInteger(), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('status', postgresql.ENUM('ACTIVE', 'EXPIRED', 'CANCELLED', name='subscriptionstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['package_id'], ['payment_packages.id'], name='user_subscriptions_package_id_fkey'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='user_subscriptions_user_id_fkey'),
        sa.PrimaryKeyConstraint('id', name='user_subscriptions_pkey'),
    )
    op.create_index('ix_user_subscriptions_user_id', 'user_subscriptions', ['user_id'], unique=False)
    op.create_index('ix_user_subscriptions_package_id', 'user_subscriptions', ['package_id'], unique=False)

    op.create_table('credits_wallet',
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('balance', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='credits_wallet_user_id_fkey'),
        sa.PrimaryKeyConstraint('user_id', name='credits_wallet_pkey'),
    )
    op.create_index('ix_credits_wallet_user_id', 'credits_wallet', ['user_id'], unique=False)
