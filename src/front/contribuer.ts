import type { Langue } from './preferences.ts'
import { ouvrirPanneau } from './lightbox.ts'

/**
 * Les panneaux « Contribuer » et « Inspirations ».
 *
 * Contribuer reprend, mot pour mot, ce qui est proposé sur 1 Thunomètre : même
 * auteur, mêmes raisons, mêmes moyens. Les identifiants de dons sont donc les
 * mêmes — et c’est voulu : ce qui est soutenu, ce n’est pas un logiciel en
 * particulier, c’est le fait d’en produire des communs.
 *
 * Les textes vivent ici plutôt que dans `i18n.ts` : ils sont longs, propres à
 * ce panneau, et suivent la même règle que partout — le français porte tout,
 * les autres langues complètent ce qu’elles peuvent.
 */

const echapper = (texte: string): string =>
  String(texte).replace(/[&<>"']/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[caractere] ?? caractere))

const EXTERNE = ' target="_blank" rel="noreferrer noopener"'

export const DEPOT = 'https://github.com/ContribuLibre/check-match'
export const COURRIEL = 'citoyen@1000i100.fr'
export const LIBERAPAY = 'https://liberapay.com/1000i100/'
export const MONNAIE_LIBRE = 'https://monnaie-libre.fr/'
export const CLE_G1 = 'g1MiLLiNhZ49bxN9nXcwQES2SAFYa51H63TtRRp3garErAATY'

/** Une adresse par réseau : envoyer sur le mauvais réseau, c’est perdre les fonds. */
export const ADRESSES_CRYPTO = [
  { reseau: 'Bitcoin (BTC)', adresse: 'bc1q6zamwz7xapmc3jmvadym5qc9f6hjmeegwe7fap' },
  { reseau: 'Monero (XMR)', adresse: '42rVinAfWRxg3E93LR3NDr3YuRD5SUrKQ7NpbgBshpRqSiiPrzjMP8eKZ6QoAzDwaRMMg6uizahB51n5SMbCPRra7baU1VK' },
  { reseau: 'Zcash (ZEC)', adresse: 'u1n2v6kc99pcdpzcwvhta4vh07tp2p74ury6nmn0ya4q5c8j37nkafktv8u9r9646a3y6khhk0ylgcd7vylw74lwjr0n0vf2nyutz6gy0mxp4ms3m2w8jw9aa4sx39pquu6re459j5ye7s7z454jexcg7emktty90s6q3q9wjqdsguxvfv7zvwjm059mv4jwh4f5cnd9tzv7s9quz9sd8' },
  { reseau: 'Stellar (XLM)', adresse: 'GDPOPCXCPVLSJMO326ZLWXW5MBQCGUFL3LF2CGLGXBP5WYIVUP3S7JQN' },
  { reseau: 'Réseaux compatibles EVM (Ethereum, BNB Smart Chain, Polygon, Arbitrum…)', adresse: '0x244D32D25A209d0F16fDccf1827f041ceFF0e461' },
  { reseau: 'Réseaux Solana', adresse: 'DfgifKRA8ut5z1Zcq79aGQZYxEtrNmUR8m4WuSrsVxxT' },
  { reseau: 'Réseaux Substrate (Polkadot, Kusama…)', adresse: '5CNheDAdFkATM45Vwf7Qs6XtAZzW7AKpfLTGg6Nuj9Syr2VY' },
  { reseau: 'Réseaux Tron', adresse: 'TLKMqZQYvfFJtZQLWV6vbFD3PYDiBUzzek' },
  { reseau: 'Réseaux XRP Ripple', adresse: 'r4MqKA9WyHf5VPk293mKvz8HTFZpTd2hui' },
  { reseau: 'Réseaux Cosmos (ATOM, Noble, IBC…)', adresse: 'noble1mnmh4xmwjf973tfqrtckte4ryyh9zgztsqcuud' },
] as const

export interface TextesContribuer {
  titre: string
  intro: string
  communiquerTitre: string
  communiquerTexte: string
  communiquerPartage: string
  perenniserTitre: string
  perenniserTexte: string
  perenniserDetail: string
  encouragerTitre: string
  encouragerIntro: string
  encouragerInvitation: string
  encouragerGratitude: string
  cryptoTitre: string
  cryptoTexte: string
  cryptoAvertissement: string
  copier: string
  copie: string
  monnaieLibre: string
  fermer: string
  inspirationsTitre: string
  inspirationsIntro: string
}

const CONTRIBUER: { fr: TextesContribuer } & Partial<Record<Langue, Partial<TextesContribuer>>> = {
  fr: {
    titre: 'Contribue à check-match',
    intro: 'Idées, encouragements, difficultés, bugs, traductions, grilles, dons… Il y a mille manières de contribuer, choisis la tienne.',
    communiquerTitre: 'Communiquer',
    communiquerTexte: `Viens sur le dépôt signaler un problème, proposer une amélioration, une traduction ou une grille. Si tu galères, dis-le-moi par e-mail : ${COURRIEL}`,
    communiquerPartage: 'Tu peux aussi contribuer en faisant connaître l’outil autour de toi et faire tourner le lien sur tes réseaux.',
    perenniserTitre: 'Pérenniser (avec des euros)',
    perenniserTexte: 'Aide à couvrir les frais de serveur, domaine et développement…',
    perenniserDetail: 'Dons ponctuels ou récurrents via Liberapay.',
    encouragerTitre: 'Encourager',
    encouragerIntro: 'Honorer le travail accompli, me remercier de produire des communs, m’encourager à continuer…\nPour ça, tu peux :',
    encouragerInvitation: `M’envoyer un e-mail à ${COURRIEL} pour m’inviter à manger chez toi ou m’héberger quand je passe dans le coin. Tu peux aussi me proposer de venir, défrayé, animer un atelier ou une conférence près de chez toi.`,
    encouragerGratitude: 'Ou simplement me témoigner ta gratitude en m’envoyant tes surplus de Monnaie Libre Ğ1 :',
    cryptoTitre: 'Financer en crypto',
    cryptoTexte: 'Lucide à l’égard des impasses sociales du libertarianisme, les dons, crypto ou non, m’aident à me consacrer aux communs de manière soutenable. Si ta générosité dépasse mes besoins, je redistribuerai au mieux, là où cela me semble le plus utile.',
    cryptoAvertissement: 'Préfère un simple transfert (même réseau et même devise/token) pour être sûr que ton don arrive à destination.',
    copier: 'Copier cette adresse',
    copie: 'Adresse copiée',
    monnaieLibre: 'Monnaie Libre Ğ1',
    fermer: 'Fermer',
    inspirationsTitre: 'Inspirations et origines',
    inspirationsIntro: 'Ce dont ce projet est issu, et ce dont il s’inspire.',
  },
  en: {
    titre: 'Contribute to check-match',
    intro: 'Ideas, encouragement, trouble, bugs, translations, grids, donations… There are a thousand ways to contribute, pick yours.',
    communiquerTitre: 'Talk to me',
    communiquerTexte: `Come to the repository to report a problem, suggest an improvement, a translation or a grid. If you are stuck, tell me by e-mail: ${COURRIEL}`,
    communiquerPartage: 'You can also contribute by making the tool known around you, and passing the link on.',
    perenniserTitre: 'Sustain (with euros)',
    perenniserTexte: 'Help cover server, domain and development costs…',
    perenniserDetail: 'One-off or recurring donations through Liberapay.',
    encouragerTitre: 'Encourage',
    encouragerIntro: 'Honour the work done, thank me for producing commons, encourage me to keep going…\nFor that, you can:',
    encouragerInvitation: `Send me an e-mail at ${COURRIEL} to invite me over for a meal or to host me when I am around. You can also offer to have me run a workshop or a talk near you, expenses covered.`,
    encouragerGratitude: 'Or simply show your gratitude by sending me your surplus of Ğ1 free currency:',
    cryptoTitre: 'Fund in crypto',
    cryptoTexte: 'Clear-eyed about the social dead ends of libertarianism, donations — crypto or not — help me devote myself to the commons sustainably. If your generosity exceeds my needs, I will pass it on where it seems most useful.',
    cryptoAvertissement: 'Prefer a plain transfer (same network, same currency or token) to be sure your donation arrives.',
    copier: 'Copy this address',
    copie: 'Address copied',
    monnaieLibre: 'Ğ1 free currency',
    fermer: 'Close',
    inspirationsTitre: 'Inspirations and origins',
    inspirationsIntro: 'What this project came from, and what it draws on.',
  },
}

export function textesContribuer(langue: Langue): TextesContribuer {
  return { ...CONTRIBUER.fr, ...CONTRIBUER[langue] }
}

/** Un lien vers un e-mail ou un site, posé dans un texte déjà échappé. */
function avecLien(texte: string, cible: string, href: string, externe = false): string {
  const lien = `<a href="${echapper(href)}"${externe ? EXTERNE : ''}>${echapper(cible)}</a>`
  // Remplacement par fonction : une chaîne de remplacement interpréterait les
  // `$&` et consorts que peut contenir une adresse.
  return echapper(texte).replace(echapper(cible), () => lien)
}

function carteLien(href: string, titre: string, paragraphes: string[]): string {
  return `<li class="carte">
    <div class="carte-texte">
      <strong>${echapper(titre)}</strong>
      ${paragraphes.map((texte) => `<p>${avecLien(texte, COURRIEL, `mailto:${COURRIEL}?subject=check-match`)}</p>`).join('')}
    </div>
    <a class="carte-lien" href="${echapper(href)}"${EXTERNE} aria-label="${echapper(titre)}">↗</a>
  </li>`
}

function boutonAdresse(reseau: string, adresse: string, avecReseau = true): string {
  return `<div class="adresse">
    ${avecReseau ? `<span class="adresse-reseau">${echapper(reseau)}</span>` : ''}
    <button type="button" class="adresse-bouton" data-copier="${echapper(adresse)}"
      title="${echapper(reseau)}" aria-label="${echapper(reseau)}"><code>${echapper(adresse)}</code></button>
  </div>`
}

export function contribuerHtml(textes: TextesContribuer): string {
  const encourager = `<li class="carte-bloc">
    <h3>${echapper(textes.encouragerTitre)}</h3>
    ${textes.encouragerIntro.split('\n').map((ligne) => `<p>${echapper(ligne)}</p>`).join('')}
    <p>${avecLien(textes.encouragerInvitation, COURRIEL, `mailto:${COURRIEL}?subject=check-match`)}</p>
    <p>${avecLien(textes.encouragerGratitude, textes.monnaieLibre, MONNAIE_LIBRE, true)}</p>
    ${boutonAdresse('Ğ1', CLE_G1, false)}
  </li>`

  const crypto = `<li class="carte-bloc">
    <details>
      <summary>${echapper(textes.cryptoTitre)}</summary>
      <p>${echapper(textes.cryptoTexte)}</p>
      <p class="avertissement">${echapper(textes.cryptoAvertissement)}</p>
      ${ADRESSES_CRYPTO.map(({ reseau, adresse }) => boutonAdresse(reseau, adresse)).join('')}
    </details>
  </li>`

  return `<p class="aide">${echapper(textes.intro)}</p>
    <ul class="cartes">
      ${carteLien(DEPOT, textes.communiquerTitre, [textes.communiquerTexte, textes.communiquerPartage])}
      ${carteLien(LIBERAPAY, textes.perenniserTitre, [textes.perenniserTexte, textes.perenniserDetail])}
      ${encourager}
      ${crypto}
    </ul>`
}

/**
 * Copie une adresse. `navigator.clipboard` n’existe pas sur toutes les origines
 * — depuis `file://` notamment : on retombe alors sur une sélection, qui laisse
 * au moins la copie à un raccourci clavier.
 */
async function copier(texte: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    return false
  }
}

export function ouvrirContribuer(langue: Langue): void {
  const textes = textesContribuer(langue)
  const dialogue = ouvrirPanneau({
    titre: textes.titre,
    corps: contribuerHtml(textes),
    fermer: textes.fermer,
    classe: 'panneau-contribuer',
  })

  dialogue.addEventListener('click', (evenement) => {
    const bouton = (evenement.target as HTMLElement).closest<HTMLElement>('[data-copier]')
    if (!bouton) return
    void copier(bouton.dataset.copier!).then((fait) => {
      if (fait) {
        bouton.classList.add('copie')
        bouton.setAttribute('data-etat', textes.copie)
        setTimeout(() => { bouton.classList.remove('copie'); bouton.removeAttribute('data-etat') }, 1800)
        return
      }
      // Faute de presse-papiers, on sélectionne : le raccourci clavier reste.
      const plage = document.createRange()
      plage.selectNodeContents(bouton)
      const selection = getSelection()
      selection?.removeAllRanges()
      selection?.addRange(plage)
    })
  })
}

export interface Inspiration {
  nom: string
  url: string
  texte: string
}

export function inspirationsHtml(textes: TextesContribuer, sources: readonly Inspiration[]): string {
  return `<p class="aide">${echapper(textes.inspirationsIntro)}</p>
    <ul class="cartes">
      ${sources.map((source) => carteLien(source.url, source.nom, [source.texte])).join('')}
    </ul>`
}

export function ouvrirInspirations(langue: Langue, sources: readonly Inspiration[]): void {
  const textes = textesContribuer(langue)
  ouvrirPanneau({
    titre: textes.inspirationsTitre,
    corps: inspirationsHtml(textes, sources),
    fermer: textes.fermer,
    classe: 'panneau-contribuer',
  })
}
