# check-match

Se situer sur une grille de sujets, et pouvoir comparer avec quelqu’un d’autre.
Tout se passe dans le navigateur, à partir de fichiers statiques.

```
bun install
bun run dev          # développement
bun run check        # grilles, types, tests, builds — la porte d’entrée unique
bun run build        # site statique dans dist/
bun run build:local  # page unique dans dist-local/, ouvrable en file://
```

Deux cibles pour deux usages. `dist/` est le site publié, avec son service
worker et son manifeste. `dist-local/` est un **`index.html` autonome** : CSS,
script, grilles et logo intégrés, rien à côté. On l’ouvre en double-cliquant, on
l’envoie par courriel, on le garde sur une clé.

Depuis `file://`, un navigateur refuse d’exécuter un module ES — le build local
produit donc un script classique — et bloque souvent `localStorage`, dont la
simple lecture lève alors une exception. L’application retombe sur la mémoire et
le dit dans son pied de page : les réponses ne survivront pas à la fermeture.

## Le vocabulaire

| mot | ce que c’est |
|---|---|
| **nœud** | un sujet : rubrique ou élément, c’est la même chose — seule la place dans le graphe diffère |
| **polarité** | la place depuis laquelle on répond : en général, en faisant, en recevant, en assistant. Une polarité = une étoile entière |
| **part** | une branche de l’étoile : une dimension d’appréciation, avec sa propre échelle et son propre dégradé. Les parts peuvent se regrouper, et un regroupement ne se dessine pas |
| **palier** | un cran d’une part, avec un score 0..1 volontairement irrégulier |
| **extrême** | un bout d’une échelle continue : deux pour une tension, trois pour un triangle |

## Ce que ça fait

Une grille est un **graphe** de sujets. Sur chacun, on se situe part par part,
et depuis plusieurs polarités. Pour la musique : en jouer, en demander, être là
pendant qu’il y en a — trois choses qui n’ont aucune raison d’avoir la même
réponse.

### L’héritage, dans trois dimensions

Répondre quelque part vaut réponse ailleurs, avec le **même score** mais un
**poids atténué** à chaque niveau franchi. Cela joue dans trois dimensions :

- **sujets** : une rubrique répondue vaut pour tout ce qu’elle contient ;
- **polarités** : la polarité **générale** vaut pour les places particulières ;
- **parts** : une part de regroupement se répartit sur ses branches.

Une part de regroupement sert à cocher vite un sujet sans détailler chaque
branche. Elle ne se dessine pas, et elle **ne descend nulle part sans
répartition déclarée** : dire « j’aime bien » en général ne dit pas si c’est
l’envie, l’acceptation ou l’expérience qui est visée. La grille le déclare, et
peut viser une seule branche comme pondérer différemment chacune :

```yaml
spread: { avis: 1, importance: 0.4 }   # l’autonomie, elle, reste à renseigner
```

Dans l’autre sens, les branches remontent vers leur regroupement
automatiquement, **au maximum** par défaut : une part générale dit ce qui
ressort, pas la moyenne de branches qui ne parlent pas de la même chose.

#### Le plus court chemin d’abord

Ces dimensions ne se valent pas. Descendre dans les sujets garde la même place
et la même branche : c’est l’héritage qui dit le plus. Changer de polarité ou de
part est un **détour** — aimer *recevoir* une chose en dit long sur le fait d’en
recevoir une autre de la même catégorie, et beaucoup moins sur l’envie d’en
*produire*.

On ne mélange donc pas : parmi les sources disponibles, seules celles du plus
petit nombre de détours sont retenues. Les autres servent en dernier recours,
faute de mieux — « pas grand-chose » n’est pas « rien ».

La polarité générale est ce qui permet de dégrossir vite, sans distinguer les
places, puis de préciser seulement là où elles divergent. Une place peut ensuite
contredire le général : une réponse posée l’emporte toujours sur un héritage.

Un sujet peut relever de **plusieurs rubriques** — une soirée dansante est autant
une question de musique que d’usage des espaces communs. Sans réponse propre, il
prend la synthèse de ses parents, pondérée par leur poids : un parent qui a
vraiment répondu compte plus qu’un parent qui héritait lui-même de loin.

Le poids se lit dans l’étoile : une valeur héritée est d’autant plus pâle qu’elle
vient de loin.

### Trois façons de répondre

Toutes les questions ne se posent pas en « plus ou moins ». Une part déclare
donc sa forme, sans que le modèle change pour autant : une valeur reste un score
entre 0 et 1 avec son poids, et l’héritage ignore d’où elle vient.

| forme | ce qu’on fait | ce qu’on peut dire en plus |
|---|---|---|
| **crans** (défaut) | on clique une réponse nommée | — |
| **tension** | on se place entre deux extrêmes | l’étendue de ce qui varie, en glissant d’un bout à l’autre |
| **triangle** | on pose un point entre trois extrêmes | l’amplitude autour, en glissant depuis le point |

Une tension met deux façons de faire **qui se valent** face à face — « au fil de
l’eau » contre « posé d’avance » — et aucune n’est un moins de l’autre. En
interface complète, un glissé dit l’étendue de ce qu’on vit : « ça dépend des
fois » est une réponse, et souvent la vraie. Elle se lit en boîte à moustaches :
bornes, et premiers et derniers déciles.

Un triangle met trois directions autour d’un point. Le point posé **est** la
répartition vers les trois branches — la seule qui ne va pas de soi, mais qui se
donne d’un geste. Les repères déclarés par la grille découpent le triangle en
cellules de Voronoï et nomment l’endroit où l’on est tombé ; sans repères, le
triangle n’est pas découpé.

```yaml
- id: cadre
  kind: tension
  poles: [souple, prevu]

- id: decider
  kind: triangle
  poles: [chacun, ensemble, delegue]   # ce sont ses trois branches
  zones:
    - { id: un-peu-des-trois, position: [1, 1, 1] }
```

### La remontée

À l’inverse, un nœud peut proposer sa réponse d’après ce qui a été répondu « en
dessous », dans l’une ou l’autre direction : résumer une rubrique d’après ses
éléments, ou déduire le général de ce qu’on a dit à chaque place.

C’est une **proposition**, pas un calcul permanent : renseigner une rubrique est
une prise de position, qui doit pouvoir dire autre chose que la somme de ses
parties. Seules comptent les réponses réellement posées en dessous, jamais les
valeurs que le nœud a lui-même diffusées vers le bas.

Une exception, parce qu’elle résume au lieu de poser une question de plus : les
places particulières remontent **toutes seules** vers la polarité qui les
englobe, et ce qu’elles y déduisent redescend ensuite vers les places restées
vides. Sans cela, un sous-nœud en saurait plus que son propre parent, puisqu’il
hérite du général, lui.

Sur une échelle en tension, la remontée déduit plus qu’une moyenne : quand
chaque élément a été situé d’un curseur, la rubrique en tire aussi la dispersion
— qui est justement ce qu’une moyenne seule efface.

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
s’écrasent pas. Une personne existe dès l’arrivée sur la page, et se renomme
après coup : on n’a à s’occuper des personnes que le jour où on veut en
distinguer plusieurs. Réécrire une réponse l’écrase dans les 24 h ; au-delà, la
précédente est conservée et une révision s’ajoute, pour suivre les évolutions.

### Ajouter ses propres sujets

Aucune grille ne prévoit tout. Depuis l’interface, on ajoute un sujet et on le
range dans l’arborescence — sous une rubrique, sous un autre ajout, ou au
premier niveau. Il hérite et remonte comme n’importe quel sujet livré.

Un identifiant ajouté commence par `+` (`+poubelles`), et ne peut donc jamais
entrer en collision avec un identifiant de la grille livrée : une mise à jour de
la grille n’écrase pas ce qu’on a ajouté, ni l’inverse. Si le parent choisi
disparaît d’une version ultérieure, le sujet remonte au premier niveau plutôt
que d’empêcher le chargement. Retirer un sujet emporte ce qui ne tenait qu’à
lui, et garde ce qui tient aussi à la grille livrée.

Les ajouts appartiennent à la personne, pas à la grille : deux personnes du même
navigateur ne voient pas les sujets l’une de l’autre.

### Ajouter ses propres échelles

Une grille qualifie ses sujets d’une certaine façon ; ce n’est pas toujours la
bonne pour tout le monde. On ajoute donc ses propres parts — des crans, une
tension, un triangle — en écrivant leurs valeurs une par ligne. Un score peut
suivre après une barre verticale quand les crans ne sont pas réguliers ; sinon
ils se répartissent d’eux-mêmes.

```
Rien | 0
Un peu | 0.2
Beaucoup | 1
```

Une échelle ajoutée peut ne concerner que certains sujets, ce qui est même
l’usage principal : une question particulière appelle souvent une façon de
répondre qui n’aurait aucun sens ailleurs. Cocher une rubrique l’étend à tout ce
qu’elle contient ; ne rien cocher la pose sur toute la grille.

Les repères nommés d’un triangle ne se saisissent pas depuis l’interface : ils
demandent des coordonnées, et restent l’affaire d’une grille écrite à la main.

### Exporter

Deux choses bien distinctes, en JSON :

- **ses réponses** — ce qu’on a dit, historique compris. Ça ne se donne qu’à qui
  on veut ;
- **sa checklist** — les sujets, les polarités, les parts et les textes dans
  toutes les langues, **sans aucune réponse**, sujets et échelles ajoutés
  compris. C’est ce qu’on envoie à quelqu’un pour qu’il réponde sur la même
  base, donc ce qui rend la comparaison possible.

Le YAML reste le format pour écrire une grille à la main ; le JSON est celui qui
circule. Une checklist exportée se reconstruit telle quelle de l’autre côté.

### Importer

Le même bouton relit les deux : c’est le fichier qui dit ce qu’il est. Une
checklist reçue rejoint les grilles proposées, marquée comme telle, et se retire
d’un clic ; des réponses reçues rejoignent la personne dont elles viennent,
révision par révision.

Une checklist est construite pour de bon avant d’être acceptée : mieux vaut
refuser à l’ouverture, en disant pourquoi, qu’afficher une grille qui casse le
calcul trois clics plus loin. Un fichier qui n’annonce pas son format est refusé
plutôt que deviné.

Une checklist reçue garde son identifiant, même s’il est celui d’une grille
livrée : les deux coexistent alors, et partagent de toute façon les réponses de
ce qu’elles ont en commun, puisqu’une réponse appartient au sujet.

## L’interface

Trois niveaux, choisis dans les réglages de l’en-tête. Le modèle a trois
dimensions d’héritage et des poids : tout montrer d’emblée à quelqu’un qui veut
juste cocher quelques items est le meilleur moyen de le faire fuir.

| niveau | ce qu’il montre |
|---|---|
| **simple** | la polarité générale seule, et la saisie rapide quand la grille en propose une |
| **avancée** | toutes les polarités, toutes les parts, les boutons de déduction |
| **complète** | et ce qui explique le calcul : poids, détours, identifiants, historique |

Thème auto / clair / sombre, et langue de l’interface (fr, en) — les trois
réglages sont retenus par le navigateur. Le thème est posé avant le premier
rendu, pour qu’une page réglée en sombre n’apparaisse pas d’abord en clair.

Chaque rubrique se replie, et le repli est retenu par grille. Une grille de deux
cents entrées se parcourt ainsi rubrique par rubrique, sans dérouler le reste.

## Hors ligne et mises à jour

L’application s’installe et fonctionne hors ligne. Une nouvelle version
n’écrase jamais celle qui tourne : elle est téléchargée, attend, et s’annonce
dans le pied de page comme un lien qu’on clique quand on veut — sauf sur un
rechargement de page, qui est une demande implicite de version fraîche.

La version affichée (`v0.1.0+442.f5178da.e148668b1c96`) porte la marque, le
nombre de commits, le sha court et une empreinte du source. C’est ce qu’il faut
demander à quelqu’un qui signale un comportement bizarre.

## Organisation

```
src/domaine/    graphe, héritage, remontée, agrégateurs — aucune dépendance au DOM
src/rendu/      géométrie de l’étoile (pure) et rendu SVG
src/donnees/    stockage des réponses
src/front/      interface, préférences, i18n, service worker
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
cycle, scores non croissants, agrégateur inconnu, YAML illisible, et les valeurs
coupées par une virgule non protégée — `{ help: Partir, revenir }` ne donne pas
l’aide attendue, et rien ne semble cassé pour autant.

### Traduire par morceaux

Une grille de deux cents entrées ne se traduit pas d’un bloc, donc une
traduction partielle est la règle. Ce qui manque retombe sur la **langue par
défaut de la grille**, jamais sur les identifiants techniques : une grille à
moitié traduite se lit sans tomber sur des `soiree-dansante` au milieu du texte.

Seule la langue par défaut doit être complète — c’est elle qui sert de repli, et
c’est la seule que le validateur exige. Pour les autres, il affiche la
couverture sans rien bloquer :

```
· vie-collective/en : 61 % traduit, 23 libellé(s) repris du fr
```

Il en va de même pour l’interface : le français porte toutes les clés, les
autres langues complètent ce qu’elles peuvent.

Les polarités forment un arbre, dont la racine — la générale — est obligatoire.
Un nœud peut restreindre les polarités qui le concernent ; la restriction vaut
**pour tout son sous-arbre**, et les polarités englobantes sont conservées
d’office, sans quoi on ne pourrait plus dégrossir au-dessus du détail.

Un palier porte aussi un texte long, qui est souvent ce qui lève vraiment
l’ambiguïté ; il apparaît en infobulle.

## État

Deux grilles livrées : **vie collective** (le cas d’usage visé) et **intimité**
(les items viennent de l’ancienne kinklist, tout le reste est neuf).

Pas encore fait : la comparaison entre personnes, l’export d’image, la
modification d’un sujet ou d’une échelle déjà ajoutés (on les retire et on les
refait), les repères de triangle depuis l’interface, les langues
supplémentaires.

L’implémentation précédente est conservée sur la branche `legacy`.

## Licence

[GNU AGPL v3 ou ultérieure](LICENSE). La clause réseau compte ici : toute
personne à qui l’application est servie doit pouvoir en obtenir le code source,
y compris modifié.
