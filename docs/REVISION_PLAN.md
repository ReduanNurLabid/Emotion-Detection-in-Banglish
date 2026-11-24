# Revision Plan: Dual-Stream Banglish Emotion Paper → Q1 Journal

Status: draft plan, 2026-11-24. Inputs: `report22101803.pdf` (the paper), `Paper_Problems_and_Fixes_.pdf` (friend's review, 12 issues), the notebooks in this repo, and a literature search.

---

## 1. Where we stand (verified)

The friend's review is accurate. I re-checked its main claims against the code and data:

| Claim | Verified how | Result |
|---|---|---|
| Stream B gets the dataset's original Bengali (oracle) | `22101803_finalproject_CSE424.ipynb` cell 8/11 | Confirmed. Transliterator in `Phase4_Transformers.ipynb` was only run on 2 sentences. |
| Lexicon vector is in-sample NB predictions | cell 6 | Confirmed (`fit` then `predict_proba` on same train texts). The SVM baseline uses it too, so the "TF-IDF baseline" also sees gold Bengali. |
| EmoNoBa: Love rows dropped, ties broken to Joy | cell 13 | Confirmed: 2,272 → 1,884; `idxmax` over `[Joy, Surprise, Anger, Sadness, Fear]`. Macro-F1 printed = 0.54. |
| 3 epochs, 1 run, still improving | cell 10 output | Val F1 0.6459 → 0.6537 → 0.6872; val loss rises in epoch 3. |
| Banglish duplicates | spreadsheet | 844 Banglish strings repeated over 1,708 rows; **26 have conflicting labels**. Bengali column has 0 duplicates. |
| Table I numbers are copied | dataset paper | Exactly the Banglish column of Faisal et al. (2024) Table 3. |

### Extra problems I found (not in the friend's review)

1. **Focal-loss bug.** `pt = exp(-CE_weighted)` uses the *class-weighted* CE, so `pt = p_t ** alpha_t`, not `p_t`. For Fear (α≈1.76) the modulating factor is wrong. Fix: compute unweighted CE for `pt`, then multiply by `alpha_t`.
2. **Cleaning deletes words.** `re.sub(r'\b[a-z]\b', '', text)` removes every one-letter token (e.g., "o" = "and/also", "e"). Digits are removed too. Report or drop this.
3. **EmoNoBa all-zero rows.** If any non-Love row has no emotion set, `idxmax` silently labels it Joy. Count them.
4. **A direct competitor is missing.** A 2025 paper on the *same* dataset reports XLM-R at 65.54% weighted F1 on Banglish (ref 6 in the review doc: "Detecting Emotions Using Transformer-based Models in Transliterated Bangla (Banglish) Text"). That already beats the "Prev. SOTA" (64.59) in our Table I.
5. **The dual-script fusion idea has prior art.** Pahari & Shimada (arXiv 2402.04542) fuse romanized and native-script encoders with cross-attention for code-mixed sentiment (Nepali/Hindi). We must cite it and position against it. A cross-attention fusion variant is also a natural ablation.
6. **Romanized-Bangla encoders exist.** BanglaTLit (Fahim et al., EMNLP Findings 2024) released "TB-encoders" further pretrained on romanized Bangla. These are the right Banglish-only baselines (Stream A candidates too).

### Why this is hard for Q1 with the current framing

- The Banglish column was **hand-written from Bengali and spelling-standardized** (99.5% spelling consistency). So "noisy Banglish" is not what the data contains, and the normalizer has little to do.
- The 69.5% is an **oracle** result. BanglaBERT on Bengali alone gets 71.3% in the dataset paper, so fusion may not help at all.
- One run, no ablations, no fair baselines, and a "zero-shot" test that is in-distribution.

Patching these issues gives a correct but thin paper. Q1 reviewers want a clear research question and a contribution that survives the fixes.

---

## 2. Proposed reframing (recommended)

The dataset's real asset is that it is **parallel**: the same 80K texts with the same labels in two scripts. That allows a controlled study that most Banglish papers can't do.

**Working title:** *Does the Script Matter? A Controlled Study of Romanized vs. Native-Script Bangla Emotion Recognition, Back-Transliteration, and Dual-Script Fusion.*

**Research questions:**

- **RQ1 – Script gap.** How much performance is lost when the same content is written in Roman script, across classic models, encoders (mBERT, XLM-R, BanglaBERT, BanglishBERT, TB-encoders) and LLMs? The parallel data isolates script from content.
- **RQ2 – Back-transliteration.** How much of the gap does automatic back-transliteration recover? Relate transliteration error (CER/WER against the gold Bengali) to downstream F1, including a controlled-noise curve.
- **RQ3 – Fusion.** Does dual-script fusion help when Stream B gets *realistic* (machine-transliterated) Bengali rather than the oracle? Compare it to simple baselines: same-size ensembles, late fusion, and cross-attention fusion (Pahari & Shimada style).
- **RQ4 – Robustness.** Because the data is standardized, inject realistic romanization variation (v/bh, sh/s, vowel drop or elongation, abbreviations) at test time. How fast does each model degrade, and do normalization or fusion help?
- **RQ5 – LLMs.** Where do current open and API LLMs stand in zero- and few-shot settings, with Banglish, Bengali, and Banglish+Bengali input? This also ties to recent findings that romanization hurts LLMs (5-Dialects-BN, EMNLP 2026).

The dual-stream model stays, but as one system inside an honest study. It is no longer a "SOTA" claim. If fusion with realistic transliteration beats Banglish-only models, that becomes the headline. If not, the paper still contributes clear, reproducible findings.

---

## 2a. Data audit findings (2026-11-24, scripts in `scripts/audit_*.py`, outputs in `results/`)

- **Near-duplicates:** 5,028 rows are the same Bengali comment up to spacing/punctuation/digit script; 669 groups crossed the first split. Split rebuilt by grouping on Banglish string OR normalized Bengali (`data/splits/split_seed42.csv`, 79,888 rows: 63,910/7,990/7,988; 0 groups cross splits). Conflicting-label duplicates dropped (55 + 149 rows). v1's random split had this leakage.
- **Machine-translated shortcut:** ≥1,706 rows match a machine-translated "I feel …" pattern (starts আমি + feel verb + no punctuation; MT artifacts like `godশ্বর`). 1,330 are fear (17.6% of fear), 355 surprise. A style rule alone predicts fear with 78% precision. TF-IDF+LR fear recall: 88–89% on these rows vs 50–53% on the rest; fear F1 drops 6–7 points without them. All fear/surprise claims must be reported with and without MT-style rows. True MT share is likely larger (conservative pattern).
- **Label noise:** confident learning flags 22% of rows (upper bound; model F1 0.62). Blind 200-row manual review in progress (`results/review/`).
- **Script gap for lexical models is ~0:** TF-IDF+LR on our split: Banglish 0.609 vs Bengali 0.599 weighted F1. The standardized hand-romanization preserves lexical information, so this corpus cannot show that "Banglish is hard" for lexical models; any gap must come from pretrained encoders' script coverage. This strengthens the case for the natural test set.

## 2b. Contribution package and novelty check (literature search, 2026-11-24)

Search snippets only; read each paper before citing.

| Idea | Closest prior work found | Verdict |
|---|---|---|
| **Natural Banglish emotion test set** + measured standardized→natural gap | None found for Banglish emotion | **Clearly new.** Strongest contribution. |
| **Cross-script privileged training**: Bengali teacher → Banglish-only student (distillation + contrastive alignment), Bengali used in training only | Jitin et al. 2021 (arXiv 2108.13620): teacher–student alignment of *machine*-transliterated Hindi/Malayalam. TransliCo (ACL 2024): contrastive sentence↔transliteration pretraining. RomanSetu (ACL 2024). GARuD (IJCNLP Findings 2025): distillation + contrastive cross-lingual. LUPI distillation (2023). | **Mechanism is not new.** New: human-written parallel romanization, task-level (emotion) privileged distillation for Bangla, tested under the natural-Banglish shift. Present it as a careful adaptation + evaluation, not a new algorithm. Include a TransliCo-style contrastive variant as a baseline. |
| **Mined-variant augmentation**: learn real spelling variants from unlabeled romanized Bangla (anchored to the same Bengali word via back-transliteration), rewrite training text | Lex-C / Lex-Var (Roman Urdu clustering, 2015/2020); unsupervised Hindi variant normalization (2018); random vowel noise in code-mixing toolkits (CALCS 2021); phonetic normalization (ICON 2022); phonetic features (arXiv 2310.18155) | **Moderately new.** Variant mining and noise exist; using back-transliteration-anchored natural variant distributions as augmentation to bridge a standardized→natural shift (for Bangla) was not found. Compare against random-noise augmentation and normalization. |
| **Uncertainty-aware fusion** (n-best transliterations, confidence gate) | n-best combination in transliteration shared tasks (NEWS 2009–2015); context-aware romanized transliteration (CL 2024) | **Small novelty.** Use as a secondary method or ablation of the dual-stream model. |
| **What romanization loses** (parallel-data analysis) | 5-Dialects-BN (EMNLP 2026): causal decomposition of the transliteration penalty for LLMs (many-to-one phoneme loss, fragmentation) | **Overlaps.** Must cite. Differentiate: emotion, encoders + LLMs, 80K human-romanized parallel data, link to per-item errors. |

**Chosen framing:**
1. **Resource:** NatBanglish-Emo test set + quantified spelling-variation gap.
2. **Analysis:** controlled script comparison on parallel data (script gap, information loss, tokenizer fragmentation vs error).
3. **Method:** Banglish-only inference model trained with (a) cross-script privileged distillation/alignment and (b) mined-variant augmentation. Evaluated on both test sets against Banglish-only encoders (incl. TB-encoders), back-transliteration pipelines, the realistic dual-stream, and LLMs.

**Method experiments to add (Phase 3b):**
- Teacher: BanglaBERT on Bengali (3 seeds; already planned as an upper reference).
- Students (Banglish only): CE baseline; + logit distillation (KL, temperature); + representation alignment (MSE / cosine to teacher CLS); + InfoNCE contrastive with parallel Bengali; combinations.
- Augmentation: none; random character noise; rule-based variants; mined variants. Run with and without distillation.
- All evaluated on the 80K test split + NatBanglish-Emo; 3 seeds for decisive rows; paired bootstrap.

## 3. Work plan

### Phase 0 — Decisions and cleanup (week 1, no GPU)
- [x] Data rule decided: Faisal dataset for training + natural-Banglish test-only set (Phase 0b).
- [ ] Convert notebooks to one script/config runner (`train.py --model ... --input ... --seed ...`) that logs JSON results. This saves time across ~60 runs.
- [ ] Group-aware split: keep all rows sharing a Banglish string in one split; drop or resolve the 26 conflicting-label strings. Save split IDs.
- [ ] Fix: out-of-fold lexicon (5-fold), focal-loss `pt`, single-letter deletion, early stopping on **macro-F1** (max ~8 epochs, patience 2).
- [ ] EmoNoBa overlap check (exact + char-n-gram near-duplicate) against the 80K Bengali column.

### Phase 0b — Natural Banglish test set ("NatBanglish-Emo") (weeks 1–5, runs in parallel, no GPU)
Decision (2026-11-24): we add a small, **test-only** set of real user-written Banglish. It answers the biggest reviewer objection (the training Banglish is hand-romanized and standardized). It also becomes a second contribution: the first naturally written Banglish emotion test set aligned to the 80K label space.

**Target:** ~2,000 labeled comments, at least ~200 per emotion class. Never used for training or model selection.

**1. Sources (prefer existing public romanized corpora over fresh scraping; check every license first)**
- Romanized texts from BanglaTLit (and BanglaTLit-PT) and BanTH: real romanized Bangla from social media, already public. We only add emotion labels. Confirm their licenses allow derivative annotation and redistribution.
- Fresh YouTube comments via the official YouTube Data API, only if needed to fill rare classes (fear, surprise). Use topics different from the 80K sources so the test is out-of-domain. Store comment IDs; follow YouTube ToS.
- Do **not** scrape Facebook (no API; ToS).

**2. Filtering**
- Keep comments that are mainly romanized Bangla: a Latin-script ratio threshold plus a simple romanized-Bangla word-list or language-ID check (BnSentMix-style). Hand-check a sample of 200 to report precision.
- Remove near-duplicates of anything in the 80K set (char n-gram similarity), plus spam, links-only, and comments under 3 words.
- Over-sample for minority classes with emotion keyword seeds. Report this sampling honestly, since it biases the class mix.

**3. Annotation**
- Guidelines: the same 6 Ekman labels as the 80K set, plus **"none/other"** and **"mixed"** escape options (kept but excluded from the main 6-class score; reported separately). Include 5–10 worked examples per label, with romanized examples.
- Pilot: 100 items, all annotators, discuss disagreements, revise guidelines.
- Main: **3 native-speaker annotators** per item; gold = majority vote; ties are adjudicated by a 4th person or dropped (report counts).
- Agreement: report **Krippendorff's α** (and Fleiss' κ) on the full set, not only the pilot. Expect much lower than 93.5%; that is normal and honest.
- Tooling: a simple spreadsheet or Label Studio (free, local).

**4. Spelling-variation statistics (key analysis)**
- Measure spelling entropy on the natural set vs the 80K Banglish (e.g., distinct spellings per frequent word; the 80K set has ~99.5% top-spelling share). This quantifies "natural vs standardized" Banglish and justifies RQ4.

**5. Ethics and release**
- Anonymize usernames, @mentions, phone numbers, emails.
- Check whether BRAC University needs ethics/IRB review for annotation of public posts; get it before annotating if so.
- Release: labels + source IDs (and texts only where the source license allows). Use CC BY-NC to match the 80K data.

**6. Budget**
- ~2,000 items × 3 annotators ≈ 6,000 judgments. At ~6 s/item that is ≈ 10 hours per annotator, plus pilot and adjudication. Volunteer co-authors or paid student annotators; record who and how paid (required by many journals).

**How it is used in experiments:** every final system (Phase 1–4) is evaluated on (a) the 80K test split and (b) NatBanglish-Emo. Transliteration CER can't be measured there (no gold Bengali), but downstream F1 can. If feasible, 200 items get a gold Bengali back-transliteration by one annotator, so transliterator CER on *natural* text can be reported too.

### Phase 1 — Fair baselines and script gap (RQ1) (weeks 2–3, GPU)
Same split, 3 seeds each, weighted F1 + macro F1 + per-class:
- TF-IDF+SVM/LR on Banglish; on Bengali
- XLM-R, mBERT, BanglishBERT, TB-encoder on Banglish
- BanglaBERT, XLM-R on Bengali (BanglaBERT-Bengali = upper reference)

### Phase 2 — Back-transliteration (RQ2) (weeks 3–4)
- Transliterate all 80K Banglish once with ≥2 systems (BanglaTLit baseline model; `Mdkaif2782/banglish-to-bangla`; optionally an LLM). Report CER/WER against gold Bengali.
- Train/test BanglaBERT on transliterated text; also train-gold/test-transliterated to show the mismatch.
- Noise curve: corrupt gold Bengali at controlled CER levels → F1 vs CER.

### Phase 3 — Fusion and ablations (RQ3) (weeks 4–6)
Rows (3 seeds for the rows that decide the story):

| Variant | Purpose |
|---|---|
| Dual-stream, oracle Bengali | upper bound (old result, honestly labeled) |
| Dual-stream, transliterated Bengali | **main realistic system** |
| − lexicon | does the NB vector help? |
| − normalizer | likely ~0 on this data; report honestly |
| CE+class weights instead of focal | focal needed? |
| Ensemble of two Banglish encoders (same params) | is gain just capacity? |
| Late fusion (average logits) vs concat vs cross-attention | fusion design |

Significance: paired bootstrap (or Almost Stochastic Order) between the main system and the best single model.

### Phase 4 — Robustness and LLMs (RQ4, RQ5) (weeks 6–7)
- Rule-based romanization perturbations at 3 strengths; evaluate all Banglish systems.
- LLMs on a stratified 1–2K test sample: one open-weight model (e.g., Qwen/Llama/Gemma class) + one API model; zero-shot and 3-shot; Banglish / Bengali / both. Fix prompts, temperature 0, report cost.

### Phase 5 — Analysis and writing (weeks 8–10)
- Error analysis: confusion pairs (anger↔sadness↔disgust), examples where Stream B fixes Stream A and vice versa, calibration.
- EmoNoBa: either remove it, or keep it as an "in-domain check on EmoNoBa-origin texts" with documented label rules + macro-F1 (friend's Options A/B).
- Rewrite: data description (hand-romanized, sources, no Facebook), all wording fixes, 40–60 verified references, limitations, ethics, CC BY-NC compliance, code + split release.

### Rough compute budget
A dual-encoder epoch on 64K rows took most of an hour on a T4, so expect roughly **60–100 GPU-hours** total. That's realistic on Kaggle (free weekly GPU quota) plus Colab, or faster on one rented A100/L4. Seeds should go to the decisive rows first.

---

## 4. Decision gates (after Phase 1–3)

1. **Fusion (realistic) > best Banglish-only model, significantly** → headline: "back-transliteration + dual-script fusion helps romanized input"; script-gap and robustness as support.
2. **Fusion ≈ best single model** → headline becomes the controlled script study (RQ1/2/4/5). Fusion is reported as a negative result with analysis. This is still publishable and arguably more useful.
3. **BanglaBERT-on-transliterated ≥ fusion** → recommend the simpler pipeline and analyze when transliteration quality is enough.

---

## 5. Open decisions for us

- **Data rule — DECIDED (2026-11-24):** train only on the Faisal dataset; add a natural-Banglish **test-only** set (Phase 0b). Optional extra check: EmoMix-3L (natural code-mixed, label-mapped, test-only).
- **Natural set sources:** confirm licenses of BanglaTLit and BanTH texts; decide whether fresh YouTube collection is needed.
- **Annotators:** who (co-authors / paid students), and whether ethics review is required.
- **Target journal.** Shortlist after results. Candidates to check in SJR/JCR for current quartile and scope: *Information Processing & Management*, *Expert Systems with Applications*, *Knowledge-Based Systems*, *Computer Speech & Language*, *Language Resources and Evaluation*, *ACM TALLIP*, *Natural Language Processing Journal*. An analysis-style paper fits CSL/LRE/TALLIP better; a method-headline paper fits ESWA/KBS.
- **Authorship / AI-use disclosure** per the chosen journal's policy.

---

## 6. Key references to read and cite (verify each before citing)

- Faisal et al. (2024), *Data in Brief* 55:110760 — the dataset. doi:10.1016/j.dib.2024.110760
- Fahim et al. (2024), BanglaTLit, Findings of EMNLP — back-transliteration + TB-encoders. aclanthology.org/2024.findings-emnlp.859
- Haider et al. (2025), BanTH, Findings of NAACL — transliterated Bangla hate speech; TB-encoders; translation-based LLM prompting. aclanthology.org/2025.findings-naacl.403
- Pahari & Shimada (2024), "Share What You Already Know", arXiv 2402.04542 — cross-script dual encoder (closest method prior art).
- Jawad et al. (2026), 5-Dialects-BN, arXiv 2609.09964 (EMNLP 2026) — romanization degrades LLMs.
- "Detecting Emotions Using Transformer-based Models in Transliterated Bangla (Banglish) Text" (2025) — same dataset, XLM-R 65.54%.
- Islam et al. (2022), EmoNoBa (AACL-IJCNLP); SentNoB (EMNLP Findings 2021); BnSentMix (LoResLM 2025); EmoMix-3L (WILDRE 2024); MONOVAB (arXiv 2309.15670); BanglaBERT (Findings of NAACL 2022).
- Hasan et al. (LREC-COLING 2024) — fine-tuned BanglaBERT vs zero/few-shot LLMs on Bangla sentiment.
