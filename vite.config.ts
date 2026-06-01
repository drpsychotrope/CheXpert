import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// ADR-0032: cross-origin isolation (COOP/COEP) is ON by default so the multi-thread
// engine can use SharedArrayBuffer in dev + preview (the .exe launcher sends the same
// headers). Opt out with ENABLE_COEP=0 for a host that can't set them (engine falls
// back to lite single-thread automatically). The launcher mirrors this in server.cjs.
const enableCoep = process.env.ENABLE_COEP !== '0';
const coepHeaders = enableCoep
  ? { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin' }
  : {};

export default defineConfig({
  plugins: [svelte()],
  worker: {
    format: 'es',
  },
  server: { headers: coepHeaders },
  preview: { headers: coepHeaders },
  // Vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
} as any);
