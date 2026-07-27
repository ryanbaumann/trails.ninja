# Lab demo onboarding contract

`apps.json` is the single routing, build, visibility, and runtime contract.
Adding a workspace source automatically enters package CI, the root build,
container staging, gateway routing, homepage discovery, and smoke coverage.
Private external source reaches the same gateway as checksum-pinned build
output; the public repository never receives its source or credentials.

## Choose one source workflow

### Start a new lab here

```bash
npm run labs:new -- my-demo --template static
npm run labs:new -- map-demo --template maps-2d
npm run labs:new -- globe-demo --template maps-3d --visibility private
cd demos/my-demo && npm install
```

Templates are `static`, `maps-2d`, and `maps-3d`. The Maps templates use a
referrer-restricted browser key named `VITE_GMP_API_KEY`; no server secret is
placed in the bundle. Public demos need a real preview image before
`labs:check` passes. `unlisted` is direct-link-only. `private` is omitted from
discovery and fails closed until its generated password environment variable
is configured on Cloud Run.

### Import a public repository snapshot

Check out the exact revision yourself, review it for secrets, then run:

```bash
npm run labs:import -- infographic-agent \
  --from ../infographic-agent \
  --source-url https://github.com/ryanbaumann/infographic-agent \
  --ref 214191bdceaf337ad0b1c3f8c19563fd0378f4ff \
  --confirm-source-public
```

Import requires a lockfile plus deterministic `build` and `test` scripts and
`engines.node`. It excludes `.git`, dependencies, build output, `.env*`, and
temporary Google authentication files. It copies a snapshot; it never edits,
deletes, archives, or redirects the source repository. Adapt and verify the
snapshot here, cut traffic over, then archive the old repository with a link
to the canonical monorepo location. Do not delete it.

### Attach a private repository build

The private repository owns its tests and produces a static `tar.gz` with
`index.html` at the archive root, no source maps, and a base path matching
`/<name>/`. Upload create-only to a private GCS object whose name contains the
SHA-256, then register only the public lock metadata:

```bash
npm run labs:attach -- private-demo \
  --artifact ../private-demo/dist-archive.tgz \
  --uri gs://portfolio-private-labs/private-demo-<sha256>.tgz \
  --release 2026-07-15.1
```

For a private Cloud Run backend exposed through the same portfolio origin:

```bash
npm run labs:attach -- private-demo \
  --artifact ../private-demo/dist-archive.tgz \
  --uri gs://portfolio-private-labs/private-demo-<sha256>.tgz \
  --release 2026-07-15.1 \
  --upstream-origin-env PRIVATE_DEMO_UPSTREAM_ORIGIN \
  --upstream-audience-env PRIVATE_DEMO_UPSTREAM_AUDIENCE
```

The browser calls `/api/private-demo/*`. The gateway requires the private
demo session, rate-limits requests, requires same-origin mutations, obtains a
Cloud Run identity token for a fixed configured audience, strips caller auth
and cookies, applies time/body/response caps, and never accepts an upstream
URL from the request. The backend should expose only its bounded API routes;
do not use this as an unrestricted internet proxy.

Trusted deploy runs `labs:fetch --required`, verifies archive SHA-256 and safe
members, rejects links/devices/traversal/source maps and size bombs, scans the
staged files, then builds the image. Fork PR CI receives no GCP credential and
uses explicit allow-missing mode; the gateway remains unavailable/fail-closed
for absent private bytes. The deploy service account needs object-viewer only
on the artifact bucket and Cloud Run invoker only on the named backend.

Artifact URI, release, route, title, and tags remain visible in public
`apps.json`. If even those names are confidential, a separate trusted
manifest overlay is required and is intentionally outside this workflow.

## API choices

| `api.type` | Use when | Required work |
|---|---|---|
| `none` | Static/BYOK demo | No secret-bearing browser calls |
| `gateway` | API is implemented in this gateway | Add bounded handler and focused tests; declare exact `path` or route-family `prefix` |
| `upstream` | Backend stays in a private service | Use `labs:attach` upstream flags; set origin/audience/password runtime configuration |

`api` and `source` are independent. A workspace demo can use a gateway API;
an artifact demo can be static or use a private upstream. `visibility` is also
independent, except external artifacts default to and must remain private.

## Deterministic completion gate

Run in this order:

```bash
npm test --prefix demos/<name>
npm run build --prefix demos/<name>
npm run labs:check
npm run test:labs
npm run build
npm test --prefix gateway
npm run smoke
docker build --build-arg ALLOW_MISSING_ARTIFACTS=1 -t portfolio-review .
```

CI derives its package matrix from workspace sources in `apps.json`; there is
no matrix, Docker stage, or gateway static route to edit. CI additionally
builds the exact container and runs smoke against it. Secret-bearing handlers
need deterministic valid/invalid input, missing-config `503`, auth denial,
timeout, size, upstream failure, and rate-limit tests. Live quota-bearing
canaries belong after deploy, not in fork PR CI.

## Applying the contract to the two candidates

| Demo | Verified source state | Path through this workflow | Current blocking gate |
|---|---|---|---|
| Infographic Agent | Public repo at `214191bdceaf337ad0b1c3f8c19563fd0378f4ff`; Vite single-file static build | `labs:import`, then `/infographic-agent/`; BYOK may remain `api.type: none` | Upstream package omits `engines.node`; add it and verify the imported build/test/preview before registration |
| Real-World Reasoning Agent | Owner-authorized private snapshot at `68e8c34547066a984ccb97f5b587caeb97561ec1`; reviewed for public release | First-party workspace at `/real-world-reasoning-agent/` with guarded `/api/real-world-reasoning-agent/*` gateway routes | Migrated; `PROVENANCE.md` records the private-to-public release boundary |

Do not delete predecessor repositories. After a migration is verified in
production, archive the predecessor with a canonical link to its Fieldwork
directory. A private-to-open-source snapshot is an owner-authorized exception,
not a reason to weaken `labs:import` or falsely confirm that a source was public.
