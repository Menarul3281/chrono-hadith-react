/* Isnad view — chain + side panel. */

const IsnadView = (() => {
  const GEN_COLORS = {
    prophet:      'var(--gen-prophet)',
    sahabi:       'var(--gen-sahabi)',
    tabii:        'var(--gen-tabii)',
    'taba-tabii': 'var(--gen-taba-tabii)',
    later:        'var(--gen-later)',
    compiler:     'var(--gen-compiler)',
    book:         'var(--gen-book)',
  };
  const colorFor = (n) => GEN_COLORS[n.generation] || 'var(--teal)';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

  let currentId = null;
  let currentContainer = null;

  function hadithCard(h) {
    const grade = h.grade ? `<span class="badge">${esc(h.grade)}</span>` : '';
    const src = h.sourceUrl
      ? `<a href="${esc(h.sourceUrl)}" target="_blank" rel="noopener">${esc(h.reference)} ↗</a>`
      : esc(h.reference);

    return `
      <div class="hadith-card">
        <button class="hadith-copy" type="button" data-copy="hadith" aria-label="Copy Arabic and English text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy</span>
        </button>
        <div class="hadith-card-inner">
          <div class="hadith-meta">
            ${grade}
            <span>${esc(h.collection)}</span>
            <span class="sep">·</span>
            <span>${esc(h.reference)}</span>
            ${h.book ? `<span class="sep">·</span><span>${esc(h.book)}</span>` : ''}
          </div>
          ${h.arabic ? `<div class="hadith-arabic">${esc(h.arabic)}</div>` : ''}
          <div class="hadith-translation">"${esc(h.translation)}"</div>
          <div class="hadith-source">${src}</div>
        </div>
      </div>
    `;
  }

  function narratorRow(link, idx) {
    const n = link.narrator;
    const color = colorFor(n);
    const isProphet = n.id === 'prophet';

    const kv = [];
    if (n.birth || n.death) {
      const dates = [n.birth, n.death].filter(Boolean).join(' – ');
      kv.push(`<div class="kv"><span>Dates</span><span>${esc(dates)}</span></div>`);
    }
    if (n.locations?.length) {
      kv.push(`<div class="kv"><span>Places</span><span>${esc(n.locations.join(', '))}</span></div>`);
    }
    if (n.teachers?.length) {
      kv.push(`<div class="kv"><span>Teachers</span><span>${esc(n.teachers.join(', '))}</span></div>`);
    }
    if (n.students?.length) {
      kv.push(`<div class="kv"><span>Students</span><span>${esc(n.students.join(', '))}</span></div>`);
    }

    return `
      <div class="chain-row ${isProphet ? 'is-prophet' : ''}"
           style="--gen-color:${color}; --row-index:${idx}">
        <div class="chain-step">${link.step}</div>
        <div class="narrator-row" data-narrator="${esc(n.id)}">
          <div class="narrator-line">
            <span class="narrator-name">${esc(n.name)}</span>
            <span class="narrator-side">
              <span class="narrator-role">${esc(link.role)}</span>
              <span class="narrator-gen">${esc(link.generation || n.generation)}</span>
            </span>
          </div>
          ${n.arabic ? `<div class="narrator-arabic-inline">${esc(n.arabic)}</div>` : ''}
          <div class="narrator-details">
            <div class="narrator-details-inner">
              ${n.bio ? `<p style="margin-bottom:8px">${esc(n.bio)}</p>` : ''}
              ${kv.join('')}
            </div>
            ${!isProphet ? `
              <a class="narrator-open-profile" href="#figures?id=${esc(n.id)}">
                Open full profile →
              </a>
            ` : ''}
          </div>
        </div>
        <div class="chain-chevron">▾</div>
      </div>
    `;
  }

  function sidePanel(h, chain) {
    // Generation breakdown
    const genCounts = {};
    chain.forEach((link) => {
      const g = link.generation || link.narrator.generation;
      genCounts[g] = (genCounts[g] || 0) + 1;
    });

    const genList = Object.entries(genCounts)
      .map(([gen, count]) => {
        const color = GEN_COLORS[gen] || 'var(--teal)';
        return `
          <div class="gen-item">
            <span class="gen-dot" style="--gen-color:${color}"></span>
            <span>${esc(gen)}</span>
            <strong>${count}</strong>
          </div>
        `;
      })
      .join('');

    // Places the report's own record names, through the shared reader.
    const places = ChronoData.placesOfReport(h);

    // Related reports (same matn group)
    const related = h.matnGroup
      ? DataLoader.listHadiths().filter(
          (x) => x.matnGroup === h.matnGroup && x.id !== h.id
        )
      : [];

    const relatedHtml = related.length
      ? related
          .map(
            (r) => `
              <button class="related-item" data-jump="${esc(r.id)}">
                <strong>${esc(r.reference)}</strong>
                <span>${esc(r.collection)} · ${esc(r.grade || '')}</span>
              </button>
            `
          )
          .join('')
      : `<div style="font-size:11px;color:var(--muted-2);padding:4px 0;">No other reports share this matn in the archive.</div>`;

    return `
      <aside class="isnad-side">
        <div class="side-card">
          <div class="side-head">Chain at a glance</div>
          <div class="side-stat"><span>Links</span><strong>${chain.length}</strong></div>
          <div class="side-stat"><span>Transmissions</span><strong>${chain.length - 1}</strong></div>
          <div class="side-stat"><span>Collection</span><strong>${esc(h.collection.replace('Sahih ', '').replace('Sunan ', ''))}</strong></div>
        </div>

        <div class="side-card">
          <div class="side-head">Generations</div>
          <div class="gen-list">${genList}</div>
        </div>

        <div class="side-card">
          <div class="side-head">Recorded at</div>
          ${places.length
            ? `<div class="ev-chiplist">${places.map((p) => `
                <a class="dsh-chip" href="#places?id=${esc(p.id)}">${esc(p.name)}</a>`).join('')}</div>
               <p class="ev-note">Place ids the report's own record carries, read through ChronoData so
               this page and the report library cannot disagree.</p>`
            : '<p class="ev-note">This report names no place in the archive.</p>'}
        </div>

        <div class="side-card">
          <div class="side-head">Related reports</div>
          <div class="related-list">${relatedHtml}</div>
        </div>

        <div class="side-card">
          <div class="side-head">Cite this</div>
          <div class="cite-buttons">
            <button class="cite-btn" data-cite="plain">Plain</button>
            <button class="cite-btn" data-cite="bibtex">BibTeX</button>
            <button class="cite-btn" data-cite="ris">RIS</button>
            <button class="cite-btn" data-cite="ref">Ref only</button>
          </div>
        </div>
      </aside>
    `;
  }

  /* The report search itself is the shared topbar picker: this strip only names
     the report on screen and opens that picker when it is clicked. There is no
     second search field on the page. */
  function pickerHtml(current) {
    return `
      <div class="picker" id="reportPicker">
        <button class="picker-button" type="button" aria-expanded="false">
          <span class="picker-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
          </span>
          <span class="picker-current">
            <strong>${esc(current.reference)}</strong>
            <span>· ${esc(current.collection)}</span>
          </span>
          <span class="picker-kbd">Search above ▴</span>
        </button>
      </div>
    `;
  }

  function bind(container, h, chain) {
    // Narrator expand/collapse
    container.querySelectorAll('.narrator-row').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.narrator-open-profile')) return;
        row.classList.toggle('expanded');
      });
    });

    // Copy hadith
    const copyBtn = container.querySelector('[data-copy="hadith"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const text = Clipboard.hadithPlainText(h);
        const ok = await Clipboard.copy(text);
        if (ok) {
          copyBtn.classList.add('copied');
          copyBtn.querySelector('span').textContent = 'Copied';
          window.showToast?.('Copied Arabic + English to clipboard');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('span').textContent = 'Copy';
          }, 1800);
        }
      });
    }

    // Citation buttons
    container.querySelectorAll('[data-cite]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const kind = btn.dataset.cite;
        let text = '';
        if (kind === 'plain') text = Clipboard.hadithPlainText(h);
        else if (kind === 'bibtex') text = Clipboard.hadithBibtex(h);
        else if (kind === 'ris') text = Clipboard.hadithRIS(h);
        else if (kind === 'ref') text = h.reference;
        const ok = await Clipboard.copy(text);
        if (ok) {
          btn.classList.add('copied');
          const orig = btn.textContent;
          btn.textContent = 'Copied';
          window.showToast?.(`${kind.toUpperCase()} citation copied`);
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.textContent = orig;
          }, 1600);
        }
      });
    });

    // Related report jump
    container.querySelectorAll('[data-jump]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.jump;
        history.replaceState(null, '', `#isnad?hadith=${id}`);
        render(container, id);
      });
    });

    // Init picker
    Picker.init({
      hadiths: DataLoader.listHadiths(),
      onSelect: (id) => {
        history.replaceState(null, '', `#isnad?hadith=${id}`);
        render(container, id);
      },
    });
    Picker.setCurrent(h);
  }

  function render(container, target) {
    /* The router hands this page the route's params, like every other page; this
       page's own links hand it a bare report id. Both resolve to one id here, so
       #isnad?hadith=… and an in-page jump take the same path. */
    const wanted = target && typeof target.get === 'function'
      ? (target.get('hadith') || target.get('id'))
      : target;
    const stored = ChronoData.recall();
    const hadithId = wanted || stored.reportId || currentId || DataLoader.listHadiths()[0]?.id;

    currentId = hadithId;
    currentContainer = container;

    const h = DataLoader.getHadith(hadithId);
    if (!h) {
      container.innerHTML = `<div class="state error">Hadith "${esc(hadithId)}" not found.</div>`;
      return;
    }
    // The report on screen is the report in the address bar, as on every page.
    ChronoData.remember({ reportId: hadithId });
    history.replaceState(null, '', `#isnad?hadith=${encodeURIComponent(hadithId)}`);
    Picker.noteView?.(hadithId);
    const chain = DataLoader.chainWithNarrators(hadithId);

    container.innerHTML = `
      <div class="isnad-page">
        <div class="isnad-head">
          <div>
            <h1>Isnad Explorer</h1>
            <p>Trace the chain of transmission of a single report, link by link, from the Prophet ﷺ to its compiler.</p>
          </div>
          ${pickerHtml(h)}
        </div>

        ${hadithCard(h)}

        <div class="isnad-grid">
          <div class="chain-track">
            ${chain.map((link, i) => narratorRow(link, i)).join('')}
          </div>
          ${sidePanel(h, chain)}
        </div>
      </div>
    `;

    bind(container, h, chain);
  }

  return { render };
})();
