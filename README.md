# 🕰️ Chrono-Hadith

> An interactive Islamic knowledge atlas for exploring hadith transmission, narrators, historical events, places, dynasties, books, and the relationships between them.

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![React Flow](https://img.shields.io/badge/React_Flow-12.3-FF0072)](https://reactflow.dev/)
[![GitHub Pages](https://github.com/Menarul3281/chrono-hadith-react/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Menarul3281/chrono-hadith-react/actions/workflows/deploy-pages.yml)

## 🌐 Live demos

| Platform | Link |
| --- | --- |
| ▲ Vercel | [chrono-hadith-react.vercel.app](https://chrono-hadith-react.vercel.app/) |
| 🐙 GitHub Pages | [menarul3281.github.io/chrono-hadith-react](https://menarul3281.github.io/chrono-hadith-react/) |

## ✨ What is Chrono-Hadith?

Chrono-Hadith brings several kinds of historical and hadith-related records into one connected interface. Instead of treating narrators, reports, books, places, and events as isolated lists, the app helps readers move between them and understand how each record fits into the wider archive.

The project combines:

- 🔗 isnad and transmission-chain exploration;
- 🧭 historical timelines, events, and places;
- 🕸️ relationship graphs powered by React Flow;
- 👤 profiles for companions, narrators, scholars, and rulers;
- 📚 browsable hadith collections and classical books;
- 🏛️ dynasty, region, and historical-period views;
- 🔎 contextual search across the active section;
- 🌓 persistent light and dark themes;
- ✨ an independent FX/atmosphere preference.

## 🗺️ Main sections

| Section | Purpose |
| --- | --- |
| 🏠 **Overview** | Introduces the archive and highlights its major connected areas. |
| ⛓️ **Isnad** | Traces a selected report through its ordered chain of transmission. |
| 🕸️ **Graph** | Displays records and documented relationships on an interactive React Flow board. |
| 🗓️ **History** | Combines the timeline, events, places, historical periods, and lifespans. |
| 👥 **Figures** | Explores companions, narrators, scholars, and related biographical records. |
| 📖 **Library** | Browses hadith reports and books through a unified tabbed section. |
| 🏛️ **Dynasties** | Presents caliphates, dynasties, rulers, regions, and historical context. |

> **Dataset note:** the Qur’an library tab is intentionally not connected until a verified dataset is available.

## 🎯 Feature highlights

### ⛓️ Isnad exploration

- Ordered chains from the Prophet ﷺ through narrators and compilers.
- Linked narrator profiles and report metadata.
- Validation that every chain reference resolves to a known record.
- Clear report grades, references, Arabic text, and English translations where available.

### 🕸️ Connected graph

- Interactive nodes and edges built with `@xyflow/react`.
- A board view and a table view of the same records.
- Stable grid placement designed to reduce card overlap.
- Relationship paths connecting figures, sources, places, themes, events, and books.
- SVG/canvas fallbacks for graph surfaces that cannot mount React Flow.

### 🗓️ Historical exploration

- Timeline lanes for figures, events, dynasties, places, and books.
- Event records with era, context, significance, participants, and citations.
- Place records with coordinates and uncertainty markers.
- Dynasty and ruler records with dates, capitals, regions, and sources.

### 🔎 Context-aware search

Search adapts to the current section and can match fields such as:

- names, kunyahs, roles, generations, and locations;
- report references, collections, narrators, and text;
- events, dates, eras, dynasties, and places;
- book titles, authors, categories, languages, and regions.

### 🌓 Theme and presentation controls

- Persistent light/dark preference.
- Animated sun and moon theme icon.
- FX/atmosphere state is independent from the color theme.
- Motion and visual effects respect reduced-motion preferences.

## 🧰 Technology stack

| Layer | Technology |
| --- | --- |
| UI shell | React 18 |
| Build tooling | Vite 8 |
| Graphs | `@xyflow/react` 12 |
| Templates | React components plus an incremental legacy compatibility bridge |
| Styling | Modular CSS with semantic design tokens |
| Data | Versioned JSON files in `public/data` |
| Routing | Hash-based client-side routing |
| Hosting | Vercel and GitHub Pages |
| Automation | GitHub Actions |

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or newer is recommended.
- npm is included with Node.js.

### Install and run

```bash
git clone https://github.com/Menarul3281/chrono-hadith-react.git
cd chrono-hadith-react
npm install
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://127.0.0.1:5173/
```

### 🪟 Windows shortcut

Windows users can also double-click:

```text
START_CHRONO_HADITH.bat
```

The script installs missing packages and starts the development server.

## 📜 Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server on `127.0.0.1`. |
| `npm run build` | Creates an optimized production build in `dist/`. |
| `npm run preview` | Serves the production build locally for final checking. |

## 🧩 Architecture

This repository is an **incremental React migration**. React and Vite own the application shell, while several established DOM-based pages continue through a compatibility bridge. This keeps the site runnable while allowing individual areas to move to React in smaller, testable stages.

```text
index.html
    │
    ▼
src/main.js
    │
    ▼
src/App.js ─────────────── React application shell
    │
    ├── src/components/ ── React interface components
    ├── src/graph/ ─────── React Flow graph implementations
    └── src/legacyScripts.js
             │
             ▼
        public/js/ ─────── Existing page modules and data services
             │
             ▼
        public/data/ ───── Curated JSON records
```

### Important architecture details

- `src/legacyShell.js` contains the shell markup rendered by React.
- `src/legacyScripts.js` preserves the required browser-script load order.
- `src/graph/GraphFlow.js` powers the main relationship graph.
- `src/graph/NarratorFlow.js` powers figure-level network views.
- `public/js/app.js` handles hash routes and mounts the appropriate page module.
- `public/js/chrono-data.js` centralizes cross-record relationships and identifiers.
- `public/js/loader.js` loads and validates narrator and hadith data.
- `public/css/` contains route styles, shared tokens, themes, motion, and accessibility states.

## 📁 Project structure

```text
chrono-hadith-react/
├── .github/workflows/       # GitHub Pages deployment
├── public/
│   ├── css/                 # Shared and route-level styles
│   ├── data/                # Narrators, reports, events, places, books, etc.
│   └── js/                  # Data services and compatibility page modules
├── src/
│   ├── components/          # React UI components
│   ├── graph/               # React Flow graph components
│   ├── App.js               # React shell and legacy boot bridge
│   ├── legacyScripts.js     # Ordered public script loader
│   ├── legacyShell.js       # Application shell markup
│   └── main.js              # React entry point
├── index.html
├── vite.config.js
└── package.json
```

## 🗃️ Data model

The archive is built from JSON files in [`public/data`](public/data). Major record types include:

- 👤 **Narrators** — names, Arabic forms, generations, biographies, teachers, students, locations, and sources.
- 📜 **Hadith reports** — collection metadata, text, grade, primary narrator, and ordered chain links.
- 🗓️ **Events** — dates, eras, places, participants, context, significance, and citations.
- 📍 **Places** — coordinates, regions, zones, milestones, and approximation flags.
- 🏛️ **Dynasties** — dates, capitals, regions, government, contributions, and sources.
- 👑 **Rulers** — reign dates, titles, dynasty references, and source notes.
- 📚 **Books** — titles, authors, categories, languages, regions, and citations.

The complete field reference is available in [`public/data/schema.md`](public/data/schema.md).

### ✅ Data integrity rules

- Every chain narrator ID must resolve to a narrator record.
- A chain starts with the Prophet ﷺ.
- Records are linked only when the included data supports the relationship.
- Approximate or contested information should be marked rather than presented as certain.
- Derived counts are calculated from source records instead of being duplicated manually.

## ♿ Accessibility and interaction

The interface includes:

- semantic buttons, links, navigation, and landmarks;
- visible keyboard focus indicators;
- accessible names for icon-only controls;
- keyboard-operable navigation and search;
- light and dark color schemes;
- reduced-motion behavior via `prefers-reduced-motion`;
- persistent UI preferences with storage-safe fallbacks;
- responsive navigation for narrow viewports.

Accessibility is an ongoing engineering requirement rather than a one-time certification. New components should preserve keyboard use, readable contrast, clear labels, and reduced-motion alternatives.

## 🌍 Deployment

The app uses relative production asset paths, allowing the same build to work at both a root domain and a project subdirectory.

### ▲ Vercel

Vercel detects the Vite project automatically:

- Build command: `npm run build`
- Output directory: `dist`

### 🐙 GitHub Pages

Pushes to `main` trigger [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which:

1. installs dependencies with `npm ci`;
2. creates the production build;
3. uploads `dist/` as the Pages artifact;
4. deploys it to GitHub Pages.

## 🧪 Verification

Before opening a pull request or deploying a change, run:

```bash
npm run build
```

For interface changes, also check:

- keyboard navigation and visible focus;
- light and dark modes;
- FX and motion preferences independently;
- narrow and wide layouts;
- browser console and network errors;
- loading, empty, and error states where relevant.

## 🛠️ Migration roadmap

The long-term direction is to move each compatibility module into a dedicated React page without an all-at-once rewrite.

1. Select one page module from `public/js`.
2. Rebuild it as a focused React component.
3. Preserve record IDs, links, content, and accessible behavior.
4. Verify the replacement against the existing page.
5. Remove the old bridge module only after the React version is proven.

## 🤝 Contributing

Contributions are welcome. For a clean review:

1. Fork the repository.
2. Create a focused feature branch.
3. Keep data claims sourced and clearly mark uncertainty.
4. Run the production build.
5. Open a pull request describing the behavior changed and how it was verified.

Please avoid inventing isnad links, dates, borders, quotations, or scholarly claims to fill visual gaps.

## ⚠️ Content scope

This repository contains a curated sample dataset, not a complete historical or hadith archive. The interface should not be read as scholarly certification of every relationship. Source notes, verification states, uncertainty markers, and the limits of the included records remain important parts of the project.

---

Built with ⚛️ React, ⚡ Vite, and a focus on connected historical learning.
