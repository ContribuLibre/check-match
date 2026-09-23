/**
 * Une grille décrit *quoi* est demandé, jamais comment c’est répondu :
 * les réponses vivent dans le stockage, indexées par identifiant de nœud.
 * Deux grilles qui partagent un nœud partagent donc ses réponses.
 */

/** Un cran d’une échelle. `score` est volontairement irrégulier : l’écart entre deux crans n’est pas constant. */
export interface Palier {
  id: string
  score: number
}

/** Un critère est une branche de l’étoile, avec sa propre échelle et son propre dégradé. */
export interface CritereDefinition {
  id: string
  couleurMin: string
  couleurMax: string
  paliers: Palier[]
}

/**
 * Une facette est une étoile entière.
 * Un même sujet se vit de plusieurs places : le faire, le recevoir, y assister.
 * Ces places n’ont aucune raison d’avoir les mêmes réponses.
 */
export interface FacetteDefinition {
  id: string
  /** Facette proposée par défaut à la saisie ; les autres restent accessibles. */
  principale?: boolean
}

/** Un nœud : rubrique ou élément, c’est la même chose — seule la place dans le graphe diffère. */
export interface NoeudDefinition {
  id: string
  /** Sous-nœuds, pour écrire la hiérarchie par imbrication. */
  enfants?: NoeudDefinition[]
  /** Parents supplémentaires : un nœud peut relever de plusieurs rubriques. */
  parents?: string[]
  /** Restreint les facettes applicables ; par défaut celles de la grille. */
  facettes?: string[]
  /** Restreint les critères applicables ; par défaut ceux de la grille. */
  criteres?: string[]
}

export interface GrilleDefinition {
  schemaVersion: 1
  id: string
  version: string
  langueParDefaut: string
  langues: Record<string, string>
  /**
   * Part du poids conservée à chaque niveau de descente.
   * Une réponse donnée sur une rubrique vaut pour ses sous-nœuds, mais moins
   * fort qu’une réponse donnée directement dessus : même score, poids moindre.
   */
  attenuation?: number
  facettes: FacetteDefinition[]
  criteres: CritereDefinition[]
  noeuds: NoeudDefinition[]
}

/** Libellés d’une langue, indexés par identifiant technique. */
export interface Traduction {
  titre: string
  intro?: string
  noeuds: Record<string, { libelle: string; aide?: string }>
  facettes: Record<string, { libelle: string; aide?: string }>
  criteres: Record<string, { libelle: string; aide?: string; paliers: Record<string, { libelle: string; aide?: string }> }>
}

/** Réponse saisie sur un couple (nœud, facette) : index de palier par critère. */
export type Reponse = Record<string, number>

/** D’où vient une valeur affichée, ce qui change entièrement sa lecture. */
export type Origine = 'propre' | 'herite' | 'absent'

/** Valeur calculée d’un critère : le score ne bouge pas en héritant, le poids si. */
export interface ValeurCritere {
  score: number
  poids: number
  origine: Origine
}

/** Valeurs d’une étoile complète. */
export type ValeurFacette = Record<string, ValeurCritere>
