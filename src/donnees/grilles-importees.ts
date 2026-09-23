import type { ChecklistExportee } from '../front/export.ts'

/**
 * Les checklists reçues de quelqu’un.
 *
 * Elles se rangent à côté des grilles livrées, et non parmi elles : une grille
 * livrée est la même pour tout le monde, alors qu’une checklist reçue n’engage
 * que celui qui l’a reçue.
 *
 * Elles sont communes aux personnes du navigateur, contrairement aux réponses
 * et aux sujets ajoutés : une checklist est ce sur quoi plusieurs personnes
 * vont justement répondre pour pouvoir se comparer.
 *
 * Une checklist qui porte l’identifiant d’une grille livrée n’écrase rien : les
 * deux coexistent, et partagent de toute façon les réponses de ce qu’elles ont
 * en commun, puisqu’une réponse appartient au sujet et non à la grille.
 */
export function creerGrillesImportees(stockage: Storage, espace = 'cm') {
  const cle = `${espace}:checklists`

  function toutes(): ChecklistExportee[] {
    try {
      const brut = stockage.getItem(cle)
      const lues = brut ? (JSON.parse(brut) as ChecklistExportee[]) : []
      return Array.isArray(lues) ? lues.filter((checklist) => checklist?.definition?.id) : []
    } catch {
      return []
    }
  }

  function ecrire(checklists: ChecklistExportee[]): void {
    try {
      stockage.setItem(cle, JSON.stringify(checklists))
    } catch { /* au mieux */ }
  }

  /** Réimporter la même checklist la remplace : c’est une mise à jour, pas un doublon. */
  function ajouter(checklist: ChecklistExportee): ChecklistExportee {
    const id = checklist.definition.id
    ecrire([...toutes().filter((autre) => autre.definition.id !== id), checklist])
    return checklist
  }

  function retirer(id: string): void {
    ecrire(toutes().filter((checklist) => checklist.definition.id !== id))
  }

  return { toutes, ajouter, retirer }
}

export type GrillesImportees = ReturnType<typeof creerGrillesImportees>
