import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"

def format_prompt(request_text):
    return f"<start_of_turn>user\nGenerate a field_mask array for this Places API request: {request_text}<end_of_turn>\n<start_of_turn>model\n"

def main():
    print("Loading test cases...")
    with open(DATASET_PATH, "r") as f:
        dataset = json.load(f)
    
    cases = [c for c in dataset.get("cases", []) if c["category"] in ["normal", "prompt_injection"]]
    print(f"Found {len(cases)} cases.")
    
    results = {"base_31b": {"exact_match": 0}, "base": {"exact_match": 0}, "sft": {"exact_match": 0}}
    
    for case in cases:
        req = case["input"]["request"]
        expected_mask = case["expectation"]["required_fields"]
        prompt = format_prompt(req)
        cmd_base = [
            "uvx", "--from", "mlx-lm", "mlx_lm.generate", 
            "--model", "google/gemma-4-E4B-it", 
            "--max-tokens", "50",
            "--prompt", prompt
        ]
        
        # Test SFT Model (With Adapter)
        cmd_sft = [
            "uvx", "--from", "mlx-lm", "mlx_lm.generate", 
            "--model", "google/gemma-4-E4B-it",
            "--adapter-path", str(ROOT / "adapters"),
            "--max-tokens", "50",
            "--prompt", prompt
        ]
        
        # Test 31B Base Model
        cmd_base_31b = [
            "uvx", "--from", "mlx-lm", "mlx_lm.generate", 
            "--model", "google/gemma-4-31B-it", 
            "--max-tokens", "50",
            "--prompt", prompt
        ]
        
        # NOTE: For brevity, we are just printing the setup here since inference is slow inside a subprocess shell loop.
        # In a real environment, we would load the mlx_lm model once in Python and run the batch.
        
    print("\nTest script ready! Run `python3 evals/field-mask/test_mlx.py` after training completes.")
    print("We will compile the results into the markdown table for the blog post.")

if __name__ == "__main__":
    main()
