/**
 * Service worker et mises à jour.
 *
 * Le principe : une nouvelle version n’écrase jamais celle qui tourne. Elle est
 * téléchargée, attend, et la personne décide quand basculer — sauf si elle
 * recharge elle-même la page, auquel cas c’est qu’elle veut du neuf.
 *
 * Rien n’est enregistré en développement ni en `file://` : un worker qui met en
 * cache pendant qu’on modifie le code fait perdre plus de temps qu’il n’en gagne.
 */

export function versionApplication(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
}

export type EcouteurMiseAJour = (version: string) => void

let inscription: ServiceWorkerRegistration | undefined
let dernierControle = 0
const ecouteurs = new Set<EcouteurMiseAJour>()

const INTERVALLE_CONTROLE_MS = 60 * 60 * 1000

export function surMiseAJourDisponible(ecouteur: EcouteurMiseAJour): () => void {
  ecouteurs.add(ecouteur)
  return () => ecouteurs.delete(ecouteur)
}

function prevenir(version: string): void {
  ecouteurs.forEach((ecouteur) => ecouteur(version))
}

export function traiterMessage(event: MessageEvent): void {
  if ((event.data as { type?: string } | null)?.type === 'updateAvailable') {
    prevenir(String((event.data as { version?: unknown }).version ?? ''))
  }
}

/** Demande sa version au worker, par un canal dédié quand c’est possible. */
function demanderVersion(worker: ServiceWorker | null): void {
  if (!worker || !navigator.serviceWorker.controller) return
  try {
    const canal = new MessageChannel()
    canal.port1.onmessage = traiterMessage
    worker.postMessage('getVersion', [canal.port2])
  } catch {
    worker.postMessage('getVersion')
  }
}

/**
 * Recharger la page est une demande implicite de version fraîche : on bascule
 * sans rien demander. Une première visite, elle, garde ce qui est déjà en place.
 */
export function basculerAuChargement(
  typeNavigation = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type,
): boolean {
  return typeNavigation === 'reload'
}

export async function appliquerMiseAJour(): Promise<void> {
  let recharge = false
  const recharger = (): void => { if (!recharge) { recharge = true; location.reload() } }
  try {
    inscription ??= await navigator.serviceWorker.getRegistration()
    if (!inscription?.waiting) return recharger()
    navigator.serviceWorker.addEventListener('controllerchange', recharger, { once: true })
    inscription.waiting.postMessage('skipWaiting')
    // Filet : si le worker ne prend pas la main, on recharge quand même.
    setTimeout(recharger, 1500)
  } catch {
    recharger()
  }
}

export async function controlerMiseAJour(): Promise<void> {
  if (!inscription || Date.now() - dernierControle < INTERVALLE_CONTROLE_MS) return
  dernierControle = Date.now()
  try {
    await inscription.update()
    demanderVersion(inscription.waiting)
  } catch { /* hors ligne : on réessaiera */ }
}

export async function enregistrerServiceWorker(): Promise<void> {
  if (import.meta.env.DEV || !/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return

  const demanderUneFoisInstalle = (worker: ServiceWorker | null): void => {
    if (!worker) return
    const demander = (): void => { if (worker.state === 'installed') demanderVersion(worker) }
    demander()
    worker.addEventListener('statechange', demander)
  }

  navigator.serviceWorker.addEventListener('message', traiterMessage)
  try {
    inscription = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    dernierControle = Date.now()
    if (inscription.waiting && basculerAuChargement()) {
      await appliquerMiseAJour()
      return
    }
    demanderVersion(inscription.waiting)
    demanderUneFoisInstalle(inscription.installing)
    inscription.addEventListener('updatefound', () => demanderUneFoisInstalle(inscription?.installing ?? null))
    await inscription.update()
    demanderVersion(inscription.waiting)
    demanderUneFoisInstalle(inscription.installing)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void controlerMiseAJour()
    })
    setInterval(() => void controlerMiseAJour(), INTERVALLE_CONTROLE_MS)
  } catch { /* l’application en ligne reste utilisable */ }
}
