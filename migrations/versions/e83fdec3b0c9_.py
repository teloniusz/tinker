"""empty message

Revision ID: e83fdec3b0c9
Revises: 
Create Date: 2024-12-08 04:24:16.577116

"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa
import flask_security
import uuid


# revision identifiers, used by Alembic.
revision = 'e83fdec3b0c9'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    role = op.create_table('role',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('permissions', flask_security.datastore.AsaList(), nullable=True),
        sa.Column('update_datetime', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    user = op.create_table('user',
        sa.Column('first_name', sa.String(), nullable=True),
        sa.Column('last_name', sa.String(), nullable=True),
        sa.Column('fs_webauthn_user_handle', sa.String(length=64), nullable=True),
        sa.Column('mf_recovery_codes', flask_security.datastore.AsaList(), nullable=True),
        sa.Column('password', sa.String(length=255), nullable=True),
        sa.Column('us_phone_number', sa.String(length=128), nullable=True),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('us_totp_secrets', sa.Text(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('fs_uniquifier', sa.String(length=64), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('current_login_at', sa.DateTime(), nullable=True),
        sa.Column('last_login_ip', sa.String(length=64), nullable=True),
        sa.Column('current_login_ip', sa.String(length=64), nullable=True),
        sa.Column('login_count', sa.Integer(), nullable=True),
        sa.Column('tf_primary_method', sa.String(length=64), nullable=True),
        sa.Column('tf_totp_secret', sa.String(length=255), nullable=True),
        sa.Column('tf_phone_number', sa.String(length=128), nullable=True),
        sa.Column('create_datetime', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('update_datetime', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('fs_uniquifier'),
        sa.UniqueConstraint('fs_webauthn_user_handle'),
        sa.UniqueConstraint('us_phone_number'),
        sa.UniqueConstraint('username')
    )
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_last_name'), ['last_name'], unique=False)

    versions = op.create_table('versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('version', sa.String(), nullable=False),
        sa.Column('created', sa.DateTime(), nullable=True),
        sa.Column('modified', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    roles_users = op.create_table('roles_users',
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['role.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], )
    )

    try:
        now = datetime.now()
        op.bulk_insert(versions, [{'version': '0.1', 'created': now, 'modified': now}])
        op.bulk_insert(role, [
            {'name': 'admin', 'permissions': ['admin']},
            {'name': 'user', 'permissions': ['user']}
        ])
        op.bulk_insert(user, [
            dict(
                email="admin@localhost",
                first_name='',
                last_name='Administrator',
                username='admin',
                password=flask_security.utils.hash_password("s0med33ps3cret"),
                active=True,
                fs_uniquifier=uuid.uuid4().hex,
                fs_webauthn_user_handle=uuid.uuid4().hex
            ),
            dict(
                id=0,
                email="",
                first_name='',
                last_name='Anonoymous user',
                username='',
                password='$argon2id$v=19$',
                active=False,
                fs_uniquifier=uuid.uuid4().hex,
                fs_webauthn_user_handle=uuid.uuid4().hex
            ),
            dict(
                email="demo@localhost",
                first_name='Demo',
                last_name='User',
                username='demo',
                password='$argon2id$v=19$',
                active=True,
                fs_uniquifier=uuid.uuid4().hex,
                fs_webauthn_user_handle=uuid.uuid4().hex
            )
        ])
        conn = op.get_bind()
        res = conn.execute(
            user.select().with_only_columns(user.c.id).where(user.c.username == 'admin')).fetchall()
        op.bulk_insert(roles_users, [{'role_id': 1, 'user_id': int(res[0][0])}])
        res = conn.execute(
            user.select().with_only_columns(user.c.id).where(user.c.username == 'demo')).fetchall()
        op.bulk_insert(roles_users, [{'role_id': 2, 'user_id': int(res[0][0])}])
    except Exception:
        downgrade()
        raise

    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('roles_users')
    op.drop_table('versions')
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_last_name'))

    op.drop_table('user')
    op.drop_table('role')
    # ### end Alembic commands ###
