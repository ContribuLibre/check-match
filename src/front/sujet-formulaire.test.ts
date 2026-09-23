import { describe, expect, it } from 'vitest'
import { formulaireSujet, lireSujet, sujetsAPlat } from './sujet-formulaire.ts'
import { formulaireHtml } from './lightbox.ts'
import { textesUi } from './i18n.ts'
import { grilleParId } from '../grilles/index.ts'

const disponible = grilleParId('vie-collective')!
const grille = disponible.grille
const ui = textesUi('fr')

describe('liste des rangements possibles', () => {
  const options = sujetsAPlat(grille, (id) => disponible.textes.noeud(id))

  it('suit l’ordre de lecture de l’arbre, avec la profondeur', () => {
    expect(options[0]).toEqual({ valeur: 'son', libelle: 'Son', niveau: 0 })
    expect(options[1]?.niveau).toBe(1)
    expect(options.map((option) => option.valeur)).toContain('cuisine')
  })

  it('ne propose qu’une fois un sujet qui relève de plusieurs rubriques', () => {
    // Choisir un rangement, ce n’est pas choisir laquelle de ses places on vise.
    const occurrences = options.filter((option) => option.valeur === 'soiree-dansante')
    expect(occurrences).toHaveLength(1)
    expect(options).toHaveLength(grille.noeuds.size)
  })
})

describe('formulaire d’ajout', () => {
  it('propose comme rangement l’endroit d’où l’on a cliqué', () => {
    const champs = formulaireSujet(disponible, ['cuisine'], ui, 'fr').champs
    expect(champs.find((champ) => champ.id === 'parents')?.valeurs).toEqual(['cuisine'])
  })

  it('range derrière un repli ce qui a déjà un réglage', () => {
    const champs = formulaireSujet(disponible, [], ui, 'fr').champs
    const avances = champs.filter((champ) => champ.avance).map((champ) => champ.id)
    // Le libellé et le rangement sont la question ; le reste est un défaut.
    expect(avances).toEqual(['polarities', 'parts'])
    expect(champs.find((champ) => champ.id === 'label')?.requis).toBe(true)
  })

  it('coche d’avance toutes les polarités et toutes les parts', () => {
    const champs = formulaireSujet(disponible, [], ui, 'fr').champs
    expect(champs.find((champ) => champ.id === 'polarities')?.valeurs)
      .toEqual([...grille.polarites.keys()])
    expect(champs.find((champ) => champ.id === 'parts')?.valeurs)
      .toEqual(grille.parts.map((part) => part.id))
  })

  it('se rend en HTML sans rien laisser passer d’interprétable', () => {
    const html = formulaireHtml({
      titre: '<script>x</script>', champs: [{ id: 'label', libelle: 'A & B', type: 'texte' }],
      valider: 'Ok', annuler: 'Non',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &amp; B')
  })
})

describe('lecture du formulaire', () => {
  it('garde le libellé, l’aide et les rangements', () => {
    const sujet = lireSujet({
      label: 'Poubelles', help: 'Qui sort le bac', parents: ['cuisine'], polarities: [], parts: [],
    }, grille)
    expect(sujet).toMatchObject({ label: 'Poubelles', help: 'Qui sort le bac', parents: ['cuisine'] })
  })

  it('n’enregistre pas une restriction qui ne restreint rien', () => {
    // Un ajout qui ne dit rien de ses polarités suivra la grille même si elle
    // en gagne une ; figer la liste complète le couperait de cette évolution.
    const sujet = lireSujet({
      label: 'X', help: '', parents: [],
      polarities: [...grille.polarites.keys()],
      parts: grille.parts.map((part) => part.id),
    }, grille)
    expect(sujet.polarities).toBeUndefined()
    expect(sujet.parts).toBeUndefined()
  })

  it('enregistre une vraie restriction', () => {
    const sujet = lireSujet({ label: 'X', help: '', parents: [], polarities: ['general'], parts: [] }, grille)
    expect(sujet.polarities).toEqual(['general'])
  })

  it('ignore un rangement sous un sujet qui n’existe pas', () => {
    const sujet = lireSujet({ label: 'X', help: '', parents: ['cuisine', 'inconnu'], parts: [], polarities: [] }, grille)
    expect(sujet.parents).toEqual(['cuisine'])
  })
})
