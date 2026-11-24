# 2. Literature Review

## 2.1 Bangla emotion detection: datasets and models

Bangla emotion detection has moved from small, single-source corpora toward larger, multi-source resources. BEmoC (Das *et al.* [10]) is a good starting point: it holds 6,243 texts from social media, blogs, news portals and books, labelled with Ekman's six emotions (Cohen's kappa 0.91). XLM-R scored about 69.7% weighted F1 on its 625-text test set. MONOVAB (Banshal *et al.* [9]) takes a different route, collecting Facebook comments on news events with five multi-label emotion tags, where Bangla-BERT-Base reached 83.23% accuracy. EmoNoBa (Islam *et al.* [8]) offers 22,698 multi-label comments from three platforms, labelled with six Junto-wheel emotions. Its authors deliberately made the test set hard, and the best macro-F1 they report is 42.81 across six binary tasks. EmoBang (Maruf *et al.* [11]) widens the label set to eight categories, including sarcasm and disappointment, and reports accuracies above 92%, though the version we read does not state the dataset size or split.

The largest effort so far is Faisal *et al.* [1]. They merge EmoNoBa, UBMEC, MONOVAB and newly collected YouTube and Twitter comments into 80,098 texts with six Ekman labels, and they release the Bengali texts alongside hand-written Banglish versions. Still, these resources differ in label set, single- versus multi-label design, split and metric, so their scores cannot be ranked against one another (Table 1). What none of them settles is how emotion models behave when the input is Banglish.

## 2.2 Classical and neural methods

The evidence on classical versus neural models in Bangla is mixed. On EmoNoBa, TF-IDF n-gram SVMs beat both neural networks and a pre-trained Bangla-BERT [8]. Later work with larger transformers found the reverse: on the same test set, re-implemented baselines scored 64.28 (TF-IDF with logistic regression), 68.57 (CNN-BiLSTM) and 73.23 (XLM-R) weighted F1 [2]. On MONOVAB, multinomial Naive Bayes (82.64% accuracy) came close to BiLSTM (79.14%) and Bangla-BERT-Base (83.23%) [9].

The same pattern shows up for transliterated text. Ahmed *et al.* [7] report that TF-IDF and bag-of-words classifiers landed within about 3% of fine-tuned language models on six datasets, and Rahman *et al.* [12] found that an ANN reached 89.59% accuracy on Romanized Bangla sentiment, ahead of the transformers they compared. Many of these comparisons rest on small test sets and single runs. The Bangla datasets in Ahmed *et al.* [7], for instance, contain just 1,300 and 5,000 comments, and only one seed is reported. For that reason, we treat classical models as strong, cheap baselines rather than as inadequate ones.

## 2.3 Lexicon-augmented transformers

Researchers have tried pairing lexical resources with transformers on several tasks, including abusive-language detection and Dutch emotion detection. The gains range from marginal to clear (as summarised in [2]). The closest Bangla work is BEmoLexBERT (Kabir *et al.* [2]). The authors translate and expand NRC EmoLex into a lexicon of 5,336 entries over nine emotions, count the matches in each text, and concatenate that count vector with the transformer's [CLS] representation. The lexicon helped all six transformers they tested, improving weighted F1 by 0.76 to 2.42 points, and BanglaBERT-large reached 82.73% on EmoNoBa. Their lexicon is hand-curated and does not depend on training labels, and the paper does not report seeds or confidence intervals.

Our lexicon vector works differently. It is a six-dimensional probability vector produced by a Naive Bayes model trained on the labelled data, so it has to be generated out-of-fold to avoid leakage.

## 2.4 Romanized, transliterated and code-mixed Bangla

Romanized Bangla is messy. BanglaTLit (Fahim *et al.* [3]) shows how a single word can be romanized in several ways, and the authors build a 42.7k-pair back-transliteration dataset and a 245.7k-text pre-training corpus. Encoders pre-trained further on that corpus did better on romanized classification: on a 1,600/400 subset of the Banglish emotion data from Faisal *et al.* [1], TB-XLM-R reached 53.40 F1 compared with 41.15 for XLM-R. Back-transliteration is still lossy, though, and the best system in that study managed a BLEU of only about 36.

Other resources cover neighbouring tasks. BanTH (Haider *et al.* [4]) provides 37,350 transliterated YouTube comments for multi-label hate speech, where further pre-trained encoders performed best on the multi-label task. BnSentMix (Alam *et al.* [5]) offers 20,000 Bengali-English code-mixed comments with four sentiment labels, with BERT reaching 69.5% accuracy. EmoMix-3L (Raihan *et al.* [6]) is a 1,071-instance test set for Bangla-English-Hindi emotion detection, built from student-written posts. Rahman *et al.* [12] compare Bangla, Romanized Bangla and a combined sentiment dataset, and XLM-R does worse on the combined data (85.81%) than on Bangla alone (89.46%).

Two points from this work matter for ours. First, several of these datasets are constructed rather than naturally written, and the Banglish text in Faisal *et al.* [1] is one of them. Second, none of these studies feeds Banglish and Bengali into two parallel encoders for emotion classification.

## 2.5 Large language models as baselines (partial)

Results for prompted LLMs are inconsistent. In BanglaTLit [3], GPT-3.5 scored 37.24 F1 on the Banglish emotion subset, well below the fine-tuned encoders (up to 53.40). In BanTH [4], GPT-4o with few-shot prompting reached 39.53 macro-F1 on multi-label classification, beating the best fine-tuned encoder (30.17), but it fell behind on binary classification (70.05 versus 77.35). On EmoMix-3L [6], zero-shot GPT-3.5 scored 0.51, close to MuRIL at 0.54. And in Ahmed *et al.* [7], zero-shot ChatGPT was the best system on Bangla sentiment but the worst on Hinglish hate speech.

We leave out the "zero-shot LLM" results from EmoBang [11], because they use encoder models (BanglaBERT, XLM-R) and the paper does not explain how any prompting works.

## 2.6 Research gap (draft)

Prior work falls into three groups. Some builds Bangla emotion models on Bengali-script text [2], [8], [10]. Some studies romanized or code-mixed Bangla, but for sentiment, offence or hate speech [3], [4], [5]. And one releases the Bengali and Banglish emotion dataset with Banglish-only baselines [1]. Among the papers we reviewed, none evaluates a model that reads Banglish and Bengali in parallel on the full six-emotion dataset.

We study exactly that: a dual-stream model with a leakage-free lexicon vector, evaluated over multiple seeds, in two settings. The oracle setting uses gold Bengali, and the realistic setting uses Bengali produced by a transliterator.

---

**Table 1.** Summary of related work on Bangla and Banglish emotion/sentiment detection.

| # | Paper (year) | Task / script | Data | Labels | Best result (metric) | Romanized? | LLM baseline? | Released |
|---|---|---|---|---|---|---|---|---|
| 1 | Faisal *et al.* (2024) | Emotion; Bengali + Banglish | 80,098 | 6 (Ekman) | BanglaBERT 71.30 (Bengali), 64.59 (Banglish), weighted F1 | Yes, hand-written | No | Yes |
| 2 | Kabir *et al.* (2023) | Emotion, multi-label; Bengali | EmoNoBa: 20,468 train, 2,272 test | 6 + 9-emotion lexicon | 82.73 weighted F1 | No | No | Lexicon |
| 3 | Fahim *et al.* (2024) | Back-transliteration + 3 tasks | 42.7k pairs; TB-Emotion subset 1,600/400 | Emotion: 6 | TB-XLM-R 53.40 F1 (TB-Emotion); GPT-3.5 0-shot 37.24 | Yes | Yes | Yes |
| 4 | Haider *et al.* (2025) | Hate speech, transliterated | 37,350 YouTube | Hate + 7 groups | XLM-R 77.35 macro-F1 (binary); TB-BERT 30.17 (multi-label) | Yes | Yes | Yes |
| 5 | Alam *et al.* (2024) | Sentiment; code-mixed | 20,000 | 4 | BERT 69.5 acc / 68.8 F1 | Yes | No | Yes |
| 6 | Raihan *et al.* (2024) | Emotion; Bn-En-Hi | 1,071 (test only) | 5 | MuRIL 0.54 weighted F1; GPT-3.5 0.51 | Yes | Yes | Yes |
| 7 | Ahmed *et al.* (2024) | Sentiment, offense; 3 languages | Bangla: 1,300 and 5,000 | 2 | ChatGPT 85.38 macro-F1 (Bangla sentiment) | Yes | Yes | n/r |
| 8 | Islam *et al.* (2022) | Emotion, multi-label; Bangla script | 22,698 | 6 (Junto) | 42.81 macro-F1 of binary tasks (SVM n-grams) | No | No | Yes |
| 9 | Banshal *et al.* (preprint) | Emotion, multi-label; Bangla script | 108,950 cleaned; annotated size n/r | 5 | Bangla-BERT-Base 83.23 accuracy | No | No | Code |
| 10 | Das *et al.* (2021) | Emotion; Bangla script | 6,243 | 6 (Ekman) | XLM-R 69.73 (abstract) / 69.61 (table) weighted F1 | No | No | Yes |
| 11 | Maruf *et al.* (preprint) | Emotion; Bangla script | n/r | 8 | 93.69 accuracy | No | "Zero/few-shot" with encoders only | n/r |
| 12 | Rahman *et al.* (2024) | Sentiment; Bangla + Romanized | 3,178 / 3,090 / 6,268 | 3 | XLM-R 89.46 (Bangla); ANN 89.59 (Romanized), accuracy | Yes | No | n/r |
| | **Ours** | **Emotion; Banglish + Bengali** | **80K (Faisal *et al.*)** | **6 (Ekman)** | **69.5 weighted F1 (oracle, own split, 1 run)** | **Via gold Bengali** | **Not yet** | **Not yet** |

*Note: Scores come from different datasets, splits and metrics, so they are not ranked. n/r = not reported. Ours uses the same data as #1 but a different split.*
