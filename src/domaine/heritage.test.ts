import { describe, expect, it } from 'vitest'
import { construireGrille, ErreurGrille } from './grille.ts'
import { calculerValeurs, cle, etoile, type Reponses } from './heritage.ts'
import { proposerDepuisEnfants } from './agregation.ts'
import type { GrilleDefinition } from './types.ts'

const criteres = [
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

const definition = (noeuds: GrilleDefinition['noeuds'], attenuation?: number): GrilleDefinition => ({
  schemaVersion: 1,
  id: 'test',
  version: '1',
  langueParDefaut: 'fr',
  langues: { fr: './fr.yml' },
  attenuation,
  facettes: [{ id: 'agir', principale: true }, { id: 'recevoir' }],
  criteres,
  noeuds,
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

describe('héritage descendant', () => {
  it('donne aux descendants le même score, avec un poids atténué par niveau', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/agir': { avis: 3 } }))

    expect(etoile(valeurs, 'musique', 'agir').avis).toEqual({ score: 1, poids: 1, origine: 'propre' })
    expect(etoile(valeurs, 'instrument', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
    // Deux niveaux plus bas : le score ne bouge toujours pas, le poids oui.
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 1, poids: 0.25, origine: 'herite' })
  })

  it('laisse une réponse propre l’emporter sur l’héritage', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3 },
      'batterie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 0, poids: 1, origine: 'propre' })
  })

  it('hérite critère par critère, pas étoile par étoile', () => {
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

  it('traite chaque facette séparément', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'chant', 'agir').avis?.poids).toBe(0.5)
    expect(etoile(valeurs, 'chant', 'recevoir').avis?.origine).toBe('absent')
  })

  it('suit l’atténuation déclarée par la grille', () => {
    const douce = construireGrille(definition([{ id: 'a', enfants: [{ id: 'b' }] }], 0.9))
    const valeurs = calculerValeurs(douce, reponses({ 'a/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'b', 'agir').avis?.poids).toBeCloseTo(0.9, 6)
  })
})

describe('héritage depuis plusieurs parents', () => {
  const grille = construireGrille(definition([
    { id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] },
    { id: 'sortie' },
  ]))

  it('prend la moyenne des parents', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'musique/agir': { avis: 3 }, // score 1
      'sortie/agir': { avis: 0 }, // score 0
    }))
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 0.5, poids: 0.5, origine: 'herite' })
  })

  it('pondère la moyenne par le poids de chaque parent', () => {
    // « sortie » répond directement (poids 1), « musique » n’a qu’un héritage
    // lointain : son avis doit peser moins dans la moyenne.
    const profonde = construireGrille(definition([
      { id: 'racine', enfants: [{ id: 'musique', enfants: [{ id: 'concert', parents: ['sortie'] }] }] },
      { id: 'sortie' },
    ]))
    const valeurs = calculerValeurs(profonde, reponses({
      'racine/agir': { avis: 3 }, // musique hérite : score 1, poids 0,5
      'sortie/agir': { avis: 0 }, // score 0, poids 1
    }))
    const avis = etoile(valeurs, 'concert', 'agir').avis
    // (1 × 0,5 + 0 × 1) / 1,5 = 0,333 : plus proche du parent qui a vraiment répondu.
    expect(avis?.score).toBeCloseTo(1 / 3, 6)
  })

  it('ignore un parent sans valeur au lieu de le compter comme zéro', () => {
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite' })
  })
})

describe('remontée depuis les enfants', () => {
  it('propose la moyenne des enfants, calée sur le palier le plus proche', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'instrument/agir': { avis: 3 }, // score 1
      'chant/agir': { avis: 0 }, // score 0
    }))
    // Moyenne 0,5 → palier « ok ».
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({ avis: 2 })
  })

  it('ne compte pas les enfants sans réponse', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'chant/agir': { avis: 3 } }))
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({ avis: 3 })
  })

  it('descend chercher les réponses à n’importe quelle profondeur', () => {
    // « batterie » est deux niveaux sous « musique » : sa réponse compte quand même.
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'batterie/agir': { avis: 3 } }))
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({ avis: 3 })
  })

  it('ne se renvoie pas à elle-même ce qu’elle a diffusé vers le bas', () => {
    // Seule la rubrique a répondu : ses descendants n’ont que des valeurs
    // héritées d’elle. Il n’y a donc rien à remonter, sinon elle se confirmerait
    // toute seule et la proposition n’apprendrait rien.
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/agir': { avis: 3 } }))
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({})
  })

  it('ne propose rien quand aucun enfant n’a de valeur', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({}))
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({})
  })

  it('reste une proposition : la rubrique peut ensuite dire autre chose', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'instrument/agir': { avis: 3 },
      'chant/agir': { avis: 3 },
      'musique/agir': { avis: 0 },
    }))
    expect(proposerDepuisEnfants(grilleSimple, valeurs, 'musique', 'agir')).toEqual({ avis: 3 })
    expect(etoile(valeurs, 'musique', 'agir').avis?.score).toBe(0)
  })
})
