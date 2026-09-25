/* Books view — the primary and secondary sources the archive rests on.
   Route: #books, deep links #books?id=<bookId>&tab=<n>&book=<id>.

   Three columns: filters, the shelf, and the selected work. The page carries no
   search field of its own — the shared topbar picker is the only text search —
   and no page title, which lives in the topbar. */

const BooksView = (() => {
  const SORTS = [
    ['relevance', 'Relevance'],
    ['name', 'Name'],
    ['author', 'Author'],
    ['chronological', 'Chronological'],
    ['category', 'Category'],
    ['referenced', 'Most Referenced'],
  ];

  const TABS = ['Overview', 'Contents', 'Key People', 'Related Books', 'Citations'];

  const state = {
    categories: new Set(), eras: new Set(), languages: new Set(), authors: new Set(),
    sort: 'relevance', view: 'grid', query: '',
    onlyBookmarked: false,
    selectedId: null, tab: 0, source: null, host: null,
  };

  const esc = ChronoData.esc;

  /* ---- bookmarks ---------------------------------------------------------
     Kept in localStorage under one key, so a reader's shelf survives a reload
     and is never confused with the archive's own data. */

  const BOOKMARK_KEY = 'chrono-hadith:bookmarks';

  function loadBookmarks() {
    try {
      const raw = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw.filter((id) => ChronoData.book(id)) : []);
    } catch { return new Set(); }
  }
  function saveBookmarks(set) {
    try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set])); }
    catch { /* private mode: the star simply does not persist */ }
  }

  let bookmarks = new Set();

  function toggleBookmark(id) {
    if (bookmarks.has(id)) bookmarks.delete(id); else bookmarks.add(id);
    saveBookmarks(bookmarks);
    const on = bookmarks.has(id);
    window.showToast?.(on ? 'Added to your bookmarks' : 'Removed from your bookmarks');
    renderCenter();
    renderSide();
    renderPanel();
  }

  /* Eras are windows on the compiler's death year, and the label says which
     window it is, so a bucket never implies more precision than the data has. */
  const ERAS = [
    { key: 'e2', label: '2nd century AH or earlier', from: null, to: 800 },
    { key: 'e3', label: '3rd century AH', from: 801, to: 900 },
    { key: 'e4', label: '4th century AH', from: 901, to: 1000 },
    { key: 'e56', label: '5th – 6th century AH', from: 1001, to: 1200 },
    { key: 'e78', label: '7th – 8th century AH', from: 1201, to: 1400 },
    { key: 'e911', label: '9th – 11th century AH', from: 1401, to: 1600 },
    { key: 'e12', label: '12th century AH or later', from: 1601, to: null },
  ];

  const eraOf = (b) => (typeof b.death === 'number'
    ? ERAS.find((e) => (e.from == null || b.death >= e.from) && (e.to == null || b.death <= e.to))
    : null);

  const authorKeys = (b) => (b.authorIds?.length ? b.authorIds : b.authors);

  // ---- selection ---------------------------------------------------------

  function matches(b, skip) {
    if (skip !== 'q' && state.query && !hay(b).includes(state.query)) return false;
    if (skip !== 'category' && state.categories.size && !state.categories.has(b.category)) return false;
    if (skip !== 'era' && state.eras.size) {
      const era = eraOf(b);
      if (!era || !state.eras.has(era.key)) return false;
    }
    if (skip !== 'language' && state.languages.size && !state.languages.has(b.language)) return false;
    if (skip !== 'author' && state.authors.size) {
      const keys = authorKeys(b).map(String);
      if (!keys.some((k) => state.authors.has(k))) return false;
    }
    if (state.onlyBookmarked && !bookmarks.has(b.id)) return false;
    return true;
  }

  function hay(b) {
    return [
      b.name, b.arabic, b.full, b.category, b.language, b.region, b.note, b.generation,
      b.authors.join(' '), (b.sources || []).join(' '),
      eventsOfBookTitles(b.id), dynastiesOfBookTitles(b.id),
    ].join(' ').toLowerCase();
  }
  const eventsOfBookTitles = (id) => ChronoData.eventsOfBook(id).map((e) => e.name).join(' ');
  const dynastiesOfBookTitles = (id) => ChronoData.dynastiesOfBook(id).map((d) => d.name).join(' ');

  const filtered = (skip) => ChronoData.allBooks().filter((b) => matches(b, skip));

  function sorted(list) {
    const out = list.slice();
    switch (state.sort) {
      case 'name': out.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'author': out.sort((a, b) => (a.authors[0] || '').localeCompare(b.authors[0] || '')); break;
      case 'chronological': out.sort((a, b) => (a.death || 9999) - (b.death || 9999)); break;
      case 'category': out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)); break;
      case 'referenced': out.sort((a, b) => ChronoData.reportsOfBook(b.id).length - ChronoData.reportsOfBook(a.id).length); break;
      default:
        // Relevance without a query keeps the shelf in a documented order:
        // collections first, then the works the archive cites most.
        out.sort((a, b) => {
          const ra = ChronoData.reportsOfBook(a.id).length;
          const rb = ChronoData.reportsOfBook(b.id).length;
          if (ra !== rb) return rb - ra;
          return (a.death || 9999) - (b.death || 9999) || a.name.localeCompare(b.name);
        });
    }
    return out;
  }

  const selected = () => ChronoData.book(state.selectedId) || sorted(filtered())[0] || null;

  // ---- markup ------------------------------------------------------------

  const stat = (icon, value, label, colour) => `
    <div class="dsh-counter" style="--c:${colour}">
      <span class="dsh-counter-ico" data-icon="${icon}"></span>
      <span class="dsh-counter-copy">
        <span class="dsh-counter-num">${value}</span>
        <span class="dsh-counter-lbl">${esc(label)}</span>
      </span>
    </div>`;

  function statsHtml() {
    const t = ChronoData.totals();
    return `
      <div class="dsh-counters">
        ${stat('books', t.books, 'Works catalogued', 'var(--gold)')}
        ${stat('hadiths', t.collectionsWithReports, 'Collections with reports', 'var(--teal)')}
        ${stat('scroll', t.reports, 'Reports digitised', 'var(--blue)')}
        ${stat('people', t.figures, 'Figures in the archive', 'var(--purple)')}
      </div>`;
  }

  const checkRow = (group, key, label, count, disabled) => {
    const set = group === 'category' ? state.categories : group === 'era' ? state.eras : state.languages;
    return `
      <label class="dsh-check${disabled ? ' is-empty' : ''}">
        <input type="checkbox" data-bk="${group}" value="${esc(key)}"${set.has(key) ? ' checked' : ''}${disabled ? ' disabled' : ''}>
        <span class="dsh-box" aria-hidden="true"></span>
        <span class="dsh-check-label">${esc(label)}</span>
        <span class="dsh-check-count">${count}</span>
      </label>`;
  };

  function sidebarHtml() {
    const cats = ChronoData.BOOK_CATEGORIES.map((c) => ({
      key: c, count: ChronoData.allBooks().filter((b) => b.category === c).length,
    }));
    const eras = ERAS.map((e) => ({
      ...e, count: ChronoData.allBooks().filter((b) => eraOf(b)?.key === e.key).length,
    }));
    const langs = [...new Set(ChronoData.allBooks().map((b) => b.language))].sort().map((l) => ({
      key: l, count: ChronoData.allBooks().filter((b) => b.language === l).length,
    }));
    const authorCounts = new Map();
    ChronoData.allBooks().forEach((b) => authorKeys(b).forEach((k) => {
      authorCounts.set(k, (authorCounts.get(k) || 0) + 1);
    }));
    const authors = [...authorCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return `
      <div class="dsh-group">
        <h2 class="dsh-group-title">Category</h2>
        ${cats.map((c) => checkRow('category', c.key, c.key, c.count, c.count === 0)).join('')}
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Era of the compiler</h2>
        ${eras.map((e) => checkRow('era', e.key, e.label, e.count, e.count === 0)).join('')}
        <p class="dsh-footnote">Buckets by death year where it is recorded; a work without one matches no bucket.</p>
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Language</h2>
        ${langs.map((l) => checkRow('language', l.key, l.key, l.count)).join('')}
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Author</h2>
        <div class="bk-authors">
          ${authors.map(([key, count]) => {
            const f = ChronoData.figure(key);
            return `<button class="dsh-chip quick${state.authors.has(key) ? ' active' : ''}" type="button"
                      data-author="${esc(key)}">${esc(f ? f.name : key)} <em>${count}</em></button>`;
          }).join('')}
        </div>
      </div>

      <div class="dsh-side-foot stacked">
        <label class="dsh-check bk-only">
          <input type="checkbox" id="bkOnly"${state.onlyBookmarked ? ' checked' : ''}>
          <span class="dsh-box" aria-hidden="true"></span>
          <span class="dsh-check-label">Bookmarked only</span>
          <span class="dsh-check-count">${bookmarks.size}</span>
        </label>
        <button class="dsh-btn primary" type="button" id="bkApply">Apply Filters</button>
        <button class="dsh-btn" type="button" id="bkReset">Reset</button>
        <p class="dsh-footnote">${filtered().length} of ${ChronoData.allBooks().length} works shown</p>
      </div>`;
  }

  const CATEGORY_COLOUR = {
    'Primary Source': 'var(--teal)',
    'Hadith Collections': 'var(--gold)',
    'Seerah & History': 'var(--red)',
    'Biographical Works': 'var(--purple)',
    Tafsir: 'var(--cyan)',
    Fiqh: 'var(--gold)',
    Aqidah: 'var(--blue)',
    Sufism: 'var(--purple)',
    'Language & Linguistics': 'var(--teal-soft)',
    'Adab & Ethics': 'var(--gold)',
    'Sciences & Miscellaneous': 'var(--muted)',
  };

  const starHtml = (b) => `
    <button class="bk-star${bookmarks.has(b.id) ? ' on' : ''}" type="button" data-star="${esc(b.id)}"
            aria-pressed="${bookmarks.has(b.id)}" aria-label="${bookmarks.has(b.id) ? 'Remove bookmark' : 'Bookmark this work'}"
            title="${bookmarks.has(b.id) ? 'Remove bookmark' : 'Bookmark this work'}">
      <span class="nav-icon" data-icon="${bookmarks.has(b.id) ? 'bookmark' : 'bookmark'}"></span>
    </button>`;

  function cardHtml(b) {
    const reports = ChronoData.reportsOfBook(b.id).length;
    const selected = state.selectedId === b.id;
    const author = b.authorIds?.[0] ? ChronoData.figure(b.authorIds[0]) : null;
    return `
      <div class="bk-cell">
        <button class="bk-card${selected ? ' selected' : ''}" type="button" data-book="${esc(b.id)}"
                aria-pressed="${selected}" style="--dot:${CATEGORY_COLOUR[b.category] || 'var(--teal)'}">
          <span class="bk-card-art">${ChronoArt.cover(b, { w: 150, h: 200 })}</span>
          <span class="bk-card-body">
            <span class="bk-badge">${esc(b.category)}</span>
            <span class="bk-card-name">${esc(b.name)}</span>
            <span class="bk-card-author">${author ? esc(author.name) : esc(b.authors[0] || '')}</span>
            <span class="bk-card-meta">${b.death ? `d. ${b.death} CE` : esc(b.generation || '')}</span>
            <span class="bk-card-foot">
              <span class="bk-count${reports ? '' : ' muted'}">${reports ? `${reports} report${reports > 1 ? 's' : ''}` : 'catalogued'}</span>
              <span class="bk-lang">${esc(b.language)}</span>
            </span>
          </span>
        </button>
        ${starHtml(b)}
      </div>`;
  }

  function rowHtml(b) {
    const reports = ChronoData.reportsOfBook(b.id).length;
    const selected = state.selectedId === b.id;
    return `
      <div class="bk-cell list">
        <button class="bk-row${selected ? ' selected' : ''}" type="button" data-book="${esc(b.id)}"
                aria-pressed="${selected}" style="--dot:${CATEGORY_COLOUR[b.category] || 'var(--teal)'}">
          <span class="bk-row-art">${ChronoArt.cover(b, { w: 60, h: 80 })}</span>
          <span class="bk-row-main">
            <span class="bk-row-name">${esc(b.name)}</span>
            <span class="bk-row-sub">${esc(b.authors.join(', '))}${b.death ? ` · d. ${b.death} CE` : ''}</span>
            <span class="bk-row-note">${esc(b.note || '')}</span>
          </span>
          <span class="bk-row-side">
            <span class="bk-badge">${esc(b.category)}</span>
            <span class="bk-count${reports ? '' : ' muted'}">${reports ? `${reports} reports` : 'no digitised reports'}</span>
          </span>
        </button>
        ${starHtml(b)}
      </div>`;
  }

  function centerHtml() {
    const list = sorted(filtered());
    return `
      <div class="bk-toolbar">
        <div class="bk-sorts" role="group" aria-label="Sort by">
          ${SORTS.map(([key, label]) => `
            <button class="dsh-chip quick${state.sort === key ? ' active' : ''}" type="button" data-sort="${key}">${esc(label)}</button>`).join('')}
        </div>
        <div class="dsh-views small" role="group" aria-label="View">
          <button class="dsh-view-btn${state.view === 'grid' ? ' active' : ''}" type="button" data-bkview="grid">
            <span class="nav-icon" data-icon="overview"></span>Grid
          </button>
          <button class="dsh-view-btn${state.view === 'list' ? ' active' : ''}" type="button" data-bkview="list">
            <span class="nav-icon" data-icon="list"></span>List
          </button>
        </div>
      </div>
      <div class="bk-count-line">${list.length} work${list.length === 1 ? '' : 's'} on the shelf${state.query ? ` · matching “${esc(state.query)}”` : ''}</div>
      <div class="bk-shelf ${state.view}">
        ${list.length
          ? (state.view === 'grid' ? list.map(cardHtml).join('') : list.map(rowHtml).join(''))
          : `<div class="dsh-empty">No work matches these filters.<span class="tiny">Reset the filters, or widen the picker search.</span></div>`}
      </div>`;
  }

  // ---- the selected work ------------------------------------------------

  const arrowIcon = () => '<span class="ev-arrow" data-icon="arrow-right"></span>';

  const evRow = (e) => `
    <a class="bk-ev" href="${ChronoData.links.event(e.id, 'books')}" style="--dot:${ChronoData.era(e.era).color}">
      <span class="bk-ev-year">${esc(String(e.year))}</span>
      <span class="bk-ev-name">${esc(e.name)}</span>
      ${arrowIcon()}
    </a>`;

  const dynRow = (d) => `
    <a class="bk-ev" href="${ChronoData.links.dynasty(d.id, 'books')}" style="--dot:${d.colour}">
      <span class="bk-ev-year">${esc(String(d.start))}</span>
      <span class="bk-ev-name">${esc(d.full || d.name)}</span>
      ${arrowIcon()}
    </a>`;

  function peopleHtml(b) {
    const authors = (b.authorIds || []).map((id) => ChronoData.figure(id)).filter(Boolean);
    const others = b.authors.filter((name) => !authors.some((f) => f.name === name));
    const compilers = [...new Map(ChronoData.reportsOfBook(b.id)
      .flatMap((h) => ChronoData.chainFigures(h))
      .filter((f) => f.generation === 'compiler')
      .map((f) => [f.id, f])).values()];

    return `
      <h3 class="ev-subhead">Compiler</h3>
      ${authors.length
        ? `<div class="ev-chiplist">${authors.map((f) => `
            <a class="dsh-chip" href="#figures?id=${esc(f.id)}">${esc(f.name)} · profile</a>`).join('')}</div>`
        : '<p class="ev-note">The compiler of this work is not in the archive yet.</p>'}
      ${others.length ? `<p class="ev-note">Credited as: ${esc(others.join('; '))}.</p>` : ''}

      <h3 class="ev-subhead">Named compilers of its reports</h3>
      ${compilers.length
        ? `<div class="ev-chiplist">${compilers.map((f) => `
            <a class="dsh-chip" href="#figures?id=${esc(f.id)}">${esc(f.name)}</a>`).join('')}</div>`
        : '<p class="ev-note">No digitised report from this work names a compiler held here.</p>'}

      <h3 class="ev-subhead">Places recorded for the compiler</h3>
      ${ChronoData.placesOfBook(b.id).length
        ? `<div class="ev-chiplist">${ChronoData.placesOfBook(b.id).map((p) => `
            <a class="dsh-chip" href="#places?id=${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div>`
        : '<p class="ev-note">No place is recorded for the compiler in this archive.</p>'}
      <p class="ev-note">A place here is where the archive records the compiler as active, not a claim
      about where the work was written.</p>`;
  }

  function relatedHtml(b) {
    const keys = authorKeys(b);
    const sameAuthor = ChronoData.allBooks().filter((x) => x.id !== b.id
      && authorKeys(x).some((k) => keys.includes(k)));
    const sameCategory = ChronoData.allBooks().filter((x) => x.id !== b.id
      && x.category === b.category && !sameAuthor.includes(x)).slice(0, 6);
    const cites = ChronoData.dynastiesOfBook(b.id);

    return `
      <h3 class="ev-subhead">By the same compiler</h3>
      ${sameAuthor.length
        ? `<div class="ev-chiplist">${sameAuthor.map((x) => `<a class="dsh-chip" href="#books?id=${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>`
        : '<p class="ev-note">No other work by this compiler is catalogued.</p>'}

      <h3 class="ev-subhead">Also in ${esc(b.category)}</h3>
      ${sameCategory.length
        ? `<div class="ev-chiplist">${sameCategory.map((x) => `<a class="dsh-chip" href="#books?id=${esc(x.id)}">${esc(x.name)}</a>`).join('')}</div>`
        : '<p class="ev-note">Nothing else in this category yet.</p>'}

      <h3 class="ev-subhead">Dynasties whose record cites it</h3>
      ${cites.length
        ? `<div class="bk-evs">${cites.map(dynRow).join('')}</div>`
        : '<p class="ev-note">No dynasty record cites this work.</p>'}
      <p class="ev-note">A citation here means the archive's own entry for that dynasty names this
      work among its sources — not that the work is about it in general.</p>`;
  }

  function tabHtml(b, index) {
    const reports = ChronoData.reportsOfBook(b.id);
    const events = ChronoData.eventsOfBook(b.id);
    const timelineHref = b.authorIds?.[0]
      ? `#timeline?lane=books&id=book-${esc(b.authorIds[0])}`
      : `#timeline?from=${(b.death || 800) - 40}&to=${(b.death || 800) + 40}`;

    if (index === 0) {
      return `
        <p class="ev-prose">${esc(b.note || '')}</p>
        <dl class="ev-facts">
          <dt>Category</dt><dd>${esc(b.category)}</dd>
          <dt>Compiler</dt><dd>${(b.authorIds || []).map((id) => ChronoData.figure(id))
            .filter(Boolean).map((f) => `<a href="#figures?id=${esc(f.id)}">${esc(f.name)}</a>`).join(', ')
            || esc(b.authors.join(', '))}</dd>
          <dt>Dates</dt><dd>${b.death ? `d. ${b.death} CE` : 'not recorded'}${b.generation ? ` · ${esc(b.generation)}` : ''}</dd>
          <dt>Language</dt><dd>${esc(b.language)}</dd>
          <dt>Region</dt><dd>${esc(b.region || '—')}</dd>
          <dt>Reports digitised</dt><dd>${reports.length
            ? `${reports.length} in this archive`
            : '<span class="ev-no-site">Present in the catalog; no report text digitised yet</span>'}</dd>
        </dl>
        <div class="ev-linkrow">
          ${reports.length ? `<a class="dsh-btn small primary" href="#hadiths?book=${esc(b.id)}">Browse its reports ${arrowIcon()}</a>` : ''}
          ${reports.length ? `<a class="dsh-btn small" href="#isnad?hadith=${esc(reports[0].id)}">Open a report in Isnad ${arrowIcon()}</a>` : ''}
          <a class="dsh-btn small" href="${timelineHref}">Open on the Timeline ${arrowIcon()}</a>
          <a class="dsh-btn small" href="#graph?node=${encodeURIComponent(ChronoData.cid.book(b.id))}">View in Graph ${arrowIcon()}</a>
        </div>`;
    }

    if (index === 1) {
      if (!reports.length) {
        return `<p class="ev-note">This work is in the catalog, but no report from it is digitised in
          this archive yet, so no contents can be listed. Nothing is filled in from memory.</p>`;
      }
      const byBook = new Map();
      reports.forEach((h) => {
        const key = h.book || 'Unclassified';
        byBook.set(key, (byBook.get(key) || []).concat(h));
      });
      return `
        <p class="ev-note">These are the sections the digitised reports actually come from.</p>
        <ul class="bk-contents">
          ${[...byBook.entries()].map(([section, list]) => `
            <li>
              <span class="bk-contents-name">${esc(section)}</span>
              <span class="bk-contents-count">${list.length} report${list.length > 1 ? 's' : ''}</span>
              <span class="bk-contents-refs">${list.map((h) => `
                <a class="dsh-chip" href="#hadiths?id=${esc(h.id)}">${esc(h.reference)}</a>`).join('')}</span>
            </li>`).join('')}
        </ul>`;
    }

    if (index === 2) return peopleHtml(b);
    if (index === 3) return relatedHtml(b);

    return `
      <h3 class="ev-subhead">Where this catalogue entry comes from</h3>
      <ul class="dyp-legacy">${(b.sources || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <h3 class="ev-subhead">Records in this archive that cite it</h3>
      ${events.length
        ? `<div class="bk-evs">${events.map(evRow).join('')}</div>`
        : '<p class="ev-note">No event record cites this work.</p>'}
      <p class="ev-note">Counts are of the records this archive holds; they are not a claim about the
      work's full size.</p>`;
  }

  function panelContentsHtml(b) {
    if (!b) return '<div class="dsh-empty">Select a work.</div>';
    const reports = ChronoData.reportsOfBook(b.id);
    const authors = (b.authorIds || []).map((id) => ChronoData.figure(id)).filter(Boolean);
    return `
      <div class="bk-hero" style="--dot:${CATEGORY_COLOUR[b.category] || 'var(--teal)'}">
        <div class="bk-hero-cover">${ChronoArt.cover(b, { w: 168, h: 224 })}</div>
        <div class="bk-hero-copy">
          <div class="bk-hero-title-row">
            <h2 class="ev-panel-title">${esc(b.name)}</h2>
            ${starHtml(b)}
          </div>
          ${b.arabic ? `<p class="dyp-arabic" lang="ar" dir="rtl">${esc(b.arabic)}</p>` : ''}
          <p class="bk-hero-author">${authors.length
            ? authors.map((f) => `<a href="#figures?id=${esc(f.id)}">${esc(f.name)}</a>`).join(', ')
            : esc(b.authors.join(', '))}</p>
          <p class="bk-hero-dates">${b.death ? `d. ${b.death} CE` : 'dates not recorded'}${b.generation ? ` · ${esc(b.generation)}` : ''}</p>
          <div class="ev-panel-badges">
            <span class="ev-badge era">${esc(b.category)}</span>
            <span class="ev-badge">${esc(b.language)}</span>
            ${reports.length
              ? `<span class="ev-badge type" style="--dot:var(--teal)">${reports.length} report${reports.length > 1 ? 's' : ''} digitised</span>`
              : '<span class="ev-badge soft">no digitised reports</span>'}
          </div>
        </div>
      </div>
      <div class="ev-tabs" role="tablist">
        ${TABS.map((t, i) => `
          <button class="ev-tab${i === state.tab ? ' active' : ''}" type="button" role="tab" data-bktab="${i}"
                  aria-selected="${i === state.tab}">${t}</button>`).join('')}
      </div>
      <div class="ev-tabbody" id="bkTabBody" role="tabpanel">${tabHtml(b, state.tab)}</div>`;
  }

  const panelHtml = (b) => `
    <aside class="dsh-panel bk-panel" id="bkPanel" aria-label="Selected work">
      ${panelContentsHtml(b)}
    </aside>`;

  const shellHtml = () => `
    <div class="dsh bk">
      <div class="bk-top">${statsHtml()}</div>
      <div class="dsh-body">
        <aside class="dsh-side bk-side" id="bkSide" aria-label="Book filters">${sidebarHtml()}</aside>
        <section class="dsh-center bk-center" id="bkCenter" aria-label="Book catalog">${centerHtml()}</section>
        ${panelHtml(selected())}
      </div>
    </div>`;

  /* ---- refresh and selection -------------------------------------------- */

  function renderSide() {
    const host = state.host.querySelector('#bkSide');
    host.innerHTML = sidebarHtml();
    Icons.init(host);
    bindSide(host);
  }

  function renderCenter() {
    const host = state.host.querySelector('#bkCenter');
    const shelf = host.querySelector('.bk-shelf');
    const top = shelf ? shelf.scrollTop : 0;
    host.innerHTML = centerHtml();
    Icons.init(host);
    bindCenter(host);
    const fresh = host.querySelector('.bk-shelf');
    if (fresh) fresh.scrollTop = top;
  }

  function renderPanel() {
    const host = state.host.querySelector('#bkPanel');
    host.innerHTML = panelContentsHtml(selected());
    Icons.init(host);
    bindPanel(host);
  }

  function selectBook(id) {
    if (!ChronoData.book(id)) return;
    state.selectedId = id;
    ChronoData.remember({ bookId: id });
    if (location.hash.startsWith('#books')) {
      history.replaceState(null, '', `#books?id=${encodeURIComponent(id)}`);
    }
    renderCenter();
    renderPanel();
  }

  function on(el, type, fn) {
    const key = `__bkb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  }

  function bindCenter(scope) {
    scope.querySelectorAll('[data-book]').forEach((el) => {
      on(el, 'click', (ev) => {
        if (ev.target.closest?.('a')) return;   // author links inside a card
        selectBook(el.dataset.book);
      });
    });
    scope.querySelectorAll('[data-star]').forEach((el) => {
      on(el, 'click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        toggleBookmark(el.dataset.star);
      });
    });
    scope.querySelectorAll('[data-sort]').forEach((el) => {
      on(el, 'click', () => { state.sort = el.dataset.sort; renderCenter(); });
    });
    scope.querySelectorAll('[data-bkview]').forEach((el) => {
      on(el, 'click', () => { state.view = el.dataset.bkview; renderCenter(); });
    });
  }

  function bindSide(scope) {
    scope.querySelectorAll('input[data-bk]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = cb.dataset.bk === 'category' ? state.categories
          : cb.dataset.bk === 'era' ? state.eras : state.languages;
        if (cb.checked) set.add(cb.value); else set.delete(cb.value);
        state.host.querySelector('#bkApply')?.classList.add('dirty');
      });
    });
    scope.querySelectorAll('[data-author]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.author;
        if (state.authors.has(key)) state.authors.delete(key); else state.authors.add(key);
        renderSide();
        renderCenter();
      });
    });
    scope.querySelector('#bkOnly')?.addEventListener('change', (ev) => {
      state.onlyBookmarked = ev.target.checked;
      renderSide();
      renderCenter();
    });
    scope.querySelector('#bkApply')?.addEventListener('click', () => {
      renderSide();
      renderCenter();
      renderPanel();
    });
    scope.querySelector('#bkReset')?.addEventListener('click', () => {
      state.categories = new Set();
      state.eras = new Set();
      state.languages = new Set();
      state.authors = new Set();
      state.onlyBookmarked = false;
      state.sort = 'relevance';
      renderSide();
      renderCenter();
      renderPanel();
    });
  }

  function bindPanel(scope) {
    scope.querySelectorAll('[data-star]').forEach((el) => {
      on(el, 'click', () => toggleBookmark(el.dataset.star));
    });
    scope.querySelectorAll('[data-bktab]').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.bktab) || 0;
        const body = scope.querySelector('#bkTabBody');
        body.innerHTML = tabHtml(selected(), state.tab);
        Icons.init(body);
        scope.querySelectorAll('[data-bktab]').forEach((b) => {
          const active = Number(b.dataset.bktab) === state.tab;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', String(active));
        });
        bindPanel(scope);
      });
    });
  }

  /* ---- public ------------------------------------------------------------ */

  async function render(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;
    state.host = host;

    const get = (k) => (params && params.get ? params.get(k) : null);
    const stored = ChronoData.recall();

    state.categories = new Set();
    state.eras = new Set();
    state.languages = new Set();
    state.authors = new Set();
    state.onlyBookmarked = false;
    state.sort = 'relevance';
    state.view = 'grid';
    state.tab = Math.max(0, Number(get('tab')) || 0);
    bookmarks = loadBookmarks();

    // The selection: the work in the link, else the one a cross-link named, else
    // the one the reader left behind, else the top of the shelf.
    const wanted = get('id') || get('book') || stored.bookId || null;
    state.selectedId = ChronoData.book(wanted) ? wanted : null;
    if (!state.selectedId) state.selectedId = sorted(filtered())[0]?.id || null;

    host.innerHTML = shellHtml();
    Icons.init(host);
    bindSide(host.querySelector('#bkSide'));
    bindCenter(host.querySelector('#bkCenter'));
    bindPanel(host.querySelector('#bkPanel'));

    if (state.selectedId) {
      ChronoData.remember({ bookId: state.selectedId });
      const q = [`id=${encodeURIComponent(state.selectedId)}`];
      if (state.tab) q.push(`tab=${state.tab}`);
      history.replaceState(null, '', `#books?${q.join('&')}`);
    }
  }

  /* The page's scope for the shared picker: every work in the catalog, with the
     categories as chips, and a pick that selects the work in place. */
  function searchScope() {
    const built = ChronoData.allBooks().map((b) => ({
      id: ChronoData.cid.book(b.id),
      label: b.name,
      group: b.category,
      meta: b.category,
      sub: [b.authors[0], b.death ? `d. ${b.death} CE` : b.generation].filter(Boolean).join(' · '),
      icon: 'books',
      colour: 'var(--gold)',
      hay: hay(b),
    }));
    let chip = 'all';
    return {
      label: 'Books',
      placeholder: 'Search books…',
      hint: 'Title, Arabic title, compiler, category, language, or a record that cites it',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All categories', count: built.length },
        ...ChronoData.BOOK_CATEGORIES
          .map((c) => ({ key: c, label: c, count: built.filter((r) => r.group === c).length }))
          .filter((c) => c.count > 0),
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => {
        const raw = ChronoData.resolve(id).id;
        if (!filtered().some((b) => b.id === raw)) {
          return { hidden: true, message: 'A category, era, language or author filter keeps it off the shelf.' };
        }
        selectBook(raw);
      },
      reveal: (id) => {
        state.categories = new Set();
        state.eras = new Set();
        state.languages = new Set();
        state.authors = new Set();
        renderSide();
        renderCenter();
        selectBook(ChronoData.resolve(id).id);
      },
    };
  }

  return { render, searchScope };
})();
