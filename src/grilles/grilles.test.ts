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

  it('traduisent tous leurs nœuds, polarites, parts et paliers', () => {
    for (const { grille, traduction } of grilles) {
      expect(clesManquantes(grille, traduction), `grille « ${grille.id} »`).toEqual([])
    }
  })

  it('gardent des scores ordonnés et bornés à 0..1', () => {
    for (const { grille } of grilles) {
      for (const part of grille.parts) {
        const scores = part.steps.map((palier) => palier.score)
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

  it('propose le général puis les trois places', () => {
    expect([...(disponible?.grille.polarites.keys() ?? [])]).toEqual(['general', 'agir', 'recevoir', 'temoin'])
    expect(disponible?.grille.polariteRacine).toBe('general')
  })

  it('fait descendre le général vers chaque place', () => {
    const grille = disponible!.grille
    const valeurs = calculerValeurs(grille, new Map([[cle('musique', 'general'), { avis: 4 }]]))
    expect(etoile(valeurs, 'musique', 'temoin').avis).toEqual({ score: 1, poids: 0.5, origine: 'herite', detours: 1 })
  })

  it('résume l’importance par le maximum, pas par la moyenne', () => {
    // Un seul sujet vital rend la rubrique vitale ; la moyenne l’effacerait.
    expect(disponible?.grille.agregationDe('importance', 'rollup')).toBe('max')
    expect(disponible?.grille.agregationDe('avis', 'rollup')).toBe('moyenne')
  })

  it('porte un nœud à deux parents', () => {
    expect(disponible?.grille.noeuds.get('soiree-dansante')?.parents).toEqual(['musique', 'espaces-communs'])
  })

  it('fait descendre une réponse de rubrique jusqu’aux feuilles', () => {
    const grille = disponible!.grille
    const valeurs = calculerValeurs(grille, new Map([[cle('son', 'agir'), { avis: 0 }]]))
    // « son » → « musique » → « instrument » : deux niveaux, poids divisé par quatre.
    expect(etoile(valeurs, 'instrument', 'agir').avis).toEqual({ score: 0, poids: 0.25, origine: 'herite', detours: 0 })
  })

  it('restreint les polarités là où une place n’a pas de sens, en gardant le général', () => {
    // On ne « fait » pas du silence comme on fait de la musique.
    expect(disponible?.grille.noeuds.get('silence')?.polarites).toEqual(['general', 'recevoir', 'temoin'])
  })
})

describe('grille issue du format historique', () => {
  const disponible = grilleParId('intimite')

  it('reprend la hiérarchie rubrique → élément', () => {
    expect(disponible?.grille.noeuds.get('bodies')?.enfants).toContain('skinny')
    expect(disponible?.grille.noeuds.get('skinny')?.parents).toEqual(['bodies'])
  })

  it('dessine les huit branches du modèle de référence', () => {
    // La part de regroupement « overall » sert à cocher vite ; elle n’est pas
    // une branche de l’étoile.
    // L’ordre est celui de la déclaration, donc celui du modèle de référence :
    // une branche doit toujours se retrouver au même endroit de l’étoile.
    expect(disponible?.grille.partsFeuilles).toEqual([
      'experience', 'excitment', 'disgust', 'exhibition', 'fear', 'acceptance', 'aftercare', 'explicit',
    ])
    expect(disponible?.grille.parts).toHaveLength(9)
  })

  it('cible la saisie rapide sur l’envie, et un peu sur l’acceptation', () => {
    const overall = disponible?.grille.parts.find((part) => part.id === 'overall')
    expect(overall?.spread).toEqual({ excitment: 1, acceptance: 0.5 })
  })

  it('garde les scores irréguliers du modèle', () => {
    const acceptance = disponible?.grille.parts.find((part) => part.id === 'acceptance')
    expect(acceptance?.steps.map((palier) => palier.score)).toEqual([0, 0.1, 0.25, 0.5, 0.6, 0.8, 1])
  })
})
