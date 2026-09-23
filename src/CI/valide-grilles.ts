/**
 * Vérifie les grilles hors de tout navigateur, avant même de compiler.
 *
 * Ce que le typage ne peut pas voir : un parent qui n’existe pas, un cycle, un
 * palier non traduit, des scores qui ne vont pas de 0 à 1. Une grille cassée
 * doit arrêter la CI, pas produire un écran vide chez la personne qui répond.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { construireGrille } from '../domaine/grille.ts'
import { clesManquantes } from '../domaine/traduction.ts'
import type { GrilleDefinition, Traduction } from '../domaine/types.ts'

const racineGrilles = new URL('../grilles/', import.meta.url).pathname

export function validerGrille(dossier: string): string[] {
  const problemes: string[] = []
  const cheminDefinition = join(dossier, 'grille.yml')
  if (!existsSync(cheminDefinition)) return [`${dossier} : pas de grille.yml`]

  const definition = parse(readFileSync(cheminDefinition, 'utf8')) as GrilleDefinition
  const grille = construireGrille(definition)

  for (const part of grille.parts) {
    const scores = part.steps.map((palier) => palier.score)
    if (scores.length < 2) problemes.push(`${grille.id}/${part.id} : moins de deux paliers`)
    if (scores[0] !== 0) problemes.push(`${grille.id}/${part.id} : le premier palier ne vaut pas 0`)
    if (scores[scores.length - 1] !== 1) problemes.push(`${grille.id}/${part.id} : le dernier palier ne vaut pas 1`)
    for (const [index, score] of scores.entries()) {
      if (index && score <= (scores[index - 1] ?? 0)) {
        problemes.push(`${grille.id}/${part.id} : les scores ne sont pas croissants (${score})`)
      }
    }
  }

  const orphelins = [...grille.noeuds.values()].filter((noeud) => !noeud.parents.length && !noeud.enfants.length)
  for (const orphelin of orphelins) {
    problemes.push(`${grille.id}/${orphelin.id} : nœud isolé, sans parent ni enfant`)
  }

  for (const [langue, chemin] of Object.entries(definition.locales ?? {})) {
    const cheminLangue = join(dossier, chemin.replace(/^\.\//, ''))
    if (!existsSync(cheminLangue)) {
      problemes.push(`${grille.id} : traduction « ${langue} » introuvable (${chemin})`)
      continue
    }
    const traduction = parse(readFileSync(cheminLangue, 'utf8')) as Traduction
    for (const manquante of clesManquantes(grille, traduction)) {
      problemes.push(`${grille.id}/${langue} : « ${manquante} » sans libellé`)
    }
  }

  return problemes
}

if (import.meta.main) {
  const dossiers = readdirSync(racineGrilles, { withFileTypes: true })
    .filter((entree) => entree.isDirectory())
    .map((entree) => join(racineGrilles, entree.name))

  if (!dossiers.length) {
    console.error('Aucune grille trouvée.')
    process.exit(1)
  }

  let total = 0
  for (const dossier of dossiers) {
    const problemes = validerGrille(dossier)
    total += problemes.length
    for (const probleme of problemes) console.error(`  ✗ ${probleme}`)
  }

  if (total) {
    console.error(`\n${total} problème(s) dans les grilles.`)
    process.exit(1)
  }
  console.log(`${dossiers.length} grille(s) valides.`)
}
