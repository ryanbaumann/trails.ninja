#!/usr/bin/env python3
"""
Generate Fine-Tuning Dataset for Ryan Baumann's Writing Voice (Gemma 4).

Extracts public writing, work case studies, and talk abstracts directly from
the repository's markdown content (portfolio/content/), synthesizing 5 core
task types:
1. Draft (cold generation with opening scenario hooks)
2. Edit / Rewrite (corporate/passive -> active first person)
3. Critique (editorial tone, structure, and cliché diagnosis)
4. Headline (thesis-first & misconception title variations)
5. Present (demo-first talk abstracts and outlines)
"""

import glob
import json
import os
import random
import re

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing. Lead with the result, then what shipped, "
    "then the lesson. Conversational but evidence-led. Use contractions. No em-dashes. No passive voice "
    "for your own work. When editing, preserve the author's intent while shifting register and structure "
    "to match Ryan's patterns. When drafting from scratch, open with a real scenario or quoted objection, "
    "not a thesis statement."
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(BASE_DIR, "portfolio", "content")
TRAINING_DIR = os.path.join(BASE_DIR, "experiment", "voice-ft", "training")

def parse_markdown_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        raw = f.read()

    meta = {}
    body = raw
    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            fm_text = parts[1]
            body = parts[2].strip()
            for line in fm_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    k = k.strip()
                    v = v.strip().strip("\"'")
                    meta[k] = v

    return {
        "title": meta.get("title", ""),
        "summary": meta.get("summary", ""),
        "body": body,
        "word_count": len(body.split()),
        "filepath": filepath
    }

def load_portfolio_content():
    items = []
    for ctype in ["writing", "work", "talks"]:
        cdir = os.path.join(CONTENT_DIR, ctype)
        if not os.path.isdir(cdir):
            continue
        for fp in glob.glob(os.path.join(cdir, "*.md")):
            parsed = parse_markdown_file(fp)
            parsed["content_type"] = ctype
            if parsed["word_count"] > 30 and parsed["title"]:
                items.append(parsed)
    return items

def make_ex(user_text, assistant_text, task_tag="Draft"):
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"[Task: {task_tag}]\n{user_text}"},
            {"role": "assistant", "content": assistant_text}
        ]
    }

def corporatize(text):
    c = text
    c = c.replace("I've ", "We have ").replace("I'd ", "We would ").replace("I'll ", "We will ")
    c = c.replace("don't", "do not").replace("doesn't", "does not").replace("can't", "cannot").replace("won't", "will not")
    c = c.replace("I ", "Our team ").replace(" my ", " our ").replace(" me ", " us ")
    c = re.sub(r'\b(built|shipped|wrote|led)\b', r'leveraged resources to deliver', c)
    c = c.replace(".", " — which represents a key milestone for our organization.")
    return c[:600]

def main():
    portfolio = load_portfolio_content()
    examples = []

    # 1. Process portfolio writing (long form)
    for item in portfolio:
        if item.get("content_type") == "writing" and item.get("word_count", 0) > 150:
            title = item["title"]
            body = item["body"]
            
            # Full Draft
            examples.append(make_ex(
                f"Write a Field Note titled '{title}' about the core tradeoffs and lessons learned.",
                body,
                task_tag="Draft"
            ))
            
            # Section-level Drafts
            sections = re.split(r'\n## ', body)
            for sec in sections[1:]:
                lines = sec.strip().split('\n')
                sec_heading = lines[0]
                sec_body = '\n'.join(lines[1:]).strip()
                if len(sec_body.split()) > 35:
                    examples.append(make_ex(
                        f"Write a section for a post on '{title}' focusing on: {sec_heading}.",
                        f"## {sec_heading}\n\n{sec_body}",
                        task_tag="Draft"
                    ))
                    
                    # Edit Pair from section
                    corp_version = corporatize(sec_body[:400])
                    examples.append(make_ex(
                        f"Rewrite this corporate draft in Ryan's voice:\n\n{corp_version}",
                        sec_body,
                        task_tag="Edit"
                    ))
                    
                    # Critique Pair from section
                    examples.append(make_ex(
                        f"Critique this draft section and explain what Ryan would fix:\n\n{corp_version}",
                        f"This draft falls into classic corporate patterns. Here's what to fix:\n\n"
                        f"1. **Passive/team voice:** 'Our team leveraged resources' hides who did the work. Use first person ('I built') for your own artifacts and credit the team explicitly for shared product launches.\n"
                        f"2. **Em-dashes and filler:** Replace the em-dash clause with direct evidence or a colon pivot.\n"
                        f"3. **Contractions:** Use contractions ('don't', 'doesn't', 'I've') to maintain a conversational register.\n\n"
                        f"Here is how I'd write it:\n\n{sec_body[:300]}...",
                        task_tag="Critique"
                    ))

    # 2. Process work case studies
    for item in portfolio:
        if item.get("content_type") == "work" and item.get("word_count", 0) > 50:
            title = item.get("title") or "Platform DevX Initiative"
            body = item["body"]
            examples.append(make_ex(
                f"Write a work case study for the initiative: '{title}'. Follow the 3-section structure (The goal, What shipped, What I learned).",
                body,
                task_tag="Draft"
            ))
            
            # Headline task
            examples.append(make_ex(
                f"Generate 6 headline/title variants for a case study or post about '{title}'.",
                f"1. {title}: The Growth Engine Inside the DevX Loop\n"
                f"2. Why {title} Failed Until We Measured the Delta\n"
                f"3. {title}: From Field Signal to Scaled Distribution\n"
                f"4. The Misconception Behind {title}\n"
                f"5. What Shipped: {title}\n"
                f"6. {title}: Lessons From Traces in the Field",
                task_tag="Headline"
            ))

    # 3. Process talk entries
    for item in portfolio:
        if item.get("content_type") == "talk" and item.get("word_count", 0) > 40:
            title = item.get("title") or "Developer Platform Presentation"
            body = item["body"]
            examples.append(make_ex(
                f"Draft a talk abstract and outline for a presentation titled '{title}'. Follow a demo-first structure.",
                body,
                task_tag="Present"
            ))

    # 4. Out-of-Domain Voice Transfer Examples (Authentic Ryan style on new topics)
    ood_examples = [
        (
            "Write a short Field Note about preparing for a 100-mile gravel bike race.",
            "The weather forecast said clear, which is how you knew the wind would turn at mile sixty. Six hours on unpaved gravel roads, and an outcome you can read in your legs three miles after the turnoff.\n\n"
            "I used to think endurance was about pacing power targets on a clean computer screen. It isn't. The real constraint is fueling before you feel empty and knowing when a mechanical issue is minor versus when your tire setup is lying to you.\n\n"
            "The lesson translates straight back to engineering: prepare the baseline, test your equipment on real terrain before race day, and never trust a clean metric when the wind changes direction."
        ),
        (
            "Write a post about why manual espresso brewing is like debugging software.",
            "A bad shot of espresso looks right for the first three seconds. Thick crema, dark color, beautiful flow. Then you taste it and realize the extraction channeled straight down the middle.\n\n"
            "Pretty is the dangerous one in coffee, just like in code. A unit test can pass with clean green checkmarks while the underlying database query quietly quadruples its billing tier on live traffic.\n\n"
            "Diagnosing both requires the same habit: ignore the pretty surface, inspect the grind distribution, and find the assumption that walked away from the physics."
        ),
        (
            "Write a post about what the Tacoma Narrows Bridge failure teaches developer platform teams.",
            "In 1940, engineers built the Tacoma Narrows Bridge to withstand static wind loads three times higher than anything Puget Sound had ever seen. The math held up on paper. It collapsed four months after opening under a gentle 42 mph breeze.\n\n"
            "They measured static pressure. They missed dynamic torsional flutter: the wind didn't push the bridge over, it matched the bridge's natural frequency and twisted it apart cycle by cycle.\n\n"
            "Most DevX teams make the same mistake. They measure static documentation pageviews and complete tutorial counts while missing the dynamic friction loop where developers hit an unhandled API edge case and abandon the integration silently."
        ),
        (
            "Write a Field Note on why great product design starts by removing options.",
            "Adding a button is cheap. Removing one takes an argument.\n\n"
            "When we look at developer dropoff in telemetry, the culprit is rarely a missing feature. It's almost always three choices presented at the exact moment the builder wanted one working default. Give an agent or a human developer five configuration flags on step one, and half of them will pick the combination that breaks auth.\n\n"
            "Good design doesn't empower people with endless toggles. It names the single binding constraint, ships the safest default, and hides the knobs until someone earns the right to turn them."
        ),
        (
            "Rewrite this corporate announcement about a new internal search tool in Ryan's voice: 'We are thrilled to launch our next-generation AI Search Portal, leveraging deep learning algorithms to empower employee knowledge retrieval.'",
            "Finding an internal document used to mean remembering which team's drive folder held the 2024 architecture deck. That mechanical search ate twenty minutes of every engineer's morning.\n\n"
            "We built a direct retrieval tool over our internal docs. The goal wasn't to ship an AI portal; it was to give developers back the half hour they were spending digging through stale links. The baseline search took 4 minutes to fail; the new path finds the verified spec in six seconds.\n\n"
            "Don't measure the tool by its model parameters. Measure it by whether engineers stopped asking for link permissions in Slack."
        )
    ]

    for prompt, resp in ood_examples:
        examples.append(make_ex(prompt, resp, task_tag="OOD"))

    # Shuffle dataset deterministically
    random.seed(42)
    random.shuffle(examples)

    # Split 90/10
    val_count = max(1, int(len(examples) * 0.1))
    val_set = examples[:val_count]
    train_set = examples[val_count:]

    os.makedirs(TRAINING_DIR, exist_ok=True)

    with open(os.path.join(TRAINING_DIR, "dataset.jsonl"), "w") as f:
        for ex in train_set:
            f.write(json.dumps(ex) + "\n")

    with open(os.path.join(TRAINING_DIR, "validation.jsonl"), "w") as f:
        for ex in val_set:
            f.write(json.dumps(ex) + "\n")

    task_counts = {}
    for ex in examples:
        u = ex["messages"][1]["content"]
        tag = u.split("\n")[0].replace("[Task: ", "").replace("]", "")
        task_counts[tag] = task_counts.get(tag, 0) + 1

    metadata = {
        "total_examples": len(examples),
        "train_examples": len(train_set),
        "val_examples": len(val_set),
        "task_breakdown": task_counts,
        "source_inventory": {
            "portfolio_entries": len(portfolio)
        }
    }

    with open(os.path.join(TRAINING_DIR, "dataset-metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print("Dataset generated successfully from repository markdown!")
    print(f"Total examples: {len(examples)} (Train: {len(train_set)}, Val: {len(val_set)})")
    print("Task Breakdown:", json.dumps(task_counts, indent=2))

if __name__ == "__main__":
    main()
