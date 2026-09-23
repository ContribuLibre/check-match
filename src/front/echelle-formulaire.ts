import type { Grille } from '../domaine/grille.ts'
import { lireCrans, lirePoles, type EchelleAjoutee } from '../domaine/parts-ajoutees.ts'
import type { TypeEchelle } from '../domaine/types.ts'
import type { GrilleDisponible } from '../grilles/index.ts'
import type { Champ, OptionsFormulaire, ValeursFormulaire } from './lightbox.ts'
import { sujetsAPlat } from './sujet-formulaire.ts'
import type { Textes } from './i18n.ts'

/**
 * Le formulaire de création d’une échelle.
 *
 * Les crans et les extrêmes s’écrivent en toutes lettres, un par ligne : une
 * liste qu’on ajoute et réordonne à la souris coûterait bien plus cher à faire
 * qu’à écrire, et se relit moins bien. Un score peut suivre le libellé après
 * une barre verticale, pour les échelles dont les crans ne sont pas réguliers.
 */
export function formulaireEchelle(
  disponible: GrilleDisponible,
  ui: Textes,
  langue: string,
): OptionsFormulaire {
  const textes = disponible.textesPour(langue)

  const champs: Champ[] = [
    { id: 'label', libelle: ui.champEchelleNom, type: 'texte', requis: true },
    { id: 'help', libelle: ui.champAide, aide: ui.champAideAide, type: 'zone' },
    {
      id: 'kind',
      libelle: ui.champForme,
      aide: ui.champFormeAide,
      type: 'radios',
      valeur: 'steps',
      options: [
        { valeur: 'steps', libelle: ui.formeCrans, aide: ui.formeCransAide },
        { valeur: 'tension', libelle: ui.formeTension, aide: ui.formeTensionAide },
        { valeur: 'triangle', libelle: ui.formeTriangle, aide: ui.formeTriangleAide },
      ],
    },
    { id: 'valeurs', libelle: ui.champValeurs, aide: ui.champValeursAide, type: 'zone', requis: true },
    {
      id: 'nodes',
      libelle: ui.champSujetsConcernes,
      aide: ui.champSujetsConcernesAide,
      type: 'cases',
      avance: true,
      options: sujetsAPlat(disponible.grille, (id) => textes.noeud(id)),
      valeurs: [],
    },
    { id: 'minColor', libelle: ui.champCouleurBasse, type: 'couleur', valeur: '#445566', avance: true },
    { id: 'maxColor', libelle: ui.champCouleurHaute, type: 'couleur', valeur: '#66bbee', avance: true },
  ]

  return {
    titre: ui.ajouterEchelleTitre,
    intro: ui.ajouterEchelleIntro,
    champs,
    valider: ui.ajouter,
    annuler: ui.annuler,
    reglages: ui.champsAvances,
  }
}

/** Ce que le formulaire rempli veut dire. */
export function lireEchelle(valeurs: ValeursFormulaire, grille: Grille): EchelleAjoutee {
  const texte = (id: string): string => (typeof valeurs[id] === 'string' ? valeurs[id] : '')
  const kind = (['steps', 'tension', 'triangle'].includes(texte('kind')) ? texte('kind') : 'steps') as TypeEchelle
  const lignes = texte('valeurs')

  return {
    label: texte('label'),
    help: texte('help') || undefined,
    kind,
    minColor: texte('minColor') || '#445566',
    maxColor: texte('maxColor') || '#66bbee',
    ...(kind === 'steps' ? { steps: lireCrans(lignes) } : { poles: lirePoles(lignes) }),
    nodes: (Array.isArray(valeurs.nodes) ? valeurs.nodes : []).filter((id) => grille.noeuds.has(id)),
  }
}
