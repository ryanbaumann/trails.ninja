---
title: The Model That Picks Your Platform Doesn't Write the Code
summary: As open models make code execution cheaper, a developer platform's moat becomes the loop of context, evals, and distribution that keeps critical developer journeys working while the models underneath churn.
date: 2026-07-20
updated: 2026-07-20
canonical: https://ryanbaumann.dev/writing/the-model-that-picks-your-platform-doesnt-write-the-code/
image: /img/writing/model-tiers-header.svg
imageAlt: One dark orchestrator node labeled Decide fans bounded tasks out to a grid of eight smaller worker nodes, one expensive decision routing many cheap builds.
socialImage: /social/the-model-that-picks-your-platform-doesnt-write-the-code.jpg
shareTitle: The Model That Picks Your Platform Doesn't Write the Code
shareSummary: Open models are making execution cheaper. The moat is the loop that keeps your platform working while the models underneath churn.
shareImageAlt: Social card for the field note beside a diagram of one orchestrator node fanning tasks out to many small worker nodes.
tags: ["developer experience", "ai", "field notes"]
draft: false
noindex: false
---

GLM 5.2, Kimi K3, and a steady run of capable open models keep landing, and each one makes it cheaper to build something with your platform. When execution gets this cheap, a developer platform faces one question: what is the moat?

The easy answer is to bet on the smartest model and read this as an open-versus-frontier size race. Watch a real agent session and that framing falls apart. A frontier model reads the intent, resolves the ambiguity, and decides the design: which API fits, where the auth boundary sits, when the work is done. Then it hands bounded tasks to cheaper models that write most of the code. The model that picks your platform is not the model that writes with it.

That split is economic. The orchestrator spends its expensive reasoning on the few decisions that change the outcome. Implementation runs cheaper the moment a task is bounded and the checks are objective, because the compiler, the tests, and the linter catch what a smaller model fumbles. Good verifiers let the cheap tier carry real work. They are why open models keep sliding down the cost curve without ever winning at system design. I [codified this routing](/writing/loop-engineering-coding-agent/) in a [public prompt](https://github.com/ryanbaumann/fieldwork/tree/main/agent-scripts/coding-agent-loop) that sends each job to the least costly model that can do it.

While frontier open models (with trillions of parameters) are still expensive to run and require data center-level GPUs, smaller open models make the rest of the execution significantly cheaper. What's more, using them means builder platforms can own more of how their data is used compared to relying entirely on proprietary models.

Your platform meets this system twice. The orchestrator is where your platform gets chosen, so it decides activation. The workers are where it gets built, so an example tested only on the strongest model is quietly undertested.

![A descending staircase of tiers from Frontier to Balanced to Open, the cost circle shrinking at each step, showing the same journey completing at a cheaper tier.](/img/writing/model-tiers-devx.svg)

The execution scoreboard is consistency. A developer journey is cheap when a small model completes it the same way run after run, with low variance and less context each release. When work that needed Gemini Pro lands just as reliably on Gemini Flash, developers get the same result faster and cheaper, and the same holds for every model family you route. A task that drops a tier is a win worth counting.

The moat is the loop, not any single model. Own the context, evals, and distribution that keep your critical journeys working as the models underneath them churn. Our team runs a version of this for Google Maps Platform through portable [agent skills](/work/agent-skills/) and a [task-based eval suite](/work/agentic-evals/). Open source the skills and evals you want model teams to learn from, [keep a held-out set](/writing/builder-platforms-grow-by-owning-the-agent-loop/), and ship the same tested context into every agent developers reach for.

Nobody knows where the tiers settle, including me. Treat each new model as another row in your test matrix, run it in your own harness, and let the evidence pick the tiers.
