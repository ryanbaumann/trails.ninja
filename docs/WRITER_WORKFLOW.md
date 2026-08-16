# Draft and scheduled essay workflow

Essays support three publishing states from front matter:

```yaml
# Private writer preview only
draft: true
noindex: true

# Public on the next deploy
draft: false
noindex: false

# Public on the first scheduled deploy after this UTC time
draft: false
noindex: false
publishAt: 2099-07-14T16:00:00Z
```

Create a safe draft with `npm run new:post -- "Essay title"`. Use `--publish` for immediate publication or `--schedule 2099-07-14T16:00:00Z` to scaffold a scheduled essay.

## Writer page

Production builds a second copy at `/writer/`. It includes drafts and future essays, is excluded from public app discovery, forces `noindex, nofollow`, disables analytics, and is protected by Google OAuth. Only `rsbaumann@gmail.com` is accepted by default. Point `WRITER_PUBLIC_ORIGIN` at the production HTTPS origin (for example, `https://ryanbaumann-dashboardfolio.admin.com`) and register `${WRITER_PUBLIC_ORIGIN}/auth/google/callback` as an authorized redirect URI in the Google Cloud OAuth client.

The release dashboard makes the workflow explicit: open the private preview, edit the Markdown, save the draft, leave a review note, and request agentic review before publishing. A review request creates a GitHub issue with the content file, branch, and the required `portfolio-writing`, `portfolio-review`, and `portfolio-design` review lanes. A connected coding agent can pick up that issue, leave findings, and make a follow-up commit. Return to the dashboard to review that iteration in the private preview, then schedule or publish it. Publish now still requires an explicit browser confirmation. Every save creates a focused commit on the configured branch through the GitHub Contents API. The branch defaults to `main`, so no pull request is required. The normal push deploy handles immediate publication, and an hourly scheduled deploy publishes due timestamps.

Required runtime configuration:

- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`: the server-side Google OAuth web-client credentials.
- `GOOGLE_OAUTH_SESSION_SECRET`: a long random value used only to sign short-lived dashboard sessions.
- `WRITER_PUBLIC_ORIGIN`: the exact HTTPS dashboard origin, with no path or trailing slash.
- `GOOGLE_OAUTH_ALLOWED_EMAIL`: optional override, defaults to `rsbaumann@gmail.com`.
- `GITHUB_CONTENT_TOKEN`: a fine-grained GitHub token restricted to this repository with **Contents: read and write**. Store it in Secret Manager.
- `GITHUB_REVIEW_TOKEN`: a dedicated fine-grained GitHub token with **Issues: read and write**. Required to submit agent-review requests; it never reaches the browser.
- `GITHUB_CONTENT_REPOSITORY`: optional, defaults to `ryanbaumann/fieldwork`.
- `GITHUB_CONTENT_BRANCH`: optional, defaults to `main`.
- `BUFFER_API_KEY`: Buffer account API key. Required only for staging social
  drafts from the writer dashboard.
- `BUFFER_ORGANIZATION_ID`, `BUFFER_LINKEDIN_CHANNEL_ID`, and
  `BUFFER_X_CHANNEL_ID`: exact Buffer destinations for writer social drafts.

Attach the OAuth client secret, session secret, and GitHub token to the Cloud Run service as secret-backed environment variables. The client ID, allowed email, and public origin may be regular runtime environment variables. Never use `VITE_` names or Docker build arguments for them.

GitHub's Contents permission applies to the whole repository, not only the writing folder. The application restricts updates to `portfolio/content/writing/<slug>.md`, but the token itself cannot be path-scoped. Use a fine-grained token dedicated to this service, rotate it regularly, and never expose it to browser code. The configured branch must allow Contents API commits. Keep `GITHUB_CONTENT_BRANCH=main` for OAuth-admin edits that need no pull request. If branch protection requires pull requests, point it at a branch created from current `main`; successful saves show a GitHub compare link so Ryan can open and merge the focused change. After that merge, recreate or rebase the writer branch from current `main` before the next editing batch. The private preview continues to show deployed `main` until the compare branch is merged and deployed.

## Important confidentiality limit

This repository is public. A Markdown draft committed here can still be read in GitHub history even when its rendered preview is OAuth-protected. Assets under `portfolio/static/` are also copied to the public build. Use this workflow for unfinished writing, not confidential or embargoed material. Confidential drafts require a private content repository or store.

Scheduled publication is not exact to the minute. GitHub's hourly schedule can be delayed, so an essay appears at or shortly after `publishAt`. Use the manual deploy workflow when exact timing matters.

## Buffer social drafts

The OAuth-protected writer dashboard shows editable LinkedIn and X copy beside
each Field Note. Each button stages one unpublished Buffer draft after browser
confirmation, then links to Buffer for final editing and publishing. An exact
current draft match is reused as a convenience, but each confirmed click is a
new external action after that copy changes.

When a pull request adds a new `draft: true` Field Note to `main`, the
`stage-social-drafts` workflow creates unpublished, editable Buffer drafts for
the connected LinkedIn and X profiles. The starter copy uses the Field Note's
share title, share summary, canonical URL, and tracked campaign parameters.
Buffer remains the final editing, scheduling, and publishing surface. The
workflow never publishes a post.

Add `stageSocial: false` to the Field Note front matter to skip staging. Edits
to an existing Field Note do not create another social draft. Automatic
staging runs only on the first GitHub Actions attempt. Rerunning the workflow
does not call Buffer, which prevents duplicate drafts after copy has been
edited. If one channel failed during the first attempt, stage that channel
explicitly from `/writer/`.

For merge-time staging, configure the GitHub repository with:

- `BUFFER_API_KEY` as an Actions secret. Create it under Buffer **Settings →
  API**. The key can access every organization and channel in the Buffer
  account, so keep it server-side and rotate it if exposed.
- `BUFFER_ORGANIZATION_ID` as an Actions variable.
- `BUFFER_LINKEDIN_CHANNEL_ID` and `BUFFER_X_CHANNEL_ID` as Actions variables.

Use Buffer's API Explorer or the official [organization](https://developers.buffer.com/examples/get-organizations.html)
and [channel](https://developers.buffer.com/examples/get-channels.html) queries
to retrieve those IDs. The workflow exits without staging when the four values
are not configured. It never prints the API key or sends it to the portfolio
container.

For staging from `/writer/`, attach the same four names to the Cloud Run
service. Store `BUFFER_API_KEY` in Secret Manager. The organization and channel
IDs can be ordinary environment variables. Neither path publishes directly.

## Local Voice AI Review & Editorial Aide

Before publishing or saving final draft edits, use the fine-tuned local Gemma 4 models on Apple Silicon to critique rhythm, suggest headline variations, rewrite corporate fragments, or generate social packaging:

```bash
# Critique voice and cadence against Ryan's style rules (Dense 31B: deep narrative & structure analysis)
npm run voice:review -- portfolio/content/writing/my-draft.md

# Rewrite corporate copy into Ryan's active, first-person voice (Dense 31B / MoE 26B)
npm run voice:edit -- "Our engineering team deployed an innovative solution to enhance system availability."

# Generate 8 thesis-driven headline options (MoE 26B: ~3s interactive turnaround)
npm run voice:headline -- "Why retrieval systems fail on chunking rather than the embedding model"

# Draft a punchy developer social post (< 120 words) (MoE 26B)
npm run voice:social -- portfolio/content/writing/my-draft.md

# Verify all arXiv, DOI, and external reference links in a draft
npm run eval:citations -- --file portfolio/content/writing/my-draft.md

# Verify held-out evaluation dataset has zero shingle leakage against training data
npm run eval:leakage
```

### Architectural Routing

- **Gemma 4 31B Dense (`adapters/gemma-4-31b-ryan-voice-v6`)**: Used for pre-publication editorial reviews (`npm run voice:review`) and high-fidelity copyediting. Yields 100% fact retention (`G-FACT-KEEP`), zero repetition loops, and 55% fewer verbatim echoes.
- **Gemma 4 26B-A4B MoE (`adapters/gemma-4-26b-ryan-voice-v6`)**: Used for interactive headline generation (`npm run voice:headline`), quick surgical edits (`npm run voice:edit`), and social copy packaging (`npm run voice:social`). Yields ~3x faster generation latency (~2.5s vs ~8.1s) on Apple Silicon Metal.

All commands run locally via Apple Silicon Metal acceleration with zero external API calls or latency.


