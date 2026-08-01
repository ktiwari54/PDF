import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://ktiwari54.github.io/PDF/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/PDF/' : '/',
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
