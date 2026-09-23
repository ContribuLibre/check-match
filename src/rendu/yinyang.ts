import { porteeBranche, PORTEE_MINIMALE } from './etoile.ts'

/**
 * Deux parts qui vont ensemble sans se contredire.
 *
 * Une étoile à deux branches ne se lit pas : deux pointes opposées, et rien
 * qui dise qu’elles se répondent. Le yin et le yang, si — ce qu’on **reçoit**
 * d’un côté, ce qu’on **fait** de l’autre. Être sensible au bruit et en faire
 * peu, y être indifférent et en faire beaucoup : ce sont quatre situations
 * différentes, et c’est exactement ce que la figure montre.
 *
 * Les deux moitiés sont **indépendantes** : contrairement au triangle, rien ne
 * se normalise ici. Chacune pousse depuis le centre à la hauteur de son score,
 * comme une branche d’étoile.
 */

export const RAYON = 100

/** Le repère est centré ; `y` descend, comme partout en SVG. */
export type Moitie = 'yin' | 'yang'

/**
 * Dans quelle moitié tombe un point.
 *
 * La frontière n’est pas un diamètre : c’est le S formé par les deux petits
 * cercles. La même règle sert au dessin (par masque) et à la saisie, donc ce
 * qu’on touche est exactement ce qu’on voit.
 */
export function moitieDe(x: number, y: number, rayon = RAYON): Moitie {
  if (Math.hypot(x, y + rayon / 2) <= rayon / 2) return 'yang'
  if (Math.hypot(x, y - rayon / 2) <= rayon / 2) return 'yin'
  return x >= 0 ? 'yang' : 'yin'
}

/**
 * Le score que dit un point : sa distance au centre.
 * En deçà de la portée minimale, c’est zéro — et zéro reste une réponse, qui
 * garde son petit disque plutôt que de disparaître.
 */
export function scoreDepuis(x: number, y: number, rayon = RAYON): number {
  const portee = Math.min(1, Math.hypot(x, y) / rayon)
  return Math.min(1, Math.max(0, (portee - PORTEE_MINIMALE) / (1 - PORTEE_MINIMALE)))
}

export interface MoitieValeur {
  /** 0..1, ou null si rien ne renseigne cette moitié. */
  score: number | null
  /** 0..1 : 1 pour une réponse posée, moins pour une valeur héritée. */
  poids: number
  couleur: string
  libelle: string
}

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

/**
 * Les masques des deux moitiés, construits de cercles et de rectangles plutôt
 * que d’arcs : la forme est alors la traduction directe de `moitieDe`, et les
 * deux ne peuvent pas diverger.
 */
function masques(id: string, rayon: number): string {
  const demi = rayon / 2
  const cadre = `<rect x="${-rayon}" y="${-rayon}" width="${rayon * 2}" height="${rayon * 2}"`
  const moitie = (yang: boolean): string => {
    const dedans = yang ? '#fff' : '#000'
    const dehors = yang ? '#000' : '#fff'
    return `<mask id="${echapper(id)}-${yang ? 'yang' : 'yin'}">
      ${cadre} fill="${dehors}"/>
      <rect x="0" y="${-rayon}" width="${rayon}" height="${rayon * 2}" fill="${dedans}"/>
      <circle cx="0" cy="${-demi}" r="${demi}" fill="${dedans}"/>
      <circle cx="0" cy="${demi}" r="${demi}" fill="${dehors}"/>
    </mask>`
  }
  return `<defs>${moitie(true)}${moitie(false)}</defs>`
}

export interface OptionsYinYang {
  taille?: number
  titre?: string
  /** Identifiant unique dans la page : deux figures ne doivent pas partager leurs masques. */
  id?: string
}

/**
 * La figure : deux moitiés en attente, et ce qui les remplit.
 *
 * La piste pâle montre la place de chaque moitié même vide — on voit ainsi
 * qu’il y a quelque chose à répondre. Les deux yeux restent toujours dessinés :
 * sans eux, la figure n’est plus reconnaissable.
 */
export function yinYangSvg(
  yin: MoitieValeur,
  yang: MoitieValeur,
  { taille = 120, titre = '', id = 'cm-yy' }: OptionsYinYang = {},
): string {
  const rayon = RAYON
  const marge = rayon * 0.04
  const etendue = rayon + marge

  const moitie = (valeur: MoitieValeur, nom: Moitie): string => {
    const masque = `mask="url(#${echapper(id)}-${nom})"`
    const piste = `<circle cx="0" cy="0" r="${rayon}" fill="${echapper(valeur.couleur)}" fill-opacity=".16" ${masque}/>`
    if (valeur.score === null || valeur.poids <= 0) return piste
    const portee = porteeBranche(Math.min(1, Math.max(0, valeur.score))) * rayon
    return piste
      + `<circle class="remplissage" data-moitie="${nom}" cx="0" cy="0" r="${portee.toFixed(2)}"`
      + ` fill="${echapper(valeur.couleur)}" fill-opacity="${opacite(valeur.poids)}" ${masque}/>`
  }

  const demi = rayon / 2
  const yeux = `<circle class="oeil" cx="0" cy="${-demi}" r="${rayon / 7}" fill="${echapper(yin.couleur)}" fill-opacity=".8"/>`
    + `<circle class="oeil" cx="0" cy="${demi}" r="${rayon / 7}" fill="${echapper(yang.couleur)}" fill-opacity=".8"/>`

  return `<svg class="yinyang" viewBox="${-etendue} ${-etendue} ${etendue * 2} ${etendue * 2}"`
    + ` width="${taille}" height="${taille}" role="img" aria-label="${echapper(titre)}">`
    + masques(id, rayon)
    + moitie(yin, 'yin') + moitie(yang, 'yang')
    + yeux
    + `<circle class="bord" cx="0" cy="0" r="${rayon}" fill="none"/>`
    + `<path class="frontiere" fill="none" d="M0,${-rayon} A${demi},${demi} 0 0 1 0,0 A${demi},${demi} 0 0 0 0,${rayon}"/>`
    + '</svg>'
}

/** Une valeur héritée reste visible : on ne descend pas sous un quart d’opacité. */
function opacite(poids: number): number {
  return Math.round((0.25 + 0.75 * Math.min(Math.max(poids, 0), 1)) * 100) / 100
}
