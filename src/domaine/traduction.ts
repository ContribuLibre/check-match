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
    facette: (id: string): string => traduction.facettes?.[id]?.libelle ?? id,
    aideFacette: (id: string): string => traduction.facettes?.[id]?.aide ?? '',
    critere: (id: string): string => traduction.criteres?.[id]?.libelle ?? id,
    aideCritere: (id: string): string => traduction.criteres?.[id]?.aide ?? '',
    palier: (critere: string, palier: string): string =>
      traduction.criteres?.[critere]?.paliers?.[palier]?.libelle ?? palier,
    aidePalier: (critere: string, palier: string): string =>
      traduction.criteres?.[critere]?.paliers?.[palier]?.aide ?? '',
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
  for (const facette of grille.facettes) {
    if (!traduction.facettes?.[facette.id]?.libelle) manquantes.push(`facettes.${facette.id}`)
  }
  for (const critere of grille.criteres) {
    const traduit = traduction.criteres?.[critere.id]
    if (!traduit?.libelle) manquantes.push(`criteres.${critere.id}`)
    for (const palier of critere.paliers) {
      if (!traduit?.paliers?.[palier.id]?.libelle) manquantes.push(`criteres.${critere.id}.paliers.${palier.id}`)
    }
  }
  return manquantes
}
