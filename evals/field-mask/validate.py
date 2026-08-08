#!/usr/bin/env python3
"""Read-only structural validation for field mask eval assets."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"
RUBRICS_PATH = ROOT / "rubrics.v1.json"

REQUIRED_CATEGORIES = {
    "normal",
    "ambiguous",
    "irrelevant",
    "prompt_injection",
}
REQUIRED_SPLITS = {"train", "test"}
CASE_FIELDS = {"id", "category", "split", "input", "expectation", "rubric_ids"}
INPUT_FIELDS = {"request"}
EXPECTATION_FIELDS = {"required_fields", "max_sku"}


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError(f"{path.name}: root must be an object")
    return value


def validate() -> list[str]:
    errors: list[str] = []
    dataset = load_json(DATASET_PATH)
    rubric_file = load_json(RUBRICS_PATH)

    if dataset.get("schema_version") != "field-mask.dataset.v1":
        errors.append("dataset: unexpected schema_version")
    if rubric_file.get("schema_version") != "field-mask.rubrics.v1":
        errors.append("rubrics: unexpected schema_version")

    rubrics = rubric_file.get("rubrics", [])
    rubric_ids = [rubric.get("id") for rubric in rubrics if isinstance(rubric, dict)]
    known_rubrics = set(rubric_ids)
    if len(known_rubrics) != len(rubric_ids):
        errors.append("rubrics: ids must be unique")

    cases = dataset.get("cases", [])
    if not isinstance(cases, list) or not cases:
        errors.append("dataset: cases must be a non-empty array")
        cases = []
    case_ids: set[str] = set()
    counts: Counter[str] = Counter()

    for index, case in enumerate(cases):
        label = f"case[{index}]"
        if not isinstance(case, dict):
            errors.append(f"{label}: must be an object")
            continue
        if set(case) != CASE_FIELDS:
            errors.append(f"{label}: fields must be exactly {sorted(CASE_FIELDS)}")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id:
            errors.append(f"{label}: id must be a non-empty string")
        elif case_id in case_ids:
            errors.append(f"{label}: duplicate id {case_id}")
        else:
            case_ids.add(case_id)
            label = case_id

        category = case.get("category")
        if category not in REQUIRED_CATEGORIES:
            errors.append(f"{label}: unknown category {category!r}")
        else:
            counts[category] += 1

        split = case.get("split")
        if split not in REQUIRED_SPLITS:
            errors.append(f"{label}: unknown split {split!r}")

        case_input = case.get("input")
        if not isinstance(case_input, dict) or set(case_input) != INPUT_FIELDS:
            errors.append(f"{label}: input fields must be exactly {sorted(INPUT_FIELDS)}")
        
        expectation = case.get("expectation")
        if not isinstance(expectation, dict) or set(expectation) != EXPECTATION_FIELDS:
            errors.append(f"{label}: expectation fields must be exactly {sorted(EXPECTATION_FIELDS)}")

        applied_rubrics = case.get("rubric_ids")
        if not isinstance(applied_rubrics, list) or not applied_rubrics:
            errors.append(f"{label}: rubric_ids must be a non-empty array")
        else:
            unknown = set(applied_rubrics) - known_rubrics
            if unknown:
                errors.append(f"{label}: unknown rubric ids {sorted(unknown)}")
            for required in ("schema_validity", "exact_mask_match", "no_over_fetching"):
                if required not in applied_rubrics:
                    errors.append(f"{label}: missing required rubric {required}")

    print(f"Validated {len(cases)} cases across {len(counts)} categories.")
    for category in sorted(counts):
        print(f"  {category}: {counts[category]}")
    print("Field mask eval assets are valid.")
    return errors


def main() -> int:
    try:
        errors = validate()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
