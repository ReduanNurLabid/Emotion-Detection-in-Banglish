# Literature index

Full texts (PDF + extracted Markdown) in `papers/`. Numbering matches the references in `paper/v2/sections/02_literature_review.md`.

| # | Paper | Notes for our study |
|---|---|---|
| 1 | Faisal et al. (2024), Bengali & Banglish dataset, *Data in Brief* 55:110760 | Our data. §4.4: Banglish written manually by the 3 annotators, then a validator **standardized** spelling. Existing sources contribute only 1,805 fear rows (Table 2); final set has 7,565. |
| 2 | Kabir et al. (2023), BEmoLexBERT | Lexicon + transformer on EmoNoBa. |
| 3 | Fahim et al. (2024), BanglaTLit, Findings of EMNLP | **BanglaTLit-PT includes 79,197 "TB-Emotion" texts = the Faisal Banglish data.** TB-encoders were further pre-trained on our test texts (MLM, no labels): contamination for any TB-encoder baseline. |
| 4 | Haider et al. (2025), BanTH, Findings of NAACL | Transliterated hate speech; TB-encoders; LLM prompting. |
| 5 | Alam et al. (2024/25), BnSentMix | Code-mixed sentiment. |
| 6 | Raihan et al. (2024), EmoMix-3L | Bn-En-Hi emotion, test-only, student-written. |
| 7 | Ahmed et al. (2024), ECAI | Classical vs LMs vs ChatGPT on transliterated text. |
| 8 | Islam et al. (2022), EmoNoBa, AACL-IJCNLP | Inside our training data. |
| 9 | Banshal et al., MONOVAB (preprint) | Inside our training data. |
| 10 | Das et al. (2021), BEmoC | Bangla-script emotion. |
| 11 | Maruf et al., EmoBang (preprint) | 8-class Bangla emotion. |
| 12 | Rahman et al. (2024), IEEE Access | Bangla vs Romanized sentiment. |
