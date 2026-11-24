"""Loading the Bengali & Banglish 80K dataset (Faisal et al., 2024, Data in Brief)."""
from __future__ import annotations

from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_XLSX = REPO_ROOT / "data" / "raw" / "Bengali_Banglish_80K_Dataset.xlsx"
CACHE_DIR = REPO_ROOT / "data" / "cache"

LABELS = ["anger", "disgust", "fear", "joy", "sadness", "surprise"]
LABEL2ID = {name: i for i, name in enumerate(LABELS)}


def load_raw(path: Path | str = RAW_XLSX, use_cache: bool = True) -> pd.DataFrame:
    """Return the dataset exactly as published (columns: Label, Bengali, Banglish, English).

    The xlsx is slow to parse, so a CSV copy is cached under data/cache/.
    """
    path = Path(path)
    cache = CACHE_DIR / (path.stem + ".csv")
    if use_cache and cache.exists():
        return pd.read_csv(cache, keep_default_na=False)
    df = pd.read_excel(path, keep_default_na=False)
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        df.to_csv(cache, index=False)
    return df


def load_dataset(path: Path | str = RAW_XLSX) -> pd.DataFrame:
    """Raw data plus a stable `row_id` and integer `label_id`.

    No cleaning or row removal happens here; filtering is done explicitly
    (and reported) by later steps.
    """
    df = load_raw(path).reset_index(drop=True)
    df.insert(0, "row_id", range(len(df)))
    df["Label"] = df["Label"].str.strip().str.lower()
    unknown = set(df["Label"]) - set(LABELS)
    if unknown:
        raise ValueError(f"Unexpected labels: {sorted(unknown)}")
    df["label_id"] = df["Label"].map(LABEL2ID)
    return df
