import { descendants, type Grille } from './grille.ts'
import { cle, type Valeurs } from './heritage.ts'
import type { Reponse } from './types.ts'

/**
 * Remontée : propose la réponse d’une rubrique d’après ce qui a été répondu en dessous.
 *
 * L’inverse de l’héritage, et volontairement une **proposition** et non un
 * calcul permanent : renseigner une rubrique est une prise de position, elle
 * doit rester une réponse propre que l’on peut ensuite corriger. Sans ça, une
 * rubrique ne pourrait jamais dire autre chose que la somme de ses parties.
 *
 * Ne comptent que les descendants portant une réponse **propre**, à n’importe
 * quelle profondeur. Prendre aussi les valeurs héritées ferait remonter à la
 * rubrique ce qu’elle a elle-même diffusé vers le bas : elle se confirmerait
 * toute seule, et une réponse posée trois niveaux plus haut reviendrait comme
 * si elle venait du terrain.
 *
 * @returns les index de paliers proposés, critère par critère ; vide si rien
 *          n’a été répondu en dessous.
 */
export function proposerDepuisEnfants(
  grille: Grille,
  valeurs: Valeurs,
  noeudId: string,
  facetteId: string,
): Reponse {
  const noeud = grille.noeuds.get(noeudId)
  if (!noeud) return {}

  const sous = descendants(grille, noeudId)
  const proposition: Reponse = {}

  for (const critereId of noeud.criteres) {
    const critere = grille.critere(critereId)
    if (!critere) continue

    let somme = 0
    let comptes = 0
    for (const descendantId of sous) {
      const valeur = valeurs.get(cle(descendantId, facetteId))?.[critereId]
      if (valeur?.origine !== 'propre') continue
      somme += valeur.score
      comptes += 1
    }
    if (!comptes) continue

    proposition[critereId] = palierLePlusProche(critere.paliers.map((palier) => palier.score), somme / comptes)
  }
  return proposition
}

/**
 * Index du palier dont le score est le plus proche.
 * Les scores étant irréguliers, on compare les écarts réels et non les rangs.
 */
export function palierLePlusProche(scores: number[], cible: number): number {
  let meilleur = 0
  let ecartMin = Number.POSITIVE_INFINITY
  for (const [index, score] of scores.entries()) {
    const ecart = Math.abs(score - cible)
    if (ecart < ecartMin) {
      ecartMin = ecart
      meilleur = index
    }
  }
  return meilleur
}
