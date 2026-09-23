import type { NomAgregateur } from './agregateurs.ts'

/**
 * Forme des données telles qu’elles sont écrites dans les fichiers.
 *
 * Les **clés sont en anglais** : une grille est une donnée destinée à circuler,
 * à être reprise et traduite hors de ce dépôt. Le code qui les manipule reste
 * en français, comme le reste du projet.
 *
 * Une grille décrit *quoi* est demandé, jamais comment c’est répondu : les
 * réponses vivent dans le stockage, indexées par identifiant de nœud. Deux
 * grilles qui partagent un nœud partagent donc ses réponses.
 */

/** Un cran d’une échelle. `score` est volontairement irrégulier : l’écart entre deux crans n’est pas constant. */
export interface Palier {
  id: string
  score: number
}

/** Comment résumer plusieurs valeurs, en descendant et en remontant. */
export interface Agregation {
  /** Combiner plusieurs sources d’héritage (plusieurs parents, ou les deux directions). */
  inheritance?: NomAgregateur
  /** Déduire une rubrique de ses sous-nœuds, ou la polarité générale de ses polarités. */
  rollup?: NomAgregateur
}

/**
 * Une part est une branche de l’étoile, avec sa propre échelle et son propre dégradé.
 *
 * Les parts peuvent elles aussi former un arbre. Une part de regroupement — une
 * part « générale » — permet de cocher vite un sujet sans détailler chaque
 * branche. Elle ne se dessine pas : seules les feuilles sont des branches.
 */
export interface PartDefinition {
  id: string
  /** Part englobante. Absent = part de premier niveau. */
  parent?: string
  minColor: string
  maxColor: string
  steps: Palier[]
  /** Surcharge l’agrégation de la grille : une limite se résume par le minimum, une envie par le maximum. */
  aggregation?: Agregation
  /**
   * Comment une valeur posée ici se répartit sur les parts filles, facteur de
   * poids par part.
   *
   * Sans `spread`, une part de regroupement **ne descend nulle part** : il n’y a
   * pas de répartition qui aille de soi. Dire « j’aime bien » en général ne dit
   * pas si c’est l’envie, l’acceptation ou l’expérience qui est visée — c’est à
   * la grille de le déclarer. Une part absente de la répartition reste non
   * renseignée, ce qui permet de viser une seule branche.
   */
  spread?: Record<string, number>
}

/**
 * Une polarité est une étoile entière : la place depuis laquelle on répond.
 *
 * Elles forment un arbre, exactement comme les sujets. La polarité racine
 * (« général ») ne distingue pas les places : elle permet de dégrossir vite,
 * puis de préciser seulement là où les places divergent. L’héritage joue dans
 * les deux directions — le général descend vers les places, les places se
 * résument en général.
 */
export interface PolariteDefinition {
  id: string
  /** Polarité englobante ; absente pour la racine. */
  parent?: string
  /** Polarité ouverte par défaut à la saisie. */
  primary?: boolean
}

/** Un nœud : rubrique ou élément, c’est la même chose — seule la place dans le graphe diffère. */
export interface NoeudDefinition {
  id: string
  /** Sous-nœuds, pour écrire la hiérarchie par imbrication. */
  children?: NoeudDefinition[]
  /** Parents supplémentaires : un nœud peut relever de plusieurs rubriques. */
  parents?: string[]
  /**
   * Restreint les polarités applicables, **pour ce nœud et tout son sous-arbre**.
   * Les polarités englobantes sont conservées d’office : sans elles, on ne
   * pourrait plus dégrossir au-dessus du détail.
   */
  polarities?: string[]
  /** Restreint les parts applicables, pour ce nœud et tout son sous-arbre. */
  parts?: string[]
}

export interface GrilleDefinition {
  schemaVersion: 1
  id: string
  version: string
  defaultLocale: string
  locales: Record<string, string>
  /**
   * Part du poids conservée à chaque niveau de descente dans les sujets.
   * Une réponse donnée sur une rubrique vaut pour ses sous-nœuds, mais moins
   * fort qu’une réponse donnée directement dessus : même score, poids moindre.
   */
  attenuation?: number
  /** Idem en descendant de la polarité générale vers les places particulières. */
  polarityAttenuation?: number
  /** Agrégation par défaut, surchargeable pour chaque part. */
  aggregation?: Agregation
  polarities: PolariteDefinition[]
  parts: PartDefinition[]
  nodes: NoeudDefinition[]
}

/** Libellés d’une langue, indexés par identifiant technique. */
export interface Traduction {
  title: string
  intro?: string
  nodes: Record<string, { label: string; help?: string }>
  polarities: Record<string, { label: string; help?: string }>
  parts: Record<string, { label: string; help?: string; steps: Record<string, { label: string; help?: string }> }>
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
  /**
   * Nombre de changements de dimension traversés pour obtenir cette valeur.
   *
   * Descendre dans les sujets ne compte pas : c’est l’héritage naturel, celui
   * qui dit le plus. Changer de polarité ou de part compte pour un détour.
   * Aimer *recevoir* une chose en dit long sur le fait d’en recevoir une autre
   * de la même catégorie, et beaucoup moins sur l’envie d’en *produire*.
   */
  detours: number
}

/** Valeurs d’une étoile complète. */
export type ValeurPolarite = Record<string, ValeurPart>
