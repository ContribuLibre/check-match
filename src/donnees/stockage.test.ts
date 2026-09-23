import { beforeEach, describe, expect, it } from 'vitest'
import { creerStockage, FENETRE_REVISION_MS, stockageMemoire, type Stockage } from './stockage.ts'

const HEURE = 60 * 60 * 1000
const CLE = 'musique/agir'

function horloge(depart = 1_000_000) {
  let temps = depart
  const stockage = creerStockage({ stockage: stockageMemoire(), maintenant: () => temps })
  return { stockage, avancer: (ms: number) => { temps += ms }, temps: () => temps }
}

describe('personnes', () => {
  let stockage: Stockage
  beforeEach(() => { stockage = horloge().stockage })

  it('sépare les sauvegardes de deux personnes', () => {
    const alex = stockage.ajouterPersonne('Alex')
    const sam = stockage.ajouterPersonne('Sam')
    stockage.enregistrer(alex.id, CLE, { avis: 3 })
    stockage.enregistrer(sam.id, CLE, { avis: 0 })

    expect(stockage.derniere(alex.id, CLE)?.reponse).toEqual({ avis: 3 })
    expect(stockage.derniere(sam.id, CLE)?.reponse).toEqual({ avis: 0 })
  })

  it('reconnaît le même nom au lieu de créer un doublon', () => {
    const premier = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(premier.id, CLE, { avis: 3 })
    const encore = stockage.ajouterPersonne('Alex')
    expect(encore.id).toBe(premier.id)
    expect(stockage.derniere(encore.id, CLE)?.reponse).toEqual({ avis: 3 })
    expect(stockage.personnes()).toHaveLength(1)
  })

  it('n’efface que les réponses de la personne oubliée', () => {
    const alex = stockage.ajouterPersonne('Alex')
    const sam = stockage.ajouterPersonne('Sam')
    stockage.enregistrer(alex.id, CLE, { avis: 3 })
    stockage.enregistrer(sam.id, CLE, { avis: 1 })
    stockage.oublierPersonne(alex.id)
    expect(stockage.derniere(alex.id, CLE)).toBeNull()
    expect(stockage.derniere(sam.id, CLE)?.reponse).toEqual({ avis: 1 })
  })

  it('refuse un nom inutilisable', () => {
    expect(() => stockage.ajouterPersonne('   ')).toThrow()
  })
})

describe('fenêtre de 24 h', () => {
  it('écrase dans la fenêtre, sans créer de révision', () => {
    const { stockage, avancer } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, CLE, { avis: 1 })
    avancer(23 * HEURE)
    const resultat = stockage.enregistrer(alex.id, CLE, { avis: 3 })

    expect(resultat.ajoutee).toBe(false)
    expect(stockage.historique(alex.id, CLE)).toHaveLength(1)
    expect(stockage.derniere(alex.id, CLE)?.reponse).toEqual({ avis: 3 })
  })

  it('ajoute une révision au-delà, en gardant la précédente', () => {
    const { stockage, avancer } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, CLE, { avis: 1 })
    avancer(25 * HEURE)
    expect(stockage.enregistrer(alex.id, CLE, { avis: 3 }).ajoutee).toBe(true)

    const suite = stockage.historique(alex.id, CLE)
    expect(suite).toHaveLength(2)
    expect(suite[0]?.reponse).toEqual({ avis: 1 })
    expect(suite[1]?.reponse).toEqual({ avis: 3 })
  })

  it('garde le début de la révision courante en écrasant dedans', () => {
    const { stockage, avancer, temps } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    const debut = temps()
    stockage.enregistrer(alex.id, CLE, { avis: 1 })
    avancer(2 * HEURE)
    stockage.enregistrer(alex.id, CLE, { avis: 2 })

    expect(stockage.derniere(alex.id, CLE)?.depuis).toBe(debut)
    expect(stockage.derniere(alex.id, CLE)?.le).toBe(debut + 2 * HEURE)
  })

  it('ne crée jamais de révision pour une réponse identique', () => {
    const { stockage, avancer } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, CLE, { avis: 1 })
    avancer(30 * HEURE)
    expect(stockage.enregistrer(alex.id, CLE, { avis: 1 }).inchangee).toBe(true)
    expect(stockage.historique(alex.id, CLE)).toHaveLength(1)
  })

  it('dure exactement 24 h', () => {
    expect(FENETRE_REVISION_MS).toBe(24 * HEURE)
  })
})

describe('circulation des réponses', () => {
  it('rend les réponses courantes prêtes pour le calcul', () => {
    const { stockage } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, 'musique/agir', { avis: 3 })
    stockage.enregistrer(alex.id, 'musique/recevoir', { avis: 1 })

    const courantes = stockage.reponsesCourantes(alex.id)
    expect(courantes.get('musique/agir')).toEqual({ avis: 3 })
    expect(courantes.get('musique/recevoir')).toEqual({ avis: 1 })
  })

  it('n’écrase pas une réponse récente en réimportant une ancienne', () => {
    const { stockage } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, CLE, { avis: 3 })
    const recente = stockage.derniere(alex.id, CLE)?.le ?? 0
    stockage.enregistrer(alex.id, CLE, { avis: 0 }, recente - 7 * 24 * HEURE)

    const suite = stockage.historique(alex.id, CLE)
    expect(suite).toHaveLength(2)
    expect(suite[0]?.reponse).toEqual({ avis: 0 })
    expect(stockage.derniere(alex.id, CLE)?.reponse).toEqual({ avis: 3 })
  })

  it('fait l’aller-retour export puis import', () => {
    const { stockage, avancer } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.enregistrer(alex.id, CLE, { avis: 1 })
    avancer(30 * HEURE)
    stockage.enregistrer(alex.id, CLE, { avis: 3 })

    const charge = stockage.exporter(alex.id)
    const { stockage: neuf } = horloge()
    const importee = neuf.importer(charge)

    expect(neuf.historique(importee.id, CLE)).toHaveLength(2)
    expect(neuf.derniere(importee.id, CLE)?.reponse).toEqual({ avis: 3 })
  })

  it('repart du défaut si une entrée est corrompue', () => {
    const stockage = creerStockage({ stockage: stockageMemoire({ 'cm:personnes': '{pas du json' }) })
    expect(stockage.personnes()).toEqual([])
    expect(stockage.ajouterPersonne('Alex').id).toBe('alex')
  })
})

describe('renommer', () => {
  it('garde les réponses : elles suivent l’identifiant, pas le nom', () => {
    const { stockage } = horloge()
    const moi = stockage.ajouterPersonne('Moi')
    stockage.enregistrer(moi.id, CLE, { avis: 3 })

    const renommee = stockage.renommerPersonne(moi.id, 'Alex')
    expect(renommee?.id).toBe(moi.id)
    expect(renommee?.nom).toBe('Alex')
    expect(stockage.derniere(moi.id, CLE)?.reponse).toEqual({ avis: 3 })
  })

  it('libère l’ancien nom sans le confondre avec la personne renommée', () => {
    const { stockage } = horloge()
    const moi = stockage.ajouterPersonne('Moi')
    stockage.renommerPersonne(moi.id, 'Alex')

    // « Moi » redevient disponible, et ne doit pas rendre la personne renommée.
    const nouvelle = stockage.ajouterPersonne('Moi')
    expect(nouvelle.id).not.toBe(moi.id)
    expect(stockage.personnes()).toHaveLength(2)
  })

  it('refuse un nom déjà pris, ou vide', () => {
    const { stockage } = horloge()
    const alex = stockage.ajouterPersonne('Alex')
    stockage.ajouterPersonne('Sam')
    expect(() => stockage.renommerPersonne(alex.id, 'Sam')).toThrow(/déjà pris/)
    expect(() => stockage.renommerPersonne(alex.id, '  ')).toThrow()
  })

  it('reste idempotent par nom, pour retrouver ses réponses', () => {
    const { stockage } = horloge()
    const premiere = stockage.ajouterPersonne('Alex')
    expect(stockage.ajouterPersonne('Alex').id).toBe(premiere.id)
    expect(stockage.personnes()).toHaveLength(1)
  })
})
