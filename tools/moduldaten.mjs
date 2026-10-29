// Erzeugt modules/bibellese/daten/bibel.json aus daten/bibel-schlachter2000.json und
// quellen/parallelen.txt. Aufruf: node tools/moduldaten.mjs
//
// Das Modul bekommt nur Zahlen und Grenzen: Bücher, Verse je Kapitel, wo Hauptteile und
// Sinnabschnitte beginnen, und die Parallelgruppen. Überschriften und Bibeltext bleiben draußen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const quelle = JSON.parse(fs.readFileSync(path.join(wurzel, 'daten/bibel-schlachter2000.json'), 'utf8'));
const ziel = path.join(wurzel, 'modules/bibellese/daten/bibel.json');

const GRUPPEN = [
  ['Gesetz (Pentateuch)', 'gesetz'], ['Geschichtsbücher', 'gesch'], ['Poetische Bücher', 'poet'],
  ['Große Propheten', 'gross'], ['Kleine Propheten', 'klein'], ['Evangelien', 'evang'],
  ['Geschichtsbuch', 'apg'], ['Paulusbriefe', 'paulus'], ['Allgemeine Briefe', 'allg'], ['Prophetisches Buch', 'offb'],
];
const gruppeId = Object.fromEntries(GRUPPEN);

// Wie das Buch in einer Stellenangabe heißt, wenn es sich vom Buchnamen unterscheidet.
const STELLE = { Ps: 'Psalm' };

const buecher = quelle.buecher.map((b) => {
  if (!gruppeId[b.gruppe]) throw new Error(`Unbekannte Gruppe ${b.gruppe} bei ${b.id}`);
  const teile = b.teile.map((t) => [t.von.kapitel, t.von.vers]);
  const abschnitte = b.teile.flatMap((t) => t.perikopen.map((p) => [p.von.kapitel, p.von.vers]));
  return {
    id: b.id, name: b.name, stelle: STELLE[b.id] ?? b.name, abk: b.abk, testament: b.testament,
    gruppe: gruppeId[b.gruppe], verse: b.verse_je_kapitel, teile, abschnitte,
  };
});
const BUCH = Object.fromEntries(buecher.map((b) => [b.id, b]));

/** „2Kgs 18,13-20,19“, „Isa 36-39“, „1Sam 31“, „Ezra 2,1-35“ → { b, von:[k,v], bis:[k,v] } */
function stelle(text) {
  const m = text.trim().match(/^(\S+) (\d+)(?:,(\d+))?(?:-(\d+)(?:,(\d+))?)?$/);
  if (!m) throw new Error(`Stelle nicht lesbar: ${text}`);
  const [, b, k1, v1, x, y] = m;
  const buch = BUCH[b];
  if (!buch) throw new Error(`Unbekanntes Buch: ${text}`);
  const vonK = Number(k1);
  const vonV = v1 ? Number(v1) : 1;
  let bisK;
  let bisV;
  if (x === undefined) { bisK = vonK; bisV = v1 ? vonV : buch.verse[vonK - 1]; }
  else if (y !== undefined) { bisK = Number(x); bisV = Number(y); }
  else if (v1) { bisK = vonK; bisV = Number(x); } // „Ezra 2,1-35“: bis Vers 35 im selben Kapitel
  else { bisK = Number(x); bisV = buch.verse[bisK - 1]; } // „Isa 36-39“: ganze Kapitel
  if (bisV > buch.verse[bisK - 1]) throw new Error(`Vers außerhalb des Kapitels: ${text}`);
  return { b, von: [vonK, vonV], bis: [bisK, bisV] };
}

const parallelen = fs.readFileSync(path.join(wurzel, 'quellen/parallelen.txt'), 'utf8')
  .split(/\r?\n/)
  .map((z) => z.trim())
  .filter((z) => z.startsWith('['))
  .map((z) => {
    const m = z.match(/^\[(\w+)\]\s*(.+)$/);
    return { art: m[1], teile: m[2].split('|').map(stelle) };
  });

const daten = {
  quelle: 'Schlachter 2000 – Verszählung, Hauptteile und Sinnabschnitte aus daten/, Parallelen aus quellen/parallelen.txt',
  gruppen: GRUPPEN.map(([name, id]) => ({ id, name, testament: buecher.find((b) => b.gruppe === id).testament })),
  buecher,
  parallelen,
};
fs.mkdirSync(path.dirname(ziel), { recursive: true });
fs.writeFileSync(ziel, `${JSON.stringify(daten)}\n`);
const verse = buecher.reduce((s, b) => s + b.verse.reduce((a, n) => a + n, 0), 0);
const abschnitte = buecher.reduce((s, b) => s + b.abschnitte.length, 0);
console.log(`${ziel}: ${buecher.length} Bücher, ${verse} Verse, ${abschnitte} Abschnitte, ${parallelen.length} Parallelgruppen, ${fs.statSync(ziel).size} Bytes`);
