import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// RNF-12: Vite build ya minifica con esbuild + css + target modernos (Chrome/Firefox/Edge/Safari últimas 2). Ver .browserslistrc
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
