/* Places view — the atlas. Route: #places, deep links #places?id=<placeId>&tab=<n>.

   The map reuses the same projection, coastline file and place ids that the
   Events map draws from, so a site sits in the same place on both. A place's
   kinds are read off the records that mention it (capital, event site, recorded
   milestone) rather than typed in by hand. */

const PlacesView = (() => {
  const TABS = ['Overview', 'Events', 'People', 'Hadiths'];
  const VIEWS = [
    ['all', 'All Places'],
    ['regions', 'Regions'],
    ['journeys', 'Journeys'],
  ];
  const LAYERS = [
    ['default', 'Default'],
    ['terrain', 'Terrain'],
    ['grid', 'Graticule'],
  ];

  const state = {
    kinds: new Set(), zones: new Set(), view: 'all', layer: 'default',
    selectedId: null, tab: 0, mapZoom: 1, mapPan: { x: 0, y: 0 }, year: null, host: null,
  };

  const esc = ChronoData.esc;

  /* Kinds are derived: a place is a capital, an event site or a milestone site
     when the records say so. A place can be more than one. */
  const KINDS = [
    { key: 'capital', label: 'Dynasty capital' },
    { key: 'event', label: 'Site of a recorded event' },
    { key: 'milestone', label: 'Recorded milestones' },
    { key: 'referenced', label: 'Referenced only' },
  ];

  const isCapital = (p) => ChronoData.allDynasties().some((d) => (d.capitalIds || []).includes(p.id));
  const eventsAt = (p) => ChronoData.allEvents().filter((e) => e.placeId === p.id);
  const kindsOf = (p) => {
    const out = [];
    if (isCapital(p)) out.push('capital');
    if (eventsAt(p).length) out.push('event');
    if ((p.milestones || []).length) out.push('milestone');
    if (!out.length) out.push('referenced');
    return out;
  };

  const matches = (p) => {
    if (state.kinds.size && !kindsOf(p).some((k) => state.kinds.has(k))) return false;
    if (state.zones.size && !state.zones.has(p.zone)) return false;
    return true;
  };
  const filtered = () => ChronoData.allPlaces().filter(matches);
  const selected = () => ChronoData.place(state.selectedId) || filtered()[0] || null;

  const placeYears = (p) => (p.milestones || []).map((m) => m.year);
  const allYears = () => [...new Set(ChronoData.allPlaces().flatMap(placeYears))].sort((a, b) => a - b);

  // ---- the map -----------------------------------------------------------

  let coastPaths = null;

  async function loadCoast() {
    if (!coastPaths) {
      const rings = await DynastyGeo.landRings();
      coastPaths = rings
        .map((ring, i) => `<path d="${DynastyGeo.ringPath(ring)}" class="plc-land${i === 0 ? ' main' : ''}"/>`)
        .join('');
    }
    return coastPaths;
  }

  function graticule() {
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

  const markerSize = (p) => {
    const k = kindsOf(p);
    if (k.includes('capital')) return 8;
    if (k.includes('event')) return 6.5;
    if (k.includes('milestone')) return 5.5;
    return 4;
  };

  function markerHtml(p) {
    const [x, y] = DynastyGeo.project([p.lon, p.lat]);
    const selected = state.selectedId === p.id;
    const k = kindsOf(p);
    const colour = k.includes('capital') ? 'var(--gold)'
      : k.includes('event') ? 'var(--red)'
        : k.includes('milestone') ? 'var(--cyan)' : 'var(--muted)';
    return `
      <g class="plc-marker${selected ? ' selected' : ''}" data-place="${esc(p.id)}" tabindex="0" role="button"
         aria-label="${esc(`${p.name}, ${p.region}`)}" style="--dot:${colour}">
        <title>${esc(`${p.name} — ${p.region}${p.approx ? ' (approximate site)' : ''}`)}</title>
        <circle class="plc-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(selected ? 14 : markerSize(p) * 1.9).toFixed(1)}"/>
        <circle class="plc-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${markerSize(p)}"/>
        ${selected ? `<text class="plc-tag" x="${(x + 12).toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(p.name)}</text>` : ''}
      </g>`;
  }

  /* A recorded journey between documented places. The line is drawn as a
     reconstruction and labelled as one: no route in the archive is surveyed. */
  function journeyHtml(points, label) {
    if (points.length < 2) return '';
    const path = points.map((p) => DynastyGeo.project([p.lon, p.lat]));
    const d = 'M' + path.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    return `
      <g class="plc-journey">
        <path d="${d}" fill="none"/>
        <text x="${path[0][0].toFixed(1)}" y="${(path[0][1] - 12).toFixed(1)}" class="plc-journey-label">${esc(label)}</text>
      </g>`;
  }

  function mapHtml() {
    const list = filtered();
    const { PLANE_W, PLANE_H } = DynastyGeo;
    const journeys = state.view === 'journeys'
      ? [journeyHtml(['makkah', 'madinah'].map((id) => ChronoData.place(id)).filter(Boolean), 'Hijrah, 622 CE · reconstruction')]
      : [];

    return `
      <div class="plc-frame" data-layer="${state.layer}">
        <svg class="plc-svg" id="plcMapSvg" viewBox="0 0 ${PLANE_W} ${PLANE_H}" role="img"
             aria-label="Map of the places recorded in the archive">
          <rect width="${PLANE_W}" height="${PLANE_H}" class="plc-sea"/>
          <g id="plcMapView">
            <g class="plc-graticule">${graticule()}</g>
            <g class="plc-land-wrap">${coastPaths || ''}</g>
            ${journeys.join('')}
            <g class="plc-markers">${list.map(markerHtml).join('')}</g>
          </g>
        </svg>
        <div class="plc-zoom">
          <button class="dsh-iconbtn" type="button" data-plcmap="in" aria-label="Zoom in" title="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
          <button class="dsh-iconbtn" type="button" data-plcmap="out" aria-label="Zoom out" title="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
          <button class="dsh-iconbtn" type="button" data-plcmap="reset" aria-label="Recentre" title="Recentre"><span class="nav-icon" data-icon="recenter"></span></button>
        </div>
        <div class="plc-legend">
          <span class="plc-legend-item" style="--dot:var(--gold)">Dynasty capital</span>
          <span class="plc-legend-item" style="--dot:var(--red)">Event site</span>
          <span class="plc-legend-item" style="--dot:var(--cyan)">Recorded milestones</span>
          <span class="plc-legend-item" style="--dot:var(--muted)">Referenced only</span>
          ${state.view === 'journeys'
            ? '<span class="plc-legend-note">Dashed lines are reconstructions between documented places, not surveyed routes.</span>'
            : ''}
        </div>
      </div>`;
  }

  function periodStripHtml() {
    const years = allYears();
    if (!years.length) return '';
    const from = Math.min(...years);
    const to = Math.max(...years);
    const x = (y) => ((y - from) / Math.max(1, to - from)) * 1000;
    const marks = ChronoData.allPlaces().flatMap((p) => (p.milestones || []).map((m) => ({ p, m })));
    return `
      <div class="plc-period">
        <h3 class="dsh-group-title">Time period</h3>
        <svg viewBox="0 0 1000 58" class="plc-period-svg" role="img" aria-label="Recorded place milestones">
          <line x1="0" y1="34" x2="1000" y2="34" class="plc-axis"/>
          ${marks.map(({ p, m }) => `
            <g class="plc-mark${state.selectedId === p.id ? ' selected' : ''}" data-place="${esc(p.id)}" tabindex="0" role="button"
               aria-label="${esc(`${p.name}, ${m.year}: ${m.label}`)}">
              <title>${esc(`${m.year} · ${p.name} — ${m.label}`)}</title>
              <circle cx="${x(m.year).toFixed(1)}" cy="34" r="${state.selectedId === p.id ? 6 : 3.6}"/>
              <text x="${x(m.year).toFixed(1)}" y="52" text-anchor="middle">${m.year}</text>
            </g>`).join('')}
        </svg>
        <p class="dsh-footnote">Every dot is a year the archive records for a place. A city is not
        founded in the year of an event held there.</p>
      </div>`;
  }

  // ---- sidebar, list and panel -------------------------------------------

  const stat = (icon, value, label, colour) => `
    <div class="dsh-counter" style="--c:${colour}">
      <span class="dsh-counter-ico" data-icon="${icon}"></span>
      <span class="dsh-counter-copy">
        <span class="dsh-counter-num">${value}</span>
        <span class="dsh-counter-lbl">${esc(label)}</span>
      </span>
    </div>`;

  const statsHtml = () => {
    const places = ChronoData.allPlaces();
    return `<div class="dsh-counters">
      ${stat('places', places.length, 'Places catalogued', 'var(--cyan)')}
      ${stat('overview', places.filter((p) => (p.milestones || []).length).length, 'With recorded milestones', 'var(--gold)')}
      ${stat('calendar', places.filter((p) => eventsAt(p).length).length, 'Event sites', 'var(--red)')}
      ${stat('crown', places.filter(isCapital).length, 'Dynasty capitals', 'var(--purple)')}
    </div>`;
  };

  function sidebarHtml() {
    const zones = ChronoData.REGIONS.map((r) => ({
      key: r.key,
      label: r.label,
      count: ChronoData.allPlaces().filter((p) => p.zone === r.key).length,
    }));
    const kinds = KINDS.map((k) => ({
      ...k, count: ChronoData.allPlaces().filter((p) => kindsOf(p).includes(k.key)).length,
    }));

    return `
      <div class="dsh-group">
        <h2 class="dsh-group-title">View</h2>
        <div class="dsh-views small" role="group" aria-label="View">
          ${VIEWS.map(([key, label]) => `
            <button class="dsh-view-btn${state.view === key ? ' active' : ''}" type="button" data-plcview="${key}">${esc(label)}</button>`).join('')}
        </div>
        <div class="dsh-views small" role="group" aria-label="Map layer">
          ${LAYERS.map(([key, label]) => `
            <button class="dsh-view-btn${state.layer === key ? ' active' : ''}" type="button" data-plclayer="${key}">${esc(label)}</button>`).join('')}
        </div>
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Place kind</h2>
        ${kinds.map((k) => `
          <label class="dsh-check">
            <input type="checkbox" data-plc="kind" value="${esc(k.key)}"${state.kinds.has(k.key) ? ' checked' : ''}>
            <span class="dsh-box" aria-hidden="true"></span>
            <span class="dsh-check-label">${esc(k.label)}</span>
            <span class="dsh-check-count">${k.count}</span>
          </label>`).join('')}
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Region</h2>
        ${zones.map((z) => `
          <label class="dsh-check">
            <input type="checkbox" data-plc="zone" value="${esc(z.key)}"${state.zones.has(z.key) ? ' checked' : ''}>
            <span class="dsh-box" aria-hidden="true"></span>
            <span class="dsh-check-label">${esc(z.label)}</span>
            <span class="dsh-check-count">${z.count}</span>
          </label>`).join('')}
      </div>

      <div class="dsh-side-foot stacked">
        <button class="dsh-btn" type="button" id="plcReset">Reset Filters</button>
        <p class="dsh-footnote">${filtered().length} of ${ChronoData.allPlaces().length} places shown</p>
      </div>`;
  }

  function listHtml() {
    const list = filtered();
    return `
      <div class="plc-list">
        ${list.length
          ? list.map((p) => `
            <button class="plc-row${state.selectedId === p.id ? ' selected' : ''}" type="button" data-place="${esc(p.id)}"
                    style="--dot:${kindsOf(p).includes('capital') ? 'var(--gold)' : kindsOf(p).includes('event') ? 'var(--red)' : 'var(--cyan)'}">
              <span class="plc-row-name">${esc(p.name)}${p.approx ? ' <em>approx.</em>' : ''}</span>
              <span class="plc-row-sub">${esc(p.region)} · ${esc(p.zone)}</span>
              <span class="plc-row-meta">${eventsAt(p).length ? `${eventsAt(p).length} event${eventsAt(p).length > 1 ? 's' : ''}` : ''}
                ${(p.milestones || []).length ? ` · ${p.milestones.length} milestone${p.milestones.length > 1 ? 's' : ''}` : ''}</span>
            </button>`).join('')
          : '<div class="dsh-empty">No place matches these filters.</div>'}
      </div>`;
  }

  function panelContentsHtml(p) {
    if (!p) return '<div class="dsh-empty">Select a place.</div>';
    const events = eventsAt(p);
    const dynasties = ChronoData.allDynasties().filter((d) => (d.capitalIds || []).includes(p.id));
    return `
      <div class="plc-hero" style="--dot:${kindsOf(p).includes('capital') ? 'var(--gold)' : 'var(--red)'}">
        <span class="plc-hero-mark"><span class="ev-pin"></span></span>
        <div class="plc-hero-copy">
          <h2 class="ev-panel-title">${esc(p.name)}</h2>
          ${p.arabic ? `<p class="dyp-arabic" lang="ar" dir="rtl">${esc(p.arabic)}</p>` : ''}
          <p class="plc-hero-coords">${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}${p.approx ? ' · approximate site' : ''}</p>
          <div class="ev-panel-badges">
            <span class="ev-badge era">${esc(p.region)}</span>
            <span class="ev-badge">${esc(p.zone)}</span>
            ${kindsOf(p).map((k) => `<span class="ev-badge soft">${esc(KINDS.find((x) => x.key === k)?.label || k)}</span>`).join('')}
          </div>
        </div>
      </div>
      <div class="ev-tabs" role="tablist">
        ${TABS.map((t, i) => `
          <button class="ev-tab${i === state.tab ? ' active' : ''}" type="button" role="tab" data-plctab="${i}"
                  aria-selected="${i === state.tab}">${t}</button>`).join('')}
      </div>
      <div class="ev-tabbody" id="plcTabBody" role="tabpanel">${tabHtml(p, events, dynasties, state.tab)}</div>`;
  }

  const arrowIcon = () => '<span class="ev-arrow" data-icon="arrow-right"></span>';

  const eventRow = (e) => `
    <a class="bk-ev" href="${ChronoData.links.event(e.id, 'places')}" style="--dot:${ChronoData.era(e.era).color}">
      <span class="bk-ev-year">${esc(String(e.year))}</span>
      <span class="bk-ev-name">${esc(e.name)}</span>
      ${arrowIcon()}
    </a>`;

  function tabHtml(p, events, dynasties, index) {
    if (index === 0) {
      return `
        <dl class="ev-facts">
          <dt>Region</dt><dd>${esc(p.region)}</dd>
          <dt>Zone</dt><dd>${esc(p.zone)}</dd>
          <dt>Coordinates</dt><dd>${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}${p.approx
            ? ' <span class="ev-meta-sub">approximate — the exact site is uncertain</span>' : ''}</dd>
          <dt>Recorded years</dt><dd>${(p.milestones || []).map((m) => `${m.year} · ${esc(m.label)}`).join('<br>')
            || '<span class="ev-no-site">none recorded</span>'}</dd>
          <dt>Sources</dt><dd>${esc((p.sources || []).join('; ') || '—')}</dd>
        </dl>
        ${dynasties.length ? `
          <h3 class="ev-subhead">Capital of</h3>
          <div class="ev-chiplist">${dynasties.map((d) => `
            <a class="dsh-chip dyn" style="--dyn:${d.colour}" href="${ChronoData.links.dynasty(d.id, 'places')}">${esc(d.full || d.name)}</a>`).join('')}</div>` : ''}
        <div class="ev-linkrow">
          <a class="dsh-btn small" href="#graph?node=${encodeURIComponent(ChronoData.cid.place(p.id))}">View in Graph ${arrowIcon()}</a>
          ${(p.milestones || []).length ? `<a class="dsh-btn small" href="#timeline?id=place-${esc(p.id)}-0">Open on the Timeline ${arrowIcon()}</a>` : ''}
        </div>`;
    }

    if (index === 1) {
      return `
        ${events.length
          ? `<div class="bk-evs">${events.map(eventRow).join('')}</div>
             <p class="ev-note">These are the events whose record names this place. The same event and the
             same place id appear on the Events page's map.</p>`
          : '<p class="ev-note">No event record is located here.</p>'}`;
    }

    if (index === 2) {
      const figures = ChronoData.allFigures().filter((f) =>
        (f.locations || []).some((l) => l.toLowerCase() === p.name.toLowerCase()));
      return `
        ${figures.length
          ? `<div class="ev-chiplist">${figures.map((f) => `
              <a class="dsh-chip" href="#figures?id=${esc(f.id)}">${esc(f.name)}${f.role ? ` · ${esc(f.role)}` : ''}</a>`).join('')}</div>
             <p class="ev-note">The archive records these figures at ${esc(p.name)}. It does not say a
             figure was born here unless its own record does.</p>`
          : `<p class="ev-note">No figure's record names ${esc(p.name)} in this archive.</p>`}`;
    }

    const reports = ChronoData.allReports().filter((h) => {
      const ids = new Set([h.narratorId, ...(h.chain || []).map((l) => l.narratorId)]);
      return [...ids].some((id) => (ChronoData.figure(id)?.locations || [])
        .some((l) => l.toLowerCase() === p.name.toLowerCase()));
    });
    const recordedHere = ChronoData.reportsAtPlace(p.id);
    return `
      <h3 class="ev-subhead">Reports recorded at ${esc(p.name)}</h3>
      ${recordedHere.length
        ? `<div class="ev-chiplist">${recordedHere.map((h) => `
            <a class="dsh-chip" href="#hadiths?id=${esc(h.id)}">${esc(h.reference)}</a>`).join('')}</div>
           <p class="ev-note">The report's own record names this place, so the link is exact — the archive
           does not move a report to a place it does not name.</p>`
        : '<p class="ev-note">No report in this archive names this place in its own record.</p>'}
      <h3 class="ev-subhead">Reports narrated by a figure recorded here</h3>
      ${reports.length
        ? `<div class="ev-chiplist">${reports.map((h) => `
            <a class="dsh-chip" href="#hadiths?id=${esc(h.id)}">${esc(h.reference)}</a>`).join('')}</div>
           <p class="ev-note">Narrated by a figure the archive records at this place — a documented
           narrator link, not a claim that the report concerns the place.</p>`
        : '<p class="ev-note">No report in this archive has a narrator recorded here.</p>'}`;
  }

  const panelHtml = (p) => `
    <aside class="dsh-panel plc-panel" id="plcPanel" aria-label="Selected place">
      ${panelContentsHtml(p)}
    </aside>`;

  const shellHtml = () => `
    <div class="dsh plc">
      <div class="bk-top">${statsHtml()}</div>
      <div class="dsh-body">
        <aside class="dsh-side plc-side" id="plcSide" aria-label="Place filters">${sidebarHtml()}</aside>
        <section class="dsh-center plc-center" id="plcCenter" aria-label="Places">
          ${mapHtml()}
          ${periodStripHtml()}
          ${listHtml()}
        </section>
        ${panelHtml(selected())}
      </div>
    </div>`;

  /* ---- map plumbing ------------------------------------------------------ */

  function applyMapTransform() {
    const g = state.host?.querySelector('#plcMapView');
    if (!g) return;
    const s = state.mapZoom;
    const { PLANE_W, PLANE_H } = DynastyGeo;
    const tx = (PLANE_W / 2) * (1 - s) + state.mapPan.x;
    const ty = (PLANE_H / 2) * (1 - s) + state.mapPan.y;
    g.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(3)})`);
  }

  /* Brings a place into the middle of the frame at a closer zoom. */
  function centreOn(placeId, zoom = 3) {
    const p = ChronoData.place(placeId);
    if (!p) return;
    const [x, y] = DynastyGeo.project([p.lon, p.lat]);
    const { PLANE_W, PLANE_H } = DynastyGeo;
    state.mapZoom = zoom;
    state.mapPan = { x: zoom * (PLANE_W / 2 - x), y: zoom * (PLANE_H / 2 - y) };
  }

  // ---- refresh and binding -----------------------------------------------

  function renderSide() {
    const host = state.host.querySelector('#plcSide');
    host.innerHTML = sidebarHtml();
    Icons.init(host);
    bindSide(host);
  }

  function renderCenter({ keepViewport = true } = {}) {
    const host = state.host.querySelector('#plcCenter');
    const list = host.querySelector('.plc-list');
    const top = keepViewport && list ? list.scrollTop : 0;
    host.innerHTML = `${mapHtml()}${periodStripHtml()}${listHtml()}`;
    Icons.init(host);
    bindCenter(host);
    const fresh = host.querySelector('.plc-list');
    if (fresh) fresh.scrollTop = top;
    applyMapTransform();
  }

  function renderPanel() {
    const host = state.host.querySelector('#plcPanel');
    host.innerHTML = panelContentsHtml(selected());
    Icons.init(host);
    bindPanel(host);
  }

  function selectPlace(id, { centre = true } = {}) {
    if (!ChronoData.place(id)) return;
    state.selectedId = id;
    ChronoData.remember({ placeId: id });
    if (location.hash.startsWith('#places')) {
      history.replaceState(null, '', `#places?id=${encodeURIComponent(id)}`);
    }
    renderCenter();
    renderPanel();
    if (centre) {
      centreOn(id, 3);
      applyMapTransform();
    }
  }

  function on(el, type, fn) {
    const key = `__plcb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  }

  function bindMapDrag(svg) {
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
      const box = svg.getBoundingClientRect();
      const k = DynastyGeo.PLANE_W / (box.width || 1);
      state.mapPan.x -= ev.deltaX * k;
      state.mapPan.y -= ev.deltaY * k;
      applyMapTransform();
    }, { passive: false });
  }

  function bindCenter(scope) {
    scope.querySelectorAll('.plc-marker, .plc-mark, .plc-row').forEach((el) => {
      on(el, 'click', () => selectPlace(el.dataset.place));
      on(el, 'keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectPlace(el.dataset.place); }
      });
    });
    scope.querySelectorAll('[data-plcmap]').forEach((btn) => {
      on(btn, 'click', () => {
        const mode = btn.dataset.plcmap;
        if (mode === 'in') state.mapZoom = Math.min(8, state.mapZoom * 1.35);
        else if (mode === 'out') state.mapZoom = Math.max(1, state.mapZoom / 1.35);
        else { state.mapZoom = 1; state.mapPan = { x: 0, y: 0 }; }
        applyMapTransform();
      });
    });
    bindMapDrag(scope.querySelector('#plcMapSvg'));
  }

  function bindSide(scope) {
    scope.querySelectorAll('input[data-plc]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = cb.dataset.plc === 'kind' ? state.kinds : state.zones;
        if (cb.checked) set.add(cb.value); else set.delete(cb.value);
        renderCenter({ keepViewport: false });
        if (state.selectedId && !filtered().some((p) => p.id === state.selectedId)) {
          state.selectedId = filtered()[0]?.id || null;
          renderPanel();
        }
      });
    });
    scope.querySelectorAll('[data-plcview]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.view = btn.dataset.plcview;
        renderSide();
        renderCenter({ keepViewport: false });
      });
    });
    scope.querySelectorAll('[data-plclayer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.layer = btn.dataset.plclayer;
        renderSide();
        renderCenter();
      });
    });
    scope.querySelector('#plcReset')?.addEventListener('click', () => {
      state.kinds = new Set();
      state.zones = new Set();
      state.view = 'all';
      state.layer = 'default';
      renderSide();
      renderCenter({ keepViewport: false });
    });
  }

  function bindPanel(scope) {
    scope.querySelectorAll('[data-plctab]').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.plctab) || 0;
        const body = scope.querySelector('#plcTabBody');
        const p = selected();
        body.innerHTML = tabHtml(p, eventsAt(p),
          ChronoData.allDynasties().filter((d) => (d.capitalIds || []).includes(p.id)), state.tab);
        Icons.init(body);
        scope.querySelectorAll('[data-plctab]').forEach((b) => {
          const active = Number(b.dataset.plctab) === state.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        bindPanel(scope);
      });
    });
  }

  async function render(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;
    state.host = host;

    const get = (k) => (params && params.get ? params.get(k) : null);
    const stored = ChronoData.recall();

    state.kinds = new Set();
    state.zones = new Set();
    state.view = 'all';
    state.layer = 'default';
    state.mapZoom = 1;
    state.mapPan = { x: 0, y: 0 };
    state.tab = Math.max(0, Number(get('tab')) || 0);

    const wanted = get('id') || stored.placeId || null;
    state.selectedId = ChronoData.place(wanted) ? wanted : null;
    if (!state.selectedId) state.selectedId = filtered()[0]?.id || null;

    // The coastline file is read before the first paint, so the map never opens
    // on an empty sea.
    await loadCoast();
    if (!host.isConnected) return;

    host.innerHTML = shellHtml();
    Icons.init(host);
    bindSide(host.querySelector('#plcSide'));
    bindCenter(host.querySelector('#plcCenter'));
    bindPanel(host.querySelector('#plcPanel'));
    applyMapTransform();

    if (state.selectedId) {
      ChronoData.remember({ placeId: state.selectedId });
      const q = [`id=${encodeURIComponent(state.selectedId)}`];
      if (state.tab) q.push(`tab=${state.tab}`);
      history.replaceState(null, '', `#places?${q.join('&')}`);
    }
  }

  function searchScope() {
    const built = ChronoData.allPlaces().map((p) => ({
      id: ChronoData.cid.place(p.id),
      label: p.name,
      group: p.zone,
      meta: 'place',
      sub: `${p.region} · ${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}${p.approx ? ' (approx.)' : ''}`,
      icon: 'places',
      colour: 'var(--cyan)',
      hay: `${p.name} ${p.arabic || ''} ${p.region} ${p.zone} ${(p.sources || []).join(' ')}`.toLowerCase(),
    }));
    let chip = 'all';
    return {
      label: 'Places',
      placeholder: 'Search places…',
      hint: 'Name, Arabic name, region or zone',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All zones', count: built.length },
        ...ChronoData.REGIONS.map((r) => ({
          key: r.key, label: r.label, count: built.filter((x) => x.group === r.key).length,
        })).filter((c) => c.count > 0),
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => {
        const raw = ChronoData.resolve(id).id;
        if (!filtered().some((p) => p.id === raw)) {
          return { hidden: true, message: 'A kind or region filter keeps it off the map.' };
        }
        selectPlace(raw);
      },
      reveal: (id) => {
        state.kinds = new Set();
        state.zones = new Set();
        renderSide();
        renderCenter({ keepViewport: false });
        selectPlace(ChronoData.resolve(id).id);
      },
    };
  }

  return { render, searchScope };
})();
