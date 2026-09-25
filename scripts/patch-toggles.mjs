import fs from 'node:fs';
const path = new URL('../public/js/app.js', import.meta.url);
let s = fs.readFileSync(path, 'utf8');
const before = s;
s = s.replace(
  "const light = ev.target.checked; document.body.dataset.theme = light ? 'light' : 'dark'; // theme-only, never touches FX",
  "document.body.dataset.theme = ev.target.checked ? 'light' : 'dark'; // theme-only, never touches FX"
);
s = s.replace(
  "if (typeof OverviewGraph !== 'undefined') OverviewGraph.setMode(light ? 'light' : 'dark'); if (typeof SiteChrome !== 'undefined') SiteChrome.setPreference('theme', light ? 'studio' : 'circuit'); // theme-only",
  "if (typeof SiteChrome !== 'undefined') SiteChrome.setPreference('theme', ev.target.checked ? 'studio' : 'circuit'); // theme-only\n    if (typeof OverviewGraph !== 'undefined') OverviewGraph.setMode(ev.target.checked ? 'light' : 'dark');"
);
s = s.replace(
  "/* theme handler owns palette + graph only */",
  "/* theme handler owns palette + graph only; FX untouched */"
);
s = s.replace(
  "const fxOn = ev.target.checked; document.body.classList.toggle('no-fx', !fxOn); document.documentElement.dataset.atmosphere = fxOn ? 'on' : 'off'; // fx-only, never touches theme",
  "document.body.classList.toggle('no-fx', !ev.target.checked); // fx-only, never touches theme\n    document.documentElement.dataset.atmosphere = ev.target.checked ? 'on' : 'off';"
);
if (s === before) { console.error('no patch applied'); process.exit(1); }
fs.writeFileSync(path, s);
console.log('patched ok');
