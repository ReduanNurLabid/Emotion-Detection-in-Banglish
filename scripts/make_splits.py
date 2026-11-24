"""Phase 0: audit the 80K dataset and create a leakage-safe train/val/test split.

Rules (all reported in results/data_audit.json):
  1. Drop rows whose Banglish text is empty.
  2. Drop every row whose Banglish string occurs with more than one label (label conflict).
  3. Group rows by Banglish string so identical strings never cross splits.
  4. Stratified group split, approximately 80/10/10, fixed seed.

Usage:  python scripts/make_splits.py [--seed 42]
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold

from banglish_emo.data import LABELS, REPO_ROOT, load_dataset

SPLIT_DIR = REPO_ROOT / "data" / "splits"
RESULTS_DIR = REPO_ROOT / "results"
BENGALI_CHARS = re.compile(r"[ঀ-৿]")


def spelling_consistency(texts: pd.Series, min_count: int = 30) -> dict:
    """Share of the most common Banglish token among tokens that map to the same
    (lower-cased) form. Without alignment we approximate with an exact-token view:
    report vocabulary size and how concentrated the token distribution is."""
    counts = Counter(tok for t in texts for tok in t.lower().split())
    frequent = {w: c for w, c in counts.items() if c >= min_count}
    return {"vocab_size": len(counts), f"tokens_with_count_ge_{min_count}": len(frequent)}


BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def bengali_key(texts: pd.Series) -> pd.Series:
    """Normalize Bengali text for near-duplicate detection."""
    return texts.str.translate(BN_DIGITS).str.replace(r"[^ঀ-৿\w]+", "", regex=True)


def connected_groups(*keys: list[str]) -> list[int]:
    """Union-find: rows that share any key end up in the same group."""
    n = len(keys[0])
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for key in keys:
        first: dict[str, int] = {}
        for i, k in enumerate(key):
            if k in first:
                parent[find(i)] = find(first[k])
            else:
                first[k] = i
    roots = [find(i) for i in range(n)]
    return pd.factorize(pd.Series(roots))[0].tolist()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    df = load_dataset()
    audit: dict = {"seed": args.seed, "raw_rows": len(df), "raw_label_counts": df["Label"].value_counts().to_dict()}

    # 1. empty Banglish
    empty = df["Banglish"].str.strip() == ""
    audit["dropped_empty_banglish"] = int(empty.sum())
    df = df[~empty].copy()

    # 2. label conflicts among identical Banglish strings
    key = df["Banglish"].str.strip()
    labels_per_key = df.groupby(key)["label_id"].nunique()
    conflict_keys = set(labels_per_key[labels_per_key > 1].index)
    conflict_mask = key.isin(conflict_keys)
    audit["conflicting_banglish_strings"] = len(conflict_keys)
    audit["dropped_conflict_rows"] = int(conflict_mask.sum())
    df = df[~conflict_mask].copy()

    dup = df["Banglish"].str.strip().duplicated(keep=False)
    audit["rows_in_duplicate_banglish_groups"] = int(dup.sum())
    audit["banglish_rows_with_bengali_chars"] = int(df["Banglish"].str.contains(BENGALI_CHARS).sum())
    audit["banglish_token_stats"] = spelling_consistency(df["Banglish"])

    # Near-duplicate Bengali texts (differ only in spacing, punctuation, or
    # Bengali vs ASCII digits) are the same comment; group them too.
    bn_key = bengali_key(df["Bengali"])
    bn_conflict = bn_key.map(df.groupby(bn_key)["label_id"].nunique()) > 1
    audit["near_duplicate_bengali_rows"] = int(bn_key.duplicated(keep=False).sum())
    audit["dropped_bengali_conflict_rows"] = int(bn_conflict.sum())
    df, bn_key = df[~bn_conflict].copy(), bn_key[~bn_conflict]

    # 3-4. stratified group split: 10 folds -> 8 train, 1 val, 1 test.
    # A group = connected rows sharing a Banglish string OR a normalized Bengali text.
    groups = connected_groups(df["Banglish"].str.strip().tolist(), bn_key.tolist())
    sgkf = StratifiedGroupKFold(n_splits=10, shuffle=True, random_state=args.seed)
    fold = pd.Series(-1, index=df.index)
    for k, (_, idx) in enumerate(sgkf.split(df, df["label_id"], groups)):
        fold.iloc[idx] = k
    df["split"] = fold.map(lambda k: "test" if k == 0 else "val" if k == 1 else "train")

    # sanity: no Banglish string in more than one split
    splits_per_group = df.groupby(groups)["split"].nunique()
    assert (splits_per_group == 1).all(), "group leakage across splits"

    audit["final_rows"] = len(df)
    audit["split_sizes"] = df["split"].value_counts().to_dict()
    audit["split_label_counts"] = {
        s: df.loc[df["split"] == s, "Label"].value_counts().reindex(LABELS).to_dict()
        for s in ["train", "val", "test"]
    }

    SPLIT_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = SPLIT_DIR / f"split_seed{args.seed}.csv"
    df[["row_id", "split"]].to_csv(out, index=False)
    (RESULTS_DIR / "data_audit.json").write_text(json.dumps(audit, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(audit, indent=2))
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
