/* Narrator page, network card — React edition.

   The mini network on a figure's page: the figure at its centre, the teachers the
   archive records above, the students below, one edge per documented teaching
   relationship. It is drawn by React Flow (@xyflow/react) so the card behaves like
   the Graph page's canvas — drag, pan, zoom, and the library's own controls —
   instead of a fixed picture that could only highlight what was already drawn.

   `js/narrator-view.js` hands this one node list, built from the same teacher and
   student fields the lists above the card read, and draws the card itself on a
   canvas when these modules are not present. The click-through to a figure is the
   same on both paths. Anything this page cannot evidence is not drawn: a figure
   with no recorded teachers gets no edge, not a guessed one. */

import React, { useState, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import {
  ReactFlow, Controls, Handle, Position, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const html = htm.bind(React.createElement);

const NODE_W = 170;
const NODE_H = 46;
const PER_ROW = 4;
const HOME_ZOOM = 0.95;
const ROW_STEP = NODE_H + 22;

/* The first row sits nearest the centre, later rows further out, so the reading
   order of the lists above the card runs inward. Nothing is stored: the same
   figure always draws the same picture. */
function place(list, dir) {
  const rows = Math.ceil(list.length / PER_ROW);
  return list.map((n, i) => {
    const row = Math.floor(i / PER_ROW);
    const inRow = Math.min(PER_ROW, list.length - row * PER_ROW);
    const col = i % PER_ROW;
    return {
      ...n,
      x: (col - (inRow - 1) / 2) * (NODE_W + 20),
      y: dir * (74 + (rows - row - 1) * ROW_STEP),
    };
  });
}

/* One figure: name, the generation the archive records, family colour. Handles are
   named the React way — a stray `class` here would replace the library's own
   className and take the edge with it. */
function FigureNode({ data, selected }) {
  return html`
    <div className=${'nfg-node' + (selected ? ' selected' : '') + (data.dim ? ' dim' : '') + (data.centre ? ' centre' : '')}
         style=${{ width: NODE_W, '--fam': data.colour }}
         data-tooltip=${`${data.label}${data.gen ? ' · ' + data.gen : ''} — Open biography`}>
      <${Handle} type="target" position=${Position.Top} className="nfg-handle" />
      <span className="nfg-mark"></span>
      <span className="nfg-copy">
        <span className="nfg-name">${data.label}</span>
        ${data.gen ? html`<span className="nfg-gen">${data.gen}</span>` : null}
      </span>
      <${Handle} type="source" position=${Position.Bottom} className="nfg-handle" />
    </div>`;
}

const nodeTypes = { figure: FigureNode };

/* ---- the card ----------------------------------------------------------- */

function Card({ centre, nodes }) {
  const safeCentre = centre ?? { id: 'unknown', label: 'Unknown figure' };
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const [hovered, setHovered] = useState(null);
  const [positions, setPositions] = useState({});
  const onNodesChange = useCallback((changes) => {
    const moved = changes.filter((change) => change.type === 'position' && change.position);
    if (moved.length) setPositions((previous) => {
      const next = { ...previous };
      moved.forEach((change) => { next[change.id] = change.position; });
      return next;
    });
  }, []);

  const teachers = useMemo(() => place(safeNodes.filter((n) => n.side === 'up'), -1), [safeNodes]);
  const students = useMemo(() => place(safeNodes.filter((n) => n.side === 'down'), 1), [safeNodes]);

  /* The card opens on the figure itself, legibly; the controls' fit button shows
     every teacher and student at once. Fitting is issued a frame on, once the nodes
     have been measured — a fit before that lands on a cold, unmeasured box. */
  const homeView = useCallback((instance) => {
    requestAnimationFrame(() => {
      try {
        instance.fitView({ nodes: [{ id: safeCentre.id }], maxZoom: HOME_ZOOM, padding: 0.5, duration: 0 });
      } catch (err) {
        console.warn('The network could not be placed on its figure:', err);
      }
    });
  }, [safeCentre.id]);

  const rfNodes = useMemo(() => [
    {
      id: safeCentre.id, type: 'figure', position: positions[safeCentre.id] || { x: 0, y: 0 },
      data: {
        label: safeCentre.label, gen: safeCentre.gen, colour: safeCentre.colour, centre: true,
        dim: Boolean(hovered) && hovered !== safeCentre.id,
      },
    },
    ...teachers.concat(students).map((n) => ({
      id: n.id, type: 'figure', position: positions[n.id] || { x: n.x, y: n.y },
      data: { label: n.label, gen: n.gen, colour: n.colour, dim: Boolean(hovered) && hovered !== n.id },
    })),
  ], [safeCentre, teachers, students, hovered, positions]);

  /* A teacher points down into the figure, the figure points down into a student:
     the direction the archive's chains run. Each edge carries the colour of the
     figure at its far end, as the canvas drew it. */
  const rfEdges = useMemo(() => {
    const edge = (from, to, colour) => ({
      id: `${from.id}|${to.id}`,
      source: from.id,
      target: to.id,
      type: 'default',
      style: { stroke: colour, strokeWidth: 1.4, opacity: 0.75 },
      markerEnd: { type: MarkerType.ArrowClosed, color: colour, width: 12, height: 12 },
    });
    return [
      ...teachers.map((t) => edge(t, safeCentre, t.colour)),
      ...students.map((s) => edge(safeCentre, s, s.colour)),
    ];
  }, [teachers, students, safeCentre]);

  const open = useCallback((id) => { location.hash = `#figures?id=${encodeURIComponent(id)}`; }, []);
  const openNode = useCallback((ev, node) => open(node.id), [open]);
  /* Hovering a figure dims the rest, the way the canvas highlighted one spoke. */
  const hoverOn = useCallback((ev, node) => setHovered(node.id), []);
  const hoverOff = useCallback(() => setHovered(null), []);

  return html`
    <div className="nfg-root">
      <${ReactFlow}
        nodes=${rfNodes}
        onNodesChange=${onNodesChange}
        edges=${rfEdges}
        nodeTypes=${nodeTypes}
        onNodeClick=${openNode}
        onNodeMouseEnter=${hoverOn}
        onNodeMouseLeave=${hoverOff}
        onInit=${homeView}
        onlyRenderVisibleElements=${true}
        minZoom=${0.15}
        maxZoom=${1.8}
        zoomOnScroll=${false}
        panOnScroll=${false}
        preventScrolling=${false}
        colorMode="system"
        nodesConnectable=${false}>
        <${Controls} showInteractive=${false} />
      <//>
    </div>`;
}

/* A render failure in the card says so rather than leaving an empty box. */
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('Network render failed:', error, info); }
  render() {
    if (this.state.error) {
      return html`<div className="nfg-error">
        <span>The network could not be drawn.</span>
        <span className="tiny">${String(this.state.error.message || this.state.error)}</span>
      </div>`;
    }
    return this.props.children;
  }
}

let activeRoot = null;

window.ChronoNarratorGraph = {
  /* `host` is the card's own wrapper; the node list is the one js/narrator-view.js
     already built for its canvas, so both renderers draw the same figures. */
  mount(host, { centre, nodes } = {}) {
    if (!host) throw new Error('Narrator network mount needs a host element');
    if (activeRoot) activeRoot.unmount();
    activeRoot = createRoot(host);
    activeRoot.render(html`<${Boundary}><${Card} centre=${centre} nodes=${nodes} /><//>`);
    return activeRoot;
  },
  unmount() {
    if (activeRoot) activeRoot.unmount();
    activeRoot = null;
  },
  ready: true,
};
window.dispatchEvent(new Event('chrono-network-ready'));
