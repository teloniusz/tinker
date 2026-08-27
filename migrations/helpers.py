from datetime import datetime

import sqlalchemy as sa
from alembic import op


def change_version(version: str, date: str | None = None, revert: bool = False):
    meta = sa.MetaData()
    meta.reflect(bind=op.get_bind(), only=('versions',))
    version_table = sa.Table('versions', meta)

    now = datetime.now()
    if not revert:
        when = datetime.strptime(date, '%Y-%m-%d') if date else now
        op.bulk_insert(version_table, [{'version': version, 'created': when, 'modified': now}])
    else:
        op.execute(version_table.delete().where(version_table.c.version == version))