import os
import json
import time
import sys
from google.cloud import aiplatform
from google.cloud import aiplatform_v1

PROJECT = os.environ.get("GCP_PROJECT", "geojson-bq-blog")
LOCATION = os.environ.get("GCP_REGION", "us-central1")
ENDPOINT_ID = os.environ.get("VERTEX_ENDPOINT_ID", "")
EVAL_PROMPTS_FILE = "experiment/voice-ft/eval/prompts.jsonl"
OUTPUT_DIR = "experiment/voice-ft/eval/results"

def log(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

os.makedirs(f"{OUTPUT_DIR}/base-model", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/finetuned", exist_ok=True)
os.makedirs(f"{OUTPUT_DIR}/judgments", exist_ok=True)

aiplatform.init(project=PROJECT, location=LOCATION)

log(f"Target Endpoint: {ENDPOINT_ID}")

endpoint = aiplatform.Endpoint(ENDPOINT_ID)
log(f"Connected to live endpoint: {endpoint.resource_name}")
log(f"Deployed models: {[dm.display_name for dm in endpoint.list_models()]}")

# Read eval prompts
with open(EVAL_PROMPTS_FILE) as f:
    prompts = [json.loads(line) for line in f if line.strip()]

log(f"Loaded {len(prompts)} held-out evaluation prompts. Running inference...")

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing. Lead with the result, then what shipped, "
    "then the lesson. Conversational but evidence-led. Use contractions. No em-dashes. No passive voice "
    "for your own work. When editing, preserve the author's intent while shifting register and structure "
    "to match Ryan's patterns. When drafting from scratch, open with a real scenario or quoted objection, "
    "not a thesis statement."
)

# Run predictions on fine-tuned model
results = []
for i, item in enumerate(prompts):
    messages = item.get("messages", [])
    if messages:
        user_msg = messages[-1]["content"]
    else:
        user_msg = str(item)

    formatted_prompt = (
        f"<start_of_turn>system\n{SYSTEM_PROMPT}<end_of_turn>\n"
        f"<start_of_turn>user\n{user_msg}<end_of_turn>\n"
        f"<start_of_turn>model\n"
    )

    log(f"Running Eval {i+1}/{len(prompts)}: {user_msg[:60]}...")
    try:
        resp = endpoint.predict(instances=[{
            "prompt": formatted_prompt,
            "max_tokens": 1024,
            "temperature": 0.7
        }])
        raw_pred = resp.predictions[0] if resp.predictions else ""
        if isinstance(raw_pred, dict) and "text" in raw_pred:
            output_text = raw_pred["text"]
        elif isinstance(raw_pred, str):
            output_text = raw_pred
        else:
            output_text = str(raw_pred)
        
        if output_text.startswith(formatted_prompt):
            output_text = output_text[len(formatted_prompt):].strip()
    except Exception as e:
        log(f"Error during prediction {i+1}: {e}")
        output_text = f"Error during prediction: {e}"

    res_obj = {
        "eval_id": i + 1,
        "prompt": user_msg,
        "raw_prompt_object": item,
        "finetuned_output": output_text
    }
    results.append(res_obj)

    with open(f"{OUTPUT_DIR}/finetuned/eval_{i+1:02d}.json", "w") as out_f:
        json.dump(res_obj, out_f, indent=2)

log("All fine-tuned evaluation predictions complete.")
log(f"ENDPOINT IS KEPT RUNNING for interactive testing: {ENDPOINT_ID}")

