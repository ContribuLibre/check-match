/**
 * Quels sujets sont repliés.
 *
 * Une grille complète fait vite cent lignes : pouvoir replier une rubrique est
 * ce qui permet de travailler sur une partie sans perdre le reste de vue.
 *
 * L’état est gardé **par grille** — replier « Son » dans la vie collective ne
 * dit rien de la grille d’à côté — et il survit au rechargement : on retrouve
 * la page telle qu’on l’a laissée.
 *
 * Ce qui est mémorisé, ce sont les nœuds **repliés**. Une grille qui gagne des
 * sujets les montre donc, au lieu de les cacher sans prévenir.
 */
export function creerReplis(grilleId: string, stockage: Storage) {
  const cle = `cm:replis:${grilleId}`

  const lire = (): Set<string> => {
    try {
      const brut = stockage.getItem(cle)
      const liste = brut ? (JSON.parse(brut) as unknown) : []
      return new Set(Array.isArray(liste) ? liste.filter((id): id is string => typeof id === 'string') : [])
    } catch {
      return new Set()
    }
  }

  let replies = lire()

  const ecrire = (): void => {
    try {
      stockage.setItem(cle, JSON.stringify([...replies]))
    } catch { /* au mieux */ }
  }

  return {
    estReplie: (id: string): boolean => replies.has(id),
    basculer(id: string): void {
      if (replies.has(id)) replies.delete(id)
      else replies.add(id)
      ecrire()
    },
    toutReplier(ids: Iterable<string>): void {
      replies = new Set(ids)
      ecrire()
    },
    toutDeplier(): void {
      replies = new Set()
      ecrire()
    },
    /** Y a-t-il quelque chose à déplier ? Sert à ne proposer que l’action utile. */
    get aDesReplis(): boolean {
      return replies.size > 0
    },
  }
}

export type Replis = ReturnType<typeof creerReplis>
