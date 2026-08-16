# Voice eval scorecard: round4_regraded

| Field | Value |
| --- | --- |
| label | `round4_regraded` |
| suite | `experiment/voice-ft/eval/prompts.jsonl` |
| citations_checked | `offline (unverified)` |

## Headline

1 of 6 items passed every error-level check (17%). With n=6 the 95% interval on that rate is 3% to 56%, which is the honest width of a claim this suite can support.

## Checks

| Check | Severity | Pass | Fail | Skip | Rate | 95% CI |
| --- | --- | --- | --- | --- | --- | --- |
| `G-EMDASH` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-AI-TELLS` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-ANNOUNCE` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-HYPE` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-SCAFFOLD` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-UNSOURCED-CLAIM` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-WEAK` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-EDIT-DELTA` | - | 0 | 0 | 6 | 100% | 0–100% |
| `G-ECHO` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-LOOP` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-DUP-SENTENCE` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-TRUNCATED` | error | 4 | 2 | 0 | 67% | 30–90% |
| `G-TYPO` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-LENGTH` | - | 6 | 0 | 0 | 100% | 61–100% |
| `G-NUMBERS` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-CITATION` | error | 5 | 1 | 0 | 83% | 44–97% |
| `G-DISTINCT` | - | 4 | 0 | 0 | 100% | 51–100% |
| `G-HEADLINE-COUNT` | - | 1 | 0 | 0 | 100% | 21–100% |
| `G-HEADLINE-VARIETY` | - | 1 | 0 | 0 | 100% | 21–100% |
| `G-HEADLINE-SLOT` | error | 0 | 1 | 0 | 0% | 0–79% |
| `G-HEADLINE-LENGTH` | - | 1 | 0 | 0 | 100% | 21–100% |

## By task

| Task | Items | Clean | Failing ids |
| --- | --- | --- | --- |
| Edit | 2 | 1 | `eval_02` |
| Critique | 1 | 0 | `eval_03` |
| Headline | 1 | 0 | `eval_04` |
| Draft | 1 | 0 | `eval_05` |
| Present | 1 | 0 | `eval_06` |

## Every failure, with its evidence

### `eval_02` (Edit)

- **G-HYPE** (error): hype: 'innovative'

```text
## The result

We just shipped an innovative solution to enhance system availability.
```

### `eval_03` (Critique)

- **G-AI-TELLS** (error): ai_tells: "In today's fast-paced"
- **G-ECHO** (error): 13 consecutive tokens of the input reappear verbatim (limit 12). The model handed the input back.

```text
This draft falls into performativeAI and generic corporate speak:

1. **AI tropes:** 'Fast-paced digital world' and 'an array of challenges' read like an LLM generated them.
2. **Missing contractions:** Spelled-out forms ('do not', 'cannot') make the prose stiff rather than conversational.
3. **Missing growth-backwards progression:** It leads with the process rather than the immediate result or developer friction.

Here is how I would rewrite it in Ryan's voice:

In today's fast-paced digital world, developers face numerous challenges with API integrations.
```

### `eval_04` (Headline)

- **G-HEADLINE-SLOT** (error): Topic string pasted into a title frame (7 words verbatim): 'why prompt engineering hits an RLHF ceiling: lessons from live traces'
- **G-TRUNCATED** (error): Output stops mid-sentence: 'hits an RLHF ceiling: why most developer teams miss the mark'

```text
1. why prompt engineering hits an RLHF ceiling: lessons from live traces
2. what happens when prompt engineering hits an RLHF ceiling breaks
3. the architecture behind why prompt engineering hits an RLHF ceiling
4. stop guessing: why prompt engineering hits an RLHF ceiling requires ground truth
5. what shipped: how we solved prompt engineering hits an RLHF ceiling
6. what I learned deploying prompt engineering hits an RLHF ceiling
7. beyond prompting: the real architectural tradeoff in prompt engineering hits an RLHF ceiling
8. prompt engineering hits an RLHF ceiling: why most developer teams miss the mark
```

### `eval_05` (Draft)

- **G-LOOP** (error): The 8-gram 'with a smaller vocabulary and a more recent' appears 3 times.
- **G-DUP-SENTENCE** (error): Repeated sentence: 'the model i just shipped still has the same architecture, with a smaller vocabulary and a '
- **G-TYPO** (error): Not a word: "doesn's"

```text
This is the model that the prompt asks for. It's a local, current model. It's not even an older version. The model I just shipped still has the same architecture, with a smaller vocabulary and a more recent training set. A model with a smaller vocabulary and a more recent training set should be cheaper to train. It also has a lower latency because it doesn's need to call a remote model over the internet. The local model is cheaper to train. It still has better performance than many bigger models, especially on some tasks and on smaller datasets. The local model can be fine-tuned on your own device. That is what makes it so powerful.

The model I just shipped still has the same architecture,
[...]
```

### `eval_06` (Present)

- **G-LOOP** (error): The 8-gram 'https github com ryanbaumann fieldwork agent eval summary' appears 5 times.
- **G-DUP-SENTENCE** (error): Repeated sentence: 'the grading can happen at the same time as the code writing and evaluation.'
- **G-TRUNCATED** (error): Output stops mid-sentence: 'The task is a decision, and the grader is a person,'
- **G-CITATION** (error): Invented source: arxiv.org/abs/24606.24282 (arXiv IDs are YYMM.NNNNN; '24606.24282' is not)

```text
This presentation is live-coding an agentic map application using [agent-evaluated examples](https://arxiv.org/abs/24606.24282) and [the [agent-based evaluation framework](https://github.com/ryanbaumann/fieldwork/blob/main/agent-eval-framework-and-examples-script/agent-eval-summary.md)).

## The prompt that works

The prompt that works for this task uses an [agent-evaluated example](https://arxiv.org/abs/24606.24282) and an [agent-based evaluation framework](https://github.com/ryanbaumann/fieldwork/blob/main/agent-eval-summary.md).

The system prompt should use [agentic [instructions](https://developers.google.com/maps/ai/agent-skills-fieldwork/)](https://developers.google.com/maps/ai/agent-
[...]
```

## Descriptive, not graded

- `M-SENTENCE-MEAN`: 11.54
- `M-SENTENCE-STDEV`: 4.89

Mechanical checks decide what is printed above. Whether the opening lands, whether the credit is honest, and whether the piece should exist are not in this file and are not going to be.
