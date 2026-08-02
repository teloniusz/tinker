import torch
from torch import nn


class InksNet(nn.Module):
    """Small fully-connected network used for reconstruction/regression.

    This class is a 1:1 copy of the implementation found in https://github.com/BDomzal/inks/blob/main/src/model.py
    created by Barbara Domżał.

    The architecture is a stack of Linear -> Dropout -> BatchNorm1d -> ReLU
    blocks with expanding and contracting widths and a final Linear layer that
    projects back to ``input_size``. The module does not apply any final
    activation so it can be used for regression.

    Parameters
    ----------
    input_size:
        Number of features in the input (and output) tensor.
    dropout_prob:
        Dropout probability used after each Linear layer.
    """

    def __init__(self, input_size: int, dropout_prob: float) -> None:
        super().__init__()
        self.seq = nn.Sequential(
            nn.Linear(input_size, 93),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(93, 586),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(586, 660),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(660, 743),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(743, 105),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(105, 893),
            nn.GELU(),
            nn.Dropout(dropout_prob),
            nn.Linear(893, input_size),
        )


    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Run a forward pass.

        Parameters
        ----------
        x:
            Input tensor of shape (batch_size, input_size).

        Returns
        -------
        torch.Tensor
            Output tensor of the same shape as input.
        """
        return self.seq(x)
