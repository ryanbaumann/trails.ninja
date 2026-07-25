---
title: Google Maps Platform Code Assist MCP
org: Google
role: Product and engineering lead
period: 2024 – present
summary: A hosted MCP service that gives AI coding agents current official Google Maps Platform documentation and samples.
tags: ["developer experience", "ai", "developer tools"]
links: [{"label": "Docs", "url": "https://developers.google.com/maps/ai/code-assist"}, {"label": "Launch blog", "url": "https://mapsplatform.google.com/resources/blog/announcing-code-assist-toolkit-bring-google-maps-platform-expertise-to-your-ai-coding-assistant/"}]
image: /img/work/code-assist-docs.png
imageAlt: Official Code Assist documentation showing its experimental status, MCP grounding, public sources, and retrieval tools
socialImage: /social/work-code-assist.jpg
shareTitle: Google Maps Platform Code Assist
shareSummary: Current official platform context inside AI coding agents.
shareImageAlt: Google Maps Platform Code Assist beside an official documentation capture.
featured: true
order: 1
---

## The goal

Developers increasingly let their agents read the docs for them. When an AI generates wrong Google Maps Platform code, the developer blames the platform. The goal: make AI coding agents generate correct, current platform code, and turn that field pain into a product surface we could operate and improve.

## What shipped

Our team built and shipped [Code Assist](https://developers.google.com/maps/ai/code-assist): an MCP server that grounds AI coding agents in official Google Maps Platform documentation, code samples, and architecture guides through retrieval. I led the strategy and stayed close to the work as we took it from a GitHub alpha to a hosted remote MCP service that works with compatible MCP clients.

With it connected, agents retrieve current official docs instead of relying only on training memory. That gives the agent current API surfaces, code samples, and architecture guidance inside the task.

## What I learned

Current documentation is most useful when the agent can retrieve it inside the task, and an eval checks the result.
