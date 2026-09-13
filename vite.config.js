import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    cacheDir: path.resolve(__dirname, '.vite-cache'),
    plugins: [react(), tailwindcss()],
    // sockjs-client is written for a CommonJS environment and dereferences the
    // Node `global` object at module scope, which does not exist in a browser
    // bundle. SockJS is not optional here: the backend refuses a raw WebSocket
    // upgrade, so this alias is what allows the live tier to load at all.
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // The route tree is already lazily split, so what remained in the entry chunk was the
          // shared validation layer plus the React and router runtime - together enough to carry
          // it past the 500 kB warning threshold. These three change far less often than
          // application code, so giving each its own chunk both takes the entry back under the
          // threshold and keeps them cached across deploys, where re-downloading them on every
          // release was the larger cost. Nothing is deferred: all three are still static imports
          // fetched in parallel with the entry, so the sign-in form has its schema on first
          // interaction without an extra round trip.
          manualChunks(id) {
            const path = id.replace(/\\/g, '/');
            if (!path.includes('/node_modules/')) return undefined;
            if (path.includes('/node_modules/zod/')) return 'vendor-zod';
            if (path.includes('/node_modules/react-router')) return 'vendor-router';
            if (
              path.includes('/node_modules/react/') ||
              path.includes('/node_modules/react-dom/') ||
              path.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    // The preview server serves the production bundle, and without this it had no proxy at all,
    // so a production build could only be exercised against a separately hosted API. Anything
    // that only reproduces in a production build - stacking contexts, CSS ordering, minified
    // class names - was therefore untestable locally.
    preview: {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
