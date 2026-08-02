ELEMENTS_DICT: dict[str, float] = {
     "Na23": 100,
     "Mg26": 11.01,
     "Al27": 100,
     "S34": 4.31,
     "K39": 93.26,
     "Ti49": 5.41,
     "V51": 99.75,
     "Cr53": 9.5,
     "Mn55": 100,
     "Fe57": 2.12,
     "Co59": 100,
     "Cu65": 30.83,
     "Zn66": 27.9,
     "Sr88": 82.56,
     "Cd111": 12.8,
     "Sn118": 24.23,
     "Ba137": 11.23,
     "Hg202": 29.86,
     "Pb208": 52.4
}

# elements to keep in prediction, including multiplication weights
KEPT_ELEMENTS_WEIGHTS: dict[str, float] = {
     "Al": 1,
     "S": 1,
     "Mn": 10,
     "Co": 19,
     "Cu": 20,
     "Zn": 17,
     "Pb": 9,
     "Fe": 20,
     "Mg": 1,
     "Na": 1,
     "K": 1
}

PREPROCESSING_METHOD: str = 'logarithm'

NORMALISATION_TO_FE: bool = False

DROPOUT_PROB: float = 0.08145514656707054