#!/usr/bin/env python3
import json
from pathlib import Path
from voiceeval import citations as citations_mod, graders, report, suite

results_dir = Path("experiment/voice-ft/eval/results")
resolver = citations_mod.Resolver(offline=True)

rounds = [
    ("R4 (MoE 6 items)", results_dir / "round4_results.json"),
    ("R5 (MoE 48 items)", results_dir / "r5.json"),
    ("R6 (MoE 48 items)", results_dir / "round6_dynamic.json"),
    ("R6 (Dense 48 items)", results_dir / "round6_dense.json"),
]

all_check_data = {}
all_tasks = set()
task_data = {}

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
    for chk_name, chk_row in summary["checks"].items():
        if chk_name.startswith("M-"):
            continue
        all_check_data.setdefault(chk_name, {})[label] = (chk_row["pass"], chk_row["fail"], chk_row["skip"])
    for t_name, t_row in summary["tasks"].items():
        all_tasks.add(t_name)
        task_data.setdefault(t_name, {})[label] = (t_row["clean"], t_row["items"])

print("==================================================================================================")
print("                       CHECK-BY-CHECK BREAKDOWN (PASS / TOTAL EVALUATED)")
print("==================================================================================================")
header = f"{'Check ID':<22} | {'R4 (MoE)':<16} | {'R5 (MoE)':<16} | {'R6 (MoE)':<16} | {'R6 (Dense 31B)':<16}"
print(header)
print("-" * len(header))
for chk in sorted(all_check_data.keys()):
    row_str = f"{chk:<22}"
    for label, _ in rounds:
        p, f, s = all_check_data.get(chk, {}).get(label, (0, 0, 0))
        tot = p + f
        if tot > 0:
            pct = (p / tot) * 100
            rate = f"{p}/{tot} ({pct:>4.0f}%)"
        else:
            rate = "N/A"
        row_str += f" | {rate:<16}"
    print(row_str)

print("\n==================================================================================================")
print("                               TASK CLEAN PASS RATE BREAKDOWN")
print("==================================================================================================")
theader = f"{'Task Name':<15} | {'R4 (MoE)':<16} | {'R5 (MoE)':<16} | {'R6 (MoE)':<16} | {'R6 (Dense 31B)':<16}"
print(theader)
print("-" * len(theader))
for t in sorted(all_tasks):
    t_str = f"{t:<15}"
    for label, _ in rounds:
        c, tot = task_data.get(t, {}).get(label, (0, 0))
        pct = (c / tot * 100) if tot > 0 else 0
        rate = f"{c}/{tot} ({pct:>4.0f}%)"
        t_str += f" | {rate:<16}"
    print(t_str)
