// Der Rechenkern (LESEPLAN.md §8): Bausteine b1 … bn mit Minuten m(i) in Einheiten teilen.
//
//   Kosten einer Einheit bi … bj = ((m(i) + … + m(j) − T) / T)² + a(j)
//
// gesucht sind die erlaubten Grenzen mit der kleinsten Kostensumme (dynamische Programmierung
// wie beim Blocksatz-Umbruch). Für genau N Einheiten rechnet die Tabelle je Einheitenzahl mit;
// eine Einheit darf höchstens dreimal so lang werden wie T (außer ein einzelner Baustein ist es).

import { abzug } from './bausteine.js';

/** Grenzpositionen: 0, jede erlaubte Grenze, Ende. Mit Abzug und Präfixsummen der Minuten. */
function vorbereiten(bausteine, minuten, einteilung) {
  const pos = [0];
  const a = [0];
  for (let i = 0; i < bausteine.length - 1; i++) {
    const x = abzug(einteilung, bausteine[i].grenze);
    if (x !== null) { pos.push(i + 1); a.push(x); }
  }
  pos.push(bausteine.length);
  a.push(0);
  const summe = [0];
  for (const m of minuten) summe.push(summe.at(-1) + m);
  return { pos, a, summe };
}

/** Genau `n` Einheiten mit kleinster Kostensumme; `null`, wenn es im Fenster keine Lösung gibt. */
function exakt({ pos, a, summe }, n) {
  const P = pos.length;
  const T = summe.at(-1) / n;
  const zurueck = new Int32Array(n * P).fill(-1);
  let vorher = new Float64Array(P).fill(Infinity);
  vorher[0] = 0;
  for (let k = 1; k <= n; k++) {
    const jetzt = new Float64Array(P).fill(Infinity);
    const bisJ = P - 1 - (n - k); // es müssen genug Grenzen für die übrigen Einheiten bleiben
    for (let j = k; j <= bisJ; j++) {
      for (let i = j - 1; i >= k - 1; i--) {
        const m = summe[pos[j]] - summe[pos[i]];
        if (m > 3 * T && i < j - 1) break;
        if (vorher[i] === Infinity) continue;
        const c = vorher[i] + ((m - T) / T) ** 2 + a[j];
        if (c < jetzt[j]) { jetzt[j] = c; zurueck[(k - 1) * P + j] = i; }
      }
    }
    vorher = jetzt;
  }
  if (vorher[P - 1] === Infinity) return null;
  const enden = [];
  for (let k = n, j = P - 1; k > 0; k--) { enden.push(pos[j]); j = zurueck[(k - 1) * P + j]; }
  return enden.reverse();
}

/** Ohne feste Zahl: kleinste Kostensumme für Zielminuten T (Rückfall, wenn exakt nicht geht). */
function frei({ pos, a, summe }, T) {
  const P = pos.length;
  const kosten = new Float64Array(P).fill(Infinity);
  const von = new Int32Array(P).fill(-1);
  kosten[0] = 0;
  for (let j = 1; j < P; j++) {
    for (let i = j - 1; i >= 0; i--) {
      const m = summe[pos[j]] - summe[pos[i]];
      if (m > 3 * T && i < j - 1) break;
      const c = kosten[i] + ((m - T) / T) ** 2 + a[j];
      if (c < kosten[j]) { kosten[j] = c; von[j] = i; }
    }
  }
  const enden = [];
  for (let j = P - 1; j > 0; j = von[j]) enden.push(pos[j]);
  return enden.reverse();
}

/**
 * Bausteine in genau `n` Einheiten teilen. Gibt die Enden der Einheiten zurück
 * (exklusive Indizes in `bausteine`).
 */
export function einteilen(bausteine, minuten, n, einteilung) {
  const v = vorbereiten(bausteine, minuten, einteilung);
  const moeglich = v.pos.length - 1;
  if (n >= moeglich) return v.pos.slice(1); // jede erlaubte Grenze ist ein Schnitt
  if (n <= 1) return [bausteine.length];
  return exakt(v, n) ?? frei(v, v.summe.at(-1) / n);
}

/** Höchstens so viele Einheiten, wie es erlaubte Grenzen gibt. */
export function hoechstens(bausteine, einteilung) {
  return vorbereiten(bausteine, bausteine.map(() => 0), einteilung).pos.length - 1;
}

/**
 * Ein Nebenstrang mit weniger Bausteinen als Einheiten: je Abschnitt eine Einheit, gleichmäßig
 * über die n Plätze gestreut; dazwischen bleibt er leer (LESEPLAN.md §1).
 */
export function streuen(enden, n) {
  const plaetze = Array.from({ length: n }, () => null);
  enden.forEach((ende, i) => { plaetze[Math.min(n - 1, Math.floor((i * n) / enden.length))] = ende; });
  return plaetze;
}
