// Bausteine eines Strangs (LESEPLAN.md §1–§4): Bücher wählen, Ring drehen, an Sinnabschnitten
// und Kapitelenden teilen, Parallelen bündeln. Ein Baustein wird später nie geteilt.

import { buecherDerAuswahl } from './bibel.js';
import { leseStart } from './stellen.js';

/**
 * Welche Grenzen eine Einteilung erlaubt und was sie kosten (LESEPLAN.md §4, Startwerte).
 * `teil` ist das Ende eines Hauptteils; kapitelweise zählt es nur, wenn es auf ein Kapitelende fällt.
 */
export const EINTEILUNGEN = {
  kapitel: { buch: 0, teil: 0.02, kapitel: 0.05, kapitelImAbschnitt: 0.30 },
  'kapitel-sinn': { buch: 0, teil: 0.02, kapitel: 0.05, nahe: 0.07 },
  abschnitte: { buch: 0, teil: 0.02, kapitel: 0.05, nahe: 0.07, abschnitt: 0.10 },
};

/** Art der Grenze nach Vers `ende` (laufende Nummer) im Buch. */
function grenzeNach(buch, ende) {
  if (ende === buch.versGesamt - 1) return { art: 'buch', kapitel: true };
  const naechster = ende + 1;
  const v = buch.zuStelle(naechster)[1];
  const kap = v === 1;
  const abs = buch.abschnittStarts.has(naechster);
  if (buch.teilStarts.has(naechster)) return { art: 'teil', kapitel: kap };
  if (kap && abs) return { art: 'kapitel', kapitel: true };
  if (abs) {
    // Ein Abschnitt, der 1–2 Verse nach dem Kapitelbeginn anfängt, zählt wie ein Kapitelende
    // (1Sam 20,1–21,1, Dan 5,1–6,1). Abschnitte kurz vor dem Kapitelende zählen nicht: sonst
    // entstünden Mini-Lesungen wie Joh 21,24–25.
    return { art: v <= 3 ? 'nahe' : 'abschnitt', kapitel: false };
  }
  return { art: 'kapitelImAbschnitt', kapitel: true };
}

/** Erlaubt die Einteilung diese Grenze, und mit welchem Abzug? `null` = gesperrt. */
export function abzug(einteilung, grenze) {
  const tabelle = EINTEILUNGEN[einteilung];
  if (!tabelle) throw new Error(`Unbekannte Einteilung: ${einteilung}`);
  if (grenze.art === 'teil' && einteilung === 'kapitel' && !grenze.kapitel) return null;
  return tabelle[grenze.art] ?? null;
}

/** Feine Stücke eines Buchs: geteilt an jedem Abschnittsbeginn und jedem Kapitelbeginn. */
function stueckeDesBuchs(buch) {
  const starts = new Set([0, ...buch.abschnittStarts]);
  for (let k = 1; k < buch.kapitel; k++) starts.add(buch.versatz[k]);
  const liste = [...starts].sort((a, b) => a - b);
  return liste.map((start, i) => {
    const ende = (liste[i + 1] ?? buch.versGesamt) - 1;
    return { b: buch.id, start, ende, verse: ende - start + 1, grenze: grenzeNach(buch, ende) };
  });
}

/**
 * Bausteine eines Strangs.
 * strang: { buecher: 'bibel'|'at'|'nt'|'gruppe:<id>'|[ids], ohne?: [ids], start?: 'Isa' | 'Isa.40.1' }
 * optionen: { parallelen: ['geschichte', 'lieder', 'gesetz'] }
 */
export function bausteine(bibel, strang, { parallelen = [] } = {}) {
  if (strang.reihenfolge && strang.reihenfolge !== 'kanonisch') {
    throw new Error('Chronologische Reihenfolge gibt es noch nicht (quellen/chronologisch.txt fehlt).');
  }
  let buecher = buecherDerAuswahl(bibel, strang.buecher, strang.ohne ?? []);
  if (!buecher.length) throw new Error('Keine Bücher ausgewählt.');

  // Ring drehen: Startbuch nach vorn, alles davor ans Ende.
  let schnitt = null;
  if (strang.start) {
    const s = leseStart(strang.start);
    const i = buecher.findIndex((b) => b.id === s.b);
    if (i >= 0) {
      buecher = [...buecher.slice(i), ...buecher.slice(0, i)];
      const buch = buecher[0];
      const pos = buch.pos([Math.min(s.k, buch.kapitel), 1]) + (s.v - 1);
      // Am Anfang des Sinnabschnitts einrasten, in dem der Startpunkt liegt.
      schnitt = Math.max(0, ...[...buch.abschnittStarts].filter((p) => p <= pos));
    }
  }
  let stuecke = buecher.flatMap(stueckeDesBuchs);
  if (schnitt > 0) {
    const ersteBuch = buecher[0].id;
    const vorn = stuecke.filter((x) => !(x.b === ersteBuch && x.start < schnitt));
    const hinten = stuecke.filter((x) => x.b === ersteBuch && x.start < schnitt);
    stuecke = [...vorn, ...hinten];
  }

  // Bausteine: zunächst je Stück einer; Parallelen fassen mehrere zu einem zusammen.
  let liste = stuecke.map((x) => ({ teile: [x], grenze: x.grenze }));
  if (parallelen.length) liste = buendeln(bibel, liste, new Set(buecher.map((b) => b.id)), parallelen);

  return liste.map((bs) => ({
    stuecke: bs.teile.map((x) => {
      const buch = bibel.buch(x.b);
      return { b: x.b, von: buch.zuStelle(x.start), bis: buch.zuStelle(x.ende), ...(x.parallel ? { parallel: true } : {}) };
    }),
    verse: bs.teile.reduce((s, x) => s + x.verse, 0),
    grenze: bs.grenze,
  }));
}

/**
 * Parallelen bündeln (LESEPLAN.md §3): Die Stelle, die im gedrehten Strang zuerst kommt, ist die
 * Leitstelle. Ihre Parallelen werden zu ihr geholt und an ihrem eigenen Platz übersprungen.
 * Gebündelt wird nur, wenn alle Teile im Strang liegen und genau auf Stückgrenzen fallen.
 */
function buendeln(bibel, liste, imStrang, arten) {
  const ort = new Map(); // "b:start" → Index in liste
  liste.forEach((bs, i) => ort.set(`${bs.teile[0].b}:${bs.teile[0].start}`, i));
  const weg = new Set();
  const ersetzt = new Map();
  for (const gruppe of bibel.parallelen) {
    if (!arten.includes(gruppe.art)) continue;
    if (!gruppe.teile.every((t) => imStrang.has(t.b))) continue;
    const bereiche = [];
    let passt = true;
    for (const t of gruppe.teile) {
      const buch = bibel.buch(t.b);
      const von = buch.pos(t.von);
      const bis = buch.pos(t.bis);
      const erster = ort.get(`${t.b}:${von}`);
      if (erster === undefined) { passt = false; break; }
      const idx = [];
      for (let i = erster; i < liste.length && liste[i].teile[0].b === t.b && liste[i].teile[0].ende <= bis; i++) idx.push(i);
      const letzter = idx.at(-1);
      if (letzter === undefined || liste[letzter].teile[0].ende !== bis || idx.some((i) => weg.has(i) || ersetzt.has(i))) { passt = false; break; }
      bereiche.push(idx);
    }
    if (!passt) continue;
    bereiche.sort((a, b) => a[0] - b[0]);
    const [leit, ...andere] = bereiche;
    const teile = [
      ...leit.map((i) => liste[i].teile[0]),
      ...andere.flatMap((idx) => idx.map((i) => ({ ...liste[i].teile[0], parallel: true }))),
    ];
    ersetzt.set(leit[0], { teile, grenze: liste[leit.at(-1)].grenze });
    for (const i of leit.slice(1)) weg.add(i);
    for (const idx of andere) for (const i of idx) weg.add(i);
  }
  return liste.flatMap((bs, i) => (weg.has(i) ? [] : [ersetzt.get(i) ?? bs]));
}
