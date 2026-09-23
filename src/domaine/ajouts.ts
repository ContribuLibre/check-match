import type { GrilleDefinition, NoeudDefinition, Traduction } from './types.ts'

/**
 * Sujets ajoutés par une personne à une grille livrée.
 *
 * Une grille ne peut pas tout prévoir : chaque lieu, chaque relation a ses
 * sujets à elle. On les ajoute donc sans toucher à la grille d’origine, qui
 * reste celle que tout le monde partage — c’est ce qui permet de continuer à se
 * comparer sur ce qu’on a en commun.
 *
 * Un ajout porte son libellé avec lui : il n’a pas de fichier de langue, et son
 * texte vaut pour toutes les langues. Traduire ses propres ajouts n’aurait pas
 * de sens tant qu’on ne les partage pas.
 */
export interface NoeudAjoute {
  id: string
  label: string
  help?: string
  /** Rubriques auxquelles il se rattache ; vide = sujet de premier niveau. */
  parents: string[]
  /**
   * Polarités et parts qui le concernent. Absentes, celles de la grille
   * s’appliquent — c’est le cas courant, et c’est ce qui garde un ajout
   * comparable au reste. Les préciser sert aux sujets qui ne se posent que
   * d’une place, ou qui ne se qualifient que d’une façon.
   */
  polarities?: string[]
  parts?: string[]
  creeLe: number
}

/** Ce qu’il faut savoir pour créer un sujet ; l’identifiant, lui, est dérivé. */
export type SujetAjoute = Omit<NoeudAjoute, 'id' | 'creeLe'>

/** Ajouts d’une personne, rangés par grille. */
export type Ajouts = Record<string, NoeudAjoute[]>

export function identifiantAjout(label: string, pris: Iterable<string>): string {
  const base = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sujet'
  const existants = new Set(pris)
  // Préfixé : un ajout ne doit jamais se confondre avec un sujet livré, même
  // s’ils portent le même nom — sinon une mise à jour de la grille écraserait
  // silencieusement le sujet ajouté, ou l’inverse.
  let candidat = `+${base}`
  let suffixe = 2
  while (existants.has(candidat)) candidat = `+${base}-${suffixe++}`
  return candidat
}

/** Vrai si ce nœud vient de la personne et non de la grille livrée. */
export function estAjoute(id: string): boolean {
  return id.startsWith('+')
}

/**
 * Greffe les ajouts sur une définition de grille.
 *
 * Les ajouts arrivent comme des nœuds de premier niveau portant leurs parents :
 * c’est le même mécanisme que celui des sujets relevant de plusieurs rubriques,
 * donc rien de particulier à prévoir dans la construction du graphe.
 */
export function augmenterDefinition(
  definition: GrilleDefinition,
  ajouts: NoeudAjoute[],
): GrilleDefinition {
  if (!ajouts.length) return definition
  const connus = new Set<string>()
  const recenser = (noeuds: NoeudDefinition[]): void => {
    for (const noeud of noeuds) {
      connus.add(noeud.id)
      recenser(noeud.children ?? [])
    }
  }
  recenser(definition.nodes)

  // Un parent disparu d’une mise à jour de la grille ne doit pas empêcher de
  // charger : l’ajout remonte alors au premier niveau plutôt que de tout casser.
  const noeuds: NoeudDefinition[] = ajouts.map((ajout) => ({
    id: ajout.id,
    parents: ajout.parents.filter((parent) => connus.has(parent) || ajouts.some((autre) => autre.id === parent)),
    ...(ajout.polarities?.length ? { polarities: ajout.polarities } : {}),
    ...(ajout.parts?.length ? { parts: ajout.parts } : {}),
  }))

  return { ...definition, nodes: [...definition.nodes, ...noeuds] }
}

/** Ajoute les libellés des sujets ajoutés à une traduction. */
export function augmenterTraduction(traduction: Traduction, ajouts: NoeudAjoute[]): Traduction {
  if (!ajouts.length) return traduction
  const nodes = { ...traduction.nodes }
  for (const ajout of ajouts) {
    nodes[ajout.id] = { label: ajout.label, ...(ajout.help ? { help: ajout.help } : {}) }
  }
  return { ...traduction, nodes }
}
