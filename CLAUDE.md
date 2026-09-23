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
critères, de paliers) restent tels qu’ils sont définis dans les grilles.

## Ce qui ne doit pas se perdre

Trois règles portent le modèle ; les changer demande d’en mesurer l’effet sur
les trois autres.

1. **Le score ne bouge pas en héritant, le poids si.** Une rubrique répondue vaut
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
