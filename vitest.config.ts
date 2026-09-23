import { defineConfig } from 'vitest/config'
import { greffonYaml } from './src/CI/vite-yaml.ts'

export default defineConfig({
  plugins: [greffonYaml()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    testTimeout: 15_000,
  },
})
