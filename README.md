# check-match

Se situer sur une grille de sujets, et pouvoir comparer avec quelqu’un d’autre.
Tout se passe dans le navigateur, à partir de fichiers statiques.

```
bun install
bun run dev      # développement
bun run check    # grilles, types, tests, build — la porte d’entrée unique
bun run build    # site statique dans dist/
```

## Le vocabulaire

| mot | ce que c’est |
|---|---|
| **nœud** | un sujet : rubrique ou élément, c’est la même chose — seule la place dans le graphe diffère |
| **polarité** | la place depuis laquelle on répond : en général, en faisant, en recevant, en assistant. Une polarité = une étoile entière |
| **part** | une branche de l’étoile : une dimension d’appréciation, avec sa propre échelle et son propre dégradé |
| **palier** | un cran d’une part, avec un score 0..1 volontairement irrégulier |

## Ce que ça fait

Une grille est un **graphe** de sujets. Sur chacun, on se situe part par part,
et depuis plusieurs polarités. Pour la musique : en jouer, en demander, être là
pendant qu’il y en a — trois choses qui n’ont aucune raison d’avoir la même
réponse.

### L’héritage, dans deux directions

Répondre quelque part vaut réponse ailleurs, avec le **même score** mais un
**poids atténué** à chaque niveau franchi. Cela joue dans deux directions, avec
exactement la même règle :

- **sujets** : une rubrique répondue vaut pour tout ce qu’elle contient ;
- **polarités** : la polarité **générale** vaut pour les places particulières.

La polarité générale est ce qui permet de dégrossir vite, sans distinguer les
places, puis de préciser seulement là où elles divergent. Une place peut ensuite
contredire le général : une réponse posée l’emporte toujours sur un héritage.

Un sujet peut relever de **plusieurs rubriques** — une soirée dansante est autant
une question de musique que d’usage des espaces communs. Sans réponse propre, il
prend la synthèse de ses parents, pondérée par leur poids : un parent qui a
vraiment répondu compte plus qu’un parent qui héritait lui-même de loin.

Le poids se lit dans l’étoile : une valeur héritée est d’autant plus pâle qu’elle
vient de loin.

### La remontée

À l’inverse, un nœud peut proposer sa réponse d’après ce qui a été répondu « en
dessous », dans l’une ou l’autre direction : résumer une rubrique d’après ses
éléments, ou déduire le général de ce qu’on a dit à chaque place.

C’est une **proposition**, pas un calcul permanent : renseigner une rubrique est
une prise de position, qui doit pouvoir dire autre chose que la somme de ses
parties. Seules comptent les réponses réellement posées en dessous, jamais les
valeurs que le nœud a lui-même diffusées vers le bas.

### Les agrégateurs

Résumer plusieurs valeurs en une ne se fait pas toujours par la moyenne, et
c’est surtout vrai en remontant. Chaque part choisit sa façon : `moyenne`,
`mediane`, `min`, `max`, `somme`, `produit`.

Une limite se résume par son **minimum** — c’est l’élément le moins acceptable
qui contraint l’ensemble. Une envie ou une importance se résument par leur
**maximum** — il suffit d’un élément qui compte pour que la rubrique compte. La
moyenne, elle, effacerait exactement ce qui est saillant.

### Les réponses appartiennent aux sujets

Une réponse est rangée sous l’identifiant du nœud et de la polarité, jamais sous
une position dans une grille. Deux grilles qui décrivent le même sujet — une
version courte et une longue, deux cadrages — partagent donc les réponses de ce
qu’elles ont en commun. Les identifiants vivent dans la structure, les libellés
dans les fichiers de langue : traduire n’oblige jamais à toucher aux identifiants.

Chaque personne a son propre bac : plusieurs personnes sur le même navigateur ne
s’écrasent pas. Réécrire une réponse l’écrase dans les 24 h ; au-delà, la
précédente est conservée et une révision s’ajoute, pour suivre les évolutions.

## Organisation

```
src/domaine/    graphe, héritage, remontée, agrégateurs — aucune dépendance au DOM
src/rendu/      géométrie de l’étoile (pure) et rendu SVG
src/donnees/    stockage des réponses
src/front/      interface
src/grilles/    les grilles : structure en YAML + un fichier par langue
src/CI/         validation des grilles, import de l’ancien format
```

## Écrire une grille

`src/grilles/<nom>/grille.yml` décrit la structure, `<langue>.yml` les textes.
Les **clés sont en anglais** — une grille est une donnée faite pour circuler —
alors que le code qui les lit reste en français.

```yaml
# grille.yml
polarityAttenuation: 0.5
aggregation: { inheritance: moyenne, rollup: moyenne }

polarities:
  - { id: general, primary: true }
  - { id: agir, parent: general }

parts:
  - id: importance
    minColor: "#BBB"
    maxColor: "#F60"
    aggregation: { rollup: max }   # un seul sujet vital rend la rubrique vitale
    steps:
      - { id: indifferent, score: 0 }
      - { id: vital, score: 1 }

nodes:
  - id: son
    children:
      - id: musique
      - { id: silence, polarities: [recevoir, temoin] }
```

```yaml
# fr.yml
title: Vie collective
polarities:
  general: { label: En général, help: Sans distinguer les places. }
parts:
  importance:
    label: Importance
    steps:
      vital: { label: Vital, help: Si ce n’est pas réglé, je ne peux pas rester. }
nodes:
  son: { label: Son, help: Tout ce qui s’entend depuis les espaces partagés. }
```

`bun run valide:grilles` refuse ce qui casserait les calculs : parent inconnu,
cycle, scores non croissants, agrégateur inconnu, libellé manquant.

Les polarités forment un arbre, dont la racine — la générale — est obligatoire.
Un nœud peut restreindre les polarités qui le concernent ; la restriction vaut
**pour tout son sous-arbre**, et les polarités englobantes sont conservées
d’office, sans quoi on ne pourrait plus dégrossir au-dessus du détail.

Un palier porte aussi un texte long, qui est souvent ce qui lève vraiment
l’ambiguïté ; il apparaît en infobulle.

## État

Deux grilles livrées : **vie collective** (le cas d’usage visé) et **intimité**
(les items viennent de l’ancienne kinklist, tout le reste est neuf).

Pas encore fait : la comparaison entre personnes, l’export d’image, l’édition de
grille depuis l’interface, les langues supplémentaires.

L’implémentation précédente est conservée sur la branche `legacy`.
