# One agentic interface — status

Increments A–E are **implemented and landed**. The remaining work is verification:
the live browser harness does not currently pass against the new shell.

Full plan: `~/.claude/plans/reactive-kindling-melody.md`. Background:
`docs/implementation/real-world-agent-foundation.md`.

## Landed

| Increment | Commit | What |
| --- | --- | --- |
| A — one session | `5d2dd28` | Five `Record<ScenarioId, T>` maps, six engines, and App.tsx's reconciliation effect collapse into one session. `activeScenario` selects prompt + tools only. Explorer stopped impersonating Scout and owns an `explorer` genUI scope. |
| B + C — canvas + camera | `b7fdbc5` | `AgentCanvas` replaces the six-strip dock and the competing `ContextDrawer` (deleted). Shell is a CSS grid, so the map owns a declared cell. `resolveCamera` is a pure reducer shared by 2D/3D; the DOM-measurement padding math is gone. `cameraOwner` suspends auto-camera after a user drag. |
| B/C fixes | `27e2336` | Defects found in a browser pass at five viewports: horizontal overflow from bare `1fr` tracks, header floating over the map, rail covering the mobile sheet, sheet anchored to a hardcoded composer height, BYOK control hidden on mobile. |
| D — actions | `070bc3e` | Typed action registry. Unregistered surface actions are refused instead of being forwarded to the agent as `[ui-action] …` prompt text. |
| D — capabilities | `d55134d` | `COMMON_TOOLS` resolves from the capability registry; `search_places` and friends return `{data, effects}` instead of mutating the store. `focus_place` reports `focusRequested` rather than claiming a focus it cannot verify. |
| D — genUI | `49b894d` | `NextActions` catalog component; the explorer presenter authors its own counterfactual instead of the shell hardcoding it. |
| E — recipes | `923803a` | `ExperienceManifest` records with no React/Zustand/SDK; `RecipePicker` in the composer replaces the deleted `ScenarioRail`. Canvas starters come from the manifest. |

Green at the merge commit: `tsc --noEmit` clean, **558/558 unit tests across 69
files**, `vite build` ok.

## Deliberately not done

**`render_surface` is still a model-facing tool with its full prompt guide.** The
plan called for demoting it to a developer escape hatch and dropping the A2UI
tutorial from every recipe prompt. It is load-bearing for three recipes today —
Scout renders comparison/evidence surfaces, Ad Studio renders the style picker
and creative carousel, Concierge renders place cards — all model-authored. That
demotion needs those three ported to deterministic presenters first (PR 9
territory), so removing the guide now would simply break them.

## Open: the live browser pass fails

**The app itself is verified working.** Driving the flow manually against the
built app and the harness's own fixtures produces the correct terminal state:

```
Rank 1 · Grounded candidate 1 · 9 min · inside limit
```

with the evidence surface at 371x622 visible, place/route/weather attribution,
the jacket inference, limitations, and the new NextActions row ("Compare
driving", "Open in Google Maps"). The genUI surface, the single composer, the
single canvas, zero rail and zero drawer were all confirmed in a real browser at
320x568, 390x844, 768x1024, 1440x900 and 1920x1080 with zero horizontal
overflow.

**`npm run mission-smoke` does not pass.** It fails waiting for that same text,
which the app demonstrably renders. Two harness bugs were found and are NOT yet
fixed in the repo (the exploratory fixes were reverted rather than landed
half-verified):

1. **The landing assertion is inverted.** Line ~110 asserts
   `/live/i.test(document.querySelector('.mission-capability').innerText())`.
   The ready state renders `● Ready`; the only copy containing "live" is the
   *failure* string `Live unavailable`. So that assertion could only ever pass
   when Live was broken. The Live promise now lives on the CTA
   ("Find with live evidence") — assert readiness there and on the chip's
   `Ready`, not the literal word "live".
2. **The terminal-text wait fails for an unknown reason.** Raising it from 15s to
   45s did not help, so it is not latency. The same regex against
   `document.body.innerText` matches in a hand-driven run of the identical flow,
   so the defect is in how the harness observes the page, not in what the page
   renders. Suspects not yet ruled out: the harness's Chromium flags
   (`--use-gl=angle --use-angle=swiftshader`) versus a default launch, and a
   `Cannot read properties of undefined (reading 'getRootNode')` page error seen
   during 3D/deck.gl init.

Start there, and start from the fact that the render is correct.

Both harnesses are gated behind `ALLOW_LIVE_MAPS_BROWSER=1` because the Maps
JavaScript renderer is live:

```bash
PORT=8099 npm start &
ALLOW_LIVE_MAPS_BROWSER=1 CHROMIUM_PATH=/usr/bin/google-chrome \
  SMOKE_URL=http://localhost:8099 npm run mission-smoke
ALLOW_LIVE_MAPS_BROWSER=1 CHROMIUM_PATH=/usr/bin/google-chrome \
  SMOKE_URL=http://localhost:8099 node scripts/uiux-audit.mjs
```

Note the browser key is HTTP-referrer restricted and rejects `localhost`
(`RefererNotAllowedMapError`), so local runs exercise the app without a working
map tile surface — and without billable Maps usage.

`scripts/uiux-audit.mjs` has not been run against the new shell at all.
