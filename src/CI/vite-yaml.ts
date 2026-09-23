import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import type { Plugin } from 'vite'

/**
 * Permet d’importer un `.yml` comme un module.
 * Les grilles sont écrites en YAML pour rester lisibles et modifiables sans
 * toucher au code ; ce greffon les transforme en données au moment du build.
 */
export function greffonYaml(): Plugin {
  return {
    name: 'check-match-yaml',
    transform(_code, id) {
      if (!id.endsWith('.yml') && !id.endsWith('.yaml')) return null
      const contenu = parse(readFileSync(id.split('?')[0] ?? id, 'utf8'))
      return { code: `export default ${JSON.stringify(contenu)}`, map: null }
    },
  }
}
