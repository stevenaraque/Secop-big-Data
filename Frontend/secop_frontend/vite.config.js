import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// RNF-12: Vite build ya minifica con esbuild + css + target modernos (Chrome/Firefox/Edge/Safari últimas 2). Ver .browserslistrc
// P0 auditoría: code-split para bajar 1.23MB >500kB — recharts/leaflet/graph separados, 50KB agregados + 50 nodos DOM = 100 FPS
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'recharts'
            if (id.includes('leaflet') || id.includes('react-leaflet')) return 'leaflet'
            if (id.includes('react-force-graph')) return 'graph'
            if (id.includes('motion') || id.includes('animejs')) return 'motion'
            if (id.includes('@tanstack')) return 'tanstack'
            return 'vendor'
          }
        },
      },
    },
  },
})
