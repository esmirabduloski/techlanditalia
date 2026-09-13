/* Service worker per le notifiche push (Firebase Cloud Messaging).
   La configurazione arriva dalla query string usata in fase di registrazione. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

/* Attiviamo subito le nuove versioni del SW (nessuna cache da gestire) e prendiamo
   il controllo delle schede già aperte: serve per navigare la scheda al click. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });

/* Ricava il percorso da aprire: le edge function lo mettono in `data.path`
   (l'SDK Firebase salva il payload originale in notification.data.FCM_MSG). */
function targetPathFromNotification(notification) {
  var data = (notification && notification.data) || {};
  var fcm = data.FCM_MSG || {};
  var custom = fcm.data || data;
  var raw = custom.path || custom.link || (fcm.fcmOptions && fcm.fcmOptions.link) || null;
  if (!raw) return null;
  try {
    var url = new URL(raw, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    return url.pathname + url.search + url.hash;
  } catch (e) {
    return null;
  }
}

/* Al click sulla notifica apriamo direttamente la pagina indicata (es. la chat
   che ha generato l'avviso). Deve essere registrato PRIMA di firebase.messaging():
   l'handler dell'SDK chiama stopImmediatePropagation() e, se trova già una scheda
   del sito aperta, la mette solo in primo piano senza navigare. */
self.addEventListener('notificationclick', function (event) {
  if (event.action) return; // pulsanti azione: lasciamo fare all'SDK
  var path = targetPathFromNotification(event.notification);
  if (!path) return; // nessuna destinazione: comportamento standard Firebase

  event.stopImmediatePropagation();
  event.notification.close();

  var absolute = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clients) {
        // Riusiamo una scheda solo se è già sulla pagina di destinazione (es. la chat
        // live con un'altra conversazione): navigare una scheda qualsiasi farebbe
        // perdere eventuale lavoro non salvato (editor blog, task, ecc.).
        var targetPathname = new URL(absolute).pathname;
        var client = clients.find(function (c) {
          try {
            var u = new URL(c.url);
            return u.origin === self.location.origin && u.pathname === targetPathname;
          } catch (e) {
            return false;
          }
        });

        if (!client) return self.clients.openWindow(absolute);

        return Promise.resolve(client.focus ? client.focus() : client).then(function (focused) {
          var target = focused || client;
          // Navigazione SPA via messaggio all'app (vedi PushNavigationListener).
          var softNavigate = function () {
            target.postMessage({ type: 'techland:navigate', path: path });
            return target;
          };
          // Se la scheda è controllata da questo SW navighiamo direttamente:
          // funziona anche se la pagina aperta non ha ancora il listener.
          if (typeof target.navigate === 'function') {
            return target.navigate(absolute).catch(softNavigate);
          }
          return softNavigate();
        });
      })
      .catch(function () {
        return self.clients.openWindow(absolute);
      })
  );
});

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();
