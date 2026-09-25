import React, { useEffect, useState } from 'react';
import { LegacyShell } from './legacyShell.js';
import { legacyScripts } from './legacyScripts.js';
// Graph is an actual React component using the installed @xyflow/react package.
// It registers window.ChronoGraph before the legacy router starts. The narrator
// page's mini network is registered the same way (window.ChronoNarratorGraph),
// and both fall back to their own canvas/SVG renderers when they cannot mount.
import './graph/GraphFlow.js';
import './graph/NarratorFlow.js';

let bootPromise = null;
function injectScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = false;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(el);
  });
}
async function startLegacyPages() {
  if (!bootPromise) {
    bootPromise = (async () => {
      for (const script of legacyScripts) await injectScript(script);
    })();
  }
  return bootPromise;
}

export default function App() {
  const [error, setError] = useState(null);
  useEffect(() => {
    let alive = true;
    startLegacyPages().catch((err) => {
      console.error('CHRONO-HADITH boot failure:', err);
      // A failed script must not poison later retries: allow a fresh boot pass.
      bootPromise = null;
      if (alive) setError(err.message);
    });
    return () => { alive = false; };
  }, []);

  return React.createElement(
    React.Fragment,
    null,
    React.createElement('a', {
      className: 'skip-link', href: '#page',
      onClick: (event) => { event.preventDefault(); document.getElementById('page')?.focus(); },
    }, 'Skip to content'),
    React.createElement('div', { id: 'chrono-app-shell' }, React.createElement(LegacyShell)),
    error && React.createElement('div', {
      role: 'alert',
      style: { position: 'fixed', left: 20, bottom: 20, zIndex: 99999,
        background: '#261319', color: '#fff', border: '1px solid #ff6478', padding: 20 }
    }, error, React.createElement('div', { style: { marginTop: 12 } },
      React.createElement('button', {
        type: 'button',
        onClick: () => { setError(null); startLegacyPages().catch((err) => { bootPromise = null; setError(err.message); }); },
        style: { padding: '6px 12px', cursor: 'pointer' },
      }, 'Retry'))),
  );
}
