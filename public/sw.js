const SW_VERSION = '__SW_VERSION__'
const PRECACHE = __PRECACHE_MANIFEST__
const CACHE_NAME = `check-match-${SW_VERSION}`

self.addEventListener('install', (event) => {
  // Le worker ne passe en « waiting » qu’une fois la nouvelle version
  // entièrement téléchargée. Si ça échoue, l’ancienne reste active.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(PRECACHE.map((asset) => new Request(asset, { cache: 'reload' }))),
  ))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('check-match-') && key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Une image ouverte dans un onglet est aussi une navigation : on cherche
  // l’URL exacte avant tout repli vers la coquille de l’application.
  const dernierSegment = url.pathname.split('/').pop() || ''
  const navigation = request.mode === 'navigate' && !/\.[a-z0-9]+$/i.test(dernierSegment)

  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request)
    if (cached) return cached
    if (navigation && url.pathname.endsWith('/')) {
      const index = await cache.match(new URL('index.html', url).href)
      if (index) return index
    }

    try {
      const response = await fetch(request)
      if (response?.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {})
      return response
    } catch (erreur) {
      if (navigation) {
        const coquille = await cache.match('./index.html') || await cache.match('./')
        if (coquille) return coquille
      }
      throw erreur
    }
  }))
})

self.addEventListener('message', (event) => {
  if (event.data === 'getVersion') {
    // Un worker en attente ne contrôle encore aucun client : il répond
    // directement à celui qui demande.
    const message = { type: 'updateAvailable', version: SW_VERSION }
    if (event.ports?.[0]) event.ports[0].postMessage(message)
    else event.source?.postMessage(message)
  } else if (event.data === 'skipWaiting') self.skipWaiting()
})
