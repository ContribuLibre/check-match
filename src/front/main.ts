import './styles.css'
import { demarrer } from './app.ts'
import { enregistrerServiceWorker } from './pwa.ts'

const racine = document.querySelector<HTMLElement>('#app')
if (racine) {
  try {
    demarrer(racine)
    void enregistrerServiceWorker()
  } catch (erreur) {
    console.error(erreur)
    racine.innerHTML = `<p class="erreur">Démarrage impossible : ${
      erreur instanceof Error ? erreur.message : String(erreur)}</p>`
  }
}
