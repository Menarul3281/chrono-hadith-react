/* TopSearch — the one search field in the app.

   It sits in the topbar, centred, on every route. Clicking it with an empty
   query browses the records of the CURRENT page; typing filters those same
   records. Choosing a row performs exactly what choosing that record in the
   page's own list would do — the page supplies that action, this component never
   navigates on its own.

   A page hands over a scope: a placeholder, optional category chips, the rows it
   can offer, and what to do when one is picked. That is the only coupling, so a
   new page means one scope, not another search bar. */

const TopSearch = (() => {
  const MAX_ROWS = 80;
  let requestVersion = 0;

  let root, input, panel, bodyEl, chipsEl, footEl, scope = null;
  let rows = [], focus = 0, isOpen = false, loading = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const activeChip = () => (scope && scope.activeChip ? scope.activeChip() : 'all');

  /* The rows the page offers for the current query. A scope may return a promise
     for larger datasets, and an empty array for a page with nothing loaded yet,
     which is shown as an honest empty state rather than a fake suggestion. */
  async function collect() {
    if (!scope) return [];
    try {
      const all = await scope.rows({ query: input.value.trim().toLowerCase(), chip: activeChip() });
      return (all || []).slice(0, MAX_ROWS);
    } catch (err) {
      console.error('TopSearch scope failed', err);
      return [];
    }
  }

  // ---- rendering ---------------------------------------------------------

  function renderChips() {
    if (!chipsEl) return;
    const chips = scope && scope.chips ? scope.chips() : [];
    if (!chips.length) {
      chipsEl.innerHTML = '';
      return;
    }
    const current = activeChip();
    chipsEl.innerHTML = chips.map((c) => `
      <button class="tps-chip${c.key === current ? ' active' : ''}" type="button" data-chip="${esc(c.key)}"
              aria-pressed="${c.key === current}">${esc(c.label)}${c.count != null ? ` <em>${c.count}</em>` : ''}</button>`).join('');
    chipsEl.querySelectorAll('[data-chip]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (scope && scope.setChip) scope.setChip(btn.dataset.chip);
        renderChips();
        await refresh();
      });
    });
  }

  const rowHtml = (row, i) => `
    <button class="tps-row${i === focus ? ' focused' : ''}" type="button" role="option" id="tps-opt-${i}"
            aria-selected="${i === focus}" data-idx="${i}" data-id="${esc(row.id)}"
            style="--dot:${esc(row.colour || 'var(--teal)')}">
      <span class="tps-row-icon" data-icon="${esc(row.icon || 'overview')}"></span>
      <span class="tps-row-main">
        <span class="tps-row-label">${esc(row.label)}</span>
        ${row.sub ? `<span class="tps-row-sub">${esc(row.sub)}</span>` : ''}
      </span>
      <span class="tps-row-meta">${esc(row.meta || '')}</span>
    </button>`;

  function renderBody() {
    if (!bodyEl) return;
    if (loading) {
      bodyEl.innerHTML = '<div class="tps-state">Loading records…</div>';
      return;
    }
    if (!rows.length) {
      const name = scope ? scope.label : 'this page';
      bodyEl.innerHTML = `<div class="tps-state">No matching records on ${esc(name)}.
        <span class="tiny">Search stays inside this page; the record links are the way across.</span></div>`;
      return;
    }
    bodyEl.innerHTML = `<div class="tps-list" role="presentation">${rows.map(rowHtml).join('')}</div>`;
    bodyEl.querySelectorAll('.tps-row').forEach((el) => {
      el.addEventListener('click', (ev) => { ev.preventDefault(); pick(Number(el.dataset.idx)); });
      el.addEventListener('mousemove', () => {
        const i = Number(el.dataset.idx);
        if (i !== focus) { focus = i; paintFocus(); }
      });
    });
    Icons.init(bodyEl);
  }

  function paintFocus() {
    bodyEl.querySelectorAll('.tps-row').forEach((el) => {
      const on = Number(el.dataset.idx) === focus;
      el.classList.toggle('focused', on);
      el.setAttribute('aria-selected', String(on));
      if (on) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function renderFoot() {
    if (!footEl) return;
    footEl.innerHTML = scope
      ? `<span>${esc(scope.hint || '')}</span><span class="tps-scope">Scope · ${esc(scope.label)}</span>`
      : '';
  }

  async function refresh() {
    if (!scope) return;
    const version = ++requestVersion;
    loading = true;
    input.removeAttribute('aria-activedescendant');
    renderBody();
    const next = await collect();
    if (version !== requestVersion) return;
    rows = next;
    focus = 0;
    loading = false;
    renderBody();
    paintFocus();
    renderFoot();
  }

  // ---- open, close, pick -------------------------------------------------

  async function open() {
    if (!scope || isOpen) return;
    const topbar = root.closest('.topbar');
    if (window.matchMedia('(max-width: 900px)').matches && !topbar?.classList.contains('search-open')) {
      document.querySelector('[data-search-toggle]')?.click();
      return;
    }
    isOpen = true;
    panel.classList.add('open');
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.focus();
    renderChips();
    await refresh();
  }

  function close() {
    ++requestVersion;
    loading = false;
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    input.value = '';
    rows = [];
    focus = 0;
  }

  /* Picking runs the page's own action. If the page reports that the record is
     hidden by its filters, the picker says so and offers to reveal it rather
     than silently focusing something the reader cannot see. */
  async function pick(i) {
    const row = rows[i];
    if (!row || !scope || loading || !isOpen) return;
    const currentScope = scope;
    const result = scope.onPick ? await scope.onPick(row.id, row) : undefined;
    if (scope !== currentScope) return;
    if (result && result.hidden) {
      renderHidden(row, result.message);
      return;
    }
    close();
    input.blur();
  }

  function renderHidden(row, message) {
    bodyEl.innerHTML = `
      <div class="tps-state">
        <strong>${esc(row.label)}</strong> is in the archive but not in the current view.
        <span class="tiny">${esc(message || 'A filter on this page keeps it out.')}</span>
        <button class="dsh-btn small primary" type="button" id="tpsReveal">Show record</button>
      </div>`;
    bodyEl.querySelector('#tpsReveal')?.addEventListener('click', async () => {
      if (scope && scope.reveal) await scope.reveal(row.id, row);
      close();
    });
  }

  // ---- wiring ------------------------------------------------------------

  function bind() {
    input.addEventListener('focus', () => open());
    input.addEventListener('click', () => open());
    input.addEventListener('input', () => { if (!isOpen) open(); else refresh(); });

    input.addEventListener('keydown', async (ev) => {
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        if (!isOpen) { await open(); return; }
        focus = Math.min(focus + 1, Math.max(0, rows.length - 1));
        paintFocus();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        focus = Math.max(focus - 1, 0);
        paintFocus();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        await pick(focus);
      } else if (ev.key === 'Escape' || ev.key === 'Tab') {
        if (ev.key === 'Escape') { ev.preventDefault(); input.blur(); }
        close();
      }
    });

    document.addEventListener('click', (ev) => {
      if (!isOpen) return;
      if (ev.target.closest?.('[data-search-toggle], .picker-button, [data-sidebar-search]')) return;
      const path = ev.composedPath ? ev.composedPath() : [];
      if (path.includes(root) || root.contains(ev.target)) return;
      close();
    });

    document.addEventListener('keydown', (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        input.focus();
        open();
        return;
      }
      if (ev.key === 'Escape' && isOpen) { close(); return; }
      const typing = document.activeElement?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (!typing && ev.key === '/') { ev.preventDefault(); input.focus(); open(); }
    });
  }

  /* The page swaps its scope on every route change: the query is cleared, the
     previous rows are dropped and the picker closes, so a search can never leak
     from one page into the next. */
  function setScope(next) {
    scope = next || null;
    close();
    rows = [];
    input.removeAttribute('aria-activedescendant');
    input.value = '';
    input.placeholder = root?.classList?.contains('overview-ribbon-search') || !next
      ? 'Search…'
      : next.placeholder;
    input.disabled = !next;
    renderChips();
    renderFoot();
  }

  function init() {
    root = document.getElementById('topSearch');
    if (!root) return;
    input = root.querySelector('#topSearchInput');
    panel = root.querySelector('#topSearchPanel');
    bodyEl = root.querySelector('#tpsBody');
    chipsEl = root.querySelector('#tpsChips');
    footEl = root.querySelector('#tpsFoot');
    panel.hidden = true;
    const shortcut = 'CTRL K';
    const keyHint = root.querySelector('.search-kbd');
    if (keyHint) keyHint.textContent = shortcut;
    input.dataset.tooltip = `Search this page (${shortcut})`;
    bind();
  }

  return { init, setScope, open, close, refresh, isOpen: () => isOpen };
})();
