import React from 'react';
import OverviewRibbon from './components/OverviewRibbon.jsx';

export const shellMarkup = `
  <div class="app">
    <div data-legacy-ribbon-mount hidden></div>

    <aside aria-label="Primary navigation" class="sidebar rail" id="sidebar">
      <button aria-label="Close navigation" class="sidebar-close" data-nav-close type="button">
        <span class="nav-icon" data-icon="close"></span>
      </button>

      <a class="rail-brand" data-tooltip="Chrono-Hadith — home" href="#overview" aria-label="Chrono-Hadith — home">
        <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="40" height="40" rx="12" stroke="currentColor" stroke-opacity=".35"/>
          <circle cx="24" cy="10" r="3.4" fill="currentColor"/>
          <circle cx="38" cy="24" r="3.4" fill="currentColor"/>
          <circle cx="24" cy="38" r="3.4" fill="currentColor"/>
          <circle cx="10" cy="24" r="3.4" fill="currentColor"/>
          <circle cx="24" cy="24" r="2.6" fill="currentColor"/>
          <path d="M24 10 38 24 24 38 10 24Z" stroke="currentColor" stroke-width="1.6"/>
          <path d="M24 13.5v6M34.5 24h-6M24 34.5v-6M13.5 24h6" stroke="currentColor" stroke-width="1.6"/>
        </svg>
      </a>

      <button class="rail-expand" data-rail-expand type="button" style="--n:0" aria-controls="primaryNav" aria-expanded="false" aria-label="Expand navigation">
        <span class="rail-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        <span class="rail-toggle-label" aria-hidden="true">Navigation</span>
      </button>

      <button aria-label="Search this page" class="nav-item rail-btn" data-sidebar-search data-tooltip="Search this page" style="--n:0" type="button">
        <span class="nav-icon" data-icon="search"></span><span class="nav-label">Search</span>
      </button>

      <nav aria-label="Primary" class="nav rail-nav" id="primaryNav">
        <a class="nav-item" data-tooltip="Overview" href="#overview" style="--n:0"><span class="nav-icon" data-icon="overview"></span><span class="nav-label">Overview</span></a>
        <a class="nav-item" data-tooltip="Isnad" href="#isnad" style="--n:1"><span class="nav-icon" data-icon="isnad"></span><span class="nav-label">Isnad</span></a>
        <a class="nav-item" data-tooltip="Graph" href="#graph" style="--n:2"><span class="nav-icon" data-icon="graph"></span><span class="nav-label">Graph</span></a>
        <a class="nav-item" data-tooltip="History" href="#history?view=timeline" style="--n:3"><span class="nav-icon" data-icon="timeline"></span><span class="nav-label">History</span></a>
        <a class="nav-item" data-tooltip="Figures" href="#figures" style="--n:4"><span class="nav-icon" data-icon="people"></span><span class="nav-label">Figures</span></a>
        <a class="nav-item" data-tooltip="Library" href="#library?tab=hadiths" style="--n:5"><span class="nav-icon" data-icon="books"></span><span class="nav-label">Library</span></a>
        <a class="nav-item" data-tooltip="Dynasties" href="#dynasties" style="--n:6"><span class="nav-icon" data-icon="crown"></span><span class="nav-label">Dynasties</span></a>
      </nav>

      <div class="sidebar-spacer"></div>

      <div class="rail-tools">
        <button aria-label="Filters" class="nav-item rail-btn" data-action="filters" data-tooltip="Filters" style="--n:7" type="button">
          <span class="nav-icon" data-icon="filters"></span><span class="nav-label">Filters</span>
        </button>
        <label class="rail-switch" data-tooltip="Grain and atmosphere" style="--n:9">
          <input type="checkbox" data-grain-toggle checked />
          <span class="rail-switch-track" aria-hidden="true"><span class="rail-switch-thumb"></span></span>
          <span class="nav-label">FX</span>
        </label>
        <button aria-label="Settings" class="nav-item rail-btn" data-action="settings" data-tooltip="Settings" style="--n:10" type="button">
          <span class="nav-icon" data-icon="settings"></span><span class="nav-label">Settings</span>
        </button>
      </div>
    </aside>

    <div aria-hidden="true" class="nav-scrim" id="navScrim"></div>

    <div class="main">
      <main class="page" id="page"><div class="state">Loading…</div></main>
    </div>
  </div>

  <div class="fx-grain" aria-hidden="true"></div>
  <div aria-hidden="true" class="scroll-rail" id="scrollRail"><div class="scroll-rail-thumb" id="scrollRailThumb"></div></div>
  <div aria-live="polite" class="toast" id="toast" role="status"></div>
`;


const appOpen = '<div class="app">';
const overlayStart = '<div class="fx-grain"';
const appInner = shellMarkup
  .slice(shellMarkup.indexOf(appOpen) + appOpen.length, shellMarkup.indexOf(overlayStart))
  .trim();
const mainStart = appInner.indexOf('<div class="main">');
const sidebarMarkup = appInner.slice(0, mainStart).trim();
// mainMarkup is the sidebar-side sibling: keep its own closing </div> so the
// React tree stays balanced (the removed slice previously also ate it).
let mainMarkup = appInner.slice(mainStart).trim();
mainMarkup = mainMarkup.slice(0, mainMarkup.lastIndexOf('</div>') + '</div>'.length).trim();
const overlayMarkup = shellMarkup.slice(shellMarkup.indexOf(overlayStart)).trim();

function StaticMarkup({ markup }) {
  return React.createElement('div', {
    className: 'legacy-shell-static',
    dangerouslySetInnerHTML: { __html: markup },
  });
}

export function LegacyShell() {
  // Live equivalent of the header previously held in shellMarkup: <OverviewRibbon />
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      'div',
      { className: 'app' },
      React.createElement(OverviewRibbon),
      React.createElement(StaticMarkup, { markup: sidebarMarkup }),
      React.createElement(StaticMarkup, { markup: mainMarkup }),
    ),
    React.createElement(StaticMarkup, { markup: overlayMarkup }),
  );
}
