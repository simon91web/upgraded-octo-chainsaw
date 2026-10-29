// Der Dienst gegen ein nachgebautes Yuvomi: Anmeldung, Rechte, CSRF und die wichtigsten Abläufe.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { starte } from '../src/server.js';
import { oeffneDatenbank } from '../src/db.js';

const KONTEN = {
  paul: { user: { id: 1, display_name: 'Paul', role: 'admin', family_role: 'dad' }, permissions: { admin: true, modules: {} } },
  maria: { user: { id: 2, display_name: 'Maria', role: 'member', family_role: 'mom' }, permissions: { admin: false, modules: { 'ext:bibellese': 'write' } } },
  lea: { user: { id: 3, display_name: 'Lea', role: 'member', family_role: 'child' }, permissions: { admin: false, modules: { 'ext:bibellese': 'write' } } },
  oma: { user: { id: 4, display_name: 'Oma', role: 'member', family_role: 'grandparent' }, permissions: { admin: false, modules: { 'ext:bibellese': 'read' } } },
  gast: { user: { id: 5, display_name: 'Gast', role: 'member', family_role: 'other' }, permissions: { admin: false, modules: { 'ext:bibellese': 'none' } } },
};

let yuvomi;
let dienst;
let basis;
const tokens = {};

before(async () => {
  yuvomi = http.createServer((req, res) => {
    const sid = /sid=(\w+)/.exec(req.headers.cookie ?? '')?.[1];
    if (req.url === '/api/v1/auth/me' && KONTEN[sid]) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(KONTEN[sid]));
    } else {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end('{"error":"Not authenticated"}');
    }
  });
  await new Promise((r) => yuvomi.listen(0, '127.0.0.1', r));
  const konfig = {
    port: 0, host: '127.0.0.1', yuvomiUrl: `http://127.0.0.1:${yuvomi.address().port}`, oeffentlich: 'http://yuvomi.test',
    datenbank: ':memory:', zeitzone: 'Europe/Berlin', sitzungCacheMs: 0, praefix: '/api/extensions/bibellese',
  };
  ({ server: dienst } = starte(konfig, { db: oeffneDatenbank(':memory:'), heute: () => '2026-10-29', uhrzeit: () => '19:42' }));
  await new Promise((r) => dienst.listen(0, '127.0.0.1', r));
  basis = `http://127.0.0.1:${dienst.address().port}/api/extensions/bibellese`;
});

after(() => { dienst.close(); yuvomi.close(); });

async function rufe(wer, methode, pfad, koerper, { csrf = true, origin = 'http://yuvomi.test' } = {}) {
  const kopf = { 'content-type': 'application/json' };
  if (wer) {
    if (!tokens[wer] && methode !== 'GET') {
      const s = await rufe(wer, 'GET', '/status');
      tokens[wer] = { token: s.daten.csrf, cookie: s.cookie };
    }
    kopf.cookie = `sid=${wer}${tokens[wer]?.cookie ? `; ${tokens[wer].cookie}` : ''}`;
    if (methode !== 'GET' && csrf) kopf['x-bibellese-csrf'] = tokens[wer].token;
  }
  if (origin) kopf.origin = origin;
  const antwort = await fetch(`${basis}${pfad}`, { method: methode, headers: kopf, body: koerper ? JSON.stringify(koerper) : undefined });
  const cookie = antwort.headers.get('set-cookie')?.split(';')[0];
  return { status: antwort.status, daten: await antwort.json(), cookie };
}

const familienRezept = {
  straenge: [{ buecher: 'bibel' }], einteilung: 'kapitel-sinn', parallelen: ['geschichte'],
  lesetage: [0, 1, 2, 3, 4, 5, 6], ziel: { datum: '2028-10-28' }, woerter_je_minute: 130, begonnen_am: '2026-10-29',
};

let familie;

test('ohne Sitzung 401, ohne Freigabe 403', async () => {
  assert.equal((await rufe(null, 'GET', '/status')).status, 401);
  assert.equal((await rufe('gast', 'GET', '/status')).status, 403);
});

test('Status liefert CSRF-Token und setzt das Cookie', async () => {
  const s = await rufe('paul', 'GET', '/status');
  assert.equal(s.status, 200);
  assert.equal(s.daten.ich.id, 1);
  assert.ok(s.daten.csrf.length > 20);
  assert.ok(s.cookie.startsWith('bibellese-csrf='));
});

test('Schreiben ohne CSRF oder von fremder Seite wird abgelehnt', async () => {
  await rufe('paul', 'GET', '/status');
  assert.equal((await rufe('paul', 'POST', '/plaene', { name: 'x', rezept: familienRezept }, { csrf: false })).status, 403);
  assert.equal((await rufe('paul', 'POST', '/plaene', { name: 'x', rezept: familienRezept }, { origin: 'http://boese.test' })).status, 403);
});

test('Gemeinsamen Plan anlegen; alle sehen ihn, Ziel aus dem Rezept', async () => {
  const r = await rufe('paul', 'POST', '/plaene', { name: 'Familienandacht', art: 'gemeinsam', rezept: familienRezept });
  assert.equal(r.status, 201);
  familie = r.daten;
  assert.equal(familie.ziel, '2028-10-28');
  assert.equal(familie.naechste.nr, 1);
  assert.equal(familie.stand.verzug, 0);
  const beiLea = await rufe('lea', 'GET', '/plaene');
  assert.ok(beiLea.daten.plaene.some((p) => p.id === familie.id && p.darfAbhaken && !p.darfAendern));
});

test('Abhaken: Lea hakt die gemeinsame Einheit ab, mit „Dabei“; das Lesezeichen rückt weiter', async () => {
  const r = await rufe('lea', 'POST', '/lesungen', { planId: familie.id, dabei: [1, 2, 3] });
  assert.equal(r.status, 201);
  assert.equal(r.daten.plan.stand.gelesen, 1);
  assert.equal(r.daten.plan.naechste.nr, 2);
  assert.equal(r.daten.plan.stand.heuteGelesen, true);
});

test('Nur wer angelegt hat oder Admin: Lea darf das Ziel nicht verschieben, Paul schon, mit Rückgängig', async () => {
  assert.equal((await rufe('lea', 'PUT', `/plaene/${familie.id}/ziel`, { ziel: '2029-01-01' })).status, 403);
  const r = await rufe('paul', 'PUT', `/plaene/${familie.id}/ziel`, { ziel: '2029-01-01' });
  assert.equal(r.status, 200);
  assert.equal(r.daten.plan.ziel, '2029-01-01');
  assert.equal(r.daten.plan.stand.zielUrspruenglich, '2028-10-28');
  assert.ok(r.daten.plan.stand.vorsprung > 0);
  const zurueck = await rufe('paul', 'DELETE', `/plaene/${familie.id}/ziel/${r.daten.aenderung}`);
  assert.equal(zurueck.daten.ziel, '2028-10-28');
});

test('Private Pläne sieht niemand sonst; sichtbare lassen sich übernehmen', async () => {
  const privat = await rufe('paul', 'POST', '/plaene', { name: 'Mein Plan', art: 'privat', rezept: { ...familienRezept, straenge: [{ buecher: 'nt' }], ziel: { minuten: 10 } } });
  assert.equal((await rufe('maria', 'GET', `/plaene/${privat.daten.id}`)).status, 404);
  const psalmen = await rufe('lea', 'POST', '/plaene', { name: 'Psalmen', art: 'sichtbar', rezept: { ...familienRezept, straenge: [{ buecher: ['Ps'] }], ziel: { minuten: 5 } } });
  const kopie = await rufe('paul', 'POST', `/plaene/${psalmen.daten.id}/kopie`);
  assert.equal(kopie.status, 201);
  assert.equal(kopie.daten.kopieVon, psalmen.daten.id);
  assert.equal(kopie.daten.art, 'privat');
  const liste = await rufe('paul', 'GET', '/plaene');
  assert.equal(liste.daten.plaene.find((p) => p.id === psalmen.daten.id).uebernommen, true);
});

test('Nur lesen: Oma sieht, darf aber nicht abhaken', async () => {
  assert.equal((await rufe('oma', 'GET', '/plaene')).status, 200);
  assert.equal((await rufe('oma', 'POST', '/lesungen', { planId: familie.id })).status, 403);
});

test('Frei eintragen zählt im Fortschritt „Alles von mir“; ungültige Stellen werden abgelehnt', async () => {
  assert.equal((await rufe('paul', 'POST', '/lesungen', { stuecke: [{ b: 'Rom', von: [17, 1], bis: [17, 2] }] })).status, 400);
  const r = await rufe('paul', 'POST', '/lesungen', { stuecke: [{ b: 'Rom', von: [8, 1], bis: [8, 39] }], notiz: 'V. 28' });
  assert.equal(r.status, 201);
  assert.equal(r.daten.text, 'Römer 8');
  const f = await rufe('paul', 'GET', '/fortschritt?plan=alle');
  assert.equal(f.daten.jeBuch.Rom.kapitel['8'], 'frei');
  // Paul war bei der Familienandacht dabei: deren erste Einheit zählt für ihn mit.
  assert.ok(f.daten.gesamt >= 2);
});

test('Logbuch: Einträge mit Plannamen; nur die letzte Plan-Lesung lässt sich zurücknehmen', async () => {
  const zweite = await rufe('paul', 'POST', '/lesungen', { planId: familie.id, dabei: [1] });
  const log = await rufe('paul', 'GET', `/lesungen?plan=${familie.id}`);
  assert.equal(log.daten.lesungen.length, 2);
  const erste = log.daten.lesungen.find((l) => l.einheitNr === 1);
  assert.equal((await rufe('lea', 'DELETE', `/lesungen/${erste.id}`)).status, 400);
  assert.equal((await rufe('paul', 'DELETE', `/lesungen/${zweite.daten.lesung}`)).status, 200);
  assert.equal((await rufe('paul', 'POST', `/lesungen/${zweite.daten.lesung}/wiederherstellen`)).status, 200);
});

test('Neu einteilen bei Verzug und zurück', async () => {
  const alt = await rufe('maria', 'POST', '/plaene', {
    name: 'NT seit Oktober', art: 'privat',
    rezept: { ...familienRezept, straenge: [{ buecher: 'nt' }], begonnen_am: '2026-10-01', ziel: { datum: '2027-03-31' } },
  });
  assert.ok(alt.daten.stand.verzug > 20);
  const neu = await rufe('maria', 'POST', `/plaene/${alt.daten.id}/einteilen`);
  assert.equal(neu.status, 200);
  assert.equal(neu.daten.stand.verzug, 0);
  assert.equal(neu.daten.version, 2);
  const zurueck = await rufe('maria', 'POST', `/plaene/${alt.daten.id}/einteilen/rueckgaengig`);
  assert.equal(zurueck.daten.version, 1);
  assert.ok(zurueck.daten.stand.verzug > 20);
});

test('Einstellungen: jede Person für sich, der Haushalt nur durch Admins', async () => {
  assert.equal((await rufe('lea', 'PUT', '/einstellungen', { person: { gemeinsamZaehlt: false } })).status, 200);
  assert.equal((await rufe('lea', 'GET', '/einstellungen')).daten.person.gemeinsamZaehlt, false);
  assert.equal((await rufe('maria', 'PUT', '/einstellungen', { haushalt: { gemeinsameAnlegen: 'admins' } })).status, 403);
  assert.equal((await rufe('paul', 'PUT', '/einstellungen', { haushalt: { gemeinsameAnlegen: 'admins' } })).status, 200);
  assert.equal((await rufe('maria', 'POST', '/plaene', { name: 'X', art: 'gemeinsam', rezept: familienRezept })).status, 403);
});
