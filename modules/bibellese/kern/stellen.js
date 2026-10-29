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
export function stueckText(bibel, s, { kurz = false, ohneName = false } = {}) {
  const buch = bibel.buch(s.b);
  const name = kurz ? buch.abk : buch.stelle;
  const mit = (stelle) => (ohneName ? stelle : `${name} ${stelle}`);
  const [k1, v1] = s.von;
  const [k2, v2] = s.bis;
  const ganzVon = v1 === 1;
  const ganzBis = v2 === buch.verse[k2 - 1];
  if (ganzVon && ganzBis) {
    if (buch.kapitel === 1) return buch.stelle === buch.name && !ohneName ? name : mit('1');
    return k1 === k2 ? mit(`${k1}`) : mit(`${k1}–${k2}`);
  }
  if (k1 === k2) return mit(`${k1},${v1}${v2 > v1 ? `–${v2}` : ''}`);
  return mit(`${k1},${v1}–${k2},${v2}`);
}

/**
 * Stücke als Text, jedes Buch einmal: „2. Chronik 36,22–23 · Nehemia 7,6–73“.
 * Parallelstellen liegen abschnittweise im Wechsel (1Kö 8,1–21, 2Chr 5,2–6,11, 1Kö 8,22–53 …).
 * Die Bücher stehen in der Reihenfolge ihres ersten Auftretens, die Stücke eines Buchs in
 * Bibelreihenfolge zusammengefasst; was nicht anschließt, folgt nach „;“.
 */
function buecherText(bibel, stuecke, opts) {
  const gruppen = new Map();
  for (const s of stuecke) {
    if (!gruppen.has(s.b)) gruppen.set(s.b, []);
    gruppen.get(s.b).push(s);
  }
  return [...gruppen.values()].map((liste) => {
    const buch = bibel.buch(liste[0].b);
    const sortiert = [...liste].sort((x, y) => buch.pos(x.von) - buch.pos(y.von));
    return verbinde(bibel, sortiert).map((s, i) => stueckText(bibel, s, { ...opts, ohneName: i > 0 })).join('; ');
  }).join(' · ');
}

/** Die Teile einer Einheit, in denen „Gelesen“ sie auseinanderhält. */
export const TEILE = ['haupt', 'zweit', 'dazu'];

/**
 * Teilt eine Einheit in Hauptstelle (Lesefaden), zweiten Strang (etwa die Weisheit neben dem
 * Lesefaden) und Parallelstellen. `zweit` sind die Bücher der weiteren Stränge (nebenBuecher);
 * ohne Angabe gehört alles außer den Parallelstellen zur Hauptstelle.
 * → { haupt: { stuecke, text }, zweit: { … } | null, dazu: { … } | null }
 */
export function einheitTeile(bibel, stuecke, { zweit = null, ...opts } = {}) {
  const art = (s) => (s.parallel ? 'dazu' : zweit?.has(s.b) ? 'zweit' : 'haupt');
  const teile = Object.fromEntries(TEILE.map((t) => [t, stuecke.filter((s) => art(s) === t)]));
  // Ohne Lesefaden (etwa nach dem Neueinteilen am Ende) rückt der zweite Strang nach vorn.
  if (!teile.haupt.length) [teile.haupt, teile.zweit] = [teile.zweit, []];
  return Object.fromEntries(TEILE.map((t) => [t, teile[t].length ? { stuecke: teile[t], text: buecherText(bibel, teile[t], opts) } : null]));
}

/** Eine Einheit als Text: „1. Könige 8 · Psalm 30 · dazu 2. Chronik 5,2–7,10“. */
export function einheitText(bibel, stuecke, opts) {
  const t = einheitTeile(bibel, stuecke, opts);
  return [t.haupt?.text, t.zweit?.text, t.dazu && `dazu ${t.dazu.text}`].filter(Boolean).join(' · ');
}

/** Verse eines Stücks. */
export function verseVon(bibel, s) {
  const buch = bibel.buch(s.b);
  return buch.pos(s.bis) - buch.pos(s.von) + 1;
}
