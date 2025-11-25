import { defineConfig } from 'vite'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vueJsx()],
  base: '/view/',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
    extensions: ['.tsx', '.ts'],
  },
  server: {
    proxy: {
      // For local development, run `pnpm run dev` in the main folder first
      '/api': 'http://localhost:8787',
    },
  },
})
