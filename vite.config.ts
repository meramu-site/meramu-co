import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The SPA entry is spa.html (renamed from index.html): Vercel serves
  // filesystem files before rewrites, so a static dist/index.html would
  // shadow the exact-/ rewrite to the serverless homepage (api/index.js).
  // /home and /dapur-redaksi in vercel.json point at /spa.html instead.
  // Local dev: open /spa.html (there is no longer an index.html to serve).
  build: {
    rollupOptions: {
      input: {
        spa: resolve(__dirname, 'spa.html'),
      },
    },
  },
});
