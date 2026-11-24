# Banglish Emotion Recognition — Revised Study

Controlled study of romanized (Banglish) vs native-script Bengali emotion recognition, back-transliteration, and dual-script fusion. Revision of the CSE424 project paper (v1) toward a journal submission. See [docs/REVISION_PLAN.md](docs/REVISION_PLAN.md).

## Layout

```
configs/            experiment configs (YAML)
data/raw/           published datasets, untouched (80K: Faisal et al., 2024, CC BY-NC)
data/splits/        saved split row ids (versioned, small)
data/cache/         generated caches (git-ignored)
docs/               revision plan, reviews, background reading
notebooks/legacy/   original v1 notebooks (frozen, for reference only)
notebooks/cloud/    thin Kaggle/Colab launchers that call the scripts
paper/v1/           submitted v1 report and its figures
results/            per-run JSON metrics and summary tables
scripts/            command-line entry points (data audit, training, evaluation)
src/banglish_emo/   reusable library code
```

## Setup (local, CPU)

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt -e .
```

GPU environments (Kaggle/Colab): `pip install -r requirements-gpu.txt -e .` after cloning.

## Data

`data/raw/Bengali_Banglish_80K_Dataset.xlsx` — Faisal et al. (2024), *Data in Brief* 55:110760, doi:10.1016/j.dib.2024.110760. Licensed CC BY-NC; respect it when redistributing.
