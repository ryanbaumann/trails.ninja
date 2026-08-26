---
name: google-maps-a2ui
description: Maps Agentic UI Toolkit (MAUI) skills for A2UI on Google Maps Platform. Use when generating, rendering, or validating interactive A2UI surfaces, Google Maps components (GoogleMap, PlaceDetailsCompact), and conversational UI for spatial reasoning agents.
license: Apache-2.0
metadata:
  version: 1.0.0
  source: https://github.com/googlemaps/a2ui
---

# Google Maps Agentic UI Toolkit (MAUI) & A2UI Skill

This skill defines the operational contracts, component catalog extensions, and prompt engineering patterns for the **Maps Agentic UI Toolkit (MAUI)** and **A2UI v1.0** (and v0.9) protocol on Google Maps Platform.

## 1. Core Objectives & Framework Overview

- **A2UI Protocol**: Generates structured, declarative UI envelopes (`createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`) rather than raw executable HTML/JS or plain conversational markdown. Supports single-message `createSurface` with embedded `components` and `dataModel` in v1.0.
- **Catalog Identification**: Official catalog ID is `a2ui://maps-agentic-ui-catalog.json` (also mapped to `atlas://maps-agentic-ui-catalog` in Atlas native React renderer).
- **Attribution ID**: When instantiating Maps web components, attach the internal usage attribution ID `gmp_web_maui_v0.1.8_atoui` or `gmp_git_agentskills_v1`.

---

## 2. Component Catalog & Schema Extension

### Official MAUI Components

| Component | Required Props | Optional Props | Description |
| :--- | :--- | :--- | :--- |
| `GoogleMap` | `center`, `zoom` | `tilt`, `mode` (`"roadmap"` \| `"satellite"`), `heading`, `anchorMarker`, `markers`, `routes`, `travelMode`, `mapId`, `gestureHandling` | Renders a 2D or Photorealistic 3D map viewport with pins, routes, and camera control. |
| `PlaceDetailsCompact` | `placeId` | `orientation` (`"horizontal"` \| `"vertical"`) | Renders compact place card with photo, rating, price, and status via Places UI Kit (`gmp-place-details-compact`). |
| `Column` / `Row` | `children` (`string[]`) | `align`, `gap`, `justify` | Flexbox structural containers for component trees. |
| `Card` | `child` (`string`) | — | Visual card surface wrapper. |
| `Text` | `text` | `variant` (`"h1"`..`"h5"`, `"body"`, `"caption"`) | Typography node with markdown formatting. |
| `List` | `children` (`string[]` \| `{ componentId, path }`) | `direction` (`"vertical"` \| `"horizontal"`) | Static or template-driven repeating list. |
| `Button` | `child`, `action` | `variant` (`"default"` \| `"primary"` \| `"borderless"`) | Interactive trigger firing actions to host or model. |
| `ChoicePicker` | `options` | `selection`, `multi`, `action` | Chip selector row for filter options. |

### Component Property Rules

1. **`PlaceDetailsCompact` Orientation Rule**:
   - Use `"vertical"` when there is only **one** `PlaceDetailsCompact` in the surface to emphasize place photography and editorial summary.
   - Use `"horizontal"` when there are **multiple** `PlaceDetailsCompact` items (e.g. within a `List`) to preserve vertical screen space.

2. **`GoogleMap` Camera & Aesthetic Rules**:
   - **Satellite Mode**: Use for outdoor activities (parks, hiking, beaches), scenic viewpoints, parking inspections, building exteriors, and walkability.
   - **Roadmap Mode**: Use for standard navigation, urban navigation, and transit.
   - **Tilt**:
     - `0°` (Flat) for Roadmap mode, outdoor parking inspection, or overhead parcel footprint.
     - `45°` (Perspective) for 3D aerial perspective, skyline, and scenic exploration.
   - **Pins**:
     - `anchorMarker`: Anchor point of search (e.g. hotel, transit center, starting location).
     - `markers`: List of candidate locations or POIs.

---

## 3. UI Decision Logic Patterns

### Pattern 1: Individual Place Focus
- **Surroundings / Exterior / Vibe**: `GoogleMap` (Satellite, Tilt 45°) + `PlaceDetailsCompact` (vertical).
- **Parking / Overhead Layout**: `GoogleMap` (Satellite, Tilt 0°) + `PlaceDetailsCompact` (vertical).
- **Interior / Services / Hours**: `PlaceDetailsCompact` (vertical, no standalone map needed).

### Pattern 2: Multiple Related Places
- **Anchored Search (Within X min of hotel/hub)**: Inline `GoogleMap` with `anchorMarker` + `List` of horizontal `PlaceDetailsCompact` items.
- **Neighborhood Survey**: Inline `GoogleMap` centered on neighborhood + `List` of horizontal `PlaceDetailsCompact` items.
- **Macro Region (Multi-City)**: `List` of `PlaceDetailsCompact` items.

### Pattern 3: Travel & Routes
- **Point-to-point or Detour / Scenic Bypass**: `GoogleMap` in routes mode with origin, destination, and waypoints, paired with `RouteItinerary` or `EtaSummary`.

---

## 4. Multi-Step Route & Search Policies

1. **Parallel Place Resolution**: Concurrently resolve place coordinates and place IDs for origin, destination, and waypoints.
2. **Parallel Segment Routing**: Concurrently compute route legs between consecutive waypoints.
3. **Dispatch Response**: Emit single valid A2UI message envelope with `createSurface`, `updateComponents`, and `updateDataModel`.
