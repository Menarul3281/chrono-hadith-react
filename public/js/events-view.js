/* Events view — the dedicated Events page. Route: #events, deep links
   #events?id=<eventId>&view=<timeline|list|map>&from=<dynasties>.

   Three columns: the filters, the timeline and event list, and the selected
   record. The list and the tab body scroll inside their own panels, so the
   header, the filter panel and the record stay where the reader left them. */

const EventsView = (() => {
  const state = {
    // Filters the reader is editing and filters that are actually applied. The
    // Apply button moves one to the other; search is live because typing is its
    // own confirmation.
    draft: { eras: new Set(), types: new Set(), regions: new Set() },
    applied: { q: '', eras: new Set(), types: new Set(), regions: new Set() },
    sort: 'chronological',
    view: 'timeline',
    focusEra: null,
    selectedId: null,
    from: null,
    tab: 0,
    miniZoom: 2,
    mapZoom: 1,
    mapPan: { x: 0, y: 0 },
    host: null,
  };

  const TABS = ['Overview', 'Context', 'Chain', 'Connections', 'Related'];

  const SORTS = [
    ['chronological', 'Chronological'],
    ['reverse', 'Most recent first'],
    ['name', 'Title (A–Z)'],
    ['era', 'Era'],
  ];

  const esc = ChronoData.esc;

  const yearLabel = (y) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);

  const rangeLabel = (a, b) => `${yearLabel(a)} – ${yearLabel(b)}`;

  // ---- Filtering ----------------------------------------------------------

  function haystack(e) {
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    return [
      e.name, e.summary, e.context, e.significance, e.source, e.hijri,
      e.dynastyIds.map((id) => ChronoData.dynasty(id)?.name).filter(Boolean).join(' '),
      ChronoData.participantsOf(e).map((p) => p.name).join(' '),
      place ? `${place.name} ${place.region}` : '',
      ChronoData.era(e.era).label,
      ChronoData.typeInfo(e.uiType).label,
    ].join(' ').toLowerCase();
  }

  /* `skip` leaves one group out of the test, which is how a filter row can show
     the number of records that row itself would still match. */
  function matches(e, skip) {
    const f = state.applied;
    if (skip !== 'q' && f.q && !haystack(e).includes(f.q)) return false;
    if (skip !== 'era' && f.eras.size && !f.eras.has(e.era)) return false;
    if (skip !== 'type' && f.types.size && !f.types.has(e.uiType)) return false;
    if (skip !== 'region' && f.regions.size && !f.regions.has(ChronoData.zoneOf(e))) return false;
    return true;
  }

  const filtered = (skip) => ChronoData.allEvents().filter((e) => matches(e, skip));

  function sorted(list) {
    const out = list.slice();
    if (state.sort === 'reverse') out.reverse();
    else if (state.sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === 'era') {
      const order = ChronoData.ERAS.map((e) => e.id);
      out.sort((a, b) => order.indexOf(a.era) - order.indexOf(b.era) || a.year - b.year);
    }
    return out;
  }

  const activeFilterCount = () => {
    const f = state.applied;
    return (f.q ? 1 : 0) + f.eras.size + f.types.size + f.regions.size;
  };

  const draftMatchesApplied = () => {
    const same = (set, other) => set.size === other.size && [...set].every((v) => other.has(v));
    return same(state.draft.eras, state.applied.eras)
      && same(state.draft.types, state.applied.types)
      && same(state.draft.regions, state.applied.regions);
  };

  // ---- Markup -------------------------------------------------------------

  function counter(icon, value, label, colour) {
    return `
      <div class="dsh-counter" style="--c:${colour}">
        <span class="dsh-counter-ico" data-icon="${icon}"></span>
        <span class="dsh-counter-copy">
          <span class="dsh-counter-num">${value}</span>
          <span class="dsh-counter-lbl">${esc(label)}</span>
        </span>
      </div>`;
  }

  function headerHtml() {
    const t = ChronoData.totals();
    // The page's title and description live in the topbar; what stays here is the
    // row of counters, each read from the records the archive holds.
    return `
      <div class="bk-top">
        ${counter('calendar', t.events, 'Events', 'var(--purple)')}
        ${counter('clock', t.eras, 'Eras', 'var(--gold)')}
        ${counter('swords', t.battles, 'Major Battles', 'var(--red)')}
        ${counter('scroll', t.treaties, 'Treaties', 'var(--blue)')}
        ${counter('people', t.eventFigures, 'Key Figures', 'var(--teal)')}
      </div>`;
  }

  function filterRow(group, value, label, extra = {}) {
    const on = state.draft[group === 'era' ? 'eras' : group === 'type' ? 'types' : 'regions'].has(value);
    return `
      <label class="dsh-check${extra.disabled ? ' is-empty' : ''}"${extra.title ? ` title="${esc(extra.title)}"` : ''}>
        <input type="checkbox" data-group="${group}" value="${esc(value)}"${on ? ' checked' : ''}${extra.disabled ? ' disabled' : ''}>
        <span class="dsh-box" aria-hidden="true"></span>
        ${extra.dot ? `<span class="dsh-dot" style="--dot:${extra.dot}"></span>` : ''}
        <span class="dsh-check-label">${esc(label)}${extra.range ? ` <span class="dsh-check-range">${esc(extra.range)}</span>` : ''}</span>
        <span class="dsh-check-count">${extra.count}</span>
      </label>`;
  }

  function sidebarContentsHtml() {
    // Counts are faceted: each row shows how many records it would leave, given
    // every other filter the reader has applied.
    const eras = ChronoData.ERAS.map((e) => ({
      ...e,
      count: filtered('era').filter((x) => x.era === e.id).length,
    }));
    const types = ChronoData.EVENT_TYPES.map((t) => ({
      ...t,
      count: filtered('type').filter((x) => x.uiType === t.key).length,
    }));
    const regions = ChronoData.REGIONS.map((r) => ({
      ...r,
      count: filtered('region').filter((x) => ChronoData.zoneOf(x) === r.key).length,
    }));

    return `
        <div class="dsh-group">
          <h2 class="dsh-group-title">Era</h2>
          ${eras.map((e) => filterRow('era', e.id, e.label, { count: e.count, range: `(${e.range})` })).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Event Type</h2>
          ${types.map((t) => filterRow('type', t.key, t.label, { count: t.count, dot: t.color })).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Region</h2>
          ${regions.map((r) => filterRow('region', r.key, r.label, {
            count: r.count, title: r.note ? `${r.label} — ${r.note}` : '',
          })).join('')}
        </div>

        <div class="dsh-side-foot">
          <button class="dsh-btn primary" type="button" id="evApply">Apply Filters</button>
          <button class="dsh-btn" type="button" id="evReset">Reset</button>
        </div>`;
  }

  const sidebarHtml = () => `
      <aside class="dsh-side ev-side" id="evSide" aria-label="Event filters">
        ${sidebarContentsHtml()}
      </aside>`;

  // ---- Center: view controls, period rail, list --------------------------

  function periodBtn(e) {
    const active = state.focusEra === e.id;
    return `
      <button class="ev-period${active ? ' active' : ''}" type="button" data-era="${e.id}"
              style="--era:${e.color}" aria-pressed="${active}">
        <span class="ev-period-name">${esc(e.label)}</span>
        <span class="ev-period-range">${esc(e.range)}</span>
      </button>`;
  }

  /* The rail plots the records that survive the current filters against the years
     they happened in, on the archive's own span, so the clustering is visible. */
  function railHtml(list) {
    const all = ChronoData.allEvents();
    const from = Math.floor(Math.min(...all.map((e) => e.year)) / 50) * 50;
    const to = Math.ceil(Math.max(...all.map((e) => e.year)) / 50) * 50;
    const w = 1000, h = 76;
    const x = (year) => ((year - from) / (to - from)) * w;

    const ticks = [...ChronoData.ERAS.map((e) => e.start).filter((y) => y != null), 1500, 1700, 1900]
      .filter((y, i, arr) => y >= from && y <= to && arr.indexOf(y) === i);

    const dots = list.map((e) => {
      const cx = x(e.year);
      const selected = state.selectedId === e.id;
      const colour = ChronoData.typeInfo(e.uiType).color;
      return `<g class="ev-dot${selected ? ' selected' : ''}" data-event="${esc(e.id)}" tabindex="0" role="button"
                 aria-label="${esc(`${e.name}, ${yearLabel(e.year)}`)}" style="color:${colour}">
        <title>${esc(`${e.name} — ${yearLabel(e.year)}`)}</title>
        <line x1="${cx.toFixed(1)}" y1="34" x2="${cx.toFixed(1)}" y2="46" stroke="currentColor" stroke-width="1" opacity="0.5"/>
        <circle cx="${cx.toFixed(1)}" cy="34" r="${selected ? 6 : 3.6}" fill="currentColor"/>
      </g>`;
    }).join('');

    return `
      <svg class="ev-railsvg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img"
           aria-label="Events plotted from ${yearLabel(from)} to ${yearLabel(to)}">
        <line x1="0" y1="46" x2="${w}" y2="46" stroke="var(--line-2)" stroke-width="1"/>
        ${ticks.map((y) => `
          <line x1="${x(y).toFixed(1)}" y1="40" x2="${x(y).toFixed(1)}" y2="52" stroke="var(--line-2)" stroke-width="1"/>
          <text x="${x(y).toFixed(1)}" y="68" class="ev-rail-label" text-anchor="middle">${y}</text>`).join('')}
        ${dots}
      </svg>`;
  }

  function listHeadHtml(count) {
    const n = activeFilterCount();
    return `
      <div class="ev-listhead">
        <h2 class="ev-listtitle" id="evListTitle">Events (${count})</h2>
        <div class="ev-listmeta">
          ${n ? `<button class="dsh-chip" type="button" id="evClearChips">${n} filter${n > 1 ? 's' : ''} · clear</button>` : ''}
          <label class="dsh-select">
            <span>Sort by:</span>
            <select id="evSort">
              ${SORTS.map(([v, l]) => `<option value="${v}"${state.sort === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}
            </select>
          </label>
        </div>
      </div>`;
  }

  function rowHtml(e) {
    const type = ChronoData.typeInfo(e.uiType);
    const era = ChronoData.era(e.era);
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    const selected = state.selectedId === e.id;
    return `
      <button class="ev-row${selected ? ' selected' : ''}" type="button" data-event="${esc(e.id)}"
              aria-pressed="${selected}" style="--dot:${type.color}">
        <span class="ev-art">${ChronoArt.frame(e, { kind: e.uiType, w: 160, h: 100, label: e.name })}</span>
        <span class="ev-rowtext">
          <span class="ev-rowtop">
            <span class="ev-dotmark" aria-hidden="true"></span>
            <span class="ev-name">${esc(e.name)}</span>
            <span class="ev-badges">
              <span class="ev-badge type">${esc(type.label)}</span>
              <span class="ev-badge era">${esc(era.label)}</span>
            </span>
          </span>
          <span class="ev-rowmeta">
            <span class="ev-meta">${esc(yearLabel(e.year))}${e.hijri ? ` <span class="ev-meta-sub">(${esc(e.hijri)})</span>` : ''}</span>
            <span class="ev-meta">${place
              ? `<span class="ev-pin" aria-hidden="true"></span>${esc(place.name)}${place.approx ? ' <span class="ev-meta-sub">approx.</span>' : ''}`
              : '<span class="ev-no-site">Location not recorded</span>'}</span>
          </span>
          <span class="ev-desc">${esc(e.summary)}</span>
        </span>
        <span class="ev-go" data-icon="arrow-right"></span>
      </button>`;
  }

  function centerContentsHtml() {
    const list = sorted(filtered());
    return `
        <div class="dsh-views" role="group" aria-label="View">
          <button class="dsh-view-btn${state.view === 'timeline' ? ' active' : ''}" type="button" data-view="timeline">
            <span class="nav-icon" data-icon="timeline"></span>Timeline View
          </button>
          <button class="dsh-view-btn${state.view === 'list' ? ' active' : ''}" type="button" data-view="list">
            <span class="nav-icon" data-icon="list"></span>List View
          </button>
          <button class="dsh-view-btn${state.view === 'map' ? ' active' : ''}" type="button" data-view="map">
            <span class="nav-icon" data-icon="map"></span>Map View
          </button>
        </div>

        <div class="ev-strip" id="evStrip"${state.view === 'list' ? ' hidden' : ''}>
          <div class="ev-periods" id="evPeriods">${ChronoData.ERAS.map(periodBtn).join('')}</div>
          <div class="ev-rail" id="evRail">${railHtml(list)}</div>
        </div>

        <div class="ev-mapwrap" id="evMapWrap"${state.view === 'map' ? '' : ' hidden'}></div>

        ${listHeadHtml(list.length)}
        <div class="ev-list" id="evList" role="list">
          ${list.length
            ? list.map(rowHtml).join('')
            : `<div class="dsh-empty">No events match these filters.<br><span class="tiny">Reset the filters, or widen the search.</span></div>`}
        </div>`;
  }

  const centerHtml = () => `
      <section class="dsh-center ev-center" id="evCenter" aria-label="Historical events">
        ${centerContentsHtml()}
      </section>`;

  // ---- Right panel --------------------------------------------------------

  const arrow = () => '<span class="ev-arrow" data-icon="arrow-right"></span>';

  const figureChip = (n) => `<a class="dsh-chip" href="${ChronoData.links.figure(n.id)}" title="Open the figure profile">${esc(n.name)}</a>`;

  /* The dynasty link the brief asks for: named in the event's own panel, and a
     single click away from the dynasty page with that dynasty selected. */
  const dynChip = (d) => `<a class="dsh-chip dyn" style="--dyn:${d.colour}" href="${ChronoData.links.dynasty(d.id, 'events')}">${esc(d.full || d.name)} · View Dynasty ${arrow()}</a>`;

  const dynastyCard = (d) => `
    <span class="ev-dyn" style="--dyn:${d.colour}">
      <span class="ev-dyn-mark">${esc((d.arabic || d.name).charAt(0))}</span>
      <span class="ev-dyn-copy">
        <span class="ev-dyn-name">${esc(d.full || d.name)}</span>
        <span class="ev-dyn-meta">${esc(d.type)} · ${esc(rangeLabel(d.start, d.end))}</span>
      </span>
      <a class="dsh-btn small primary" href="${ChronoData.links.dynasty(d.id, 'events')}">View Dynasty ${arrow()}</a>
    </span>`;

  const eventTile = (e) => `
    <button class="ev-near" type="button" data-event="${esc(e.id)}" style="--dot:${ChronoData.typeInfo(e.uiType).color}">
      <span class="ev-near-year">${esc(yearLabel(e.year))}</span>
      <span class="ev-near-name">${esc(e.name)}</span>
    </button>`;

  function tabHtml(e, index) {
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    const dynasties = ChronoData.dynastiesOfEvent(e);
    const people = ChronoData.participantsOf(e);
    const era = ChronoData.era(e.era);
    const type = ChronoData.typeInfo(e.uiType);
    const timelineLink = ChronoData.links.timelineEvent(e);
    const inCanvas = e.year >= -500 && e.year <= 1500;

    if (index === 0) {
      return `
        <p class="ev-prose">${esc(e.summary)}</p>
        ${e.quote ? `
          <blockquote class="ev-quote">
            <p class="ev-quote-ar" lang="ar" dir="rtl">${esc(e.quote.arabic)}</p>
            <p class="ev-quote-en">${esc(e.quote.english)}</p>
            <cite>— ${esc(e.quote.ref)}</cite>
          </blockquote>` : ''}
        <dl class="ev-facts">
          <dt>Date</dt><dd>${esc(yearLabel(e.year))}${e.hijri ? ` (${esc(e.hijri)})` : ''}</dd>
          <dt>Location</dt><dd>${place
            ? `${esc(place.name)}${place.approx ? ' <span class="ev-meta-sub">approximate site</span>' : ''}`
            : '<span class="ev-no-site">No documented location in the archive</span>'}</dd>
          <dt>Era</dt><dd>${esc(era.label)} (${esc(era.range)})</dd>
          <dt>Type</dt><dd>${esc(type.label)}</dd>
          <dt>Participants</dt><dd>${people.length ? people.map(figureChip).join(' ') : '<span class="ev-no-site">No participant records in the archive yet</span>'}</dd>
          <dt>Significance</dt><dd>${esc(e.significance)}</dd>
          <dt>Dynasties</dt><dd>${dynasties.length ? dynasties.map(dynChip).join(' ')
            : '<span class="ev-no-site">No dynasty association recorded</span>'}</dd>
          <dt>Sources</dt><dd>${esc(e.source)}</dd>
        </dl>
        <div class="ev-linkrow">
          <a class="dsh-btn small" href="${timelineLink}">${inCanvas ? 'Open on the Timeline' : 'Open the Timeline'} ${arrow()}</a>
          ${inCanvas ? '' : '<span class="ev-note">This record falls outside the timeline canvas (500 BCE – 1500 CE), so the timeline opens on the events lane instead of the marker.</span>'}
        </div>`;
    }

    if (index === 1) {
      const all = sorted(filtered());
      const before = all.filter((x) => x.year < e.year || (x.year === e.year && x.id !== e.id)).slice(-3).reverse();
      return `
        <p class="ev-prose">${esc(e.context)}</p>
        <h3 class="ev-subhead">Earlier records</h3>
        ${before.length
          ? `<div class="ev-nears">${before.map(eventTile).join('')}</div>`
          : '<p class="ev-note">No earlier record matches the current filters.</p>'}
        <h3 class="ev-subhead">Historical setting</h3>
        <dl class="ev-facts">
          <dt>Period</dt><dd>${esc(era.label)} (${esc(era.range)})</dd>
          <dt>Region</dt><dd>${esc(ChronoData.zoneOf(e))}</dd>
          <dt>Dynastic frame</dt><dd>${dynasties.length
            ? dynasties.map((d) => `<a href="${ChronoData.links.timelineDynasty(d)}">${esc(d.name)}, ${esc(rangeLabel(d.start, d.end))}</a>`).join(', ')
            : '<span class="ev-no-site">Before the recorded dynasties</span>'}</dd>
        </dl>
        <div class="ev-linkrow">
          <a class="dsh-btn small" href="${ChronoData.links.timelineEra(e.era)}">Open this period in the Timeline ${arrow()}</a>
        </div>`;
    }

    if (index === 2) {
      const records = ChronoData.hadithsOfEvent(e);
      if (!records.length) {
        return `
          <p class="ev-note">
            No hadith transmission chain is recorded for this event. A historical chronology is not a
            chain: the archive shows an isnad here only when a report in the corpus is itself about the
            event, so nothing is inferred from the year a record happens to fall on.
          </p>
          <div class="ev-linkrow"><a class="dsh-btn small" href="#isnad">Browse the Isnad Explorer ${arrow()}</a></div>`;
      }
      return records.map((h) => `
        <article class="ev-chain">
          <header class="ev-chain-head">
            <span class="ev-chain-ref">${esc(h.reference)}</span>
            ${h.grade ? `<span class="ev-badge era">${esc(h.grade)}</span>` : ''}
          </header>
          <p class="ev-quote-en">${esc(h.translation)}</p>
          <ol class="ev-chain-steps">
            ${DataLoader.chainWithNarrators(h.id).map((step) => `
              <li>
                <span class="ev-chain-step">${step.step}</span>
                ${step.narrator
                  ? `<a href="${ChronoData.links.figure(step.narrator.id)}">${esc(step.narrator.name)}</a>`
                  : '<span class="ev-no-site">Unknown narrator</span>'}
                <span class="ev-chain-role">${esc(step.role)}${step.generation ? ` · ${esc(step.generation)}` : ''}</span>
              </li>`).join('')}
          </ol>
          <div class="ev-linkrow"><a class="dsh-btn small" href="${ChronoData.links.hadith(h.id)}">Open in the Isnad Explorer ${arrow()}</a></div>
        </article>`).join('');
    }

    if (index === 3) {
      const relatedHadith = ChronoData.hadithsByParticipants(e);
      return `
        <h3 class="ev-subhead">Historical figures</h3>
        ${people.length
          ? `<div class="ev-chiplist">${people.map(figureChip).join('')}</div>`
          : '<p class="ev-note">No participant record in the archive for this event.</p>'}

        <h3 class="ev-subhead">Dynasties</h3>
        ${dynasties.length
          ? `<div class="ev-dynlist">${dynasties.map(dynastyCard).join('')}</div>`
          : `<p class="ev-note">No dynasty is associated with this record. An event is linked to a dynasty
             only where the sources place it in that state&rsquo;s own history.</p>`}

        <h3 class="ev-subhead">Places</h3>
        ${place ? `
          <dl class="ev-facts">
            <dt>Site</dt><dd>${esc(place.name)}${place.arabic ? ` <span class="ev-meta-sub" lang="ar" dir="rtl">${esc(place.arabic)}</span>` : ''}</dd>
            <dt>Area</dt><dd>${esc(place.region)}</dd>
            <dt>Coordinates</dt><dd>${place.lat.toFixed(3)}, ${place.lon.toFixed(3)}${place.approx ? ' <span class="ev-meta-sub">approximate</span>' : ''}</dd>
            <dt>Sources</dt><dd>${esc((place.sources || []).join('; ') || '—')}</dd>
          </dl>`
          : '<p class="ev-note">No documented location for this record, so no marker is drawn for it.</p>'}

        <h3 class="ev-subhead">Hadith records from participants</h3>
        ${relatedHadith.length
          ? `<div class="ev-chiplist">${relatedHadith.map((h) => `
              <a class="dsh-chip" href="${ChronoData.links.hadith(h.id)}" title="${esc(h.translation)}">${esc(h.reference)}</a>`).join('')}</div>
             <p class="ev-note">Narrated by a participant in this event — a documented narrator link, not a claim that the report is about the event.</p>`
          : '<p class="ev-note">None of the archive&rsquo;s hadith records are narrated by a participant of this event.</p>'}`;
    }

    const all = sorted(filtered());
    const idx = all.findIndex((x) => x.id === e.id);
    const near = all.filter((x) => x.id !== e.id)
      .sort((a, b) => Math.abs(a.year - e.year) - Math.abs(b.year - e.year))
      .slice(0, 4)
      .sort((a, b) => a.year - b.year);
    const relatedHadith = ChronoData.hadithsByParticipants(e);
    return `
      <h3 class="ev-subhead">Nearest records in time</h3>
      ${near.length
        ? `<div class="ev-nears">${near.map(eventTile).join('')}</div>`
        : '<p class="ev-note">No other record matches the current filters.</p>'}
      <h3 class="ev-subhead">Biographies and hadith</h3>
      <div class="ev-chiplist">
        ${people.slice(0, 6).map(figureChip).join('')}
        ${relatedHadith.slice(0, 6).map((h) => `<a class="dsh-chip" href="${ChronoData.links.hadith(h.id)}">${esc(h.reference)}</a>`).join('')}
        ${!people.length && !relatedHadith.length ? '<span class="ev-note">Nothing further is recorded for this event.</span>' : ''}
      </div>
      <h3 class="ev-subhead">Elsewhere in CHRONO-HADITH</h3>
      <div class="ev-chiplist">
        <a class="dsh-chip" href="${timelineLink}">Timeline · this record</a>
        <a class="dsh-chip" href="${ChronoData.links.timelineEra(e.era)}">Timeline · ${esc(era.label)}</a>
        <a class="dsh-chip" href="#timeline?lane=events">Timeline · all events</a>
        <a class="dsh-chip" href="#places">Places atlas</a>
      </div>
      <p class="ev-note">Record ${idx + 1} of ${all.length} in the filtered set.</p>`;
  }

  // ---- Maps ---------------------------------------------------------------

  let coastMarkupCache = null;
  let coastRingCache = null;

  async function coastMarkup() {
    if (coastMarkupCache) return coastMarkupCache;
    coastRingCache = await DynastyGeo.landRings();
    coastMarkupCache = coastRingCache
      .map((ring, i) => `<path d="${DynastyGeo.ringPath(ring)}" class="evm-land${i === 0 ? ' main' : ''}"/>`)
      .join('');
    return coastMarkupCache;
  }

  function graticuleMarkup(step = 10) {
    const { VIEW, PLANE_W, PLANE_H } = DynastyGeo;
    const out = [];
    for (let lon = Math.ceil(VIEW.lonMin / step) * step; lon <= VIEW.lonMax; lon += step) {
      const [x] = DynastyGeo.project([lon, 0]);
      out.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${PLANE_H.toFixed(1)}" class="evm-grid"/>`);
    }
    for (let lat = Math.ceil(VIEW.latMin / 5) * 5; lat <= VIEW.latMax; lat += 5) {
      const [, y] = DynastyGeo.project([0, lat]);
      out.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${PLANE_W}" y2="${y.toFixed(1)}" class="evm-grid"/>`);
    }
    return out.join('');
  }

  /* The compact map at the foot of the record: the documented site, centred, with
     modern coastlines for context. Nothing is drawn when the record has no
     location — an invented marker would be worse than an empty state. */
  function miniMapHtml(place, halfSpan) {
    const W = 400, H = 240;
    const spanLat = halfSpan;
    const spanLon = halfSpan / Math.cos((place.lat * Math.PI) / 180);
    const px = (lon, lat) => [
      W / 2 + ((lon - place.lon) / spanLon) * (W / 2),
      H / 2 - ((lat - place.lat) / spanLat) * (H / 2),
    ];
    const rings = (coastRingCache || []).map((ring) => {
      const pts = ring.map(([lon, lat]) => px(lon, lat));
      return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L') + ' Z';
    }).join('');

    const step = halfSpan <= 1 ? 0.5 : halfSpan <= 3 ? 1 : 5;
    const grid = [];
    for (let lon = Math.floor(place.lon - spanLon); lon <= place.lon + spanLon; lon += step) {
      const [x] = px(lon, place.lat);
      grid.push(`<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" class="evm-grid"/>`);
    }
    for (let lat = Math.floor(place.lat - spanLat); lat <= place.lat + spanLat; lat += step) {
      const [, y] = px(place.lon, lat);
      grid.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" class="evm-grid"/>`);
    }

    return `
      <svg class="ev-minisvg" viewBox="0 0 ${W} ${H}" role="img"
           aria-label="Map of ${esc(place.name)}" preserveAspectRatio="xMidYMid slice">
        <rect width="${W}" height="${H}" class="evm-sea"/>
        <g class="evm-land-wrap">${rings}</g>
        <g class="evm-graticule">${grid.join('')}</g>
        <line x1="${W / 2}" y1="${H / 2 - 15}" x2="${W / 2}" y2="${H / 2 - 3}" class="evm-pin-stem"/>
        <circle cx="${W / 2}" cy="${H / 2}" r="6" class="evm-pin"/>
        <text x="${W / 2}" y="${H - 12}" class="evm-label" text-anchor="middle">${esc(place.name)}${place.approx ? ' (approx.)' : ''}</text>
      </svg>`;
  }

  const MINI_SPANS = [12, 6, 3, 1.5, 0.75];
  const miniSpan = () => MINI_SPANS[state.miniZoom] ?? 6;

  function locationPanelHtml(e) {
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    if (!place) {
      return `
        <section class="ev-loc" aria-label="Location">
          <header class="ev-loc-head"><h3>Location</h3></header>
          <div class="dsh-empty small">
            No verified location is recorded for this event, so no map is drawn.
            <span class="tiny">The record stays available in the timeline and list views.</span>
          </div>
        </section>`;
    }
    return `
      <section class="ev-loc" aria-label="Location">
        <header class="ev-loc-head">
          <h3>Location</h3>
          <span class="ev-loc-coord">${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}${place.approx ? ' · approx.' : ''}</span>
        </header>
        <div class="ev-loc-map" id="evMiniMap">${miniMapHtml(place, miniSpan())}</div>
        <div class="ev-loc-bar">
          <button class="dsh-iconbtn" type="button" data-mini="in" aria-label="Zoom in" title="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
          <button class="dsh-iconbtn" type="button" data-mini="out" aria-label="Zoom out" title="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
          <button class="dsh-iconbtn" type="button" data-mini="reset" aria-label="Recentre" title="Recentre"><span class="nav-icon" data-icon="recenter"></span></button>
          <span class="ev-loc-name">${esc(place.name)}</span>
        </div>
      </section>`;
  }

  function panelContentsHtml(e) {
    if (!e) {
      return `<div class="dsh-empty">Select an event to read its record.</div>`;
    }
    const type = ChronoData.typeInfo(e.uiType);
    const era = ChronoData.era(e.era);
    const place = e.placeId ? ChronoData.place(e.placeId) : null;
    const dynasties = ChronoData.dynastiesOfEvent(e);
    return `
        <div class="ev-hero">${ChronoArt.frame(e, { kind: e.uiType, w: 480, h: 220, label: e.name })}</div>
        <div class="ev-panel-head">
          <h2 class="ev-panel-title">${esc(e.name)}</h2>
          <div class="ev-panel-meta">
            <span class="ev-meta"><span class="nav-icon" data-icon="clock"></span>${esc(yearLabel(e.year))}${e.hijri ? ` (${esc(e.hijri)})` : ''}</span>
            <span class="ev-meta">${place
              ? `<span class="ev-pin"></span>${esc(place.name)}${place.approx ? ' <span class="ev-meta-sub">approx.</span>' : ''}`
              : '<span class="ev-no-site">Location not recorded</span>'}</span>
          </div>
          <div class="ev-panel-badges">
            <span class="ev-badge type" style="--dot:${type.color}">${esc(type.label)}</span>
            <span class="ev-badge era">${esc(era.label)}</span>
            ${dynasties.map((d) => `<a class="ev-badge dyn" style="--dyn:${d.colour}" href="${ChronoData.links.dynasty(d.id, 'events')}">${esc(d.name)} · View Dynasty ${arrow()}</a>`).join('')}
          </div>
        </div>
        <div class="ev-tabs" role="tablist">
          ${TABS.map((t, i) => `
            <button class="ev-tab${i === state.tab ? ' active' : ''}" type="button" role="tab" data-tab="${i}"
                    aria-selected="${i === state.tab}">${t}</button>`).join('')}
        </div>
        <div class="ev-tabbody" id="evTabBody" role="tabpanel">${tabHtml(e, state.tab)}</div>
        ${locationPanelHtml(e)}`;
  }

  const panelHtml = (e) => `
      <aside class="dsh-panel ev-panel" id="evPanel" aria-label="Selected event">
        ${panelContentsHtml(e)}
      </aside>`;

  // ---- Geographic view ----------------------------------------------------

  const markerHtml = (e) => {
    const place = ChronoData.place(e.placeId);
    if (!place) return '';
    const [x, y] = DynastyGeo.project([place.lon, place.lat]);
    const selected = state.selectedId === e.id;
    return `
      <g class="evmm-marker${selected ? ' selected' : ''}" data-event="${esc(e.id)}" tabindex="0" role="button"
         aria-label="${esc(`${e.name}, ${place.name}, ${yearLabel(e.year)}`)}" style="--dot:${ChronoData.typeInfo(e.uiType).color}">
        <title>${esc(`${e.name} — ${place.name}, ${yearLabel(e.year)}`)}</title>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${selected ? 13 : 9}" class="evmm-halo"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" class="evmm-dot"/>
        ${selected ? `<text x="${(x + 12).toFixed(1)}" y="${(y + 4).toFixed(1)}" class="evmm-tag">${esc(e.name)}</text>` : ''}
      </g>`;
  };

  function mapViewHtml() {
    const list = sorted(filtered());
    const plotted = list.filter((e) => e.placeId && ChronoData.place(e.placeId));
    const unplotted = list.filter((e) => !(e.placeId && ChronoData.place(e.placeId)));
    const { PLANE_W, PLANE_H } = DynastyGeo;
    const types = [...new Set(plotted.map((e) => e.uiType))];

    return `
      <div class="ev-map">
        <div class="ev-map-bar">
          <span class="ev-map-note">Documented sites only · ${plotted.length} of ${list.length} records plotted</span>
          <span class="ev-map-ctrl">
            <button class="dsh-iconbtn" type="button" data-map="in" aria-label="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
            <button class="dsh-iconbtn" type="button" data-map="out" aria-label="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
            <button class="dsh-iconbtn" type="button" data-map="reset" aria-label="Recentre"><span class="nav-icon" data-icon="recenter"></span></button>
          </span>
        </div>
        <svg class="ev-mapsvg" viewBox="0 0 ${PLANE_W} ${PLANE_H}" role="img" id="evMapSvg"
             aria-label="Map of events with documented coordinates">
          <rect width="${PLANE_W}" height="${PLANE_H}" class="evm-sea"/>
          <g id="evMapView">
            <g class="evm-graticule">${graticuleMarkup()}</g>
            <g class="evm-land-wrap">${coastMarkupCache || ''}</g>
            <g class="evmm-markers">${plotted.map(markerHtml).join('')}</g>
          </g>
        </svg>
        <div class="ev-map-legend">
          ${types.map((t) => {
            const info = ChronoData.typeInfo(t);
            return `<span class="ev-legend-item" style="--dot:${info.color}"><span class="ev-dotmark"></span>${esc(info.label)}</span>`;
          }).join('')}
        </div>
        ${unplotted.length ? `
          <div class="ev-noloc">
            <h3 class="ev-subhead">Records without a documented site (${unplotted.length})</h3>
            <div class="ev-chiplist">
              ${unplotted.map((e) => `<button class="dsh-chip" type="button" data-event="${esc(e.id)}">${esc(e.name)} · ${esc(yearLabel(e.year))}</button>`).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }

  // ---- Selection and refresh ---------------------------------------------

  const selected = () => ChronoData.event(state.selectedId) || sorted(filtered())[0] || null;

  function syncHash() {
    const p = [];
    if (state.selectedId) p.push(`id=${encodeURIComponent(state.selectedId)}`);
    if (state.view !== 'timeline') p.push(`view=${state.view}`);
    if (state.from) p.push(`from=${encodeURIComponent(state.from)}`);
    history.replaceState(null, '', `#events${p.length ? '?' + p.join('&') : ''}`);
  }

  /* Marks the selected record across every list on the page — rows, rail dots,
     map markers and the nearest-record tiles — without rebuilding them. */
  function markSelection(root) {
    root.querySelectorAll('[data-event]').forEach((el) => {
      const on = el.dataset.event === state.selectedId;
      el.classList.toggle('selected', on);
      if (el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', String(on));
    });
  }

  function renderPanel() {
    const host = state.host.querySelector('#evPanel');
    host.innerHTML = panelHtml(selected());
    Icons.init(host);
    // The whole panel is re-bound, not just its mini map: the tab strip, the
    // nearest-record tiles and the dynasty chips are all new elements.

    bindPanel(host);
  }

  function renderCenter({ keepScroll = true } = {}) {
    const host = state.host.querySelector('#evCenter');
    const list = host.querySelector('#evList');
    const top = keepScroll && list ? list.scrollTop : 0;
    host.innerHTML = centerHtml();
    Icons.init(host);
    bindCenter(host);
    const fresh = host.querySelector('#evList');
    if (fresh) fresh.scrollTop = top;
    if (state.view === 'map') renderMap();
    markSelection(host);
  }

  function renderSide() {
    const host = state.host.querySelector('#evSide');
    host.innerHTML = sidebarHtml();
    Icons.init(host);
    bindSide(host);
  }

  function selectEvent(id) {
    if (!ChronoData.event(id)) return;
    state.selectedId = id;
    ChronoData.remember({ eventId: id });
    syncHash();
    markSelection(state.host);
    renderPanel();
    if (state.view === 'map') renderMap();
    const ctx = state.host.querySelector('#evContext');
    if (ctx) renderContext(ctx);
  }

  // ---- Binding ------------------------------------------------------------

  function bindMini(scope) {
    const e = selected();
    const place = e && e.placeId ? ChronoData.place(e.placeId) : null;
    scope.querySelectorAll('[data-mini]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!place) return;
        const mode = btn.dataset.mini;
        if (mode === 'in') state.miniZoom = Math.max(0, state.miniZoom - 1);
        else if (mode === 'out') state.miniZoom = Math.min(MINI_SPANS.length - 1, state.miniZoom + 1);
        else state.miniZoom = 2;
        const map = scope.querySelector('#evMiniMap');
        if (map) map.innerHTML = miniMapHtml(place, miniSpan());
      });
    });
  }

  function bindCenter(scope) {
    scope.querySelectorAll('.ev-row, .ev-near, .dsh-chip[data-event]').forEach((el) => {
      el.addEventListener('click', () => selectEvent(el.dataset.event));
    });

    scope.querySelectorAll('.ev-dot, .evmm-marker').forEach((dot) => {
      dot.addEventListener('click', () => selectEvent(dot.dataset.event));
      dot.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectEvent(dot.dataset.event); }
      });
    });

    scope.querySelectorAll('.ev-period').forEach((btn) => {
      btn.addEventListener('click', () => setFocusEra(btn.dataset.era));
    });

    scope.querySelectorAll('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    const sort = scope.querySelector('#evSort');
    if (sort) sort.addEventListener('change', () => {
      state.sort = sort.value;
      renderCenter({ keepScroll: false });
    });

    scope.querySelector('#evClearChips')?.addEventListener('click', resetFilters);

    scope.querySelectorAll('[data-map]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.map;
        if (mode === 'in') state.mapZoom = Math.min(6, state.mapZoom * 1.35);
        else if (mode === 'out') state.mapZoom = Math.max(1, state.mapZoom / 1.35);
        else { state.mapZoom = 1; state.mapPan = { x: 0, y: 0 }; }
        applyMapTransform();
      });
    });

    bindMapDrag(scope.querySelector('#evMapSvg'));
  }

  /* Drag to pan and wheel to zoom, the way the timeline canvas behaves. */
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
      state.mapZoom = Math.min(6, Math.max(1, state.mapZoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12)));
      applyMapTransform();
    }, { passive: false });
  }

  function applyMapTransform() {
    const g = state.host.querySelector('#evMapView');
    if (!g) return;
    const s = state.mapZoom;
    const { PLANE_W, PLANE_H } = DynastyGeo;
    const tx = (PLANE_W / 2) * (1 - s) + state.mapPan.x;
    const ty = (PLANE_H / 2) * (1 - s) + state.mapPan.y;
    g.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(3)})`);
  }

  function renderMap() {
    const wrap = state.host.querySelector('#evMapWrap');
    if (!wrap) return;
    wrap.innerHTML = mapViewHtml();
    Icons.init(wrap);
    bindCenter(wrap);
    applyMapTransform();
    markSelection(wrap);
  }

  function setView(view) {
    if (!['timeline', 'list', 'map'].includes(view)) return;
    state.view = view;
    syncHash();
    const strip = state.host.querySelector('#evStrip');
    const wrap = state.host.querySelector('#evMapWrap');
    if (strip) strip.hidden = view === 'list';
    if (wrap) {
      wrap.hidden = view !== 'map';
      if (view === 'map') renderMap();
    }
    state.host.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  }

  function setFocusEra(id) {
    const next = state.focusEra === id ? null : id;
    state.focusEra = next;
    state.applied.eras = next ? new Set([next]) : new Set();
    state.draft.eras = new Set(state.applied.eras);
    renderSide();
    renderCenter({ keepScroll: false });
  }

  /* One handler per element per event: the panel is re-bound after every tab
     switch, and re-adding listeners there would double-fire them. */
  function on(el, type, fn) {
    const key = `__evb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  }

  function bindPanel(scope) {
    scope.querySelectorAll('.ev-tab').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.tab) || 0;
        const body = scope.querySelector('#evTabBody');
        body.innerHTML = tabHtml(selected(), state.tab);
        Icons.init(body);
        scope.querySelectorAll('.ev-tab').forEach((b) => {
          const active = Number(b.dataset.tab) === state.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        bindPanel(scope);
      });
    });
    scope.querySelectorAll('.ev-near').forEach((el) => {
      on(el, 'click', () => selectEvent(el.dataset.event));
    });
    bindMini(scope);
  }

  function bindSide(scope) {
    scope.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = cb.dataset.group === 'era' ? state.draft.eras
          : cb.dataset.group === 'type' ? state.draft.types : state.draft.regions;
        if (cb.checked) set.add(cb.value); else set.delete(cb.value);
        state.host.querySelector('#evApply')?.classList.toggle('dirty', !draftMatchesApplied());
      });
    });

    const search = scope.querySelector('#evSearch');
    if (search) {
      let timer;
      search.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.applied.q = search.value.trim().toLowerCase();
          renderCenter({ keepScroll: false });
          state.host.querySelector('#evApply')?.classList.toggle('dirty', !draftMatchesApplied());
        }, 140);
      });
    }

    scope.querySelector('#evApply')?.addEventListener('click', () => {
      state.applied.eras = new Set(state.draft.eras);
      state.applied.types = new Set(state.draft.types);
      state.applied.regions = new Set(state.draft.regions);
      state.focusEra = state.applied.eras.size === 1 ? [...state.applied.eras][0] : null;
      renderSide();
      renderCenter({ keepScroll: false });
    });

    scope.querySelector('#evReset')?.addEventListener('click', resetFilters);
  }

  function resetFilters() {
    state.draft = { eras: new Set(), types: new Set(), regions: new Set() };
    state.applied = { q: '', eras: new Set(), types: new Set(), regions: new Set() };
    state.focusEra = null;
    state.sort = 'chronological';
    renderSide();
    renderCenter({ keepScroll: false });
  }

  /* Arriving from a dynasty keeps the way back in sight, and the dynasty page
     keeps its own selection through session storage. */
  function renderContext(host) {
    const stored = ChronoData.recall();
    const d = state.from === 'dynasties' && stored.dynastyId ? ChronoData.dynasty(stored.dynastyId) : null;
    host.innerHTML = d
      ? `<div class="dsh-context">
           <a class="dsh-btn small" href="${ChronoData.links.dynasty(d.id, 'events')}">
             <span class="ev-arrow flip" data-icon="arrow-right"></span>Back to ${esc(d.full || d.name)}
           </a>
           <span class="ev-note">You came from the Islamic Dynasties page; that dynasty is still selected there.</span>
         </div>`
      : '';
    Icons.init(host);
  }

  // ---- Shell and public entry --------------------------------------------

  const shellHtml = () => `
    <div class="dsh ev">
      ${headerHtml()}
      <div id="evContext"></div>
      <div class="dsh-body">
        ${sidebarHtml()}
        ${centerHtml()}
        ${panelHtml(selected())}
      </div>
    </div>`;

  async function render(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;

    state.host = host;
    const get = (k) => (params && params.get ? params.get(k) : null);
    const stored = ChronoData.recall();

    // Every visit starts from a clean filter set; the selection is the record in
    // the link, or the one the reader left behind in this session.
    state.from = get('from') || null;
    const view = get('view');
    state.view = ['timeline', 'list', 'map'].includes(view) ? view : 'timeline';
    state.tab = 0;
    state.focusEra = null;
    state.sort = 'chronological';
    state.draft = { eras: new Set(), types: new Set(), regions: new Set() };
    state.applied = { q: '', eras: new Set(), types: new Set(), regions: new Set() };
    state.miniZoom = 2;
    state.mapZoom = 1;
    state.mapPan = { x: 0, y: 0 };

    const wanted = get('id') || (state.from === 'dynasties' ? stored.eventId : null) || stored.eventId || null;
    state.selectedId = ChronoData.event(wanted) ? wanted : null;

    // The land outline is fetched before the first paint, so neither map opens
    // on an empty sea.
    await coastMarkup();
    if (!host.isConnected) return;
    if (!state.selectedId) {
      const first = sorted(filtered())[0];
      state.selectedId = first ? first.id : null;
    }

    host.innerHTML = shellHtml();
    Icons.init(host);
    renderContext(host.querySelector('#evContext'));
    bindSide(host.querySelector('#evSide'));
    bindCenter(host.querySelector('#evCenter'));
    bindPanel(host.querySelector('#evPanel'));
    if (state.view === 'map') renderMap();
    markSelection(host);

    if (state.selectedId) {
      ChronoData.remember({ eventId: state.selectedId });
      syncHash();
    }
  }

  function searchScope() {
    const built = ChronoData.allEvents().map((e) => ({
      id: ChronoData.cid.event(e.id),
      label: e.name,
      group: e.era,
      meta: 'event',
      sub: [e.hijri || `${e.year} CE`, e.placeId ? ChronoData.place(e.placeId)?.name : null]
        .filter(Boolean).join(' · '),
      icon: 'calendar',
      colour: ChronoData.era(e.era).color,
      hay: `${e.name} ${e.year} ${e.hijri || ''} ${e.summary} ${e.context} ${e.source}`.toLowerCase(),
    }));
    let chip = 'all';
    return {
      label: 'Events',
      placeholder: 'Search events…',
      hint: 'Title, place, participant, era or wording of the record',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All eras', count: built.length },
        ...ChronoData.ERAS.map((era) => ({
          key: era.id, label: era.label, count: built.filter((r) => r.group === era.id).length,
        })).filter((c) => c.count > 0),
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => {
        const raw = ChronoData.resolve(id).id;
        if (!sorted(filtered()).some((e) => e.id === raw)) {
          return { hidden: true, message: 'An era, type or region filter keeps it out of the list.' };
        }
        selectEvent(raw);
      },
      reveal: (id) => {
        resetFilters();
        selectEvent(ChronoData.resolve(id).id);
      },
    };
  }

  return { render, searchScope };
})();
