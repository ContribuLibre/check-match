import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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

/**
 * Build hors ligne : un `index.html` autonome, ouvrable en `file://`.
 *
 * Deux obstacles, deux réponses :
 *
 * - un navigateur refuse d’exécuter un module ES depuis `file://` (origine
 *   opaque), d’où un bundle classique plutôt qu’un module ;
 * - les chemins relatifs vers `assets/` marchent, mais un fichier unique se
 *   partage et s’ouvre sans se soucier d’un dossier à garder entier — donc CSS,
 *   script et icône sont intégrés dans la page.
 *
 * Le service worker et le manifeste n’ont pas de sens ici : ils sont retirés.
 * Le client, lui, sait déjà ne pas s’enregistrer hors http(s).
 */
function greffonFichierUnique(sortie: string): Plugin {
  return {
    name: 'check-match-fichier-unique',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      // Seule forme qu’un navigateur exécute depuis file://.
      return html
        .replace(/<script type="module" crossorigin src=/g, '<script defer src=')
        .replace(/<link rel="modulepreload"[^>]*>/g, '')
        .replace(/ crossorigin(?=[ >])/g, '')
    },
    closeBundle() {
      const cheminHtml = resolve(sortie, 'index.html')
      let html = readFileSync(cheminHtml, 'utf8')

      const integrer = (motif: RegExp, remplacer: (contenu: string, chemin: string) => string): void => {
        html = html.replace(motif, (_balise, chemin: string) => {
          const fichier = resolve(sortie, chemin.replace(/^\.\//, ''))
          return remplacer(readFileSync(fichier, 'utf8'), fichier)
        })
      }

      integrer(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (css) => `<style>${css}</style>`)

      // Le script part en fin de body : intégré tel quel, il perdrait son
      // `defer` et s’exécuterait avant que la page ait son point de montage.
      let script = ''
      html = html.replace(/<script defer src="([^"]+)"><\/script>/g, (_balise, chemin: string) => {
        script = readFileSync(resolve(sortie, chemin.replace(/^\.\//, '')), 'utf8')
        return ''
      })
      // Dans une balise `<script>`, `</script` ferme la balise et `<!--` ouvre
      // un commentaire — y compris au milieu d’une chaîne. Le SVG du logo, lui,
      // porte un commentaire : sans cet échappement, le script casse en silence.
      const protege = (code: string): string =>
        code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')
      // Remplacement par **fonction** : dans une chaîne de remplacement, les
      // séquences `$&`, `` $` `` et `$'` sont interprétées, et le code minifié
      // en contient. Passer par une chaîne corromprait le script en silence.
      if (script) html = html.replace('</body>', () => `<script>${protege(script)}</script></body>`)
      integrer(/<link rel="icon"[^>]*href="([^"]+)"[^>]*>/g, (svg) =>
        `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" type="image/svg+xml" />`)

      // Sans serveur, ni PWA ni worker : autant ne pas les promettre.
      html = html.replace(/<link rel="manifest"[^>]*>/g, '')

      writeFileSync(cheminHtml, html)
      for (const reste of ['assets', 'icons', 'sw.js', 'manifest.webmanifest']) {
        rmSync(resolve(sortie, reste), { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const version = versionBuild()
  const local = mode === 'hors-ligne'
  const sortie = resolve(import.meta.dirname, local ? 'dist-local' : 'dist')
  return {
    base: './',
    publicDir: resolve(import.meta.dirname, 'public'),
    define: { __APP_VERSION__: JSON.stringify(version) },
    build: {
      target: 'es2022',
      outDir: sortie,
      assetsDir: 'assets',
      // Un seul morceau : un fichier unique ne peut pas charger de fragment.
      ...(local ? { modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } } : {}),
    },
    plugins: [
      greffonYaml(),
      ...(local ? [greffonFichierUnique(sortie)] : [greffonPwa(version, sortie)]),
    ],
  }
})
