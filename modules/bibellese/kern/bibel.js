// Die Bibel als Zahlen: Bücher, Verse je Kapitel, Beginn der Hauptteile und Sinnabschnitte.
// Läuft im Browser (Modul) und im Dienst (Node) gleich; die Daten kommen aus daten/bibel.json.

/** Buch-Index mit Versversatz je Kapitel, damit eine Stelle eine laufende Versnummer bekommt. */
export function ladeBibel(daten) {
  const buecher = daten.buecher.map((b, index) => {
    const versatz = [0];
    for (const n of b.verse) versatz.push(versatz.at(-1) + n);
    const pos = ([k, v]) => versatz[k - 1] + v - 1;
    return {
      ...b,
      index,
      kapitel: b.verse.length,
      versGesamt: versatz.at(-1),
      versatz,
      pos,
      teilStarts: new Set(b.teile.map(pos)),
      abschnittStarts: new Set(b.abschnitte.map(pos)),
      /** Laufende Versnummer (0-basiert) → [Kapitel, Vers] */
      zuStelle(p) {
        let k = 1;
        while (versatz[k] <= p) k++;
        return [k, p - versatz[k - 1] + 1];
      },
    };
  });
  const nachId = Object.fromEntries(buecher.map((b) => [b.id, b]));
  return {
    buecher,
    gruppen: daten.gruppen,
    parallelen: daten.parallelen,
    buch: (id) => {
      const b = nachId[id];
      if (!b) throw new Error(`Unbekanntes Buch: ${id}`);
      return b;
    },
    hat: (id) => Boolean(nachId[id]),
    kapitelGesamt: buecher.reduce((s, b) => s + b.kapitel, 0),
    versGesamt: buecher.reduce((s, b) => s + b.versGesamt, 0),
  };
}

/** Weisheitsliteratur (LESEPLAN.md §1). */
export const WEISHEIT = ['Job', 'Ps', 'Prov', 'Eccl', 'Song'];

/** Bücher einer Auswahl in kanonischer Reihenfolge: 'bibel', 'at', 'nt', 'gruppe:<id>' oder eine Liste. */
export function buecherDerAuswahl(bibel, auswahl, ohne = []) {
  let liste;
  if (Array.isArray(auswahl)) liste = bibel.buecher.filter((b) => auswahl.includes(b.id));
  else if (auswahl === 'bibel') liste = bibel.buecher;
  else if (auswahl === 'at') liste = bibel.buecher.filter((b) => b.testament === 'AT');
  else if (auswahl === 'nt') liste = bibel.buecher.filter((b) => b.testament === 'NT');
  else if (typeof auswahl === 'string' && auswahl.startsWith('gruppe:')) {
    const g = auswahl.slice(7);
    liste = bibel.buecher.filter((b) => b.gruppe === g);
  } else throw new Error(`Unbekannte Auswahl: ${auswahl}`);
  return liste.filter((b) => !ohne.includes(b.id));
}
