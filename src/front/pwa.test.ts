import { describe, expect, it, vi } from 'vitest'
import { basculerAuChargement, surMiseAJourDisponible, traiterMessage, versionApplication } from './pwa.ts'

describe('bascule au chargement', () => {
  it('bascule sur un rechargement : la personne demande du neuf', () => {
    expect(basculerAuChargement('reload')).toBe(true)
  })

  it('ne bascule pas sur une navigation ordinaire', () => {
    // Sinon on remplacerait l’application sous les doigts de quelqu’un qui
    // arrive simplement sur la page.
    expect(basculerAuChargement('navigate')).toBe(false)
    expect(basculerAuChargement('back_forward')).toBe(false)
    expect(basculerAuChargement(undefined)).toBe(false)
  })
})

describe('annonce d’une mise à jour', () => {
  it('prévient les écouteurs avec la version annoncée', () => {
    const vu: string[] = []
    const arreter = surMiseAJourDisponible((version) => vu.push(version))
    traiterMessage(new MessageEvent('message', { data: { type: 'updateAvailable', version: 'v0.2.0+3.abc' } }))
    expect(vu).toEqual(['v0.2.0+3.abc'])
    arreter()
  })

  it('ignore les messages qui ne la concernent pas', () => {
    const ecouteur = vi.fn()
    const arreter = surMiseAJourDisponible(ecouteur)
    traiterMessage(new MessageEvent('message', { data: { type: 'autreChose' } }))
    traiterMessage(new MessageEvent('message', { data: null }))
    traiterMessage(new MessageEvent('message', { data: 'texte' }))
    expect(ecouteur).not.toHaveBeenCalled()
    arreter()
  })

  it('se désabonne proprement', () => {
    const ecouteur = vi.fn()
    surMiseAJourDisponible(ecouteur)()
    traiterMessage(new MessageEvent('message', { data: { type: 'updateAvailable', version: 'v1' } }))
    expect(ecouteur).not.toHaveBeenCalled()
  })
})

describe('version affichée', () => {
  it('retombe sur « dev » hors build', () => {
    // __APP_VERSION__ n’est défini que par Vite ; les tests ne doivent pas
    // planter pour autant.
    expect(versionApplication()).toBe('dev')
  })
})
