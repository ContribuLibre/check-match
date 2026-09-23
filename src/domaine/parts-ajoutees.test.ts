import { describe, expect, it } from 'vitest'
import {
  augmenterDefinitionParts, augmenterTraductionParts, definitionsDe, lireCrans, lirePoles, type PartAjoutee,
} from './parts-ajoutees.ts'
import { construireGrille } from './grille.ts'
import { calculerValeurs, cle, etoile } from './heritage.ts'
import { creerTextes } from './traduction.ts'
import { typeEchelle } from './echelle.ts'
import type { GrilleDefinition, Traduction } from './types.ts'

const definition: GrilleDefinition = {
  schemaVersion: 1,
  id: 'test',
  version: '1',
  defaultLocale: 'fr',
  locales: { fr: './fr.yml' },
  polarities: [{ id: 'general', primary: true }],
  parts: [{
    id: 'avis',
    minColor: '#E00',
    maxColor: '#6F0',
    steps: [{ id: 'non', score: 0 }, { id: 'oui', score: 1 }],
  }],
  nodes: [
    { id: 'maison', children: [{ id: 'cuisine' }] },
    { id: 'dehors' },
  ],
}

const traduction: Traduction = {
  title: 'Test',
  nodes: { maison: { label: 'Maison' }, cuisine: { label: 'Cuisine' }, dehors: { label: 'Dehors' } },
  polarities: { general: { label: 'En général' } },
  parts: { avis: { label: 'Avis', steps: { non: { label: 'Non' }, oui: { label: 'Oui' } } } },
}

const cadre = (nodes?: string[]): PartAjoutee => ({
  id: '+cadre',
  label: 'Cadre',
  kind: 'tension',
  minColor: '#222',
  maxColor: '#ddd',
  poles: [{ id: 'souple', label: 'Souple' }, { id: 'prevu', label: 'Prévu' }],
  ...(nodes ? { nodes } : {}),
  creeLe: 0,
})

describe('valeurs écrites en toutes lettres', () => {
  it('répartit les crans régulièrement quand aucun score n’est écrit', () => {
    expect(lireCrans('Jamais\nParfois\nToujours')).toEqual([
      { id: 'jamais', label: 'Jamais', score: 0 },
      { id: 'parfois', label: 'Parfois', score: 0.5 },
      { id: 'toujours', label: 'Toujours', score: 1 },
    ])
  })

  it('accepte un score écrit à la main : une échelle irrégulière est un choix', () => {
    expect(lireCrans('Non | 0\nBof|0.1\nOui | 1').map((cran) => cran.score)).toEqual([0, 0.1, 1])
  })

  it('ignore les lignes vides et borne les scores hors bornes', () => {
    expect(lireCrans('A | -2\n\n  \nB | 7').map((cran) => cran.score)).toEqual([0, 1])
  })

  it('ne donne jamais deux fois le même identifiant', () => {
    const crans = lireCrans('Oui\nOui')
    expect(crans[0]!.id).not.toBe(crans[1]!.id)
  })

  it('lit les extrêmes de la même façon', () => {
    expect(lirePoles('Au fil de l’eau\nPosé d’avance').map((pole) => pole.id))
      .toEqual(['au-fil-de-l-eau', 'pose-d-avance'])
  })
})

describe('ce qu’une échelle ajoutée produit', () => {
  it('une tension, avec ses deux extrêmes', () => {
    const [part] = definitionsDe(cadre())
    expect(part).toMatchObject({ id: '+cadre', kind: 'tension', poles: ['souple', 'prevu'] })
  })

  it('un triangle, et ses trois branches continues', () => {
    const parts = definitionsDe({
      ...cadre(), kind: 'triangle',
      poles: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    })
    expect(parts).toHaveLength(4)
    expect(parts[0]!.poles).toEqual(['+cadre-1', '+cadre-2', '+cadre-3'])
    // Les branches ne se répondent pas une à une : le point les pose toutes.
    expect(parts.slice(1).every((part) => typeEchelle(part) === 'continue')).toBe(true)
    expect(parts.slice(1).every((part) => part.parent === '+cadre')).toBe(true)
  })
})

describe('greffe d’une échelle sur une grille', () => {
  it('vaut pour toute la grille quand aucun sujet n’est visé', () => {
    const grille = construireGrille(augmenterDefinitionParts(definition, [cadre()]))
    expect(grille.noeuds.get('cuisine')?.parts).toContain('+cadre')
    expect(grille.noeuds.get('dehors')?.parts).toContain('+cadre')
  })

  it('ne concerne que ce qu’on a visé, et ce qu’il contient', () => {
    // Une question particulière appelle souvent une façon de répondre qui
    // n’aurait aucun sens ailleurs.
    const grille = construireGrille(augmenterDefinitionParts(definition, [cadre(['maison'])]))
    expect(grille.noeuds.get('maison')?.parts).toContain('+cadre')
    expect(grille.noeuds.get('cuisine')?.parts).toContain('+cadre')
    expect(grille.noeuds.get('dehors')?.parts).not.toContain('+cadre')
  })

  it('se répond et se transmet comme n’importe quelle part', () => {
    const grille = construireGrille(augmenterDefinitionParts(definition, [cadre()]))
    const valeurs = calculerValeurs(grille, new Map([
      [cle('maison', 'general'), { '+cadre': { position: 0.75 } }],
    ]))
    expect(etoile(valeurs, 'maison', 'general')['+cadre']).toMatchObject({ score: 0.75, origine: 'propre' })
    expect(etoile(valeurs, 'cuisine', 'general')['+cadre']).toMatchObject({ score: 0.75, poids: 0.5 })
  })

  it('ne touche pas la définition d’origine', () => {
    const avant = definition.parts.length
    augmenterDefinitionParts(definition, [cadre()])
    expect(definition.parts).toHaveLength(avant)
  })

  it('porte ses libellés sans fichier de langue', () => {
    const textes = creerTextes(augmenterTraductionParts(traduction, [cadre()]))
    expect(textes.part('+cadre')).toBe('Cadre')
    expect(textes.pole('+cadre', 'souple')).toBe('Souple')
  })

  it('nomme aussi les branches d’un triangle, qui sont des parts', () => {
    const triangle: PartAjoutee = {
      ...cadre(), kind: 'triangle',
      poles: [{ id: 'a', label: 'Chacun' }, { id: 'b', label: 'Ensemble' }, { id: 'c', label: 'Confié' }],
    }
    const textes = creerTextes(augmenterTraductionParts(traduction, [triangle]))
    expect(textes.part('+cadre-2')).toBe('Ensemble')
  })
})
