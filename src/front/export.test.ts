import { describe, expect, it } from 'vitest'
import { composerChecklist, composerReponses, nomFichier } from './export.ts'
import { construireGrille } from '../domaine/grille.ts'
import { creerTextes } from '../domaine/traduction.ts'
import { grilles, grilleParId } from '../grilles/index.ts'

describe('export de la checklist', () => {
  const vieCollective = grilleParId('vie-collective')!
  const ajout = { id: '+poubelles', label: 'Poubelles', parents: ['espaces-communs'], creeLe: 0 }

  it('emporte les sujets ajoutés, et rien des réponses', () => {
    const paquet = composerChecklist(vieCollective.definition, vieCollective.traductions, [ajout])
    const exporte = JSON.stringify(paquet)

    expect(paquet.definition.nodes.some((noeud) => noeud.id === '+poubelles')).toBe(true)
    expect(paquet.traductions.fr?.nodes['+poubelles']?.label).toBe('Poubelles')
    // Ce qui sort ne doit rien dire de ce qu’on a répondu.
    expect(exporte).not.toContain('reponses')
    expect(exporte).not.toContain('personne')
  })

  it('produit une grille qui se reconstruit telle quelle', () => {
    // Le vrai critère : ce qu’on envoie doit se relire de l’autre côté.
    const paquet = composerChecklist(vieCollective.definition, vieCollective.traductions, [ajout])
    const grille = construireGrille(paquet.definition)
    expect(grille.noeuds.get('+poubelles')?.parents).toEqual(['espaces-communs'])
    expect(grille.noeuds.size).toBe(vieCollective.grille.noeuds.size + 1)

    const textes = creerTextes(paquet.traductions.fr!, paquet.traductions.fr!)
    expect(textes.noeud('+poubelles')).toBe('Poubelles')
    expect(textes.noeud('cuisine')).toBe('Cuisine')
  })

  it('reste fidèle à la grille quand rien n’a été ajouté', () => {
    const paquet = composerChecklist(vieCollective.definition, vieCollective.traductions, [])
    expect(construireGrille(paquet.definition).noeuds.size).toBe(vieCollective.grille.noeuds.size)
  })

  it('garde toutes les langues disponibles', () => {
    const paquet = composerChecklist(vieCollective.definition, vieCollective.traductions, [ajout])
    expect(Object.keys(paquet.traductions).sort()).toEqual(['en', 'fr'])
    // Un ajout porte son libellé dans chaque langue, faute d’être traduit.
    expect(paquet.traductions.en?.nodes['+poubelles']?.label).toBe('Poubelles')
  })
})

describe('export des réponses', () => {
  it('dit de quelle grille il parle', () => {
    const paquet = composerReponses('vie-collective', { version: 1, personne: null, reponses: {} })
    expect(paquet.format).toBe('check-match/reponses')
    expect(paquet.grille).toBe('vie-collective')
  })
})

describe('nom de fichier', () => {
  it('porte le sujet puis la date, pour se trier tout seul', () => {
    expect(nomFichier('reponses', 'vie-collective')).toMatch(/^reponses-vie-collective-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('les grilles livrées savent accueillir des ajouts', () => {
  it('sans toucher à la grille d’origine', () => {
    const avant = grilles[0]!.grille.noeuds.size
    const augmentee = grilles[0]!.avecAjouts([{ id: '+x', label: 'X', parents: [], creeLe: 0 }])
    expect(augmentee.grille.noeuds.size).toBe(avant + 1)
    expect(grilles[0]!.grille.noeuds.size).toBe(avant)
  })
})
