"""
This module is a refactored and trimmed copy of the implementation found in https://github.com/BDomzal/inks/blob/main/src/data_utils.py
created by Barbara Domżał.
"""
import logging
from typing import Any

import numpy as np
from numpy.typing import NDArray
import pandas as pd
import torch

from . import defaults


logger = logging.getLogger(__name__)


def create_sample_id_in_target_data(inds_df: pd.DataFrame, column_to_use: str = 'name'):
    assert column_to_use in inds_df.columns

    def create_sample_id(x: str):
        return ''.join(x.split('_', 2)[0:-1]) if '_' in x else x

    inds_df['Sample_id'] = inds_df[column_to_use].apply(create_sample_id)
    #inds_df['Sample_id'] = inds_df['Sample_id'].apply(lambda x: x.split('.')[0])
    inds_df.drop(columns=[column_to_use], inplace=True)
    inds_df.reset_index(drop=True, inplace=True)

    return inds_df


def remove_outer_samples(any_df: pd.DataFrame, how_many_outer_to_remove: int, sample_id_column: str = 'Sample_id'):
    def remove_outer(group: pd.DataFrame, n: int):
        if n == 0:
            return group
        return group.iloc[n:-n] if len(group) > 2*n else pd.DataFrame(columns=group.columns)

    any_df = any_df.groupby(sample_id_column, group_keys=False).apply(remove_outer, n=how_many_outer_to_remove)
    any_df = any_df.reset_index(drop=True)

    return any_df


def delete_elements(any_df: pd.DataFrame, elements_to_keep: list[str], indicators_suffix: str = '_i', inks_suffix: str = '_a',
                    keep_sample_id: bool = True, keep_name: bool = True):
    columns_to_keep_inds = [el + indicators_suffix for el in elements_to_keep]
    columns_to_keep_inks = [el + inks_suffix for el in elements_to_keep]

    if keep_sample_id:
        elements_to_keep = elements_to_keep + ['Sample_id']
    if keep_name:
        elements_to_keep = elements_to_keep + ['name']

    return any_df[[col for col in any_df.columns if col in elements_to_keep + columns_to_keep_inds + columns_to_keep_inks]]


def remove_missing_data(any_df: pd.DataFrame):
    how_many_nans = any_df.shape[0] - any_df.dropna().shape[0]
    if how_many_nans > 0:
        any_df = any_df.dropna()

    return any_df


def set_negative_to_zero(any_df: pd.DataFrame):
    cols = any_df.select_dtypes(np.number).columns
    any_df[cols] = any_df[cols].clip(lower=0)

    return any_df


def divide_by_weights(any_df: pd.DataFrame, columns_to_transform: list[str], weights: list[float], suffix: str = ''):
    any_df = any_df.copy()
    weights = [el/sum(weights) for el in weights]
    columns_to_transform = [el + suffix for el in columns_to_transform]
    for i, col in enumerate(columns_to_transform):
        any_df[col] = any_df[col]/weights[i]

    return any_df


def normalise_to_Fe(any_df: pd.DataFrame, elements_to_keep: list[str], remove_Fe: bool = False, suffixes: list[str] | None = None):
    if suffixes is None:
        suffixes = ['', '_i', '_a']
    any_df = any_df.copy()

    for suffix in suffixes:
        divisor = any_df['Fe' + suffix].copy()
        columns_to_keep = [el + suffix for el in elements_to_keep]
        for col in columns_to_keep:
            any_df[col] = any_df[col] / divisor

    if remove_Fe:
        any_df = any_df.drop(columns=['Fe' + suffix for suffix in suffixes])

    return any_df


def prepare_target_data(
    inds_df: pd.DataFrame,
    elements_weights: dict[str, float] | None = None,
    how_many_outer_to_remove: int = 0,
    preprocessing_method: str = defaults.PREPROCESSING_METHOD,
    column_to_use: str = 'name',
    normalisation_to_Fe: bool = defaults.NORMALISATION_TO_FE
    ):

    if elements_weights is None:
        elements_weights = defaults.KEPT_ELEMENTS_WEIGHTS

    elements_to_keep = list(elements_weights.keys())
    multiplication_weights = list(elements_weights.values())

    # ## Preprocessing

    # 0. Keeping track of the records from the same sample.
    # We will keep this info in 'Sample_id' column.

    inds_df = create_sample_id_in_target_data(inds_df, column_to_use)

    # 1. Removing 'outer' samples:

    inds_df = remove_outer_samples(inds_df, how_many_outer_to_remove)

    # 2. Removing columns that we don't need.
    # Instead of predicting amounts of all the elements, we will predict only those from elements_to_keep list.

    inds_df = delete_elements(inds_df, elements_to_keep, keep_sample_id=True, keep_name=False)

    # 3. Removing rows with missing values if there are any.

    inds_df = remove_missing_data(inds_df)

    # 4. Setting negative numbers to zeros. (First, checking if there are any.)

    inds_df = set_negative_to_zero(inds_df)

    # 5. Dividing the indicators by weights.

    inds_df = divide_by_weights(inds_df, elements_to_keep, weights=multiplication_weights)

    if normalisation_to_Fe:

        # 6. Normalising with respect to Fe.

        inds_df = normalise_to_Fe(inds_df, elements_to_keep, remove_Fe=False, suffixes=[''])

        # 7. Removing Fe.

        elements_to_keep = [el for el in elements_to_keep if el != 'Fe']
        inds_df = delete_elements(inds_df, elements_to_keep, keep_sample_id=True, keep_name=False)

    # 8. Resetting the index.

    inds_df.reset_index(drop=True, inplace=True)


    # 9. Converting to np.array
    # (Everything except Sample_id column.)

    data = np.array(inds_df[elements_to_keep].values)

    # 10.  Normalisation / taking logarithm.

    data_to_return = transform_data(data, preprocessing_method)

    # 11. Converting to tensors.

    device = get_device()
    device_data = data_to_device(data_to_return, device)

    return device_data, data_to_return


def transform_data(data: NDArray[Any], preprocessing_method: str) -> NDArray[Any]:
    def adjusted_log_transform(input_array: NDArray[Any]):
        res = np.where(input_array > 0, np.log(input_array), 0.)
        return res

    if preprocessing_method == 'normalisation':
        prep_data = (data - np.min(data, axis=0)) / np.std(data, axis=0)
    elif preprocessing_method == 'logarithm':
        prep_data = adjusted_log_transform(data)
    elif preprocessing_method == 'logarithm_and_normalisation':
        #logarithm
        prep_data = adjusted_log_transform(data)
        #normalisation
        prep_data = (prep_data - np.min(prep_data, axis=0))/np.std(prep_data, axis=0)
    else:
        prep_data = data
    return prep_data


def get_device():
    device = (
        "cuda"
        if torch.cuda.is_available()
        else "mps"
        if torch.backends.mps.is_available()
        else "cpu"
    )
    logger.info('Using device: %s', device)
    return device


def data_to_device(data: NDArray[Any], device: str):
    return torch.Tensor(data).to(device)
