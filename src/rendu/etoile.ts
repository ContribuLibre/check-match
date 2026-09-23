/**
 * Géométrie pure de l’étoile : aucune dépendance au DOM, donc testable telle
 * quelle et réutilisable pour un export.
 *
 * Chaque critère possède un secteur angulaire, dessiné en pointe :
 * centre → bord gauche à mi-rayon → pointe → bord droit à mi-rayon.
 * Les secteurs sont à angle fixe, donc un critère est toujours à la même place
 * et deux étoiles se comparent d’un coup d’œil.
 */

const TOUR = Math.PI * 2

/** Part du rayon conservée par une réponse au plus bas : sans ça, elle disparaîtrait. */
export const PORTEE_MINIMALE = 0.25

const arrondi = (valeur: number): number => Math.round(valeur * 1000) / 1000
const polaire = (angle: number, portee: number): Point => ({
  x: arrondi(Math.cos(angle) * portee),
  y: arrondi(Math.sin(angle) * portee),
})

export interface Point {
  x: number
  y: number
}

export interface Secteur {
  index: number
  direction: number
  /** Le secteur à pleine taille : l’emplacement, qu’il soit rempli ou non. */
  piste: Point[]
  /** Le secteur à la taille de la réponse ; vide si rien n’est renseigné. */
  remplissage: Point[]
  pointe: Point
  portee: number
}

/** Valeur d’une branche telle que le rendu la consomme. */
export interface BrancheValeur {
  /** 0..1, ou null si rien ne renseigne cette branche. */
  score: number | null
  /** 0..1 : 1 pour une réponse directe, moins pour une valeur héritée. */
  poids: number
}

export function porteeBranche(score: number): number {
  return PORTEE_MINIMALE + score * (1 - PORTEE_MINIMALE)
}

/**
 * @param valeurs une par critère, dans l’ordre des branches
 * @param taille  diamètre du dessin
 */
export function geometrieEtoile(
  valeurs: BrancheValeur[],
  { taille = 100, rotation = -Math.PI / 2 } = {},
): { branches: number; rayon: number; ouverture: number; secteurs: Secteur[] } {
  if (!valeurs.length) throw new TypeError('Une étoile a besoin d’au moins une branche.')
  const rayon = taille / 2
  const ouverture = TOUR / valeurs.length

  const secteurs = valeurs.map((valeur, index) => {
    const direction = rotation + ouverture * index
    const renseigne = valeur.score !== null && valeur.poids > 0
    const score = renseigne ? Math.min(Math.max(valeur.score ?? 0, 0), 1) : 0
    const portee = porteeBranche(score) * rayon

    const piste = [
      { x: 0, y: 0 },
      polaire(direction - ouverture / 2, rayon / 2),
      polaire(direction, rayon),
      polaire(direction + ouverture / 2, rayon / 2),
    ]

    // Une réponse au plus bas perd sa pointe : elle ne doit pas se lire comme
    // une petite réponse positive. Rien de renseigné ne dessine rien du tout.
    const remplissage = !renseigne
      ? []
      : score === 0
        ? [{ x: 0, y: 0 }, polaire(direction - ouverture / 2, portee / 2), polaire(direction + ouverture / 2, portee / 2)]
        : [
          { x: 0, y: 0 },
          polaire(direction - ouverture / 2, portee / 2),
          polaire(direction, portee),
          polaire(direction + ouverture / 2, portee / 2),
        ]

    return { index, direction, piste, remplissage, pointe: polaire(direction, portee), portee: arrondi(portee) }
  })

  return { branches: valeurs.length, rayon, ouverture, secteurs }
}

/**
 * Dégradés des secteurs, en unités de boîte englobante.
 * Chaque dégradé suit la direction de son secteur, du centre vers la pointe.
 */
export function degradesEtoile(branches: number, { rotation = -Math.PI / 2 } = {}): {
  index: number
  x1: number
  y1: number
  x2: number
  y2: number
}[] {
  const ouverture = TOUR / branches
  return Array.from({ length: branches }, (_, index) => {
    const pointe = polaire(rotation + ouverture * index, 1)
    return {
      index,
      x1: Math.max(0, -pointe.x),
      y1: Math.max(0, -pointe.y),
      x2: Math.max(0, pointe.x),
      y2: Math.max(0, pointe.y),
    }
  })
}

export function pointsSvg(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ')
}
