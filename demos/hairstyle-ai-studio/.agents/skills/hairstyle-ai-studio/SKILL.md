---
name: hairstyle-ai-studio
description: Guidance on modifying the hairstyle-ai-studio codebase, including models, UX/UI rules, testing, and deployment.
---

# Hairstyle AI Studio Skill

Use this skill when changing this repository's Gemini model integration, UX flow, deployment docs, or agent-readiness files.

## Workflow
1. Read `AGENTS.md` first.
2. Read `gateway/lib/hairstyleAi.js` from the repository root before changing
   model names, prompts, validation, or provider behavior.
3. Keep browser request code in `app/services/geminiService.ts`; Gemini
   provider calls and prompts belong in the gateway, never in components.
4. Keep app orchestration in `app/hooks/useAppFlow.ts`.
5. Keep shared metadata in `app/types.ts`.
6. Run `npm run typecheck`, `npm test`, and `npm run build` in this directory,
   then the gateway tests and root smoke suite for API or deployment changes.

## Secret checklist
- Never put Gemini keys in `VITE_*` variables, source, local storage, IndexedDB,
  logs, analytics, URLs, or committed environment files.
- Use the server-side `GEMINI_API_KEY` for the shared allowance of five
  successful image generations per client IP per UTC day. Do not charge the
  allowance for recommendation analysis or failed generation requests.
- Let visitors override the shared key at runtime. Validate a personal key
  through the non-generating proxy endpoint before activation, keep it only in
  React memory, and pass it transiently in `X-Gemini-API-Key`.
- A valid personal key bypasses the shared spend cap but not the separate
  gateway abuse limiter. A supplied malformed or rejected key must fail closed;
  never silently replace it with the shared deployed key.
- The gateway forwards the selected key only to Gemini. It must not store,
  return, log, or send it to analytics.
- Update the app README, privacy copy, gateway tests, and rate-limit tests when
  environment or request behavior changes.

## UX checklist
- Mobile-first upload/style/result paths.
- Inline recovery instead of alerts.
- Clear privacy copy near uploads.
- Result actions: download, refine, regenerate, start over.
- Model/layout choices should be understandable to non-technical users.
