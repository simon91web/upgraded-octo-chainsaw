// Fortschritt auf die ganze Bibel bezogen (KONZEPT.md §3): welche Verse gelesen sind, und daraus,
// welche Kapitel vollständig gelesen sind. Plan-Lesungen gehen vor freien Einträgen.

/** lesungen: [{ quelle: 'plan'|'frei', stuecke: [...] }] → { je Buch: { verse: Uint8Array, kapitel: Map } } */
export function fortschritt(bibel, lesungen) {
  const verse = Object.fromEntries(bibel.buecher.map((b) => [b.id, new Uint8Array(b.versGesamt)]));
  for (const l of lesungen) {
    const wert = l.quelle === 'plan' ? 2 : 1;
    for (const s of l.stuecke) {
      if (!bibel.hat(s.b)) continue;
      const buch = bibel.buch(s.b);
      const feld = verse[s.b];
      for (let p = buch.pos(s.von), e = buch.pos(s.bis); p <= e; p++) if (feld[p] < wert) feld[p] = wert;
    }
  }
  const jeBuch = {};
  let gesamt = 0;
  let at = 0;
  let nt = 0;
  const jeGruppe = {};
  for (const buch of bibel.buecher) {
    const feld = verse[buch.id];
    const kapitel = new Map(); // Kapitel → 'plan' | 'frei' (vollständig gelesen)
    let begonnen = 0;
    for (let k = 1; k <= buch.kapitel; k++) {
      let min = 2;
      let max = 0;
      for (let p = buch.versatz[k - 1]; p < buch.versatz[k]; p++) { min = Math.min(min, feld[p]); max = Math.max(max, feld[p]); }
      if (min > 0) kapitel.set(k, min === 2 ? 'plan' : 'frei');
      else if (max > 0) begonnen++;
    }
    jeBuch[buch.id] = { kapitel, begonnen, gelesen: kapitel.size, von: buch.kapitel };
    gesamt += kapitel.size;
    if (buch.testament === 'AT') at += kapitel.size; else nt += kapitel.size;
    jeGruppe[buch.gruppe] ??= { gelesen: 0, von: 0 };
    jeGruppe[buch.gruppe].gelesen += kapitel.size;
    jeGruppe[buch.gruppe].von += buch.kapitel;
  }
  return { jeBuch, jeGruppe, gesamt, at, nt };
}
