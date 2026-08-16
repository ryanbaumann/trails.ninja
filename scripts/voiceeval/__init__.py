"""Voice eval harness: grade model output the way a reader would fail it.

The split that matters here is generation from grading. `runner` needs a Mac with
MLX and a 20 GB model on disk. Everything else is stdlib Python over JSON, so the
graders run in CI, in a test, and on results captured months ago.

Modules:
    text       tokenisation, overlap, repetition, and interval math
    lexicon    the shared word lists (scripts/lib/voice-lexicon.json)
    citations  extract, format-check, and resolve links, arXiv IDs, and DOIs
    graders    the checks themselves, one function per failure mode
    suite      load the held-out set, apply per-task defaults, check for leakage
    report     scorecards, run-to-run comparison, exit codes
    runner     MLX and HTTP generation
    judge      an advisory rubric pass; never gates
"""

__all__ = [
    "citations",
    "graders",
    "lexicon",
    "report",
    "suite",
    "text",
]
