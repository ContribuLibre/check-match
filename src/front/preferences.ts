/**
 * Les trois réglages de l’en-tête : thème, niveau d’interface, langue.
 *
 * Même mécanique pour les trois — lire, valider, écrire, prévenir — donc un
 * seul module plutôt que trois quasi identiques. Tout passe par un `try` :
 * `localStorage` peut être refusé (navigation privée, réglage strict), et
 * l’application doit rester utilisable sans mémoriser les préférences.
 */

export const THEMES = ['auto', 'clair', 'sombre'] as const
export type Theme = typeof THEMES[number]

/**
 * Niveau d’interface.
 *
 * Le modèle a trois dimensions d’héritage et des poids : montrer tout à
 * quelqu’un qui veut juste cocher quelques items est le meilleur moyen de le
 * faire fuir. Chaque niveau ajoute ce que le précédent cachait.
 *
 * - `simple`   : la polarité générale et la saisie rapide, rien d’autre ;
 * - `avancee`  : toutes les polarités, toutes les parts, la déduction ;
 * - `complete` : et ce qui explique le calcul — poids, provenance, historique,
 *                identifiants techniques.
 */
export const NIVEAUX = ['simple', 'avancee', 'complete'] as const
export type Niveau = typeof NIVEAUX[number]

export const LANGUES = ['fr', 'en'] as const
export type Langue = typeof LANGUES[number]

export interface Preferences {
  theme: Theme
  niveau: Niveau
  langue: Langue
}

const CLES = {
  theme: 'cm:theme',
  niveau: 'cm:niveau',
  langue: 'cm:langue',
} as const

function lire<T extends string>(cle: string, valides: readonly T[], defaut: T): T {
  try {
    const valeur = localStorage.getItem(cle)
    return valides.includes(valeur as T) ? (valeur as T) : defaut
  } catch {
    return defaut
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur)
  } catch { /* au mieux */ }
}

/** Langue du navigateur si on la sert, sinon le français. */
function langueParDefaut(): Langue {
  try {
    const preferee = navigator.languages?.map((etiquette) => etiquette.slice(0, 2))
      .find((code) => LANGUES.includes(code as Langue))
    return (preferee as Langue) ?? 'fr'
  } catch {
    return 'fr'
  }
}

/**
 * `matchMedia` manque dans certains contextes (jsdom, vieux moteurs).
 * On retombe alors sur « clair », plutôt que de refuser de démarrer pour une
 * préférence d’affichage.
 */
function mediaSombre(): Pick<MediaQueryList, 'matches' | 'addEventListener'> {
  if (typeof matchMedia !== 'function') return { matches: false, addEventListener: () => {} }
  return matchMedia('(prefers-color-scheme: dark)')
}

export function creerPreferences() {
  const media = mediaSombre()
  const ecouteurs = new Set<() => void>()

  const etat: Preferences = {
    theme: lire(CLES.theme, THEMES, 'auto'),
    niveau: lire(CLES.niveau, NIVEAUX, 'simple'),
    langue: lire(CLES.langue, LANGUES, langueParDefaut()),
  }

  const themeEffectif = (): 'clair' | 'sombre' =>
    etat.theme === 'auto' ? (media.matches ? 'sombre' : 'clair') : etat.theme

  function appliquer(): void {
    document.documentElement.dataset.theme = themeEffectif()
    document.documentElement.lang = etat.langue
    ecouteurs.forEach((ecouteur) => ecouteur())
  }

  // En mode auto, suivre le système en direct plutôt qu’au prochain chargement.
  media.addEventListener('change', () => { if (etat.theme === 'auto') appliquer() })
  appliquer()

  return {
    get theme() { return etat.theme },
    get niveau() { return etat.niveau },
    get langue() { return etat.langue },
    themeEffectif,
    /** Vrai si le niveau courant montre ce qui apparaît à partir de `seuil`. */
    montre(seuil: Niveau): boolean {
      return NIVEAUX.indexOf(etat.niveau) >= NIVEAUX.indexOf(seuil)
    },
    definir<C extends keyof Preferences>(cle: C, valeur: Preferences[C]): void {
      etat[cle] = valeur
      ecrire(CLES[cle], valeur)
      appliquer()
    },
    surChangement(ecouteur: () => void): () => void {
      ecouteurs.add(ecouteur)
      return () => ecouteurs.delete(ecouteur)
    },
  }
}

export type GestionnairePreferences = ReturnType<typeof creerPreferences>
