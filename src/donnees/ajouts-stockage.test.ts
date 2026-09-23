import { beforeEach, describe, expect, it } from 'vitest'
import { creerAjouts, type StockageAjouts } from './ajouts-stockage.ts'
import { stockageMemoire } from './stockage.ts'

describe('sujets ajoutés par une personne', () => {
  let ajouts: StockageAjouts
  beforeEach(() => { ajouts = creerAjouts(stockageMemoire()) })

  it('se rangent par personne et par grille', () => {
    ajouts.ajouter('alex', 'vie-collective', { label: 'Poubelles', parents: ['espaces'] }, [])
    expect(ajouts.pourGrille('alex', 'vie-collective')).toHaveLength(1)
    // Ni les autres grilles ni les autres personnes n’en savent rien.
    expect(ajouts.pourGrille('alex', 'intimite')).toEqual([])
    expect(ajouts.pourGrille('sam', 'vie-collective')).toEqual([])
  })

  it('ne reprend jamais un identifiant de la grille livrée', () => {
    const sujet = ajouts.ajouter('alex', 'vie-collective', { label: 'Cuisine', parents: ['espaces'] }, ['cuisine', 'salon'])
    expect(sujet.id).toBe('+cuisine')
    expect(sujet.id).not.toBe('cuisine')
  })

  it('refuse un libellé vide', () => {
    expect(() => ajouts.ajouter('alex', 'vie-collective', { label: '   ', parents: [] }, [])).toThrow()
  })

  it('retire un sujet', () => {
    const sujet = ajouts.ajouter('alex', 'vie-collective', { label: 'Poubelles', parents: ['espaces'] }, [])
    ajouts.retirer('alex', 'vie-collective', sujet.id)
    expect(ajouts.pourGrille('alex', 'vie-collective')).toEqual([])
  })

  it('emporte ce qui ne tenait qu’à lui', () => {
    // Laisser un sous-sujet rattaché à un parent disparu n’aiderait personne.
    const parent = ajouts.ajouter('alex', 'vie-collective', { label: 'Poubelles', parents: ['espaces'] }, [])
    const enfant = ajouts.ajouter('alex', 'vie-collective', { label: 'Tri', parents: [parent.id] }, [])
    const petit = ajouts.ajouter('alex', 'vie-collective', { label: 'Verre', parents: [enfant.id] }, [])
    const voisin = ajouts.ajouter('alex', 'vie-collective', { label: 'Compost', parents: ['espaces'] }, [])

    ajouts.retirer('alex', 'vie-collective', parent.id)
    const restants = ajouts.pourGrille('alex', 'vie-collective').map((sujet) => sujet.id)
    expect(restants).toEqual([voisin.id])
    expect(restants).not.toContain(enfant.id)
    expect(restants).not.toContain(petit.id)
  })

  it('garde ce qui tient aussi à la grille livrée', () => {
    const parent = ajouts.ajouter('alex', 'vie-collective', { label: 'Poubelles', parents: ['espaces'] }, [])
    const double = ajouts.ajouter('alex', 'vie-collective', { label: 'Tri', parents: [parent.id, 'cuisine'] }, [])
    ajouts.retirer('alex', 'vie-collective', parent.id)
    expect(ajouts.pourGrille('alex', 'vie-collective').map((sujet) => sujet.id)).toEqual([double.id])
  })

  it('repart de zéro si l’entrée est corrompue', () => {
    const stockage = stockageMemoire({ 'cm:ajouts:alex': '{pas du json' })
    expect(creerAjouts(stockage).pourGrille('alex', 'vie-collective')).toEqual([])
  })
})
