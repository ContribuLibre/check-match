import './styles.css'
import { demarrer } from './app.ts'

const racine = document.querySelector<HTMLElement>('#app')
if (racine) {
  try {
    demarrer(racine)
  } catch (erreur) {
    console.error(erreur)
    racine.innerHTML = `<p class="erreur">Démarrage impossible : ${
      erreur instanceof Error ? erreur.message : String(erreur)}</p>`
  }
}
