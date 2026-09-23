import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { greffonYaml } from './src/CI/vite-yaml.ts'

function git(args: string[]): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

function fichiers(racine: string, dossier = racine): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = resolve(dossier, nom)
    return statSync(chemin).isDirectory() ? fichiers(racine, chemin) : [relative(racine, chemin).split(sep).join('/')]
  })
}

/**
 * Empreinte du code source.
 *
 * Elle distingue deux versions que Git ne distingue pas : un travail en cours
 * non commité, ou deux builds du même commit avec des dépendances différentes.
 * C’est elle qui déclenche la mise à jour du service worker.
 */
function empreinteSource(): string {
  const racine = import.meta.dirname
  const entrees = ['index.html', 'package.json', 'bun.lock', 'vite.config.ts', 'src', 'public']
  const chemins = entrees.flatMap((entree) => {
    const chemin = resolve(racine, entree)
    try {
      return statSync(chemin).isDirectory() ? fichiers(racine, chemin) : [entree]
    } catch {
      return []
    }
  }).sort()
  const hash = createHash('sha256')
  for (const chemin of chemins) {
    hash.update(chemin)
    hash.update('\0')
    hash.update(readFileSync(resolve(racine, chemin)))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 12)
}

/**
 * `v0.1.0+441.a1b2c3d.8026083ab123`
 *
 * La marque vient de `package.json`, et non d’un tag Git : le dépôt porte
 * encore les tags de la liste dont il est issu, qui ne disent rien de ce
 * projet-ci. Le nombre de commits, lui, compte tout l’historique hérité — c’est
 * bien ce qu’il est.
 */
function versionBuild(): string {
  const paquet = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')) as { version?: string }
  const commits = git(['rev-list', '--count', 'HEAD']) || '0'
  const sha = git(['rev-parse', '--short', 'HEAD'])
  return `v${paquet.version ?? '0.0.0'}+${commits}.${sha ? `${sha}.` : ''}${empreinteSource()}`
}

/**
 * Remplit le service worker après le build : il lui faut la liste exacte des
 * fichiers produits, que seul le build connaît.
 */
function greffonPwa(version: string, sortie: string): Plugin {
  return {
    name: 'check-match-pwa',
    apply: 'build',
    closeBundle() {
      const cheminSw = resolve(sortie, 'sw.js')
      const precache = fichiers(sortie)
        .filter((chemin) => chemin !== 'sw.js')
        .map((chemin) => `./${chemin}`)
      writeFileSync(cheminSw, readFileSync(cheminSw, 'utf8')
        .replace('__SW_VERSION__', () => version)
        .replace('__PRECACHE_MANIFEST__', () => JSON.stringify(precache)))
    },
  }
}

export default defineConfig(() => {
  const version = versionBuild()
  const sortie = resolve(import.meta.dirname, 'dist')
  return {
    base: './',
    publicDir: resolve(import.meta.dirname, 'public'),
    define: { __APP_VERSION__: JSON.stringify(version) },
    build: {
      target: 'es2022',
      outDir: sortie,
      assetsDir: 'assets',
    },
    plugins: [greffonYaml(), greffonPwa(version, sortie)],
  }
})
