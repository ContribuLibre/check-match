import type { Grille } from './grille.ts'
import { etoile, type Valeurs } from './heritage.ts'
import type { ValeurPart } from './types.ts'

/**
 * Comparer deux personnes sur une même grille.
 *
 * Deux façons de s’accorder, et elles ne se valent pas :
 *
 * - **se ressembler** : on veut la même chose, on est d’accord ;
 * - **se répondre** : l’un aime faire ce que l’autre aime recevoir, l’un est
 *   sensible à ce dont l’autre s’occupe. C’est mieux que se ressembler, parce
 *   que deux personnes qui veulent toutes les deux *faire* se disputent la
 *   tâche, et deux qui veulent toutes les deux *recevoir* attendent que
 *   quelqu’un s’y colle.
 *
 * La grille déclare qui répond à qui (`reciprocal`). Sans réciproque déclarée,
 * il ne reste que la ressemblance — et c’est très bien : tous les sujets ne se
 * partagent pas en rôles.
 *
 * Rien n’est comparé qui ne soit renseigné des **deux** côtés. Un profil à
 * moitié rempli se compare donc sur sa moitié, et le poids de la comparaison
 * dit à quel point elle s’appuie sur quelque chose.
 */

/** Ce qu’une complémentarité gagne sur une simple ressemblance de même écart. */
export const PRIME_COMPLEMENTARITE = 0.25

/** Ce qu’une comparaison pèse au minimum, même sur un sujet indifférent. */
const PLANCHER_IMPORTANCE = 0.1

export interface AccordPart {
  part: string
  /** Accord moyen pondéré, 0..1. */
  accord: number
  /** À quel point la comparaison s’appuie sur du renseigné. */
  poids: number
  /** Nombre de couples (sujet, place) réellement comparés. */
  comparaisons: number
  /** Le plus petit et le plus grand écart observés entre les deux personnes. */
  ecartMin: number
  ecartMax: number
  /** Part des accords où c’est la complémentarité qui l’a emporté. */
  complementarite: number
}

export interface Accord {
  /** Accord d’ensemble, 0..1 ; `null` si rien n’est comparable. */
  global: number | null
  poids: number
  comparaisons: number
  parts: AccordPart[]
}

/** Moyenne des valeurs d’une personne sur une part, pondérée par leur poids. */
export function niveauMoyen(grille: Grille, valeurs: Valeurs, partId: string): number | null {
  let somme = 0
  let poids = 0
  for (const noeud of grille.noeuds.values()) {
    for (const polarite of noeud.polarites) {
      const valeur = etoile(valeurs, noeud.id, polarite)[partId]
      if (!valeur || valeur.poids <= 0) continue
      somme += valeur.score * valeur.poids
      poids += valeur.poids
    }
  }
  return poids > 0 ? somme / poids : null
}

/** Un accord complémentaire vaut mieux qu’une ressemblance de même écart. */
function prime(accord: number): number {
  return accord + (1 - accord) * PRIME_COMPLEMENTARITE
}

/**
 * Combien ce sujet pèse pour l’un ou pour l’autre.
 * On prend le **maximum** des deux : si c’est vital pour l’un, le désaccord
 * compte, même si l’autre s’en moque — c’est justement là que ça coince.
 */
function poidsDuSujet(
  grille: Grille,
  a: Valeurs,
  b: Valeurs,
  noeud: string,
  polarite: string,
  weightBy: string | undefined,
): number {
  if (!weightBy) return 1
  const importance = Math.max(
    etoile(a, noeud, polarite)[weightBy]?.score ?? 0,
    etoile(b, noeud, polarite)[weightBy]?.score ?? 0,
  )
  return PLANCHER_IMPORTANCE + (1 - PLANCHER_IMPORTANCE) * importance
}

export function comparer(grille: Grille, a: Valeurs, b: Valeurs, weightBy?: string): Accord {
  const parts: AccordPart[] = []
  let sommeGlobale = 0
  let poidsGlobal = 0
  let comparaisonsGlobales = 0

  for (const partId of grille.partsFeuilles) {
    // La part qui sert à pondérer n’est pas elle-même un critère d’accord :
    // elle dit ce qui compte, pas ce qu’on veut.
    if (partId === weightBy) continue
    const reciproquePart = grille.part(partId)?.reciprocal

    let somme = 0
    let poids = 0
    let comparaisons = 0
    let complementaires = 0
    let ecartMin = Number.POSITIVE_INFINITY
    let ecartMax = 0

    for (const noeud of grille.noeuds.values()) {
      if (!noeud.parts.includes(partId)) continue
      for (const polarite of noeud.polarites) {
        const valA = etoile(a, noeud.id, polarite)[partId]
        const valB = etoile(b, noeud.id, polarite)[partId]
        if (!valA || !valB || valA.poids <= 0 || valB.poids <= 0) continue

        // Quand les places ou les parts se répondent, c’est la **réponse**
        // qu’on mesure, pas la ressemblance : deux personnes qui veulent
        // toutes les deux faire, et aucune recevoir, ne s’accordent pas — elles
        // se disputent la tâche. Retenir le meilleur des deux lectures
        // gonflerait tous les scores en choisissant toujours la plus flatteuse.
        const croises = [...croisements(grille, a, b, noeud, polarite, partId, reciproquePart)]
        const parComplementarite = croises.length > 0
        const accord = parComplementarite
          ? prime(croises.reduce((total, valeur) => total + valeur, 0) / croises.length)
          : 1 - Math.abs(valA.score - valB.score)

        const importance = poidsDuSujet(grille, a, b, noeud.id, polarite, weightBy)
        const contribution = Math.min(valA.poids, valB.poids) * importance
        somme += accord * contribution
        poids += contribution
        comparaisons += 1
        if (parComplementarite) complementaires += 1
        const ecart = Math.abs(valA.score - valB.score)
        ecartMin = Math.min(ecartMin, ecart)
        ecartMax = Math.max(ecartMax, ecart)
      }
    }

    if (!comparaisons) continue
    parts.push({
      part: partId,
      accord: poids > 0 ? somme / poids : 0,
      poids,
      comparaisons,
      ecartMin: ecartMin === Number.POSITIVE_INFINITY ? 0 : ecartMin,
      ecartMax,
      complementarite: complementaires / comparaisons,
    })
    sommeGlobale += somme
    poidsGlobal += poids
    comparaisonsGlobales += comparaisons
  }

  return {
    global: poidsGlobal > 0 ? sommeGlobale / poidsGlobal : null,
    poids: poidsGlobal,
    comparaisons: comparaisonsGlobales,
    parts,
  }
}

/** Une valeur réellement posée, et non héritée d’ailleurs. */
const posee = (valeur: ValeurPart | undefined): valeur is ValeurPart =>
  !!valeur && valeur.poids > 0 && valeur.origine === 'propre'

/**
 * Les accords obtenus en croisant les places, ou les parts, qui se répondent.
 *
 * Il faut que **les quatre** valeurs aient été posées. Un général répondu
 * descend sur toutes les places : les croiser reviendrait à comparer une
 * réponse avec elle-même, et à distribuer une prime de complémentarité à
 * quelqu’un qui n’a jamais distingué le faire du recevoir.
 */
function* croisements(
  grille: Grille,
  a: Valeurs,
  b: Valeurs,
  noeud: { id: string; polarites: string[]; parts: string[] },
  polarite: string,
  partId: string,
  reciproquePart: string | undefined,
): Generator<number> {
  const reciproquePolarite = grille.polarites.get(polarite)?.reciproque
  if (reciproquePolarite && reciproquePolarite !== polarite && noeud.polarites.includes(reciproquePolarite)) {
    const versLui = etoile(b, noeud.id, reciproquePolarite)[partId]
    const versElle = etoile(a, noeud.id, reciproquePolarite)[partId]
    const ici = { a: etoile(a, noeud.id, polarite)[partId], b: etoile(b, noeud.id, polarite)[partId] }
    // Dans les deux sens : ce que l’un veut faire contre ce que l’autre veut
    // recevoir, et l’inverse. Les deux doivent tenir pour que ça se réponde.
    if (posee(versLui) && posee(versElle) && posee(ici.a) && posee(ici.b)) {
      yield ((1 - Math.abs(ici.a.score - versLui.score)) + (1 - Math.abs(versElle.score - ici.b.score))) / 2
    }
  }

  if (reciproquePart && reciproquePart !== partId && noeud.parts.includes(reciproquePart)) {
    const chezLui = etoile(b, noeud.id, polarite)[reciproquePart]
    const chezElle = etoile(a, noeud.id, polarite)[reciproquePart]
    const ici = { a: etoile(a, noeud.id, polarite)[partId], b: etoile(b, noeud.id, polarite)[partId] }
    if (posee(chezLui) && posee(chezElle) && posee(ici.a) && posee(ici.b)) {
      yield ((1 - Math.abs(ici.a.score - chezLui.score)) + (1 - Math.abs(chezElle.score - ici.b.score))) / 2
    }
  }
}

/**
 * Range les profils pour que les voisins se ressemblent.
 *
 * On part de la paire la plus proche, puis on allonge la chaîne par les deux
 * bouts, en prenant à chaque fois le profil le plus proche d’une extrémité. Ce
 * n’est pas l’ordre optimal — le trouver serait un problème de voyageur de
 * commerce — mais il place côte à côte ce qui se ressemble, ce qui est tout ce
 * qu’on demande à des colonnes.
 */
export function ordonnerParProximite(
  ids: string[],
  accordEntre: (a: string, b: string) => number | null,
): string[] {
  if (ids.length < 3) return [...ids]
  const note = (a: string, b: string): number => accordEntre(a, b) ?? -1

  let depart: [string, string] = [ids[0]!, ids[1]!]
  let meilleur = -Infinity
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue
      const valeur = note(a, b)
      if (valeur > meilleur) {
        meilleur = valeur
        depart = [a, b]
      }
    }
  }

  const chaine = [...depart]
  const restants = new Set(ids.filter((id) => !chaine.includes(id)))
  while (restants.size) {
    let choisi = ''
    let auDebut = false
    let score = -Infinity
    for (const candidat of restants) {
      const versDebut = note(candidat, chaine[0]!)
      const versFin = note(candidat, chaine[chaine.length - 1]!)
      if (versDebut > score) { score = versDebut; choisi = candidat; auDebut = true }
      if (versFin > score) { score = versFin; choisi = candidat; auDebut = false }
    }
    restants.delete(choisi)
    if (auDebut) chaine.unshift(choisi)
    else chaine.push(choisi)
  }
  return chaine
}

/** Les écarts extrêmes observés sur chaque part, tous couples confondus. */
export function ecartsParPart(accords: Accord[]): Map<string, { min: number; max: number }> {
  const ecarts = new Map<string, { min: number; max: number }>()
  for (const accord of accords) {
    for (const part of accord.parts) {
      const deja = ecarts.get(part.part)
      ecarts.set(part.part, deja
        ? { min: Math.min(deja.min, part.ecartMin), max: Math.max(deja.max, part.ecartMax) }
        : { min: part.ecartMin, max: part.ecartMax })
    }
  }
  return ecarts
}
