/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/tinker/',
  plugins: [react()],
  server: {
    // CRA's react-scripts defaulted to port 3000; Vite defaults to 5173.
    port: 3000,
    host: '127.0.0.1',
    strictPort: true, // fail instead of silently picking another port if 3000 is taken
    allowedHosts: ['web'],
    // Equivalent of setupProxy.js. Vite's own dev server replaces
    // react-scripts/webpack-dev-server entirely.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true, // important: socket.io needs the websocket upgrade proxied too
      },
    },
  },
  test: {
    // Vitest config (replaces `react-scripts test` / Jest)
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    css: true,
  },
})