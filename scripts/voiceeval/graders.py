"""The checks. One function per way the model actually failed.

Every grader takes (item, output, resolver) and returns a list of findings. A finding
is a dict with a check id, a severity, a status, a value, and a message that names the
evidence. Nothing here averages anything into a score: the run either has an error or
it does not, because the moment a number exists I will start writing for it.

The graders exist in this file because each one is a specific round-four failure:

    G-EDIT-DELTA      "## The result\\n\\nWe just shipped an innovative solution to
                      enhance system availability." The edit did not edit.
    G-EDIT-TARGET     the buzzword survived the rewrite
    G-EDIT-PRESERVE   the opposite failure: a rewrite that throws the facts away
    G-ECHO            the critique that pasted its input back word for word
    G-LOOP            the draft that repeated a sentence and never stopped
    G-HEADLINE        "what happens when prompt engineering hits an RLHF ceiling
                      breaks": the title pattern with the topic dropped in the slot
    G-TYPO            "doesn's"
    G-CITATION        arxiv.org/abs/24606.24282
"""

import re

from . import citations as citations_mod
from . import lexicon
from . import text as T

ERROR = "error"
WARN = "warn"


def finding(check, status, severity=ERROR, message="", value=None):
    return {
        "check": check,
        "status": status,
        "severity": severity if status == "fail" else "info",
        "message": message,
        "value": value,
    }


def _passed(check, message="", value=None):
    return finding(check, "pass", ERROR, message, value)


def _skipped(check, message):
    return finding(check, "skip", ERROR, message, None)


def _term_pattern(term):
    """A `must_remove`/`must_preserve` entry. Prefix with `re:` for a raw regex.

    Lookarounds rather than \\b, because half these terms end in a symbol. "40%"
    followed by a space has no word boundary after the percent sign, and \\b would
    silently never match it.
    """
    if term.startswith("re:"):
        return re.compile(term[3:], re.IGNORECASE)
    return re.compile(r"(?<!\w)%s(?!\w)" % re.escape(term), re.IGNORECASE)


# --------------------------------------------------------------------------- tells


def grade_tells(item, output, checks):
    """Words and phrases that are banned outright, from the shared lexicon."""
    findings = []
    dashes = [d for d in lexicon.em_dashes() if d in output]
    if dashes:
        findings.append(finding("G-EMDASH", "fail", ERROR,
                                "Em-dash in output. Use a period, a comma, or a colon.",
                                len(dashes)))
    else:
        findings.append(_passed("G-EMDASH"))

    for name, patterns in sorted(lexicon.categories().items()):
        severity = lexicon.SEVERITY.get(name, WARN)
        if name in checks.get("allow_categories", []):
            continue
        hits = lexicon.hits(output, patterns)
        check_id = "G-%s" % name.upper().replace("_", "-")
        if hits:
            findings.append(finding(check_id, "fail", severity,
                                    "%s: %s" % (name, ", ".join(repr(h) for h in hits[:5])),
                                    len(hits)))
        else:
            findings.append(_passed(check_id))
    return findings


# ---------------------------------------------------------------------------- edit


def grade_edit(item, output, checks):
    """Did the edit change anything, keep the meaning, and hit its targets?

    Three thresholds, because an edit fails in three directions. Too similar to the
    source and it did nothing. Too dissimilar and it threw the facts away. Similar
    enough but with the buzzword still in place and it missed the point entirely.
    """
    source = item.get("source_text")
    findings = []
    if not source:
        return [_skipped("G-EDIT-DELTA", "item has no source_text")]

    src_tokens = T.tokens(source)
    out_tokens = T.tokens(output)
    out_content = T.content_tokens(output)

    # Words the item asked the model to delete cannot also count towards "kept the
    # meaning". Without this, an input of "pleased to announce our platform" would
    # demand that the rewrite keep "pleased" and "announce".
    doomed = [_term_pattern(t) for t in (checks.get("must_remove") or [])]
    src_content = [tok for tok in T.content_tokens(source)
                   if not any(p.search(tok) for p in doomed)]

    similarity = T.token_f1(src_tokens, out_tokens)
    change = round(1.0 - similarity, 4)
    span = T.longest_common_span(src_tokens, out_tokens)
    span_ratio = round(span / float(len(src_tokens)), 4) if src_tokens else 0.0
    preserved = round(T.coverage(src_content, out_content), 4)

    min_change = checks.get("min_change")
    max_change = checks.get("max_change")
    min_preserve = checks.get("min_preserve")
    max_span_ratio = checks.get("max_verbatim_span_ratio")

    if min_change is not None:
        if change < min_change:
            findings.append(finding(
                "G-EDIT-DELTA", "fail", ERROR,
                "Output is %.0f%% the same as the input (needs to change at least %.0f%%). "
                "The edit did not edit." % (similarity * 100, min_change * 100),
                change))
        else:
            findings.append(_passed("G-EDIT-DELTA", "changed %.0f%%" % (change * 100), change))

    if max_change is not None:
        if change > max_change:
            findings.append(finding(
                "G-EDIT-RESTRAINT", "fail", ERROR,
                "Output rewrote %.0f%% of an input that only needed a light pass "
                "(ceiling %.0f%%)." % (change * 100, max_change * 100),
                change))
        else:
            findings.append(_passed("G-EDIT-RESTRAINT", value=change))

    if min_preserve is not None:
        if preserved < min_preserve:
            findings.append(finding(
                "G-EDIT-PRESERVE", "fail", ERROR,
                "Only %.0f%% of the input's content words survive (floor %.0f%%). "
                "This is a new draft, not an edit." % (preserved * 100, min_preserve * 100),
                preserved))
        else:
            findings.append(_passed("G-EDIT-PRESERVE", value=preserved))

    # On a two-line input a shared four-word run is a coincidence, not an echo.
    if max_span_ratio is not None and len(src_tokens) >= 20:
        if span_ratio > max_span_ratio:
            findings.append(finding(
                "G-EDIT-VERBATIM", "fail", ERROR,
                "%d consecutive tokens (%.0f%% of the input) come back untouched."
                % (span, span_ratio * 100),
                span_ratio))
        else:
            findings.append(_passed("G-EDIT-VERBATIM", value=span_ratio))

    return findings


def grade_terms(item, output, checks):
    """Explicit per-item targets: what this rewrite has to remove and to keep."""
    findings = []
    must_remove = checks.get("must_remove") or []
    survivors = [term for term in must_remove if _term_pattern(term).search(output)]
    if must_remove:
        if survivors:
            findings.append(finding(
                "G-EDIT-TARGET", "fail", ERROR,
                "These were supposed to go and did not: %s" % ", ".join(repr(s) for s in survivors),
                len(survivors)))
        else:
            findings.append(_passed("G-EDIT-TARGET", value=0))

    must_preserve = checks.get("must_preserve") or []
    missing = [term for term in must_preserve if not _term_pattern(term).search(output)]
    if must_preserve:
        if missing:
            findings.append(finding(
                "G-FACT-KEEP", "fail", ERROR,
                "Dropped from the input: %s" % ", ".join(repr(m) for m in missing),
                len(missing)))
        else:
            findings.append(_passed("G-FACT-KEEP", value=0))

    must_contain = checks.get("must_contain") or []
    absent = [p for p in must_contain if not re.search(p, output, re.IGNORECASE | re.MULTILINE)]
    if must_contain:
        if absent:
            findings.append(finding("G-REQUIRED", "fail", ERROR,
                                    "Missing required pattern(s): %s" % ", ".join(absent),
                                    len(absent)))
        else:
            findings.append(_passed("G-REQUIRED"))

    must_not_contain = checks.get("must_not_contain") or []
    present = [p for p in must_not_contain if re.search(p, output, re.IGNORECASE | re.MULTILINE)]
    if must_not_contain:
        if present:
            findings.append(finding("G-FORBIDDEN", "fail", ERROR,
                                    "Contains forbidden pattern(s): %s" % ", ".join(present),
                                    len(present)))
        else:
            findings.append(_passed("G-FORBIDDEN"))
    return findings


# ---------------------------------------------------------------------------- echo


def grade_echo(item, output, checks):
    """Verbatim reuse of the prompt. A critique that quotes is fine; one that pastes is not."""
    limit = checks.get("max_echo_tokens")
    if limit is None:
        return []
    reference = item.get("source_text") or item.get("prompt") or ""
    ref_tokens = T.tokens(reference)
    out_tokens = T.tokens(output)
    if not ref_tokens or not out_tokens:
        return [_skipped("G-ECHO", "nothing to compare")]
    span = T.longest_common_span(ref_tokens, out_tokens)
    if span > limit:
        return [finding("G-ECHO", "fail", ERROR,
                        "%d consecutive tokens of the input reappear verbatim (limit %d). "
                        "The model handed the input back." % (span, limit), span)]
    return [_passed("G-ECHO", value=span)]


# ---------------------------------------------------------------------------- loop


def grade_repetition(item, output, checks):
    """Looping, the failure that makes a draft unreadable and unreviewable."""
    findings = []
    out_tokens = T.tokens(output)
    gram_size = checks.get("repeat_ngram", 8)
    max_repeat = checks.get("max_ngram_repeat", 1)
    count, gram = T.max_ngram_repeat(out_tokens, gram_size)
    if count > max_repeat:
        findings.append(finding("G-LOOP", "fail", ERROR,
                                "The %d-gram %r appears %d times." % (gram_size, gram, count),
                                count))
    else:
        findings.append(_passed("G-LOOP", value=count))

    floor = checks.get("min_distinct_3")
    if floor is not None and len(out_tokens) >= 40:
        ratio = round(T.distinct_ratio(out_tokens, 3), 4)
        if ratio < floor:
            findings.append(finding("G-DISTINCT", "fail", ERROR,
                                    "Only %.0f%% of trigrams are unique (floor %.0f%%)."
                                    % (ratio * 100, floor * 100), ratio))
        else:
            findings.append(_passed("G-DISTINCT", value=ratio))

    seen = {}
    for sentence in T.sentences(output):
        key = T.normalize(sentence)
        if len(key.split()) < 6:
            continue
        seen[key] = seen.get(key, 0) + 1
    duplicates = [s for s, n in seen.items() if n > 1]
    if duplicates:
        findings.append(finding("G-DUP-SENTENCE", "fail", ERROR,
                                "Repeated sentence: %r" % duplicates[0][:90], len(duplicates)))
    else:
        findings.append(_passed("G-DUP-SENTENCE", value=0))
    return findings


# ------------------------------------------------------------------------ headline


HEADLINE_LINE_RE = re.compile(r"^\s*(?:\d+[.)]|[-*+])\s*(?P<title>.+?)\s*$", re.MULTILINE)


def parse_headlines(output):
    """Numbered or bulleted lines, which is how the model returns title variants."""
    titles = [m.group("title").strip().strip("*_`\"'") for m in HEADLINE_LINE_RE.finditer(output)]
    return [t for t in titles if len(t.split()) >= 2]


def grade_headlines(item, output, checks):
    """Variants have to be different titles, not one template with a slot filled."""
    if not checks.get("headline_check"):
        return []
    findings = []
    titles = parse_headlines(output)
    wanted = checks.get("min_variants", 6)
    if len(titles) < wanted:
        findings.append(finding("G-HEADLINE-COUNT", "fail", ERROR,
                                "Returned %d usable variants, asked for %d." % (len(titles), wanted),
                                len(titles)))
    else:
        findings.append(_passed("G-HEADLINE-COUNT", value=len(titles)))
    if len(titles) < 2:
        return findings

    ceiling = checks.get("max_variant_similarity", 0.7)
    worst, pair = 0.0, None
    for i in range(len(titles)):
        for j in range(i + 1, len(titles)):
            score = T.jaccard(T.tokens(titles[i]), T.tokens(titles[j]))
            if score > worst:
                worst, pair = score, (titles[i], titles[j])
    if worst > ceiling:
        findings.append(finding("G-HEADLINE-VARIETY", "fail", ERROR,
                                "Two variants are %.0f%% the same words: %r / %r"
                                % (worst * 100, pair[0], pair[1]), round(worst, 4)))
    else:
        findings.append(_passed("G-HEADLINE-VARIETY", value=round(worst, 4)))

    # The slot-filling tell: a long verbatim run from the prompt wedged into a frame.
    slot_limit = checks.get("max_headline_prompt_span", 5)
    prompt_tokens = T.tokens(item.get("source_text") or item.get("prompt") or "")
    offenders = []
    for title in titles:
        span = T.longest_common_span(prompt_tokens, T.tokens(title))
        if span > slot_limit:
            offenders.append((title, span))
    if offenders:
        findings.append(finding("G-HEADLINE-SLOT", "fail", ERROR,
                                "Topic string pasted into a title frame (%d words verbatim): %r"
                                % (offenders[0][1], offenders[0][0]), len(offenders)))
    else:
        findings.append(_passed("G-HEADLINE-SLOT", value=0))

    long_titles = [t for t in titles if len(t.split()) > checks.get("max_headline_words", 14)]
    if long_titles:
        findings.append(finding("G-HEADLINE-LENGTH", "fail", WARN,
                                "Over-long variant: %r" % long_titles[0], len(long_titles)))
    else:
        findings.append(_passed("G-HEADLINE-LENGTH", value=0))
    return findings


# ------------------------------------------------------------------- shape and form


UNFINISHED_TAIL_RE = re.compile(r"[A-Za-z0-9,;:(\[]$")


def grade_form(item, output, checks):
    """Finished, in-format, and the right length."""
    findings = []
    stripped = (output or "").strip()

    if not stripped:
        return [finding("G-EMPTY", "fail", ERROR, "Empty output.", 0)]

    if checks.get("require_complete", True):
        last_line = stripped.splitlines()[-1].strip()
        fences = stripped.count("```")
        if fences % 2 == 1:
            findings.append(finding("G-TRUNCATED", "fail", ERROR, "Unclosed code fence.", fences))
        elif UNFINISHED_TAIL_RE.search(last_line):
            findings.append(finding("G-TRUNCATED", "fail", ERROR,
                                    "Output stops mid-sentence: %r" % last_line[-60:], None))
        else:
            findings.append(_passed("G-TRUNCATED"))

    typos = T.malformed_contractions(output)
    if typos:
        findings.append(finding("G-TYPO", "fail", ERROR,
                                "Not a word: %s" % ", ".join(repr(t) for t in typos[:5]), len(typos)))
    else:
        findings.append(_passed("G-TYPO", value=0))

    words = len(stripped.split())
    low, high = checks.get("min_words"), checks.get("max_words")
    if low is not None and words < low:
        findings.append(finding("G-LENGTH", "fail", ERROR,
                                "%d words, floor is %d." % (words, low), words))
    elif high is not None and words > high:
        findings.append(finding("G-LENGTH", "fail", ERROR,
                                "%d words, ceiling is %d." % (words, high), words))
    elif low is not None or high is not None:
        findings.append(_passed("G-LENGTH", value=words))
    return findings


# ------------------------------------------------------------------------- numbers


# The trailing guard is a negative lookahead rather than \b, because there is no word
# boundary after "%" and "40%" would never have matched.
NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\s?(?:%|percent|x|ms|s|gb|mb|tb|kb|k|m|b|bn|hours?|minutes?|seconds?|days?|weeks?|months?|years?)(?!\w)", re.IGNORECASE)
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")


def grade_numbers(item, output, checks):
    """Any measurement the model produced that was not in front of it.

    A percentage the input never mentioned is a fabricated claim, and it is the kind
    that survives a read because it looks like evidence.
    """
    if not checks.get("no_new_numbers", True):
        return []
    reference = " ".join([
        item.get("prompt") or "",
        item.get("source_text") or "",
        " ".join(checks.get("allowed_numbers") or []),
    ]).lower()

    def normalise(value):
        return re.sub(r"\s+", "", value.lower()).replace("percent", "%")

    known = {normalise(m) for m in NUMBER_RE.findall(reference)}
    known |= {normalise(m.group(0)) for m in NUMBER_RE.finditer(reference)}
    known |= set(YEAR_RE.findall(reference))

    invented = []
    for match in NUMBER_RE.finditer(output or ""):
        if normalise(match.group(0)) not in known:
            invented.append(match.group(0).strip())
    for match in YEAR_RE.finditer(output or ""):
        if match.group(0) not in known:
            invented.append(match.group(0))

    invented = list(dict.fromkeys(invented))
    if invented:
        return [finding("G-NUMBERS", "fail", ERROR,
                        "Numbers that were not in the input: %s"
                        % ", ".join(repr(n) for n in invented[:6]), len(invented))]
    return [_passed("G-NUMBERS", value=0)]


# ----------------------------------------------------------------------- citations


def grade_citations(item, output, checks, resolver=None, today=None):
    """Fail the run when the model invents a source.

    `citation_policy` decides what "correct" means for the item:
        any             every citation present must be real (the default)
        must_abstain    the model cannot know a source here, so it must say so
        must_cite       the item supplies real sources and expects them used
    """
    policy = checks.get("citation_policy", "any")
    audited = citations_mod.audit(output, resolver=resolver, today=today)
    findings = []

    if policy == "ignore":
        # Used where the item hands the model a bad link on purpose and the correct
        # answer quotes it back while calling it out.
        return [_passed("G-CITATION", "not graded for this item", len(audited))], audited

    invented = [c for c in audited if c["verdict"] == "invented"]
    placeholders = [c for c in audited if c["verdict"] == "placeholder"]
    unverified = [c for c in audited if c["verdict"] == "unverified"]

    if invented:
        findings.append(finding(
            "G-CITATION", "fail", ERROR,
            "Invented source: %s (%s)" % (invented[0]["raw"], invented[0]["reason"]),
            len(invented)))
    elif unverified:
        findings.append(finding(
            "G-CITATION", "fail", WARN,
            "%d citation(s) not verified: %s" % (len(unverified), unverified[0]["reason"]),
            len(unverified)))
    else:
        findings.append(_passed("G-CITATION", value=len(audited)))

    if placeholders:
        findings.append(finding("G-PLACEHOLDER", "fail", WARN,
                                "Placeholder link: %s" % placeholders[0]["raw"], len(placeholders)))

    if policy == "must_abstain":
        real = [c for c in audited if c["verdict"] != "placeholder"]
        abstained = bool(lexicon.hits(output, lexicon.abstain_patterns()))
        if real:
            findings.append(finding(
                "G-ABSTAIN", "fail", ERROR,
                "Asked for a source it cannot have, and produced %d anyway." % len(real),
                len(real)))
        elif not abstained:
            findings.append(finding(
                "G-ABSTAIN", "fail", ERROR,
                "No source and no admission that one is missing. Silence reads as fact.",
                0))
        else:
            findings.append(_passed("G-ABSTAIN"))
    elif policy == "must_cite" and not audited:
        findings.append(finding("G-CITATION-PRESENT", "fail", ERROR,
                                "The item supplied sources and the output cites none.", 0))

    return findings, audited


# -------------------------------------------------------------------------- runner


GRADERS = (grade_tells, grade_edit, grade_terms, grade_echo, grade_repetition,
           grade_headlines, grade_form, grade_numbers)


def grade_output(item, output, checks, resolver=None, today=None):
    """Every check for one item. Returns (findings, citation records)."""
    findings = []
    for grader in GRADERS:
        findings.extend(grader(item, output, checks))
    citation_findings, audited = grade_citations(item, output, checks, resolver, today)
    findings.extend(citation_findings)

    mean_len, stdev_len = T.sentence_length_stats(output)
    findings.append(_passed("M-SENTENCE-MEAN", value=mean_len))
    findings.append(_passed("M-SENTENCE-STDEV", value=stdev_len))
    return findings, audited
