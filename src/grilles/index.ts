import { augmenterDefinition, augmenterTraduction, type NoeudAjoute } from '../domaine/ajouts.ts'
import { construireGrille, type Grille } from '../domaine/grille.ts'
import { creerTextes, type Textes } from '../domaine/traduction.ts'
import type { GrilleDefinition, Traduction } from '../domaine/types.ts'

import defVieCollective from './vie-collective/grille.yml'
import frVieCollective from './vie-collective/fr.yml'
import enVieCollective from './vie-collective/en.yml'
import defIntimite from './intimite/grille.yml'
import enIntimite from './intimite/en.yml'

export interface GrilleDisponible {
  grille: Grille
  /** Vraie pour une checklist reçue de quelqu’un, fausse pour une grille livrée. */
  importee: boolean
  /** Langue de repli, celle qui doit être complète. */
  langueParDefaut: string
  traductions: Record<string, Traduction>
  /**
   * Textes dans la langue demandée, complétés par la langue par défaut.
   * Une grille à moitié traduite reste lisible : c’est le cas courant.
   */
  textesPour(langue: string): Textes
  /** Textes dans la langue par défaut, pour lister les grilles avant tout choix. */
  textes: Textes
  /** La définition d’origine, pour l’exporter augmentée des ajouts. */
  definition: GrilleDefinition
  /** La même grille, augmentée des sujets ajoutés par une personne. */
  avecAjouts(ajouts: NoeudAjoute[]): GrilleDisponible
}

/**
 * Construit une grille prête à afficher, d’où qu’elle vienne : livrée avec
 * l’application, ou reçue de quelqu’un sous forme de checklist exportée.
 */
export function preparer(
  definitionBrute: unknown,
  traductions: Record<string, unknown>,
  importee = false,
): GrilleDisponible {
  const definition = definitionBrute as GrilleDefinition
  const grille = construireGrille(definition)
  const parLangue = traductions as Record<string, Traduction>
  const langueParDefaut = definition.defaultLocale
  const repli = parLangue[langueParDefaut] ?? Object.values(parLangue)[0]!

  const cache = new Map<string, Textes>()
  const textesPour = (langue: string): Textes => {
    const deja = cache.get(langue)
    if (deja) return deja
    const textes = creerTextes(parLangue[langue] ?? repli, repli)
    cache.set(langue, textes)
    return textes
  }

  return {
    grille,
    importee,
    langueParDefaut,
    traductions: parLangue,
    textesPour,
    textes: textesPour(langueParDefaut),
    definition,
    avecAjouts: (ajouts) => (ajouts.length
      ? preparer(
        augmenterDefinition(definition, ajouts),
        Object.fromEntries(Object.entries(parLangue)
          .map(([langue, traduction]) => [langue, augmenterTraduction(traduction, ajouts)])),
        importee,
      )
      : preparer(definition, parLangue, importee)),
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
  preparer(defVieCollective, { fr: frVieCollective, en: enVieCollective }),
  preparer(defIntimite, { en: enIntimite }),
]

export function grilleParId(id: string): GrilleDisponible | undefined {
  return grilles.find((disponible) => disponible.grille.id === id)
}
