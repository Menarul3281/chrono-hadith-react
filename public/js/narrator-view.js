/* Narrator view — grid + detail. Route: #figures and #figures?id=<narratorId> */

const NarratorView = (() => {
  const GEN_COLORS = {
    prophet:      'var(--gen-prophet)',
    sahabi:       'var(--gen-sahabi)',
    tabii:        'var(--gen-tabii)',
    'taba-tabii': 'var(--gen-taba-tabii)',
    later:        'var(--gen-later)',
    compiler:     'var(--gen-compiler)',
  };
  const GEN_LABELS = {
    prophet:      'Prophet',
    sahabi:       'Companion',
    tabii:        "Tabi'i",
    'taba-tabii': "Taba' al-Tabi'in",
    later:        'Scholar',
    compiler:     'Compiler',
  };

  const colorFor = (n) => GEN_COLORS[n.generation] || 'var(--teal)';
  const labelFor = (n) => GEN_LABELS[n.generation] || n.generation;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Initials from Arabic name — first letter of first two words
  function initials(n) {
    const src = n.arabic || n.name || '';
    const parts = src.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0] || '').join('') || '·';
  }

  let activeFilter = 'all';
  let searchQuery = '';
  let currentContainer = null;

  /* ==================== GRID ==================== */

  function gridHtml(narrators) {
    const filters = [
      ['all', 'All'],
      ['prophet', 'Prophet'],
      ['sahabi', 'Companions'],
      ['tabii', "Tabi'un"],
      ['taba-tabii', "Taba' al-Tabi'in"],
      ['later', 'Scholars'],
      ['compiler', 'Compilers'],
    ];

    return `
      <div class="figures-page">
        <div class="figures-head">
          <div>
            <h2>Companions, narrators, scholars, and compilers</h2>
          </div>
        </div>

        <div class="figures-filters" id="figuresFilters">
          ${filters.map(([key, label]) => `
            <button class="filter-chip ${key === activeFilter ? 'active' : ''}" data-filter="${key}">
              ${label}
            </button>
          `).join('')}
        </div>

        <div class="figures-grid" id="figuresGrid"></div>
      </div>
    `;
  }

  function figureCard(n) {
    const color = colorFor(n);
    const dates = [n.birth, n.death].filter(Boolean).join(' – ') || '—';

    return `
      <button class="figure-card" data-id="${esc(n.id)}" style="--gen-color:${color}">
        <div class="figure-card-top">
          <div class="figure-avatar">${esc(initials(n))}</div>
          <div class="figure-card-head">
            <div class="figure-card-name">${esc(n.name)}</div>
            <div class="figure-card-role">${esc(n.role || labelFor(n))}</div>
          </div>
        </div>
        ${n.arabic ? `<div class="figure-card-arabic">${esc(n.arabic)}</div>` : ''}
        <div class="figure-card-meta">
          <span>${esc(dates)}</span>
          <span class="gen-pill">${esc(labelFor(n))}</span>
        </div>
      </button>
    `;
  }

  function renderGrid(container) {
    const grid = container.querySelector('#figuresGrid');
    const narrators = Object.values(DataLoader.listNarrators())
      .filter((n) => n.id !== 'prophet')
      .filter((n) => activeFilter === 'all' || n.generation === activeFilter)
      .filter((n) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (n.name + ' ' + (n.arabic || '') + ' ' + (n.role || '')).toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Sort by generation order, then name
        const order = ['prophet', 'sahabi', 'tabii', 'taba-tabii', 'later', 'compiler'];
        const diff = order.indexOf(a.generation) - order.indexOf(b.generation);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

    if (!narrators.length) {
      grid.innerHTML = `
        <div class="figures-empty">
          No figures match your search.
        </div>
      `;
      return;
    }

    grid.innerHTML = narrators.map(figureCard).join('');

    grid.querySelectorAll('[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#figures?id=${el.dataset.id}`;
      });
    });
  }

  /* ==================== DETAIL ==================== */

  function relationRow(n, role) {
    const color = colorFor(n);
    const dates = [n.birth, n.death].filter(Boolean).join(' – ') || '—';
    return `
      <button class="relation-row" data-jump="${esc(n.id)}" style="--gen-color:${color}">
        <span class="relation-avatar">${esc(initials(n))}</span>
        <span class="relation-info">
          <strong>${esc(n.name)}</strong>
          <span>${esc(dates)} · ${esc(role || labelFor(n))}</span>
        </span>
        <span class="relation-arrow">→</span>
      </button>
    `;
  }

  function hadithRow(h) {
    const isNarrator = h.narratorId === currentContainer;
    return `
      <button class="hadith-row" data-hadith="${esc(h.id)}">
        <span class="hadith-row-badge">${esc(h.grade || '—')}</span>
        <span class="hadith-row-main">
          <strong>${esc(h.translation)}</strong>
          <span>${esc(h.collection)}</span>
        </span>
        <span class="hadith-row-ref">${esc(h.reference)}</span>
      </button>
    `;
  }

  function detailHtml(n, id) {
    const color = colorFor(n);

    // Resolve teachers/students
    const teacherIds = n.teachers || [];
    const studentIds = n.students || [];
    const teachers = teacherIds.map((tid) => DataLoader.getNarrator(tid)).filter(Boolean);
    const students = studentIds.map((sid) => DataLoader.getNarrator(sid)).filter(Boolean);

    // Find hadiths that include this narrator in their chain
    const allHadiths = DataLoader.listHadiths();
    const hadithsThroughThis = allHadiths.filter((h) =>
      h.chain.some((link) => link.narratorId === id)
    );

    // Dates
    const dates = [n.birth, n.death].filter(Boolean).join(' – ') || '—';
    const locations = (n.locations || []).join(' · ') || '—';

    return `
      <div class="narrator-page">
        <button class="narrator-back" id="backToFigures">← All figures</button>

        <div class="narrator-hero" style="--gen-color:${color}">
          <div class="narrator-hero-inner">
            ${n.arabic ? `<div class="narrator-hero-arabic">${esc(n.arabic)}</div>` : ''}
            <h1 class="narrator-hero-name">${esc(n.name)}</h1>
            <div class="narrator-hero-meta">
              <span class="gen-pill">${esc(labelFor(n))}</span>
              <span>${esc(dates)}</span>
              ${locations !== '—' ? `<span>·</span><span>${esc(locations)}</span>` : ''}
            </div>
            ${n.bio ? `<p class="narrator-hero-bio">${esc(n.bio)}</p>` : ''}
            <div class="narrator-hero-actions">
              <button class="hero-btn" data-copy-bio>
                <span class="nav-icon" data-icon="external" style="width:12px;height:12px"></span>
                Copy bio
              </button>
            </div>
          </div>
        </div>

        <div class="narrator-stats">
          <div class="stat-tile">
            <strong>${hadithsThroughThis.length}</strong>
            <span>Reports</span>
          </div>
          <div class="stat-tile">
            <strong>${teachers.length}</strong>
            <span>Teachers</span>
          </div>
          <div class="stat-tile">
            <strong>${students.length}</strong>
            <span>Students</span>
          </div>
          <div class="stat-tile">
            <strong>${teachers.length + students.length}</strong>
            <span>Connections</span>
          </div>
        </div>

        <div class="relations-grid">
          <div class="relation-col">
            <h3>Teachers <span class="count">${teachers.length}</span></h3>
            <div class="relation-list">
              ${teachers.length
                ? teachers.map((t) => relationRow(t, 'Teacher')).join('')
                : `<div class="relation-empty">No teachers recorded in the archive.</div>`}
            </div>
          </div>

          <div class="relation-col">
            <h3>Students <span class="count">${students.length}</span></h3>
            <div class="relation-list">
              ${students.length
                ? students.map((s) => relationRow(s, 'Student')).join('')
                : `<div class="relation-empty">No students recorded in the archive.</div>`}
            </div>
          </div>
        </div>

        <div class="narrator-hadiths">
          <h3>Reports in the archive <span class="count">${hadithsThroughThis.length}</span></h3>
          ${hadithsThroughThis.length
            ? hadithsThroughThis.map(hadithRow).join('')
            : `<div class="relation-empty">No reports in the archive pass through this figure yet.</div>`}
        </div>

        <div class="network-card">
          <h3>Network</h3>
          <div class="network-canvas-wrap">
            <canvas id="networkCanvas"></canvas>
          </div>
        </div>
      </div>
    `;
  }

  /* ==================== BINDING ==================== */

  function bindGrid(container) {
    const search = container.querySelector('#figuresSearch');
    if (search) {
      search.addEventListener('input', () => {
        searchQuery = search.value;
        renderGrid(container);
      });
    }
    container.querySelectorAll('[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter;
        container.querySelectorAll('[data-filter]').forEach((c) =>
          c.classList.toggle('active', c.dataset.filter === activeFilter)
        );
        renderGrid(container);
      });
    });
    renderGrid(container);
  }

  function bindDetail(container, n, id) {
    container.querySelector('#backToFigures').addEventListener('click', () => {
      location.hash = '#figures';
    });

    container.querySelectorAll('[data-jump]').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#figures?id=${el.dataset.jump}`;
      });
    });

    container.querySelectorAll('[data-hadith]').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#isnad?hadith=${el.dataset.hadith}`;
      });
    });

    const copyBtn = container.querySelector('[data-copy-bio]');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = [
          n.name,
          n.arabic ? `(${n.arabic})` : '',
          [n.birth, n.death].filter(Boolean).join(' – '),
          '',
          n.bio || '',
        ].filter(Boolean).join('\n');
        const ok = await Clipboard.copy(text);
        if (ok) {
          window.showToast?.('Bio copied to clipboard');
        }
      });
    }

    /* The network card. One node list serves both renderers — React Flow draws it
       when its modules are present (src/graph/NarratorFlow.js) and the canvas draws
       it when they are not — so the card cannot show two different networks. Each
       figure carries the generation the archive records and the family colour the
       canvas always used; the click-through to a figure is the same either way. */
    const wrap = container.querySelector('.network-canvas-wrap');
    const teacherNodes = (n.teachers || [])
      .map((tid) => DataLoader.getNarrator(tid))
      .filter(Boolean)
      .map((t) => ({
        id: t.id,
        label: t.name,
        short: t.name.split(' ').slice(0, 2).join(' '),
        side: 'up',
        gen: labelFor(t),
        color: colorFor(t),
        onClick: () => { location.hash = `#figures?id=${t.id}`; },
      }));

    const studentNodes = (n.students || [])
      .map((sid) => DataLoader.getNarrator(sid))
      .filter(Boolean)
      .map((s) => ({
        id: s.id,
        label: s.name,
        short: s.name.split(' ').slice(0, 2).join(' '),
        side: 'down',
        gen: labelFor(s),
        color: colorFor(s),
        onClick: () => { location.hash = `#figures?id=${s.id}`; },
      }));

    const networkNodes = [...teacherNodes, ...studentNodes];

    if (wrap && window.ChronoNarratorGraph && window.ChronoNarratorGraph.mount) {
      try {
        // The canvas belongs to the fallback: React Flow takes the card over.
        wrap.replaceChildren();
        window.ChronoNarratorGraph.mount(wrap, {
          centre: { id: n.id, label: n.name, gen: labelFor(n), colour: colorFor(n) },
          nodes: networkNodes,
        });
        container._network = 'react';
      } catch (err) {
        console.error('React network failed to mount; drawing it on the canvas instead.', err);
      }
    }

    if (container._network !== 'react') {
      const canvas = wrap ? wrap.querySelector('#networkCanvas') : container.querySelector('#networkCanvas');
      if (canvas) {
        container._graph = new NetworkGraph.Graph(canvas, {
          center: { id: n.id, label: n.name, color: colorFor(n) },
          nodes: networkNodes,
        });
      }
    }
  }

  /* ==================== RENDER ==================== */

  function render(container, params) {
    // Tear down prior graph
    if (currentContainer?._graph) {
      currentContainer._graph.destroy();
    }
    if (currentContainer?._network === 'react' && window.ChronoNarratorGraph) {
      window.ChronoNarratorGraph.unmount();
    }
    currentContainer = container;

    const id = params?.get?.('id');

    if (!id) {
      container.innerHTML = gridHtml();
      bindGrid(container);
      return;
    }

    const n = DataLoader.getNarrator(id);
    if (!n) {
      container.innerHTML = `
        <div class="figures-page">
          <div class="figures-empty">Figure "${esc(id)}" not found.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = detailHtml(n, id);
    bindDetail(container, n, id);
  }

  function destroy() {
    currentContainer?._graph?.destroy();
    window.ChronoNarratorGraph?.unmount();
    currentContainer = null;
  }

  return { render, destroy };
})();
