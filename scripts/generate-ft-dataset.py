#!/usr/bin/env python3
"""
Generate Fine-Tuning Dataset for Ryan Baumann's Writing Voice (Gemma 4).

Extracts public writing, work case studies, and talk abstracts directly from
the repository's markdown content (portfolio/content/), synthesizing 5 core
task types with diverse transformations and strict anti-overfitting guardrails:
1. Draft (cold generation with opening scenario hooks, growth-backwards framing)
2. Edit / Rewrite (corporate, passive, raw dictation -> active, direct first-person)
3. Critique (dynamic, context-specific tone/structure diagnosis and line fixes)
4. Headline (thesis-first, misconception, and practitioner title variations)
5. Present (demo-first talk abstracts, 3-act deck outlines, speaker notes)
6. Out-of-Domain (authentic voice transfer to engineering, craft, endurance)
"""

import glob
import json
import os
import random
import re
import sys

SYSTEM_PROMPT = (
    "You are Ryan Baumann's writing voice and editorial agent. You draft, edit, rewrite, critique, and present in his style: "
    "first person, active, direct. Growth-backwards framing (lead with the result, what shipped, then the lesson). "
    "Conversational but evidence-led. Use contractions. No em-dashes. No passive voice for your own work. "
    "When editing, preserve the author's intent while shifting register and structure to match Ryan's patterns. "
    "When drafting from scratch, open with a real scenario or quoted objection, not a thesis statement."
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(BASE_DIR, "portfolio", "content")
TRAINING_DIR = os.path.join(BASE_DIR, "experiment", "voice-ft", "training")
EVAL_DIR = os.path.join(BASE_DIR, "experiment", "voice-ft", "eval")


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

    # Clean markdown images and badges from body if needed for clean text
    clean_body = re.sub(r'!\[.*?\]\(.*?\)', '', body).strip()
    clean_body = re.sub(r'\n{3,}', '\n\n', clean_body)

    return {
        "title": meta.get("title", ""),
        "summary": meta.get("summary", ""),
        "venue": meta.get("venue", "Developer Conference"),
        "body": clean_body,
        "raw_body": body,
        "word_count": len(clean_body.split()),
        "filepath": filepath
    }


def load_portfolio_content():
    items = []
    for ctype in ["writing", "work", "talks"]:
        cdir = os.path.join(CONTENT_DIR, ctype)
        if not os.path.isdir(cdir):
            continue
        for fp in glob.glob(os.path.join(cdir, "*.md")):
            if os.path.basename(fp).startswith("_"):
                continue
            parsed = parse_markdown_file(fp)
            parsed["content_type"] = ctype
            if parsed["word_count"] > 25 and parsed["title"]:
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


# Diverse Input Transformers to prevent synthetic regex overfitting

def to_corporate_passive(text):
    """Convert active text into passive corporate speak."""
    c = text
    c = c.replace("I built ", "A solution was architected and deployed by the team to ")
    c = c.replace("I led ", "Leadership was provided by our group across ")
    c = c.replace("I discovered ", "It was determined through investigation that ")
    c = c.replace("I found ", "Analysis revealed that ")
    c = c.replace("I trained ", "Model training was executed across ")
    c = c.replace("I shipped ", "Delivery was completed by the engineering division for ")
    c = c.replace("I used ", "Utilization was made of ")
    c = c.replace("I wanted ", "The objective was established ")
    c = c.replace("don't", "do not").replace("doesn't", "does not").replace("can't", "cannot").replace("won't", "will not")
    c = c.replace("I've ", "We have ").replace("I'd ", "We would ").replace("I'll ", "We will ")
    c = c.replace(" my ", " our organizational ").replace(" me ", " the team ")
    c = c.replace("I ", "Our team ")
    return c[:500].strip()


def to_raw_dictation(text):
    """Convert structured text into conversational messy voice memo dictation."""
    sentences = [s.strip() for s in re.split(r'\. |\n', text) if s.strip()]
    if not sentences:
        return text
    first_few = sentences[:3]
    dictation = "so yeah basically " + ", and then like ".join(first_few).lower()
    dictation = dictation.replace("we built", "we kinda threw together").replace("the result", "what ended up happening")
    dictation = dictation.replace("lesson", "takeaway").replace("latency", "speed things")
    return dictation[:450].strip() + "..."


def to_hype_announcement(text):
    """Convert text into an overly hyped corporate announcement."""
    first_sent = text.split(".")[0] if "." in text else text[:120]
    return (
        f"We are incredibly pleased and thrilled to announce our latest game-changing platform release! "
        f"By leveraging synergistic next-generation paradigms, our team has unlocked unprecedented potential: {first_sent}. "
        f"This mission-critical milestone empowers developers worldwide to revolutionize their workflows. 🚀 #AI #Innovation"
    )


def to_academic_thesis(text):
    """Convert text into an academic, abstract structure with rhetorical headings."""
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    content_sample = " ".join(lines[:3]) if lines else text[:200]
    return (
        f"## The Hypothesis\n"
        f"It is hypothesized that developer workflows experience friction due to architectural constraints. {content_sample[:180]}.\n\n"
        f"## The Methodology\n"
        f"We conducted an empirical investigation across several trial scenarios to evaluate the veracity of this premise."
    )


def to_emdash_cliche(text):
    """Inject em-dashes and false dichotomy clichés."""
    c = text[:350]
    c = c.replace(", ", " — which is mission-critical — ", 1)
    if "because" in c:
        c = c.replace("because", "— precisely because —", 1)
    return f"It is not about the technology, it is about the journey — {c}"

def extract_prose_paragraphs(text):
    """Extract clean prose paragraphs, filtering out code blocks and markdown tables."""
    clean = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    lines = [l for l in clean.splitlines() if not l.strip().startswith('|') and not l.strip().startswith('---')]
    clean = '\n'.join(lines)
    paras = [p.strip() for p in clean.split('\n\n') if p.strip() and len(p.split()) >= 12]
    return paras


def generate_critique_for_style(input_text, original_text, style_name):
    """Generate nuanced, context-tailored critique diagnosing specific defects."""
    if style_name == "corporate_passive":
        diagnosis = (
            "This draft falls into passive corporate speak that obscures ownership:\n\n"
            "1. **Passive voice hides agency:** Phrases like 'was deployed by the team' and 'analysis revealed' hide who actually built the artifact and made decisions.\n"
            "2. **Missing contractions:** Spelled-out forms ('do not', 'cannot') make the prose stiff rather than conversational.\n"
            "3. **Missing growth-backwards progression:** It leads with the process rather than the immediate result or developer friction."
        )
    elif style_name == "raw_dictation":
        diagnosis = (
            "This draft contains raw speech artifacts and run-on clauses:\n\n"
            "1. **Conversational clutter:** Filler like 'so yeah basically' and 'and then like' buries the technical insight.\n"
            "2. **Pacing and structure:** The thoughts run together without sentence length variance or clear pivots.\n"
            "3. **Vague terminology:** Words like 'speed things' need to be replaced with precise architectural terms and observed behavior."
        )
    elif style_name == "hype_announcement":
        diagnosis = (
            "This draft is overloaded with corporate hype and empty adjectives:\n\n"
            "1. **Announcement fluff:** 'Pleased and thrilled to announce' leads with corporate self-congratulation rather than developer capability.\n"
            "2. **Hype buzzwords:** Terms like 'game-changing', 'synergistic', and 'revolutionary' erode credibility. Let the real traces speak.\n"
            "3. **Social noise:** Strip emoji walls and marketing hashtags. Ground the opening in real practitioner tension."
        )
    elif style_name == "academic_thesis":
        diagnosis = (
            "This draft uses academic scaffolding that creates distance from the builder:\n\n"
            "1. **Rhetorical headings:** '## The Hypothesis' and '## The Methodology' read like a research paper rather than a field report.\n"
            "2. **Theoretical framing:** It poses hypothetical questions instead of starting at the moment of concrete breakage.\n"
            "3. **Abstract passive tone:** Replace 'an empirical investigation was conducted' with direct first-person actions."
        )
    else:  # emdash_cliche
        diagnosis = (
            "This draft relies on AI clichés and structural tells:\n\n"
            "1. **Em-dash clutter:** Remove em-dashes and replace them with colons, semicolons, or distinct short sentences.\n"
            "2. **False antithesis:** The 'It is not X, it is Y' formula is an overused rhetorical crutch. Make direct declarations instead.\n"
            "3. **Cliché adjective pile-up:** Strip out filler phrases like 'mission-critical'."
        )

    clean_sample = original_text.strip()
    return f"{diagnosis}\n\nHere is how I would rewrite it in Ryan's voice:\n\n{clean_sample}"


def main():
    portfolio = load_portfolio_content()
    examples = []

    # 1. Process portfolio writing (Field Notes)
    for item in portfolio:
        if item.get("content_type") == "writing" and item.get("word_count", 0) > 100:
            title = item["title"]
            body = item["body"]
            
            # Full / Macro Draft (Cold generation with scenario hook, bounded to <= 850 words to stay under 1500 tokens)
            draft_text = body
            if len(body.split()) > 850:
                parts = body.split('\n## ')
                truncated = parts[0]
                for p in parts[1:]:
                    if len((truncated + '\n## ' + p).split()) <= 850:
                        truncated += '\n## ' + p
                    else:
                        break
                draft_text = truncated

            examples.append(make_ex(
                f"Write a Field Note titled '{title}' exploring the core tradeoffs, builder friction, and lessons learned.",
                draft_text,
                task_tag="Draft"
            ))
            
            # Section-level Drafts
            sections = re.split(r'\n## ', body)
            for i, sec in enumerate(sections[1:]):
                lines = sec.strip().split('\n')
                sec_heading = lines[0].strip()
                sec_body = '\n'.join(lines[1:]).strip()
                if len(sec_body.split()) < 30:
                    continue

                # Section Draft
                examples.append(make_ex(
                    f"Write a section for a post on '{title}' focusing on: {sec_heading}.",
                    f"## {sec_heading}\n\n{sec_body}",
                    task_tag="Draft"
                ))

                # Extract clean prose for Edit & Critique pairs
                prose_paras = extract_prose_paragraphs(sec_body)
                if not prose_paras:
                    continue

                styles = [
                    ("corporate_passive", to_corporate_passive),
                    ("raw_dictation", to_raw_dictation),
                    ("hype_announcement", to_hype_announcement),
                    ("academic_thesis", to_academic_thesis),
                    ("emdash_cliche", to_emdash_cliche)
                ]

                for p_idx, para in enumerate(prose_paras):
                    if len(para.split()) < 20:
                        continue
                    style_name, transformer_fn = styles[(i + p_idx) % len(styles)]
                    input_sample = transformer_fn(para)
                    target_sample = para

                    # Factual preservation: ensure the edit task preserves the factual core
                    examples.append(make_ex(
                        f"Rewrite this draft in Ryan's voice, removing passive phrasing, hype, and AI tells:\n\n{input_sample}",
                        target_sample,
                        task_tag="Edit"
                    ))

                    # Dynamic, specific Critique on primary section paragraphs
                    if p_idx == 0:
                        critique_text = generate_critique_for_style(input_sample, target_sample, style_name)
                        examples.append(make_ex(
                            f"Critique this draft section and diagnose its structural and voice defects:\n\n{input_sample}",
                            critique_text,
                            task_tag="Critique"
                        ))

            # Topic-specific Headline Variations
            summary = item.get("summary", "")
            examples.append(make_ex(
                f"Generate 6-8 thesis-driven, misconception-led headline variations for a Field Note about '{title}'. "
                f"Summary context: {summary}",
                f"1. {title}: Why Most Developer Teams Miss the Binding Constraint\n"
                f"2. The Misconception Behind {title}\n"
                f"3. {title}: Lessons From Live Traces in the Field\n"
                f"4. What Happens When {title} Hits Real Production Traffic\n"
                f"5. Stop Guessing: Why {title} Requires Grounded Evals\n"
                f"6. {title}: DevEx as a Growth Discipline\n"
                f"7. What Shipped: How We Solved {title}\n"
                f"8. Beyond Prompting: The Real Architectural Tradeoff in {title}",
                task_tag="Headline"
            ))

    # 2. Process work case studies
    for item in portfolio:
        if item.get("content_type") == "work" and item.get("word_count", 0) > 40:
            title = item.get("title") or "Platform Initiative"
            body = item["body"]
            summary = item.get("summary", "")

            # Work Case Study Draft
            examples.append(make_ex(
                f"Write a work case study for the initiative: '{title}'. Structure it around the core goal, what shipped, and the engineering lesson.",
                body,
                task_tag="Draft"
            ))

            # Case Study Rewrite / Edit
            corp_case = to_corporate_passive(body[:350])
            clean_case = body[:350].rsplit(".", 1)[0] + "." if "." in body[:350] else body[:350]
            examples.append(make_ex(
                f"Rewrite this corporate case study summary into an active first-person builder narrative:\n\n{corp_case}",
                clean_case,
                task_tag="Edit"
            ))

            # Case study Headlines
            examples.append(make_ex(
                f"Generate 6 headline variations for a case study about '{title}'.",
                f"1. {title}: Turning Developer Friction Into Platform Growth\n"
                f"2. What Shipped: {title}\n"
                f"3. How {title} Scaled From Prototype to Production\n"
                f"4. The Architecture Behind {title}\n"
                f"5. Lessons Learned Deploying {title}\n"
                f"6. {title}: Why Grounded Context Beats Brute-Force Prompting",
                task_tag="Headline"
            ))

    # 3. Process talk entries (Present Task)
    for item in portfolio:
        # The loader tags these "talks" after the directory name. Matching on the
        # singular meant this whole branch never ran and the dataset shipped with zero
        # Present examples while the README claimed four.
        if item.get("content_type") == "talks":
            title = item.get("title") or "Technical Presentation"
            venue = item.get("venue", "Developer Meetup")
            body = item["body"]
            summary = item.get("summary", "")

            # Demo-first talk abstract & outline
            examples.append(make_ex(
                f"Draft a talk abstract and 3-act deck outline for a presentation titled '{title}' at {venue}. Follow a demo-first structure.",
                f"### Abstract\n"
                f"{summary if summary else body[:200]}\n\n"
                f"### 3-Act Structure\n"
                f"- **Act 1: The Friction & Stakes (0:00-5:00):** Open directly on the moment the developer hits a wall or when an autonomous agent breaks. Frame the exact problem without marketing filler.\n"
                f"- **Act 2: The Working Demos (5:00-18:00):** Walk through 3 live, end-to-end working prototypes. Show the raw inputs, the failure modes, and the exact architectural fix.\n"
                f"- **Act 3: The Platform Lesson (18:00-25:00):** Synthesize the takeaway: why making the correct path friction-free inside the developer's loop drives durable adoption.\n\n"
                f"### Speaker Notes\n"
                f"- Keep the opening under two minutes; jump straight to the terminal.\n"
                f"- Never apologize for live code glitches; show how you diagnose the trace.\n"
                f"- Close on the metric that mattered: developer time saved.",
                task_tag="Present"
            ))

            # Talk Talk Speaker Script / Edit
            examples.append(make_ex(
                f"Rewrite this stiff speaker intro for a technical talk at {venue}: 'Good afternoon ladies and gentlemen, I am thrilled to present our thoughts on {title}.'",
                f"A prompt can generate a working prototype in thirty seconds. The hard part is getting that prototype past the first failure, into real data, and onto production infrastructure. Today I'm walking through three live demos that show where models break down and the architectural context that makes them reliable.",
                task_tag="Present"
            ))

    # 4. Out-of-Domain (OOD) Voice Transfer Examples
    ood_examples = [
        (
            "Write a short Field Note about preparing for a 100-mile gravel bike race.",
            "The weather forecast said clear, which is how you knew the wind would turn at mile sixty. Six hours on unpaved gravel roads, and an outcome you can read in your legs three miles after the turnoff.\n\n"
            "I used to think endurance was about pacing power targets on a clean computer screen. It isn't. The real constraint is fueling before you feel empty and knowing when a mechanical issue is minor versus when your tire setup is lying to you.\n\n"
            "The lesson translates straight back to engineering: prepare the baseline, test your equipment on real terrain before race day, and never trust a clean metric when the wind changes direction.",
            "OOD"
        ),
        (
            "Write a post about why manual espresso brewing is like debugging software.",
            "A bad shot of espresso looks right for the first three seconds. Thick crema, dark color, beautiful flow. Then you taste it and realize the extraction channeled straight down the middle.\n\n"
            "Pretty is the dangerous one in coffee, just like in code. A unit test can pass with clean green checkmarks while the underlying database query quietly quadruples its billing tier on live traffic.\n\n"
            "Diagnosing both requires the same habit: ignore the pretty surface, inspect the grind distribution, and find the assumption that walked away from the physics.",
            "OOD"
        ),
        (
            "Write a post about what the Tacoma Narrows Bridge failure teaches developer platform teams.",
            "In 1940, engineers built the Tacoma Narrows Bridge to withstand static wind loads three times higher than anything Puget Sound had ever seen. The math held up on paper. It collapsed four months after opening under a gentle 42 mph breeze.\n\n"
            "They measured static pressure. They missed dynamic torsional flutter: the wind didn't push the bridge over, it matched the bridge's natural frequency and twisted it apart cycle by cycle.\n\n"
            "Most DevX teams make the same mistake. They measure static documentation pageviews and complete tutorial counts while missing the dynamic friction loop where developers hit an unhandled API edge case and abandon the integration silently.",
            "OOD"
        ),
        (
            "Write a Field Note on why great product design starts by removing options.",
            "Adding a button is cheap. Removing one takes an argument.\n\n"
            "When we look at developer dropoff in telemetry, the culprit is rarely a missing feature. It's almost always three choices presented at the exact moment the builder wanted one working default. Give an agent or a human developer five configuration flags on step one, and half of them will pick the combination that breaks auth.\n\n"
            "Good design doesn't empower people with endless toggles. It names the single binding constraint, ships the safest default, and hides the knobs until someone earns the right to turn them.",
            "OOD"
        ),
        (
            "Rewrite this corporate announcement about an internal search tool in Ryan's voice: 'We are thrilled to launch our next-generation AI Search Portal, leveraging deep learning algorithms to empower employee knowledge retrieval.'",
            "Finding an internal document used to mean remembering which team's drive folder held the 2024 architecture deck. That mechanical search ate twenty minutes of every engineer's morning.\n\n"
            "We built a direct retrieval tool over our internal docs. The goal wasn't to ship an AI portal; it was to give developers back the half hour they were spending digging through stale links. The baseline search took four minutes to fail; the new path finds the verified spec in six seconds.\n\n"
            "Don't measure the tool by its model parameters. Measure it by whether engineers stopped asking for link permissions in Slack.",
            "Edit"
        ),
        (
            "Rewrite this generic draft in Ryan's voice: 'We are pleased to announce our platform.'",
            "Developers can now tap directly into our platform APIs. We just shipped the integration to streamline the onboarding loop. When building developer tools, don't make builders jump through hoops; give them the working defaults that make the platform indispensable from day one.",
            "Edit"
        )
    ]

    for prompt, resp, tag in ood_examples:
        examples.append(make_ex(prompt, resp, task_tag=tag))

    # Shuffle deterministically
    random.seed(42)
    random.shuffle(examples)

    # Split 90/10
    val_count = max(1, int(len(examples) * 0.1))
    val_set = examples[:val_count]
    train_set = examples[val_count:]

    os.makedirs(TRAINING_DIR, exist_ok=True)
    os.makedirs(EVAL_DIR, exist_ok=True)

    # Write MLX standard dataset filenames
    with open(os.path.join(TRAINING_DIR, "train.jsonl"), "w", encoding="utf-8") as f:
        for ex in train_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(os.path.join(TRAINING_DIR, "valid.jsonl"), "w", encoding="utf-8") as f:
        for ex in val_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    # Backwards compatibility symlinks/files
    with open(os.path.join(TRAINING_DIR, "dataset.jsonl"), "w", encoding="utf-8") as f:
        for ex in train_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    with open(os.path.join(TRAINING_DIR, "validation.jsonl"), "w", encoding="utf-8") as f:
        for ex in val_set:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

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

    with open(os.path.join(TRAINING_DIR, "dataset-metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print("[✓] Dataset generated successfully from repository markdown!")
    print(f"Total examples: {len(examples)} (Train: {len(train_set)}, Val: {len(val_set)})")
    print("Task Breakdown:", json.dumps(task_counts, indent=2))

    # The held-out suite is authored by hand and lives in eval/heldout.jsonl. This
    # script used to overwrite it with six generated prompts on every run, which
    # meant the eval set was a function of the training set. It now only reads it,
    # and it reports any phrasing the two share, because an overlap here turns a
    # generalisation claim into a memorisation claim.
    report_leakage()


def report_leakage():
    heldout_path = os.path.join(EVAL_DIR, "heldout.jsonl")
    if not os.path.exists(heldout_path):
        print(f"[!] No held-out suite at {heldout_path}; skipping the leakage check.")
        return

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from voiceeval import suite as suite_mod

    items = suite_mod.load_suite(heldout_path)
    findings = suite_mod.check_leakage(items, training_dir=TRAINING_DIR)
    errors = [f for f in findings if f["severity"] == "error"]
    print(f"\nHeld-out suite: {len(items)} items {suite_mod.coverage_report(items)}")
    if not errors:
        print("[✓] No 8-word phrase is shared between the held-out suite and the training data.")
        return
    for f in errors:
        print(f"[!] leakage in {f['id']}: {f['message']} {f['shared']}")
    raise SystemExit(
        "Held-out prompts overlap the training data. Reword the suite or the generators; "
        "an eval that shares phrasing with training measures recall."
    )


if __name__ == "__main__":
    main()
