"""Audit machine-translated ("I feel ...") rows and the shortcut they create.

MT-style row (conservative): Bengali starts with "আমি" (I), contains a
"feel" verb (অনুভব / বোধ কর / বোধ হ), and has no punctuation. This pattern is
typical of a machine-translated English "i feel ..." emotion corpus.

Measures, on our leakage-safe split (train -> test), with TF-IDF+LR models:
  - per-class F1 on MT-style vs other test rows, for Bengali and Banglish input
  - how well a style-only rule predicts fear
Writes results/audit_mt_rows.json.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, recall_score

from banglish_emo.data import LABELS, LABEL2ID, REPO_ROOT, load_dataset

FEEL = r"অনুভব|বোধ কর|বোধ হ"
PUNCT = r"[।?!,.\"'():;]"


def mt_style(bengali: pd.Series) -> pd.Series:
    b = bengali.str.strip()
    return b.str.startswith("আমি") & b.str.contains(FEEL, regex=True) & ~b.str.contains(PUNCT, regex=True)


def fit_predict(tr: pd.Series, y: np.ndarray, te: pd.Series) -> np.ndarray:
    w = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=2, max_features=200_000, sublinear_tf=True)
    c = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=3, max_features=300_000, sublinear_tf=True)
    Xtr = hstack([w.fit_transform(tr), c.fit_transform(tr)]).tocsr()
    Xte = hstack([w.transform(te), c.transform(te)]).tocsr()
    return LogisticRegression(max_iter=2000, C=4.0).fit(Xtr, y).predict(Xte)


def main() -> None:
    split = pd.read_csv(REPO_ROOT / "data" / "splits" / "split_seed42.csv")
    df = load_dataset().merge(split, on="row_id")
    df["mt"] = mt_style(df["Bengali"])
    fear = LABEL2ID["fear"]

    out: dict = {
        "mt_style_rows": int(df["mt"].sum()),
        "mt_style_label_counts": df.loc[df["mt"], "Label"].value_counts().to_dict(),
        "share_of_class_mt_style": df.groupby("Label")["mt"].mean().round(3).to_dict(),
        "rule_mt_style_to_fear": {
            "precision": round(float((df.loc[df["mt"], "label_id"] == fear).mean()), 3),
            "recall_of_fear": round(float(df.loc[df["label_id"] == fear, "mt"].mean()), 3),
        },
    }

    tr, te = df[df["split"] == "train"], df[df["split"] == "test"]
    y_tr, y_te = tr["label_id"].to_numpy(), te["label_id"].to_numpy()
    m = te["mt"].to_numpy()
    for col in ["Bengali", "Banglish"]:
        pred = fit_predict(tr[col], y_tr, te[col])
        res = {
            "weighted_f1_all": round(f1_score(y_te, pred, average="weighted"), 4),
            "macro_f1_all": round(f1_score(y_te, pred, average="macro"), 4),
            "macro_f1_without_mt_rows": round(f1_score(y_te[~m], pred[~m], average="macro"), 4),
            "fear_f1_all": round(f1_score(y_te, pred, labels=[fear], average="macro"), 4),
            "fear_f1_without_mt_rows": round(f1_score(y_te[~m], pred[~m], labels=[fear], average="macro"), 4),
            "fear_recall_on_mt_rows": round(recall_score(y_te[m], pred[m], labels=[fear], average="macro"), 4),
            "fear_recall_on_other_rows": round(recall_score(y_te[~m], pred[~m], labels=[fear], average="macro"), 4),
            "accuracy_on_mt_rows": round(float((pred[m] == y_te[m]).mean()), 4),
            "accuracy_on_other_rows": round(float((pred[~m] == y_te[~m]).mean()), 4),
        }
        out[f"tfidf_lr_{col.lower()}"] = res
    out["test_mt_rows"] = int(m.sum())

    (REPO_ROOT / "results" / "audit_mt_rows.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
