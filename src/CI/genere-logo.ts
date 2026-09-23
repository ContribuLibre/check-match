/**
 * Redessine le logo à partir de la géométrie des étoiles de l’application.
 *
 * Le dessiner à la main reviendrait à le laisser dériver : ici, la marque est
 * littéralement une étoile du produit, toutes branches à pleine portée. Changer
 * la forme des étoiles change le logo, et c’est voulu.
 *
 *     bun src/CI/genere-logo.ts [nombre de branches] > public/icons/icon.svg
 */

import { geometrieEtoile, pointsSvg } from '../rendu/etoile.ts'

/** Teintes réparties sur la roue, dans l’ordre des branches. */
const COULEURS: Record<number, string[]> = {
  6: ['#5B0', '#09C', '#75E', '#C0B', '#E33', '#F90'],
  8: ['#5B0', '#0C9', '#29E', '#75E', '#C0B', '#E33', '#F80', '#FC0'],
}

/**
 * Les pointes restent sous 0,92 : c’est la zone qu’une icône « maskable »
 * garantit de ne pas rogner, et le logo sert aussi d’icône installée.
 */
const PORTEE_SURE = 0.92

export function logoSvg(branches: number): string {
  const couleurs = COULEURS[branches] ?? COULEURS[8]!
  const { secteurs } = geometrieEtoile(
    Array.from({ length: branches }, () => ({ score: 1, poids: 1 })),
    { taille: PORTEE_SURE * 2 },
  )

  const polygones = secteurs.map((secteur, index) =>
    `    <polygon points="${pointsSvg(secteur.piste)}" fill="${couleurs[index % couleurs.length]}"/>`).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.15 -1.15 2.3 2.3" role="img" aria-label="check-match">
  <!--
    Produit par « bun src/CI/genere-logo.ts ${branches} » : c’est une étoile de
    l’application, dessinée par la même géométrie, toutes branches à pleine
    portée. Une branche par part, chacune sa couleur.
  -->
  <rect x="-1.15" y="-1.15" width="2.3" height="2.3" rx="0.45" fill="#15171c"/>
  <g stroke="#15171c" stroke-width="0.02" stroke-linejoin="round">
${polygones}
  </g>
</svg>
`
}

if (import.meta.main) {
  const branches = Number(process.argv[2] ?? 8)
  if (!Number.isInteger(branches) || branches < 3) {
    console.error('Nombre de branches attendu : un entier d’au moins 3.')
    process.exit(1)
  }
  process.stdout.write(logoSvg(branches))
}
