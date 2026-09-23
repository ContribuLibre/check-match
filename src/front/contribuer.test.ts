import { describe, expect, it } from 'vitest'
import {
  ADRESSES_CRYPTO, CLE_G1, COURRIEL, contribuerHtml, inspirationsHtml, textesContribuer,
} from './contribuer.ts'

describe('panneau de contribution', () => {
  const html = contribuerHtml(textesContribuer('fr'))

  it('propose les quatre façons de contribuer', () => {
    for (const attendu of ['Communiquer', 'Pérenniser', 'Encourager', 'Financer en crypto']) {
      expect(html).toContain(attendu)
    }
  })

  it('rend l’adresse e-mail cliquable là où elle est citée', () => {
    expect(html).toContain(`mailto:${COURRIEL}?subject=check-match`)
  })

  it('porte la clé Ğ1 et une adresse par réseau', () => {
    expect(html).toContain(CLE_G1)
    for (const { adresse } of ADRESSES_CRYPTO) expect(html).toContain(adresse)
  })

  it('échappe les textes, guillemets compris', () => {
    // Ils passent par le même échappement que le reste, sans exception : un
    // guillemet dans un texte ne doit pas refermer l’attribut qui le porte.
    const hostile = contribuerHtml({
      ...textesContribuer('fr'),
      cryptoTitre: 'A" onclick="x',
      encouragerTitre: '<script>x</script>',
    })
    expect(hostile).not.toContain('A" onclick')
    expect(hostile).toContain('A&quot; onclick')
    expect(hostile).not.toContain('<script>')
  })

  it('traduit ce qui est traduit, et retombe sur le français sinon', () => {
    expect(textesContribuer('en').titre).toBe('Contribute to check-match')
    expect(textesContribuer('fr').monnaieLibre).toBe('Monnaie Libre Ğ1')
  })
})

describe('panneau des inspirations', () => {
  it('donne une carte par source, avec son lien', () => {
    const html = inspirationsHtml(textesContribuer('fr'), [
      { nom: 'KinkList', url: 'https://example.org/k', texte: 'D’où viennent les items.' },
    ])
    expect(html).toContain('KinkList')
    expect(html).toContain('https://example.org/k')
    expect(html).toContain('D’où viennent les items.')
  })

  it('échappe ce qui vient des sources', () => {
    const html = inspirationsHtml(textesContribuer('fr'), [
      { nom: '<script>x</script>', url: 'https://example.org', texte: 'A & B' },
    ])
    expect(html).not.toContain('<script>')
    expect(html).toContain('A &amp; B')
  })
})
