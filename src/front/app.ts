import { peutRemonter, proposerDepuis, type Direction } from '../domaine/agregation.ts'
import type { Grille } from '../domaine/grille.ts'
import { calculerValeurs, cle, etoile, type Valeurs } from '../domaine/heritage.ts'
import type { Textes as TextesGrille } from '../domaine/traduction.ts'
import type {
  PartDefinition, PositionRepondue, Reponse, ReponsePart, ValeurPart, ValeurPolarite,
} from '../domaine/types.ts'
import { estPosition, paliers, typeEchelle, zoneDe } from '../domaine/echelle.ts'
import { tensionSvg, triangleSvg } from '../rendu/echelles.ts'
import { amplitudeDepuis, versBarycentre, versXY } from '../rendu/triangle.ts'
import { moitieDe, scoreDepuis, yinYangSvg } from '../rendu/yinyang.ts'
import { creerStockage, stockagePersistant, type Stockage } from '../donnees/stockage.ts'
import { degradesSvg, etoileSvg } from '../rendu/indicateur.ts'
import { grilles, preparer, type GrilleDisponible } from '../grilles/index.ts'
import { LANGUES_LIBELLES, textesUi, type Textes } from './i18n.ts'
import {
  creerPreferences, LANGUES, NIVEAUX, THEMES,
  type GestionnairePreferences, type Niveau,
} from './preferences.ts'
import { appliquerMiseAJour, surMiseAJourDisponible, versionApplication } from './pwa.ts'
import { creerReplis, type Replis } from './repli.ts'
import { estAjoute } from '../domaine/ajouts.ts'
import { creerAjouts } from '../donnees/ajouts-stockage.ts'
import { creerPartsAjoutees } from '../donnees/parts-stockage.ts'
import { formulaireEchelle, lireEchelle } from './echelle-formulaire.ts'
import { composerChecklist, composerReponses, nomFichier, telecharger } from './export.ts'
import { ouvrirFormulaire } from './lightbox.ts'
import { formulaireSujet, lireSujet } from './sujet-formulaire.ts'
import { DEPOT, ouvrirContribuer, ouvrirInspirations, type Inspiration } from './contribuer.ts'
import { choisirFichier, ErreurImport, lireFichier } from './import.ts'
import { creerGrillesImportees } from '../donnees/grilles-importees.ts'
// Intégrée à la compilation : le build hors ligne est un fichier unique, qui ne
// peut charger aucune image à côté de lui.
import logoSvg from '../../public/icons/icon.svg?raw'

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

const EXTERNE = ' target="_blank" rel="noreferrer noopener"'

/** D’où vient ce projet. Deux sources, donc un panneau plutôt qu’un lien. */
const inspirations = (ui: Textes): Inspiration[] => [
  { nom: 'KinkList', url: 'https://github.com/Goctionni/KinkList', texte: ui.inspirationKinklist },
  { nom: '1 Thunomètre', url: 'https://framagit.org/contribulibre/1thunometre', texte: ui.inspirationThunometre },
  { nom: 'PolitiScales', url: 'https://github.com/Lastenc/politiscales', texte: ui.inspirationPolitiscales },
]

interface Etat {
  personne: string | null
  disponible: GrilleDisponible
  ouvert: { noeud: string; polarite: string } | null
  /** Version proposée par un service worker en attente, s’il y en a une. */
  miseAJour: string | null
}

/** Ce que chaque rendu a besoin de savoir, rassemblé pour ne pas le repasser partout. */
interface Contexte {
  etat: Etat
  ui: Textes
  prefs: GestionnairePreferences
  replis: Replis
}

const support = stockagePersistant()

export function demarrer(
  racine: HTMLElement,
  stockage: Stockage = creerStockage({ stockage: support.stockage }),
  prefs: GestionnairePreferences = creerPreferences(),
): void {
  const ui0 = textesUi(prefs.langue)
  // Quelqu’un qui arrive doit pouvoir répondre tout de suite. On ne lui demande
  // son nom que s’il veut distinguer plusieurs séries de réponses.
  const premiere = stockage.personnes()[0] ?? stockage.ajouterPersonne(ui0.personneParDefaut)

  const etat: Etat = {
    personne: premiere.id,
    disponible: grilles[0]!,
    ouvert: null,
    miseAJour: null,
  }

  let replis = creerReplis(etat.disponible.grille.id, support.stockage)
  const ajouts = creerAjouts(support.stockage)
  const echelles = creerPartsAjoutees(support.stockage)
  const importees = creerGrillesImportees(support.stockage)

  /**
   * Les grilles proposées : celles livrées, puis les checklists reçues.
   * Une checklist illisible est passée sous silence plutôt que de faire tomber
   * la page — elle a pu être écrite par une version plus récente.
   */
  const toutesLesGrilles = (): GrilleDisponible[] => [
    ...grilles,
    ...importees.toutes().flatMap((checklist) => {
      try {
        return [preparer(checklist.definition, checklist.traductions, true)]
      } catch {
        return []
      }
    }),
  ]

  /** La grille choisie, augmentée des sujets que cette personne a ajoutés. */
  const grilleCourante = (): GrilleDisponible => {
    const toutes = toutesLesGrilles()
    const base = toutes.find((d) => d.grille.id === etat.disponible.grille.id
      && d.importee === etat.disponible.importee) ?? toutes[0]!
    if (!etat.personne) return base
    return base.avecAjouts({
      noeuds: ajouts.pourGrille(etat.personne, base.grille.id),
      parts: echelles.pourGrille(etat.personne, base.grille.id),
    })
  }

  racine.innerHTML = `
    <header class="entete" data-entete></header>
    <main data-arbre></main>
    <footer class="pied" data-pied></footer>
    <aside class="editeur" data-editeur hidden></aside>`

  const champs = {
    entete: racine.querySelector<HTMLElement>('[data-entete]')!,
    arbre: racine.querySelector<HTMLElement>('[data-arbre]')!,
    pied: racine.querySelector<HTMLElement>('[data-pied]')!,
    editeur: racine.querySelector<HTMLElement>('[data-editeur]')!,
  }

  const contexte = (): Contexte => ({ etat, ui: textesUi(prefs.langue), prefs, replis })
  const reponses = (): Map<string, Reponse> =>
    etat.personne ? stockage.reponsesCourantes(etat.personne) : new Map()

  function afficher(): void {
    etat.disponible = grilleCourante()
    const ctx = contexte()
    const { grille } = etat.disponible
    const valeurs = calculerValeurs(grille, reponses())

    // Le panneau de réglages reste ouvert d’un rendu à l’autre : le refermer à
    // chaque clic empêcherait d’essayer deux réglages de suite.
    const reglagesOuverts = champs.entete.querySelector<HTMLDetailsElement>('[data-reglages]')?.open ?? false
    champs.entete.innerHTML = enteteHtml(ctx, stockage, reglagesOuverts, toutesLesGrilles())
    afficherAvancement(grille, valeurs, ctx)
    champs.arbre.innerHTML = degradesCaches(etat.disponible) + arbreHtml(etat.disponible, valeurs, ctx)
    champs.pied.innerHTML = piedHtml(ctx)
    afficherEditeur(valeurs, ctx)
  }

  /** Combien d’étoiles sont posées, héritées, encore vides — et sur quel total. */
  function afficherAvancement(grille: Grille, valeurs: Valeurs, ctx: Contexte): void {
    const champ = champs.entete.querySelector<HTMLElement>('[data-avancement]')
    if (!champ) return
    let repondues = 0
    let heritees = 0
    let total = 0
    for (const noeud of grille.noeuds.values()) {
      for (const polarite of polaritesVisibles(grille, noeud, ctx.prefs.niveau)) {
        total += 1
        const valeursPolarite = Object.values(etoile(valeurs, noeud.id, polarite))
        if (valeursPolarite.some((valeur) => valeur.origine === 'propre')) repondues += 1
        else if (valeursPolarite.some((valeur) => valeur.poids > 0)) heritees += 1
      }
    }
    champ.textContent = ctx.ui.avancement(repondues, heritees, total - repondues - heritees, total)
  }

  function afficherEditeur(valeurs: Valeurs, ctx: Contexte): void {
    if (!etat.ouvert || !etat.personne) {
      champs.editeur.hidden = true
      champs.editeur.innerHTML = ''
      return
    }
    champs.editeur.hidden = false
    champs.editeur.innerHTML = editeurHtml(etat.disponible, valeurs, etat.ouvert, stockage, etat.personne, ctx)
  }

  function enregistrer(reponse: Reponse): void {
    if (!etat.ouvert || !etat.personne) return
    stockage.enregistrer(etat.personne, cle(etat.ouvert.noeud, etat.ouvert.polarite), reponse)
    afficher()
  }

  const reponseCourante = (): Reponse => {
    if (!etat.ouvert || !etat.personne) return {}
    return stockage.derniere(etat.personne, cle(etat.ouvert.noeud, etat.ouvert.polarite))?.reponse ?? {}
  }

  // --- en-tête ------------------------------------------------------------

  champs.entete.addEventListener('click', (evenement) => {
    const cible = evenement.target as HTMLElement
    if (cible.closest('[data-ajout-personne]')) {
      const nom = prompt(textesUi(prefs.langue).nommerPersonne)
      if (!nom?.trim()) return
      try {
        etat.personne = stockage.ajouterPersonne(nom).id
        afficher()
      } catch (erreur) {
        alert(erreur instanceof Error ? erreur.message : String(erreur))
      }
      return
    }
    if (cible.closest('[data-renommer]')) {
      const actuelle = stockage.personnes().find((personne) => personne.id === etat.personne)
      const nom = prompt(textesUi(prefs.langue).renommerInvite, actuelle?.nom ?? '')
      if (!nom?.trim()) return
      try {
        stockage.renommerPersonne(etat.personne!, nom)
        afficher()
      } catch (erreur) {
        alert(erreur instanceof Error ? erreur.message : String(erreur))
      }
      return
    }
    if (cible.closest('[data-ajouter-racine]')) {
      void ajouterSujet([])
      return
    }
    if (cible.closest('[data-ajouter-echelle]')) {
      void ajouterEchelle()
      return
    }
    if (cible.closest('[data-exporter-reponses]')) {
      const grilleId = etat.disponible.grille.id
      telecharger(nomFichier('reponses', grilleId),
        composerReponses(grilleId, stockage.exporter(etat.personne!)))
      return
    }
    if (cible.closest('[data-exporter-checklist]')) {
      // La grille telle qu’elle est livrée ou telle qu’elle a été reçue, plus
      // les ajouts : l’étape d’augmentation par personne n’a pas à s’y ajouter
      // deux fois.
      const base = toutesLesGrilles().find((d) => d.grille.id === etat.disponible.grille.id
        && d.importee === etat.disponible.importee)!
      telecharger(nomFichier('checklist', base.grille.id),
        composerChecklist(base.definition, base.traductions, {
          noeuds: ajouts.pourGrille(etat.personne!, base.grille.id),
          parts: echelles.pourGrille(etat.personne!, base.grille.id),
        }))
      return
    }
    if (cible.closest('[data-importer]')) {
      void importer()
      return
    }
    if (cible.closest('[data-retirer-grille]')) {
      if (!confirm(textesUi(prefs.langue).retirerGrilleConfirme)) return
      importees.retirer(etat.disponible.grille.id)
      etat.disponible = grilles[0]!
      etat.ouvert = null
      afficher()
      return
    }
    if (cible.closest('[data-contribuer]')) {
      ouvrirContribuer(prefs.langue)
      return
    }
    if (cible.closest('[data-inspirations]')) {
      ouvrirInspirations(prefs.langue, inspirations(textesUi(prefs.langue)))
      return
    }
    if (cible.closest('[data-tout-replier]')) {
      replis.toutReplier([...etat.disponible.grille.noeuds.values()]
        .filter((noeud) => noeud.enfants.length).map((noeud) => noeud.id))
      afficher()
      return
    }
    if (cible.closest('[data-tout-deplier]')) {
      replis.toutDeplier()
      afficher()
      return
    }
    const reglage = cible.closest<HTMLElement>('[data-reglage]')
    if (reglage) {
      const champ = reglage.dataset.reglage as 'theme' | 'niveau'
      prefs.definir(champ, reglage.dataset.valeur as never)
      afficher()
    }
  })

  champs.entete.addEventListener('change', (evenement) => {
    const champ = evenement.target as HTMLSelectElement
    if (champ.matches('[data-personne]')) {
      etat.personne = champ.value || null
      etat.ouvert = null
    } else if (champ.matches('[data-grille]')) {
      etat.disponible = toutesLesGrilles().find((d) => refGrille(d) === champ.value) ?? grilles[0]!
      replis = creerReplis(etat.disponible.grille.id, support.stockage)
      etat.ouvert = null
    } else if (champ.matches('[data-langue]')) {
      prefs.definir('langue', champ.value as never)
    }
    afficher()
  })

  // --- arbre et éditeur ---------------------------------------------------

  champs.arbre.addEventListener('click', (evenement) => {
    const pliage = (evenement.target as HTMLElement).closest<HTMLElement>('[data-plier]')
    if (pliage) {
      replis.basculer(pliage.dataset.plier!)
      afficher()
      return
    }
    const cible = evenement.target as HTMLElement

    const ajout = cible.closest<HTMLElement>('[data-ajouter-sous]')
    if (ajout) {
      void ajouterSujet([ajout.dataset.ajouterSous!])
      return
    }
    const retrait = cible.closest<HTMLElement>('[data-retirer]')
    if (retrait) {
      if (!confirm(textesUi(prefs.langue).retirerSujetConfirme)) return
      ajouts.retirer(etat.personne!, etat.disponible.grille.id, retrait.dataset.retirer!)
      etat.ouvert = null
      afficher()
      return
    }

    const bouton = cible.closest<HTMLElement>('[data-noeud][data-polarite]')
    if (!bouton) return
    if (!etat.personne) {
      alert(textesUi(prefs.langue).personneDabord)
      return
    }
    const noeud = bouton.dataset.noeud!
    const polarite = bouton.dataset.polarite!
    const dejaOuvert = etat.ouvert?.noeud === noeud && etat.ouvert.polarite === polarite
    etat.ouvert = dejaOuvert ? null : { noeud, polarite }
    afficher()
  })

  champs.editeur.addEventListener('click', (evenement) => {
    const cible = evenement.target as HTMLElement
    if (cible.closest('[data-fermer]')) {
      etat.ouvert = null
      afficher()
      return
    }
    if (cible.closest('[data-effacer]')) return enregistrer({})

    const retraitEchelle = cible.closest<HTMLElement>('[data-retirer-echelle]')
    if (retraitEchelle) {
      if (!confirm(textesUi(prefs.langue).retirerEchelleConfirme)) return
      echelles.retirer(etat.personne!, etat.disponible.grille.id, retraitEchelle.dataset.retirerEchelle!)
      afficher()
      return
    }

    const deduire = cible.closest<HTMLElement>('[data-deduire]')
    if (deduire) {
      const valeurs = calculerValeurs(etat.disponible.grille, reponses())
      const proposition = proposerDepuis(
        etat.disponible.grille, valeurs, etat.ouvert!.noeud, etat.ouvert!.polarite,
        deduire.dataset.deduire as Direction,
      )
      if (Object.keys(proposition).length) enregistrer(proposition)
      return
    }

    const palier = cible.closest<HTMLElement>('[data-palier]')
    if (palier) {
      const part = palier.dataset.part!
      const index = Number(palier.dataset.palier)
      const courante = { ...reponseCourante() }
      // Recliquer le palier déjà choisi le retire : on peut revenir à « pas répondu ».
      if (courante[part] === index) delete courante[part]
      else courante[part] = index
      enregistrer(courante)
    }
  })

  /**
   * Se situer sur une échelle continue.
   *
   * Un simple appui suffit à poser une position. Un cliqué-glissé dit en plus
   * l’étendue : sur une règle, du point de départ au point de lâcher ; dans un
   * triangle, le départ donne le barycentre et la distance parcourue
   * l’amplitude. Une seule geste, deux informations, et personne n’est obligé
   * de faire la seconde.
   */
  champs.editeur.addEventListener('pointerdown', (evenement) => {
    const cible = evenement.target as HTMLElement
    const regle = cible.closest<HTMLElement>('[data-tension]')
    const triangle = cible.closest<HTMLElement>('[data-triangle]')
    const yinyang = cible.closest<HTMLElement>('[data-yinyang]')
    const zone = regle ?? triangle ?? yinyang
    if (!zone) return
    evenement.preventDefault()

    const svg = zone.querySelector('svg')!
    const depart = positionDansSvg(svg, evenement)
    let arrivee = depart
    zone.setPointerCapture?.(evenement.pointerId)

    const suivre = (autre: PointerEvent): void => { arrivee = positionDansSvg(svg, autre) }
    const lacher = (autre: PointerEvent): void => {
      zone.removeEventListener('pointermove', suivre)
      zone.removeEventListener('pointerup', lacher)
      zone.removeEventListener('pointercancel', lacher)
      arrivee = positionDansSvg(svg, autre)
      const courante = { ...reponseCourante() }
      if (regle) courante[regle.dataset.tension!] = tensionSaisie(depart, arrivee, !!regle.dataset.etendue)
      else if (triangle) courante[triangle.dataset.triangle!] = triangleSaisie(depart, arrivee)
      else {
        // Le geste désigne une moitié et une distance : laquelle des deux, et
        // à quel point. Les deux moitiés ne se touchent jamais ensemble.
        const moitie = moitieDe(arrivee[0], arrivee[1])
        const branche = moitie === 'yin' ? yinyang!.dataset.yin! : yinyang!.dataset.yang!
        courante[branche] = { position: scoreDepuis(arrivee[0], arrivee[1]) }
      }
      enregistrer(courante)
    }
    zone.addEventListener('pointermove', suivre)
    zone.addEventListener('pointerup', lacher)
    zone.addEventListener('pointercancel', lacher)
  })

  /**
   * Ouvre le formulaire d’ajout, puis range le sujet.
   *
   * Tout y a un défaut qui convient presque toujours — le rangement proposé est
   * celui d’où l’on a cliqué, les polarités et les parts sont celles de la
   * grille. Ce qui se règle rarement est derrière un repli.
   */
  async function ajouterSujet(parents: string[]): Promise<void> {
    if (!etat.personne) return
    const ui = textesUi(prefs.langue)
    const saisi = await ouvrirFormulaire(formulaireSujet(etat.disponible, parents, ui, prefs.langue))
    if (!saisi) return
    try {
      const sujet = lireSujet(saisi, etat.disponible.grille)
      ajouts.ajouter(etat.personne, etat.disponible.grille.id, sujet, etat.disponible.grille.noeuds.keys())
      // Un sujet ajouté sous une rubrique repliée resterait invisible.
      for (const parent of sujet.parents) if (replis.estReplie(parent)) replis.basculer(parent)
      afficher()
    } catch (erreur) {
      alert(erreur instanceof Error ? erreur.message : String(erreur))
    }
  }

  /**
   * Ouvre le formulaire d’échelle, puis l’ajoute à la grille.
   * Une échelle ajoutée se pose sur les sujets visés — ou sur toute la grille
   * si on n’en vise aucun — et se répond ensuite comme n’importe quelle autre.
   */
  async function ajouterEchelle(): Promise<void> {
    if (!etat.personne) return
    const ui = textesUi(prefs.langue)
    const saisi = await ouvrirFormulaire(formulaireEchelle(etat.disponible, ui, prefs.langue))
    if (!saisi) return
    try {
      echelles.ajouter(etat.personne, etat.disponible.grille.id,
        lireEchelle(saisi, etat.disponible.grille),
        etat.disponible.grille.parts.map((part) => part.id))
      afficher()
    } catch (erreur) {
      alert(erreur instanceof Error ? erreur.message : String(erreur))
    }
  }

  /**
   * Relit un fichier exporté. Le même bouton accepte les deux formats : c’est
   * le fichier qui dit ce qu’il est, et on ne demande pas à quelqu’un de le
   * savoir avant de l’ouvrir.
   */
  async function importer(): Promise<void> {
    const ui = textesUi(prefs.langue)
    const fichier = await choisirFichier()
    if (!fichier) return
    try {
      const lecture = await lireFichier(fichier)
      if (lecture.type === 'checklist') {
        importees.ajouter(lecture.charge)
        // On bascule dessus : l’avoir importée sans la voir n’aurait aucun sens.
        etat.disponible = preparer(lecture.charge.definition, lecture.charge.traductions, true)
        replis = creerReplis(etat.disponible.grille.id, support.stockage)
      } else {
        etat.personne = stockage.importer(lecture.charge.contenu as never).id
      }
      etat.ouvert = null
      afficher()
    } catch (erreur) {
      alert(erreur instanceof ErreurImport && erreur.message !== 'format'
        ? `${ui.importEchoue}\n${erreur.message}`
        : ui.importEchoue)
    }
  }

  champs.pied.addEventListener('click', (evenement) => {
    if ((evenement.target as HTMLElement).closest('[data-appliquer-maj]')) void appliquerMiseAJour()
  })

  // Une version prête à prendre la place s’annonce dans le pied de page, sans
  // rien interrompre : c’est à la personne de choisir quand basculer.
  surMiseAJourDisponible((version) => {
    if (version === versionApplication()) return
    etat.miseAJour = version
    champs.pied.innerHTML = piedHtml(contexte())
  })

  prefs.surChangement(() => { /* le rendu suit déjà chaque action */ })
  afficher()
}

// --- en-tête --------------------------------------------------------------

/**
 * Désigne une grille dans le sélecteur.
 * Une checklist reçue peut porter l’identifiant d’une grille livrée — c’est même
 * le cas quand quelqu’un renvoie la sienne, complétée : il faut donc pouvoir
 * choisir l’une ou l’autre.
 */
function refGrille(disponible: GrilleDisponible): string {
  return `${disponible.importee ? 'i' : 'l'}:${disponible.grille.id}`
}

function enteteHtml(
  ctx: Contexte,
  stockage: Stockage,
  reglagesOuverts: boolean,
  disponibles: GrilleDisponible[],
): string {
  const { etat, ui, prefs } = ctx
  const personnes = stockage.personnes()

  const marque = `<div class="marque">
    <span class="logo" aria-hidden="true">${logoSvg}</span>
    <span>${echapper(ui.titre)}</span>
  </div>`

  const qui = `<label class="champ">${echapper(ui.reponsesDe)}
    <select data-personne aria-label="${echapper(ui.reponsesDe)}">${
      personnes.length
        ? personnes.map((personne) =>
          `<option value="${echapper(personne.id)}"${personne.id === etat.personne ? ' selected' : ''}>${echapper(personne.nom)}</option>`).join('')
        : `<option value="">— ${echapper(ui.personne)} —</option>`
    }</select></label>
    <button type="button" data-renommer title="${echapper(ui.renommer)}" aria-label="${echapper(ui.renommer)}">✎</button>
    <button type="button" data-ajout-personne>${echapper(ui.ajouterPersonne)}</button>`

  const courante = refGrille(etat.disponible)
  const quelleGrille = `<label class="champ">${echapper(ui.grille)}
    <select data-grille aria-label="${echapper(ui.grille)}">${disponibles.map((disponible) =>
      `<option value="${echapper(refGrille(disponible))}"${refGrille(disponible) === courante ? ' selected' : ''}>${
        echapper(disponible.textesPour(prefs.langue).titre)}${disponible.importee ? ` ${ui.grilleImportee}` : ''}</option>`).join('')}</select></label>${
    etat.disponible.importee
      ? `<button type="button" data-retirer-grille title="${echapper(ui.retirerGrille)}" aria-label="${echapper(ui.retirerGrille)}">×</button>`
      : ''}`

  const langue = `<label class="champ">${echapper(ui.langue)}
    <select data-langue aria-label="${echapper(ui.langue)}">${LANGUES.map((code) =>
      `<option value="${code}"${code === prefs.langue ? ' selected' : ''}>${echapper(LANGUES_LIBELLES[code])}</option>`).join('')}</select></label>`

  const choix = (champ: 'theme' | 'niveau', valeurs: readonly string[], courant: string, libelle: (valeur: string) => string) =>
    `<div class="choix" role="group" aria-label="${echapper(champ === 'theme' ? ui.theme : ui.niveau)}">${valeurs.map((valeur) =>
      `<button type="button" class="choix-option${valeur === courant ? ' actif' : ''}"
        data-reglage="${champ}" data-valeur="${valeur}"
        aria-pressed="${valeur === courant}">${echapper(libelle(valeur))}</button>`).join('')}</div>`

  const libelleTheme = (valeur: string) =>
    valeur === 'auto' ? ui.themeAuto : valeur === 'clair' ? ui.themeClair : ui.themeSombre
  const libelleNiveau = (valeur: string) =>
    valeur === 'simple' ? ui.niveauSimple : valeur === 'avancee' ? ui.niveauAvancee : ui.niveauComplete

  const reglages = `<details class="reglages" data-reglages${reglagesOuverts ? ' open' : ''}>
    <summary>⚙ ${echapper(ui.reglages)}</summary>
    <div class="reglages-panneau">
      <div class="reglage"><span class="reglage-nom">${echapper(ui.theme)}</span>${choix('theme', THEMES, prefs.theme, libelleTheme)}</div>
      <div class="reglage"><span class="reglage-nom">${echapper(ui.niveau)}</span>${choix('niveau', NIVEAUX, prefs.niveau, libelleNiveau)}</div>
    </div>
  </details>`

  const outils = `<details class="reglages" data-exports>
    <summary>${echapper(ui.echanger)}</summary>
    <div class="reglages-panneau">
      <button type="button" data-exporter-reponses>${echapper(ui.exporterReponses)}</button>
      <button type="button" data-exporter-checklist>${echapper(ui.exporterChecklist)}</button>
      <p class="aide">${echapper(ui.exporterChecklistAide)}</p>
      <button type="button" data-importer>${echapper(ui.importer)}</button>
      <p class="aide">${echapper(ui.importerAide)}</p>
    </div>
  </details>`

  const pliage = `<div class="pliage">
    <button type="button" data-ajouter-racine title="${echapper(ui.ajouterSujet)}">${echapper(ui.ajouterSujet)}</button>
    <button type="button" data-ajouter-echelle title="${echapper(ui.ajouterEchelleTitre)}">${echapper(ui.ajouterEchelle)}</button>
    <button type="button" data-tout-replier title="${echapper(ui.toutReplier)}">⊟</button>
    <button type="button" data-tout-deplier title="${echapper(ui.toutDeplier)}">⊞</button>
  </div>`

  // Deux panneaux, pas deux liens : contribuer ne se résume pas à une adresse,
  // et d’où vient le projet non plus.
  const liens = `<nav class="entete-liens">
    <button type="button" data-contribuer>${echapper(ui.contribuer)}</button>
    <button type="button" data-inspirations>${echapper(ui.inspiration)}</button>
  </nav>`

  return `${marque}${qui}${quelleGrille}${pliage}${outils}${liens}${langue}${reglages}
    <span class="avancement" data-avancement></span>`
}

// --- pied de page ---------------------------------------------------------

/**
 * Qui l’a fait, sous quelle licence, et quelle version tourne. La version n’est
 * pas une décoration : c’est ce qu’on demande à quelqu’un qui signale un
 * comportement bizarre.
 */
function piedHtml({ etat, ui }: Contexte): string {
  const credits = `<span>${echapper(ui.realisePar)} <a href="https://framagit.org/1000i100/"${EXTERNE}>1000i100</a>,`
    + ` ${echapper(ui.dopeA)}<a href="https://claude.com/claude-code"${EXTERNE}>I.A.</a>`
    + ` — ${echapper(ui.licence)} <a href="https://choosealicense.com/licenses/agpl-3.0/"${EXTERNE}>AGPLv3</a>`
    + ` (<a href="${DEPOT}"${EXTERNE}>${echapper(ui.codeSource)}</a>)</span>`

  const maj = etat.miseAJour
    ? '<span class="version-fleche" aria-hidden="true">→</span>'
      + `<button class="version-maj" type="button" data-appliquer-maj title="${echapper(ui.majPrete)}">`
      + `${echapper(etat.miseAJour)}</button>`
    : ''
  const version = `<div class="version"><span class="version-courante">${echapper(ui.version)} ${echapper(versionApplication())}</span>${maj}</div>`

  // Mieux vaut le dire que laisser quelqu’un remplir une grille pour rien.
  const volatil = support.persistant
    ? ''
    : `<div class="volatil" role="status">${echapper(ui.sansPersistance)}</div>`

  return `<div class="pied-centre">${credits}${volatil}</div>${version}`
}

// --- arbre ----------------------------------------------------------------

/** Les dégradés sont posés une fois pour toute la page, pas dans chaque étoile. */
function degradesCaches({ grille }: GrilleDisponible): string {
  return `<svg width="0" height="0" aria-hidden="true" class="degrades">${degradesSvg(grille.id, grille.parts)}</svg>`
}

function titreEtoile(textes: TextesGrille, ui: Textes, grille: Grille, valeurs: Valeurs, noeud: string, polarite: string): string {
  const etoileValeurs = etoile(valeurs, noeud, polarite)
  const morceaux = grille.parts
    .filter((part) => etoileValeurs[part.id] && etoileValeurs[part.id]!.poids > 0)
    .map((part) => `${textes.part(part.id)} : ${diteEnMots(part, etoileValeurs[part.id]!, textes)}`)
  const prefixe = `${textes.noeud(noeud)} — ${textes.polarite(polarite)}`
  return morceaux.length ? `${prefixe}. ${morceaux.join(', ')}` : `${prefixe}. ${ui.rienRenseigne}`
}

/**
 * Une valeur dite en mots, pour une infobulle ou un lecteur d’écran.
 * Un cran porte son nom ; une position se dit par l’extrême dont elle est la
 * plus proche, avec sa part — « plutôt X », c’est déjà se situer.
 */
function diteEnMots(part: PartDefinition, valeur: ValeurPart, textes: TextesGrille): string {
  if (typeEchelle(part) === 'tension') {
    const [bas, haut] = part.poles ?? []
    const vers = valeur.score >= 0.5 ? haut : bas
    const part100 = Math.round((valeur.score >= 0.5 ? valeur.score : 1 - valeur.score) * 100)
    return `${textes.pole(part.id, vers ?? '')} ${part100} %`
  }
  const crans = paliers(part)
  if (!crans.length) return `${Math.round(valeur.score * 100)} %`
  const palier = crans.reduce((meilleur, candidat) =>
    Math.abs(candidat.score - valeur.score) < Math.abs(meilleur.score - valeur.score) ? candidat : meilleur)
  return textes.palier(part.id, palier.id)
}

/**
 * Les polarités montrées.
 * En mode simple, la principale seule : une étoile par sujet suffit pour se
 * situer, et trois colonnes de plus ne feraient que décourager.
 */
function polaritesVisibles(grille: Grille, noeud: { polarites: string[] }, niveau: Niveau): string[] {
  if (niveau !== 'simple') return noeud.polarites
  const principale = [...grille.polarites.values()].find((polarite) => polarite.principale)?.id
    ?? grille.polariteRacine
  return noeud.polarites.filter((polarite) => polarite === principale)
}

function arbreHtml(disponible: GrilleDisponible, valeurs: Valeurs, ctx: Contexte): string {
  const grille = disponible.grille
  const textes = disponible.textesPour(ctx.prefs.langue)
  const { etat, ui, prefs, replis } = ctx

  const rendu = (id: string, chemin: string[]): string => {
    const noeud = grille.noeuds.get(id)
    if (!noeud) return ''
    // Un nœud à plusieurs parents apparaît sous chacun : il relève bien des deux.
    const repete = noeud.parents.length > 1
    const etoiles = polaritesVisibles(grille, noeud, prefs.niveau).map((polarite) => {
      const valeursPolarite = etoile(valeurs, id, polarite)
      const propre = Object.values(valeursPolarite).some((valeur) => valeur.origine === 'propre')
      const ouvert = etat.ouvert?.noeud === id && etat.ouvert.polarite === polarite
      return `<button type="button" class="etoile-bouton${propre ? ' propre' : ''}${ouvert ? ' ouvert' : ''}"
        data-noeud="${echapper(id)}" data-polarite="${echapper(polarite)}"
        title="${echapper(titreEtoile(textes, ui, grille, valeurs, id, polarite))}">
        ${etoileSvg(grille.id, branchesDe(grille, noeud.parts), valeursPolarite, { taille: 40, degradesExternes: true })}
        <span class="polarite-nom">${echapper(textes.polarite(polarite))}</span>
      </button>`
    }).join('')

    const aide = textes.aideNoeud(id)
    const enfants = noeud.enfants.filter((enfant) => !chemin.includes(enfant))
    const replie = replis.estReplie(id)
    const propre = estAjoute(id)
    // Le nombre de sous-sujets cachés : sans lui, une rubrique repliée ne dit
    // pas ce qu’elle contient.
    const pliage = enfants.length
      ? `<button type="button" class="plier" data-plier="${echapper(id)}"
          aria-expanded="${!replie}" title="${echapper(replie ? ui.deplier : ui.replier)}">
          <span class="chevron" aria-hidden="true">${replie ? '▸' : '▾'}</span>${replie ? `<span class="compte">${enfants.length}</span>` : ''}
        </button>`
      : '<span class="plier-vide" aria-hidden="true"></span>'

    return `<li class="noeud" style="--niveau: ${chemin.length}">
      <div class="ligne">
        <div class="intitule">
          ${pliage}
          <span class="libelle">${echapper(textes.noeud(id))}</span>
          ${repete ? `<span class="multi" title="${echapper(ui.plusieursRubriques)}">↔</span>` : ''}
          ${propre ? `<span class="marque-ajout" title="${echapper(ui.sujetAjoute)}">✚</span>` : ''}
          ${aide ? `<span class="aide">${echapper(aide)}</span>` : ''}
          <span class="actions-noeud">
            <button type="button" data-ajouter-sous="${echapper(id)}" title="${echapper(ui.ajouterSujetIci)}">+</button>
            ${propre ? `<button type="button" data-retirer="${echapper(id)}" title="${echapper(ui.retirerSujet)}">×</button>` : ''}
          </span>
        </div>
        <div class="etoiles">${etoiles}</div>
      </div>
      ${enfants.length && !replie ? `<ul>${enfants.map((enfant) => rendu(enfant, [...chemin, id])).join('')}</ul>` : ''}
    </li>`
  }

  return `<ul class="arbre">${grille.racines.map((racine) => rendu(racine, [])).join('')}</ul>`
}

/** Les parts applicables à un nœud, dans l’ordre de la grille. */
function partsDe(grille: Grille, ids: string[]) {
  return ids.map((id) => grille.part(id)).filter((part) => part !== undefined)
}

/**
 * Les branches dessinées : uniquement les feuilles.
 * Une part de regroupement sert à cocher vite, elle ne dit rien de plus que ce
 * qu’elle a réparti sur ses branches — la dessiner doublerait l’information.
 */
function branchesDe(grille: Grille, ids: string[]) {
  return partsDe(grille, ids).filter((part) => grille.partsFeuilles.includes(part.id))
}

/**
 * La remontée est proposée dans chaque direction séparément, et seulement là où
 * elle produirait quelque chose : un bouton qui ne fait rien vaut moins qu’un
 * bouton absent.
 */
function boutonsRemontee(grille: Grille, valeurs: Valeurs, ouvert: { noeud: string; polarite: string }, ui: Textes): string {
  const boutons: string[] = []
  if (peutRemonter(grille, valeurs, ouvert.noeud, ouvert.polarite, 'sujets')) {
    boutons.push(`<button type="button" data-deduire="sujets" title="${echapper(ui.deduireSousElementsAide)}">${echapper(ui.deduireSousElements)}</button>`)
  }
  if (peutRemonter(grille, valeurs, ouvert.noeud, ouvert.polarite, 'polarites')) {
    boutons.push(`<button type="button" data-deduire="polarites" title="${echapper(ui.deduirePlacesAide)}">${echapper(ui.deduirePlaces)}</button>`)
  }
  return boutons.join('')
}

// --- éditeur --------------------------------------------------------------

/**
 * De quoi répondre, selon la forme de l’échelle.
 *
 * Des crans se cliquent. Une tension se pointe sur sa règle, et en interface
 * complète on peut y ajouter l’étendue de ce qu’on vit — « ça dépend des fois »
 * est une réponse, et souvent la vraie. Un triangle se pointe aussi, et un
 * cliqué-glissé y trace en plus l’amplitude autour du point.
 */
function saisieHtml(
  part: PartDefinition,
  valeursPolarite: ValeurPolarite,
  choisi: ReponsePart | undefined,
  textes: TextesGrille,
  ctx: Contexte,
): string {
  const valeur = valeursPolarite[part.id]
  const { ui, prefs } = ctx

  if (typeEchelle(part) === 'tension') {
    const [bas, haut] = part.poles ?? []
    const etendue = prefs.montre('complete')
    return `<div class="tension-saisie" data-tension="${echapper(part.id)}"
        ${etendue ? ` data-etendue="1" title="${echapper(ui.tensionEtendueAide)}"` : ''}>
      <span class="pole">${echapper(textes.pole(part.id, bas ?? ''))}</span>
      ${tensionSvg(part, valeur, { titre: textes.part(part.id) })}
      <span class="pole">${echapper(textes.pole(part.id, haut ?? ''))}</span>
    </div>
    ${etendue && valeur?.etendue
      ? `<p class="aide">${echapper(ui.tensionEtendue(...valeur.etendue.map((borne) => Math.round(borne * 100)) as [number, number, number, number]))}</p>`
      : ''}`
  }

  if (typeEchelle(part) === 'triangle') {
    const poles = part.poles ?? []
    const barycentre = estPosition(choisi) ? choisi.barycentre : undefined
    const zoneCourante = barycentre ? zoneDe(part.zones, barycentre) : null
    const zones = (part.zones ?? []).flatMap((zone) => {
      const point = versXY(zone.position)
      return point ? [{ id: zone.id, point, libelle: textes.zone(part.id, zone.id) }] : []
    })
    return `<div class="triangle-saisie" data-triangle="${echapper(part.id)}" title="${echapper(ui.triangleAide)}">
      ${triangleSvg(barycentre ?? null, estPosition(choisi) ? choisi.amplitude : undefined, {
        zones, zoneActive: zoneCourante, titre: textes.part(part.id),
        couleurs: poles.map((pole) => ctxCouleur(ctx, pole)),
      })}
      <div class="triangle-sommets">${poles.map((pole) =>
        `<span class="pole" style="--couleur: ${echapper(ctxCouleur(ctx, pole))}">${echapper(textes.part(pole))}</span>`).join('')}</div>
      ${zoneCourante ? `<p class="zone-nommee">${echapper(textes.zone(part.id, zoneCourante))}</p>` : ''}
    </div>`
  }

  if (typeEchelle(part) === 'yinyang') {
    const [yin, yang] = (part.poles ?? []).map((pole) => ctx.etat.disponible.grille.part(pole))
    if (!yin || !yang) return ''
    const moitie = (branche: PartDefinition) => {
      const valeur = valeursPolarite[branche.id]
      return {
        score: valeur && valeur.poids > 0 ? valeur.score : null,
        poids: valeur?.poids ?? 0,
        couleur: branche.maxColor,
        libelle: textes.part(branche.id),
      }
    }
    return `<div class="yinyang-saisie" data-yinyang="${echapper(part.id)}"
        data-yin="${echapper(yin.id)}" data-yang="${echapper(yang.id)}" title="${echapper(ui.yinyangAide)}">
      ${yinYangSvg(moitie(yin), moitie(yang), { titre: textes.part(part.id), id: `yy-${part.id}` })}
      <div class="yinyang-cotes">
        <span class="pole" style="--couleur: ${echapper(yin.maxColor)}">${echapper(textes.part(yin.id))}</span>
        <span class="pole" style="--couleur: ${echapper(yang.maxColor)}">${echapper(textes.part(yang.id))}</span>
      </div>
    </div>`
  }

  // Une part continue ne se répond pas directement : elle se lit. C’est le cas
  // des branches d’un triangle, que le point renseigne toutes les trois.
  if (typeEchelle(part) === 'continue') {
    return `<div class="tension-lecture">${tensionSvg(part, valeur, { titre: textes.part(part.id) })}</div>`
  }

  const crans = paliers(part).map((palier, index) => {
    const aide = textes.aidePalier(part.id, palier.id)
    return `<button type="button" class="palier${choisi === index ? ' choisi' : ''}"
      data-part="${echapper(part.id)}" data-palier="${index}"
      style="--couleur: ${echapper(part.maxColor)}"
      ${aide ? `title="${echapper(aide)}"` : ''}>${echapper(textes.palier(part.id, palier.id))}</button>`
  }).join('')
  return `<div class="paliers">${crans}</div>`
}

/** Où un geste est tombé, dans le repère du dessin et non celui de l’écran. */
function positionDansSvg(svg: SVGSVGElement, evenement: PointerEvent): [number, number] {
  const boite = svg.getBoundingClientRect()
  const vue = svg.viewBox.baseVal
  if (!boite.width || !boite.height) return [0, 0]
  return [
    vue.x + ((evenement.clientX - boite.left) / boite.width) * vue.width,
    vue.y + ((evenement.clientY - boite.top) / boite.height) * vue.height,
  ]
}

/**
 * Ce qu’un geste sur une règle veut dire.
 * Glisser en dit plus que pointer : les deux bouts du geste deviennent les
 * extrêmes de ce qu’on vit, et le milieu la position. Un simple appui, lui,
 * ne pose qu’une position.
 */
function tensionSaisie(depart: [number, number], arrivee: [number, number], avecEtendue: boolean): PositionRepondue {
  const debut = positionSurRegle(depart[0])
  const fin = positionSurRegle(arrivee[0])
  if (!avecEtendue || Math.abs(fin - debut) < 0.02) return { position: fin }
  const [min, max] = debut <= fin ? [debut, fin] : [fin, debut]
  // Les déciles sont posés au cinquième de l’intervalle : sans plus
  // d’information, c’est la lecture la plus sobre d’un « de là à là ».
  const marge = (max - min) / 5
  return { position: (min + max) / 2, etendue: [min, min + marge, max - marge, max] }
}

const positionSurRegle = (x: number): number => Math.min(1, Math.max(0, (x - 10) / 180))

/** Le point posé dans un triangle, et l’amplitude que le glissé a tracée autour. */
function triangleSaisie(depart: [number, number], arrivee: [number, number]): PositionRepondue {
  const barycentre = versBarycentre(depart)
  const distance = Math.hypot(arrivee[0] - depart[0], arrivee[1] - depart[1])
  const amplitude = amplitudeDepuis(distance)
  return { barycentre, ...(amplitude > 0.02 ? { amplitude } : {}) }
}

/** La couleur haute d’une part, pour teinter un sommet de triangle. */
function ctxCouleur(ctx: Contexte, partId: string): string {
  return ctx.etat.disponible.grille.part(partId)?.maxColor ?? 'var(--trait, #000)'
}

function editeurHtml(
  disponible: GrilleDisponible,
  valeurs: Valeurs,
  ouvert: { noeud: string; polarite: string },
  stockage: Stockage,
  personne: string,
  ctx: Contexte,
): string {
  const grille = disponible.grille
  const { ui, prefs } = ctx
  const textes = disponible.textesPour(prefs.langue)
  const noeud = grille.noeuds.get(ouvert.noeud)
  if (!noeud) return ''
  const valeursPolarite = etoile(valeurs, ouvert.noeud, ouvert.polarite)
  const saisie = stockage.derniere(personne, cle(ouvert.noeud, ouvert.polarite))?.reponse ?? {}
  const historique = stockage.historique(personne, cle(ouvert.noeud, ouvert.polarite))

  const estRegroupement = (id: string) => (grille.arbreParts.get(id)?.enfants ?? []).length > 0
  // En mode simple, on ne propose que la saisie rapide quand elle existe : c’est
  // exactement ce à quoi elle sert. Sans regroupement, on retombe sur les branches.
  // En mode simple : les regroupements, plus les branches qui n’en ont aucun.
  // Une part de premier niveau ne doit pas disparaître parce qu’un groupe existe
  // à côté d’elle — elle n’est couverte par rien.
  const partsAffichees = prefs.montre('avancee')
    ? partsDe(grille, noeud.parts)
    : partsDe(grille, noeud.parts).filter((part) =>
      estRegroupement(part.id) || !grille.arbreParts.get(part.id)?.parent)

  const parts = partsAffichees.map((part) => {
    const regroupement = estRegroupement(part.id)
    const valeur = valeursPolarite[part.id]
    const choisi = saisie[part.id]

    // Dire d’où vient la valeur affichée est indispensable : héritée, elle
    // n’engage pas la personne de la même façon qu’une réponse posée. Le détail
    // chiffré, lui, n’intéresse que qui veut comprendre le calcul.
    const detail = prefs.montre('complete') && valeur
      ? ` (${valeur.poids.toFixed(2)}, ${valeur.detours} ${valeur.detours > 1 ? ui.detours : ui.detour})`
      : ''
    // C’est l’origine calculée qui fait foi, pas la présence d’une saisie sur
    // cette part précise : les trois branches d’un triangle sont bel et bien
    // posées, même si c’est le point qui les a posées.
    const provenance = valeur?.origine === 'propre'
      ? `<span class="provenance propre">${echapper(ui.reponseDirecte)}</span>`
      : valeur && valeur.poids > 0
        ? `<span class="provenance herite">${echapper(ui.herite)}${echapper(detail)}</span>`
        : `<span class="provenance vide">${echapper(ui.nonRenseigne)}</span>`

    // « Saisie rapide » ne vaut que pour un regroupement qui descend vraiment
    // vers ses branches : un triangle ou un yin-yang ne sont pas des raccourcis,
    // ce sont les questions elles-mêmes.
    // Une échelle ajoutée se retire d’où elle est : sa racine, pas ses branches.
    const propre = estAjoute(part.id) && !grille.arbreParts.get(part.id)?.parent
    return `<div class="part${regroupement ? ' regroupement' : ''}">
      <div class="part-nom" style="--couleur: ${echapper(part.maxColor)}">
        ${echapper(textes.part(part.id))}${part.spread ? ` <span class="rapide">${echapper(ui.saisieRapide)}</span>` : ''}
        ${propre ? `<span class="marque-ajout" title="${echapper(ui.echelleAjoutee)}">✚</span>
          <button type="button" class="retirer-echelle" data-retirer-echelle="${echapper(part.id)}"
            title="${echapper(ui.retirerEchelle)}">×</button>` : ''} ${provenance}
      </div>
      ${textes.aidePart(part.id) ? `<p class="aide">${echapper(textes.aidePart(part.id))}</p>` : ''}
      ${saisieHtml(part, valeursPolarite, choisi, textes, ctx)}
    </div>`
  }).join('')

  const revisions = prefs.montre('complete') && historique.length > 1
    ? `<div class="historique"><h4>${echapper(ui.revisions(historique.length))}</h4><ol>${
      historique.slice().reverse().map((revision) =>
        `<li>${new Date(revision.le).toLocaleString(prefs.langue)}</li>`).join('')}</ol></div>`
    : ''

  const identifiant = prefs.montre('complete')
    ? `<code>${echapper(cle(ouvert.noeud, ouvert.polarite))}</code>`
    : ''

  return `<header class="editeur-entete">
      <span class="grande-etoile">${etoileSvg(grille.id, branchesDe(grille, noeud.parts), valeursPolarite, { taille: 130, degradesExternes: true })}</span>
      <div>
        <h3>${echapper(textes.noeud(ouvert.noeud))} — ${echapper(textes.polarite(ouvert.polarite))}</h3>
        <p class="aide">${echapper(textes.aidePolarite(ouvert.polarite))}</p>
        ${identifiant}
      </div>
      <div class="actions">
        ${prefs.montre('avancee') ? boutonsRemontee(grille, valeurs, ouvert, ui) : ''}
        <button type="button" data-effacer>${echapper(ui.effacer)}</button>
        <button type="button" data-fermer>${echapper(ui.fermer)}</button>
      </div>
    </header>
    <div class="parts">${parts}</div>
    ${revisions}`
}
