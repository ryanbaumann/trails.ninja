"""An advisory reviewer pass. It never gates a run.

The graders decide the mechanical half. This is the other half, and it is worth
exactly what a model's opinion about taste is worth, which is why it writes to its own
file and never touches the exit code.

Two things keep it honest:

    evidence      every verdict has to quote the span it is about. A criticism that
                  cannot point at a line is a criticism of nothing.
    position swap pairwise comparisons run in both orders, and a preference only
                  counts when it survives the swap. Otherwise it is position bias.

The judge should be the base model, not the adapter. An adapter grading its own output
is a model agreeing with itself.
"""

import json
import re

CRITERIA = [
    ("opening", "Does the first sentence land on a real scenario, a quoted objection, or "
                "concrete friction? A thesis statement or a definition is a failure."),
    ("evidence", "Is every claim either supported in the text or clearly marked as the "
                 "author's judgement? An unsupported number or attribution is a failure."),
    ("credit", "Does the piece claim work it does not show? Overclaiming is a failure."),
    ("shape", "Result, then what shipped, then the lesson. Does the structure carry an "
              "argument, or is it a list of true statements?"),
    ("worth", "Would a working developer read past the second paragraph, and would they "
              "learn something they could not get from the abstract?"),
]

JUDGE_SYSTEM = (
    "You are a hostile copy editor. You are reviewing a draft, not praising it. For every "
    "criterion you must quote the exact span you are judging, verbatim, from the draft. If "
    "you cannot find a span to quote, the verdict is 'unsure'. Never invent a quotation. "
    "Reply with JSON only."
)

JUDGE_TEMPLATE = """Review this draft against each criterion.

Criteria:
{criteria}

Draft:
---
{draft}
---

Reply with JSON in exactly this shape and nothing else:
{{"opening": {{"verdict": "holds|fails|unsure", "quote": "...", "why": "..."}},
 "evidence": {{...}}, "credit": {{...}}, "shape": {{...}}, "worth": {{...}},
 "one_thing_to_cut": "..."}}
"""

PAIRWISE_TEMPLATE = """Two versions of the same piece. Decide which one a working developer
would rather read, judging only voice and usefulness. Quote one span from each to justify it.

Version A:
---
{a}
---

Version B:
---
{b}
---

Reply with JSON only: {{"winner": "A|B|tie", "quote_a": "...", "quote_b": "...", "why": "..."}}
"""

JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _parse_json(raw):
    match = JSON_BLOCK_RE.search(raw or "")
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except ValueError:
        return None


def _verify_quotes(verdicts, draft):
    """Drop any verdict whose quote is not actually in the draft.

    A judge that fabricates its evidence is worse than no judge, and this is cheap to
    check, so it gets checked.
    """
    normalised = re.sub(r"\s+", " ", draft or "").lower()
    for name, _ in CRITERIA:
        entry = verdicts.get(name)
        if not isinstance(entry, dict):
            continue
        quote = re.sub(r"\s+", " ", str(entry.get("quote", ""))).strip().lower()
        if quote and quote not in normalised:
            entry["verdict"] = "unsure"
            entry["why"] = "Judge quoted text that is not in the draft; verdict discarded."
            entry["quote_verified"] = False
        else:
            entry["quote_verified"] = bool(quote)
    return verdicts


def review(backend, draft, max_tokens=700, temperature=0.3, seed=7):
    """Criterion-by-criterion review of one output."""
    criteria = "\n".join("- %s: %s" % (name, description) for name, description in CRITERIA)
    messages = [
        {"role": "system", "content": JUDGE_SYSTEM},
        {"role": "user", "content": JUDGE_TEMPLATE.format(criteria=criteria, draft=draft)},
    ]
    raw, seconds = backend.generate(messages, max_tokens=max_tokens,
                                    temperature=temperature, seed=seed)
    parsed = _parse_json(raw)
    if parsed is None:
        return {"parsed": False, "raw": raw[:1200], "seconds": seconds}
    return {"parsed": True, "verdicts": _verify_quotes(parsed, draft),
            "seconds": seconds, "raw": None}


def pairwise(backend, version_a, version_b, max_tokens=400, temperature=0.3, seed=7):
    """A/B in both orders. A preference that flips with position is not a preference."""
    def ask(first, second):
        messages = [
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": PAIRWISE_TEMPLATE.format(a=first, b=second)},
        ]
        raw, _ = backend.generate(messages, max_tokens=max_tokens,
                                  temperature=temperature, seed=seed)
        parsed = _parse_json(raw) or {}
        return str(parsed.get("winner", "")).strip().upper()[:1]

    forward = ask(version_a, version_b)
    reverse = ask(version_b, version_a)
    if forward == "A" and reverse == "B":
        winner = "a"
    elif forward == "B" and reverse == "A":
        winner = "b"
    else:
        winner = "no_preference"
    return {"winner": winner, "forward": forward, "reverse": reverse,
            "position_consistent": winner != "no_preference"}


def render_markdown(records, label):
    lines = [
        "# Advisory review: %s" % label,
        "",
        "This file is a model's opinion about taste. Nothing in it gates a run, nothing in "
        "it is averaged, and a verdict whose quote did not appear in the draft has already "
        "been discarded. Read it as an argument to have, not a result.",
        "",
    ]
    for record in records:
        lines.append("## `%s` (%s)" % (record["id"], record["task"]))
        lines.append("")
        review_data = record.get("review", {})
        if not review_data.get("parsed"):
            lines.append("Judge did not return usable JSON.")
            lines.append("")
            continue
        verdicts = review_data["verdicts"]
        for name, _ in CRITERIA:
            entry = verdicts.get(name)
            if not isinstance(entry, dict):
                continue
            lines.append("- **%s**: %s. %s" % (name, entry.get("verdict", "?"),
                                               entry.get("why", "")))
            if entry.get("quote"):
                lines.append("  > %s" % str(entry["quote"]).replace("\n", " ")[:200])
        if verdicts.get("one_thing_to_cut"):
            lines.append("- **cut**: %s" % verdicts["one_thing_to_cut"])
        if record.get("pairwise"):
            lines.append("- **pairwise vs reference**: %s (forward %s, reverse %s)"
                         % (record["pairwise"]["winner"], record["pairwise"]["forward"],
                            record["pairwise"]["reverse"]))
        lines.append("")
    return "\n".join(lines)
