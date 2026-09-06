/* Service worker per le notifiche push (Firebase Cloud Messaging).
   La configurazione arriva dalla query string usata in fase di registrazione. */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();
