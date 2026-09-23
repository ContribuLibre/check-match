import { describe, expect, it } from 'vitest'
import { grilles, grilleParId } from './index.ts'
import { calculerValeurs, cle, etoile } from '../domaine/heritage.ts'
import { clesManquantes } from '../domaine/traduction.ts'

describe('grilles livrées', () => {
  it('se construisent toutes sans erreur', () => {
    expect(grilles.length).toBeGreaterThanOrEqual(2)
    for (const { grille } of grilles) {
      expect(grille.noeuds.size).toBeGreaterThan(0)
      expect(grille.racines.length).toBeGreaterThan(0)
      expect(grille.ordre).toHaveLength(grille.noeuds.size)
    }
  })

  it('traduisent tous leurs nœuds, facettes, critères et paliers', () => {
    for (const { grille, traduction } of grilles) {
      expect(clesManquantes(grille, traduction), `grille « ${grille.id} »`).toEqual([])
    }
  })

  it('gardent des scores ordonnés et bornés à 0..1', () => {
    for (const { grille } of grilles) {
      for (const critere of grille.criteres) {
        const scores = critere.paliers.map((palier) => palier.score)
        expect(scores[0]).toBe(0)
        expect(scores[scores.length - 1]).toBe(1)
        for (const [index, score] of scores.entries()) {
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(1)
          if (index) expect(score).toBeGreaterThan(scores[index - 1] ?? -1)
        }
      }
    }
  })
})

describe('vie collective', () => {
  const disponible = grilleParId('vie-collective')

  it('propose les trois facettes : faire, recevoir, être témoin', () => {
    expect(disponible?.grille.facettes.map((facette) => facette.id)).toEqual(['agir', 'recevoir', 'temoin'])
  })

  it('porte un nœud à deux parents', () => {
    expect(disponible?.grille.noeuds.get('soiree-dansante')?.parents).toEqual(['musique', 'espaces-communs'])
  })

  it('fait descendre une réponse de rubrique jusqu’aux feuilles', () => {
    const grille = disponible!.grille
    const valeurs = calculerValeurs(grille, new Map([[cle('son', 'agir'), { avis: 0 }]]))
    // « son » → « musique » → « instrument » : deux niveaux, poids divisé par quatre.
    expect(etoile(valeurs, 'instrument', 'agir').avis).toEqual({ score: 0, poids: 0.25, origine: 'herite' })
  })

  it('restreint les facettes là où une seule a du sens', () => {
    // On ne « fait » pas du silence comme on fait de la musique.
    expect(disponible?.grille.noeuds.get('silence')?.facettes).toEqual(['recevoir', 'temoin'])
  })
})

describe('grille issue du format historique', () => {
  const disponible = grilleParId('intimite')

  it('reprend la hiérarchie rubrique → élément', () => {
    expect(disponible?.grille.noeuds.get('bodies')?.enfants).toContain('skinny')
    expect(disponible?.grille.noeuds.get('skinny')?.parents).toEqual(['bodies'])
  })

  it('porte les huit critères du modèle de référence', () => {
    expect(disponible?.grille.criteres.map((critere) => critere.id)).toEqual([
      'experience', 'excitment', 'disgust', 'exhibition', 'fear', 'acceptance', 'aftercare', 'explicit',
    ])
  })

  it('garde les scores irréguliers du modèle', () => {
    const acceptance = disponible?.grille.criteres.find((critere) => critere.id === 'acceptance')
    expect(acceptance?.paliers.map((palier) => palier.score)).toEqual([0, 0.1, 0.25, 0.5, 0.6, 0.8, 1])
  })
})
