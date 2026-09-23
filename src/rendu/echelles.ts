import type { PartDefinition, ValeurPart } from '../domaine/types.ts'
import { cellules, chemin, COTE, HAUTEUR, RAYON_MAX, SOMMETS, versXY, type Point } from './triangle.ts'

/**
 * Le dessin des échelles continues.
 *
 * Une tension se lit sur une règle : les deux extrêmes aux bouts, la position
 * entre eux. Si on a dit la variabilité, elle se pose dessus en boîte à
 * moustaches — le trait va du minimum au maximum, la boîte des premiers aux
 * derniers déciles, et le repère reste la position. Ce n’est pas un détail
 * décoratif : « ça dépend des fois » est une réponse, et souvent la vraie.
 *
 * Un triangle se lit d’un point. Les zones, quand la grille en déclare,
 * nomment l’endroit où l’on est tombé.
 */

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

const LARGEUR = 200
const HAUT = 44
/** La règle ne va pas d’un bord à l’autre : les extrêmes ont besoin de place. */
const MARGE = 10
const UTILE = LARGEUR - 2 * MARGE

const surLaRegle = (position: number): number => MARGE + Math.min(1, Math.max(0, position)) * UTILE

export interface OptionsTension {
  /** Montre la boîte à moustaches quand une étendue est connue. */
  etendue?: boolean
  titre?: string
}

/**
 * Une tension : la règle, le dégradé des deux extrêmes, la position, et
 * l’étendue si elle a été dite.
 */
export function tensionSvg(part: PartDefinition, valeur: ValeurPart | undefined, options: OptionsTension = {}): string {
  const { etendue = true, titre = '' } = options
  const id = `cm-tension-${part.id}`
  const milieu = HAUT / 2

  const regle = `<defs><linearGradient id="${echapper(id)}" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0%" stop-color="${echapper(part.minColor)}"/>`
    + `<stop offset="100%" stop-color="${echapper(part.maxColor)}"/>`
    + '</linearGradient></defs>'
    + `<rect class="regle" x="${MARGE}" y="${milieu - 5}" width="${UTILE}" height="10" rx="5"`
    + ` fill="url(#${echapper(id)})" fill-opacity=".35"/>`

  if (!valeur || valeur.poids <= 0) {
    return svg(`${regle}`, titre)
  }

  const x = surLaRegle(valeur.score)
  const moustaches = etendue && valeur.etendue ? boiteSvg(valeur.etendue, milieu) : ''
  const curseur = `<g class="curseur" opacity="${opacite(valeur.poids)}">`
    + `<line x1="${x}" y1="${milieu - 11}" x2="${x}" y2="${milieu + 11}"`
    + ` stroke="var(--trait, #000)" stroke-width="2"/>`
    + `<circle cx="${x}" cy="${milieu}" r="6" fill="${echapper(part.maxColor)}"`
    + ' stroke="var(--trait, #000)" stroke-width="1.2"/></g>'

  return svg(`${regle}${moustaches}${curseur}`, titre)
}

function boiteSvg([min, bas, haut, max]: [number, number, number, number], milieu: number): string {
  const xMin = surLaRegle(min)
  const xBas = surLaRegle(bas)
  const xHaut = surLaRegle(haut)
  const xMax = surLaRegle(max)
  return '<g class="moustaches" fill="none" stroke="var(--trait, #000)" stroke-width="1">'
    + `<line x1="${xMin}" y1="${milieu}" x2="${xMax}" y2="${milieu}"/>`
    + `<line x1="${xMin}" y1="${milieu - 7}" x2="${xMin}" y2="${milieu + 7}"/>`
    + `<line x1="${xMax}" y1="${milieu - 7}" x2="${xMax}" y2="${milieu + 7}"/>`
    + `<rect x="${xBas}" y="${milieu - 9}" width="${Math.max(0.5, xHaut - xBas)}" height="18" rx="3"`
    + ' fill="var(--trait, #000)" fill-opacity=".12"/></g>'
}

function svg(contenu: string, titre: string): string {
  return `<svg class="tension" viewBox="0 0 ${LARGEUR} ${HAUT}" role="img"`
    + ` aria-label="${echapper(titre)}">${contenu}</svg>`
}

export interface OptionsTriangle {
  /** Repères nommés, déjà traduits. */
  zones?: { id: string; point: Point; libelle: string }[]
  /** Zone où tombe le point courant, pour la mettre en avant. */
  zoneActive?: string | null
  /** Couleurs des trois sommets, dans l’ordre. */
  couleurs?: string[]
  titre?: string
}

/**
 * Un triangle : son contour, ses zones quand il y en a, le point posé et son
 * amplitude.
 *
 * L’amplitude est un cercle, pas une aire déformée : elle dit « autour d’ici,
 * à peu près comme ça » sans prétendre décrire une forme qu’on n’a pas saisie.
 */
export function triangleSvg(
  barycentre: readonly number[] | null,
  amplitude: number | undefined,
  options: OptionsTriangle = {},
): string {
  const { zones = [], zoneActive = null, couleurs = [], titre = '' } = options
  const contour = chemin(SOMMETS as Point[])

  const decoupe = zones.length
    ? `<g class="zones">${cellules(zones.map((zone) => zone.point)).map((cellule, index) => {
        const zone = zones[index]!
        return `<path class="zone${zone.id === zoneActive ? ' active' : ''}" data-zone="${echapper(zone.id)}"`
          + ` d="${chemin(cellule)}"><title>${echapper(zone.libelle)}</title></path>`
      }).join('')}</g>`
    : ''

  const coins = SOMMETS.map((sommet, index) =>
    `<circle cx="${sommet[0]}" cy="${sommet[1]}" r="4" fill="${echapper(couleurs[index] ?? 'var(--trait, #000)')}"/>`).join('')

  const point = barycentre ? versXY(barycentre) : null
  const pose = point
    ? `${amplitude ? `<circle class="amplitude" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}"`
        + ` r="${(amplitude * RAYON_MAX).toFixed(2)}"/>` : ''}`
      + `<circle class="barycentre" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}" r="5"/>`
    : ''

  return `<svg class="triangle" viewBox="-6 -6 ${COTE + 12} ${HAUTEUR + 12}" role="img"`
    + ` aria-label="${echapper(titre)}">`
    + `<path class="fond" d="${contour}"/>${decoupe}`
    + `<path class="bord" d="${contour}"/>${coins}${pose}</svg>`
}

/** Une valeur héritée reste visible : on ne descend pas sous un quart d’opacité. */
function opacite(poids: number): number {
  return Math.round((0.25 + 0.75 * Math.min(Math.max(poids, 0), 1)) * 100) / 100
}
