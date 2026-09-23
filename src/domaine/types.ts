import type { NomAgregateur } from './agregateurs.ts'

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

/** Comment résumer plusieurs valeurs, en descendant et en remontant. */
export interface Agregation {
  /** Combiner plusieurs sources d’héritage (plusieurs parents, ou les deux sens). */
  heritage?: NomAgregateur
  /** Déduire une rubrique de ses sous-nœuds, ou la polarité générale de ses polarités. */
  remontee?: NomAgregateur
}

/** Une part est une branche de l’étoile, avec sa propre échelle et son propre dégradé. */
export interface PartDefinition {
  id: string
  couleurMin: string
  couleurMax: string
  paliers: Palier[]
  /** Surcharge l’agrégation de la grille : une limite se résume par le minimum, une envie par le maximum. */
  agregation?: Agregation
}

/**
 * Une polarité est une étoile entière : la place depuis laquelle on répond.
 *
 * Elles forment un arbre, exactement comme les sujets. La polarité racine
 * (« général ») ne distingue pas les places : elle permet de dégrossir vite,
 * puis de préciser seulement là où les places divergent. L’héritage joue dans
 * les deux sens — le général descend vers les places, les places se résument
 * en général.
 */
export interface PolariteDefinition {
  id: string
  /** Polarité englobante ; absente pour la racine. */
  parent?: string
  /** Polarité ouverte par défaut à la saisie. */
  principale?: boolean
}

/** Un nœud : rubrique ou élément, c’est la même chose — seule la place dans le graphe diffère. */
export interface NoeudDefinition {
  id: string
  /** Sous-nœuds, pour écrire la hiérarchie par imbrication. */
  enfants?: NoeudDefinition[]
  /** Parents supplémentaires : un nœud peut relever de plusieurs rubriques. */
  parents?: string[]
  /**
   * Restreint les polarités applicables, **pour ce nœud et tout son sous-arbre**.
   * Les polarités englobantes sont conservées d’office : sans elles, on ne
   * pourrait plus dégrossir au-dessus du détail.
   */
  polarites?: string[]
  /** Restreint les parts applicables, pour ce nœud et tout son sous-arbre. */
  parts?: string[]
}

export interface GrilleDefinition {
  schemaVersion: 1
  id: string
  version: string
  langueParDefaut: string
  langues: Record<string, string>
  /**
   * Part du poids conservée à chaque niveau de descente dans les sujets.
   * Une réponse donnée sur une rubrique vaut pour ses sous-nœuds, mais moins
   * fort qu’une réponse donnée directement dessus : même score, poids moindre.
   */
  attenuation?: number
  /** Idem en descendant de la polarité générale vers les places particulières. */
  attenuationPolarite?: number
  /** Agrégation par défaut, surchargeable pour chaque part. */
  agregation?: Agregation
  polarites: PolariteDefinition[]
  parts: PartDefinition[]
  noeuds: NoeudDefinition[]
}

/** Libellés d’une langue, indexés par identifiant technique. */
export interface Traduction {
  titre: string
  intro?: string
  noeuds: Record<string, { libelle: string; aide?: string }>
  polarites: Record<string, { libelle: string; aide?: string }>
  parts: Record<string, { libelle: string; aide?: string; paliers: Record<string, { libelle: string; aide?: string }> }>
}

/** Réponse saisie sur un couple (nœud, polarité) : index de palier par part. */
export type Reponse = Record<string, number>

/** D’où vient une valeur affichée, ce qui change entièrement sa lecture. */
export type Origine = 'propre' | 'herite' | 'absent'

/** Valeur calculée d’une part : le score ne bouge pas en héritant, le poids si. */
export interface ValeurPart {
  score: number
  poids: number
  origine: Origine
}

/** Valeurs d’une étoile complète. */
export type ValeurPolarite = Record<string, ValeurPart>
