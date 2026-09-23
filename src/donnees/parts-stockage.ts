import { identifiantPart, type EchelleAjoutee, type PartAjoutee } from '../domaine/parts-ajoutees.ts'

/**
 * Les échelles qu’une personne a ajoutées, rangées par grille.
 *
 * Elles vivent à côté de ses réponses et de ses sujets ajoutés, pour la même
 * raison : la grille livrée reste celle que tout le monde partage, et c’est ce
 * qui permet de continuer à se comparer sur ce qu’on a en commun.
 */
export function creerPartsAjoutees(stockage: Storage, espace = 'cm') {
  const cle = (personne: string) => `${espace}:echelles:${personne}`

  function tous(personne: string): Record<string, PartAjoutee[]> {
    try {
      const brut = stockage.getItem(cle(personne))
      const lus = brut ? (JSON.parse(brut) as Record<string, PartAjoutee[]>) : {}
      return lus && typeof lus === 'object' ? lus : {}
    } catch {
      return {}
    }
  }

  function pourGrille(personne: string, grille: string): PartAjoutee[] {
    const liste = tous(personne)[grille]
    return Array.isArray(liste) ? liste.filter((part) => part?.id && part?.kind) : []
  }

  function ecrire(personne: string, parts: Record<string, PartAjoutee[]>): void {
    try {
      stockage.setItem(cle(personne), JSON.stringify(parts))
    } catch { /* au mieux */ }
  }

  /** @param pris identifiants de parts déjà utilisés dans la grille */
  function ajouter(
    personne: string,
    grille: string,
    echelle: EchelleAjoutee,
    pris: Iterable<string>,
  ): PartAjoutee {
    const propre = echelle.label.trim()
    if (!propre) throw new TypeError('Une échelle sans nom n’est pas une échelle.')
    if (echelle.kind === 'steps' && (echelle.steps?.length ?? 0) < 2) {
      throw new TypeError('Une échelle à crans en demande au moins deux.')
    }
    if (echelle.kind === 'tension' && echelle.poles?.length !== 2) {
      throw new TypeError('Une tension se tient entre exactement deux extrêmes.')
    }
    if (echelle.kind === 'triangle' && echelle.poles?.length !== 3) {
      throw new TypeError('Un triangle se tient entre exactement trois extrêmes.')
    }

    const toutes = tous(personne)
    const existantes = pourGrille(personne, grille)
    const part: PartAjoutee = {
      ...echelle,
      label: propre,
      id: identifiantPart(propre, [...pris, ...existantes.map((autre) => autre.id)]),
      creeLe: Date.now(),
    }
    ecrire(personne, { ...toutes, [grille]: [...existantes, part] })
    return part
  }

  function retirer(personne: string, grille: string, id: string): void {
    const toutes = tous(personne)
    ecrire(personne, { ...toutes, [grille]: pourGrille(personne, grille).filter((part) => part.id !== id) })
  }

  return { tous, pourGrille, ajouter, retirer }
}

export type StockagePartsAjoutees = ReturnType<typeof creerPartsAjoutees>
