"""Trainable intent classification with a separate, human-labelled validation set."""
import hashlib
import json
import unicodedata
from collections import Counter

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.pipeline import Pipeline


def normalize_text(text):
    text = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return " ".join("".join(c for c in text if unicodedata.category(c) != "Mn").split())


def dataset_hash(rows):
    values = sorted((normalize_text(row["text"]), row["intent"], row["purpose"]) for row in rows)
    return hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()


def fit_classifier(intents, examples):
    labels = {item["key"] for item in intents if item.get("enabled", True)}
    rows = [row for row in examples if row.get("approved") and row["intent"] in labels]
    if len(labels) < 2:
        raise ValueError("Cần ít nhất 2 intent đang bật để huấn luyện.")
    seen = {}
    for row in rows:
        key = normalize_text(row["text"])
        if not key:
            raise ValueError("Câu mẫu không được để trống.")
        if key in seen:
            raise ValueError("Có câu mẫu trùng hoặc xuất hiện ở cả tập học và tập kiểm tra.")
        seen[key] = row
    train = [row for row in rows if row["purpose"] == "train"]
    validation = [row for row in rows if row["purpose"] == "validation"]
    train_counts = Counter(row["intent"] for row in train)
    test_counts = Counter(row["intent"] for row in validation)
    insufficient = [label for label in sorted(labels) if train_counts[label] < 3 or test_counts[label] < 2]
    if insufficient:
        raise ValueError("Mỗi intent cần ít nhất 3 câu học và 2 câu kiểm tra đã duyệt: " + ", ".join(insufficient))
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(preprocessor=normalize_text, analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True, max_features=30000)),
        ("classifier", LogisticRegression(C=12, max_iter=1000, class_weight="balanced", random_state=42)),
    ])
    pipeline.fit([row["text"] for row in train], [row["intent"] for row in train])
    actual = [row["intent"] for row in validation]
    predicted = pipeline.predict([row["text"] for row in validation])
    report = classification_report(actual, predicted, labels=sorted(labels), output_dict=True, zero_division=0)
    metrics = {
        "accuracy": float(accuracy_score(actual, predicted)),
        "macroF1": float(f1_score(actual, predicted, average="macro", zero_division=0)),
        "trainingSamples": len(train), "validationSamples": len(validation),
        "perIntent": [{"intent": label, **report[label]} for label in sorted(labels)],
        "mistakes": [{"text": row["text"], "actual": row["intent"], "predicted": str(guess)} for row, guess in zip(validation, predicted) if row["intent"] != guess],
    }
    return {
        "pipeline": pipeline, "intents": {item["key"]: item for item in intents if item["key"] in labels},
        "metrics": metrics, "datasetHash": dataset_hash(rows), "validationHash": dataset_hash(validation),
        "sampleIds": [str(row.get("_id", "")) for row in rows],
    }


def predict_intent(artifact, text, threshold=0.4):
    vector = artifact["pipeline"].named_steps["tfidf"].transform([text])
    if vector.nnz == 0:
        return {"intent": "general", "confidence": 0.0}
    probabilities = artifact["pipeline"].named_steps["classifier"].predict_proba(vector)[0]
    best = int(probabilities.argmax())
    confidence = float(probabilities[best])
    label = str(artifact["pipeline"].named_steps["classifier"].classes_[best])
    return {"intent": label if confidence >= threshold else "general", "confidence": confidence}
