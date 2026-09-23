import type { SujetAjoute } from '../domaine/ajouts.ts'
import type { Grille } from '../domaine/grille.ts'
import type { GrilleDisponible } from '../grilles/index.ts'
import type { Champ, OptionChamp, OptionsFormulaire, ValeursFormulaire } from './lightbox.ts'
import type { Textes } from './i18n.ts'

/**
 * Le formulaire d’ajout d’un sujet.
 *
 * Séparé de l’interface qui l’ouvre : ce qu’il propose et ce qu’il en retient
 * sont des décisions, pas de la mise en page. Notamment celle-ci — tout a un
 * défaut qui convient presque toujours, et ce qui se règle rarement est rangé
 * derrière un repli.
 */

/**
 * Les sujets dans l’ordre où on les lit à l’écran, avec leur profondeur.
 * Un sujet relevant de plusieurs rubriques n’est listé qu’une fois : on choisit
 * un rangement, pas une occurrence.
 */
export function sujetsAPlat(grille: Grille, libelle: (id: string) => string): OptionChamp[] {
  const vus = new Set<string>()
  const options: OptionChamp[] = []
  const descendre = (id: string, niveau: number): void => {
    if (vus.has(id)) return
    vus.add(id)
    options.push({ valeur: id, libelle: libelle(id), niveau })
    for (const enfant of grille.noeuds.get(id)?.enfants ?? []) descendre(enfant, niveau + 1)
  }
  for (const racine of grille.racines) descendre(racine, 0)
  return options
}

export function formulaireSujet(
  disponible: GrilleDisponible,
  parents: string[],
  ui: Textes,
  langue: string,
): OptionsFormulaire {
  const grille = disponible.grille
  const textes = disponible.textesPour(langue)

  const champs: Champ[] = [
    { id: 'label', libelle: ui.champLibelle, type: 'texte', requis: true },
    { id: 'help', libelle: ui.champAide, aide: ui.champAideAide, type: 'zone' },
    {
      id: 'parents',
      libelle: ui.champRangement,
      aide: ui.champRangementAide,
      type: 'cases',
      options: sujetsAPlat(grille, (id) => textes.noeud(id)),
      valeurs: parents,
    },
    {
      id: 'polarities',
      libelle: ui.champPolarites,
      aide: ui.champPolaritesAide,
      type: 'cases',
      avance: true,
      options: [...grille.polarites.values()].map((polarite) => ({
        valeur: polarite.id,
        libelle: textes.polarite(polarite.id),
        aide: textes.aidePolarite(polarite.id),
        niveau: polarite.niveau,
      })),
      valeurs: [...grille.polarites.keys()],
    },
    {
      id: 'parts',
      libelle: ui.champParts,
      aide: ui.champPartsAide,
      type: 'cases',
      avance: true,
      options: grille.parts.map((part) => ({
        valeur: part.id,
        libelle: textes.part(part.id),
        aide: textes.aidePart(part.id),
      })),
      valeurs: grille.parts.map((part) => part.id),
    },
  ]

  return {
    titre: ui.ajouterSujetTitre,
    intro: ui.ajouterSujetIntro,
    champs,
    valider: ui.ajouter,
    annuler: ui.annuler,
    reglages: ui.champsAvances,
  }
}

/**
 * Ce que le formulaire rempli veut dire.
 *
 * Une restriction qui ne restreint rien n’est pas enregistrée : un ajout qui ne
 * dit rien de ses polarités suivra la grille même si elle en gagne une.
 */
export function lireSujet(valeurs: ValeursFormulaire, grille: Grille): SujetAjoute {
  const liste = (id: string): string[] => (Array.isArray(valeurs[id]) ? valeurs[id] : [])
  const restriction = (id: string, toutes: string[]): string[] | undefined => {
    const choisies = liste(id).filter((valeur) => toutes.includes(valeur))
    return choisies.length && choisies.length < toutes.length ? choisies : undefined
  }

  return {
    label: String(valeurs.label ?? ''),
    help: String(valeurs.help ?? '') || undefined,
    parents: liste('parents').filter((id) => grille.noeuds.has(id)),
    polarities: restriction('polarities', [...grille.polarites.keys()]),
    parts: restriction('parts', grille.parts.map((part) => part.id)),
  }
}
