from base64 import b64encode
from datetime import timezone
import os
from pathlib import Path
import tempfile
from flask import request

from typing import Any
import pandas as pd
import sqlalchemy.exc
from werkzeug.exceptions import Forbidden, NotFound
from werkzeug.utils import secure_filename
from sqlalchemy.orm import joinedload

from .. import app, db
from ..helpers import RequestError, make_resp_data, wrap_errors
from ..base.models import current_uid, current_user
from ..inksnet import prediction
from .models import DataSet

bp = app.create_blueprint(__name__, url_prefix='/api/datasets')


@bp.route("/list", methods=["GET"])
def get_datasets():
    datasets: list[dict[str, Any]]
    uid = current_uid()
    if uid:
        all_datasets = db.query(DataSet).options(joinedload(DataSet.files)).filter(db.func.coalesce(DataSet.user_id, 0).in_((uid, 0)))
        datasets = [
            {
                "id": dataset.id,
                "label": dataset.label,
                "filename": dataset.filename,
                "files": [
                    {
                        "id": datafile.id,
                        "filename": datafile.filename,
                        "label": datafile.label,
                        "size": datafile.size,
                        "created_date": datafile.created.replace(tzinfo=timezone.utc).isoformat(),
                        "modification_date": datafile.modified.replace(tzinfo=timezone.utc).isoformat()
                    }
                    for datafile in dataset.files
                ],
                "size": dataset.size,
                "user_id": dataset.user_id,
                "processed": dataset.is_processed,
                "created_date": dataset.created.replace(tzinfo=timezone.utc).isoformat(),
                "modification_date": dataset.modified.replace(tzinfo=timezone.utc).isoformat()
            }
            for dataset in all_datasets
        ]
    else:
        datasets = []
    return {'datasets': datasets}


@app.sio.onmsg('get_orig_dataset')
def ws_get_orig_dataset(id: int):
    user = current_user()
    uid = current_uid()
    sec_filter = () if user and user.is_admin else (db.func.coalesce(DataSet.user_id, 0).in_((uid, 0)),)
    dataset = db.query(DataSet).filter(DataSet.id == id, *sec_filter).one()
    with dataset.fileobj() as fobj:
        data = fobj.read()
    return make_resp_data({
        "status": "ok",
        "dataset": {"id": dataset.id, "name": dataset.filename, "label": dataset.label, "data": b64encode(data).decode()}
    })


@bp.route("/create", methods=["GET", "POST"], defaults={"common": False})
@bp.route("/create/common", methods=["GET", "POST"], defaults={"common": True})
@wrap_errors
def create_dataset(common: bool) -> dict[str, Any]:
    user = current_user()
    if not user or not user.is_authenticated:
        raise Forbidden
    uid = 0 if common and user and user.is_admin else current_uid()
    dataset_label = request.form['label']
    dataset_file = request.files['dataset']
    if not dataset_file.filename:
        raise ValueError('No filename selected')
    tfile = tempfile.NamedTemporaryFile(delete=False)
    try:
        dataset_file.save(tfile)
        tfile.close()
        dataset = DataSet.create(tfile.name, secure_filename(dataset_file.filename), dataset_label, uid)
        is_demo = user.username == 'demo' and user.email == 'demo@localhost'
        if is_demo:
            db.session.rollback()
        else:
            db.session.commit()
    finally:
        if os.path.exists(tfile.name):
            os.unlink(tfile.name)
    return {"status": "ok", "dataset_id": dataset.id, "is_demo": is_demo}


@bp.route("/remove/<int:id>", methods=["GET"])
@wrap_errors
def remove_dataset(id: int):
    user = current_user()
    uid = current_uid()
    sec_filter: dict[str, Any] = {} if user and user.is_admin else {'user_id': uid}
    dataset = db.query(DataSet).filter_by(id=id, **sec_filter).one()
    dataset.remove()
    return {"status": "ok"}


@app.sio.onmsg('prediction')
def ws_prediction(id: int):
    user = current_user()
    uid = current_uid()
    sec_filter: dict[str, Any] = {} if user and user.is_admin else {'user_id': uid}
    try:
        db.query(DataSet).filter_by(id=id, **sec_filter).one()
    except sqlalchemy.exc.NoResultFound:
        raise RequestError("No prediction allowed for this user")

    def run_prediction(client_sid: str) -> dict[str, Any]:
        try:
            dataset = db.query(DataSet).filter_by(id=id).one()
            if not dataset.is_processed:
                raise RequestError("Dataset must be processed before prediction")

            figures_dir = Path(dataset.filepath) / 'prediction'
            figures_dir.mkdir(parents=True, exist_ok=True)

            model_dir = Path(__file__).resolve().parents[1] / 'inksnet'
            preprocessed_df = pd.read_csv(dataset.processedfilepath, header=0)
            prediction_values = prediction.get_prediction(preprocessed_df, str(model_dir))

            visualisation_input = preprocessed_df.select_dtypes(include='number')
            visualiser = prediction.PredictionVisualizer(
                visualisation_input,
                preprocessed_df,
                str(figures_dir),
            )

            pca_path = visualiser.show_pca(str(figures_dir))
            means_pca_path = visualiser.show_means_pca(str(figures_dir))
            heatmap_path = visualiser.show_clustering_heatmap(str(figures_dir))

            def encode_visualisation(path: str | None) -> dict[str, Any] | None:
                if not path:
                    return None
                with open(path, 'rb') as fobj:
                    encoded = b64encode(fobj.read()).decode()
                return {
                    'filename': Path(path).name,
                    'data': encoded,
                }

            return {
                'id': id,
                'status': 'ok',
                'message': 'Prediction completed',
                'prediction': prediction_values.tolist(),
                'visualisations': {
                    'pca': encode_visualisation(pca_path),
                    'means_pca': encode_visualisation(means_pca_path),
                    'clustering_heatmap': encode_visualisation(heatmap_path),
                }
            }
        finally:
            db.session.remove()

    return run_prediction


@app.sio.onmsg('update_dataset')
def ws_update_dataset(id: int, label: str | None, datafile_labels: dict[str | int, str]):
    user = current_user()
    uid = current_uid()
    sec_filter: dict[str, Any] = {} if user and user.is_admin else {'user_id': uid}
    dataset = db.query(DataSet).filter_by(id=id, **sec_filter).one()
    if label:
        dataset.label = label
    for file in dataset.files:
        try:
            file_label = datafile_labels.get(file.id) or datafile_labels[str(file.id)]
        except KeyError:
            continue
        file.label = file_label or file.basename
    db.session.commit()
    return make_resp_data({
        "status": "ok"
    })


@app.sio.onmsg('preprocess')
def ws_preprocess(id: int):
    user = current_user()
    uid = current_uid()
    sec_filter: dict[str, Any] = {} if user and user.is_admin else {'user_id': uid}
    try:
        db.query(DataSet).filter_by(id=id, **sec_filter).one()
    except sqlalchemy.exc.NoResultFound:
        raise RequestError("No preprocess allowed for this user")

    def run_preprocess(client_sid: str) -> dict[str, Any]:
        try:
            dataset = db.query(DataSet).filter_by(id=id).one()
            dataset.preprocess()
            app.logger.info('Background preprocess completed for dataset %s', id)
            return {
                'id': id,
                'status': 'ok',
                'message': 'Preprocess completed'
            }
        finally:
            db.session.remove()

    return run_preprocess


@app.sio.onmsg('get_processed_dataset')
def ws_get_processed_dataset(id: int):
    user = current_user()
    uid = current_uid()
    sec_filter = () if user and user.is_admin else (db.func.coalesce(DataSet.user_id, 0).in_((uid, 0)),)
    dataset = db.query(DataSet).filter(DataSet.id == id, *sec_filter).one()
    if not dataset.is_processed:
        raise NotFound
    with open(dataset.processedfilepath, 'rb') as fobj:
        data = fobj.read()
    return make_resp_data({
        "status": "ok",
        "processed": {"id": dataset.id, "name": dataset.filename.partition('.')[0] + '-processed.csv', "data": b64encode(data).decode()}
    })


@app.sio.onmsg('reset_processing')
def ws_reset_processing(id: int):
    user = current_user()
    if not (user and user.is_admin):
        raise Forbidden
    dataset = db.query(DataSet).filter_by(id=id).one()
    dataset.reset_processing()
    return make_resp_data({"status": "ok"})
