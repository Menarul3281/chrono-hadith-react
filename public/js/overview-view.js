const OverviewView = (() => {
  const esc = ChronoData.esc;
  const fmt = new Intl.NumberFormat('en-US');
  let onPage = { fields: [], explore: [], scholar: null, verse: null };

  const FIELDS = [
    { num: '01', key: 'graph', label: 'Graph', sub: 'Explore the network', href: '#graph', colour: 'var(--teal)', icon: 'graph',
      desc: 'Open the connected record as one canvas of documented relations.', count: () => GraphView.allNodes().length, unit: 'nodes' },
    { num: '02', key: 'timeline', label: 'Timeline', sub: 'Explore the chronology', href: '#history?view=timeline', colour: 'var(--blue)', icon: 'timeline',
      desc: 'Browse figures, events, dynasties and places in chronological order.', count: () => ChronoData.totals().events, unit: 'events' },
    { num: '03', key: 'figures', label: 'Figures', sub: 'Explore the people', href: '#figures', colour: 'var(--purple)', icon: 'people',
      desc: 'Companions, narrators and scholars held in the archive.', count: () => ChronoData.totals().figures, unit: 'figures' },
    { num: '04', key: 'hadiths', label: 'Hadiths', sub: 'Explore the narrations', href: '#library?tab=hadiths', colour: 'var(--gold)', icon: 'hadiths',
      desc: 'Verified reports with reference, grade and chain links.', count: () => ChronoData.totals().reports, unit: 'reports' },
    { num: '05', key: 'places', label: 'Places', sub: 'Explore the locations', href: '#history?view=places', colour: 'var(--cyan)', icon: 'places',
      desc: 'Sites, cities and capitals with their recorded events and reports.', count: () => ChronoData.totals().places, unit: 'places' },
    { num: '06', key: 'events', label: 'Events', sub: 'Explore the moments', href: '#history?view=events', colour: 'var(--red)', icon: 'calendar',
      desc: 'Key events with documented participants, geography and sources.', count: () => ChronoData.totals().events, unit: 'events' },
    { num: '07', key: 'dynasties', label: 'Dynasties', sub: 'Explore historical eras', href: '#dynasties', colour: 'var(--orange)', icon: 'crown',
      desc: 'Caliphates, sultanates and kingdoms through 1500 CE.', count: () => ChronoData.totals().dynasties, unit: 'dynasties' },
    { num: '08', key: 'books', label: 'Books', sub: 'Explore the collections', href: '#library?tab=books', colour: '#f27ea9', icon: 'books',
      desc: 'Explore books and primary collections. Preview route; not a verified isnad chain.', count: () => ChronoData.totals().books, unit: 'books' },
  ];

  function epigraph() {
    const quoted = ChronoData.allEvents().filter((e) => e.quote && e.quote.arabic);
    const e = quoted.find((x) => x.era === 'prophetic') || quoted[0] || null;
    return e ? { event: e, quote: e.quote } : null;
  }

  function connectionsOf(id) {
    const collections = new Set(ChronoData.reportsOfFigure(id).map((h) => h.collection)).size;
    const events = ChronoData.allEvents().filter((e) => (e.participants || []).includes(id)).length;
    return collections + ChronoData.booksOfFigure(id).length + ChronoData.placesOfFigure(id).length + events;
  }

  function featuredScholar() {
    const f = ChronoData.figure('bukhari')
      || ChronoData.allFigures().find((x) => x.generation === 'compiler' && ChronoData.reportsOfFigure(x.id).length)
      || null;
    if (!f) return null;
    return {
      figure: f,
      desc: f.id === 'bukhari'
        ? 'Compiler of Sahih al-Bukhari — the collection this archive reads most of its reports from.'
        : (f.bio || 'A recorded figure in this archive.'),
    };
  }
  function statsHtml() {
    const t = ChronoData.totals();
    const rows = [[t.figures, 'Figures'], [t.reports, 'Hadiths'], [t.places, 'Places'], [t.dynasties, 'Dynasties']];
    return `<div class="ov8-stats">${rows.map(([n, l]) => `<span class="ov8-stat"><b>${fmt.format(n)}</b><span>${esc(l)}</span></span>`).join('')}</div>`;
  }

  const EXPLORE = [
    { id: 'explore:history', kicker: '01 / HISTORICAL CONTEXT', title: 'Moments in time.',
      desc: 'Browse events in chronological order and discover how they connect across the record.',
      cta: 'EXPLORE HISTORY ↗', href: '#history?view=timeline' },
    { id: 'explore:graph', kicker: '02 / NETWORK', title: 'Follow the connections.',
      desc: 'Open people, places, and works from a single point of reference.',
      cta: 'EXPLORE GRAPH ↗', href: '#graph' },
  ];
  function exploreHtml() {
    return `
      <section class="ov8-explore" aria-labelledby="ov8ExploreTitle">
        <h2 class="ov8-explore-title" id="ov8ExploreTitle">EXPLORE THE RECORD</h2>
        <p class="ov8-explore-sub">Discover the stories. Trace historical moments and the people and records associated with them.</p>
        <div class="ov8-explore-grid">
          ${EXPLORE.map((c) => `
            <article class="ov8-explore-card">
              <span class="ov8-kicker">${esc(c.kicker)}</span>
              <h3 class="ov8-explore-card-title">${esc(c.title)}</h3>
              <p class="ov8-explore-card-desc">${esc(c.desc)}</p>
              <a class="dsh-btn primary ov8-explore-cta" href="${c.href}">${esc(c.cta)}</a>
            </article>`).join('')}
        </div>
      </section>`;
  }

  function scholarHtml() {
    const s = featuredScholar();
    if (!s) return '';
    const f = s.figure;
    const meta = [f.role || f.generation, [f.birth, f.death].filter(Boolean).join(' – '), (f.locations || [])[0]].filter(Boolean).join(' · ');
    return `
      <section class="ov8-scholar" aria-label="Featured scholar">
        <span class="ov8-kicker cyan">FEATURED SCHOLAR</span>
        ${f.arabic ? `<div class="ov8-scholar-ar" dir="rtl" lang="ar">${esc(f.arabic)}</div>` : ''}
        <h3 class="ov8-scholar-name">${esc(f.name)}</h3>
        <div class="ov8-scholar-meta">${esc(meta)}</div>
        <p class="ov8-scholar-desc">${esc(s.desc)}</p>
        <div class="ov8-scholar-stats">
          <span class="ov8-scholar-stat"><b>${ChronoData.reportsOfFigure(f.id).length}</b><span>HADITH REFS</span></span>
          <span class="ov8-scholar-stat"><b>${connectionsOf(f.id)}</b><span>CONNECTIONS</span></span>
        </div>
        <a class="dsh-btn primary" href="${esc(ChronoData.links.figure(f.id))}">READ THE FULL BIOGRAPHY →</a>
      </section>`;
  }

  function hodHtml() {
    return `
      <section aria-label="Hadith of the Day" class="ov8-hod" id="hadithOfDay">
        <div class="hod-eyebrow"><span class="hod-star" data-icon="hod"></span><span>Hadith of the Day</span></div>
        <div class="hod-arabic" dir="rtl" id="hodArabic" lang="ar">—</div>
        <div class="hod-translation" id="hodTranslation">—</div>
        <div class="hod-meta">
          <span class="hod-badge" id="hodGrade">—</span>
          <span class="hod-ref" id="hodRef">—</span>
        </div>
        <a class="hod-link" href="#isnad" id="hodLink"><span>See isnad</span><span class="hod-arrow" data-icon="external"></span></a>
      </section>`;
  }
  function shellHtml() {
    return `
      <div class="ov8">
        <section class="ov8-hero">
          <div class="ov8-hero-copy">
            <p class="ov8-kicker">THE ISLAMIC KNOWLEDGE NETWORK / 01</p>
            <h1 class="ov8-title">See how<br>knowledge<br><em>travels.</em></h1>
            <p class="ov8-lead">From the Prophet ﷺ to the people who learned, narrated, and preserved knowledge. Explore the archive through a clear visual system.</p>
            <div class="ov8-cta">
              <a class="dsh-btn primary" href="#graph">ENTER THE GRAPH ↗</a>
              <a class="dsh-btn" href="#figures">BROWSE NARRATORS →</a>
            </div>
            ${statsHtml()}
            <p class="ov8-tagline">PEOPLE / PLACES / EVENTS / CHAINS / A RICHER UNDERSTANDING</p>
          </div>
          <div class="ov-graph-mount" id="ovGraphMount"></div>
        </section>
        ${exploreHtml()}
        ${scholarHtml()}
        ${hodHtml()}
        <footer class="ov8-footer">
          <span class="ov8-footer-tag">Knowledge Connects Generations</span>
          <span class="ov8-footer-ar" dir="rtl" lang="ar">السيرة النبوية</span>
          <nav class="ov8-footer-links" aria-label="About this archive">
            <button class="ov8-footer-btn" type="button" data-action="About">About</button>
            <span aria-hidden="true">|</span>
            <a class="ov8-footer-btn" href="#library?tab=books">Sources</a>
            <span aria-hidden="true">|</span>
            <button class="ov8-footer-btn" type="button" data-action="Feedback">Feedback</button>
          </nav>
        </footer>
      </div>`;
  }

  async function render(host) {
    if (typeof OverviewGraph !== 'undefined') OverviewGraph.unmount();
    await ChronoData.load();
    if (!host.isConnected) return;
    const ep = epigraph();
    onPage = { fields: FIELDS, explore: EXPLORE, scholar: featuredScholar(), verse: ep ? ep.event : null };
    host.innerHTML = shellHtml();
    if (typeof Icons !== 'undefined' && Icons.init) Icons.init(host);
    if (typeof OverviewGraph !== 'undefined') {
      OverviewGraph.mount(host.querySelector('#ovGraphMount'));
    }
    const fx = document.createElement('div');
    fx.className = 'ov8-particles';
    fx.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('span');
      p.style.left = (Math.random() * 100).toFixed(2) + '%';
      p.style.animationDuration = (14 + Math.random() * 16).toFixed(2) + 's';
      p.style.animationDelay = (-Math.random() * 20).toFixed(2) + 's';
      p.style.opacity = (0.15 + Math.random() * 0.35).toFixed(2);
      fx.appendChild(p);
    }
    host.prepend(fx);
    const ar = document.getElementById('bandVerseAr');
    const en = document.getElementById('bandVerseEn');
    const rf = document.getElementById('bandVerseRef');
    if (ep && ar && en && rf) {
      ar.textContent = ep.quote.arabic;
      en.textContent = `“${ep.quote.english}”`;
      rf.textContent = `— ${ep.quote.ref || ep.event.name} ↗`;
    }
    if (typeof HadithOfDay !== 'undefined' && HadithOfDay.init) HadithOfDay.init(DataLoader.listHadiths());
  }

  function searchScope() {
    const built = [
      ...onPage.fields.map((f) => ({
        id: `field:${f.key}`, label: `${f.num} ${f.label}`, group: 'field', meta: 'Route',
        sub: `${f.sub} · ${fmt.format(f.count())} ${f.unit}`, icon: f.icon, colour: f.colour, href: f.href,
        hay: `${f.label} ${f.sub} ${f.key} field route`.toLowerCase() })),
      ...onPage.explore.map((c) => ({
        id: c.id, label: c.title, group: 'explore', meta: 'Explore', sub: c.kicker,
        icon: 'calendar', colour: 'var(--teal)', href: c.href,
        hay: `${c.title} ${c.desc} ${c.kicker}`.toLowerCase() })),
    ];
    if (onPage.scholar) {
      const f = onPage.scholar.figure;
      built.push({ id: 'scholar', label: f.name, group: 'explore', meta: 'Featured scholar',
        sub: [f.role, f.birth, f.death].filter(Boolean).join(' · '), icon: 'people', colour: 'var(--gold)',
        href: ChronoData.links.figure(f.id), hay: `${f.name} ${f.arabic || ''} featured scholar`.toLowerCase() });
    }
    if (onPage.verse) {
      const e = onPage.verse;
      built.push({ id: 'verse', label: e.quote.ref || e.name, group: 'verse', meta: 'Verse', sub: e.name,
        icon: 'bookmark', colour: 'var(--gold)', href: ChronoData.links.event(e.id, 'overview'),
        hay: `${e.quote.ref || ''} ${e.quote.english || ''} ${e.name} verse`.toLowerCase() });
    }
    let chip = 'all';
    return {
      label: 'Overview',
      placeholder: 'Search shortcuts, fields, explore cards and featured records…',
      hint: 'Overview route fields, explore cards, featured scholar and the band verse',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'Everything on the page', count: built.length },
        { key: 'field', label: 'fields', count: built.filter((r) => r.group === 'field').length },
        { key: 'explore', label: 'explore', count: built.filter((r) => r.group === 'explore').length },
        { key: 'verse', label: 'verse', count: built.filter((r) => r.group === 'verse').length },
      ].filter((c) => c.count > 0),
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built.filter((r) => chip === 'all' || r.group === chip).filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => { const row = built.find((r) => r.id === id); if (row) location.hash = row.href; },
    };
  }

  return { render, searchScope };
})();
