# LinkedIn profile copy review

Reviewed: 2026-07-28
Target: [linkedin.com/in/ryanbaumann](https://www.linkedin.com/in/ryanbaumann)
Method: `portfolio-writing` voice rules, claim mapping against
`docs/PORTFOLIO_EVIDENCE_LEDGER.md`, then an independent read-only copy and
claims reviewer per `portfolio-review` section 5.

## Scope limit

LinkedIn's auth wall exposes only the headline, the About opening line, the
Projects blurb, the patents, and education to a logged-out fetch. Experience
descriptions were not retrievable. Those sections below are replacements written
from the evidence ledger and `portfolio/content/work/`, not diffs against the
live bullets.

## 1. Fact corrections (verified against primary sources)

The patents section lists three entries. The public record supports two issued
patents, and two of the three entries are mislabeled.

| Current entry | Public record | Action |
|---|---|---|
| US9685009B2, "issued June 6, 2017" | Granted [2017-06-20](https://patents.google.com/patent/US9685009B2/en) | Correct the date |
| "US 14/676,278, issued October 6, 2016" | Application serial number. Granted as [US 10,324,433 on 2019-06-18](https://patents.google.com/patent/US10324433B2/en) | Replace with the granted number and date |
| "Time-shift controlled visualization of worksite operations, issued October 6, 2016" | [US20160292920A1](https://patents.google.com/patent/US20160292920A1/en) is abandoned, never issued | Delete. LinkedIn offers only "issued" or "pending" and it is neither |

Related ledger drift: `docs/PORTFOLIO_EVIDENCE_LEDGER.md` line 51 still reads
"co-invented three US patents." It should name the two grant numbers so the
ledger stops supporting the wrong claim.

## 2. Headline

Current copy states self-assessed expertise with no artifact behind it, and the
same string is repeated as the opening line of About.

> Engineering leader (15+ years of experience) with deep expertise scaling global Builder platform

Replacement (156 of 220 characters):

```text
Head of Developer Experience, Google Maps Platform | Turning repeated developer friction into shipped tools, evals, and open source for humans and AI agents
```

## 3. About

Replace the whole section. The first 300 characters are what most readers see
before the fold, so the platform scale and the tension sit there.

```text
I lead Developer Experience Engineering for Google Maps Platform, which powers more than 10 million websites and apps. A lot of builders now reach it through an agent first, and when that agent writes wrong code, the developer blames us, not the model.

That gap is most of my job. The work runs as a loop with a short cycle time: find the friction that repeats, ship the smallest artifact that removes it, put that artifact where builders already are, then check whether behavior actually changed. I work across product, engineering, UX, DevX, DRE, technical writing, and field engineering, and I stay close enough to the work to write the first evals or ship the reference app myself.

Recent work:

• Code Assist, a hosted MCP service our team shipped. It gives AI coding agents current official platform documentation and samples instead of relying only on training memory. I set the direction from the first GitHub alpha through hosted launch.
• Agent skills, portable workflow modules our team launched. One command installs them wherever a compatible agent runs, including AI Studio, and evals gate each release.
• Task-based evals scored against a no-context baseline, so a launch call rests on a measured delta.
• API references answer what an endpoint does. They don't answer how to build a fleet tracker that scales, so I started the Geo Architecture Center and wrote several of its guides.
• Open source. Google Maps Platform sponsors @vis.gl/react-google-maps, now past 1 million weekly downloads. Between early 2025 and 2026 our open-source ecosystem more than doubled its unique active users, and API engagement grew with it.

Earlier: Google Cloud, Instabase, Mapbox, and Caterpillar. The experience section below has the artifacts. The through line is that field friction, looked at long enough, turns into a product.

I studied mechanical engineering at Wisconsin, and before I wrote software I raced professionally for Trek-Livestrong and Bahati Foundation, which is where I learned to pace a long effort and watch the one signal that matters.

Nobody has figured out yet what a builder platform should look like when the first user is an agent. I publish what I learn, and the artifacts behind it, at ryanbaumann.dev.
```

## 4. Experience descriptions

### Google, Head of Developer Experience, Google Maps Platform (2022 to present)

```text
Google Maps Platform powers more than 10 million websites and apps. My job is to shorten the distance between a developer's intent and working code, now that a lot of that code is written by agents.

• Code Assist: our team shipped a hosted MCP service that retrieves current official platform documentation, code samples, and architecture guides for AI coding agents. I set the direction and wrote alongside the team, from the first GitHub alpha through hosted launch.
• Agent skills: our team launched portable modules for building across Web, Android, iOS, and Web Services. One command installs them into AI Studio and any compatible agent environment, and each skill ships behind an eval gate.
• Agentic evals: my team and I built task-based evals benchmarked against a no-context baseline, so launch and roadmap calls rest on a measured delta.
• Open source and distribution: between early 2025 and 2026 our open-source ecosystem more than doubled its unique active users, and API engagement grew with it. Google Maps Platform sponsors @vis.gl/react-google-maps, now past 1 million weekly downloads.
• Geo Architecture Center: I started it and wrote several of its guides. The team publishes end-to-end system patterns for the questions an API reference can't answer.
• AI-driven Voice of Developer: I created and lead the program that turns repeated developer friction into evidence-backed roadmap priorities.
• I lead a 20+ person Developer Experience Engineering organization and partner across product, engineering, UX, DevX, DRE, technical writing, and field engineering.
```

### Google Cloud, Manufacturing Industry Solutions Manager (2021 to 2022)

```text
Google Cloud needed a repeatable connected-product stack for manufacturers, and the bar was a working product with a real launch customer.

• I led product and engineering for Intelligent Product Essentials, zero to launch in nine months. It paired edge AI with cloud analytics so manufacturers could ship products that keep improving after they leave the factory.
• GE Appliances launched with the team.
• The launch customer found our product gaps faster than any internal review did.
```

### Instabase, Director, Solutions Architecture (2020 to 2021)

```text
• I built the solutions architecture team for an AI platform automating unstructured document workflows.
• The team exceeded its FY2020 revenue target.
```

### Mapbox, Senior Manager and Senior Solutions Architect (2016 to 2020)

```text
I joined as Mapbox's first customer-facing engineer and kept hitting the same blockers in enterprise deals. Each one turned out to be a missing product.

• Grew customer engineering from 1 to 15 as the company crossed $100M ARR.
• Boundaries and Atlas: enterprise customers had no administrative boundary data to join their records against, and regulated customers would not put maps in the cloud. I took both products from zero to one as founding product manager, then handed them to dedicated PMs. Both remain in Mapbox's portfolio.
• I wrote mapboxgl-jupyter and mapboxgl-powerbi, open-source libraries that put Mapbox maps inside Python notebooks and Power BI dashboards, two audiences the platform had not reached.
• I led the open-source partnership with Uber that connected Mapbox GL JS custom layers to deck.gl and kepler.gl, so the two ecosystems took less work to combine.
```

### Caterpillar, Technical Solutions Engineer (2012 to 2016)

```text
• I built a connected-worksite productivity system across cloud, IoT, mobile, and analytics, deployed across 50+ job sites.
• Co-inventor on two issued US patents for worksite video and audio analytics: US 9,685,009 and US 10,324,433.
```

## 5. Projects section

Current copy sweeps `@vis.gl/react-google-maps` under Ryan's authorship, which
the ledger does not support. Google Maps Platform sponsors the library; the
repository's top contributors are elsewhere.

> My Github portfolio with the OSS libraries I lead, developed, and shared

Replacement:

```text
Open-source libraries I wrote at Mapbox, mapboxgl-jupyter and mapboxgl-powerbi, plus the Google Maps Platform agent skills repo our team launched. Google Maps Platform also sponsors @vis.gl/react-google-maps, now past 1 million weekly downloads.
```

## 6. Featured section

Add, if empty: the Code Assist launch post,
[github.com/googlemaps/agent-skills](https://github.com/googlemaps/agent-skills),
"DevX Is a Growth Function," and `ryanbaumann.dev`. Long URLs belong here rather
than inside position descriptions, where LinkedIn renders them as plain text.

## 7. Open decisions

1. **Explicit sign-off needed** on every claim whose ledger row says "Ryan
   approval required": Mapbox 1 to 15 and $100M ARR, Caterpillar 50+ job sites,
   the 20+ person organization, the Voice of Developer program, the nine-month
   Intelligent Product Essentials delivery, the Boundaries and Atlas founding
   product manager role, and the Uber partnership leadership. None are publicly
   verifiable.
2. **Recommend cutting** "The team exceeded its FY2020 revenue target." It puts
   a private former employer's non-public financial attainment on a public
   profile, and it adds the least of any bullet here.

## 8. Checks run

- Character counts: headline 156 of 220, About 2,237 of 2,600, every position
  description under the 2,000 limit (Google 1,582, Mapbox 882, Google Cloud 486,
  Projects 245, Caterpillar 234, Instabase 151).
- Zero em-dashes and zero en-dashes.
- Recent internal current-employer metrics use the ledger's qualitative framing.
  No precise percentages.
- Phrase reuse: no verbatim run longer than the ledger-approved growth sentence,
  which stays word for word by design. Checked with the repo's own six-word
  shingle method against `portfolio/content/**`.
- Public figures reverified: Google Maps Platform "more than 10 million websites
  and apps" against the cited launch post, and npm weekly downloads for
  `@vis.gl/react-google-maps` above 1 million.
