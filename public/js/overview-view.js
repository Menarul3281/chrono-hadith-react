const OverviewView = (() => {
  const esc = ChronoData.esc;
  const fmt = new Intl.NumberFormat('en-US');
  let onPage = { sections: [], records: [], report: null, scholar: null };

  const SECTION_DEFS = [
    {
      id: 'overview', num: '01', label: 'Overview', href: '#overview', icon: 'overview',
      purpose: 'Introduces the archive and highlights its major connected areas.',
      meta: (t) => `${fmt.format(totalRecords(t))} loaded records`,
    },
    {
      id: 'isnad', num: '02', label: 'Isnad', href: '#isnad', icon: 'isnad',
      purpose: 'Traces a selected report through its ordered chain of transmission.',
      meta: (t) => `${fmt.format(t.reports)} hadith reports`,
    },
    {
      id: 'graph', num: '03', label: 'Graph', href: '#graph', icon: 'graph',
      purpose: 'Displays records and documented relationships on an interactive React Flow board.',
      meta: () => {
        const count = typeof GraphView !== 'undefined' && GraphView.allNodes ? GraphView.allNodes().length : 0;
        return count ? `${fmt.format(count)} graph nodes` : 'Documented relationships';
      },
    },
    {
      id: 'history', num: '04', label: 'History', href: '#history?view=timeline', icon: 'timeline',
      purpose: 'Combines the timeline, events, places, historical periods, and lifespans.',
      meta: (t) => `${fmt.format(t.events)} events · ${fmt.format(t.places)} places`,
    },
    {
      id: 'figures', num: '05', label: 'Figures', href: '#figures', icon: 'people',
      purpose: 'Explores companions, narrators, scholars, and related biographical records.',
      meta: (t) => `${fmt.format(t.figures)} figure records`,
    },
    {
      id: 'library', num: '06', label: 'Library', href: '#library?tab=hadiths', icon: 'books',
      purpose: 'Browses hadith reports and books through one unified section.',
      meta: (t) => `${fmt.format(t.reports)} reports · ${fmt.format(t.books)} books`,
    },
    {
      id: 'dynasties', num: '07', label: 'Dynasties', href: '#dynasties', icon: 'crown',
      purpose: 'Presents caliphates, dynasties, rulers, regions, and historical context.',
      meta: (t) => `${fmt.format(t.dynasties)} dynasties · ${fmt.format(t.rulers)} rulers`,
    },
  ];

  const RECORD_DEFS = [
    {
      id: 'narrators', label: 'Narrators', icon: 'people',
      count: (t) => t.figures,
      desc: 'Names, generations, teachers, students, locations, biographies, and sources.',
    },
    {
      id: 'reports', label: 'Hadith reports', icon: 'hadiths',
      count: (t) => t.reports,
      desc: 'Collections, references, grades, text, primary narrators, and ordered chains.',
    },
    {
      id: 'events', label: 'Events', icon: 'calendar',
      count: (t) => t.events,
      desc: 'Dates, eras, places, participants, context, significance, and citations.',
    },
    {
      id: 'places', label: 'Places', icon: 'places',
      count: (t) => t.places,
      desc: 'Regions, zones, coordinates, approximation flags, milestones, and sources.',
    },
    {
      id: 'dynasties', label: 'Dynasties', icon: 'crown',
      count: (t) => t.dynasties,
      desc: 'Dates, capitals, regions, government, contributions, and sources.',
    },
    {
      id: 'rulers', label: 'Rulers', icon: 'crown',
      count: (t) => t.rulers,
      desc: 'Titles, reign dates, dynasty references, profile links where present, and sources.',
    },
    {
      id: 'books', label: 'Books', icon: 'books',
      count: (t) => t.books,
      desc: 'Categories, authors, languages, regions, notes, and citations.',
    },
  ];

  function totalRecords(t) {
    return t.figures + t.reports + t.events + t.places + t.dynasties + t.rulers + t.books;
  }

  function sections(t) {
    return SECTION_DEFS.map((section) => ({ ...section, metaText: section.meta(t) }));
  }

  function records(t) {
    return RECORD_DEFS.map((record) => ({ ...record, countValue: record.count(t) }));
  }

  function featuredReport() {
    const reports = ChronoData.allReports();
    const report = reports.find((h) =>
      h.collection === 'Sahih al-Bukhari' && Array.isArray(h.chain) && h.chain.length >= 4)
      || reports.find((h) => Array.isArray(h.chain) && h.chain.length >= 4)
      || reports[0]
      || null;
    if (!report) return null;

    const chain = (report.chain || []).map((link, index) => ({
      ...link,
      index,
      figure: ChronoData.figure(link.narratorId),
    })).filter((link) => link.figure);

    return {
      report,
      chain,
      narrator: ChronoData.figure(report.narratorId),
      book: ChronoData.bookOfReport(report),
      places: ChronoData.placesOfReport(report),
    };
  }

  function featuredScholar() {
    const figure = ChronoData.figure('bukhari')
      || ChronoData.allFigures().find((item) => item.generation === 'compiler')
      || ChronoData.allFigures()[0]
      || null;
    if (!figure) return null;
    return {
      figure,
      reports: ChronoData.reportsOfFigure(figure.id),
      books: ChronoData.booksOfFigure(figure.id),
      places: ChronoData.placesOfFigure(figure.id),
    };
  }

  function archiveIndexHtml(items, total) {
    return `
      <aside class="ovx-index" aria-label="Archive inventory">
        <div class="ovx-index-head">
          <span class="ovx-eyebrow">LIVE ARCHIVE INVENTORY</span>
          <strong>${fmt.format(total)}</strong>
          <p>Loaded records across the seven record families used by this overview.</p>
        </div>
        <div class="ovx-index-grid">
          ${items.map((item, index) => `
            <div class="ovx-index-item" style="--i:${index}">
              <span class="ovx-index-icon" data-icon="${esc(item.icon)}" aria-hidden="true"></span>
              <span class="ovx-index-copy">
                <b>${fmt.format(item.countValue)}</b>
                <span>${esc(item.label)}</span>
              </span>
            </div>`).join('')}
        </div>
        <p class="ovx-index-note">Counts are derived from the source records at runtime.</p>
      </aside>`;
  }

  function sectionCardsHtml(items) {
    return `
      <section class="ovx-lenses" aria-labelledby="ovxLensesTitle">
        <div class="ovx-section-heading">
          <span class="ovx-eyebrow">SEVEN WAYS INTO THE ARCHIVE</span>
          <h2 id="ovxLensesTitle">Choose the question you want to ask.</h2>
          <p>The same archive can be read as transmission, relationship, chronology, biography, source material, or political history.</p>
        </div>
        <div class="ovx-lens-grid">
          ${items.map((item, index) => `
            <a class="ovx-lens-card ovx-lens-${esc(item.id)}" href="${esc(item.href)}"
              ${item.id === 'overview' ? 'aria-current="page"' : ''}
              style="--i:${index}">
              <span class="ovx-lens-top">
                <span class="ovx-lens-num">${esc(item.num)}</span>
                <span class="ovx-lens-icon" data-icon="${esc(item.icon)}" aria-hidden="true"></span>
              </span>
              <span class="ovx-lens-body">
                <strong>${esc(item.label)}</strong>
                <span>${esc(item.purpose)}</span>
              </span>
              <span class="ovx-lens-meta">${esc(item.metaText)}</span>
              <span class="ovx-lens-arrow" aria-hidden="true">↗</span>
            </a>`).join('')}
        </div>
      </section>`;
  }

  function reportChainHtml(data) {
    if (!data) return '';
    const { report, chain, narrator, book, places } = data;
    const grade = report.grade ? ` · ${report.grade}` : '';
    return `
      <section class="ovx-chain-section" aria-labelledby="ovxChainTitle">
        <div class="ovx-chain-intro">
          <span class="ovx-eyebrow">A REAL RECORD, CONNECTED</span>
          <h2 id="ovxChainTitle">One report. Its actual chain.</h2>
          <p>This preview is built directly from <code>hadith.chain</code>. Every displayed narrator resolves to a narrator record in the archive.</p>
          <a class="ovx-btn ovx-btn-primary" href="${esc(ChronoData.links.hadith(report.id))}">Open this report in Isnad <span aria-hidden="true">↗</span></a>
        </div>

        <div class="ovx-chain-panel">
          <header class="ovx-report-head">
            <div>
              <span class="ovx-report-label">HADITH REPORT</span>
              <strong>${esc(report.reference)}</strong>
            </div>
            <span class="ovx-report-grade">${esc(report.collection + grade)}</span>
          </header>

          <div class="ovx-chain-scroll" tabindex="0" aria-label="Ordered hadith chain">
            <ol class="ovx-chain">
              ${chain.map((link, index) => `
                <li class="ovx-chain-step" data-chain-step="${index}">
                  <a href="${esc(ChronoData.links.figure(link.figure.id))}">
                    <span class="ovx-chain-index">${String(index + 1).padStart(2, '0')}</span>
                    <span class="ovx-chain-node">
                      ${link.figure.arabic ? `<span class="ovx-chain-ar" dir="rtl" lang="ar">${esc(link.figure.arabic)}</span>` : ''}
                      <strong>${esc(link.figure.name)}</strong>
                      <small>${esc(link.role || link.figure.role || link.figure.generation)}</small>
                    </span>
                  </a>
                </li>`).join('')}
            </ol>
          </div>

          <div class="ovx-context-grid">
            ${narrator ? `
              <a class="ovx-context-card" href="${esc(ChronoData.links.figure(narrator.id))}">
                <span>PRIMARY NARRATOR</span><strong>${esc(narrator.name)}</strong>
              </a>` : ''}
            ${book ? `
              <a class="ovx-context-card" href="#library?tab=books">
                <span>COLLECTION RECORD</span><strong>${esc(book.name)}</strong>
              </a>` : ''}
            ${places.length ? `
              <a class="ovx-context-card" href="#history?view=places">
                <span>RECORDED PLACE${places.length > 1 ? 'S' : ''}</span><strong>${esc(places.map((place) => place.name).join(' · '))}</strong>
              </a>` : ''}
            <div class="ovx-context-card">
              <span>CHAIN LENGTH</span><strong>${fmt.format(chain.length)} resolved links</strong>
            </div>
          </div>
        </div>
      </section>`;
  }

  function recordTypesHtml(items) {
    return `
      <section class="ovx-records" aria-labelledby="ovxRecordsTitle">
        <div class="ovx-section-heading compact">
          <span class="ovx-eyebrow">WHAT THE ARCHIVE ACTUALLY STORES</span>
          <h2 id="ovxRecordsTitle">Seven record families. Explicit fields.</h2>
          <p>These are the current JSON-backed record types used across the app.</p>
        </div>
        <div class="ovx-record-grid">
          ${items.map((item, index) => `
            <article class="ovx-record-card" style="--i:${index}">
              <div class="ovx-record-top">
                <span class="ovx-record-icon" data-icon="${esc(item.icon)}" aria-hidden="true"></span>
                <b>${fmt.format(item.countValue)}</b>
              </div>
              <h3>${esc(item.label)}</h3>
              <p>${esc(item.desc)}</p>
            </article>`).join('')}
        </div>
      </section>`;
  }

  function scholarHtml(data) {
    if (!data) return '';
    const { figure, reports, books, places } = data;
    const dates = [figure.birth, figure.death].filter(Boolean).join(' – ');
    const meta = [figure.role || figure.generation, dates, ...(figure.locations || []).slice(0, 3)].filter(Boolean);
    return `
      <section class="ovx-feature" aria-labelledby="ovxFeatureTitle">
        <div class="ovx-feature-copy">
          <span class="ovx-eyebrow">FEATURED FIGURE FROM THE DATASET</span>
          ${figure.arabic ? `<div class="ovx-feature-ar" dir="rtl" lang="ar">${esc(figure.arabic)}</div>` : ''}
          <h2 id="ovxFeatureTitle">${esc(figure.name)}</h2>
          <div class="ovx-feature-meta">${esc(meta.join(' · '))}</div>
          ${figure.bio ? `<p class="ovx-feature-bio">${esc(figure.bio)}</p>` : ''}
          <a class="ovx-btn ovx-btn-primary" href="${esc(ChronoData.links.figure(figure.id))}">Open figure profile <span aria-hidden="true">↗</span></a>
        </div>
        <div class="ovx-feature-facts" aria-label="Featured figure relationships">
          <div><b>${fmt.format(reports.length)}</b><span>Report references</span></div>
          <div><b>${fmt.format(books.length)}</b><span>Catalogued books</span></div>
          <div><b>${fmt.format(places.length)}</b><span>Matched places</span></div>
          <div><b>${fmt.format((figure.teachers || []).length)}</b><span>Teacher IDs</span></div>
        </div>
      </section>`;
  }

  function integrityHtml() {
    const rules = [
      ['01', 'Chains resolve', 'Every chain narrator ID must resolve to a narrator record, and a hadith chain begins with the Prophet ﷺ.'],
      ['02', 'Relations are explicit', 'Records are connected only when the included data carries the supporting ID, field, or citation.'],
      ['03', 'Uncertainty stays visible', 'Approximate or contested information is marked instead of being presented as certain.'],
      ['04', 'Counts are derived', 'Archive totals are calculated from the source records instead of being duplicated manually.'],
    ];
    return `
      <section class="ovx-integrity" aria-labelledby="ovxIntegrityTitle">
        <div class="ovx-integrity-head">
          <span class="ovx-eyebrow">INTEGRITY RULES</span>
          <h2 id="ovxIntegrityTitle">The interface should never claim more than the data can support.</h2>
        </div>
        <div class="ovx-integrity-grid">
          ${rules.map(([num, title, body]) => `
            <article>
              <span>${num}</span>
              <h3>${esc(title)}</h3>
              <p>${esc(body)}</p>
            </article>`).join('')}
        </div>
      </section>`;
  }

  function shellHtml(data) {
    const { totals, sections: sectionItems, records: recordItems, report, scholar } = data;
    return `
      <div class="ovx" data-ovx-root>
        <section class="ovx-hero" aria-labelledby="ovxTitle">
          <div class="ovx-hero-copy">
            <span class="ovx-eyebrow">CHRONO—HADITH · CONNECTED ISLAMIC ARCHIVE</span>
            <h1 id="ovxTitle">Read the archive<br><em>as a connected record.</em></h1>
            <p class="ovx-intro">An interactive Islamic knowledge atlas for exploring hadith transmission, narrators, historical events, places, dynasties, books, and the relationships between them.</p>
            <div class="ovx-actions">
              <a class="ovx-btn ovx-btn-primary" href="#graph">Explore the graph <span aria-hidden="true">↗</span></a>
              <a class="ovx-btn" href="#isnad">Open Isnad <span aria-hidden="true">→</span></a>
            </div>
            <div class="ovx-hero-proof" aria-label="Archive status">
              <span><b>${fmt.format(totals.reports)}</b> reports</span>
              <span><b>${fmt.format(totals.figures)}</b> narrators & figures</span>
              <span><b>${fmt.format(totals.events)}</b> historical events</span>
            </div>
          </div>
          ${archiveIndexHtml(recordItems, totalRecords(totals))}
        </section>

        ${sectionCardsHtml(sectionItems)}
        ${reportChainHtml(report)}
        ${recordTypesHtml(recordItems)}
        ${scholarHtml(scholar)}
        ${integrityHtml()}

        <footer class="ovx-footer">
          <div>
            <strong>CHRONO—HADITH</strong>
            <span>Curated sample dataset · relationships remain source-bound.</span>
          </div>
          <nav aria-label="Overview footer">
            <a href="#library?tab=books">Sources</a>
            <a href="#graph">Graph</a>
            <a href="#history?view=timeline">History</a>
          </nav>
        </footer>
      </div>`;
  }

  async function render(host) {
    await ChronoData.load();
    if (!host.isConnected) return;

    const totals = ChronoData.totals();
    const data = {
      totals,
      sections: sections(totals),
      records: records(totals),
      report: featuredReport(),
      scholar: featuredScholar(),
    };
    onPage = data;

    host.innerHTML = shellHtml(data);
    if (typeof Icons !== 'undefined' && Icons.init) Icons.init(host);
    window.dispatchEvent(new CustomEvent('chrono:overview-rendered'));
  }

  function searchScope() {
    const built = [
      ...onPage.sections.map((item) => ({
        id: `section:${item.id}`,
        label: item.label,
        group: 'section',
        meta: 'Section',
        sub: item.purpose,
        icon: item.icon,
        colour: 'var(--teal)',
        href: item.href,
        hay: `${item.label} ${item.purpose} ${item.metaText}`.toLowerCase(),
      })),
      ...onPage.records.map((item) => ({
        id: `record:${item.id}`,
        label: item.label,
        group: 'record',
        meta: 'Record family',
        sub: `${fmt.format(item.countValue)} loaded records`,
        icon: item.icon,
        colour: 'var(--gold)',
        href: item.id === 'reports' ? '#library?tab=hadiths'
          : item.id === 'books' ? '#library?tab=books'
            : item.id === 'narrators' ? '#figures'
              : item.id === 'events' ? '#history?view=events'
                : item.id === 'places' ? '#history?view=places'
                  : item.id === 'dynasties' || item.id === 'rulers' ? '#dynasties'
                    : '#overview',
        hay: `${item.label} ${item.desc}`.toLowerCase(),
      })),
    ];

    if (onPage.report?.report) {
      const report = onPage.report.report;
      built.push({
        id: 'featured:report',
        label: report.reference,
        group: 'featured',
        meta: 'Featured report',
        sub: report.collection,
        icon: 'hadiths',
        colour: 'var(--gold)',
        href: ChronoData.links.hadith(report.id),
        hay: `${report.reference} ${report.collection} ${report.grade || ''}`.toLowerCase(),
      });
    }

    if (onPage.scholar?.figure) {
      const figure = onPage.scholar.figure;
      built.push({
        id: 'featured:figure',
        label: figure.name,
        group: 'featured',
        meta: 'Featured figure',
        sub: [figure.role, figure.birth, figure.death].filter(Boolean).join(' · '),
        icon: 'people',
        colour: 'var(--cyan)',
        href: ChronoData.links.figure(figure.id),
        hay: `${figure.name} ${figure.arabic || ''} ${figure.bio || ''}`.toLowerCase(),
      });
    }

    let chip = 'all';
    return {
      label: 'Overview',
      placeholder: 'Search sections, record families and featured records…',
      hint: 'Overview sections, record families and featured records',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'Everything', count: built.length },
        { key: 'section', label: 'sections', count: built.filter((row) => row.group === 'section').length },
        { key: 'record', label: 'record types', count: built.filter((row) => row.group === 'record').length },
        { key: 'featured', label: 'featured', count: built.filter((row) => row.group === 'featured').length },
      ].filter((item) => item.count > 0),
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((row) => chip === 'all' || row.group === chip)
        .filter((row) => !query || row.hay.includes(query)),
      onPick: (id) => {
        const row = built.find((item) => item.id === id);
        if (row) location.hash = row.href;
      },
    };
  }

  return { render, searchScope };
})();
