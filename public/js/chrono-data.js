/* Chrono data — one shared reading of the archive for the Events page and the
   Islamic Dynasties page.

   Both pages read the same files (events, dynasties, places, rulers) and both
   need the same relations: which dynasties an event belongs to, which events a
   dynasty produced, which place an event happened at, which narrators took part.
   Those relations are derived here once, so the two pages cannot disagree.

   Nothing is invented: a relation exists only when the record carries the id.
   An event with no placeId has no location, an event with no dynastyIds has no
   dynasty, and the pages say so instead of guessing. */

const ChronoData = (() => {
  // ---- Taxonomies ---------------------------------------------------------
  // The six eras of the Events sidebar, with the window each one covers. The
  // label and the dates are shown beside the checkbox, as in the layout.
  const ERAS = [
    { id: 'pre-islamic', label: 'Pre-Islamic',            range: 'before 570', start: null, end: 570,  color: '#a49ac4' },
    { id: 'prophetic',   label: "Prophet's Life",         range: '570 – 632',  start: 570,  end: 632,  color: 'var(--teal-soft)' },
    { id: 'rashidun',    label: 'Rightly Guided Caliphs', range: '632 – 661',  start: 632,  end: 661,  color: 'var(--teal)' },
    { id: 'umayyad',     label: 'Umayyad',                range: '661 – 750',  start: 661,  end: 750,  color: 'var(--gold)' },
    { id: 'abbasid',     label: 'Abbasid',                range: '750 – 1258', start: 750,  end: 1258, color: 'var(--purple)' },
    { id: 'later',       label: 'Later Periods',          range: '1258+',      start: 1258, end: null, color: '#b9b2d8' },
  ];

  // The event types of the sidebar. `key` is what the data carries in uiType.
  const EVENT_TYPES = [
    { key: 'birth',      label: 'Birth / Family',  color: 'var(--blue)' },
    { key: 'revelation', label: 'Revelation',      color: 'var(--purple)' },
    { key: 'migration',  label: 'Migration',       color: 'var(--cyan)' },
    { key: 'battle',     label: 'Battles',         color: 'var(--red)' },
    { key: 'treaty',     label: 'Treaties',        color: 'var(--teal-soft)' },
    { key: 'political',  label: 'Political Event', color: 'var(--orange)' },
    { key: 'social',     label: 'Social Event',    color: 'var(--gold)' },
    { key: 'death',      label: 'Death',           color: '#8fa3ad' },
    { key: 'other',      label: 'Other',           color: '#6b8794' },
  ];

  // Event regions. Iraq shares the "Persia" bucket because the two form one
  // corridor from the Sasanian past into the Abbasid heartland; the tooltip on
  // the chip says so.
  const REGIONS = [
    { key: 'Makkah',  label: 'Makkah' },
    { key: 'Madinah', label: 'Madinah' },
    { key: 'Arabia',  label: 'Arabia (Other)' },
    { key: 'Levant',  label: 'Levant' },
    { key: 'Egypt',   label: 'Egypt' },
    { key: 'Persia',  label: 'Persia', note: 'Persia & Iraq' },
    { key: 'Others',  label: 'Others' },
  ];

  const DYN_REGIONS = [
    'Arabia', 'Levant', 'North Africa', 'Al-Andalus', 'Persia',
    'Central Asia', 'South Asia', 'Anatolia', 'Sub-Saharan Africa', 'Others',
  ];

  const DYN_TYPES = ['Caliphate', 'Dynasty', 'Sultanate', 'Emirate', 'Kingdom', 'Other'];

  // Quick filters of the Dynasties sidebar, in historical order.
  const QUICK_DYNASTIES = [
    'rashidun', 'umayyad', 'abbasid', 'ottoman', 'fatimid', 'seljuk', 'mamluk', 'mughal',
  ];

  // ---- State --------------------------------------------------------------
  const state = {
    events: [], dynasties: [], places: [], rulers: [], books: [],
    eventById: new Map(), dynastyById: new Map(), placeById: new Map(),
    bookById: new Map(), rulerById: new Map(),
    loaded: false,
  };
  const relations = {
    eventsByDynasty: new Map(), rulersByDynasty: new Map(), booksByFigure: new Map(),
    reportsByBook: new Map(), reportsByFigure: new Map(), reportsByPlace: new Map(),
  };
  const related = (index, id) => (index.get(id) || []).slice();
  function indexRelations() {
    Object.values(relations).forEach((index) => index.clear());
    const add = (index, id, record) => {
      if (!id) return;
      if (!index.has(id)) index.set(id, []);
      index.get(id).push(record);
    };
    state.events.forEach((e) => new Set(e.dynastyIds || []).forEach((id) => add(relations.eventsByDynasty, id, e)));
    state.rulers.forEach((r) => add(relations.rulersByDynasty, r.dynastyId, r));
    state.books.forEach((b) => new Set(b.authorIds || []).forEach((id) => add(relations.booksByFigure, id, b)));
    DataLoader.listHadiths().forEach((h) => {
      add(relations.reportsByBook, COLLECTION_TO_BOOK[h.collection], h);
      new Set([h.narratorId, ...h.chain.map((link) => link.narratorId)])
        .forEach((id) => add(relations.reportsByFigure, id, h));
      new Set(h.placeIds || []).forEach((id) => add(relations.reportsByPlace, id, h));
    });
  }

  /* The archive's collections as the reports name them, mapped to the canonical
     book records. This is the one place the two spellings meet, so a report can
     always be traced to its collection record without string matching at the
     point of use. */
  const COLLECTION_TO_BOOK = {
    'Sahih al-Bukhari': 'bukhari',
    'Sahih Muslim': 'muslim',
    'Sunan an-Nasa\'i': 'nasai',
    'Sunan Abi Dawud': 'abu-dawud',
    'Jami\' al-Tirmidhi': 'tirmidhi',
    'Sunan Ibn Majah': 'ibn-majah',
    'al-Muwatta': 'muwatta',
    'Musnad Ahmad': 'musnad-ahmad',
  };

  // The page picker's categories, and which of them the data actually fills.
  const BOOK_CATEGORIES = [
    'Primary Source', 'Hadith Collections', 'Seerah & History', 'Biographical Works',
    'Tafsir', 'Fiqh', 'Aqidah', 'Sufism', 'Language & Linguistics', 'Adab & Ethics',
    'Sciences & Miscellaneous',
  ];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let pending = null;
  function load() {
    if (state.loaded) return Promise.resolve(state);
    if (!pending) pending = (async () => {
      const names = ['events', 'dynasties', 'places', 'rulers', 'books'];
      await DataLoader.load();
      const files = await Promise.all(names.map((name) => DataLoader.json('./data/' + name + '.json')));
      const next = {};
      names.forEach((name, i) => {
        const records = files[i]?.[name];
        if (!Array.isArray(records) || records.some((r) => !r || typeof r.id !== 'string')
            || new Set(records.map((r) => r.id)).size !== records.length) {
          DataLoader.invalidate('./data/' + name + '.json');
          throw new Error('Invalid or duplicate records in ' + name + '.json');
        }
        next[name] = records.slice();
      });
      next.events.sort((a, b) => a.year - b.year || a.name.localeCompare(b.name));
      next.dynasties.sort((a, b) => a.start - b.start);
      next.rulers.sort((a, b) => a.start - b.start);
      next.books.sort((a, b) => a.name.localeCompare(b.name));
      // Publish only after every collection passes validation.
      Object.assign(state, next);
      for (const [plural, singular] of Object.entries({ events: 'event', dynasties: 'dynasty', places: 'place', rulers: 'ruler', books: 'book' })) {
        state[singular + 'ById'] = new Map(next[plural].map((r) => [r.id, r]));
      }
      indexRelations();
      state.loaded = true;
      return state;
    })().finally(() => { pending = null; });
    return pending;
  }

  // ---- Resolvers ----------------------------------------------------------
  const place = (id) => state.placeById.get(id) || null;
  const event = (id) => state.eventById.get(id) || null;
  const dynasty = (id) => state.dynastyById.get(id) || null;
  const allEvents = () => state.events.slice();
  const allDynasties = () => state.dynasties.slice();
  const allPlaces = () => state.places.slice();
  const allRulers = () => state.rulers.slice();

  const era = (id) => ERAS.find((e) => e.id === id) || ERAS[ERAS.length - 1];
  const typeInfo = (key) => EVENT_TYPES.find((t) => t.key === key) || EVENT_TYPES[EVENT_TYPES.length - 1];

  /* The region an event is filed under: the place's own zone, or the event's
     explicit zone when the record has no single site (a war fought across a
     province, for instance). */
  const zoneOf = (e) => (e.placeId && place(e.placeId)?.zone) || e.zone || 'Others';

  const dynastiesOfEvent = (e) => (e.dynastyIds || []).map(dynasty).filter(Boolean);
  const participantsOf = (e) => (e.participants || []).map((id) => DataLoader.getNarrator(id)).filter(Boolean);
  const hadithsOfEvent = (e) => (e.hadithIds || []).map((id) => DataLoader.getHadith(id)).filter(Boolean);
  const eventsOfDynasty = (id) => related(relations.eventsByDynasty, id);
  const rulersOfDynasty = (id) => related(relations.rulersByDynasty, id);

  /* Places a dynasty is documented at: its capitals plus the sites of its own
     events. Nothing is added that the records do not carry. */
  function placesOfDynasty(id) {
    const out = new Map();
    (dynasty(id)?.capitalIds || []).forEach((pid) => {
      const p = place(pid);
      if (p) out.set(pid, { place: p, kind: 'Capital' });
    });
    eventsOfDynasty(id).forEach((e) => {
      if (e.placeId && place(e.placeId) && !out.has(e.placeId)) {
        out.set(e.placeId, { place: place(e.placeId), kind: 'Event site' });
      }
    });
    return [...out.values()];
  }

  /* Hadith records the archive holds from a participant of the event — a
     documented narrator-to-hadith link, offered as a related record. */
  const hadithsByParticipants = (e) => {
    const ids = new Set(e.participants || []);
    if (!ids.size) return [];
    return DataLoader.listHadiths().filter((h) =>
      ids.has(h.narratorId) || h.chain.some((l) => ids.has(l.narratorId)));
  };

  const eraCounts = () => ERAS.map((e) => ({ ...e, count: state.events.filter((x) => x.era === e.id).length }));
  const typeCounts = () => EVENT_TYPES.map((t) => ({ ...t, count: state.events.filter((x) => x.uiType === t.key).length }));
  const regionCounts = () => REGIONS.map((r) => ({ ...r, count: state.events.filter((x) => zoneOf(x) === r.key).length }));
  const dynRegionCounts = () => DYN_REGIONS.map((r) => ({ key: r, count: state.dynasties.filter((d) => d.region === r).length }));
  const dynTypeCounts = () => DYN_TYPES.map((t) => ({ key: t, count: state.dynasties.filter((d) => d.type === t).length }));

  const distinct = (arr) => [...new Set(arr)];

  /* Header counters, all read from the records rather than typed in: the pages
     must never claim a total the data does not hold. */
  function totals() {
    const linked = state.events.filter((e) => (e.dynastyIds || []).length);
    const cities = new Set();
    state.dynasties.forEach((d) => (d.capitalIds || []).forEach((c) => cities.add(c)));
    linked.forEach((e) => e.placeId && cities.add(e.placeId));
    return {
      events: state.events.length,
      eras: distinct(state.events.map((e) => e.era)).length,
      battles: state.events.filter((e) => e.uiType === 'battle').length,
      treaties: state.events.filter((e) => e.uiType === 'treaty').length,
      eventFigures: distinct(state.events.flatMap((e) => e.participants || [])).length,
      eventPlaces: state.events.filter((e) => e.placeId && place(e.placeId)).length,

      dynasties: state.dynasties.length,
      rulers: state.rulers.length,
      cities: cities.size,
      keyEvents: linked.length,

      // Books, reports and figures: every one of these is a count of records the
      // archive actually holds, not a figure from a mock-up.
      books: state.books.length,
      collections: state.books.filter((b) => reportsOfBook(b.id).length > 0).length,
      reports: allReports().length,
      collectionsWithReports: new Set(allReports().map((h) => COLLECTION_TO_BOOK[h.collection]).filter(Boolean)).size,
      figures: allFigures().length,
      figuresNamed: allFigures().filter((f) => f.arabic).length,
      topics: topics().length,
      places: state.places.length,
      placesWithMilestones: state.places.filter((p) => (p.milestones || []).length).length,
    };
  }
  // ---- Books, reports, figures and topics ---------------------------------
  // The four record families the Books, Hadiths, Places and Graph pages read.
  // They already exist in the loader and data files; these are the shared
  // accessors, so every page reads the same record for the same id.

  const allBooks = () => state.books.slice();
  const book = (id) => state.bookById.get(id) || null;
  const allReports = () => DataLoader.listHadiths();
  const report = (id) => DataLoader.getHadith(id);
  const allFigures = () => Object.values(DataLoader.listNarrators());
  const figure = (id) => DataLoader.getNarrator(id);

  const bookOfReport = (h) => book(COLLECTION_TO_BOOK[h?.collection]) || null;
  const reportsOfBook = (id) => related(relations.reportsByBook, id);
  const booksOfFigure = (id) => related(relations.booksByFigure, id);
  const reportsOfFigure = (id) => related(relations.reportsByFigure, id);
  const chainFigures = (h) => (h?.chain || []).map((l) => figure(l.narratorId)).filter(Boolean);

  /* Topics are the topical books and matn groups the reports carry. They are
     derived, never typed twice: the label is the name the data already uses. */
  function topics() {
    const map = new Map();
    allReports().forEach((h) => {
      if (h.matnGroup) map.set(`matn:${h.matnGroup}`, { id: `matn:${h.matnGroup}`, label: h.matnGroup, kind: 'matn group' });
      if (h.book) map.set(`topic:${h.book}`, { id: `topic:${h.book}`, label: h.book, kind: 'topical book' });
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  const reportsOfTopic = (topicId) => {
    const [kind, ...parts] = String(topicId).split(':');
    const raw = parts.join(':');
    return allReports().filter((h) => (kind === 'matn' ? h.matnGroup === raw : h.book === raw));
  };

  /* Places a figure is recorded at. The archive stores these as names, so the
     match is by name and is described as such wherever it is shown. */
  const placesOfFigure = (id) => {
    const f = figure(id);
    if (!f || !f.locations) return [];
    return f.locations.map((name) => state.places.find((p) => p.name.toLowerCase() === String(name).toLowerCase()))
      .filter(Boolean);
  };

  /* Places a report is recorded at. These are place ids the report's own record
     carries — unlike a figure's locations, which are names — so nothing is
     matched by spelling: the link exists because the record holds the id. */
  const placesOfReport = (h) => (h?.placeIds || []).map((id) => place(id)).filter(Boolean);

  // The reports the archive records at a place, by the report's own place ids.
  const reportsAtPlace = (placeId) => related(relations.reportsByPlace, placeId);

  /* Reports a record is evidenced with. The graph draws record families, not
     reports — a report is reached through its reference — so both renderers
     show these as links out to the report's own page rather than as nodes.
     Each entry names the edge type and the field that produced it. */
  function reportLinksOf(node) {
    const out = [];
    const { kind, record } = node || {};
    if (!record) return out;
    const add = (type, h, note) => { if (h) out.push({ type, report: h, note }); };
    if (kind === 'figure') {
      allReports().filter((h) => h.narratorId === record.id).forEach((h) => add('narrated', h, 'narration'));
    } else if (kind === 'book') {
      reportsOfBook(record.id).forEach((h) => add('narrated', h, 'a report it holds'));
    } else if (kind === 'event') {
      hadithsOfEvent(record).forEach((h) => add('narrated', h, 'a report about it'));
    } else if (kind === 'topic') {
      reportsOfTopic(record.id).forEach((h) => add('topic', h, 'report on this topic'));
    } else if (kind === 'place') {
      reportsAtPlace(record.id).forEach((h) => add('recorded', h, 'recorded at this place'));
    }
    return out;
  }

  const bookCategoryCounts = () => BOOK_CATEGORIES.map((c) => ({
    key: c,
    count: state.books.filter((b) => b.category === c).length,
  }));

  /* ---- Books as sources --------------------------------------------------
     The archive cites its sources by name, so the link between a book record and
     the records that lean on it is not a guess: a book matches an event or a
     dynasty when that record's own citation contains the book's citation string.
     Nothing is inferred from a shared century or a shared subject. */

  const citeKeyOf = (bookId) => low(book(bookId)?.sources?.[0] || '');
  const low = (s) => String(s ?? '').toLowerCase();
  const cites = (record, key) => Boolean(key)
    && `${record.source || ''} ${(record.sources || []).join(' ')}`.toLowerCase().includes(key);

  const eventsOfBook = (bookId) => {
    const key = citeKeyOf(bookId);
    return state.events.filter((e) => cites(e, key));
  };

  const dynastiesOfBook = (bookId) => {
    const key = citeKeyOf(bookId);
    return state.dynasties.filter((d) => cites(d, key));
  };

  // The places a book is tied to are the recorded places of its compilers.
  const placesOfBook = (bookId) => {
    const ids = book(bookId)?.authorIds || [];
    const seen = new Map();
    ids.forEach((fid) => placesOfFigure(fid).forEach((p) => seen.set(p.id, p)));
    return [...seen.values()];
  };

  // ---- Canonical ids -------------------------------------------------------
  // One record, one id, one spelling, everywhere: the picker, the graph, the
  // cross-links and the deep links all speak these.
  const cid = {
    event: (id) => `event:${id}`,
    dynasty: (id) => `dynasty:${id}`,
    place: (id) => `place:${id}`,
    ruler: (id) => `ruler:${id}`,
    book: (id) => `book:${id}`,
    report: (id) => `report:${id}`,
    figure: (id) => `figure:${id}`,
    topic: (id) => `topic:${id}`,
  };

  /* `resolve('place:makkah')` → { kind, id, record }. The graph, the picker and
     the cross-link builder all go through this one function, so a canonical id
     means the same record on every page. */
  function resolve(canonicalId) {
    const [kind, ...rest] = String(canonicalId || '').split(':');
    const raw = rest.join(':');
    const record = kind === 'event' ? event(raw)
      : kind === 'dynasty' ? dynasty(raw)
        : kind === 'place' ? place(raw)
          : kind === 'ruler' ? state.rulerById.get(raw)
            : kind === 'book' ? book(raw)
              : kind === 'report' ? report(raw)
                : kind === 'figure' ? figure(raw)
                  : kind === 'topic' ? topics().find((t) => t.id === raw) || null
                    : null;
    return { kind, id: raw, record: record || null };
  }

  const labelOf = (kind, record) => {
    if (!record) return '';
    if (kind === 'report') return record.reference;
    if (kind === 'figure') return record.name;
    if (kind === 'place' || kind === 'event' || kind === 'dynasty' || kind === 'book') return record.name;
    return record.name || record.label || '';
  };

  /* The citation a record carries, in one shape, so detail panels can print a
     source without inventing one. */
  function citationOf(kind, record) {
    if (!record) return { text: '', url: '' };
    if (kind === 'report') return { text: record.reference || '', url: record.sourceUrl || '' };
    if (kind === 'book') return { text: (record.sources || []).join('; '), url: '' };
    if (kind === 'event') return { text: record.source || '', url: '' };
    if (kind === 'dynasty') return { text: (record.sources || []).join('; '), url: '' };
    if (kind === 'place') return { text: (record.sources || []).join('; '), url: '' };
    if (kind === 'figure') return { text: (record.sources || []).join('; '), url: '' };
    return { text: '', url: '' };
  }

  // ---- Cross-page context -------------------------------------------------
  // The two pages are separate routes, so the last selection of each is kept in
  // session storage: coming back to a page restores the record the reader left.
  const STORE = 'chrono.selection';
  function remember(patch) {
    try {
      const now = recall();
      sessionStorage.setItem(STORE, JSON.stringify({ ...now, ...patch }));
    } catch { /* private mode — deep links still work */ }
  }
  function recall() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  }

  const links = {
    event: (id, from) =>
      `#history?view=events&id=${encodeURIComponent(id)}${from ? `&from=${encodeURIComponent(from)}` : ''}`,

    dynasty: (id, from) =>
      `#dynasties?id=${encodeURIComponent(id)}${from ? `&from=${encodeURIComponent(from)}` : ''}`,

    figure: (id) =>
      `#figures?id=${encodeURIComponent(id)}`,

    hadith: (id) =>
      `#isnad?hadith=${encodeURIComponent(id)}`,

    // The timeline canvas covers 500 BCE – 1500 CE, so a later record has no
    // marker to open; those links fall back to the History timeline view.
    timelineEvent: (e) =>
      (e.year >= -500 && e.year <= 1500
        ? `#history?view=timeline&lane=events&id=event-${e.id}`
        : '#history?view=timeline'),

    timelineDynasty: (d) =>
      (d.start <= 1500
        ? `#history?view=timeline&lane=dynasties&id=dyn-${d.id}`
        : '#history?view=timeline'),

    timelineEra: (id) => {
      const e = era(id);
      const from = e.start == null ? -500 : Math.max(-500, e.start);
      const to = e.end == null ? 1500 : Math.min(1500, e.end);
      return `#history?view=timeline&from=${from}&to=${to}`;
    },
  };

  return {
    load, ERAS, EVENT_TYPES, REGIONS, DYN_REGIONS, DYN_TYPES, QUICK_DYNASTIES, BOOK_CATEGORIES,
    esc, era, typeInfo, zoneOf,
    place, event, dynasty, allEvents, allDynasties, allPlaces, allRulers,
    dynastiesOfEvent, participantsOf, hadithsOfEvent, hadithsByParticipants,
    eventsOfDynasty, rulersOfDynasty, placesOfDynasty,
    eraCounts, typeCounts, regionCounts, dynRegionCounts, dynTypeCounts,
    totals, remember, recall, links,

    // books, reports, figures, topics and the canonical id contract
    allBooks, book, allReports, report, allFigures, figure,
    bookOfReport, reportsOfBook, booksOfFigure, reportsOfFigure, chainFigures,
    topics, reportsOfTopic, placesOfFigure, bookCategoryCounts,
    placesOfReport, reportsAtPlace, reportLinksOf,
    eventsOfBook, dynastiesOfBook, placesOfBook, citeKeyOf,
    cid, resolve, labelOf, citationOf,
    COLLECTION_TO_BOOK,
  };
})();
