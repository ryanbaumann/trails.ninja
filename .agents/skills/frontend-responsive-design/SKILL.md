---
name: frontend-responsive-design
description: Design and review responsive frontend layouts, styling, accessibility, interaction behavior, Tailwind usage, and visual QA for the portfolio and demo apps. Use before changing layout, CSS, semantic HTML, map controls, responsive behavior, or other perceptible frontend interactions.
---

# Frontend Responsive Design Skill

Use this skill for tasks involving layout, styling, accessibility, responsive behavior, Tailwind utility usage, HTML structure, visual QA, or frontend interaction design in either app.

## Primary References

Prefer current platform documentation for behavior questions:

- Responsive web design basics: https://web.dev/articles/responsive-web-design-basics
- MDN container queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- MDN responsive images: https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/HTML/Responsive_images
- WCAG quick reference: https://www.w3.org/WAI/WCAG22/quickref/
- Tailwind CSS docs when editing Tailwind-heavy markup: https://tailwindcss.com/docs

## Workflow

1. Determine the app and styling system:
   - `demos/strava-explorer/` uses Vite and app-local CSS.
   - `demos/aqi-map/` uses Vite and app-local CSS.
2. Inspect the relevant HTML and JavaScript before changing classes or structure.
3. Start from the smallest supported viewport and progressively enhance for larger containers/viewports.
4. Prefer resilient modern CSS:
   - `clamp()` for fluid spacing/type with limits.
   - CSS Grid/Flexbox with `minmax()`, `auto-fit`, and sensible intrinsic sizing.
   - Container queries for component-level changes when the component can appear in multiple page contexts.
   - Viewport media queries for major page-shell changes.
5. Maintain accessibility while changing visuals:
   - Explicit labels for inputs and controls.
   - Meaningful `alt` text for images.
   - Semantic buttons/links instead of clickable divs.
   - Visible focus states and keyboard operability.
   - Announced loading/error states when practical.
6. Account for map UX: avoid panels that trap gestures, cover important map controls, or make touch targets smaller than comfortable mobile sizes. For custom map markers, keep text high-contrast and thumbnails legible over satellite/photorealistic backgrounds.
7. If animation or camera behavior changes, respect `prefers-reduced-motion` where practical.
8. Validate with the relevant build command and, for perceptible UI changes, use a browser/screenshot check when available.

## Review Checklist

- No horizontal scrolling at common mobile widths unless intentionally part of a map canvas.
- Form controls are reachable by keyboard and have accessible names.
- Interactive targets are large enough for touch use.
- Text remains legible over map backgrounds, custom markers, popovers, and side panels.
- Layout works with long activity names, empty states, loading states, and error messages.
- External CSS frameworks do not override map internals unexpectedly.
