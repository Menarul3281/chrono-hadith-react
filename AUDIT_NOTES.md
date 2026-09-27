# Code and interface review

## Fixes

- Shared JSON request cache and in-flight load promises prevent duplicate archive requests. Failed requests and invalid collections can be retried; failures no longer become permanently empty archives.
- Hadith IDs and frequently used relationships have in-memory indexes. Timeline and its search share the archive loader. JSON remains the source of truth; browser storage holds only reader preferences and selections.
- Validation rejects malformed chains and duplicate record IDs before publishing collections.
- Topic resolution preserves nested IDs and colons in topic labels. Event participant totals are separate from archive figure totals.
- Route hosts and search request versions prevent stale asynchronous work from replacing the latest page or results. Page failures expose a retry action.
- Search handles uppercase queries and mobile opening correctly. The report picker delegates to shared search. Invalid or blocked browser storage no longer interrupts report selection.
- Graph nodes retain dragged positions, edges follow those positions, deep links focus their record, and selecting a hidden family reveals it. Table rows support Enter and Space. Graph roots and timeline observers are cleaned up on navigation.
- Clipboard fallback reports failed copies accurately. Daily report rotation uses calendar dates without daylight-saving drift.

## Interface polish

- Shared text tooltips on navigation, titled controls and graph records, with keyboard focus support and Escape dismissal.
- Subtle hover elevation, row highlights, graph outlines, consistent focus indicators and a skip link.
- Reduced-motion support and removal of perpetual selected-card border animations.
- Click feedback uses the animation API instead of forcing synchronous layout.
- Mobile navigation closes after choosing a page, and search displays the correct platform shortcut.
- A dark theme sits beside the light palette. The choice is one attribute on the document, written before the first paint so no route flashes the wrong field, and it is remembered per browser. Until the reader chooses, the operating system decides; the rail switch then states the action, not just the state.

## Verification

Run `npm.cmd run build` from this directory. The former regression test files were removed during repository cleanup.

The production build passed after restoring declared dependencies and aligning `@vitejs/plugin-react` with Vite 8. Browser visual QA was performed with a headless Edge session at 1440 × 1200 and 390 × 844 across the overview, graph, figures and dynasties routes (see the Apple design pass below); no browser session was connected for interactive regression, so live keyboard/animation flows still need a manual check.

The app still uses the existing incremental React/legacy architecture. Settings and the global Filters button remain existing “coming soon” controls; this review does not turn them into new features or change the historical dataset. The dark theme added in this pass is not yet visible: the toggle, the pre-paint attribute and the dark colour tokens all work, but `public/css/theme-dark.css` is not linked from `index.html`, so the dark palette never loads and text and surfaces keep their hard-coded light values. The interface therefore still renders its light palette only.

## Apple design pass · 2026-09-26

### Summary

Overall rating after the pass: **Good**. Chrono-Hadith's thesis is now explicit in the interface: help readers see how Islamic knowledge travels through people, places, reports, and time. Its memorable element remains the interactive archive board; the work deliberately avoids turning the site into an imitation of a native Apple app.

This is a React web experience, so Apple's guidance was translated into browser-native CSS, ARIA, responsive breakpoints, system appearance preferences, and familiar scrolling. Platform-specific iOS and macOS conventions were not applied where they would feel foreign on the web.

### Improvements implemented

- **Critical · Legibility and contrast:** raised shared body, small, and utility type floors; changed the light accent from `#008577` to `#007a6e` (5.16:1 on `#f8fffc`, 4.84:1 on `#eef8f7`); and added readable foregrounds for accent-filled states. This follows `accessibility.md › Vision` and `typography.md › Ensuring legibility`.
- **Critical · Control size:** established 36 px desktop controls and 44 px compact/touch controls for navigation, buttons, tabs, chips, dialog dismissal, and map/graph actions. This follows `accessibility.md › Mobility`.
- **High · Adaptability:** constrained route shells to the viewport, made route tabs locally scrollable, let text/toolbars reflow, stacked overview actions at compact widths, and removed the functionless compact 3D accessory. This follows `layout.md › Adaptability`.
- **High · Material hierarchy:** reserved translucency and blur for floating navigation or transient controls and made content panels opaque. This follows `materials.md › Liquid Glass`.
- **High · Appearance:** applies the saved or system light/dark preference before first paint and adds high-contrast, reduced-transparency, forced-color, and reduced-motion responses. This follows `dark-mode.md › Best practices`, `dark-mode.md › Dark Mode colors`, and `motion.md › Best practices`.
- **Medium · Familiarity:** restored the browser's native scrollbar and removed the decorative duplicate scroll rail. This follows `design-principles.md › Familiarity` and `design-principles.md › Simplicity`.
- **Medium · Non-color cues:** strengthened selected navigation with weight and a persistent shape, in addition to accent color. This follows `accessibility.md › Vision`.

### Craft notes

The plan passed the specificity check: the same solution would not fit a generic knowledge dashboard because the graph board, archival typography, Arabic material, mint field, and restrained gold signal all come from this subject. The one accessory removed was the compact-width 3D toggle, where it added decoration without useful control. Branding now defers more consistently to the records, following `branding.md › Best practices`.

### Verification

- Production build passes with Vite 8.
- Headless Edge visual QA completed at 1440 × 1200 and 390 × 844 for the overview, plus desktop graph, figures, and dynasties routes.
- Light and dark tokens both meet the shared text contrast floor; the remaining category colors are paired with labels or shapes and aren't the sole carrier of meaning.
