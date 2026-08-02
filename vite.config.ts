import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vercel / local: base '/'
// GitHub Pages project site only when GITHUB_PAGES=true
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/PDF/' : '/',
  optimizeDeps: {
    include: ['pdfjs-dist', '@cantoo/pdf-lib'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
  },
})
