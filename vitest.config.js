import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	define: {
		'import.meta.env.VITE_MOCK': JSON.stringify('true'),
	},
	plugins: [vue()],
	test: {
		environment: 'node',
	},
})
