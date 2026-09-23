import { describe, expect, it } from 'vitest'
import { comparer, ecartsParPart, niveauMoyen, ordonnerParProximite } from './comparaison.ts'
import { construireGrille } from './grille.ts'
import { calculerValeurs, cle, type Reponses } from './heritage.ts'
import type { GrilleDefinition } from './types.ts'

const definition: GrilleDefinition = {
  schemaVersion: 1,
  id: 'test',
  version: '1',
  defaultLocale: 'fr',
  locales: { fr: './fr.yml' },
  weightBy: 'importance',
  polarities: [
    { id: 'general', primary: true },
    { id: 'agir', parent: 'general', reciprocal: 'recevoir' },
    { id: 'recevoir', parent: 'general', reciprocal: 'agir' },
  ],
  parts: [
    {
      id: 'avis',
      minColor: '#E00',
      maxColor: '#6F0',
      steps: [{ id: 'non', score: 0 }, { id: 'bof', score: 0.5 }, { id: 'oui', score: 1 }],
    },
    {
      id: 'importance',
      minColor: '#BBB',
      maxColor: '#F60',
      steps: [{ id: 'nulle', score: 0 }, { id: 'forte', score: 1 }],
    },
  ],
  nodes: [{ id: 'menage' }, { id: 'musique' }],
}

const grille = construireGrille(definition)
const reponses = (entrees: Record<string, Record<string, number>>): Reponses => new Map(Object.entries(entrees))
const valeursDe = (entrees: Record<string, Record<string, number>>) => calculerValeurs(grille, reponses(entrees))
const accord = (a: Parameters<typeof valeursDe>[0], b: Parameters<typeof valeursDe>[0]) =>
  comparer(grille, valeursDe(a), valeursDe(b), 'importance')

describe('accord entre deux personnes', () => {
  it('est parfait quand les deux disent la même chose', () => {
    const resultat = accord({ 'menage/general': { avis: 2 } }, { 'menage/general': { avis: 2 } })
    expect(resultat.global).toBe(1)
  })

  it('est nul quand les deux s’opposent complètement', () => {
    const resultat = accord({ 'menage/general': { avis: 2 } }, { 'menage/general': { avis: 0 } })
    expect(resultat.global).toBe(0)
  })

  it('ne compare que ce qui est renseigné des deux côtés', () => {
    // Un profil à moitié rempli se compare sur sa moitié, sans rien inventer.
    const resultat = accord(
      { 'menage/general': { avis: 2 }, 'musique/general': { avis: 0 } },
      { 'menage/general': { avis: 2 } },
    )
    expect(resultat.global).toBe(1)
    expect(resultat.parts.find((part) => part.part === 'avis')?.comparaisons).toBe(3)
  })

  it('ne compare rien du tout quand rien ne se recoupe', () => {
    const resultat = accord({ 'menage/general': { avis: 2 } }, { 'musique/general': { avis: 2 } })
    expect(resultat.global).toBeNull()
    expect(resultat.comparaisons).toBe(0)
  })
})

describe('se répondre plutôt que se ressembler', () => {
  it('vaut mieux que la même chose des deux côtés', () => {
    // Deux qui veulent faire se disputent la tâche ; l’un qui fait et l’autre
    // qui reçoit s’accordent.
    const complementaires = accord(
      { 'menage/agir': { avis: 2 }, 'menage/recevoir': { avis: 0 } },
      { 'menage/agir': { avis: 0 }, 'menage/recevoir': { avis: 2 } },
    )
    const identiques = accord(
      { 'menage/agir': { avis: 2 }, 'menage/recevoir': { avis: 0 } },
      { 'menage/agir': { avis: 2 }, 'menage/recevoir': { avis: 0 } },
    )
    expect(complementaires.global!).toBeGreaterThan(identiques.global!)
  })

  it('se note comme telle, pour pouvoir le montrer', () => {
    const resultat = accord(
      { 'menage/agir': { avis: 2 }, 'menage/recevoir': { avis: 0 } },
      { 'menage/agir': { avis: 0 }, 'menage/recevoir': { avis: 2 } },
    )
    expect(resultat.parts.find((part) => part.part === 'avis')!.complementarite).toBeGreaterThan(0)
  })

  it('ne s’invente pas là où aucune place ne se répond', () => {
    const sansReciproque = construireGrille({
      ...definition,
      polarities: [{ id: 'general', primary: true }, { id: 'agir', parent: 'general' }],
    })
    const resultat = comparer(
      sansReciproque,
      calculerValeurs(sansReciproque, reponses({ 'menage/agir': { avis: 2 } })),
      calculerValeurs(sansReciproque, reponses({ 'menage/agir': { avis: 0 } })),
      'importance',
    )
    expect(resultat.parts.find((part) => part.part === 'avis')!.complementarite).toBe(0)
  })
})

describe('ce qui pèse dans la comparaison', () => {
  it('donne plus de poids à un désaccord sur ce qui compte', () => {
    const surUnSujetVital = accord(
      { 'menage/general': { avis: 2, importance: 1 } },
      { 'menage/general': { avis: 0, importance: 1 } },
    )
    const surUnSujetIndifferent = accord(
      { 'menage/general': { avis: 2, importance: 0 } },
      { 'menage/general': { avis: 0, importance: 0 } },
    )
    expect(surUnSujetVital.poids).toBeGreaterThan(surUnSujetIndifferent.poids)
  })

  it('suffit qu’un seul des deux y tienne : c’est là que ça coince', () => {
    const unSeulYTient = accord(
      { 'menage/general': { avis: 2, importance: 1 } },
      { 'menage/general': { avis: 0, importance: 0 } },
    )
    const personne = accord(
      { 'menage/general': { avis: 2, importance: 0 } },
      { 'menage/general': { avis: 0, importance: 0 } },
    )
    expect(unSeulYTient.poids).toBeGreaterThan(personne.poids)
  })

  it('ne compte pas la part qui pondère comme un critère d’accord', () => {
    // Elle dit ce qui compte, pas ce qu’on veut.
    const resultat = accord({ 'menage/general': { importance: 1 } }, { 'menage/general': { importance: 0 } })
    expect(resultat.parts.map((part) => part.part)).not.toContain('importance')
  })
})

describe('écarts observés', () => {
  it('retient le plus petit et le plus grand, par part', () => {
    const resultat = accord(
      { 'menage/general': { avis: 2 }, 'musique/general': { avis: 2 } },
      { 'menage/general': { avis: 2 }, 'musique/general': { avis: 0 } },
    )
    const avis = resultat.parts.find((part) => part.part === 'avis')!
    expect(avis.ecartMin).toBe(0)
    expect(avis.ecartMax).toBe(1)
  })

  it('se cumulent sur plusieurs couples', () => {
    const premier = accord({ 'menage/general': { avis: 2 } }, { 'menage/general': { avis: 2 } })
    const second = accord({ 'menage/general': { avis: 2 } }, { 'menage/general': { avis: 0 } })
    expect(ecartsParPart([premier, second]).get('avis')).toEqual({ min: 0, max: 1 })
  })
})

describe('niveau moyen d’une personne', () => {
  it('pondère par le poids : une valeur héritée de loin compte moins', () => {
    expect(niveauMoyen(grille, valeursDe({ 'menage/general': { avis: 2 } }), 'avis')).toBe(1)
    expect(niveauMoyen(grille, valeursDe({}), 'avis')).toBeNull()
  })
})

describe('ordre des colonnes', () => {
  it('laisse tel quel en dessous de trois profils', () => {
    expect(ordonnerParProximite(['a', 'b'], () => 1)).toEqual(['a', 'b'])
  })

  it('met côte à côte ce qui se ressemble', () => {
    // « a » et « c » se ressemblent, « b » est à part : il ne doit pas se
    // retrouver entre les deux.
    const proximites: Record<string, number> = { 'a|c': 0.9, 'a|b': 0.2, 'b|c': 0.3 }
    const ordre = ordonnerParProximite(['a', 'b', 'c'], (x, y) => proximites[[x, y].sort().join('|')] ?? 0)
    expect(ordre.indexOf('b')).not.toBe(1)
    expect(Math.abs(ordre.indexOf('a') - ordre.indexOf('c'))).toBe(1)
  })

  it('garde tout le monde, sans doublon', () => {
    const ordre = ordonnerParProximite(['a', 'b', 'c', 'd'], () => 0.5)
    expect(new Set(ordre)).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(ordre).toHaveLength(4)
  })
})
