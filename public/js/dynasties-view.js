/* Islamic Dynasties view. Route: #dynasties, deep links
   #dynasties?id=<dynastyId>&view=<map|timeline|all|profile>&from=<events>.

   The sidebar filters the catalog, the centre holds the territory map (with the
   dynasty timeline that can take its place), and the right panel reads the
   selected dynasty. Two further views — the full catalog and a dynasty profile —
   are routes of their own, so both can be linked to. */

const DynastiesView = (() => {
  const state = {
    query: '',
    regions: new Set(),
    types: new Set(),
    quick: null,
    window: { from: 600, to: 1930 },
    year: 1300,
    selectedId: null,
    tab: 0,
    view: 'map',
    page: 'dashboard',
    chart: { from: 600, to: 2000 },
    showOverlaps: true,
    mapZoom: 1,
    mapPan: { x: 0, y: 0 },
    mapFocus: null,
    from: null,
    host: null,
  };

  const TABS = ['Overview', 'Rulers', 'Major Events', 'Places', 'Legacy'];

  const esc = ChronoData.esc;
  const yearLabel = (y) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);
  const rangeLabel = (a, b) => `${yearLabel(a)} – ${yearLabel(b)}`;

  const arrow = () => '<span class="ev-arrow" data-icon="arrow-right"></span>';

  const on = (el, type, fn) => {
    const key = `__dyb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  };

  // ---- Filtering ----------------------------------------------------------

  function haystack(d) {
    return [
      d.name, d.arabic, d.full, d.type, d.typeNote, d.region, d.regions.join(' '),
      d.capital, d.government, d.religion, d.languages.join(' '),
      d.summary, d.contributions.join(' '),
      rangeLabel(d.start, d.end),
      ChronoData.rulersOfDynasty(d.id).map((r) => `${r.name} ${r.title} ${r.start} ${r.end}`).join(' '),
      (d.capitalIds || []).map((id) => ChronoData.place(id)?.name || '').join(' '),
    ].join(' ').toLowerCase();
  }

  function matches(d, skip) {
    if (skip !== 'q' && state.query && !haystack(d).includes(state.query)) return false;
    if (skip !== 'region' && state.regions.size && !state.regions.has(d.region)) return false;
    if (skip !== 'type' && state.types.size && !state.types.has(d.type)) return false;
    if (skip !== 'window' && !(d.start <= state.window.to && d.end >= state.window.from)) return false;
    if (state.quick && d.id !== state.quick) return false;
    return true;
  }

  const filtered = (skip) => ChronoData.allDynasties().filter((d) => matches(d, skip));

  const filtersActive = () =>
    Boolean(state.query || state.regions.size || state.types.size || state.quick)
    || state.window.from !== windowBounds().min || state.window.to !== windowBounds().max;

  const windowBounds = () => {
    const all = ChronoData.allDynasties();
    return {
      min: Math.floor(Math.min(...all.map((d) => d.start)) / 10) * 10,
      max: Math.ceil(Math.max(...all.map((d) => d.end)) / 10) * 10,
    };
  };

  // ---- Header and sidebar -------------------------------------------------

  const counter = (icon, value, label, colour) => `
    <div class="dsh-counter" style="--c:${colour}">
      <span class="dsh-counter-ico" data-icon="${icon}"></span>
      <span class="dsh-counter-copy">
        <span class="dsh-counter-num">${value}</span>
        <span class="dsh-counter-lbl">${esc(label)}</span>
      </span>
    </div>`;

  function headerHtml() {
    const t = ChronoData.totals();
    // The title and description sit in the topbar; this row is the counters, each
    // one a count of records the archive holds.
    return `
      <div class="bk-top">
        ${counter('crown', t.dynasties, 'Dynasties', 'var(--gold)')}
        ${counter('people', t.rulers, 'Rulers', 'var(--red)')}
        ${counter('map', t.cities, 'Major Cities', 'var(--orange)')}
        ${counter('scroll', t.keyEvents, 'Key Events', 'var(--teal)')}
      </div>`;
  }

  const checkRow = (group, value, label, count, dot) => {
    const set = group === 'region' ? state.regions : state.types;
    return `
      <label class="dsh-check">
        <input type="checkbox" data-dygroup="${group}" value="${esc(value)}"${set.has(value) ? ' checked' : ''}>
        <span class="dsh-box" aria-hidden="true"></span>
        ${dot ? `<span class="dsh-dot" style="--dot:${dot}"></span>` : ''}
        <span class="dsh-check-label">${esc(label)}</span>
        <span class="dsh-check-count">${count}</span>
      </label>`;
  };

  /* A dual-handle range: two inputs over one track, the way the timeline slider
     works, so both ends of the window can be set without a library. */
  function periodSliderHtml() {
    const { min, max } = windowBounds();
    const { from, to } = state.window;
    const span = Math.max(1, max - min);
    const left = ((from - min) / span) * 100;
    const right = ((to - min) / span) * 100;
    return `
      <div class="dsh-range" style="--lo:${left.toFixed(2)}%; --hi:${right.toFixed(2)}%">
        <div class="dsh-range-track"><span class="dsh-range-fill"></span></div>
        <input type="range" id="dyFrom" min="${min}" max="${max}" step="10" value="${from}" aria-label="Earliest year">
        <input type="range" id="dyTo" min="${min}" max="${max}" step="10" value="${to}" aria-label="Latest year">
      </div>
      <div class="dsh-range-readout">
        <span>${esc(yearLabel(from))}</span>
        <span>${esc(yearLabel(to))}</span>
      </div>`;
  }

  function sidebarContentsHtml() {
    const tot = ChronoData.totals();
    const regions = ChronoData.DYN_REGIONS.map((r) => ({
      key: r,
      count: ChronoData.allDynasties().filter((d) => d.region === r).length,
    }));
    const types = ChronoData.DYN_TYPES.map((t) => ({
      key: t,
      count: ChronoData.allDynasties().filter((d) => d.type === t).length,
    }));

    return `
        <div class="dsh-group">
          <h2 class="dsh-group-title">Time Period</h2>
          ${periodSliderHtml()}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Region</h2>
          ${regions.map((r) => checkRow('region', r.key, r.key, r.count)).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Type</h2>
          ${types.map((t) => checkRow('type', t.key, t.key, t.count)).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Quick Filters</h2>
          <div class="dy-quick">
            ${ChronoData.QUICK_DYNASTIES.map((id) => {
              const d = ChronoData.dynasty(id);
              if (!d) return '';
              return `<button class="dsh-chip quick${state.quick === id ? ' active' : ''}" type="button"
                        data-quick="${esc(id)}" style="--dyn:${d.colour}">${esc(d.name)}</button>`;
            }).join('')}
            <button class="dsh-chip quick${state.quick ? '' : ' active'}" type="button" data-quick="">All Dynasties</button>
          </div>
        </div>

        <div class="dsh-side-foot stacked">
          <button class="dsh-btn primary" type="button" id="dyAll">View All Dynasties</button>
          <button class="dsh-btn" type="button" id="dyReset">Reset Filters</button>
          <p class="dsh-footnote">Filters apply as you set them · ${filtered().length} of ${tot.dynasties} dynasties shown</p>
        </div>`;
  }

  const sidebarHtml = () => `
    <aside class="dsh-side dy-side" id="dySide" aria-label="Dynasty filters">
      ${sidebarContentsHtml()}
    </aside>`;

  // ---- Territory map ------------------------------------------------------

  const regionPath = (keys) => keys
    .map((k) => DynastyGeo.REGIONS[k])
    .filter(Boolean)
    .map((r) => DynastyGeo.ringPath(r.ring))
    .join(' ');

  function graticuleMarkup() {
    const { VIEW, PLANE_W, PLANE_H } = DynastyGeo;
    const out = [];
    for (let lon = Math.ceil(VIEW.lonMin / 10) * 10; lon <= VIEW.lonMax; lon += 10) {
      const [x] = DynastyGeo.project([lon, 0]);
      out.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${PLANE_H.toFixed(1)}"/>`);
    }
    for (let lat = Math.ceil(VIEW.latMin / 5) * 5; lat <= VIEW.latMax; lat += 5) {
      const [, y] = DynastyGeo.project([0, lat]);
      out.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${PLANE_W}" y2="${y.toFixed(1)}"/>`);
    }
    return out.join('');
  }

  function terrHtml(d, period, selected) {
    const path = regionPath(period.regions);
    const first = DynastyGeo.REGIONS[period.regions[0]];
    const [lx, ly] = first ? DynastyGeo.centroid(first.ring) : [0, 0];
    return `
      <g class="dym-terr${selected ? ' selected' : ''}" data-dynasty="${esc(d.id)}" tabindex="0" role="button"
         aria-label="${esc(`${d.full || d.name}, ${rangeLabel(period.from, period.to)}`)}"
         style="--dyn:${d.colour}">
        <title>${esc(`${d.full || d.name} — ${rangeLabel(period.from, period.to)}`)}</title>
        <path class="dym-fill" d="${path}" fill-rule="nonzero"/>
        <path class="dym-edge" d="${path}" fill="none"/>
        <text class="dym-label" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${esc(d.name)}</text>
      </g>`;
  }

  const cityHtml = (place, kind, focused) => {
    const [x, y] = DynastyGeo.project([place.lon, place.lat]);
    return `
      <g class="dym-city${focused ? ' focused' : ''}">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${focused ? 7 : 3.4}" class="dym-city-dot"/>
        <text x="${(x + 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" class="dym-city-label">${esc(place.name)}${focused ? ` <tspan class="dym-city-kind">· ${esc(kind)}</tspan>` : ''}</text>
      </g>`;
  };

  function legendHtml(snaps, year) {
    if (!snaps.length) {
      return `<p class="dym-legend-note">No recorded extent covers ${esc(yearLabel(year))}. Move the year to a period a dynasty ruled in.</p>`;
    }
    return `
      <ul class="dym-legend">
        ${snaps.map(({ dynasty: d, period }) => `
          <li>
            <button class="dym-legend-item${state.selectedId === d.id ? ' active' : ''}" type="button"
                    data-dynasty="${esc(d.id)}" style="--dyn:${d.colour}">
              <span class="dym-legend-dot"></span>
              <span class="dym-legend-name">${esc(d.name)}</span>
              <span class="dym-legend-years">(${esc(String(period.from))}–${esc(String(period.to))})</span>
            </button>
          </li>`).join('')}
      </ul>`;
  }

  function mapPanelHtml() {
    const year = state.year;
    const snaps = DynastyGeo.snapshot(year);
    const { PLANE_W, PLANE_H } = DynastyGeo;
    // Cities on the frame: the capitals of the dynasties drawn for this year,
    // plus the sites of the selected dynasty's own events.
    const cities = new Map();
    snaps.forEach(({ dynasty: d }) => {
      (d.capitalIds || []).forEach((id) => {
        const p = ChronoData.place(id);
        if (p) cities.set(p.id, { place: p, kind: 'Capital' });
      });
    });
    if (state.selectedId) {
      ChronoData.placesOfDynasty(state.selectedId).forEach((x) => {
        if (!cities.has(x.place.id)) cities.set(x.place.id, x);
      });
    }
    const focus = state.mapFocus ? ChronoData.place(state.mapFocus) : null;
    const bounds = DynastyGeo.yearBounds();

    return `
      <div class="dym-bar">
          <div class="dsh-views small" role="group" aria-label="Central view">
            <button class="dsh-view-btn${state.view === 'map' ? ' active' : ''}" type="button" data-dyview="map">
              <span class="nav-icon" data-icon="map"></span>Map View
            </button>
            <button class="dsh-view-btn${state.view === 'timeline' ? ' active' : ''}" type="button" data-dyview="timeline">
              <span class="nav-icon" data-icon="timeline"></span>Timeline View
            </button>
          </div>
          <div class="dym-year">
            <label for="dyYear">Extents as recorded for</label>
            <input id="dyYear" type="range" min="${bounds.min}" max="${bounds.max}" step="5" value="${year}" />
            <output id="dyYearOut">${esc(yearLabel(year))}</output>
            <span class="dym-steppers">
              <button class="dsh-iconbtn" type="button" data-year="prev" aria-label="Earlier period" title="Earlier period"><span class="nav-icon" data-icon="arrow-left"></span></button>
              <button class="dsh-iconbtn" type="button" data-year="next" aria-label="Later period" title="Later period"><span class="nav-icon" data-icon="arrow-right"></span></button>
            </span>
          </div>
      </div>

      <div class="dym-wrap">
        <div class="dym-frame">
          <svg class="dym-svg" id="dyMapSvg" viewBox="0 0 ${PLANE_W} ${PLANE_H}" role="img"
               aria-label="Territories recorded for ${esc(yearLabel(year))}">
            <defs>
              <radialGradient id="dymSea" cx="50%" cy="40%" r="75%">
                <stop offset="0" stop-color="#07202c"/>
                <stop offset="1" stop-color="#02121a"/>
              </radialGradient>
              <filter id="dymGrain">
                <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7" result="n"/>
                <feColorMatrix in="n" type="saturate" values="0"/>
                <feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
              </filter>
            </defs>
            <rect width="${PLANE_W}" height="${PLANE_H}" fill="url(#dymSea)"/>
            <g id="dyMapView">
              <g class="dym-graticule">${graticuleMarkup()}</g>
              <g class="dym-land">${coastMarkupCache || ''}</g>
              <rect class="dym-grain" width="${PLANE_W}" height="${PLANE_H}" filter="url(#dymGrain)"/>
              <g class="dym-terrs">${snaps.map(({ dynasty: d, period }) => terrHtml(d, period, d.id === state.selectedId)).join('')}</g>
              <g class="dym-cities">${[...cities.values()].map((c) => cityHtml(c.place, c.kind, Boolean(focus && focus.id === c.place.id))).join('')}</g>
            </g>
            <g class="dym-compass" transform="translate(${(PLANE_W - 46).toFixed(0)}, ${(PLANE_H - 62).toFixed(0)})">
              <circle r="17" class="dym-compass-ring"/>
              <path d="M0 -11 L5 4 L0 1 L-5 4 Z" class="dym-compass-needle"/>
              <text y="13" text-anchor="middle" class="dym-compass-n">N</text>
            </g>
            <text x="14" y="${(PLANE_H - 12).toFixed(0)}" class="dym-frame-note">Schematic · territories and borders are approximate</text>
          </svg>

          <div class="dym-zoom">
            <button class="dsh-iconbtn" type="button" data-dymap="in" aria-label="Zoom in" title="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
            <button class="dsh-iconbtn" type="button" data-dymap="out" aria-label="Zoom out" title="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
            <button class="dsh-iconbtn" type="button" data-dymap="reset" aria-label="Recentre" title="Recentre"><span class="nav-icon" data-icon="recenter"></span></button>
          </div>
        </div>

        <div class="dym-legend-wrap">
          <h3 class="dym-legend-title">On the map in ${esc(yearLabel(year))}</h3>
          ${legendHtml(snaps, year)}
          <p class="dym-legend-note">
            Where two states claimed the same corridor in the same year, both are drawn.
            Regions are the areas the sources describe, not surveyed frontiers.
          </p>
        </div>
      </div>`;
  }

  // ---- Dynasty timeline chart --------------------------------------------

  /* Bars are packed into levels: with overlaps on, every dynasty keeps a level of
     its own so concurrent periods can be compared; with it off, the rows are
     packed greedily so the chart stays compact. */
  function chartRows(list) {
    if (state.showOverlaps) return list.map((d) => [d]);
    const rows = [];
    list.forEach((d) => {
      const row = rows.find((r) => r.every((x) => d.start >= x.end || d.end <= x.start));
      if (row) row.push(d); else rows.push([d]);
    });
    return rows;
  }

  function chartHtml() {
    const list = filtered();
    const rows = chartRows(list);
    const { from, to } = state.chart;
    const span = Math.max(50, to - from);
    const W = 1000;
    const rowH = 30, gap = 8, axisH = 26, pad = 10;
    const H = axisH + rows.length * (rowH + gap) + pad;
    const x = (year) => ((Math.min(Math.max(year, from), to) - from) / span) * W;

    const gridStep = span > 900 ? 100 : span > 400 ? 50 : span > 150 ? 25 : 10;
    const grid = [];
    for (let y = Math.ceil(from / gridStep) * gridStep; y <= to; y += gridStep) {
      grid.push(`<line x1="${x(y).toFixed(1)}" y1="${axisH}" x2="${x(y).toFixed(1)}" y2="${H}" class="dyt-grid"/>`);
      grid.push(`<text x="${x(y).toFixed(1)}" y="${axisH - 9}" class="dyt-tick" text-anchor="middle">${y}</text>`);
    }

    const bars = rows.map((row, ri) => row.map((d) => {
      const bx = x(d.start);
      const bw = Math.max(6, x(d.end) - bx);
      const by = axisH + 4 + ri * (rowH + gap);
      const selected = d.id === state.selectedId;
      const labelInto = bw > 150;
      return `
        <g class="dyt-bar${selected ? ' selected' : ''}" data-dynasty="${esc(d.id)}" tabindex="0" role="button"
           aria-label="${esc(`${d.full || d.name}, ${rangeLabel(d.start, d.end)}`)}" style="--dyn:${d.colour}">
          <title>${esc(`${d.full || d.name} — ${rangeLabel(d.start, d.end)}`)}</title>
          <rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${rowH}" rx="4" class="dyt-bar-bg"/>
          <circle cx="${bx.toFixed(1)}" cy="${(by + rowH / 2).toFixed(1)}" r="4" class="dyt-bar-dot"/>
          <text x="${(bx + 12).toFixed(1)}" y="${(by + rowH / 2 + 4).toFixed(1)}"
                class="dyt-bar-label${labelInto ? '' : ' outside'}"
                ${labelInto ? '' : `transform="translate(${(bw + 8).toFixed(1)} 0)"`}>${esc(d.name)}</text>
        </g>`;
    }).join('')).join('');

    return `
      <div class="dyt" id="dyChart">
        <div class="dyt-bar-top">
          <h3 class="dyt-title">Dynasty Timeline</h3>
          <span class="dyt-controls">
            <span class="dyt-readout" id="dyChartWindow">${esc(yearLabel(Math.round(from)))} – ${esc(yearLabel(Math.round(to)))}</span>
            <label class="dsh-switch">
              <input type="checkbox" id="dyOverlaps"${state.showOverlaps ? ' checked' : ''}>
              <span class="dsh-switch-track" aria-hidden="true"></span>
              <span>Show Overlaps</span>
            </label>
            <button class="dsh-btn tiny" type="button" id="dyChartFit">Fit</button>
            <button class="dsh-iconbtn" type="button" data-dychart="in" aria-label="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
            <button class="dsh-iconbtn" type="button" data-dychart="out" aria-label="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
          </span>
        </div>
        <div class="dyt-frame">
          <svg class="dyt-svg" id="dyChartSvg" viewBox="0 0 ${W} ${H}" role="img"
               style="aspect-ratio:${(W / H).toFixed(3)}"
               aria-label="Lifespans of the dynasties on record">
            <line x1="0" y1="${axisH}" x2="${W}" y2="${axisH}" class="dyt-axis"/>
            <g id="dyChartContent">
              ${grid.join('')}
              ${bars}
            </g>
          </svg>
        </div>
        <p class="dyt-note">
          Drag to pan, scroll to zoom. Bars run from each dynasty's recorded beginning to its recorded end;
          ${state.showOverlaps ? 'every dynasty holds its own level so concurrent periods can be compared.' : 'concurrent dynasties share a level.'}
        </p>
      </div>`;
  }

  // ---- Dynasty panel ------------------------------------------------------

  const rulerRow = (r) => `
    <li class="dyp-ruler">
      <span class="dyp-ruler-years">${esc(String(r.start))}–${esc(String(r.end))}</span>
      <span class="dyp-ruler-copy">
        <span class="dyp-ruler-name">${r.narratorId
          ? `<a href="${ChronoData.links.figure(r.narratorId)}">${esc(r.name)}</a>`
          : esc(r.name)}</span>
        <span class="dyp-ruler-meta">${esc(r.title)}${r.arabic ? ` · <span lang="ar" dir="rtl">${esc(r.arabic)}</span>` : ''}${
          r.narratorId ? ' · archive profile' : ' · no profile in the archive yet'}</span>
        ${r.note ? `<span class="dyp-ruler-note">${esc(r.note)}</span>` : ''}
      </span>
    </li>`;

  /* Every event row on the dynasties page is a link to the record on the Events
     page, carrying the dynasty along so the way back is kept. */
  const eventCard = (e) => {
    const type = ChronoData.typeInfo(e.uiType);
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    return `
      <a class="dyp-event" href="${ChronoData.links.event(e.id, 'dynasties')}" style="--dot:${type.color}">
        <span class="dyp-event-year">${esc(yearLabel(e.year))}</span>
        <span class="dyp-event-copy">
          <span class="dyp-event-name">${esc(e.name)}</span>
          <span class="dyp-event-meta">${esc(type.label)}${place ? ` · ${esc(place.name)}` : ''}</span>
        </span>
        ${arrow()}
      </a>`;
  };

  const placeRow = (entry) => `
    <li class="dyp-place">
      <span class="dyp-place-copy">
        <span class="dyp-place-name">${esc(entry.place.name)} <span class="dyp-place-kind">${esc(entry.kind)}</span></span>
        <span class="dyp-place-meta">${esc(entry.place.region)} · ${entry.place.lat.toFixed(2)}, ${entry.place.lon.toFixed(2)}${
          entry.place.approx ? ' (approx.)' : ''}</span>
      </span>
      <button class="dsh-btn tiny" type="button" data-focus-place="${esc(entry.place.id)}">Show on map</button>
    </li>`;

  function panelTabHtml(d, index) {
    const rulers = ChronoData.rulersOfDynasty(d.id);
    const events = ChronoData.eventsOfDynasty(d.id);
    const places = ChronoData.placesOfDynasty(d.id);
    const capitals = (d.capitalIds || []).map((id) => ChronoData.place(id)).filter(Boolean);

    if (index === 0) {
      return `
        <p class="ev-prose">${esc(d.summary)}</p>
        <dl class="ev-facts">
          <dt>Capital</dt><dd>${capitals.map((p) => esc(p.name)).join(', ') || esc(d.capital)}</dd>
          <dt>Regions</dt><dd>${esc(d.regions.join(', '))}</dd>
          <dt>Government</dt><dd>${esc(d.government)}</dd>
          <dt>Languages</dt><dd>${esc(d.languages.join(', '))}</dd>
          <dt>Religion</dt><dd>${esc(d.religion)}</dd>
          <dt>Notable rulers</dt><dd>${rulers.slice(0, 4).map((r) => `<button class="dsh-chip" type="button" data-dytab-jump="1">${esc(r.name)}</button>`).join(' ') || '—'}</dd>
          <dt>Key contributions</dt><dd>${d.contributions.map((c) => esc(c)).join('<br>')}</dd>
          <dt>Sources</dt><dd>${esc(d.sources.join('; '))}</dd>
        </dl>
        <h3 class="ev-subhead">Events in the archive</h3>
        ${events.length
          ? `<div class="dyp-events">${events.slice(0, 4).map(eventCard).join('')}</div>`
          : '<p class="ev-note">No event in the archive is linked to this dynasty yet.</p>'}
        <div class="ev-linkrow">
          <a class="dsh-btn small" href="${ChronoData.links.timelineDynasty(d)}">Open on the Timeline ${arrow()}</a>
          ${events.length ? `<a class="dsh-btn small" href="${ChronoData.links.event(events[0].id, 'dynasties')}">Open its first event ${arrow()}</a>` : ''}
        </div>`;
    }

    if (index === 1) {
      return rulers.length
        ? `<ol class="dyp-rulers">${rulers.map(rulerRow).join('')}</ol>
           <p class="ev-note">Reign dates follow the sources named for each dynasty. A ruler without an
           archive profile is listed without a link rather than pointed at a record that does not exist.</p>`
        : '<p class="ev-note">No ruler record is held for this dynasty.</p>';
    }

    if (index === 2) {
      return events.length
        ? `<div class="dyp-events">${events.map(eventCard).join('')}</div>
           <p class="ev-note">Each record opens on the Events page with that event selected; your dynasty stays
           selected here, and the Events page shows the way back.</p>`
        : '<p class="ev-note">No event in the archive is linked to this dynasty yet.</p>';
    }

    if (index === 3) {
      return `${places.length
        ? `<ul class="dyp-places">${places.map(placeRow).join('')}</ul>`
        : '<p class="ev-note">No place is recorded for this dynasty yet.</p>'}
        <p class="ev-note">Capitals come from the dynasty record; the other sites are the places of its own
        events. Coordinates are those of the modern site.</p>`;
    }

    return `
      <ul class="dyp-legacy">${d.contributions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <h3 class="ev-subhead">Events that show it</h3>
      ${events.length
        ? `<div class="dyp-events">${events.slice(0, 5).map(eventCard).join('')}</div>`
        : '<p class="ev-note">No linked event in the archive.</p>'}
      <h3 class="ev-subhead">Sources</h3>
      <p class="ev-prose">${esc(d.sources.join('; '))}</p>`;
  }

  function panelContentsHtml(d) {
    if (!d) return '<div class="dsh-empty">Select a dynasty.</div>';
    const rulers = ChronoData.rulersOfDynasty(d.id);
    const events = ChronoData.eventsOfDynasty(d.id);
    const places = ChronoData.placesOfDynasty(d.id);
    const yearIn = state.year >= d.start && state.year <= d.end;

    return `
        <div class="dyp-hero" style="--dyn:${d.colour}">
          ${ChronoArt.emblemFrame(d, { w: 480, h: 200 })}
          <span class="dyp-hero-name">${esc(d.full || d.name)}</span>
          <span class="dyp-hero-years">${esc(rangeLabel(d.start, d.end))}</span>
        </div>
        <div class="ev-panel-head">
          <h2 class="ev-panel-title">${esc(d.full || d.name)}</h2>
          ${d.arabic ? `<p class="dyp-arabic" lang="ar" dir="rtl">${esc(d.arabic)}</p>` : ''}
          <div class="ev-panel-meta">
            <span class="ev-meta">${esc(rangeLabel(d.start, d.end))}</span>
            <span class="ev-meta"><span class="ev-pin"></span>${esc(d.capital)}</span>
          </div>
          <div class="ev-panel-badges">
            <span class="ev-badge era">${esc(d.type)}</span>
            <span class="ev-badge">${esc(d.region)}</span>
            ${d.typeNote ? `<span class="ev-badge soft">${esc(d.typeNote)}</span>` : ''}
            ${yearIn ? '' : `<span class="ev-badge warn">Not extant in ${esc(yearLabel(state.year))}</span>`}
          </div>
        </div>
        <div class="ev-tabs" role="tablist">
          ${TABS.map((t, i) => `
            <button class="ev-tab${i === state.tab ? ' active' : ''}" type="button" role="tab" data-dytab="${i}"
                    aria-selected="${i === state.tab}">${t}${i === 1 ? ` <em>(${rulers.length})</em>` : ''}${i === 2 ? ` <em>(${events.length})</em>` : ''}${i === 3 ? ` <em>(${places.length})</em>` : ''}</button>`).join('')}
        </div>
        <div class="ev-tabbody" id="dyTabBody" role="tabpanel">${panelTabHtml(d, state.tab)}</div>
        <div class="dyp-foot">
          <a class="dsh-btn primary block" href="#dynasties?view=profile&id=${encodeURIComponent(d.id)}">
            View Full Dynasty Profile ${arrow()}
          </a>
        </div>`;
  }

  const panelHtml = (d) => `
    <aside class="dsh-panel dy-panel" id="dyPanel" aria-label="Selected dynasty">
      ${panelContentsHtml(d)}
    </aside>`;

  // ---- Carousel, catalog and profile -------------------------------------

  const cardHtml = (d, big = false) => `
    <button class="dy-card${state.selectedId === d.id ? ' selected' : ''}${big ? ' big' : ''}" type="button"
            data-dynasty="${esc(d.id)}" style="--dyn:${d.colour}">
      <span class="dy-card-art">${ChronoArt.emblemFrame(d, { w: 280, h: 150 })}</span>
      <span class="dy-card-body">
        <span class="dy-card-name">${esc(d.name)}</span>
        <span class="dy-card-years">${esc(rangeLabel(d.start, d.end))}</span>
        ${big ? `<span class="dy-card-meta">${esc(d.type)} · ${esc(d.region)} · ${esc(d.capital)}</span>` : ''}
      </span>
    </button>`;

  function carouselHtml() {
    const list = filtered();
    return `
      <section class="dy-carousel-wrap" aria-label="Major Dynasties">
        <div class="dy-carousel-head">
          <h2 class="dyt-title">Major Dynasties</h2>
          <a class="dy-more" href="#dynasties?view=all">View All Dynasties ${arrow()}</a>
        </div>
        <div class="dy-carousel">
          <button class="dy-arrow" type="button" data-carousel="-1" aria-label="Scroll left"><span class="nav-icon" data-icon="chevron-left"></span></button>
          <div class="dy-track" id="dyTrack">
            ${list.map((d) => cardHtml(d)).join('')}
          </div>
          <button class="dy-arrow" type="button" data-carousel="1" aria-label="Scroll right"><span class="nav-icon" data-icon="chevron-right"></span></button>
        </div>
      </section>`;
  }

  const centerHtml = () => `
    <section class="dsh-center dy-center" id="dyCenter" aria-label="Dynasty map and timeline">
      <div class="dy-slot" id="dyMapSlot">${mapPanelHtml()}</div>
      <div class="dy-slot" id="dyChartSlot">${chartHtml()}</div>
      <div id="dyCarouselSlot">${carouselHtml()}</div>
    </section>`;

  const shellHtml = () => `
    <div class="dsh dy">
      ${headerHtml()}
      <div id="dyContext"></div>
      <div class="dsh-body">
        ${sidebarHtml()}
        ${centerHtml()}
        ${panelHtml(ChronoData.dynasty(state.selectedId))}
      </div>
    </div>`;

  /* The complete catalog: every dynasty the archive holds, filtered by the same
     sidebar rules. */
  function catalogHtml() {
    const list = filtered();
    return `
      <div class="dsh dy dy-page">
        <header class="dsh-head">
          <div class="dsh-head-id">
            <span class="dsh-head-icon" data-icon="crown" style="--c:var(--gold)"></span>
            <div>
              <h1 class="dsh-title">All Dynasties</h1>
              <p class="dsh-sub">Every dynasty recorded in the archive — ${list.length} of ${ChronoData.allDynasties().length} shown.</p>
            </div>
          </div>
          <div class="dsh-counters">
            <a class="dsh-btn" href="#dynasties">
              <span class="ev-arrow flip" data-icon="arrow-right"></span>Back to the map
            </a>
          </div>
        </header>
        <div class="dy-catalog">
          ${list.length
            ? list.map((d) => cardHtml(d, true)).join('')
            : '<div class="dsh-empty">No dynasty matches the filters.</div>'}
        </div>
      </div>`;
  }

  function profileHtml(d) {
    if (!d) {
      return `<div class="dsh dy dy-page"><div class="dsh-empty">That dynasty is not in the archive.
        <a class="dsh-btn small" href="#dynasties">Back to the dynasties map</a></div></div>`;
    }
    const rulers = ChronoData.rulersOfDynasty(d.id);
    const events = ChronoData.eventsOfDynasty(d.id);
    const places = ChronoData.placesOfDynasty(d.id);
    const capitals = (d.capitalIds || []).map((id) => ChronoData.place(id)).filter(Boolean);

    return `
      <div class="dsh dy dy-page">
        <header class="dsh-head">
          <div class="dsh-head-id">
            <span class="dsh-head-icon" data-icon="crown" style="--c:${d.colour}"></span>
            <div>
              <h1 class="dsh-title">${esc(d.full || d.name)}</h1>
              <p class="dsh-sub">${esc(rangeLabel(d.start, d.end))} · ${esc(d.type)} · ${esc(d.capital)}</p>
            </div>
          </div>
          <div class="dsh-counters">
            <a class="dsh-btn" href="#dynasties?id=${encodeURIComponent(d.id)}">
              <span class="ev-arrow flip" data-icon="arrow-right"></span>Back to the map
            </a>
          </div>
        </header>

        <div class="dyp-profile">
          <div class="dyp-profile-hero" style="--dyn:${d.colour}">
            ${ChronoArt.emblemFrame(d, { w: 900, h: 260 })}
            <span class="dyp-hero-name">${esc(d.name)}</span>
            ${d.arabic ? `<span class="dyp-hero-arabic" lang="ar" dir="rtl">${esc(d.arabic)}</span>` : ''}
          </div>

          <div class="dyp-profile-body">
            <section class="dyp-section">
              <h2>Overview</h2>
              <p>${esc(d.summary)}</p>
              <dl class="ev-facts">
                <dt>Type</dt><dd>${esc(d.type)}${d.typeNote ? ` — ${esc(d.typeNote)}` : ''}</dd>
                <dt>Capitals</dt><dd>${capitals.map((p) => esc(p.name)).join(', ') || esc(d.capital)}</dd>
                <dt>Regions</dt><dd>${esc(d.regions.join(', '))}</dd>
                <dt>Government</dt><dd>${esc(d.government)}</dd>
                <dt>Languages</dt><dd>${esc(d.languages.join(', '))}</dd>
                <dt>Religion</dt><dd>${esc(d.religion)}</dd>
              </dl>
              ${events.length ? `<div class="ev-linkrow"><a class="dsh-btn small" href="${ChronoData.links.event(events[0].id, 'dynasties')}">Open its records on the Events page ${arrow()}</a></div>` : ''}
            </section>

            <section class="dyp-section">
              <h2>Rulers (${rulers.length})</h2>
              ${rulers.length ? `<ol class="dyp-rulers">${rulers.map(rulerRow).join('')}</ol>` : '<p class="ev-note">None recorded in the archive.</p>'}
            </section>

            <section class="dyp-section">
              <h2>Major Events (${events.length})</h2>
              ${events.length ? `<div class="dyp-events">${events.map(eventCard).join('')}</div>` : '<p class="ev-note">None recorded in the archive.</p>'}
            </section>

            <section class="dyp-section">
              <h2>Places (${places.length})</h2>
              ${places.length ? `<ul class="dyp-places">${places.map(placeRow).join('')}</ul>` : '<p class="ev-note">None recorded in the archive.</p>'}
            </section>

            <section class="dyp-section">
              <h2>Legacy</h2>
              <ul class="dyp-legacy">${d.contributions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
            </section>

            <section class="dyp-section">
              <h2>Sources</h2>
              <ul class="dyp-legacy">${d.sources.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
              <p class="ev-note">Territory shapes on the map are schematic and marked approximate; the map frame
              states the same caveat.</p>
            </section>
          </div>
        </div>
      </div>`;
  }

  // ---- Map plumbing -------------------------------------------------------

  let coastMarkupCache = null;

  async function coastMarkup() {
    if (coastMarkupCache !== null) return coastMarkupCache;
    const rings = await DynastyGeo.land();
    coastMarkupCache = rings.map((d, i) => `<path d="${d}" class="dym-land-shape${i === 0 ? ' main' : ''}"/>`).join('');
    return coastMarkupCache;
  }

  function applyMapTransform() {
    const g = state.host?.querySelector('#dyMapView');
    if (!g) return;
    const s = state.mapZoom;
    const { PLANE_W, PLANE_H } = DynastyGeo;
    const tx = (PLANE_W / 2) * (1 - s) + state.mapPan.x;
    const ty = (PLANE_H / 2) * (1 - s) + state.mapPan.y;
    g.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(3)})`);
  }

  /* Centres the frame on a place at the given zoom: the inverse of the transform
     above, so "Show on map" lands the site in the middle of the frame. */
  function centreOn(placeId, zoom = 3) {
    const target = placeId ? ChronoData.place(placeId) : null;
    if (!target) return;
    const [x, y] = DynastyGeo.project([target.lon, target.lat]);
    const { PLANE_W, PLANE_H } = DynastyGeo;
    state.mapZoom = zoom;
    state.mapPan = { x: zoom * (PLANE_W / 2 - x), y: zoom * (PLANE_H / 2 - y) };
  }

  function placeChart() {
    const chart = state.host?.querySelector('#dyChart');
    const mapSlot = state.host?.querySelector('#dyMapSlot');
    const chartSlot = state.host?.querySelector('#dyChartSlot');
    if (!chart || !mapSlot || !chartSlot) return;
    const inMap = state.view === 'timeline';
    (inMap ? mapSlot : chartSlot).appendChild(chart);
    mapSlot.querySelector('.dym-wrap')?.classList.toggle('hidden', inMap);
    chartSlot.classList.toggle('hidden', inMap);
    chart.classList.toggle('expanded', inMap);
  }

  function renderMap() {
    const slot = state.host.querySelector('#dyMapSlot');
    slot.innerHTML = mapPanelHtml();
    Icons.init(slot);
    bindMap(slot);
    applyMapTransform();
  }

  function renderChart() {
    const mapSlot = state.host.querySelector('#dyMapSlot');
    const slot = state.host.querySelector('#dyChartSlot');
    mapSlot.querySelector('#dyChart')?.remove();
    slot.classList.remove('hidden');
    slot.innerHTML = chartHtml();
    Icons.init(slot);
    bindChart(slot);
    placeChart();
  }

  function renderSide() {
    const host = state.host.querySelector('#dySide');
    host.innerHTML = sidebarContentsHtml();
    Icons.init(host);
    bindSide(host);
  }

  function renderPanel() {
    const host = state.host.querySelector('#dyPanel');
    host.innerHTML = panelContentsHtml(ChronoData.dynasty(state.selectedId));
    Icons.init(host);
    bindPanel(host);
  }

  function renderCarousel() {
    const slot = state.host.querySelector('#dyCarouselSlot');
    slot.innerHTML = carouselHtml();
    Icons.init(slot);
    bindCenter(slot);
  }

  /* Filters change what the map and the chart show, so both are rebuilt. */
  function refreshCentral() {
    renderMap();
    renderChart();
    renderCarousel();
    renderPanel();
    const note = state.host.querySelector('#dySide .dsh-footnote');
    if (note) {
      const t = ChronoData.totals();
      note.textContent = `Filters apply as you set them · ${filtered().length} of ${t.dynasties} dynasties shown`;
    }
  }

  function selectDynasty(id) {
    if (!ChronoData.dynasty(id)) return;
    state.selectedId = id;
    state.mapFocus = null;
    ChronoData.remember({ dynastyId: id });
    // The year follows the dynasty when the current one is outside its rule, so
    // the reader always opens on a frame where the state exists.
    const d = ChronoData.dynasty(id);
    if (state.year < d.start || state.year > d.end) state.year = Math.round((d.start + d.end) / 2 / 5) * 5;
    syncHash();
    renderMap();
    renderChart();
    renderCarousel();
    renderPanel();
  }

  function setYear(year) {
    state.year = Math.max(DynastyGeo.yearBounds().min, Math.min(DynastyGeo.yearBounds().max, Math.round(year)));
    state.mapFocus = null;
    renderMap();
    renderPanel();
  }

  // ---- Filters ------------------------------------------------------------

  function syncHash() {
    const p = [];
    if (state.selectedId) p.push(`id=${encodeURIComponent(state.selectedId)}`);
    if (state.from) p.push(`from=${encodeURIComponent(state.from)}`);
    history.replaceState(null, '', `#dynasties${p.length ? '?' + p.join('&') : ''}`);
  }

  function setQuick(id) {
    state.quick = id || null;
    renderSide();
    refreshCentral();
  }

  function setWindow(patch) {
    const b = windowBounds();
    const next = { ...state.window, ...patch };
    if (next.from > next.to - 20) {
      if (patch.from != null) next.from = next.to - 20; else next.to = next.from + 20;
    }
    state.window = {
      from: Math.max(b.min, Math.min(b.max, next.from)),
      to: Math.max(b.min, Math.min(b.max, next.to)),
    };
    renderSide();
    refreshCentral();
  }

  function resetFilters() {
    const b = windowBounds();
    state.query = '';
    state.regions = new Set();
    state.types = new Set();
    state.quick = null;
    state.window = { from: b.min, to: b.max };
    renderSide();
    refreshCentral();
  }

  function focusPlace(placeId) {
    ChronoData.remember({ focusPlace: placeId });
    if (state.page !== 'dashboard') {
      location.hash = ChronoData.links.dynasty(state.selectedId, 'events');
      return;
    }
    const d = ChronoData.dynasty(state.selectedId);
    if (d && (state.year < d.start || state.year > d.end)) {
      state.year = Math.round(((d.start + d.end) / 2) / 5) * 5;
    }
    state.mapFocus = placeId;
    renderMap();
    renderPanel();
    centreOn(placeId, 3);
    applyMapTransform();
  }

  // ---- Binding ------------------------------------------------------------

  function bindSide(scope) {
    scope.querySelectorAll('input[type="checkbox"][data-dygroup]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = cb.dataset.dygroup === 'region' ? state.regions : state.types;
        if (cb.checked) set.add(cb.value); else set.delete(cb.value);
        refreshCentral();
      });
    });

    scope.querySelectorAll('input[type="range"]').forEach((slider) => {
      slider.addEventListener('input', () => {
        if (slider.id === 'dyFrom') setWindow({ from: Number(slider.value) });
        else setWindow({ to: Number(slider.value) });
      });
    });

    scope.querySelectorAll('[data-quick]').forEach((btn) => {
      btn.addEventListener('click', () => setQuick(btn.dataset.quick));
    });

    scope.querySelector('#dyReset')?.addEventListener('click', resetFilters);
    scope.querySelector('#dyAll')?.addEventListener('click', () => { location.hash = '#dynasties?view=all'; });
  }

  function bindMap(scope) {
    scope.querySelectorAll('[data-dyview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.dyview;
        renderMap();
        placeChart();
      });
    });

    scope.querySelectorAll('[data-dynasty]').forEach((el) => {
      on(el, 'click', () => selectDynasty(el.dataset.dynasty));
      on(el, 'keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectDynasty(el.dataset.dynasty); }
      });
    });

    const year = scope.querySelector('#dyYear');
    if (year) {
      year.addEventListener('input', () => {
        const out = scope.querySelector('#dyYearOut');
        if (out) out.textContent = yearLabel(Number(year.value));
      });
      year.addEventListener('change', () => setYear(Number(year.value)));
    }
    scope.querySelectorAll('[data-year]').forEach((btn) => {
      btn.addEventListener('click', () => stepYear(btn.dataset.year === 'next' ? 1 : -1));
    });

    scope.querySelectorAll('[data-focus-place]').forEach((btn) => {
      btn.addEventListener('click', () => focusPlace(btn.dataset.focusPlace));
    });

    scope.querySelectorAll('[data-dymap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.dymap;
        if (mode === 'in') state.mapZoom = Math.min(8, state.mapZoom * 1.35);
        else if (mode === 'out') state.mapZoom = Math.max(1, state.mapZoom / 1.35);
        else { state.mapZoom = 1; state.mapPan = { x: 0, y: 0 }; state.mapFocus = null; renderMap(); }
        applyMapTransform();
      });
    });

    bindDrag(scope.querySelector('#dyMapSvg'));
  }

  /* Pan by dragging and zoom by wheel, the way the timeline canvas works. */
  function bindDrag(svg) {
    if (!svg) return;
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      drag = { x: ev.clientX, y: ev.clientY, pan: { ...state.mapPan } };
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const box = svg.getBoundingClientRect();
      const k = DynastyGeo.PLANE_W / (box.width || 1);
      state.mapPan = { x: drag.pan.x + (ev.clientX - drag.x) * k, y: drag.pan.y + (ev.clientY - drag.y) * k };
      applyMapTransform();
    });
    const end = (ev) => {
      if (!drag) return;
      drag = null;
      svg.classList.remove('dragging');
      if (svg.hasPointerCapture?.(ev.pointerId)) svg.releasePointerCapture(ev.pointerId);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const k = DynastyGeo.PLANE_W / (svg.getBoundingClientRect().width || 1);
      state.mapPan.x -= ev.deltaX * k;
      state.mapPan.y -= ev.deltaY * k;
      applyMapTransform();
    }, { passive: false });
  }

  /* Steps the frame to the next dated extent: every period boundary in the
     territorial data, in order, so the stepper lands on the years the reading
     actually changes. */
  function stepYear(dir) {
    const marks = new Set();
    Object.values(DynastyGeo.TERRITORIES).forEach((periods) => periods.forEach((p) => {
      marks.add(p.from); marks.add(p.to);
    }));
    const sorted = [...marks].sort((a, b) => a - b);
    const b = DynastyGeo.yearBounds();
    const next = dir > 0
      ? sorted.find((y) => y > state.year)
      : [...sorted].reverse().find((y) => y < state.year);
    setYear(next == null ? (dir > 0 ? b.max : b.min) : next);
  }

  function bindChart(scope) {
    const svg = scope.querySelector('#dyChartSvg');
    const chart = scope.querySelector('#dyChart');

    const zoomAt = (factor, pointerYear = null) => {
      const { from, to } = state.chart;
      const span = to - from;
      const anchor = pointerYear == null ? (from + to) / 2 : pointerYear;
      const nextSpan = Math.max(60, Math.min(2400, span * factor));
      let nf = anchor - ((anchor - from) / span) * nextSpan;
      let nt = nf + nextSpan;
      if (nt > 2000) { nt = 2000; nf = nt - nextSpan; }
      if (nf < 400) { nf = 400; nt = nf + nextSpan; }
      state.chart = { from: nf, to: nt };
      renderChart();
    };

    scope.querySelectorAll('[data-dychart]').forEach((btn) => {
      btn.addEventListener('click', () => zoomAt(btn.dataset.dychart === 'in' ? 0.65 : 1 / 0.65));
    });

    scope.querySelector('#dyChartFit')?.addEventListener('click', () => {
      const b = windowBounds();
      state.chart = { from: b.min, to: b.max };
      renderChart();
    });

    scope.querySelector('#dyOverlaps')?.addEventListener('change', (ev) => {
      state.showOverlaps = ev.target.checked;
      renderChart();
    });

    scope.querySelectorAll('[data-dynasty]').forEach((el) => {
      on(el, 'click', (ev) => {
        ev.stopPropagation();
        selectDynasty(el.dataset.dynasty);
      });
      on(el, 'keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectDynasty(el.dataset.dynasty); }
      });
    });

    if (!svg) return;
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      drag = { x: ev.clientX, from: state.chart.from, to: state.chart.to };
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      // While the pointer is down the content group is simply shifted: the frame
      // stays in the DOM, so the drag keeps its grip, and the labels are not
      // rescaled. The window is committed on release.
      const box = svg.getBoundingClientRect();
      const perPx = DynastyGeo.PLANE_W / (box.width || 1);
      const shiftY = ((ev.clientX - drag.x) * perPx) / 1000 * (drag.to - drag.from);
      const g = svg.querySelector('#dyChartContent');
      if (g) g.setAttribute('transform', `translate(${(-(ev.clientX - drag.x) * perPx).toFixed(1)} 0)`);
      const win = state.host.querySelector('#dyChartWindow');
      if (win) {
        const nf = drag.from + shiftY;
        const nt = drag.to + shiftY;
        win.textContent = `${yearLabel(Math.round(nf))} – ${yearLabel(Math.round(nt))}`;
      }
    });
    const end = (ev) => {
      if (!drag) return;
      const box = svg.getBoundingClientRect();
      const perPx = DynastyGeo.PLANE_W / (box.width || 1);
      const span = drag.to - drag.from;
      let shift = ((ev.clientX - drag.x) * perPx) / 1000 * span;
      let nf = drag.from + shift;
      let nt = drag.to + shift;
      if (nf < 400) { nf = 400; nt = 400 + span; }
      if (nt > 2000) { nt = 2000; nf = 2000 - span; }
      drag = null;
      svg.classList.remove('dragging');
      if (Math.abs(nt - state.chart.to) > 1) {
        state.chart = { from: nf, to: nt };
        renderChart();
      } else {
        svg.querySelector('#dyChartContent')?.removeAttribute('transform');
      }
      if (svg.hasPointerCapture?.(ev.pointerId)) svg.releasePointerCapture(ev.pointerId);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const box = svg.getBoundingClientRect();
      const ratio = (ev.clientX - box.left) / (box.width || 1);
      const year = state.chart.from + ratio * (state.chart.to - state.chart.from);
      zoomAt(ev.deltaY < 0 ? 0.82 : 1 / 0.82, year);
    }, { passive: false });
  }

  // ---- Carousel, panel and page entry ------------------------------------

  function bindCenter(scope) {
    scope.querySelectorAll('[data-carousel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const track = scope.querySelector('#dyTrack');
        if (!track) return;
        const card = track.querySelector('.dy-card');
        const stepPx = card ? (card.getBoundingClientRect().width + 12) * 2 : 480;
        track.scrollBy({ left: Number(btn.dataset.carousel) * stepPx, behavior: 'smooth' });
      });
    });
    scope.querySelectorAll('[data-dynasty]').forEach((el) => {
      on(el, 'click', () => selectDynasty(el.dataset.dynasty));
    });
  }

  function bindPanel(scope) {
    scope.querySelectorAll('[data-dytab]').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.dytab) || 0;
        const body = scope.querySelector('#dyTabBody');
        const d = ChronoData.dynasty(state.selectedId);
        body.innerHTML = panelTabHtml(d, state.tab);
        Icons.init(body);
        scope.querySelectorAll('[data-dytab]').forEach((b) => {
          const active = Number(b.dataset.dytab) === state.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        bindPanel(scope);
      });
    });
    scope.querySelectorAll('[data-dytab-jump]').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.dytabJump) || 0;
        renderPanel();
      });
    });
    scope.querySelectorAll('[data-focus-place]').forEach((btn) => {
      on(btn, 'click', () => focusPlace(btn.dataset.focusPlace));
    });
  }

  /* Arriving from an event keeps the way back in sight. */
  function renderContext(host) {
    const stored = ChronoData.recall();
    const e = state.from === 'events' && stored.eventId ? ChronoData.event(stored.eventId) : null;
    host.innerHTML = e
      ? `<div class="dsh-context">
           <a class="dsh-btn small" href="${ChronoData.links.event(e.id, 'dynasties')}">
             <span class="ev-arrow flip" data-icon="arrow-right"></span>Back to ${esc(e.name)}
           </a>
           <span class="ev-note">You came from the Events page; that record is still selected there.</span>
         </div>`
      : '';
    Icons.init(host);
  }

  /* The frame the page opens on when no dynasty is asked for: the decade with the
     most recorded extents, so the map starts on a moment the sources describe
     with several states rather than a single one. */
  function busiestFrame() {
    const b = DynastyGeo.yearBounds();
    let year = b.min;
    let best = -1;
    for (let y = b.min; y <= b.max; y += 10) {
      const n = DynastyGeo.snapshot(y).length;
      if (n > best) { best = n; year = y; }
    }
    return { year, count: best };
  }

  async function render(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;
    await coastMarkup();
    if (!host.isConnected) return;

    state.host = host;
    const get = (k) => (params && params.get ? params.get(k) : null);
    const stored = ChronoData.recall();

    const view = get('view');
    state.page = view === 'all' ? 'all' : view === 'profile' ? 'profile' : 'dashboard';
    state.from = get('from') || null;

    // A visit opens unfiltered; the selection is the dynasty in the link, or the
    // one the reader left behind in this session.
    const b = windowBounds();
    state.query = '';
    state.regions = new Set();
    state.types = new Set();
    state.quick = null;
    state.window = { from: b.min, to: b.max };
    state.chart = { from: b.min, to: b.max };
    state.showOverlaps = true;
    state.mapZoom = 1;
    state.mapPan = { x: 0, y: 0 };
    state.mapFocus = null;
    state.tab = 0;
    state.view = 'map';

    const wanted = get('id') || stored.dynastyId || null;
    const asked = ChronoData.dynasty(wanted);
    if (asked) {
      // A link or a remembered selection: open on that dynasty, in a year it
      // ruled, so the frame and the panel agree.
      state.selectedId = asked.id;
      state.year = Math.round(((Math.max(asked.start, 600) + Math.min(asked.end, 1930)) / 2) / 5) * 5;
    } else {
      const frame = busiestFrame();
      state.year = frame.year;
      const extant = DynastyGeo.snapshot(frame.year).map((x) => x.dynasty);
      state.selectedId = (extant[extant.length - 1] || ChronoData.allDynasties()[0])?.id || null;
    }

    if (state.page === 'profile') {
      state.selectedId = ChronoData.dynasty(get('id')) ? get('id') : state.selectedId;
      host.innerHTML = profileHtml(ChronoData.dynasty(state.selectedId));
      Icons.init(host);
      bindPanel(host);
      return;
    }

    if (state.page === 'all') {
      host.innerHTML = catalogHtml();
      Icons.init(host);
      host.querySelectorAll('[data-dynasty]').forEach((el) => {
        el.addEventListener('click', () => {
          ChronoData.remember({ dynastyId: el.dataset.dynasty });
          location.hash = ChronoData.links.dynasty(el.dataset.dynasty, 'dynasties');
        });
      });
      return;
    }

    host.innerHTML = shellHtml();
    Icons.init(host);
    renderContext(host.querySelector('#dyContext'));
    bindSide(host.querySelector('#dySide'));
    bindMap(host.querySelector('#dyMapSlot'));
    bindChart(host.querySelector('#dyChartSlot'));
    bindCenter(host.querySelector('#dyCarouselSlot'));
    bindPanel(host.querySelector('#dyPanel'));
    placeChart();

    if (stored.focusPlace && ChronoData.place(stored.focusPlace)) {
      state.mapFocus = stored.focusPlace;
      renderMap();
      centreOn(stored.focusPlace, 3);
    }
    applyMapTransform();

    if (state.selectedId) {
      ChronoData.remember({ dynastyId: state.selectedId });
      syncHash();
    }
  }

  function searchScope() {
    const built = [
      ...ChronoData.allDynasties().map((d) => ({
        id: ChronoData.cid.dynasty(d.id),
        label: d.name,
        group: 'dynasty',
        meta: 'dynasty',
        sub: `${d.start} – ${d.end} · ${d.capital}`,
        icon: 'crown',
        colour: d.colour,
        hay: `${d.name} ${d.arabic} ${d.full} ${d.capital} ${d.region} ${d.regions.join(' ')} ${d.type} ${d.rulers ? '' : ''}`.toLowerCase(),
      })),
      ...ChronoData.allRulers().map((r) => ({
        id: ChronoData.cid.ruler(r.id),
        label: r.name,
        group: 'ruler',
        meta: r.title,
        sub: `${r.start} – ${r.end} · ${ChronoData.dynasty(r.dynastyId)?.name || ''}`,
        icon: 'people',
        colour: 'var(--gold)',
        hay: `${r.name} ${r.arabic} ${r.title} ${r.note || ''} ${ChronoData.dynasty(r.dynastyId)?.name || ''}`.toLowerCase(),
      })),
      ...ChronoData.allPlaces().map((p) => ({
        id: ChronoData.cid.place(p.id),
        label: p.name,
        group: 'place',
        meta: 'place',
        sub: p.region,
        icon: 'places',
        colour: 'var(--cyan)',
        hay: `${p.name} ${p.arabic || ''} ${p.region}`.toLowerCase(),
      })),
    ];
    let chip = 'all';
    return {
      label: 'Dynasties',
      placeholder: 'Search dynasties…',
      hint: 'Dynasty, ruler, capital, region or period',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All', count: built.length },
        { key: 'dynasty', label: 'Dynasties', count: built.filter((r) => r.group === 'dynasty').length },
        { key: 'ruler', label: 'Rulers', count: built.filter((r) => r.group === 'ruler').length },
        { key: 'place', label: 'Capitals & places', count: built.filter((r) => r.group === 'place').length },
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => {
        const { kind, id: raw } = ChronoData.resolve(id);
        if (kind === 'dynasty') {
          if (!filtered().some((d) => d.id === raw)) {
            return { hidden: true, message: 'A region, type, period or quick filter keeps it off the map.' };
          }
          selectDynasty(raw);
          return;
        }
        if (kind === 'ruler') {
          const ruler = ChronoData.allRulers().find((r) => r.id === raw);
          if (ruler) {
            state.tab = 1;
            selectDynasty(ruler.dynastyId);
          }
          return;
        }
        if (kind === 'place') location.hash = `#places?id=${encodeURIComponent(raw)}`;
      },
      reveal: (id) => {
        resetFilters();
        selectDynasty(ChronoData.resolve(id).id);
      },
    };
  }

  return { render, searchScope };
})();
