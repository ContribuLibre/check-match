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
  inspirationKinklist: string
  inspirationThunometre: string
  inspirationPolitiscales: string
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
  sansPersistance: string
  personneParDefaut: string
  renommer: string
  renommerInvite: string
  toutReplier: string
  toutDeplier: string
  replier: string
  deplier: string
  ajouterSujet: string
  ajouterSujetIci: string
  ajouterSujetTitre: string
  ajouterSujetIntro: string
  ajouter: string
  annuler: string
  champLibelle: string
  champAide: string
  champAideAide: string
  champRangement: string
  champRangementAide: string
  champPolarites: string
  champPolaritesAide: string
  champParts: string
  champPartsAide: string
  champsAvances: string
  retirerSujet: string
  retirerSujetConfirme: string
  sujetAjoute: string
  echanger: string
  exporterReponses: string
  exporterChecklist: string
  exporterChecklistAide: string
  importer: string
  importerAide: string
  importEchoue: string
  grilleImportee: string
  retirerGrille: string
  retirerGrilleConfirme: string
  tensionAide: string
  tensionEtendueAide: string
  tensionEtendue: (min: number, bas: number, haut: number, max: number) => string
  triangleAide: string
  yinyangAide: string
  ajouterEchelle: string
  ajouterEchelleTitre: string
  ajouterEchelleIntro: string
  champEchelleNom: string
  champForme: string
  champFormeAide: string
  formeCrans: string
  formeCransAide: string
  formeTension: string
  formeTensionAide: string
  formeTriangle: string
  formeTriangleAide: string
  champValeurs: string
  champValeursAide: string
  champSujetsConcernes: string
  champSujetsConcernesAide: string
  champCouleurBasse: string
  champCouleurHaute: string
  retirerEchelle: string
  retirerEchelleConfirme: string
  echelleAjoutee: string
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
    inspirationKinklist: 'La liste dont viennent les items d’« Intimité », et le point de départ du projet.',
    inspirationThunometre: 'Dont viennent l’organisation du projet, les réglages et le fonctionnement hors ligne.',
    inspirationPolitiscales: 'Dont vient l’idée de situer une position politique sur plusieurs axes en tension, reprise dans « Labôrizon ».',
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
    sansPersistance: 'Ce navigateur n’autorise pas l’enregistrement depuis un fichier local : les réponses seront perdues à la fermeture.',
    personneParDefaut: 'Moi',
    renommer: 'Renommer',
    renommerInvite: 'Nouveau nom :',
    toutReplier: 'Tout replier',
    toutDeplier: 'Tout déplier',
    replier: 'Replier',
    deplier: 'Déplier',
    ajouterSujet: '+ sujet',
    ajouterSujetIci: 'Ajouter un sous-sujet ici',
    ajouterSujetTitre: 'Ajouter un sujet',
    ajouterSujetIntro: 'Il vous appartient : personne d’autre ne le verra, et il hérite comme n’importe quel sujet de la grille.',
    ajouter: 'Ajouter',
    annuler: 'Annuler',
    champLibelle: 'Sujet',
    champAide: 'Précision',
    champAideAide: 'Ce qui lève l’ambiguïté, s’il y en a une.',
    champRangement: 'Ranger sous',
    champRangementAide: 'Rien de coché : le sujet apparaît au premier niveau. Plusieurs rubriques : il relève de chacune.',
    champPolarites: 'Polarités',
    champPolaritesAide: 'Les places depuis lesquelles ce sujet se pose. Tout décocher revient à garder celles de la grille.',
    champParts: 'Parts',
    champPartsAide: 'Les façons de le qualifier. Tout décocher revient à garder celles de la grille.',
    champsAvances: 'Ce qui a déjà un réglage',
    retirerSujet: 'Retirer ce sujet',
    retirerSujetConfirme: 'Retirer ce sujet et ce qu’il contient ? Les réponses déjà posées dessus resteront enregistrées.',
    sujetAjoute: 'Ajouté par vous',
    echanger: 'Échanger',
    exporterReponses: 'Exporter mes réponses',
    exporterChecklist: 'Exporter la checklist, sans réponses',
    exporterChecklistAide: 'Les sujets et la façon de les qualifier, vos ajouts compris — à envoyer à qui veut répondre sur la même base.',
    importer: 'Ouvrir un fichier reçu',
    importerAide: 'Une checklist s’ajoute aux grilles proposées ; des réponses rejoignent la personne dont elles viennent, révision par révision.',
    importEchoue: 'Fichier illisible ou d’un autre format.',
    grilleImportee: '(reçue)',
    retirerGrille: 'Retirer cette checklist reçue',
    retirerGrilleConfirme: 'Retirer cette checklist ? Les réponses posées dessus restent enregistrées, et vaudront encore si vous la réimportez.',
    tensionAide: 'Pointez où vous vous situez entre les deux.',
    tensionEtendueAide: 'Pointez où vous vous situez ; glissez d’un bout à l’autre si ça dépend des fois.',
    tensionEtendue: (min: number, bas: number, haut: number, max: number) =>
      `Selon les cas : de ${min} % à ${max} %, le plus souvent entre ${bas} % et ${haut} %.`,
    triangleAide: 'Posez un point entre les trois. Glissez pour dire de combien ça varie autour.',
    yinyangAide: 'Cliquez dans une moitié : plus vous allez vers le bord, plus c’est fort. Les deux sont indépendantes.',
    ajouterEchelle: '+ échelle',
    ajouterEchelleTitre: 'Ajouter une échelle',
    ajouterEchelleIntro: 'Une façon de qualifier les sujets qui vous manque. Elle vous appartient, comme vos sujets ajoutés.',
    champEchelleNom: 'Nom de l’échelle',
    champForme: 'Forme',
    champFormeAide: 'Comment on y répond.',
    formeCrans: 'Des crans',
    formeCransAide: 'Des réponses nommées, du plus bas au plus haut. C’est ce qui se compare le mieux.',
    formeTension: 'Entre deux extrêmes',
    formeTensionAide: 'Un curseur entre deux façons de faire qui se valent, et l’étendue de ce qui varie.',
    formeTriangle: 'Entre trois extrêmes',
    formeTriangleAide: 'Un point entre trois directions, avec l’amplitude autour.',
    champValeurs: 'Les valeurs, une par ligne',
    champValeursAide: 'Des crans du plus bas au plus haut, ou les extrêmes (deux, ou trois). Un score entre 0 et 1 peut suivre après « | » quand les crans ne sont pas réguliers.',
    champSujetsConcernes: 'Sujets concernés',
    champSujetsConcernesAide: 'Rien de coché : l’échelle vaut pour toute la grille. Une rubrique cochée l’étend à ce qu’elle contient.',
    champCouleurBasse: 'Couleur au plus bas',
    champCouleurHaute: 'Couleur au plus haut',
    retirerEchelle: 'Retirer cette échelle',
    retirerEchelleConfirme: 'Retirer cette échelle ? Les réponses posées dessus restent enregistrées.',
    echelleAjoutee: 'Échelle ajoutée par vous',
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
    inspirationKinklist: 'The list the “Intimacy” items come from, and the starting point of the project.',
    inspirationThunometre: 'Where the project layout, the settings and the offline support come from.',
    inspirationPolitiscales: 'Where the idea of placing a political stance on several opposed axes comes from, reused in “Labôrizon”.',
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
    sansPersistance: 'This browser does not allow storage from a local file: answers will be lost when you close it.',
    personneParDefaut: 'Me',
    renommer: 'Rename',
    renommerInvite: 'New name:',
    toutReplier: 'Collapse all',
    toutDeplier: 'Expand all',
    replier: 'Collapse',
    deplier: 'Expand',
    ajouterSujet: '+ subject',
    ajouterSujetIci: 'Add a sub-subject here',
    ajouterSujetTitre: 'Add a subject',
    ajouterSujetIntro: 'It is yours: nobody else sees it, and it inherits like any subject of the grid.',
    ajouter: 'Add',
    annuler: 'Cancel',
    champLibelle: 'Subject',
    champAide: 'Detail',
    champAideAide: 'What removes the ambiguity, if there is one.',
    champRangement: 'File under',
    champRangementAide: 'Nothing ticked: the subject shows at top level. Several sections: it belongs to each.',
    champPolarites: 'Polarities',
    champPolaritesAide: 'The places this subject arises from. Unticking everything keeps those of the grid.',
    champParts: 'Parts',
    champPartsAide: 'The ways to qualify it. Unticking everything keeps those of the grid.',
    champsAvances: 'Already set for you',
    retirerSujet: 'Remove this subject',
    retirerSujetConfirme: 'Remove this subject and what it contains? Answers already given on it stay stored.',
    sujetAjoute: 'Added by you',
    echanger: 'Exchange',
    exporterReponses: 'Export my answers',
    exporterChecklist: 'Export the checklist, without answers',
    exporterChecklistAide: 'The subjects and how to qualify them, your additions included — to send to whoever answers on the same basis.',
    importer: 'Open a received file',
    importerAide: 'A checklist joins the offered grids; answers go back to the person they come from, revision by revision.',
    importEchoue: 'Unreadable file, or another format.',
    grilleImportee: '(received)',
    retirerGrille: 'Remove this received checklist',
    retirerGrilleConfirme: 'Remove this checklist? Answers given on it stay stored, and will still hold if you import it again.',
    tensionAide: 'Point where you stand between the two.',
    tensionEtendueAide: 'Point where you stand; drag from one end to the other if it depends.',
    tensionEtendue: (min: number, bas: number, haut: number, max: number) =>
      `Depending: from ${min} % to ${max} %, most often between ${bas} % and ${haut} %.`,
    triangleAide: 'Place a point between the three. Drag to say how much it varies around it.',
    yinyangAide: 'Click inside a half: the closer to the edge, the stronger. The two are independent.',
    ajouterEchelle: '+ scale',
    ajouterEchelleTitre: 'Add a scale',
    ajouterEchelleIntro: 'A way of qualifying subjects that you are missing. It is yours, like your added subjects.',
    champEchelleNom: 'Scale name',
    champForme: 'Shape',
    champFormeAide: 'How it is answered.',
    formeCrans: 'Steps',
    formeCransAide: 'Named answers, from lowest to highest. This is what compares best.',
    formeTension: 'Between two extremes',
    formeTensionAide: 'A slider between two ways that are worth as much, and the range of what varies.',
    formeTriangle: 'Between three extremes',
    formeTriangleAide: 'A point between three directions, with the spread around it.',
    champValeurs: 'The values, one per line',
    champValeursAide: 'Steps from lowest to highest, or the extremes (two, or three). A score between 0 and 1 may follow after “|” when steps are not regular.',
    champSujetsConcernes: 'Subjects concerned',
    champSujetsConcernesAide: 'Nothing ticked: the scale holds for the whole grid. A ticked section extends it to what it contains.',
    champCouleurBasse: 'Colour at the low end',
    champCouleurHaute: 'Colour at the high end',
    retirerEchelle: 'Remove this scale',
    retirerEchelleConfirme: 'Remove this scale? Answers given on it stay stored.',
    echelleAjoutee: 'Scale added by you',
  },
}

/** Les textes demandés, complétés par le français pour ce qui manque. */
export function textesUi(langue: Langue): Textes {
  return { ...TEXTES.fr, ...TEXTES[langue] }
}

export const LANGUES_LIBELLES: Record<Langue, string> = { fr: 'Français', en: 'English' }
