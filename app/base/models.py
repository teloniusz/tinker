from datetime import datetime, timezone
from typing import cast, Generic, TypeVar

import flask_security as fs
from flask_security.models import fsqla_v3 as fsqla
from sqlalchemy.orm import Query, Mapped

from .. import db


_T = TypeVar('_T')


class QHelper(Generic[_T]):
    @classmethod
    def qry(cls) -> Query[_T]:
        return cls.query # type: ignore


class Versions(db.Model, QHelper['Versions']):  # type: ignore
    id: Mapped[int] = db.Column(db.Integer, primary_key=True)
    version: Mapped[str] = db.Column(db.String, nullable=False)
    created: Mapped[datetime] = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    modified: Mapped[datetime] = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @classmethod
    def last_version(cls):
        return cls.qry().order_by(Versions.id.desc()).first()


fsqla.FsModels.set_db_info(db)  # type: ignore


class Role(db.Model, fsqla.FsRoleMixin):  # type: ignore
    id: int
    name: str


class User(db.Model, fsqla.FsUserMixin, QHelper['User']):  # type: ignore
    id: Mapped[int]
    first_name: Mapped[str | None] = db.Column(db.String)
    last_name: Mapped[str | None] = db.Column(db.String, index=True)
    username: Mapped[str]

    def __str__(self):
        return '{s.first_name} {s.last_name} <{s.email}> ({s.username}, {s.id}, {roles})'.format(
            s=self, roles=[role.name for role in cast(list[Role], self.roles)] # type: ignore
        )

    @classmethod
    def get_user(cls, username: str):
        return cls.qry().filter(User.username == username).one_or_none()

    def update_user(self, first_name: str, last_name: str, password: str | None, email: str):
        # TODO: email confirmation
        errors: dict[str, list[str]] = {}
        if password:
            if len(password) < 8:
                errors['password'] = ['Password must be at least 8 characters long']
        if not errors:
            self.first_name = first_name
            self.last_name = last_name
            if password:
                self.password = fs.utils.hash_password(password)
            try:
                db.session.add(self)
                db.session.commit()
            except Exception as exc:
                return {'_': [str(exc)]}
        return errors


def current_user() -> User | None:
    return fs.current_user   # type: ignore


def current_uid() -> int:
    cu = current_user()
    return cu.id if cu else 0
