import { beforeEach, describe, expect, it } from 'vitest'
import { creerPreferences } from './preferences.ts'
import { textesUi } from './i18n.ts'

describe('préférences', () => {
  beforeEach(() => localStorage.clear())

  it('démarre en simple, en thème automatique', () => {
    const prefs = creerPreferences()
    expect(prefs.niveau).toBe('simple')
    expect(prefs.theme).toBe('auto')
  })

  it('retient un choix d’un chargement à l’autre', () => {
    creerPreferences().definir('niveau', 'complete')
    expect(creerPreferences().niveau).toBe('complete')
  })

  it('ignore une valeur invalide au lieu de casser', () => {
    // Un réglage bidouillé à la main ne doit pas empêcher l’application de démarrer.
    localStorage.setItem('cm:niveau', 'expert')
    expect(creerPreferences().niveau).toBe('simple')
  })

  it('pose le thème effectif sur la racine du document', () => {
    const prefs = creerPreferences()
    prefs.definir('theme', 'sombre')
    expect(document.documentElement.dataset.theme).toBe('sombre')
    expect(prefs.themeEffectif()).toBe('sombre')
  })

  it('suit la langue choisie jusque dans l’attribut lang', () => {
    creerPreferences().definir('langue', 'en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('prévient ses écouteurs, et sait les retirer', () => {
    const prefs = creerPreferences()
    let appels = 0
    const arreter = prefs.surChangement(() => { appels += 1 })
    prefs.definir('theme', 'clair')
    expect(appels).toBe(1)
    arreter()
    prefs.definir('theme', 'sombre')
    expect(appels).toBe(1)
  })
})

describe('niveaux d’interface', () => {
  beforeEach(() => localStorage.clear())

  it('chaque niveau montre ce que le précédent cachait', () => {
    const prefs = creerPreferences()

    prefs.definir('niveau', 'simple')
    expect(prefs.montre('simple')).toBe(true)
    expect(prefs.montre('avancee')).toBe(false)
    expect(prefs.montre('complete')).toBe(false)

    prefs.definir('niveau', 'avancee')
    expect(prefs.montre('avancee')).toBe(true)
    expect(prefs.montre('complete')).toBe(false)

    prefs.definir('niveau', 'complete')
    expect(prefs.montre('complete')).toBe(true)
  })
})

describe('textes de l’interface', () => {
  it('traduit, et sait composer les phrases à nombres', () => {
    expect(textesUi('fr').effacer).toBe('Effacer')
    expect(textesUi('en').effacer).toBe('Clear')
    expect(textesUi('fr').avancement(1, 2, 3, 6)).toContain('1 répondues')
    expect(textesUi('en').avancement(1, 2, 3, 6)).toContain('1 answered')
  })
})
