import { describe, expect, it } from 'vitest'
import { moitieDe, scoreDepuis, yinYangSvg, RAYON } from './yinyang.ts'
import { PORTEE_MINIMALE } from './etoile.ts'

const yin = { score: null as number | null, poids: 0, couleur: '#4AB', libelle: 'Sensibilité' }
const yang = { score: null as number | null, poids: 0, couleur: '#E85', libelle: 'Action' }

describe('quelle moitié on touche', () => {
  it('sépare à gauche et à droite, loin du centre', () => {
    expect(moitieDe(-80, 0)).toBe('yin')
    expect(moitieDe(80, 0)).toBe('yang')
  })

  it('suit le S, et non un simple diamètre', () => {
    // Juste au-dessus du centre, on est encore dans le yang bien que x soit nul
    // ou légèrement négatif : c’est tout l’intérêt de la figure.
    expect(moitieDe(-10, -40)).toBe('yang')
    expect(moitieDe(10, 40)).toBe('yin')
  })

  it('ne laisse aucun point sans moitié', () => {
    for (let x = -RAYON; x <= RAYON; x += 20) {
      for (let y = -RAYON; y <= RAYON; y += 20) {
        expect(['yin', 'yang']).toContain(moitieDe(x, y))
      }
    }
  })
})

describe('le score que dit un point', () => {
  it('vaut 1 au bord et 0 sous la portée minimale', () => {
    expect(scoreDepuis(RAYON, 0)).toBe(1)
    expect(scoreDepuis(0, 0)).toBe(0)
    expect(scoreDepuis(RAYON * PORTEE_MINIMALE, 0)).toBe(0)
  })

  it('croît avec la distance, et reste borné au-delà du cercle', () => {
    expect(scoreDepuis(RAYON * 0.6, 0)).toBeGreaterThan(scoreDepuis(RAYON * 0.4, 0))
    expect(scoreDepuis(RAYON * 3, 0)).toBe(1)
  })

  it('fait l’aller-retour avec ce que le dessin montre', () => {
    // Le rayon dessiné pour un score doit redonner ce score si on le relit.
    for (const score of [0, 0.3, 0.7, 1]) {
      const rayonDessine = (PORTEE_MINIMALE + score * (1 - PORTEE_MINIMALE)) * RAYON
      expect(scoreDepuis(rayonDessine, 0)).toBeCloseTo(score, 6)
    }
  })
})

describe('la figure', () => {
  it('ne remplit rien tant que rien n’est répondu', () => {
    const svg = yinYangSvg(yin, yang)
    expect(svg).not.toContain('class="remplissage"')
  })

  it('remplit chaque moitié à sa propre hauteur', () => {
    // Très sensible au bruit, peu en action dessus : les deux moitiés n’ont
    // aucune raison de se répondre.
    const svg = yinYangSvg({ ...yin, score: 1, poids: 1 }, { ...yang, score: 0, poids: 1 })
    const rayons = [...svg.matchAll(/data-moitie="(\w+)" cx="0" cy="0" r="([\d.]+)"/g)]
      .map(([, moitie, rayon]) => [moitie, Number(rayon)] as const)
    expect(Object.fromEntries(rayons)).toEqual({ yin: RAYON, yang: RAYON * PORTEE_MINIMALE })
  })

  it('garde ses deux yeux : sans eux la figure n’est plus reconnaissable', () => {
    expect((yinYangSvg(yin, yang).match(/class="oeil"/g) ?? []).length).toBe(2)
  })

  it('donne des masques distincts à chaque figure de la page', () => {
    const premier = yinYangSvg(yin, yang, { id: 'a' })
    const second = yinYangSvg(yin, yang, { id: 'b' })
    expect(premier).toContain('id="a-yin"')
    expect(second).toContain('id="b-yin"')
    expect(premier).not.toContain('"b-yin"')
  })

  it('échappe ce qui vient des données', () => {
    const svg = yinYangSvg({ ...yin, couleur: '" onload="x' }, yang, { titre: '<script>' })
    expect(svg).not.toContain('onload="x')
    expect(svg).not.toContain('<script>')
  })
})
