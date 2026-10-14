import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the real backend so the frontend can call "/api/..."
    // without CORS issues during development. The backend default port is 3000;
    // override with VITE_API_TARGET=http://localhost:8080 if it runs elsewhere.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        // Keep the "/api" prefix as-is so the backend receives the full path
        // (the backend mounts its routers under /api/auth and /api/imports).
      },
    },
  },
})
