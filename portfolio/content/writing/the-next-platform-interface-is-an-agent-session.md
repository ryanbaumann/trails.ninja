---
draft: true
noindex: true
title: I Asked Code Assist for a React Store Locator
summary: The first result from the React library ranked third. Retrieval brought back current official context, but it didn't make the architecture decision.
date: 2026-07-13
updated: 2026-08-07
canonical: https://ryanbaumann.dev/writing/the-next-platform-interface-is-an-agent-session/
image: /img/writing/agent-session-header.svg
imageAlt: One public retrieval ranks two Extended Component Library results ahead of the first result from the React library; no code was generated.
socialImage: /social/the-next-platform-interface-is-an-agent-session.jpg
shareTitle: I Asked Code Assist for a React Store Locator
shareSummary: The first result from the React library ranked third. Retrieval supplied official material; the agent still had to choose what fit the task.
shareImageAlt: A social card reading I Asked Code Assist for a React Store Locator beside a Code Assist retrieval artifact.
tags: ["developer experience", "ai", "distribution"]
---

The query was straightforward:

> Build a React store locator using Places API (New),
> AdvancedMarkerElement, and production API key restrictions.

When the coding agent called the public Code Assist MCP service, the top two results came from the Google Maps Platform Extended Component Library, pointing to its `<gmpx-store-locator>` Web Component. The first result from the React library ranked third, trailing the top result by 0.0154.

That is a revealing agent-session trace because the retrieval worked: it returned current official code, marked the sources `CURRENT`, and included a React Places UI Kit example. But retrieval only surfaced the material. It still left the critical architecture decision to the agent: which context actually fits the requested framework and project constraints?

The [public trace record](https://github.com/ryanbaumann/fieldwork/blob/main/docs/code-assist-retrieval-trace-2026-08-07.md) preserves the MCP preflight, tool call, query, first three sources, ranking scores, and limits. No code was generated, so this is not an end-to-end quality result.

## Retrieval gives the agent material, not judgment

[Code Assist](https://developers.google.com/maps/ai/code-assist?utm_campaign=gmp_git_agentskills_v1) is a hosted MCP service that retrieves official Google Maps Platform documentation and code samples at task time. Our team shipped it so compatible coding agents can use material that is not limited to what existed at the model's training date. I led the product strategy around a simple question: which parts of Maps expertise had to arrive inside the session for the code to improve? The team's evals compared task runs against a no-context baseline.

This one query shows the boundary cleanly. Retrieval found relevant official sources. A workflow still has to choose between the React library and the framework-neutral Web Component, carry the key-security requirement forward, and refuse unrelated context. An eval then has to inspect the generated application and decide whether that selection produced working, current code.

Retrieval made the current sources available. The next run still needs workflow guidance to choose among them, and an eval to check what the repository actually contains afterward.

![Three failure patterns map to three platform responses: a wrong fact needs retrieval, a wrong sequence needs a skill, and a wrong result needs an eval.](/img/writing/agent-session-diagnostic.svg)

## The tool call is part of the product interface

The developer never had to visit a new destination for this retrieval to happen. The interface was the request, the MCP tool call, and the ranked context returned inside the session.

That changes what a platform team has to maintain. The documentation still matters, but so do the query contract, retrieved sources, workflow instructions, and eval cases that catch a bad selection. A correct website doesn't guarantee that an agent will choose the right page for the job.

I've seen this distribution shift before. At Mapbox, integrations with [deck.gl](https://github.com/visgl/deck.gl) and [kepler.gl](https://github.com/keplergl/kepler.gl) put the platform underneath tools developers had already chosen. An MCP tool does the same kind of work one layer earlier: it puts platform context inside the decision.

## The next run has to finish the task

This trace stops after retrieval. The next version should keep the same query, repeat each condition, record which context the agent selects, generate the React app, and run checks for the requested framework, current Places surface, Advanced Markers, and key restrictions. The trace should retain the prompt, tool result, source choice, generated diff, test output, and final state.

Then I can compare retrieval alone with retrieval plus workflow guidance and see which decision changed. Until that run exists, the honest result is smaller: current context was available, and the first result from the React library ranked third.

If you publish agent-tool traces that continue from retrieval through a verified repository state, I'd like to see how you keep them readable.
