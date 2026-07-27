---
title: Privacy
eyebrow: Privacy
summary: How Fieldwork handles analytics, contact details, email subscriptions, Lab data, and third-party services.
---

Effective July 17, 2026. Fieldwork collects as little data as practical. Public pages work without an account or personalized advertising.

## Contact

The contact form sends your selected intent, message, name, and email address to a server-managed email provider so Ryan can receive and reply to your note. The server may send the selected intent and message to Google's Gemini service to check for unsolicited advertising before delivery. Name and email are not included in that classifier request. The site does not publish your email address. Do not include secrets, customer data, or other sensitive information in the message.

## Email list

The subscribe form sends your email address to Resend so Ryan can send occasional updates about new essays, talks, and Labs. Resend retains the contact, subscription status, and delivery history. Every marketing email includes an unsubscribe link. Unsubscribing changes your delivery preference; it does not necessarily delete the contact record. Only addresses that directly opt in, or that can be traced to a prior explicit opt-in, belong on this list.

## Comments

Comments on field notes, where enabled, are GitHub Discussions rendered by the open-source [giscus](https://giscus.app) widget. Posting requires signing in to GitHub inside the widget; comments are public and stored by GitHub under its own [privacy practices](https://docs.github.com/site-policy/privacy-policies). This site never sees your GitHub credentials.

## Fieldwork analytics

Google Analytics is on by default on Fieldwork and the Labs applications hosted with it. It measures page paths, a sanitized internal referrer, approved campaign tags (`utm_source`, `utm_medium`, `utm_campaign`, and `utm_content`), and low-cardinality actions such as selecting a content item, subscribing, or completing the contact form. Advertising storage and personalization signals are disabled.

Arbitrary query parameters are excluded. Analytics events must not contain names, email addresses, form text, OAuth values, activity IDs, place names, coordinates, route geometry, photos, or raw errors. Google may still receive normal request and device information, including an IP address and browser details, under [Google’s privacy policy](https://policies.google.com/privacy). Browser privacy controls and content blockers may limit this collection. Experiments hosted outside Fieldwork follow their own analytics and privacy practices.

## Labs

Same-origin Lab applications can call third-party services to provide their core functionality. Strava 3D Explorer can process account and activity data after you choose to connect Strava. Air Quality Map and Isochrones can send a selected location to their supporting APIs.

Hairstyle AI Studio sends photos and style instructions to Google's Gemini service only after you request a recommendation, generation, or refinement. Fieldwork provides five successful image generations per client IP per UTC day and keeps that daily count only in the running server's memory. You may instead provide a personal Gemini API key; the app validates it through the same-origin proxy, keeps it only in the current browser tab's memory, and never includes it in analytics. Fieldwork does not store personal keys or photos on the server. Generated looks and history stay in your browser until you delete them or clear the site's local data.

Real World Reasoning Agent sends the locations, map actions, and prompts needed for a live mission to Google Maps Platform and Gemini through Fieldwork's same-origin gateway. A personal Gemini key is optional, validated without generating content, kept only in the current tab's memory, and never included in analytics. Diagnostics are off unless you opt in; the gateway accepts only bounded structural status labels and rejects URLs, coordinates, place IDs, prompts, and identity data.

Do not submit a location, connect an account, provide an API key, or upload a photo unless you accept the relevant provider terms and privacy practices.

Labs also links to experiments hosted outside Fieldwork. Those destinations run separately and are governed by their own privacy notices and providers.

## Third-party links

Links to GitHub, LinkedIn, Substack, X, YouTube, Google, npm, and other sites take you to services with their own privacy practices. This policy covers Fieldwork and same-origin Lab applications, not external sites.

Questions about this policy can be sent through [the contact form](/contact/).
