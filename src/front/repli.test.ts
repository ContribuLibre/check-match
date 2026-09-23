import { beforeEach, describe, expect, it } from 'vitest'
import { creerReplis } from './repli.ts'
import { stockageMemoire } from '../donnees/stockage.ts'

describe('repli de l’arborescence', () => {
  let stockage: Storage
  beforeEach(() => { stockage = stockageMemoire() })

  it('déplie tout au départ : rien n’est caché sans qu’on l’ait demandé', () => {
    const replis = creerReplis('vie-collective', stockage)
    expect(replis.estReplie('son')).toBe(false)
    expect(replis.aDesReplis).toBe(false)
  })

  it('bascule un sujet, et s’en souvient au rechargement', () => {
    creerReplis('vie-collective', stockage).basculer('son')
    expect(creerReplis('vie-collective', stockage).estReplie('son')).toBe(true)
  })

  it('garde un état par grille', () => {
    // Replier « Son » ici ne dit rien de la grille d’à côté.
    creerReplis('vie-collective', stockage).basculer('son')
    expect(creerReplis('intimite', stockage).estReplie('son')).toBe(false)
  })

  it('replie et déplie tout d’un coup', () => {
    const replis = creerReplis('vie-collective', stockage)
    replis.toutReplier(['son', 'espaces'])
    expect(replis.estReplie('son')).toBe(true)
    expect(replis.estReplie('espaces')).toBe(true)
    replis.toutDeplier()
    expect(replis.aDesReplis).toBe(false)
  })

  it('ne mémorise que ce qui est replié, pour montrer les sujets ajoutés depuis', () => {
    const replis = creerReplis('vie-collective', stockage)
    replis.basculer('son')
    // Un sujet apparu après coup n’est pas caché sans prévenir.
    expect(creerReplis('vie-collective', stockage).estReplie('nouvelle-rubrique')).toBe(false)
  })

  it('repart de zéro si l’entrée est corrompue', () => {
    stockage.setItem('cm:replis:x', '{pas du json')
    expect(creerReplis('x', stockage).aDesReplis).toBe(false)
  })
})
