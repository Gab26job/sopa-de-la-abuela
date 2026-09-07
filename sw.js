// Service worker de la sopa. Tiene un solo objetivo: que el juego abra al
// instante y sin conexión, porque el público está en Android de gama baja con
// datos caros. No hay notificaciones ni sincronización: eso es de la app nativa.
//
// Al cambiar el juego hay que subir VERSION, o los teléfonos que ya lo tienen
// guardado siguen jugando el build viejo.
const VERSION = "sopa-fase1-v2";

const BASICOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icono-192.png",
  "./icono-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(BASICOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // El juego en sí: red primero, para que nadie se quede jugando una versión
  // vieja sin enterarse. El cache es la red de contención cuando no hay señal.
  if (url.origin === location.origin && (req.mode === "navigate" || url.pathname.endsWith("/index.html"))) {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(VERSION).then(c => c.put("./index.html", copia));
          return r;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Todo lo demás —íconos, manifiesto, las fuentes de Google—: del cache si ya
  // está, y si no de la red guardando una copia para la próxima.
  e.respondWith(
    caches.match(req).then(guardado => {
      if (guardado) return guardado;
      return fetch(req).then(r => {
        if (r && (r.ok || r.type === "opaque")) {
          const copia = r.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return r;
      });
    })
  );
});
