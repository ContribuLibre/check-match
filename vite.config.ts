import { defineConfig } from 'vite'
import { greffonYaml } from './src/CI/vite-yaml.ts'

export default defineConfig({
  base: './',
  plugins: [greffonYaml()],
  build: {
    target: 'es2022',
    // Tout tient dans un site statique déposable tel quel.
    assetsDir: 'assets',
  },
})
