/**
 * Façons de résumer plusieurs valeurs en une.
 *
 * La moyenne n’est pas toujours la bonne réponse, et c’est particulièrement
 * vrai en remontant vers une rubrique ou vers la polarité générale :
 *
 * - une limite (« acceptance ») se résume mieux par le **minimum** : ce qui
 *   contraint, c’est le sujet le moins acceptable du lot, pas la moyenne ;
 * - une envie (« excitment ») ou une importance se résument mieux par le
 *   **maximum** : il suffit d’un sujet qui compte pour que la rubrique compte ;
 * - la **médiane** ignore un extrême isolé, là où la moyenne s’y accroche.
 *
 * Chaque fonction reçoit des valeurs déjà pondérées et rend un score 0..1.
 */

export type NomAgregateur = 'moyenne' | 'mediane' | 'min' | 'max' | 'somme' | 'produit'

export interface Contribution {
  score: number
  poids: number
}

const borne = (valeur: number): number => Math.min(Math.max(valeur, 0), 1)

const agregateurs: Record<NomAgregateur, (contributions: Contribution[]) => number> = {
  /** Pondérée : une source sûre pèse plus qu’une source héritée de loin. */
  moyenne: (contributions) => {
    const poids = contributions.reduce((total, contribution) => total + contribution.poids, 0)
    if (!poids) return 0
    return borne(contributions.reduce((total, c) => total + c.score * c.poids, 0) / poids)
  },
  mediane: (contributions) => {
    const scores = contributions.map((contribution) => contribution.score).sort((a, b) => a - b)
    const milieu = Math.floor(scores.length / 2)
    if (!scores.length) return 0
    return borne(scores.length % 2 ? scores[milieu]! : ((scores[milieu - 1]! + scores[milieu]!) / 2))
  },
  min: (contributions) => borne(Math.min(...contributions.map((contribution) => contribution.score))),
  max: (contributions) => borne(Math.max(...contributions.map((contribution) => contribution.score))),
  somme: (contributions) => borne(contributions.reduce((total, c) => total + c.score, 0)),
  produit: (contributions) => borne(contributions.reduce((total, c) => total * c.score, 1)),
}

export const NOMS_AGREGATEURS = Object.keys(agregateurs) as NomAgregateur[]

export function estAgregateur(nom: string): nom is NomAgregateur {
  return nom in agregateurs
}

/** Applique l’agrégateur demandé ; rend `null` s’il n’y a rien à résumer. */
export function agreger(nom: NomAgregateur, contributions: Contribution[]): number | null {
  if (!contributions.length) return null
  return agregateurs[nom](contributions)
}
