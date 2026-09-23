import type { Grille } from './grille.ts'
import type { Traduction } from './types.ts'

/**
 * Accès aux libellés.
 *
 * Les identifiants techniques sont dans la structure, les textes dans les
 * fichiers de langue : traduire une grille n’oblige donc jamais à toucher aux
 * identifiants, et les réponses restent valables d’une langue à l’autre.
 *
 * Un libellé manquant retombe sur l’identifiant plutôt que sur du vide : on
 * voit tout de suite ce qui reste à traduire, sans écran cassé.
 */
export function creerTextes(traduction: Traduction) {
  return {
    titre: traduction.title,
    intro: traduction.intro ?? '',
    noeud: (id: string): string => traduction.nodes?.[id]?.label ?? id,
    aideNoeud: (id: string): string => traduction.nodes?.[id]?.help ?? '',
    polarite: (id: string): string => traduction.polarities?.[id]?.label ?? id,
    aidePolarite: (id: string): string => traduction.polarities?.[id]?.help ?? '',
    part: (id: string): string => traduction.parts?.[id]?.label ?? id,
    aidePart: (id: string): string => traduction.parts?.[id]?.help ?? '',
    palier: (part: string, palier: string): string =>
      traduction.parts?.[part]?.steps?.[palier]?.label ?? palier,
    aidePalier: (part: string, palier: string): string =>
      traduction.parts?.[part]?.steps?.[palier]?.help ?? '',
  }
}

export type Textes = ReturnType<typeof creerTextes>

/**
 * Ce qu’une traduction ne couvre pas.
 *
 * On cherche l’absence de clé, et non un libellé égal à son identifiant :
 * « unknown » est une traduction parfaitement valable du palier `unknown`.
 */
export function clesManquantes(grille: Grille, traduction: Traduction): string[] {
  const manquantes: string[] = []
  if (!traduction.title) manquantes.push('titre')

  for (const id of grille.noeuds.keys()) {
    if (!traduction.nodes?.[id]?.label) manquantes.push(`noeuds.${id}`)
  }
  for (const polarite of grille.polarites.values()) {
    if (!traduction.polarities?.[polarite.id]?.label) manquantes.push(`polarites.${polarite.id}`)
  }
  for (const part of grille.parts) {
    const traduit = traduction.parts?.[part.id]
    if (!traduit?.label) manquantes.push(`parts.${part.id}`)
    for (const palier of part.steps) {
      if (!traduit?.steps?.[palier.id]?.label) manquantes.push(`parts.${part.id}.steps.${palier.id}`)
    }
  }
  return manquantes
}
