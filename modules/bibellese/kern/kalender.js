// Tage als 'YYYY-MM-DD' in UTC gerechnet, damit Sommerzeit nichts verschiebt.
// Lesetage sind Wochentage 0 (So) bis 6 (Sa); `null` heißt „ohne festen Rhythmus“.

const TAG = 86400000;

export const zuZahl = (t) => Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)));
export const zuTag = (z) => new Date(z).toISOString().slice(0, 10);
export const plusTage = (t, n) => zuTag(zuZahl(t) + n * TAG);
export const wochentag = (t) => new Date(zuZahl(t)).getUTCDay();
export const tageZwischen = (a, b) => Math.round((zuZahl(b) - zuZahl(a)) / TAG);

/** Lesetage von `von` bis `bis`, beide eingeschlossen. */
export function lesetage(tage, von, bis) {
  if (!tage?.length || bis < von) return 0;
  const n = tageZwischen(von, bis) + 1;
  const wochen = Math.floor(n / 7);
  let summe = wochen * tage.length;
  const w0 = wochentag(von);
  for (let i = wochen * 7; i < n; i++) if (tage.includes((w0 + i) % 7)) summe++;
  return summe;
}

/** Der n-te Lesetag ab `von` (von selbst zählt mit, wenn es ein Lesetag ist). */
export function nterLesetag(tage, von, n) {
  if (!tage?.length) return null;
  if (n <= 0) return plusTage(von, -1);
  const wochen = Math.floor((n - 1) / tage.length);
  let t = plusTage(von, wochen * 7);
  let offen = n - wochen * tage.length;
  for (;;) {
    if (tage.includes(wochentag(t))) offen--;
    if (offen === 0) return t;
    t = plusTage(t, 1);
  }
}
