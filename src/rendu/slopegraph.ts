/**
 * Comparer des profils, métrique par métrique.
 *
 * Une colonne par personne, une bande par métrique, un point par personne dans
 * chaque bande à la hauteur de son niveau, et un trait entre voisins. Un trait
 * **plat** dit que ça s’accorde, un trait **pentu** que ça diverge — on lit
 * donc d’un coup d’œil où ça coince, sans avoir à comparer des chiffres.
 *
 * Les rubans d’un Sankey n’apporteraient rien ici : les métriques se
 * correspondent une à une d’une colonne à l’autre, donc rien ne se croise. Ce
 * qui porte l’information, c’est la pente.
 */

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

export interface LigneComparee {
  part: string
  libelle: string
  couleur: string
  /** Le niveau de chaque personne, dans l’ordre des colonnes ; `null` si rien. */
  niveaux: (number | null)[]
  /** L’accord entre chaque paire voisine, dans l’ordre ; `null` si incomparable. */
  accords: (number | null)[]
  /** Part des points d’accord venus d’une complémentarité, entre voisins. */
  complementarites: number[]
  ecartMin: number
  ecartMax: number
}

/**
 * À partir d’où l’on signale qu’un accord doit quelque chose à la
 * complémentarité. Zéro serait trop bavard — un seul point croisé sur cent
 * n’explique rien — et la moitié trop sévère : les places particulières sont
 * rarement remplies partout.
 */
export const SEUIL_COMPLEMENTARITE = 0.15

export interface OptionsSlopegraph {
  /** Les noms de colonnes, déjà dans l’ordre voulu. */
  colonnes: string[]
  lignes: LigneComparee[]
  /** Accord d’ensemble entre chaque paire voisine. */
  accordsGlobaux: (number | null)[]
  titre?: string
}

const LARGEUR_LIBELLE = 190
const LARGEUR_COLONNE = 130
const HAUTEUR_BANDE = 54
const HAUT = 46
const MARGE = 10

/** Du rouge au vert, pour lire un accord sans avoir à lire un nombre. */
export function teinteAccord(accord: number): string {
  const borne = Math.min(1, Math.max(0, accord))
  return `hsl(${Math.round(borne * 125)} 65% 45%)`
}

export function slopegraphSvg({ colonnes, lignes, accordsGlobaux, titre = '' }: OptionsSlopegraph): string {
  const largeur = LARGEUR_LIBELLE + colonnes.length * LARGEUR_COLONNE + MARGE
  const hauteur = HAUT + lignes.length * HAUTEUR_BANDE + MARGE
  const x = (index: number): number => LARGEUR_LIBELLE + index * LARGEUR_COLONNE + LARGEUR_COLONNE / 2

  const entetes = colonnes.map((nom, index) =>
    `<text class="colonne-nom" x="${x(index)}" y="20" text-anchor="middle">${echapper(nom)}</text>`).join('')

  // L’accord d’ensemble se pose entre deux têtes de colonnes : c’est là qu’on
  // le cherche quand on veut savoir « et eux deux, ça donne quoi ? ».
  const globaux = accordsGlobaux.map((accord, index) => {
    if (accord === null) return ''
    const milieu = (x(index) + x(index + 1)) / 2
    return `<text class="accord-global" x="${milieu}" y="38" text-anchor="middle"`
      + ` fill="${teinteAccord(accord)}">${Math.round(accord * 100)} %</text>`
  }).join('')

  const bandes = lignes.map((ligne, rang) => {
    const haut = HAUT + rang * HAUTEUR_BANDE
    const bas = haut + HAUTEUR_BANDE - 14
    const y = (niveau: number): number => bas - niveau * (HAUTEUR_BANDE - 22)

    const traits = ligne.accords.map((accord, index) => {
      const gauche = ligne.niveaux[index]
      const droite = ligne.niveaux[index + 1]
      if (accord === null || gauche === null || droite === null
        || gauche === undefined || droite === undefined) return ''
      const croise = ligne.complementarites[index] ?? 0
      const style = croise > SEUIL_COMPLEMENTARITE ? ' stroke-dasharray="5 3"' : ''
      const infobulle = `${ligne.libelle} : ${Math.round(accord * 100)} %`
        + (croise > 0 ? ` — ${Math.round(croise * 100)} % par complémentarité` : '')
      return `<line class="pente" x1="${x(index)}" y1="${y(gauche).toFixed(1)}"`
        + ` x2="${x(index + 1)}" y2="${y(droite).toFixed(1)}"`
        + ` stroke="${teinteAccord(accord)}" stroke-width="${(1 + accord * 3).toFixed(1)}"${style}>`
        + `<title>${echapper(infobulle)}</title></line>`
    }).join('')

    const points = ligne.niveaux.map((niveau, index) => niveau === null
      ? `<circle class="absent" cx="${x(index)}" cy="${(haut + bas) / 2}" r="3"/>`
      : `<circle class="niveau" cx="${x(index)}" cy="${y(niveau).toFixed(1)}" r="5"`
        + ` fill="${echapper(ligne.couleur)}"><title>${Math.round(niveau * 100)} %</title></circle>`).join('')

    return `<g class="bande" data-part="${echapper(ligne.part)}">
      <rect class="fond-bande" x="${LARGEUR_LIBELLE - 6}" y="${haut - 6}"
        width="${largeur - LARGEUR_LIBELLE}" height="${HAUTEUR_BANDE - 4}"/>
      <text class="ligne-nom" x="${LARGEUR_LIBELLE - 14}" y="${(haut + bas) / 2}" text-anchor="end">${echapper(ligne.libelle)}</text>
      <text class="ligne-ecarts" x="${LARGEUR_LIBELLE - 14}" y="${(haut + bas) / 2 + 13}" text-anchor="end"
        >écart ${Math.round(ligne.ecartMin * 100)} → ${Math.round(ligne.ecartMax * 100)} %</text>
      ${traits}${points}
    </g>`
  }).join('')

  return `<svg class="slopegraph" viewBox="0 0 ${largeur} ${hauteur}" role="img"`
    + ` aria-label="${echapper(titre)}">${entetes}${globaux}${bandes}</svg>`
}
