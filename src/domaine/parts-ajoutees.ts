import { identifiantAjout } from './ajouts.ts'
import type { GrilleDefinition, NoeudDefinition, PartDefinition, Traduction, TypeEchelle } from './types.ts'

/**
 * Les échelles qu’une personne ajoute à une grille.
 *
 * Une grille livrée qualifie ses sujets d’une certaine façon ; ce n’est pas
 * toujours la bonne pour tout le monde. On ajoute donc ses propres parts —
 * crans, tension entre deux extrêmes, ou triangle entre trois — sans toucher à
 * celles que tout le monde partage.
 *
 * Comme les sujets ajoutés, elles portent un identifiant préfixé `+` : une mise
 * à jour de la grille et les échelles de quelqu’un ne peuvent pas s’écraser.
 *
 * Elles peuvent ne concerner que certains sujets. C’est même l’usage principal :
 * une question particulière appelle souvent une façon de répondre particulière,
 * qui n’aurait aucun sens ailleurs.
 */
export interface PartAjoutee {
  id: string
  label: string
  help?: string
  kind: TypeEchelle
  minColor: string
  maxColor: string
  /** Les crans, pour une échelle à crans : du plus bas au plus haut. */
  steps?: { id: string; label: string; score: number }[]
  /** Les extrêmes, pour une tension (deux) ou un triangle (trois). */
  poles?: { id: string; label: string }[]
  /**
   * Sujets auxquels elle s’applique, leur sous-arbre compris.
   * Vide : elle s’applique partout.
   */
  nodes?: string[]
  creeLe: number
}

/** Ce qu’il faut savoir pour créer une échelle ; l’identifiant est dérivé du nom. */
export type EchelleAjoutee = Omit<PartAjoutee, 'id' | 'creeLe'>

/** Les identifiants qu’une échelle ajoutée occupe : elle-même, et ses branches de triangle. */
export function identifiantsDe(part: PartAjoutee): string[] {
  return [part.id, ...(part.kind === 'triangle' ? branches(part).map((branche) => branche.id) : [])]
}

/** Les trois branches d’un triangle ajouté, dérivées de ses extrêmes. */
function branches(part: PartAjoutee): { id: string; label: string }[] {
  return (part.poles ?? []).map((pole, index) => ({ id: `${part.id}-${index + 1}`, label: pole.label }))
}

/** Les définitions de parts qu’une échelle ajoutée produit. */
export function definitionsDe(part: PartAjoutee): PartDefinition[] {
  const commun = { minColor: part.minColor, maxColor: part.maxColor }

  if (part.kind === 'triangle') {
    const filles = branches(part)
    return [
      { id: part.id, kind: 'triangle', poles: filles.map((fille) => fille.id), ...commun },
      // Les trois branches ne se répondent pas une à une : le point les pose.
      ...filles.map((fille): PartDefinition => ({
        id: fille.id, parent: part.id, kind: 'continue', ...commun,
      })),
    ]
  }

  if (part.kind === 'tension') {
    return [{ id: part.id, kind: 'tension', poles: (part.poles ?? []).map((pole) => pole.id), ...commun }]
  }

  return [{
    id: part.id,
    ...commun,
    steps: (part.steps ?? []).map((cran) => ({ id: cran.id, score: cran.score })),
  }]
}

/**
 * Greffe des échelles sur une définition.
 *
 * Une part ne suffit pas à se retrouver dans une étoile : les nœuds déclarent
 * quelles parts les concernent, et une restriction existante l’exclurait.
 * On la pose donc explicitement sur les sujets visés — ou sur les racines,
 * quand elle vaut partout, puisque les restrictions se propagent au sous-arbre.
 */
export function augmenterDefinitionParts(
  definition: GrilleDefinition,
  parts: PartAjoutee[],
): GrilleDefinition {
  if (!parts.length) return definition

  const nouvelles = parts.flatMap(definitionsDe)
  const toutes = [...definition.parts, ...nouvelles]
  // Le défaut reste celui de la grille : une échelle ajoutée n’arrive que là où
  // on l’a posée, sans quoi viser un sujet ne restreindrait rien.
  const partsParDefaut = definition.parts.map((part) => part.id)

  const poserSur = new Map<string, string[]>()
  for (const part of parts) {
    const cibles = part.nodes?.length ? part.nodes : definition.nodes.map((noeud) => noeud.id)
    for (const cible of cibles) {
      poserSur.set(cible, [...(poserSur.get(cible) ?? []), ...identifiantsDe(part)])
    }
  }

  const parcourir = (noeud: NoeudDefinition, heritees: string[], racine = false): NoeudDefinition => {
    const effectives = noeud.parts ?? heritees
    const ajoutees = poserSur.get(noeud.id) ?? []
    const retenues = ajoutees.length ? [...new Set([...effectives, ...ajoutees])] : effectives
    return {
      ...noeud,
      // Toute racine devient explicite : sans restriction écrite, un nœud prend
      // *toutes* les parts déclarées, et les échelles ajoutées arriveraient
      // jusque sur les sujets qu’on n’avait pas visés.
      ...(racine || ajoutees.length || noeud.parts ? { parts: retenues } : {}),
      ...(noeud.children ? { children: noeud.children.map((enfant) => parcourir(enfant, retenues)) } : {}),
    }
  }

  return {
    ...definition,
    parts: toutes,
    nodes: definition.nodes.map((noeud) => parcourir(noeud, partsParDefaut, true)),
  }
}

/** Ajoute les libellés des échelles ajoutées à une traduction. */
export function augmenterTraductionParts(traduction: Traduction, ajoutees: PartAjoutee[]): Traduction {
  if (!ajoutees.length) return traduction
  const parts = { ...traduction.parts }
  for (const part of ajoutees) {
    parts[part.id] = {
      label: part.label,
      ...(part.help ? { help: part.help } : {}),
      ...(part.kind === 'steps'
        ? { steps: Object.fromEntries((part.steps ?? []).map((cran) => [cran.id, { label: cran.label }])) }
        : {}),
      ...(part.kind === 'tension'
        ? { poles: Object.fromEntries((part.poles ?? []).map((pole) => [pole.id, { label: pole.label }])) }
        : {}),
    }
    // Les sommets d’un triangle sont des parts : ils portent leur propre libellé.
    if (part.kind === 'triangle') {
      for (const branche of branches(part)) parts[branche.id] = { label: branche.label }
    }
  }
  return { ...traduction, parts }
}

/** Un identifiant d’échelle, préfixé comme celui d’un sujet ajouté. */
export function identifiantPart(label: string, pris: Iterable<string>): string {
  return identifiantAjout(label, pris)
}

/** Des crans écrits en toutes lettres, un par ligne, éventuellement suivis de leur score. */
export function lireCrans(texte: string): { id: string; label: string; score: number }[] {
  const lignes = texte.split('\n').map((ligne) => ligne.trim()).filter(Boolean)
  const lues = lignes.map((ligne) => {
    const separateur = ligne.lastIndexOf('|')
    const label = (separateur >= 0 ? ligne.slice(0, separateur) : ligne).trim()
    const score = separateur >= 0 ? Number(ligne.slice(separateur + 1).replace(',', '.').trim()) : Number.NaN
    return { label, score }
  }).filter((cran) => cran.label)

  const pris = new Set<string>()
  return lues.map((cran, index) => {
    let id = slug(cran.label) || `cran-${index + 1}`
    while (pris.has(id)) id = `${id}-${index + 1}`
    pris.add(id)
    // Sans score écrit, les crans se répartissent régulièrement : une échelle
    // irrégulière est un choix qui se déclare, pas un défaut.
    const score = Number.isFinite(cran.score)
      ? Math.min(1, Math.max(0, cran.score))
      : (lues.length > 1 ? index / (lues.length - 1) : 0)
    return { id, label: cran.label, score }
  })
}

/** Des extrêmes écrits un par ligne. */
export function lirePoles(texte: string): { id: string; label: string }[] {
  const pris = new Set<string>()
  return texte.split('\n').map((ligne) => ligne.trim()).filter(Boolean).map((label, index) => {
    let id = slug(label) || `pole-${index + 1}`
    while (pris.has(id)) id = `${id}-${index + 1}`
    pris.add(id)
    return { id, label }
  })
}

function slug(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
