# check-match

Se situer sur une grille de sujets, critère par critère, et pouvoir comparer avec
quelqu’un d’autre. Tout se passe dans le navigateur, à partir de fichiers statiques.

```
bun install
bun run dev      # développement
bun run check    # grilles, types, tests, build — la porte d’entrée unique
bun run build    # site statique dans dist/
```

## Ce que ça fait

Une **grille** est un graphe de sujets. Sur chacun, on se situe selon plusieurs
**critères** (une branche d’étoile chacun), et depuis plusieurs **facettes** —
par défaut : ce qu’on fait, ce qu’on reçoit, ce dont on est témoin. Pour la
musique : en jouer, en demander, être là pendant qu’il y en a.

Trois mécaniques portent tout le reste.

### L’héritage descendant

Répondre sur une rubrique vaut réponse sur tout ce qu’elle contient, avec le
**même score** mais un **poids atténué** à chaque niveau : une réponse directe
pèse 1, sa fille 0,5, sa petite-fille 0,25. On peut donc se positionner en gros
sur « le son », puis préciser seulement là où on a quelque chose de particulier
à dire. Le poids se lit dans l’étoile : une valeur héritée est plus pâle.

Un sujet peut relever de **plusieurs rubriques** — une soirée dansante est autant
une question de musique que d’usage des espaces communs. Sans réponse propre,
il prend la moyenne de ses parents, pondérée par leur poids : un parent qui a
vraiment répondu compte plus qu’un parent qui héritait lui-même de loin.

### La remontée

À l’inverse, une rubrique peut proposer sa réponse d’après ce qui a été répondu
en dessous. C’est une **proposition**, pas un calcul permanent : renseigner une
rubrique est une prise de position, qui doit pouvoir dire autre chose que la
somme de ses parties. Seules comptent les réponses réellement posées sous elle,
jamais les valeurs qu’elle a elle-même diffusées vers le bas.

### Les réponses appartiennent aux sujets

Une réponse est rangée sous l’identifiant du nœud, jamais sous une position dans
une grille. Deux grilles qui décrivent le même sujet — une version courte et une
longue, deux cadrages — partagent donc les réponses de ce qu’elles ont en commun.
Les identifiants vivent dans la structure, les libellés dans les fichiers de
langue : traduire n’oblige jamais à toucher aux identifiants.

Chaque personne a son propre bac : plusieurs personnes sur le même navigateur ne
s’écrasent pas. Réécrire une réponse l’écrase dans les 24 h ; au-delà, la
précédente est conservée et une révision s’ajoute, pour suivre les évolutions.

## Organisation

```
src/domaine/    graphe, héritage, remontée, traductions — aucune dépendance au DOM
src/rendu/      géométrie de l’étoile (pure) et rendu SVG
src/donnees/    stockage des réponses
src/front/      interface
src/grilles/    les grilles : structure en YAML + un fichier par langue
src/CI/         validation des grilles, import de l’ancien format
```

## Écrire une grille

`src/grilles/<nom>/grille.yml` décrit la structure, `<langue>.yml` les textes.
`bun run valide:grilles` refuse ce qui casserait les calculs : parent inconnu,
cycle, scores non croissants, libellé manquant.

Les scores des paliers sont volontairement **irréguliers** : l’écart entre « ça
compte » et « structurant » n’est pas celui entre « indifférent » et
« accessoire ». Un palier porte aussi un texte long, qui est souvent ce qui lève
vraiment l’ambiguïté ; il apparaît en infobulle.

## État

Deux grilles livrées : **vie collective** (le cas d’usage visé) et **intimité**
(les items viennent de l’ancienne kinklist, tout le reste est neuf).

Pas encore fait : la comparaison entre personnes, l’export d’image, l’édition de
grille depuis l’interface, les langues supplémentaires.

L’implémentation précédente est conservée sur la branche `legacy`.
