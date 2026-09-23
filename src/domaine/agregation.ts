import { agreger, type Contribution } from './agregateurs.ts'
import { descendants, sousPolarites, type Grille } from './grille.ts'
import { cle, type Valeurs } from './heritage.ts'
import type { Reponse } from './types.ts'

/** Dans quelle direction remonter : les sous-sujets, les sous-polarités, ou les deux. */
export type Direction = 'sujets' | 'polarites' | 'les-deux'

/**
 * Remontée : propose la réponse d’un nœud d’après ce qui a été répondu « en dessous ».
 *
 * L’inverse de l’héritage, et dans les deux mêmes directions :
 *
 * - direction des sujets : résumer une rubrique d’après ses éléments ;
 * - direction des polarités : déduire la polarité générale de ce qu’on a dit en
 *   faisant, en recevant, en assistant — l’aperçu rapide reconstitué depuis le
 *   détail.
 *
 * C’est une **proposition** et non un calcul permanent : renseigner une
 * rubrique ou un général est une prise de position, qui doit pouvoir dire autre
 * chose que la somme de ses parties.
 *
 * Ne comptent que les réponses **propres**, à n’importe quelle profondeur.
 * Prendre aussi les valeurs héritées ferait remonter ce que le nœud a lui-même
 * diffusé vers le bas : il se confirmerait tout seul.
 *
 * La façon de résumer suit l’agrégateur de la part — souvent le bon choix n’est
 * pas la moyenne : une limite se résume par son minimum, une envie par son
 * maximum.
 *
 * @returns les index de paliers proposés ; vide si rien n’a été répondu en dessous.
 */
export function proposerDepuis(
  grille: Grille,
  valeurs: Valeurs,
  noeudId: string,
  polariteId: string,
  direction: Direction = 'les-deux',
): Reponse {
  const noeud = grille.noeuds.get(noeudId)
  if (!noeud) return {}

  const couples: [string, string][] = []
  if (direction === 'sujets' || direction === 'les-deux') {
    for (const descendant of descendants(grille, noeudId)) couples.push([descendant, polariteId])
  }
  if (direction === 'polarites' || direction === 'les-deux') {
    for (const sous of sousPolarites(grille, polariteId)) {
      if (noeud.polarites.includes(sous)) couples.push([noeudId, sous])
    }
  }

  const proposition: Reponse = {}
  for (const partId of noeud.parts) {
    const part = grille.part(partId)
    if (!part) continue

    const sources: Contribution[] = []
    for (const [autreNoeud, autrePolarite] of couples) {
      const valeur = valeurs.get(cle(autreNoeud, autrePolarite))?.[partId]
      if (valeur?.origine === 'propre') sources.push({ score: valeur.score, poids: 1 })
    }

    const score = agreger(grille.agregationDe(partId, 'rollup'), sources)
    if (score === null) continue
    proposition[partId] = palierLePlusProche(part.steps.map((palier) => palier.score), score)
  }
  return proposition
}

/** Y a-t-il quelque chose à remonter ? Sert à n’afficher le bouton que s’il fait quelque chose. */
export function peutRemonter(grille: Grille, valeurs: Valeurs, noeudId: string, polariteId: string, direction: Direction = 'les-deux'): boolean {
  return Object.keys(proposerDepuis(grille, valeurs, noeudId, polariteId, direction)).length > 0
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
