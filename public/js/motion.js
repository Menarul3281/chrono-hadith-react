/* Motion — click acknowledgement in one place.

   Hover and press are pure CSS (css/motion.css). Click rings use the animation
   API, delegated from the document, so a control that only changes something
   elsewhere on the page still answers the click. Pages can also ask for the
   same ring directly when a change happens for another reason. */

const Motion = (() => {
  // Controls that sit inside a larger surface get the soft ring, so a click does
  // not flash a whole panel; standalone controls get the full ring.
  const SOFT = '.ev-row, .ev-near, .dy-card, .figure-card, .narrator-row, .dyt-bar, .dsh-check, .ev-period, .picker-item, .tps-row, .plc-row, .gph-node, .hk-card';
  const TARGETS = `${SOFT}, .pressable, .dsh-btn, .dsh-iconbtn, .dsh-chip, .dsh-view-btn,
    .top-action, .footer-btn, .nav-item, .ev-tab, .ev-badge.dyn, .dy-arrow, .dy-more,
    .dym-legend-item, .filter-chip, .picker-button, .tlc-btn, .tlc-tab, .crumb, .dsh-switch`;

  let enabled = true;
  let initialized = false;
  const animations = new WeakMap();

  function pulse(el, soft) {
    if (!el || !el.classList || !enabled) return;
    if (!el.animate) return;
    animations.get(el)?.cancel();
    const animation = el.animate([
      { boxShadow: `0 0 0 0 rgba(52, 246, 193, ${soft ? '.16' : '.35'})` },
      { boxShadow: '0 0 0 8px rgba(52, 246, 193, 0)' },
    ], { duration: soft ? 300 : 240, easing: 'ease-out' });
    animations.set(el, animation);
  }

  function fromEvent(ev) {
    const el = ev.target?.closest?.(TARGETS);
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
    return el;
  }

  function init() {
    if (initialized) return;
    initialized = true;
    // A reduced-motion reader gets no rings at all.
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    enabled = !preference.matches;
    preference.addEventListener('change', (event) => { enabled = !event.matches; });

    document.addEventListener('click', (ev) => {
      const el = fromEvent(ev);
      if (!el) return;
      pulse(el, el.matches(SOFT));
    }, true);

    // Native buttons also dispatch click for keyboard activation.
  }

  return { init, pulse };
})();
