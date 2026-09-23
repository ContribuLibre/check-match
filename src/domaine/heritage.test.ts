import { describe, expect, it } from 'vitest'
import { construireGrille, ErreurGrille } from './grille.ts'
import { calculerValeurs, cle, etoile, type Reponses } from './heritage.ts'
import { proposerDepuis } from './agregation.ts'
import type { GrilleDefinition } from './types.ts'

const parts = [
  {
    id: 'avis',
    minColor: '#E00',
    maxColor: '#6F0',
    steps: [
      { id: 'contre', score: 0 },
      { id: 'reserve', score: 0.25 },
      { id: 'ok', score: 0.5 },
      { id: 'pour', score: 1 },
    ],
  },
  {
    id: 'importance',
    minColor: '#AAA',
    maxColor: '#F60',
    steps: [
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
  noeuds: GrilleDefinition['nodes'],
  extra: Partial<GrilleDefinition> = {},
): GrilleDefinition => ({
  schemaVersion: 1,
  id: 'test',
  version: '1',
  defaultLocale: 'fr',
  locales: { fr: './fr.yml' },
  polarities: polarites,
  parts,
  nodes: noeuds,
  ...extra,
})

const grilleSimple = construireGrille(definition([
  {
    id: 'musique',
    children: [
      { id: 'instrument', children: [{ id: 'batterie' }] },
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
      { id: 'musique', children: [{ id: 'concert', parents: ['sortie'] }] },
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
      polarities: [{ id: 'agir' }, { id: 'recevoir' }],
    }))).toThrow(/exactement une polarité générale/)
  })

  it('classe les polarités de la générale vers les particulières', () => {
    expect(grilleSimple.ordrePolarites).toEqual(['general', 'agir', 'recevoir'])
    expect(grilleSimple.polarites.get('general')?.enfants).toEqual(['agir', 'recevoir'])
  })

  it('accepte des polarités plus fines que le triptyque', () => {
    const grille = construireGrille(definition([{ id: 'a' }], {
      polarities: [
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
      polarities: [{ id: 'general' }, { id: 'perdue', parent: 'inexistante' }],
    }))).toThrow(/parent inconnu/)
  })
})

describe('restriction des polarités', () => {
  const grille = construireGrille(definition([
    {
      id: 'silence',
      polarities: ['recevoir'],
      children: [{ id: 'silence-nuit' }],
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

    expect(etoile(valeurs, 'musique', 'agir').avis).toEqual({ score: 1, poids: 1, origine: 'propre', detours: 0 })
    expect(etoile(valeurs, 'instrument', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 0 })
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 1, poids: 0.25, origine: 'herite', detours: 0 })
  })

  it('laisse une réponse propre l’emporter sur l’héritage', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3 },
      'batterie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 0, poids: 1, origine: 'propre', detours: 0 })
  })

  it('hérite part par part, pas étoile par étoile', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/agir': { avis: 3, importance: 2 },
      'chant/agir': { avis: 0 },
    }))
    const chant = etoile(valeurs, 'chant', 'agir')
    expect(chant.avis?.origine).toBe('propre')
    expect(chant.importance).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 0 })
  })

  it('n’invente rien là où personne n’a répondu', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({}))
    expect(etoile(valeurs, 'batterie', 'agir').avis).toEqual({ score: 0, poids: 0, origine: 'absent', detours: 0 })
  })

  it('suit l’atténuation déclarée par la grille', () => {
    const douce = construireGrille(definition([{ id: 'a', children: [{ id: 'b' }] }], { attenuation: 0.9 }))
    const valeurs = calculerValeurs(douce, reponses({ 'a/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'b', 'agir').avis?.poids).toBeCloseTo(0.9, 6)
  })
})

describe('héritage dans la direction des polarités', () => {
  it('fait descendre le général vers chaque place, avec un poids atténué', () => {
    // Dégrossir en général doit renseigner d’un coup faire, recevoir, assister.
    const valeurs = calculerValeurs(grilleSimple, reponses({ 'musique/general': { avis: 3 } }))

    expect(etoile(valeurs, 'musique', 'general').avis).toEqual({ score: 1, poids: 1, origine: 'propre', detours: 0 })
    // Un détour : on a changé de place.
    expect(etoile(valeurs, 'musique', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 1 })
    expect(etoile(valeurs, 'musique', 'recevoir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 1 })
  })

  it('laisse une place particulière contredire le général', () => {
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'musique/general': { avis: 3 },
      'musique/recevoir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'musique', 'agir').avis?.score).toBe(1)
    expect(etoile(valeurs, 'musique', 'recevoir').avis).toEqual({ score: 0, poids: 1, origine: 'propre', detours: 0 })
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
    const grille = construireGrille(definition([{ id: 'a' }], { polarityAttenuation: 0.8 }))
    const valeurs = calculerValeurs(grille, reponses({ 'a/general': { avis: 3 } }))
    expect(etoile(valeurs, 'a', 'agir').avis?.poids).toBeCloseTo(0.8, 6)
  })
})

describe('remontée des places vers la polarité qui les englobe', () => {
  const avecTemoin: GrilleDefinition['polarities'] = [
    { id: 'general', primary: true },
    { id: 'agir', parent: 'general' },
    { id: 'recevoir', parent: 'general' },
    { id: 'temoin', parent: 'general' },
  ]
  const grille = construireGrille(definition([
    { id: 'musique', children: [{ id: 'instrument' }] },
  ], { polarities: avecTemoin }))

  it('déduit le général de ce qu’on a dit à chaque place', () => {
    // Répondre place par place doit renseigner le général : il sert autant à
    // résumer après qu’à dégrossir avant.
    const valeurs = calculerValeurs(grille, reponses({
      'musique/agir': { avis: 3 },
      'musique/recevoir': { avis: 3 },
    }))
    expect(etoile(valeurs, 'musique', 'general').avis)
      .toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 1 })
  })

  it('laisse une réponse posée sur le général l’emporter', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'musique/general': { avis: 0 },
      'musique/agir': { avis: 3 },
    }))
    expect(etoile(valeurs, 'musique', 'general').avis)
      .toEqual({ score: 0, poids: 1, origine: 'propre', detours: 0 })
  })

  it('redescend vers les places restées vides', () => {
    // Sinon le nœud en saurait moins que ses propres sous-nœuds, qui héritent
    // du général, eux.
    const valeurs = calculerValeurs(grille, reponses({
      'musique/agir': { avis: 3 },
      'musique/recevoir': { avis: 3 },
    }))
    expect(etoile(valeurs, 'musique', 'temoin').avis)
      .toEqual({ score: 1, poids: 0.25, origine: 'herite', detours: 2 })
  })

  it('vaut ensuite pour les sous-nœuds', () => {
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'instrument', 'general').avis)
      .toEqual({ score: 1, poids: 0.25, origine: 'herite', detours: 1 })
  })

  it('suit l’agrégateur de remontée de la part', () => {
    // Deux places qui divergent : ce qui ressort n’est pas la même chose selon
    // qu’on résume une limite ou une envie.
    const divergent = { 'musique/agir': { avis: 3 }, 'musique/recevoir': { avis: 0 } }
    const auMin = construireGrille(definition([{ id: 'musique' }], {
      polarities: avecTemoin,
      parts: [{ ...parts[0]!, aggregation: { rollup: 'min' } }],
    }))
    const auMax = construireGrille(definition([{ id: 'musique' }], {
      polarities: avecTemoin,
      parts: [{ ...parts[0]!, aggregation: { rollup: 'max' } }],
    }))
    expect(etoile(calculerValeurs(auMin, reponses(divergent)), 'musique', 'general').avis?.score).toBe(0)
    expect(etoile(calculerValeurs(auMax, reponses(divergent)), 'musique', 'general').avis?.score).toBe(1)
  })

  it('ne remonte pas pour autant dans la direction des sujets', () => {
    // Résumer une rubrique d’après ses éléments reste une prise de position
    // qu’on accepte d’un geste, pas un calcul qui se fait tout seul.
    const valeurs = calculerValeurs(grille, reponses({ 'instrument/agir': { avis: 3 } }))
    expect(etoile(valeurs, 'instrument', 'general').avis?.origine).toBe('herite')
    expect(etoile(valeurs, 'musique', 'general').avis?.poids ?? 0).toBe(0)
  })
})

describe('héritage depuis plusieurs parents', () => {
  const grille = construireGrille(definition([
    { id: 'musique', children: [{ id: 'concert', parents: ['sortie'] }] },
    { id: 'sortie' },
  ]))

  it('prend la moyenne des parents', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'musique/agir': { avis: 3 },
      'sortie/agir': { avis: 0 },
    }))
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 0.5, poids: 0.5, origine: 'herite', detours: 0 })
  })

  it('pondère la moyenne par le poids de chaque parent', () => {
    const profonde = construireGrille(definition([
      { id: 'racine', children: [{ id: 'musique', children: [{ id: 'concert', parents: ['sortie'] }] }] },
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
    expect(etoile(valeurs, 'concert', 'agir').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 0 })
  })
})

describe('agrégateurs configurables', () => {
  const avecAgregation = (nom: 'min' | 'max' | 'mediane') => construireGrille(definition([
    { id: 'musique', children: [{ id: 'concert', parents: ['sortie'] }] },
    { id: 'sortie' },
  ], { aggregation: { inheritance: nom, rollup: nom } }))

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
    const grille = construireGrille(definition([{ id: 'musique', children: [{ id: 'chant' }] }], {
      parts: [
        { ...parts[0]!, aggregation: { rollup: 'min' } },
        parts[1]!,
      ],
    }))
    expect(grille.agregationDe('avis', 'rollup')).toBe('min')
    // Les autres suivent le défaut, qui n’est pas le même dans les deux sens.
    expect(grille.agregationDe('importance', 'rollup')).toBe('max')
    expect(grille.agregationDe('avis', 'inheritance')).toBe('moyenne')
  })

  it('refuse un agrégateur inconnu', () => {
    expect(() => construireGrille(definition([{ id: 'a' }], {
      aggregation: { inheritance: 'mediane-ponderee' as never },
    }))).toThrow(/inconnu/)
  })
})

describe('remontée', () => {
  it('résume une rubrique par ce qui en ressort, et non par la moyenne', () => {
    // Un seul élément auquel on tient rend la rubrique tenue ; la moyenne
    // l’effacerait sous ceux qui laissent indifférent.
    const valeurs = calculerValeurs(grilleSimple, reponses({
      'instrument/agir': { avis: 3 },
      'chant/agir': { avis: 0 },
    }))
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 3 })
  })

  it('suit la moyenne quand la grille la demande', () => {
    const grille = construireGrille(definition([
      { id: 'musique', children: [{ id: 'instrument' }, { id: 'chant' }] },
    ], { aggregation: { rollup: 'moyenne' } }))
    const valeurs = calculerValeurs(grille, reponses({
      'instrument/agir': { avis: 3 },
      'chant/agir': { avis: 0 },
    }))
    // Moyenne 0,5 → palier « ok ».
    expect(proposerDepuis(grille, valeurs, 'musique', 'agir', 'sujets')).toEqual({ avis: 2 })
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
    expect(proposerDepuis(grilleSimple, valeurs, 'musique', 'general', 'polarites')).toEqual({ avis: 3 })
  })

  it('résume selon l’agrégateur demandé', () => {
    const grille = construireGrille(definition([{ id: 'musique', children: [{ id: 'chant' }, { id: 'cor' }] }], {
      aggregation: { rollup: 'min' },
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

describe('héritage dans la direction des parts', () => {
  // « rapide » regroupe « avis » et « importance », et déclare comment elle se
  // répartit : tout vers l’avis, rien vers l’importance.
  const avecRegroupement = (spread?: Record<string, number>) => construireGrille(definition(
    [{ id: 'musique', children: [{ id: 'chant' }] }],
    {
      parts: [
        { id: 'rapide', minColor: '#888', maxColor: '#ccc', spread, steps: parts[0]!.steps },
        { ...parts[0]!, parent: 'rapide' },
        { ...parts[1]!, parent: 'rapide' },
      ],
    },
  ))

  it('ne descend nulle part sans répartition déclarée', () => {
    // Aucune répartition n’allant de soi, cocher « en gros » ne doit rien
    // inventer sur des branches qui ne parlent pas de la même chose.
    const grille = avecRegroupement(undefined)
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { rapide: 3 } }))
    expect(etoile(valeurs, 'musique', 'agir').rapide?.origine).toBe('propre')
    expect(etoile(valeurs, 'musique', 'agir').avis?.origine).toBe('absent')
  })

  it('vise une seule branche, les autres restant non renseignées', () => {
    const grille = avecRegroupement({ avis: 1 })
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { rapide: 3 } }))
    const etoileMusique = etoile(valeurs, 'musique', 'agir')
    expect(etoileMusique.avis).toEqual({ score: 1, poids: 1, origine: 'herite', detours: 1 })
    expect(etoileMusique.importance?.origine).toBe('absent')
  })

  it('pondère différemment chaque branche', () => {
    const grille = avecRegroupement({ avis: 1, importance: 0.25 })
    const etoileMusique = etoile(
      calculerValeurs(grille, reponses({ 'musique/agir': { rapide: 3 } })), 'musique', 'agir',
    )
    expect(etoileMusique.avis?.poids).toBe(1)
    expect(etoileMusique.importance?.poids).toBe(0.25)
    // Même score : seule la force de l’héritage change.
    expect(etoileMusique.importance?.score).toBe(1)
  })

  it('remonte des branches vers le regroupement, au maximum par défaut', () => {
    const grille = avecRegroupement({ avis: 1 })
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { avis: 0, importance: 2 } }))
    // avis = 0, importance = 1 → le regroupement retient ce qui ressort.
    expect(etoile(valeurs, 'musique', 'agir').rapide?.score).toBe(1)
  })

  it('laisse une réponse posée sur le regroupement l’emporter sur la remontée', () => {
    const grille = avecRegroupement({ avis: 1 })
    const valeurs = calculerValeurs(grille, reponses({ 'musique/agir': { rapide: 0, importance: 2 } }))
    expect(etoile(valeurs, 'musique', 'agir').rapide).toEqual({ score: 0, poids: 1, origine: 'propre', detours: 0 })
  })

  it('refuse une répartition vers une part qui n’est pas une fille', () => {
    expect(() => avecRegroupement({ inexistante: 1 })).toThrow(/part inconnue/)
  })
})

describe('le plus court chemin d’abord', () => {
  const grille = construireGrille(definition([
    { id: 'son', children: [{ id: 'musique', children: [{ id: 'chant' }] }] },
  ]))

  it('préfère l’héritage par sujet à l’héritage par polarité, même de plus loin', () => {
    // « son/recevoir » est répondu, donc chant/recevoir peut l’hériter par les
    // sujets (deux niveaux, aucun détour). « chant/general » est aussi répondu
    // et donnerait un poids plus fort, mais en changeant de place : aimer
    // recevoir en dit plus long sur le fait de recevoir autre chose que sur
    // l’envie de produire.
    const valeurs = calculerValeurs(grille, reponses({
      'son/recevoir': { avis: 3 },
      'chant/general': { avis: 0 },
    }))
    const chant = etoile(valeurs, 'chant', 'recevoir').avis
    expect(chant?.detours).toBe(0)
    expect(chant?.score).toBe(1)
  })

  it('accepte le détour quand rien de plus court n’existe', () => {
    // Rien sur la polarité « recevoir » : faute de mieux, on prend le général.
    const valeurs = calculerValeurs(grille, reponses({ 'chant/general': { avis: 3 } }))
    const chant = etoile(valeurs, 'chant', 'recevoir').avis
    expect(chant?.detours).toBe(1)
    expect(chant?.score).toBe(1)
  })

  it('ne noie pas une source directe dans une source détournée', () => {
    const valeurs = calculerValeurs(grille, reponses({
      'musique/recevoir': { avis: 3 }, // score 1, sans détour
      'chant/general': { avis: 0 }, // score 0, un détour
    }))
    // La moyenne des deux donnerait 0,5 : c’est exactement ce qu’on refuse.
    expect(etoile(valeurs, 'chant', 'recevoir').avis?.score).toBe(1)
  })
})
