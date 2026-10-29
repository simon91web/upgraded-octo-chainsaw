// Mockup-Daten und Leselogik für Bibellese. Alles hier ist Beispiel: Pläne werden aus der
// Buchtabelle erzeugt, das Logbuch aus einem festen Zufallsstrom. Die Rechenwege (Lesezeichen,
// Ziel, Verzug, Prognose, Fortschritt) sind dieselben, die das Modul später im Dienst nutzt.
// Der Plan-Erzeuger hier ist eine Vereinfachung des Rechenkerns aus LESEPLAN.md §8: er teilt
// nach Kapiteln und schätzt Minuten aus Verszahlen, statt Sinnabschnitte und Wortzahlen zu nutzen.

// Bücher nach Schlachter 2000: IDs, Namen, Abkürzungen, Kapitel, Verse und Gruppen wie in
// daten/buecher.csv. Das Modul liest später diese Datei.
export const BUECHER = [
  // Altes Testament
  ['Gen', '1. Mose', '1Mo', 50, 'gesetz'], ['Exod', '2. Mose', '2Mo', 40, 'gesetz'],
  ['Lev', '3. Mose', '3Mo', 27, 'gesetz'], ['Num', '4. Mose', '4Mo', 36, 'gesetz'],
  ['Deut', '5. Mose', '5Mo', 34, 'gesetz'],
  ['Josh', 'Josua', 'Jos', 24, 'gesch'], ['Judg', 'Richter', 'Ri', 21, 'gesch'],
  ['Ruth', 'Ruth', 'Rt', 4, 'gesch'], ['1Sam', '1. Samuel', '1Sam', 31, 'gesch'],
  ['2Sam', '2. Samuel', '2Sam', 24, 'gesch'], ['1Kgs', '1. Könige', '1Kö', 22, 'gesch'],
  ['2Kgs', '2. Könige', '2Kö', 25, 'gesch'], ['1Chr', '1. Chronik', '1Chr', 29, 'gesch'],
  ['2Chr', '2. Chronik', '2Chr', 36, 'gesch'], ['Ezra', 'Esra', 'Esr', 10, 'gesch'],
  ['Neh', 'Nehemia', 'Neh', 13, 'gesch'], ['Esth', 'Esther', 'Est', 10, 'gesch'],
  ['Job', 'Hiob', 'Hi', 42, 'poet'], ['Ps', 'Psalmen', 'Ps', 150, 'poet', 'Psalm'],
  ['Prov', 'Sprüche', 'Spr', 31, 'poet'], ['Eccl', 'Prediger', 'Pred', 12, 'poet'],
  ['Song', 'Hohelied', 'Hld', 8, 'poet'],
  ['Isa', 'Jesaja', 'Jes', 66, 'gross'], ['Jer', 'Jeremia', 'Jer', 52, 'gross'],
  ['Lam', 'Klagelieder', 'Kla', 5, 'gross'], ['Ezek', 'Hesekiel', 'Hes', 48, 'gross'],
  ['Dan', 'Daniel', 'Dan', 12, 'gross'],
  ['Hos', 'Hosea', 'Hos', 14, 'klein'], ['Joel', 'Joel', 'Joel', 4, 'klein'],
  ['Amos', 'Amos', 'Am', 9, 'klein'], ['Obad', 'Obadja', 'Ob', 1, 'klein'],
  ['Jonah', 'Jona', 'Jon', 4, 'klein'], ['Mic', 'Micha', 'Mi', 7, 'klein'],
  ['Nah', 'Nahum', 'Nah', 3, 'klein'], ['Hab', 'Habakuk', 'Hab', 3, 'klein'],
  ['Zeph', 'Zephanja', 'Zeph', 3, 'klein'], ['Hag', 'Haggai', 'Hag', 2, 'klein'],
  ['Zech', 'Sacharja', 'Sach', 14, 'klein'], ['Mal', 'Maleachi', 'Mal', 3, 'klein'],
  // Neues Testament
  ['Matt', 'Matthäus', 'Mt', 28, 'evang'], ['Mark', 'Markus', 'Mk', 16, 'evang'],
  ['Luke', 'Lukas', 'Lk', 24, 'evang'], ['John', 'Johannes', 'Joh', 21, 'evang'],
  ['Acts', 'Apostelgeschichte', 'Apg', 28, 'apg'],
  ['Rom', 'Römer', 'Röm', 16, 'paulus'], ['1Cor', '1. Korinther', '1Kor', 16, 'paulus'],
  ['2Cor', '2. Korinther', '2Kor', 13, 'paulus'], ['Gal', 'Galater', 'Gal', 6, 'paulus'],
  ['Eph', 'Epheser', 'Eph', 6, 'paulus'], ['Phil', 'Philipper', 'Phil', 4, 'paulus'],
  ['Col', 'Kolosser', 'Kol', 4, 'paulus'], ['1Thess', '1. Thessalonicher', '1Th', 5, 'paulus'],
  ['2Thess', '2. Thessalonicher', '2Th', 3, 'paulus'], ['1Tim', '1. Timotheus', '1Tim', 6, 'paulus'],
  ['2Tim', '2. Timotheus', '2Tim', 4, 'paulus'], ['Titus', 'Titus', 'Tit', 3, 'paulus'],
  ['Phlm', 'Philemon', 'Phim', 1, 'paulus'],
  ['Heb', 'Hebräer', 'Hebr', 13, 'allg'], ['Jas', 'Jakobus', 'Jak', 5, 'allg'],
  ['1Pet', '1. Petrus', '1Pt', 5, 'allg'], ['2Pet', '2. Petrus', '2Pt', 3, 'allg'],
  ['1John', '1. Johannes', '1Joh', 5, 'allg'], ['2John', '2. Johannes', '2Joh', 1, 'allg'],
  ['3John', '3. Johannes', '3Joh', 1, 'allg'], ['Jude', 'Judas', 'Jud', 1, 'allg'],
  ['Rev', 'Offenbarung', 'Offb', 22, 'offb'],
].map(([id, name, kurz, kapitel, gruppe, stelle], index) => ({
  id, name, kurz, kapitel, gruppe, stelle: stelle ?? name, index, testament: index < 39 ? 'AT' : 'NT',
}));

// Verse je Buch, Schlachter 2000 (daten/buecher.csv), zusammen 31.172.
const VERSE = {
  Gen: 1533, Exod: 1213, Lev: 859, Num: 1288, Deut: 959, Josh: 658, Judg: 618, Ruth: 85, '1Sam': 811,
  '2Sam': 695, '1Kgs': 817, '2Kgs': 720, '1Chr': 943, '2Chr': 822, Ezra: 280, Neh: 406, Esth: 167, Job: 1070,
  Ps: 2527, Prov: 915, Eccl: 222, Song: 117, Isa: 1291, Jer: 1364, Lam: 154, Ezek: 1273, Dan: 357, Hos: 197,
  Joel: 73, Amos: 146, Obad: 21, Jonah: 48, Mic: 105, Nah: 47, Hab: 56, Zeph: 53, Hag: 38, Zech: 211, Mal: 55,
  Matt: 1071, Mark: 678, Luke: 1151, John: 879, Acts: 1007, Rom: 433, '1Cor': 437, '2Cor': 256, Gal: 149,
  Eph: 155, Phil: 104, Col: 95, '1Thess': 89, '2Thess': 47, '1Tim': 113, '2Tim': 83, Titus: 46, Phlm: 25,
  Heb: 303, Jas: 108, '1Pet': 105, '2Pet': 61, '1John': 105, '2John': 13, '3John': 15, Jude: 25, Rev: 405,
};
for (const b of BUECHER) b.verse = VERSE[b.id];

export const GRUPPEN = [
  { id: 'gesetz', name: 'Gesetz (Pentateuch)', testament: 'AT' },
  { id: 'gesch', name: 'Geschichtsbücher', testament: 'AT' },
  { id: 'poet', name: 'Poetische Bücher', testament: 'AT' },
  { id: 'gross', name: 'Große Propheten', testament: 'AT' },
  { id: 'klein', name: 'Kleine Propheten', testament: 'AT' },
  { id: 'evang', name: 'Evangelien', testament: 'NT' },
  { id: 'apg', name: 'Geschichtsbuch', testament: 'NT' },
  { id: 'paulus', name: 'Paulusbriefe', testament: 'NT' },
  { id: 'allg', name: 'Allgemeine Briefe', testament: 'NT' },
  { id: 'offb', name: 'Prophetisches Buch', testament: 'NT' },
];

/** Weisheitsliteratur als eigener Strang (LESEPLAN.md §1). */
export const WEISHEIT = ['Job', 'Ps', 'Prov', 'Eccl', 'Song'];

export const BUCH = Object.fromEntries(BUECHER.map((b) => [b.id, b]));
export const KAPITEL_GESAMT = BUECHER.reduce((s, b) => s + b.kapitel, 0); // 1189
export const KAPITEL_AT = BUECHER.filter((b) => b.testament === 'AT').reduce((s, b) => s + b.kapitel, 0); // 929
export const KAPITEL_NT = KAPITEL_GESAMT - KAPITEL_AT; // 260

const kapitelVon = (buecher) => buecher.flatMap((b) => Array.from({ length: b.kapitel }, (_, i) => ({ b: b.id, k: i + 1 })));
const alleKapitel = (filter = () => true) => kapitelVon(BUECHER.filter(filter));

/** Teilt eine Kapitelfolge gleichmäßig auf n Einheiten auf. */
function aufteilen(kapitel, n) {
  return Array.from({ length: n }, (_, i) =>
    kapitel.slice(Math.floor((i * kapitel.length) / n), Math.floor(((i + 1) * kapitel.length) / n)));
}

/** „Psalm 8–9“, „2. Mose 40 · 3. Mose 1“, „Jesaja 40–41 · Johannes 3“ */
export function stelle(kapitel) {
  const teile = [];
  for (const { b, k } of kapitel) {
    const letzter = teile.at(-1);
    if (letzter && letzter.b === b && letzter.bis === k - 1) letzter.bis = k;
    else teile.push({ b, von: k, bis: k });
  }
  return teile.map(({ b, von, bis }) =>
    `${BUCH[b].stelle} ${von}${bis > von ? `–${bis}` : ''}`).join(' · ');
}

// ---------------------------------------------------------------- Lesezeit
// Bis quellen/wortzahlen.txt da ist: Verse je Kapitel im Buchmittel × Wörter je Vers.
// 23 Wörter je Vers ergibt für die ganze Bibel still gelesen rund 60 Stunden (LESEPLAN.md §5).

export const WOERTER_JE_VERS = 23;
export const LESARTEN = [
  { id: 'still', name: 'Still', wpm: 200 },
  { id: 'langsam', name: 'Langsam', wpm: 150 },
  { id: 'vorlesen', name: 'Vorlesen', wpm: 130 },
];
export const minutenKapitel = ({ b }, wpm) => (BUCH[b].verse / BUCH[b].kapitel) * WOERTER_JE_VERS / wpm;
export const minuten = (kapitel, wpm) => kapitel.reduce((s, k) => s + minutenKapitel(k, wpm), 0);

// ---------------------------------------------------------------- Datum

export const HEUTE = new Date(2026, 9, 29); // Do, 29.10.2026
export const tag = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const datum = (t) => { const [y, m, d] = t.split('-').map(Number); return new Date(y, m - 1, d); };
const tageZwischen = (a, b) => Math.round((b - a) / 86400000);

export const RHYTHMEN = [
  { id: 'taeglich', name: 'Täglich', tage: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'mo-sa', name: 'Mo–Sa', tage: [1, 2, 3, 4, 5, 6] },
  { id: 'werktags', name: 'Mo–Fr', tage: [1, 2, 3, 4, 5] },
  { id: 'frei', name: 'Ohne festen Rhythmus', tage: null },
];

export const lesetage = (tempo, von, bis) => {
  let n = 0;
  for (let d = new Date(von); d <= bis; d = plusTage(d, 1)) if (tempo.tage.includes(d.getDay())) n++;
  return n;
};

/** Der n-te Lesetag ab `von` (von selbst zählt mit, wenn es ein Lesetag ist). */
export function nterLesetag(tempo, von, n) {
  let d = plusTage(von, -1);
  for (let offen = n; offen > 0;) {
    d = plusTage(d, 1);
    if (tempo.tage.includes(d.getDay())) offen -= tempo.jeTag;
  }
  return d;
}

// ---------------------------------------------------------------- Familie

export const FAMILIE = [
  { id: 'paul', name: 'Paul', farbe: '#2563EB' },
  { id: 'maria', name: 'Maria', farbe: '#CE2A63' },
  { id: 'lea', name: 'Lea', farbe: '#C2410C' },
  { id: 'jonas', name: 'Jonas', farbe: '#157F3D' },
];
export const ICH = FAMILIE[0];
export const PERSON = Object.fromEntries(FAMILIE.map((p) => [p.id, p]));

// ---------------------------------------------------------------- Beispiel-Logbuch

function zufall(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Erzeugt Lesungen von `start` bis gestern. `muster(datum, rnd, rueckstand)` gibt zurück, wie viele
 * Einheiten an dem Tag gelesen wurden (0, 1, 2).
 */
function logbuch({ abo, person, start, einheiten, muster, zeit, dabei, seed }) {
  const rnd = zufall(seed);
  const lesungen = [];
  let nr = 0;
  let rueckstand = 0;
  for (let d = new Date(start); d < HEUTE && nr < einheiten.length; d = plusTage(d, 1)) {
    const anzahl = muster(d, rnd, rueckstand);
    rueckstand += 1 - anzahl;
    let [h, m] = zeit(d, rnd);
    for (let i = 0; i < anzahl && nr < einheiten.length; i++) {
      lesungen.push({
        id: `${abo}-${nr}`, abo, person, quelle: 'plan', einheit: nr + 1, datum: tag(d),
        uhrzeit: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
        kapitel: einheiten[nr], dabei: dabei?.(d, rnd) ?? null, notiz: '',
      });
      nr++;
      m += 9 + Math.floor(rnd() * 6);
      if (m >= 60) { h++; m -= 60; }
    }
  }
  return lesungen;
}

const EINHEITEN_FAMILIE = aufteilen(alleKapitel(), 730);
const EINHEITEN_ICH = (() => {
  const at = aufteilen(alleKapitel((b) => b.testament === 'AT'), 365);
  const nt = aufteilen(alleKapitel((b) => b.testament === 'NT'), 365);
  return at.map((teil, i) => [...teil, ...nt[i]]);
})();
const EINHEITEN_JOHANNES = aufteilen(alleKapitel((b) => b.id === 'John'), 21);
const EINHEITEN_LEA = aufteilen(alleKapitel((b) => b.id === 'Ps'), 75);

const OKT_FAMILIE = { 6: 0, 7: 2, 13: 0, 14: 2, 21: 0, 25: 0, 27: 0 };

const familienLesungen = logbuch({
  abo: 'familie',
  person: 'paul',
  start: new Date(2026, 0, 1),
  einheiten: EINHEITEN_FAMILIE,
  seed: 7,
  muster(d, rnd, rueckstand) {
    if (d.getMonth() === 9) return OKT_FAMILIE[d.getDate()] ?? 1;
    if (d.getMonth() === 8 && d.getDate() >= 25) return rueckstand > 0 ? 2 : 1; // bis Ende September aufgeholt
    if (rnd() < 0.09) return 0;
    if (rueckstand > 0 && rnd() < 0.4) return 2;
    return 1;
  },
  zeit(d, rnd) {
    const wochenende = d.getDay() === 0 || d.getDay() === 6;
    return wochenende && rnd() < 0.6 ? [9, Math.floor(rnd() * 40)] : [19, 5 + Math.floor(rnd() * 45)];
  },
  dabei(d, rnd) {
    const r = rnd();
    if (r < 0.12) return ['paul', 'maria', 'lea'];
    if (r < 0.2) return ['maria', 'lea', 'jonas'];
    return FAMILIE.map((p) => p.id);
  },
});
familienLesungen.find((l) => l.datum === '2026-10-26').notiz = 'Lea hat das Gebet übernommen.';
familienLesungen.find((l) => l.datum === '2026-10-19').notiz = 'Jonas wollte wissen, warum Hiob nicht aufgibt.';

const OKT_ICH = { 3: 0, 4: 2, 18: 0, 19: 2 };
const SEP_ICH = { 12: 0, 13: 2 };

const eigeneLesungen = logbuch({
  abo: 'ich',
  person: 'paul',
  start: new Date(2026, 8, 1),
  einheiten: EINHEITEN_ICH,
  seed: 11,
  muster(d) {
    const tabelle = d.getMonth() === 9 ? OKT_ICH : SEP_ICH;
    return tabelle[d.getDate()] ?? 1;
  },
  zeit(d, rnd) { return [6, 20 + Math.floor(rnd() * 35)]; },
});

const johannesLesungen = logbuch({
  abo: 'johannes',
  person: 'paul',
  start: new Date(2026, 9, 20),
  einheiten: EINHEITEN_JOHANNES,
  seed: 5,
  muster(d) { return d.getDay() === 0 || d.getDay() === 6 || d.getDate() === 27 ? 0 : 1; },
  zeit(d, rnd) { return [21, 30 + Math.floor(rnd() * 20)]; },
});

const leaLesungen = logbuch({
  abo: 'lea',
  person: 'lea',
  start: new Date(2026, 8, 1),
  einheiten: EINHEITEN_LEA,
  seed: 3,
  muster(d, rnd) { return rnd() < 0.15 ? 0 : 1; },
  zeit(d, rnd) { return [20, 40 + Math.floor(rnd() * 15)]; },
});

/** Freie Einträge gehören zur Person, nicht zu einem Plan. */
export const FREIE = [
  { datum: '2026-10-22', uhrzeit: '21:40', kapitel: [{ b: 'John', k: 15 }], notiz: 'Bleibt in mir – für den Hauskreis vorbereitet.' },
  { datum: '2026-10-18', uhrzeit: '15:10', kapitel: [{ b: 'Rom', k: 8 }], notiz: 'V. 28 mit Lea besprochen.' },
  { datum: '2026-10-09', uhrzeit: '22:05', kapitel: [{ b: 'Ps', k: 23 }], notiz: '' },
  { datum: '2026-09-27', uhrzeit: '20:30', kapitel: [{ b: 'Phil', k: 1 }, { b: 'Phil', k: 2 }, { b: 'Phil', k: 3 }, { b: 'Phil', k: 4 }], notiz: 'Den ganzen Brief auf einmal.' },
].map((l, i) => ({ ...l, id: `frei-${i}`, abo: null, person: 'paul', quelle: 'frei', einheit: null, dabei: null }));

// ---------------------------------------------------------------- Pläne
// Jedes Mitglied legt beliebig viele Pläne an (LESEPLAN.md §7): privat, sichtbar oder gemeinsam.
// Jeder Plan hat genau ein Lesezeichen und seine eigenen Einheiten (fester Stand, `version`).
// Das Ziel wird beim Start aus Einheiten und Tempo gesetzt und ändert sich danach nur über
// „Ziel verschieben“ (Verlauf in `zielVerlauf`) oder bleibt bei „Neu einteilen“ stehen.

const tempo = (id) => ({ tage: RHYTHMEN.find((r) => r.id === id).tage, jeTag: 1 });

export const ABOS = {
  familie: {
    id: 'familie', name: 'Familienandacht', art: 'gemeinsam', besitzer: 'paul',
    rezept: 'Ganze Bibel · kanonisch · zwei Jahre · täglich', wpm: 130,
    begonnen: new Date(2026, 0, 1), tempo: tempo('taeglich'), einheiten: EINHEITEN_FAMILIE,
    durchgang: 1, version: 1, lesungen: familienLesungen, zielVerlauf: [],
  },
  ich: {
    id: 'ich', name: 'Bibel in einem Jahr', art: 'privat', besitzer: 'paul',
    rezept: 'AT und NT nebeneinander · ein Jahr · täglich', wpm: 200,
    begonnen: new Date(2026, 8, 1), tempo: tempo('taeglich'), einheiten: EINHEITEN_ICH,
    durchgang: 1, version: 1, lesungen: eigeneLesungen, zielVerlauf: [],
  },
  johannes: {
    id: 'johannes', name: 'Johannes', art: 'sichtbar', besitzer: 'paul',
    rezept: 'Johannes · ein Kapitel je Lesung · Mo–Fr', wpm: 150,
    begonnen: new Date(2026, 9, 20), tempo: tempo('werktags'), einheiten: EINHEITEN_JOHANNES,
    durchgang: 1, version: 1, lesungen: johannesLesungen, zielVerlauf: [],
  },
  lea: {
    id: 'lea', name: 'Psalmen im Herbst', art: 'sichtbar', besitzer: 'lea',
    rezept: 'Psalmen · zwei je Lesung · täglich', wpm: 150,
    begonnen: new Date(2026, 8, 1), tempo: tempo('taeglich'), einheiten: EINHEITEN_LEA,
    durchgang: 1, version: 1, lesungen: leaLesungen, zielVerlauf: [],
  },
};
for (const abo of Object.values(ABOS)) abo.ziel = nterLesetag(abo.tempo, abo.begonnen, abo.einheiten.length);

// ---------------------------------------------------------------- Rechenwege

/** Bis zu so vielen Einheiten Rückstand zeigt das Modul nur das Ziel, ohne Warnfarbe. */
export const PUFFER = 2;

/**
 * Lesezeichen, Ziel, Verzug, Prognose.
 *
 *   Rest     = Einheiten im Plan − gelesene
 *   Vorrat   = Lesetage von heute bis zum Ziel × Einheiten je Tag (ab morgen, wenn heute gelesen)
 *   Abstand  = Rest − Vorrat   (> 0 Verzug, < 0 Vorsprung)
 *
 * Die erste Einheit eines Tages ist die von heute; erst jede weitere baut Verzug ab.
 * Ohne festen Rhythmus gibt es weder Ziel noch Verzug (LESEPLAN.md §6).
 */
export function stand(abo) {
  const anzahl = abo.einheiten.length;
  const planLesungen = abo.lesungen.filter((l) => l.quelle === 'plan' && !l.geloescht);
  const gelesen = planLesungen.length;
  const heuteGelesen = planLesungen.some((l) => l.datum === tag(HEUTE));
  const rest = anzahl - gelesen;
  const ab = heuteGelesen ? plusTage(HEUTE, 1) : HEUTE;
  const ntAb = abo.einheiten.findIndex((e) => e.some((k) => BUCH[k.b].testament === 'NT')) + 1;
  const basis = {
    anzahl, gelesen, rest, heuteGelesen, ntAb,
    naechste: gelesen < anzahl ? { nr: gelesen + 1, kapitel: abo.einheiten[gelesen] } : null,
    danach: abo.einheiten.slice(gelesen + 1, gelesen + 5).map((kapitel, i) => ({ nr: gelesen + 2 + i, kapitel })),
    minutenNaechste: gelesen < anzahl ? minuten(abo.einheiten[gelesen], abo.wpm) : 0,
  };
  if (!abo.tempo.tage) {
    return { ...basis, ohneRhythmus: true, verzug: 0, vorsprung: 0, ziel: null, ende: null, zielUrspruenglich: null };
  }
  const vorrat = abo.ziel >= ab ? lesetage(abo.tempo, ab, abo.ziel) * abo.tempo.jeTag : 0;
  const abstand = rest - vorrat;
  const verzug = Math.max(0, abstand);
  return {
    ...basis,
    vorrat,
    verzug,
    vorsprung: Math.max(0, -abstand),
    ende: rest > 0 ? nterLesetag(abo.tempo, ab, rest) : null,
    // Aufholen: an jedem Lesetag ab heute eine Einheit mehr. Der Tag, an dem der Verzug 0 ist.
    wiederImPlan: verzug > 0 ? nterLesetag({ ...abo.tempo, jeTag: 1 }, HEUTE, verzug) : null,
    // Groß ist ein Verzug, den man in zwei Wochen nur mit mehr als einer Einheit extra je Tag aufholt.
    grosserVerzug: verzug > lesetage(abo.tempo, HEUTE, plusTage(HEUTE, 13)),
    ziel: abo.ziel,
    zielUrspruenglich: abo.zielVerlauf[0]?.von ?? abo.ziel,
    imPuffer: verzug > 0 && verzug <= PUFFER,
  };
}

/** Was ein neues Ziel bewirken würde, ohne es zu setzen (Vorschau im Blatt „Ziel verschieben“). */
export function mitZiel(abo, ziel) {
  return stand({ ...abo, ziel });
}

/** Teilt Kapitel nach Minuten auf n Einheiten auf (Grenzen dort, wo die Summe ein n-tel erreicht). */
function nachMinuten(kapitel, n, wpm) {
  const gesamt = minuten(kapitel, wpm);
  const teile = Array.from({ length: n }, () => []);
  let summe = 0;
  for (const k of kapitel) {
    const m = minutenKapitel(k, wpm);
    const i = Math.min(n - 1, Math.floor(((summe + m / 2) / gesamt) * n));
    teile[i].push(k);
    summe += m;
  }
  return teile;
}

/**
 * „Neu einteilen“ (LESEPLAN.md §6/§9): der Rest ab dem Lesezeichen wird auf die Lesetage bis zum
 * Ziel verteilt, die Lesungen werden dadurch etwas länger. Gelesenes bleibt, die Version steigt.
 */
export function neuEinteilenVorschau(abo) {
  const st = stand(abo);
  const restKapitel = abo.einheiten.slice(st.gelesen).flat();
  const n = Math.min(st.vorrat ?? 0, restKapitel.length);
  const vorher = st.rest ? minuten(restKapitel, abo.wpm) / st.rest : 0;
  const nachher = n > 0 ? minuten(restKapitel, abo.wpm) / n : 0;
  return { moeglich: n > 0 && n < st.rest, n, vorher, nachher, restKapitel };
}

export function neuEinteilen(abo) {
  const v = neuEinteilenVorschau(abo);
  if (!v.moeglich) return null;
  const st = stand(abo);
  const alt = abo.einheiten;
  abo.einheiten = [...alt.slice(0, st.gelesen), ...nachMinuten(v.restKapitel, v.n, abo.wpm)];
  abo.version++;
  return () => { abo.einheiten = alt; abo.version--; };
}

// ---------------------------------------------------------------- Plan-Erzeuger (vereinfacht)

/** Bücher einer Auswahl in kanonischer Reihenfolge. */
export function buecherDerAuswahl(r) {
  if (r.auswahl === 'bibel') return BUECHER;
  if (r.auswahl === 'at') return BUECHER.filter((b) => b.testament === 'AT');
  if (r.auswahl === 'nt') return BUECHER.filter((b) => b.testament === 'NT');
  if (r.auswahl === 'gruppe') return BUECHER.filter((b) => b.gruppe === r.gruppe);
  return BUECHER.filter((b) => r.buecher.includes(b.id));
}

/**
 * Aus den Antworten des Assistenten die Einheiten erzeugen:
 * Bücher wählen → Weisheit als zweiter Strang → Ring drehen → nach Minuten einteilen.
 * Parallelen bündeln und Sinnabschnitte kann erst der echte Rechenkern (braucht daten/).
 */
export function erzeuge(r) {
  const auswahl = buecherDerAuswahl(r);
  const mitWeisheit = r.weisheit && ['bibel', 'at'].includes(r.auswahl);
  let haupt = mitWeisheit ? auswahl.filter((b) => !WEISHEIT.includes(b.id)) : auswahl;
  const neben = mitWeisheit ? auswahl.filter((b) => WEISHEIT.includes(b.id)) : [];
  const startIndex = haupt.findIndex((b) => b.id === r.start);
  if (startIndex > 0) haupt = [...haupt.slice(startIndex), ...haupt.slice(0, startIndex)];
  const k1 = kapitelVon(haupt);
  const k2 = kapitelVon(neben);
  const gesamt = minuten(k1, r.wpm) + minuten(k2, r.wpm);
  const rhythmus = RHYTHMEN.find((x) => x.id === r.rhythmus);
  const t = rhythmus.tage ? { tage: rhythmus.tage, jeTag: 1 } : null;
  let n;
  if (r.modus === 'datum' && t) n = Math.max(1, lesetage(t, r.beginn, r.bis));
  else n = Math.max(1, Math.round(gesamt / r.minuten));
  // Ein Kapitel wird nie geteilt: höchstens so viele Lesungen wie Kapitel im Hauptstrang.
  const begrenzt = n > k1.length;
  n = Math.min(n, k1.length);
  const s1 = nachMinuten(k1, n, r.wpm);
  const s2 = k2.length ? nachMinuten(k2, n, r.wpm) : [];
  const einheiten = s1.map((teil, i) => [...teil, ...(s2[i] ?? [])]);
  return {
    einheiten,
    n,
    begrenzt,
    minutenJe: gesamt / n,
    gesamt,
    kapitel: k1.length + k2.length,
    straenge: mitWeisheit ? 2 : 1,
    ende: t ? nterLesetag(t, r.beginn, n) : null,
    tempo: t ?? { tage: null, jeTag: 1 },
  };
}

// ---------------------------------------------------------------- Fortschritt, Statistik

/** Kapitel je Buch im laufenden Durchgang: { Gen: Map(kapitel -> 'plan'|'frei') } */
export function fortschritt(abo) {
  const proBuch = Object.fromEntries(BUECHER.map((b) => [b.id, new Map()]));
  for (const l of abo.lesungen) {
    if (l.geloescht) continue;
    for (const { b, k } of l.kapitel) {
      if (proBuch[b].get(k) !== 'plan') proBuch[b].set(k, l.quelle);
    }
  }
  const zaehle = (filter) => BUECHER.filter(filter).reduce((s, b) => s + proBuch[b.id].size, 0);
  return {
    proBuch,
    gesamt: zaehle(() => true),
    at: zaehle((b) => b.testament === 'AT'),
    nt: zaehle((b) => b.testament === 'NT'),
    gruppe: (g) => ({
      gelesen: zaehle((b) => b.gruppe === g),
      von: BUECHER.filter((b) => b.gruppe === g).reduce((s, b) => s + b.kapitel, 0),
    }),
  };
}

/** Das Buch, in dem das Lesezeichen gerade steht (erstes Buch der nächsten Einheit). */
export function aktuellesBuch(abo, st) {
  const k = st?.naechste?.kapitel[0] ?? [...abo.lesungen].sort((a, b) => a.datum.localeCompare(b.datum)).at(-1)?.kapitel[0];
  return k ? BUCH[k.b] : null;
}

/** Statistik über die gelesenen Tage. */
export function statistik(abo, { monat = HEUTE.getMonth(), jahr = HEUTE.getFullYear() } = {}) {
  const proTag = new Map();
  for (const l of abo.lesungen) {
    if (l.geloescht) continue;
    if (!proTag.has(l.datum)) proTag.set(l.datum, []);
    proTag.get(l.datum).push(l);
  }
  const imMonat = [...proTag.keys()].filter((t) => {
    const [y, m] = t.split('-').map(Number);
    return y === jahr && m === monat + 1;
  });
  // Im laufenden Monat zählt heute erst mit, wenn schon gelesen wurde.
  const tageImMonat = monat === HEUTE.getMonth() && jahr === HEUTE.getFullYear()
    ? HEUTE.getDate() - (proTag.has(tag(HEUTE)) ? 0 : 1) : new Date(jahr, monat + 1, 0).getDate();
  const achtWochen = [...proTag.keys()].filter((t) => {
    const d = datum(t);
    return d >= plusTage(HEUTE, -56) && d < HEUTE;
  }).length;
  const wochentage = [1, 2, 3, 4, 5, 6, 0].map((wd) => [...proTag.keys()].filter((t) => datum(t).getDay() === wd).length);
  const tageszeit = [
    ['Früh', 5, 9], ['Vormittag', 9, 12], ['Mittag', 12, 15], ['Nachmittag', 15, 18], ['Abend', 18, 22], ['Nacht', 22, 29],
  ].map(([name, von, bis]) => ({
    name,
    anzahl: abo.lesungen.filter((l) => {
      const h = Number(l.uhrzeit.slice(0, 2));
      return !l.geloescht && ((h >= von && h < bis) || (h + 24 >= von && h + 24 < bis));
    }).length,
  }));
  return {
    proTag,
    lesetageImMonat: imMonat.length,
    tageImMonat,
    jeWoche: achtWochen / 8,
    wochentage,
    tageszeit,
    meist: tageszeit.reduce((a, b) => (b.anzahl > a.anzahl ? b : a)),
    seitBeginn: abo.begonnen ? tageZwischen(abo.begonnen, HEUTE) : null,
  };
}
