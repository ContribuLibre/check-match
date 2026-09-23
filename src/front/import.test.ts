import { describe, expect, it } from 'vitest'
import { analyser, ErreurImport } from './import.ts'
import { composerChecklist, composerReponses } from './export.ts'
import { grilleParId } from '../grilles/index.ts'
import { creerGrillesImportees } from '../donnees/grilles-importees.ts'
import { stockageMemoire } from '../donnees/stockage.ts'

const vieCollective = grilleParId('vie-collective')!
const checklist = composerChecklist(vieCollective.definition, vieCollective.traductions, [
  { id: '+poubelles', label: 'Poubelles', parents: ['espaces-communs'], creeLe: 0 },
])

describe('reconnaissance d’un fichier reçu', () => {
  it('distingue une checklist de réponses', () => {
    expect(analyser(checklist).type).toBe('checklist')
    expect(analyser(composerReponses('vie-collective', { version: 1, personne: null, reponses: {} })).type)
      .toBe('reponses')
  })

  it('refuse ce qui n’annonce pas son format', () => {
    // On ne devine pas : un fichier qui ne dit pas ce qu’il est pourrait tout
    // aussi bien être une sauvegarde d’autre chose.
    expect(() => analyser({ nodes: [], polarities: [] })).toThrow(ErreurImport)
    expect(() => analyser(null)).toThrow(ErreurImport)
    expect(() => analyser('{}')).toThrow(ErreurImport)
  })

  it('refuse une checklist qui ne se construit pas, et dit pourquoi', () => {
    // Mieux vaut refuser à l’ouverture qu’afficher une grille qui casse le
    // calcul trois clics plus loin.
    const cassee = {
      ...checklist,
      definition: { ...checklist.definition, nodes: [{ id: 'a', parents: ['fantome'] }] },
    }
    expect(() => analyser(cassee)).toThrow(/parent inconnu/)
  })

  it('refuse des réponses sans contenu', () => {
    expect(() => analyser({ format: 'check-match/reponses', version: 1 })).toThrow(ErreurImport)
  })
})

describe('checklists reçues', () => {
  it('se rangent à côté des grilles livrées', () => {
    const importees = creerGrillesImportees(stockageMemoire())
    importees.ajouter(checklist)
    expect(importees.toutes()).toHaveLength(1)
    expect(importees.toutes()[0]?.definition.id).toBe('vie-collective')
  })

  it('se remplacent au lieu de se dupliquer', () => {
    // Recevoir la même checklist complétée, c’est une mise à jour.
    const importees = creerGrillesImportees(stockageMemoire())
    importees.ajouter(checklist)
    importees.ajouter({ ...checklist, exporteLe: 'plus tard' })
    expect(importees.toutes()).toHaveLength(1)
    expect(importees.toutes()[0]?.exporteLe).toBe('plus tard')
  })

  it('se retirent', () => {
    const importees = creerGrillesImportees(stockageMemoire())
    importees.ajouter(checklist)
    importees.retirer('vie-collective')
    expect(importees.toutes()).toEqual([])
  })

  it('repartent de zéro si l’entrée est corrompue', () => {
    expect(creerGrillesImportees(stockageMemoire({ 'cm:checklists': 'pas du json' })).toutes()).toEqual([])
  })

  it('écartent une entrée sans identifiant plutôt que de tomber dessus plus tard', () => {
    const stockage = stockageMemoire({ 'cm:checklists': JSON.stringify([{ format: 'check-match/checklist' }]) })
    expect(creerGrillesImportees(stockage).toutes()).toEqual([])
  })
})
