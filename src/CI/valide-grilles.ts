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
import { paliers, typeEchelle } from '../domaine/echelle.ts'
import { construireGrille } from '../domaine/grille.ts'
import { clesManquantes, couverture } from '../domaine/traduction.ts'
import type { GrilleDefinition, Traduction } from '../domaine/types.ts'

const racineGrilles = new URL('../grilles/', import.meta.url).pathname

/** Lit un YAML en transformant une erreur de syntaxe en message lisible. */
function lireYaml<T>(chemin: string): { valeur?: T; probleme?: string } {
  try {
    return { valeur: parse(readFileSync(chemin, 'utf8')) as T }
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message.split('\n')[0] : String(erreur)
    return { probleme: `${chemin} : YAML invalide — ${message}` }
  }
}

const CLES_ATTENDUES: Record<string, string[]> = {
  nodes: ['label', 'help'],
  polarities: ['label', 'help'],
  parts: ['label', 'help', 'steps', 'poles', 'zones'],
}

/**
 * Attrape les valeurs coupées par une virgule.
 *
 * En YAML, `{ label: Absences, help: Partir, revenir }` ne donne pas l’aide
 * attendue : la virgule sépare les entrées du mapping, et « revenir » devient
 * une clé. Le libellé existe quand même, donc rien ne semble cassé — c’est
 * précisément pour ça qu’il faut le vérifier ici.
 */
function clesInattendues(traduction: Traduction, ou: string): string[] {
  const problemes: string[] = []
  for (const [section, attendues] of Object.entries(CLES_ATTENDUES)) {
    const entrees = (traduction as unknown as Record<string, Record<string, Record<string, unknown>>>)[section] ?? {}
    for (const [id, valeur] of Object.entries(entrees)) {
      for (const cle of Object.keys(valeur ?? {})) {
        if (!attendues.includes(cle)) {
          problemes.push(`${ou} : ${section}.${id} porte « ${cle} » — une virgule non protégée a coupé la valeur`)
        }
      }
      // Les sous-sections d’une part — crans, extrêmes, repères — portent les
      // mêmes clés et courent le même risque.
      for (const sous of ['steps', 'poles', 'zones']) {
        const entrees = (valeur?.[sous] ?? {}) as Record<string, Record<string, unknown>>
        for (const [nom, contenu] of Object.entries(entrees)) {
          for (const cle of Object.keys(contenu ?? {})) {
            if (cle !== 'label' && cle !== 'help') {
              problemes.push(`${ou} : ${section}.${id}.${sous}.${nom} porte « ${cle} » — une virgule non protégée a coupé la valeur`)
            }
          }
        }
      }
    }
  }
  return problemes
}

export interface Rapport {
  /** Ce qui casserait les calculs ou l’affichage : la CI s’arrête. */
  problemes: string[]
  /** Ce qui mérite d’être su sans rien bloquer : couverture des traductions. */
  remarques: string[]
}

export function validerGrille(dossier: string): Rapport {
  const problemes: string[] = []
  const remarques: string[] = []
  const cheminDefinition = join(dossier, 'grille.yml')
  if (!existsSync(cheminDefinition)) return { problemes: [`${dossier} : pas de grille.yml`], remarques }

  const lu = lireYaml<GrilleDefinition>(cheminDefinition)
  if (!lu.valeur) return { problemes: [lu.probleme ?? `${cheminDefinition} : illisible`], remarques }
  const definition = lu.valeur
  const grille = construireGrille(definition)

  for (const part of grille.parts) {
    // Une échelle continue n’a pas de crans : c’est sa raison d’être.
    if (typeEchelle(part) !== 'steps') continue
    const scores = paliers(part).map((palier) => palier.score)
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
    const lue = lireYaml<Traduction>(cheminLangue)
    if (!lue.valeur) {
      problemes.push(lue.probleme ?? `${cheminLangue} : illisible`)
      continue
    }
    const traduction = lue.valeur
    problemes.push(...clesInattendues(traduction, `${grille.id}/${langue}`))
    const manquantes = clesManquantes(grille, traduction)

    // La langue par défaut sert de repli à toutes les autres : elle doit être
    // complète. Les autres seront presque toujours partielles — une grille de
    // deux cents entrées ne se traduit pas d’un bloc, et une traduction entamée
    // ne doit rien bloquer.
    if (langue === definition.defaultLocale) {
      for (const manquante of manquantes) {
        problemes.push(`${grille.id}/${langue} (langue par défaut) : « ${manquante} » sans libellé`)
      }
    } else if (manquantes.length) {
      const part = Math.round(couverture(grille, traduction) * 100)
      remarques.push(`${grille.id}/${langue} : ${part} % traduit, ${manquantes.length} libellé(s) repris du ${definition.defaultLocale}`)
    }
  }

  return { problemes, remarques }
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
    const { problemes, remarques } = validerGrille(dossier)
    total += problemes.length
    for (const probleme of problemes) console.error(`  ✗ ${probleme}`)
    for (const remarque of remarques) console.log(`  · ${remarque}`)
  }

  if (total) {
    console.error(`\n${total} problème(s) dans les grilles.`)
    process.exit(1)
  }
  console.log(`${dossiers.length} grille(s) valides.`)
}
