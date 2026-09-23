import { describe, expect, it } from 'vitest'
import { construireGrille, ErreurGrille } from './grille.ts'
import { calculerValeurs, cle, etoile, type Reponses } from './heritage.ts'
import { proposerDepuis } from './agregation.ts'
import type { GrilleDefinition } from './types.ts'

const parts = [
  {
    id: 'avis',
    couleurMin: '#E00',
    couleurMax: '#6F0',
    paliers: [
      { id: 'contre', score: 0 },
      { id: 'reserve', score: 0.25 },
      { id: 'ok', score: 0.5 },
      { id: 'pour', score: 1 },
    ],
  },
  {
    id: 'importance',
    couleurMin: '#AAA',
    couleurMax: '#F60',
    paliers: [
      { id: 'aucune', score: 0 },
      { id: 'moyenne', score: 0.5 },
      { id: 'forte', score: 1 },
    ],
  },
]

const polarites = [
  { id: 'general', principale: true },
  { id: 'agir', parent: 'general' },
  { id: 'recevoir', parent: 'general' },
]

const definition = (
  noeuds: GrilleDefinition['noeuds'],
  extra: Partial<GrilleDefinition> = {},
): GrilleDefinition => ({
  schemaVersion: 1,
  id: 'test',
  version: '1',
  langueParDefaut: 'fr',
  langues: { fr: './fr.yml' },
  polarites,
  parts,
  noeuds,
  ...extra,
})

const grilleSimple = construireGrille(definition([
  {
    id: 'musique',
    enfants: [
      { id: 'instrument', enfants: [{ id: 'batterie' }] },
      { id: 'chant' },
    ],
  },
]))

const reponses = (entrees: Record<string, Record<string, number>>): Reponses => new Map(Object.entries(entrees))

describe('construction du graphe', () => {
  it('relie les nœuds dans les deux sens et calcule les niveaux', () => {
    expect(grilleSimple.racines).toEqual(['musique'])
    expect(grilleSimple.noeuds.get('musique')?.enfants).toEqual(['instrument', 'chant'])
    expect(grilleSimple.noeuds.get('batterie')?.parents).toEqual(['instrument'])
    expect(grilleSimple.noeuds.get('batterie')?.niveau).toBe(2)
  })

  it('accepte plusieurs parents pour un même nœud', () => {
    const grille = construireGrille(definition([
      { id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] },
      { id: 'sortie' },
    ]))
    expect(grille.noeuds.get('concert')?.parents).toEqual(['musique', 'sortie'])
    expect(grille.noeuds.get('sortie')?.enfants).toEqual(['concert'])
  })

  it('refuse un cycle plutôt que de boucler', () => {
    expect(() => construireGrille(definition([
      { id: 'a', parents: ['b'] },
      { id: 'b', parents: ['a'] },
    ]))).toThrow(ErreurGrille)
  })

  it('refuse un identifiant répété ou un parent inconnu', () => {
    expect(() => construireGrille(definition([{ id: 'a' }, { id: 'a' }]))).toThrow(/défini deux fois/)
    expect(() => construireGrille(definition([{ id: 'a', parents: ['absent'] }]))).toThrow(/parent inconnu/)
  })
})

describe('arbre des polarités', () => {
  it('exige une polarité générale, et une seule', () => {
    expect(grilleSimple.polariteRacine).toBe('general')
    expect(() => construireGrille(definition([{ id: 'a' }], {
      polarites: [{ id: 'agir' }, { id: 'recevoir' }],
    }))).toThrow(/exactement une polarité générale/)
  })

  it('classe les polarités de la générale vers les particulières', () => {
    expect(grilleSimple.ordrePolarites).toEqual(['general', 'agir', 'recevoir'])
    expect(grilleSimple.polarites.get('general')?.enfants).toEqual(['agir', 'recevoir'])
  })

  it('accepte des polarités plus fines que le triptyque', () => {
    const grille = construireGrille(definition([{ id: 'a' }], {
      polarites: [
        { id: 'general' },
        { id: 'agir', parent: 'general' },
        { id: 'agir-seul', parent: 'agir' },
        { id: 'agir-ensemble', parent: 'agir' },
      ],
    }))
    expect(grille.polarites.get('agir-seul')?.niveau).toBe(2)
  })

  it('refuse une polarité coupée de la générale', () => {
    expect(() => construireGrille(definition([{ id: 'a' }], {
      polarites: [{ id: 'general' }, { id: 'perdue', parent: 'inexistante' }],
    }))).toThrow(/parent inconnu/)
  })
})

describe('restriction des polarités', () => {
  const grille = construireGrille(definition([
    {
      id: 'silence',
      polarites: ['recevoir'],
      enfants: [{ id: 'silence-nuit' }],
    },
    { id: 'musique' },
  ]))

  it('garde la polarité englobante, sinon on ne peut plus dégrossir', () => {
    expect(grille.noeuds.get('silence')?.polarites).toEqual(['general', 'recevoir'])
  })

  it('se propage au sous-arbre', () => {
    // Restreindre une rubrique n’aurait aucun sens si ses éléments rouvraient tout.
    expect(grille.noeuds.get('silence-nuit')?.polarites).toEqual(['general', 'recevoir'])
    expect(grille.noeuds.get('musique')?.polarites).toEqual(['general', 'agir', 'recevoir'])
  })
})

describe('héritage dans la direction des sujets', () => {
  it('donne aux descendants le même score, avec un poids atténué par niveau', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/agir': { avis: 3 } }))

    expect(etoile(valeurs, 'musique', 'agir').avis).toEqual({ score: 1, poids: 1, origine: 'propre' })
    expect(etoile(valeurs, 'instrument', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 1, poids: 0.25, origine: 'herite' })
  })

  it('laisse une réponse propre l’emporter sur l’héritage', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3 },
      'batterie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 0, poids: 1, origine: 'propre' })
  })

  it('hérite part par part, pas étoile par étoile', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3, importance: 2 },
      'chant/agir': { avis: 0 },
    }))
    const chant = etoile(valeurs, 'chant', 'agir')
    expect(chant.avis?.origine).toBe('propre')
    expect(chant.importance).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
  })

  it('n’invente rien là où personne n’a répondu', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({}))
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 0, poids: 0, origine: 'absent' })
  })

  it('suit l’atténuation déclarée par la grille', () => {
    const douce = construireGrille(definition([{ id: 'a', enfants: [{ id: 'b' }] }], { attenuation: 0.9 }))
    const valeurs = calculerValeurs(douce, reponses({ 'a/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'b', 'agir').avis?.poids).toBeCloseTo(0.9, 6)
  })
})

describe('héritage dans la direction des polarités', () => {
  it('fait descendre le général vers chaque place, avec un poids atténué', () => {
    // Dégrossir en général doit renseigner d’un coup faire, recevoir, assister.
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/general': { avis: 3 } }))

    expect(etoile(valeurs, 'musique', 'general').avis).toEqual({ score: 1, poids: 1, origine: 'propre' })
    expect(etoile(valeurs, 'musique', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
    expect(etoile(valeurs, 'musique', 'recevoir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
  })

  it('laisse une place particulière contredire le général', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/general': { avis: 3 },
      'musique/recevoir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'musique', 'agir').avis?.score).toBe(1)
    expect(etoile(valeurs, 'musique', 'recevoir').avis).toEqual({ score: 0, poids: 1, origine: 'propre' })
  })

  it('combine les deux sens sur un sous-nœud', () => {
    // « instrument/agir » n’a ni réponse propre, ni parent direct répondu sur
    // « agir » : il hérite de musique/agir (lui-même hérité du général).
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/general': { avis: 3 } }))
    const instrument = etoile(valeurs, 'instrument', 'agir').avis
    expect(instrument?.origine).toBe('herite')
    expect(instrument?.score).toBe(1)
    // Deux franchissements : un de polarité, un de sujet.
    expect(instrument?.poids).toBeCloseTo(0.25, 6)
  })

  it('suit sa propre atténuation, distincte de celle des sujets', () => {
    const grille = construireGrille(definition([{ id: 'a' }], { attenuationPolarite: 0.8 }))
    const valeurs = calculerValeurs(grille, reponses({ 'a/general': { avis: 3 } }))
    expect(etoile(valeurs, 'a', 'agir').avis?.poids).toBeCloseTo(0.8, 6)
  })
})

describe('héritage depuis plusieurs parents', () => {
  const grille = construireGrille(definition([
    { id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] },
    { id: 'sortie' },
  ]))

  it('prend la moyenne des parents', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'musique/agir': { avis: 3 },
      'sortie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 0.5, poids: 0.5, origine: 'herite' })
  })

  it('pondère la moyenne par le poids de chaque parent', () => {
    const profonde = construireGrille(definition([
      { id: 'racine', enfants: [{ id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] }] },
      { id: 'sortie' },
    ]))
    const valeurs = calculerValeurs(profonde, reponses({
      'racine/agir': { avis: 3 },
      'sortie/agir': { avis: 0 },
    }))
    // musique hérite (poids 0,5) ; sortie a répondu (poids 1) : sortie pèse plus.
    expect(etoile(valeurs, 'concert', 'agir').avis?.score).toBeCloseTo(1 / 3, 6)
  })

  it('ignore un parent sans valeur au lieu de le compter comme zéro', () => {
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
  })
})

describe('agrégateurs configurables', () => {
  const avecAgregation = (nom: 'min' | 'max' | 'mediane') => construireGrille(definition([
    { id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] },
    { id: 'sortie' },
  ], { agregation: { heritage: nom, remontee: nom } }))

  it('résume un héritage multi-parents par le minimum', () => {
    // Une limite : c’est le parent le plus restrictif qui contraint.
    const valeurs = calculerValeurs(avecAgregation('min'), reponses({
      'musique/agir': { avis: 3 },
      'sortie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'concert', 'agir').avis?.score).toBe(0)
  })

  it('ou par le maximum', () => {
    const valeurs = calculerValeurs(avecAgregation('max'), reponses({
      'musique/agir': { avis: 3 },
      'sortie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'concert', 'agir').avis?.score).toBe(1)
  })

  it('se surcharge part par part', () => {
    const grille = construireGrille(definition([{ id: 'musique', enfants: [{ id: 'chant' }] }], {
      parts: [
        { ...parts[0]!, agregation: { remontee: 'min' } },
        parts[1]!,
      ],
    }))
    expect(grille.agregationDe('avis', 'remontee')).toBe('min')
    expect(grille.agregationDe('importance', 'remontee')).toBe('moyenne')
    expect(grille.agregationDe('avis', 'heritage')).toBe('moyenne')
  })

  it('refuse un agrégateur inconnu', () => {
    expect(() => construireGrille(definition([{ id: 'a' }], {
      agregation: { heritage: 'mediane-ponderee' as never },
    }))).toThrow(/inconnu/)
  })
})

describe('remontée', () => {
  it('résume une rubrique d’après ses éléments', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'instrument/agir': { avis: 3 },
      'chant/agir': { avis: 0 },
    }))
    // Moyenne 0,5 → palier « ok ».
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 2 })
  })

  it('descend chercher les réponses à n’importe quelle profondeur', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'batterie/agir': { avis: 3 } }))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 3 })
  })

  it('déduit le général de ce qui a été dit à chaque place', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3 },
      'musique/recevoir': { avis: 0 },
    }))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'general', 'polarites')).toEqual({ avis: 2 })
  })

  it('résume selon l’agrégateur demandé', () => {
    const grille = construireGrille(definition([{ id: 'musique', enfants: [{ id: 'chant' }, { id: 'cor' }] }], {
      agregation: { remontee: 'min' },
    }))
    const valeurs = calculerValeurs(grille, reponses({
      'chant/agir': { avis: 3 },
      'cor/agir': { avis: 0 },
    }))
    // Le minimum, et non la moyenne : une seule limite basse contraint l’ensemble.
    expect(proposerDepuis(grille, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 0 })
  })

  it('ne se renvoie pas à elle-même ce qu’elle a diffusé vers le bas', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/agir': { avis: 3 } }))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'agir', 'sujets')).toEqual({})
  })

  it('ne propose rien quand rien n’a été répondu en dessous', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({}))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'general')).toEqual({})
  })

  it('reste une proposition : le nœud peut ensuite dire autre chose', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'instrument/agir': { avis: 3 },
      'chant/agir': { avis: 3 },
      'musique/agir': { avis: 0 },
    }))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 3 })
    expect(etoile(valeurs, 'musique', 'agir').avis?.score).toBe(0)
  })
})
