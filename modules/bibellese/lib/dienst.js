// Verbindung zum Bibellese-Dienst unter /api/extensions/bibellese/ (gleiche Herkunft wie Yuvomi).
// Schreibende Anfragen tragen das CSRF-Token, das /status liefert.

const BASIS = '/api/extensions/bibellese';
let token = null;

export class DienstFehler extends Error {
  constructor(text, status, code) {
    super(text);
    this.status = status;
    this.code = code;
  }
}

async function anfrage(methode, pfad, koerper, { signal } = {}) {
  if (methode !== 'GET' && !token) await status({ signal });
  let antwort;
  try {
    antwort = await fetch(`${BASIS}${pfad}`, {
      method: methode,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      headers: {
        accept: 'application/json',
        ...(koerper ? { 'content-type': 'application/json' } : {}),
        ...(methode !== 'GET' ? { 'x-bibellese-csrf': token } : {}),
      },
      body: koerper ? JSON.stringify(koerper) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new DienstFehler('Bibellese-Dienst nicht erreichbar.', 0, 'offline');
  }
  let daten = null;
  try { daten = await antwort.json(); } catch { /* kein JSON, etwa vom Proxy */ }
  if (!antwort.ok) {
    if (antwort.status === 502 || antwort.status === 503 || antwort.status === 504 || !daten) {
      throw new DienstFehler('Bibellese-Dienst nicht erreichbar.', antwort.status, 'offline');
    }
    if (daten.code === 'csrf') token = null;
    throw new DienstFehler(daten.error ?? 'Unbekannter Fehler.', antwort.status, daten.code);
  }
  return daten;
}

export async function status(opts) {
  const s = await anfrage('GET', '/status', null, opts);
  token = s.csrf;
  return s;
}

export const dienst = {
  status,
  plaene: (opts) => anfrage('GET', '/plaene', null, opts),
  plan: (id, opts) => anfrage('GET', `/plaene/${id}`, null, opts),
  planAnlegen: (daten) => anfrage('POST', '/plaene', daten),
  planAendern: (id, daten) => anfrage('PATCH', `/plaene/${id}`, daten),
  planLoeschen: (id) => anfrage('DELETE', `/plaene/${id}`),
  planWiederherstellen: (id) => anfrage('POST', `/plaene/${id}/wiederherstellen`),
  uebernehmen: (id) => anfrage('POST', `/plaene/${id}/kopie`),
  zielSetzen: (id, ziel) => anfrage('PUT', `/plaene/${id}/ziel`, { ziel }),
  zielZurueck: (id, aenderung) => anfrage('DELETE', `/plaene/${id}/ziel/${aenderung}`),
  neuEinteilen: (id) => anfrage('POST', `/plaene/${id}/einteilen`),
  neuEinteilenZurueck: (id) => anfrage('POST', `/plaene/${id}/einteilen/rueckgaengig`),
  nochEinmal: (id) => anfrage('POST', `/plaene/${id}/noch-einmal`),
  abhaken: (daten) => anfrage('POST', '/lesungen', daten),
  eintragen: (daten) => anfrage('POST', '/lesungen', daten),
  lesungAendern: (id, daten) => anfrage('PATCH', `/lesungen/${id}`, daten),
  lesungLoeschen: (id) => anfrage('DELETE', `/lesungen/${id}`),
  lesungWiederherstellen: (id) => anfrage('POST', `/lesungen/${id}/wiederherstellen`),
  lesungen: (plan, von, bis, opts) => anfrage('GET', `/lesungen?plan=${encodeURIComponent(plan)}&von=${von}&bis=${bis}`, null, opts),
  fortschritt: (plan, opts) => anfrage('GET', `/fortschritt?plan=${encodeURIComponent(plan)}`, null, opts),
  einstellungen: (opts) => anfrage('GET', '/einstellungen', null, opts),
  einstellungenSetzen: (daten) => anfrage('PUT', '/einstellungen', daten),
};

/** Die Bibeldaten und der Kern, einmal geladen (für Buchnamen und die Vorschau im Assistenten). */
let bibelVersprechen = null;
export function ladeBibelDaten() {
  bibelVersprechen ??= Promise.all([
    fetch(new URL('../daten/bibel.json', import.meta.url)).then((r) => r.json()),
    import('../kern/index.js'),
  ]).then(([daten, kern]) => ({ bibel: kern.ladeBibel(daten), kern }));
  return bibelVersprechen;
}
