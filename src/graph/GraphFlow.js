/* Graph page, React edition.

   The canvas is React Flow (@xyflow/react), so the archive's records behave like
   a real graph: draggable nodes, pan and zoom, a mini-map, typed edges and a
   hover/press vocabulary that comes from the library's own interaction model.

   The board follows the reference layout this page was drawn from: the Prophet at
   the centre, family and lineage above him, the companions below him, the sources,
   places and events to the left, and the transmission — tabi'un, scholars and the
   books they carried — to the right. Records are placed on a grid of cells, one per
   cell, so no two cards can overlap; the relations between them are routed the way
   a circuit board routes a trace — straight runs and 45° bends, entering and
   leaving the sides that face each other. `layout()` above the components explains
   how a record is placed and `pcbPath()` how a line is drawn.

   Migrated as a Vite ESM module importing React Flow from npm — the library's own
   stylesheet comes with it (imported below when graph.css describes the app's
   palette on top of it). htm keeps the original template markup intact, with one
   caveat worth stating because it cost this page its edges once: htm hands props
   straight to React, so attributes have to be named the React way — `className`,
   `tabIndex`. A stray `class` on <Handle> is written to the DOM as a raw
   attribute that replaces the library's own className, the handle disappears from
   the library's measurements, and every edge of that node is dropped.

   The data comes from ChronoData — the same canonical records, ids and relations
   every other page reads — so nothing here knows a fact the archive does not
   hold. `js/graph-view.js` mounts this when the modules load and falls back to
   its own renderer when they do not. */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, Handle, Position, MarkerType, BaseEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const html = htm.bind(React.createElement);

// ---- families, layout and the record graph ------------------------------

/* The archive's families: what the rail's filters switch on and off, and the
   colour each record family is drawn in. They are the filter taxonomy, not the
   layout — where a record is placed on the board is the bands' business, below. */
const FAMILIES = [
  { key: 'prophet',    label: 'Prophets & Key Figures', colour: '#62f59a', match: (n) => n.kind === 'figure' && n.generation === 'prophet' },
  { key: 'companions', label: 'Companions',            colour: '#34f6c1', match: (n) => n.kind === 'figure' && n.generation === 'sahabi' },
  { key: 'narrators',  label: "Tabi'un & later",       colour: '#5a8dff', match: (n) => n.kind === 'figure' && ['tabii', 'taba-tabii', 'later', 'compiler'].includes(n.generation) },
  { key: 'books',      label: 'Hadith Books & Sources', colour: '#ffd45e', match: (n) => n.kind === 'book' },
  { key: 'events',     label: 'Key Events',            colour: '#ff5f70', match: (n) => n.kind === 'event' },
  { key: 'places',     label: 'Important Places',      colour: '#34c9ff', match: (n) => n.kind === 'place' },
  { key: 'dynasties',  label: 'Dynasties & Periods',   colour: '#ad68ff', match: (n) => n.kind === 'dynasty' },
  { key: 'topics',     label: 'Themes & Topics',       colour: '#ff9648', match: (n) => n.kind === 'topic' },
];

const EDGE_TYPES = {
  isnad: { label: 'Narrated from (isnad)', colour: '#34f6c1' },
  compiled: { label: 'Compiled the work', colour: '#ffd45e' },
  narrated: { label: 'Narrated a report', colour: '#5a8dff' },
  located: { label: 'Sited at', colour: '#34c9ff' },
  participated: { label: 'Took part in', colour: '#ff5f70' },
  affiliated: { label: 'Ruled / associated', colour: '#ad68ff' },
  cites: { label: 'Cites as a source', colour: '#ff9648' },
  recorded: { label: 'Recorded at', colour: '#91a9b5' },
  topic: { label: 'Has topic', colour: '#ff9648' },
};

const NODE_W = 186;
const NODE_H = 58;
/* The canvas is laid out on a board-like grid: one record per cell, so no two
   cards can be placed on top of each other. A cell is the card plus the channel
   the traces run in. */
const CELL_W = NODE_W + 24;
const CELL_H = NODE_H + 20;
const SIDE_COLS = 5;    // columns in each of the two side strips
const TOP_COLS = 5;     // columns the band above the Prophet is packed into
const BOTTOM_COLS = 6;  // columns the band below the Prophet is packed into

/* How the canvas opens and how much of it is ever drawn at once.

   All 298 records cannot be legible in one frame — at the zoom that fits them the
   node cards are twelve pixels tall — so the canvas opens on the archive's centre
   at HOME_ZOOM, where the cards read, and the controls' fit button shows the whole
   picture on request. The three caps keep one render inside a frame budget: the
   selected record's relations, the isnad spine drawn when nothing is selected, and
   every documented relation when the rail's switch asks for it. */
const HOME_ZOOM = 0.85;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 2.4;
const FOCUS_EDGE_CAP = 80;
const SPINE_EDGE_CAP = 260;
const ALL_EDGE_CAP = 900;
const TABLE_ROW_CAP = 400;

/* ---- the regions and the bands ------------------------------------------
   This page follows the reference layout: the Prophet at the centre, family and
   lineage above him, the companions below him, the sources, places and events to
   the left, and the transmission — tabi'un, scholars and the books they carried —
   to the right. Every record lands in exactly one band, and the band is decided by
   a field the record itself carries, never by a shared century:

     figure  the Prophet                    → the centre (the archive holds one)
             role or life names his household → family & lineage (above)
             generation sahabi               → companions (below)
             generation tabi'i, tabi' al-tabi'in → transmission (right)
             generation later, compiler      → scholars (right)
     book    category a source text          → sources (left)
             any other category              → books (right)
     place / event / dynasty / topic         → left, each band of its own

   "Family & lineage" is drawn from the archive's own words: the records whose role
   or life says they are of the Prophet's household. The archive holds no marriage
   or descent field, so no family line is invented — the lineage the archive does
   evidence, teacher to student, is drawn as its isnad edges like every other
   relation here. */
const HOUSEHOLD = /(?:grandson|granddaughter|son-in-law|daughter-in-law|cousin|uncle|aunt|nephew|niece|brother|sister|wife|husband|daughter|son)\s+of\s+the\s+Prophet|mother of the believers/i;

const SOURCE_CATEGORIES = ['Primary Source', 'Hadith Collections'];

/* The bands, in the order each region stacks them. `label` is what the canvas
   prints on that band's own caption, so the picture names its regions the way the
   rail does. */
const BANDS = [
  { key: 'family',       region: 'top',    label: 'Family & lineage' },
  { key: 'companions',   region: 'bottom', label: 'Companions of the Prophet ﷺ' },
  { key: 'sources',      region: 'left',   label: 'Sources' },
  { key: 'places',       region: 'left',   label: 'Places' },
  { key: 'events',       region: 'left',   label: 'Events' },
  { key: 'dynasties',    region: 'left',   label: 'Dynasties & periods' },
  { key: 'topics',       region: 'left',   label: 'Themes & topics' },
  { key: 'transmission', region: 'right',  label: "Transmission · Tabi'un" },
  { key: 'scholars',     region: 'right',  label: 'Scholars & compilers' },
  { key: 'books',        region: 'right',  label: 'Books of the tradition' },
];

/* The band a record belongs to, or null for the one record drawn at the centre. */
function bandOf(node) {
  const { kind, record } = node;
  if (kind === 'figure') {
    if (record.id === 'prophet') return null;
    if (HOUSEHOLD.test(`${record.role || ''} ${record.bio || ''}`)) return 'family';
    if (node.generation === 'sahabi') return 'companions';
    if (node.generation === 'tabii' || node.generation === 'taba-tabii') return 'transmission';
    return 'scholars';
  }
  if (kind === 'book') return SOURCE_CATEGORIES.includes(record.category) ? 'sources' : 'books';
  if (kind === 'place') return 'places';
  if (kind === 'event') return 'events';
  if (kind === 'dynasty') return 'dynasties';
  if (kind === 'topic') return 'topics';
  return 'scholars';
}

const familyOf = (node) => FAMILIES.find((f) => f.match(node)) || null;

/* The record list the graph draws: the same record families the rest of the app
   reads, each node carrying its canonical id. */
function buildNodes() {
  const out = [];
  ChronoData.allFigures().forEach((f) => out.push({
    id: ChronoData.cid.figure(f.id), kind: 'figure', record: f, generation: f.generation,
    label: f.name, sub: f.role || f.generation,
  }));
  ChronoData.allBooks().forEach((b) => out.push({
    id: ChronoData.cid.book(b.id), kind: 'book', record: b, label: b.name,
    sub: [b.authors[0], b.death ? `d. ${b.death} CE` : b.generation].filter(Boolean).join(' · '),
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

/* Places every record on the board, and returns the region captions with it.

   The Prophet sits in the middle. One band is stacked above him and one below,
   inside the centre column; the two strips are built against that column's edges
   and centred on his own row. Because a strip never reaches into the centre column
   and the two bands never leave it, no two regions can meet — which is what keeps
   the cards off each other, whatever the archive's counts turn out to be. The
   placement is computed, never stored, so the same archive always draws the same
   picture. */
function layout(records) {
  const byBand = new Map(BANDS.map((b) => [b.key, []]));
  let hub = null;
  records.forEach((r) => {
    const key = bandOf(r);
    if (key === null) hub = r;
    else byBand.get(key).push(r);
  });
  BANDS.forEach((b) => byBand.get(b.key).sort((a, c) => a.label.localeCompare(c.label)));

  const inRegion = (region) => BANDS.filter((b) => b.region === region);
  const rowsOf = (count, cols) => Math.max(1, Math.ceil(count / cols));

  /* The centre column is as wide as the wider of the two bands that live in it,
     and never narrower than two cells: the caption beside the Prophet needs one of
     them, so a band can always be named. */
  const topBands = inRegion('top');
  const bottomBands = inRegion('bottom');
  const colsFor = (bands, cap) => Math.max(1, Math.min(cap,
    Math.max(1, ...bands.map((b) => byBand.get(b.key).length))));
  const topCols = colsFor(topBands, TOP_COLS);
  const bottomCols = colsFor(bottomBands, BOTTOM_COLS);
  const centreWidth = Math.max(topCols, bottomCols, 2);
  const centreLeft = -Math.floor(centreWidth / 2);
  const centreRight = centreLeft + centreWidth - 1;

  const placed = [];
  const captions = [];

  /* One band: a row of cells filled across and then down. Every cell remembers the
     band it was placed in, so the rail's filters can hide a band's caption with the
     band itself. */
  const block = (items, cols, startCol, startRow, band) => items.map((r, i) => ({
    ...r,
    band,
    col: startCol + (i % cols),
    row: startRow + Math.floor(i / cols),
  }));

  const caption = (band, items, cols, col, row) => captions.push({
    key: band.key, label: band.label, count: items.length,
    cols, col, row, width: cols * CELL_W - 24,
  });

  /* A strip: its bands stacked, each under its own caption, the whole centred on
     the Prophet's row so both sides of the board balance. */
  const strip = (bands, cols, startCol) => {
    const rows = bands.reduce((n, b) => n + 1 + rowsOf(byBand.get(b.key).length, cols), 0);
    let row = -Math.floor(rows / 2);
    bands.forEach((b) => {
      const items = byBand.get(b.key);
      caption(b, items, cols, startCol, row);
      row += 1;
      placed.push(...block(items, cols, startCol, row, b.key));
      row += rowsOf(items.length, cols);
    });
  };

  /* The centre column: a caption, then the band, above or below the Prophet's own
     cell. The caption sits outside the band's own rows, so it never covers a card. */
  const column = (bands, cols, above) => {
    if (!bands.length) return;
    const items = bands.flatMap((b) => byBand.get(b.key));
    if (!items.length) return;
    const rows = rowsOf(items.length, cols);
    const startCol = centreLeft + Math.floor((centreWidth - cols) / 2);
    const firstRow = above ? -rows : 1;
    const band = { key: bands[0].key, label: bands.map((b) => b.label).join(' · ') };
    caption(band, items, cols, startCol, above ? firstRow - 1 : firstRow + rows);
    placed.push(...block(items, cols, startCol, firstRow, band.key));
  };

  column(topBands, topCols, true);
  column(bottomBands, bottomCols, false);
  strip(inRegion('left'), SIDE_COLS, centreLeft - SIDE_COLS);
  strip(inRegion('right'), SIDE_COLS, centreRight + 1);

  const centred = [];
  if (hub) {
    centred.push({ ...hub, band: 'centre', col: 0, row: 0 });
    /* The middle band's caption goes in the cell beside the Prophet — empty, since
       the centre column holds only him on this row — so the view the canvas opens
       on names its centre. */
    captions.push({
      key: 'centre', label: hub.label, count: 1, cols: 1,
      col: -1, row: 0, width: CELL_W - 24,
    });
  }

  const cellX = (col) => col * CELL_W - NODE_W / 2;
  const cellY = (row) => row * CELL_H - NODE_H / 2;

  return {
    nodes: placed.concat(centred).map((p) => {
      const family = familyOf(p);
      return {
        ...p,
        family: family ? family.key : p.kind,
        colour: family ? family.colour : '#91a9b5',
        x: cellX(p.col),
        y: cellY(p.row),
      };
    }),
    captions: captions.map((c) => ({ ...c, x: cellX(c.col), y: cellY(c.row) })),
  };
}

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
/* The relations the archive can evidence, as (source, target, type) pairs. Built
   from the same fields the other pages read, so the graph cannot invent a
   connection the records do not carry. */
function buildEdges(placed) {
  const seen = new Set();
  const edges = [];
  const add = (from, to, type) => {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ id: key, source: from, target: to, type });
  };

  placed.forEach((node) => {
    const { kind, record } = node;
    if (kind === 'figure') {
      ChronoData.allReports().forEach((h) => {
        const chain = h.chain || [];
        const i = chain.findIndex((l) => l.narratorId === record.id);
        if (i > 0) add(ChronoData.cid.figure(chain[i - 1].narratorId), node.id, 'isnad');
        if (i >= 0 && i < chain.length - 1) add(node.id, ChronoData.cid.figure(chain[i + 1].narratorId), 'isnad');
      });
      ChronoData.booksOfFigure(record.id).forEach((b) => add(node.id, ChronoData.cid.book(b.id), 'compiled'));
      ChronoData.allEvents().forEach((e) => {
        if ((e.participants || []).includes(record.id)) add(node.id, ChronoData.cid.event(e.id), 'participated');
      });
      ChronoData.placesOfFigure(record.id).forEach((p) => add(node.id, ChronoData.cid.place(p.id), 'recorded'));
    }
    if (kind === 'book') {
      (record.authorIds || []).forEach((fid) => add(ChronoData.cid.figure(fid), node.id, 'compiled'));
      ChronoData.eventsOfBook(record.id).forEach((e) => add(node.id, ChronoData.cid.event(e.id), 'cites'));
      ChronoData.dynastiesOfBook(record.id).forEach((d) => add(node.id, ChronoData.cid.dynasty(d.id), 'cites'));
    }
    if (kind === 'event') {
      (record.dynastyIds || []).forEach((did) => add(node.id, ChronoData.cid.dynasty(did), 'affiliated'));
      (record.participants || []).forEach((fid) => add(node.id, ChronoData.cid.figure(fid), 'participated'));
      if (record.placeId) add(node.id, ChronoData.cid.place(record.placeId), 'located');
    }
    if (kind === 'place') {
      ChronoData.allEvents().filter((e) => e.placeId === record.id)
        .forEach((e) => add(node.id, ChronoData.cid.event(e.id), 'located'));
      ChronoData.allDynasties().filter((d) => (d.capitalIds || []).includes(record.id))
        .forEach((d) => add(node.id, ChronoData.cid.dynasty(d.id), 'affiliated'));
      ChronoData.allFigures().filter((f) => (f.locations || []).some((l) => l.toLowerCase() === record.name.toLowerCase()))
        .forEach((f) => add(node.id, ChronoData.cid.figure(f.id), 'recorded'));
    }
    if (kind === 'dynasty') {
      ChronoData.eventsOfDynasty(record.id).forEach((e) => add(node.id, ChronoData.cid.event(e.id), 'affiliated'));
      (record.capitalIds || []).forEach((pid) => add(node.id, ChronoData.cid.place(pid), 'located'));
    }
    if (kind === 'topic') {
      ChronoData.reportsOfTopic(record.id).forEach((h) => {
        const b = ChronoData.bookOfReport(h);
        if (b) add(ChronoData.cid.book(b.id), node.id, 'topic');
      });
    }
  });

  return edges;
}

/* ---- components --------------------------------------------------------- */

/* One record drawn as a React Flow node: family colour on the left edge, the
   name, its context line, and the handles an edge can attach to. There is a
   handle on each of the four sides, and an edge picks the pair facing the record
   it is drawn to, so a trace always leaves and arrives on the near side of a card.
   Every attribute here is named the React way: a stray `class` on a <Handle> is
   written to the DOM as a raw attribute, replaces the library's own className, and
   takes the node's edges with it. */
function RecordNode({ data, selected }) {
  return html`
    <div className=${'rx-node' + (selected ? ' selected' : '') + (data.dim ? ' dim' : '')}
         style=${{ width: NODE_W, height: NODE_H, '--family': data.colour }}
         data-tooltip=${`${data.label} — ${data.sub || ''}`}>
      <${Handle} type="target" id="t-left" position=${Position.Left} className="rx-handle" />
      <${Handle} type="target" id="t-right" position=${Position.Right} className="rx-handle" />
      <${Handle} type="target" id="t-top" position=${Position.Top} className="rx-handle" />
      <${Handle} type="target" id="t-bottom" position=${Position.Bottom} className="rx-handle" />
      <span className="rx-node-dot"></span>
      <span className="rx-node-copy">
        <span className="rx-node-label">${data.label}</span>
        ${data.showSub !== false && data.sub ? html`<span className="rx-node-sub">${data.sub}</span>` : null}
      </span>
      <${Handle} type="source" id="s-left" position=${Position.Left} className="rx-handle" />
      <${Handle} type="source" id="s-right" position=${Position.Right} className="rx-handle" />
      <${Handle} type="source" id="s-top" position=${Position.Top} className="rx-handle" />
      <${Handle} type="source" id="s-bottom" position=${Position.Bottom} className="rx-handle" />
    </div>`;
}

/* A band's own caption on the board: the region's name in the rail's own words,
   and how many of its records the filters are leaving switched on. It names a part
   of the picture rather than holding a record, so it is drawn flat, cannot be
   selected or dragged, and lets clicks through to the pane. */
function CaptionNode({ data }) {
  return html`
    <div className="rx-cap" style=${{ width: data.width }}>
      <span className="rx-cap-label">${data.label}</span>
      <span className="rx-cap-count">${data.count}</span>
    </div>`;
}

const nodeTypes = { record: RecordNode, caption: CaptionNode };

/* One documented relation, drawn the way a board routes a trace: straight runs and
   45° bends, never a curve. React Flow hands an edge the coordinates of the two
   handles it was attached to, so the path is routed between the sides the two
   records actually face each other on. */
function pcbPath({ sourceX, sourceY, targetX, targetY, horizontal, chamfer = 18 }) {
  const n = (v) => Math.round(v * 10) / 10;
  const source = `${n(sourceX)},${n(sourceY)}`;
  if (horizontal) {
    const span = Math.abs(targetX - sourceX);
    const dy = targetY - sourceY;
    if (Math.abs(dy) < 1 || span < 1) return `M ${source} H ${n(targetX)}`;
    const c = Math.max(3, Math.min(chamfer, span / 2, Math.abs(dy) / 2));
    const mid = sourceX + (targetX >= sourceX ? span : -span) / 2;
    const d = targetX >= sourceX ? 1 : -1;
    const s = dy >= 0 ? 1 : -1;
    return `M ${source} H ${n(mid - c * d)} L ${n(mid)},${n(sourceY + c * s)}`
      + ` V ${n(targetY - c * s)} L ${n(mid + c * d)},${n(targetY)} H ${n(targetX)}`;
  }
  const span = Math.abs(targetY - sourceY);
  const dx = targetX - sourceX;
  if (Math.abs(dx) < 1 || span < 1) return `M ${source} V ${n(targetY)}`;
  const c = Math.max(3, Math.min(chamfer, span / 2, Math.abs(dx) / 2));
  const mid = sourceY + (targetY >= sourceY ? span : -span) / 2;
  const d = targetY >= sourceY ? 1 : -1;
  const s = dx >= 0 ? 1 : -1;
  return `M ${source} V ${n(mid - c * d)} L ${n(sourceX + c * s)},${n(mid)}`
    + ` H ${n(targetX - c * s)} L ${n(targetX)},${n(mid + c * d)} V ${n(targetY)}`;
}

function PcbEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, markerEnd, style, interactionWidth }) {
  const horizontal = sourcePosition === Position.Left || sourcePosition === Position.Right;
  return html`<${BaseEdge}
    path=${pcbPath({ sourceX, sourceY, targetX, targetY, horizontal })}
    markerEnd=${markerEnd}
    style=${style}
    interactionWidth=${interactionWidth ?? 16} />`;
}

const edgeTypes = { pcb: PcbEdge };

/* The handle pair an edge uses, from the two records' centres: the axis they are
   furthest apart on decides which pair of sides the trace leaves and arrives by.
   Deciding it here, from the real positions, is what stops a line leaving a card's
   far side or arriving against the direction it flows. */
function handlePair(a, b) {
  if (!a || !b) return {};
  if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) {
    return b.x >= a.x
      ? { sourceHandle: 's-right', targetHandle: 't-left' }
      : { sourceHandle: 's-left', targetHandle: 't-right' };
  }
  return b.y >= a.y
    ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
    : { sourceHandle: 's-top', targetHandle: 't-bottom' };
}

/* ---- the page ----------------------------------------------------------- */

/* The controls rail: the family filters (folded away on request) with real
   counts, the three display switches, the regions, and the edge-type legend. */
const railHtml = (p) => html`
  <aside className="gph-rail" aria-label="Graph controls">
    <div className="gph-stats">
      <div className="gph-stat"><span className="gph-stat-num">${p.records.length}</span><span className="gph-stat-lbl">Nodes</span></div>
      <div className="gph-stat"><span className="gph-stat-num">${p.allEdges.length}</span><span className="gph-stat-lbl">Relations</span></div>
      <div className="gph-stat"><span className="gph-stat-num">${p.touching.length}</span><span className="gph-stat-lbl">Node edges</span></div>
    </div>

    <div className="dsh-group gph-fold">
      <button className="dsh-group-title gph-fold-btn" type="button"
              aria-expanded=${p.filtersOpen ? 'true' : 'false'} aria-controls="gphFilters"
              onClick=${() => p.setFiltersOpen(!p.filtersOpen)}>
        <span className=${'gph-caret' + (p.filtersOpen ? ' open' : '')} aria-hidden="true"></span>
        <span>Filters</span>
        <span className="dsh-check-count">${FAMILIES.length - p.off.length}/${FAMILIES.length}</span>
      </button>
      ${p.filtersOpen ? html`<div className="gph-fold-body" id="gphFilters">
        ${FAMILIES.map((f) => html`
          <label className="dsh-check" key=${f.key}>
            <input type="checkbox" checked=${!p.off.includes(f.key)}
                   onChange=${(e) => p.setOff(e.target.checked ? p.off.filter((k) => k !== f.key) : [...p.off, f.key])} />
            <span className="dsh-box" aria-hidden="true"></span>
            <span className="dsh-dot" style=${{ '--dot': f.colour }}></span>
            <span className="dsh-check-label">${f.label}</span>
            <span className="dsh-check-count">${p.counts[f.key]}</span>
          </label>`)}
        <button className="dsh-btn small" type="button" onClick=${() => p.setOff([])}>Show every family</button>
      </div>` : null}
    </div>

    <div className="dsh-group">
      <h2 className="dsh-group-title">Display</h2>
      <label className="dsh-switch">
        <input type="checkbox" checked=${p.labels} onChange=${(e) => p.setLabels(e.target.checked)} />
        <span className="dsh-switch-track" aria-hidden="true"></span>
        <span>Node captions</span>
      </label>
      <label className="dsh-switch">
        <input type="checkbox" checked=${p.arrows} onChange=${(e) => p.setArrows(e.target.checked)} />
        <span className="dsh-switch-track" aria-hidden="true"></span>
        <span>Edge arrows</span>
      </label>
      <label className="dsh-switch">
        <input type="checkbox" checked=${p.allEdgesOn} onChange=${(e) => p.setAllEdgesOn(e.target.checked)} />
        <span className="dsh-switch-track" aria-hidden="true"></span>
        <span>All documented edges</span>
      </label>
      <p className="dsh-footnote">${p.edgeNote}</p>
    </div>

    <div className="dsh-group">
      <h2 className="dsh-group-title">The board</h2>
      <ul className="gph-bands">
        ${p.bands.map((b) => html`
          <li className="gph-band" key=${b.key}>
            <span className="gph-band-where">${b.where}</span>
            <span className="gph-band-label">${b.label}</span>
            <span className="dsh-check-count">${b.count}</span>
          </li>`)}
      </ul>
      <p className="dsh-footnote">
        The reference layout's regions, filled from the records: the Prophet in the middle, family and
        lineage above him, the companions below, sources, places and events to the left, and the
        transmission to the right. Family &amp; lineage is the household a record's own role or life
        names — the archive holds no marriage or descent field, so no family line is drawn. Records
        that merely share a century are never joined.
      </p>
    </div>

    <div className="dsh-group">
      <h2 className="dsh-group-title">Legend · edge types</h2>
      <ul className="gph-legend">
        ${Object.entries(EDGE_TYPES).map(([key, meta]) => html`
          <li className="gph-legend-item" key=${key} style=${{ '--edge': meta.colour }}>
            <span className="gph-legend-line"></span>${meta.label}
          </li>`)}
      </ul>
      <p className="dsh-footnote">
        Every trace is a field of a record: a chain adjacency, a compilation, a location, a documented
        association. Dashed traces are the relations other than the isnad.
      </p>
    </div>
  </aside>`;

/* The selected record: its relations, each drawn as a row that selects the other
   end, plus the way through to the record's own page. */
const panelHtml = (p) => html`
  <aside className="dsh-panel gph-panel" aria-label="Selected node">
    ${p.selected
      ? html`<${React.Fragment}>
        <div className="ev-panel-head">
          <h2 className="ev-panel-title">${p.selected.label}</h2>
          <div className="ev-panel-meta">
            <span className="ev-meta">${(familyOf(p.selected) || {}).label || p.selected.kind}</span>
            ${p.selected.sub ? html`<span className="ev-meta">${p.selected.sub}</span>` : null}
          </div>
        </div>
        <div className="ev-tabbody">
          <div className="ev-linkrow">
            <a className="dsh-btn small primary" href=${p.pageHref(p.selected.id)}>Open on its page</a>
            <button className="dsh-btn small" type="button" onClick=${() => p.select(null)}>Clear selection</button>
          </div>
          ${p.relationGroups.length
            ? p.relationGroups.map(([type, list]) => html`
                <div key=${type}>
                  <h3 className="ev-subhead">${(EDGE_TYPES[type] || {}).label || type} · ${list.length}</h3>
                  <div className="gph-rels">
                    ${list.slice(0, 40).map((row) => (row.href
                      ? html`<a className="gph-rel" key=${row.href} href=${row.href}
                                style=${{ '--edge': (EDGE_TYPES[type] || {}).colour || '#91a9b5' }}>
                          <span className="gph-rel-name">${row.label}</span>
                          <span className="gph-rel-note">${row.sub} → its report page</span>
                        </a>`
                      : html`<button className="gph-rel" type="button" key=${row.id}
                                style=${{ '--edge': (EDGE_TYPES[type] || {}).colour || '#91a9b5' }}
                                onClick=${() => p.select(row.id)}>
                          <span className="gph-rel-name">${row.label}</span>
                          <span className="gph-rel-note">${row.sub}</span>
                        </button>`))}
                  </div>
                </div>`)
            : html`<p className="ev-note">No documented relation for this record in the archive yet.</p>`}
          <p className="ev-note">Every node is a record held in this archive, and every edge is a field of
          that record: a chain adjacency, a compilation, a location, a documented association. The
          archive's reports are shown here as links to their own page, not as nodes.</p>
        </div><//>`
      : html`<div className="dsh-empty">Select a node in the graph.<span className="tiny">Every node is a
            record held in this archive.</span></div>`}
  </aside>`;

/* Where a node's own page is. One mapping, shared by the panel links, so a node
   never points somewhere its record does not live. */
function pageHref(id) {
  const { kind, id: raw } = ChronoData.resolve(id);
  switch (kind) {
    case 'figure': return `#figures?id=${encodeURIComponent(raw)}`;
    case 'book': return `#books?id=${encodeURIComponent(raw)}`;
    case 'event': return ChronoData.links.event(raw, 'graph');
    case 'place': return `#places?id=${encodeURIComponent(raw)}`;
    case 'dynasty': return ChronoData.links.dynasty(raw, 'graph');
    case 'report': return `#hadiths?id=${encodeURIComponent(raw)}`;
    case 'topic': return `#hadiths?id=${encodeURIComponent(ChronoData.reportsOfTopic(raw)[0]?.id || '')}`;
    default: return '#graph';
  }
}

let bridge = { select: () => {} };
let activeRoot = null;

function App({ initialId }) {
  /* The board: every record placed in its band, plus the captions that name the
     bands. Nothing is stored — the archive always draws the same picture. */
  const board = useMemo(() => layout(buildNodes()), []);
  const records = board.nodes;
  const allEdges = useMemo(() => buildEdges(records), [records]);
  const [off, setOff] = useState([]);
  const [labels, setLabels] = useState(true);
  const [arrows, setArrows] = useState(true);
  const [allEdgesOn, setAllEdgesOn] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('graph');
  /* The record whose relations the canvas should bring into view. Set when the
     selection comes from somewhere other than the canvas itself, so that clicking
     a row in the table or a relation in the panel moves the view to that record
     instead of leaving it off screen. */
  const [focusId, setFocusId] = useState(null);
  const flowRef = React.useRef(null);
  const [positions, setPositions] = useState({});
  const onNodesChange = useCallback((changes) => {
    const moved = changes.filter((change) => change.type === 'position' && change.position);
    if (moved.length) setPositions((previous) => {
      const next = { ...previous };
      moved.forEach((change) => { next[change.id] = change.position; });
      return next;
    });
  }, []);

  /* The isnad spine: the chain adjacencies, which are the archive's own record of
     who narrated from whom. It is what the canvas draws while nothing is selected,
     so the page reads as a graph of relations rather than a field of nodes. */
  const spine = useMemo(() => allEdges.filter((e) => e.type === 'isnad'), [allEdges]);

  /* Selecting on the canvas leaves the view where the reader put it; selecting
     anywhere else — a table row, the search picker, a relation in the panel —
     asks the canvas to move to that record. Both set the same single selection. */
  const pick = useCallback((id) => setSelectedId(id), []);
  const reveal = useCallback((id) => {
    if (!id) { setSelectedId(null); return; }
    const record = records.find((r) => r.id === id);
    if (!record) return;
    setOff((previous) => previous.filter((family) => family !== record.family));
    setSelectedId(id);
    setFocusId(id);
  }, [records]);

  const visible = useMemo(() => records.filter((r) => !off.includes(r.family)), [records, off]);
  const visibleIds = useMemo(() => new Set(visible.map((r) => r.id)), [visible]);
  const selected = selectedId ? records.find((r) => r.id === selectedId) || null : null;

  /* A band is captioned while it still has a record switched on, and the caption
     counts what is left, so the board names its regions the way the rail filters
     them and the two cannot disagree about what is on it. */
  const captionNodes = useMemo(() => {
    const counts = new Map();
    visible.forEach((r) => counts.set(r.band, (counts.get(r.band) || 0) + 1));
    return board.captions
      .filter((c) => counts.get(c.key))
      .map((c) => ({
        id: `caption:${c.key}`,
        type: 'caption',
        position: { x: c.x, y: c.y },
        draggable: false, selectable: false, focusable: false, connectable: false,
        data: { label: c.label, count: counts.get(c.key), width: c.width },
      }));
  }, [board.captions, visible]);

  /* Where each record's card sits, measured at its centre. An edge's handles are
     chosen from two of these, so a trace always leaves by the side facing the
     record it is drawn to. */
  const centres = useMemo(() => {
    const m = new Map();
    records.forEach((r) => m.set(r.id, {
      x: (positions[r.id]?.x ?? r.x) + NODE_W / 2,
      y: (positions[r.id]?.y ?? r.y) + NODE_H / 2,
    }));
    return m;
  }, [records, positions]);

  const touching = useMemo(
    () => (selected ? allEdges.filter((e) => e.source === selected.id || e.target === selected.id) : []),
    [allEdges, selected],
  );
  const neighbours = useMemo(() => {
    const set = new Set();
    touching.forEach((e) => { set.add(e.source); set.add(e.target); });
    return set;
  }, [touching]);

  useEffect(() => {
    bridge.select = reveal;
    return () => { if (bridge.select === reveal) bridge.select = () => {}; };
  }, [reveal]);

  /* A deep link (#graph?node=…) is honoured only when the archive holds that
     node — a stale or foreign id leaves the panel on its empty state instead of
     claiming a record that is not drawn. */
  useEffect(() => {
    if (initialId && records.some((r) => r.id === initialId)) reveal(initialId);
  }, [initialId, records, reveal]);

  /* The canvas opens on the archive's centre — the figure every chain in it ends
     at — at a zoom whose node captions can be read, instead of fitting all 298
     records into one frame where a card is twelve pixels tall. The library's own
     fit button still shows the whole picture when it is asked for. The frame is
     waited for because a fit issued before the nodes are measured lands on a cold,
     unmeasured box. */
  const homeView = useCallback((instance) => {
    flowRef.current = instance;
    const hub = (() => {
      try { return ChronoData.cid.figure('prophet'); } catch (err) { return null; }
    })();
    requestAnimationFrame(() => {
      try {
        const target = records.some((r) => r.id === initialId) ? initialId : hub;
        if (target) instance.fitView({ nodes: [{ id: target }], maxZoom: HOME_ZOOM, padding: 0.8, duration: 0 });
        else instance.fitView({ maxZoom: HOME_ZOOM, duration: 0 });
      } catch (err) {
        // A view that cannot be placed is not worth failing the page over: the
        // controls' fit button leaves the reader a way to place it themselves.
        console.warn('The graph could not be placed on its centre:', err);
      }
    });
  }, [initialId, records]);

  /* Bringing a record into view, once, for that record: the view must not follow
     every later render, or a reader could never pan away from what they selected. */
  useEffect(() => {
    if (!focusId || !flowRef.current) return;
    if (!records.some((r) => r.id === focusId)) { setFocusId(null); return; }
    try {
      flowRef.current.fitView({ nodes: [{ id: focusId }], maxZoom: HOME_ZOOM, padding: 0.5,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320 });
    } catch (err) {
      console.warn('Could not bring the selected record into view:', err);
    }
    setFocusId(null);
  }, [focusId, records]);

  /* The mini-map draws the board's shape; the captions are not records, so they are
     left out of its colours and the records answer for it alone. */
  const miniNodeColour = useCallback((node) => (node.type === 'caption' ? 'transparent' : '#1d4354'), []);

  useEffect(() => {
    if (selectedId) ChronoData.remember({ graphNode: selectedId });
    if (location.hash.startsWith('#graph')) {
      history.replaceState(null, '', `#graph${selectedId ? `?node=${encodeURIComponent(selectedId)}` : ''}`);
    }
  }, [selectedId]);

  const counts = useMemo(() => {
    const m = {};
    FAMILIES.forEach((f) => { m[f.key] = records.filter(f.match).length; });
    return m;
  }, [records]);

  /* The board's regions in the rail's own words: what each band holds and where it
     is drawn, counted off the records rather than typed in. */
  const bands = useMemo(() => {
    const inBand = new Map();
    records.forEach((r) => inBand.set(r.band, (inBand.get(r.band) || 0) + 1));
    const centre = records.find((r) => r.band === 'centre');
    return [{
      key: 'centre', where: 'middle', label: centre ? centre.label : 'The Prophet ﷺ', count: centre ? 1 : 0,
    }].concat(BANDS.map((b) => ({
      key: b.key,
      where: b.region === 'top' ? 'above' : b.region === 'bottom' ? 'below' : b.region,
      label: b.label,
      count: inBand.get(b.key) || 0,
    })));
  }, [records]);

  /* The relations of the selected record, grouped by edge type so the panel can
     head each group the way the fallback panel does. Edges give the node rows;
     the reports the record is evidenced with arrive through the shared helper as
     rows that link out, since the canvas draws families and not reports. One row
     per related record per type: two edges that reach the same record the same way
     are one relation to a reader, and repeating the row would also repeat its key. */
  const relationGroups = useMemo(() => {
    if (!selected) return [];
    const groups = new Map();
    const push = (type, row) => {
      const list = groups.get(type) || [];
      const key = row.id ?? row.href;
      if (list.some((r) => (r.id ?? r.href) === key)) return;
      groups.set(type, list.concat(row));
    };
    touching.forEach((e) => {
      const otherId = e.source === selected.id ? e.target : e.source;
      const other = records.find((r) => r.id === otherId);
      if (!other) return;
      push(e.type, { id: other.id, label: other.label, sub: other.sub || other.kind });
    });
    ChronoData.reportLinksOf(selected).forEach((r) => push(r.type, {
      href: `#hadiths?id=${encodeURIComponent(r.report.id)}`,
      label: r.report.reference,
      sub: r.note,
    }));
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [touching, selected, records]);

  const rfNodes = useMemo(() => captionNodes.concat(visible.map((r) => ({
    id: r.id,
    type: 'record',
    position: positions[r.id] || { x: r.x, y: r.y },
    draggable: true,
    selected: r.id === selectedId,
    data: {
      label: r.label,
      sub: r.sub,
      colour: r.colour,
      showSub: labels,
      dim: Boolean(selected) && selected.id !== r.id && !neighbours.has(r.id),
    },
  }))), [captionNodes, visible, selected, neighbours, labels, positions]);

  /* The relations the canvas draws. Nothing selected: the isnad spine, so the
     page is never a field of nodes with no lines between them. A record selected:
     that record's own relations, so the panel and the canvas agree. The switch on:
     every documented relation. `edgeCap` bounds each pool, and `edgeNote` says
     which pool is drawn and whether the cap bit, so the canvas cannot quietly
     show less than the rail claims. */
  const edgePool = useMemo(() => {
    const pool = selected ? touching : (allEdgesOn ? allEdges : spine);
    return pool.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [selected, touching, allEdgesOn, spine, visibleIds]);

  const edgeCap = selected ? FOCUS_EDGE_CAP : (allEdgesOn ? ALL_EDGE_CAP : SPINE_EDGE_CAP);
  const edgeDrawn = Math.min(edgePool.length, edgeCap);
  const edgeNote = selected
    ? `${edgeDrawn} of this record's ${edgePool.length} documented relation${edgePool.length === 1 ? '' : 's'}`
    : allEdgesOn
      ? `${edgeDrawn} of the archive's ${edgePool.length} documented relations`
      : `${edgeDrawn} isnad relationships — the spine the archive's chains are built on`
        + (edgePool.length > edgeCap ? ` (showing the first ${edgeCap})` : '');

  const rfEdges = useMemo(() => edgePool
    .slice(0, edgeCap)
    .map((e) => {
      const colour = (EDGE_TYPES[e.type] || {}).colour || '#91a9b5';
      const hot = Boolean(selected) && (e.source === selected.id || e.target === selected.id);
      const pair = handlePair(centres.get(e.source), centres.get(e.target));
      if (!pair.sourceHandle) return null;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        // The record's two ends are joined by name, and the sides the trace leaves
        // and arrives by are the ones facing each other.
        sourceHandle: pair.sourceHandle,
        targetHandle: pair.targetHandle,
        // 'pcb' is this page's own edge: straight runs and 45° bends, the way a
        // board routes a trace, instead of the library's curves.
        type: 'pcb',
        animated: hot && e.type === 'isnad',
        style: {
          stroke: colour,
          strokeWidth: hot ? 2.2 : 1.1,
          opacity: hot ? 0.95 : 0.4,
          strokeDasharray: e.type === 'isnad' ? undefined : '5 4',
        },
        markerEnd: arrows ? { type: MarkerType.ArrowClosed, color: colour, width: 14, height: 14 } : undefined,
      };
    })
    .filter(Boolean), [edgePool, edgeCap, selected, arrows, centres]);

  const props = {
    records, allEdges, touching, counts, edgeNote, bands,
    off, setOff, labels, setLabels, arrows, setArrows, allEdgesOn, setAllEdgesOn,
    filtersOpen, setFiltersOpen,
    selected, relationGroups, select: reveal, pageHref,
  };

  return html`
    <div className="dsh gph gph-react">
      <div className="rx-canvas">
        <div className="gph-modes" role="group" aria-label="Graph view">
          <button className=${'dsh-view-btn' + (mode === 'graph' ? ' active' : '')} type="button"
                  aria-pressed=${mode === 'graph'} onClick=${() => setMode('graph')}>Knowledge Graph</button>
          <button className=${'dsh-view-btn' + (mode === 'table' ? ' active' : '')} type="button"
                  aria-pressed=${mode === 'table'} onClick=${() => setMode('table')}>Table</button>
        </div>
        <div className="rx-flow" hidden=${mode !== 'graph'}>
          <${ReactFlow}
            nodes=${rfNodes}
            onNodesChange=${onNodesChange}
            edges=${rfEdges}
            nodeTypes=${nodeTypes}
            edgeTypes=${edgeTypes}
            onNodeClick=${(ev, node) => pick(node.id)}
            onPaneClick=${() => setSelectedId(null)}
            onInit=${homeView}
            onlyRenderVisibleElements=${true}
            minZoom=${MIN_ZOOM}
            maxZoom=${MAX_ZOOM}
            colorMode="system"
            nodesConnectable=${false}>
            <${Background} variant=${BackgroundVariant.Lines} gap=${26} size=${1} color="color-mix(in srgb, var(--teal) 7%, transparent)" />
            <${Controls} showInteractive=${false} />
            <${MiniMap} pannable=${true} zoomable=${true} nodeColor=${miniNodeColour} maskColor="var(--overlay)" />
          <//>
        </div>
        <div className="gph-slot" hidden=${mode !== 'table'}>
          <div className="dsh-footnote">
            ${visible.length} nodes in the visible families${visible.length > TABLE_ROW_CAP
              ? ` · the first ${TABLE_ROW_CAP} are listed below` : ''}
          </div>
          <table className="gph-table">
            <thead><tr><th>Record</th><th>Family</th><th>Date</th></tr></thead>
            <tbody>
              ${visible.slice(0, TABLE_ROW_CAP).map((r) => html`
                <tr className=${'gph-tr' + (selectedId === r.id ? ' selected' : '')} key=${r.id}
                    tabIndex=${0} role="button" onClick=${() => reveal(r.id)}
                    onKeyDown=${(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); reveal(r.id); } }}>
                  <td>${r.label}</td>
                  <td>${(familyOf(r) || {}).label || r.kind}</td>
                  <td>${nodeYear(r) ?? '—'}</td>
                </tr>`)}
            </tbody>
          </table>
        </div>
      </div>
      ${railHtml(props)}
      ${panelHtml(props)}
    </div>`;
}

/* A render failure in the graph should say so, not leave an empty panel. React
   reports the error here as well as to the console. */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Graph render failed:', error, info); }
  render() {
    if (this.state.error) {
      return html`<div className="dsh-empty">
        <strong>The graph could not be drawn.</strong>
        <span className="tiny">${String(this.state.error.message || this.state.error)}</span>
        <span className="tiny">Every other page of the archive is unaffected.</span>
      </div>`;
    }
    return this.props.children;
  }
}

window.ChronoGraph = {
  mount(host, opts = {}) {
    if (!host) throw new Error('Graph mount needs a host element');
    // Previous route may have removed the host without unmounting its React tree.
    if (activeRoot) activeRoot.unmount();
    activeRoot = createRoot(host);
    activeRoot.render(html`<${Boundary}><${App} initialId=${opts.initial || null} /><//>`);
    return activeRoot;
  },
  unmount() {
    if (activeRoot) activeRoot.unmount();
    activeRoot = null;
    bridge.select = () => {};
  },
  select(id) { try { bridge.select(id); } catch (err) { console.error('Graph select failed:', err); } },
  ready: true,
};
window.dispatchEvent(new Event('chrono-graph-ready'));
