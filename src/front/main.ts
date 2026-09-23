import './styles.css'
import { demarrer } from './app.ts'
import { enregistrerServiceWorker } from './pwa.ts'

function lancer(): void {
  const racine = document.querySelector<HTMLElement>('#app')
  if (!racine) return
  try {
    demarrer(racine)
    void enregistrerServiceWorker()
  } catch (erreur) {
    console.error(erreur)
    racine.innerHTML = `<p class="erreur">Démarrage impossible : ${
      erreur instanceof Error ? erreur.message : String(erreur)}</p>`
  }
}

// Le point de montage n’existe pas forcément encore : selon la façon dont la
// page est construite, le script peut passer avant lui.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer)
else lancer()
