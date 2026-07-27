# Security

Please do not open public issues for vulnerabilities or exposed credentials. Use [Fieldwork's private vulnerability reporting](https://github.com/ryanbaumann/fieldwork/security/advisories/new) to reach the maintainer.

Atlas expects only the restricted browser Maps key to reach client code. `GMP_SERVER_KEY` and `GEMINI_KEY` must stay server-side and should be supplied through Secret Manager or equivalent runtime secrets.

The optional in-app Gemini BYOK flow is explicitly tab-scoped: the raw key is held only in module memory, never local/session storage, URLs, app state, transcripts, telemetry, or logs. It is sent to the same-origin `/ai` proxy in `X-Atlas-Gemini-Key`; the proxy removes that private header and replaces it with the standard Gemini auth header only after pinning and allowlisting the upstream request. Because same-origin JavaScript can access any in-memory credential, users should connect personal keys only on deployments they trust and disconnect or reload when finished.
