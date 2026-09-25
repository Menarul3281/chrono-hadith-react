/* Command-palette style report picker.
   Scales to thousands of reports via substring index + windowed rendering. */

const Picker = (() => {
  const RECENT_KEY = 'chrono-hadith:recent-reports';
  const MAX_RECENT = 5;
  const VISIBLE_LIMIT = 60;

  let root, button, panel, input, body, footerNote;
  let allHadiths = [];
  let index = [];
  let filtered = [];
  let focusIdx = 0;
  let activeCollection = 'all';
  let onSelect = null;
  let isOpen = false;

  function loadRecent() {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string').slice(0, MAX_RECENT) : [];
    }
    catch { return []; }
  }
  function pushRecent(id) {
    const list = loadRecent().filter((x) => x !== id);
    list.unshift(id);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); }
    catch { /* Selection still works when browser storage is unavailable. */ }
  }

  function buildIndex() {
    index = allHadiths.map((h) => {
      const chainNames = (h.chain || [])
        .map((link) => DataLoader.getNarrator(link.narratorId))
        .filter(Boolean)
        .map((n) => `${n.name} ${n.arabic || ''}`)
        .join(' ');

      const haystack = [
        h.reference,
        h.collection,
        h.book,
        h.number,
        h.translation,
        h.arabic,
        h.grade,
        chainNames,
      ].filter(Boolean).join(' ').toLowerCase();

      return { h, haystack };
    });
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    let pool = index;
    if (activeCollection !== 'all') {
      pool = pool.filter((x) => x.h.collection === activeCollection);
    }
    if (!q) return pool.map((x) => x.h).slice(0, VISIBLE_LIMIT);
    return pool
      .filter((x) => x.haystack.includes(q))
      .map((x) => x.h)
      .slice(0, VISIBLE_LIMIT);
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function renderItem(h, i) {
    const isFocused = i === focusIdx;
    const num = h.number || h.reference.split(' ').pop();
    return `
      <div class="picker-item ${isFocused ? 'focused' : ''}" data-idx="${i}" data-id="${esc(h.id)}">
        <div class="picker-item-icon">${esc(num)}</div>
        <div class="picker-item-main">
          <span class="picker-item-ref">${esc(h.reference)}</span>
          <span class="picker-item-trans">${esc(h.translation)}</span>
        </div>
        <div class="picker-item-side">
          ${h.grade ? `<span class="badge-mini">${esc(h.grade.toUpperCase())}</span>` : ''}
          ${esc(h.collection.replace('Sahih ', '').replace('Sunan ', ''))}
        </div>
      </div>
    `;
  }

  function renderEmptyPanel() {
    const recent = loadRecent()
      .map((id) => allHadiths.find((h) => h.id === id))
      .filter(Boolean);

    const collections = ['all', ...new Set(allHadiths.map((h) => h.collection))];
    const aishaCount = allHadiths.filter((h) =>
      h.chain?.some((link) => link.narratorId === 'aisha')
    ).length;
    const suggestions = [
      {
        label: 'The intention report across collections',
        sub: 'See 2 routes · Bukhari & Nasa’i',
        action: () => {
          activeCollection = 'all';
          input.value = 'intention';
          renderBody();
        },
      },
      {
        label: 'Chains narrated by Aisha',
        sub: `${aishaCount} reports`,
        action: () => {
          activeCollection = 'all';
          input.value = 'aisha';
          renderBody();
        },
      },
      {
        label: 'Sahih reports only',
        sub: 'Filter by grade',
        action: () => {
          activeCollection = 'all';
          input.value = 'sahih';
          renderBody();
        },
      },
    ];

    body.innerHTML = `
      ${recent.length ? `
        <div class="picker-section">
          <div class="picker-section-head">Recent</div>
          <div class="picker-list-recent">
            ${recent.map((h, i) => renderItem(h, i)).join('')}
          </div>
        </div>
      ` : ''}
      <div class="picker-section">
        <div class="picker-section-head">Collections</div>
        <div class="picker-chips">
          ${collections.map((c) => `
            <button class="picker-chip ${c === activeCollection ? 'active' : ''}" data-collection="${esc(c)}">
              ${c === 'all' ? 'All' : esc(c.replace('Sahih ', '').replace('Sunan ', ''))}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="picker-section">
        <div class="picker-section-head">Suggested</div>
        <div class="picker-suggestions">
          ${suggestions.map((s, i) => `
            <div class="picker-item picker-suggestion" data-suggestion="${i}">
              <div class="picker-item-icon">✦</div>
              <div class="picker-item-main">
                <span class="picker-item-ref">${esc(s.label)}</span>
                <span class="picker-item-trans">${esc(s.sub)}</span>
              </div>
              <div class="picker-item-side">→</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('[data-collection]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeCollection = btn.dataset.collection;
        input.value = '';
        renderBody();
        input.focus();
      });
    });
    body.querySelectorAll('[data-suggestion]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        suggestions[+el.dataset.suggestion].action();
      });
    });
    body.querySelectorAll('.picker-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => select(el.dataset.id));
    });
  }

  function renderBody() {
    // The panel it used to render is gone: the shared topbar picker holds the
    // report list now, so this body has nothing to draw.
    if (!body) return;

    const q = input.value;
    if (!q.trim() && activeCollection === 'all') {
      renderEmptyPanel();
      filtered = loadRecent()
        .map((id) => allHadiths.find((h) => h.id === id))
        .filter(Boolean);
      focusIdx = 0;
      return;
    }

    filtered = filter(q);

    if (!filtered.length) {
      body.innerHTML = `
        <div class="picker-empty">
          No reports match "${esc(q)}"
          ${activeCollection !== 'all' ? ` in ${esc(activeCollection)}` : ''}.
        </div>
      `;
      return;
    }

    body.innerHTML = `
      <div class="picker-section">
        <div class="picker-section-head">
          ${q ? `Results · ${filtered.length}` : `${filtered.length} reports`}
        </div>
        <div class="picker-list">
          ${filtered.map((h, i) => renderItem(h, i)).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.picker-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => select(el.dataset.id));
    });

    scrollFocusedIntoView();
  }

  function scrollFocusedIntoView() {
    const el = body.querySelector('.picker-item.focused');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function select(id) {
    pushRecent(id);
    close();
    if (onSelect) onSelect(id);
  }

  function open() {
    // The report search now lives in the shared topbar picker; this button opens
    // that one, so there is a single search field in the app.
    if (typeof TopSearch !== 'undefined' && typeof TopSearch.open === 'function') {
      TopSearch.open();
      return;
    }
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    setTimeout(() => input.focus(), 40);
    renderBody();
  }

  function close() {
    isOpen = false;
    panel.classList.remove('open');
    button.setAttribute('aria-expanded', 'false');
    input.value = '';
    focusIdx = 0;
    activeCollection = 'all';
  }

  function bind() {
    button.addEventListener('click', () => (isOpen ? close() : open()));

    input.addEventListener('input', () => {
      focusIdx = 0;
      renderBody();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusIdx = Math.min(focusIdx + 1, filtered.length - 1);
        updateFocus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusIdx = Math.max(focusIdx - 1, 0);
        updateFocus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const h = filtered[focusIdx];
        if (h) select(h.id);
      } else if (e.key === 'Escape') {
        close();
      }
    });

    document.addEventListener('click', (e) => {
      if (!isOpen) return;
      const path = e.composedPath?.() || [];
      if (path.includes(panel) || panel.contains(e.target)) return;
      if (path.includes(button) || button.contains(e.target)) return;
      close();
    });

    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') close();
    });
  }

  function updateFocus() {
    body.querySelectorAll('.picker-item').forEach((el, i) => {
      el.classList.toggle('focused', +el.dataset.idx === focusIdx);
    });
    scrollFocusedIntoView();
  }

  function init(opts) {
    root = document.getElementById('reportPicker');
    if (!root) return;

    button = root.querySelector('.picker-button');
    if (button && typeof TopSearch !== 'undefined') {
      button.addEventListener('click', () => TopSearch.open());
      return;
    }
    panel = root.querySelector('.picker-panel');
    input = panel ? panel.querySelector('input') : null;
    body = panel ? panel.querySelector('.picker-body') : null;
    footerNote = panel ? panel.querySelector('.picker-footer-note') : null;

    allHadiths = opts.hadiths;
    onSelect = opts.onSelect;

    buildIndex();
    if (button && input) bind();
  }

  function setCurrent(h) {
    if (!button) return;
    const el = button.querySelector('.picker-current');
    if (!el || !h) return;
    el.innerHTML = `<strong>${esc(h.reference)}</strong> <span>· ${esc(h.collection)}</span>`;
  }

  function noteView(id) {
    if (!id) return;
    pushRecent(id);
  }

  return { init, setCurrent, open, close, noteView };
})();
