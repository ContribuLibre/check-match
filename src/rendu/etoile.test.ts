import { describe, expect, it } from 'vitest'
import { degradesEtoile, geometrieEtoile, PORTEE_MINIMALE, porteeBranche } from './etoile.ts'
import { etoileSvg } from './indicateur.ts'
import type { PartDefinition, ValeurPolarite } from '../domaine/types.ts'

const portee = (point: { x: number; y: number }): number => Math.hypot(point.x, point.y)
const valeurs = (scores: (number | null)[], poids = 1) =>
  scores.map((score) => ({ score, poids: score === null ? 0 : poids }))

const parts: PartDefinition[] = ['a', 'b', 'c'].map((id) => ({
  id,
  couleurMin: '#111',
  couleurMax: '#eee',
  paliers: [{ id: 'bas', score: 0 }, { id: 'haut', score: 1 }],
}))

describe('géométrie de l’étoile', () => {
  it('donne un secteur par part, quel que soit leur nombre', () => {
    for (const nombre of [1, 3, 8, 13]) {
      const etoile = geometrieEtoile(valeurs(Array.from({ length: nombre }, () => 0.5)))
      expect(etoile.branches).toBe(nombre)
      expect(etoile.secteurs).toHaveLength(nombre)
      expect(etoile.secteurs[0]?.piste).toHaveLength(4)
      expect(etoile.ouverture).toBeCloseTo((2 * Math.PI) / nombre, 6)
    }
  })

  it('fait pointer la première branche vers le haut', () => {
    const [premier] = geometrieEtoile(valeurs([1, 1, 1])).secteurs
    expect(premier?.pointe.x).toBeCloseTo(0, 3)
    expect(premier?.pointe.y).toBeLessThan(0)
  })

  it('allonge la branche avec le score', () => {
    const { secteurs } = geometrieEtoile(valeurs([0, 0.5, 1]))
    expect(secteurs[0]!.portee).toBeLessThan(secteurs[1]!.portee)
    expect(secteurs[1]!.portee).toBeLessThan(secteurs[2]!.portee)
    expect(porteeBranche(0)).toBeCloseTo(PORTEE_MINIMALE, 6)
    expect(porteeBranche(1)).toBe(1)
  })

  it('distingue « répondu au plus bas » de « pas renseigné »', () => {
    const { secteurs } = geometrieEtoile(valeurs([0, null, 1]))
    // Répondu à zéro : triangle tronqué, la pointe tombe.
    expect(secteurs[0]?.remplissage).toHaveLength(3)
    // Pas renseigné : aucun remplissage, seule la piste reste.
    expect(secteurs[1]?.remplissage).toHaveLength(0)
    expect(secteurs[1]?.piste).toHaveLength(4)
    expect(secteurs[2]?.remplissage).toHaveLength(4)
  })

  it('atteint le rayon extérieur au score maximal', () => {
    const { secteurs } = geometrieEtoile(valeurs([1]), { taille: 100 })
    expect(portee(secteurs[0]!.pointe)).toBeCloseTo(50, 3)
  })

  it('refuse une étoile sans branche', () => {
    expect(() => geometrieEtoile([])).toThrow()
  })

  it('oriente chaque dégradé selon son secteur', () => {
    const degrades = degradesEtoile(4)
    expect(degrades).toHaveLength(4)
    expect(degrades[0]?.y1).toBeCloseTo(1, 6)
    expect(degrades[0]?.y2).toBeCloseTo(0, 6)
  })
})

describe('rendu SVG', () => {
  const etoile = (valeursPolarite: ValeurPolarite, options = {}) =>
    etoileSvg('demo', parts, valeursPolarite, options)
  const compte = (svg: string, motif: string) => svg.split(motif).length - 1

  it('dessine une piste par part et un remplissage par valeur', () => {
    const svg = etoile({
      a: { score: 1, poids: 1, origine: 'propre' },
      b: { score: 0, poids: 0, origine: 'absent' },
      c: { score: 0.5, poids: 0.5, origine: 'herite' },
    })
    expect(compte(svg, 'class="piste"')).toBe(3)
    expect(compte(svg, 'class="reponse"')).toBe(2)
  })

  it('rend le poids lisible : une valeur héritée est plus pâle', () => {
    const propre = etoile({ a: { score: 1, poids: 1, origine: 'propre' } })
    const herite = etoile({ a: { score: 1, poids: 0.25, origine: 'herite' } })
    expect(propre).toContain('fill-opacity="1"')
    expect(herite).toContain('fill-opacity="0.44"')
  })

  it('ne dessine aucun remplissage quand rien n’est renseigné', () => {
    expect(etoile({})).not.toContain('class="reponse"')
    expect(etoile({ a: { score: 0, poids: 0, origine: 'absent' } })).not.toContain('class="reponse"')
  })

  it('embarque ses dégradés, ou les délègue à la page', () => {
    expect(compte(etoile({}), '<linearGradient')).toBe(3)
    const externe = etoile({}, { degradesExternes: true })
    expect(externe).not.toContain('<linearGradient')
    expect(externe).toContain('url(#cm-demo-a-3)')
  })

  it('échappe ce qui vient des définitions de grille', () => {
    const piege: PartDefinition[] = [{
      id: 'x',
      couleurMin: '#000',
      couleurMax: '"><script>alert(1)</script>',
      paliers: [{ id: 'bas', score: 0 }],
    }]
    const svg = etoileSvg('g', piege, { x: { score: 1, poids: 1, origine: 'propre' } })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
})
