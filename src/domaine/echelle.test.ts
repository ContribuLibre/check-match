import { describe, expect, it } from 'vitest'
import {
  composantesDuTriangle, etendueDe, etendueDepuis, normaliserBarycentre, quantile, scoreDe, typeEchelle, zoneDe,
} from './echelle.ts'
import { construireGrille, ErreurGrille } from './grille.ts'
import { calculerValeurs, cle, etoile, type Reponses } from './heritage.ts'
import { proposerDepuis } from './agregation.ts'
import type { GrilleDefinition, PartDefinition } from './types.ts'

const crans: PartDefinition = {
  id: 'avis',
  minColor: '#E00',
  maxColor: '#6F0',
  steps: [{ id: 'non', score: 0 }, { id: 'bof', score: 0.4 }, { id: 'oui', score: 1 }],
}

const tension: PartDefinition = {
  id: 'cadre', kind: 'tension', poles: ['souple', 'prevu'], minColor: '#2A9', maxColor: '#94C',
}

describe('lecture d’une réponse', () => {
  it('lit un cran par son index, et son score irrégulier', () => {
    expect(scoreDe(crans, 1)).toBe(0.4)
    expect(typeEchelle(crans)).toBe('steps')
  })

  it('lit une position telle quelle, et la borne', () => {
    expect(scoreDe(tension, { position: 0.73 })).toBe(0.73)
    expect(scoreDe(tension, { position: 2 })).toBe(1)
    expect(scoreDe(tension, { position: -1 })).toBe(0)
  })

  it('refuse d’interpréter une réponse qui ne va pas avec l’échelle', () => {
    // Traduire un cran en position, ou l’inverse, ferait dire à quelqu’un ce
    // qu’il n’a pas dit.
    expect(scoreDe(tension, 2)).toBeNull()
    expect(scoreDe(crans, { position: 0.5 })).toBeNull()
    expect(scoreDe(crans, 99)).toBeNull()
    expect(scoreDe(crans, undefined)).toBeNull()
  })

  it('remet une étendue dans l’ordre plutôt que de la refuser', () => {
    expect(etendueDe({ position: 0.5, etendue: [0.9, 0.2, 0.6, 0.1] })).toEqual([0.1, 0.2, 0.6, 0.9])
    expect(etendueDe({ position: 0.5 })).toBeUndefined()
  })
})

describe('coordonnées barycentriques', () => {
  it('se normalisent, quelle que soit leur échelle de départ', () => {
    expect(normaliserBarycentre([1, 1, 1])).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(normaliserBarycentre([2, 0, 0])).toEqual([1, 0, 0])
    expect(normaliserBarycentre([0, 0, 0])).toBeNull()
  })

  it('n’ont pas de composante négative', () => {
    expect(normaliserBarycentre([-1, 1, 0])).toEqual([0, 1, 0])
  })
})

describe('zones d’un triangle', () => {
  const zones = [
    { id: 'coin-a', position: [1, 0, 0] as [number, number, number] },
    { id: 'coin-b', position: [0, 1, 0] as [number, number, number] },
    { id: 'milieu', position: [1, 1, 1] as [number, number, number] },
  ]

  it('nomment l’endroit où l’on est tombé', () => {
    expect(zoneDe(zones, [0.9, 0.05, 0.05])).toBe('coin-a')
    expect(zoneDe(zones, [0.34, 0.33, 0.33])).toBe('milieu')
  })

  it('ne nomment rien sans repères : un triangle nu reste un triangle', () => {
    expect(zoneDe(undefined, [1, 1, 1])).toBeNull()
    expect(zoneDe([], [1, 1, 1])).toBeNull()
  })
})

describe('étendue déduite d’une série', () => {
  it('donne les bornes et les déciles', () => {
    const bornes = etendueDepuis([0, 0.5, 1])!
    expect(bornes[0]).toBe(0)
    expect(bornes[3]).toBe(1)
    expect(bornes[1]).toBeGreaterThan(0)
    expect(bornes[2]).toBeLessThan(1)
  })

  it('ne déduit rien d’une seule valeur : une variabilité demande plusieurs cas', () => {
    expect(etendueDepuis([0.4])).toBeUndefined()
    expect(etendueDepuis([])).toBeUndefined()
  })

  it('interpole les quantiles plutôt que de sauter d’une valeur à l’autre', () => {
    expect(quantile([0, 1], 0.5)).toBe(0.5)
    expect(quantile([0, 10], 0.25)).toBe(2.5)
  })
})

// --- une grille complète, avec les trois formes ---------------------------

const definition: GrilleDefinition = {
  schemaVersion: 1,
  id: 'test',
  version: '1',
  defaultLocale: 'fr',
  locales: { fr: './fr.yml' },
  polarities: [{ id: 'general', primary: true }, { id: 'agir', parent: 'general' }],
  parts: [
    crans,
    tension,
    {
      id: 'decider',
      kind: 'triangle',
      poles: ['chacun', 'ensemble', 'delegue'],
      minColor: '#888',
      maxColor: '#BBB',
      zones: [
        { id: 'seul', position: [1, 0, 0] },
        { id: 'a-plusieurs', position: [0, 1, 0] },
      ],
    },
    { id: 'chacun', parent: 'decider', kind: 'continue', minColor: '#333', maxColor: '#E93' },
    { id: 'ensemble', parent: 'decider', kind: 'continue', minColor: '#333', maxColor: '#3B9' },
    { id: 'delegue', parent: 'decider', kind: 'continue', minColor: '#333', maxColor: '#96E' },
  ],
  nodes: [{ id: 'maison', children: [{ id: 'cuisine' }, { id: 'salon' }] }],
}

const grille = construireGrille(definition)
const reponses = (entrees: Record<string, Record<string, unknown>>): Reponses =>
  new Map(Object.entries(entrees)) as Reponses

describe('construction d’une grille à échelles continues', () => {
  it('exige le bon nombre d’extrêmes', () => {
    expect(() => construireGrille({
      ...definition,
      parts: [crans, { ...tension, poles: ['seul'] }],
    })).toThrow(/2 extrêmes/)
  })

  it('exige qu’un triangle ait ses branches pour sommets', () => {
    // Le point placé *est* la répartition : viser autre chose que ses branches
    // ne répartirait rien.
    expect(() => construireGrille({
      ...definition,
      parts: [crans, { id: 'x', kind: 'triangle', poles: ['avis', 'avis', 'avis'], minColor: '#000', maxColor: '#fff' }],
    })).toThrow(ErreurGrille)
  })

  it('exige des crans pour une échelle à crans, et rien pour une continue', () => {
    expect(() => construireGrille({
      ...definition,
      parts: [{ id: 'vide', minColor: '#000', maxColor: '#fff' }],
    })).toThrow(/aucun palier/)
  })
})

describe('un point dans un triangle', () => {
  it('pose ses trois branches d’un coup, et non par héritage', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'maison/general': { decider: { barycentre: [1, 0, 0] } },
    }))
    const etoileMaison = etoile(valeurs, 'maison', 'general')
    expect(etoileMaison.chacun).toMatchObject({ score: 1, poids: 1, origine: 'propre' })
    expect(etoileMaison.ensemble).toMatchObject({ score: 0, poids: 1, origine: 'propre' })
  })

  it('se lit en relief : un sommet vaut 1, pas un tiers', () => {
    expect(composantesDuTriangle(grille.part('decider')!, { barycentre: [2, 1, 1] }))
      .toEqual({ chacun: 1, ensemble: 0.5, delegue: 0.5 })
  })

  it('emporte son amplitude sur les branches qu’il pose', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'maison/general': { decider: { barycentre: [1, 1, 1], amplitude: 0.4 } },
    }))
    expect(etoile(valeurs, 'maison', 'general').chacun?.amplitude).toBe(0.4)
  })

  it('descend ensuite comme n’importe quelle valeur', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'maison/general': { decider: { barycentre: [1, 0, 0] } },
    }))
    expect(etoile(valeurs, 'cuisine', 'general').chacun).toMatchObject({ score: 1, poids: 0.5, origine: 'herite' })
  })

  it('ne dit rien quand il ne pèse rien', () => {
    expect(composantesDuTriangle(grille.part('decider')!, { barycentre: [0, 0, 0] })).toBeNull()
  })
})

describe('une position sur une tension', () => {
  it('vaut réponse posée, et porte son étendue', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'maison/general': { cadre: { position: 0.8, etendue: [0.2, 0.4, 0.9, 1] } },
    }))
    expect(etoile(valeurs, 'maison', 'general').cadre).toEqual({
      score: 0.8, poids: 1, origine: 'propre', detours: 0, etendue: [0.2, 0.4, 0.9, 1],
    })
  })

  it('descend avec le même score et un poids atténué, comme le reste', () => {
    const valeurs = calculerValeurs(grille, reponses({ 'maison/general': { cadre: { position: 0.8 } } }))
    expect(etoile(valeurs, 'cuisine', 'general').cadre).toMatchObject({ score: 0.8, poids: 0.5, origine: 'herite' })
  })
})

describe('remontée d’une rubrique', () => {
  it('déduit la variabilité de ses éléments, pas seulement leur moyenne', () => {
    // Se situer d’un curseur sur chaque élément dit deux choses : où l’on est
    // en général, et à quel point ça dépend des cas.
    const valeurs = calculerValeurs(grille, reponses({
      'cuisine/general': { cadre: { position: 0 } },
      'salon/general': { cadre: { position: 1 } },
    }))
    const proposition = proposerDepuis(grille, valeurs, 'maison', 'general', 'sujets')
    expect(proposition.cadre).toMatchObject({ position: 0.5 })
    expect((proposition.cadre as { etendue: number[] }).etendue[0]).toBe(0)
    expect((proposition.cadre as { etendue: number[] }).etendue[3]).toBe(1)
  })

  it('déduit un triangle du relief de ses trois branches', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'cuisine/general': { decider: { barycentre: [1, 0, 0] } },
      'salon/general': { decider: { barycentre: [0, 1, 0] } },
    }))
    const proposition = proposerDepuis(grille, valeurs, 'maison', 'general', 'sujets')
    const point = (proposition.decider as { barycentre: number[] }).barycentre
    expect(point[0]).toBeCloseTo(point[1]!, 6)
    expect(point[2]).toBe(0)
  })

  it('ne propose pas de cran là où l’échelle n’en a pas', () => {
    const valeurs = calculerValeurs(grille, reponses({ 'cuisine/general': { cadre: { position: 0.3 } } }))
    const proposition = proposerDepuis(grille, valeurs, 'maison', 'general', 'sujets')
    expect(typeof proposition.cadre).toBe('object')
  })
})
