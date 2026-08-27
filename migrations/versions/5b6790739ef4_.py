"""empty message

Revision ID: 5b6790739ef4
Revises: fb9e6fdda6d6
Create Date: 2026-08-12 15:16:55.304990

"""
from migrations.helpers import change_version

# revision identifiers, used by Alembic.
revision = '5b6790739ef4'
down_revision = 'fb9e6fdda6d6'
branch_labels = None
depends_on = None


def upgrade():
    change_version('1.0', '2026-08-12')
    # ### end Alembic commands ###


def downgrade():
    change_version('1.0', revert=True)
