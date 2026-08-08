import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"

def format_prompt(request_text):
    return f"<start_of_turn>user\nGenerate a field_mask array for this Places API request: {request_text}<end_of_turn>\n<start_of_turn>model\n"

def parse_field_mask(raw_output: str) -> list[str]:
    """Parse JSON field_mask from model generation output."""
    try:
        data = json.loads(raw_output)
        if isinstance(data, dict) and "field_mask" in data:
            return data["field_mask"]
    except json.JSONDecodeError:
        pass
    # Fallback substring extraction for json block
    start = raw_output.find("{")
    end = raw_output.rfind("}")
    if start != -1 and end != -1 and start < end:
        try:
            data = json.loads(raw_output[start:end+1])
            if isinstance(data, dict) and "field_mask" in data:
                return data["field_mask"]
        except json.JSONDecodeError:
            pass
    return []

def main():
    print("Loading evaluation cases...")
    with open(DATASET_PATH, "r") as f:
        dataset = json.load(f)
    
    cases = [c for c in dataset.get("cases", []) if c["category"] in ["normal", "prompt_injection"]]
    print(f"Found {len(cases)} cases.")
    
    has_uvx = shutil.which("uvx") is not None
    adapters_exist = (ROOT / "adapters").exists()
    
    if not has_uvx:
        print("\nNote: 'uvx' command not found. To run live inference with MLX:")
        print("  pip install uv")
        print("  python evals/field-mask/test_mlx.py\n")

    results_summary = {
        "gemma-4-E4B-it Base": {"exact_match": 0, "total": len(cases), "failed": 0},
        "gemma-4-E4B-it +SFT": {"exact_match": 0, "total": len(cases), "failed": 0, "adapters_found": adapters_exist},
        "gemma-4-12B-it Base": {"exact_match": 0, "total": len(cases), "failed": 0}
    }
    
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
        
        cmd_sft = [
            "uvx", "--from", "mlx-lm", "mlx_lm.generate", 
            "--model", "google/gemma-4-E4B-it",
            "--adapter-path", str(ROOT / "adapters"),
            "--max-tokens", "50",
            "--prompt", prompt
        ]
        
        cmd_base_12b = [
            "uvx", "--from", "mlx-lm", "mlx_lm.generate", 
            "--model", "google/gemma-4-12B-it", 
            "--max-tokens", "50",
            "--prompt", prompt
        ]
        
        models_to_test = [("gemma-4-E4B-it Base", cmd_base)]
        if adapters_exist:
            models_to_test.append(("gemma-4-E4B-it +SFT", cmd_sft))
        models_to_test.append(("gemma-4-12B-it Base", cmd_base_12b))
        
        for model_key, cmd in models_to_test:
            if not has_uvx:
                results_summary[model_key]["failed"] += 1
                continue
                
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                if proc.returncode == 0 and proc.stdout:
                    predicted = parse_field_mask(proc.stdout.strip())
                    if sorted(predicted) == sorted(expected_mask):
                        results_summary[model_key]["exact_match"] += 1
                else:
                    results_summary[model_key]["failed"] += 1
            except (subprocess.SubprocessError, FileNotFoundError):
                results_summary[model_key]["failed"] += 1

    print("\nEvaluation Results Summary:")
    print(json.dumps(results_summary, indent=2))

if __name__ == "__main__":
    main()
