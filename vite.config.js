import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/chrono-hadith-react/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Diagnostic output can be locked by Windows while a helper writes it.
    // These scratch logs are not app assets and do not need hot reloads.
    watch: { ignored: ['**/_*.txt', '**/*.log'] },
  },
});
