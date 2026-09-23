import type { CritereDefinition, FacetteDefinition, GrilleDefinition, NoeudDefinition } from './types.ts'

/**
 * Un nœud mis à plat, avec ses liens résolus dans les deux sens.
 * L’imbrication YAML n’est qu’une façon d’écrire ; ce qui compte ensuite est
 * le graphe, car un nœud peut relever de plusieurs rubriques.
 */
export interface Noeud {
  id: string
  parents: string[]
  enfants: string[]
  /** Profondeur minimale depuis une racine, utilisée pour l’affichage. */
  niveau: number
  facettes: string[]
  criteres: string[]
}

export interface Grille {
  id: string
  version: string
  attenuation: number
  facettes: FacetteDefinition[]
  criteres: CritereDefinition[]
  noeuds: Map<string, Noeud>
  /** Nœuds sans parent. */
  racines: string[]
  /** Ordre topologique : un nœud arrive toujours après tous ses parents. */
  ordre: string[]
  critere(id: string): CritereDefinition | undefined
}

export const ATTENUATION_PAR_DEFAUT = 0.5

export class ErreurGrille extends Error {}

/**
 * Construit le graphe à partir de la définition.
 * Vérifie ce qui rendrait les calculs faux plus tard : identifiant répété,
 * parent inconnu, cycle, critère ou facette inexistants.
 */
export function construireGrille(definition: GrilleDefinition): Grille {
  const facettesConnues = new Set(definition.facettes.map((facette) => facette.id))
  const criteresConnus = new Set(definition.criteres.map((critere) => critere.id))
  if (!facettesConnues.size) throw new ErreurGrille(`La grille « ${definition.id} » n’a aucune facette.`)
  if (!criteresConnus.size) throw new ErreurGrille(`La grille « ${definition.id} » n’a aucun critère.`)

  const noeuds = new Map<string, Noeud>()
  const facettesParDefaut = definition.facettes.map((facette) => facette.id)
  const criteresParDefaut = definition.criteres.map((critere) => critere.id)

  const aplatir = (defNoeud: NoeudDefinition, parent: string | undefined): void => {
    if (noeuds.has(defNoeud.id)) {
      throw new ErreurGrille(`Le nœud « ${defNoeud.id} » est défini deux fois.`)
    }
    for (const facette of defNoeud.facettes ?? []) {
      if (!facettesConnues.has(facette)) {
        throw new ErreurGrille(`Le nœud « ${defNoeud.id} » cite la facette inconnue « ${facette} ».`)
      }
    }
    for (const critere of defNoeud.criteres ?? []) {
      if (!criteresConnus.has(critere)) {
        throw new ErreurGrille(`Le nœud « ${defNoeud.id} » cite le critère inconnu « ${critere} ».`)
      }
    }
    noeuds.set(defNoeud.id, {
      id: defNoeud.id,
      parents: [...(parent ? [parent] : []), ...(defNoeud.parents ?? [])],
      enfants: [],
      niveau: 0,
      facettes: defNoeud.facettes ?? facettesParDefaut,
      criteres: defNoeud.criteres ?? criteresParDefaut,
    })
    for (const enfant of defNoeud.enfants ?? []) aplatir(enfant, defNoeud.id)
  }
  for (const racine of definition.noeuds) aplatir(racine, undefined)

  // Liens retour, une fois tous les nœuds connus : un parent déclaré par
  // `parents:` peut apparaître plus loin dans le fichier.
  for (const noeud of noeuds.values()) {
    const parentsUniques = [...new Set(noeud.parents)]
    noeud.parents = parentsUniques
    for (const parent of parentsUniques) {
      const cible = noeuds.get(parent)
      if (!cible) throw new ErreurGrille(`Le nœud « ${noeud.id} » cite le parent inconnu « ${parent} ».`)
      if (!cible.enfants.includes(noeud.id)) cible.enfants.push(noeud.id)
    }
  }

  const racines = [...noeuds.values()].filter((noeud) => !noeud.parents.length).map((noeud) => noeud.id)
  const ordre = trierTopologiquement(noeuds)
  for (const id of ordre) {
    const noeud = noeuds.get(id)
    if (!noeud) continue
    noeud.niveau = noeud.parents.length
      ? Math.min(...noeud.parents.map((parent) => (noeuds.get(parent)?.niveau ?? 0) + 1))
      : 0
  }

  const parCritere = new Map(definition.criteres.map((critere) => [critere.id, critere]))
  return {
    id: definition.id,
    version: definition.version,
    attenuation: definition.attenuation ?? ATTENUATION_PAR_DEFAUT,
    facettes: definition.facettes,
    criteres: definition.criteres,
    noeuds,
    racines,
    ordre,
    critere: (id) => parCritere.get(id),
  }
}

/**
 * Ordre topologique (Kahn). Un cycle rendrait l’héritage insoluble : on refuse
 * plutôt que de boucler ou de produire des valeurs qui dépendent de l’ordre de
 * lecture du fichier.
 */
function trierTopologiquement(noeuds: Map<string, Noeud>): string[] {
  const restants = new Map<string, number>()
  for (const noeud of noeuds.values()) restants.set(noeud.id, noeud.parents.length)

  const file = [...restants.entries()].filter(([, reste]) => reste === 0).map(([id]) => id)
  const ordre: string[] = []
  while (file.length) {
    const id = file.shift()
    if (id === undefined) break
    ordre.push(id)
    for (const enfant of noeuds.get(id)?.enfants ?? []) {
      const reste = (restants.get(enfant) ?? 0) - 1
      restants.set(enfant, reste)
      if (reste === 0) file.push(enfant)
    }
  }

  if (ordre.length !== noeuds.size) {
    const bloques = [...noeuds.keys()].filter((id) => !ordre.includes(id))
    throw new ErreurGrille(`Cycle de parenté entre : ${bloques.join(', ')}.`)
  }
  return ordre
}

/** Tous les descendants d’un nœud, sans doublon même en cas de parents multiples. */
export function descendants(grille: Grille, id: string): string[] {
  const vus = new Set<string>()
  const file = [...(grille.noeuds.get(id)?.enfants ?? [])]
  while (file.length) {
    const courant = file.shift()
    if (courant === undefined || vus.has(courant)) continue
    vus.add(courant)
    file.push(...(grille.noeuds.get(courant)?.enfants ?? []))
  }
  return [...vus]
}
