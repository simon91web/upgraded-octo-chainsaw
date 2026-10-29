// Einstellungen aus der Umgebung. Geheimnisse gibt es keine: der Dienst prüft jede Anfrage über
// die Yuvomi-Sitzung des Aufrufers und braucht dafür nur die interne Adresse von Yuvomi.

import path from 'node:path';

export function ladeKonfiguration(env = process.env) {
  const yuvomi = (env.YUVOMI_URL || 'http://yuvomi:3000').replace(/\/+$/, '');
  return {
    port: Number(env.PORT || 3100),
    host: env.HOST || '0.0.0.0',
    yuvomiUrl: yuvomi,
    // Öffentliche Adresse, unter der Browser Yuvomi aufrufen (für die Origin-Prüfung).
    // Leer: der Origin muss zum Host-Kopf der Anfrage passen.
    oeffentlich: (env.PUBLIC_ORIGIN || '').replace(/\/+$/, ''),
    datenbank: env.DB_PATH || path.join(env.DATA_DIR || './daten', 'bibellese.db'),
    zeitzone: env.TZ_HAUSHALT || env.TZ || 'Europe/Berlin',
    // Wie lange eine geprüfte Sitzung zwischengespeichert wird (Yuvomi begrenzt /api auf 300/min).
    sitzungCacheMs: Number(env.SESSION_CACHE_MS || 15000),
    praefix: '/api/extensions/bibellese',
  };
}
