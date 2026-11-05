// Révisions — service worker
//
// Stratégie « réseau d'abord » : en ligne, l'appli récupère toujours la dernière
// version ; le cache ne sert que de repli hors ligne. Les appels à l'IA ne sont jamais mis en cache.
// Incrémente VERSION à chaque mise en ligne.
const VERSION = "v0.1.0";
const CACHE = `revisions-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/app.js",
  "./js/seance.js",
  "./js/api.js",
  "./js/correction.js",
  "./js/parole.js",
  "./js/util.js",
  "./referentiel/index.json",
  "./referentiel/ce1-francais.json",
  "./referentiel/ce1-maths.json",
  "./referentiel/tle-philosophie.json",
  "./referentiel/tle-hlp.json",
  "./referentiel/tle-svt.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request))
  );
});
