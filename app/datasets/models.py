from os import makedirs, path as op, unlink, stat, walk
from contextlib import contextmanager
from datetime import datetime
from functools import cached_property
import os
from shutil import move
import shutil
import tempfile
from typing import cast
from urllib.parse import quote_plus
import zipfile
import tarfile

import magic
import pandas as pd
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.exc import IntegrityError

import flask_security as fs
from .. import app, db
from ..base.models import User
from ..helpers import utcnow
from ..inksnet import preprocessing, defaults


class InvalidFile(Exception):
    ...


class DuplicateFile(InvalidFile):
    ...


class WrongFileType(InvalidFile):
    ...


class NoDataFile(InvalidFile):
    ...


class DataFile(db.Model):  # type: ignore
    """A file in the filesystem with metadata

    - belongs to a specific user (or is empty, then it's some general use file)
    - stores CSV files (.csv or .xl, both treated as CSV)
    - optionally belongs to a DataSet
    """
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(index=True)
    label: Mapped[str] = mapped_column()
    size: Mapped[int]
    dataset_id: Mapped[int] = mapped_column(db.ForeignKey('data_set.id'))
    dataset: Mapped['DataSet'] = cast(Mapped['DataSet'], db.relationship('DataSet', back_populates='files'))
    user_id: Mapped[int | None] = mapped_column(db.ForeignKey(User.id))
    user: Mapped[User | None] = cast(Mapped[User | None], db.relationship(backref='files'))
    created: Mapped[datetime] = mapped_column(default=utcnow)
    modified: Mapped[datetime] = mapped_column(default=utcnow,
                                               onupdate=utcnow)
    __table_args__ = (db.UniqueConstraint(user_id, filename),)

    ACCEPTED_EXTENSIONS = ('csv', 'xl', 'xls', 'xlsx')

    def __str__(self):
        return f'File {self.filename} | {self.label} ({self.filepath})'

    def __repr__(self):
        return f'<{self}>'

    @cached_property
    def filepath(self):
        return op.join(self.dataset.datafilepath, self.fname)

    @cached_property
    def fname(self):
        return quote_plus(self.filename)

    @cached_property
    def stat(self):
        return stat(self.filepath)

    @cached_property
    def basename(self):
        return op.basename(self.fname)

    @cached_property
    def dataframe(self):
        """Convert the CSV file to a pandas DataFrame"""
        return pd.read_csv(self.filepath)

    @classmethod
    def create(
            cls,
            temp_filename: str,
            orig_filename: str,
            dataset: 'DataSet',
            label: str | None = None,
            user_id: int | None = None,
    ):
        """Creates a CSV file in the db and in the filesystem

        Accepts .csv or .xl files (both treated as CSV) or xls/xlsx.
        Validates file type using magic MIME type detection.

        Warning: That method does not commit the session.
        If committing the session fails, the file should be removed
        from the filesystem using self.unlink()
        """
        # Validate file extension
        if not (orig_filename.lower().rpartition('.')[2] in DataFile.ACCEPTED_EXTENSIONS):
            raise WrongFileType(
                f'File {orig_filename!r} must have one of the {DataFile.ACCEPTED_EXTENSIONS} extensions')

        # Validate file type using magic MIME type detection
        file_magic = magic.from_file(temp_filename, mime=True)

        excel_mimetypes = ('application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        supported_mimetypes = ('text/csv', 'text/plain') + excel_mimetypes

        if file_magic not in supported_mimetypes:
            raise WrongFileType(
                f'File {orig_filename!r} has invalid MIME type {file_magic!r}, expected one of {supported_mimetypes}')

        # Convert Excel to CSV using pandas if it is an excel file
        if file_magic in excel_mimetypes:
            df = pd.read_excel(temp_filename)
            df.to_csv(temp_filename, index=False)

        if user_id is None:
            user = fs.current_user
        else:
            user = db.session.query(User).get(user_id)
        if user and not user.is_authenticated:
            user = None
        user_str = str(user) if user else 'common'

        file = cls(filename=orig_filename, size=stat(temp_filename).st_size, user=user,
                   label=label or op.basename(orig_filename), dataset=dataset)
        db.session.add(file)
        try:
            db.session.flush()
        except IntegrityError:
            raise DuplicateFile(
                f'File {orig_filename!r} already exists for user {user_str}')
        dest = file.filepath
        makedirs(op.dirname(dest), exist_ok=True)
        move(temp_filename, file.filepath)
        return file

    def remove(self):
        """Remove file from the db and the filesystem

        Warning: commits (or rollbacks if there's an exception) the active session.
        """
        db.session.delete(self)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        else:
            self.unlink()

    def unlink(self):
        """Remove the file from the filesystem

        Warning: should never be used on an object that exists in the db.
        Use it only on new ones or removed ones in order to cleanup.
        """
        unlink(self.filepath)

    @contextmanager
    def fileobj(self, mode: str = 'rb'):
        with open(self.filepath, mode) as fobj:
            yield fobj


class DataSet(db.Model):  # type: ignore
    """A dataset containing multiple Excel files within an archive

    - belongs to a specific user (or is empty, then it's some general use dataset)
    - stores the archive file (zip or tar) in the filesystem
    - contains one or more DataFile objects for each .xl file in the archive
    """
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(index=True)
    label: Mapped[str] = mapped_column()
    size: Mapped[int]
    user_id: Mapped[int | None] = mapped_column(db.ForeignKey(User.id))
    user: Mapped[User | None] = cast(Mapped[User | None], db.relationship(backref='datasets'))
    files: Mapped[list['DataFile']] = cast(Mapped[list['DataFile']], db.relationship(
        'DataFile', foreign_keys='DataFile.dataset_id', back_populates='dataset',
        cascade='all, delete-orphan'
    ))
    created: Mapped[datetime] = mapped_column(default=utcnow)
    modified: Mapped[datetime] = mapped_column(default=utcnow,
                                               onupdate=utcnow)
    __table_args__ = (db.UniqueConstraint(user_id, filename),)

    def __str__(self):
        return f'DataSet {self.filename} | {self.label} ({self.filepath})'

    def __repr__(self):
        return f'<{self}>'

    @cached_property
    def fname(self):
        return quote_plus(self.filename)

    @cached_property
    def filepath(self):
        return op.join(app.DATADIR, f'user_{self.user_id or "common"}', self.fname)

    @cached_property
    def origfilepath(self):
        return op.join(self.filepath, 'orig', self.basename)

    @cached_property
    def datafilepath(self):
        return op.join(self.filepath, 'files')

    @cached_property
    def processedfilepath(self):
        return op.join(self.filepath, 'processed.csv')

    @property
    def is_processed(self):
        return op.exists(self.processedfilepath)

    def reset_processing(self):
        if self.is_processed:
            os.unlink(self.processedfilepath)

    def preprocess(self):
        app.logger.info("Preprocessing: %s", self)
        df = preprocessing.preprocess(
            (file.filepath for file in self.files),
            defaults.ELEMENTS_DICT
        )
        df.to_csv(self.processedfilepath, index=False)
        app.logger.info("Preprocessing finished: %s", self)

    @cached_property
    def stat(self):
        return stat(self.origfilepath)

    @cached_property
    def basename(self):
        return op.basename(self.fname)

    @classmethod
    def create(
            cls,
            temp_filename: str,
            orig_filename: str,
            label: str | None = None,
            user_id: int | None = None
    ):
        """Creates a dataset in the db and in the filesystem

        Only accepts zip or (possibly compressed) tar files.
        The archive must contain at least one .csv or .xl file.
        Creates a DataFile object for each .csv or .xl file found.

        Warning: That method does not commit the session.
        If committing the session fails, the dataset and files should be removed
        from the filesystem using self.remove()

        Raises:
            WrongFileType: if the file is not zip or tar format, or if files are not valid CSV
            NoDataFile: if no .csv or .xl files are found in the archive
            DuplicateFile: if a dataset with the same name already exists for the user
        """
        # Extract and find .csv/.xl files - do this once in a context manager
        csv_files_info: list[tuple[str, bytes]] = []  # List of (filename, file_content)
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                # Determine archive type and extract
                if zipfile.is_zipfile(temp_filename):
                    with zipfile.ZipFile(temp_filename, 'r') as zf:
                        zf.extractall(tmpdir)
                elif tarfile.is_tarfile(temp_filename):
                    with tarfile.open(temp_filename, 'r:*') as tf:
                        tf.extractall(tmpdir)
                else:
                    raise WrongFileType(
                        f'File {orig_filename!r} is not a valid zip or tar archive')

                # Find all .csv or .xl files and read their content
                for root, _, filenames in walk(tmpdir):
                    for file in filenames:
                        if file.lower().rpartition('.')[2] in DataFile.ACCEPTED_EXTENSIONS:
                            excel_path = op.join(root, file)
                            with open(excel_path, 'rb') as src:
                                file_content = src.read()
                            csv_files_info.append((file, file_content))

            if not csv_files_info:
                raise NoDataFile(
                    f'No CSV or XL files found in archive {orig_filename!r}')

        except (zipfile.BadZipFile, tarfile.TarError) as e:
            raise WrongFileType(
                f'File {orig_filename!r} is not a valid archive: {e}')

        # Get user
        if user_id is None:
            user = fs.current_user
        else:
            user = db.session.query(User).get(user_id)
        if user and not user.is_authenticated:
            user = None
        user_str = str(user) if user else 'common'

        # Create dataset object
        dataset = cls(
            filename=orig_filename,
            size=stat(temp_filename).st_size,
            user=user,
            label=label or orig_filename.partition('.')[0].replace('_', ' ')
        )
        db.session.add(dataset)
        try:
            db.session.flush()
        except IntegrityError:
            raise DuplicateFile(
                f'Dataset {orig_filename!r} already exists for user {user_str}')

        # Move archive to destination
        makedirs(op.dirname(dataset.origfilepath), exist_ok=True)
        makedirs(dataset.datafilepath, exist_ok=True)
        move(temp_filename, dataset.origfilepath)

        # Create DataFile objects for each CSV file using the content we already read
        try:
            for filename, file_content in csv_files_info:
                # Create temporary file for DataFile.create()
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    tmp_path = tmp.name
                    tmp.write(file_content)

                try:
                    # Create DataFile without committing
                    DataFile.create(
                        temp_filename=tmp_path,
                        orig_filename=filename,
                        dataset=dataset,
                        label=filename,
                        user_id=user_id
                    )
                except Exception:
                    unlink(tmp_path)
                    raise

        except Exception:
            # Cleanup on error
            db.session.delete(dataset)
            db.session.flush()
            dataset.unlink()
            raise

        return dataset

    def remove(self):
        """Remove dataset from the db and the filesystem

        Warning: commits (or rollbacks if there's an exception) the active session.
        Also removes all associated DataFile objects.
        """
        db.session.delete(self)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        else:
            self.unlink()

    def unlink(self):
        """Remove the archive file from the filesystem

        Warning: should never be used on an object that exists in the db.
        Use it only on new ones or removed ones in order to cleanup.
        """
        shutil.rmtree(self.filepath)

    @contextmanager
    def fileobj(self, mode: str = 'rb'):
        with open(self.origfilepath, mode) as fobj:
            yield fobj
