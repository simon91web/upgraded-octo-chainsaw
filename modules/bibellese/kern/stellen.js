// Stellenangaben. Ein Stück ist { b, von: [k, v], bis: [k, v] }, innerhalb eines Buchs.

/** „Isa“, „Isa.40“, „Isa.40.3“ → { b, k, v } (k, v ab 1; ohne Angabe 1) */
export function leseStart(text) {
  const [b, k = '1', v = '1'] = String(text).split('.');
  return { b, k: Number(k), v: Number(v) };
}

/** Fasst aufeinanderfolgende Stücke desselben Buchs zusammen. */
export function verbinde(bibel, stuecke) {
  const aus = [];
  for (const s of stuecke) {
    const letztes = aus.at(-1);
    if (letztes && letztes.b === s.b && !letztes.parallel === !s.parallel) {
      const buch = bibel.buch(s.b);
      if (buch.pos(letztes.bis) + 1 === buch.pos(s.von)) {
        letztes.bis = s.bis;
        continue;
      }
    }
    aus.push({ ...s, von: [...s.von], bis: [...s.bis] });
  }
  return aus;
}

/**
 * „Psalm 8–9“, „1. Mose 1,1–2,3“, „Markus 4,1–34“, „Obadja“, „Jona 1–2“.
 * Ganze Kapitel ohne Verse, ein ganzes Buch mit einem Kapitel nur mit Namen.
 */
export function stueckText(bibel, s, { kurz = false } = {}) {
  const buch = bibel.buch(s.b);
  const name = kurz ? buch.abk : buch.stelle;
  const [k1, v1] = s.von;
  const [k2, v2] = s.bis;
  const ganzVon = v1 === 1;
  const ganzBis = v2 === buch.verse[k2 - 1];
  if (ganzVon && ganzBis) {
    if (buch.kapitel === 1) return buch.stelle === buch.name ? name : `${name} 1`;
    return k1 === k2 ? `${name} ${k1}` : `${name} ${k1}–${k2}`;
  }
  if (k1 === k2) return `${name} ${k1},${v1}${v2 > v1 ? `–${v2}` : ''}`;
  return `${name} ${k1},${v1}–${k2},${v2}`;
}

/** Eine Einheit als Text: „1. Könige 8 · dazu 2. Chronik 5,2–7,10 · Psalm 1“. */
export function einheitText(bibel, stuecke, opts) {
  return verbinde(bibel, stuecke)
    .map((s) => `${s.parallel ? 'dazu ' : ''}${stueckText(bibel, s, opts)}`)
    .join(' · ');
}

/** Verse eines Stücks. */
export function verseVon(bibel, s) {
  const buch = bibel.buch(s.b);
  return buch.pos(s.bis) - buch.pos(s.von) + 1;
}
