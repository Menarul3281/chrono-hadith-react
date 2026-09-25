/* Hadiths view — the report library. Route: #hadiths, deep links
   #hadiths?id=<reportId>&tab=<n>&book=<collectionId>.

   Left filters, the report list, and the reader. The Arabic matn is the Arabic
   the archive holds; the English beneath it is the archive's translation, and the
   grade is printed as the source gives it. Where a chain is not recorded, the
   Chain tab says so rather than assembling one. */

const HadithsView = (() => {
  const SORTS = [
    ['relevance', 'Relevance'],
    ['collection', 'Collection'],
    ['chronological', 'Chronological'],
    ['topic', 'Topic'],
    ['narrator', 'Narrator'],
  ];
  const TABS = ['Details', 'Chain', 'Context', 'Connections', 'Related'];

  const state = {
    collections: new Set(), topics: new Set(), narrators: new Set(),
    sort: 'relevance', selectedId: null, tab: 0, host: null, bookFilter: null,
  };

  const esc = ChronoData.esc;

  /* The collections the archive holds reports for, in the order the six books are
     usually listed, with any others after them. */
  const ORDER = ['Sahih al-Bukhari', 'Sahih Muslim', 'Sunan Abi Dawud', "Jami' al-Tirmidhi", "Sunan an-Nasa'i", 'Sunan Ibn Majah'];
  const COLLECTIONS = () => [...new Set(ChronoData.allReports().map((h) => h.collection))]
    .sort((a, b) => {
      const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });

  // The narrators who actually carry a report here, with how many they carry.
  function narratorCounts() {
    const counts = new Map();
    ChronoData.allReports().forEach((h) => {
      const ids = new Set([h.narratorId, ...(h.chain || []).map((l) => l.narratorId)]);
      ids.forEach((id) => { if (id !== 'prophet') counts.set(id, (counts.get(id) || 0) + 1); });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function hay(h) {
    return [
      h.reference, h.collection, h.book, h.number, h.translation, h.arabic, h.grade, h.matnGroup, h.note,
      (h.chain || []).map((l) => ChronoData.figure(l.narratorId)?.name).join(' '),
      ChronoData.bookOfReport(h)?.name,
    ].join(' ').toLowerCase();
  }

  function matches(h, skip) {
    if (skip !== 'collection' && state.collections.size && !state.collections.has(h.collection)) return false;
    if (skip !== 'topic' && state.topics.size) {
      const keys = [`matn:${h.matnGroup}`, `topic:${h.book}`];
      if (!keys.some((k) => state.topics.has(k))) return false;
    }
    if (skip !== 'narrator' && state.narrators.size) {
      const ids = new Set([h.narratorId, ...(h.chain || []).map((l) => l.narratorId)]);
      if (![...ids].some((id) => state.narrators.has(id))) return false;
    }
    if (state.bookFilter && ChronoData.COLLECTION_TO_BOOK[h.collection] !== state.bookFilter) return false;
    return true;
  }

  const filtered = (skip) => ChronoData.allReports().filter((h) => matches(h, skip));

  function sorted(list) {
    const out = list.slice();
    switch (state.sort) {
      case 'collection': out.sort((a, b) => a.collection.localeCompare(b.collection) || Number(a.number) - Number(b.number)); break;
      case 'chronological': out.sort((a, b) => (ChronoData.bookOfReport(a)?.death || 0) - (ChronoData.bookOfReport(b)?.death || 0)); break;
      case 'topic': out.sort((a, b) => (a.book || '').localeCompare(b.book || '')); break;
      case 'narrator': out.sort((a, b) => (ChronoData.figure(a.narratorId)?.name || '').localeCompare(ChronoData.figure(b.narratorId)?.name || '')); break;
      default: out.sort((a, b) => (a.collection.localeCompare(b.collection) || Number(a.number) - Number(b.number)));
    }
    return out;
  }

  const selected = () => ChronoData.report(state.selectedId) || sorted(filtered())[0] || null;

  // ---- markup ------------------------------------------------------------

  const stat = (icon, value, label, colour) => `
    <div class="dsh-counter" style="--c:${colour}">
      <span class="dsh-counter-ico" data-icon="${icon}"></span>
      <span class="dsh-counter-copy">
        <span class="dsh-counter-num">${value}</span>
        <span class="dsh-counter-lbl">${esc(label)}</span>
      </span>
    </div>`;

  const statsHtml = () => {
    const t = ChronoData.totals();
    return `<div class="dsh-counters">
      ${stat('hadiths', t.reports, 'Reports digitised', 'var(--teal)')}
      ${stat('books', t.collectionsWithReports, 'Collections represented', 'var(--gold)')}
      ${stat('people', t.figures, 'Figures in the archive', 'var(--purple)')}
      ${stat('overview', t.topics, 'Topics tagged', 'var(--blue)')}
    </div>`;
  };

  const checkRow = (group, key, label, count) => {
    const set = group === 'collection' ? state.collections : state.topics;
    return `
      <label class="dsh-check">
        <input type="checkbox" data-hd="${group}" value="${esc(key)}"${set.has(key) ? ' checked' : ''}>
        <span class="dsh-box" aria-hidden="true"></span>
        <span class="dsh-check-label">${esc(label)}</span>
        <span class="dsh-check-count">${count}</span>
      </label>`;
  };

  function sidebarHtml() {
    const collections = COLLECTIONS().map((c) => ({
      key: c, count: ChronoData.allReports().filter((h) => h.collection === c).length,
    }));
    const topics = ChronoData.topics().map((t) => ({
      key: t.id, label: t.label, kind: t.kind, count: ChronoData.reportsOfTopic(t.id).length,
    }));
    const narrators = narratorCounts();

    return `
      ${state.bookFilter ? `
        <div class="dsh-group hd-scope">
          <h2 class="dsh-group-title">Collection scope</h2>
          <p class="dsh-footnote">Showing ${esc(ChronoData.book(state.bookFilter)?.name || state.bookFilter)} only
            · <a href="#hadiths" class="hd-clearbook">clear</a></p>
        </div>` : ''}

      <div class="dsh-group">
        <h2 class="dsh-group-title">Collection</h2>
        ${collections.map((c) => checkRow('collection', c.key, c.key, c.count)).join('')}
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Topic</h2>
        ${topics.map((t) => checkRow('topic', t.key, `${t.label} (${t.kind})`, t.count)).join('')}
      </div>

      <div class="dsh-group">
        <h2 class="dsh-group-title">Narrator</h2>
        <div class="hd-narrators">
          ${narrators.map(([id, count]) => {
            const f = ChronoData.figure(id);
            return `<button class="dsh-chip quick${state.narrators.has(id) ? ' active' : ''}" type="button"
                      data-narrator="${esc(id)}" title="${esc(f?.role || '')}">${esc(f?.name || id)} <em>${count}</em></button>`;
          }).join('')}
        </div>
      </div>

      <div class="dsh-side-foot stacked">
        <button class="dsh-btn primary" type="button" id="hdApply">Apply Filters</button>
        <button class="dsh-btn" type="button" id="hdReset">Reset</button>
        <p class="dsh-footnote">${filtered().length} of ${ChronoData.allReports().length} reports shown</p>
      </div>`;
  }

  function listRow(h) {
    const bookRec = ChronoData.bookOfReport(h);
    const selected = state.selectedId === h.id;
    return `
      <button class="hd-card${selected ? ' selected' : ''}" type="button" data-report="${esc(h.id)}"
              aria-pressed="${selected}">
        <span class="hd-card-top">
          <span class="hd-card-ref">${esc(h.reference)}</span>
          <span class="hd-badge">${esc(bookRec?.name || h.collection)}</span>
          ${h.grade ? `<span class="hd-badge grade">${esc(h.grade)}</span>` : ''}
        </span>
        ${h.arabic ? `<span class="hd-card-ar" lang="ar" dir="rtl">${esc(h.arabic)}</span>` : ''}
        <span class="hd-card-en">${esc(h.translation)}</span>
        <span class="hd-card-foot">
          <span class="hd-card-narrator">${esc(ChronoData.figure(h.narratorId)?.name || '')}</span>
          <span class="hd-card-topic">${esc(h.book || '')}</span>
        </span>
      </button>`;
  }

  function centerHtml() {
    const list = sorted(filtered());
    return `
      <div class="bk-toolbar">
        <div class="bk-sorts" role="group" aria-label="Sort by">
          ${SORTS.map(([key, label]) => `
            <button class="dsh-chip quick${state.sort === key ? ' active' : ''}" type="button" data-hdsort="${key}">${esc(label)}</button>`).join('')}
        </div>
        <div class="bk-count-line">${list.length} report${list.length === 1 ? '' : 's'}</div>
      </div>
      <div class="hd-list">
        ${list.length
          ? list.map(listRow).join('')
          : '<div class="dsh-empty">No report matches these filters.<span class="tiny">Reset the filters, or use the topbar search.</span></div>'}
      </div>`;
  }

  /* ---- the reader -------------------------------------------------------- */

  const arrowIcon = () => '<span class="ev-arrow" data-icon="arrow-right"></span>';

  /* A report is not a graph node — the graph draws record families, not reports —
     so this points at the node the report hangs from: its matn group when the
     archive groups it, otherwise the collection it is recorded in. Either way the
     link opens a node the canvas actually draws. */
  function graphNodeHref(h) {
    if (h.matnGroup) return `#graph?node=${encodeURIComponent(ChronoData.cid.topic(`matn:${h.matnGroup}`))}`;
    const bookRec = ChronoData.bookOfReport(h);
    return bookRec ? `#graph?node=${encodeURIComponent(ChronoData.cid.book(bookRec.id))}` : '';
  }

  const graphNodeLabel = (h) => (h.matnGroup ? 'Graph · this matn' : 'Graph · its collection');

  function chainHtml(h) {
    if (!h.chain || !h.chain.length) {
      return `<p class="ev-note">Chain not available in this dataset. The archive does not assemble a
        chain out of a report's neighbours: if the isnad is not recorded with the report, nothing is drawn.</p>`;
    }
    return `
      <p class="ev-note">The chain as the archive records it, from the source of the report to the compiler.</p>
      <ol class="hd-chain">
        ${h.chain.map((link, i) => {
          const f = ChronoData.figure(link.narratorId);
          return `
            <li class="hd-chain-step">
              <span class="hd-chain-node">${i + 1}</span>
              <span class="hd-chain-copy">
                ${f ? `<a href="#figures?id=${esc(f.id)}">${esc(f.name)}</a>` : esc(link.narratorId)}
                <span class="hd-chain-role">${esc(link.role || '')}${link.generation ? ` · ${esc(link.generation)}` : ''}</span>
                ${link.note ? `<span class="hd-chain-note">${esc(link.note)}</span>` : ''}
              </span>
            </li>`;
        }).join('')}
      </ol>
      <div class="ev-linkrow">
        <a class="dsh-btn small primary" href="#isnad?hadith=${esc(h.id)}">Open in the Isnad Explorer ${arrowIcon()}</a>
        ${graphNodeHref(h) ? `<a class="dsh-btn small" href="${graphNodeHref(h)}">View in Graph ${arrowIcon()}</a>` : ''}
      </div>`;
  }

  const relatedMatn = (h) => (h.matnGroup
    ? ChronoData.allReports().filter((x) => x.matnGroup === h.matnGroup && x.id !== h.id)
    : []);

  const eventsFor = (h) => {
    const book = ChronoData.bookOfReport(h);
    return book ? ChronoData.eventsOfBook(book.id) : [];
  };

  function tabHtml(h, index) {
    const bookRec = ChronoData.bookOfReport(h);
    const figures = [...new Map(ChronoData.chainFigures(h).map((f) => [f.id, f])).values()];
    const places = ChronoData.placesOfReport(h);

    if (index === 0) {
      return `
        ${h.arabic ? `<p class="hd-matn" lang="ar" dir="rtl">${esc(h.arabic)}</p>` : ''}
        <p class="ev-prose">${esc(h.translation)}</p>
        ${h.note ? `<p class="ev-note">${esc(h.note)}</p>` : ''}
        <dl class="ev-facts">
          <dt>Reference</dt><dd>${esc(h.reference)}${h.sourceUrl ? ` · <a href="${esc(h.sourceUrl)}" target="_blank" rel="noopener">source page</a>` : ''}</dd>
          <dt>Collection</dt><dd>${bookRec ? `<a href="#books?id=${esc(bookRec.id)}">${esc(bookRec.name)}</a>` : esc(h.collection)}</dd>
          <dt>Section</dt><dd>${esc(h.book || '—')}</dd>
          <dt>Number</dt><dd>${esc(h.number)}</dd>
          <dt>Grade</dt><dd>${esc(h.grade || 'not stated')} <span class="ev-meta-sub">as the source gives it</span></dd>
          <dt>Narrated by</dt><dd>${ChronoData.figure(h.narratorId)
            ? `<a href="#figures?id=${esc(h.narratorId)}">${esc(ChronoData.figure(h.narratorId).name)}</a>`
            : '<span class="ev-no-site">not recorded</span>'}</dd>
          <dt>Chain length</dt><dd>${(h.chain || []).length} links</dd>
          <dt>Recorded at</dt><dd>${places.length
            ? places.map((p) => `<a href="#places?id=${esc(p.id)}">${esc(p.name)}</a>`).join(' · ')
            : '<span class="ev-no-site">not recorded</span>'}</dd>
        </dl>
        <div class="ev-linkrow">
          <a class="dsh-btn small primary" href="#isnad?hadith=${esc(h.id)}">Open in the Isnad Explorer ${arrowIcon()}</a>
          ${bookRec ? `<a class="dsh-btn small" href="#books?id=${esc(bookRec.id)}">Open the collection record ${arrowIcon()}</a>` : ''}
        </div>`;
    }

    if (index === 1) return chainHtml(h);

    if (index === 2) {
      return `
        <h3 class="ev-subhead">Where this report sits</h3>
        <dl class="ev-facts">
          <dt>Collection</dt><dd>${bookRec ? esc(bookRec.name) : esc(h.collection)}</dd>
          <dt>Dating</dt><dd>${bookRec?.death
            ? `read with the compiler's lifetime; he died in ${bookRec.death} CE`
            : 'compiler dates not recorded'}</dd>
          <dt>Section</dt><dd>${esc(h.book || '—')}</dd>
        </dl>
        ${bookRec ? `
          <h3 class="ev-subhead">About the collection</h3>
          <p class="ev-prose">${esc(bookRec.note || '')}</p>` : ''}
        <p class="ev-note">A report is dated here by the collection it is recorded in and the compiler's
        lifetime — not by the year this catalogue was made.</p>`;
    }

    if (index === 3) {
      return `
        <h3 class="ev-subhead">Figures in the chain</h3>
        ${figures.length
          ? `<div class="ev-chiplist">${figures.map((f) => `
              <a class="dsh-chip" href="#figures?id=${esc(f.id)}">${esc(f.name)}${f.role ? ` · ${esc(f.role)}` : ''}</a>`).join('')}</div>`
          : '<p class="ev-note">No figure in this report is held in the archive.</p>'}
        <h3 class="ev-subhead">Other reports of the same matn</h3>
        ${relatedMatn(h).length
          ? `<div class="ev-chiplist">${relatedMatn(h).map((x) => `
              <a class="dsh-chip" href="#hadiths?id=${esc(x.id)}">${esc(x.reference)}</a>`).join('')}</div>`
          : '<p class="ev-note">This matn is not recorded in another collection here.</p>'}
        <h3 class="ev-subhead">Elsewhere in the archive</h3>
        <div class="ev-chiplist">
          <a class="dsh-chip" href="#isnad?hadith=${esc(h.id)}">Isnad Explorer · this report</a>
          ${graphNodeHref(h) ? `<a class="dsh-chip" href="${graphNodeHref(h)}">${graphNodeLabel(h)}</a>` : ''}
          ${bookRec ? `<a class="dsh-chip" href="#books?id=${esc(bookRec.id)}">Books · ${esc(bookRec.name)}</a>` : ''}
        </div>
        <h3 class="ev-subhead">Places this report names</h3>
        ${places.length
          ? `<div class="ev-chiplist">${places.map((p) => `
              <a class="dsh-chip" href="#places?id=${esc(p.id)}">${esc(p.name)}${p.region ? ` · ${esc(p.region)}` : ''}</a>`).join('')}</div>
             <p class="ev-note">The place ids the report's own record carries — the archive names no place
             for a report unless its record does.</p>`
          : '<p class="ev-note">This report names no place in the archive.</p>'}`;
    }

    const events = eventsFor(h);
    return `
      <h3 class="ev-subhead">Events whose record cites this collection</h3>
      ${events.length
        ? `<div class="bk-evs">${events.map((e) => `
            <a class="bk-ev" href="${ChronoData.links.event(e.id, 'hadiths')}" style="--dot:${ChronoData.era(e.era).color}">
              <span class="bk-ev-year">${esc(String(e.year))}</span>
              <span class="bk-ev-name">${esc(e.name)}</span>
              ${arrowIcon()}
            </a>`).join('')}</div>`
        : '<p class="ev-note">No event record cites this collection.</p>'}
      <p class="ev-note">A link here means the archive's entry for that event names this collection among
      its sources — not that the report is about the event.</p>`;
  }

  function panelContentsHtml(h) {
    if (!h) return '<div class="dsh-empty">Select a report.</div>';
    const bookRec = ChronoData.bookOfReport(h);
    return `
      <div class="ev-panel-head">
        <h2 class="ev-panel-title">${esc(h.reference)}</h2>
        <div class="ev-panel-meta">
          <span class="ev-meta">${esc(bookRec?.name || h.collection)}</span>
          <span class="ev-meta">${esc(h.book || '')} · no. ${esc(h.number)}</span>
        </div>
        <div class="ev-panel-badges">
          ${h.grade ? `<span class="ev-badge era">${esc(h.grade)}</span>` : ''}
          <span class="ev-badge">${(h.chain || []).length} links</span>
          ${h.matnGroup ? `<span class="ev-badge soft">${esc(h.matnGroup)}</span>` : ''}
        </div>
      </div>
      <div class="ev-tabs" role="tablist">
        ${TABS.map((t, i) => `
          <button class="ev-tab${i === state.tab ? ' active' : ''}" type="button" role="tab" data-hdtab="${i}"
                  aria-selected="${i === state.tab}">${t}</button>`).join('')}
      </div>
      <div class="ev-tabbody" id="hdTabBody" role="tabpanel">${tabHtml(h, state.tab)}</div>`;
  }

  const panelHtml = (h) => `
    <aside class="dsh-panel hd-panel" id="hdPanel" aria-label="Selected report">
      ${panelContentsHtml(h)}
    </aside>`;

  const shellHtml = () => `
    <div class="dsh hd">
      <div class="bk-top">${statsHtml()}</div>
      <div class="dsh-body">
        <aside class="dsh-side hd-side" id="hdSide" aria-label="Report filters">${sidebarHtml()}</aside>
        <section class="dsh-center hd-center" id="hdCenter" aria-label="Reports">${centerHtml()}</section>
        ${panelHtml(selected())}
      </div>
    </div>`;

  /* ---- refresh and selection -------------------------------------------- */

  function renderSide() {
    const host = state.host.querySelector('#hdSide');
    host.innerHTML = sidebarHtml();
    Icons.init(host);
    bindSide(host);
  }

  function renderCenter() {
    const host = state.host.querySelector('#hdCenter');
    const list = host.querySelector('.hd-list');
    const top = list ? list.scrollTop : 0;
    host.innerHTML = centerHtml();
    Icons.init(host);
    bindCenter(host);
    const fresh = host.querySelector('.hd-list');
    if (fresh) fresh.scrollTop = top;
  }

  function renderPanel() {
    const host = state.host.querySelector('#hdPanel');
    host.innerHTML = panelContentsHtml(selected());
    Icons.init(host);
    bindPanel(host);
  }

  function selectReport(id) {
    if (!ChronoData.report(id)) return;
    state.selectedId = id;
    ChronoData.remember({ reportId: id });
    if (location.hash.startsWith('#hadiths')) {
      history.replaceState(null, '', `#hadiths?id=${encodeURIComponent(id)}`);
    }
    renderCenter();
    renderPanel();
  }

  function on(el, type, fn) {
    const key = `__hdb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  }

  function bindCenter(scope) {
    scope.querySelectorAll('[data-report]').forEach((el) => {
      on(el, 'click', () => selectReport(el.dataset.report));
    });
    scope.querySelectorAll('[data-hdsort]').forEach((el) => {
      on(el, 'click', () => { state.sort = el.dataset.hdsort; renderCenter(); });
    });
  }

  function bindSide(scope) {
    scope.querySelectorAll('input[data-hd]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const set = cb.dataset.hd === 'collection' ? state.collections : state.topics;
        if (cb.checked) set.add(cb.value); else set.delete(cb.value);
        state.host.querySelector('#hdApply')?.classList.add('dirty');
      });
    });
    scope.querySelectorAll('[data-narrator]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.narrator;
        if (state.narrators.has(id)) state.narrators.delete(id); else state.narrators.add(id);
        renderSide();
        renderCenter();
      });
    });
    scope.querySelector('#hdApply')?.addEventListener('click', () => {
      renderSide();
      renderCenter();
      renderPanel();
    });
    scope.querySelector('#hdReset')?.addEventListener('click', () => {
      state.collections = new Set();
      state.topics = new Set();
      state.narrators = new Set();
      state.bookFilter = null;
      state.sort = 'relevance';
      renderSide();
      renderCenter();
      renderPanel();
    });
  }

  function bindPanel(scope) {
    scope.querySelectorAll('[data-hdtab]').forEach((btn) => {
      on(btn, 'click', () => {
        state.tab = Number(btn.dataset.hdtab) || 0;
        const body = scope.querySelector('#hdTabBody');
        body.innerHTML = tabHtml(selected(), state.tab);
        Icons.init(body);
        scope.querySelectorAll('[data-hdtab]').forEach((b) => {
          const active = Number(b.dataset.hdtab) === state.tab;
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

    state.collections = new Set();
    state.topics = new Set();
    state.narrators = new Set();
    state.sort = 'relevance';
    state.tab = Math.max(0, Number(get('tab')) || 0);

    // A link from Books arrives as ?book=<collectionId>: that is a scope, shown
    // in the sidebar, rather than a silent filter.
    const bookParam = get('book');
    state.bookFilter = bookParam && ChronoData.book(bookParam) ? bookParam : null;

    const wanted = get('id') || stored.reportId || null;
    state.selectedId = ChronoData.report(wanted) ? wanted : null;
    if (!state.selectedId) state.selectedId = sorted(filtered())[0]?.id || null;

    host.innerHTML = shellHtml();
    Icons.init(host);
    bindSide(host.querySelector('#hdSide'));
    bindCenter(host.querySelector('#hdCenter'));
    bindPanel(host.querySelector('#hdPanel'));

    if (state.selectedId) {
      ChronoData.remember({ reportId: state.selectedId });
      const q = [`id=${encodeURIComponent(state.selectedId)}`];
      if (state.bookFilter) q.push(`book=${encodeURIComponent(state.bookFilter)}`);
      if (state.tab) q.push(`tab=${state.tab}`);
      history.replaceState(null, '', `#hadiths?${q.join('&')}`);
    }
  }

  function searchScope() {
    const built = ChronoData.allReports().map((h) => ({
      id: ChronoData.cid.report(h.id),
      label: h.reference,
      group: h.collection,
      meta: h.grade || 'report',
      sub: [h.translation ? `${h.translation.slice(0, 60)}…` : '', ChronoData.figure(h.narratorId)?.name]
        .filter(Boolean).join(' · '),
      icon: 'hadiths',
      colour: 'var(--teal)',
      hay: hay(h),
    }));
    let chip = 'all';
    return {
      label: 'Hadiths',
      placeholder: 'Search hadiths…',
      hint: 'Arabic or English text, reference, collection, narrator or topic',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All collections', count: built.length },
        ...COLLECTIONS().map((c) => ({
          key: c, label: c, count: built.filter((r) => r.group === c).length,
        })),
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => {
        const raw = ChronoData.resolve(id).id;
        const visible = filtered().some((h) => h.id === raw);
        if (!visible) {
          return { hidden: true, message: 'A collection, topic or narrator filter keeps it out of the list.' };
        }
        selectReport(raw);
      },
      reveal: (id) => {
        state.collections = new Set();
        state.topics = new Set();
        state.narrators = new Set();
        state.bookFilter = null;
        renderSide();
        renderCenter();
        selectReport(ChronoData.resolve(id).id);
      },
    };
  }

  return { render, searchScope };
})();
