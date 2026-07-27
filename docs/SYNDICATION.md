# Field Notes syndication

Field Notes owns the content. Resend owns the email audience. Substack,
LinkedIn, and X are distribution channels that point readers back to the
canonical post on this site.

## The simple publishing loop

1. Draft and review the Markdown post through `/writer/`.
2. Publish the site version first and verify its canonical URL, social image,
   summary, and tags.
3. Prepare one small syndication kit:
   - canonical URL;
   - title, summary, image, image alt text, and up to three tags;
   - one short excerpt for Substack;
   - two LinkedIn hooks;
   - two X hooks or one short thread;
   - one tracked URL for each hook.
4. Review the kit, then publish manually to each channel.
5. Record the channel URL, hook variant, and publication time with the post.
6. Compare channel-native reach with site sessions, subscriptions, and
   contact completions.

Use one approval queue for social distribution. Buffer is the first choice
because it supports LinkedIn profiles and Pages, X, and additional networks
from one calendar. Its API can create posts as drafts when a channel requires
approval, so generation and publishing remain separate decisions. The private
Writer dashboard now stages editable drafts, and a merge workflow handles the
first pass for newly added Field Notes.

Keep Substack outside that queue. Substack documents archive imports from RSS
and manual copy-and-paste, but not an ongoing post-creation API. Publish its
excerpt or Note manually after the Field Note is live.

## Channel format

| Channel | Publish | Why |
| --- | --- | --- |
| Substack | A short excerpt or Note with a tracked link to the full Field Note. | Preserves the site as the archive and avoids relying on an external canonical setting that Substack does not document. Its RSS importer is useful for migrations, not selective ongoing syndication. |
| LinkedIn | A native feed post with a strong opening, the social image, and a tracked link. | Followers stay native to LinkedIn, while the complete argument and subscription conversion happen on the site. A LinkedIn newsletter is optional duplicate distribution, not the email-list source of truth. |
| X | A concise post or short thread with the tracked link in the closing post. | Keeps the workflow fast. Use the API only if manual publishing becomes a proven bottleneck. |

Official capability references: [Substack post import](https://support.substack.com/hc/en-us/articles/360037830351-How-do-I-import-my-posts-from-another-platform-such-as-Mailchimp-WordPress-Medium-or-Ghost), [LinkedIn newsletters](https://www.linkedin.com/help/linkedin/answer/a524002), [LinkedIn's Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [X API pricing](https://docs.x.com/x-api/getting-started/pricing), [Buffer's supported channels and draft approval](https://support.buffer.com/article/859-does-buffer-have-an-api), and [Buffer draft creation](https://developers.buffer.com/examples/create-draft-post.html).

## One manageable social queue

Connect Ryan's LinkedIn profile and X account to Buffer first. Add another
network only when the same Field Note has a real audience there. Do not create
separate publishing code for each network.

Each destination keeps its own copy. A shared link and image are reusable, but
the opening, length, and call to action are channel-specific. Queue the
LinkedIn post and X post together, then approve or revise each one in Buffer.
Record the published URLs beside the Field Note. Buffer is the operational
queue, not the content archive or analytics source of truth.

The server-side Buffer integration follows this loop:

1. Generate a reviewed syndication kit from the published Field Note.
2. Show the exact LinkedIn and X copy before it leaves the site.
3. On explicit approval, create Buffer drafts for selected channels.
4. Review timing, previews, mentions, and image crops in Buffer.
5. Publish from Buffer. Record the resulting channel URL with the Field Note
   when comparing attribution.

The integration must use a server-side credential stored in Secret Manager.
It must never place a Buffer, LinkedIn, or X token in Markdown, client-side
JavaScript, a `VITE_` variable, logs, or a pull request. Writer staging always
requires an explicit browser confirmation. Merge-time staging is limited to
the first workflow attempt. A rerun makes no Buffer calls; use Writer to stage
any channel that failed during the first attempt. Exact-copy lookup is only a
convenience because editing a Buffer draft changes the value being compared.

## Rollout decision

1. **Now:** merge a new Field Note draft to stage editable LinkedIn and X
   drafts in Buffer. Publish Substack manually.
2. **After three to five Field Notes:** compare the time spent copying posts,
   correction rate, and channel-attributed subscriptions. Add channels only
   when they earn ongoing effort.
3. **If copying is still the bottleneck:** extend the reviewed metadata used
   by the merge workflow. Do not add direct LinkedIn or X integrations.
4. **If approval is the bottleneck:** keep the dashboard workflow. More API
   code will not solve an editorial decision.

## Attribution and creative comparisons

Use one controlled UTM vocabulary:

| Parameter | Values |
| --- | --- |
| `utm_source` | `linkedin`, `x`, `substack`, `field_notes` |
| `utm_medium` | `organic_social`, `referral`, `email` |
| `utm_campaign` | `fn_<slug>_<yyyymm>` |
| `utm_content` | `post_hook_a`, `post_hook_b`, `thread_hook_a`, `excerpt_cta_a` |

Example:

```text
https://ryanbaumann.dev/writing/loop-engineering-coding-agent/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=fn_loop_engineering_202607&utm_content=post_hook_a
```

The portfolio sends only these four allowlisted values to Google Analytics.
All other query parameters remain excluded. `utm_content` distinguishes hooks
and creative treatments. Organic comparisons are not randomized A/B tests,
so change one variable at a time and compare several releases before drawing
a conclusion. Use a true split test only with randomly assigned email or paid
campaign audiences.

Measure a short funnel:

1. Native impressions and engagement from each channel.
2. Site sessions by source, campaign, and content variant.
3. Confirmed `sign_up` events.
4. Confirmed `generate_lead` events.

See [Google's campaign URL guidance](https://support.google.com/analytics/answer/10917952).

## Email audience ownership

Resend is the master email list unless paid Substack subscriptions become a
requirement. The site signup writes a global Resend Contact, adds it to the
Field Notes Segment, and opts it into the Field Notes Topic. The Topic owns
the reader's unsubscribe preference. The Segment is only an internal sending
group.

For a one-time Substack migration:

1. Export active Substack subscribers to CSV.
2. Keep only people who explicitly opted in to receive this publication.
3. Normalize and deduplicate by email. An unsubscribe or suppression always
   wins over an active record.
4. Preserve source and original signup date when available.
5. Import the clean list into Resend, add it to the Field Notes Segment, and
   opt it into the Field Notes Topic.
6. Send a transparent migration notice from the publication the reader
   originally joined.
7. Stop sending the same update from both systems.

Do not build bidirectional Resend and Substack synchronization. Substack has
CSV import and export but no supported subscriber webhook or write API, so a
continuous sync can miss unsubscribes and create duplicate mail. References:
[Substack subscriber import](https://support.substack.com/hc/en-us/articles/360037829931-How-do-I-import-my-mailing-list-from-another-platform-such-as-Mailchimp-Ghost-or-Beehiiv), [Substack export](https://support.substack.com/hc/en-us/articles/6314498343700-How-do-I-export-my-email-list-on-Substack), and [Resend Contacts, Segments, and Topics](https://resend.com/docs/dashboard/audiences/introduction).

If paid Substack subscriptions become important, reverse the decision:
Substack should own subscriber and billing state, and the site should link to
its signup instead of maintaining a parallel marketing list.

## Followers are not email subscribers

Do not add LinkedIn or X followers, connections, or scraped contacts to the
email list. A follow is not consent to receive email. LinkedIn followers and
newsletter subscribers are platform identities, not a mergeable email list,
and LinkedIn does not support merging or transferring newsletter followers.

Use channel CTAs and tracked profile links to let each person opt in on the
site. This produces a smaller list with clear provenance, safer deliverability,
and honest channel attribution.

## Later automation

The merge workflow stages approval-required Buffer drafts for newly added Field
Notes and validated one-off release drafts in `docs/social-drafts/`. Release
drafts declare one channel and exact copy in JSON; they are staged once on the
first merge-workflow attempt and never auto-published. The private `/writer/`
panel can regenerate either Field Note channel explicitly. Keep Substack manual
until it offers an official write API.
