import { peutRemonter, proposerDepuis, type Direction } from '../domaine/agregation.ts'
import type { Grille } from '../domaine/grille.ts'
import { calculerValeurs, cle, etoile, type Valeurs } from '../domaine/heritage.ts'
import type { Textes } from '../domaine/traduction.ts'
import type { Reponse } from '../domaine/types.ts'
import { creerStockage, type Stockage } from '../donnees/stockage.ts'
import { degradesSvg, etoileSvg } from '../rendu/indicateur.ts'
import { grilles, type GrilleDisponible } from '../grilles/index.ts'

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

interface Etat {
  personne: string | null
  disponible: GrilleDisponible
  ouvert: { noeud: string; polarite: string } | null
}

export function demarrer(racine: HTMLElement, stockage: Stockage = creerStockage({ stockage: localStorage })): void {
  const etat: Etat = {
    personne: stockage.personnes()[0]?.id ?? null,
    disponible: grilles[0]!,
    ouvert: null,
  }

  racine.innerHTML = `
    <header class="entete">
      <h1>check-match</h1>
      <label>Réponses de <select data-personne></select></label>
      <button type="button" data-ajout-personne>+ personne</button>
      <label>Grille <select data-grille></select></label>
      <span class="avancement" data-avancement></span>
    </header>
    <main data-arbre></main>
    <aside class="editeur" data-editeur hidden></aside>`

  const champs = {
    personne: racine.querySelector<HTMLSelectElement>('[data-personne]')!,
    ajout: racine.querySelector<HTMLButtonElement>('[data-ajout-personne]')!,
    grille: racine.querySelector<HTMLSelectElement>('[data-grille]')!,
    avancement: racine.querySelector<HTMLElement>('[data-avancement]')!,
    arbre: racine.querySelector<HTMLElement>('[data-arbre]')!,
    editeur: racine.querySelector<HTMLElement>('[data-editeur]')!,
  }

  const reponses = (): Map<string, Reponse> =>
    etat.personne ? stockage.reponsesCourantes(etat.personne) : new Map()

  function afficher(): void {
    const { grille, textes } = etat.disponible
    const valeurs = calculerValeurs(grille, reponses())

    afficherPersonnes()
    afficherGrilles()
    afficherAvancement(grille, valeurs)
    champs.arbre.innerHTML = degradesCaches(etat.disponible) + arbreHtml(etat.disponible, valeurs, etat)
    afficherEditeur(valeurs)
  }

  function afficherPersonnes(): void {
    const liste = stockage.personnes()
    champs.personne.innerHTML = liste.length
      ? liste.map((personne) =>
        `<option value="${echapper(personne.id)}"${personne.id === etat.personne ? ' selected' : ''}>${echapper(personne.nom)}</option>`).join('')
      : '<option value="">— personne —</option>'
  }

  function afficherGrilles(): void {
    champs.grille.innerHTML = grilles.map((disponible) =>
      `<option value="${echapper(disponible.grille.id)}"${disponible.grille.id === etat.disponible.grille.id ? ' selected' : ''}>${echapper(disponible.textes.titre)}</option>`).join('')
  }

  function afficherAvancement(grille: Grille, valeurs: Valeurs): void {
    let repondus = 0
    let herites = 0
    let total = 0
    for (const noeud of grille.noeuds.values()) {
      for (const polarite of noeud.polarites) {
        total += 1
        const valeursPolarite = Object.values(etoile(valeurs, noeud.id, polarite))
        if (valeursPolarite.some((valeur) => valeur.origine === 'propre')) repondus += 1
        else if (valeursPolarite.some((valeur) => valeur.poids > 0)) herites += 1
      }
    }
    champs.avancement.textContent =
      `${repondus} répondues, ${herites} héritées, ${total - repondus - herites} vides (sur ${total} étoiles)`
  }

  function afficherEditeur(valeurs: Valeurs): void {
    const ouvert = etat.ouvert
    if (!ouvert || !etat.personne) {
      champs.editeur.hidden = true
      champs.editeur.innerHTML = ''
      return
    }
    champs.editeur.hidden = false
    champs.editeur.innerHTML = editeurHtml(etat.disponible, valeurs, ouvert, stockage, etat.personne)
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

  champs.ajout.addEventListener('click', () => {
    const nom = prompt('Nom de cette série de réponses :')
    if (!nom?.trim()) return
    try {
      etat.personne = stockage.ajouterPersonne(nom).id
      afficher()
    } catch (erreur) {
      alert(erreur instanceof Error ? erreur.message : String(erreur))
    }
  })

  champs.personne.addEventListener('change', (evenement) => {
    etat.personne = (evenement.target as HTMLSelectElement).value || null
    etat.ouvert = null
    afficher()
  })

  champs.grille.addEventListener('change', (evenement) => {
    const choisie = grilles.find((d) => d.grille.id === (evenement.target as HTMLSelectElement).value)
    if (choisie) etat.disponible = choisie
    etat.ouvert = null
    afficher()
  })

  champs.arbre.addEventListener('click', (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>('[data-noeud][data-polarite]')
    if (!bouton) return
    if (!etat.personne) {
      alert('Créez d’abord une personne : les réponses sont rangées par personne.')
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
    if (cible.closest('[data-effacer]')) {
      enregistrer({})
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

  afficher()
}

/** Les dégradés sont posés une fois pour toute la page, pas dans chaque étoile. */
function degradesCaches({ grille }: GrilleDisponible): string {
  return `<svg width="0" height="0" aria-hidden="true" class="degrades">${degradesSvg(grille.id, grille.parts)}</svg>`
}

function titreEtoile(textes: Textes, grille: Grille, valeurs: Valeurs, noeud: string, polarite: string): string {
  const etoileValeurs = etoile(valeurs, noeud, polarite)
  const morceaux = grille.parts
    .filter((part) => etoileValeurs[part.id] && etoileValeurs[part.id]!.poids > 0)
    .map((part) => {
      const valeur = etoileValeurs[part.id]!
      const palier = part.paliers.reduce((meilleur, candidat) =>
        Math.abs(candidat.score - valeur.score) < Math.abs(meilleur.score - valeur.score) ? candidat : meilleur)
      return `${textes.part(part.id)} : ${textes.palier(part.id, palier.id)}`
    })
  const prefixe = `${textes.noeud(noeud)} — ${textes.polarite(polarite)}`
  return morceaux.length ? `${prefixe}. ${morceaux.join(', ')}` : `${prefixe}. Rien de renseigné.`
}

function arbreHtml(disponible: GrilleDisponible, valeurs: Valeurs, etat: Etat): string {
  const { grille, textes } = disponible
  const rendu = (id: string, chemin: string[]): string => {
    const noeud = grille.noeuds.get(id)
    if (!noeud) return ''
    // Un nœud à plusieurs parents apparaît sous chacun : il relève bien des deux.
    const repete = noeud.parents.length > 1
    const etoiles = noeud.polarites.map((polarite) => {
      const valeursPolarite = etoile(valeurs, id, polarite)
      const propre = Object.values(valeursPolarite).some((valeur) => valeur.origine === 'propre')
      const ouvert = etat.ouvert?.noeud === id && etat.ouvert.polarite === polarite
      return `<button type="button" class="etoile-bouton${propre ? ' propre' : ''}${ouvert ? ' ouvert' : ''}"
        data-noeud="${echapper(id)}" data-polarite="${echapper(polarite)}"
        title="${echapper(titreEtoile(textes, grille, valeurs, id, polarite))}">
        ${etoileSvg(grille.id, partsDe(grille, noeud.parts), valeursPolarite, { taille: 40, degradesExternes: true })}
        <span class="polarite-nom">${echapper(textes.polarite(polarite))}</span>
      </button>`
    }).join('')

    const aide = textes.aideNoeud(id)
    const enfants = noeud.enfants.filter((enfant) => !chemin.includes(enfant))
    return `<li class="noeud" style="--niveau: ${chemin.length}">
      <div class="ligne">
        <div class="intitule">
          <span class="libelle">${echapper(textes.noeud(id))}</span>
          ${repete ? '<span class="multi" title="Relève de plusieurs rubriques">↔</span>' : ''}
          ${aide ? `<span class="aide">${echapper(aide)}</span>` : ''}
        </div>
        <div class="etoiles">${etoiles}</div>
      </div>
      ${enfants.length ? `<ul>${enfants.map((enfant) => rendu(enfant, [...chemin, id])).join('')}</ul>` : ''}
    </li>`
  }

  return `<ul class="arbre">${grille.racines.map((racine) => rendu(racine, [])).join('')}</ul>`
}

function partsDe(grille: Grille, ids: string[]) {
  return ids.map((id) => grille.part(id)).filter((part) => part !== undefined)
}

/**
 * La remontée est proposée sur chaque sens séparément, et seulement là où elle
 * produirait quelque chose : un bouton qui ne ferait rien vaut moins qu’un
 * bouton absent.
 */
function boutonsRemontee(grille: Grille, valeurs: Valeurs, ouvert: { noeud: string; polarite: string }): string {
  const boutons: string[] = []
  if (peutRemonter(grille, valeurs, ouvert.noeud, ouvert.polarite, 'sujets')) {
    boutons.push('<button type="button" data-deduire="sujets" title="Résumer d’après ce qui est répondu dans les sous-éléments">Déduire des sous-éléments</button>')
  }
  if (peutRemonter(grille, valeurs, ouvert.noeud, ouvert.polarite, 'polarites')) {
    boutons.push('<button type="button" data-deduire="polarites" title="Résumer d’après ce qui est répondu à chaque place">Déduire des places</button>')
  }
  return boutons.join('')
}

function editeurHtml(
  disponible: GrilleDisponible,
  valeurs: Valeurs,
  ouvert: { noeud: string; polarite: string },
  stockage: Stockage,
  personne: string,
): string {
  const { grille, textes } = disponible
  const noeud = grille.noeuds.get(ouvert.noeud)
  if (!noeud) return ''
  const valeursPolarite = etoile(valeurs, ouvert.noeud, ouvert.polarite)
  const saisie = stockage.derniere(personne, cle(ouvert.noeud, ouvert.polarite))?.reponse ?? {}
  const historique = stockage.historique(personne, cle(ouvert.noeud, ouvert.polarite))

  const parts = partsDe(grille, noeud.parts).map((part) => {
    const valeur = valeursPolarite[part.id]
    const choisi = saisie[part.id]
    const paliers = part.paliers.map((palier, index) => {
      const aide = textes.aidePalier(part.id, palier.id)
      return `<button type="button" class="palier${choisi === index ? ' choisi' : ''}"
        data-part="${echapper(part.id)}" data-palier="${index}"
        style="--couleur: ${echapper(part.couleurMax)}"
        ${aide ? `title="${echapper(aide)}"` : ''}>${echapper(textes.palier(part.id, palier.id))}</button>`
    }).join('')

    // Dire d’où vient la valeur affichée est indispensable : héritée, elle
    // n’engage pas la personne de la même façon qu’une réponse posée.
    const provenance = choisi !== undefined
      ? '<span class="provenance propre">réponse directe</span>'
      : valeur && valeur.poids > 0
        ? `<span class="provenance herite">hérité (poids ${valeur.poids.toFixed(2)})</span>`
        : '<span class="provenance vide">non renseigné</span>'

    return `<div class="part">
      <div class="part-nom" style="--couleur: ${echapper(part.couleurMax)}">
        ${echapper(textes.part(part.id))} ${provenance}
      </div>
      ${textes.aidePart(part.id) ? `<p class="aide">${echapper(textes.aidePart(part.id))}</p>` : ''}
      <div class="paliers">${paliers}</div>
    </div>`
  }).join('')

  const revisions = historique.length > 1
    ? `<div class="historique"><h4>${historique.length} révisions</h4><ol>${historique.slice().reverse().map((revision) =>
      `<li>${new Date(revision.le).toLocaleString('fr-FR')}</li>`).join('')}</ol></div>`
    : ''

  return `<header class="editeur-entete">
      <span class="grande-etoile">${etoileSvg(grille.id, partsDe(grille, noeud.parts), valeursPolarite, { taille: 130, degradesExternes: true })}</span>
      <div>
        <h3>${echapper(textes.noeud(ouvert.noeud))} — ${echapper(textes.polarite(ouvert.polarite))}</h3>
        <p class="aide">${echapper(textes.aidePolarite(ouvert.polarite))}</p>
        <code>${echapper(cle(ouvert.noeud, ouvert.polarite))}</code>
      </div>
      <div class="actions">
        ${boutonsRemontee(grille, valeurs, ouvert)}
        <button type="button" data-effacer>Effacer</button>
        <button type="button" data-fermer>Fermer</button>
      </div>
    </header>
    <div class="parts">${parts}</div>
    ${revisions}`
}
