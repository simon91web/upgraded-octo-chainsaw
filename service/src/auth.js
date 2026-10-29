// Anmeldung und Rechte (MODULES.md, „Modules With A Backend Service“):
// - Die Sitzung des Aufrufers wird bei Yuvomi geprüft (GET /api/v1/auth/me mit seinem Cookie),
//   nur dieser Antwort wird geglaubt, nie einer Person-ID aus der Anfrage.
// - Das Ergebnis wird kurz zwischengespeichert; Yuvomi begrenzt /api auf 300 Anfragen je Minute.
// - Schreibende Anfragen brauchen einen passenden Origin und das eigene CSRF-Paar (Cookie + Kopf).

import crypto from 'node:crypto';

export const CSRF_COOKIE = 'bibellese-csrf';
export const CSRF_KOPF = 'x-bibellese-csrf';
const MODUL = 'ext:bibellese';

export class Fehler extends Error {
  constructor(status, code, text) {
    super(text);
    this.status = status;
    this.code = code;
  }
}

export function leseCookies(kopf = '') {
  const aus = {};
  for (const teil of kopf.split(';')) {
    const i = teil.indexOf('=');
    if (i > 0) aus[teil.slice(0, i).trim()] = decodeURIComponent(teil.slice(i + 1).trim());
  }
  return aus;
}

export function erzeugeAnmeldung(konfig, { fetchImpl = fetch, jetzt = () => Date.now() } = {}) {
  const cache = new Map();

  async function frageYuvomi(pfad, req) {
    const antwort = await fetchImpl(`${konfig.yuvomiUrl}/api/v1${pfad}`, {
      headers: {
        cookie: req.headers.cookie ?? '',
        accept: 'application/json',
        // Ohne diese Kopfzeile ginge Yuvomis Rate-Limit für alle Nutzer zu Lasten der Dienst-IP.
        'x-forwarded-for': req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? '',
      },
    });
    if (antwort.status === 401 || antwort.status === 403) throw new Fehler(401, 'nicht_angemeldet', 'Bitte in Yuvomi anmelden.');
    if (!antwort.ok) throw new Fehler(502, 'yuvomi_fehler', `Yuvomi antwortet mit ${antwort.status}.`);
    return antwort.json();
  }

  /** Wer fragt, und was darf er? Wirft 401/403. */
  async function wer(req) {
    const cookie = req.headers.cookie;
    if (!cookie) throw new Fehler(401, 'nicht_angemeldet', 'Bitte in Yuvomi anmelden.');
    const schluessel = crypto.createHash('sha256').update(cookie).digest('hex');
    const treffer = cache.get(schluessel);
    if (treffer && treffer.bis > jetzt()) return treffer.wer;
    const me = await frageYuvomi('/auth/me', req);
    const recht = me.permissions?.modules?.[MODUL] ?? 'write';
    if (recht === 'none') throw new Fehler(403, 'kein_zugriff', 'Bibellese ist für dieses Konto nicht freigegeben.');
    const ergebnis = {
      id: me.user.id,
      name: me.user.display_name,
      admin: me.user.role === 'admin' || me.permissions?.admin === true,
      kind: me.user.family_role === 'child',
      darfSchreiben: recht === 'write',
    };
    cache.set(schluessel, { wer: ergebnis, bis: jetzt() + konfig.sitzungCacheMs });
    if (cache.size > 500) for (const [k, v] of cache) if (v.bis <= jetzt()) cache.delete(k);
    return ergebnis;
  }

  return { wer, frageYuvomi };
}

/** Origin der Anfrage muss die öffentliche Adresse sein (oder zum Host passen). */
export function pruefeOrigin(konfig, req) {
  const origin = req.headers.origin;
  if (!origin) throw new Fehler(403, 'origin', 'Anfrage ohne Origin abgelehnt.');
  const erlaubt = konfig.oeffentlich
    ? origin === konfig.oeffentlich
    : new URL(origin).host === (req.headers['x-forwarded-host'] ?? req.headers.host);
  if (!erlaubt) throw new Fehler(403, 'origin', 'Anfrage von fremder Seite abgelehnt.');
}

/** Doppelt übermitteltes CSRF-Token: Cookie und Kopfzeile müssen übereinstimmen. */
export function pruefeCsrf(req) {
  const cookie = leseCookies(req.headers.cookie)[CSRF_COOKIE];
  const kopf = req.headers[CSRF_KOPF];
  if (!cookie || !kopf || cookie.length !== kopf.length
    || !crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(String(kopf)))) {
    throw new Fehler(403, 'csrf', 'Sicherheitstoken fehlt oder passt nicht. Seite neu laden.');
  }
}

export const neuesCsrfToken = () => crypto.randomBytes(24).toString('base64url');
