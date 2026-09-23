// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { ouvrirFormulaire, ouvrirPanneau } from './lightbox.ts'

afterEach(() => { document.body.innerHTML = '' })

const champs = [
  { id: 'label', libelle: 'Sujet', type: 'texte' as const, requis: true },
  { id: 'parents', libelle: 'Ranger sous', type: 'cases' as const, options: [
    { valeur: 'cuisine', libelle: 'Cuisine' },
    { valeur: 'salon', libelle: 'Salon' },
  ], valeurs: ['cuisine'] },
]

describe('formulaire modal', () => {
  it('rend ce qui a été saisi, et disparaît du document', async () => {
    const attendu = ouvrirFormulaire({ titre: 'Ajouter', champs, valider: 'Ajouter', annuler: 'Annuler' })
    const dialogue = document.querySelector('dialog')!
    dialogue.querySelector<HTMLInputElement>('[name="label"]')!.value = 'Poubelles'
    dialogue.querySelector<HTMLInputElement>('[value="salon"]')!.checked = true
    dialogue.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'))

    expect(await attendu).toEqual({ label: 'Poubelles', parents: ['cuisine', 'salon'] })
    expect(document.querySelector('dialog')).toBeNull()
  })

  it('rend null quand on renonce', async () => {
    const attendu = ouvrirFormulaire({ titre: 'Ajouter', champs, valider: 'Ajouter', annuler: 'Annuler' })
    document.querySelector<HTMLButtonElement>('[data-annuler]')!.click()
    expect(await attendu).toBeNull()
  })

  it('rogne les espaces autour d’une saisie', async () => {
    const attendu = ouvrirFormulaire({ titre: 'Ajouter', champs, valider: 'Ajouter', annuler: 'Annuler' })
    const dialogue = document.querySelector('dialog')!
    dialogue.querySelector<HTMLInputElement>('[name="label"]')!.value = '  Poubelles  '
    dialogue.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'))
    expect((await attendu)?.label).toBe('Poubelles')
  })

  it('s’ouvre et se ferme là où showModal et close n’existent pas', () => {
    // Les navigateurs les connaissent tous ; les environnements de test, non.
    // Retomber sur l’attribut vaut mieux qu’une exception au premier clic.
    ouvrirPanneau({ titre: 'Contribuer', corps: '<p>Bonjour</p>', fermer: 'Fermer' })
    const dialogue = document.querySelector('dialog')!
    expect(typeof (dialogue as HTMLDialogElement).showModal).not.toBe('function')
    expect(dialogue.hasAttribute('open')).toBe(true)
    document.querySelector<HTMLButtonElement>('[data-fermer]')!.click()
    expect(document.querySelector('dialog')).toBeNull()
  })
})

describe('panneau de lecture', () => {
  it('laisse passer le contenu déjà mis en forme, et se ferme', () => {
    ouvrirPanneau({ titre: 'Inspirations', corps: '<a href="#x">Lien</a>', fermer: 'Fermer' })
    expect(document.querySelector('dialog a')?.textContent).toBe('Lien')
    document.querySelector<HTMLButtonElement>('[data-fermer]')!.click()
    expect(document.querySelector('dialog')).toBeNull()
  })
})
