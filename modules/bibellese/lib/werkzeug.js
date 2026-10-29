// Kleine Helfer: sicheres HTML, Zahlen, Daten, Statistik über Lesungen.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const ic = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
export const NBSP = ' ';
export const zahl = (n) => Number(n).toLocaleString('de-DE');
export const dezimal = (n) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const prozent = (a, b) => `${b ? Math.round((a / b) * 100) : 0}${NBSP}%`;
export const anteil = (a, b) => (b ? Math.min(1, a / b) : 0);
export const min = (m) => `≈${NBSP}${m < 10 ? dezimal(m) : Math.round(m)}${NBSP}Min.`;
export const einheiten = (n) => `${zahl(n)}${NBSP}${n === 1 ? 'Einheit' : 'Einheiten'}`;
export const lesungenText = (n) => `${zahl(n)}${NBSP}${n === 1 ? 'Lesung' : 'Lesungen'}`;
export const eintraegeText = (n) => (n === 1 ? '1 Eintrag' : `${zahl(n)} Einträge`);

export const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
export const WT2 = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
export const MON3 = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

// Tage als 'YYYY-MM-DD' (UTC-gerechnet, wie im Kern).
export const zuDatum = (t) => new Date(Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10))));
export const zuTag = (d) => d.toISOString().slice(0, 10);
export const plusTage = (t, n) => zuTag(new Date(zuDatum(t).getTime() + n * 86400000));
export const wochentag = (t) => zuDatum(t).getUTCDay();
export const fmtDatum = (t) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '');
export const kurzDatum = (t, heute) => `${WT2[wochentag(t)]}., ${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4) === heute.slice(0, 4) ? '' : t.slice(0, 4)}`;
export function tagKopf(t, heute) {
  if (t === heute) return 'Heute';
  if (t === plusTage(heute, -1)) return 'Gestern';
  const d = zuDatum(t);
  return `${WT[d.getUTCDay()]}, ${d.getUTCDate()}. ${MON[d.getUTCMonth()]}`;
}
export const uhrzeitJetzt = () => new Date().toTimeString().slice(0, 5);

/** Statistik über Lesungen (Liste vom Dienst) für Kalender, Woche und den Reiter „Statistik“. */
export function statistik(lesungen, heute, { monat, jahr }) {
  const proTag = new Map();
  for (const l of lesungen) {
    if (!proTag.has(l.datum)) proTag.set(l.datum, []);
    proTag.get(l.datum).push(l);
  }
  const praefix = `${jahr}-${String(monat + 1).padStart(2, '0')}`;
  const lesetageImMonat = [...proTag.keys()].filter((t) => t.startsWith(praefix)).length;
  const laufend = heute.startsWith(praefix);
  const tageImMonat = laufend
    ? Number(heute.slice(8, 10)) - (proTag.has(heute) ? 0 : 1)
    : new Date(Date.UTC(jahr, monat + 1, 0)).getUTCDate();
  const achtWochenAb = plusTage(heute, -56);
  const jeWoche = [...proTag.keys()].filter((t) => t > achtWochenAb && t <= heute).length / 8;
  const wochentage = [1, 2, 3, 4, 5, 6, 0].map((wd) => [...proTag.keys()].filter((t) => wochentag(t) === wd).length);
  const tageszeit = [
    ['Früh', 5, 9], ['Vormittag', 9, 12], ['Mittag', 12, 15], ['Nachmittag', 15, 18], ['Abend', 18, 22], ['Nacht', 22, 29],
  ].map(([name, von, bis]) => ({
    name,
    anzahl: lesungen.filter((l) => {
      if (!l.uhrzeit) return false;
      const h = Number(l.uhrzeit.slice(0, 2));
      return (h >= von && h < bis) || (h + 24 >= von && h + 24 < bis);
    }).length,
  }));
  return {
    proTag, lesetageImMonat, tageImMonat, jeWoche, wochentage, tageszeit,
    meist: tageszeit.reduce((a, b) => (b.anzahl > a.anzahl ? b : a)),
    erster: [...proTag.keys()].sort()[0] ?? null,
  };
}
