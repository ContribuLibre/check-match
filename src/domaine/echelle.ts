import type { PartDefinition, PositionRepondue, ReponsePart, TypeEchelle, ZoneDefinition } from './types.ts'

/**
 * Lire une échelle, quelle que soit sa forme.
 *
 * Trois façons de répondre, un seul modèle de valeur : un score entre 0 et 1.
 * Des crans nommés, un curseur entre deux extrêmes, un point dans un triangle —
 * ce qui change est la saisie et la lecture, jamais ce qui circule ensuite.
 * L’héritage, les agrégateurs et les étoiles ne connaissent que le score.
 *
 * Ce que ces formes apportent en plus, c’est la **variabilité** : un curseur
 * peut dire l’étendue de ce qu’on a vécu, pas seulement son point moyen, et un
 * triangle peut dire de combien on s’écarte de son barycentre. C’est une
 * information à côté du score, jamais à sa place.
 */

export function typeEchelle(part: PartDefinition): TypeEchelle {
  return part.kind ?? 'steps'
}

/** Les crans d’une part, vide pour une échelle continue. */
export function paliers(part: PartDefinition) {
  return part.steps ?? []
}

const borne = (valeur: number): number => Math.min(1, Math.max(0, valeur))

/** Vrai si la réponse est une position et non l’index d’un cran. */
export function estPosition(reponse: ReponsePart | undefined): reponse is PositionRepondue {
  return typeof reponse === 'object' && reponse !== null
}

/**
 * Le score d’une réponse, ou `null` si elle ne veut rien dire pour cette part.
 *
 * Refuser plutôt que d’interpréter : une réponse à crans posée sur une tension
 * n’a aucune traduction évidente, et en inventer une ferait dire à quelqu’un ce
 * qu’il n’a pas dit.
 */
export function scoreDe(part: PartDefinition, reponse: ReponsePart | undefined): number | null {
  if (reponse === undefined) return null
  const kind = typeEchelle(part)
  if (typeof reponse === 'number') {
    if (kind !== 'steps') return null
    const palier = paliers(part)[reponse]
    return palier ? palier.score : null
  }
  if (kind === 'steps' || kind === 'triangle') return null
  if (typeof reponse.position === 'number') return borne(reponse.position)
  return null
}

/** Normalise des coordonnées barycentriques ; `null` si elles ne pèsent rien. */
export function normaliserBarycentre(brut: readonly number[]): [number, number, number] | null {
  const trois = [brut[0] ?? 0, brut[1] ?? 0, brut[2] ?? 0].map((valeur) => Math.max(0, valeur))
  const total = trois[0]! + trois[1]! + trois[2]!
  if (!(total > 0)) return null
  return [trois[0]! / total, trois[1]! / total, trois[2]! / total]
}

/**
 * Ce qu’un point de triangle dit de chacune de ses trois branches.
 *
 * C’est une répartition, mais une répartition **posée** : placer le point, c’est
 * dire les trois à la fois. Rien à voir avec la répartition par défaut d’une
 * part de regroupement, qui elle n’existe pas.
 */
export function composantesDuTriangle(
  part: PartDefinition,
  reponse: ReponsePart | undefined,
): Record<string, number> | null {
  if (typeEchelle(part) !== 'triangle' || !estPosition(reponse) || !reponse.barycentre) return null
  const poles = part.poles ?? []
  const normalise = normaliserBarycentre(reponse.barycentre)
  if (!normalise || poles.length !== 3) return null
  // Rapporté au maximum : un point sur un sommet donne 1 à cette branche, et
  // non un tiers. Ce qui compte est le relief entre les trois, pas leur somme.
  const sommet = Math.max(...normalise)
  return Object.fromEntries(poles.map((pole, index) => [pole, normalise[index]! / sommet]))
}

/** L’étendue déclarée, remise en ordre et bornée. */
export function etendueDe(reponse: ReponsePart | undefined): [number, number, number, number] | undefined {
  if (!estPosition(reponse) || !reponse.etendue) return undefined
  const quatre = reponse.etendue.slice(0, 4).map(borne)
  if (quatre.length < 4) return undefined
  const triees = [...quatre].sort((a, b) => a - b)
  return [triees[0]!, triees[1]!, triees[2]!, triees[3]!]
}

/**
 * Résume une série de positions en étendue : minimum, premier décile, dernier
 * décile, maximum. C’est ce qu’une rubrique peut déduire de ses éléments quand
 * chacun a été situé d’un simple curseur — la dispersion se lit alors d’un coup
 * d’œil, là où une moyenne seule l’aurait effacée.
 */
export function etendueDepuis(scores: number[]): [number, number, number, number] | undefined {
  if (scores.length < 2) return undefined
  const triees = [...scores].sort((a, b) => a - b)
  return [triees[0]!, quantile(triees, 0.1), quantile(triees, 0.9), triees[triees.length - 1]!]
}

/** Quantile par interpolation linéaire, comme une boîte à moustaches le demande. */
export function quantile(triees: number[], ratio: number): number {
  if (!triees.length) return 0
  const position = (triees.length - 1) * ratio
  const bas = Math.floor(position)
  const reste = position - bas
  return triees[bas]! * (1 - reste) + triees[Math.min(bas + 1, triees.length - 1)]! * reste
}

/**
 * La zone d’un triangle où tombe un point : celle du repère le plus proche.
 * Sans repères déclarés, le triangle n’est pas découpé et rien n’est nommé.
 */
export function zoneDe(zones: ZoneDefinition[] | undefined, barycentre: readonly number[]): string | null {
  const point = normaliserBarycentre(barycentre)
  if (!zones?.length || !point) return null
  let meilleure: string | null = null
  let distanceMin = Number.POSITIVE_INFINITY
  for (const zone of zones) {
    const repere = normaliserBarycentre(zone.position)
    if (!repere) continue
    // Distance dans le plan du triangle : les coordonnées barycentriques
    // normalisées y suffisent, puisque leur somme est constante.
    const distance = repere.reduce((total, valeur, index) => total + (valeur - point[index]!) ** 2, 0)
    if (distance < distanceMin) {
      distanceMin = distance
      meilleure = zone.id
    }
  }
  return meilleure
}
