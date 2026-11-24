"""Estimate label noise with confident learning (Northcutt et al., 2021), CPU only.

1. 5-fold out-of-fold class probabilities from TF-IDF (word 1-2 + char 2-5) +
   logistic regression on the Bengali text (the cleaner script).
2. Per-class threshold t_j = mean predicted prob of class j over rows labeled j.
3. A row labeled i is "flagged" if some other class j has p_j >= t_j
   (the most probable such j is the suggested label).

Flagged != wrong: a ~60%-accurate model over-flags. The flag rate is an upper
estimate; the real noise rate comes from the blind manual review sheet.

Outputs: results/audit_label_noise.json, results/review/label_review_sheet.csv
(blind, for a human) and results/review/label_review_key.csv (do not open
while reviewing).
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from sklearn.model_selection import StratifiedKFold

from banglish_emo.data import LABELS, REPO_ROOT, load_dataset

OUT = REPO_ROOT / "results"
SEED = 42


def oof_probs(texts: pd.Series, y: np.ndarray) -> np.ndarray:
    probs = np.zeros((len(y), len(LABELS)))
    for tr, va in StratifiedKFold(5, shuffle=True, random_state=SEED).split(texts, y):
        w = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=2, max_features=200_000, sublinear_tf=True)
        c = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=3, max_features=300_000, sublinear_tf=True)
        Xtr = hstack([w.fit_transform(texts.iloc[tr]), c.fit_transform(texts.iloc[tr])]).tocsr()
        Xva = hstack([w.transform(texts.iloc[va]), c.transform(texts.iloc[va])]).tocsr()
        clf = LogisticRegression(max_iter=2000, C=4.0)
        clf.fit(Xtr, y[tr])
        probs[va] = clf.predict_proba(Xva)
    return probs


def main() -> None:
    split = pd.read_csv(REPO_ROOT / "data" / "splits" / "split_seed42.csv")
    df = load_dataset().merge(split, on="row_id").reset_index(drop=True)
    y = df["label_id"].to_numpy()
    p = oof_probs(df["Bengali"], y)
    pred = p.argmax(1)

    t = np.array([p[y == j, j].mean() for j in range(len(LABELS))])
    above = p >= t
    above[np.arange(len(y)), y] = False
    masked = np.where(above, p, -1)
    flagged = above.any(1)
    suggested = masked.argmax(1)

    pairs = pd.crosstab(pd.Series(np.array(LABELS)[y[flagged]], name="given"),
                        pd.Series(np.array(LABELS)[suggested[flagged]], name="suggested"))
    summary = {
        "rows": len(y),
        "oof_weighted_f1": round(f1_score(y, pred, average="weighted"), 4),
        "oof_macro_f1": round(f1_score(y, pred, average="macro"), 4),
        "class_thresholds": dict(zip(LABELS, np.round(t, 3).tolist())),
        "flagged_rows": int(flagged.sum()),
        "flag_rate_upper_estimate": round(float(flagged.mean()), 4),
        "flag_rate_by_given_label": {LABELS[j]: round(float(flagged[y == j].mean()), 3) for j in range(len(LABELS))},
        "top_flag_pairs": {f"{g}->{s}": int(pairs.loc[g, s]) for g in pairs.index for s in pairs.columns
                           if g != s and pairs.loc[g, s] > 0},
    }
    summary["top_flag_pairs"] = dict(sorted(summary["top_flag_pairs"].items(), key=lambda kv: -kv[1])[:10])

    # Blind review sheet: 150 most confident flags + 50 random unflagged, shuffled.
    rng = np.random.default_rng(SEED)
    conf = np.where(flagged, masked.max(1) - p[np.arange(len(y)), y], -np.inf)
    top = np.argsort(-conf)[:150]
    unflagged = np.flatnonzero(~flagged)
    rand = rng.choice(unflagged, 50, replace=False)
    idx = rng.permutation(np.concatenate([top, rand]))
    sheet = df.loc[idx, ["row_id", "Bengali", "Banglish", "Label"]].rename(columns={"Label": "given_label"})
    sheet["your_label"] = ""
    sheet["given_label_ok (y/n/unsure)"] = ""
    sheet["note"] = ""
    key = pd.DataFrame({"row_id": df.loc[idx, "row_id"].to_numpy(), "flagged": flagged[idx],
                        "suggested": np.where(flagged[idx], np.array(LABELS)[suggested[idx]], "")})

    (OUT / "review").mkdir(parents=True, exist_ok=True)
    sheet.to_csv(OUT / "review" / "label_review_sheet.csv", index=False, encoding="utf-8-sig")
    key.to_csv(OUT / "review" / "label_review_key.csv", index=False, encoding="utf-8-sig")
    (OUT / "audit_label_noise.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
