# check-match — consignes de travail

## Bun est le seul moteur d’exécution

Jamais `npm`, `npx`, `yarn`, `pnpm` ni `node` directement. Les dépendances
s’installent avec `bun install`, les scripts se lancent avec `bun run <script>`,
un fichier TypeScript s’exécute avec `bun <fichier>.ts`.

Les binaires de `node_modules/.bin` (`vite`, `tsc`, `vitest`) portent un shebang
node : les scripts de `package.json` les appellent en `bun --bun <binaire>`, qui
force le moteur de bun. Garde cette forme en ajoutant un script.

## Vérifier avant de conclure

`bun run check` est la porte d’entrée unique : validation des grilles, typecheck,
tests, build. Une tâche n’est terminée que lorsqu’elle passe en entier.

## Langue

Le code, les commentaires, les noms de tests et les messages de commit sont en
français. Les identifiants techniques des données (identifiants de nœuds, de
parts, de paliers) restent tels qu’ils sont définis dans les grilles.

## Ce qui ne doit pas se perdre

Trois règles portent le modèle ; les changer demande d’en mesurer l’effet sur
les trois autres.

1. **Le score ne bouge pas en héritant, le poids si.** Une rubrique répondue, ou une polarité générale répondue, vaut
   pour ses sous-nœuds avec la même valeur et un poids atténué par niveau. Le
   poids dit la force de l’engagement, pas son contenu.
2. **Zéro n’est pas « pas renseigné ».** Répondre au plus bas est une réponse, et
   se dessine (triangle tronqué) ; ne pas avoir répondu ne dessine rien.
3. **La remontée ne remonte que des réponses propres.** Sinon une rubrique se
   confirme elle-même à travers ce qu’elle a diffusé vers le bas.

## Les grilles sont des données, pas du code

Structure et textes sont séparés : `grille.yml` porte les identifiants et le
graphe, `<langue>.yml` porte les libellés. Ajouter une langue ne doit jamais
toucher aux identifiants — c’est ce qui garde les réponses valables d’une langue
à l’autre, et comparables entre deux grilles qui partagent des sujets.

4. **L’héritage joue dans trois dimensions.** Sujets, polarités et parts sont
   trois arbres parcourus par la même règle. Un changement sur l’un doit valoir
   pour les autres, sinon l’un devient un cas particulier à part.
6. **Le plus court chemin d’abord.** Descendre dans les sujets ne coûte pas de
   détour ; changer de polarité ou de part en coûte un. Seules les sources du
   plus petit nombre de détours sont retenues — mélanger un héritage direct
   avec un héritage venu d’ailleurs noierait le premier dans le second.
7. **Aucune répartition ne va de soi vers les parts.** Une part de regroupement
   sans `spread` ne descend nulle part, et c’est voulu.
5. **La moyenne n’est pas le résumé par défaut du métier.** Chaque part choisit
   son agrégateur : une limite se résume par son minimum, une envie par son
   maximum. Remettre une moyenne partout effacerait ce qui est saillant.

## Français dans le code, anglais dans les données

Les clés des fichiers YAML sont en **anglais** (`nodes`, `children`, `parts`,
`steps`, `minColor`, `aggregation`, `rollup`…) : une grille est une donnée
destinée à circuler, à être reprise et traduite hors de ce dépôt.

Les interfaces qui mappent ces fichiers (`GrilleDefinition`, `PartDefinition`,
`Traduction`…) portent donc des propriétés anglaises. Tout le reste — noms de
fonctions, variables, structures internes calculées (`Grille`, `Noeud`,
`Polarite`), commentaires, tests — reste en français.

## Traduire ne bloque jamais

Une traduction partielle est la règle, pas l’exception. Ce qui manque retombe
sur la langue par défaut — de la grille pour son contenu, le français pour
l’interface — et jamais sur un identifiant technique.

Seule la langue par défaut d’une grille doit être complète : c’est elle qui sert
de repli. Le validateur l’exige pour elle seule, et se contente d’afficher la
couverture des autres.
