/* One delegated tooltip for all routes, including dynamically mounted graphs.
   Plain text only; descriptions are attached while visible and restored on exit. */
const Tooltips = (() => {
  let tip, active, timer, originalTitle;
  const selector = '[data-tooltip], button[title], a[title], [role="button"][title], button[aria-label]';

  function hide() {
    clearTimeout(timer);
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== tip.id);
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '));
      else active.removeAttribute('aria-describedby');
      if (originalTitle !== null) active.setAttribute('title', originalTitle);
    }
    active = null;
    originalTitle = null;
    if (tip) tip.hidden = true;
  }

  function show(el, immediate = false) {
    if (!el || el === active || el.disabled) return;
    const onExpandedRail = el.closest?.('.sidebar.rail') && document.body.classList.contains('rail-expanded');
    if (onExpandedRail) { hide(); return; }
    hide();
    const text = el.dataset.tooltip || el.getAttribute('title') || el.getAttribute('aria-label');
    if (!text) return;
    active = el;
    originalTitle = el.getAttribute('title');
    el.removeAttribute('title');
    timer = setTimeout(() => {
      if (!el.isConnected) { hide(); return; }
      tip.textContent = text;
      tip.hidden = false;
      const rect = el.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const left = Math.max(8, Math.min(innerWidth - box.width - 8, rect.left + (rect.width - box.width) / 2));
      const top = rect.top >= box.height + 12 ? rect.top - box.height - 8 : rect.bottom + 8;
      tip.style.left = left + 'px';
      tip.style.top = Math.max(8, Math.min(innerHeight - box.height - 8, top)) + 'px';
      const ids = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      ids.add(tip.id);
      el.setAttribute('aria-describedby', [...ids].join(' '));
    }, immediate ? 0 : 450);
  }

  function init() {
    if (tip) return;
    tip = document.createElement('div');
    tip.id = 'chrono-tooltip';
    tip.className = 'chrono-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.appendChild(tip);
    const hints = {
      overview: 'Start with highlights from the archive',
      isnad: 'Trace a report through its chain of narrators',
      graph: 'Explore connections between figures, places, books and events',
      timeline: 'Compare lifetimes and events across history',
      figures: 'Explore biographies, teachers and students',
      hadiths: 'Browse reports and their sources',
      places: 'Explore the places recorded in the archive',
      events: 'Explore historical events and their context',
      dynasties: 'Compare dynasties, rulers and periods',
      books: 'Browse source works and save books to your shelf',
    };
    document.querySelectorAll('.nav-item').forEach((link) => {
      const route = link.getAttribute('href')?.slice(1).split('?')[0];
      if (hints[route]) link.dataset.tooltip = hints[route];
    });
    document.addEventListener('pointerover', (ev) => {
      if (ev.pointerType !== 'touch') show(ev.target.closest?.(selector));
    });
    document.addEventListener('pointerout', (ev) => {
      if (active && !active.contains(ev.relatedTarget)) hide();
    });
    document.addEventListener('focusin', (ev) => {
      const target = ev.target.closest?.(selector);
      if (!target?.closest?.('.sidebar.rail')) show(target, true);
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });
    document.addEventListener('scroll', hide, { capture: true, passive: true });
    window.addEventListener('resize', hide);
    window.addEventListener('hashchange', hide);
  }
  return { init, hide };
})();
