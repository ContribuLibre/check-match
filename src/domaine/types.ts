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
 * Un repère nommé d’un triangle : « ici, c’est ceci ».
 *
 * `position` est barycentrique, normalisée à la lecture : `[1, 0, 0]` est un
 * sommet, `[1, 1, 1]` le centre. Les repères découpent le triangle en autant de
 * zones qu’il y en a — chaque point appartient à la zone du repère le plus
 * proche. Sans repères, le triangle n’est pas découpé.
 */
export interface ZoneDefinition {
  id: string
  position: [number, number, number]
}

/**
 * Comment une part se répond.
 *
 * - `steps` : des crans nommés. C’est le défaut, et ce qui se compare le mieux.
 * - `tension` : un curseur entre deux extrêmes, continu. On peut y ajouter
 *   l’étendue de ce qu’on a vécu, pas seulement son point moyen.
 * - `triangle` : un barycentre entre trois extrêmes. Une part de regroupement à
 *   trois branches se saisit alors d’un point plutôt que branche par branche.
 * - `yinyang` : deux parts qui vont ensemble sans se contredire — ce qu’on
 *   reçoit d’un côté, ce qu’on fait de l’autre. Les deux moitiés sont
 *   indépendantes : rien ne s’y normalise, contrairement au triangle.
 * - `continue` : un score entre 0 et 1 qu’on ne saisit pas directement. C’est
 *   ce que sont les branches d’un triangle : le point les renseigne toutes les
 *   trois, et les demander une à une n’aurait pas de sens.
 *
 * Le type ne change rien au modèle : une valeur reste un score entre 0 et 1,
 * avec son poids. Seules la saisie et la lecture diffèrent.
 */
export type TypeEchelle = 'steps' | 'tension' | 'triangle' | 'yinyang' | 'continue'

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
  /** Défaut : `steps`. */
  kind?: TypeEchelle
  /**
   * Les crans d’une échelle `steps`. Une tension ou un triangle n’en a pas
   * besoin : ils sont continus.
   */
  steps?: Palier[]
  /**
   * Les extrêmes d’une tension (deux), d’un triangle (trois) ou d’un yin-yang
   * (deux). Pour un triangle comme pour un yin-yang, ils désignent les parts
   * filles, dans l’ordre — le yin d’abord, le yang ensuite.
   */
  poles?: string[]
  /** Repères nommés d’un triangle. */
  zones?: ZoneDefinition[]
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
  parts: Record<string, {
    label: string
    help?: string
    /** Les crans, pour une échelle à crans. */
    steps?: Record<string, { label: string; help?: string }>
    /**
     * Les extrêmes d’une tension. Un triangle n’en a pas besoin : ses sommets
     * sont ses branches, et portent déjà leur libellé de part.
     */
    poles?: Record<string, { label: string; help?: string }>
    /** Les repères nommés d’un triangle. */
    zones?: Record<string, { label: string; help?: string }>
  }>
}

/**
 * Ce qu’on a posé sur une part qui ne se répond pas par un cran.
 *
 * Une position seule suffit à répondre. L’étendue et l’amplitude disent en plus
 * la variabilité : selon les cas, selon les jours, ce n’est pas toujours pareil,
 * et ça vaut la peine de pouvoir le dire plutôt que de moyenner en silence.
 */
export interface PositionRepondue {
  /** Position sur une tension, 0 au premier extrême, 1 au second. */
  position?: number
  /** Position dans un triangle, en coordonnées barycentriques (normalisées à la lecture). */
  barycentre?: [number, number, number]
  /** Étendue vécue autour de la position : minimum, premier décile, dernier décile, maximum. */
  etendue?: [number, number, number, number]
  /** Amplitude autour d’un barycentre, en part du rayon du triangle. */
  amplitude?: number
}

/**
 * Réponse posée sur une part : l’index d’un cran, ou une position.
 *
 * Le nombre reste accepté tel quel — c’est la forme qu’ont toutes les réponses
 * déjà enregistrées, et la seule qui ait du sens pour une échelle à crans.
 */
export type ReponsePart = number | PositionRepondue

/** Réponse saisie sur un couple (nœud, polarité), part par part. */
export type Reponse = Record<string, ReponsePart>

/** D’où vient une valeur affichée, ce qui change entièrement sa lecture. */
export type Origine = 'propre' | 'herite' | 'absent'

/** Valeur calculée d’une part : le score ne bouge pas en héritant, le poids si. */
export interface ValeurPart {
  score: number
  poids: number
  origine: Origine
  /**
   * Variabilité autour du score, quand elle a été dite ou déduite.
   * Quatre bornes : minimum, premier décile, dernier décile, maximum.
   */
  etendue?: [number, number, number, number]
  /** Amplitude autour d’un barycentre, pour une part saisie dans un triangle. */
  amplitude?: number
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
