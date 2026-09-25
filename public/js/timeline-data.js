/* Timeline data — declares the axis domain, the category lanes and the era
   ribbon, then turns narrators, events, dynasties and places into the flat
   record list the timeline canvas plots.

   Every record is:
     { id, kind, lane, name, arabic, startYear, endYear, role, tier, data }

   kind  entity family — event | figure | book | place | dynasty
   lane  the lane row it is plotted in (see LANES)
   tier  featured | medium | small. "small" records are drawn as bare markers;
         the other two also carry a name + year label.
*/

const TimelineData = (() => {
  // ---- Axis domain -------------------------------------------------------
  // Years before the common era are negative, so the canvas runs from 500 BCE
  // to 1500 CE — wider than the six periods of the bar above it, which begin
  // with Pre-Islamic (500 CE). The canvas opens on the archive's own records
  // and the range slider can be dragged out to either end of this domain.
  const MIN_YEAR = -500;
  const MAX_YEAR = 1500;

  // The window the canvas opens on (and what "Fit" returns to): the century the
  // archive's own records start in through the century its transmitters end in.
  // The slider can be dragged out to the full domain above, which is the only
  // way to reach the pre-Islamic centuries before 500 CE.
  const DEFAULT_WINDOW = { start: 500, end: 1000 };

  // ---- Lanes -------------------------------------------------------------
  // Render order, top → bottom. Colors are CSS custom properties owned by
  // css/timeline.css, so one markup tree serves every skin. The weight is the
  // lane's share of the canvas height — the events lane carries the most
  // labels, so it gets the most room.
  const LANES = {
    prophets:   { label: 'Prophets & Key Figures', color: 'var(--tl-figures)',    weight: 0.85 },
    companions: { label: 'Companions (Sahaba)',    color: 'var(--tl-companions)', weight: 1.00 },
    tabiun:     { label: "Tabi'un",                color: 'var(--tl-tabiun)',     weight: 1.00 },
    scholars:   { label: 'Scholars',               color: 'var(--tl-scholars)',   weight: 1.10 },
    books:      { label: 'Hadith Books',           color: 'var(--tl-books)',      weight: 1.00 },
    events:     { label: 'Major Events',           color: 'var(--tl-events)',     weight: 1.60 },
    places:     { label: 'Places',                 color: 'var(--tl-places)',     weight: 1.00 },
    dynasties:  { label: 'Dynasties',              color: 'var(--tl-dynasties)',  weight: 0.90 },
  };

  const LANE_ORDER = Object.keys(LANES);

  // Lanes the reader can never hide. The prophetic life is the axis the whole
  // archive is read against, so it is not listed in the category sidebar at all:
  // there is no row to dim it with, and ALL / NONE skip it.
  const ALWAYS_VISIBLE = ['prophets'];

  // ---- Eras --------------------------------------------------------------
  // The historical period bar across the top of the canvas. Each entry is one
  // clickable segment: a coloured dot, the period name and its date range, and
  // clicking it navigates the canvas to those years. `openEnd` marks a period
  // that runs on past the last year the canvas covers.
  const ERAS = [
    { id: 'pre-islamic', label: 'Pre-Islamic',   start: 500,  end: 570,  color: 'var(--tl-era-1)' },
    { id: 'prophetic',   label: "Prophet's Life", start: 570,  end: 632,  color: 'var(--tl-era-2)' },
    { id: 'rashidun',    label: 'Rashidun',      start: 632,  end: 661,  color: 'var(--tl-era-3)' },
    { id: 'umayyad',     label: 'Umayyad',       start: 661,  end: 750,  color: 'var(--tl-era-4)' },
    { id: 'abbasid',     label: 'Abbasid',       start: 750,  end: 1000, color: 'var(--tl-era-5)' },
    { id: 'later',       label: 'Later',         start: 1000, end: 1500, color: 'var(--tl-era-6)', openEnd: true },
  ];

  // The legend documents entity families, not lanes.
  const LEGEND = [
    { label: 'Major Event', color: 'var(--tl-events)'    },
    { label: 'Figure',      color: 'var(--tl-figures)'   },
    { label: 'Hadith/Book', color: 'var(--tl-books)'     },
    { label: 'Place',       color: 'var(--tl-places)'    },
    { label: 'Dynasty',     color: 'var(--tl-dynasties)' },
  ];

  // ---- Generation → lane -------------------------------------------------
  // Each generation gets its own row: the successors and the scholars who came
  // after them are separated so both lanes stay readable, while the compilers
  // also appear in the books lane as the collection they produced.
  const GENERATION_TO_LANE = {
    prophet:      'prophets',
    sahabi:       'companions',
    tabii:        'tabiun',
    'taba-tabii': 'scholars',
    later:        'scholars',
    compiler:     'scholars',
  };

  // Headline seerah events keep a label even on a zoomed-out axis. Everything
  // else in the events lane is plotted as a bare marker and reveals itself on
  // hover, which is what keeps the lane readable at every zoom level.
  const HEADLINE_EVENTS = [
    'birth', 'first-rev', 'hijrah', 'badr', 'conquest', 'farewell', 'passing',
  ];

  // The Rashidun caliphs and Aisha carry a label in the companions lane; the
  // rest of the generation is plotted as bare markers for the same reason.
  const KEY_COMPANIONS = ['abu-bakr', 'umar', 'uthman', 'ali', 'aisha'];

  // Successors and scholars only keep a label when the archive records a role
  // beyond plain "Narrator", so a lane of ninety transmitters never turns into
  // a wall of text — the bare markers still reveal themselves on hover.
  const NOTABLE_ROLE = /Scholar|Founder|Jurist|Imam|Qadi|Mufti|Critic|Historian|Compiler|Reciter/i;

  // Compilers also appear in the books lane, as the collection they produced.
  // The year is the collection's completion, not the compiler's death.
  const COMPILER_TO_BOOK = {
    malik:       { name: 'Muwatta Malik',      year: 770 },
    bukhari:     { name: 'Sahih al-Bukhari',   year: 846 },
    ahmad:       { name: 'Musnad Ahmad',       year: 850 },
    muslim:      { name: 'Sahih Muslim',       year: 875 },
    'abu-dawud': { name: 'Sunan Abi Dawud',    year: 879 },
    'ibn-majah': { name: 'Sunan Ibn Majah',    year: 880 },
    tirmidhi:    { name: "Jami' at-Tirmidhi",  year: 884 },
    nasai:       { name: "Sunan an-Nasa'i",    year: 908 },
  };

  // ---- Year formatting ---------------------------------------------------

  // "570 CE", "500 BCE", "0" — BCE years are stored negative and printed back
  // without the sign, so a reader never has to decode a minus.
  function formatYear(year) {
    const y = Math.round(year);
    if (y === 0) return '0';
    return y < 0 ? `${-y} BCE` : `${y} CE`;
  }

  // A span carries the era marker once, at the end, the way a history book
  // prints it: "570 – 632 CE", "500 BCE – 570 CE".
  function formatRange(start, end) {
    const a = Math.round(start);
    const b = Math.round(end);
    if (a === b) return formatYear(a);
    if (a < 0 && b < 0) return `${-a} – ${-b} BCE`;
    if (a >= 0 && b > 0) return `${a} – ${b} CE`;
    if (a < 0 && b === 0) return `${-a} BCE – 0`;
    return `${formatYear(a)} – ${formatYear(b)}`;
  }

  // The era a year falls inside — used by the ribbon tooltips and the card.
  function eraFor(year) {
    const y = Math.round(year);
    return ERAS.find((e) => y >= e.start && y < e.end) ||
           (y >= MAX_YEAR ? ERAS[ERAS.length - 1] : null);
  }

  // "The Prophet Muhammad ﷺ" reads better as "Prophet Muhammad ﷺ" on a chart.
  const displayName = (s) => String(s ?? '').replace(/^The\s+/, '');

  // Clip a record to the domain; drop it if it lies entirely outside.
  // The original years are kept so a clipped run still reports its real dates:
  // the Mamluk bar leaves the canvas at 1500 but is labelled 1250 – 1517.
  function clip(rec) {
    if (rec.startYear > MAX_YEAR || rec.endYear < MIN_YEAR) return null;
    const start = Math.max(MIN_YEAR, rec.startYear);
    const end = Math.min(MAX_YEAR, rec.endYear);
    return {
      ...rec,
      startYear: start,
      endYear: Math.max(start, end),
      trueStart: rec.startYear,
      trueEnd: rec.endYear,
      startClipped: rec.startYear < MIN_YEAR,
      endClipped: rec.endYear > MAX_YEAR,
    };
  }

  // Which records keep a name label. One rule per lane, so the density of a row
  // decides how loud it reads.
  function tierFor(narrator, lane) {
    if (lane === 'prophets') return 'featured';
    if (lane === 'companions') return KEY_COMPANIONS.includes(narrator.id) ? 'medium' : 'small';
    if (lane === 'tabiun' || lane === 'scholars') {
      return NOTABLE_ROLE.test(narrator.role || '') ? 'medium' : 'small';
    }
    return 'small';
  }

  function buildRecords(narrators, events, dynasties, places) {
    const records = [];

    // ---- Narrators ----
    Object.values(narrators || {}).forEach((n) => {
      if (n.id === 'prophet') {
        // The Prophet's life is the axis everything else is read against, so it
        // is plotted explicitly rather than inferred from null-safe year fields.
        records.push(clip({
          id: 'prophet',
          kind: 'figure',
          lane: 'prophets',
          name: displayName(n.name),
          arabic: n.arabic,
          startYear: 570,
          endYear: 632,
          role: 'Prophet',
          tier: 'featured',
          data: n,
        }));
        return;
      }

      const lane = GENERATION_TO_LANE[n.generation];
      if (!lane) return;

      const birth = n.birthYear;
      const death = n.deathYear;
      if (birth == null && death == null) return;   // nothing to plot

      records.push(clip({
        id: n.id,
        kind: 'figure',
        lane,
        name: n.name,
        arabic: n.arabic,
        startYear: birth ?? death,     // a single known year is a point
        endYear: death ?? birth,
        role: n.role || n.generation,
        tier: tierFor(n, lane),
        data: n,
      }));
    });

    // ---- Compiler collections ----
    Object.entries(COMPILER_TO_BOOK).forEach(([id, book]) => {
      records.push(clip({
        id: 'book-' + id,
        kind: 'book',
        lane: 'books',
        name: book.name,
        startYear: book.year,
        endYear: book.year,
        role: 'Collection',
        tier: 'medium',
        data: { id, compilerId: id, name: book.name, year: book.year },
      }));
    });

    // ---- Events ----
    (events || []).forEach((e) => {
      records.push(clip({
        id: 'event-' + e.id,
        kind: 'event',
        lane: 'events',
        name: e.name,
        startYear: e.year,
        endYear: e.year,
        role: e.category === 'battle' ? 'Battle' : 'Event',
        tier: HEADLINE_EVENTS.includes(e.id) ? 'medium' : 'small',
        data: e,
      }));
    });

    // ---- Dynasties ----
    (dynasties || []).forEach((d) => {
      records.push(clip({
        id: 'dyn-' + d.id,
        kind: 'dynasty',
        lane: 'dynasties',
        name: d.name,
        arabic: d.arabic,
        startYear: d.start,
        endYear: d.end,
        role: 'Dynasty',
        tier: 'medium',
        data: d,
      }));
    });

    // ---- Places: every milestone is a marker, the first one carries the label
    //      so each city is named once instead of repeating across the row.
    (places || []).forEach((p) => {
      (p.milestones || []).forEach((m, i) => {
        records.push(clip({
          id: `place-${p.id}-${i}`,
          kind: 'place',
          lane: 'places',
          name: p.name,
          arabic: p.arabic,
          startYear: m.year,
          endYear: m.year,
          role: m.label,
          tier: i === 0 ? 'medium' : 'small',
          data: { ...p, milestone: m },
        }));
      });
    });

    const laneIndex = (r) => LANE_ORDER.indexOf(r.lane);
    return records
      .filter(Boolean)
      .sort((a, b) => laneIndex(a) - laneIndex(b) || a.startYear - b.startYear);
  }

  return {
    MIN_YEAR, MAX_YEAR, DEFAULT_WINDOW,
    LANES, LANE_ORDER, ALWAYS_VISIBLE, LEGEND, ERAS,
    formatYear, formatRange, eraFor,
    buildRecords,
  };
})();
