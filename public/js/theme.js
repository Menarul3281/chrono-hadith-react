/* Reader palette: light is the product's default, dark is one attribute away.
   The attribute lives on <html> and is written before the first paint by the
   inline script in index.html, so CSS never has to guess and the page never
   flashes the wrong field. This module owns every change after that — the rail
   switch, the stored choice, and the operating-system preference while the
   reader has not chosen. Storage is optional: a blocked store must not stop
   the switch from working for the session. */
const Theme = (() => {
  const KEY = 'chrono.theme.v1';
  const MODES = ['light', 'dark'];
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'light';
  let initialized = false;

  function stored() {
    try {
      const value = localStorage.getItem(KEY);
      return MODES.includes(value) ? value : null;
    } catch { return null; }
  }

  function preferred() {
    return stored() || (system.matches ? 'dark' : 'light');
  }

  function current() {
    return mode;
  }

  /* Theme controls are buttons, not presentation-preference checkboxes. Keeping
     the two control types distinct prevents a theme change from sharing state or
     a hit area with the independent FX switch. Input support remains for any
     older embedded shell that still renders the former checkbox. */
  function syncControls() {
    document.querySelectorAll('[data-theme-toggle]').forEach((control) => {
      const dark = mode === 'dark';
      if ('checked' in control && control.checked !== dark) control.checked = dark;
      control.dataset.themeState = mode;
      if (control.matches('button')) control.setAttribute('aria-pressed', String(dark));
      const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
      control.setAttribute('aria-label', label);
      control.dataset.tooltip = label;
      const visibleLabel = control.querySelector?.('[data-theme-label]');
      if (visibleLabel) visibleLabel.textContent = dark ? 'Dark mode' : 'Light mode';
    });
  }

  function apply(next, save) {
    mode = MODES.includes(next) ? next : preferred();
    document.documentElement.dataset.theme = mode;
    if (save) {
      try { localStorage.setItem(KEY, mode); } catch { /* Session-only choice. */ }
    }
    syncControls();
  }

  function set(next) {
    if (!MODES.includes(next) || next === mode) return;
    apply(next, true);
  }

  function toggle() {
    set(mode === 'dark' ? 'light' : 'dark');
  }

  function init() {
    if (initialized) return;
    initialized = true;
    // Honour the attribute the inline script already set; recompute only if it
    // was never written (for example, an inline-script CSP that dropped it).
    apply(document.documentElement.dataset.theme || preferred(), false);
    // One delegated listener keeps working for controls mounted later, and a
    // programmatic flip never fires 'change', so this cannot loop.
    document.addEventListener('click', (event) => {
      const control = event.target.closest?.('button[data-theme-toggle]');
      if (!control) return;
      toggle();
    });
    document.addEventListener('change', (event) => {
      const control = event.target.closest?.('[data-theme-toggle]');
      if (!control || control.matches('button')) return;
      set(control.checked ? 'dark' : 'light');
    });
    // The system is followed only while the reader has no stored choice.
    system.addEventListener('change', () => { if (!stored()) apply(null, false); });
    // The shell mounts before the legacy scripts load, but stay safe anyway.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncControls, { once: true });
    }
  }

  init();
  return { init, set, toggle, current };
})();
