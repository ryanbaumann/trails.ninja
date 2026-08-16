"""Turn findings into a scorecard, a comparison, and an exit code.

The report deliberately refuses to produce a single quality number. It reports a pass
rate per check with a Wilson interval next to it, so "5 of 6 passed" is printed as
what it is: a point estimate with a 95% interval running from 42% to 99%.
"""

from collections import OrderedDict

from . import text as T

STATUS_ICON = {"pass": "ok", "fail": "FAIL", "skip": "--"}


def summarise(graded, suite_size=None):
    """Aggregate per-check and per-task outcomes across a run."""
    checks = OrderedDict()
    tasks = OrderedDict()
    metrics = OrderedDict()

    for record in graded:
        task = record["task"]
        task_row = tasks.setdefault(task, {"items": 0, "clean": 0, "failed_ids": []})
        task_row["items"] += 1
        item_errors = [f for f in record["findings"]
                       if f["status"] == "fail" and f["severity"] == "error"]
        if not item_errors:
            task_row["clean"] += 1
        else:
            task_row["failed_ids"].append(record["id"])

        for f in record["findings"]:
            if f["check"].startswith("M-"):
                if f["value"] is not None:
                    metrics.setdefault(f["check"], []).append(f["value"])
                continue
            row = checks.setdefault(f["check"], {
                "pass": 0, "fail": 0, "skip": 0, "severity": "error", "examples": []})
            row[f["status"]] += 1
            if f["status"] == "fail":
                row["severity"] = f["severity"]
                if len(row["examples"]) < 3:
                    row["examples"].append({"id": record["id"], "message": f["message"]})

    total_items = len(graded)
    clean_items = sum(1 for r in graded
                      if not [f for f in r["findings"]
                              if f["status"] == "fail" and f["severity"] == "error"])

    return {
        "items": total_items,
        "suite_size": suite_size if suite_size is not None else total_items,
        "clean_items": clean_items,
        "clean_rate": round(clean_items / float(total_items), 4) if total_items else 0.0,
        "clean_interval": T.wilson_interval(clean_items, total_items),
        "checks": checks,
        "tasks": tasks,
        "metrics": {k: round(sum(v) / float(len(v)), 2) for k, v in metrics.items() if v},
    }


def error_count(graded):
    """Number of error-severity failures across a run. This is the exit code driver."""
    return sum(1 for r in graded for f in r["findings"]
               if f["status"] == "fail" and f["severity"] == "error")


def warn_count(graded):
    return sum(1 for r in graded for f in r["findings"]
               if f["status"] == "fail" and f["severity"] == "warn")


def render_markdown(summary, graded, meta):
    """A scorecard a person reads, with the failing evidence quoted inline."""
    lines = []
    lines.append("# Voice eval scorecard: %s" % meta.get("label", "run"))
    lines.append("")
    lines.append("| Field | Value |")
    lines.append("| --- | --- |")
    for key in ("label", "model", "adapter", "suite", "generated_at", "temperature",
                "seed", "samples", "citations_checked"):
        if meta.get(key) is not None:
            lines.append("| %s | `%s` |" % (key, meta[key]))
    lines.append("")

    low, high = summary["clean_interval"]
    lines.append("## Headline")
    lines.append("")
    lines.append("%d of %d items passed every error-level check (%.0f%%). With n=%d the 95%% "
                 "interval on that rate is %.0f%% to %.0f%%, which is the honest width of a "
                 "claim this suite can support."
                 % (summary["clean_items"], summary["items"], summary["clean_rate"] * 100,
                    summary["items"], low * 100, high * 100))
    lines.append("")

    lines.append("## Checks")
    lines.append("")
    lines.append("| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |")
    lines.append("| --- | --- | --- | --- | --- | --- | --- |")
    for name, row in summary["checks"].items():
        graded_n = row["pass"] + row["fail"]
        rate = (row["pass"] / float(graded_n)) if graded_n else 1.0
        lo, hi = T.wilson_interval(row["pass"], graded_n)
        lines.append("| `%s` | %s | %d | %d | %d | %.0f%% | %.0f–%.0f%% |"
                     % (name, row["severity"] if row["fail"] else "-", row["pass"],
                        row["fail"], row["skip"], rate * 100, lo * 100, hi * 100))
    lines.append("")

    lines.append("## By task")
    lines.append("")
    lines.append("| Task | Items | Clean | Failing ids |")
    lines.append("| --- | --- | --- | --- |")
    for task, row in summary["tasks"].items():
        lines.append("| %s | %d | %d | %s |"
                     % (task, row["items"], row["clean"],
                        ", ".join("`%s`" % i for i in row["failed_ids"]) or "-"))
    lines.append("")

    failures = [(r, [f for f in r["findings"] if f["status"] == "fail"]) for r in graded]
    failures = [(r, fs) for r, fs in failures if fs]
    if failures:
        lines.append("## Every failure, with its evidence")
        lines.append("")
        for record, found in failures:
            lines.append("### `%s` (%s)" % (record["id"], record["task"]))
            lines.append("")
            for f in found:
                lines.append("- **%s** (%s): %s" % (f["check"], f["severity"], f["message"]))
            excerpt = (record.get("output") or "").strip()
            if excerpt:
                if len(excerpt) > 700:
                    excerpt = excerpt[:700].rstrip() + "\n[...]"
                lines.append("")
                lines.append("```text")
                lines.append(excerpt)
                lines.append("```")
            lines.append("")
    else:
        lines.append("No failures. That is a statement about these %d prompts and nothing wider."
                     % summary["items"])
        lines.append("")

    if summary["metrics"]:
        lines.append("## Descriptive, not graded")
        lines.append("")
        for name, value in summary["metrics"].items():
            lines.append("- `%s`: %s" % (name, value))
        lines.append("")

    lines.append("Mechanical checks decide what is printed above. Whether the opening lands, "
                 "whether the credit is honest, and whether the piece should exist are not in "
                 "this file and are not going to be.")
    lines.append("")
    return "\n".join(lines)


def render_console(summary, graded, meta):
    """Short form for a terminal."""
    lines = []
    lines.append("")
    lines.append("voice eval: %s  (%d items, suite %s)"
                 % (meta.get("label", "run"), summary["items"], meta.get("suite", "?")))
    low, high = summary["clean_interval"]
    lines.append("clean items: %d/%d = %.0f%%  [95%% CI %.0f-%.0f%%]"
                 % (summary["clean_items"], summary["items"], summary["clean_rate"] * 100,
                    low * 100, high * 100))
    lines.append("")
    for name, row in summary["checks"].items():
        if not row["fail"]:
            continue
        lines.append("  %-20s %-5s %d fail" % (name, row["severity"], row["fail"]))
        for example in row["examples"]:
            lines.append("      %-12s %s" % (example["id"], example["message"]))
    lines.append("")
    return "\n".join(lines)


def compare(baseline_graded, candidate_graded):
    """Item-level regression table between two runs of the same suite.

    Averages hide the thing worth knowing, which is whether a round fixed three items
    and broke two others. This lists both.
    """
    base = {r["id"]: r for r in baseline_graded}
    cand = {r["id"]: r for r in candidate_graded}
    shared = [i for i in cand if i in base]

    def failing(record):
        return {f["check"] for f in record["findings"]
                if f["status"] == "fail" and f["severity"] == "error"}

    fixed, broken, still, clean = [], [], [], []
    for item_id in sorted(shared):
        before, after = failing(base[item_id]), failing(cand[item_id])
        if before and not after:
            fixed.append(item_id)
        elif after and not before:
            broken.append((item_id, sorted(after)))
        elif after and before:
            still.append((item_id, sorted(after)))
        else:
            clean.append(item_id)
    return {
        "shared_items": len(shared),
        "only_in_candidate": sorted(set(cand) - set(base)),
        "only_in_baseline": sorted(set(base) - set(cand)),
        "fixed": fixed,
        "broken": broken,
        "still_failing": still,
        "clean_in_both": clean,
    }


def render_comparison(diff, baseline_label, candidate_label):
    lines = []
    lines.append("# %s vs %s" % (candidate_label, baseline_label))
    lines.append("")
    lines.append("%d items in both runs." % diff["shared_items"])
    lines.append("")
    lines.append("- Fixed (%d): %s" % (len(diff["fixed"]),
                                       ", ".join("`%s`" % i for i in diff["fixed"]) or "none"))
    lines.append("- Broken (%d): %s" % (len(diff["broken"]),
                                        ", ".join("`%s` (%s)" % (i, ", ".join(c))
                                                  for i, c in diff["broken"]) or "none"))
    lines.append("- Still failing (%d): %s" % (len(diff["still_failing"]),
                                               ", ".join("`%s` (%s)" % (i, ", ".join(c))
                                                         for i, c in diff["still_failing"]) or "none"))
    lines.append("- Clean in both: %d" % len(diff["clean_in_both"]))
    if diff["only_in_candidate"] or diff["only_in_baseline"]:
        lines.append("")
        lines.append("Suite drift: %d items only in the candidate, %d only in the baseline. "
                     "A comparison across different suites is not a comparison."
                     % (len(diff["only_in_candidate"]), len(diff["only_in_baseline"])))
    lines.append("")
    return "\n".join(lines)
