---
draft: true
noindex: true
title: The Next Platform Interface Is an Agent Session
summary: Platforms need to ship context and workflows into the agent sessions where developers now make product decisions.
date: 2026-07-13
updated: 2026-07-15
canonical: https://ryanbaumann.dev/writing/the-next-platform-interface-is-an-agent-session/
image: /img/writing/agent-session-header.svg
imageAlt: Developer intent moves through current platform context and workflow guidance to working code inside an agent session.
socialImage: /social/the-next-platform-interface-is-an-agent-session.jpg
shareTitle: The Next Platform Interface Is an Agent Session
shareSummary: Ship context and workflows where developers make decisions.
shareImageAlt: The Next Platform Interface Is an Agent Session beside a Code Assist retrieval artifact.
tags: ["developer experience", "ai", "distribution"]
---

The next platform interface is an agent session. Developers still use documentation, consoles, SDKs, and samples, but an agent increasingly chooses which of those surfaces to read and how to combine them into working code.

That makes the agent experience part of the product experience. A correct website is no longer enough if the agent cannot find current context, apply it to the task, and follow the platform's preferred workflow.

## Context is now a product surface

When a developer asks an AI coding agent to add a map, the agent makes several platform decisions before the developer reviews the code. It selects an API, recalls initialization syntax, chooses an authentication pattern, and assembles a runnable example.

Training memory alone is a weak contract for that work because APIs change and recommended patterns move. A platform needs a way to provide current, official context inside the task instead of waiting for the developer to search for it.

[Google Maps Platform Code Assist](https://developers.google.com/maps/ai/code-assist) addresses that gap through a hosted remote MCP service. I wrote the initial evaluation suites, and our team took it from a GitHub alpha to a product that grounds compatible AI coding agents in official documentation, code samples, and architecture guidance. The [public repository](https://github.com/googlemaps/platform-ai) shows the integration surface, and the [launch walkthrough](https://youtu.be/L2V58kKIHvc) shows it in use.

The interface isn't a new destination: it's a tool call inside the developer's existing agent session.

## Facts are necessary, workflows are different

Retrieved documentation can tell an agent what is current, but it does not automatically teach the agent how an experienced platform engineer approaches a task.

That second layer is procedural. It includes how to choose between APIs, validate coordinates, structure a map experience, restrict a key, and verify the result. [Google Maps Platform agent skills](https://github.com/googlemaps/agent-skills) package those workflows as portable modules for Web, Android, iOS, and Web Services.

This creates a useful separation:

1. Retrieval grounds the agent in current platform facts.
2. Skills teach the workflow used to apply those facts.
3. Evals test whether the combined experience improves task completion.

The separation matters because each layer fails differently. While missing context requires better retrieval and a poor sequence of actions means the workflow must be rewritten, a confident but wrong result demands a new eval case to make that failure visible.

![Three failure patterns map to three platform responses: a wrong fact needs retrieval, a wrong sequence needs a skill, and a wrong result needs an eval.](/img/writing/agent-session-diagnostic.svg)

## Distribution starts before the first API call

The agent session is also a distribution surface. A developer might choose a library, service, or architecture during the conversation, before ever visiting a product page.

Platforms therefore need to be useful where the decision happens. That can mean an MCP service, a portable skill, a high-quality open-source library, or an integration with AI Studio and other compatible agent environments. It does not mean copying every document into every channel. The goal is a maintained path from developer intent to grounded action.

The same principle has held across earlier shifts in developer workflow. At Mapbox, integrations with [deck.gl](https://github.com/visgl/deck.gl) and [kepler.gl](https://github.com/keplergl/kepler.gl) put the platform beneath tools developers already chose. Agent interfaces change the mechanics, but not the operating lesson: meet developers inside the workflow and make the path to a correct result short.

## Replay one real task

The patterns for these interfaces will evolve as we experiment. But the starting point is visible today. 

Run a real developer task with no platform context, then run it again with current retrieval and workflow guidance. Inspect the trace. The first incorrect decision tells you whether the missing piece is a fact, a workflow, or an eval case, and gives you the next experiment to run.
