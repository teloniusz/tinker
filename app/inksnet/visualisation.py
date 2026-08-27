"""
This module is a refactored and trimmed copy of the visualisation part of the implementation found
in https://github.com/BDomzal/inks/blob/main/src/data_utils.py module created by Barbara Domżał.
"""
from pathlib import Path
from typing import Any

import os
import numpy as np
import pandas as pd
import matplotlib
if not os.environ.get('DISPLAY'):
    matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import Colormap, LogNorm
from matplotlib.lines import Line2D
from numpy.typing import NDArray
import seaborn as sns


def visualise_pca(X_low_dim: NDArray[Any], y: pd.Series | pd.Index,
                    dimensions: list[int] = [0,1],
                    figures_name: str = 'pca',
                    cmap: Colormap = plt.get_cmap('tab20'),
                    annotate: bool = False,
                    whether_sort: bool = True,
                    figures_path: Path | None = None):

    fig, ax = plt.subplots()
    colors = cmap(np.linspace(0, 0.99, y.nunique()))

    if whether_sort:
        sorted_labels = sorted(y.unique())
    else:
        sorted_labels = y.unique()

    color_dict = dict((key, value) for key, value in zip(sorted_labels, colors))
    color_dict['corroded'] = [1., 0., 0., 1.]
    legend_elements = [Line2D([0], [0], color='w', marker='o', markerfacecolor=color_dict[label],
                                                  label=label, markersize=15) for label in sorted_labels]

    x_pca_0 = [X_low_dim[i, dimensions[0]] for i in range(X_low_dim.shape[0])]
    x_pca_1 = [X_low_dim[i, dimensions[1]] for i in range(X_low_dim.shape[0])]
    y_colors = np.array([color_dict[el] for el in y])

    ax.set_xlabel('PC' + str(dimensions[0]+1))
    ax.set_ylabel('PC' + str(dimensions[1]+1))

    ax.scatter(x_pca_0, x_pca_1, marker='o', s=100, color=y_colors)
    ax.legend(handles=legend_elements, prop={'size': 8})

    if figures_path is not None:
        dest_path = figures_path / (figures_name + '_' + 'PC' + str(dimensions[0]+1) + '_' + 'PC' + str(dimensions[1]+1) + '.png')
        fig.savefig(dest_path)
    else:
        dest_path = None
    plt.close(fig)
    return dest_path


def visualise_means_pca(data: NDArray[Any], y: pd.Series | pd.Index,
                        figures_name: str = 'pca_means',
                        cmap: Colormap = plt.get_cmap('tab20'),
                        annotate: bool = False,
                        figures_path: Path | None = None):

    df = pd.DataFrame(data)
    df['Sample_id'] = y.values
    df = df.groupby('Sample_id').mean()
    return visualise_pca(df.values, df.index, figures_name=figures_name, cmap=cmap, annotate=annotate, figures_path=figures_path)


def visualise_clustering_on_heatmap(
        data: NDArray[Any], y: NDArray[Any],
        elements_to_keep: list[str], colormap: Colormap = plt.get_cmap('tab20'), figsize: tuple[int, int] = (6,5),
        cbar_pos: tuple[float, float, float, float] | None = None, dendrogram_ratio: float = 0.1,
        show_classes_names: bool = False, show_legend: bool = False, row_cluster: bool = True,
        col_cluster: bool = True, figures_path: Path | None = None):
    y_true = pd.Series(y)
    y_true = y_true.rename('          ')

    heatmap_df = pd.DataFrame(
        data=data,
        columns=elements_to_keep,
        index=np.arange(len(y_true))
    )

    colors = colormap(np.linspace(0, 0.99, y_true.nunique()))
    sorted_labels = sorted(y_true.unique())
    color_dict = dict((key, value) for key, value in zip(sorted_labels, colors))
    if 'corroded' in sorted_labels:
        color_dict['corroded'] = [1., 0., 0., 1.]

    row_colors = y_true.map(color_dict)
    row_colors.index = heatmap_df.index

    cg = sns.clustermap(
        heatmap_df,
        row_cluster=row_cluster,
        col_cluster=col_cluster,
        row_colors=row_colors,
        dendrogram_ratio=dendrogram_ratio,
        colors_ratio=0.05,
        figsize=figsize,
        norm=LogNorm(),
        cbar_pos=cbar_pos
    )

    #cg.ax_row_dendrogram.set_visible(False)
    cg.ax_col_dendrogram.set_visible(False)

    ax = cg.ax_heatmap
    ax.yaxis.set_ticks([])
    ax.tick_params(axis='both', labelsize=25, rotation=90)

    # Row order after clustering
    row_order = cg.dendrogram_row.reordered_ind
    labels = y_true.iloc[row_order].values

    # Find boundaries where label changes
    change_idx = np.where(labels[:-1] != labels[1:])[0] + 1

    # Start + end indices of each block
    block_starts = np.r_[0, change_idx]
    block_ends = np.r_[change_idx, len(labels)]

    # Tick positions = center of each block
    tick_pos = (block_starts + block_ends) / 2
    tick_labels = labels[block_starts]

    ax = cg.ax_row_colors

    if show_legend:
        markers = [
            plt.Line2D([0,0], [0,0], color=color, marker='o', markersize=12, linestyle='')
            for color in color_dict.values()
        ]
        cg.figure.legend(markers, color_dict.keys(), numpoints=1)

    if show_classes_names:
        ax.set_yticks(tick_pos)
        ax.set_yticklabels(tick_labels)
    else:
        ax.set_yticks([])
        ax.set_yticklabels([])

    if figures_path is not None:
        dest_path = figures_path / 'clustering_heatmap.png'
        cg.savefig(dest_path, dpi=400)
    else:
        dest_path = None
    plt.close(cg.figure)
    return dest_path
