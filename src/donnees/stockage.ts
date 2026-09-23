import type { Reponse } from '../domaine/types.ts'
import type { Reponses } from '../domaine/heritage.ts'

/**
 * Stockage des réponses.
 *
 * Trois règles :
 *
 * 1. Les réponses sont rangées par identifiant de nœud, jamais par position
 *    dans une grille : deux grilles qui partagent un nœud partagent sa réponse.
 * 2. Chaque personne a son propre bac. Plusieurs personnes sur le même
 *    navigateur ne s’écrasent pas ; se nommer autrement suffit à avoir une
 *    sauvegarde distincte et intacte.
 * 3. Une réécriture n’écrase que dans les 24 h. Passé ce délai la réponse
 *    précédente est conservée et une nouvelle révision est ajoutée, pour suivre
 *    l’évolution des positions. C’est la plus récente qui est affichée.
 */

export const FENETRE_REVISION_MS = 24 * 60 * 60 * 1000

export interface Personne {
  id: string
  nom: string
  creeLe: number
}

export interface Revision {
  /** Dernière écriture de cette révision. */
  le: number
  /** Début de la révision courante, conservé même quand on écrase dedans. */
  depuis: number
  reponse: Reponse
}

export function identifiant(nom: string): string {
  return nom
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stockage en mémoire, pour les tests et comme repli si localStorage manque. */
export function stockageMemoire(initial: Record<string, string> = {}): Storage {
  const donnees = new Map(Object.entries(initial))
  return {
    getItem: (cle) => donnees.get(cle) ?? null,
    setItem: (cle, valeur) => void donnees.set(cle, String(valeur)),
    removeItem: (cle) => void donnees.delete(cle),
    clear: () => donnees.clear(),
    key: (index) => [...donnees.keys()][index] ?? null,
    get length() { return donnees.size },
  } as Storage
}

/**
 * Le stockage du navigateur, ou la mémoire si on ne peut pas s’en servir.
 *
 * Depuis `file://`, l’origine est opaque : **lire la variable `localStorage`
 * lève une exception**, avant même tout appel. Le mode hors ligne est
 * précisément fait pour être ouvert ainsi ; sans ce repli, l’application ne
 * démarrerait pas du tout. Elle fonctionne alors normalement, mais les
 * réponses ne survivent pas à la fermeture — ce que l’interface dit.
 */
export function stockagePersistant(): { stockage: Storage; persistant: boolean } {
  try {
    const essai = globalThis.localStorage
    const temoin = '__cm__'
    essai.setItem(temoin, '1')
    essai.removeItem(temoin)
    return { stockage: essai, persistant: true }
  } catch {
    return { stockage: stockageMemoire(), persistant: false }
  }
}

const memesReponses = (a: Reponse = {}, b: Reponse = {}): boolean => {
  const cles = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const cle of cles) if (a[cle] !== b[cle]) return false
  return true
}

export interface OptionsStockage {
  stockage?: Storage
  espace?: string
  maintenant?: () => number
  fenetreMs?: number
}

export function creerStockage({
  stockage,
  espace = 'cm',
  maintenant = () => Date.now(),
  fenetreMs = FENETRE_REVISION_MS,
}: OptionsStockage = {}) {
  const support = stockage ?? stockageMemoire()
  const clePersonnes = `${espace}:personnes`
  const cleReponses = (personne: string) => `${espace}:reponses:${personne}`

  function lire<T>(cle: string, defaut: T): T {
    try {
      const brut = support.getItem(cle)
      if (brut === null) return defaut
      const analyse = JSON.parse(brut) as T | null
      return analyse === null ? defaut : analyse
    } catch {
      // Entrée corrompue : on repart du défaut plutôt que de bloquer la page.
      return defaut
    }
  }

  const ecrire = (cle: string, valeur: unknown): void => support.setItem(cle, JSON.stringify(valeur))

  function personnes(): Personne[] {
    const liste = lire<Personne[]>(clePersonnes, [])
    return Array.isArray(liste) ? liste : []
  }

  /** Idempotent : un même nom désigne la même personne et garde ses réponses. */
  function ajouterPersonne(nom: string): Personne {
    const id = identifiant(nom)
    if (!id) throw new TypeError(`« ${nom} » n’est pas un nom utilisable.`)
    const existantes = personnes()
    const deja = existantes.find((personne) => personne.id === id)
    if (deja) return deja
    const personne: Personne = { id, nom: nom.trim(), creeLe: maintenant() }
    ecrire(clePersonnes, [...existantes, personne])
    return personne
  }

  function oublierPersonne(id: string): void {
    ecrire(clePersonnes, personnes().filter((personne) => personne.id !== id))
    support.removeItem(cleReponses(id))
  }

  const toutesRevisions = (personne: string): Record<string, Revision[]> =>
    lire<Record<string, Revision[]>>(cleReponses(personne), {})

  function historique(personne: string, cle: string): Revision[] {
    const revisions = toutesRevisions(personne)[cle]
    return Array.isArray(revisions) ? revisions : []
  }

  function derniere(personne: string, cle: string): Revision | null {
    const revisions = historique(personne, cle)
    return revisions.length ? revisions[revisions.length - 1] ?? null : null
  }

  /**
   * Enregistre une réponse en appliquant la règle des 24 h.
   * La révision est insérée à sa place chronologique et non en fin de liste :
   * un import rejoue de vieilles réponses, qui ne doivent pas écraser les récentes.
   */
  function enregistrer(personne: string, cle: string, reponse: Reponse, le = maintenant()): {
    revision: Revision
    ajoutee: boolean
    inchangee: boolean
  } {
    const tout = toutesRevisions(personne)
    const revisions = [...(tout[cle] ?? [])]

    let indexPrecedent = -1
    for (const [index, revision] of revisions.entries()) if (revision.le <= le) indexPrecedent = index
    const precedente = indexPrecedent >= 0 ? revisions[indexPrecedent] : undefined

    // Réécrire la même chose n’est pas une révision, quel que soit le délai.
    if (precedente && memesReponses(precedente.reponse, reponse)) {
      return { revision: precedente, ajoutee: false, inchangee: true }
    }

    const dansLaFenetre = Boolean(precedente && le - precedente.le < fenetreMs)
    const revision: Revision = {
      le,
      depuis: dansLaFenetre ? precedente?.depuis ?? le : le,
      reponse: { ...reponse },
    }
    if (dansLaFenetre) revisions[indexPrecedent] = revision
    else revisions.splice(indexPrecedent + 1, 0, revision)

    tout[cle] = revisions
    ecrire(cleReponses(personne), tout)
    return { revision, ajoutee: !dansLaFenetre, inchangee: false }
  }

  /** Les réponses courantes d’une personne, prêtes pour le calcul des valeurs. */
  function reponsesCourantes(personne: string): Reponses {
    const courantes: Reponses = new Map()
    for (const [cle, revisions] of Object.entries(toutesRevisions(personne))) {
      const derniereRevision = Array.isArray(revisions) ? revisions[revisions.length - 1] : undefined
      if (derniereRevision) courantes.set(cle, derniereRevision.reponse)
    }
    return courantes
  }

  function oublier(personne: string, cle: string): void {
    const tout = toutesRevisions(personne)
    delete tout[cle]
    ecrire(cleReponses(personne), tout)
  }

  function exporter(personne: string) {
    return {
      version: 1 as const,
      personne: personnes().find((candidate) => candidate.id === personne) ?? null,
      reponses: toutesRevisions(personne),
    }
  }

  /** Fusionne un export, révision par révision, en gardant les deux histoires. */
  function importer(charge: ReturnType<typeof exporter>): Personne {
    if (!charge?.personne) throw new TypeError('Rien à importer.')
    const personne = ajouterPersonne(charge.personne.nom || charge.personne.id)
    for (const [cle, revisions] of Object.entries(charge.reponses ?? {})) {
      if (!Array.isArray(revisions)) continue
      for (const revision of revisions) enregistrer(personne.id, cle, revision.reponse ?? {}, revision.le)
    }
    return personne
  }

  return {
    personnes, ajouterPersonne, oublierPersonne,
    enregistrer, derniere, historique, reponsesCourantes, oublier,
    exporter, importer,
    fenetreMs,
  }
}

export type Stockage = ReturnType<typeof creerStockage>
