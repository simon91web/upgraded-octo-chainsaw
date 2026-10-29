// Aus einem Rezept (LESEPLAN.md §9) die Einheiten eines Plans erzeugen.
//
// rezept = {
//   straenge: [{ buecher, ohne?, reihenfolge?, start? }, …],
//   einteilung: 'kapitel' | 'kapitel-sinn' | 'abschnitte',
//   parallelen: ['geschichte', 'lieder', 'gesetz'],
//   lesetage: [0..6] | null,            // null = ohne festen Rhythmus
//   ziel: { datum: 'YYYY-MM-DD' } | { minuten: 15 },
//   woerter_je_minute: 130, begonnen_am: 'YYYY-MM-DD',
// }
//
// Eine Einheit ist { stuecke: [{ b, von, bis, parallel? }], verse, bis: [Baustein-Ende je Strang] }.

import { bausteine as bausteineDesStrangs } from './bausteine.js';
import { einteilen, hoechstens, streuen } from './einteilen.js';
import { lesetage as zaehleLesetage, nterLesetag } from './kalender.js';
import { verbinde } from './stellen.js';

/** Bis quellen/wortzahlen.txt da ist: Wörter je Vers im Mittel (ganze Bibel still ≈ 60 Std.). */
export const WOERTER_JE_VERS = 23;
export const minutenFuerVerse = (verse, wpm) => (verse * WOERTER_JE_VERS) / wpm;
export const LESARTEN = { still: 200, langsam: 150, vorlesen: 130 };

export function bausteineDesRezepts(bibel, rezept) {
  return rezept.straenge.map((s) => bausteineDesStrangs(bibel, s, { parallelen: rezept.parallelen ?? [] }));
}

/** Einen Strang in n Einheiten teilen; ein Nebenstrang mit zu wenig Bausteinen wird gestreut. */
function strangTeilen(bs, n, wpm, einteilung, { haupt }) {
  const minuten = bs.map((b) => minutenFuerVerse(b.verse, wpm));
  const max = hoechstens(bs, einteilung);
  if (!haupt && max < n) return streuen(einteilen(bs, minuten, max, einteilung), n);
  return einteilen(bs, minuten, n, einteilung);
}

/** Einheiten aus den Strängen zusammensetzen: je Platz die Stücke aller Stränge. */
function zusammensetzen(bibel, straenge, endenJeStrang, anfang = straenge.map(() => 0)) {
  const n = endenJeStrang[0].length;
  const stand = [...anfang];
  const einheiten = [];
  for (let i = 0; i < n; i++) {
    const stuecke = [];
    let verse = 0;
    straenge.forEach((bs, s) => {
      const ende = endenJeStrang[s][i];
      if (ende === null || ende === undefined) return;
      for (let j = stand[s]; j < ende; j++) { stuecke.push(...bs[j].stuecke); verse += bs[j].verse; }
      stand[s] = ende;
    });
    einheiten.push({ stuecke: verbinde(bibel, stuecke), verse, bis: [...stand] });
  }
  return einheiten;
}

/**
 * Plan erzeugen. Mit Zieldatum: so viele Einheiten wie Lesetage bis dahin; mit Minuten: so viele,
 * dass jede Lesung etwa so lang ist. Weil Bausteine nie geteilt werden, kann das Ergebnis um eine
 * Einheit abweichen; `begrenzt` sagt, dass es weniger Bausteine als gewünschte Einheiten gab.
 */
export function erzeugePlan(bibel, rezept) {
  const wpm = rezept.woerter_je_minute ?? LESARTEN.still;
  const einteilung = rezept.einteilung ?? 'kapitel-sinn';
  const straenge = bausteineDesRezepts(bibel, rezept);
  const verseGesamt = straenge.flat().reduce((s, b) => s + b.verse, 0);
  const gesamt = minutenFuerVerse(verseGesamt, wpm);
  let n;
  if (rezept.ziel?.datum && rezept.lesetage?.length) n = zaehleLesetage(rezept.lesetage, rezept.begonnen_am, rezept.ziel.datum);
  else n = Math.round(gesamt / (rezept.ziel?.minuten ?? 10));
  n = Math.max(1, n);
  const max = hoechstens(straenge[0], einteilung);
  const begrenzt = n > max;
  n = Math.min(n, max);
  const enden = straenge.map((bs, s) => strangTeilen(bs, n, wpm, einteilung, { haupt: s === 0 }));
  // Der Hauptstrang bestimmt die tatsächliche Zahl (±1 gegenüber dem Wunsch).
  const anzahl = enden[0].length;
  for (let s = 1; s < enden.length; s++) {
    if (enden[s].length !== anzahl) enden[s] = strangTeilen(straenge[s], anzahl, wpm, einteilung, { haupt: false });
  }
  const einheiten = zusammensetzen(bibel, straenge, enden);
  return {
    einheiten,
    n: anzahl,
    begrenzt,
    gesamt,
    minutenJe: gesamt / anzahl,
    straenge: straenge.length,
    ende: rezept.lesetage?.length ? nterLesetag(rezept.lesetage, rezept.begonnen_am, anzahl) : null,
  };
}

/**
 * „Neu einteilen“ (LESEPLAN.md §6/§9): der Rest ab dem Lesezeichen wird in `n` Einheiten neu geteilt.
 * Gelesenes bleibt, wie es war.
 */
export function neuEinteilen(bibel, rezept, einheiten, gelesen, n) {
  const wpm = rezept.woerter_je_minute ?? LESARTEN.still;
  const einteilung = rezept.einteilung ?? 'kapitel-sinn';
  const straenge = bausteineDesRezepts(bibel, rezept);
  const anfang = gelesen > 0 ? einheiten[gelesen - 1].bis : straenge.map(() => 0);
  const rest = straenge.map((bs, s) => bs.slice(anfang[s]));
  if (!rest[0].length) return einheiten;
  const anzahl = Math.max(1, Math.min(n, hoechstens(rest[0], einteilung)));
  const enden = rest.map((bs, s) => (bs.length ? strangTeilen(bs, anzahl, wpm, einteilung, { haupt: s === 0 }) : Array(anzahl).fill(null)));
  const tatsaechlich = enden[0].length;
  const verschoben = enden.map((e, s) => e.map((x) => (x === null ? null : x + anfang[s])));
  const neu = zusammensetzen(bibel, straenge, verschoben.map((e) => e.slice(0, tatsaechlich)), anfang);
  return [...einheiten.slice(0, gelesen), ...neu];
}

/** Minuten einer Einheit. */
export const minutenDerEinheit = (einheit, wpm) => minutenFuerVerse(einheit.verse, wpm);
