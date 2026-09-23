import type { CritereDefinition, ValeurFacette } from '../domaine/types.ts'
import { degradesEtoile, geometrieEtoile, pointsSvg, type BrancheValeur } from './etoile.ts'

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

/** Identifiant stable d’un dégradé : partagé par toutes les étoiles d’une même grille. */
export function idDegrade(grilleId: string, critereId: string, branches: number): string {
  return `cm-${grilleId}-${critereId}-${branches}`
}

/** Bloc `<defs>` à poser une seule fois dans la page plutôt que dans chaque étoile. */
export function degradesSvg(grilleId: string, criteres: CritereDefinition[]): string {
  const degrades = degradesEtoile(criteres.length)
  const contenu = criteres.map((critere, index) => {
    const position = degrades[index]
    if (!position) return ''
    return `<linearGradient id="${echapper(idDegrade(grilleId, critere.id, criteres.length))}"`
      + ` x1="${position.x1}" y1="${position.y1}" x2="${position.x2}" y2="${position.y2}">`
      + `<stop offset="0%" stop-color="${echapper(critere.couleurMin)}"/>`
      + `<stop offset="100%" stop-color="${echapper(critere.couleurMax)}"/>`
      + '</linearGradient>'
  }).join('')
  return `<defs>${contenu}</defs>`
}

export interface OptionsEtoile {
  taille?: number
  /** Les dégradés sont-ils déjà posés ailleurs dans la page ? */
  degradesExternes?: boolean
  titre?: string
}

/**
 * Une étoile en SVG.
 *
 * Le poids d’une valeur se lit dans son opacité : une réponse directe est
 * pleine, une valeur héritée d’une rubrique est d’autant plus pâle qu’elle
 * vient de loin. Même score, présence moindre — exactement ce que le poids dit.
 */
export function etoileSvg(
  grilleId: string,
  criteres: CritereDefinition[],
  valeurs: ValeurFacette,
  options: OptionsEtoile = {},
): string {
  const { taille = 100, degradesExternes = false, titre = '' } = options
  const branches: BrancheValeur[] = criteres.map((critere) => {
    const valeur = valeurs[critere.id]
    return { score: valeur && valeur.poids > 0 ? valeur.score : null, poids: valeur?.poids ?? 0 }
  })
  const { secteurs } = geometrieEtoile(branches, { taille })
  const trait = taille * 0.008
  const marge = taille * 0.02
  const etendue = taille / 2 + marge

  const pistes = secteurs.map((secteur, index) => {
    const critere = criteres[index]
    if (!critere) return ''
    const points = pointsSvg(secteur.piste)
    // Dégradé puis voile : l’emplacement vide reste lisible sans concurrencer
    // la réponse posée par-dessus. Le voile suit le fond de la page.
    return `<polygon class="piste" points="${points}"`
      + ` fill="url(#${echapper(idDegrade(grilleId, critere.id, criteres.length))})"/>`
      + `<polygon points="${points}" fill="var(--voile, #fff)" fill-opacity="var(--voile-opacite, .8)"/>`
  }).join('')

  const remplissages = secteurs.map((secteur, index) => {
    const critere = criteres[index]
    if (!critere || !secteur.remplissage.length) return ''
    const poids = branches[index]?.poids ?? 1
    return `<polygon class="reponse" data-critere="${echapper(critere.id)}"`
      + ` points="${pointsSvg(secteur.remplissage)}" fill="${echapper(critere.couleurMax)}"`
      + ` fill-opacity="${arrondiOpacite(poids)}"/>`
  }).join('')

  const contours = secteurs.map((secteur) =>
    `<polygon class="contour" points="${pointsSvg(secteur.piste)}" fill="none"`
    + ` stroke="var(--trait, #000)" stroke-width="${trait}"/>`).join('')

  const defs = degradesExternes ? '' : degradesSvg(grilleId, criteres)
  return `<svg class="etoile" viewBox="${-etendue} ${-etendue} ${etendue * 2} ${etendue * 2}"`
    + ` role="img" aria-label="${echapper(titre)}">${defs}${pistes}${remplissages}${contours}</svg>`
}

/** Une valeur héritée reste visible : on ne descend pas sous un quart d’opacité. */
function arrondiOpacite(poids: number): number {
  const opacite = 0.25 + 0.75 * Math.min(Math.max(poids, 0), 1)
  return Math.round(opacite * 100) / 100
}
