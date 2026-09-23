import { agreger, type Contribution } from './agregateurs.ts'
import type { Grille } from './grille.ts'
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
 * Le parcours suit l’ordre topologique des polarités, puis des nœuds, puis des
 * parts, si bien que toute source est calculée avant d’être lue.
 */
export function calculerValeurs(grille: Grille, reponses: Reponses): Valeurs {
  const valeurs: Valeurs = new Map()

  for (const polariteId of grille.ordrePolarites) {
    const polarite = grille.polarites.get(polariteId)
    if (!polarite) continue

    for (const id of grille.ordre) {
      const noeud = grille.noeuds.get(id)
      if (!noeud || !noeud.polarites.includes(polariteId)) continue

      const propre = reponses.get(cle(id, polariteId))
      const etoileValeurs: ValeurPolarite = {}
      valeurs.set(cle(id, polariteId), etoileValeurs)

      // Ordre du calcul : les regroupements avant les branches qu’ils alimentent.
      for (const partId of grille.ordreParts) {
        const part = grille.part(partId)
        if (!part || !noeud.parts.includes(part.id)) continue

        const palierChoisi = propre?.[part.id]
        if (palierChoisi !== undefined && part.steps[palierChoisi]) {
          etoileValeurs[part.id] = {
            score: part.steps[palierChoisi].score, poids: 1, origine: 'propre', detours: 0,
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
          const valeur = valeurs.get(cle(id, polarite.parent))?.[part.id]
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

      // Les parts de regroupement se déduisent de leurs branches quand rien ne
      // les renseigne : c’est un résumé, pas une question de plus à poser.
      remonterVersLesRegroupements(grille, noeud.parts, etoileValeurs)
    }
  }

  return valeurs
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
      poids: sources.reduce((total, source) => total + source.poids, 0) / sources.length,
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
