---
name: portfolio-content
description: How to add or update content on this site — work entries, blog posts, talks, pages, static assets, or a whole new content type. The CMS is the filesystem.
---

# Updating content

The CMS is `content/` + `build.mjs`. Add a markdown file and rebuild. Every collection folder has a
`_TEMPLATE.md` (underscore-prefixed files are skipped by the build).

## Front matter

A `---`-delimited block of `key: value` lines. Values that parse as JSON
(arrays, objects, numbers, booleans) are used as such; everything else is a
string. Common keys:

| Key | Used by | Meaning |
|---|---|---|
| `title`, `summary` | all | Shown in lists, cards, and meta tags. Use the writing skill's packaging framework before publishing. |
| `order` | all | Sort key (ascending); ties break by `date` descending |
| `featured` | work | `true` puts the entry on the home page |
| `org`, `role`, `period`, `tags`, `links` | work | Card + case-study header |
| `date`, `external` | writing | `external: <url>` = outbound link, no page |
| `slug`, `aliases` | detail pages | Pin the canonical slug and list old root-relative paths that must permanently redirect to it |
| `image`, `imageAlt` | narrative pages | Purposeful visible image plus literal alt text |
| `socialImage`, `shareTitle`, `shareSummary`, `shareImageAlt` | shareable pages | Dedicated 1200×627 social preview and its copy/alt contract |
| `draft`, `noindex`, `publishAt` | writing | Drafts stay private to `/writer/`; `publishAt` is an explicit UTC timestamp gate |
| `venue`, `type`, `links` | talks | Row metadata; `type` is free-form |
| `eyebrow` | pages | Label above the page title |

Keep tags reader-facing and reusable. Prefer the existing vocabulary: `developer experience`, `ai`, `growth`, `distribution`, `evals`, `open source`, `product`, `developer tools`, `architecture`, `research`, `maps`, and a small number of domain-specific terms. Use at most three tags unless a fourth materially improves discovery. Do not create a synonym such as `applied ai` or `agent experience` when an existing tag already carries the meaning.

## Where things go

- **Work case study** → `content/work/<slug>.md`. Body renders at `/work/<slug>/`; no body = card links out to the first `links` URL.
- **Blog post** → `content/writing/<slug>.md` (or `npm run new:post -- "Title"` from the repo root). New posts are drafts. Use `--publish` or `--schedule 2099-07-14T16:00:00Z` deliberately. Use the writing skill for voice, titles, summaries, social preview copy, and social-draft packaging.
- **Talk / presentation** → `content/talks/<slug>.md`, decks in `static/decks/` (see the presenting skill).
- **Agent script** → canonical package in `../agent-scripts/<slug>/`, with an optional reader-facing field note in `content/writing/<slug>.md`. The field note summarizes and links to the package; it does not duplicate the full prompt.
- **Standalone page** → `content/pages/<slug>.md` → `/<slug>/`. Add it to the nav in `build.mjs` `layout()` if it should be globally reachable.
- **Any static asset** (images, PDFs, files) → `static/`, copied verbatim into the site root.
- **Site-wide copy** (name, thesis, section intros, links) → `content/site.json`.

Internal links in content are written root-relative (`/work/`, `/decks/x.pdf`);
the build rebases them if the site is mounted under a subpath.

## Drafts and schedules

- `draft: true` + `noindex: true` never enters public HTML, RSS, or sitemap.
- `draft: false` with no `publishAt` publishes on the next deploy.
- `draft: false` + `publishAt: <UTC ISO timestamp>` publishes on the first scheduled deploy at or after that time.
- Any automation that decides public state must reuse `isPublished()` from
  `build.mjs` or pin an explicit parity test to that implementation. Never
  paraphrase publication as `draft === false`: test a future schedule first,
  then before, at, and after its UTC boundary.
- `/writer/` is a separate password-protected build with preview and publishing controls. It needs server-only writer and GitHub credentials; see `docs/WRITER_WORKFLOW.md`.
- The repository is public. Committed Markdown and `static/` assets are not confidential even when the rendered route is protected.

Markdown headings receive stable fragment IDs. Authors may pin one with `## Heading {#stable-id}`. Tables, fenced code language labels, blockquotes, images, lists, emphasis, and links are supported.

When renaming a published detail page, set its new `slug`, add every previous path to `aliases`, and update `canonical`. The build writes `redirects.json`; the gateway turns each alias into an HTTP 308 and preserves the query string. Never leave the old page rendered as duplicate content.

Every hosted essay needs three purposeful visual assets before publication:

1. A dedicated 1200×675 header that explains the thesis without repeating the title.
2. A distinct 1200×627 raster social card composed for thumbnail legibility.
3. At least one dedicated 1200×675 inline image that shows a mechanism, artifact, or evidence from the argument.

Write asset-specific alt text for each. Do not reuse a generic portfolio preview, title card, or the header as the inline evidence image.

## Adding a new content type

1. Add `{ name, label, listPage, detailPages }` to `COLLECTIONS` in `build.mjs`.
2. Create `content/<name>/` with a `_TEMPLATE.md`.
3. Add the nav item in `layout()` and a section intro in `site.json` if wanted.
4. `node build.mjs` — the index, rows, and detail pages come for free.

## Verify

Run the `portfolio-review` skill before publication. Its claim, link, canonical, redirect, image, metadata, browser, and independent-review gates are required in addition to the build commands below.

```bash
node build.mjs   # prints the page count
BASE_PATH=/writer/ PORTFOLIO_WRITER_MODE=true PORTFOLIO_DIST_DIR=writer-dist node build.mjs
node serve.mjs   # preview at http://localhost:4000
```
