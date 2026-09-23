import { agreger, type Contribution } from './agregateurs.ts'
import type { Grille } from './grille.ts'
import type { Reponse, ValeurPart, ValeurPolarite } from './types.ts'

/** Clé d’une étoile : une réponse porte toujours sur un couple (nœud, polarité). */
export function cle(noeud: string, polarite: string): string {
  return `${noeud}/${polarite}`
}

/** Réponses saisies, indexées par `cle()`. */
export type Reponses = Map<string, Reponse>

/** Valeurs calculées, indexées par `cle()`. */
export type Valeurs = Map<string, ValeurPolarite>

const ABSENT: ValeurPart = { score: 0, poids: 0, origine: 'absent' }

/**
 * Calcule les valeurs de toute la grille à partir des réponses saisies.
 *
 * L’héritage descend dans **deux directions**, avec exactement la même règle :
 *
 * - direction des sujets : une rubrique répondue vaut pour ses sous-nœuds ;
 * - direction des polarités : la polarité générale vaut pour les places
 *   particulières — répondre « en général » sur la musique renseigne d’un coup
 *   « en faire », « en recevoir » et « y assister ».
 *
 * Dans les deux cas le **score ne bouge pas**, seul le **poids** est atténué à
 * chaque niveau franchi. Toutes les sources disponibles sont ensuite résumées
 * par l’agrégateur de la part : la moyenne pondérée par défaut, mais une limite
 * se résume mieux par son minimum et une envie par son maximum.
 *
 * Le grain est la part et non l’étoile : on peut très bien avoir répondu à
 * une branche et pas aux autres.
 *
 * Le parcours suit l’ordre topologique des polarités *puis* celui des nœuds,
 * si bien que toute source est calculée avant d’être lue, en un seul passage.
 */
export function calculerValeurs(grille: Grille, reponses: Reponses): Valeurs {
  const valeurs: Valeurs = new Map()

  for (const polariteId of grille.ordrePolarites) {
    const polarite = grille.polarites.get(polariteId)
    if (!polarite) continue

    for (const id of grille.ordre) {
      const noeud = grille.noeuds.get(id)
      if (!noeud || !noeud.polarites.includes(polariteId)) continue

      const propre = reponses.get(cle(id, polariteId))
      const etoileValeurs: ValeurPolarite = {}

      for (const partId of noeud.parts) {
        const part = grille.part(partId)
        if (!part) continue

        const palierChoisi = propre?.[partId]
        if (palierChoisi !== undefined && part.steps[palierChoisi]) {
          etoileValeurs[partId] = { score: part.steps[palierChoisi].score, poids: 1, origine: 'propre' }
          continue
        }

        // Sources d’héritage : les rubriques au-dessus, et la polarité englobante.
        const sources: Contribution[] = []
        for (const parent of noeud.parents) {
          const valeur = valeurs.get(cle(parent, polariteId))?.[partId]
          if (valeur && valeur.poids > 0) {
            sources.push({ score: valeur.score, poids: valeur.poids * grille.attenuation })
          }
        }
        if (polarite.parent && noeud.polarites.includes(polarite.parent)) {
          const valeur = valeurs.get(cle(id, polarite.parent))?.[partId]
          if (valeur && valeur.poids > 0) {
            sources.push({ score: valeur.score, poids: valeur.poids * grille.attenuationPolarite })
          }
        }

        etoileValeurs[partId] = resumer(grille, partId, sources)
      }

      valeurs.set(cle(id, polariteId), etoileValeurs)
    }
  }

  return valeurs
}

/** Résume des sources d’héritage en une valeur ; le poids retenu est celui des sources. */
function resumer(grille: Grille, partId: string, sources: Contribution[]): ValeurPart {
  const score = agreger(grille.agregationDe(partId, 'inheritance'), sources)
  if (score === null) return ABSENT
  const poids = sources.reduce((total, source) => total + source.poids, 0) / sources.length
  return { score, poids, origine: 'herite' }
}

/** Valeur d’une étoile, vide si le nœud ne porte pas cette polarité. */
export function etoile(valeurs: Valeurs, noeud: string, polarite: string): ValeurPolarite {
  return valeurs.get(cle(noeud, polarite)) ?? {}
}

/** Vrai dès qu’au moins une part porte une valeur, héritée comprise. */
export function estRenseignee(valeursEtoile: ValeurPolarite): boolean {
  return Object.values(valeursEtoile).some((valeur) => valeur.poids > 0)
}

/** Vrai si au moins une part a été répondu directement sur ce nœud. */
export function estRepondue(valeursEtoile: ValeurPolarite): boolean {
  return Object.values(valeursEtoile).some((valeur) => valeur.origine === 'propre')
}
