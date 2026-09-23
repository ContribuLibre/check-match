/**
 * Boîtes modales : un panneau à lire, ou un formulaire à remplir.
 *
 * Un `prompt()` ne demande qu’une chose et ne sait rien proposer. Dès qu’il faut
 * un libellé **et** une aide **et** un rangement dans l’arborescence, il faut un
 * vrai formulaire — avec des réglages par défaut qui conviennent presque
 * toujours, et qu’on ne déplie que si on veut autre chose.
 *
 * Tout passe par `<dialog>` : la pile, le focus et la touche Échap sont déjà
 * gérés par le navigateur, et ça marche depuis `file://`.
 */

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

export interface OptionChamp {
  valeur: string
  libelle: string
  aide?: string
  /** Décalage d’affichage, pour rendre lisible une arborescence mise à plat. */
  niveau?: number
}

export interface Champ {
  id: string
  libelle: string
  aide?: string
  type: 'texte' | 'zone' | 'cases' | 'radios' | 'couleur'
  /** Valeur de départ d’un champ de texte. */
  valeur?: string
  /** Options cochées au départ, pour un champ à cases. */
  valeurs?: string[]
  options?: OptionChamp[]
  requis?: boolean
  /**
   * Rangé derrière un repli. Un réglage qui a un défaut sensé n’a pas à se
   * montrer d’emblée : il doit juste être là quand on le cherche.
   */
  avance?: boolean
}

export interface OptionsFormulaire {
  titre: string
  intro?: string
  champs: Champ[]
  valider: string
  annuler: string
  /** Intitulé du repli qui porte les champs avancés. */
  reglages?: string
}

/** Ce qu’un formulaire rend : une chaîne par champ de texte, un tableau par champ à cases. */
export type ValeursFormulaire = Record<string, string | string[]>

function champHtml(champ: Champ): string {
  const aide = champ.aide ? `<p class="aide">${echapper(champ.aide)}</p>` : ''

  if (champ.type === 'radios') {
    const options = (champ.options ?? []).map((option, index) => `
      <label class="case"${option.aide ? ` title="${echapper(option.aide)}"` : ''}>
        <input type="radio" name="${echapper(champ.id)}" value="${echapper(option.valeur)}"${
          (champ.valeur ?? (index === 0 ? option.valeur : '')) === option.valeur ? ' checked' : ''}>
        <span>${echapper(option.libelle)}</span>
      </label>`).join('')
    return `<fieldset class="champ-groupe">
      <legend>${echapper(champ.libelle)}</legend>
      ${aide}
      <div class="cases cases-en-ligne">${options}</div>
    </fieldset>`
  }

  if (champ.type === 'couleur') {
    return `<div class="champ-ligne champ-couleur">
      <label for="champ-${echapper(champ.id)}">${echapper(champ.libelle)}</label>
      ${aide}
      <input type="color" name="${echapper(champ.id)}" id="champ-${echapper(champ.id)}"
        value="${echapper(champ.valeur ?? '#888888')}">
    </div>`
  }

  if (champ.type === 'cases') {
    const options = (champ.options ?? []).map((option) => `
      <label class="case" style="--niveau: ${option.niveau ?? 0}"${option.aide ? ` title="${echapper(option.aide)}"` : ''}>
        <input type="checkbox" name="${echapper(champ.id)}" value="${echapper(option.valeur)}"${
          (champ.valeurs ?? []).includes(option.valeur) ? ' checked' : ''}>
        <span>${echapper(option.libelle)}</span>
      </label>`).join('')
    return `<fieldset class="champ-groupe">
      <legend>${echapper(champ.libelle)}</legend>
      ${aide}
      <div class="cases">${options}</div>
    </fieldset>`
  }

  const commun = `name="${echapper(champ.id)}" id="champ-${echapper(champ.id)}"${champ.requis ? ' required' : ''}`
  const saisie = champ.type === 'zone'
    ? `<textarea ${commun} rows="2">${echapper(champ.valeur ?? '')}</textarea>`
    : `<input type="text" ${commun} value="${echapper(champ.valeur ?? '')}">`
  return `<div class="champ-ligne">
    <label for="champ-${echapper(champ.id)}">${echapper(champ.libelle)}</label>
    ${aide}
    ${saisie}
  </div>`
}

/** Le corps du formulaire, séparé de son ouverture pour rester vérifiable. */
export function formulaireHtml(options: OptionsFormulaire): string {
  const simples = options.champs.filter((champ) => !champ.avance)
  const avances = options.champs.filter((champ) => champ.avance)
  const replies = avances.length
    ? `<details class="champs-avances">
        <summary>${echapper(options.reglages ?? '')}</summary>
        ${avances.map(champHtml).join('')}
      </details>`
    : ''

  return `<form method="dialog" class="lightbox-panneau">
    <header class="lightbox-entete">
      <h2>${echapper(options.titre)}</h2>
      <button type="button" class="lightbox-fermer" data-annuler aria-label="${echapper(options.annuler)}">×</button>
    </header>
    <div class="lightbox-corps">
      ${options.intro ? `<p class="aide">${echapper(options.intro)}</p>` : ''}
      ${simples.map(champHtml).join('')}
      ${replies}
    </div>
    <footer class="lightbox-pied">
      <button type="button" data-annuler>${echapper(options.annuler)}</button>
      <button type="submit" class="principal" data-valider>${echapper(options.valider)}</button>
    </footer>
  </form>`
}

/** Relit un formulaire rempli, champ déclaré par champ déclaré. */
export function lireFormulaire(formulaire: HTMLFormElement, champs: Champ[]): ValeursFormulaire {
  const donnees = new FormData(formulaire)
  const valeurs: ValeursFormulaire = {}
  for (const champ of champs) {
    valeurs[champ.id] = champ.type === 'cases'
      ? donnees.getAll(champ.id).map(String)
      : String(donnees.get(champ.id) ?? '').trim()
  }
  return valeurs
}

/**
 * `<dialog>` n’est pas partout aussi complet : certains environnements — les
 * moteurs de test au premier chef — n’ont ni `showModal` ni `close`. On retombe
 * alors sur l’attribut et sur l’événement, plutôt que de lever une exception au
 * premier clic.
 */
function ouvrir(dialogue: HTMLDialogElement): void {
  if (typeof dialogue.showModal === 'function') dialogue.showModal()
  else dialogue.setAttribute('open', '')
}

function fermer(dialogue: HTMLDialogElement): void {
  if (typeof dialogue.close === 'function') dialogue.close()
  else if (dialogue.hasAttribute('open')) {
    dialogue.removeAttribute('open')
    dialogue.dispatchEvent(new Event('close'))
  }
}

function creerDialogue(classe: string, contenu: string): HTMLDialogElement {
  const dialogue = document.createElement('dialog')
  dialogue.className = `lightbox ${classe}`
  dialogue.innerHTML = contenu
  document.body.appendChild(dialogue)
  return dialogue
}

/**
 * Ouvre un formulaire et rend ce qui a été saisi, ou `null` si on a renoncé.
 * Le dialogue disparaît du document en se refermant : rien à nettoyer ensuite.
 */
export function ouvrirFormulaire(options: OptionsFormulaire): Promise<ValeursFormulaire | null> {
  const dialogue = creerDialogue('lightbox-formulaire', formulaireHtml(options))
  const formulaire = dialogue.querySelector('form')!

  return new Promise((resoudre) => {
    let resultat: ValeursFormulaire | null = null

    // `method="dialog"` ferme déjà le dialogue en soumettant, mais pas partout ;
    // le faire explicitement ne coûte rien et ne dépend de personne.
    formulaire.addEventListener('submit', () => {
      resultat = lireFormulaire(formulaire, options.champs)
      fermer(dialogue)
    })
    for (const bouton of dialogue.querySelectorAll('[data-annuler]')) {
      bouton.addEventListener('click', () => fermer(dialogue))
    }
    dialogue.addEventListener('close', () => {
      dialogue.remove()
      resoudre(resultat)
    })

    ouvrir(dialogue)
    dialogue.querySelector<HTMLInputElement>('input[type="text"], textarea')?.focus()
  })
}

/** Ouvre un panneau de lecture : du contenu déjà mis en forme, et un bouton pour fermer. */
export function ouvrirPanneau(options: { titre: string; corps: string; fermer: string; classe?: string }): HTMLDialogElement {
  const dialogue = creerDialogue(`lightbox-panneau-lecture ${options.classe ?? ''}`, `
    <div class="lightbox-panneau">
      <header class="lightbox-entete">
        <h2>${echapper(options.titre)}</h2>
        <button type="button" class="lightbox-fermer" data-fermer aria-label="${echapper(options.fermer)}">×</button>
      </header>
      <div class="lightbox-corps">${options.corps}</div>
    </div>`)

  for (const bouton of dialogue.querySelectorAll('[data-fermer]')) {
    bouton.addEventListener('click', () => fermer(dialogue))
  }
  dialogue.addEventListener('close', () => dialogue.remove())
  ouvrir(dialogue)
  return dialogue
}
