import { construireGrille, type Grille } from '../domaine/grille.ts'
import { creerTextes, type Textes } from '../domaine/traduction.ts'
import type { GrilleDefinition, Traduction } from '../domaine/types.ts'

import defVieCollective from './vie-collective/grille.yml'
import frVieCollective from './vie-collective/fr.yml'
import defIntimite from './intimite/grille.yml'
import enIntimite from './intimite/en.yml'

export interface GrilleDisponible {
  grille: Grille
  textes: Textes
  /** Traduction brute, pour vérifier la complétude sans repasser par les accès. */
  traduction: Traduction
}

/** Assemble une définition et sa traduction en grille utilisable. */
function preparer(definition: unknown, traduction: unknown): GrilleDisponible {
  return {
    grille: construireGrille(definition as GrilleDefinition),
    textes: creerTextes(traduction as Traduction),
    traduction: traduction as Traduction,
  }
}

/**
 * Les grilles proposées.
 *
 * Elles ne partagent volontairement aucun nœud : ce sont deux sujets distincts.
 * Deux grilles qui décriraient le même sujet — une version courte et une longue,
 * deux cadrages — reprendraient les mêmes identifiants et partageraient alors
 * automatiquement les réponses de ce qu’elles ont en commun.
 */
export const grilles: GrilleDisponible[] = [
  preparer(defVieCollective, frVieCollective),
  preparer(defIntimite, enIntimite),
]

export function grilleParId(id: string): GrilleDisponible | undefined {
  return grilles.find((disponible) => disponible.grille.id === id)
}
