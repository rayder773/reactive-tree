import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'examples',
  envDir: resolve(import.meta.dirname),
  plugins: [vue()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
})
