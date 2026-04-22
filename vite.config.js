import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target:
          process.env.VITE_BFF_URL ||
          (process.env.NODE_ENV === "production"
            ? "https://bff.traders.tradergunit.is-a.dev"
            : "http://127.0.0.1:8788"),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1700,
    rolldownOptions: {
      checks: {
        pluginTimings: false,
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('tesseract.js')) {
            return 'ocr'
          }

          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('react-syntax-highlighter')
          ) {
            return 'markdown'
          }

          if (id.includes('firebase/')) {
            return 'firebase'
          }

          if (
            id.includes('@emailjs/') ||
            id.includes('emailjs-com')
          ) {
            return 'email'
          }

          if (id.includes('lucide-react')) {
            return 'icons'
          }

          return 'vendor'
        },
      },
    },
  },
})
