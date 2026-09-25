# Chrono-Hadith (React + React Flow)

An incremental React migration of the **Chrono-Hadith** archive explorer — a browser app for browsing a curated dataset of hadiths, narrators (isnad chains), books, places, events, and dynasties, with interactive relationship graphs.

The React/Vite shell owns the application, while the original DOM-based pages continue to run through a compatibility bridge. Graphs are rendered by the real [`@xyflow/react`](https://reactflow.dev/) library.

## Tech Stack

- [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) (dev server & build)
- [`@xyflow/react`](https://reactflow.dev/) 12 — graph rendering (Graph page board, Figures network card)
- [`htm`](https://github.com/developit/htm) — JSX-free tagged-template markup where needed
- Legacy DOM modules in `public/js` served through a compatibility bridge
- Static JSON data in `public/data` (source of truth; see `public/data/schema.md`)

## Getting Started

### Prerequisites

- Node.js LTS ([nodejs.org](https://nodejs.org/))

### Windows (easiest)

Double-click **`START_CHRONO_HADITH.bat`**. It installs packages on first run, then starts the Vite dev server. Keep the console window open while using the app.

### Any platform (terminal)

```bash
npm install
npm run dev
```

Then open the local address Vite prints — usually <http://127.0.0.1:5173/chrono-hadith-react/>.

**Overview** is the default landing page; **Graph** is accessible from the sidebar.

## Scripts

| Command           | Description                                        |
|-------------------|----------------------------------------------------|
| `npm run dev`     | Start the Vite dev server (host `127.0.0.1`)       |
| `npm run build`   | Production build (also the project's validation check) |
| `npm run preview` | Preview the production build locally               |

## Project Structure

```
├── index.html              # App entry point
├── vite.config.js          # Vite config (base: /chrono-hadith-react/)
├── START_CHRONO_HADITH.bat # One-click Windows launcher
├── src/
│   ├── main.js             # React bootstrap
│   ├── App.js              # Shell + legacy boot code
│   ├── legacyShell.js      # Shell template for the compatibility bridge
│   ├── legacyScripts.js    # Bridge that loads public/js modules
│   ├── components/
│   │   └── OverviewRibbon.jsx
│   └── graph/
│       ├── GraphFlow.js    # Graph page via @xyflow/react
│       └── NarratorFlow.js # Figure network card via @xyflow/react
├── public/
│   ├── js/                 # Legacy DOM modules (Isnad, Timeline, Overview,
│   │                       # Figures, Hadiths, Books, Places, Events,
│   │                       # Dynasties, sidebar, search)
│   ├── css/                # Site stylesheets (tokens, base, per-page CSS)
│   └── data/               # JSON archive: narrators, hadiths, books,
│                           # places, events, dynasties, rulers + schema.md
├── scripts/
│   └── patch-toggles.mjs   # Maintenance script
└── .github/workflows/
    └── deploy-pages.yml    # GitHub Pages deployment on push to main
```

## Architecture Notes

- **Incremental migration, not a full rewrite.** The Isnad, Timeline, Overview, Figures, Hadiths, Books, Places, Events, Dynasties pages, plus the sidebar and search, still run through the compatibility bridge so their existing interactions and CSS don't require a high-risk all-at-once rewrite.
- **React Flow graphs.** The Graph page (`src/graph/GraphFlow.js`) and the figure network card on the Figures page (`src/graph/NarratorFlow.js`) mount real `@xyflow/react`. If mounting fails, each falls back to the page's own SVG/canvas renderer. React Flow's stylesheet is imported by those modules, so there is exactly one copy that cannot drift from the installed version.
- **The Graph board.** Laid out like the reference design: the Prophet at the centre, family and lineage above, companions below, sources/places/events to the left, and the transmission (tabi'un, scholars, books) to the right. Records sit in fixed grid cells to prevent overlap; relations route like circuit traces (straight runs and 45° bends). Two views: board and table of the same records.
- **Data integrity.** JSON files remain the source of truth; browser storage holds only reader preferences and selections. Validation rejects malformed chains and duplicate record IDs before publishing collections. See `AUDIT_NOTES.md` for the full list of fixes and interface changes.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy-pages.yml`, which builds with Vite and publishes to GitHub Pages under the `/chrono-hadith-react/` base path.

## Validation & Known Limits

- Run `npm run build` to repeat the production-build check.
- Browser visual and interactive testing remains unverified (no browser connection was available during development); desktop and mobile rendering still need visual QA.
- Settings, theme, and the global Filters button are existing "coming soon" controls.

## Migration Next Stage

Move each DOM-driven module to a dedicated React component/page in small tested steps. Keep the original source ZIP as a reference, and do not delete the `public/js` bridge until the replacement React page is tested.

## Data Disclaimer

This project includes only its original sample/curated dataset, not a complete historical archive. The UI does not imply extra hadith records or verified relationships beyond those present in the original files.

## Related Documents

- `README_START_HERE.txt` — quick-start notes for the migration package
- `AUDIT_NOTES.md` — code/interface review: fixes, polish, verification limits
- `public/data/schema.md` — data schema v1 (narrators, hadiths)
