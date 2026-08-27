import tempfile
import unittest
from pathlib import Path

import pandas as pd

from app.inksnet.prediction import PredictionVisualizer


class PredictionVisualizationTest(unittest.TestCase):

    def test_show_clustering_heatmap_writes_file(self):
        visualisation_data = pd.DataFrame(
            [
                [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0],
                [12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 21.0, 22.0],
                [23.0, 24.0, 25.0, 26.0, 27.0, 28.0, 29.0, 30.0, 31.0, 32.0, 33.0],
            ],
            columns=[
                "feature_a",
                "feature_b",
                "feature_c",
                "feature_d",
                "feature_e",
                "feature_f",
                "feature_g",
                "feature_h",
                "feature_i",
                "feature_j",
                "feature_k",
            ],
        )
        input_data = pd.DataFrame({"name": ["sample_1", "sample_2", "sample_3"]})

        with tempfile.TemporaryDirectory() as tmp_path:
            visualiser = PredictionVisualizer(visualisation_data, input_data, tmp_path)
            output_path = visualiser.show_clustering_heatmap(tmp_path)

            self.assertIsNotNone(output_path)
            assert output_path
            self.assertTrue(Path(output_path).exists())


if __name__ == '__main__':
    unittest.main()