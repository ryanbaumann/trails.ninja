#!/usr/bin/env python3
import json
from pathlib import Path
from voiceeval import citations as citations_mod, graders, report, suite

results_dir = Path("experiment/voice-ft/eval/results")
resolver = citations_mod.Resolver(offline=True)

rounds = [
    ("R5 (MoE 26B)", results_dir / "r5.json"),
    ("R6 (Dense 31B)", results_dir / "round6_dense.json"),
    ("R7 (MoE 26B)", results_dir / "round7.json"),
    ("R8 (MoE 26B)", results_dir / "round8.json"),
    ("R8 (Dense 31B)", results_dir / "round8_dense.json"),
]

all_check_data = {}
all_tasks = set()
task_data = {}
round_clean_data = {}

for label, p in rounds:
    if not p.exists():
        continue
    with open(p) as f:
        raw = json.load(f)
    items = raw.get("items", raw) if isinstance(raw, dict) else raw
    graded = []
    for record in items:
        item = {
            "id": record["id"],
            "task": record.get("task", "Draft"),
            "prompt": record.get("prompt", ""),
            "source_text": record.get("source_text"),
            "checks": record.get("checks"),
        }
        checks = suite.resolve_checks(item)
        findings, audited = graders.grade_output(item, record.get("output", ""),
                                                 checks, resolver=resolver)
        graded.append({
            "id": record["id"],
            "task": item["task"],
            "output": record.get("output", ""),
            "findings": findings,
            "citations": audited,
        })
    
    summary = report.summarise(graded)
    round_clean_data[label] = (summary["clean_items"], summary["items"], int(round(100.0 * summary["clean_rate"])))
    for chk_name, chk_row in summary["checks"].items():
        if chk_name.startswith("M-"):
            continue
        all_check_data.setdefault(chk_name, {})[label] = (chk_row["pass"], chk_row["fail"], chk_row["skip"])
    for t_name, t_row in summary["tasks"].items():
        all_tasks.add(t_name)
        task_data.setdefault(t_name, {})[label] = (t_row["clean"], t_row["items"])

col_headers = [r[0] for r in rounds if r[1].exists()]

print("=" * 115)
print("                       CHECK-BY-CHECK BREAKDOWN (PASS / TOTAL EVALUATED)")
print("=" * 115)
header = f"{'Check ID':<20} | " + " | ".join(f"{h:<16}" for h in col_headers)
print(header)
print("-" * len(header))

for chk_name in sorted(all_check_data.keys()):
    row_str = f"{chk_name:<20} | "
    cols = []
    for label in col_headers:
        if label in all_check_data[chk_name]:
            p, f, s = all_check_data[chk_name][label]
            tot = p + f
            pct = int(round(100.0 * p / tot)) if tot > 0 else 0
            cols.append(f"{f'{p}/{tot} ({pct:>3}%)':<16}")
        else:
            cols.append(f"{'N/A':<16}")
    row_str += " | ".join(cols)
    print(row_str)

print("\n" + "=" * 115)
print("                               TASK CLEAN PASS RATE BREAKDOWN")
print("=" * 115)
header_tasks = f"{'Task Name':<15} | " + " | ".join(f"{h:<16}" for h in col_headers)
print(header_tasks)
print("-" * len(header_tasks))

for t_name in sorted(all_tasks):
    row_str = f"{t_name:<15} | "
    cols = []
    for label in col_headers:
        if label in task_data[t_name]:
            c, tot = task_data[t_name][label]
            pct = int(round(100.0 * c / tot)) if tot > 0 else 0
            cols.append(f"{f'{c}/{tot} ({pct:>3}%)':<16}")
        else:
            cols.append(f"{'N/A':<16}")
    row_str += " | ".join(cols)
    print(row_str)

print("-" * len(header_tasks))
summary_row = f"{'OVERALL CLEAN':<15} | "
summary_cols = []
for label in col_headers:
    c, tot, pct = round_clean_data[label]
    summary_cols.append(f"{f'{c}/{tot} ({pct:>3}%)':<16}")
summary_row += " | ".join(summary_cols)
print(summary_row)
print("=" * 115)
