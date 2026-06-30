# Banglish Emotion Detection Modular Notebooks

This directory contains the modularized code for the Banglish Emotion Detection project.
This structure is designed to avoid massive notebooks and prevent lost progress due to Colab runtime disconnects.

## Directory Structure

```
/424 Project/
│
├── helpers/                   # Core Python Modules
│   ├── preprocessing.py       # Data cleaning, phonetic normalization, vocab building
│   ├── features.py            # TF-IDF, Bengali lexicon injection features
│   ├── baselines.py           # Traditional ML baseline models
│   ├── visualization.py       # Plotting, confusion matrices
│   └── architecture.py        # Custom Transformer architectures (Phase 4)
│
├── Phase1_2_EDA.ipynb         # Data Cleaning & Exploratory Data Analysis
├── Phase3_Baselines.ipynb     # Traditional ML Models Evaluation
└── Phase4_Transformers.ipynb  # Dual-input & Contrastive Learning Models
```

## How to use in Google Colab

1. Upload the entire structure to your Google Drive `/424 Project/` folder.
2. In your notebooks, mount your drive and append the directory to `sys.path` so you can import the modular code:

```python
import sys
from google.colab import drive
drive.mount('/content/drive')
sys.path.append('/content/drive/My Drive/424 Project')

# Now you can use the modular code!
from helpers.preprocessing import preprocess_dataset
from helpers.features import extract_tfidf_features
```

## Setup & Installations

Ensure you install these before running the notebooks:
```bash
!pip install lightgbm openpyxl transformers datasets accelerate optuna
```
