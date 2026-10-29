// Erzeugt daten/*.json und daten/*.csv aus den Quelldateien in quellen/.
// Aufruf: node build.js
//
// Perikopen-Quellformat (quellen/perikopen/*.txt):
//   @Gen                  Beginn eines Buches (ID wie in buecher.json)
//   = 1,1 Titel           Beginn eines Hauptteils
//   1,1 Titel             Beginn eines Sinnabschnitts ("23 Titel" = Kapitel 23, Vers 1)
//   # ...                 Kommentar
// Jeder Abschnitt reicht bis zum Vers vor dem nächsten Abschnitt bzw. bis zum Buchende.

const fs = require('fs');
const path = require('path');

const Q = path.join(__dirname, 'quellen');
const OUT = path.join(__dirname, 'daten');

const buecher = JSON.parse(fs.readFileSync(path.join(Q, 'buecher.json'), 'utf8'));

const verse = {};
for (const line of fs.readFileSync(path.join(Q, 'verszahlen.txt'), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [id, liste] = line.split(':');
  verse[id.trim()] = liste.split(',').map(Number);
}

const fehler = [];
const perikopen = {};
const dir = path.join(Q, 'perikopen');
for (const datei of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) {
  let buch = null;
  fs.readFileSync(path.join(dir, datei), 'utf8').split(/\r?\n/).forEach((roh, i) => {
    const line = roh.trim();
    const wo = `${datei}:${i + 1}`;
    if (!line || line.startsWith('#')) return;
    if (line.startsWith('@')) {
      buch = line.slice(1).trim();
      if (!verse[buch]) fehler.push(`${wo}: unbekanntes Buch ${buch}`);
      if (perikopen[buch]) fehler.push(`${wo}: Buch ${buch} doppelt`);
      perikopen[buch] = [];
      return;
    }
    const m = line.match(/^(=\s*)?(\d+)(?:,(\d+))?\s+(.+)$/);
    if (!m || !buch) { fehler.push(`${wo}: nicht lesbar: ${line}`); return; }
    perikopen[buch].push({ teil: !!m[1], kapitel: +m[2], vers: m[3] ? +m[3] : 1, titel: m[4].trim(), wo });
  });
}

const vorVers = (id, k, v) => (v > 1 ? { kapitel: k, vers: v - 1 } : { kapitel: k - 1, vers: verse[id][k - 2] });

function stelle(b, von, bis) {
  const vz = verse[b.id];
  const ganzVon = von.vers === 1;
  const ganzBis = bis.vers === vz[bis.kapitel - 1];
  let s;
  if (von.kapitel === bis.kapitel) {
    if (ganzVon && ganzBis) s = `${von.kapitel}`;
    else if (von.vers === bis.vers) s = `${von.kapitel},${von.vers}`;
    else s = `${von.kapitel},${von.vers}–${bis.vers}`;
  } else if (ganzVon && ganzBis) s = `${von.kapitel}–${bis.kapitel}`;
  else s = `${von.kapitel},${von.vers}–${bis.kapitel},${bis.vers}`;
  return `${b.abk} ${s}`;
}

function versZahl(id, von, bis) {
  if (von.kapitel === bis.kapitel) return bis.vers - von.vers + 1;
  let n = verse[id][von.kapitel - 1] - von.vers + 1;
  for (let k = von.kapitel + 1; k < bis.kapitel; k++) n += verse[id][k - 1];
  return n + bis.vers;
}

const ergebnis = [];
buecher.forEach((b, idx) => {
  const vz = verse[b.id];
  const eintraege = perikopen[b.id];
  if (!vz) { fehler.push(`${b.id}: keine Verszahlen`); return; }
  if (!eintraege || !eintraege.length) { fehler.push(`${b.id}: keine Perikopen`); return; }

  // Hauptteil-Zeilen markieren den Beginn eines Teils; sie müssen mit einem Abschnitt zusammenfallen.
  const abschnitte = [];
  const teilStarts = [];
  for (const e of eintraege) {
    if (e.kapitel < 1 || e.kapitel > vz.length || e.vers < 1 || e.vers > vz[e.kapitel - 1]) {
      fehler.push(`${e.wo}: ${b.id} ${e.kapitel},${e.vers} existiert nicht`);
      continue;
    }
    (e.teil ? teilStarts : abschnitte).push(e);
  }
  const pos = e => e.kapitel * 1000 + e.vers;
  for (const liste of [abschnitte, teilStarts]) {
    for (let i = 1; i < liste.length; i++) {
      if (pos(liste[i]) <= pos(liste[i - 1])) fehler.push(`${liste[i].wo}: Reihenfolge (${liste[i].kapitel},${liste[i].vers})`);
    }
    if (liste.length && pos(liste[0]) !== 1001) fehler.push(`${liste[0].wo}: ${b.id} beginnt nicht bei 1,1`);
  }
  if (!teilStarts.length) fehler.push(`${b.id}: keine Hauptteile`);
  const startSet = new Set(abschnitte.map(pos));
  for (const t of teilStarts) if (!startSet.has(pos(t))) fehler.push(`${t.wo}: Hauptteil ohne Abschnitt am selben Vers`);

  const ende = { kapitel: vz.length, vers: vz[vz.length - 1] };
  const mitBis = (liste) => liste.map((e, i) => {
    const von = { kapitel: e.kapitel, vers: e.vers };
    const bis = i + 1 < liste.length ? vorVers(b.id, liste[i + 1].kapitel, liste[i + 1].vers) : ende;
    return { titel: e.titel, von, bis, stelle: stelle(b, von, bis), verse: versZahl(b.id, von, bis) };
  });

  const peri = mitBis(abschnitte).map((p, i) => ({ nr: i + 1, ...p }));
  const teile = mitBis(teilStarts).map((t, i) => ({
    nr: i + 1,
    ...t,
    perikopen: peri.filter(p => pos(p.von) >= pos(t.von) && pos(p.von) <= pos(t.bis)),
  }));

  ergebnis.push({
    nr: idx + 1,
    id: b.id,
    name: b.name,
    alternativ: b.alternativ,
    abk: b.abk,
    testament: b.testament,
    gruppe: b.gruppe,
    kapitelanzahl: vz.length,
    versanzahl: vz.reduce((a, n) => a + n, 0),
    perikopenanzahl: peri.length,
    verse_je_kapitel: vz,
    teile,
  });
});
for (const id of Object.keys(perikopen)) if (!buecher.some(b => b.id === id)) fehler.push(`Perikopen für unbekanntes Buch ${id}`);

if (fehler.length) {
  console.error(fehler.join('\n'));
  console.error(`\n${fehler.length} Fehler – nichts geschrieben.`);
  process.exit(1);
}

const summe = (f) => ergebnis.reduce((a, b) => a + f(b), 0);
const statistik = {
  buecher: ergebnis.length,
  kapitel: summe(b => b.kapitelanzahl),
  verse: summe(b => b.versanzahl),
  hauptteile: summe(b => b.teile.length),
  perikopen: summe(b => b.perikopenanzahl),
  at: { buecher: 39, kapitel: 0, verse: 0 },
  nt: { buecher: 27, kapitel: 0, verse: 0 },
};
for (const b of ergebnis) {
  const t = b.testament === 'AT' ? statistik.at : statistik.nt;
  t.kapitel += b.kapitelanzahl;
  t.verse += b.versanzahl;
}

const json = {
  titel: 'Die Bibel – Bücher, Kapitel, Verse und Sinnabschnitte',
  uebersetzung: 'Schlachter 2000',
  versifikation:
    'Verszählung der Schlachter 2000 (hebräische Zählung im AT wie Luther/Elberfelder, mit den Ausnahmen 4Mo 25/26, 2Kö 15, 2Chr 1/2 und Apg 19, wo die Schlachter 2000 der englischen Zählung folgt)',
  hinweise: [
    'Kapitel- und Verszahlen: SWORD-Versifikation „German“ (CrossWire), alle 1.189 Kapitel gegen die Schlachter 2000 (bibleserver.com) geprüft und dort korrigiert, wo die Schlachter 2000 abweicht.',
    'Psalm-Überschriften zählen wie in der Schlachter 2000 als eigene Verse (z. B. Ps 51 hat 21 Verse).',
    'Hauptteile und Sinnabschnitte sind eine eigene Gliederung nach gängigen Abschnittsgrenzen; die Titel sind eigene Formulierungen und nicht die (urheberrechtlich geschützten) Zwischenüberschriften der Schlachter 2000.',
    'Jeder Abschnitt reicht lückenlos bis zum Vers vor dem nächsten Abschnitt.',
  ],
  statistik,
  buecher: ergebnis,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bibel-schlachter2000.json'), JSON.stringify(json, null, 2) + '\n');

// CSV: Semikolon, UTF-8 mit BOM, damit Excel Umlaute und Spalten richtig erkennt.
const zelle = (x) => {
  const s = x === null || x === undefined ? '' : String(x);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (datei, kopf, zeilen) =>
  fs.writeFileSync(path.join(OUT, datei), '﻿' + [kopf, ...zeilen].map(z => z.map(zelle).join(';')).join('\r\n') + '\r\n');

csv('buecher.csv',
  ['Nr', 'ID', 'Buch', 'Alternativname', 'Abkürzung', 'Testament', 'Gruppe', 'Kapitel', 'Verse', 'Hauptteile', 'Perikopen'],
  ergebnis.map(b => [b.nr, b.id, b.name, b.alternativ, b.abk, b.testament, b.gruppe, b.kapitelanzahl, b.versanzahl, b.teile.length, b.perikopenanzahl]));

csv('kapitel.csv',
  ['Buch-Nr', 'Buch', 'Abkürzung', 'Kapitel', 'Verse'],
  ergebnis.flatMap(b => b.verse_je_kapitel.map((n, i) => [b.nr, b.name, b.abk, i + 1, n])));

let lfd = 0;
csv('perikopen.csv',
  ['Lfd', 'Buch-Nr', 'Buch', 'Abkürzung', 'Teil-Nr', 'Hauptteil', 'Nr', 'Von Kapitel', 'Von Vers', 'Bis Kapitel', 'Bis Vers', 'Verse', 'Stelle', 'Titel'],
  ergebnis.flatMap(b => b.teile.flatMap(t => t.perikopen.map(p =>
    [++lfd, b.nr, b.name, b.abk, t.nr, t.titel, p.nr, p.von.kapitel, p.von.vers, p.bis.kapitel, p.bis.vers, p.verse, p.stelle, p.titel]))));

console.log(`OK: ${statistik.buecher} Bücher, ${statistik.kapitel} Kapitel, ${statistik.verse} Verse, ${statistik.hauptteile} Hauptteile, ${statistik.perikopen} Perikopen`);
