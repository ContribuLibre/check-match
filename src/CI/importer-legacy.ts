/**
 * Convertit une liste au format texte historique en grille.
 *
 *   #Rubrique
 *   (Colonne, Autre colonne)
 *   * Élément
 *
 * Les colonnes de l’ancien format ne sont pas reprises : elles disaient déjà,
 * maladroitement et différemment d’une rubrique à l’autre (Giving/Receiving,
 * Self/Partner, Dominant/Submissive…), ce que les polarités disent maintenant
 * partout de la même façon. Ce qui est repris, c’est la hiérarchie et le texte.
 *
 * Usage : bun src/CI/importer-legacy.ts <fichier.txt> <id-grille> > grille.yml
 */

export interface RubriqueImportee {
  id: string
  libelle: string
  elements: { id: string; libelle: string }[]
}

export function identifiant(texte: string): string {
  return texte
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function analyser(texte: string): RubriqueImportee[] {
  const rubriques: RubriqueImportee[] = []
  let courante: RubriqueImportee | undefined
  const vus = new Set<string>()

  texte.split(/\r?\n/).forEach((brute, index) => {
    const ligne = brute.trim()
    if (!ligne) return

    const rubrique = /^#\s*(.+)$/.exec(ligne)
    if (rubrique?.[1]) {
      courante = { id: unique(identifiant(rubrique[1]), vus), libelle: rubrique[1].trim(), elements: [] }
      rubriques.push(courante)
      return
    }
    if (/^\(.*\)$/.test(ligne)) return // colonnes de l’ancien format, remplacées par les polarités

    const element = /^\*\s*(.+)$/.exec(ligne)
    if (element?.[1]) {
      if (!courante) throw new SyntaxError(`Ligne ${index + 1} : « ${ligne} » apparaît avant toute rubrique.`)
      courante.elements.push({ id: unique(identifiant(element[1]), vus), libelle: element[1].trim() })
      return
    }
    throw new SyntaxError(`Ligne ${index + 1} : « ${ligne} » n’est ni #rubrique, ni (colonnes), ni * élément.`)
  })

  return rubriques
}

/** Le même libellé peut revenir dans deux rubriques ; les identifiants, eux, doivent rester uniques. */
function unique(base: string, vus: Set<string>): string {
  let candidat = base || 'element'
  let suffixe = 2
  while (vus.has(candidat)) candidat = `${base}-${suffixe++}`
  vus.add(candidat)
  return candidat
}

if (import.meta.main) {
  const [chemin, id] = process.argv.slice(2)
  if (!chemin || !id) {
    console.error('Usage : bun src/CI/importer-legacy.ts <fichier.txt> <id-grille>')
    process.exit(1)
  }
  const rubriques = analyser(await Bun.file(chemin).text())
  const noeuds = rubriques.map((rubrique) =>
    `  - id: ${rubrique.id}\n    enfants:\n${rubrique.elements.map((element) => `      - id: ${element.id}`).join('\n')}`)
  console.log(noeuds.join('\n'))
  console.error(`${rubriques.length} rubriques, ${rubriques.reduce((total, r) => total + r.elements.length, 0)} éléments.`)
  console.error(JSON.stringify(Object.fromEntries(
    rubriques.flatMap((rubrique) => [[rubrique.id, rubrique.libelle], ...rubrique.elements.map((e) => [e.id, e.libelle] as const)]),
  ), null, 2))
}
