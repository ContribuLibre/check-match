import {
  comparer, ecartsParPart, niveauMoyen, ordonnerParProximite, type Accord,
} from '../domaine/comparaison.ts'
import { calculerValeurs, type Valeurs } from '../domaine/heritage.ts'
import type { Personne, Stockage } from '../donnees/stockage.ts'
import type { GrilleDisponible } from '../grilles/index.ts'
import { slopegraphSvg, teinteAccord, type LigneComparee } from '../rendu/slopegraph.ts'
import type { Textes } from './i18n.ts'

/**
 * La page de comparaison.
 *
 * Tout le monde est comparé à tout le monde, mais les colonnes sont rangées
 * pour que les voisins se ressemblent : on lit alors la suite comme un
 * dégradé, et les ruptures sautent aux yeux.
 *
 * Rien n’est comparé qui ne soit renseigné des deux côtés, donc des profils à
 * peine commencés se comparent quand même — sur le peu qu’ils ont en commun, et
 * en le disant.
 */

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

export interface ProfilCompare {
  personne: Personne
  valeurs: Valeurs
}

/** Les profils qui ont au moins une réponse : comparer du vide n’apprend rien. */
export function profilsDe(disponible: GrilleDisponible, stockage: Stockage): ProfilCompare[] {
  return stockage.personnes().flatMap((personne) => {
    const reponses = stockage.reponsesCourantes(personne.id)
    if (!reponses.size) return []
    return [{ personne, valeurs: calculerValeurs(disponible.grille, reponses) }]
  })
}

const cleCouple = (a: string, b: string): string => [a, b].sort().join('|')

/** Tous les accords deux à deux, calculés une seule fois. */
export function accordsDeuxADeux(
  disponible: GrilleDisponible,
  profils: ProfilCompare[],
): Map<string, Accord> {
  const weightBy = disponible.definition.weightBy
  const accords = new Map<string, Accord>()
  for (const [index, a] of profils.entries()) {
    for (const b of profils.slice(index + 1)) {
      accords.set(
        cleCouple(a.personne.id, b.personne.id),
        comparer(disponible.grille, a.valeurs, b.valeurs, weightBy),
      )
    }
  }
  return accords
}

export function comparaisonHtml(
  disponible: GrilleDisponible,
  profils: ProfilCompare[],
  ui: Textes,
  langue: string,
): string {
  if (profils.length < 2) {
    return `<div class="comparaison-vide"><p class="aide">${echapper(ui.comparaisonTropPeu)}</p></div>`
  }

  const grille = disponible.grille
  const textes = disponible.textesPour(langue)
  const accords = accordsDeuxADeux(disponible, profils)
  const accordEntre = (a: string, b: string): number | null => accords.get(cleCouple(a, b))?.global ?? null

  const ordre = ordonnerParProximite(profils.map((profil) => profil.personne.id), accordEntre)
  const ranges = ordre.flatMap((id) => profils.filter((profil) => profil.personne.id === id))

  const voisins = ranges.slice(0, -1).map((profil, index) =>
    accords.get(cleCouple(profil.personne.id, ranges[index + 1]!.personne.id)))
  const ecarts = ecartsParPart([...accords.values()])

  // Une ligne par part dessinée : celles de regroupement ne disent rien de plus
  // que leurs branches, et les compter deux fois fausserait la lecture.
  const lignes: LigneComparee[] = grille.partsFeuilles
    .filter((partId) => partId !== disponible.definition.weightBy)
    .flatMap((partId) => {
      const part = grille.part(partId)
      if (!part) return []
      const niveaux = ranges.map((profil) => niveauMoyen(grille, profil.valeurs, partId))
      if (niveaux.every((niveau) => niveau === null)) return []
      const parPart = voisins.map((accord) => accord?.parts.find((entree) => entree.part === partId))
      const ecart = ecarts.get(partId) ?? { min: 0, max: 0 }
      return [{
        part: partId,
        libelle: textes.part(partId),
        couleur: part.maxColor,
        niveaux,
        accords: parPart.map((entree) => entree?.accord ?? null),
        complementarites: parPart.map((entree) => entree?.complementarite ?? 0),
        ecartMin: ecart.min,
        ecartMax: ecart.max,
      }]
    })

  const figure = slopegraphSvg({
    colonnes: ranges.map((profil) => profil.personne.nom),
    lignes,
    accordsGlobaux: voisins.map((accord) => accord?.global ?? null),
    titre: ui.comparaisonTitre,
  })

  return `<section class="comparaison">
    <header class="comparaison-entete">
      <h2>${echapper(ui.comparaisonTitre)}</h2>
      <p class="aide">${echapper(ui.comparaisonAide)}</p>
    </header>
    <div class="comparaison-figure">${figure}</div>
    ${matriceHtml(ranges, accords, ui)}
    <p class="aide legende">${echapper(ui.comparaisonLegende)}</p>
  </section>`
}

/** Tous les couples, pas seulement les voisins : le tableau dit le reste. */
function matriceHtml(profils: ProfilCompare[], accords: Map<string, Accord>, ui: Textes): string {
  const entetes = profils.map((profil) => `<th scope="col">${echapper(profil.personne.nom)}</th>`).join('')
  const lignes = profils.map((ligne) => {
    const cellules = profils.map((colonne) => {
      if (ligne.personne.id === colonne.personne.id) return '<td class="soi">—</td>'
      const accord = accords.get(cleCouple(ligne.personne.id, colonne.personne.id))
      if (!accord || accord.global === null) {
        return `<td class="incomparable" title="${echapper(ui.comparaisonRienEnCommun)}">·</td>`
      }
      return `<td style="color: ${teinteAccord(accord.global)}" title="${
        echapper(ui.comparaisonSur(accord.comparaisons))}">${Math.round(accord.global * 100)} %</td>`
    }).join('')
    return `<tr><th scope="row">${echapper(ligne.personne.nom)}</th>${cellules}</tr>`
  }).join('')

  return `<table class="matrice-accords">
    <caption>${echapper(ui.comparaisonMatrice)}</caption>
    <thead><tr><td></td>${entetes}</tr></thead>
    <tbody>${lignes}</tbody>
  </table>`
}
