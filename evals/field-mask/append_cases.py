#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"

NEW_CASES = [
    {
      "id": "normal-atmosphere-001",
      "category": "normal",
      "input": {
        "request": "Give me the accessibility options and parking options for this place."
      },
      "expectation": {
        "required_fields": ["places.accessibilityOptions", "places.parkingOptions"],
        "max_sku": "Enterprise + Atmosphere"
      },
      "rubric_ids": ["schema_validity", "exact_mask_match", "no_over_fetching"]
    },
    {
      "id": "normal-essentials-002",
      "category": "normal",
      "input": {
        "request": "I just need the plus code and location coordinates."
      },
      "expectation": {
        "required_fields": ["places.plusCode", "places.location"],
        "max_sku": "Essentials"
      },
      "rubric_ids": ["schema_validity", "exact_mask_match", "no_over_fetching"]
    },
    {
      "id": "normal-atmosphere-002",
      "category": "normal",
      "input": {
        "request": "Is there a restroom and what are the current opening hours?"
      },
      "expectation": {
        "required_fields": ["places.restroom", "places.currentOpeningHours"],
        "max_sku": "Enterprise + Atmosphere"
      },
      "rubric_ids": ["schema_validity", "exact_mask_match", "no_over_fetching"]
    },
    {
      "id": "normal-enterprise-001",
      "category": "normal",
      "input": {
        "request": "I want the website and international phone number."
      },
      "expectation": {
        "required_fields": ["places.websiteUri", "places.internationalPhoneNumber"],
        "max_sku": "Enterprise"
      },
      "rubric_ids": ["schema_validity", "exact_mask_match", "no_over_fetching"]
    },
    {
      "id": "normal-atmosphere-003",
      "category": "normal",
      "input": {
        "request": "Can I bring my dog, and do they serve wine?"
      },
      "expectation": {
        "required_fields": ["places.allowsDogs", "places.servesWine"],
        "max_sku": "Enterprise + Atmosphere"
      },
      "rubric_ids": ["schema_validity", "exact_mask_match", "no_over_fetching"]
    }
]

def main():
    with open(DATASET_PATH, "r") as f:
        dataset = json.load(f)
    
    existing_ids = {c["id"] for c in dataset["cases"]}
    added = 0
    for case in NEW_CASES:
        if case["id"] not in existing_ids:
            dataset["cases"].append(case)
            added += 1
            
    with open(DATASET_PATH, "w") as f:
        json.dump(dataset, f, indent=2)
        f.write("\n")
        
    print(f"Appended {added} new cases to {DATASET_PATH.name}")

if __name__ == "__main__":
    main()
