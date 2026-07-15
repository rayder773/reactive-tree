import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
	envDir: process.cwd(),
	plugins: [vue()],
})
