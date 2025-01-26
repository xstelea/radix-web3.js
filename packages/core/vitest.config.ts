import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {},
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
