"""Token and string math shared by the graders.

Nothing here knows about voice. It answers mechanical questions: how much of this
output is the input verbatim, does any phrase repeat, how wide is the confidence
interval on six samples.
"""

import math
import re
import unicodedata
from collections import Counter

WORD_RE = re.compile(r"[a-z0-9]+(?:['’][a-z]+)?")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])[\s\n]+|\n{2,}")

# Markdown scaffolding that should not count as a difference between two texts.
MARKUP_RE = re.compile(
    r"^\s{0,3}#{1,6}\s+"          # headings
    r"|^\s{0,3}[-*+]\s+"          # bullets
    r"|^\s{0,3}\d+[.)]\s+"        # ordered list markers
    r"|^\s{0,3}>\s?"              # block quotes
    r"|\*{1,3}|`{1,3}|_{1,3}",    # emphasis and code spans
    re.MULTILINE,
)

STOPWORDS = frozenset("""
a about above after again against all am an and any are aren't as at be because been
before being below between both but by can cannot can't could couldn't did didn't do
does doesn't doing don't down during each few for from further had hadn't has hasn't
have haven't having he her here hers herself him himself his how i i'd i'll i'm i've
if in into is isn't it it's its itself just let's me more most mustn't my myself no
nor not of off on once only or other ought our ours ourselves out over own same shan't
she should shouldn't so some such than that that's the their theirs them themselves
then there there's these they they'd they'll they're they've this those through to too
under until up very was wasn't we we'd we'll we're we've were weren't what what's when
where which while who whom why will with won't would wouldn't you you'd you'll you're
you've your yours yourself yourselves
""".split())

# Clipped forms that are correct even though the tail is not a normal suffix.
VALID_CONTRACTIONS = frozenset("""
o'clock ma'am y'all ne'er e'er ol' rock'n'roll
""".split())

# Stems that exist only in front of "n't". "doesn's" is the round-four typo this
# catches: it ends in "'s", so a naive possessive rule waves it through.
NEGATED_STEMS = frozenset("""
ain aren can couldn daren didn doesn don hadn hasn haven isn mightn mustn needn
oughtn shan shouldn wasn weren won wouldn
""".split())

# Suffixes a real English contraction or possessive can end in.
VALID_TAILS = frozenset(["s", "d", "ll", "re", "ve", "m", "t"])


def normalize(text):
    """Lowercase, strip markdown scaffolding, and flatten whitespace and quotes."""
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = MARKUP_RE.sub(" ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def tokens(text):
    """Word tokens from normalised text."""
    return WORD_RE.findall(normalize(text))


def content_tokens(text):
    """Tokens that carry meaning. Overlap on these is what "same content" means."""
    return [t for t in tokens(text) if t not in STOPWORDS and len(t) > 2]


def sentences(text):
    """Sentence-ish units. Good enough for length variance and repeat detection."""
    stripped = re.sub(r"```.*?```", " ", text or "", flags=re.DOTALL)
    parts = SENTENCE_SPLIT_RE.split(stripped)
    return [p.strip() for p in parts if p and p.strip()]


def ngrams(seq, n):
    """All n-grams of a token sequence, as tuples."""
    if n <= 0 or len(seq) < n:
        return []
    return [tuple(seq[i:i + n]) for i in range(len(seq) - n + 1)]


def jaccard(a, b):
    """Set overlap of two token sequences. 1.0 means identical vocabulary."""
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / float(len(sa | sb))


def token_f1(a, b):
    """Multiset F1 over tokens: how much of each text the other one accounts for.

    Symmetric, and unlike Jaccard it notices when a word is used three times in one
    text and once in the other.
    """
    ca, cb = Counter(a), Counter(b)
    overlap = sum((ca & cb).values())
    if not overlap:
        return 0.0
    precision = overlap / float(sum(cb.values()))
    recall = overlap / float(sum(ca.values()))
    return 2 * precision * recall / (precision + recall)


def coverage(source_tokens, output_tokens):
    """Fraction of the source's distinct tokens that survive into the output.

    Asymmetric on purpose. An edit that keeps every fact and adds a sentence should
    score 1.0; an edit that drops half the meaning should not.
    """
    src = set(source_tokens)
    if not src:
        return 1.0
    return len(src & set(output_tokens)) / float(len(src))


def longest_common_span(a, b):
    """Length of the longest run of tokens appearing verbatim in both sequences.

    This is the echo detector. A critique that pastes its input back has a span the
    length of the input; a critique that quotes one phrase has a span of five.
    """
    if not a or not b:
        return 0
    previous = [0] * (len(b) + 1)
    best = 0
    for i in range(1, len(a) + 1):
        current = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                run = previous[j - 1] + 1
                current[j] = run
                if run > best:
                    best = run
        previous = current
    return best


def distinct_ratio(seq, n):
    """Unique n-grams over total n-grams. Drops as a generation starts looping."""
    grams = ngrams(seq, n)
    if not grams:
        return 1.0
    return len(set(grams)) / float(len(grams))


def max_ngram_repeat(seq, n):
    """Highest repeat count of any single n-gram, and the n-gram itself."""
    grams = ngrams(seq, n)
    if not grams:
        return 0, None
    gram, count = Counter(grams).most_common(1)[0]
    return count, " ".join(gram)


def shingles(text, size=6):
    """Distinct word shingles, matching the site's W-STOCK-PHRASE rule."""
    toks = tokens(text)
    return {" ".join(g) for g in ngrams(toks, size)}


def sentence_length_stats(text):
    """Mean and standard deviation of words per sentence."""
    lengths = [len(s.split()) for s in sentences(text)]
    lengths = [n for n in lengths if n > 0]
    if not lengths:
        return 0.0, 0.0
    mean = sum(lengths) / float(len(lengths))
    if len(lengths) < 2:
        return round(mean, 2), 0.0
    variance = sum((n - mean) ** 2 for n in lengths) / float(len(lengths) - 1)
    return round(mean, 2), round(math.sqrt(variance), 2)


def wilson_interval(successes, total, z=1.96):
    """Wilson score interval for a pass rate.

    Six prompts is a signal and not a result, and this is the function that says so
    out loud: 5/6 carries a 95% interval of roughly [0.42, 0.99].
    """
    if total <= 0:
        return 0.0, 1.0
    p = successes / float(total)
    denominator = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return round(max(0.0, centre - margin), 4), round(min(1.0, centre + margin), 4)


def malformed_contractions(text):
    """Apostrophised tokens that are not real contractions or possessives."""
    bad = []
    for match in re.finditer(r"\b[A-Za-z]+['’][A-Za-z]+\b", text or ""):
        raw = match.group(0)
        token = raw.replace("’", "'").lower()
        if token in VALID_CONTRACTIONS:
            continue
        stem, _, tail = token.partition("'")
        if stem in NEGATED_STEMS:
            # These stems are only ever followed by "t".
            if tail != "t":
                bad.append(raw)
            continue
        if tail in VALID_TAILS:
            continue
        bad.append(raw)
    return bad
