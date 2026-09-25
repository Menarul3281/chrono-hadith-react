/* Graph view — the archive as clusters of records and the relations it can
   actually evidence. Route: #graph, deep links #graph?node=<canonicalId>&cluster=<key>.

   Every node is a canonical record, and every edge declares one relationship
   type and comes from a field in the data: a chain adjacency is an isnad edge, a
   compiler's authorship is a compilation edge, an event's place is a location
   edge. Nothing is drawn as a line merely because two records fall in the same
   century, and the clusters that the reference layout shows but the archive
   cannot support (family lines, for instance) are listed as absent rather than
   sketched in. */

const GraphView = (() => {
  const CLUSTERS = [
    { key: 'prophets', label: 'Prophets & Key Figures', colour: 'var(--teal-soft)', match: (n) => n.kind === 'figure' && n.generation === 'prophet' },
    { key: 'companions', label: 'Companions', colour: 'var(--teal)', match: (n) => n.kind === 'figure' && n.generation === 'sahabi' },
    { key: 'narrators', label: "Tabi'un & later narrators", colour: 'var(--blue)', match: (n) => n.kind === 'figure' && ['tabii', 'taba-tabii', 'later', 'compiler'].includes(n.generation) },
    { key: 'books', label: 'Hadith Books & Sources', colour: 'var(--gold)', match: (n) => n.kind === 'book' },
    { key: 'events', label: 'Key Events', colour: 'var(--red)', match: (n) => n.kind === 'event' },
    { key: 'places', label: 'Important Places', colour: 'var(--cyan)', match: (n) => n.kind === 'place' },
    { key: 'dynasties', label: 'Dynasties & Periods', colour: 'var(--purple)', match: (n) => n.kind === 'dynasty' },
    { key: 'topics', label: 'Themes & Topics', colour: 'var(--orange)', match: (n) => n.kind === 'topic' },
  ];

  /* The reference bundles family and marriage clusters; the archive holds no such
     relationships, so they are named here as not held rather than invented. */
  const ABSENT = [
    { label: 'Family & Lineage', why: 'no lineage record in the archive yet' },
    { label: 'Wives & Family', why: 'no marriage record in the archive yet' },
  ];

  const EDGE_TYPES = {
    isnad: { label: 'Narrated from (isnad)', colour: 'var(--teal)' },
    compiled: { label: 'Compiled the work', colour: 'var(--gold)' },
    narrated: { label: 'Narrated a report', colour: 'var(--blue)' },
    located: { label: 'Sited at', colour: 'var(--cyan)' },
    participated: { label: 'Took part in', colour: 'var(--red)' },
    affiliated: { label: 'Ruled / associated', colour: 'var(--purple)' },
    cites: { label: 'Cites as a source', colour: 'var(--orange)' },
    recorded: { label: 'Recorded at', colour: 'var(--muted)' },
    topic: { label: 'Has topic', colour: 'var(--orange)' },
  };

  const state = {
    off: new Set(),            // cluster keys switched off
    expanded: new Set(),
    labels: true, arrows: true, density: 'comfortable',
    mode: 'graph',             // graph | table
    selectedId: null, cluster: null,
    zoom: 1, pan: { x: 0, y: 0 }, host: null,
  };

  const esc = ChronoData.esc;

  // ---- nodes and relations ----------------------------------------------

  function buildNodes() {
    const out = [];
    ChronoData.allFigures().forEach((f) => out.push({
      id: ChronoData.cid.figure(f.id), kind: 'figure', record: f,
      label: f.name, generation: f.generation, sub: f.role || f.generation,
    }));
    ChronoData.allBooks().forEach((b) => out.push({
      id: ChronoData.cid.book(b.id), kind: 'book', record: b,
      label: b.name, sub: [b.authors[0], b.death ? `d. ${b.death} CE` : b.generation].filter(Boolean).join(' · '),
    }));
    ChronoData.allEvents().forEach((e) => out.push({
      id: ChronoData.cid.event(e.id), kind: 'event', record: e, label: e.name, sub: `${e.year} CE`,
    }));
    ChronoData.allPlaces().forEach((p) => out.push({
      id: ChronoData.cid.place(p.id), kind: 'place', record: p, label: p.name, sub: p.region,
    }));
    ChronoData.allDynasties().forEach((d) => out.push({
      id: ChronoData.cid.dynasty(d.id), kind: 'dynasty', record: d, label: d.name, sub: `${d.start} – ${d.end}`,
    }));
    ChronoData.topics().forEach((t) => out.push({
      id: ChronoData.cid.topic(t.id), kind: 'topic', record: t, label: t.label, sub: t.kind,
    }));
    return out;
  }

  let cache = null;
  const allNodes = () => {
    if (!cache) cache = buildNodes();
    return cache;
  };
  const nodeById = (id) => allNodes().find((n) => n.id === id) || null;

  const push = (out, type, other, note) => {
    if (other) out.push({ type, other, note: note || '' });
  };

  /* The relations of one node, each with its type and a plain-language note.
     Every branch reads a field the record already carries. */
  function relationsOf(node) {
    if (!node) return [];
    const out = [];
    const { kind, record } = node;

    if (kind === 'figure') {
      ChronoData.allReports().forEach((h) => {
        const chain = h.chain || [];
        const idx = chain.findIndex((l) => l.narratorId === record.id);
        if (idx > 0) {
          const prev = ChronoData.figure(chain[idx - 1].narratorId);
          if (prev && prev.id !== record.id) push(out, 'isnad', ChronoData.cid.figure(prev.id), `received ${h.reference} from ${prev.name}`);
        }
        if (idx >= 0 && idx < chain.length - 1) {
          const next = ChronoData.figure(chain[idx + 1].narratorId);
          if (next) push(out, 'isnad', ChronoData.cid.figure(next.id), `passed ${h.reference} to ${next.name}`);
        }
      });
      ChronoData.booksOfFigure(record.id).forEach((b) => push(out, 'compiled', ChronoData.cid.book(b.id), 'compiler'));
      ChronoData.allEvents().forEach((e) => {
        if ((e.participants || []).includes(record.id)) push(out, 'participated', ChronoData.cid.event(e.id), 'participant');
      });
      ChronoData.placesOfFigure(record.id).forEach((p) => push(out, 'recorded', ChronoData.cid.place(p.id), 'recorded at'));
      ChronoData.allRulers().filter((r) => r.narratorId === record.id)
        .forEach((r) => push(out, 'affiliated', ChronoData.cid.ruler(r.id),
          `${r.title} of ${ChronoData.dynasty(r.dynastyId)?.name || ''}`.trim()));
    }

    if (kind === 'book') {
      (record.authorIds || []).forEach((fid) => push(out, 'compiled', ChronoData.cid.figure(fid), 'author'));
      ChronoData.eventsOfBook(record.id).forEach((e) => push(out, 'cites', ChronoData.cid.event(e.id), 'this event cites it'));
      ChronoData.dynastiesOfBook(record.id).forEach((d) => push(out, 'cites', ChronoData.cid.dynasty(d.id), 'this dynasty cites it'));
    }

    if (kind === 'event') {
      (record.dynastyIds || []).forEach((did) => push(out, 'affiliated', ChronoData.cid.dynasty(did), 'placed in this state’s history'));
      (record.participants || []).forEach((fid) => push(out, 'participated', ChronoData.cid.figure(fid), 'participant'));
      if (record.placeId) push(out, 'located', ChronoData.cid.place(record.placeId), 'location');
    }

    if (kind === 'place') {
      ChronoData.allEvents().filter((e) => e.placeId === record.id)
        .forEach((e) => push(out, 'located', ChronoData.cid.event(e.id), 'event sited here'));
      ChronoData.allDynasties().filter((d) => (d.capitalIds || []).includes(record.id))
        .forEach((d) => push(out, 'affiliated', ChronoData.cid.dynasty(d.id), 'capital'));
      ChronoData.allFigures().filter((f) => (f.locations || []).some((l) => l.toLowerCase() === record.name.toLowerCase()))
        .forEach((f) => push(out, 'recorded', ChronoData.cid.figure(f.id), 'recorded at this place'));
    }

    if (kind === 'dynasty') {
      ChronoData.rulersOfDynasty(record.id).forEach((r) => push(out, 'affiliated', ChronoData.cid.ruler(r.id), r.title));
      ChronoData.eventsOfDynasty(record.id).forEach((e) => push(out, 'affiliated', ChronoData.cid.event(e.id), 'in this dynasty’s history'));
      (record.capitalIds || []).forEach((pid) => push(out, 'located', ChronoData.cid.place(pid), 'capital'));
      ChronoData.allBooks().filter((b) => ChronoData.dynastiesOfBook(b.id).some((d) => d.id === record.id))
        .forEach((b) => push(out, 'cites', ChronoData.cid.book(b.id), 'its record cites this work'));
    }

    if (kind === 'ruler') {
      push(out, 'affiliated', ChronoData.cid.dynasty(record.dynastyId), 'ruled');
      if (record.narratorId) push(out, 'recorded', ChronoData.cid.figure(record.narratorId), 'profile in the archive');
    }

    if (kind === 'topic') {
      // A topic is attached to the works that hold a report on it.
      const books = new Map();
      ChronoData.reportsOfTopic(record.id).forEach((h) => {
        const b = ChronoData.bookOfReport(h);
        if (b) books.set(b.id, b);
      });
      books.forEach((b) => push(out, 'topic', ChronoData.cid.book(b.id), 'holds a report on this topic'));
    }

    return out.sort((a, b) => a.type.localeCompare(b.type) || a.note.localeCompare(b.note));
  }

  // ---- canvas -------------------------------------------------------------

  const W = 1200, H = 760;
  const HUB = { x: W / 2, y: H / 2 };

  /* Cluster cards sit on a ring at fixed angles, so the same archive always draws
     the same diagram — the layout is deterministic, not random per render. */
  const RING = [
    { r: 258, a: -90 }, { r: 300, a: -45 }, { r: 300, a: 0 }, { r: 300, a: 45 },
    { r: 258, a: 90 }, { r: 300, a: 135 }, { r: 300, a: 180 }, { r: 300, a: -135 },
  ];

  function clusterCards() {
    const active = CLUSTERS.filter((c) => !state.off.has(c.key));
    return active.map((c, i) => {
      const ring = RING[i % RING.length];
      const rad = (ring.a * Math.PI) / 180;
      const cx = HUB.x + Math.cos(rad) * ring.r;
      const cy = HUB.y + Math.sin(rad) * ring.r;
      const nodes = allNodes().filter(c.match);
      const expanded = state.expanded.has(c.key);
      const shown = expanded ? nodes.slice(0, 60) : nodes.slice(0, 4);
      const rows = Math.max(1, Math.ceil(shown.length / 2));
      const h = 46 + rows * 20;
      const w = expanded ? 280 : 216;
      return { cluster: c, x: cx - w / 2, y: cy - h / 2, w, h, nodes, shown, expanded };
    });
  }

  const nodeChip = (node, x, y, w) => {
    const selected = state.selectedId === node.id;
    return `
      <g class="gph-node${selected ? ' selected' : ''}" data-node="${esc(node.id)}" tabindex="0" role="button"
         aria-label="${esc(node.label)}">
        <title>${esc(`${node.label} — ${node.sub || node.kind}`)}</title>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(40, w - 6).toFixed(1)}" height="16" rx="8"/>
        ${state.labels ? `<text x="${(x + 8).toFixed(1)}" y="${(y + 11).toFixed(1)}">${esc(node.label.slice(0, 24))}</text>` : ''}
      </g>`;
  };

  /* The relations a selected node is documented as having, deduplicated, capped
     so a hub figure with eighty chains does not flood the canvas. */
  function edgesFor(node) {
    if (!node) return [];
    const seen = new Map();
    relationsOf(node).forEach((r) => {
      const other = nodeById(r.other);
      if (!other) return;
      const key = `${other.id}|${r.type}`;
      if (!seen.has(key)) seen.set(key, { other, type: r.type });
    });
    return [...seen.values()].slice(0, 14);
  }

  function spokes(node) {
    if (!node) return '';
    const cards = clusterCards();
    const cardOf = (id) => cards.find((c) => c.nodes.some((n) => n.id === id));
    const start = cardOf(node.id);
    const from = start ? { x: start.x + start.w / 2, y: start.y + start.h / 2 } : HUB;
    return edgesFor(node).map((edge, i) => {
      const target = cardOf(edge.other.id);
      const to = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : HUB;
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2 - 80 - i * 8;
      const colour = EDGE_TYPES[edge.type]?.colour || 'var(--muted)';
      return `
        <path class="gph-edge" d="M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}"
              style="--edge:${colour}"${state.arrows ? ' marker-end="url(#gphArrow)"' : ''}/>
        <circle class="gph-edge-dot" cx="${to.x.toFixed(1)}" cy="${to.y.toFixed(1)}" r="4" style="--edge:${colour}"/>`;
    }).join('');
  }

  function canvasHtml() {
    const cards = clusterCards();
    const node = nodeById(state.selectedId);
    const hub = allNodes().find((n) => n.kind === 'figure' && n.record.id === 'prophet');

    return `
      <svg class="gph-svg" id="gphSvg" viewBox="0 0 ${W} ${H}" role="img"
           aria-label="Knowledge graph of the records in this archive and their documented relations">
        <defs>
          <marker id="gphArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 Z" fill="currentColor"/>
          </marker>
          <radialGradient id="gphHub" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="rgba(52,246,193,0.20)"/>
            <stop offset="1" stop-color="rgba(52,246,193,0)"/>
          </radialGradient>
          <pattern id="gphGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0 H0 V40" fill="none" stroke="rgba(52,246,193,0.05)" stroke-width="1"/>
          </pattern>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#gphGrid)"/>
        <g id="gphView">
          <circle cx="${HUB.x}" cy="${HUB.y}" r="150" fill="url(#gphHub)"/>
          <g class="gph-hub"${hub ? ` data-node="${esc(hub.id)}" tabindex="0" role="button"` : ''}>
            <circle cx="${HUB.x}" cy="${HUB.y}" r="46"/>
            <text x="${HUB.x}" y="${HUB.y - 2}" text-anchor="middle" class="gph-hub-name">Muhammad &#65018;</text>
            <text x="${HUB.x}" y="${HUB.y + 14}" text-anchor="middle" class="gph-hub-sub">${ChronoData.allReports().length} reports</text>
          </g>
          <g class="gph-edges">${spokes(node)}</g>
          ${cards.map((c) => `
            <g class="gph-cluster${c.expanded ? ' expanded' : ''}" style="--cluster:${c.cluster.colour}">
              <rect class="gph-card" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" width="${c.w}" height="${c.h}" rx="12"/>
              <text class="gph-card-title" x="${(c.x + 12).toFixed(1)}" y="${(c.y + 20).toFixed(1)}">${esc(c.cluster.label)}</text>
              <text class="gph-card-count" x="${(c.x + c.w - 12).toFixed(1)}" y="${(c.y + 20).toFixed(1)}" text-anchor="end">${c.nodes.length}</text>
              ${c.shown.map((n, i) => nodeChip(n,
                c.x + 8 + (i % 2) * ((c.w - 16) / 2),
                c.y + 30 + Math.floor(i / 2) * 20,
                (c.w - 16) / 2)).join('')}
              <g class="gph-more" data-cluster="${esc(c.cluster.key)}" tabindex="0" role="button"
                 aria-label="${c.expanded ? 'Show fewer' : 'Show more'} in ${esc(c.cluster.label)}">
                <rect x="${(c.x + 8).toFixed(1)}" y="${(c.y + c.h - 20).toFixed(1)}" width="${Math.min(126, c.w - 16)}" height="16" rx="8"/>
                <text x="${(c.x + 14).toFixed(1)}" y="${(c.y + c.h - 8).toFixed(1)}">${c.expanded ? 'Show fewer' : `Show all ${c.nodes.length}`}</text>
              </g>
            </g>`).join('')}
        </g>
      </svg>`;
  }

  /* One place decides where a node's own page is, so the graph, the picker and
     every panel agree. */
  function pageHref(node) {
    const { kind, id } = ChronoData.resolve(node.id);
    switch (kind) {
      case 'figure': return `#figures?id=${encodeURIComponent(id)}`;
      case 'book': return `#books?id=${encodeURIComponent(id)}`;
      case 'event': return ChronoData.links.event(id, 'graph');
      case 'place': return `#places?id=${encodeURIComponent(id)}`;
      case 'dynasty': return ChronoData.links.dynasty(id, 'graph');
      case 'report': return `#hadiths?id=${encodeURIComponent(id)}`;
      case 'topic': return `#hadiths?id=${encodeURIComponent(ChronoData.reportsOfTopic(id)[0]?.id || '')}`;
      default: return '#graph';
    }
  }

  // ---- controls, panel and public ---------------------------------------

  function controlsHtml() {
    const node = nodeById(state.selectedId);
    const stats = [
      ['Nodes', allNodes().length],
      ['Relations', node ? relationsOf(node).length : 0],
      ['Isnad edges', node ? relationsOf(node).filter((r) => r.type === 'isnad').length : 0],
    ];
    return `
      <aside class="gph-rail" aria-label="Graph controls">
        <div class="gph-stats">
          ${stats.map(([label, value]) => `
            <div class="gph-stat"><span class="gph-stat-num">${value}</span><span class="gph-stat-lbl">${esc(label)}</span></div>`).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Filters</h2>
          ${CLUSTERS.map((c) => `
            <label class="dsh-check">
              <input type="checkbox" data-gphcluster="${esc(c.key)}"${state.off.has(c.key) ? '' : ' checked'}>
              <span class="dsh-box" aria-hidden="true"></span>
              <span class="dsh-dot" style="--dot:${c.colour}"></span>
              <span class="dsh-check-label">${esc(c.label)}</span>
              <span class="dsh-check-count">${allNodes().filter(c.match).length}</span>
            </label>`).join('')}
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Display</h2>
          <label class="dsh-switch">
            <input type="checkbox" id="gphLabels"${state.labels ? ' checked' : ''}>
            <span class="dsh-switch-track" aria-hidden="true"></span>
            <span>Node labels</span>
          </label>
          <label class="dsh-switch">
            <input type="checkbox" id="gphArrows"${state.arrows ? ' checked' : ''}>
            <span class="dsh-switch-track" aria-hidden="true"></span>
            <span>Edge arrows</span>
          </label>
        </div>

        <div class="dsh-group">
          <h2 class="dsh-group-title">Legend · edge types</h2>
          <ul class="gph-legend">
            ${Object.entries(EDGE_TYPES).map(([key, meta]) => `
              <li class="gph-legend-item" style="--edge:${meta.colour}"><span class="gph-legend-line"></span>${esc(meta.label)}</li>`).join('')}
          </ul>
          <p class="dsh-footnote">Clusters the reference layout shows but the archive cannot evidence yet:
            ${ABSENT.map((a) => `${esc(a.label)} (${esc(a.why)})`).join('; ')}.</p>
        </div>
      </aside>`;
  }

  const hubId = () => {
    const hub = allNodes().find((n) => n.kind === 'figure' && n.record.id === 'prophet');
    return hub ? hub.id : '';
  };

  /* A readable name for any canonical id, including the families that are not
     graph nodes themselves (a report is shown through its reference). */
  const displayLabel = (id) => {
    const n = nodeById(id);
    if (n) return n.label;
    const r = ChronoData.resolve(id);
    return ChronoData.labelOf(r.kind, r.record) || id;
  };

  function panelContentsHtml(node) {
    if (!node) {
      return `<div class="dsh-empty">Select a node in the graph.<span class="tiny">Every node is a record
        held in this archive.</span></div>`;
    }
    const rels = relationsOf(node);
    /* Reports are not graph nodes — the canvas draws record families — so the
       reports this record is evidenced with are listed as links to their own
       page rather than as rows that would select nothing. */
    const reportLinks = ChronoData.reportLinksOf(node);
    const groups = new Map();
    rels.forEach((r) => groups.set(r.type, (groups.get(r.type) || []).concat({ note: r.note, node: r.other })));
    reportLinks.forEach((r) => groups.set(r.type, (groups.get(r.type) || []).concat({
      note: r.note,
      href: `#hadiths?id=${encodeURIComponent(r.report.id)}`,
      label: r.report.reference,
    })));
    const groupRows = [...groups.entries()];
    return `
      <div class="ev-panel-head">
        <h2 class="ev-panel-title">${esc(node.label)}</h2>
        <div class="ev-panel-meta">
          <span class="ev-meta">${esc(node.kind)}</span>
          ${node.sub ? `<span class="ev-meta">${esc(node.sub)}</span>` : ''}
        </div>
      </div>
      <div class="ev-tabbody" id="gphTabBody">
        <div class="ev-linkrow">
          <a class="dsh-btn small primary" href="${pageHref(node)}">Open on its page</a>
          <button class="dsh-btn small" type="button" id="gphClear">Clear selection</button>
        </div>
        ${groupRows.length ? groupRows.map(([type, list]) => `
          <h3 class="ev-subhead">${esc(EDGE_TYPES[type]?.label || type)} · ${list.length}</h3>
          <div class="gph-rels">
            ${list.slice(0, 40).map((row) => (row.href
              ? `<a class="gph-rel" href="${esc(row.href)}"
                    style="--edge:${EDGE_TYPES[type]?.colour || 'var(--muted)'}">
                  <span class="gph-rel-name">${esc(row.label)}</span>
                  <span class="gph-rel-note">${esc(row.note)} → its report page</span>
                </a>`
              : `<button class="gph-rel" type="button" data-node="${esc(row.node)}"
                    style="--edge:${EDGE_TYPES[type]?.colour || 'var(--muted)'}">
                  <span class="gph-rel-name">${esc(displayLabel(row.node))}</span>
                  <span class="gph-rel-note">${esc(row.note)}</span>
                </button>`)).join('')}
          </div>`).join('')
          : '<p class="ev-note">No documented relation for this record in the archive yet.</p>'}
        <p class="ev-note">Edges follow the records: a chain adjacency is an isnad edge, a compiler's
        authorship a compilation edge, an event's place a location edge. Records that merely share a
        century are not joined.</p>
      </div>`;
  }

  /* ---- the two views of the canvas area ----------------------------------
     Graph draws the clusters; Table lists the same nodes as rows. Both read the
     same node set, so switching never changes the selection. */

  function nodeYear(node) {
    const { kind, record } = node;
    if (kind === 'event') return record.year;
    if (kind === 'dynasty') return record.start;
    if (kind === 'book') return typeof record.death === 'number' ? record.death : null;
    if (kind === 'figure') return typeof record.birthYear === 'number' ? record.birthYear
      : (typeof record.deathYear === 'number' ? record.deathYear : null);
    if (kind === 'place') return (record.milestones || [])[0]?.year ?? null;
    return null;
  }

  const visibleNodes = () => allNodes().filter((n) => {
    const c = CLUSTERS.find((x) => x.match(n));
    return c && !state.off.has(c.key);
  });

  function tableHtml() {
    const nodes = visibleNodes();
    return `
      <div class="gph-table-wrap">
        <div class="dsh-footnote">${nodes.length} nodes in the visible clusters</div>
        <table class="gph-table">
          <thead><tr><th>Record</th><th>Family</th><th>Date</th><th>Relations</th></tr></thead>
          <tbody>
            ${nodes.slice(0, 300).map((n) => `
              <tr class="gph-tr${state.selectedId === n.id ? ' selected' : ''}" data-node="${esc(n.id)}" tabindex="0" role="button">
                <td>${esc(n.label)}</td>
                <td>${esc(n.kind)}</td>
                <td>${nodeYear(n) ?? '—'}</td>
                <td>${relationsOf(n).length}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function modeBarHtml() {
    const modes = [['graph', 'Knowledge Graph'], ['table', 'Table']];
    return `
      <div class="gph-modes" role="group" aria-label="Graph view">
        ${modes.map(([key, label]) => `
          <button class="dsh-view-btn${state.mode === key ? ' active' : ''}" type="button" data-gphmode="${key}">${esc(label)}</button>`).join('')}
      </div>`;
  }

  function canvasWrapHtml() {
    if (state.mode === 'table') return `${modeBarHtml()}<div class="gph-slot">${tableHtml()}</div>`;
    return `${modeBarHtml()}${canvasHtml()}
      <div class="gph-zoom">
        <button class="dsh-iconbtn" type="button" data-gphmap="in" aria-label="Zoom in" title="Zoom in"><span class="nav-icon" data-icon="zoom-in"></span></button>
        <button class="dsh-iconbtn" type="button" data-gphmap="out" aria-label="Zoom out" title="Zoom out"><span class="nav-icon" data-icon="zoom-out"></span></button>
        <button class="dsh-iconbtn" type="button" data-gphmap="fit" aria-label="Fit to screen" title="Fit to screen"><span class="nav-icon" data-icon="recenter"></span></button>
      </div>
      <div class="gph-minimap" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}"/></svg></div>`;
  }


  const shellHtml = () => `
    <div class="dsh gph">
      <div class="gph-canvas-wrap" id="gphCanvasWrap">
        ${canvasWrapHtml()}
      </div>
      ${controlsHtml()}
      <aside class="dsh-panel gph-panel" id="gphPanel" aria-label="Selected node">
        ${panelContentsHtml(nodeById(state.selectedId))}
      </aside>
    </div>`;

  // ---- binding -----------------------------------------------------------

  function renderCanvas() {
    const wrap = state.host.querySelector('#gphCanvasWrap');
    wrap.innerHTML = canvasWrapHtml();
    Icons.init(wrap);
    bindCanvas(wrap);
    applyTransform();
  }

  function renderRail() {
    const rail = state.host.querySelector('.gph-rail');
    rail.outerHTML = controlsHtml();
    bindRail(state.host.querySelector('.gph-rail'));
  }

  function renderPanel() {
    const host = state.host.querySelector('#gphPanel');
    host.innerHTML = panelContentsHtml(nodeById(state.selectedId));
    Icons.init(host);
    bindPanel(host);
  }

  function applyTransform() {
    const g = state.host.querySelector('#gphView');
    if (!g) return;
    const s = state.zoom;
    g.setAttribute('transform',
      `translate(${((W / 2) * (1 - s) + state.pan.x).toFixed(1)} ${((H / 2) * (1 - s) + state.pan.y).toFixed(1)}) scale(${s.toFixed(3)})`);
    const box = state.host.querySelector('.gph-minimap rect');
    if (box) {
      const size = Math.max(60, W * s);
      box.setAttribute('x', Math.max(0, (W - size) / 2 - state.pan.x).toFixed(1));
      box.setAttribute('y', Math.max(0, (H - size) / 2 - state.pan.y).toFixed(1));
      box.setAttribute('width', size.toFixed(1));
      box.setAttribute('height', Math.max(60, H * s).toFixed(1));
    }
  }

  function selectNode(id) {
    if (!nodeById(id)) return;
    state.selectedId = id;
    ChronoData.remember({ graphNode: id });
    if (location.hash.startsWith('#graph')) {
      history.replaceState(null, '', `#graph?node=${encodeURIComponent(id)}`);
    }
    renderCanvas();
    renderRail();
    renderPanel();
  }

  function on(el, type, fn) {
    const key = `__gphb_${type}`;
    if (!el || el[key]) return;
    el[key] = true;
    el.addEventListener(type, fn);
  }

  function bindCanvas(scope) {
    scope.querySelectorAll('[data-gphmode]').forEach((btn) => {
      on(btn, 'click', () => {
        state.mode = btn.dataset.gphmode;
        renderCanvas();
      });
    });
    scope.querySelectorAll('[data-node]').forEach((el) => {
      on(el, 'click', () => selectNode(el.dataset.node));
      on(el, 'keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectNode(el.dataset.node); }
      });
    });
    scope.querySelectorAll('[data-cluster]').forEach((el) => {
      const toggle = () => {
        const key = el.dataset.cluster;
        if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key);
        renderCanvas();
      };
      on(el, 'click', toggle);
      on(el, 'keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
      });
    });
    scope.querySelectorAll('[data-gphmap]').forEach((btn) => {
      on(btn, 'click', () => {
        const mode = btn.dataset.gphmap;
        if (mode === 'in') state.zoom = Math.min(2.4, state.zoom * 1.2);
        else if (mode === 'out') state.zoom = Math.max(0.6, state.zoom / 1.2);
        else { state.zoom = 1; state.pan = { x: 0, y: 0 }; }
        applyTransform();
      });
    });

    const svg = scope.querySelector('#gphSvg');
    if (!svg) return;
    let drag = null;
    svg.addEventListener('pointerdown', (ev) => {
      drag = { x: ev.clientX, y: ev.clientY, pan: { ...state.pan } };
      svg.setPointerCapture(ev.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const box = svg.getBoundingClientRect();
      const k = W / (box.width || 1);
      state.pan = { x: drag.pan.x + (ev.clientX - drag.x) * k, y: drag.pan.y + (ev.clientY - drag.y) * k };
      applyTransform();
    });
    const end = (ev) => {
      if (!drag) return;
      drag = null;
      svg.classList.remove('dragging');
      if (svg.hasPointerCapture?.(ev.pointerId)) svg.releasePointerCapture(ev.pointerId);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      state.zoom = Math.min(2.4, Math.max(0.6, state.zoom * (ev.deltaY < 0 ? 1.08 : 1 / 1.08)));
      applyTransform();
    }, { passive: false });
  }

  function bindRail(scope) {
    scope.querySelectorAll('[data-gphcluster]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.off.delete(cb.dataset.gphcluster);
        else state.off.add(cb.dataset.gphcluster);
        renderCanvas();
      });
    });
    scope.querySelector('#gphLabels')?.addEventListener('change', (ev) => {
      state.labels = ev.target.checked;
      renderCanvas();
    });
    scope.querySelector('#gphArrows')?.addEventListener('change', (ev) => {
      state.arrows = ev.target.checked;
      renderCanvas();
    });
  }

  function bindPanel(scope) {
    scope.querySelectorAll('[data-node]').forEach((el) => {
      on(el, 'click', () => selectNode(el.dataset.node));
    });
    scope.querySelector('#gphClear')?.addEventListener('click', () => {
      state.selectedId = null;
      if (location.hash.startsWith('#graph')) history.replaceState(null, '', '#graph');
      renderCanvas();
      renderRail();
      renderPanel();
    });
  }

  /* ---- public ------------------------------------------------------------ */

  async function render(host, params) {
    await ChronoData.load();
    if (!host.isConnected) return;
    state.host = host;

    const get = (k) => (params && params.get ? params.get(k) : null);
    const stored = ChronoData.recall();

    // The record the link or the last visit asks for, resolved before either
    // renderer is chosen.
    const wanted = get('node') || stored.graphNode || null;

    state.off = new Set();
    state.expanded = new Set();
    state.zoom = 1;
    state.pan = { x: 0, y: 0 };
    state.labels = true;
    state.arrows = true;

    /* React owns the page when its modules are present (src/graph/GraphFlow.js,
       loaded with the app shell). It is given its own child container rather than
       #page, so React never owns the router's element; and if the mount fails for
       any reason, the fallback below draws the page instead of leaving it empty. */
    if (window.ChronoGraph && typeof window.ChronoGraph.mount === 'function') {
      try {
        const mount = document.createElement('div');
        mount.className = 'graph-root';
        host.replaceChildren(mount);
        window.ChronoGraph.mount(mount, { initial: wanted });
        state.react = true;
        return;
      } catch (err) {
        console.error('React graph failed to mount; drawing it with the fallback renderer.', err);
      }
    }
    state.react = false;

    // The modules had not arrived when this ran: take the page over if they do,
    // so the fallback is never the last word on a route React can draw.
    window.addEventListener('chrono-graph-ready', () => {
      if (location.hash.startsWith('#graph')) {
        render(host, new URLSearchParams((location.hash.split('?')[1] || '')));
      }
    }, { once: true });

    state.selectedId = wanted && nodeById(wanted) ? wanted : null;
    // The panel and the address bar agree, as on the React path: an id the archive
    // does not hold is not left in the URL claiming a node that is not drawn.
    if (wanted && !state.selectedId) history.replaceState(null, '', '#graph');

    host.innerHTML = shellHtml();
    Icons.init(host);
    bindCanvas(host.querySelector('#gphCanvasWrap'));
    bindRail(host.querySelector('.gph-rail'));
    bindPanel(host.querySelector('#gphPanel'));
    applyTransform();
  }
  function searchScope() {
    const built = allNodes().map((n) => ({
      id: n.id,
      label: n.label,
      group: n.kind,
      meta: n.kind,
      sub: n.sub || '',
      icon: n.kind === 'place' ? 'places' : n.kind === 'dynasty' ? 'crown' : n.kind === 'event' ? 'calendar'
        : n.kind === 'book' ? 'books' : n.kind === 'report' ? 'hadiths' : 'people',
      colour: 'var(--teal-soft)',
      hay: `${n.label} ${n.sub || ''} ${n.kind}`.toLowerCase(),
    }));
    let chip = 'all';
    return {
      label: 'Graph',
      placeholder: 'Search graph nodes…',
      hint: 'Figures, books, events, places, dynasties, rulers, topics and reports',
      activeChip: () => chip,
      chips: () => [
        { key: 'all', label: 'All nodes', count: built.length },
        ...['figure', 'book', 'event', 'place', 'dynasty', 'topic'].map((k) => ({
          key: k, label: `${k}s`, count: built.filter((r) => r.group === k).length,
        })).filter((c) => c.count > 0),
      ],
      setChip: (key) => { chip = key; },
      rows: ({ query }) => built
        .filter((r) => chip === 'all' || r.group === chip)
        .filter((r) => !query || r.hay.includes(query)),
      onPick: (id) => selectAny(id),
      reveal: (id) => { state.off = new Set(); selectAny(id); },
    };
  }

  /* Selecting from the shared picker: hand it to React when React is drawing the
     page, otherwise to the fallback renderer. */
  function selectAny(id) {
    if (state.react && window.ChronoGraph) { window.ChronoGraph.select(id); return; }
    selectNode(id);
  }

  /* The families, the ones the archive cannot evidence, and the node list are part
     of this page's public shape: the Overview draws the same eight families and
     counts them off the same list, so the two pages cannot disagree about what a
     family is or how big it is. */
  return { render, searchScope, CLUSTERS, ABSENT, allNodes };
})();
