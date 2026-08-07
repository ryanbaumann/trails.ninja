# Code Assist retrieval trace

Observed: 2026-08-07 UTC

Endpoint: `POST https://mapscodeassist.googleapis.com/mcp`

Analytics/request-attribution source: `gmp_git_agentskills_v1`

## MCP calls

The documented preflight ran first:

```json
{
  "method": "tools/call",
  "params": {
    "name": "retrieve-instructions",
    "arguments": { "name": "instructions" }
  }
}
```

The retrieval then used the service's documented tool name and argument
schema:

```json
{
  "method": "tools/call",
  "params": {
    "name": "retrieve-google-maps-platform-docs",
    "arguments": {
      "llmQuery": "Build a React store locator using Places API (New), AdvancedMarkerElement, and production API key restrictions",
      "source": "gmp_git_agentskills_v1"
    }
  }
}
```

Query:

> Build a React store locator using Places API (New),
> AdvancedMarkerElement, and production API key restrictions

## First three returned contexts

| Rank | Documentation source | Score | API state | What the excerpt contained |
|---|---|---:|---|---|
| 1 | `googlemaps/extended-component-library` | 0.7244397402 | `CURRENT` | The `<gmpx-store-locator>` Web Component implementation. |
| 2 | `googlemaps/extended-component-library` | 0.7125335932 | `CURRENT` | The same store-locator source file and supporting imports. |
| 3 | `visgl/react-google-maps` | 0.7090147734 | `CURRENT` | A React Places UI Kit example using `APIProvider`, `Map`, and hooks. |

The service returned five official contexts. The first result from the React
library ranked third, 0.0154249668 behind the top result. This observation
measures retrieval order for one query. It does not show that the two Web
Component results are unusable from React, and it does not measure
generated-code quality or general retrieval accuracy.

No model generated code in this trace. A complete task trace would continue
through context selection, code generation, deterministic checks, and the final
repository state.
