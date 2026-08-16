"""Load the held-out suite, fill in per-task defaults, and prove it is held out.

A held-out set that shares phrasing with the training data measures memorisation. The
dataset here is generated from the same corpus the model writes about, so the leakage
check is not a formality.
"""

import json
import os
from pathlib import Path

from . import text as T

ROOT = Path(__file__).resolve().parent.parent.parent
EVAL_DIR = ROOT / "experiment" / "voice-ft" / "eval"
DEFAULT_SUITE = EVAL_DIR / "heldout.jsonl"
TRAINING_DIR = ROOT / "experiment" / "voice-ft" / "training"

TASKS = ("Edit", "Critique", "Headline", "Draft", "Present", "OOD")

# Thresholds are defaults, not law. Any item can override any key, and several do,
# because "rewrite this whole paragraph" and "fix this one line" are not the same job.
DEFAULTS = {
    "_all": {
        "max_echo_tokens": 25,
        "repeat_ngram": 8,
        "max_ngram_repeat": 1,
        "min_distinct_3": 0.55,
        "require_complete": True,
        "no_new_numbers": True,
        "citation_policy": "any",
        "max_tokens": 1024,
    },
    "Edit": {
        "min_change": 0.35,
        "min_preserve": 0.35,
        "max_verbatim_span_ratio": 0.45,
        "max_echo_tokens": 12,
        "max_words": 300,
        "max_tokens": 512,
    },
    "Critique": {
        # A critique quotes a phrase. Round four quoted the whole opening back under
        # "here is how I would rewrite it", which was fourteen tokens long.
        "max_echo_tokens": 12,
        "min_words": 40,
        "max_words": 450,
        "max_tokens": 800,
    },
    "Headline": {
        "headline_check": True,
        "min_variants": 6,
        "max_variant_similarity": 0.7,
        "max_headline_prompt_span": 5,
        "max_headline_words": 14,
        "max_words": 250,
        "no_new_numbers": False,
        "require_complete": False,
        "max_tokens": 512,
    },
    "Draft": {
        "min_words": 120,
        "max_words": 800,
        "max_tokens": 1024,
    },
    "Present": {
        "min_words": 100,
        "max_words": 700,
        "no_new_numbers": False,
        "max_tokens": 1024,
    },
    "OOD": {
        "min_words": 80,
        "max_words": 600,
        "max_tokens": 768,
    },
}


def resolve_checks(item):
    """Merge global defaults, task defaults, and the item's own overrides."""
    checks = dict(DEFAULTS["_all"])
    checks.update(DEFAULTS.get(item.get("task", ""), {}))
    checks.update(item.get("checks") or {})
    return checks


def load_suite(path=None):
    """Read a suite file. Accepts the new schema and the original prompts.jsonl."""
    path = Path(path) if path else DEFAULT_SUITE
    items = []
    with open(path, "r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            try:
                raw = json.loads(line)
            except ValueError as error:
                raise ValueError("%s:%d is not valid JSON: %s" % (path, line_number, error))
            items.append(normalise_item(raw, "%s:%d" % (path.name, line_number)))
    if not items:
        raise ValueError("%s contains no items" % path)
    ids = [i["id"] for i in items]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise ValueError("duplicate ids in %s: %s" % (path, ", ".join(sorted(duplicates))))
    return items


def normalise_item(raw, where):
    """One shape for both schemas: instruction plus optional source_text."""
    item = dict(raw)
    if "id" not in item:
        raise ValueError("%s: item has no id" % where)
    if "task" not in item:
        raise ValueError("%s: %s has no task" % (where, item["id"]))
    if item["task"] not in TASKS:
        raise ValueError("%s: %s has unknown task %r (expected one of %s)"
                         % (where, item["id"], item["task"], ", ".join(TASKS)))
    if "instruction" not in item:
        # Original schema: a single `prompt` string with the source inlined.
        if "prompt" not in item:
            raise ValueError("%s: %s has neither instruction nor prompt" % (where, item["id"]))
        item["instruction"] = item["prompt"]
    item.setdefault("source_text", None)
    item["prompt"] = compose_prompt(item)
    return item


def compose_prompt(item):
    """The user turn the model sees."""
    if item.get("source_text"):
        return "%s\n\n%s" % (item["instruction"].strip(), item["source_text"].strip())
    return item["instruction"].strip()


# --------------------------------------------------------------------- leakage


def _training_texts(training_dir=None):
    directory = Path(training_dir) if training_dir else TRAINING_DIR
    texts = []
    if not directory.exists():
        return texts
    for name in ("train.jsonl", "valid.jsonl"):
        path = directory / name
        if not path.exists():
            continue
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                except ValueError:
                    continue
                for message in record.get("messages", []):
                    texts.append(message.get("content", ""))
                if "prompt" in record:
                    texts.append(record["prompt"])
                if "completion" in record:
                    texts.append(record["completion"])
                if "text" in record:
                    texts.append(record["text"])
    return texts


def check_leakage(items, training_dir=None, shingle=8, max_shared=0):
    """Shared word shingles between the held-out set and the training data.

    Returns a list of findings. Anything above `max_shared` distinct shared shingles
    for one item means that item is partly measuring recall.
    """
    training = _training_texts(training_dir)
    if not training:
        return [{
            "id": None,
            "severity": "warn",
            "message": "No training data found in %s. Run scripts/generate-ft-dataset.py "
                       "before trusting a held-out claim." % (training_dir or TRAINING_DIR),
            "shared": [],
        }]

    corpus = set()
    for chunk in training:
        corpus |= T.shingles(chunk, shingle)

    findings = []
    for item in items:
        probe = "%s %s" % (item.get("instruction") or "", item.get("source_text") or "")
        shared = sorted(T.shingles(probe, shingle) & corpus)
        if len(shared) > max_shared:
            findings.append({
                "id": item["id"],
                "severity": "error",
                "message": "%d %d-word shingle(s) also appear in training data" % (len(shared), shingle),
                "shared": shared[:5],
            })
    return findings


def coverage_report(items):
    """How many items per task, so a thin category is visible before the run."""
    counts = {}
    for item in items:
        counts[item["task"]] = counts.get(item["task"], 0) + 1
    return counts


def default_suite_path():
    return str(DEFAULT_SUITE if DEFAULT_SUITE.exists() else EVAL_DIR / "prompts.jsonl")


def results_dir():
    path = EVAL_DIR / "results"
    os.makedirs(str(path), exist_ok=True)
    return path
