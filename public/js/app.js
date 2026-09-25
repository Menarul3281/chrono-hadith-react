(async function main() {
  Icons.init();
  Motion.init();
  Tooltips.init();
  if (typeof SiteChrome !== 'undefined') SiteChrome.init();

  let page = document.getElementById('page');
  let routeVersion = 0;
  const titleEl = document.getElementById('topbarTitle');

  try {
    await DataLoader.load();
  } catch (err) {
    page.innerHTML = '<div class="state error"><strong>Could not load data.</strong><br>' +
      ChronoData.esc(err.message) +
      '<br><br><span class="tiny muted">Serve the app over HTTP — e.g. npm run dev.</span>' +
      '<p><button class="dsh-btn primary" type="button" data-reload>Reload archive</button></p></div>';
    page.querySelector('[data-reload]').addEventListener('click', () => location.reload());
    return;
  }

  HadithOfDay.init(DataLoader.listHadiths());
  TopSearch.init();

  document.querySelector('[data-sidebar-search]')?.addEventListener('click', () => {
    TopSearch.open();
    document.getElementById('topSearchInput')?.focus();
  });

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '') || 'overview';
    let [path, query] = raw.split('?');
    const params = new URLSearchParams(query || '');
    const aliases = { timeline: 'history', events: 'history', places: 'history', hadiths: 'library', books: 'library', quran: 'library' };
    if (aliases[path]) {
      const consolidated = aliases[path];
      if (consolidated === 'history') params.set('view', path === 'timeline' ? 'timeline' : path);
      if (consolidated === 'library') params.set('tab', path === 'quran' ? 'quran' : path);
      const qs = params.toString();
      history.replaceState(null, '', '#' + consolidated + (qs ? '?' + qs : ''));
      return { path: consolidated, params };
    }
    if (path === 'history' && !params.get('view')) params.set('view', 'timeline');
    if (path === 'library' && !params.get('tab')) params.set('tab', 'hadiths');
    return { path, params };
  }

  function routeFromHref(anchor) {
    const hash = anchor.getAttribute('href')?.split('#')[1];
    return hash ? hash.split('?')[0] : '';
  }

  function setActiveNav(path) {
    document.querySelectorAll('.nav-item').forEach((a) => {
      const isActive = routeFromHref(a) === path;
      a.classList.toggle('active', isActive);
      if (isActive) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  const low = (s) => String(s ?? '').toLowerCase();

  const Rows = {
    event: (e) => ({ id: ChronoData.cid.event(e.id), label: e.name, group: e.era, meta: 'Event',
      sub: [e.hijri ? `${e.hijri}` : `${e.year} CE`, e.placeId ? ChronoData.place(e.placeId)?.name : null].filter(Boolean).join(' · '),
      icon: 'calendar', colour: ChronoData.era(e.era).color,
      hay: low(`${e.name} ${e.year} ${e.hijri} ${e.summary} ${e.context} ${e.source}`) }),
    dynasty: (d) => ({ id: ChronoData.cid.dynasty(d.id), label: d.name, group: d.type, meta: 'Dynasty',
      sub: `${d.start} – ${d.end} · ${d.capital}`, icon: 'crown', colour: d.colour,
      hay: low(`${d.name} ${d.arabic} ${d.full} ${d.capital} ${d.region} ${(d.regions || []).join(' ')} ${d.type}`) }),
    place: (p) => ({ id: ChronoData.cid.place(p.id), label: p.name, group: p.zone, meta: 'Place',
      sub: `${p.region} · ${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}${p.approx ? ' (approx.)' : ''}`, icon: 'places', colour: 'var(--cyan)',
      hay: low(`${p.name} ${p.arabic} ${p.region} ${p.zone}`) }),
    ruler: (r) => ({ id: ChronoData.cid.ruler(r.id), label: r.name, group: r.dynastyId, meta: r.title,
      sub: `${r.start} – ${r.end}`, icon: 'people', colour: 'var(--gold)', hay: low(`${r.name} ${r.arabic} ${r.title} ${r.note}`) }),
    book: (b) => ({ id: ChronoData.cid.book(b.id), label: b.name, group: b.category, meta: b.category,
      sub: [b.authors[0], b.death ? `d. ${b.death} CE` : b.generation].filter(Boolean).join(' · '), icon: 'books', colour: 'var(--gold)',
      hay: low(`${b.name} ${b.arabic} ${(b.authors || []).join(' ')} ${b.category} ${b.language} ${b.region} ${b.note}`) }),
    report: (h) => ({ id: ChronoData.cid.report(h.id), label: h.reference, group: h.collection, meta: 'Report',
      sub: [h.collection, h.grade, DataLoader.getNarrator(h.narratorId)?.name].filter(Boolean).join(' · '), icon: 'hadiths', colour: 'var(--teal)',
      hay: low(`${h.reference} ${h.collection} ${h.book} ${h.number} ${h.translation} ${h.arabic} ${h.grade} ${(h.chain || []).map((l) => DataLoader.getNarrator(l.narratorId)?.name).join(' ')}`) }),
    figure: (f) => ({ id: ChronoData.cid.figure(f.id), label: f.name, group: f.generation, meta: f.role || f.generation,
      sub: [f.birth, f.death].filter(Boolean).join(' – ') || (f.locations || []).join(', '), icon: 'people', colour: 'var(--teal-soft)',
      hay: low(`${f.name} ${f.arabic} ${f.kunya} ${f.nasab} ${f.role} ${f.generation} ${f.bio} ${(f.locations || []).join(' ')}`) }),
    topic: (t) => ({ id: ChronoData.cid.topic(t.id), label: t.label, group: 'topic', meta: t.kind,
      sub: `${ChronoData.reportsOfTopic(t.id).length} report(s)`, icon: 'hadiths', colour: 'var(--blue)', hay: low(`${t.label} ${t.kind}`) }),
  };
  const scopeRows = (built, q, chip) => built
    .filter((r) => !chip || chip === 'all' || r.group === chip)
    .filter((r) => !q || r.hay.includes(q));

  const chipsFrom = (built, allLabel = 'All') => {
    const counts = new Map();
    built.forEach((r) => counts.set(r.group, (counts.get(r.group) || 0) + 1));
    return [
      { key: 'all', label: allLabel, count: built.length },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: key, count })),
    ];
  };

  const PAGES = {
    overview: { title: 'Overview', sub: 'Explore connected Islamic knowledge.' },
    isnad: { title: 'Isnad', sub: 'Trace the chain.' },
    graph: { title: 'Graph', sub: 'Explore documented historical connections.' },
    history: { title: 'History', sub: 'Timeline, events, places and lifespans.' },
    figures: { title: 'Figures', sub: 'Companions, narrators, scholars.' },
    library: { title: 'Library', sub: "Qur'an, hadiths, books and collections." },
    dynasties: { title: 'Dynasties', sub: 'Islamic caliphates and periods.' },
    timeline: { title: 'Timeline', sub: 'Explore the chronological flow.' },
    events: { title: 'Events', sub: 'Key events in Islamic history.' },
    places: { title: 'Places', sub: 'Locations in Islamic history.' },
    hadiths: { title: 'Hadiths', sub: 'Browse the Nine Books.' },
    books: { title: 'Books', sub: 'The classic hadith collections.' },
  };

  const WIDE = ['overview', 'graph', 'history', 'events', 'places', 'dynasties', 'library', 'books', 'hadiths'];

  function simpleScope(config, built) {
    let chip = 'all';
    return {
      label: config.label, placeholder: config.placeholder, hint: config.hint,
      activeChip: () => chip,
      chips: () => chipsFrom(built, config.allLabel || 'All'),
      setChip: (key) => { chip = key; },
      rows: ({ query }) => scopeRows(built, query, chip),
      onPick: config.onPick, reveal: config.reveal,
    };
  }

  const figuresScope = () => simpleScope({
    label: 'Figures', placeholder: 'Search figures…', hint: 'By name, kunya, role or place',
    onPick: (id) => { location.hash = `#figures?id=${ChronoData.resolve(id).id}`; },
  }, ChronoData.allFigures().map(Rows.figure));

  const reportsScope = () => simpleScope({
    label: 'Isnad', placeholder: 'Search reports…', hint: 'By reference, collection, narrator or text', allLabel: 'All collections',
    onPick: (id) => { location.hash = `#isnad?hadith=${ChronoData.resolve(id).id}`; },
  }, ChronoData.allReports().map(Rows.report));

  let timelineRows = null;
  async function timelineScope() {
    if (!timelineRows) {
      await ChronoData.load();
      const records = TimelineData.buildRecords(
        DataLoader.listNarrators(), ChronoData.allEvents(), ChronoData.allDynasties(), ChronoData.allPlaces());
      timelineRows = records.map((rec) => ({
        id: `tl:${rec.id}`, label: rec.name, group: rec.kind, meta: rec.kind,
        sub: rec.startYear === rec.endYear ? `${rec.startYear}` : `${rec.startYear} – ${rec.endYear}`,
        icon: rec.kind === 'event' ? 'calendar' : rec.kind === 'dynasty' ? 'crown' : rec.kind === 'place' ? 'places' : rec.kind === 'book' ? 'books' : 'people',
        colour: TimelineData.LANES?.[rec.lane]?.color || 'var(--teal)',
        hay: low(`${rec.name} ${rec.arabic || ''} ${rec.role || ''} ${rec.kind} ${rec.startYear} ${rec.endYear}`),
      }));
    }
    return simpleScope({
      label: 'History', placeholder: 'Search timeline records…',
      hint: 'Figures, events, dynasties, books and places on the canvas', allLabel: 'All categories',
      onPick: (id) => {
        const raw = String(id).replace(/^tl:/, '');
        const lane = raw.startsWith('event-') ? 'events' : 'all';
        location.hash = `#history?view=timeline&lane=${encodeURIComponent(lane)}&id=${encodeURIComponent(raw)}`;
      },
    }, timelineRows);
  }

  async function scopeFor(path, params) {
    const view = params && params.get ? params.get('view') : null;
    const tab = params && params.get ? params.get('tab') : null;
    switch (path) {
      case 'overview': return OverviewView.searchScope?.() || null;
      case 'history':
        if (view === 'events') return EventsView.searchScope?.() || null;
        if (view === 'places') return PlacesView.searchScope?.() || null;
        return timelineScope();
      case 'library':
        if (tab === 'books') return BooksView.searchScope?.() || null;
        if (tab === 'hadiths') return HadithsView.searchScope?.() || null;
        return null;
      case 'events': return EventsView.searchScope?.() || null;
      case 'dynasties': return DynastiesView.searchScope?.() || null;
      case 'books': return BooksView.searchScope?.() || null;
      case 'hadiths': return HadithsView.searchScope?.() || null;
      case 'places': return PlacesView.searchScope?.() || null;
      case 'graph': return GraphView.searchScope?.() || null;
      case 'figures': return figuresScope();
      case 'isnad': return reportsScope();
      case 'timeline': return timelineScope();
      default: return null;
    }
  }
  async function render() {
    Tooltips.hide();
    const version = ++routeVersion;
    window.ChronoGraph?.unmount?.();
    if (typeof OverviewGraph !== 'undefined') OverviewGraph.unmount();
    NarratorView.destroy?.();
    Timeline.destroy?.();

    const host = document.createElement('main');
    host.id = 'page';
    host.className = 'page';
    host.tabIndex = -1;
    host.setAttribute('aria-busy', 'true');
    host.innerHTML = '<div class="state loading-block" role="status">Loading archive…</div>';
    page.replaceWith(host);
    page = host;
    host.classList.add('page-enter');

    const { path, params } = parseRoute();
    setActiveNav(path);
    document.body.dataset.route = path;

    const meta = PAGES[path] || { title: 'Chrono-Hadith', sub: '' };
    titleEl.innerHTML = `<strong>${meta.title}</strong><span class="topbar-sep">·</span><span class="topbar-sub">${meta.sub}</span>`;
    document.title = `${meta.title} · Chrono-Hadith & Seerah Graph`;
    TopSearch.setScope(null);
    page.classList.toggle('page-wide', WIDE.includes(path));

    try {
      if (path === 'overview') {
        await OverviewView.render(host, params);
      } else if (path === 'isnad') {
        IsnadView.render(host, params);
      } else if (path === 'figures') {
        NarratorView.render(host, params);
      } else if (path === 'history') {
        const view = params.get('view') || 'timeline';
        if (view === 'events') await EventsView.render(host, params);
        else if (view === 'places') await PlacesView.render(host, params);
        else await Timeline.render(host, params);
      } else if (path === 'library') {
        const tab = params.get('tab') || 'hadiths';
        if (tab === 'books') await BooksView.render(host, params);
        else if (tab === 'hadiths') await HadithsView.render(host, params);
        else host.innerHTML = '<div class="state">The Qur\'an tab is not connected to a verified dataset yet.<span class="tiny">Hadiths and Books are available through the Library tabs.</span></div>';
      } else if (path === 'timeline') {
        await Timeline.render(host, params);
      } else if (path === 'events') {
        await EventsView.render(host, params);
      } else if (path === 'dynasties') {
        await DynastiesView.render(host, params);
      } else if (path === 'books') {
        await BooksView.render(host, params);
      } else if (path === 'hadiths') {
        await HadithsView.render(host, params);
      } else if (path === 'places') {
        await PlacesView.render(host, params);
      } else if (path === 'graph') {
        await GraphView.render(host, params);
      } else {
        host.innerHTML = `<div class="state">The <strong>${meta.title}</strong> view is not built yet.<span class="tiny">Its record set is not in the archive either, so there is nothing to search yet.</span></div>`;
      }
      if (version !== routeVersion) return;
      const scope = await scopeFor(path, params);
      if (version !== routeVersion) return;
      TopSearch.setScope(scope);
    } catch (error) {
      if (version !== routeVersion) return;
      console.error('Page failed to load:', error);
      host.innerHTML = '<div class="state error" role="alert"><strong>Could not load this page.</strong><p>' +
        ChronoData.esc(error.message) +
        '</p><button class="dsh-btn primary" type="button" data-retry>Try again</button></div>';
      host.querySelector('[data-retry]').addEventListener('click', render);
    } finally {
      host.removeAttribute('aria-busy');
    }
  }

  window.addEventListener('hashchange', render);

  if (parseRoute().path === 'graph' && !window.ChronoGraph) {
    await Promise.race([
      new Promise((resolve) => window.addEventListener('chrono-graph-ready', resolve, { once: true })),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  }

  await render();

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest?.('[data-action]');
    if (!btn) return;
    showToast(`${btn.dataset.action} — coming soon`);
  });
  document.querySelector('[data-grain-toggle]')?.addEventListener('change', (ev) => {
    document.body.classList.toggle('no-fx', !ev.target.checked);
    document.documentElement.dataset.atmosphere = ev.target.checked ? 'on' : 'off';
    if (typeof SiteChrome !== 'undefined') SiteChrome.setPreference('atmosphere', ev.target.checked);
  });
  const topbar = document.querySelector('.topbar');
  const sidebarEl = document.getElementById('sidebar');
  const navToggle = topbar?.querySelector('[data-nav-toggle]');
  const searchToggle = topbar?.querySelector('[data-search-toggle]');
  const navScrim = document.getElementById('navScrim');
  const narrow = window.matchMedia('(max-width: 900px)');

  if (topbar && sidebarEl && navToggle && searchToggle && navScrim) {
    const navOpen = () => sidebarEl.classList.contains('open');
    const searchOpen = () => topbar.classList.contains('search-open');
    function setNav(open) {
      sidebarEl.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      if (open && searchOpen()) setSearch(false);
    }
    function setSearch(open) {
      topbar.classList.toggle('search-open', open);
      searchToggle.setAttribute('aria-expanded', String(open));
      searchToggle.setAttribute('aria-label', open ? 'Close search' : 'Search this page');
      if (open) {
        if (navOpen()) setNav(false);
        TopSearch.open();
        document.getElementById('topSearchInput')?.focus();
      } else {
        TopSearch.close();
      }
    }
    navToggle.addEventListener('click', () => setNav(!navOpen()));
    searchToggle.addEventListener('click', () => setSearch(!searchOpen()));
    navScrim.addEventListener('click', () => setNav(false));
    sidebarEl.querySelector('nav')?.addEventListener('click', (ev) => {
      if (ev.target.closest('a[href]') && narrow.matches) setNav(false);
    });
    sidebarEl.querySelector('[data-nav-close]')?.addEventListener('click', () => setNav(false));
    document.addEventListener('click', (ev) => {
      if (!narrow.matches) return;
      const onToggle = navToggle.contains(ev.target) || searchToggle.contains(ev.target)
        || !!ev.target.closest?.('[data-sidebar-search]');
      if (navOpen() && !onToggle && !sidebarEl.contains(ev.target)) setNav(false);
      if (searchOpen() && !onToggle && !topbar.contains(ev.target)) setSearch(false);
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      setNav(false);
      setSearch(false);
    });
    narrow.addEventListener('change', (ev) => {
      if (!ev.matches) { setNav(false); setSearch(false); }
    });
  }

  const rail = document.getElementById('scrollRail');
  const thumb = document.getElementById('scrollRailThumb');
  let railTimer;
  function updateRail() {
    const scrolled = window.scrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = scrolled / max;
    const railH = rail.clientHeight;
    const thumbH = Math.min(railH, Math.max(40, (window.innerHeight / document.documentElement.scrollHeight) * railH));
    thumb.style.height = thumbH + 'px';
    thumb.style.transform = `translateY(${ratio * (railH - thumbH)}px)`;
  }
  window.addEventListener('scroll', () => {
    rail.classList.add('active');
    updateRail();
    clearTimeout(railTimer);
    railTimer = setTimeout(() => rail.classList.remove('active'), 1200);
  }, { passive: true });
  window.addEventListener('resize', updateRail);
  updateRail();

  window.showToast = showToast;
  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
})();
