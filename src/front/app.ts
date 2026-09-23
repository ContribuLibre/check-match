import { peutRemonter, proposerDepuis, type Direction } from '../domaine/agregation.ts'
import type { Grille } from '../domaine/grille.ts'
import { calculerValeurs, cle, etoile, type Valeurs } from '../domaine/heritage.ts'
import type { Textes as TextesGrille } from '../domaine/traduction.ts'
import type { Reponse } from '../domaine/types.ts'
import { creerStockage, stockagePersistant, type Stockage } from '../donnees/stockage.ts'
import { degradesSvg, etoileSvg } from '../rendu/indicateur.ts'
import { grilles, type GrilleDisponible } from '../grilles/index.ts'
import { LANGUES_LIBELLES, textesUi, type Textes } from './i18n.ts'
import {
  creerPreferences, LANGUES, NIVEAUX, THEMES,
  type GestionnairePreferences, type Niveau,
} from './preferences.ts'
import { appliquerMiseAJour, surMiseAJourDisponible, versionApplication } from './pwa.ts'
// Intégrée à la compilation : le build hors ligne est un fichier unique, qui ne
// peut charger aucune image à côté de lui.
import logoSvg from '../../public/icons/icon.svg?raw'

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

const EXTERNE = ' target="_blank" rel="noreferrer noopener"'
const DEPOT = 'https://github.com/ContribuLibre/check-match'

/** D’où vient ce projet. Deux sources, donc un panneau plutôt qu’un lien. */
const INSPIRATIONS = [
  { nom: 'KinkList', url: 'https://github.com/Goctionni/KinkList', texte: 'inspirationKinklist' },
  { nom: '1 Thunomètre', url: 'https://framagit.org/contribulibre/1thunometre', texte: 'inspirationThunometre' },
] as const

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
}

const support = stockagePersistant()

export function demarrer(
  racine: HTMLElement,
  stockage: Stockage = creerStockage({ stockage: support.stockage }),
  prefs: GestionnairePreferences = creerPreferences(),
): void {
  const etat: Etat = {
    personne: stockage.personnes()[0]?.id ?? null,
    disponible: grilles[0]!,
    ouvert: null,
    miseAJour: null,
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

  const contexte = (): Contexte => ({ etat, ui: textesUi(prefs.langue), prefs })
  const reponses = (): Map<string, Reponse> =>
    etat.personne ? stockage.reponsesCourantes(etat.personne) : new Map()

  function afficher(): void {
    const ctx = contexte()
    const { grille } = etat.disponible
    const valeurs = calculerValeurs(grille, reponses())

    // Le panneau de réglages reste ouvert d’un rendu à l’autre : le refermer à
    // chaque clic empêcherait d’essayer deux réglages de suite.
    const reglagesOuverts = champs.entete.querySelector<HTMLDetailsElement>('[data-reglages]')?.open ?? false
    const inspirationsOuvertes = champs.entete.querySelector<HTMLDetailsElement>('[data-inspirations]')?.open ?? false
    champs.entete.innerHTML = enteteHtml(ctx, stockage, reglagesOuverts, inspirationsOuvertes)
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
      etat.disponible = grilles.find((d) => d.grille.id === champ.value) ?? grilles[0]!
      etat.ouvert = null
    } else if (champ.matches('[data-langue]')) {
      prefs.definir('langue', champ.value as never)
    }
    afficher()
  })

  // --- arbre et éditeur ---------------------------------------------------

  champs.arbre.addEventListener('click', (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>('[data-noeud][data-polarite]')
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

function enteteHtml(ctx: Contexte, stockage: Stockage, reglagesOuverts: boolean, inspirationsOuvertes = false): string {
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
    <button type="button" data-ajout-personne>${echapper(ui.ajouterPersonne)}</button>`

  const quelleGrille = `<label class="champ">${echapper(ui.grille)}
    <select data-grille aria-label="${echapper(ui.grille)}">${grilles.map((disponible) =>
      `<option value="${echapper(disponible.grille.id)}"${disponible.grille.id === etat.disponible.grille.id ? ' selected' : ''}>${echapper(disponible.textesPour(prefs.langue).titre)}</option>`).join('')}</select></label>`

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

  const inspirations = `<details class="reglages" data-inspirations${inspirationsOuvertes ? ' open' : ''}>
    <summary>${echapper(ui.inspiration)}</summary>
    <div class="reglages-panneau inspirations">
      <p class="aide">${echapper(ui.inspirationIntro)}</p>
      ${INSPIRATIONS.map((source) => `<p class="inspiration">
        <a href="${source.url}"${EXTERNE}>${echapper(source.nom)}</a>
        <span class="aide">${echapper(ui[source.texte])}</span>
      </p>`).join('')}
    </div>
  </details>`

  const liens = `<nav class="entete-liens">
    <a href="${DEPOT}"${EXTERNE}>${echapper(ui.contribuer)}</a>
  </nav>${inspirations}`

  return `${marque}${qui}${quelleGrille}${liens}${langue}${reglages}
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
    .map((part) => {
      const valeur = etoileValeurs[part.id]!
      const palier = part.steps.reduce((meilleur, candidat) =>
        Math.abs(candidat.score - valeur.score) < Math.abs(meilleur.score - valeur.score) ? candidat : meilleur)
      return `${textes.part(part.id)} : ${textes.palier(part.id, palier.id)}`
    })
  const prefixe = `${textes.noeud(noeud)} — ${textes.polarite(polarite)}`
  return morceaux.length ? `${prefixe}. ${morceaux.join(', ')}` : `${prefixe}. ${ui.rienRenseigne}`
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
  const { etat, ui, prefs } = ctx

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
    return `<li class="noeud" style="--niveau: ${chemin.length}">
      <div class="ligne">
        <div class="intitule">
          <span class="libelle">${echapper(textes.noeud(id))}</span>
          ${repete ? `<span class="multi" title="${echapper(ui.plusieursRubriques)}">↔</span>` : ''}
          ${aide ? `<span class="aide">${echapper(aide)}</span>` : ''}
        </div>
        <div class="etoiles">${etoiles}</div>
      </div>
      ${enfants.length ? `<ul>${enfants.map((enfant) => rendu(enfant, [...chemin, id])).join('')}</ul>` : ''}
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
  const partsAffichees = prefs.montre('avancee')
    ? partsDe(grille, noeud.parts)
    : (() => {
        const rapides = partsDe(grille, noeud.parts).filter((part) => estRegroupement(part.id))
        return rapides.length ? rapides : branchesDe(grille, noeud.parts)
      })()

  const parts = partsAffichees.map((part) => {
    const regroupement = estRegroupement(part.id)
    const valeur = valeursPolarite[part.id]
    const choisi = saisie[part.id]
    const paliers = part.steps.map((palier, index) => {
      const aide = textes.aidePalier(part.id, palier.id)
      return `<button type="button" class="palier${choisi === index ? ' choisi' : ''}"
        data-part="${echapper(part.id)}" data-palier="${index}"
        style="--couleur: ${echapper(part.maxColor)}"
        ${aide ? `title="${echapper(aide)}"` : ''}>${echapper(textes.palier(part.id, palier.id))}</button>`
    }).join('')

    // Dire d’où vient la valeur affichée est indispensable : héritée, elle
    // n’engage pas la personne de la même façon qu’une réponse posée. Le détail
    // chiffré, lui, n’intéresse que qui veut comprendre le calcul.
    const detail = prefs.montre('complete') && valeur
      ? ` (${valeur.poids.toFixed(2)}, ${valeur.detours} ${valeur.detours > 1 ? ui.detours : ui.detour})`
      : ''
    const provenance = choisi !== undefined
      ? `<span class="provenance propre">${echapper(ui.reponseDirecte)}</span>`
      : valeur && valeur.poids > 0
        ? `<span class="provenance herite">${echapper(ui.herite)}${echapper(detail)}</span>`
        : `<span class="provenance vide">${echapper(ui.nonRenseigne)}</span>`

    return `<div class="part${regroupement ? ' regroupement' : ''}">
      <div class="part-nom" style="--couleur: ${echapper(part.maxColor)}">
        ${echapper(textes.part(part.id))}${regroupement ? ` <span class="rapide">${echapper(ui.saisieRapide)}</span>` : ''} ${provenance}
      </div>
      ${textes.aidePart(part.id) ? `<p class="aide">${echapper(textes.aidePart(part.id))}</p>` : ''}
      <div class="paliers">${paliers}</div>
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
