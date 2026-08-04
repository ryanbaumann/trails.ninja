import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"
TRAIN_JSONL_PATH = ROOT / "train.jsonl"

def format_prompt(request_text, field_mask):
    prompt = f"<start_of_turn>user\nGenerate a field_mask array for this Places API request: {request_text}<end_of_turn>\n"
    prompt += f"<start_of_turn>model\n{json.dumps({'field_mask': field_mask})}<end_of_turn>"
    return prompt

def main():
    print("Parsing dataset for MLX...")
    with open(DATASET_PATH, "r") as f:
        dataset_json = json.load(f)
    
    # MLX expects a JSONL file with {"text": "..."} lines
    valid_cases = 0
    with open(TRAIN_JSONL_PATH, "w") as f_out:
        for case in dataset_json.get("cases", []):
            if case["category"] in ["normal", "prompt_injection"]:
                req = case["input"]["request"]
                mask = case["expectation"]["required_fields"]
                f_out.write(json.dumps({"text": format_prompt(req, mask)}) + "\n")
                valid_cases += 1
                
    print(f"Exported {valid_cases} cases to {TRAIN_JSONL_PATH.name}")
    print("\nTo start fine-tuning, run the following command in your terminal:")
    print(f"mlx_lm.lora --model google/gemma-4b --train --data {ROOT} --iters 100")

if __name__ == "__main__":
    main()
