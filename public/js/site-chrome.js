/* Shared presentation controls. Archive records and page renderers stay independent
   of the chosen theme. Storage is optional: blocked storage must not prevent boot. */
const SiteChrome = (() => {
  const KEY = 'chrono.display.v1';
  const defaults = { theme: 'studio', atmosphere: true, motion: true };
  let preferences = { ...defaults };
  let initialized = false;
  let returnFocus = null;

  function readPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return {
        theme: value?.theme === 'circuit' ? 'circuit' : 'studio',
        atmosphere: typeof value?.atmosphere === 'boolean' ? value.atmosphere : true,
        motion: typeof value?.motion === 'boolean' ? value.motion : true,
      };
    } catch { return { ...defaults }; }
  }

  function applyPreferences(save = false, onlyControl = null) {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    document.body.dataset.theme = preferences.theme === 'studio' ? 'light' : 'dark';
    // Mirror the resolved palette onto <html> so the theme applies even before
    // body exists (the React shell mounts asynchronously after this script).
    root.dataset.themeResolved = document.body.dataset.theme;
    if (preferences.atmosphere) document.body.classList.remove('no-fx');
    else document.body.classList.add('no-fx');
    root.dataset.atmosphere = preferences.atmosphere ? 'on' : 'off';
    root.dataset.motion = preferences.motion ? 'on' : 'off';
    root.style.colorScheme = preferences.theme === 'studio' ? 'light' : 'dark';
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === preferences.theme));
    });
    // Each rail switch is synced only when its own preference is applied.
    // A theme change must never rewrite the FX checkbox and vice versa —
    // programmatic .checked assignment does not fire `change`, so the two
    // controls stay visually and logically decoupled.
    if (!onlyControl || onlyControl === 'theme') {
      const theme = document.querySelector('[data-theme-toggle]');
      theme?.setAttribute('aria-label', preferences.theme === 'studio'
        ? 'Switch to Circuit dark theme' : 'Switch to Studio light theme');
      document.querySelectorAll('[data-theme-toggle]').forEach((input) => {
        if ('checked' in input && input.checked !== (preferences.theme === 'studio')) {
          input.checked = preferences.theme === 'studio';
        }
      });
    }
    if (!onlyControl || onlyControl === 'atmosphere') {
      document.querySelectorAll('[data-grain-toggle]').forEach((input) => {
        if ('checked' in input && input.checked !== preferences.atmosphere) {
          input.checked = preferences.atmosphere;
        }
      });
    }
    if (typeof OverviewGraph !== 'undefined') OverviewGraph.setMode(document.body.dataset.theme);
    const atmosphere = document.querySelector('[data-atmosphere]');
    const motion = document.querySelector('[data-motion]');
    if (atmosphere) atmosphere.checked = preferences.atmosphere;
    if (motion) motion.checked = preferences.motion;
    if (save) {
      try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Session-only preferences. */ }
    }
  }

  function setPreference(key, value) {
    if (key === 'theme' && !['studio', 'circuit'].includes(value)) return;
    if (['motion', 'atmosphere'].includes(key) && typeof value !== 'boolean') return;
    if (!(key in defaults)) return;
    if (preferences[key] === value) return;
    preferences = { ...preferences, [key]: value };
    applyPreferences(true, key);
  }

  function syncRouteTabs() {
    setRailExpanded(false);
    const nav = document.getElementById('routeTabs');
    if (!nav) return;
    const [raw, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const params = new URLSearchParams(query);
    const historyViews = ['timeline', 'events', 'places'];
    const libraryViews = ['hadiths', 'books', 'quran'];
    const path = historyViews.includes(raw) ? 'history' : libraryViews.includes(raw) ? 'library' : raw;
    const active = path === 'history'
      ? (historyViews.includes(raw) ? raw : params.get('view') || 'timeline')
      : (libraryViews.includes(raw) ? raw : params.get('tab') || 'hadiths');
    const tabs = path === 'history'
      ? [['timeline', 'Timeline'], ['events', 'Events'], ['places', 'Places']]
      : path === 'library' ? [['hadiths', 'Hadiths'], ['books', 'Books'], ['quran', "Qur’an"]] : [];
    nav.hidden = !tabs.length;
    nav.innerHTML = tabs.map(([key, label]) =>
      `<a href="#${path}?${path === 'history' ? 'view' : 'tab'}=${key}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  }

  function setRailExpanded(expanded) {
    const on = Boolean(expanded);
    document.body.classList.toggle('rail-expanded', on);
    const expand = document.querySelector('[data-rail-expand]');
    expand?.setAttribute('aria-expanded', String(on));
    expand?.setAttribute('aria-label', on ? 'Collapse navigation' : 'Expand navigation');
    if (typeof Tooltips !== 'undefined') Tooltips.hide();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    preferences = readPreferences();
    applyPreferences();
    syncRouteTabs();
    window.addEventListener('hashchange', syncRouteTabs);

    const dialog = document.getElementById('displayPanel');
    const closeDisplay = () => dialog?.close();
    dialog?.addEventListener('close', () => returnFocus?.focus());
    dialog?.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDisplay();
    });
    document.querySelectorAll('[data-display-open]').forEach((button) => {
      button.addEventListener('click', () => {
        returnFocus = button;
        if (dialog && !dialog.open) dialog.showModal();
      });
    });
    document.querySelector('[data-display-close]')?.addEventListener('click', closeDisplay);
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => setPreference('theme', button.dataset.themeChoice));
    });
    const themeToggle = document.querySelector('[data-theme-toggle]');
    // The shell checkbox change is owned by app.js; retain support for button shells.
    if (themeToggle && themeToggle.type !== 'checkbox') themeToggle.addEventListener('click', () =>
      setPreference('theme', preferences.theme === 'studio' ? 'circuit' : 'studio'));
    for (const key of ['atmosphere', 'motion']) {
      document.querySelector(`[data-${key}]`)?.addEventListener('change', (event) => setPreference(key, event.target.checked));
    }
    const expand = document.querySelector('[data-rail-expand]');
    expand?.addEventListener('click', () => {
      setRailExpanded(!document.body.classList.contains('rail-expanded'));
    });
    document.getElementById('navScrim')?.addEventListener('click', () => setRailExpanded(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setRailExpanded(false);
      }
    });
  }

  return { init, setPreference };
})();
