import { normaliserBarycentre } from '../domaine/echelle.ts'

/**
 * Géométrie d’un triangle de positionnement.
 *
 * Trois extrêmes, un point entre eux : c’est la façon de se situer quand aucune
 * des trois n’est un « plus » ou un « moins » de l’autre, mais bien trois
 * directions. Les coordonnées barycentriques disent exactement ça — combien on
 * penche vers chacune — et se normalisent d’elles-mêmes.
 *
 * Le repère est celui du SVG : `y` vers le bas, sommet en haut.
 */

export type Point = readonly [number, number]

export const COTE = 200
export const HAUTEUR = COTE * Math.sqrt(3) / 2

/** Les trois sommets, dans l’ordre des composantes barycentriques. */
export const SOMMETS: readonly Point[] = [
  [COTE / 2, 0],
  [0, HAUTEUR],
  [COTE, HAUTEUR],
]

/** Barycentre normalisé vers un point du plan. */
export function versXY(barycentre: readonly number[]): Point | null {
  const normalise = normaliserBarycentre(barycentre)
  if (!normalise) return null
  let x = 0
  let y = 0
  for (const [index, poids] of normalise.entries()) {
    x += SOMMETS[index]![0] * poids
    y += SOMMETS[index]![1] * poids
  }
  return [x, y]
}

/** L’inverse : un point du plan vers ses trois composantes, bornées au triangle. */
export function versBarycentre(point: Point): [number, number, number] {
  const [a, b, c] = SOMMETS as [Point, Point, Point]
  const denominateur = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
  const u = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / denominateur
  const v = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / denominateur
  const brut = [u, v, 1 - u - v].map((valeur) => Math.max(0, valeur))
  return normaliserBarycentre(brut) ?? [1 / 3, 1 / 3, 1 / 3]
}

/**
 * Découpe un polygone convexe par le demi-plan des points plus proches de `ici`
 * que de `autre` : la médiatrice des deux, du bon côté.
 *
 * C’est tout ce qu’il faut pour un diagramme de Voronoï à quelques points —
 * l’intersection de ces demi-plans est exactement la cellule. Inutile de
 * trianguler pour sept repères.
 */
function couperParMediatrice(polygone: Point[], ici: Point, autre: Point): Point[] {
  const milieu: Point = [(ici[0] + autre[0]) / 2, (ici[1] + autre[1]) / 2]
  const normale: Point = [ici[0] - autre[0], ici[1] - autre[1]]
  const duBonCote = (point: Point): number =>
    (point[0] - milieu[0]) * normale[0] + (point[1] - milieu[1]) * normale[1]

  const garde: Point[] = []
  for (const [index, point] of polygone.entries()) {
    const suivant = polygone[(index + 1) % polygone.length]!
    const ici2 = duBonCote(point)
    const la = duBonCote(suivant)
    if (ici2 >= 0) garde.push(point)
    if ((ici2 >= 0) !== (la >= 0)) {
      const ratio = ici2 / (ici2 - la)
      garde.push([
        point[0] + (suivant[0] - point[0]) * ratio,
        point[1] + (suivant[1] - point[1]) * ratio,
      ])
    }
  }
  return garde
}

/** Les cellules de Voronoï de quelques repères, découpées dans un contour. */
export function cellules(reperes: Point[], contour: Point[] = SOMMETS as Point[]): Point[][] {
  return reperes.map((repere) => {
    let cellule = [...contour]
    for (const autre of reperes) {
      if (autre === repere) continue
      cellule = couperParMediatrice(cellule, repere, autre)
      if (!cellule.length) break
    }
    return cellule
  })
}

export function chemin(polygone: Point[]): string {
  if (!polygone.length) return ''
  const [depart, ...suite] = polygone
  return `M${arrondi(depart!)}${suite.map((point) => `L${arrondi(point)}`).join('')}Z`
}

const arrondi = (point: Point): string => `${point[0].toFixed(2)},${point[1].toFixed(2)}`

/**
 * Le rayon maximal utile pour une amplitude : au-delà, le cercle sort du
 * triangle de toute façon. On prend le rayon du cercle inscrit, qui est la
 * plus grande amplitude qui garde un sens depuis le centre.
 */
export const RAYON_MAX = HAUTEUR / 3

/** L’amplitude, entre 0 et 1, correspondant à une distance en unités du plan. */
export function amplitudeDepuis(distance: number): number {
  return Math.min(1, Math.max(0, distance / RAYON_MAX))
}
