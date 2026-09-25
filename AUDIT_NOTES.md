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

## Verification

Run `npm.cmd run build` from this directory. The former regression test files were removed during repository cleanup.

The production build passed after restoring declared dependencies and aligning `@vitejs/plugin-react` with Vite 8. Browser visual and interactive QA could not run because no browser connection was available; desktop and mobile rendering still need visual verification.

The app still uses the existing incremental React/legacy architecture. Settings and the global Filters button remain existing “coming soon” controls; this review does not turn them into new features or change the historical dataset. The interface currently ships with one fixed light palette.
