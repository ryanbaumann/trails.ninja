import json
import os
from pathlib import Path

# In a real environment, you'd import:
# from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments
# from trl import SFTTrainer
# from datasets import Dataset

ROOT = Path(__file__).resolve().parent
DATASET_PATH = ROOT / "dataset.v1.json"

def format_prompt(request_text, field_mask):
    """
    Format the training examples for Gemma 4.
    Instruction: Generate the Google Maps Places API (New) field mask for the request.
    """
    prompt = f"<start_of_turn>user\nGenerate a field_mask array for this Places API request: {request_text}<end_of_turn>\n"
    prompt += f"<start_of_turn>model\n{json.dumps({'field_mask': field_mask})}<end_of_turn>"
    return prompt

def main():
    print("Starting Gemma 4 TRL Fine-tuning...")
    print("Loading synthetic dataset...")
    
    with open(DATASET_PATH, "r") as f:
        dataset_json = json.load(f)
    
    training_data = []
    for case in dataset_json.get("cases", []):
        if case.get("split") == "train" and case["category"] in ["normal", "prompt_injection"]:
            req = case["input"]["request"]
            mask = case["expectation"]["required_fields"]
            training_data.append({"text": format_prompt(req, mask)})
            
    print(f"Loaded {len(training_data)} training split examples.")
    
    # Save training dataset file for TRL / SFTTrainer
    train_out = ROOT / "train.jsonl"
    with open(train_out, "w") as f_out:
        for item in training_data:
            f_out.write(json.dumps(item) + "\n")
            
    print(f"Prepared training dataset at {train_out.name}")
    print("To execute fine-tuning using HuggingFace TRL / SFTTrainer:")
    print("  python evals/field-mask/train.py --run")

if __name__ == "__main__":
    main()
