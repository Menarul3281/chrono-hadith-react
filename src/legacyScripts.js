// Source script order is preserved so legacy module globals resolve correctly.
// Prefix public assets with Vite's configured base so they also load when the
// app is hosted below a project path (for example, GitHub Pages).
const publicBase = import.meta.env.BASE_URL;

export const legacyScripts = [
  "icons.js",
  "loader.js",
  "clipboard.js",
  "picker.js",
  "isnad-view.js",
  "network.js",
  "narrator-view.js",
  "timeline-data.js",
  "timeline.js",
  "chrono-data.js",
  "chrono-art.js",
  "dynasty-geo.js",
  "events-view.js",
  "dynasties-view.js",
  "books-view.js",
  "hadiths-view.js",
  "places-view.js",
  "graph-view.js",
  "overview-graph.js",
  "overview-view.js",
  "motion.js",
  "tooltips.js",
  "topsearch.js",
  "site-chrome.js",
  "theme.js",
  "hadith-of-day.js",
  "app.js"
].map((file) => `${publicBase}js/${file}`);
