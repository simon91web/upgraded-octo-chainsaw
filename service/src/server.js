// Bibellese-Dienst: läuft als eigener Container neben Yuvomi und antwortet unter
// /api/extensions/bibellese/ (der Reverse Proxy leitet diesen Pfad hierher).

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { ladeKonfiguration } from './config.js';
import { oeffneDatenbank } from './db.js';
import { erzeugeAnmeldung } from './auth.js';
import { erzeugeApi } from './api.js';

export function starte(konfig = ladeKonfiguration(), optionen = {}) {
  const db = optionen.db ?? oeffneDatenbank(konfig.datenbank);
  const anmeldung = optionen.anmeldung ?? erzeugeAnmeldung(konfig, optionen);
  const api = erzeugeApi({ db, konfig, anmeldung, ...optionen });
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith(konfig.praefix)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{"error":"Unbekannte Adresse.","code":"nicht_gefunden"}');
      return;
    }
    api(req, res);
  });
  return { server, db };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const konfig = ladeKonfiguration();
  const { server, db } = starte(konfig);
  server.listen(konfig.port, konfig.host, () => {
    console.log(`[bibellese] Dienst auf ${konfig.host}:${konfig.port}, Yuvomi unter ${konfig.yuvomiUrl}, Daten in ${konfig.datenbank}`);
  });
  const ende = () => server.close(() => { db.close(); process.exit(0); });
  process.on('SIGTERM', ende);
  process.on('SIGINT', ende);
}
