import { describe, expect, it } from 'vitest'
import { augmenterDefinition, augmenterTraduction, estAjoute, identifiantAjout } from './ajouts.ts'
import { construireGrille } from './grille.ts'
import { calculerValeurs, cle, etoile } from './heritage.ts'
import { creerTextes } from './traduction.ts'
import type { GrilleDefinition, Traduction } from './types.ts'

const definition: GrilleDefinition = {
  schemaVersion: 1,
  id: 'test',
  version: '1',
  defaultLocale: 'fr',
  locales: { fr: './fr.yml' },
  polarities: [{ id: 'general', primary: true }, { id: 'agir', parent: 'general' }],
  parts: [{
    id: 'avis',
    minColor: '#E00',
    maxColor: '#6F0',
    steps: [{ id: 'contre', score: 0 }, { id: 'pour', score: 1 }],
  }],
  nodes: [{ id: 'son', children: [{ id: 'musique' }] }],
}

const traduction: Traduction = {
  title: 'Test',
  nodes: { son: { label: 'Son' }, musique: { label: 'Musique' } },
  polarities: { general: { label: 'En général' }, agir: { label: 'Faire' } },
  parts: { avis: { label: 'Avis', steps: { contre: { label: 'Contre' }, pour: { label: 'Pour' } } } },
}

describe('identifiants des sujets ajoutés', () => {
  it('se distinguent des sujets livrés', () => {
    // Sans préfixe, une mise à jour de la grille écraserait un sujet ajouté qui
    // porterait le même nom — ou l’inverse.
    const id = identifiantAjout('Musique', ['musique'])
    expect(id).toBe('+musique')
    expect(estAjoute(id)).toBe(true)
    expect(estAjoute('musique')).toBe(false)
  })

  it('ne se marchent pas dessus entre eux', () => {
    expect(identifiantAjout('Bruit', ['+bruit'])).toBe('+bruit-2')
    expect(identifiantAjout('Bruit', ['+bruit', '+bruit-2'])).toBe('+bruit-3')
  })

  it('restent utilisables même sans un seul caractère exploitable', () => {
    expect(identifiantAjout('!!!', [])).toBe('+sujet')
  })
})

describe('greffe sur une grille', () => {
  const ajout = { id: '+batterie', label: 'Batterie', parents: ['musique'], creeLe: 0 }

  it('rattache le sujet là où on l’a rangé', () => {
    const grille = construireGrille(augmenterDefinition(definition, [ajout]))
    expect(grille.noeuds.get('+batterie')?.parents).toEqual(['musique'])
    expect(grille.noeuds.get('musique')?.enfants).toContain('+batterie')
  })

  it('le fait hériter comme n’importe quel autre sujet', () => {
    const grille = construireGrille(augmenterDefinition(definition, [ajout]))
    const valeurs = calculerValeurs(grille, new Map([[cle('son', 'agir'), { avis: 1 }]]))
    // « son » → « musique » → l’ajout : deux niveaux, poids divisé par quatre.
    expect(etoile(valeurs, '+batterie', 'agir').avis).toEqual({
      score: 1, poids: 0.25, origine: 'herite', detours: 0,
    })
  })

  it('accepte un sujet de premier niveau', () => {
    const grille = construireGrille(augmenterDefinition(definition, [
      { id: '+finances', label: 'Finances', parents: [], creeLe: 0 },
    ]))
    expect(grille.racines).toContain('+finances')
  })

  it('remonte au premier niveau si son parent a disparu de la grille', () => {
    // Plutôt que de refuser de charger : une grille peut évoluer sous les
    // ajouts de quelqu’un qui ne les a pas suivis.
    const grille = construireGrille(augmenterDefinition(definition, [
      { id: '+orphelin', label: 'Orphelin', parents: ['rubrique-supprimee'], creeLe: 0 },
    ]))
    expect(grille.racines).toContain('+orphelin')
  })

  it('accepte qu’un ajout en contienne un autre', () => {
    const grille = construireGrille(augmenterDefinition(definition, [
      { id: '+a', label: 'A', parents: ['son'], creeLe: 0 },
      { id: '+b', label: 'B', parents: ['+a'], creeLe: 0 },
    ]))
    expect(grille.noeuds.get('+b')?.parents).toEqual(['+a'])
  })

  it('ne touche pas la définition d’origine', () => {
    const avant = definition.nodes.length
    augmenterDefinition(definition, [ajout])
    expect(definition.nodes).toHaveLength(avant)
  })
})

describe('libellés des sujets ajoutés', () => {
  it('portent leur texte, sans fichier de langue', () => {
    const ajout = { id: '+batterie', label: 'Batterie', help: 'La mienne', parents: ['musique'], creeLe: 0 }
    const textes = creerTextes(augmenterTraduction(traduction, [ajout]))
    expect(textes.noeud('+batterie')).toBe('Batterie')
    expect(textes.aideNoeud('+batterie')).toBe('La mienne')
  })

  it('valent pour toutes les langues : les traduire n’aurait pas de sens ici', () => {
    const ajout = { id: '+batterie', label: 'Batterie', parents: [], creeLe: 0 }
    const anglais: Traduction = { ...traduction, title: 'Test', nodes: { son: { label: 'Sound' } } }
    const textes = creerTextes(augmenterTraduction(anglais, [ajout]), traduction)
    expect(textes.noeud('son')).toBe('Sound')
    expect(textes.noeud('+batterie')).toBe('Batterie')
  })
})
