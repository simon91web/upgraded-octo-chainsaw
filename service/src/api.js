// Die Schnittstelle unter /api/extensions/bibellese/ (KONZEPT.md §6).
// Jede Anfrage: Sitzung bei Yuvomi prüfen; schreibende zusätzlich Origin und CSRF.

import { readFileSync } from 'node:fs';
import { Fehler, CSRF_COOKIE, leseCookies, neuesCsrfToken, pruefeCsrf, pruefeOrigin } from './auth.js';
import { transaktion } from './db.js';
import { bibel } from './kern.js';
import {
  erzeugePlan, neuEinteilen, stand as berechneStand, fortschritt as berechneFortschritt,
  einheitText, einheitTeile, nebenBuecher, minutenDerEinheit, EINTEILUNGEN, WEISHEIT, kalender,
} from '../../modules/bibellese/kern/index.js';

// Version aus package.json: /status und /gesund zeigen, welcher Dienst tatsächlich läuft.
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const UHR = /^([01]\d|2[0-3]):[0-5]\d$/;
const ARTEN = ['privat', 'sichtbar', 'gemeinsam'];
const PARALLELEN = ['geschichte', 'lieder', 'gesetz'];
const MAX_PLAENE = 50;

const istTag = (t) => typeof t === 'string' && TAG.test(t) && kalender.zuTag(kalender.zuZahl(t)) === t;

export function heuteIn(zeitzone, jetzt = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zeitzone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(jetzt);
}
export function uhrzeitIn(zeitzone, jetzt = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zeitzone, hour: '2-digit', minute: '2-digit', hour12: false }).format(jetzt);
}

// ------------------------------------------------------------------ Prüfen

function pruefeStuecke(stuecke) {
  if (!Array.isArray(stuecke) || stuecke.length === 0 || stuecke.length > 50) throw new Fehler(400, 'stuecke', 'Stellen fehlen.');
  return stuecke.map((s) => {
    if (!s || !bibel.hat(s.b)) throw new Fehler(400, 'stuecke', 'Unbekanntes Buch.');
    const buch = bibel.buch(s.b);
    const ok = (x) => Array.isArray(x) && x.length === 2 && Number.isInteger(x[0]) && Number.isInteger(x[1])
      && x[0] >= 1 && x[0] <= buch.kapitel && x[1] >= 1 && x[1] <= buch.verse[x[0] - 1];
    if (!ok(s.von) || !ok(s.bis) || buch.pos(s.von) > buch.pos(s.bis)) {
      throw new Fehler(400, 'stuecke', `${buch.name} hat ${buch.kapitel} Kapitel; bitte Kapitel und Verse prüfen.`);
    }
    return { b: s.b, von: s.von, bis: s.bis };
  });
}

function pruefeRezept(r, heute) {
  if (!r || typeof r !== 'object') throw new Fehler(400, 'rezept', 'Rezept fehlt.');
  if (!Array.isArray(r.straenge) || r.straenge.length < 1 || r.straenge.length > 3) throw new Fehler(400, 'rezept', 'Ein bis drei Stränge.');
  const auswahlOk = (a) => (Array.isArray(a) ? a.length > 0 && a.length <= 66 && a.every((id) => bibel.hat(id))
    : ['bibel', 'at', 'nt'].includes(a) || (typeof a === 'string' && a.startsWith('gruppe:') && bibel.gruppen.some((g) => `gruppe:${g.id}` === a)));
  const straenge = r.straenge.map((s) => {
    if (!s || !auswahlOk(s.buecher)) throw new Fehler(400, 'rezept', 'Unbekannte Buchauswahl.');
    if (s.ohne && !(Array.isArray(s.ohne) && s.ohne.every((id) => bibel.hat(id)))) throw new Fehler(400, 'rezept', 'Unbekanntes Buch bei „ohne“.');
    if (s.reihenfolge && s.reihenfolge !== 'kanonisch') throw new Fehler(400, 'reihenfolge', 'Chronologisch gibt es noch nicht.');
    if (s.start && !(typeof s.start === 'string' && /^[1-3]?[A-Za-z]+(\.\d{1,3}){0,2}$/.test(s.start) && bibel.hat(s.start.split('.')[0]))) {
      throw new Fehler(400, 'rezept', 'Unbekannter Startpunkt.');
    }
    return { buecher: s.buecher, ...(s.ohne ? { ohne: s.ohne } : {}), reihenfolge: 'kanonisch', ...(s.start ? { start: s.start } : {}) };
  });
  const einteilung = r.einteilung ?? 'kapitel-sinn';
  if (!EINTEILUNGEN[einteilung]) throw new Fehler(400, 'rezept', 'Unbekannte Einteilung.');
  const parallelen = r.parallelen ?? [];
  if (!Array.isArray(parallelen) || !parallelen.every((p) => PARALLELEN.includes(p))) throw new Fehler(400, 'rezept', 'Unbekannte Parallelen.');
  const lesetage = r.lesetage ?? null;
  if (lesetage !== null && !(Array.isArray(lesetage) && lesetage.length >= 1 && lesetage.length <= 7
    && new Set(lesetage).size === lesetage.length && lesetage.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))) {
    throw new Fehler(400, 'rezept', 'Lesetage sind Wochentage 0 bis 6.');
  }
  const begonnen = r.begonnen_am ?? heute;
  if (!istTag(begonnen)) throw new Fehler(400, 'rezept', 'Beginn ist kein Datum.');
  const wpm = Number(r.woerter_je_minute ?? 200);
  if (!(wpm >= 60 && wpm <= 400)) throw new Fehler(400, 'rezept', 'Lesegeschwindigkeit zwischen 60 und 400 Wörtern je Minute.');
  let ziel;
  if (r.ziel?.datum !== undefined) {
    if (!lesetage) throw new Fehler(400, 'ziel', 'Ohne festen Rhythmus gibt es kein Zieldatum.');
    if (!istTag(r.ziel.datum) || r.ziel.datum <= begonnen) throw new Fehler(400, 'ziel', 'Das Ziel muss nach dem Beginn liegen.');
    ziel = { datum: r.ziel.datum };
  } else {
    const m = Number(r.ziel?.minuten);
    if (!(m >= 1 && m <= 180)) throw new Fehler(400, 'ziel', 'Minuten je Lesung zwischen 1 und 180.');
    ziel = { minuten: m };
  }
  return { straenge, einteilung, parallelen, lesetage, ziel, woerter_je_minute: Math.round(wpm), begonnen_am: begonnen };
}

function pruefeName(name) {
  const n = String(name ?? '').trim();
  if (!n || n.length > 80) throw new Fehler(400, 'name', 'Name mit 1 bis 80 Zeichen.');
  return n;
}

/** Welche Teile beim Abhaken herausgenommen sind: höchstens „zweit“ und „dazu“, die Hauptstelle nie. */
function pruefeOhne(ohne) {
  if (ohne === undefined || ohne === null) return [];
  if (!Array.isArray(ohne) || !ohne.every((t) => t === 'zweit' || t === 'dazu')) {
    throw new Fehler(400, 'ohne', 'Herausnehmen lassen sich nur zweiter Strang und Parallelstellen.');
  }
  return [...new Set(ohne)];
}

const pruefeDabei = (dabei) => (Array.isArray(dabei)
  ? [...new Set(dabei.filter((x) => Number.isInteger(x) && x > 0))].slice(0, 30) : null);

// ------------------------------------------------------------------ Antworten

function json(res, status, daten, kopf = {}) {
  const text = JSON.stringify(daten);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...kopf });
  res.end(text);
}

async function leseKoerper(req) {
  let laenge = 0;
  const teile = [];
  for await (const teil of req) {
    laenge += teil.length;
    if (laenge > 256 * 1024) throw new Fehler(413, 'zu_gross', 'Anfrage zu groß.');
    teile.push(teil);
  }
  if (!teile.length) return {};
  try {
    return JSON.parse(Buffer.concat(teile).toString('utf8'));
  } catch {
    throw new Fehler(400, 'json', 'Anfrage ist kein gültiges JSON.');
  }
}

// ------------------------------------------------------------------ API

export function erzeugeApi({ db, konfig, anmeldung, heute = () => heuteIn(konfig.zeitzone), uhrzeit = () => uhrzeitIn(konfig.zeitzone) }) {
  const q = {
    plan: db.prepare('SELECT * FROM plan WHERE id = ? AND geloescht_am IS NULL'),
    planAuchGeloescht: db.prepare('SELECT * FROM plan WHERE id = ?'),
    plaene: db.prepare('SELECT * FROM plan WHERE geloescht_am IS NULL ORDER BY erstellt_am'),
    zaehleEigene: db.prepare('SELECT COUNT(*) AS n FROM plan WHERE besitzer = ? AND geloescht_am IS NULL'),
    gelesen: db.prepare(`SELECT COUNT(*) AS n, SUM(gelesen_am = ?) AS heute FROM lesung
                         WHERE plan_id = ? AND quelle = 'plan' AND durchgang = ? AND geloescht_am IS NULL`),
    kopieVon: db.prepare('SELECT id FROM plan WHERE kopie_von = ? AND besitzer = ? AND geloescht_am IS NULL'),
    ersteAenderung: db.prepare('SELECT von FROM ziel_aenderung WHERE plan_id = ? AND zurueckgenommen_am IS NULL ORDER BY id LIMIT 1'),
    aenderungen: db.prepare('SELECT id, am, von, nach FROM ziel_aenderung WHERE plan_id = ? AND zurueckgenommen_am IS NULL ORDER BY id'),
    lesung: db.prepare('SELECT * FROM lesung WHERE id = ?'),
    einstellung: db.prepare('SELECT wert FROM einstellung WHERE bereich = ? AND person_id = ? AND schluessel = ?'),
    setzeEinstellung: db.prepare(`INSERT INTO einstellung (bereich, person_id, schluessel, wert) VALUES (?, ?, ?, ?)
                                  ON CONFLICT (bereich, person_id, schluessel) DO UPDATE SET wert = excluded.wert`),
  };

  const einstellung = (bereich, person, schluessel, standard) => {
    const z = q.einstellung.get(bereich, person, schluessel);
    return z ? JSON.parse(z.wert) : standard;
  };
  const gemeinsamZaehlt = (wer) => einstellung('person', wer.id, 'gemeinsam_zaehlt', true);

  const zeile = (z) => z && {
    ...z,
    rezept: JSON.parse(z.rezept),
    einheiten: JSON.parse(z.einheiten),
    lesetage: z.lesetage ? JSON.parse(z.lesetage) : null,
  };
  const sichtbar = (p, wer) => p.art !== 'privat' || p.besitzer === wer.id;
  const darfAendern = (p, wer) => wer.darfSchreiben && (wer.admin || p.besitzer === wer.id);
  const darfAbhaken = (p, wer) => wer.darfSchreiben && (p.art === 'gemeinsam' || p.besitzer === wer.id);

  function holePlan(id, wer) {
    const p = zeile(q.plan.get(Number(id)));
    if (!p || !sichtbar(p, wer)) throw new Fehler(404, 'plan', 'Plan nicht gefunden.');
    return p;
  }

  function standDes(p) {
    const t = heute();
    const g = q.gelesen.get(t, p.id, p.durchgang);
    const st = berechneStand(p, { gelesen: g.n, heuteGelesen: Boolean(g.heute), heute: t });
    const ersteAenderung = q.ersteAenderung.get(p.id);
    return { ...st, zielUrspruenglich: ersteAenderung ? ersteAenderung.von : p.ziel };
  }

  // Bücher der Nebenstränge je Rezept; für viele Lesungen desselben Plans nur einmal gerechnet.
  const nebenCache = new Map();
  const neben = (rezept) => {
    const k = JSON.stringify(rezept.straenge);
    if (!nebenCache.has(k)) nebenCache.set(k, nebenBuecher(bibel, rezept));
    return nebenCache.get(k);
  };
  const teileText = (t) => ({ haupt: t.haupt?.text ?? '', zweit: t.zweit?.text ?? null, dazu: t.dazu?.text ?? null });
  // „Ausgelassen: Psalm 30 · 2. Chronik 5,2–7,10“ – ohne „dazu“, es ist eine Liste.
  const ausgelassenText = (stuecke) => einheitText(bibel, stuecke.map(({ parallel, ...s }) => s));

  /** Gelesenes und Herausgenommenes einer Einheit, wenn `ohne` Teile herausnimmt. */
  function teileTrennen(stuecke, zweit, ohne) {
    const t = einheitTeile(bibel, stuecke, { zweit });
    const weg = new Set(ohne.flatMap((teil) => t[teil]?.stuecke ?? []));
    return { gelesen: stuecke.filter((s) => !weg.has(s)), ausgelassen: stuecke.filter((s) => weg.has(s)) };
  }

  const einheitAus = (p, nr) => {
    const e = p.einheiten[nr - 1];
    if (!e) return null;
    const zweit = neben(p.rezept);
    return {
      nr, stuecke: e.stuecke, text: einheitText(bibel, e.stuecke, { zweit }),
      teile: teileText(einheitTeile(bibel, e.stuecke, { zweit })), minuten: minutenDerEinheit(e, p.woerter_je_minute),
    };
  };

  function ausgabe(p, wer, { mitEinheiten = false } = {}) {
    const st = standDes(p);
    const naechste = st.naechsteNr ? einheitAus(p, st.naechsteNr) : null;
    const aktuell = naechste?.stuecke[0]?.b ?? null;
    // Wann das Neue Testament beginnt, für „Beginnt mit Einheit 571 · voraussichtlich …“.
    const ntAb = p.einheiten.findIndex((e) => e.stuecke.some((s) => bibel.buch(s.b).testament === 'NT')) + 1;
    const ntAbDatum = ntAb && st.naechsteNr && ntAb >= st.naechsteNr && p.lesetage
      ? kalender.nterLesetag(p.lesetage, st.heuteGelesen ? kalender.plusTage(heute(), 1) : heute(), ntAb - st.naechsteNr + 1) : null;
    return {
      id: p.id, name: p.name, art: p.art, besitzer: p.besitzer, eigen: p.besitzer === wer.id, kopieVon: p.kopie_von,
      rezept: p.rezept, version: p.version, begonnenAm: p.begonnen_am, lesetage: p.lesetage,
      woerterJeMinute: p.woerter_je_minute, durchgang: p.durchgang, ziel: p.ziel,
      stand: st, naechste,
      danach: st.naechsteNr ? [1, 2, 3, 4].map((i) => einheitAus(p, st.naechsteNr + i)).filter(Boolean) : [],
      aktuellesBuch: aktuell, ntAb: ntAb || null, ntAbDatum,
      darfAendern: darfAendern(p, wer), darfAbhaken: darfAbhaken(p, wer),
      kannNeuEinteilen: Boolean(p.einheiten_vorher) || undefined,
      uebernommen: p.besitzer !== wer.id && p.art === 'sichtbar' ? Boolean(q.kopieVon.get(p.id, wer.id)) : undefined,
      zielVerlauf: q.aenderungen.all(p.id),
      ...(mitEinheiten ? { einheiten: p.einheiten.map((e, i) => ({ nr: i + 1, text: einheitText(bibel, e.stuecke, { zweit: neben(p.rezept) }), minuten: minutenDerEinheit(e, p.woerter_je_minute) })) } : {}),
    };
  }

  function speicherePlan({ besitzer, name, art, rezept, einheiten, ziel, kopieVon = null }) {
    const r = db.prepare(`INSERT INTO plan (besitzer, name, art, kopie_von, rezept, einheiten, begonnen_am, lesetage,
                           woerter_je_minute, ziel, erstellt_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(besitzer, name, art, kopieVon, JSON.stringify(rezept), JSON.stringify(einheiten), rezept.begonnen_am,
        rezept.lesetage ? JSON.stringify(rezept.lesetage) : null, rezept.woerter_je_minute, ziel, new Date().toISOString());
    return Number(r.lastInsertRowid);
  }

  /** Lesungen, die zu „Alles von mir“ zählen, oder die eines Plans (laufender Durchgang). */
  function lesungenFuer(wer, plan, { von = '0000-00-00', bis = '9999-99-99' } = {}) {
    const zeilen = plan === 'alle'
      ? db.prepare(`SELECT l.*, p.name AS plan_name, p.art AS plan_art, p.rezept AS plan_rezept FROM lesung l LEFT JOIN plan p ON p.id = l.plan_id
                    WHERE l.geloescht_am IS NULL AND l.gelesen_am BETWEEN ? AND ?
                      AND (p.id IS NULL OR p.geloescht_am IS NULL)
                      AND (l.person_id = ? OR (p.art = 'gemeinsam' AND l.dabei IS NOT NULL))
                    ORDER BY l.gelesen_am DESC, l.uhrzeit DESC, l.id DESC`).all(von, bis, wer.id)
      : db.prepare(`SELECT l.*, p.name AS plan_name, p.art AS plan_art, p.rezept AS plan_rezept FROM lesung l JOIN plan p ON p.id = l.plan_id
                    WHERE l.geloescht_am IS NULL AND l.plan_id = ? AND l.gelesen_am BETWEEN ? AND ?
                    ORDER BY l.gelesen_am DESC, l.uhrzeit DESC, l.id DESC`).all(plan.id, von, bis);
    const zaehlt = gemeinsamZaehlt(wer);
    return zeilen
      .map((l) => ({
        ...l, stuecke: JSON.parse(l.stuecke), dabei: l.dabei ? JSON.parse(l.dabei) : null,
        ausgelassen: l.ausgelassen ? JSON.parse(l.ausgelassen) : [],
        zweit: l.quelle === 'plan' && l.plan_rezept ? neben(JSON.parse(l.plan_rezept)) : null,
      }))
      .filter((l) => {
        if (plan !== 'alle') return true;
        if (l.plan_art !== 'gemeinsam') return l.person_id === wer.id;
        // Gemeinsame Pläne zählen für mich, wenn ich dabei war (abschaltbar).
        if (l.quelle === 'plan' && l.dabei) return zaehlt && l.dabei.includes(wer.id);
        return l.person_id === wer.id || (zaehlt && l.dabei?.includes(wer.id));
      })
      .map((l) => {
        // Welche Teile die Einheit hatte und welche davon herausgenommen sind (für das Logbuch-Blatt).
        const ganz = einheitTeile(bibel, [...l.stuecke, ...l.ausgelassen], { zweit: l.zweit });
        const gelesen = einheitTeile(bibel, l.stuecke, { zweit: l.zweit });
        const hat = ['zweit', 'dazu'].filter((t) => ganz[t]);
        return {
          id: l.id, planId: l.plan_id, planName: l.plan_name ?? null, personId: l.person_id, quelle: l.quelle,
          datum: l.gelesen_am, uhrzeit: l.uhrzeit, einheitNr: l.einheit_nr, durchgang: l.durchgang,
          stuecke: l.stuecke, text: einheitText(bibel, l.stuecke, { zweit: l.zweit }), teile: teileText(gelesen),
          ausgelassen: l.ausgelassen.length ? ausgelassenText(l.ausgelassen) : null,
          einheit: teileText(ganz), hat, ohne: hat.filter((t) => !gelesen[t]),
          notiz: l.notiz, dabei: l.dabei, eigen: l.person_id === wer.id,
        };
      });
  }

  // ---------------------------------------------------------------- Handler

  const routen = [];
  const route = (methode, muster, fn, { schreibt = methode !== 'GET' } = {}) => {
    const namen = [];
    const re = new RegExp(`^${muster.replace(/:(\w+)/g, (_, n) => { namen.push(n); return '([^/]+)'; })}$`);
    routen.push({ methode, re, namen, fn, schreibt });
  };

  route('GET', '/status', async ({ wer, req }) => {
    const cookies = leseCookies(req.headers.cookie);
    const token = cookies[CSRF_COOKIE] || neuesCsrfToken();
    const sicher = req.headers['x-forwarded-proto'] === 'https';
    return {
      kopf: cookies[CSRF_COOKIE] ? {} : {
        'set-cookie': `${CSRF_COOKIE}=${token}; Path=${konfig.praefix}; SameSite=Strict; HttpOnly${sicher ? '; Secure' : ''}`,
      },
      daten: { heute: heute(), ich: wer, csrf: token, version: VERSION, weisheit: WEISHEIT },
    };
  });

  route('GET', '/plaene', ({ wer }) => ({
    daten: { plaene: q.plaene.all().map(zeile).filter((p) => sichtbar(p, wer)).map((p) => ausgabe(p, wer)) },
  }));

  route('GET', '/plaene/:id', ({ wer, p }) => ({ daten: ausgabe(holePlan(p.id, wer), wer, { mitEinheiten: true }) }));

  route('POST', '/plaene', async ({ wer, koerper }) => {
    if (!wer.darfSchreiben) throw new Fehler(403, 'nur_lesen', 'Nur lesen: Pläne anlegen ist nicht freigegeben.');
    const name = pruefeName(koerper.name);
    const art = ARTEN.includes(koerper.art) ? koerper.art : 'privat';
    if (art === 'gemeinsam' && einstellung('haushalt', 0, 'gemeinsame_anlegen', 'alle') === 'admins' && !wer.admin) {
      throw new Fehler(403, 'nur_admins', 'Gemeinsame Pläne legen in diesem Haushalt nur Admins an.');
    }
    if (q.zaehleEigene.get(wer.id).n >= MAX_PLAENE) throw new Fehler(400, 'zu_viele', `Höchstens ${MAX_PLAENE} Pläne je Person.`);
    const rezept = pruefeRezept(koerper.rezept, heute());
    const erzeugt = erzeugePlan(bibel, rezept);
    const id = speicherePlan({ besitzer: wer.id, name, art, rezept, einheiten: erzeugt.einheiten, ziel: erzeugt.ende });
    return { status: 201, daten: ausgabe(holePlan(id, wer), wer) };
  });

  route('POST', '/plaene/:id/kopie', ({ wer, p }) => {
    if (!wer.darfSchreiben) throw new Fehler(403, 'nur_lesen', 'Nur lesen: Übernehmen ist nicht freigegeben.');
    const quelle = holePlan(p.id, wer);
    if (quelle.art !== 'sichtbar' || quelle.besitzer === wer.id) throw new Fehler(400, 'kopie', 'Nur sichtbare Pläne anderer lassen sich übernehmen.');
    const t = heute();
    const rezept = { ...quelle.rezept, begonnen_am: t };
    const ziel = quelle.lesetage ? kalender.nterLesetag(quelle.lesetage, t, quelle.einheiten.length) : null;
    const id = speicherePlan({ besitzer: wer.id, name: quelle.name, art: 'privat', rezept, einheiten: quelle.einheiten, ziel, kopieVon: quelle.id });
    return { status: 201, daten: ausgabe(holePlan(id, wer), wer) };
  });

  route('PATCH', '/plaene/:id', ({ wer, p, koerper }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Nur wer den Plan angelegt hat, und Admins.');
    const name = koerper.name !== undefined ? pruefeName(koerper.name) : plan.name;
    const art = koerper.art !== undefined ? (ARTEN.includes(koerper.art) ? koerper.art : plan.art) : plan.art;
    db.prepare('UPDATE plan SET name = ?, art = ? WHERE id = ?').run(name, art, plan.id);
    return { daten: ausgabe(holePlan(plan.id, wer), wer) };
  });

  route('DELETE', '/plaene/:id', ({ wer, p }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Nur wer den Plan angelegt hat, und Admins.');
    db.prepare('UPDATE plan SET geloescht_am = ? WHERE id = ?').run(new Date().toISOString(), plan.id);
    return { daten: { id: plan.id, geloescht: true } };
  });

  route('POST', '/plaene/:id/wiederherstellen', ({ wer, p }) => {
    const z = zeile(q.planAuchGeloescht.get(Number(p.id)));
    if (!z || !sichtbar(z, wer) || !darfAendern(z, wer)) throw new Fehler(404, 'plan', 'Plan nicht gefunden.');
    db.prepare('UPDATE plan SET geloescht_am = NULL WHERE id = ?').run(z.id);
    return { daten: ausgabe(holePlan(z.id, wer), wer) };
  });

  route('PUT', '/plaene/:id/ziel', ({ wer, p, koerper }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Das Ziel verschieben darf, wer den Plan angelegt hat, und Admins.');
    if (!plan.lesetage) throw new Fehler(400, 'ziel', 'Ohne festen Rhythmus gibt es kein Ziel.');
    if (!istTag(koerper.ziel) || koerper.ziel <= heute()) throw new Fehler(400, 'ziel', 'Das Ziel muss nach heute liegen.');
    const aenderung = transaktion(db, () => {
      const r = db.prepare('INSERT INTO ziel_aenderung (plan_id, am, von, nach, person_id) VALUES (?, ?, ?, ?, ?)')
        .run(plan.id, heute(), plan.ziel, koerper.ziel, wer.id);
      db.prepare('UPDATE plan SET ziel = ? WHERE id = ?').run(koerper.ziel, plan.id);
      return Number(r.lastInsertRowid);
    });
    return { daten: { aenderung, plan: ausgabe(holePlan(plan.id, wer), wer) } };
  });

  route('DELETE', '/plaene/:id/ziel/:aenderung', ({ wer, p }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Nicht erlaubt.');
    const a = db.prepare('SELECT * FROM ziel_aenderung WHERE id = ? AND plan_id = ? AND zurueckgenommen_am IS NULL').get(Number(p.aenderung), plan.id);
    if (!a) throw new Fehler(404, 'aenderung', 'Änderung nicht gefunden.');
    transaktion(db, () => {
      db.prepare('UPDATE ziel_aenderung SET zurueckgenommen_am = ? WHERE id = ?').run(new Date().toISOString(), a.id);
      db.prepare('UPDATE plan SET ziel = ? WHERE id = ?').run(a.von, plan.id);
    });
    return { daten: ausgabe(holePlan(plan.id, wer), wer) };
  });

  route('POST', '/plaene/:id/einteilen', ({ wer, p }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Neu einteilen darf, wer den Plan angelegt hat, und Admins.');
    const st = standDes(plan);
    if (st.ohneRhythmus || !st.verzug) throw new Fehler(400, 'einteilen', 'Kein Verzug, nichts neu einzuteilen.');
    const neu = neuEinteilen(bibel, plan.rezept, plan.einheiten, st.gelesen, st.vorrat);
    db.prepare('UPDATE plan SET einheiten_vorher = einheiten, einheiten = ?, version = version + 1 WHERE id = ?')
      .run(JSON.stringify(neu), plan.id);
    return { daten: ausgabe(holePlan(plan.id, wer), wer) };
  });

  route('POST', '/plaene/:id/einteilen/rueckgaengig', ({ wer, p }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer) || !plan.einheiten_vorher) throw new Fehler(400, 'einteilen', 'Nichts zurückzunehmen.');
    db.prepare('UPDATE plan SET einheiten = einheiten_vorher, einheiten_vorher = NULL, version = version - 1 WHERE id = ?').run(plan.id);
    return { daten: ausgabe(holePlan(plan.id, wer), wer) };
  });

  route('POST', '/plaene/:id/noch-einmal', ({ wer, p }) => {
    const plan = holePlan(p.id, wer);
    if (!darfAendern(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Nicht erlaubt.');
    if (standDes(plan).rest > 0) throw new Fehler(400, 'noch_nicht_fertig', 'Der Plan ist noch nicht durchgelesen.');
    const t = heute();
    const ziel = plan.lesetage ? kalender.nterLesetag(plan.lesetage, t, plan.einheiten.length) : null;
    db.prepare('UPDATE plan SET durchgang = durchgang + 1, begonnen_am = ?, ziel = ?, einheiten_vorher = NULL WHERE id = ?').run(t, ziel, plan.id);
    return { daten: ausgabe(holePlan(plan.id, wer), wer) };
  });

  route('POST', '/lesungen', ({ wer, koerper }) => {
    if (!wer.darfSchreiben) throw new Fehler(403, 'nur_lesen', 'Nur lesen: Eintragen ist nicht freigegeben.');
    const t = heute();
    const datum = koerper.datum ?? t;
    if (!istTag(datum) || datum > t) throw new Fehler(400, 'datum', 'Das Datum darf nicht in der Zukunft liegen.');
    const zeit = koerper.uhrzeit ?? (datum === t ? uhrzeit() : null);
    if (zeit !== null && !UHR.test(zeit)) throw new Fehler(400, 'uhrzeit', 'Uhrzeit als HH:MM.');
    const notiz = String(koerper.notiz ?? '').slice(0, 2000);
    const plan = koerper.planId ? holePlan(koerper.planId, wer) : null;
    const dabei = plan?.art === 'gemeinsam' ? pruefeDabei(koerper.dabei) ?? [wer.id] : null;
    const jetzt = new Date().toISOString();
    if (!koerper.stuecke) {
      // Abhaken: die nächste Einheit des Plans.
      if (!plan) throw new Fehler(400, 'plan', 'Plan fehlt.');
      if (!darfAbhaken(plan, wer)) throw new Fehler(403, 'nicht_erlaubt', 'Diesen Plan kann nur sein Besitzer abhaken.');
      // Herausgenommene Teile zählen nicht als gelesen; das Lesezeichen rückt trotzdem weiter.
      const ohne = pruefeOhne(koerper.ohne);
      const zweit = neben(plan.rezept);
      const { id, gelesen } = transaktion(db, () => {
        const nr = q.gelesen.get(t, plan.id, plan.durchgang).n + 1;
        const e = plan.einheiten[nr - 1];
        if (!e) throw new Fehler(400, 'fertig', 'Der Plan ist durchgelesen.');
        const teile = teileTrennen(e.stuecke, zweit, ohne);
        const neu = Number(db.prepare(`INSERT INTO lesung (plan_id, person_id, quelle, gelesen_am, uhrzeit, einheit_nr, plan_version,
                                   durchgang, stuecke, ausgelassen, notiz, dabei, erstellt_am) VALUES (?, ?, 'plan', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(plan.id, wer.id, datum, zeit, nr, plan.version, plan.durchgang, JSON.stringify(teile.gelesen),
            teile.ausgelassen.length ? JSON.stringify(teile.ausgelassen) : null, notiz,
            dabei ? JSON.stringify(dabei) : null, jetzt).lastInsertRowid);
        return { id: neu, gelesen: teile.gelesen };
      });
      return { status: 201, daten: { lesung: id, text: einheitText(bibel, gelesen, { zweit }), plan: ausgabe(holePlan(plan.id, wer), wer) } };
    }
    // Frei eintragen: für mich (ohne Plan) oder ins Logbuch eines gemeinsamen Plans.
    if (plan && plan.art !== 'gemeinsam') throw new Fehler(400, 'plan', 'Frei eintragen geht für dich oder in einen gemeinsamen Plan.');
    const stuecke = pruefeStuecke(koerper.stuecke);
    const r = db.prepare(`INSERT INTO lesung (plan_id, person_id, quelle, gelesen_am, uhrzeit, stuecke, notiz, dabei, erstellt_am)
                          VALUES (?, ?, 'frei', ?, ?, ?, ?, ?, ?)`)
      .run(plan?.id ?? null, wer.id, datum, zeit, JSON.stringify(stuecke), notiz, dabei ? JSON.stringify(dabei) : null, jetzt);
    return { status: 201, daten: { lesung: Number(r.lastInsertRowid), text: einheitText(bibel, stuecke) } };
  });

  function holeLesung(id, wer) {
    const l = q.lesung.get(Number(id));
    if (!l) throw new Fehler(404, 'lesung', 'Eintrag nicht gefunden.');
    if (l.person_id !== wer.id && !wer.admin) throw new Fehler(403, 'nicht_erlaubt', 'Nur eigene Einträge.');
    return l;
  }

  route('PATCH', '/lesungen/:id', ({ wer, p, koerper }) => {
    const l = holeLesung(p.id, wer);
    if (l.geloescht_am) throw new Fehler(404, 'lesung', 'Eintrag nicht gefunden.');
    const datum = koerper.datum ?? l.gelesen_am;
    if (!istTag(datum) || datum > heute()) throw new Fehler(400, 'datum', 'Das Datum darf nicht in der Zukunft liegen.');
    const zeit = koerper.uhrzeit ?? l.uhrzeit;
    if (zeit !== null && !UHR.test(zeit)) throw new Fehler(400, 'uhrzeit', 'Uhrzeit als HH:MM.');
    let stuecke = l.quelle === 'frei' && koerper.stuecke ? JSON.stringify(pruefeStuecke(koerper.stuecke)) : l.stuecke;
    let ausgelassen = l.ausgelassen;
    if (l.quelle === 'plan' && koerper.ohne !== undefined) {
      // Nachträglich: herausnehmen oder wieder mitzählen. Die Einheit ist Gelesenes plus Ausgelassenes.
      const plan = zeile(q.plan.get(l.plan_id));
      if (!plan) throw new Fehler(404, 'plan', 'Plan nicht gefunden.');
      const ganz = [...JSON.parse(l.stuecke), ...(l.ausgelassen ? JSON.parse(l.ausgelassen) : [])];
      const teile = teileTrennen(ganz, neben(plan.rezept), pruefeOhne(koerper.ohne));
      stuecke = JSON.stringify(teile.gelesen);
      ausgelassen = teile.ausgelassen.length ? JSON.stringify(teile.ausgelassen) : null;
    }
    const notiz = koerper.notiz !== undefined ? String(koerper.notiz).slice(0, 2000) : l.notiz;
    db.prepare('UPDATE lesung SET gelesen_am = ?, uhrzeit = ?, stuecke = ?, ausgelassen = ?, notiz = ? WHERE id = ?')
      .run(datum, zeit, stuecke, ausgelassen, notiz, l.id);
    return { daten: { id: l.id } };
  });

  route('DELETE', '/lesungen/:id', ({ wer, p }) => {
    const l = holeLesung(p.id, wer);
    if (l.quelle === 'plan') {
      // Nur die letzte Plan-Lesung lässt sich zurücknehmen, sonst entstünde eine Lücke im Lesezeichen.
      const letzte = db.prepare(`SELECT MAX(einheit_nr) AS n FROM lesung WHERE plan_id = ? AND quelle = 'plan'
                                 AND durchgang = ? AND geloescht_am IS NULL`).get(l.plan_id, l.durchgang).n;
      if (l.einheit_nr !== letzte) throw new Fehler(400, 'reihenfolge', 'Nur die zuletzt abgehakte Einheit lässt sich zurücknehmen.');
    }
    db.prepare('UPDATE lesung SET geloescht_am = ? WHERE id = ?').run(new Date().toISOString(), l.id);
    return { daten: { id: l.id, geloescht: true } };
  });

  route('POST', '/lesungen/:id/wiederherstellen', ({ wer, p }) => {
    const l = holeLesung(p.id, wer);
    if (l.quelle === 'plan') {
      const belegt = db.prepare(`SELECT COUNT(*) AS n FROM lesung WHERE plan_id = ? AND quelle = 'plan' AND durchgang = ?
                                 AND geloescht_am IS NULL AND einheit_nr = ?`).get(l.plan_id, l.durchgang, l.einheit_nr).n;
      if (belegt) throw new Fehler(400, 'reihenfolge', 'Diese Einheit ist inzwischen wieder abgehakt.');
    }
    db.prepare('UPDATE lesung SET geloescht_am = NULL WHERE id = ?').run(l.id);
    return { daten: { id: l.id } };
  });

  const planOderAlle = (wer, wert) => (wert === 'alle' || !wert ? 'alle' : holePlan(wert, wer));

  route('GET', '/lesungen', ({ wer, url }) => {
    const plan = planOderAlle(wer, url.searchParams.get('plan'));
    const von = url.searchParams.get('von') ?? '0000-00-00';
    const bis = url.searchParams.get('bis') ?? '9999-99-99';
    return { daten: { lesungen: lesungenFuer(wer, plan, { von, bis }) } };
  });

  route('GET', '/fortschritt', ({ wer, url }) => {
    const plan = planOderAlle(wer, url.searchParams.get('plan'));
    let lesungen = lesungenFuer(wer, plan);
    if (plan !== 'alle') lesungen = lesungen.filter((l) => l.durchgang === null || l.durchgang === plan.durchgang || l.quelle === 'frei');
    const f = berechneFortschritt(bibel, lesungen);
    const jeBuch = Object.fromEntries(Object.entries(f.jeBuch).map(([id, b]) => [id, { ...b, kapitel: Object.fromEntries(b.kapitel) }]));
    return { daten: { ...f, jeBuch, kapitelGesamt: bibel.kapitelGesamt } };
  });

  route('GET', '/einstellungen', ({ wer }) => ({
    daten: {
      person: { gemeinsamZaehlt: gemeinsamZaehlt(wer) },
      haushalt: { gemeinsameAnlegen: einstellung('haushalt', 0, 'gemeinsame_anlegen', 'alle') },
    },
  }));

  route('PUT', '/einstellungen', ({ wer, koerper }) => {
    if (koerper.person?.gemeinsamZaehlt !== undefined) {
      q.setzeEinstellung.run('person', wer.id, 'gemeinsam_zaehlt', JSON.stringify(Boolean(koerper.person.gemeinsamZaehlt)));
    }
    if (koerper.haushalt?.gemeinsameAnlegen !== undefined) {
      if (!wer.admin) throw new Fehler(403, 'nur_admins', 'Haushaltseinstellungen ändern nur Admins.');
      if (!['alle', 'admins'].includes(koerper.haushalt.gemeinsameAnlegen)) throw new Fehler(400, 'wert', 'Erlaubt: alle, admins.');
      q.setzeEinstellung.run('haushalt', 0, 'gemeinsame_anlegen', JSON.stringify(koerper.haushalt.gemeinsameAnlegen));
    }
    return { daten: { ok: true } };
  });

  // ---------------------------------------------------------------- Verteiler

  return async function behandle(req, res) {
    const url = new URL(req.url, 'http://dienst');
    const pfad = url.pathname.slice(konfig.praefix.length) || '/';
    try {
      if (pfad === '/gesund' && req.method === 'GET') return json(res, 200, { ok: true, version: VERSION });
      let passend = null;
      for (const r of routen) {
        const m = r.methode === req.method && pfad.match(r.re);
        if (m) { passend = { r, p: Object.fromEntries(r.namen.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }; break; }
      }
      if (!passend) throw new Fehler(404, 'nicht_gefunden', 'Unbekannte Adresse.');
      const wer = await anmeldung.wer(req);
      if (passend.r.schreibt) { pruefeOrigin(konfig, req); pruefeCsrf(req); }
      const koerper = passend.r.schreibt ? await leseKoerper(req) : {};
      const { status = 200, daten, kopf = {} } = await passend.r.fn({ wer, req, url, p: passend.p, koerper });
      return json(res, status, daten, kopf);
    } catch (err) {
      if (err instanceof Fehler) return json(res, err.status, { error: err.message, code: err.code });
      console.error('[bibellese]', err);
      return json(res, 500, { error: 'Interner Fehler im Bibellese-Dienst.', code: 'intern' });
    }
  };
}
