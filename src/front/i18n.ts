import type { Langue } from './preferences.ts'

/**
 * Textes de l’interface.
 *
 * Volontairement un simple dictionnaire : il y a une trentaine de chaînes, et
 * les contenus qui comptent — les grilles — ont déjà leur propre mécanisme de
 * traduction, séparé de leur structure.
 *
 * Une clé absente retombe sur le français plutôt que sur du vide : on voit ce
 * qui reste à traduire sans écran cassé.
 */
export interface Textes {
  titre: string
  reponsesDe: string
  personne: string
  ajouterPersonne: string
  nommerPersonne: string
  personneDabord: string
  grille: string
  avancement: (repondues: number, heritees: number, vides: number, total: number) => string
  contribuer: string
  inspiration: string
  inspirationIntro: string
  inspirationKinklist: string
  inspirationThunometre: string
  reglages: string
  theme: string
  themeAuto: string
  themeClair: string
  themeSombre: string
  niveau: string
  niveauSimple: string
  niveauAvancee: string
  niveauComplete: string
  langue: string
  saisieRapide: string
  reponseDirecte: string
  herite: string
  nonRenseigne: string
  detour: string
  detours: string
  effacer: string
  fermer: string
  deduireSousElements: string
  deduireSousElementsAide: string
  deduirePlaces: string
  deduirePlacesAide: string
  revisions: (nombre: number) => string
  plusieursRubriques: string
  rienRenseigne: string
  version: string
  majPrete: string
  realisePar: string
  dopeA: string
  licence: string
  codeSource: string
}

/**
 * Le français porte toutes les clés ; les autres langues complètent ce qu’elles
 * peuvent. Une traduction en cours ne doit jamais bloquer une compilation.
 */
const TEXTES: { fr: Textes } & Partial<Record<Langue, Partial<Textes>>> = {
  fr: {
    titre: 'check-match',
    reponsesDe: 'Réponses de',
    personne: 'personne',
    ajouterPersonne: '+ personne',
    nommerPersonne: 'Nom de cette série de réponses :',
    personneDabord: 'Créez d’abord une personne : les réponses sont rangées par personne.',
    grille: 'Grille',
    avancement: (repondues: number, heritees: number, vides: number, total: number) =>
      `${repondues} répondues, ${heritees} héritées, ${vides} vides (sur ${total} étoiles)`,
    contribuer: 'Contribuer',
    inspiration: 'Inspirations',
    inspirationIntro: 'Ce dont ce projet est issu, et ce dont il s’inspire.',
    inspirationKinklist: 'La liste dont viennent les items d’« Intimité », et le point de départ du projet.',
    inspirationThunometre: 'Dont viennent l’organisation du projet, les réglages et le fonctionnement hors ligne.',
    reglages: 'Réglages',
    theme: 'Thème',
    themeAuto: 'auto',
    themeClair: 'clair',
    themeSombre: 'sombre',
    niveau: 'Interface',
    niveauSimple: 'simple',
    niveauAvancee: 'avancée',
    niveauComplete: 'complète',
    langue: 'Langue',
    saisieRapide: 'saisie rapide',
    reponseDirecte: 'réponse directe',
    herite: 'hérité',
    nonRenseigne: 'non renseigné',
    detour: 'détour',
    detours: 'détours',
    effacer: 'Effacer',
    fermer: 'Fermer',
    deduireSousElements: 'Déduire des sous-éléments',
    deduireSousElementsAide: 'Résumer d’après ce qui est répondu dans les sous-éléments',
    deduirePlaces: 'Déduire des places',
    deduirePlacesAide: 'Résumer d’après ce qui est répondu à chaque place',
    revisions: (nombre: number) => `${nombre} révisions`,
    plusieursRubriques: 'Relève de plusieurs rubriques',
    rienRenseigne: 'Rien de renseigné.',
    version: 'Version',
    majPrete: 'Une nouvelle version est prête : cliquer pour l’appliquer et recharger',
    realisePar: 'Réalisé par',
    dopeA: 'dopé à l’',
    licence: 'Licence',
    codeSource: 'Code source',
  },
  en: {
    titre: 'check-match',
    reponsesDe: 'Answers of',
    personne: 'nobody',
    ajouterPersonne: '+ person',
    nommerPersonne: 'Name for this set of answers:',
    personneDabord: 'Create someone first: answers are stored per person.',
    grille: 'Grid',
    avancement: (repondues: number, heritees: number, vides: number, total: number) =>
      `${repondues} answered, ${heritees} inherited, ${vides} empty (of ${total} stars)`,
    contribuer: 'Contribute',
    inspiration: 'Inspirations',
    inspirationIntro: 'What this project came from, and what it draws on.',
    inspirationKinklist: 'The list the “Intimacy” items come from, and the starting point of the project.',
    inspirationThunometre: 'Where the project layout, the settings and the offline support come from.',
    reglages: 'Settings',
    theme: 'Theme',
    themeAuto: 'auto',
    themeClair: 'light',
    themeSombre: 'dark',
    niveau: 'Interface',
    niveauSimple: 'simple',
    niveauAvancee: 'advanced',
    niveauComplete: 'complete',
    langue: 'Language',
    saisieRapide: 'quick entry',
    reponseDirecte: 'answered here',
    herite: 'inherited',
    nonRenseigne: 'not answered',
    detour: 'detour',
    detours: 'detours',
    effacer: 'Clear',
    fermer: 'Close',
    deduireSousElements: 'Deduce from sub-items',
    deduireSousElementsAide: 'Summarise from what is answered in the sub-items',
    deduirePlaces: 'Deduce from places',
    deduirePlacesAide: 'Summarise from what is answered in each place',
    revisions: (nombre: number) => `${nombre} revisions`,
    plusieursRubriques: 'Belongs to several sections',
    rienRenseigne: 'Nothing answered.',
    version: 'Version',
    majPrete: 'A new version is ready: click to apply it and reload',
    realisePar: 'Made by',
    dopeA: 'boosted with ',
    licence: 'License',
    codeSource: 'Source code',
  },
}

/** Les textes demandés, complétés par le français pour ce qui manque. */
export function textesUi(langue: Langue): Textes {
  return { ...TEXTES.fr, ...TEXTES[langue] }
}

export const LANGUES_LIBELLES: Record<Langue, string> = { fr: 'Français', en: 'English' }
