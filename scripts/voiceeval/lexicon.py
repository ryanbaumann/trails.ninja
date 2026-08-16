"""Load the shared voice lexicon and compile it once.

The JSON lives in scripts/lib/ because the site linter (content-rules.mjs) reads the
same file. If a word gets added there, both the published-prose check and the model
eval pick it up on the next run.
"""

import json
import re
from pathlib import Path

LEXICON_PATH = Path(__file__).resolve().parent.parent / "lib" / "voice-lexicon.json"

# Which categories fail a run and which only get reported. Hype and announcement
# phrasing are already banned in published prose, so a model that emits them has
# produced copy I would have to fix by hand. "weak" words are judgement calls.
SEVERITY = {
    "hype": "error",
    "announce": "error",
    "ai_tells": "error",
    "scaffold": "error",
    "unsourced_claim": "warn",
    "weak": "warn",
}

_CACHE = {}


def load(path=None):
    """Read the lexicon JSON, cached by path."""
    resolved = Path(path) if path else LEXICON_PATH
    key = str(resolved)
    if key not in _CACHE:
        with open(resolved, "r", encoding="utf-8") as handle:
            _CACHE[key] = json.load(handle)
    return _CACHE[key]


def _compile(patterns):
    return [re.compile(p, re.IGNORECASE | re.MULTILINE) for p in patterns]


def categories(path=None):
    """Every category a model output is graded against, as compiled patterns.

    Site rules merge into the model rules: anything the linter would reject in a
    published post is also a failure in generated copy.
    """
    data = load(path)
    site = data.get("site", {})
    model = data.get("model_output", {})
    merged = {}
    for name in set(list(site.keys()) + list(model.keys())):
        # emdash is a literal-character rule, not a pattern list. abstain is the one
        # category where a match is the good outcome, so it is graded by grade_citations
        # and must not be reported as a lexical violation.
        if name in ("emdash", "abstain"):
            continue
        patterns = list(site.get(name, [])) + list(model.get(name, []))
        merged[name] = _compile(patterns)
    return merged


def em_dashes(path=None):
    """Literal dash characters that are banned outright."""
    return list(load(path).get("site", {}).get("emdash", ["—"]))


def abstain_patterns(path=None):
    """Phrasings that count as the model declining to invent something."""
    return _compile(load(path).get("model_output", {}).get("abstain", []))


def hits(text, patterns):
    """Distinct matched strings for a list of compiled patterns."""
    found = []
    for pattern in patterns:
        for match in pattern.finditer(text or ""):
            snippet = match.group(0).strip()
            if snippet and snippet not in found:
                found.append(snippet)
    return found
