#!/usr/bin/env python3
"""Voice eval harness.

    python3 scripts/voice_eval.py run --adapter adapters/ryan-voice-v5 --label r5
    python3 scripts/voice_eval.py grade --results experiment/voice-ft/eval/results/r5.json
    python3 scripts/voice_eval.py citations --file portfolio/content/writing/a-post.md
    python3 scripts/voice_eval.py leakage
    python3 scripts/voice_eval.py compare --baseline r4.json --candidate r5.json
    python3 scripts/voice_eval.py judge --results r5.json --model models/gemma-4-31b-it-4bit

`run` needs MLX and a model. Everything else is stdlib Python over JSON and runs
anywhere, including over results captured months ago.

Exit codes: 0 clean, 1 an error-level check failed, 2 the harness itself could not run.
"""

import argparse
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from voiceeval import citations as citations_mod  # noqa: E402
from voiceeval import graders, judge, report, runner, suite  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MODEL = ROOT / "models" / "gemma-4-26b-a4b-it-4bit"
LINK_CACHE = ROOT / "experiment" / "voice-ft" / "eval" / ".link-cache.json"


def build_resolver(args):
    offline = getattr(args, "offline", False)
    return citations_mod.Resolver(cache_path=str(LINK_CACHE), offline=offline)


def grade_records(records, resolver, today=None):
    """Attach findings to a list of {id, task, prompt, source_text, output} records."""
    graded = []
    for record in records:
        item = {
            "id": record["id"],
            "task": record["task"],
            "prompt": record.get("prompt", ""),
            "source_text": record.get("source_text"),
            "checks": record.get("checks"),
        }
        checks = suite.resolve_checks(item)
        findings, audited = graders.grade_output(item, record.get("output", ""),
                                                 checks, resolver=resolver, today=today)
        graded.append({
            "id": record["id"],
            "task": record["task"],
            "prompt": record.get("prompt", ""),
            "source_text": record.get("source_text"),
            "output": record.get("output", ""),
            "findings": findings,
            "citations": audited,
            "seconds": record.get("seconds"),
        })
    return graded


def cross_item_findings(graded):
    """Checks that only exist across a whole run, not inside one output."""
    from voiceeval import text as T

    seen = {}
    for record in graded:
        for phrase in T.shingles(record["output"], 6):
            seen.setdefault(phrase, set()).add(record["id"])
    repeated = sorted(((p, ids) for p, ids in seen.items() if len(ids) >= 3),
                      key=lambda pair: -len(pair[1]))
    findings = []
    for phrase, ids in repeated[:10]:
        findings.append({
            "check": "G-STOCK-PHRASE",
            "status": "fail",
            "severity": "warn",
            "message": '"%s" appears in %d outputs (%s). A phrase the model reaches for '
                       'every time is a template, not a voice.'
                       % (phrase, len(ids), ", ".join(sorted(ids)[:4])),
            "value": len(ids),
        })
    return findings


def write_outputs(label, graded, meta, extra_findings):
    results_dir = suite.results_dir()
    summary = report.summarise(graded)
    payload = {
        "meta": meta,
        "summary": {k: v for k, v in summary.items() if k not in ("checks", "tasks")},
        "checks": {k: dict(v) for k, v in summary["checks"].items()},
        "tasks": {k: dict(v) for k, v in summary["tasks"].items()},
        "cross_item": extra_findings,
        "items": graded,
    }
    json_path = results_dir / ("%s.json" % label)
    with open(str(json_path), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)

    markdown = report.render_markdown(summary, graded, meta)
    if extra_findings:
        markdown += "\n## Across the run\n\n"
        markdown += "\n".join("- **%s** (%s): %s" % (f["check"], f["severity"], f["message"])
                              for f in extra_findings)
        markdown += "\n"
    md_path = results_dir / ("%s_scorecard.md" % label)
    with open(str(md_path), "w", encoding="utf-8") as handle:
        handle.write(markdown)

    print(report.render_console(summary, graded, meta))
    for f in extra_findings:
        print("  %-20s %-5s %s" % (f["check"], f["severity"], f["message"]))
    print("wrote %s" % json_path)
    print("wrote %s" % md_path)
    return summary


def finish(graded, strict_warnings=False):
    errors = report.error_count(graded)
    warnings = report.warn_count(graded)
    print("%d error-level failures, %d warnings" % (errors, warnings))
    if errors:
        return 1
    if strict_warnings and warnings:
        return 1
    return 0


# ----------------------------------------------------------------------------- run


def cmd_run(args):
    items = suite.load_suite(args.suite)
    if args.tasks:
        wanted = {t.strip() for t in args.tasks.split(",")}
        items = [i for i in items if i["task"] in wanted]
    if args.limit:
        items = items[: args.limit]
    if not items:
        print("no items selected", file=sys.stderr)
        return 2

    if args.endpoint:
        backend = runner.HTTPBackend(args.endpoint, args.model or "default",
                                     api_key_env=args.api_key_env)
    else:
        model_path = args.model or str(DEFAULT_MODEL)
        if not os.path.exists(model_path):
            print("model not found at %s. Run scripts/local_gemma.py download first."
                  % model_path, file=sys.stderr)
            return 2
        try:
            backend = runner.MLXBackend(model_path, args.adapter, think=args.think)
        except ImportError:
            print("mlx_lm is not installed. `pip install mlx-lm`, or use --endpoint.",
                  file=sys.stderr)
            return 2

    leaks = suite.check_leakage(items)
    hard_leaks = [f for f in leaks if f["severity"] == "error"]
    if hard_leaks and not args.allow_leakage:
        for f in hard_leaks:
            print("leakage: %s %s %s" % (f["id"], f["message"], f["shared"]), file=sys.stderr)
        print("These items overlap the training data, so they measure recall rather than "
              "generalisation. Fix the suite or pass --allow-leakage.", file=sys.stderr)
        return 2
    for f in leaks:
        if f["severity"] == "warn":
            print("note: %s" % f["message"])

    records = []
    for index, item in enumerate(items, start=1):
        for sample in range(args.samples):
            seed = args.seed + sample
            messages = runner.build_messages(item)
            output, seconds = backend.generate(
                messages, max_tokens=args.max_tokens, temperature=args.temperature,
                seed=seed)
            record = dict(item)
            record["id"] = item["id"] if args.samples == 1 else "%s#%d" % (item["id"], sample + 1)
            record["output"] = output
            record["seconds"] = seconds
            record["seed"] = seed
            records.append(record)
            print("  [%2d/%2d] %-16s %4d words  %5.1fs"
                  % (index, len(items), record["id"], len(output.split()), seconds))

    resolver = build_resolver(args)
    graded = grade_records(records, resolver)
    resolver.save()

    meta = {
        "label": args.label,
        "suite": str(args.suite or suite.default_suite_path()),
        "generated_at": datetime.now().replace(microsecond=0).isoformat(),
        "temperature": args.temperature,
        "seed": args.seed,
        "samples": args.samples,
        "citations_checked": "offline (unverified)" if args.offline else "resolved over the network",
    }
    meta.update(backend.describe())
    write_outputs(args.label, graded, meta, cross_item_findings(graded))
    return finish(graded, args.strict)


# --------------------------------------------------------------------------- grade


def _load_records(path):
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if isinstance(payload, dict) and "items" in payload:
        return payload["items"], payload.get("meta", {})
    if isinstance(payload, list):
        return payload, {}
    raise ValueError("%s is not a results file" % path)


def _rehydrate(records, items_by_id):
    """Old results files carry no source_text or checks. Put them back from the suite."""
    out = []
    for record in records:
        base_id = record["id"].split("#")[0]
        item = items_by_id.get(base_id)
        merged = dict(record)
        if item:
            merged.setdefault("source_text", item.get("source_text"))
            merged.setdefault("checks", item.get("checks"))
            if not merged.get("prompt"):
                merged["prompt"] = item["prompt"]
            merged["task"] = merged.get("task") or item["task"]
        out.append(merged)
    return out


def cmd_grade(args):
    records, meta = _load_records(args.results)
    items_by_id = {}
    try:
        items_by_id = {i["id"]: i for i in suite.load_suite(args.suite)}
    except (IOError, OSError, ValueError) as error:
        print("note: could not load suite for context (%s)" % error)
    records = _rehydrate(records, items_by_id)

    resolver = build_resolver(args)
    today = date.fromisoformat(args.today) if args.today else None
    graded = grade_records(records, resolver, today=today)
    resolver.save()

    label = args.label or (Path(args.results).stem + "_graded")
    meta = dict(meta)
    meta.update({
        "label": label,
        "suite": args.suite or suite.default_suite_path(),
        "graded_at": datetime.now().replace(microsecond=0).isoformat(),
        "citations_checked": "offline (unverified)" if args.offline else "resolved over the network",
        "source_results": str(args.results),
    })
    write_outputs(label, graded, meta, cross_item_findings(graded))
    return finish(graded, args.strict)


# ----------------------------------------------------------------------- citations


def cmd_citations(args):
    targets = []
    for path in args.file:
        with open(path, "r", encoding="utf-8") as handle:
            targets.append((path, handle.read()))
    for path in args.results or []:
        records, _ = _load_records(path)
        for record in records:
            targets.append(("%s:%s" % (Path(path).name, record["id"]), record.get("output", "")))

    if not targets:
        print("nothing to check; pass --file or --results", file=sys.stderr)
        return 2

    resolver = build_resolver(args)
    today = date.fromisoformat(args.today) if args.today else None
    invented, unverified, ok = [], [], 0
    for name, body in targets:
        for record in citations_mod.audit(body, resolver=resolver, today=today):
            line = "%-40s %-11s %s" % (name[:40], record["verdict"], record["raw"])
            if record["verdict"] == "invented":
                invented.append((line, record["reason"]))
            elif record["verdict"] in ("unverified", "placeholder"):
                unverified.append((line, record["reason"]))
            else:
                ok += 1
    resolver.save()

    for line, reason in invented:
        print("%s  <- %s" % (line, reason))
    for line, reason in unverified:
        print("%s  <- %s" % (line, reason))
    print("\n%d resolved, %d unverified, %d invented" % (ok, len(unverified), len(invented)))
    if invented:
        return 1
    if unverified and args.strict:
        return 1
    return 0


# ------------------------------------------------------------------------ leakage


def cmd_leakage(args):
    items = suite.load_suite(args.suite)
    print("suite: %d items across %s" % (len(items), suite.coverage_report(items)))
    findings = suite.check_leakage(items, training_dir=args.training, shingle=args.shingle)
    errors = 0
    for f in findings:
        print("%-8s %-14s %s %s" % (f["severity"], f["id"] or "-", f["message"], f["shared"] or ""))
        errors += 1 if f["severity"] == "error" else 0
    if not findings:
        print("no %d-word overlap between the held-out set and the training data" % args.shingle)
    return 1 if errors else 0


# ------------------------------------------------------------------------ compare


def cmd_compare(args):
    baseline, base_meta = _load_records(args.baseline)
    candidate, cand_meta = _load_records(args.candidate)
    items_by_id = {}
    try:
        items_by_id = {i["id"]: i for i in suite.load_suite(args.suite)}
    except (IOError, OSError, ValueError):
        pass
    resolver = citations_mod.Resolver(cache_path=str(LINK_CACHE), offline=True)
    graded_base = grade_records(_rehydrate(baseline, items_by_id), resolver)
    graded_cand = grade_records(_rehydrate(candidate, items_by_id), resolver)

    diff = report.compare(graded_base, graded_cand)
    base_label = base_meta.get("label") or Path(args.baseline).stem
    cand_label = cand_meta.get("label") or Path(args.candidate).stem
    text = report.render_comparison(diff, base_label, cand_label)
    print(text)
    out = suite.results_dir() / ("compare_%s_vs_%s.md" % (cand_label, base_label))
    with open(str(out), "w", encoding="utf-8") as handle:
        handle.write(text)
    print("wrote %s" % out)
    return 1 if diff["broken"] else 0


# -------------------------------------------------------------------------- judge


def cmd_judge(args):
    records, _ = _load_records(args.results)
    if args.limit:
        records = records[: args.limit]
    model_path = args.model or str(DEFAULT_MODEL)
    if args.endpoint:
        backend = runner.HTTPBackend(args.endpoint, args.model or "default",
                                     api_key_env=args.api_key_env)
    else:
        try:
            backend = runner.MLXBackend(model_path, adapter_path=None, think=False)
        except ImportError:
            print("mlx_lm is not installed. `pip install mlx-lm`, or use --endpoint.",
                  file=sys.stderr)
            return 2

    reviewed = []
    for record in records:
        output = record.get("output", "")
        if not output.strip():
            continue
        entry = {"id": record["id"], "task": record.get("task", "?"),
                 "review": judge.review(backend, output)}
        reference = record.get("reference")
        if reference:
            entry["pairwise"] = judge.pairwise(backend, output, reference)
        reviewed.append(entry)
        print("  judged %s" % record["id"])

    label = args.label or (Path(args.results).stem + "_advisory")
    out = suite.results_dir() / ("%s.md" % label)
    with open(str(out), "w", encoding="utf-8") as handle:
        handle.write(judge.render_markdown(reviewed, label))
    with open(str(suite.results_dir() / ("%s.json" % label)), "w", encoding="utf-8") as handle:
        json.dump(reviewed, handle, indent=2, ensure_ascii=False)
    print("wrote %s (advisory only; exit code is always 0)" % out)
    return 0


# --------------------------------------------------------------------------- main


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command")

    def add_common(p):
        p.add_argument("--suite", default=None, help="held-out suite JSONL")
        p.add_argument("--offline", action="store_true",
                       help="skip network citation resolution and mark the run unverified")
        p.add_argument("--strict", action="store_true", help="treat warnings as failures")
        p.add_argument("--today", default=None,
                       help="ISO date used for arXiv plausibility, for reproducible tests")

    run = sub.add_parser("run", help="generate and grade")
    add_common(run)
    run.add_argument("--model", default=None)
    run.add_argument("--adapter", default=None)
    run.add_argument("--endpoint", default=None, help="OpenAI-compatible base URL, e.g. http://localhost:8080/v1")
    run.add_argument("--api-key-env", default="VOICE_EVAL_API_KEY")
    run.add_argument("--label", default="run")
    run.add_argument("--tasks", default=None, help="comma-separated task filter")
    run.add_argument("--limit", type=int, default=0)
    run.add_argument("--samples", type=int, default=1,
                     help="generations per prompt; >1 measures run-to-run variance")
    run.add_argument("--max-tokens", type=int, default=1024)
    run.add_argument("--temperature", type=float, default=0.7)
    run.add_argument("--seed", type=int, default=11)
    run.add_argument("--think", action="store_true", help="leave thinking mode on")
    run.add_argument("--allow-leakage", action="store_true")
    run.set_defaults(func=cmd_run)

    grade = sub.add_parser("grade", help="grade a stored results file")
    add_common(grade)
    grade.add_argument("--results", required=True)
    grade.add_argument("--label", default=None)
    grade.set_defaults(func=cmd_grade)

    cites = sub.add_parser("citations", help="resolve every citation in files or results")
    add_common(cites)
    cites.add_argument("--file", action="append", default=[])
    cites.add_argument("--results", action="append", default=[])
    cites.set_defaults(func=cmd_citations)

    leak = sub.add_parser("leakage", help="check the suite against the training data")
    add_common(leak)
    leak.add_argument("--training", default=None)
    leak.add_argument("--shingle", type=int, default=8)
    leak.set_defaults(func=cmd_leakage)

    comp = sub.add_parser("compare", help="item-level diff between two runs")
    add_common(comp)
    comp.add_argument("--baseline", required=True)
    comp.add_argument("--candidate", required=True)
    comp.set_defaults(func=cmd_compare)

    jdg = sub.add_parser("judge", help="advisory rubric review; never gates")
    add_common(jdg)
    jdg.add_argument("--results", required=True)
    jdg.add_argument("--model", default=None)
    jdg.add_argument("--endpoint", default=None)
    jdg.add_argument("--api-key-env", default="VOICE_EVAL_API_KEY")
    jdg.add_argument("--label", default=None)
    jdg.add_argument("--limit", type=int, default=0)
    jdg.set_defaults(func=cmd_judge)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        return 2
    try:
        return args.func(args)
    except (IOError, OSError, ValueError, RuntimeError) as error:
        print("error: %s" % error, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
