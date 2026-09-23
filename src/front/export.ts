import { augmenterDefinition, augmenterTraduction, type NoeudAjoute } from '../domaine/ajouts.ts'
import { augmenterDefinitionParts, augmenterTraductionParts } from '../domaine/parts-ajoutees.ts'
import type { Ajouts } from '../grilles/index.ts'
import type { GrilleDefinition, Traduction } from '../domaine/types.ts'

/**
 * Deux choses bien distinctes se partagent.
 *
 * - **Les réponses** : ce que quelqu’un a dit. Ça ne se donne qu’à qui on veut.
 * - **La checklist** : les sujets et la façon de les qualifier, sans aucune
 *   réponse. C’est ce qu’on envoie à quelqu’un pour qu’il réponde sur la même
 *   base, et donc ce qui rend la comparaison possible.
 *
 * Les deux partent en JSON. Le YAML reste le format pour écrire une grille à la
 * main ; le JSON est celui qui circule, et qu’un programme relit sans risque.
 */

export interface ChecklistExportee {
  format: 'check-match/checklist'
  version: 1
  exporteLe: string
  definition: GrilleDefinition
  traductions: Record<string, Traduction>
}

export interface ReponsesExportees {
  format: 'check-match/reponses'
  version: 1
  exporteLe: string
  grille: string
  contenu: unknown
}

export function composerChecklist(
  definition: GrilleDefinition,
  traductions: Record<string, Traduction>,
  ajouts: Ajouts | NoeudAjoute[] = {},
): ChecklistExportee {
  const { noeuds = [], parts = [] } = Array.isArray(ajouts) ? { noeuds: ajouts, parts: [] } : ajouts
  // Les échelles d’abord, les sujets ensuite : dans cet ordre, un sujet ajouté
  // hérite des échelles comme n’importe quel autre.
  const traduites = Object.fromEntries(
    Object.entries(traductions).map(([langue, traduction]) =>
      [langue, augmenterTraduction(augmenterTraductionParts(traduction, parts), noeuds)]),
  )
  return {
    format: 'check-match/checklist',
    version: 1,
    exporteLe: new Date().toISOString(),
    definition: augmenterDefinition(augmenterDefinitionParts(definition, parts), noeuds),
    traductions: traduites,
  }
}

export function composerReponses(grille: string, contenu: unknown): ReponsesExportees {
  return {
    format: 'check-match/reponses',
    version: 1,
    exporteLe: new Date().toISOString(),
    grille,
    contenu,
  }
}

/** Nom de fichier lisible et trié naturellement : sujet, puis date. */
export function nomFichier(prefixe: string, grille: string): string {
  const jour = new Date().toISOString().slice(0, 10)
  return `${prefixe}-${grille}-${jour}.json`
}

/** Déclenche un téléchargement, sans serveur ni permission particulière. */
export function telecharger(nom: string, donnees: unknown): void {
  const contenu = JSON.stringify(donnees, null, 2)
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  // Laisser au navigateur le temps d’entamer l’enregistrement avant de libérer.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
