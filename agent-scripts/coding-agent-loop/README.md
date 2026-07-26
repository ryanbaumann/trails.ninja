# Loop Engineering Coding Agent

A vendor-neutral operating contract for coding agents that need to inspect,
change, test, review, delegate, recover, and stop without losing user intent or
repository state.

## Install it with your agent

Give this package URL to the coding agent you already use:

```text
Install this coding-agent operating contract globally for every compatible
agent harness on this computer:
https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop

Use each harness's native user-level instructions and skills. Install
SYSTEM_PROMPT.md as the always-on contract and the four files under roles/ as
optional role skills or equivalent on-demand instructions. Preserve existing
global guidance, do not change model or permission settings, and verify what
each harness will load. Report the files changed and any harness you could not
configure.
```

The agent should inspect the installed tools and their current conventions
rather than assume paths from this README. That keeps the package useful as
agent products change. Reuse the same instruction when you want to update the
installed copy.

---

## Harness Compatibility & Setup Guide

| Agent Harness | Discovery & Configuration Paths | Subagent / Overlay Integration |
| :--- | :--- | :--- |
| **Google Antigravity / AGY / AG2.0** | `~/.gemini/config/agents/<role>.md`<br>`.agents/agents/<role>.md` | Native frontmatter (`subagent: true`, tool flags), interactive `/agents` panel, and `invoke_subagent` dispatch. |
| **Anthropic Claude Code** | `~/.claude/CLAUDE.md`<br>`.claude/agents/<role>.md` | Append `SYSTEM_PROMPT.md` to `CLAUDE.md`. Copy `roles/*.md` into `.claude/agents/` for subagent dispatch. |
| **OpenAI Codex** | `.codex/instructions.md`<br>Global system prompt | Ingest `SYSTEM_PROMPT.md` into global system instructions; inject role prompt overlays per sub-session. |
| **OpenCode** | `.opencode/instructions.md`<br>`opencode.json` | Register `SYSTEM_PROMPT.md` as primary project instruction; load `roles/*.md` as subagent skills. |
| **Aider** | `.aider.conf.yml` (`system-prompt`) | Set `system-prompt: SYSTEM_PROMPT.md` in `.aider.conf.yml`. Read role files on demand via `/read roles/<role>.md`. |

---

## Use the roles only when the job needs them

Every agent receives [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md). A normal,
single-agent coding task needs nothing else.

For multi-agent work, assign exactly one overlay to each participant:

- **Orchestrator:** owns intent, task boundaries, write ownership, integration,
  final verification, and the user-facing result.
- **Worker:** completes one bounded task packet and reports evidence back.
- **Reviewer:** reads the supplied change independently and does not edit it.
- **Verifier:** maps acceptance criteria to observed checks after implementation.

Skill-aware harnesses can register the four files as on-demand skills. In subagent-capable harnesses (such as Antigravity or OpenCode), the four role files in `roles/` include YAML frontmatter (`subagent: true`, `enable_write_tools`, `enable_subagent_tools`, `enable_mcp_tools`, `model`) allowing them to be registered directly as subagents and invoked asynchronously.

The overlays make a job narrower. They never grant permissions that the shared
contract or the user did not grant. Give every worker a concrete objective,
done condition, read/write boundaries, verifier, output format, and stop rule.

## Files

- [`SYSTEM_PROMPT.md`](SYSTEM_PROMPT.md): canonical complete prompt.
- [`roles/orchestrator.md`](roles/orchestrator.md): root control-plane overlay with subagent YAML frontmatter.
- [`roles/worker.md`](roles/worker.md): bounded maker or investigator overlay with subagent YAML frontmatter.
- [`roles/reviewer.md`](roles/reviewer.md): read-only finding and risk overlay with subagent YAML frontmatter.
- [`roles/verifier.md`](roles/verifier.md): evidence-only verification overlay with subagent YAML frontmatter.
- [`evals/cases.md`](evals/cases.md): regression cases and grading rubric.
- [`evals/check.sh`](evals/check.sh): deterministic structural contract check.

The harness must still enforce workspace boundaries, network policy, protected
paths, approvals, and audit logging. A prompt cannot enforce its own security
guarantees.

Do not hard-code model names into the evergreen prompt. Configure routing in the
harness using measured capability profiles such as fast, balanced, and deep,
plus the available reasoning effort. Re-run the regression suite whenever the
prompt, model, tool interface, permissions, or harness changes.

Run the deterministic structural check with `bash evals/check.sh`.

## Evaluation status

The checked-in suite defines 17 regression scenarios and a 20-point rubric.
For a revision, C01–C13 are the development cases and C14–C17 are a held-out
selection gate: accept only a bounded prompt edit that strictly improves the
held-out result with no safety regression. The deterministic structural check
passes, and a separate read-only agent review identified issues that were
corrected. That correlated review is not independent proof, and no behavioral
trial results are recorded yet. This package does not claim a statistically
meaningful cross-model behavioral benchmark.
Run repeated trials in your target harness and record the exact prompt, case
split, fixture, model, reasoning effort, tools, permissions, environment,
transcripts, diffs, scores, and final state before treating it as
production-qualified. A repository's versioned learning log is a useful source
for new cases, but retrieve it narrowly and verify each claim against current
evidence before encoding it into the contract.

## Design basis

The package applies a consistent set of findings from current agent-harness and
software-agent work:

- Keep always-loaded instructions small and use progressive disclosure.
- Make repository knowledge legible, versioned, and mechanically checked.
- Treat tool design, permissions, and environment feedback as part of the agent,
  not as afterthoughts to the model prompt.
- Separate orchestration, implementation, review, and verification roles.
- Grade outcomes and trajectories with deterministic, model, and human evidence
  matched to the behavior.
- Carry explicit state across long-running sessions and leave clean checkpoints.
- Promote learnings through evidence and review rather than automatic memory.

Primary references include [OpenAI's harness engineering
report](https://openai.com/index/harness-engineering/), [Anthropic's context
engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[long-running harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents),
and [agent evaluation](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
guidance, the [SWE-agent ACI
paper](https://proceedings.neurips.cc/paper_files/paper/2024/file/5a7c947568c1b1328ccc5230172e1e7c-Paper-Conference.pdf),
and the open-source [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent),
[OpenHands](https://github.com/OpenHands/OpenHands), and
[Aider](https://aider.chat/docs/usage/modes.html) projects.

## License

Use and adapt this prompt with attribution. The repository license governs this
directory.
