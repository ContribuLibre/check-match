/**
 * Vérifie que le build hors ligne est vraiment autonome.
 *
 * Un `index.html` qui s’ouvre depuis `file://` ne pardonne rien : un module ES
 * ne s’exécute pas, et un fichier voisin oublié ne se charge pas. Ces deux
 * pièges sont silencieux au build et ne se voient qu’en double-cliquant le
 * fichier — d’où ce contrôle.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const racine = new URL('../../dist-local/', import.meta.url).pathname

export function verifierBuildLocal(dossier: string): string[] {
  const problemes: string[] = []
  const chemin = join(dossier, 'index.html')
  if (!existsSync(chemin)) return [`${chemin} : absent — lance d’abord « bun run build:local »`]

  const restes = readdirSync(dossier).filter((nom) => nom !== 'index.html')
  if (restes.length) {
    problemes.push(`des fichiers accompagnent la page : ${restes.join(', ')} — elle doit se suffire`)
  }

  const html = readFileSync(chemin, 'utf8')

  if (/<script[^>]*type="module"/.test(html)) {
    problemes.push('un script de type module : un navigateur refuse de l’exécuter depuis file://')
  }

  // Tout ce qui pointe vers un voisin : une page seule ne peut rien charger.
  for (const [, attribut, cible] of html.matchAll(/\b(src|href)="(\.\/[^"]*|[^":]*\.(?:js|css|svg|png|webmanifest))"/g)) {
    if (cible === './') continue
    problemes.push(`référence vers un fichier voisin : ${attribut}="${cible}"`)
  }

  if (!/<style>/.test(html)) problemes.push('aucune feuille de style intégrée')
  if (!/<script>/.test(html)) problemes.push('aucun script intégré')

  return problemes
}

if (import.meta.main) {
  const problemes = verifierBuildLocal(racine)
  for (const probleme of problemes) console.error(`  ✗ ${probleme}`)
  if (problemes.length) {
    console.error(`\n${problemes.length} problème(s) dans le build hors ligne.`)
    process.exit(1)
  }
  const taille = readFileSync(join(racine, 'index.html')).length
  console.log(`Build hors ligne autonome : un fichier de ${Math.round(taille / 1024)} Ko.`)
}
