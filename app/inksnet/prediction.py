from functools import cached_property
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
import torch

from . import engine, data_utils, defaults, visualisation

logger = logging.getLogger(__name__)


MODEL_FILE = 'optuna_l1_71_3000.zip'


def get_prediction(data: str | pd.DataFrame, model_dir: str) -> pd.DataFrame:
    inds_df = pd.read_csv(data, header=0) if isinstance(data, str) else data
    prepared = data_utils.prepare_target_data(inds_df)[0]

    labels = [*defaults.KEPT_ELEMENTS_WEIGHTS] \
        if not defaults.NORMALISATION_TO_FE \
        else [elem for elem in defaults.KEPT_ELEMENTS_WEIGHTS if elem != 'Fe']
    input_size = len(labels)
    device = data_utils.get_device()
    model = engine.InksNet(input_size=input_size, dropout_prob=defaults.DROPOUT_PROB).to(device)
    model.load_state_dict(torch.load(Path(model_dir) / MODEL_FILE, weights_only=False,
                                     map_location=torch.device(device)))

    # ## Prediction
    model.eval()
    prediction = model(prepared)
    return pd.DataFrame(data=prediction.cpu().detach().numpy(), columns=labels)


class PredictionVisualizer:
    def _prepare_visual_data(self, data: str | pd.DataFrame, input_data: str | pd.DataFrame):
        if isinstance(data, str):
            df = pd.read_csv(data, delimiter=',', names=self.elements_to_keep, header=None)
        else:
            df = data
        if isinstance(input_data, str):
            inds_df = pd.read_csv(input_data, header=0)
        else:
            inds_df = input_data
        return np.array(df.values), data_utils.create_sample_id_in_target_data(inds_df)['Sample_id']

    def __init__(self, data: str | pd.DataFrame, input_data: str | pd.DataFrame, dest_dir: str):
        if defaults.NORMALISATION_TO_FE:
            self.elements_to_keep = [el for el in defaults.KEPT_ELEMENTS_WEIGHTS if el != 'Fe']
        else:
            self.elements_to_keep = [*defaults.KEPT_ELEMENTS_WEIGHTS]
        self.x_values, self.y_true = self._prepare_visual_data(data, input_data)

    @cached_property
    def x_pca(self):
        return PCA(n_components=2).fit_transform(self.x_values)

    def show_pca(self, dest_dir: Path):
        return visualisation.visualise_pca(self.x_pca, self.y_true, figures_path=dest_dir)

    def show_means_pca(self, dest_dir: Path):
        return visualisation.visualise_means_pca(self.x_pca, self.y_true, figures_path=dest_dir)

    def show_clustering_heatmap(self, dest_dir: Path):
        return visualisation.visualise_clustering_on_heatmap(
            self.x_values,
            self.y_true.to_numpy(),
            self.elements_to_keep,
            figures_path=dest_dir,
        )

