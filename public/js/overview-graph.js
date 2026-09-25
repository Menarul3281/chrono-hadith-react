/* Isolated reference graph mounted inside the live Overview. */
const OverviewGraph = (() => {
  'use strict';
  let panel = null, ro = null, cleanup = null;
  const ROUTES = {
    prophets: '#graph', companions: '#history?view=timeline',
    narrators: '#figures', sources: '#library?tab=hadiths',
    places: '#history?view=places', dynasties: '#history?view=events',
    themes: '#dynasties', events: '#library?tab=books',
  };
  const GRAPH_MARKUP = `<div class="hero-shell">
<div class="hero-layout"><div class="visual-area"><div aria-label="Knowledge graph category selector" class="stage" data-atlas-region="true" id="stage">
<div class="stage-toolbar"><span><span class="live-dot"></span> LIVE PREVIEW <span class="toolbar-muted">/ SCHEMATIC VIEW</span></span><button aria-pressed="true" class="micro-btn" id="tiltToggle" title="Toggle animated 3D lean" type="button">3D ON <span aria-hidden="true">◉</span></button></div>
<div class="scene-viewport"><div class="scene" id="scene"><div aria-hidden="true" class="board-shadow"></div><div aria-hidden="true" class="board-under"></div><div aria-hidden="true" class="board" id="board"><div class="board-grid"></div><div class="board-halo"></div><div class="board-orbit orbit1"></div><div class="board-orbit orbit2"></div><div class="board-orbit orbit3"></div><div class="board-cross"></div><span class="board-corner tl"></span><span class="board-corner tr"></span><span class="board-corner bl"></span><span class="board-corner br"></span><span class="board-engrave">CHRONO—HADITH / KNOWLEDGE ATLAS</span></div>
<svg aria-hidden="true" class="wire-overlay" viewbox="0 0 960 620" xmlns="http://www.w3.org/2000/svg"><defs><filter id="wireGlow"><fegaussianblur result="glow" stddeviation="4"></fegaussianblur><femerge><femergenode in="glow"></femergenode><femergenode in="SourceGraphic"></femergenode></femerge></filter></defs><g class="wire-track"><path class="wire wire-prophets" d="M437 272 H427 V127 H420" data-wire="prophets"></path><path class="wire wire-companions" d="M545 272 H566 V126 H574" data-wire="companions"></path><path class="wire wire-narrators" d="M580 293 H710 V249 H690" data-wire="narrators"></path><path class="wire wire-sources" d="M580 329 H700 V415 H670" data-wire="sources"></path><path class="wire wire-places" d="M535 369 V475 H635 V496" data-wire="places"></path><path class="wire wire-dynasties" d="M446 367 V471 H342 V490" data-wire="dynasties"></path><path class="wire wire-themes" d="M400 333 H275 V414 H282" data-wire="themes"></path><path class="wire wire-events" d="M400 291 H270 V246 H278" data-wire="events"></path></g><g class="terminal-points"><circle cx="330" cy="125" fill="var(--prophets)" opacity=".85" r="3.5"></circle><circle cx="660" cy="125" fill="var(--companions)" opacity=".85" r="3.5"></circle><circle cx="780" cy="250" fill="var(--narrators)" opacity=".85" r="3.5"></circle><circle cx="765" cy="415" fill="var(--sources)" opacity=".85" r="3.5"></circle><circle cx="634" cy="526" fill="var(--places)" opacity=".85" r="3.5"></circle><circle cx="342" cy="522" fill="var(--dynasties)" opacity=".85" r="3.5"></circle><circle cx="190" cy="415" fill="var(--themes)" opacity=".85" r="3.5"></circle><circle cx="185" cy="247" fill="var(--events)" opacity=".85" r="3.5"></circle></g><path d="M24 24h38 M24 24v38 M936 24h-38 M936 24v38 M24 596h38 M24 596v-38 M936 596h-38 M936 596v-38" fill="none" stroke="var(--line)" stroke-opacity=".25" stroke-width="1.5"></path></svg>
<button aria-label="The Prophet, central node" class="root" data-root="" type="button"><span class="root-overline">ROOT / 000</span><span class="root-glyph" lang="ar">ﷺ</span><strong>The Prophet</strong><small>Central reference</small></button>
<button aria-pressed="false" class="node node--prophets" data-node="prophets" style="--px:330;--py:125;--tone:var(--prophets)" title="" type="button"><span aria-hidden="true" class="node-icon">✦</span><span class="node-copy"><strong>Prophets</strong><small>FIELD 01 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--companions" data-node="companions" style="--px:660;--py:125;--tone:var(--companions)" title="" type="button"><span aria-hidden="true" class="node-icon">♧</span><span class="node-copy"><strong>Companions</strong><small>FIELD 02 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--narrators" data-node="narrators" style="--px:780;--py:250;--tone:var(--narrators)" title="" type="button"><span aria-hidden="true" class="node-icon">≋</span><span class="node-copy"><strong>Narrators</strong><small>FIELD 03 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--sources" data-node="sources" style="--px:765;--py:415;--tone:var(--sources)" title="" type="button"><span aria-hidden="true" class="node-icon">▤</span><span class="node-copy"><strong>Sources</strong><small>FIELD 04 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--places" data-node="places" style="--px:634;--py:526;--tone:var(--places)" title="" type="button"><span aria-hidden="true" class="node-icon">⌖</span><span class="node-copy"><strong>Places</strong><small>FIELD 05 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--dynasties" data-node="dynasties" style="--px:342;--py:522;--tone:var(--dynasties)" title="" type="button"><span aria-hidden="true" class="node-icon">♜</span><span class="node-copy"><strong>Dynasties</strong><small>FIELD 06 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--themes" data-node="themes" style="--px:190;--py:415;--tone:var(--themes)" title="" type="button"><span aria-hidden="true" class="node-icon">◈</span><span class="node-copy"><strong>Themes</strong><small>FIELD 07 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button><button aria-pressed="false" class="node node--events" data-node="events" style="--px:185;--py:247;--tone:var(--events)" title="" type="button"><span aria-hidden="true" class="node-icon">▦</span><span class="node-copy"><strong>Events</strong><small>FIELD 08 / 08</small></span><span aria-hidden="true" class="node-arrow">↗</span></button>
<span aria-hidden="true" class="coordinate">08 CATEGORIES <span>•</span> 01 CENTRAL REFERENCE</span></div></div>
<div class="mobile-categories"><span class="mobile-categories-title">SELECT A FIELD <span>08 ENDPOINTS</span></span><div class="mobile-button-grid"></div></div>
<div class="stage-footer"><span>SELECT A FIELD TO TRACE ITS ROUTE</span><button class="micro-btn" id="clearBtn" type="button">CLEAR SELECTION ↗</button></div></div><div aria-live="polite" class="selection-summary"><span aria-hidden="true" class="summary-bar"></span><span class="summary-copy"><small id="summaryLabel">KNOWLEDGE GRAPH</small><strong id="summaryTitle">Eight fields. One visual starting point.</strong><span id="summaryBody">Choose a category on the graph to see how the concept responds.</span></span><span class="summary-index">05 / 05</span></div></div></div></div>`;

  function unmount() {
    ro?.disconnect(); ro = null;
    cleanup?.(); cleanup = null;
    panel?.replaceChildren();
    panel = null;
  }
  function mount(host) {
    if (!host) return;
    unmount();
    panel = host;
    panel.classList.add('variation');
    host.innerHTML = GRAPH_MARKUP;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function resize(p){
    const scene = p.querySelector('.scene');
    if(!scene || p.hidden) return;
    const width = scene.parentElement.getBoundingClientRect().width;
    if(width > 0) scene.style.transform = `scale(${width / 960})`;
  }

  ro = new ResizeObserver(() => { if (panel === host) resize(host); });
  ro.observe(panel.querySelector('.scene-viewport'));

  /* ---- Summary copy per category (unchanged from source) ---- */
  const details = {
    prophets:['Graph','Explore the connected knowledge atlas'],
    companions:['Timeline','Explore historical eras and events'],
    narrators:['Figures','Explore historical figures and their records'],
    sources:['Hadiths','Explore hadith reports and references'],
    places:['Places','Explore locations in the historical record'],
    dynasties:['Events','Explore events and historical context'],
    themes:['Dynasties','Explore dynasties and their historical context'],
    events:['Books','Explore books and primary collections']
  };

  function chMotionMarkup(enabled){
    return `<span class="ch-motion-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"><path d="m12 2 8 4.5v10L12 21l-8-4.5v-10L12 2Z"/><path d="m4 6.5 8 5 8-5M12 11.5V21"/></svg></span><span class="ch-motion-label">3D ${enabled?'ON':'OFF'}</span><span class="ch-motion-dot" aria-hidden="true"></span>`;
  }

  function reset(){
    const rig = panel.querySelector('.ch-spatial-rig');
    if(!rig) return;
    rig.classList.remove('is-preview');
    rig.querySelectorAll('.node').forEach(n => n.classList.remove('is-active'));
    rig.querySelectorAll('.wire').forEach(w => w.classList.remove('is-route'));
    panel.querySelector('#summaryLabel').textContent = 'KNOWLEDGE GRAPH';
    panel.querySelector('#summaryTitle').textContent = 'Eight fields. One visual starting point.';
    panel.querySelector('#summaryBody').textContent = 'Hover over a field for a preview. Select a link to open its own page.';
  }

  const stage = panel.querySelector('.stage');
  const scene = panel.querySelector('.scene');

  /* ---- One transformed 3D space around the original layers ---- */
  const rig = document.createElement('div');
  rig.className = 'ch-spatial-rig';
  while(scene.firstChild) rig.append(scene.firstChild);
  scene.append(rig);

  // Real links preserve browser link actions and the supplied glyph/arrow markup.
  rig.querySelectorAll('.node').forEach(button => {
    const link = document.createElement('a');
    for (const attribute of button.attributes) {
      if (attribute.name !== 'type') link.setAttribute(attribute.name, attribute.value);
    }
    link.href = ROUTES[button.dataset.node] || '#graph';
    while (button.firstChild) link.append(button.firstChild);
    button.replaceWith(link);
  });

  /* Mobile mirror of the same buttons (hidden above 700px by the base CSS) */
  const mobile = panel.querySelector('.mobile-button-grid');
  rig.querySelectorAll('.node').forEach(btn => {
    btn.removeAttribute('aria-pressed');
    const clone = btn.cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttribute('aria-pressed','false');
    mobile.append(clone);
  });

  function focusNode(key){
    if(!details[key]) return;
    rig.classList.add('is-preview');
    rig.querySelectorAll('.node').forEach(n => n.classList.toggle('is-active', n.dataset.node === key));
    rig.querySelectorAll('.wire').forEach(w => w.classList.toggle('is-route', w.dataset.wire === key));
    const active = rig.querySelector('.node.is-active');
    rig.style.setProperty('--ch-route', active ? getComputedStyle(active).getPropertyValue('--tone').trim() : 'var(--accent)');
    panel.querySelector('#summaryLabel').textContent = 'KNOWLEDGE GRAPH / ' + key.toUpperCase();
    panel.querySelector('#summaryTitle').textContent = details[key][0];
    panel.querySelector('#summaryBody').textContent = details[key][1] + '. Preview route; not a verified isnad chain.';
  }

  stage.addEventListener('pointerover', e => { const n = e.target.closest('.node'); if(n) focusNode(n.dataset.node); });
  stage.addEventListener('pointerout', e => { const n = e.target.closest('.node'); if(n && !n.contains(e.relatedTarget)) reset(); });
  stage.addEventListener('focusin', e => { const n = e.target.closest('.node'); if(n) focusNode(n.dataset.node); });
  stage.addEventListener('focusout', e => { const n = e.target.closest('.node'); if(n && !n.contains(e.relatedTarget)) reset(); });
  stage.addEventListener('click', e => {
    const n = e.target.closest('.node');
    if(n){
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      location.hash = ROUTES[n.dataset.node] || '#graph'; reset(); return;
    }
    if(e.target.closest('[data-root]')){ location.hash = '#figures?id=prophet'; reset(); }
    if(e.target.closest('#clearBtn')) reset();
  });

  /* ---- 3D lean toggle ---- */
  let motion = true, raf = 0, x = 0, y = 0;
  const toggle = panel.querySelector('#tiltToggle');
  toggle.innerHTML = chMotionMarkup(true);
  toggle.addEventListener('click', () => {
    motion = !motion;
    toggle.setAttribute('aria-pressed', String(motion));
    toggle.innerHTML = chMotionMarkup(motion);
    if(!motion){
      rig.style.setProperty('--ch-tilt-x','0deg');
      rig.style.setProperty('--ch-tilt-y','0deg');
    }
  });

  stage.addEventListener('pointermove', e => {
    if(!motion || reduced.matches || e.pointerType === 'touch') return;
    const r = stage.querySelector('.scene-viewport').getBoundingClientRect();
    x = Math.max(-1, Math.min(1, 2 * (e.clientX - r.left) / r.width - 1));
    y = Math.max(-1, Math.min(1, 2 * (e.clientY - r.top) / r.height - 1));
    if(raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      rig.style.setProperty('--ch-tilt-x', (x * 2.8).toFixed(2) + 'deg');
      rig.style.setProperty('--ch-tilt-y', (-y * 2.8).toFixed(2) + 'deg');
    });
  });

  stage.addEventListener('pointerleave', () => {
    reset();
    rig.style.setProperty('--ch-tilt-x','0deg');
    rig.style.setProperty('--ch-tilt-y','0deg');
  });

  reset();

  /* ---- Root hover: distance-staggered illumination ---- */
  const order = ['prophets','companions','events','narrators','themes','sources','dynasties','places'];
  order.forEach((name, index) => {
    const delay = reduced.matches ? 0 : (.11 * index);
    for(const n of rig.querySelectorAll(`.node[data-node="${name}"],.wire[data-wire="${name}"]`)) n.style.setProperty('--ch-wave-delay', delay + 's');
  });

  const rootBtn = panel.querySelector('[data-root]');
  const spread = () => rig.classList.add('is-root-spreading');
  const unwind = () => rig.classList.remove('is-root-spreading');
  rootBtn.addEventListener('pointerenter', spread);
  rootBtn.addEventListener('pointerleave', unwind);
  rootBtn.addEventListener('focus', spread);
  rootBtn.addEventListener('blur', unwind);
  stage.addEventListener('pointerleave', unwind);

  /* ---- Real SVG path lengths, so each node glows only after the light arrives ---- */
  const speed = 112; /* SVG px/s: intentionally slow, directional propagation */
  rig.querySelectorAll('.wire[data-wire]').forEach(wire => {
    const length = Math.ceil(wire.getTotalLength());
    const duration = Math.max(.9, length / speed);
    const key = wire.dataset.wire;
    wire.style.setProperty('--ch-path-len', `${length}px`);
    wire.style.setProperty('--ch-line-duration', `${duration.toFixed(3)}s`);
    wire.style.setProperty('--ch-entry-delay', '0.12s');
    const target = rig.querySelector(`.node[data-node="${key}"]`);
    if(target) target.style.setProperty('--ch-arrival-delay', `${(duration + .12).toFixed(3)}s`);
  });

  /* ---- Field labels (unchanged from source) ---- */
  const labels = {
    prophets:['01 Graph','Explore the network'], companions:['02 Timeline','Explore the chronology'],
    narrators:['03 Figures','Explore the people'], sources:['04 Hadiths','Explore the narrations'],
    places:['05 Places','Explore the locations'], dynasties:['06 Events','Explore the moments'],
    themes:['07 Dynasties','Explore historical eras'], events:['08 Books','Explore the collections']
  };
  panel.querySelectorAll('.node[data-node]').forEach(node => {
    const info = labels[node.dataset.node];
    if(!info) return;
    const name = node.querySelector('.node-copy strong');
    const caption = node.querySelector('.node-copy small');
    if(name) name.textContent = info[0];
    if(caption) caption.textContent = info[1];
    node.setAttribute('aria-label', info[0].replace(/^0[1-8] /,'') + ' — ' + info[1]);
  });
  panel.querySelectorAll('.coordinate').forEach(el => { el.textContent = '◈ CHRONO—HADITH'; });
  panel.querySelectorAll('.stage-footer > span:first-child').forEach(el => {
    el.textContent = '◈ CHRONO—HADITH';
    el.classList.add('ch-stage-brand');
  });


  resize(panel);
  cleanup = () => {
    if (raf) cancelAnimationFrame(raf);
  };

  }
  return { mount, unmount };
})();
