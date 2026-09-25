CHRONO-HADITH — REACT + REACT FLOW MIGRATION PACKAGE
================================================

HOW TO START (Windows / VS Code)
1. Extract this ZIP to a new folder. Keep your original site unchanged.
2. In VS Code choose File > Open Folder and open CHRONO-HADITH-REACT.
3. EASIEST: Double-click START_CHRONO_HADITH.bat in the extracted folder.
   It installs packages if needed, then starts Vite. Keep the black window open.
   Alternative (in VS Code terminal): npm.cmd install && npm.cmd run dev
4. Open the Local address printed by Vite (usually http://127.0.0.1:5173/).
   Overview is the default landing page. Graph is accessible from the sidebar.

STATUS — PLEASE READ
This is a runnable, incremental React migration, not a claim that every page has
already been rewritten in idiomatic React. React/Vite owns the application shell,
and the site's graphs are drawn by the real @xyflow/react npm library: the Graph
page (src/graph/GraphFlow.js) and a figure's network card on the Figures page
(src/graph/NarratorFlow.js), each of which falls back to the page's own SVG or
canvas renderer if it cannot mount. React Flow's own stylesheet is imported by
those modules, so there is one copy of it and it cannot drift from the installed
version.
The original Isnad, Timeline, Overview, Figures, Hadiths, Books, Places, Events,
Dynasties, sidebar, and search continue through a compatibility bridge so their
existing interactions and CSS do not need a high-risk all-at-once rewrite.
Their DOM-based modules live in public/js. The shell template is in
src/legacyShell.js; the legacy boot code is in src/App.js.

GRAPH PAGE — THE BOARD
The Graph page draws the archive as a board laid out like the reference design: the
Prophet at its centre, family and lineage above him, the companions below him, the
sources, places and events to the left, and the transmission — tabi'un, scholars and
the books they carried — to the right. Every band is captioned on the canvas and
counted in the rail, so the picture names its own regions. Each record sits in one
cell of a fixed grid, which is what keeps the cards from overlapping whatever the
archive's counts are; the relations between them are routed the way a circuit board
routes a trace — straight runs and 45° bends, leaving and arriving on the sides that
face each other. The page has two views, the board and a table of the same records.
The archive's Timeline is a route of its own and is not offered from this page.

VALIDATION
The production build passes with the installed dependencies. Run
npm.cmd run build from this folder to repeat the check. The former regression
test files were removed during repository cleanup. Browser visual and interactive
testing remains unverified because no browser connection was available in this session.
See AUDIT_NOTES.md for the fixes, interface changes, and verification limits.

MIGRATION NEXT STAGE
Move each DOM-driven module to a dedicated React component/page in small tested
steps. Keep the original source ZIP as a reference. Do not delete the public/js
bridge until the replacement React page is tested. The browser-facing content,
record IDs and cross-links all remain derived from the original uploaded data.

NOTES
The source project only includes its original sample/curated dataset, not a
complete historical archive. The UI does not imply extra hadith records or
verified relationships beyond those present in the original files.
