import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { verifierBuildLocal } from './verifie-local.ts'

// Depuis la racine du projet : sous vitest, `import.meta.url` ne pointe pas
// vers le fichier sur disque.
const dossier = resolve(process.cwd(), 'dist-local')
const construit = existsSync(resolve(dossier, 'index.html'))

/** Charge la page et attend que son script se soit exécuté. */
async function pageChargee(html: string): Promise<JSDOM> {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'file:///tmp/index.html' })
  await new Promise((resoudre) => setTimeout(resoudre, 50))
  return dom
}

// Ces tests portent sur un produit de `bun run build:local`. Sans lui, ils
// n’ont rien à dire — `bun run check` construit avant de vérifier.
describe.skipIf(!construit)('build hors ligne', () => {
  const html = construit ? readFileSync(resolve(dossier, 'index.html'), 'utf8') : ''

  it('tient dans une seule page, sans rien autour', () => {
    expect(verifierBuildLocal(dossier)).toEqual([])
  })

  it('n’utilise pas de module ES, que file:// refuse d’exécuter', () => {
    expect(html).not.toMatch(/<script[^>]*type="module"/)
    expect(html).toMatch(/<script>/)
    expect(html).toMatch(/<style>/)
  })

  it('ne promet ni manifeste ni service worker : il n’y a rien à côté', () => {
    // On vise les balises, pas la chaîne « sw.js » : le code d’enregistrement
    // reste dans le bundle, il sait juste ne pas s’exécuter hors http(s).
    expect(html).not.toMatch(/<link[^>]*rel="manifest"/)
    expect(html).not.toMatch(/<script[^>]*src="[^"]*sw\.js/)
  })

  it('démarre pour de bon, sans serveur ni stockage', async () => {
    // Le vrai test : exécuter la page comme le ferait un double-clic. L’URL en
    // file:// donne une origine opaque, donc un localStorage qui lève à la
    // simple lecture — exactement ce que rencontre un double-clic.
    const dom = await pageChargee(html)
    const document = dom.window.document

    expect(document.querySelector('.erreur')).toBeNull()
    expect(document.querySelector('.entete')).not.toBeNull()
    expect(document.querySelector('.arbre')).not.toBeNull()
    // Les grilles sont intégrées : l’arbre est peuplé sans aucune requête.
    expect(document.querySelectorAll('.noeud').length).toBeGreaterThan(20)
    expect(document.querySelector('.pied')?.textContent).toContain('AGPLv3')
    dom.window.close()
  })

  it('prévient que les réponses ne seront pas conservées', async () => {
    // Plutôt que de laisser quelqu’un remplir une grille pour rien.
    const dom = await pageChargee(html)
    expect(dom.window.document.querySelector('.volatil')).not.toBeNull()
    dom.window.close()
  })

  it('embarque ses grilles et son logo, pas des chemins vers eux', async () => {
    const dom = await pageChargee(html)
    const document = dom.window.document
    expect(document.querySelector('.logo svg')).not.toBeNull()
    // La langue suit celle du navigateur : on vérifie le sujet, pas sa langue.
    const libelles = [...document.querySelectorAll('.libelle')].map((noeud) => noeud.textContent)
    expect(libelles.some((libelle) => libelle === 'Son' || libelle === 'Sound')).toBe(true)
    dom.window.close()
  })
})
