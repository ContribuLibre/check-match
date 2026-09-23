import { construireGrille } from '../domaine/grille.ts'
import type { ChecklistExportee, ReponsesExportees } from './export.ts'

/**
 * Relire ce qui a été exporté.
 *
 * Deux formats se présentent au même endroit — une checklist et des réponses —
 * et ils n’ont pas du tout le même effet : l’une ajoute une grille à remplir,
 * l’autre verse des réponses dans le bac de quelqu’un. Le fichier dit lui-même
 * lequel il est ; à défaut, on refuse plutôt que de deviner.
 */

export type Lecture =
  | { type: 'checklist'; charge: ChecklistExportee }
  | { type: 'reponses'; charge: ReponsesExportees }

export class ErreurImport extends Error {}

/**
 * Reconnaît un fichier importé, et vérifie qu’il tient debout.
 *
 * Une checklist est construite pour de bon avant d’être acceptée : mieux vaut
 * refuser à l’import qu’afficher une grille qui casse le calcul ensuite.
 */
export function analyser(donnees: unknown): Lecture {
  // Les deux formats se distinguent par leur champ `format` ; le reste est lu
  // à plat, puisqu’on ne sait pas encore auquel on a affaire.
  const charge = donnees as
    | ({ format?: string } & Partial<Omit<ChecklistExportee, 'format'>> & Partial<Omit<ReponsesExportees, 'format'>>)
    | null
  if (!charge || typeof charge !== 'object') throw new ErreurImport('format')

  if (charge.format === 'check-match/checklist') {
    if (!charge.definition || !charge.traductions) throw new ErreurImport('format')
    try {
      construireGrille(charge.definition)
    } catch (erreur) {
      throw new ErreurImport(erreur instanceof Error ? erreur.message : 'format')
    }
    return { type: 'checklist', charge: charge as ChecklistExportee }
  }

  if (charge.format === 'check-match/reponses') {
    if (!charge.contenu || typeof charge.contenu !== 'object') throw new ErreurImport('format')
    return { type: 'reponses', charge: charge as ReponsesExportees }
  }

  throw new ErreurImport('format')
}

/** Lit un fichier choisi et l’analyse. */
export async function lireFichier(fichier: File): Promise<Lecture> {
  let donnees: unknown
  try {
    donnees = JSON.parse(await fichier.text())
  } catch {
    throw new ErreurImport('format')
  }
  return analyser(donnees)
}

/**
 * Demande un fichier. Le sélecteur est posé puis retiré du document : il ne sert
 * qu’à ouvrir la fenêtre du système, et ne doit rien laisser derrière lui.
 */
export function choisirFichier(accept = 'application/json,.json'): Promise<File | null> {
  return new Promise((resoudre) => {
    const champ = document.createElement('input')
    champ.type = 'file'
    champ.accept = accept
    champ.style.display = 'none'
    document.body.appendChild(champ)
    champ.addEventListener('change', () => {
      const fichier = champ.files?.[0] ?? null
      champ.remove()
      resoudre(fichier)
    })
    // Renoncer dans la fenêtre du système n’émet aucun événement fiable partout :
    // on laisse le champ en place plutôt que de promettre un `null` qui ne
    // viendrait jamais.
    champ.click()
  })
}
