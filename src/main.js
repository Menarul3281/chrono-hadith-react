import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// App shell is mounted by React; legacy page renderers remain temporarily
// bridged during migration. Do not use StrictMode around these legacy effects.
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(React.createElement(App));
} else {
  console.error('CHRONO-HADITH boot failure: missing #root element');
}
