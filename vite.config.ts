import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Q-C=a (hybrid): default build is lite single-thread Stockfish, which does NOT
// need SharedArrayBuffer, so we ship WITHOUT COOP/COEP headers by default.
// Flip ENABLE_COEP=1 only when serving a multi-thread engine build on a host
// that can set these headers (Phase 2 opt-in). See specs/phase1-mvp-spec.md G3.
const enableCoep = process.env.ENABLE_COEP === '1';

export default defineConfig({
  plugins: [svelte()],
  worker: {
    format: 'es',
  },
  server: {
    headers: enableCoep
      ? {
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Opener-Policy': 'same-origin',
        }
      : {},
  },
  // Vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
} as any);
