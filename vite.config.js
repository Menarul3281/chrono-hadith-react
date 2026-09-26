import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Hash routing keeps every view on index.html, so relative assets work from
  // both a root deployment (Vercel) and the GitHub Pages project subdirectory.
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Diagnostic output can be locked by Windows while a helper writes it.
    // These scratch logs are not app assets and do not need hot reloads.
    watch: { ignored: ['**/_*.txt', '**/*.log'] },
  },
});
