import { estAgregateur, type NomAgregateur } from './agregateurs.ts'
import type { Agregation, PartDefinition, GrilleDefinition, NoeudDefinition, PolariteDefinition } from './types.ts'

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
  polarites: string[]
  parts: string[]
}

export interface Polarite {
  id: string
  parent: string | null
  enfants: string[]
  niveau: number
  principale: boolean
}

export interface Grille {
  id: string
  version: string
  attenuation: number
  attenuationPolarite: number
  agregation: Required<Agregation>
  polarites: Map<string, Polarite>
  /** Polarités de la racine vers les feuilles : un parent arrive toujours avant ses enfants. */
  ordrePolarites: string[]
  polariteRacine: string
  parts: PartDefinition[]
  noeuds: Map<string, Noeud>
  racines: string[]
  ordre: string[]
  part(id: string): PartDefinition | undefined
  /** Agrégation applicable à une part, surcharge comprise. */
  agregationDe(partId: string, sens: keyof Agregation): NomAgregateur
}

export const ATTENUATION_PAR_DEFAUT = 0.5
export const AGREGATION_PAR_DEFAUT: Required<Agregation> = { inheritance: 'moyenne', rollup: 'moyenne' }

export class ErreurGrille extends Error {}

/**
 * Construit le graphe à partir de la définition.
 * Vérifie ce qui rendrait les calculs faux plus tard : identifiant répété,
 * parent inconnu, cycle, part ou polarité inexistants, agrégateur inconnu.
 */
export function construireGrille(definition: GrilleDefinition): Grille {
  const polarites = construirePolarites(definition.polarities, definition.id)
  const partsConnues = new Set(definition.parts.map((part) => part.id))
  if (!partsConnues.size) throw new ErreurGrille(`La grille « ${definition.id} » n’a aucune part.`)

  for (const part of definition.parts) verifierAgregation(part.aggregation, `${definition.id}/${part.id}`)
  verifierAgregation(definition.aggregation, definition.id)

  const noeuds = new Map<string, Noeud>()
  const polaritesParDefaut = [...polarites.keys()]
  const partsParDefaut = definition.parts.map((part) => part.id)

  /**
   * Les restrictions se propagent au sous-arbre : restreindre une rubrique aux
   * polarités qui la concernent n’aurait aucun sens si ses éléments les
   * rouvraient tous.
   */
  const aplatir = (defNoeud: NoeudDefinition, parent: string | undefined, heritees: {
    polarites: string[]
    parts: string[]
  }): void => {
    if (noeuds.has(defNoeud.id)) {
      throw new ErreurGrille(`Le nœud « ${defNoeud.id} » est défini deux fois.`)
    }
    for (const polarite of defNoeud.polarities ?? []) {
      if (!polarites.has(polarite)) {
        throw new ErreurGrille(`Le nœud « ${defNoeud.id} » cite la polarité inconnue « ${polarite} ».`)
      }
    }
    for (const part of defNoeud.parts ?? []) {
      if (!partsConnues.has(part)) {
        throw new ErreurGrille(`Le nœud « ${defNoeud.id} » cite la part inconnu « ${part} ».`)
      }
    }

    const polaritesNoeud = defNoeud.polarities
      ? avecAncetres(defNoeud.polarities, polarites)
      : heritees.polarites
    const partsNoeud = defNoeud.parts ?? heritees.parts

    noeuds.set(defNoeud.id, {
      id: defNoeud.id,
      parents: [...(parent ? [parent] : []), ...(defNoeud.parents ?? [])],
      enfants: [],
      niveau: 0,
      polarites: polaritesNoeud,
      parts: partsNoeud,
    })
    for (const enfant of defNoeud.children ?? []) {
      aplatir(enfant, defNoeud.id, { polarites: polaritesNoeud, parts: partsNoeud })
    }
  }
  for (const racine of definition.nodes) {
    aplatir(racine, undefined, { polarites: polaritesParDefaut, parts: partsParDefaut })
  }

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

  const parPart = new Map(definition.parts.map((part) => [part.id, part]))
  const agregation = { ...AGREGATION_PAR_DEFAUT, ...definition.aggregation }
  const racinePolarite = [...polarites.values()].find((polarite) => !polarite.parent)

  return {
    id: definition.id,
    version: definition.version,
    attenuation: definition.attenuation ?? ATTENUATION_PAR_DEFAUT,
    attenuationPolarite: definition.polarityAttenuation ?? ATTENUATION_PAR_DEFAUT,
    agregation,
    polarites,
    ordrePolarites: [...polarites.keys()],
    polariteRacine: racinePolarite?.id ?? '',
    parts: definition.parts,
    noeuds,
    racines,
    ordre,
    part: (id) => parPart.get(id),
    agregationDe: (partId, sens) => parPart.get(partId)?.aggregation?.[sens] ?? agregation[sens],
  }
}

function verifierAgregation(agregation: Agregation | undefined, ou: string): void {
  for (const [sens, nom] of Object.entries(agregation ?? {})) {
    if (nom && !estAgregateur(nom)) {
      throw new ErreurGrille(`${ou} : agrégateur « ${nom} » inconnu pour « ${sens} ».`)
    }
  }
}

/**
 * Les polarités forment un arbre, dont la racine est la polarité générale.
 * Elle est obligatoire : c’est elle qui permet de répondre sans distinguer les
 * places, et sans elle l’héritage entre polarités n’a pas de point de départ.
 */
function construirePolarites(definitions: PolariteDefinition[], grilleId: string): Map<string, Polarite> {
  if (!definitions?.length) throw new ErreurGrille(`La grille « ${grilleId} » n’a aucune polarité.`)

  const polarites = new Map<string, Polarite>()
  for (const definition of definitions) {
    if (polarites.has(definition.id)) {
      throw new ErreurGrille(`La polarité « ${definition.id} » est définie deux fois.`)
    }
    polarites.set(definition.id, {
      id: definition.id,
      parent: definition.parent ?? null,
      enfants: [],
      niveau: 0,
      principale: definition.primary ?? false,
    })
  }

  const racines = [...polarites.values()].filter((polarite) => !polarite.parent)
  if (racines.length !== 1) {
    throw new ErreurGrille(
      `La grille « ${grilleId} » doit avoir exactement une polarité générale (sans parent), ${racines.length} trouvée(s).`,
    )
  }

  for (const polarite of polarites.values()) {
    if (!polarite.parent) continue
    const parent = polarites.get(polarite.parent)
    if (!parent) throw new ErreurGrille(`La polarité « ${polarite.id} » cite le parent inconnu « ${polarite.parent} ».`)
    parent.enfants.push(polarite.id)
  }

  // Ordre de la racine vers les feuilles, en refusant les cycles.
  const ordonnees = new Map<string, Polarite>()
  const file = [racines[0]!.id]
  while (file.length) {
    const id = file.shift()!
    const polarite = polarites.get(id)!
    polarite.niveau = polarite.parent ? (ordonnees.get(polarite.parent)?.niveau ?? 0) + 1 : 0
    ordonnees.set(id, polarite)
    file.push(...polarite.enfants)
  }
  if (ordonnees.size !== polarites.size) {
    const bloquees = [...polarites.keys()].filter((id) => !ordonnees.has(id))
    throw new ErreurGrille(`Polarités inatteignables depuis la générale : ${bloquees.join(', ')}.`)
  }
  return ordonnees
}

/** Ajoute les polarités englobantes : sans elles, plus moyen de dégrossir. */
function avecAncetres(choisies: string[], polarites: Map<string, Polarite>): string[] {
  const retenues = new Set<string>()
  for (const id of choisies) {
    let courant: string | null = id
    while (courant && !retenues.has(courant)) {
      retenues.add(courant)
      courant = polarites.get(courant)?.parent ?? null
    }
  }
  return [...polarites.keys()].filter((id) => retenues.has(id))
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

/** Toutes les polarités sous une polarité donnée. */
export function sousPolarites(grille: Grille, id: string): string[] {
  const vues: string[] = []
  const file = [...(grille.polarites.get(id)?.enfants ?? [])]
  while (file.length) {
    const courant = file.shift()
    if (courant === undefined) continue
    vues.push(courant)
    file.push(...(grille.polarites.get(courant)?.enfants ?? []))
  }
  return vues
}
