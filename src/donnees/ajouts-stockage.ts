import { identifiantAjout, type Ajouts, type NoeudAjoute } from '../domaine/ajouts.ts'

/**
 * Les sujets qu’une personne a ajoutés, rangés par grille.
 *
 * Ils vivent à côté de ses réponses et pas dans la grille : la grille livrée
 * reste celle que tout le monde partage, et c’est ce qui permet de continuer à
 * se comparer sur les sujets communs.
 */
export function creerAjouts(stockage: Storage, espace = 'cm') {
  const cle = (personne: string) => `${espace}:ajouts:${personne}`

  function tous(personne: string): Ajouts {
    try {
      const brut = stockage.getItem(cle(personne))
      const lus = brut ? (JSON.parse(brut) as Ajouts) : {}
      return lus && typeof lus === 'object' ? lus : {}
    } catch {
      return {}
    }
  }

  function pourGrille(personne: string, grille: string): NoeudAjoute[] {
    const liste = tous(personne)[grille]
    return Array.isArray(liste) ? liste : []
  }

  function ecrire(personne: string, ajouts: Ajouts): void {
    try {
      stockage.setItem(cle(personne), JSON.stringify(ajouts))
    } catch { /* au mieux */ }
  }

  /**
   * @param pris identifiants déjà utilisés dans la grille, pour n’en pas reprendre
   */
  function ajouter(
    personne: string,
    grille: string,
    label: string,
    parents: string[],
    pris: Iterable<string>,
  ): NoeudAjoute {
    const propre = label.trim()
    if (!propre) throw new TypeError('Un sujet sans libellé n’est pas un sujet.')

    const ajouts = tous(personne)
    const existants = pourGrille(personne, grille)
    const noeud: NoeudAjoute = {
      id: identifiantAjout(propre, [...pris, ...existants.map((ajout) => ajout.id)]),
      label: propre,
      parents: [...parents],
      creeLe: Date.now(),
    }
    ecrire(personne, { ...ajouts, [grille]: [...existants, noeud] })
    return noeud
  }

  /**
   * Retire un sujet ajouté, et avec lui ceux qui n’en dépendaient que par lui :
   * laisser des orphelins rattachés à un parent disparu n’aiderait personne.
   */
  function retirer(personne: string, grille: string, id: string): void {
    const ajouts = tous(personne)
    let restants = pourGrille(personne, grille).filter((ajout) => ajout.id !== id)
    let encore = true
    while (encore) {
      encore = false
      const vivants = new Set(restants.map((ajout) => ajout.id))
      const survivants = restants.filter((ajout) =>
        !ajout.parents.length || ajout.parents.some((parent) => !parent.startsWith('+') || vivants.has(parent)))
      if (survivants.length !== restants.length) {
        restants = survivants
        encore = true
      }
    }
    ecrire(personne, { ...ajouts, [grille]: restants })
  }

  return { tous, pourGrille, ajouter, retirer }
}

export type StockageAjouts = ReturnType<typeof creerAjouts>
