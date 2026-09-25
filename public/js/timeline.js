/* Timeline View — an interactive, zoomable canvas of the whole archive.

   Layout: a frozen lane-label column on the left and one <svg> on the right.
   The svg is sized in real pixels (no viewBox scaling) so markers stay round
   and labels stay crisp at every zoom level. The visible window is the only
   piece of view state — zooming and panning both move its two ends — so the
   range slider in the header always reports exactly what the canvas shows.

   Bands, top → bottom of the canvas:
     0 … AXIS_H          the year ruler (its own svg, pinned in the Lifespan View)
     AXIS_H … floor      one row per category lane (or per packed lifespan)
     floor … chartH      the callout of the selected record

   The Lifespan View keeps every one of those bands and every pixel of that
   mapping, and repacks the middle band as one line per life from birth to death.
   It is a flag over this canvas, not a second canvas: the window, the zoom, the
   dimmed categories and the selection are shared, so a reader can flip between
   the two readings of the archive without losing their place. */

const Timeline = (() => {
  const {
    LANES, LANE_ORDER, ALWAYS_VISIBLE, LEGEND, ERAS,
    MIN_YEAR, MAX_YEAR, DEFAULT_WINDOW,
    formatYear, formatRange, eraFor,
  } = TimelineData;

  // Inline icons keep the lane column self-contained: no asset dependency, and
  // they inherit the lane colour through `currentColor`.
  const LANE_ICONS = {
    prophets:   '<circle cx="12" cy="8" r="3.5"/><path d="M4.6 20.5c1.2-4.1 4.1-6.1 7.4-6.1s6.2 2 7.4 6.1"/>',
    companions: '<circle cx="9.2" cy="8.2" r="3.2"/><path d="M2.7 20.5c1-3.7 3.4-5.5 6.5-5.5s5.5 1.8 6.5 5.5"/>' +
                '<circle cx="17.5" cy="9.5" r="2.5"/><path d="M15.9 15.7c2.8-.3 4.8 1.4 5.4 4.6"/>',
    tabiun:     '<circle cx="8.4" cy="8.6" r="3"/><path d="M2.4 20.3c1-3.5 3.2-5.2 6-5.2s5 1.7 6 5.2"/>' +
                '<path d="M16.4 4.4v9M19.9 6.9v6.5"/>',
    scholars:   '<path d="M11 4.7C9.6 3.5 7.3 3 4.6 3v14.6c2.7 0 5 .5 6.4 1.7"/>' +
                '<path d="M13 4.7C14.4 3.5 16.7 3 19.4 3v14.6c-2.7 0-5 .5-6.4 1.7"/><path d="M12 4.9v14.4"/>',
    books:      '<path d="M4 4.4h5.4a2.6 2.6 0 0 1 2.6 2.6v12.4a2 2 0 0 0-2-2H4z"/>' +
                '<path d="M20 4.4h-5.4a2.6 2.6 0 0 0-2.6 2.6v12.4a2 2 0 0 1 2-2H20z"/>',
    events:     '<path d="M5 21V3"/><path d="M5 4.6h12.6l-3.3 4 3.3 4H5z"/>',
    places:     '<path d="M12 21.5s-6.6-6.8-6.6-11.5a6.6 6.6 0 0 1 13.2 0c0 4.7-6.6 11.5-6.6 11.5z"/>' +
                '<circle cx="12" cy="9.8" r="2.4"/>',
    dynasties:  '<path d="M3.6 18.4 2.6 6.9l5.1 4.1L12 4.4l4.3 6.6 5.1-4.1-1 11.5z"/><path d="M4.6 21h14.8"/>',
  };

  // Generation labels for the tags on the detail card.
  const GEN_LABELS = {
    prophet:      'Prophet',
    sahabi:       'Companion',
    tabii:        "Tabi'i",
    'taba-tabii': "Taba' al-Tabi'in",
    later:        'Scholar',
    compiler:     'Compiler',
  };

  // The Lifespan View reads the archive by generation rather than by lane, so it
  // carries its own key: the four figure categories, in canvas order, each with
  // the count the archive holds (filled in by updateSpanKey).
  const SPAN_KEY = [
    { id: 'prophets',   label: 'Prophets' },
    { id: 'companions', label: 'Companions' },
    { id: 'tabiun',     label: "Tabi'un" },
    { id: 'scholars',   label: 'Scholars' },
  ];

  const AXIS_H = 38;          // year ruler band
  const SELECT_H = 42;        // callout band under the last lane
  const SIDE_PAD = 18;        // keeps the first/last marker off the edge
  const MIN_LANE_H = 64;
  const MAX_LANE_H = 150;
  const MIN_CANVAS = 540;     // every lane on: the rows fill this much
  const SPINE_OVERHANG = 14;  // a spine runs a little past its end markers
  const SPINE_BOTTOM = 18;    // distance from the lane floor to its spine
  const TIER_STACK = 17;      // vertical pitch of a stacked (single-line) label
  const NAME_SIZE = 10.5;
  const YEAR_SIZE = 9.5;
  const FEATURED_SIZE = 12;
  const HIT_R = 9;            // invisible hit radius for bare markers
  const MIN_SPAN = 30;        // tightest window a reader can zoom to, in years
  const ZOOM_PRECISION = 0.01;// years the window is held to (see snapYear)
  const WHEEL_ZOOM = 1.18;    // what one notch of the scroll wheel does to the window
  const WHEEL_NOTCH = 100;    // scroll pixels that count as one notch
  const WHEEL_MAX_NOTCHES = 3;// the most a single wheel event may zoom, however hard it
  const LABEL_MIN_GAP = 54;   // px between two printed year labels
  const PERIOD_GLIDE_MS = 520; // how long the canvas takes to travel to a period
  const GRID_UNITS = { century: 100, 'half-century': 50, decade: 10 };
  const AUTO_STEPS = [10, 20, 25, 50, 100, 200, 250, 500];
  // The card under the canvas is one fixed-height panel that lists four rows per
  // list and scrolls for the rest, so opening a record never resizes the page.
  // VISIBLE_ROWS is the JS half of the --tl-row-h / --tl-rows-h pair in
  // css/timeline.css.
  const VISIBLE_ROWS = 4;
  // Dimming runs on two dials, because the sidebar and the canvas are read in two
  // different ways. DIM_OPACITY is what a category's own group drops to on the
  // canvas. Never 0: the lane keeps its place and its records keep their dates, so
  // nothing above, below or beside it moves. DIM_OPACITY_SIDEBAR is what a dimmed
  // category drops to in the two controls that switch it — the frozen label column
  // and the All Categories menu. Half strength, because a label nobody can read is
  // a label nobody can click back on.
  const DIM_OPACITY = 0.01;
  const DIM_OPACITY_SIDEBAR = 0.5;
  const PRESS_MS = 320;       // how long a category row's click feedback plays

  // ---- Lifespan View geometry (px) ----
  // One thin line per figure, birth → death, packed into rows. The pitch of a
  // row, the room the packer keeps between two lifespans that share one, and the
  // cap at each end of the line.
  const SPAN_ROW_H = 30;
  const SPAN_TOP = 16;
  const SPAN_BOTTOM = 18;
  const SPAN_GAP = 26;
  const SPAN_LINE_W = 2;
  const SPAN_CAP_R = 3.2;
  const SPAN_NAME_SIZE = 10.5;

  // The categories the sidebar can dim. The lanes in ALWAYS_VISIBLE are not
  // listed there at all, so neither a row nor an ALL / NONE sweep can reach them.
  const TOGGLEABLE = LANE_ORDER.filter((id) => !ALWAYS_VISIBLE.includes(id));
  const isToggleable = (id) => TOGGLEABLE.includes(id);

  const state = {
    // One flag per category: true is full opacity, false is dimmed. A dimmed
    // category is never removed — its lane and its records only lose opacity.
    lanesOn: {},
    showLabels: true,
    // The Lifespan View is a flag over this one canvas, not a second canvas: the
    // window, the dimmed categories, the selection and the open tab are shared,
    // so flipping it changes nothing but how the figures are plotted.
    lifespan: false,
    spans: [],
    unit: 'century',
    viewMin: DEFAULT_WINDOW.start,
    viewMax: DEFAULT_WINDOW.end,
    records: [],
    byId: new Map(),
    lanes: [],
    events: [],
    hadiths: [],
    places: [],
    chartW: 0,
    chartH: MIN_CANVAS,
    selectedId: null,
    tab: 0,
  };
  LANE_ORDER.forEach((id) => { state.lanesOn[id] = true; });

  const dom = {};
  // A category's state is drawn in three places at once — its row in the sidebar,
  // its row in the frozen label column and its own group on the canvas — so each
  // render hands back the nodes it drew and a toggle only has to touch opacity.
  const laneNodes = {};      // lane id → <g> holding that lane's records
  const labelNodes = {};     // lane id → the lane's row in the label column
  let frame = 0;
  let glide = 0;             // rAF id of a running "travel to this period" glide
  let tipId = null;
  let boundOnce = false;     // window/document listeners survive a re-render
  let resizeObs = null;
  const drag = { active: false, moved: false, startX: 0, startMin: 0, startMax: 0 };

  // ==================== HELPERS ====================

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // The window is held to a hundredth of a year. Whole years are too coarse to
  // zoom on: at MIN_SPAN one year is ~33 px, so rounding the window would slide
  // the year under the pointer that far on every step — the jump a wheel zoom
  // has to avoid. Reading the dates back rounds (see formatYear), so nothing
  // ever prints a fraction.
  const snapYear = (v) => Math.round(v / ZOOM_PRECISION) * ZOOM_PRECISION;

  function node(name, attrs = {}, styles = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    Object.entries(styles).forEach(([k, v]) => el.style.setProperty(k, v));
    return el;
  }

  // Rough glyph advance for Inter, used only to reserve room for a label.
  const textWidth = (s, size) => String(s ?? '').length * size * 0.535;

  // A clipped record still reports its real dates — the bar leaves the canvas at
  // the edge of the domain, but the Mamluk dynasty did not end in 1500.
  const trueStart = (rec) => (rec.trueStart ?? rec.startYear);
  const trueEnd = (rec) => (rec.trueEnd ?? rec.endYear);
  const sortLo = (rec) => Math.min(rec.startYear, rec.endYear);
  const sortHi = (rec) => Math.max(rec.startYear, rec.endYear);
  // "570 – 632 CE": the dates a reader sees, clipped range or not.
  const spanText = (rec) => formatRange(trueStart(rec), trueEnd(rec));
  const laneOf = (id) => LANES[id] || { color: 'var(--tl-accent)', label: '' };
  const colorOf = (rec) => laneOf(rec ? rec.lane : null).color;

  // Arabic initials — first letter of the first two words of the Arabic name.
  function initials(rec) {
    const src = rec.arabic || rec.name || '';
    const parts = String(src).trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0] || '').join('') || '·';
  }

  // A category is either drawn at full strength or dimmed: on the canvas to
  // DIM_OPACITY, in the sidebar controls to DIM_OPACITY_SIDEBAR.
  // ALWAYS_VISIBLE lanes can never be dimmed: the sidebar does not list them and
  // the ALL / NONE sweeps skip them.
  const isOn = (lane) => ALWAYS_VISIBLE.includes(lane) || !!state.lanesOn[lane];

  // Where each record family leads when the reader wants the whole page.
  const DETAIL_ROUTES = {
    figure:  { hash: (rec) => `#figures?id=${rec.id}`, label: 'View Full Profile' },
    book:    { hash: (rec) => `#figures?id=${rec.data?.compilerId || ''}`, label: 'View the compiler' },
    place:   { hash: () => '#places', label: 'Open the Places atlas' },
    dynasty: { hash: () => '#events', label: 'Open Events & Dynasties' },
    event:   { hash: () => '#events', label: 'Open Events & Dynasties' },
  };

  // ==================== SCALE ====================

  // The canvas spans SIDE_PAD … chartW - SIDE_PAD; the window maps onto it.
  const avail = () => Math.max(120, state.chartW - SIDE_PAD * 2);
  const spanYears = () => Math.max(1, state.viewMax - state.viewMin);
  const perYear = () => avail() / spanYears();
  const xOf = (year) => SIDE_PAD + ((year - state.viewMin) / spanYears()) * avail();
  const yearAt = (px) => state.viewMin + ((px - SIDE_PAD) / avail()) * spanYears();

  // Clamp a requested window: inside the domain, and never narrower than
  // MIN_SPAN, so no zoom can collapse the axis to a point.
  function fitSpan(min, max) {
    let lo = min;
    let hi = max;

    if (hi - lo < MIN_SPAN) {
      const mid = (lo + hi) / 2;
      lo = mid - MIN_SPAN / 2;
      hi = mid + MIN_SPAN / 2;
    }
    if (lo < MIN_YEAR) { hi += MIN_YEAR - lo; lo = MIN_YEAR; }
    if (hi > MAX_YEAR) { lo -= hi - MAX_YEAR; hi = MAX_YEAR; }
    lo = Math.max(MIN_YEAR, lo);
    hi = Math.min(MAX_YEAR, hi);
    if (hi - lo < MIN_SPAN) {                       // domain smaller than a step
      lo = MIN_YEAR;
      hi = MAX_YEAR;
    }
    return { min: snapYear(lo), max: snapYear(hi) };
  }

  function setWindow(min, max, { silent = false } = {}) {
    const next = fitSpan(min, max);
    state.viewMin = next.min;
    state.viewMax = next.max;
    syncRange();
    if (!silent) scheduleRender();
  }

  // ---- gliding to a historical period ------------------------------------

  const reducedMotion = () => !!(window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function cancelGlide() {
    if (!glide) return;
    cancelAnimationFrame(glide);
    glide = 0;
  }

  // Travel from the current window to another span. Eased so a period click
  // reads as one movement across the centuries rather than a jump cut.
  function glideTo(min, max, duration = PERIOD_GLIDE_MS) {
    cancelGlide();

    const target = fitSpan(min, max);
    const from = { min: state.viewMin, max: state.viewMax };

    if (reducedMotion() || duration <= 0) {
      setWindow(target.min, target.max);
      return;
    }

    const started = performance.now();
    const step = (now) => {
      const t = clamp((now - started) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);        // easeOutCubic
      setWindow(from.min + (target.min - from.min) * eased,
                from.max + (target.max - from.max) * eased);
      glide = t < 1 ? requestAnimationFrame(step) : 0;
    };
    glide = requestAnimationFrame(step);
  }

  // Wheel deltas come in pixels, lines or pages, and a trackpad drips them in
  // sub-pixel trickles, so normalise them to pixels first: a notched mouse, a
  // trackpad glide and the keyboard then all move the axis by the same amount.
  function deltaPixels(e, delta) {
    if (!delta) return 0;
    if (e.deltaMode === 1) return (delta * WHEEL_NOTCH) / 3;   // three lines = one notch
    if (e.deltaMode === 2) return delta * WHEEL_NOTCH * 4;     // a page = four notches
    return delta;
  }

  // Zoom around a pixel on the canvas: the year under the pointer keeps its
  // place, so the wheel pulls the axis toward the cursor instead of the middle.
  // The span is clamped here rather than afterwards — re-centring an
  // over-zoomed window later would slide the years out from under the pointer,
  // which is exactly what makes a zoom read as a jump.
  function zoomAt(factor, focusPx = SIDE_PAD + avail() / 2) {
    cancelGlide();                                 // a hand on the wheel wins
    const px = clamp(focusPx, SIDE_PAD, SIDE_PAD + avail());
    const frac = (px - SIDE_PAD) / avail();        // where the cursor sits in the window
    const anchor = yearAt(px);
    const span = clamp(spanYears() / factor, MIN_SPAN, MAX_YEAR - MIN_YEAR);

    // Same fraction of the new window → the anchored year never moves. Only at
    // the two ends of the domain does the anchor have to give way, because
    // there is nothing left to pull in from.
    let min = anchor - frac * span;
    let max = min + span;
    if (min < MIN_YEAR) { max += MIN_YEAR - min; min = MIN_YEAR; }
    if (max > MAX_YEAR) { min -= max - MAX_YEAR; max = MAX_YEAR; }
    setWindow(min, max);
  }

  function panPixels(dx) {
    cancelGlide();
    const years = -(dx / avail()) * spanYears();
    setWindow(state.viewMin + years, state.viewMax + years);
  }

  function resetWindow() {
    cancelGlide();
    setWindow(DEFAULT_WINDOW.start, DEFAULT_WINDOW.end);
  }

  // Bring a record fully into view, keeping the current span where it fits.
  function revealRecord(rec) {
    const lo = sortLo(rec);
    const hi = sortHi(rec);
    const pad = Math.max(8, (hi - lo) * 0.25);
    if (lo - pad >= state.viewMin && hi + pad <= state.viewMax) { syncRange(); return; }
    const span = Math.max(spanYears(), hi - lo + pad * 2);
    const mid = (lo + hi) / 2;
    setWindow(mid - span / 2, mid + span / 2, { silent: true });
    syncRange();
  }

  // ==================== LAYOUT ====================

  // Every lane is laid out on every render, whether it is dimmed or not. Dimming
  // a category must never move the rows the other categories sit in, so the
  // canvas is plotted once and stays put.
  function layout() {
    const active = LANE_ORDER
      .map((id) => ({ id, ...LANES[id], records: state.records.filter((r) => r.lane === id) }));

    const totalWeight = active.reduce((sum, lane) => sum + lane.weight, 0) || 1;
    // All eight lanes on: the rows fill MIN_CANVAS. Only one or two on:
    // MAX_LANE_H stops a single row from being stretched down the whole card.
    const space = Math.max(
      active.length * MIN_LANE_H,
      Math.min(MIN_CANVAS, active.length * MAX_LANE_H),
    );

    let y = AXIS_H;
    active.forEach((lane) => {
      // Weight decides the share, MIN_LANE_H guarantees a readable floor.
      lane.h = Math.max(MIN_LANE_H, Math.round((space * lane.weight) / totalWeight));
      lane.y = y;
      y += lane.h;
    });

    state.lanes = active;
    state.chartH = y + SELECT_H;
  }

  // How many stacked label rows fit above this lane's spine. Row 0 is the
  // design's two-line straddle — name above the marker, years below it — so it
  // costs nothing above the spine. Rows 1+ are single lines stacked upward,
  // each costing TIER_STACK pixels of headroom.
  const tierCount = (lane) => clamp(2 + Math.floor((lane.h - 58) / TIER_STACK), 1, 5);

  // A record whose span lies entirely outside the window is not drawn at all.
  const offscreen = (rec) => xOf(sortHi(rec)) < -4 || xOf(sortLo(rec)) > state.chartW + 4;

  // Where the record's own marker sits. A bar that started before the window
  // opens is pinned to the edge rather than drawn off-canvas.
  const markerX = (rec) => clamp(xOf(rec.startYear), SIDE_PAD, state.chartW - SIDE_PAD);

  // ==================== LANE LABELS ====================

  const laneIcon = (id) => `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${LANE_ICONS[id] || LANE_ICONS.events}
    </svg>`;

  // The frozen lane column doubles as the canvas's own category sidebar: a lane
  // the reader may dim is drawn as a toggle button, so clicking its label dims
  // and restores it right where it sits. The always-visible lanes are plain rows
  // — nothing to toggle, so nothing to click.
  function renderLaneLabels() {
    dom.labels.innerHTML = '';
    Object.keys(labelNodes).forEach((id) => { delete labelNodes[id]; });

    state.lanes.forEach((lane) => {
      const toggleable = isToggleable(lane.id);
      const row = document.createElement(toggleable ? 'button' : 'div');
      row.className = `tlc-lane${toggleable ? '' : ' locked'}`;
      row.setAttribute('data-lane', lane.id);
      row.style.setProperty('height', `${lane.h}px`);
      row.style.setProperty('--lane', lane.color);

      if (toggleable) {
        row.setAttribute('type', 'button');
        row.setAttribute('aria-pressed', 'true');
        row.setAttribute('title', `Show or dim ${lane.label}`);
        row.setAttribute('aria-label', `${lane.label} — ${lane.records.length} records`);
      }

      row.innerHTML = `
        <span class="tlc-ico">${laneIcon(lane.id)}</span>
        <span class="tlc-lane-name">${esc(lane.label)}</span>
        <span class="tlc-lane-count">${lane.records.length}</span>
      `;

      dom.labels.appendChild(row);
      labelNodes[lane.id] = row;
    });
  }

  // ==================== HISTORICAL PERIOD BAR ====================

  // "570 – 632 CE", or "1000+ CE" for a period that runs on.
  const eraRange = (era) => (era.openEnd
    ? `${era.start}+ CE`
    : formatRange(era.start, era.end));

  const eraById = (id) => ERAS.find((era) => era.id === id) || null;

  // One segment per period, grown by the years it covers so the long periods
  // get the room and a short one keeps a readable floor (the min-width).
  function buildRibbon() {
    dom.ribbon.innerHTML = ERAS.map((era) => `
      <button class="tlc-era" type="button" data-era="${era.id}" aria-pressed="false"
              style="--era:${era.color};--era-grow:${era.end - era.start}"
              title="${esc(`${era.label} · ${eraRange(era)}`)}">
        <span class="tlc-era-head">
          <span class="tlc-era-dot" aria-hidden="true"></span>
          <span class="tlc-era-name">${esc(era.label)}</span>
        </span>
        <span class="tlc-era-range">${esc(eraRange(era))}</span>
      </button>
    `).join('');
  }

  // The period the canvas is mostly showing. Overlap is measured in years, so a
  // window that spans several periods highlights the one it covers most; a tie
  // (the window sits exactly on a turnover) goes to the period holding its middle.
  function visibleEra() {
    const centre = (state.viewMin + state.viewMax) / 2;
    const holds = (era) => era && centre >= era.start && centre < era.end;
    let best = null;
    let bestYears = 0;

    ERAS.forEach((era) => {
      const overlap = Math.min(era.end, state.viewMax) - Math.max(era.start, state.viewMin);
      if (overlap <= 0) return;
      const better = overlap > bestYears || (overlap === bestYears && holds(era) && !holds(best));
      if (better) { best = era; bestYears = overlap; }
    });

    return best;
  }

  // Exactly one segment is ever active.
  function setActiveEra(id) {
    dom.ribbon.querySelectorAll('[data-era]').forEach((chip) => {
      const on = chip.getAttribute('data-era') === id;
      chip.classList.toggle('active', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  }

  // Keep the bar in step with the canvas. While a period is being travelled to,
  // the clicked segment stays lit rather than flickering through the periods the
  // canvas passes on the way.
  function syncRibbon() {
    if (glide) return;
    const era = visibleEra();
    setActiveEra(era ? era.id : null);
  }

  // Short click feedback: flash the background, pulse the dot and sweep the
  // accent rail from left to right. The class is removed when it has played.
  function pulseEra(chip) {
    chip.classList.remove('pulse');
    void chip.offsetWidth;               // restart the animation
    chip.classList.add('pulse');
    setTimeout(() => chip.classList.remove('pulse'), 360);
  }

  // ==================== GRID ====================

  // Grid step in years. A fixed unit is honoured (labels thin out when the
  // window is zoomed out); "auto" picks the finest step that still breathes.
  function tickStep() {
    const fixed = GRID_UNITS[state.unit];
    if (fixed) return fixed;
    const px = perYear();
    return AUTO_STEPS.find((step) => step * px >= LABEL_MIN_GAP + 30) || 500;
  }

  // Every grid step inside the window, oldest first.
  function ticks() {
    const step = tickStep();
    const first = Math.ceil(state.viewMin / step) * step;
    const out = [];
    for (let y = first; y <= state.viewMax && out.length < 220; y += step) out.push(y);
    return { step, years: out };
  }

  // Plain tick text: the caption at the end of the ruler says which era.
  const tickText = (year) => (year < 0 ? `${-year} BCE` : String(year));

  // ==================== RENDER: YEAR RULER ====================
  // The ruler is its own svg rather than part of the canvas svg, because it has to
  // be able to stay put: in the Lifespan View the canvas is taller than the screen
  // and the band sticks to the top of the page, so the years stay in sight while
  // the rows travel under them. Both svgs share chartW, so the years line up.
  function renderAxis() {
    const g = dom.axisSvg;
    g.innerHTML = '';

    const { step, years } = ticks();
    const stepPx = step * perYear();
    const every = Math.max(1, Math.ceil(LABEL_MIN_GAP / Math.max(1, stepPx)));

    // The ruler baseline — the seam the canvas continues from.
    g.appendChild(node('line', { x1: 0, x2: state.chartW, y1: AXIS_H - 0.5, y2: AXIS_H - 0.5 },
      { stroke: 'var(--tl-line-2)', 'stroke-width': '1' }));

    // A tick and a year per grid step, as often as the width allows. The grid
    // lines themselves live on the canvas below, so the ruler only marks the
    // steps it names.
    let lastLabelX = -Infinity;
    years.forEach((year, i) => {
      if (i % every !== 0) return;
      const x = xOf(year);

      g.appendChild(node('line', { x1: x, x2: x, y1: AXIS_H - 5, y2: AXIS_H },
        { stroke: 'var(--tl-line-2)', 'stroke-width': '1' }));

      const label = node('text', {
        x: clamp(x, 26, state.chartW - 26),
        y: AXIS_H - 12,
        'text-anchor': 'middle',
      }, { fill: 'var(--tl-fg-3)', 'font-size': '9.5px', 'font-family': 'var(--font-mono)' });
      label.textContent = tickText(year);
      g.appendChild(label);
      lastLabelX = x;
    });

    // "years CE" / "years BCE" — only when it will not run into the last label.
    if (state.chartW - lastLabelX > 62) {
      const caption = node('text', {
        x: state.chartW - 2,
        y: AXIS_H - 12,
        'text-anchor': 'end',
      }, { fill: 'var(--tl-fg-3)', 'font-size': '9px', 'font-family': 'var(--font-mono)' });
      caption.textContent = state.viewMin >= 0
        ? 'years CE'
        : state.viewMax <= 0 ? 'years BCE' : 'BCE | CE';
      g.appendChild(caption);
    }
  }

  // ==================== RENDER: GRID ====================

  function renderGrid() {
    const g = dom.grid;
    g.innerHTML = '';

    const { step, years } = ticks();
    const floor = state.chartH - SELECT_H;
    const stepPx = step * perYear();
    const every = Math.max(1, Math.ceil(LABEL_MIN_GAP / Math.max(1, stepPx)));

    // Lane separators — the horizontal half of the grid. The Lifespan View packs
    // its rows on a pitch of its own, so it draws no lane rules: its rows are
    // told apart by the lifespans in them, not by a line between them.
    if (!state.lifespan) {
      state.lanes.forEach((lane, i) => {
        if (i === 0) return;
        g.appendChild(node('line', { x1: 0, x2: state.chartW, y1: lane.y, y2: lane.y },
          { stroke: 'var(--tl-line)', 'stroke-width': '1' }));
      });
    }

    // A dashed rule where one era hands over to the next.
    ERAS.forEach((era) => {
      if (era.start <= state.viewMin || era.start >= state.viewMax) return;
      const x = xOf(era.start);
      g.appendChild(node('line', { x1: x, x2: x, y1: AXIS_H, y2: floor },
        { stroke: era.color, 'stroke-width': '1', 'stroke-dasharray': '3 5', opacity: '0.4' }));
    });

    // One vertical line per grid step, from just under the ruler to the floor.
    years.forEach((year, i) => {
      const x = xOf(year);
      const strong = i % every === 0;
      g.appendChild(node('line', { x1: x, x2: x, y1: AXIS_H, y2: floor },
        { stroke: strong ? 'var(--tl-grid-strong)' : 'var(--tl-grid)', 'stroke-width': '1' }));
    });
  }

  // ==================== RENDER: LANES ====================

  function renderLanes() {
    const g = dom.lanes;
    g.innerHTML = '';
    Object.keys(laneNodes).forEach((id) => { delete laneNodes[id]; });

    state.lanes.forEach((lane) => {
      const group = node('g', { 'data-lane': lane.id });
      g.appendChild(group);
      // Kept on hand so dimming this category can fade the whole lane — spine,
      // markers and labels alike — without re-plotting anything.
      laneNodes[lane.id] = group;

      const inView = lane.records.filter((rec) => !offscreen(rec));
      if (!inView.length) return;

      const spineY = lane.y + lane.h - SPINE_BOTTOM;

      // The spine runs from the first record to the last one with a short
      // overhang, so the row reads as a ruler instead of stopping dead on a dot.
      let lo = Infinity;
      let hi = -Infinity;
      inView.forEach((rec) => {
        lo = Math.min(lo, sortLo(rec));
        hi = Math.max(hi, sortHi(rec));
      });
      group.appendChild(node('line', {
        x1: clamp(xOf(lo) - SPINE_OVERHANG, SIDE_PAD - SPINE_OVERHANG, state.chartW),
        x2: clamp(xOf(hi) + SPINE_OVERHANG, 0, state.chartW - SIDE_PAD + SPINE_OVERHANG),
        y1: spineY,
        y2: spineY,
      }, { stroke: lane.color, 'stroke-width': '1', opacity: '0.28' }));

      // Bare markers first, so labels always end up on top of them.
      inView.forEach((rec) => {
        if (rec.tier === 'small') drawMarker(group, lane, rec, spineY, null);
      });

      // Labels are placed left → right and stack into the first free row, so two
      // names can never collide however dense the lane gets.
      const tiers = tierCount(lane);
      const tierEnd = [];

      inView
        .filter((rec) => rec.tier !== 'small')
        .sort((a, b) => sortLo(a) - sortLo(b) || a.name.localeCompare(b.name))
        .forEach((rec) => {
          const years = spanText(rec);
          const x1 = markerX(rec);
          const x2 = clamp(xOf(rec.endYear), 0, state.chartW);
          const mid = (x1 + Math.max(x1, x2)) / 2;

          // Row 0 straddles the marker so it only has to fit the longer of its
          // two lines; rows 1+ are single-line and therefore wider.
          const w0 = Math.max(
            textWidth(rec.name, rec.tier === 'featured' ? FEATURED_SIZE : NAME_SIZE),
            textWidth(years, YEAR_SIZE),
          );
          const w1 = textWidth(`${rec.name} · ${years}`, NAME_SIZE);
          const fit = (w) => clamp(mid - w / 2, 4, Math.max(4, state.chartW - w - 4));

          let tier = 0;
          let boxW = w0;
          let left = fit(boxW);
          while (tier < tiers && left < (tierEnd[tier] ?? -Infinity) + 7) {
            tier++;
            boxW = w1;
            left = fit(boxW);
          }

          const place = tier < tiers ? { left, boxW, tier, years } : null;
          if (place) tierEnd[tier] = left + boxW;

          drawMarker(group, lane, rec, spineY, place);
        });
    });
  }

  // One record: lifespan bar (when it spans years), end markers, optional label.
  function drawMarker(parent, lane, rec, spineY, place) {
    const selected = state.selectedId === rec.id;
    const group = node('g', { 'data-rec': rec.id });
    if (rec.tier !== 'small') {
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${rec.name} — ${spanText(rec)}`);
    }

    const x1 = markerX(rec);
    const x2 = rec.endClipped ? state.chartW - 2 : clamp(xOf(rec.endYear), 0, state.chartW);
    const spans = x2 - x1 > 3;
    const small = rec.tier === 'small';
    const color = lane.color;

    // Selection halo, drawn under the marker so the dot itself stays crisp.
    if (selected) {
      group.appendChild(node('circle', {
        cx: x1, cy: spineY, r: rec.tier === 'featured' ? 13 : 10,
      }, { fill: 'color-mix(in srgb, var(--tl-sel) 14%, transparent)',
           stroke: 'var(--tl-sel)', 'stroke-width': '1.2', opacity: '0.85' }));
    }

    if (spans) {
      // Invisible strip: a 2.6px bar is otherwise hard to hover.
      group.appendChild(node('line', { x1, x2, y1: spineY, y2: spineY },
        { stroke: 'transparent', 'stroke-width': '13', 'pointer-events': 'stroke' }));
      group.appendChild(node('line', { x1, x2, y1: spineY, y2: spineY },
        { stroke: color,
          'stroke-width': rec.tier === 'featured' ? '5' : '2.6',
          'stroke-linecap': 'round',
          opacity: small ? '0.5' : '1' }));
    }

    if (rec.tier === 'featured') {
      // Ring with a hollow core — the anchor the rest of the canvas reads against.
      group.appendChild(node('circle', { cx: x1, cy: spineY, r: 7.5 },
        { fill: 'var(--tl-bg)', stroke: color, 'stroke-width': '3.2' }));
    } else {
      group.appendChild(node('circle', { cx: x1, cy: spineY, r: small ? 3.2 : 4.6 },
        { fill: color, opacity: small ? '0.8' : '1' }));
    }

    // A run that carries on past the right edge gets no end marker: the bar
    // leaves the canvas rather than implying it stopped at the last year shown.
    if (spans && !rec.endClipped && x2 < state.chartW - 2) {
      group.appendChild(node('circle', {
        cx: x2, cy: spineY,
        r: rec.tier === 'featured' ? 5 : small ? 3.2 : 4,
      }, { fill: color, opacity: small ? '0.8' : '1' }));
    }

    // Bare markers get a generous invisible hit target so hovering is easy.
    if (small) {
      group.appendChild(node('circle', { cx: x1, cy: spineY, r: HIT_R, fill: 'none' },
        { 'pointer-events': 'all' }));
      if (spans) {
        group.appendChild(node('circle', { cx: x2, cy: spineY, r: HIT_R, fill: 'none' },
          { 'pointer-events': 'all' }));
      }
    }

    parent.appendChild(group);
    if (place && state.showLabels) drawLabel(group, rec, spineY, place, color);
  }

  // The straddle label of row 0, or a stacked single line for rows 1+.
  function drawLabel(group, rec, spineY, place, color) {
    const cx = place.left + place.boxW / 2;

    if (place.tier === 0) {
      // The design's straddle: name above the marker, years below it.
      const name = node('text', { x: cx, y: spineY - 11, 'text-anchor': 'middle' },
        { fill: color,
          'font-size': `${rec.tier === 'featured' ? FEATURED_SIZE : NAME_SIZE}px`,
          'font-weight': rec.tier === 'featured' ? '600' : '500' });
      name.textContent = rec.name;

      const years = node('text', { x: cx, y: spineY + 15, 'text-anchor': 'middle' },
        { fill: color, 'font-size': `${YEAR_SIZE}px`, 'font-family': 'var(--font-mono)',
          opacity: '0.78' });
      years.textContent = place.years;

      group.appendChild(name);
      group.appendChild(years);
      return;
    }

    // Stacked rows are one line — "Name · years" — so several can share a lane
    // without the name and the year landing on top of each other.
    const line = node('text', {
      x: cx,
      y: spineY - 26 - (place.tier - 1) * TIER_STACK,
      'text-anchor': 'middle',
    }, { 'font-size': `${NAME_SIZE}px`, 'font-weight': '500' });

    const namePart = node('tspan', {}, { fill: color });
    namePart.textContent = rec.name;

    const yearPart = node('tspan', {}, { fill: 'var(--tl-fg-3)' });
    yearPart.textContent = ` · ${place.years}`;

    line.appendChild(namePart);
    line.appendChild(yearPart);
    group.appendChild(line);
  }

  // ==================== TOOLTIP ====================

  function tipHTML(rec) {
    const d = rec.data || {};
    let note = '';
    if (rec.kind === 'figure') note = d.bio || '';
    else if (rec.kind === 'event') note = d.source ? `Source: ${d.source}` : '';
    else if (rec.kind === 'dynasty') {
      note = [d.region, d.capital ? `${d.capital} (capital)` : ''].filter(Boolean).join(' · ');
    } else if (rec.kind === 'place') {
      note = [d.region, d.milestone?.label].filter(Boolean).join(' · ');
    } else if (rec.kind === 'book') {
      note = `${d.name || rec.name} — completed ${formatYear(d.year || rec.startYear)}`;
    }

    // In the Lifespan View the line *is* the record, so its length is the first
    // thing a reader wants told: the years the archive gives, subtracted.
    if (state.lifespan && rec.kind === 'figure' && d.birthYear != null && d.deathYear != null) {
      const years = Math.max(0, Math.round(d.deathYear - d.birthYear));
      note = `${years} years from birth to death${note ? ` · ${note}` : ''}`;
    }

    return `
      <div class="tlc-tip-name">${esc(rec.name)}</div>
      ${rec.arabic ? `<div class="tlc-tip-ar" lang="ar" dir="rtl">${esc(rec.arabic)}</div>` : ''}
      <div class="tlc-tip-dates">${esc(spanText(rec))}</div>
      ${rec.role ? `<div class="tlc-tip-role">${esc(rec.role)}</div>` : ''}
      ${note ? `<div class="tlc-tip-note">${esc(note)}</div>` : ''}
    `;
  }

  function placeTip(e) {
    const rect = dom.track.getBoundingClientRect();
    const w = dom.tip.offsetWidth;
    const h = dom.tip.offsetHeight;
    let x = e.clientX - rect.left + 14;
    let y = e.clientY - rect.top + 14;
    if (x + w > rect.width - 8) x = e.clientX - rect.left - w - 14;
    if (y + h > rect.height - 8) y = e.clientY - rect.top - h - 14;
    dom.tip.style.transform =
      `translate(${Math.round(Math.max(4, x))}px, ${Math.round(Math.max(4, y))}px)`;
  }

  function hideTip() {
    tipId = null;
    if (dom.tip) dom.tip.classList.remove('show');
  }

  function onHover(e) {
    const hit = e.target.closest ? e.target.closest('[data-rec]') : null;
    const id = hit && hit.getAttribute('data-rec');

    if (!id) { hideTip(); return; }
    if (id === tipId) { placeTip(e); return; }

    const rec = state.byId.get(id);
    if (!rec) { hideTip(); return; }

    tipId = id;
    dom.tip.innerHTML = tipHTML(rec);
    dom.tip.classList.add('show');
    placeTip(e);
  }

  // ==================== RENDER: LIFESPAN VIEW ====================
  // The same canvas, read the other way round: one thin line per figure from birth
  // to death, packed into as few rows as the overlaps allow. Nothing here is a
  // second view of the archive — it is the lane canvas with its rows repacked,
  // which is why the window, the zoom, the dimmed categories and the selection all
  // carry over untouched, in both directions.

  // The lanes the Lifespan View plots: every lane the archive files figures in,
  // taken in canvas order so the key and the lines can never drift apart.
  const spanLanes = () => LANE_ORDER
    .filter((id) => state.records.some((rec) => rec.lane === id && rec.kind === 'figure'));

  // Greedy first-fit, oldest first: a lifespan takes the topmost row whose last
  // occupant ended before it began, plus a little air so two names never touch.
  // The packing depends on the zoom (SPAN_GAP is pixels), so it is redone on every
  // render — it is arithmetic over a hundred records, and it is what makes a
  // crowded century fan out while a quiet one collapses to a single row.
  function packSpans() {
    // Names are what need the room, so with the labels switched off the rows pack
    // tighter — the gap was only ever there for them.
    const gap = (state.showLabels ? SPAN_GAP : 8) / perYear();
    const lanes = spanLanes();

    const items = state.records
      .filter((rec) => rec.kind === 'figure' && lanes.includes(rec.lane) && !offscreen(rec))
      .map((rec) => ({ rec, lo: sortLo(rec), hi: sortHi(rec) }))
      .sort((a, b) => a.lo - b.lo || b.hi - a.hi || a.rec.name.localeCompare(b.rec.name));

    const rowEnd = [];
    state.spans = items.map((item) => {
      let row = rowEnd.findIndex((end) => end + gap <= item.lo);
      if (row < 0) {
        row = rowEnd.length;
        rowEnd.push(item.hi);
      }
      rowEnd[row] = Math.max(rowEnd[row], item.hi);
      return { rec: item.rec, lo: item.lo, hi: item.hi, row };
    });

    return rowEnd.length;
  }

  // The packer decides the canvas height: one row per row of lifespans, plus the
  // ruler above and the selection callout below, exactly as the lanes do.
  function layoutSpans() {
    const rows = Math.max(1, packSpans());
    state.chartH = AXIS_H + SPAN_TOP + rows * SPAN_ROW_H + SPAN_BOTTOM + SELECT_H;
  }

  // One lifespan: a thin line from birth to death, a cap at each end of it, and
  // the name off the far end. A figure the archive dates only once is a single
  // cap: there is no line to draw, and inventing one would be a fiction.
  function drawSpan(parent, lane, item) {
    const rec = item.rec;
    const y = AXIS_H + SPAN_TOP + item.row * SPAN_ROW_H + SPAN_ROW_H / 2;
    const x1 = clamp(xOf(item.lo), SIDE_PAD, state.chartW - SIDE_PAD);
    const x2 = clamp(xOf(item.hi), SIDE_PAD, state.chartW - SIDE_PAD);
    const line = x2 - x1 > 2;
    const selected = state.selectedId === rec.id;

    // The lane colour rides on the group as `color`, so the CSS glow can pick it
    // up with currentColor instead of a rule per category.
    const group = node('g', { 'data-rec': rec.id, class: 'tlc-span' }, { color: lane.color });
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    group.setAttribute('aria-label', `${rec.name} — ${spanText(rec)}`);

    if (selected) {
      group.classList.add('selected');
      group.appendChild(node('circle', { cx: x1, cy: y, r: 10 },
        { fill: 'color-mix(in srgb, var(--tl-sel) 14%, transparent)',
          stroke: 'var(--tl-sel)', 'stroke-width': '1.2', opacity: '0.85' }));
    }

    if (line) {
      // Invisible strip: a 2px line is otherwise hard to hover.
      group.appendChild(node('line', { x1, x2, y1: y, y2: y },
        { stroke: 'transparent', 'stroke-width': '13', 'pointer-events': 'stroke' }));
      group.appendChild(node('line', { x1, x2, y1: y, y2: y, class: 'tlc-span-line' },
        { stroke: lane.color, 'stroke-width': String(SPAN_LINE_W), 'stroke-linecap': 'round' }));
    } else {
      group.appendChild(node('circle', { cx: x1, cy: y, r: HIT_R, fill: 'none' },
        { 'pointer-events': 'all' }));
    }

    // Birth cap: hollow, so the two ends of a life can be told apart at a glance.
    group.appendChild(node('circle', { cx: x1, cy: y, r: SPAN_CAP_R, class: 'tlc-span-cap' },
      { fill: 'var(--tl-bg)', stroke: lane.color, 'stroke-width': '1.6' }));
    if (line) {
      group.appendChild(node('circle', { cx: x2, cy: y, r: SPAN_CAP_R + 0.6, class: 'tlc-span-cap' },
        { fill: lane.color }));
    }

    // The name sits off the end of the line. Where it would run into the right
    // edge it flips to the birth end instead of being clipped, so the reader still
    // reads it beside the life it belongs to.
    if (state.showLabels) {
      const after = x2 + SPAN_CAP_R + 7 + textWidth(rec.name, SPAN_NAME_SIZE) <= state.chartW - 4;
      const label = node('text', {
        x: after ? x2 + SPAN_CAP_R + 7 : x1 - SPAN_CAP_R - 7,
        y: y + 3.4,
        'text-anchor': after ? 'start' : 'end',
        class: 'tlc-span-name',
      }, { fill: lane.color, 'font-size': `${SPAN_NAME_SIZE}px`, 'font-weight': '500' });
      label.textContent = rec.name;
      group.appendChild(label);
    }

    parent.appendChild(group);
  }

  // One group per category, the same shape applyLaneVisibility expects — so a
  // dimmed category fades here exactly as it does on the lanes, and clicking its
  // row in the sidebar brings it back here too.
  function renderSpans() {
    const g = dom.spans;
    g.innerHTML = '';
    Object.keys(laneNodes).forEach((id) => { delete laneNodes[id]; });

    const buckets = spanLanes().map((id) => ({ id, lane: laneOf(id), items: [] }));
    state.spans.forEach((item) => {
      const bucket = buckets.find((b) => b.id === item.rec.lane);
      if (bucket) bucket.items.push(item);
    });

    buckets.forEach((bucket) => {
      if (!bucket.items.length) return;
      const group = node('g', { 'data-lane': bucket.id });
      g.appendChild(group);
      laneNodes[bucket.id] = group;
      bucket.items.forEach((item) => drawSpan(group, bucket.lane, item));
    });
  }

  // The key counts what the archive holds per category, so a reader can tell a
  // sparse century from a crowded one without counting dots.
  function updateSpanKey() {
    if (!dom.spanKey) return;
    dom.spanKey.querySelectorAll('[data-cat]').forEach((cell) => {
      const id = cell.getAttribute('data-cat');
      const n = state.records.filter((rec) => rec.lane === id && rec.kind === 'figure').length;
      cell.textContent = String(n);
    });
  }

  // One flag, one re-plot. The dimmed categories, the window, the selection and
  // the open tab are all left exactly as they were, so a reader can flip between
  // the two readings of the same archive without losing their place.
  function setLifespan(on) {
    const next = !!on;
    if (next === state.lifespan) return;

    state.lifespan = next;
    dom.root.classList.toggle('lifespan', next);
    dom.lifespan.setAttribute('aria-pressed', String(next));
    hideTip();
    scheduleRender();
  }

  // ==================== RENDER: SELECTION ====================

  // The guide line, ring and callout under the canvas that mark the record the
  // detail card is showing.
  function renderSelection() {
    const g = dom.select;
    g.innerHTML = '';

    const rec = state.selectedId ? state.byId.get(state.selectedId) : null;
    if (!rec) return;

    const floor = state.chartH - SELECT_H;
    const x = clamp(xOf(trueStart(rec)), 14, state.chartW - 14);

    g.appendChild(node('line', { x1: x, x2: x, y1: AXIS_H, y2: floor },
      { stroke: 'var(--tl-accent)', 'stroke-width': '1', 'stroke-dasharray': '4 4', opacity: '0.75' }));

    g.appendChild(node('circle', { cx: x, cy: floor + 9, r: 5 },
      { fill: 'var(--tl-bg)', stroke: 'var(--tl-accent)', 'stroke-width': '2' }));
    g.appendChild(node('circle', { cx: x, cy: floor + 9, r: 1.6 },
      { fill: 'var(--tl-accent)' }));

    const text = `${spanText(rec)} · ${rec.name}`;
    const w = textWidth(text, 10) + 20;
    const left = clamp(x - w / 2, 4, Math.max(4, state.chartW - w - 4));
    const top = floor + 18;

    g.appendChild(node('rect', { x: left, y: top, width: w, height: 20, rx: 10 },
      { fill: 'var(--tl-bg-soft)', stroke: colorOf(rec), 'stroke-width': '1' }));

    const label = node('text', { x: left + w / 2, y: top + 13.6, 'text-anchor': 'middle' },
      { fill: 'var(--tl-fg)', 'font-size': '10px' });
    label.textContent = text;
    g.appendChild(label);
  }

  // ==================== DETAIL CARD ====================

  const META_JOIN = ' · ';

  // One row of a detail tab: a year rail, a title + meta line, and an arrow.
  function row({ recId, year, title, meta }) {
    return `
      <button class="tlc-row" type="button" data-rec="${esc(recId)}">
        <span class="tlc-row-year">${year == null ? '—' : esc(formatYear(year))}</span>
        <span class="tlc-row-body">
          <strong>${esc(title)}</strong>
          <span>${esc(meta || '')}</span>
        </span>
        <span class="tlc-row-arrow" aria-hidden="true">→</span>
      </button>`;
  }

  const eventRow = (e) => row({
    recId: 'event-' + e.id,
    year: e.year,
    title: e.name,
    meta: [e.category, e.source].filter(Boolean).join(META_JOIN),
  });

  const placeRow = (p) => row({
    recId: `place-${p.id}-0`,
    year: p.milestones?.[0]?.year,
    title: p.name,
    meta: [p.region, p.milestones?.[0]?.label].filter(Boolean).join(META_JOIN),
  });

  // A report opens in the Isnad Explorer rather than on this canvas, so its row
  // carries the hadith id instead of a record id.
  function hadithRow(h) {
    return `
      <button class="tlc-row" type="button" data-hadith="${esc(h.id)}">
        <span class="tlc-row-year">${esc(h.grade || '—')}</span>
        <span class="tlc-row-body">
          <strong>${esc(h.translation)}</strong>
          <span>${esc([h.book, h.reference].filter(Boolean).join(META_JOIN))}</span>
        </span>
        <span class="tlc-row-arrow" aria-hidden="true">→</span>
      </button>`;
  }

  const eventsBetween = (lo, hi) => state.events
    .filter((e) => e.year >= lo && e.year <= hi)
    .sort((a, b) => a.year - b.year);

  const placesBetween = (lo, hi) => state.places
    .filter((p) => (p.milestones || []).some((m) => m.year >= lo && m.year <= hi))
    .sort((a, b) => a.milestones[0].year - b.milestones[0].year);

  const reportsThrough = (id) => state.hadiths
    .filter((h) => (h.chain || []).some((link) => link.narratorId === id));

  const reportsOf = (collection) => state.hadiths
    .filter((h) => h.collection === collection);

  // What a list says when the archive holds nothing for that side of the card.
  // Each tab carries its own line, so the card never has to guess why it is bare.
  const EMPTY_TEXT = {
    events: 'No related events recorded.',
    hadiths: 'No hadith records available.',
    places: 'No related places recorded.',
    milestones: 'No milestones recorded for this place.',
  };

  // Two tabs per record family, each a list that links back into the app.
  function tabDefs(rec) {
    const d = rec.data || {};
    const year = trueStart(rec);
    const lo = sortLo(rec);
    const hi = sortHi(rec);

    switch (rec.kind) {
      case 'figure':
        return [
          { label: 'Key Events', empty: EMPTY_TEXT.events,
            rows: eventsBetween(lo, hi).map(eventRow) },
          { label: 'Famous Hadith', empty: EMPTY_TEXT.hadiths,
            rows: reportsThrough(rec.id).map(hadithRow) },
        ];
      case 'book':
        return [
          { label: 'Key Events', empty: EMPTY_TEXT.events,
            rows: eventsBetween(year - 40, year + 40).map(eventRow) },
          { label: 'Reports', empty: EMPTY_TEXT.hadiths, rows: reportsOf(d.name).map(hadithRow) },
        ];
      case 'event':
        return [
          { label: 'Nearby Events', empty: EMPTY_TEXT.events,
            rows: eventsBetween(year - 30, year + 30).filter((e) => e.id !== d.id).map(eventRow) },
          { label: 'Places', empty: EMPTY_TEXT.places,
            rows: placesBetween(year - 60, year + 60).map(placeRow) },
        ];
      case 'place': {
        const years = (d.milestones || []).map((m) => m.year);
        return [
          { label: 'Milestones', empty: EMPTY_TEXT.milestones,
            rows: (d.milestones || []).map((m, i) =>
              row({ recId: `place-${d.id}-${i}`, year: m.year, title: m.label || d.name, meta: d.name })) },
          { label: 'Nearby Events', empty: EMPTY_TEXT.events,
            rows: eventsBetween(Math.min(...years) - 30, Math.max(...years) + 30).map(eventRow) },
        ];
      }
      case 'dynasty':
        return [
          { label: 'Key Events', empty: EMPTY_TEXT.events, rows: eventsBetween(lo, hi).map(eventRow) },
          { label: 'Places', empty: EMPTY_TEXT.places, rows: placesBetween(lo, hi).map(placeRow) },
        ];
      default:
        return [];
    }
  }

  // Chips under the name. Each kind draws them from what the archive records.
  function detailTags(rec) {
    const d = rec.data || {};

    if (rec.kind === 'figure') {
      const tags = [];
      if (d.generation) tags.push(GEN_LABELS[d.generation] || d.generation);
      if (d.role) tags.push(d.role);
      (d.locations || []).slice(0, 2).forEach((loc) => tags.push(loc));
      return tags.slice(0, 4);
    }
    if (rec.kind === 'book') {
      const c = d.compilerId ? DataLoader.getNarrator(d.compilerId) : null;
      return ['Collection', c ? `Compiled by ${c.name}` : 'Compiler unknown'];
    }
    if (rec.kind === 'event') return [rec.role, d.category, d.type].filter(Boolean).slice(0, 3);
    if (rec.kind === 'place') return [d.region, d.milestone?.label].filter(Boolean).slice(0, 2);
    if (rec.kind === 'dynasty') {
      return [d.region, d.capital ? `Capital: ${d.capital}` : '', formatRange(d.start, d.end)]
        .filter(Boolean).slice(0, 3);
    }
    return [];
  }

  // A sentence for the card, built only from fields this record actually has.
  function detailText(rec) {
    const d = rec.data || {};
    const era = eraFor(trueStart(rec));

    switch (rec.kind) {
      case 'figure':
        return d.bio || `${rec.name} is recorded in the archive as ${rec.role || 'a transmitter'}.`;
      case 'book': {
        const c = d.compilerId ? DataLoader.getNarrator(d.compilerId) : null;
        return `${d.name} was completed around ${formatYear(d.year)}` +
               `${c ? ` by ${c.name}` : ''}${era ? `, in the ${era.label} era` : ''}.`;
      }
      case 'event':
        return `${rec.name} is recorded for ${formatYear(trueStart(rec))}` +
               `${d.source ? `, from ${d.source}` : ''}${era ? ` — the ${era.label} era` : ''}.`;
      case 'place': {
        const ms = d.milestones || [];
        const first = ms[0]?.year ?? trueStart(rec);
        const last = ms[ms.length - 1]?.year ?? trueEnd(rec);
        return `${d.name}${d.region ? ` (${d.region})` : ''} carries ${ms.length} milestones in the ` +
               `archive, from ${formatYear(first)} to ${formatYear(last)}.`;
      }
      case 'dynasty':
        return `${d.name} ruled ${formatRange(d.start, d.end)} from ${d.capital || 'its capital'}` +
               `${d.region ? `, across ${d.region}` : ''}.`;
      default:
        return '';
    }
  }

  const detailRoute = (rec) => DETAIL_ROUTES[rec.kind] || DETAIL_ROUTES.event;

  // The card under the canvas: who or what is selected, and what the archive
  // holds around it. It is one fixed-height panel — hero on the left, lists on the
  // right — because a card that grew and shrank with every record moved the page
  // under the reader's pointer. Each half fills the panel and scrolls inside
  // itself, and the tab strip stays put above its list.
  function detailHtml(rec) {
    const d = rec.data || {};
    const tabs = tabDefs(rec);
    const index = clamp(state.tab, 0, Math.max(0, tabs.length - 1));
    const active = tabs[index];
    const rows = active ? active.rows : [];

    return `
      <div class="tlc-detail-hero">
        <div class="tlc-detail-media">
          ${d.portrait
            ? `<img class="tlc-detail-photo" src="${esc(d.portrait)}" alt="" />`
            : `<span class="tlc-detail-mark">${esc(initials(rec))}</span>
               ${rec.arabic ? `<span class="tlc-detail-arabic" lang="ar" dir="rtl">${esc(rec.arabic)}</span>` : ''}`}
        </div>

        <div class="tlc-detail-body">
          <div class="tlc-detail-eyebrow">${esc(laneOf(rec.lane).label)}</div>
          <h3 class="tlc-detail-name">${esc(rec.name)}</h3>
          <div class="tlc-detail-dates">${esc(spanText(rec))}</div>
          <div class="tlc-detail-tags">
            ${detailTags(rec).map((t) => `<span class="tlc-tag">${esc(t)}</span>`).join('')}
          </div>
          <p class="tlc-detail-bio">${esc(detailText(rec))}</p>
          <button class="tlc-detail-cta" type="button" id="tlcDetailCta">
            <span>${esc(detailRoute(rec).label)}</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div class="tlc-detail-side">
        <div class="tlc-tabs" role="tablist">
          ${tabs.map((t, i) => `
            <button class="tlc-tab${i === index ? ' active' : ''}" type="button" role="tab"
                    aria-selected="${i === index}" data-tab="${i}">
              ${esc(t.label)}<span class="tlc-tab-count">${t.rows.length}</span>
            </button>`).join('')}
        </div>
        <div class="tlc-tab-panel" role="tabpanel">
          ${rows.length
            ? rows.join('')
            : `<div class="tlc-empty">${esc(active?.empty || 'Nothing is recorded here yet.')}</div>`}
        </div>
        ${rows.length ? `
          <div class="tlc-rows-note">
            <span>${rows.length} recorded</span>
            ${rows.length > VISIBLE_ROWS ? '<span>scroll for more</span>' : ''}
          </div>` : ''}
      </div>
    `;
  }

  function renderDetail() {
    const rec = state.selectedId ? state.byId.get(state.selectedId) : null;

    if (!rec) {
      dom.detail.hidden = true;
      dom.detail.innerHTML = '';
      return;
    }

    dom.detail.hidden = false;
    dom.detail.style.setProperty('--rec-color', colorOf(rec));
    dom.detail.innerHTML = detailHtml(rec);
  }

  // Selecting a record highlights it on the canvas and opens its card. When the
  // marker is outside the window, the window slides over to it.
  function selectRecord(id, { reveal = true } = {}) {
    const rec = id ? state.byId.get(id) : null;
    if (id && !rec) return;

    state.selectedId = rec ? rec.id : null;
    state.tab = 0;
    hideTip();

    if (rec && reveal) {
      // Opening a record of a dimmed category brings that category back: the
      // reader asked to see it, so it must not stay faded out on the canvas.
      if (!isOn(rec.lane)) restoreLane(rec.lane);
      revealRecord(rec);
    }

    renderDetail();
    scheduleRender();
  }

  // ==================== HEADER CONTROLS ====================

  // A category is drawn in three places at once: its row in the sidebar, its row
  // in the frozen label column and its own group on the canvas. One flag per lane
  // drives all three, and dimming touches opacity only — nothing is removed and
  // nothing is re-ordered, so the timeline never rearranges under the reader.
  // The canvas group fades right out (DIM_OPACITY); the two sidebar controls only
  // half-fade their own label and dots (DIM_OPACITY_SIDEBAR) and keep everything
  // else, so a dimmed row is still a row the reader can read and click.
  function applyLaneVisibility() {
    LANE_ORDER.forEach((id) => {
      const dim = !isOn(id);

      const group = laneNodes[id];
      if (group) {
        group.setAttribute('opacity', dim ? String(DIM_OPACITY) : '1');
        group.classList.toggle('dimmed', dim);
      }

      const label = labelNodes[id];
      if (label) {
        label.classList.toggle('dimmed', dim);
        setSidebarDim(label, dim);
        if (label.tagName === 'BUTTON') label.setAttribute('aria-pressed', String(!dim));
      }
    });

    dom.menu.querySelectorAll('[data-lane]').forEach((row) => {
      const dim = !isOn(row.getAttribute('data-lane'));
      row.classList.toggle('dimmed', dim);
      setSidebarDim(row, dim);
      row.setAttribute('aria-pressed', String(!dim));
    });
  }

  // How far a sidebar control's own label and colour indicators are dimmed. The
  // row publishes it as --tl-dim and css/timeline.css spends it on the name and
  // the dots alone: the row itself, its background, its hover, its focus ring and
  // its hit area all stay at full strength, so what is dimmed is what is clickable.
  function setSidebarDim(row, dim) {
    row.style.setProperty('--tl-dim', dim ? String(DIM_OPACITY_SIDEBAR) : '1');
  }

  // Short click feedback, the same tick the period bar gives: a flash of the
  // lane's own colour and a pulse of its dot. Removed once it has played.
  function pressRow(row) {
    row.classList.remove('press');
    void row.offsetWidth;                // restart the animation
    row.classList.add('press');
    setTimeout(() => row.classList.remove('press'), PRESS_MS);
  }

  // Every dim or restore goes through here, so the sidebar, the label column and
  // the canvas can never disagree.
  function lanesChanged() {
    applyLaneVisibility();
    updateMenuLabel();
    hideTip();
  }

  // ALL and NONE sweep every category the reader is allowed to dim. The lanes in
  // ALWAYS_VISIBLE are not in TOGGLEABLE, so neither button can reach them.
  function setAllLanes(on) {
    TOGGLEABLE.forEach((id) => { state.lanesOn[id] = on; });
    lanesChanged();
  }

  function toggleLane(id) {
    if (!isToggleable(id)) return;
    state.lanesOn = { ...state.lanesOn, [id]: !isOn(id) };
    lanesChanged();
  }

  // Bring a dimmed category back to full strength without touching the others.
  function restoreLane(id) {
    if (!id || isOn(id)) return;
    state.lanesOn = { ...state.lanesOn, [id]: true };
    lanesChanged();
  }

  function updateMenuLabel() {
    const dimmed = LANE_ORDER.filter((id) => !isOn(id));
    if (!dimmed.length) dom.menuLabel.textContent = 'All Categories';
    else if (dimmed.length === 1) dom.menuLabel.textContent = `${LANES[dimmed[0]].label} dimmed`;
    else dom.menuLabel.textContent = `${dimmed.length} of ${TOGGLEABLE.length} categories dimmed`;
  }

  // The category sidebar behind the "Categories" button. Every toggleable lane is
  // one click-to-dim row, and ALL / NONE act on all of them at once. The lanes in
  // ALWAYS_VISIBLE are deliberately absent: the prophetic life is the axis the
  // rest of the archive is read against, so there is nothing there to dim.
  function buildMenu() {
    dom.menu.setAttribute('aria-label', 'Categories');
    dom.menu.innerHTML = `
      <div class="tlc-menu-actions">
        <button class="tlc-menu-all" type="button" data-all="1"
                title="Show every category">All</button>
        <button class="tlc-menu-all" type="button" data-none="1"
                title="Dim every category">None</button>
      </div>
      <div class="tlc-menu-sep"></div>
      ${TOGGLEABLE.map((id) => `
        <button class="tlc-menu-row" type="button" data-lane="${id}"
                aria-pressed="true" style="--lane:${LANES[id].color}"
                title="Show or dim ${esc(LANES[id].label)}">
          <span class="tlc-menu-dot" aria-hidden="true"></span>
          <span class="tlc-menu-name">${esc(LANES[id].label)}</span>
          <span class="tlc-menu-state" aria-hidden="true"></span>
        </button>`).join('')}
    `;
    applyLaneVisibility();
  }

  function setMenuOpen(open) {
    dom.menu.hidden = !open;
    dom.cats.setAttribute('aria-expanded', String(!!open));
  }

  // ---- range slider: both ends of the window, always in sync with the canvas ----
  function syncRange() {
    if (!dom.rangeMin) return;

    // The window carries fractions while a reader zooms; the handles are
    // year-stepped, so they only ever see whole years.
    dom.rangeMin.value = String(Math.round(state.viewMin));
    dom.rangeMax.value = String(Math.round(state.viewMax));

    const toPct = (year) => ((year - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * 100;
    const lo = toPct(state.viewMin);
    const hi = toPct(state.viewMax);
    dom.rangeFill.style.left = `${lo}%`;
    dom.rangeFill.style.width = `${Math.max(0.4, hi - lo)}%`;
    dom.windowLabel.textContent = formatRange(state.viewMin, state.viewMax);

    // The handle that is boxed in has to sit on top for the pointer to reach it.
    const rightHalf = state.viewMin > (MIN_YEAR + MAX_YEAR) / 2;
    dom.rangeMin.style.zIndex = rightHalf ? '4' : '3';
    dom.rangeMax.style.zIndex = rightHalf ? '3' : '4';
  }

  // ==================== RENDER ====================

  function scheduleRender() {
    if (frame || !dom.root?.isConnected) return;
    frame = requestAnimationFrame(() => { frame = 0; render(); });
  }

  function render() {
    if (!dom.track) return;
    state.chartW = Math.max(240, dom.track.clientWidth);

    // The lanes are laid out in both views. In the Lifespan View nothing is drawn
    // from them, but the sidebar rows and the label column still measure the same,
    // so the categories keep their place while their figures are repacked.
    layout();
    if (state.lifespan) layoutSpans();
    else state.spans = [];

    renderLaneLabels();
    renderAxis();
    renderGrid();
    // Only one of the two canvas layers is ever drawn: the one standing down is
    // emptied rather than hidden, so no stale lanes are left behind the lifespans
    // (or the other way round) at the wrong row heights.
    if (state.lifespan) {
      dom.lanes.innerHTML = '';
      renderSpans();
    } else {
      dom.spans.innerHTML = '';
      renderLanes();
    }
    applyLaneVisibility();        // a dimmed category stays dimmed across a re-plot
    renderSelection();

    dom.svg.setAttribute('width', state.chartW);
    dom.svg.setAttribute('height', state.chartH);
    dom.axisSvg.setAttribute('width', state.chartW);
    dom.axisSvg.setAttribute('height', AXIS_H);
    dom.track.classList.toggle('pannable', spanYears() < MAX_YEAR - MIN_YEAR);

    syncRange();
    syncRibbon();
    updateMenuLabel();
    updateSpanKey();
  }

  // ==================== WIRING ====================

  function bind() {
    // Hover tooltip — delegated, because the canvas is re-plotted on every zoom.
    dom.track.addEventListener('mousemove', (e) => {
      if (drag.active) hideTip();
      else onHover(e);
    });
    dom.track.addEventListener('mouseleave', hideTip);

    // Drag to pan: the window slides under the pointer and keeps its span.
    dom.track.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      cancelGlide();                                 // the reader took the wheel
      drag.active = true;
      drag.moved = false;
      drag.startX = e.clientX;
      drag.startMin = state.viewMin;
      drag.startMax = state.viewMax;
      dom.track.classList.add('dragging');
      hideTip();
    });

    // Pointer handlers live on the window so a drag that leaves the canvas keeps
    // working. They are registered once, on the first render.
    if (!boundOnce) {
      boundOnce = true;

      window.addEventListener('mousemove', (e) => {
        if (!drag.active) return;
        const dx = e.clientX - drag.startX;
        if (Math.abs(dx) > 3) drag.moved = true;
        if (!drag.moved) return;
        const years = -(dx / avail()) * (drag.startMax - drag.startMin);
        setWindow(drag.startMin + years, drag.startMax + years);
      });

      window.addEventListener('mouseup', (e) => {
        if (!drag.active) return;
        drag.active = false;
        dom.track.classList.remove('dragging');
        if (!drag.moved) onCanvasClick(e);
      });

      document.addEventListener('click', () => setMenuOpen(false));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenuOpen(false); });
    }

    // ---- the scroll wheel zooms around the pointer -------------------------
    // The listener sits on the chart, so the wheel is the canvas's own while it
    // is over the timeline and the page scrolls normally everywhere else. Up
    // (a negative delta) zooms in, down zooms out; the year under the cursor is
    // the year that stays under it.
    dom.chart.addEventListener('wheel', (e) => {
      const up = deltaPixels(e, e.deltaY);           // vertical intent → zoom
      const across = deltaPixels(e, e.deltaX);       // horizontal intent → shift-pan

      // Shift + wheel keeps the sideways pan readers already know. Some
      // browsers hand a shift-wheel's movement to deltaX instead of deltaY.
      if (e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const pan = across || up;
        if (!pan) return;
        e.preventDefault();
        panPixels(-pan);
        return;
      }

      // The Lifespan View is taller than the screen, so the wheel belongs to the
      // page there: a scroll trap is worse than a missing zoom. Zoom stays on
      // ⌘/Ctrl + wheel, on +/- and on a double-click, which is what the hint under
      // the canvas says.
      if (state.lifespan && !e.ctrlKey && !e.metaKey) return;

      if (!up) return;                               // a side swipe leaves the page alone
      e.preventDefault();                            // …and the page must not scroll as well

      // Exponential in the delta, so one notch of a mouse and a fraction of a
      // trackpad glide move the axis by the same amount. Capped, so a flick of
      // a free-spinning wheel cannot throw the canvas across the centuries.
      const notches = clamp(up / WHEEL_NOTCH, -WHEEL_MAX_NOTCHES, WHEEL_MAX_NOTCHES);
      const inside = e.clientX - dom.track.getBoundingClientRect().left;
      // Over the lane labels there is no cursor year to hold, so the zoom takes
      // the middle of the canvas instead of the edge the labels sit against.
      const focus = inside >= 0 && inside <= dom.track.clientWidth ? inside : undefined;
      zoomAt(Math.pow(WHEEL_ZOOM, -notches), focus);
    }, { passive: false });

    // Safari reports a trackpad pinch as gesture events rather than as a wheel,
    // so the pinch zooms this canvas instead of growing the whole page.
    if ('ongesturechange' in window) {
      let pinchFrom = 1;
      dom.chart.addEventListener('gesturestart', (e) => {
        e.preventDefault();
        pinchFrom = e.scale || 1;
      });
      dom.chart.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        const scale = e.scale || 1;
        zoomAt(scale / pinchFrom, e.clientX - dom.track.getBoundingClientRect().left);
        pinchFrom = scale;
      });
      dom.chart.addEventListener('gestureend', () => { pinchFrom = 1; });
    }

    // Double-click zooms in on the year under the pointer.
    dom.track.addEventListener('dblclick', (e) => {
      zoomAt(1.9, e.clientX - dom.track.getBoundingClientRect().left);
    });

    // The canvas is focusable, so the whole view is reachable by keyboard.
    dom.track.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); panPixels(avail() * 0.15); break;
        case 'ArrowRight': e.preventDefault(); panPixels(-avail() * 0.15); break;
        case '+': case '=': e.preventDefault(); zoomAt(WHEEL_ZOOM * 1.2); break;
        case '-': case '_': e.preventDefault(); zoomAt(1 / (WHEEL_ZOOM * 1.2)); break;
        case 'Home':       e.preventDefault(); resetWindow(); break;
        case 'Escape':     selectRecord(null); break;
        default: break;
      }
    });

    // Range slider — one handle per end of the window.
    dom.rangeMin.addEventListener('input', () => {
      cancelGlide();
      setWindow(Math.min(Number(dom.rangeMin.value), state.viewMax - MIN_SPAN), state.viewMax);
    });
    dom.rangeMax.addEventListener('input', () => {
      cancelGlide();
      setWindow(state.viewMin, Math.max(Number(dom.rangeMax.value), state.viewMin + MIN_SPAN));
    });

    dom.unit.addEventListener('change', () => {
      state.unit = dom.unit.value;
      scheduleRender();
    });
    dom.fit.addEventListener('click', resetWindow);

    dom.labelsToggle.addEventListener('change', () => {
      state.showLabels = dom.labelsToggle.checked;
      scheduleRender();
    });

    // The Lifespan switch: the same canvas, read as one line per figure.
    dom.lifespan.addEventListener('click', () => setLifespan(!state.lifespan));

    // The period bar: clicking anywhere inside a segment lights it up straight
    // away and glides the canvas to those years.
    dom.ribbon.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-era]');
      if (!chip) return;

      const era = eraById(chip.getAttribute('data-era'));
      if (!era) return;

      pulseEra(chip);
      setActiveEra(era.id);          // instant feedback — the glide follows
      glideTo(era.start, era.end);
    });

    // Detail card: rows select a record or open a report, tabs switch the list.
    dom.detail.addEventListener('click', (e) => {
      const rowEl = e.target.closest('[data-rec]');
      if (rowEl) { selectRecord(rowEl.getAttribute('data-rec')); return; }

      const hadithEl = e.target.closest('[data-hadith]');
      if (hadithEl) { location.hash = `#isnad?hadith=${hadithEl.getAttribute('data-hadith')}`; return; }

      const tabEl = e.target.closest('[data-tab]');
      if (tabEl) {
        state.tab = Number(tabEl.getAttribute('data-tab')) || 0;
        renderDetail();
        return;
      }

      if (e.target.closest('#tlcDetailCta')) {
        const rec = state.byId.get(state.selectedId);
        if (rec) location.hash = detailRoute(rec).hash(rec);
      }
    });

    // Category sidebar: each row dims and restores one category, ALL and NONE
    // sweep the lot. None of it re-plots the canvas, so the timeline stays put.
    dom.cats.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenuOpen(dom.menu.hidden);
    });
    dom.menu.addEventListener('click', (e) => {
      e.stopPropagation();

      const all = e.target.closest('[data-all]');
      if (all) { pressRow(all); setAllLanes(true); return; }

      const none = e.target.closest('[data-none]');
      if (none) { pressRow(none); setAllLanes(false); return; }

      const row = e.target.closest('[data-lane]');
      if (!row) return;
      pressRow(row);
      toggleLane(row.getAttribute('data-lane'));
    });

    // The frozen label column is the canvas's own category sidebar: clicking a
    // lane's label dims it in place and clicking it again brings it back, with
    // the lane and its records never leaving the canvas. The always-visible lanes
    // are drawn as plain rows, so there is nothing there to click.
    dom.labels.addEventListener('click', (e) => {
      const row = e.target.closest('button[data-lane]');
      if (!row) return;
      pressRow(row);
      toggleLane(row.getAttribute('data-lane'));
    });

    // Re-plot when the canvas column changes width (window resize, sidebar…).
    if (resizeObs) resizeObs.disconnect();
    if (window.ResizeObserver) {
      resizeObs = new ResizeObserver(() => {
        if (Math.abs(dom.track.clientWidth - state.chartW) > 1) scheduleRender();
      });
      resizeObs.observe(dom.track);
    } else {
      window.addEventListener('resize', scheduleRender);
    }
  }

  // A click that never turned into a drag is either a record or empty canvas. The
  // card is the page's anchor — the Prophet ﷺ opens it and the reader's own pick
  // replaces him — so an empty click leaves the selection alone. Escape is what
  // takes it away.
  function onCanvasClick(e) {
    if (e.target.closest && (e.target.closest('#tlcSelect') || e.target.closest('.tlc-tip'))) return;
    const hit = e.target.closest ? e.target.closest('[data-rec]') : null;
    if (!hit) return;
    selectRecord(hit.getAttribute('data-rec'));
  }

  // ==================== TEMPLATE ====================

  function template() {
    return `
      <div class="timeline-page">
        <section class="tlc" id="tlc"
                 style="--tl-axis-h:${AXIS_H}px;--tl-select-h:${SELECT_H}px;--tl-side-pad:${SIDE_PAD}px">
          <header class="tlc-head">
            <div>
              <h2 class="tlc-title">Timeline View</h2>
              <p class="tlc-sub">Explore the chronological flow of people, events, and hadith
                transmissions from Jahiliyyah to later generations.</p>
            </div>

            <div class="tlc-controls">
              <div class="tlc-select-wrap">
                <button class="tlc-btn" id="tlcCats" type="button"
                        aria-haspopup="true" aria-expanded="false">
                  <span id="tlcCatsLabel">All Categories</span>
                  <span class="tlc-caret" aria-hidden="true">▾</span>
                </button>
                <div class="tlc-menu" id="tlcCatsMenu" hidden></div>
              </div>

              <div class="tlc-window">
                <span class="tlc-window-label" id="tlcWindowLabel"></span>
                <div class="tlc-range">
                  <span class="tlc-range-track"></span>
                  <span class="tlc-range-fill" id="tlcRangeFill"></span>
                  <input type="range" id="tlcRangeMin" min="${MIN_YEAR}" max="${MAX_YEAR}"
                         step="5" value="${Math.round(state.viewMin)}" aria-label="First year in view" />
                  <input type="range" id="tlcRangeMax" min="${MIN_YEAR}" max="${MAX_YEAR}"
                         step="5" value="${Math.round(state.viewMax)}" aria-label="Last year in view" />
                </div>
              </div>

              <label class="tlc-select">
                <select id="tlcUnit" aria-label="Grid unit">
                  <option value="century">Century</option>
                  <option value="half-century">Half-century</option>
                  <option value="decade">Decade</option>
                  <option value="auto">Auto</option>
                </select>
                <span class="tlc-caret" aria-hidden="true">▾</span>
              </label>

              <button class="tlc-btn" id="tlcFit" type="button">Fit</button>
            </div>
          </header>

          <div class="tlc-ribbon" aria-label="Historical eras">
            <div class="tlc-ribbon-inner" id="tlcRibbon"></div>
          </div>

          <div class="tlc-chart" id="tlcChart">
            <div class="tlc-labels" id="tlcLabels"></div>
            <div class="tlc-track" id="tlcTrack" tabindex="0" role="group"
                 aria-label="Chronological canvas: scroll or pinch to zoom around the pointer, drag to pan, and select a marker to read its record.">
              <!-- The ruler is its own svg, so the Lifespan View can pin it while
                   its rows travel underneath. -->
              <div class="tlc-axis-band" id="tlcAxisBand" aria-hidden="true">
                <svg class="tlc-axis-svg" id="tlcAxisSvg"></svg>
              </div>
              <svg class="tlc-svg" id="tlcSvg" role="img"
                   aria-label="Chronological timeline of figures, events, books, places and dynasties">
                <g id="tlcGrid"></g>
                <g id="tlcLanes"></g>
                <g id="tlcSpans"></g>
                <g id="tlcSelect"></g>
              </svg>
              <div class="tlc-tip" id="tlcTip" role="tooltip"></div>
            </div>
          </div>

          <footer class="tlc-legend">
            <div class="tlc-legend-items tlc-legend-items--lanes">
              ${LEGEND.map((item) => `
                <span class="tlc-legend-item">
                  <span class="tlc-legend-dot" style="--lane:${item.color}"></span>${esc(item.label)}
                </span>`).join('')}
            </div>

            <!-- The Lifespan View is read by generation, so it carries its own key. -->
            <div class="tlc-legend-items tlc-legend-items--spans" id="tlcSpanKey">
              ${SPAN_KEY.map((cat) => `
                <span class="tlc-legend-item">
                  <span class="tlc-legend-dot" style="--lane:${LANES[cat.id].color}"></span>${esc(cat.label)}
                  <span class="tlc-legend-count" data-cat="${cat.id}"></span>
                </span>`).join('')}
            </div>

            <label class="tlc-switch">
              <span>Show labels</span>
              <input type="checkbox" id="tlcLabelsToggle" checked />
              <span class="tlc-switch-track"><span class="tlc-switch-knob"></span></span>
            </label>

            <button class="tlc-lifespan" id="tlcLifespan" type="button" aria-pressed="false"
                    title="Lifespan View — one line per figure, birth to death">
              <span class="tlc-lifespan-dot" aria-hidden="true"></span>
              <span>Lifespan</span>
            </button>

            <span class="tlc-hint tlc-hint--lanes">Drag to pan · Scroll to zoom · Click a marker for its record</span>
            <span class="tlc-hint tlc-hint--spans">Scroll for the rows · ⌘/Ctrl + scroll to zoom · Drag to pan · Click a life for its record</span>
            <span class="tlc-tagline">Knowledge connects generations</span>
          </footer>
        </section>

        <section class="tlc-detail" id="tlcDetail" aria-live="polite" hidden></section>
      </div>
    `;
  }

  function cacheDom(host) {
    dom.root = host.querySelector('#tlc');
    dom.labels = host.querySelector('#tlcLabels');
    dom.chart = host.querySelector('#tlcChart');
    dom.track = host.querySelector('#tlcTrack');
    dom.svg = host.querySelector('#tlcSvg');
    dom.grid = host.querySelector('#tlcGrid');
    dom.lanes = host.querySelector('#tlcLanes');
    dom.select = host.querySelector('#tlcSelect');
    dom.tip = host.querySelector('#tlcTip');
    dom.axisBand = host.querySelector('#tlcAxisBand');
    dom.axisSvg = host.querySelector('#tlcAxisSvg');
    dom.spans = host.querySelector('#tlcSpans');
    dom.ribbon = host.querySelector('#tlcRibbon');
    dom.detail = host.querySelector('#tlcDetail');
    dom.menu = host.querySelector('#tlcCatsMenu');
    dom.cats = host.querySelector('#tlcCats');
    dom.menuLabel = host.querySelector('#tlcCatsLabel');
    dom.rangeMin = host.querySelector('#tlcRangeMin');
    dom.rangeMax = host.querySelector('#tlcRangeMax');
    dom.rangeFill = host.querySelector('#tlcRangeFill');
    dom.windowLabel = host.querySelector('#tlcWindowLabel');
    dom.unit = host.querySelector('#tlcUnit');
    dom.fit = host.querySelector('#tlcFit');
    dom.labelsToggle = host.querySelector('#tlcLabelsToggle');
    dom.lifespan = host.querySelector('#tlcLifespan');
    dom.spanKey = host.querySelector('#tlcSpanKey');
    dom.unit.value = state.unit;
    dom.labelsToggle.checked = state.showLabels;

    // The card is re-built from scratch on every render, so the switch is set
    // from the state rather than assumed to be off.
    dom.root.classList.toggle('lifespan', state.lifespan);
    dom.lifespan.setAttribute('aria-pressed', String(state.lifespan));
  }

  // Deep links keep the page shareable:
  //   #timeline?lane=books&id=prophet&tab=1&from=500&to=1000
  // Every render starts from a clean slate, so a filter, a window or an open
  // tab never leaks in from the page before.
  function applyParams(params) {
    const get = (key) => (params && params.get ? params.get(key) : null);

    // ?lane=<id> spotlights one category: every other category opens dimmed, so
    // the lane the link points at is the only one at full strength. The lanes
    // that are always visible are not dimmed by it either.
    const asked = get('lane');
    const only = asked && LANES[asked] ? asked : null;
    LANE_ORDER.forEach((id) => { state.lanesOn[id] = !only || id === only; });

    state.selectedId = get('id') || null;
    state.tab = Math.max(0, parseInt(get('tab'), 10) || 0);

    const from = parseFloat(get('from'));
    const to = parseFloat(get('to'));
    const view = Number.isFinite(from) && Number.isFinite(to) && to > from
      ? { start: from, end: to }
      : DEFAULT_WINDOW;
    setWindow(view.start, view.end, { silent: true });
  }

  // ==================== PUBLIC API ====================

  async function render_page(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;
    state.events = ChronoData.allEvents();
    state.places = ChronoData.allPlaces();
    state.dynasties = ChronoData.allDynasties();
    state.records = TimelineData.buildRecords(DataLoader.listNarrators(), state.events, state.dynasties, state.places);
    state.byId = new Map(state.records.map((rec) => [rec.id, rec]));
    state.hadiths = DataLoader.listHadiths();

    applyParams(params);

    host.innerHTML = template();
    cacheDom(host);
    buildMenu();
    buildRibbon();
    bind();

    // The archive opens on the Prophet ﷺ — the life every other record is read
    // against, dated 570 – 632 CE — so his record is selected before the first
    // render: the card below is full from the start and the canvas marks his life.
    if (!state.selectedId || !state.byId.has(state.selectedId)) state.selectedId = 'prophet';

    syncRange();
    renderDetail();
    render();
  }

  function destroy() {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(glide);
    frame = glide = 0;
    resizeObs?.disconnect();
    resizeObs = null;
    window.removeEventListener('resize', scheduleRender);
    drag.active = false;
  }
  return { render: render_page, destroy };
})();
