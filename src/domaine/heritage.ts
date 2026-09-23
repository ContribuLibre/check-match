import type { Grille } from './grille.ts'
import type { Reponse, ValeurCritere, ValeurFacette } from './types.ts'

/** Clé d’une étoile : une réponse porte toujours sur un couple (nœud, facette). */
export function cle(noeud: string, facette: string): string {
  return `${noeud}/${facette}`
}

/** Réponses saisies, indexées par `cle()`. */
export type Reponses = Map<string, Reponse>

/** Valeurs calculées, indexées par `cle()`. */
export type Valeurs = Map<string, ValeurFacette>

const ABSENT: ValeurCritere = { score: 0, poids: 0, origine: 'absent' }

/**
 * Calcule les valeurs de toute la grille à partir des réponses saisies.
 *
 * Deux règles, appliquées critère par critère — le grain est le critère, pas
 * l’étoile, car on peut très bien avoir répondu à une branche et pas aux autres :
 *
 * 1. Répondre sur une rubrique vaut réponse sur tout ce qu’elle contient, avec
 *    le **même score** mais un **poids atténué** à chaque niveau de descente.
 *    Une réponse directe pèse 1, sa fille 0,5, sa petite-fille 0,25.
 * 2. Un nœud à plusieurs parents non répondu prend la **moyenne** de ses parents,
 *    pondérée par leur poids : un parent répondu directement pèse plus lourd
 *    qu’un parent qui héritait lui-même de loin.
 *
 * Le parcours suit l’ordre topologique, donc les parents sont toujours calculés
 * avant leurs enfants et un seul passage suffit.
 */
export function calculerValeurs(grille: Grille, reponses: Reponses): Valeurs {
  const valeurs: Valeurs = new Map()

  for (const facette of grille.facettes) {
    for (const id of grille.ordre) {
      const noeud = grille.noeuds.get(id)
      if (!noeud || !noeud.facettes.includes(facette.id)) continue

      const propre = reponses.get(cle(id, facette.id))
      const etoile: ValeurFacette = {}

      for (const critereId of noeud.criteres) {
        const critere = grille.critere(critereId)
        if (!critere) continue

        const palierChoisi = propre?.[critereId]
        if (palierChoisi !== undefined && critere.paliers[palierChoisi]) {
          etoile[critereId] = { score: critere.paliers[palierChoisi].score, poids: 1, origine: 'propre' }
          continue
        }

        etoile[critereId] = herite(grille, valeurs, noeud.parents, facette.id, critereId)
      }

      valeurs.set(cle(id, facette.id), etoile)
    }
  }

  return valeurs
}

/** Moyenne pondérée des parents qui portent une valeur, atténuée d’un niveau. */
function herite(
  grille: Grille,
  valeurs: Valeurs,
  parents: string[],
  facetteId: string,
  critereId: string,
): ValeurCritere {
  let sommePonderee = 0
  let sommePoids = 0
  let contributeurs = 0

  for (const parent of parents) {
    const valeurParent = valeurs.get(cle(parent, facetteId))?.[critereId]
    if (!valeurParent || valeurParent.poids <= 0) continue
    sommePonderee += valeurParent.score * valeurParent.poids
    sommePoids += valeurParent.poids
    contributeurs += 1
  }

  if (!contributeurs) return ABSENT
  return {
    score: sommePonderee / sommePoids,
    poids: (sommePoids / contributeurs) * grille.attenuation,
    origine: 'herite',
  }
}

/** Valeur d’une étoile, vide si le nœud ne porte pas cette facette. */
export function etoile(valeurs: Valeurs, noeud: string, facette: string): ValeurFacette {
  return valeurs.get(cle(noeud, facette)) ?? {}
}

/** Vrai dès qu’au moins un critère porte une valeur, héritée comprise. */
export function estRenseignee(etoileValeurs: ValeurFacette): boolean {
  return Object.values(etoileValeurs).some((valeur) => valeur.poids > 0)
}

/** Vrai si au moins un critère a été répondu directement sur ce nœud. */
export function estRepondue(etoileValeurs: ValeurFacette): boolean {
  return Object.values(etoileValeurs).some((valeur) => valeur.origine === 'propre')
}
