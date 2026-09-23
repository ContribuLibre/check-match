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
    titre: traduction.titre,
    intro: traduction.intro ?? '',
    noeud: (id: string): string => traduction.noeuds?.[id]?.libelle ?? id,
    aideNoeud: (id: string): string => traduction.noeuds?.[id]?.aide ?? '',
    polarite: (id: string): string => traduction.polarites?.[id]?.libelle ?? id,
    aidePolarite: (id: string): string => traduction.polarites?.[id]?.aide ?? '',
    part: (id: string): string => traduction.parts?.[id]?.libelle ?? id,
    aidePart: (id: string): string => traduction.parts?.[id]?.aide ?? '',
    palier: (part: string, palier: string): string =>
      traduction.parts?.[part]?.paliers?.[palier]?.libelle ?? palier,
    aidePalier: (part: string, palier: string): string =>
      traduction.parts?.[part]?.paliers?.[palier]?.aide ?? '',
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
  if (!traduction.titre) manquantes.push('titre')

  for (const id of grille.noeuds.keys()) {
    if (!traduction.noeuds?.[id]?.libelle) manquantes.push(`noeuds.${id}`)
  }
  for (const polarite of grille.polarites.values()) {
    if (!traduction.polarites?.[polarite.id]?.libelle) manquantes.push(`polarites.${polarite.id}`)
  }
  for (const part of grille.parts) {
    const traduit = traduction.parts?.[part.id]
    if (!traduit?.libelle) manquantes.push(`parts.${part.id}`)
    for (const palier of part.paliers) {
      if (!traduit?.paliers?.[palier.id]?.libelle) manquantes.push(`parts.${part.id}.paliers.${palier.id}`)
    }
  }
  return manquantes
}
