import { paliers, typeEchelle } from './echelle.ts'
import type { Grille } from './grille.ts'
import type { PartDefinition, Traduction } from './types.ts'

/**
 * Accès aux libellés.
 *
 * Les identifiants techniques sont dans la structure, les textes dans les
 * fichiers de langue : traduire une grille n’oblige donc jamais à toucher aux
 * identifiants, et les réponses restent valables d’une langue à l’autre.
 *
 * ## Une traduction partielle est la règle, pas l’exception
 *
 * Une grille de deux cents entrées ne sera jamais traduite d’un bloc. Un
 * libellé manquant retombe donc sur la **langue par défaut de la grille**, et
 * seulement en tout dernier ressort sur l’identifiant technique. On lit ainsi
 * une grille à moitié traduite sans tomber sur des `soiree-dansante` au milieu
 * du texte, et sans qu’une traduction entamée bloque quoi que ce soit.
 */
export function creerTextes(traduction: Traduction, parDefaut: Traduction = traduction) {
  const premier = (...candidats: (string | undefined)[]): string | undefined =>
    candidats.find((candidat) => candidat !== undefined && candidat !== '')

  return {
    titre: premier(traduction.title, parDefaut.title) ?? '',
    intro: premier(traduction.intro, parDefaut.intro) ?? '',

    noeud: (id: string): string =>
      premier(traduction.nodes?.[id]?.label, parDefaut.nodes?.[id]?.label) ?? id,
    aideNoeud: (id: string): string =>
      premier(traduction.nodes?.[id]?.help, parDefaut.nodes?.[id]?.help) ?? '',

    polarite: (id: string): string =>
      premier(traduction.polarities?.[id]?.label, parDefaut.polarities?.[id]?.label) ?? id,
    aidePolarite: (id: string): string =>
      premier(traduction.polarities?.[id]?.help, parDefaut.polarities?.[id]?.help) ?? '',

    part: (id: string): string =>
      premier(traduction.parts?.[id]?.label, parDefaut.parts?.[id]?.label) ?? id,
    aidePart: (id: string): string =>
      premier(traduction.parts?.[id]?.help, parDefaut.parts?.[id]?.help) ?? '',

    palier: (part: string, palier: string): string =>
      premier(
        traduction.parts?.[part]?.steps?.[palier]?.label,
        parDefaut.parts?.[part]?.steps?.[palier]?.label,
      ) ?? palier,
    aidePalier: (part: string, palier: string): string =>
      premier(
        traduction.parts?.[part]?.steps?.[palier]?.help,
        parDefaut.parts?.[part]?.steps?.[palier]?.help,
      ) ?? '',

    pole: (part: string, pole: string): string =>
      premier(traduction.parts?.[part]?.poles?.[pole]?.label, parDefaut.parts?.[part]?.poles?.[pole]?.label) ?? pole,
    aidePole: (part: string, pole: string): string =>
      premier(traduction.parts?.[part]?.poles?.[pole]?.help, parDefaut.parts?.[part]?.poles?.[pole]?.help) ?? '',

    zone: (part: string, zone: string): string =>
      premier(traduction.parts?.[part]?.zones?.[zone]?.label, parDefaut.parts?.[part]?.zones?.[zone]?.label) ?? zone,
    aideZone: (part: string, zone: string): string =>
      premier(traduction.parts?.[part]?.zones?.[zone]?.help, parDefaut.parts?.[part]?.zones?.[zone]?.help) ?? '',
  }
}

export type Textes = ReturnType<typeof creerTextes>

/**
 * Ce qu’une traduction ne couvre pas.
 *
 * On cherche l’absence de clé, et non un libellé égal à son identifiant :
 * « unknown » est une traduction parfaitement valable du palier `unknown`.
 *
 * Le résultat n’est une erreur que pour la langue par défaut d’une grille —
 * c’est elle qui sert de repli, donc elle doit être complète. Pour les autres,
 * c’est une mesure de couverture, pas un reproche.
 */
export function clesManquantes(grille: Grille, traduction: Traduction): string[] {
  const manquantes: string[] = []
  if (!traduction.title) manquantes.push('title')

  for (const id of grille.noeuds.keys()) {
    if (!traduction.nodes?.[id]?.label) manquantes.push(`nodes.${id}`)
  }
  for (const polarite of grille.polarites.values()) {
    if (!traduction.polarities?.[polarite.id]?.label) manquantes.push(`polarities.${polarite.id}`)
  }
  for (const part of grille.parts) {
    const traduit = traduction.parts?.[part.id]
    if (!traduit?.label) manquantes.push(`parts.${part.id}`)
    for (const cle of clesEchelle(part)) {
      const [section, id] = cle
      if (!traduit?.[section]?.[id]?.label) manquantes.push(`parts.${part.id}.${section}.${id}`)
    }
  }
  return manquantes
}

/**
 * Ce qu’une part demande de traduire en plus de son propre libellé : ses crans,
 * ou les extrêmes et les repères de son échelle continue. Un triangle fait
 * exception pour ses sommets, qui sont ses branches et portent déjà leur nom.
 */
function clesEchelle(part: PartDefinition): ['steps' | 'poles' | 'zones', string][] {
  const cles: ['steps' | 'poles' | 'zones', string][] = []
  for (const palier of paliers(part)) cles.push(['steps', palier.id])
  if (typeEchelle(part) === 'tension') for (const pole of part.poles ?? []) cles.push(['poles', pole])
  for (const zone of part.zones ?? []) cles.push(['zones', zone.id])
  return cles
}

/** Part des clés effectivement traduites, entre 0 et 1. */
export function couverture(grille: Grille, traduction: Traduction): number {
  const total = 1
    + grille.noeuds.size
    + grille.polarites.size
    + grille.parts.length
    + grille.parts.reduce((somme, part) => somme + clesEchelle(part).length, 0)
  return total ? (total - clesManquantes(grille, traduction).length) / total : 1
}
