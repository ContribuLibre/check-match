import { agreger, type Contribution } from './agregateurs.ts'
import { composantesDuTriangle, estPosition, etendueDe, scoreDe, typeEchelle } from './echelle.ts'
import { sousPolarites, type Grille, type Noeud } from './grille.ts'
import type { Reponse, ValeurPart, ValeurPolarite } from './types.ts'

/** Clé d’une étoile : une réponse porte toujours sur un couple (nœud, polarité). */
export function cle(noeud: string, polarite: string): string {
  return `${noeud}/${polarite}`
}

/** Réponses saisies, indexées par `cle()`. */
export type Reponses = Map<string, Reponse>

/** Valeurs calculées, indexées par `cle()`. */
export type Valeurs = Map<string, ValeurPolarite>

const ABSENT: ValeurPart = { score: 0, poids: 0, origine: 'absent', detours: 0 }

/** Une source d’héritage candidate, avec le détour qu’elle a coûté. */
interface Source extends Contribution {
  detours: number
}

/**
 * Calcule les valeurs de toute la grille à partir des réponses saisies.
 *
 * L’héritage descend dans **trois dimensions**, avec la même règle de fond :
 * le score ne bouge pas, seul le poids est atténué à chaque niveau franchi.
 *
 * - **sujets** : une rubrique répondue vaut pour tout ce qu’elle contient ;
 * - **polarités** : la polarité générale vaut pour les places particulières ;
 * - **parts** : une part de regroupement se répartit sur ses branches, selon la
 *   répartition que la grille déclare — il n’y en a pas qui aille de soi.
 *
 * ## Le plus court chemin d’abord
 *
 * Ces dimensions ne se valent pas. Descendre dans les sujets garde la même
 * place et la même branche : c’est l’héritage qui dit le plus. Changer de
 * polarité ou de part est un **détour** — aimer *recevoir* une chose en dit
 * long sur le fait d’en recevoir une autre de la même catégorie, et beaucoup
 * moins sur l’envie d’en *produire*.
 *
 * On ne mélange donc pas : parmi les sources disponibles, seules celles du plus
 * petit nombre de détours sont retenues. Les autres ne servent qu’en dernier
 * recours, faute de mieux — « pas grand-chose » n’est pas « rien ».
 *
 * Le grain est la part et non l’étoile : on peut très bien avoir répondu à une
 * branche et pas aux autres.
 *
 * ## Deux sens, pas un
 *
 * Deux dimensions remontent aussi, automatiquement, parce qu’elles résument au
 * lieu de poser une question de plus : les branches vers leur regroupement, et
 * les places particulières vers la polarité qui les englobe. Ce qui est remonté
 * redescend ensuite vers les places restées vides — sans quoi un sous-nœud
 * saurait des choses que son propre parent ignore.
 *
 * La direction des sujets, elle, ne remonte pas toute seule : renseigner une
 * rubrique est une prise de position, pas une moyenne. C’est une proposition
 * qu’on accepte d’un geste (voir `agregation.ts`).
 *
 * Le parcours suit l’ordre topologique des nœuds, puis des polarités, puis des
 * parts, si bien que toute source est calculée avant d’être lue.
 */
export function calculerValeurs(grille: Grille, reponses: Reponses): Valeurs {
  const valeurs: Valeurs = new Map()

  for (const id of grille.ordre) {
    const noeud = grille.noeuds.get(id)
    if (!noeud) continue

    // Descente : de la polarité englobante vers les places particulières.
    for (const polariteId of grille.ordrePolarites) {
      if (!noeud.polarites.includes(polariteId)) continue
      const etoileValeurs: ValeurPolarite = {}
      valeurs.set(cle(id, polariteId), etoileValeurs)
      descendre(grille, valeurs, noeud, polariteId, reponses.get(cle(id, polariteId)), etoileValeurs)
      // Les parts de regroupement se déduisent de leurs branches quand rien ne
      // les renseigne : c’est un résumé, pas une question de plus à poser.
      remonterVersLesRegroupements(grille, noeud.parts, etoileValeurs)
    }

    // Puis la remontée des places vers ce qui les englobe, et la redescente de
    // ce qu’elle vient de renseigner.
    remonterVersLesPolaritesEnglobantes(grille, valeurs, noeud)
  }

  return valeurs
}

/** Une étoile, de ses trois sources d’héritage et de la réponse posée dessus. */
function descendre(
  grille: Grille,
  valeurs: Valeurs,
  noeud: Noeud,
  polariteId: string,
  propre: Reponse | undefined,
  etoileValeurs: ValeurPolarite,
): void {
  const polarite = grille.polarites.get(polariteId)
  if (!polarite) return

  // Un triangle est répondu d’un point : les trois branches qu’il porte sont
  // alors posées toutes les trois à la fois, et non héritées.
  const parLeTriangle = new Map<string, number>()
  let amplitude: number | undefined
  for (const partId of grille.ordreParts) {
    const part = grille.part(partId)
    if (!part || typeEchelle(part) !== 'triangle') continue
    const composantes = composantesDuTriangle(part, propre?.[part.id])
    if (!composantes) continue
    for (const [branche, valeur] of Object.entries(composantes)) parLeTriangle.set(branche, valeur)
    const rayon = propre?.[part.id]
    amplitude = estPosition(rayon) ? rayon.amplitude : undefined
  }

  // Ordre du calcul : les regroupements avant les branches qu’ils alimentent.
  for (const partId of grille.ordreParts) {
    const part = grille.part(partId)
    if (!part || !noeud.parts.includes(part.id)) continue

    const posee = parLeTriangle.get(part.id)
    if (posee !== undefined) {
      etoileValeurs[part.id] = {
        score: posee, poids: 1, origine: 'propre', detours: 0, ...(amplitude ? { amplitude } : {}),
      }
      continue
    }

    const score = scoreDe(part, propre?.[part.id])
    if (score !== null) {
      const etendue = etendueDe(propre?.[part.id])
      etoileValeurs[part.id] = {
        score, poids: 1, origine: 'propre', detours: 0, ...(etendue ? { etendue } : {}),
      }
      continue
    }

    const sources: Source[] = []

    // Dimension des sujets : même place, même branche. Aucun détour.
    for (const parent of noeud.parents) {
      const valeur = valeurs.get(cle(parent, polariteId))?.[part.id]
      if (valeur && valeur.poids > 0) {
        sources.push({ score: valeur.score, poids: valeur.poids * grille.attenuation, detours: valeur.detours })
      }
    }

    // Dimension des polarités : on change de place. Un détour.
    if (polarite.parent && noeud.polarites.includes(polarite.parent)) {
      const valeur = valeurs.get(cle(noeud.id, polarite.parent))?.[part.id]
      if (valeur && valeur.poids > 0) {
        sources.push({
          score: valeur.score,
          poids: valeur.poids * grille.attenuationPolarite,
          detours: valeur.detours + 1,
        })
      }
    }

    // Dimension des parts : on change de branche, selon la répartition
    // déclarée par la part englobante. Un détour.
    const partParente = grille.arbreParts.get(part.id)?.parent
    const repartition = partParente
      ? grille.arbreParts.get(partParente)?.definition.spread?.[part.id]
      : undefined
    if (partParente && repartition) {
      const valeur = etoileValeurs[partParente]
      if (valeur && valeur.poids > 0) {
        sources.push({
          score: valeur.score,
          poids: valeur.poids * repartition,
          detours: valeur.detours + 1,
        })
      }
    }

    etoileValeurs[part.id] = resumer(grille, part.id, sources)
  }
}

/**
 * Remonte les places particulières vers la polarité qui les englobe.
 *
 * Répondre « en faisant » et « en recevant » dit quelque chose du général, et
 * c’est même la façon normale de le renseigner : la polarité générale sert
 * autant à dégrossir avant qu’à résumer après.
 *
 * Seules comptent les réponses **propres**, à n’importe quelle profondeur.
 * Reprendre une valeur héritée ferait remonter ce que le général a lui-même
 * diffusé vers le bas : il se confirmerait tout seul.
 *
 * Le poids est atténué comme pour un héritage descendant — un général déduit
 * n’engage pas autant qu’un général répondu.
 */
function remonterVersLesPolaritesEnglobantes(grille: Grille, valeurs: Valeurs, noeud: Noeud): void {
  // Des places vers ce qui les englobe : l’inverse de l’ordre de descente.
  for (const polariteId of [...grille.ordrePolarites].reverse()) {
    if (!noeud.polarites.includes(polariteId)) continue
    const etoileValeurs = valeurs.get(cle(noeud.id, polariteId))
    if (!etoileValeurs) continue
    const sous = sousPolarites(grille, polariteId).filter((id) => noeud.polarites.includes(id))
    if (!sous.length) continue

    let renseignee = false
    for (const partId of noeud.parts) {
      const deja = etoileValeurs[partId]
      if (deja && deja.poids > 0) continue

      const sources: Contribution[] = []
      for (const place of sous) {
        const valeur = valeurs.get(cle(noeud.id, place))?.[partId]
        if (valeur?.origine === 'propre') sources.push({ score: valeur.score, poids: valeur.poids })
      }
      if (!sources.length) continue

      const score = agreger(grille.agregationDe(partId, 'rollup'), sources)
      if (score === null) continue
      etoileValeurs[partId] = {
        score,
        poids: moyenneDesPoids(sources) * grille.attenuationPolarite,
        origine: 'herite',
        detours: 1,
      }
      renseignee = true
    }

    if (!renseignee) continue
    remonterVersLesRegroupements(grille, noeud.parts, etoileValeurs)
    redescendreVersLesPlacesVides(grille, valeurs, noeud, polariteId)
  }
}

/**
 * Redescend ce qu’une remontée vient de renseigner vers les places restées
 * vides. Sans cela, avoir répondu « en faisant » ne dirait rien « en assistant »
 * sur le nœud même, alors que ça le dit déjà sur tous ses sous-nœuds — l’enfant
 * en saurait plus que son parent.
 *
 * On ne remplit que le vide : une place qui tient déjà quelque chose le tient
 * par un chemin plus court.
 */
function redescendreVersLesPlacesVides(grille: Grille, valeurs: Valeurs, noeud: Noeud, depuis: string): void {
  const concernees = new Set(sousPolarites(grille, depuis))
  for (const polariteId of grille.ordrePolarites) {
    if (!concernees.has(polariteId) || !noeud.polarites.includes(polariteId)) continue
    const parent = grille.polarites.get(polariteId)?.parent
    if (!parent || !noeud.polarites.includes(parent)) continue

    const etoileValeurs = valeurs.get(cle(noeud.id, polariteId))
    const englobante = valeurs.get(cle(noeud.id, parent))
    if (!etoileValeurs || !englobante) continue

    let renseignee = false
    for (const partId of noeud.parts) {
      const deja = etoileValeurs[partId]
      if (deja && deja.poids > 0) continue
      const valeur = englobante[partId]
      if (!valeur || valeur.poids <= 0) continue
      etoileValeurs[partId] = {
        score: valeur.score,
        poids: valeur.poids * grille.attenuationPolarite,
        origine: 'herite',
        detours: valeur.detours + 1,
      }
      renseignee = true
    }
    if (renseignee) remonterVersLesRegroupements(grille, noeud.parts, etoileValeurs)
  }
}

function moyenneDesPoids(sources: Contribution[]): number {
  return sources.reduce((total, source) => total + source.poids, 0) / sources.length
}

/**
 * Ne garde que les sources du plus petit nombre de détours, puis les résume.
 * Mélanger un héritage direct avec un héritage venu d’une autre place noierait
 * le premier dans le second.
 */
function resumer(grille: Grille, partId: string, sources: Source[]): ValeurPart {
  if (!sources.length) return ABSENT
  const detours = Math.min(...sources.map((source) => source.detours))
  const retenues = sources.filter((source) => source.detours === detours)

  const score = agreger(grille.agregationDe(partId, 'inheritance'), retenues)
  if (score === null) return ABSENT
  const poids = retenues.reduce((total, source) => total + source.poids, 0) / retenues.length
  return { score, poids, origine: 'herite', detours }
}

/**
 * Remonte les branches vers les parts qui les regroupent, du bas vers le haut.
 * Par défaut au maximum : une part générale dit « ce qui ressort », et non la
 * moyenne de branches qui ne parlent pas de la même chose.
 */
function remonterVersLesRegroupements(grille: Grille, partsDuNoeud: string[], etoileValeurs: ValeurPolarite): void {
  for (const partId of [...grille.ordreParts].reverse()) {
    const part = grille.part(partId)
    if (!part) continue
    const enfants = grille.arbreParts.get(part.id)?.enfants ?? []
    if (!enfants.length || !partsDuNoeud.includes(part.id)) continue
    const deja = etoileValeurs[part.id]
    if (deja && deja.poids > 0) continue

    const sources: Contribution[] = []
    let detours = 0
    for (const enfant of enfants) {
      const valeur = etoileValeurs[enfant]
      if (!valeur || valeur.poids <= 0) continue
      sources.push({ score: valeur.score, poids: valeur.poids })
      detours = Math.max(detours, valeur.detours)
    }
    if (!sources.length) continue

    // Le maximum par défaut, et non l’agrégateur de la grille : regrouper des
    // branches qui ne parlent pas de la même chose, c’est retenir ce qui
    // ressort, pas en faire une moyenne qui ne veut rien dire. La part peut
    // toujours déclarer autre chose.
    const score = agreger(part.aggregation?.rollup ?? 'max', sources)
    if (score === null) continue
    etoileValeurs[part.id] = {
      score,
      poids: moyenneDesPoids(sources),
      origine: 'herite',
      detours: detours + 1,
    }
  }
}

/** Valeur d’une étoile, vide si le nœud ne porte pas cette polarité. */
export function etoile(valeurs: Valeurs, noeud: string, polarite: string): ValeurPolarite {
  return valeurs.get(cle(noeud, polarite)) ?? {}
}

/** Vrai dès qu’au moins une part porte une valeur, héritée comprise. */
export function estRenseignee(valeursEtoile: ValeurPolarite): boolean {
  return Object.values(valeursEtoile).some((valeur) => valeur.poids > 0)
}

/** Vrai si au moins une part a été répondue directement sur ce nœud. */
export function estRepondue(valeursEtoile: ValeurPolarite): boolean {
  return Object.values(valeursEtoile).some((valeur) => valeur.origine === 'propre')
}
