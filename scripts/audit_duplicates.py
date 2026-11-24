"""Why do identical Banglish strings map to different Bengali texts?

For every Banglish string that occurs more than once, compare its Bengali texts:
  - identical after stripping punctuation/whitespace  -> trivial (punctuation-only difference)
  - otherwise: character-level similarity of the Bengali pair, and what differs.
Writes results/audit_duplicates.json and results/audit_duplicates_examples.csv.
"""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from itertools import combinations

import pandas as pd

from banglish_emo.data import REPO_ROOT, load_dataset

OUT = REPO_ROOT / "results"
NON_LETTER = re.compile(r"[^ঀ-৿\w]+")


def bn_key(s: str) -> str:
    return NON_LETTER.sub("", s)


def main() -> None:
    df = load_dataset()
    df = df[df["Banglish"].str.strip() != ""].copy()
    df["bl_key"] = df["Banglish"].str.strip()
    groups = df[df["bl_key"].duplicated(keep=False)].groupby("bl_key")

    rows, cats = [], {"punct_or_space_only": 0, "near_identical_ge_0.9": 0, "similar_0.6_0.9": 0, "different_lt_0.6": 0}
    label_conflict_by_cat = {k: 0 for k in cats}
    for key, g in groups:
        bns = g["Bengali"].tolist()
        labels = g["Label"].tolist()
        a, b = bns[0], bns[1]
        if len({bn_key(x) for x in bns}) == 1:
            cat = "punct_or_space_only"
            ratio = 1.0
        else:
            ratio = min(SequenceMatcher(None, x, y).ratio() for x, y in combinations(bns, 2))
            cat = ("near_identical_ge_0.9" if ratio >= 0.9 else "similar_0.6_0.9" if ratio >= 0.6 else "different_lt_0.6")
        cats[cat] += 1
        if len(set(labels)) > 1:
            label_conflict_by_cat[cat] += 1
        rows.append({"banglish": key, "n": len(g), "category": cat, "min_char_ratio": round(ratio, 3),
                     "labels": "|".join(labels), "bengali_1": a, "bengali_2": b})

    ex = pd.DataFrame(rows).sort_values(["category", "min_char_ratio"])
    summary = {"duplicate_banglish_strings": len(ex), "rows_involved": int(ex["n"].sum()),
               "by_category": cats, "label_conflicts_by_category": label_conflict_by_cat,
               "mean_banglish_words": round(ex["banglish"].str.split().str.len().mean(), 1)}
    OUT.mkdir(exist_ok=True)
    (OUT / "audit_duplicates.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    ex.to_csv(OUT / "audit_duplicates_examples.csv", index=False, encoding="utf-8-sig")
    print(json.dumps(summary, indent=2))
    for cat in cats:
        print(f"\n=== {cat} (examples) ===")
        for _, r in ex[ex["category"] == cat].head(4).iterrows():
            print(f"BL: {r.banglish[:90]}\n  BN1: {r.bengali_1[:90]}\n  BN2: {r.bengali_2[:90]}\n  labels: {r.labels}  ratio={r.min_char_ratio}")


if __name__ == "__main__":
    main()
