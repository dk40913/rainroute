import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // maplibre-gl's tile-parsing web worker breaks under Vite's dep pre-bundling
  // (worker served with an empty MIME type → blocked → no vector layers render).
  optimizeDeps: { exclude: ["maplibre-gl"] },
  // Allow serving through Cloudflare quick tunnels (random *.trycloudflare.com hosts).
  preview: { allowedHosts: [".trycloudflare.com"] },
})
