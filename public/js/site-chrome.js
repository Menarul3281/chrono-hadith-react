/* Shared presentation controls. Storage is optional: blocked storage must not prevent boot. */
const SiteChrome = (() => {
  const KEY = 'chrono.display.v1';
  const defaults = { theme: 'light', atmosphere: true, motion: true };
  let preferences = { ...defaults };
  let initialized = false;
  let returnFocus = null;

  function readPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return {
        theme: value?.theme === 'dark' || value?.theme === 'circuit' ? 'dark' : 'light',
        atmosphere: typeof value?.atmosphere === 'boolean' ? value.atmosphere : true,
        motion: typeof value?.motion === 'boolean' ? value.motion : true,
      };
    } catch { return { ...defaults }; }
  }

  function applyPreferences(save = false, onlyControl = null) {
    const root = document.documentElement;
    root.dataset.theme = preferences.theme;
    document.body.dataset.theme = preferences.theme;
    root.style.colorScheme = preferences.theme;
    if (preferences.atmosphere) document.body.classList.remove('no-fx');
    else document.body.classList.add('no-fx');
    root.dataset.atmosphere = preferences.atmosphere ? 'on' : 'off';
    root.dataset.motion = preferences.motion ? 'on' : 'off';
    if (!onlyControl || onlyControl === 'theme') {
      const toggle = document.querySelector('[data-theme-toggle]');
      const dark = preferences.theme === 'dark';
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(dark));
        toggle.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
        toggle.dataset.tooltip = `Switch to ${dark ? 'light' : 'dark'} theme`;
        const label = toggle.querySelector('[data-theme-label]');
        if (label) label.textContent = `${dark ? 'Dark' : 'Light'} theme`;
        const icon = toggle.querySelector('[data-theme-icon]');
        if (icon) icon.textContent = dark ? '☾' : '☼';
      }
    }
    if (!onlyControl || onlyControl === 'atmosphere') {
      document.querySelectorAll('[data-grain-toggle]').forEach((input) => {
        if ('checked' in input && input.checked !== preferences.atmosphere) {
          input.checked = preferences.atmosphere;
        }
      });
    }
    const atmosphere = document.querySelector('[data-atmosphere]');
    const motion = document.querySelector('[data-motion]');
    if (atmosphere) atmosphere.checked = preferences.atmosphere;
    if (motion) motion.checked = preferences.motion;
    if (save) {
      try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Session-only preferences. */ }
    }
  }

  function setPreference(key, value) {
    if (key === 'theme' && !['light', 'dark'].includes(value)) return;
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
    applyPreferences(true);
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
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', () =>
      setPreference('theme', preferences.theme === 'light' ? 'dark' : 'light'));
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
