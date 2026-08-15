#!/usr/bin/env python3
"""
Ryan Voice Assistant & Review Subagent (Fine-Tuned Gemma 4 26B-A4B)

A dedicated tool and subagent interface for:
- Spinning up/down the fine-tuned model on Vertex AI on-demand
- Reviewing and critiquing copy across this repository
- Rewriting, drafting, and headline generation in Ryan's authentic voice
"""

import sys
import os
import argparse
import time
from google.cloud import aiplatform

PROJECT = os.environ.get("GCP_PROJECT", "geojson-bq-blog")
LOCATION = os.environ.get("GCP_REGION", "us-central1")
TUNED_MODEL_NAME = os.environ.get("VERTEX_TUNED_MODEL", f"projects/{PROJECT}/locations/{LOCATION}/models/ryan-voice-gemma-4-26b-v1")
ENDPOINT_DISPLAY_NAME = "ryan-voice-endpoint"
MACHINE_TYPE = "a2-ultragpu-1g"
ACCELERATOR_TYPE = "NVIDIA_A100_80GB"

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing. Lead with the result, then what shipped, "
    "then the lesson. Conversational but evidence-led. Use contractions. No em-dashes. No passive voice "
    "for your own work. When editing, preserve the author's intent while shifting register and structure "
    "to match Ryan's patterns. When drafting from scratch, open with a real scenario or quoted objection, "
    "not a thesis statement."
)

def log(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def find_active_endpoint():
    """Find existing endpoint by display name."""
    aiplatform.init(project=PROJECT, location=LOCATION)
    endpoints = aiplatform.Endpoint.list(filter=f'display_name="{ENDPOINT_DISPLAY_NAME}"')
    if not endpoints:
        # Also check fallback display name
        endpoints = aiplatform.Endpoint.list(filter='display_name="ryan-voice-eval-ephemeral"')
    return endpoints[0] if endpoints else None

def spin_up_endpoint():
    """Spin up Vertex AI endpoint and deploy tuned model."""
    aiplatform.init(project=PROJECT, location=LOCATION)
    ep = find_active_endpoint()
    if ep:
        deployed = ep.list_models()
        if deployed:
            log(f"Endpoint already active: {ep.resource_name} (Deployed models: {len(deployed)})")
            return ep

    if not ep:
        log(f"Creating new endpoint '{ENDPOINT_DISPLAY_NAME}' in {LOCATION}...")
        ep = aiplatform.Endpoint.create(
            display_name=ENDPOINT_DISPLAY_NAME,
            project=PROJECT,
            location=LOCATION
        )
        log(f"Endpoint created: {ep.resource_name}")

    log(f"Deploying fine-tuned model ({TUNED_MODEL_NAME}) onto {MACHINE_TYPE} ({ACCELERATOR_TYPE})...")
    log("This typically takes ~10-12 minutes on Vertex AI.")
    model = aiplatform.Model(model_name=TUNED_MODEL_NAME)
    model.deploy(
        endpoint=ep,
        min_replica_count=1,
        max_replica_count=1,
        machine_type=MACHINE_TYPE,
        accelerator_type=ACCELERATOR_TYPE,
        accelerator_count=1,
    )
    log(f"Deployment complete! Model is live on {ep.resource_name}")
    return ep

def spin_down_endpoint():
    """Undeploy all models and delete endpoint to eliminate ongoing charges."""
    aiplatform.init(project=PROJECT, location=LOCATION)
    ep = find_active_endpoint()
    if not ep:
        log("No active Ryan Voice endpoint found. (Zero GPU charges).")
        return

    log(f"Undeploying models from {ep.resource_name}...")
    try:
        ep.undeploy_all()
    except Exception as e:
        log(f"Note during undeploy: {e}")

    log(f"Deleting endpoint {ep.resource_name}...")
    ep.delete()
    log("Endpoint successfully spun down and deleted! (Zero ongoing charges).")

def check_status():
    """Check if endpoint is currently running."""
    aiplatform.init(project=PROJECT, location=LOCATION)
    ep = find_active_endpoint()
    if not ep:
        print("Status: INACTIVE (Endpoint is spun down, 0 GPU cost)")
        return False
    deployed = ep.list_models()
    if not deployed:
        print(f"Status: ENDPOINT EXISTS ({ep.resource_name}) but no model is deployed.")
        return False
    print(f"Status: ACTIVE & READY")
    print(f"Endpoint: {ep.resource_name}")
    print(f"Deployed Model: {deployed[0].display_name} ({deployed[0].id})")
    return True

def generate(user_prompt: str, task_type: str = "Edit", temperature: float = 0.7, max_tokens: int = 1024, auto_up: bool = False) -> str:
    """Generate response from live model endpoint."""
    ep = find_active_endpoint()
    if not ep or not ep.list_models():
        if auto_up:
            log("Endpoint is offline. Auto-spinning up endpoint...")
            ep = spin_up_endpoint()
        else:
            raise RuntimeError(
                "Ryan Voice endpoint is currently offline. "
                "Run `python3 scripts/ryan_voice.py up` or pass `--auto-up` to spin it up."
            )

    if not user_prompt.strip().startswith("[Task:"):
        formatted_user_prompt = f"[Task: {task_type}]\n{user_prompt.strip()}"
    else:
        formatted_user_prompt = user_prompt.strip()

    formatted_prompt = (
        f"<start_of_turn>system\n{SYSTEM_PROMPT}<end_of_turn>\n"
        f"<start_of_turn>user\n{formatted_user_prompt}<end_of_turn>\n"
        f"<start_of_turn>model\n"
    )

    resp = ep.predict(instances=[{
        "prompt": formatted_prompt,
        "max_tokens": max_tokens,
        "temperature": temperature
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

    return output_text.strip()

def review_copy(content_or_path: str, **kwargs) -> str:
    """Review and critique copy in Ryan's voice against portfolio standards."""
    text = content_or_path
    if os.path.exists(content_or_path):
        with open(content_or_path, "r", encoding="utf-8") as f:
            text = f.read()

    prompt = (
        "Perform a thorough editorial review and critique of this copy against Ryan Baumann's voice standards.\n\n"
        "Assess:\n"
        "1. Voice & Cadence: Active first-person, direct, growth-backwards framing (Result -> Shipped -> Lesson).\n"
        "2. Cliché & AI-Tell Check: Scan for em-dashes, passive voice for own work, corporate buzzwords, and vague claims.\n"
        "3. Opening Hook: Does it land on real developer friction or a quoted objection?\n"
        "4. Concrete Line-by-Line Rewrites: Provide specific rewrites for the weakest sections.\n\n"
        f"--- COPY TO REVIEW ---\n{text}"
    )
    return generate(prompt, task_type="Critique", **kwargs)

def edit_text(content_or_path: str, **kwargs) -> str:
    """Rewrite text into Ryan's voice."""
    text = content_or_path
    if os.path.exists(content_or_path):
        with open(content_or_path, "r", encoding="utf-8") as f:
            text = f.read()
    prompt = f"Rewrite the following text in Ryan's voice, stripping corporate boilerplate, passive voice, and buzzwords:\n\n{text}"
    return generate(prompt, task_type="Edit", **kwargs)

def draft_content(topic: str, format_type: str = "Blog Post", **kwargs) -> str:
    """Draft a new piece in Ryan's voice."""
    prompt = f"[Format: {format_type}]\n{topic}"
    return generate(prompt, task_type="Draft", **kwargs)

def headline_variants(topic: str, **kwargs) -> str:
    """Generate thesis-first headline variants."""
    prompt = f"Generate 6-8 thesis-driven, misconception-first title variants for:\n\n{topic}"
    return generate(prompt, task_type="Headline", **kwargs)

def interactive():
    """Interactive REPL session."""
    if not check_status():
        choice = input("\nEndpoint is offline. Spin it up now? (y/n): ").strip().lower()
        if choice == 'y':
            spin_up_endpoint()
        else:
            print("Exiting.")
            return

    print("\n" + "=" * 60)
    print(" Ryan Voice Subagent (Gemma 4 26B-A4B Fine-Tuned)")
    print(" Commands: /review <file>, /task <edit|draft|critique|headline|present>, /down, /exit")
    print("=" * 60)

    current_task = "edit"
    while True:
        try:
            cmd = input(f"\n[{current_task.upper()}] Enter text/file (or /down, /exit): ").strip()
            if not cmd:
                continue
            if cmd.lower() in ("/exit", "exit", "quit"):
                break
            if cmd.lower() == "/down":
                spin_down_endpoint()
                break
            if cmd.startswith("/review "):
                target_path = cmd.split(" ", 1)[1].strip()
                print("\nReviewing copy...\n" + "-" * 40)
                print(review_copy(target_path))
                print("-" * 40)
                continue
            if cmd.startswith("/task "):
                new_task = cmd.split(" ", 1)[1].strip().lower()
                if new_task in ("edit", "draft", "critique", "headline", "present"):
                    current_task = new_task
                    print(f"Switched task to: {current_task.upper()}")
                else:
                    print("Unknown task. Choose: edit, draft, critique, headline, present")
                continue

            print("\nGenerating...\n" + "-" * 40)
            if current_task == "edit":
                res = edit_text(cmd)
            elif current_task == "critique":
                res = review_copy(cmd)
            elif current_task == "draft":
                res = draft_content(cmd)
            elif current_task == "headline":
                res = headline_variants(cmd)
            else:
                res = generate(cmd, task_type=current_task.capitalize())
            print(res)
            print("-" * 40)
        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {e}")

def main():
    parser = argparse.ArgumentParser(description="Ryan Voice Assistant & Review Subagent")
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Lifecycle commands
    subparsers.add_parser("up", help="Spin up Vertex AI endpoint on-demand")
    subparsers.add_parser("down", help="Spin down and delete Vertex AI endpoint")
    subparsers.add_parser("status", help="Check endpoint running status")

    # Review command
    review_parser = subparsers.add_parser("review", help="Review and critique copy in a file or string")
    review_parser.add_argument("target", help="File path or text string to review")
    review_parser.add_argument("--auto-up", action="store_true", help="Spin up endpoint if offline")

    # Edit command
    edit_parser = subparsers.add_parser("edit", help="Rewrite text or file in Ryan's voice")
    edit_parser.add_argument("target", help="Text or file path to rewrite")
    edit_parser.add_argument("--auto-up", action="store_true", help="Spin up endpoint if offline")

    # Draft command
    draft_parser = subparsers.add_parser("draft", help="Draft new content in Ryan's voice")
    draft_parser.add_argument("topic", help="Topic or prompt")
    draft_parser.add_argument("--format", default="Blog Post", help="Format type")
    draft_parser.add_argument("--auto-up", action="store_true", help="Spin up endpoint if offline")

    # Headline command
    hl_parser = subparsers.add_parser("headline", help="Brainstorm title variants")
    hl_parser.add_argument("topic", help="Topic to brainstorm")
    hl_parser.add_argument("--auto-up", action="store_true", help="Spin up endpoint if offline")

    # Interactive REPL
    subparsers.add_parser("interactive", help="Start interactive REPL session")

    args = parser.parse_args()

    if args.command == "up":
        spin_up_endpoint()
    elif args.command == "down":
        spin_down_endpoint()
    elif args.command == "status":
        check_status()
    elif args.command == "review":
        print(review_copy(args.target, auto_up=args.auto_up))
    elif args.command == "edit":
        print(edit_text(args.target, auto_up=args.auto_up))
    elif args.command == "draft":
        print(draft_content(args.topic, format_type=args.format, auto_up=args.auto_up))
    elif args.command == "headline":
        print(headline_variants(args.topic, auto_up=args.auto_up))
    elif args.command == "interactive" or len(sys.argv) == 1:
        interactive()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
