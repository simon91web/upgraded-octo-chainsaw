// Mockup Bibellese: zeichnet dieselbe Seite in den Laptop- und den Handy-Rahmen und die
// Dashboard-Kachel daneben. Zustand liegt nur im Speicher; Neuladen setzt alles zurück.
// Angemeldet ist Paul.

import {
  BUECHER, GRUPPEN, BUCH, KAPITEL_GESAMT, KAPITEL_AT, KAPITEL_NT, ABOS, FREIE, FAMILIE, PERSON, ICH, HEUTE, PUFFER,
  LESARTEN, RHYTHMEN, WEISHEIT, stelle, stand, mitZiel, neuEinteilen, neuEinteilenVorschau, erzeuge, buecherDerAuswahl,
  minuten, fortschritt, aktuellesBuch, statistik, tag, plusTage, datum, nterLesetag,
} from './bibellese-daten.js';

const S = {
  ansicht: 'beide', thema: 'light', szenario: 'normal',
  tab: 'heute',          // heute | plaene | fortschritt | logbuch | statistik
  filter: 'alle',        // Fortschritt, Logbuch, Statistik: 'alle' oder eine Plan-ID
  dabei: new Set(FAMILIE.map((p) => p.id)),
  monat: { j: HEUTE.getFullYear(), m: HEUTE.getMonth() },
  tagWahl: null,
  buch: null,
  ui: null,              // { art: 'menu'|'sheet', ort, was, wert, aboId, … }
  toast: null,           // { ort, text, undo, id }
  busy: null,            // Plan-ID, die gerade gespeichert wird
  gerade: {},            // je Plan: zuletzt heute abgehakt
  einst: { gemeinsamZaehlt: true, anlegen: 'alle' },
  saved: null,
  warteschlange: 0,
  assistent: null,       // Antworten des Assistenten „Neuer Leseplan“
};

// ------------------------------------------------------------------ Hilfen

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const NBSP = ' ';
const zahl = (n) => n.toLocaleString('de-DE');
const dezimal = (n) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const prozent = (a, b) => `${b ? Math.round((a / b) * 100) : 0}${NBSP}%`;
const anteil = (a, b) => (b ? Math.min(1, a / b) : 0);
const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WT2 = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MON3 = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const zwei = (n) => String(n).padStart(2, '0');
const fmtDatum = (d) => `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
const kurzDatum = (d) => `${WT2[d.getDay()]}., ${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear() === HEUTE.getFullYear() ? '' : d.getFullYear()}`;
function tagKopf(t) {
  if (t === tag(HEUTE)) return 'Heute';
  if (t === tag(plusTage(HEUTE, -1))) return 'Gestern';
  const d = datum(t);
  return `${WT[d.getDay()]}, ${d.getDate()}. ${MON[d.getMonth()]}`;
}
const einheiten = (n) => `${n}${NBSP}${n === 1 ? 'Einheit' : 'Einheiten'}`;
const lesungenText = (n) => `${zahl(n)}${NBSP}${n === 1 ? 'Lesung' : 'Lesungen'}`;
const min = (m) => `≈${NBSP}${m < 10 ? dezimal(m) : Math.round(m)}${NBSP}Min.`;
const sortiert = (lesungen) => lesungen.filter((l) => !l.geloescht)
  .sort((a, b) => (b.datum + b.uhrzeit).localeCompare(a.datum + a.uhrzeit));

const ART = {
  gemeinsam: { icon: 'users', name: 'Gemeinsam' },
  privat: { icon: 'lock', name: 'Nur für mich' },
  sichtbar: { icon: 'eye', name: 'Für mich, sichtbar' },
};

// ------------------------------------------------------------------ Pläne und Sichten

/** Pläne, die Paul liest: gemeinsame und eigene. Ohne eigene Pläne im Szenario „Ohne eigene Pläne“. */
function meinePlaene() {
  return Object.values(ABOS)
    .filter((a) => !a.geloescht && (a.art === 'gemeinsam' || a.besitzer === ICH.id))
    .filter((a) => !(S.szenario === 'ohnePlan' && a.art !== 'gemeinsam' && !a.neu))
    .sort((a, b) => (a.art === 'gemeinsam' ? 0 : 1) - (b.art === 'gemeinsam' ? 0 : 1) || a.begonnen - b.begonnen);
}
const vonAnderen = () => Object.values(ABOS).filter((a) => !a.geloescht && a.art === 'sichtbar' && a.besitzer !== ICH.id);
const istUebernommen = (abo) => Object.values(ABOS).some((a) => !a.geloescht && a.kopieVon === abo.id);

/** Ein Plan, wie die Ansicht ihn sieht (im Szenario „Großer Verzug“ fehlen der Familie drei Wochen). */
function planSicht(id) {
  const roh = ABOS[id];
  let abo = roh;
  if (id === 'familie' && S.szenario === 'grossVerzug') {
    abo = { ...roh, lesungen: roh.lesungen.filter((l) => !(l.datum >= '2026-10-06' && l.datum <= '2026-10-28')) };
  }
  const st = stand(abo);
  return { abo, st, fort: fortschritt(abo), buch: aktuellesBuch(abo, st), stat: statistik(abo, { monat: S.monat.m, jahr: S.monat.j }) };
}

/** „Alles von mir“: eigene Pläne, gemeinsame Pläne, bei denen ich dabei war, und freie Einträge. */
function alleSicht() {
  const lesungen = [];
  for (const a of meinePlaene()) {
    const { abo } = planSicht(a.id);
    for (const l of abo.lesungen) {
      if (a.art === 'gemeinsam' && l.quelle === 'plan' && !(S.einst.gemeinsamZaehlt && l.dabei?.includes(ICH.id))) continue;
      lesungen.push(l);
    }
  }
  lesungen.push(...FREIE);
  const abo = { id: 'alle', name: 'Alles von mir', lesungen, begonnen: new Date(2026, 0, 1) };
  return { abo, st: null, fort: fortschritt(abo), buch: aktuellesBuch(abo, null), stat: statistik(abo, { monat: S.monat.m, jahr: S.monat.j }), alle: true };
}

const sicht = (id = S.filter) => (id === 'alle' || !ABOS[id] ? alleSicht() : planSicht(id));
const ersterPlan = () => meinePlaene()[0]?.id;

// ------------------------------------------------------------------ Schale

const BRAND = `<svg class="brand-mark" viewBox="0 0 160 160" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="160" y2="160" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#8B5CF6"/><stop offset="100%" stop-color="#6C3AED"/></linearGradient></defs><rect width="160" height="160" rx="36" fill="url(#bm)"/><g fill="#fff" opacity=".93"><circle cx="64" cy="72" r="27"/><circle cx="100" cy="78" r="25"/><circle cx="80" cy="106" r="24"/></g></svg>`;

const NAV = [
  ['Übersicht', 'layout-grid', 'dashboard'],
  'Planen',
  ['Kalender', 'calendar', 'calendar'], ['Aufgaben', 'square-check', 'tasks'], ['Belohnungen', 'award', 'rewards'],
  ['Notizen', 'file-text', 'notes'], ['Schichtplan', 'briefcase', 'schedule'], ['Bibellese', 'book-open', 'bibellese'],
  'Haushalt',
  ['Küche', 'utensils', 'kitchen'], ['Haushaltshilfe', 'brush', 'housekeeping'], ['Entsorgung', 'trash-2', 'waste'],
  ['Dokumente', 'folder', 'documents'], ['Inventar', 'box', 'inventory'],
  'Menschen',
  ['Kontakte', 'contact', 'contacts'], ['Geburtstage', 'cake', 'birthdays'], ['Gesundheit', 'heart-pulse', 'health'],
  null,
  ['Budget', 'wallet', 'budget'],
];

function sidebar() {
  const items = NAV.map((n) => {
    if (n === null) return '<div style="height:8px"></div>';
    if (typeof n === 'string') return `<div class="sidebar__group">${n}</div>`;
    const [label, icon, mod] = n;
    const tone = mod === 'bibellese' ? 'var(--active-module-accent)' : `var(--module-${mod})`;
    return `<button class="nav-item" style="--nav-tone:${tone}"${mod === 'bibellese' ? ' aria-current="page"' : ''}>
      <span class="nav-item__well">${ic(icon)}</span>${label}</button>`;
  }).join('');
  return `<nav class="sidebar" aria-label="Hauptnavigation">
    <div class="sidebar__logo">${BRAND}<strong>Yuvomi</strong>
      <button class="sidebar__tool" aria-label="Suche">${ic('search')}</button>
      <button class="sidebar__tool" aria-label="Seitenleiste einklappen">${ic('panel-left-close')}</button></div>
    <div class="sidebar__items">${items}</div>
    <div class="sidebar__foot">
      <button class="nav-item" style="--nav-tone:var(--module-settings)"><span class="nav-item__well">${ic('settings')}</span>Einstellungen</button>
      <button class="nav-item"><span class="nav-avatar">P</span>Paul<span style="margin-left:auto;color:var(--color-text-tertiary);display:grid">${ic('chevrons-up-down')}</span></button>
    </div>
  </nav>`;
}

function bottomNav(ort) {
  const items = [['Übersicht', 'layout-grid', 'dashboard'], ['Kalender', 'calendar', 'calendar'], ['Aufgaben', 'square-check', 'tasks'], ['Küche', 'utensils', 'kitchen'], ['Mehr', 'ellipsis', null]];
  const offen = S.ui?.art === 'menu' && S.ui.was === 'neu' && S.ui.ort === ort;
  return `<nav class="bottom-nav" aria-label="Navigation">${items.map(([l, i, m]) =>
    `<button style="--nav-tone:${m ? `var(--module-${m})` : 'var(--color-text-primary)'}"${m ? '' : ' aria-current="page"'}>${ic(i)}${l}</button>`).join('')}</nav>
    <button class="fab" data-akt="menu" data-was="neu" data-wert="" aria-label="Neu" aria-expanded="${offen}">${ic(offen ? 'x' : 'plus')}</button>
    ${offen ? `<div class="fab-menu">${menu('neu', '')}</div>` : ''}`;
}

// ------------------------------------------------------------------ Kopf

function kopf(ort) {
  const neuOffen = S.ui?.art === 'menu' && S.ui.was === 'neu' && S.ui.ort === ort;
  const aktionen = ort === 'laptop'
    ? `<div class="page-actions">${menuAnker('kopf', '', 'Mehr')}
        <span class="menu-anchor"><button class="btn btn--primary" data-akt="menu" data-was="neu" data-wert="" aria-expanded="${neuOffen}">${ic('plus')}Neu</button>${neuOffen ? menu('neu', '') : ''}</span></div>`
    : '';
  return `<div class="page-head"><h1 class="page-title">Bibellese</h1>${aktionen}</div>`;
}

const TABS = [['heute', 'Heute'], ['plaene', 'Pläne'], ['fortschritt', 'Fortschritt'], ['logbuch', 'Logbuch'], ['statistik', 'Statistik']];
const reiter = () => `<div class="sub-tabs" role="tablist" aria-label="Ansicht">${TABS.map(([id, l]) =>
  `<button class="sub-tab" role="tab" aria-selected="${S.tab === id}" data-akt="tab" data-wert="${id}">${l}</button>`).join('')}</div>`;

function menuAnker(was, wert, label, klasse = 'btn btn--secondary btn--icon') {
  const offen = S.ui?.art === 'menu' && S.ui.was === was && S.ui.wert === wert;
  return `<span class="menu-anchor"><button class="${klasse}" data-akt="menu" data-was="${was}" data-wert="${esc(wert)}" aria-label="${label}" aria-expanded="${offen}">${ic('ellipsis')}</button>${offen ? menu(was, wert) : ''}</span>`;
}

function menu(was, wert) {
  let items = '';
  if (was === 'einheit') {
    const { st } = planSicht(wert);
    const a = `data-abo="${esc(wert)}"`;
    items = `<button data-akt="sheet" data-was="gelesenAm" ${a}>${ic('calendar-clock')}An einem anderen Tag gelesen …</button>
      <button data-akt="sheet" data-was="plan" ${a}>${ic('list')}Plan ansehen</button>
      ${st.verzug ? `<button data-akt="sheet" data-was="aufholen" ${a}>${ic('fast-forward')}Aufholen …</button>` : ''}
      ${st.ohneRhythmus ? '' : `<button data-akt="sheet" data-was="ziel" ${a}>${ic('calendar-range')}Ziel verschieben …</button>`}
      <hr><button data-akt="sheet" data-was="einstellungen">${ic('settings')}Einstellungen</button>`;
  } else if (was === 'kopf') {
    items = `<button data-akt="tab" data-wert="plaene">${ic('list')}Pläne verwalten</button>
      <button data-akt="sheet" data-was="einstellungen">${ic('settings')}Einstellungen</button>`;
  } else if (was === 'neu') {
    items = `<button data-akt="eintragen">${ic('pen-line')}Eintrag</button>
      <button data-akt="assistent">${ic('list-plus')}Leseplan</button>`;
  } else if (was === 'eintrag') {
    items = `<button data-akt="bearbeiten" data-wert="${esc(wert)}">${ic('pencil')}Bearbeiten</button>
      <hr><button class="danger" data-akt="loeschen" data-wert="${esc(wert)}">${ic('trash-2')}Löschen</button>`;
  }
  return `<div class="menu" role="menu">${items}</div>`;
}

// ------------------------------------------------------------------ Seite

function seite(ort) {
  const inhalt = { heute, plaene, fortschritt: fortschrittTab, logbuch, statistik: statistikTab }[S.tab](ort);
  const warn = S.szenario === 'fehler'
    ? `<div class="alert" role="status">${ic('cloud-off')}<p>Bibellese-Dienst nicht erreichbar – Einträge werden nachgetragen.</p>
        <button class="btn btn--secondary btn--sm" data-akt="erneut">${ic('refresh-cw')}Erneut versuchen</button></div>`
    : '';
  return `<div class="page-body">${warn}${inhalt}</div>`;
}

const spalten = (ort, main, rail) => (ort === 'laptop'
  ? `<div class="columns"><div class="col">${main}</div><div class="col">${rail}</div></div>`
  : `<div class="col">${main}${rail}</div>`);

/** Filter für Fortschritt, Logbuch und Statistik: alles von mir oder ein Plan. */
function filterLeiste() {
  const chips = [['alle', 'Alles von mir'], ...meinePlaene().map((a) => [a.id, a.name])];
  if (!chips.some(([id]) => id === S.filter)) S.filter = 'alle';
  return `<div class="chips" role="group" aria-label="Plan">${chips.map(([id, l]) =>
    `<button class="chip-filter" aria-pressed="${S.filter === id}" data-akt="filter" data-wert="${id}">${esc(l)}</button>`).join('')}</div>`;
}

// ------------------------------------------------------------------ Heute

function heute(ort) {
  const plaene = meinePlaene();
  const karten = plaene.map((a, i) => heuteKarte(planSicht(a.id), { primaer: i === 0 })).join('');
  const ohneEigene = !plaene.some((a) => a.art !== 'gemeinsam');
  const leer = ohneEigene ? `<section class="carrier">${leerPlan()}</section>` : '';
  const alle = alleSicht();
  if (ort === 'laptop') return spalten(ort, karten + leer, geradeDran(plaene, alle) + kalenderKarte(alle, ort));
  return spalten(ort, karten + leer + wocheKarte(alle), geradeDran(plaene, alle));
}

function leerPlan() {
  return `<div class="empty"><span class="empty__icon">${ic('book-open')}</span>
    <h3>Noch kein eigener Plan</h3>
    <p>Stell dir einen Plan zusammen oder trag ein, was du liest.</p>
    <div class="empty__actions"><button class="btn btn--secondary" data-akt="assistent">${ic('list-plus')}Plan erstellen</button>
    <button class="btn btn--secondary" data-akt="eintragen">Frei eintragen</button></div></div>`;
}

function heuteKarte(v, { primaer }) {
  const { st, abo } = v;
  if (!st.naechste) {
    return `<article class="card today"><div class="today__eyebrow">${ic(ART[abo.art].icon)}${esc(abo.name)}</div>
      <div class="today__ref">Fertig gelesen</div><div class="today__unit">${lesungenText(st.anzahl)}</div></article>`;
  }
  const fam = abo.art === 'gemeinsam';
  const gerade = S.gerade[abo.id];
  const busy = S.busy === abo.id;
  const aufholen = st.heuteGelesen && st.verzug > 0;
  const dabei = fam ? `<div class="today__dabei"><span class="today__dabei-label">Dabei</span><div class="avatars">${FAMILIE.map((p) =>
    `<button class="avatar" style="--av:${p.farbe}" aria-pressed="${S.dabei.has(p.id)}" data-akt="dabei" data-wert="${p.id}" aria-label="${p.name}" title="${p.name}">
      <span class="avatar__face">${p.name[0]}</span><span class="avatar__tick">${ic('check')}</span></button>`).join('')}</div></div>` : '';
  const knopf = `btn ${primaer ? 'btn--primary' : 'btn--secondary'}${busy ? ' btn--busy' : ''}`;
  return `<article class="card today${primaer ? '' : ' today--compact'}" aria-label="${esc(abo.name)}">
    <div class="today__eyebrow">${ic(ART[abo.art].icon)}${esc(abo.name)}
      ${menuAnker('einheit', abo.id, `Mehr zu ${esc(abo.name)}`, 'btn btn--ghost btn--icon')}</div>
    ${gerade ? `<div class="today__done"><span class="check-ring check-ring--done check-ring--sm">${ic('check')}</span>${esc(gerade.stelle)} gelesen · ${gerade.uhrzeit}</div>` : ''}
    <div class="today__ref">${stelle(st.naechste.kapitel)}</div>
    <div class="today__unit tabnum">Einheit ${st.naechste.nr} von ${zahl(st.anzahl)} · ${min(st.minutenNaechste)}${aufholen ? ' · zum Aufholen' : ''}</div>
    ${zielStatus(st, abo)}
    ${dabei}
    <div class="today__actions"><button class="${knopf}" data-akt="gelesen" data-abo="${abo.id}">${busy ? 'Wird gespeichert …' : `${ic('check')}Gelesen`}</button></div>
  </article>`;
}

/**
 * Ziel und Verzug. Bis PUFFER Einheiten Rückstand steht nur das Ziel da. Darüber in Warnfarbe,
 * mit den Auswegen; bei großem Verzug steht „Ziel verschieben“ vorn.
 */
function zielStatus(st, abo) {
  if (st.ohneRhythmus) return `<div class="today__meta"><span class="state">${ic('infinity')}Ohne festen Rhythmus</span></div>`;
  const ziel = fmtDatum(st.ziel);
  const a = `data-abo="${abo.id}"`;
  if (st.verzug > PUFFER) {
    const auswege = [
      `<button class="btn btn--ghost btn--sm" data-akt="sheet" data-was="aufholen" ${a}>${ic('fast-forward')}Aufholen</button>`,
      `<button class="btn btn--ghost btn--sm" data-akt="sheet" data-was="ziel" ${a}>${ic('calendar-range')}Ziel verschieben</button>`,
    ];
    if (st.grosserVerzug) auswege.reverse();
    return `<div class="today__meta"><span class="state state--warn">${ic('hourglass')}${einheiten(st.verzug)} im Verzug</span>
        <span>so wird es der ${fmtDatum(st.ende)}</span></div>
      <div class="today__fix">${auswege.join('')}</div>`;
  }
  if (st.verzug > 0) return `<div class="today__meta"><span class="state">${ic('flag')}Ziel ${ziel}</span></div>`;
  if (st.vorsprung > 0) {
    return `<div class="today__meta"><span class="state state--ok">${ic('check')}${einheiten(st.vorsprung)} Vorsprung</span><span>Ziel ${ziel}</span></div>`;
  }
  return `<div class="today__meta"><span class="state state--ok">${ic('check')}Im Plan</span><span>Ziel ${ziel}</span></div>`;
}

function kurzStatus(st) {
  if (st.ohneRhythmus) return ['', 'Ohne festen Rhythmus'];
  if (st.verzug > PUFFER) return ['state--warn', `${einheiten(st.verzug)} im Verzug`];
  if (st.verzug > 0) return ['', `Ziel ${fmtDatum(st.ziel)}`];
  if (st.vorsprung > 0) return ['state--ok', `${einheiten(st.vorsprung)} Vorsprung`];
  return ['state--ok', 'Im Plan'];
}

function geradeDran(plaene, alle) {
  const zeilen = plaene.map((a) => {
    const v = planSicht(a.id);
    const b = v.buch;
    if (!b) return '';
    const n = v.fort.proBuch[b.id].size;
    return `<div class="meter"><div class="meter__head"><b>${b.name}</b><span>${n} von ${b.kapitel}</span></div>
      <div class="bar"><span style="transform:scaleX(${anteil(n, b.kapitel)})"></span></div><div class="footnote">${esc(a.name)}</div></div>`;
  }).join('');
  return `<section class="carrier"><div class="stack">
      <h3 class="card-title" style="margin:0">Gerade dran</h3>${zeilen}
      <div class="meter meter--sum"><div class="meter__head"><b>Ganze Bibel</b><span>${zahl(alle.fort.gesamt)} von ${zahl(KAPITEL_GESAMT)} · ${prozent(alle.fort.gesamt, KAPITEL_GESAMT)}</span></div>
        <div class="bar"><span style="transform:scaleX(${anteil(alle.fort.gesamt, KAPITEL_GESAMT)})"></span></div><div class="footnote">Alles von mir</div></div>
    </div>
    <button class="row row--link row--sep" data-akt="tab" data-wert="fortschritt">Fortschritt${ic('chevron-right')}</button></section>`;
}

function wocheKarte(v) {
  const montag = plusTage(HEUTE, -((HEUTE.getDay() + 6) % 7));
  let gelesen = 0;
  let bisher = 0;
  const tage = Array.from({ length: 7 }, (_, i) => {
    const d = plusTage(montag, i);
    const t = tag(d);
    const n = v.stat.proTag.get(t)?.length ?? 0;
    const zukunft = d > HEUTE;
    const istHeute = t === tag(HEUTE);
    if (!zukunft && (!istHeute || n)) { bisher++; if (n) gelesen++; }
    return `<div class="week__day" data-tip="${kurzDatum(d)} · ${n ? (n === 1 ? '1 Eintrag' : `${n} Einträge`) : 'nichts eingetragen'}">${WT2[d.getDay()]}
      <span class="week__num${istHeute ? ' week__num--today' : ''}${zukunft ? ' week__num--future' : ''}">${d.getDate()}</span>
      <span class="dots dots--sm">${'<i></i>'.repeat(Math.min(4, n))}</span></div>`;
  }).join('');
  return `<section class="carrier"><div style="padding:16px">
    <h3 class="card-title">Diese Woche<small>an ${gelesen} von ${bisher} Tagen gelesen</small></h3>
    <div class="week">${tage}</div></div>
    <button class="row row--link row--sep" data-akt="tab" data-wert="logbuch">Logbuch${ic('chevron-right')}</button></section>`;
}

// ------------------------------------------------------------------ Pläne

function plaene(ort) {
  const zeile = (a) => {
    const { st } = planSicht(a.id);
    const [cls, text] = kurzStatus(st);
    const leute = a.art === 'gemeinsam' ? 'alle im Haushalt' : ART[a.art].name;
    return `<button class="row" data-akt="sheet" data-was="plan" data-abo="${a.id}">
      <span class="row__well">${ic(ART[a.art].icon)}</span>
      <div class="row__main"><span class="row__title">${esc(a.name)}</span>
        <span class="row__meta">${esc(a.rezept)}</span>
        <span class="row__meta tabnum">${leute} · Einheit ${Math.min(st.gelesen + 1, st.anzahl)} von ${zahl(st.anzahl)} · <span class="state ${cls}" style="font-size:13px">${text}</span></span>
        <div class="bar bar--thin"><span style="transform:scaleX(${anteil(st.gelesen, st.anzahl)})"></span></div></div>
      ${ic('chevron-right')}</button>`;
  };
  const gemeinsam = meinePlaene().filter((a) => a.art === 'gemeinsam');
  const eigene = meinePlaene().filter((a) => a.art !== 'gemeinsam');
  const andere = vonAnderen();
  const andereZeilen = andere.map((a) => {
    const { st } = planSicht(a.id);
    const fertig = istUebernommen(a);
    return `<div class="row"><span class="row__well">${ic('eye')}</span>
      <div class="row__main"><span class="row__title">${esc(a.name)}</span>
        <span class="row__meta">${PERSON[a.besitzer].name} · ${esc(a.rezept)} · ${lesungenText(st.anzahl)}</span></div>
      ${fertig ? `<span class="state state--ok" style="font-size:13px">${ic('check')}Übernommen</span>`
        : `<button class="btn btn--secondary btn--sm" data-akt="uebernehmen" data-abo="${a.id}">Übernehmen</button>`}</div>`;
  }).join('');
  const main = `
    <section class="section"><h2 class="section-title">Gemeinsam</h2><div class="carrier rows">${gemeinsam.map(zeile).join('')}</div></section>
    <section class="section"><h2 class="section-title">Für mich</h2>
      ${eigene.length ? `<div class="carrier rows">${eigene.map(zeile).join('')}</div>` : `<section class="carrier">${leerPlan()}</section>`}</section>
    ${andere.length ? `<section class="section"><h2 class="section-title">Von anderen</h2><div class="carrier rows">${andereZeilen}</div></section>` : ''}`;
  return ort === 'laptop' ? `<div class="columns"><div class="col">${main}</div><div class="col"></div></div>` : `<div class="col">${main}</div>`;
}

// ------------------------------------------------------------------ Kalender

function kalenderKarte(v, ort, { voll = false } = {}) {
  const { j, m } = S.monat;
  const erster = new Date(j, m, 1);
  const versatz = (erster.getDay() + 6) % 7;
  const tageImMonat = new Date(j, m + 1, 0).getDate();
  const zellen = [];
  for (let i = 0; i < versatz; i++) zellen.push('<span></span>');
  for (let d = 1; d <= tageImMonat; d++) {
    const dt = new Date(j, m, d);
    const t = tag(dt);
    const n = v.stat.proTag.get(t)?.length ?? 0;
    const zukunft = dt > HEUTE;
    const cls = ['cal__day', t === tag(HEUTE) && 'cal__day--today', S.tagWahl === t && 'cal__day--sel', zukunft && 'cal__day--future'].filter(Boolean).join(' ');
    const tip = `${kurzDatum(dt)} · ${n ? (n === 1 ? '1 Eintrag' : `${n} Einträge`) : 'nichts eingetragen'}`;
    zellen.push(zukunft
      ? `<span class="${cls}"><span class="cal__num">${d}</span></span>`
      : `<button class="${cls}" data-akt="tag" data-wert="${t}" data-tip="${tip}" aria-label="${tip}" aria-pressed="${S.tagWahl === t}">
          <span class="cal__num">${d}</span><span class="dots">${'<i></i>'.repeat(Math.min(4, n))}</span></button>`);
  }
  const aktuell = j === HEUTE.getFullYear() && m === HEUTE.getMonth();
  const s = v.stat;
  return `<section class="carrier"><div style="padding:16px">
    <div class="cal__head"><b>${MON[m]} ${j}</b>
      <button class="btn btn--ghost btn--icon" data-akt="monat" data-wert="-1" aria-label="Voriger Monat">${ic('chevron-left')}</button>
      <button class="btn btn--ghost btn--icon" data-akt="monat" data-wert="1" aria-label="Nächster Monat"${aktuell ? ' aria-disabled="true" title="Später als heute gibt es nichts"' : ''}>${ic('chevron-right')}</button></div>
    <div class="cal__grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="cal__wd">${w}</span>`).join('')}${zellen.join('')}</div>
    <div class="cal__foot"><span class="dots"><i></i></span>je Eintrag<span style="margin-left:auto" class="tabnum">an ${s.lesetageImMonat} von ${s.tageImMonat} Tagen</span></div></div>
    ${voll ? '' : `<button class="row row--link row--sep" data-akt="tab" data-wert="logbuch">Logbuch${ic('chevron-right')}</button>`}</section>`;
}

// ------------------------------------------------------------------ Fortschritt

function fortschrittTab(ort) {
  const v = sicht();
  const { fort, st } = v;
  const ntOffen = !v.alle && fort.nt === 0 && st?.ntAb && st.naechste
    ? `<div class="footnote">Beginnt mit Einheit ${st.ntAb} · voraussichtlich ${fmtDatum(plusTage(HEUTE, st.ntAb - st.naechste.nr + (st.heuteGelesen ? 1 : 0)))}</div>` : '';
  const herkunft = v.alle ? 'aus deinen Plänen und freien Einträgen' : `${v.abo.durchgang}. Durchgang seit ${fmtDatum(v.abo.begonnen)}`;
  const kopfKarte = `<section class="card" style="padding:20px">
    <div class="prog__big">${prozent(fort.gesamt, KAPITEL_GESAMT)}</div>
    <div class="prog__sub tabnum">${zahl(fort.gesamt)} von ${zahl(KAPITEL_GESAMT)} Kapiteln · ${herkunft}</div>
    <div class="bar bar--lg"><span style="transform:scaleX(${anteil(fort.gesamt, KAPITEL_GESAMT)})"></span></div>
    <div class="prog__rows">
      <div class="meter"><div class="meter__head"><b>Altes Testament</b><span>${fort.at} von ${KAPITEL_AT} · ${prozent(fort.at, KAPITEL_AT)}</span></div>
        <div class="bar"><span style="transform:scaleX(${anteil(fort.at, KAPITEL_AT)})"></span></div></div>
      <div class="meter"><div class="meter__head"><b>Neues Testament</b><span>${fort.nt} von ${KAPITEL_NT} · ${prozent(fort.nt, KAPITEL_NT)}</span></div>
        <div class="bar"><span style="transform:scaleX(${anteil(fort.nt, KAPITEL_NT)})"></span></div>${ntOffen}</div>
    </div></section>`;

  const gewaehlt = S.buch ?? v.buch?.id ?? 'Gen';
  const testament = (t) => `<section class="section"><h2 class="section-title">${t === 'AT' ? 'Altes Testament' : 'Neues Testament'}</h2>
    <div class="card">${GRUPPEN.filter((g) => g.testament === t).map((g) => {
      const gr = fort.gruppe(g.id);
      return `<div class="group"><h3 class="group__head">${g.name}<span>${prozent(gr.gelesen, gr.von)}</span></h3>
        <div class="tiles">${BUECHER.filter((b) => b.gruppe === g.id).map((b) => kachel(b, fort, v, gewaehlt, ort)).join('')}</div></div>`;
    }).join('')}</div></section>`;

  const main = filterLeiste() + kopfKarte + testament('AT') + testament('NT');
  if (ort === 'laptop') return spalten(ort, main, buchDetail(gewaehlt, v));
  return `<div class="col">${main}</div>`;
}

function kachel(b, fort, v, gewaehlt, ort) {
  const n = fort.proBuch[b.id].size;
  const fertig = n === b.kapitel;
  const jetzt = !v.alle && v.buch?.id === b.id && v.st?.naechste;
  const cls = ['tile', fertig && 'tile--done', jetzt && !fertig && 'tile--now'].filter(Boolean).join(' ');
  const tip = `${b.name} · ${n} von ${b.kapitel}${jetzt ? ' · gerade dran' : ''}`;
  return `<button class="${cls}" data-akt="buch" data-wert="${b.id}" data-tip="${tip}" aria-label="${tip}" aria-pressed="${ort === 'laptop' && gewaehlt === b.id}">
    ${b.kurz}<small>${fertig ? '100 %' : n ? prozent(n, b.kapitel) : NBSP}</small>
    ${!fertig && n ? `<span class="tile__bar"><span style="width:${anteil(n, b.kapitel) * 100}%"></span></span>` : ''}</button>`;
}

function buchDetail(id, v) {
  const b = BUCH[id];
  const gelesen = v.fort.proBuch[id];
  const naechste = new Set((v.st?.naechste?.kapitel ?? []).filter((k) => k.b === id).map((k) => k.k));
  const hatFrei = [...gelesen.values()].includes('frei');
  const kap = Array.from({ length: b.kapitel }, (_, i) => {
    const k = i + 1;
    const q = gelesen.get(k);
    const cls = naechste.has(k) ? 'chapter--next' : q === 'plan' ? 'chapter--plan' : q === 'frei' ? 'chapter--frei' : '';
    const tip = `${b.stelle} ${k}${naechste.has(k) ? ' · als Nächstes' : q === 'plan' ? ' · im Plan gelesen' : q === 'frei' ? ' · frei gelesen' : ''}`;
    return `<span class="chapter ${cls}" data-tip="${tip}">${k}</span>`;
  }).join('');
  return `<section class="card">
    <h3 class="card-title">${b.name}<small class="tabnum">${gelesen.size} von ${b.kapitel} · ${prozent(gelesen.size, b.kapitel)}</small></h3>
    <div class="chapters">${kap}</div>
    <div class="legend" style="margin-top:14px"><span><i style="background:var(--tone-fill)"></i>Gelesen</span>
      ${hatFrei ? '<span><i style="box-shadow:inset 0 0 0 2px var(--tone-fill)"></i>Frei gelesen</span>' : ''}
      ${naechste.size ? '<span><i style="box-shadow:inset 0 0 0 2px var(--color-accent)"></i>Als Nächstes</span>' : ''}
      <span><i style="background:var(--color-fill-well)"></i>Offen</span></div>
  </section>`;
}

// ------------------------------------------------------------------ Logbuch

function logbuch(ort) {
  const v = sicht();
  const { j, m } = S.monat;
  const prefix = `${j}-${zwei(m + 1)}`;
  const alle = sortiert(v.abo.lesungen).filter((l) => (S.tagWahl ? l.datum === S.tagWahl : l.datum.startsWith(prefix)));
  const filter = S.tagWahl
    ? `<div><button class="filter-chip" data-akt="tag-alle" aria-label="Filter aufheben">${tagKopf(S.tagWahl)}${ic('x')}</button></div>` : '';
  const liste = alle.length
    ? `<section class="section"><h2 class="section-title">Einträge<small class="tabnum">${alle.length}</small></h2>
        <div class="carrier rows">${alle.map((l, i) => zeile(l, i === 0 || alle[i - 1].datum !== l.datum, v.alle)).join('')}</div></section>`
    : `<section class="carrier"><div class="empty" style="padding:28px 20px"><span class="empty__icon">${ic('calendar-days')}</span>
        <h3>${S.tagWahl ? 'An diesem Tag nichts eingetragen' : 'In diesem Monat nichts eingetragen'}</h3>
        <div class="empty__actions"><button class="btn btn--secondary" data-akt="eintragen" data-wert="${S.tagWahl ?? ''}">Nachtragen</button></div></div></section>`;
  const main = filterLeiste() + filter + liste;
  const kal = kalenderKarte(v, ort, { voll: true });
  if (ort === 'laptop') return spalten(ort, main, kal);
  return `<div class="col">${filterLeiste()}${kal}${filter}${liste}</div>`;
}

function zeile(l, ersterDesTages, mitPlan) {
  const namen = l.dabei ? (l.dabei.length === FAMILIE.length ? 'alle' : l.dabei.map((id) => PERSON[id].name).join(', ')) : '';
  const planName = mitPlan && l.abo ? ABOS[l.abo]?.name : null;
  const meta = [planName, l.quelle === 'plan' ? `Einheit ${l.einheit}` : 'Frei eingetragen', l.uhrzeit, namen].filter(Boolean).join(' · ');
  const d = datum(l.datum);
  const heute = l.datum === tag(HEUTE);
  return `<div class="row${ersterDesTages ? '' : ' row--same-day'}">
    <span class="row__date${heute ? ' row__date--today' : ''}" aria-label="${tagKopf(l.datum)}">${ersterDesTages ? `<b>${d.getDate()}</b>${WT2[d.getDay()]}` : ''}</span>
    <div class="row__main"><span class="row__title">${stelle(l.kapitel)}</span><span class="row__meta">${esc(meta)}</span>
      ${l.notiz ? `<span class="row__note">${esc(l.notiz)}</span>` : ''}</div>
    ${menuAnker('eintrag', l.id, 'Mehr zum Eintrag', 'btn btn--ghost btn--icon')}</div>`;
}

// ------------------------------------------------------------------ Statistik

function statistikTab(ort) {
  const v = sicht();
  const s = statistik(v.abo);
  const gesamt = v.abo.lesungen.filter((l) => !l.geloescht).length;
  const meistName = { Früh: 'Früh', Vormittag: 'Vormittags', Mittag: 'Mittags', Nachmittag: 'Nachmittags', Abend: 'Abends', Nacht: 'Nachts' }[s.meist.name];
  const je = dezimal(s.jeWoche);
  const kopf = ort === 'laptop'
    ? `<div class="metrics">
        <div class="metric"><div class="metric__label">Lesetage im ${MON[HEUTE.getMonth()]}</div><div class="metric__value">${s.lesetageImMonat}<span class="metric__unit">von ${s.tageImMonat}</span></div></div>
        <div class="metric"><div class="metric__label">Je Woche</div><div class="metric__value">${je}<span class="metric__unit">Tage</span></div><div class="metric__note">letzte 8 Wochen</div></div>
        <div class="metric"><div class="metric__label">Meist gelesen</div><div class="metric__value">${meistName}</div><div class="metric__note">${prozent(s.meist.anzahl, gesamt)} der Einträge</div></div>
        <div class="metric"><div class="metric__label">Einträge</div><div class="metric__value">${zahl(gesamt)}</div><div class="metric__note">seit ${fmtDatum(v.abo.begonnen)}</div></div>
      </div>`
    : `<section class="carrier glance"><div class="glance__lead"><span>Lesetage im ${MON[HEUTE.getMonth()]}</span><b>${s.lesetageImMonat} <small>von ${s.tageImMonat}</small></b></div>
        <div class="glance__side"><span><b>${je}</b> Tage je Woche</span><span>Meist <b>${meistName.toLowerCase()}</b></span>
          <span><b>${zahl(gesamt)}</b> Einträge seit ${fmtDatum(v.abo.begonnen).slice(0, 6)}</span></div></section>`;

  // Mobil dasselbe Jahr, nur dichter: das Raster scrollt waagrecht und steht am Ende (heute).
  const wochen = 53;
  const heat = heatmap(s, v.abo, wochen, ort);
  const fensterAb = tag(plusTage(HEUTE, -((HEUTE.getDay() + 6) % 7) - (wochen - 1) * 7));
  const imFenster = v.abo.lesungen.filter((l) => !l.geloescht && l.datum >= fensterAb).length;
  const wt = balken(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], s.wochentage, (l, n) => `${l} · ${n} Lesetage`);
  const tz = balken(['Früh', 'Vorm.', 'Mittag', 'Nachm.', 'Abend', 'Nacht'], s.tageszeit.map((t) => t.anzahl),
    (l, n, i) => `${['5–9', '9–12', '12–15', '15–18', '18–22', '22–5'][i]} Uhr · ${n} Einträge`);
  return `${filterLeiste()}${kopf}
    <section class="card"><h3 class="card-title">Letzte 12 Monate<small class="tabnum">${imFenster === 1 ? '1 Eintrag' : `${zahl(imFenster)} Einträge`}</small></h3>${heat}
      <div class="legend" style="margin-top:12px"><span><i style="background:var(--color-fill-well)"></i>Nichts</span><span><i style="background:var(--tone-mid)"></i>1 Eintrag</span><span><i style="background:var(--tone-fill)"></i>2 und mehr</span></div></section>
    <div class="stat-pair">
      <section class="card"><h3 class="card-title">Nach Wochentag<small>Lesetage</small></h3>${wt}</section>
      <section class="card"><h3 class="card-title">Nach Tageszeit<small>Einträge</small></h3>${tz}</section>
    </div>`;
}

function heatmap(s, abo, wochen, ort) {
  const zelle = ort === 'laptop' ? 13 : 9;
  const luecke = ort === 'laptop' ? 4 : 3;
  const montagHeute = plusTage(HEUTE, -((HEUTE.getDay() + 6) % 7));
  const start = plusTage(montagHeute, -(wochen - 1) * 7);
  const zellen = [];
  const monate = [];
  for (let w = 0; w < wochen; w++) {
    for (let d = 0; d < 7; d++) {
      const dt = plusTage(start, w * 7 + d);
      if (d === 0 && (dt.getDate() <= 7)) monate.push({ w, name: MON3[dt.getMonth()] });
      if (dt > HEUTE || dt < abo.begonnen) { zellen.push('<i class="hx"></i>'); continue; }
      const n = s.proTag.get(tag(dt))?.length ?? 0;
      zellen.push(`<i class="${n >= 2 ? 'h2' : n ? 'h1' : ''}" data-tip="${kurzDatum(dt)} · ${n ? (n === 1 ? '1 Eintrag' : `${n} Einträge`) : 'nichts'}"></i>`);
    }
  }
  const sp = `repeat(${wochen}, ${zelle}px)`;
  return `<div class="heat-scroll" style="overflow-x:auto;scrollbar-width:thin"><div class="heat" style="grid-template-columns:${sp};gap:${luecke}px;--z:${zelle}px">${zellen.join('')}</div>
    <div class="heat-months" style="grid-template-columns:${sp};column-gap:${luecke}px">${monate.map((mo) =>
      `<span style="grid-column:${mo.w + 1} / span 3">${mo.name}</span>`).join('')}</div></div>`;
}

function balken(labels, werte, tipText) {
  const max = Math.max(...werte, 1);
  const iMax = werte.indexOf(Math.max(...werte));
  return `<div class="bars">${werte.map((n, i) => `<div class="bars__col" data-tip="${tipText(labels[i], n, i)}">
      <div class="bars__bar${i === iMax ? ' bars__bar--max' : ''}" style="height:${Math.max(2, (n / max) * 100)}%">${i === iMax ? `<span class="bars__val">${n}</span>` : ''}</div></div>`).join('')}</div>
    <div class="bars__labels">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
}

// ------------------------------------------------------------------ Blätter

function blatt(ort) {
  if (S.ui?.art !== 'sheet' || S.ui.ort !== ort) return '';
  const abo = ABOS[S.ui.aboId];
  const inhalt = {
    eintragen: blattEintragen, plan: blattPlan, gelesenAm: blattGelesenAm, aufholen: blattAufholen, ziel: blattZiel,
    einstellungen: blattEinstellungen, buch: () => buchDetail(S.ui.wert, sicht()).replace('class="card"', 'class=""'),
    assistent: () => blattAssistent(ort),
  }[S.ui.was]();
  const titel = {
    eintragen: S.ui.edit ? 'Eintrag bearbeiten' : 'Eintrag', plan: abo?.name ?? 'Plan', gelesenAm: 'An einem anderen Tag gelesen',
    aufholen: 'Aufholen', ziel: 'Ziel verschieben', einstellungen: 'Bibellese', buch: BUCH[S.ui.wert]?.name ?? '',
    assistent: 'Neuer Leseplan',
  }[S.ui.was];
  const extra = S.ui.was === 'assistent' ? `<span class="sheet__step">${S.assistent.schritt} von ${SCHRITTE.length}</span>` : '';
  // Hereingleiten nur beim Öffnen, nicht bei jedem Neuzeichnen (je Rahmen und Blatt einmal).
  const rein = S.ui.gezeigt !== `${ort}:${S.ui.was}` ? ' is-rein' : '';
  S.ui.gezeigt = `${ort}:${S.ui.was}`;
  return `<div class="sheet-layer${rein}"><div class="sheet-backdrop" data-akt="schliessen"></div>
    <div class="sheet${S.ui.was === 'assistent' ? ' sheet--wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titel)}"><div class="sheet__grip"></div>
      <div class="sheet__head"><h2>${esc(titel)}</h2>${extra}<button class="btn btn--ghost btn--icon" data-akt="schliessen" aria-label="Schließen">${ic('x')}</button></div>
      ${inhalt}</div></div>`;
}

const alleLesungen = () => [...Object.values(ABOS).flatMap((a) => a.lesungen), ...FREIE];

function blattEintragen() {
  const edit = S.ui.edit ? alleLesungen().find((l) => l.id === S.ui.edit) : null;
  const gemeinsame = meinePlaene().filter((a) => a.art === 'gemeinsam');
  const ziel = S.ui.ziel ?? (ABOS[S.filter]?.art === 'gemeinsam' ? S.filter : 'ich');
  const v = sicht(ziel === 'ich' ? 'alle' : ziel);
  const w = S.ui.werte ?? {}; // Eingaben bleiben nach einer Fehlermeldung stehen
  const buchId = w.buch ?? edit?.kapitel[0].b ?? v.buch?.id ?? 'Gen';
  const von = w.von ?? edit?.kapitel[0].k ?? 1;
  const bis = w.bis ?? edit?.kapitel.at(-1).k ?? 1;
  const opt = (t) => BUECHER.filter((b) => b.testament === t).map((b) => `<option value="${b.id}"${b.id === buchId ? ' selected' : ''}>${b.name}</option>`).join('');
  return `<form data-form="eintrag" onsubmit="return false">
    ${edit ? '' : `<div class="field"><label>Logbuch</label><div><div class="seg" role="group" aria-label="Logbuch">${[['ich', 'Für mich'], ...gemeinsame.map((a) => [a.id, a.name])].map(([id, l]) =>
      `<button type="button" aria-pressed="${ziel === id}" data-akt="logbuch-wahl" data-wert="${id}">${esc(l)}</button>`).join('')}</div></div></div>`}
    <div class="field"><label for="f-buch">Buch</label><select id="f-buch" name="buch"><optgroup label="Altes Testament">${opt('AT')}</optgroup><optgroup label="Neues Testament">${opt('NT')}</optgroup></select></div>
    <div class="field-row"><div class="field"><label for="f-von">Kapitel von</label><input id="f-von" name="von" type="number" inputmode="numeric" min="1" value="${esc(von)}"></div>
      <div class="field"><label for="f-bis">bis</label><input id="f-bis" name="bis" type="number" inputmode="numeric" min="1" value="${esc(bis)}"></div></div>
    <div class="field__error" aria-live="polite">${S.ui.fehler ? `${ic('circle-alert')}${esc(S.ui.fehler)}` : ''}</div>
    <div class="field-row"><div class="field" style="margin-top:4px"><label for="f-datum">Datum</label><input id="f-datum" name="datum" type="date" max="${tag(HEUTE)}" value="${esc(w.datum ?? edit?.datum ?? S.ui.datum ?? tag(HEUTE))}"></div>
      <div class="field" style="margin-top:4px"><label for="f-zeit">Uhrzeit</label><input id="f-zeit" name="zeit" type="time" value="${esc(w.zeit ?? edit?.uhrzeit ?? '20:15')}"></div></div>
    <div class="field"><label for="f-notiz">Notiz</label><textarea id="f-notiz" name="notiz" placeholder="z. B. Gedanken, Fragen, Gebetsanliegen">${esc(w.notiz ?? edit?.notiz ?? '')}</textarea></div>
    <div class="sheet__foot"><button type="button" class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button type="button" class="btn btn--primary" data-akt="eintrag-speichern">${edit ? 'Speichern' : 'Eintragen'}</button></div></form>`;
}

function blattPlan() {
  const abo = ABOS[S.ui.aboId];
  const { st } = planSicht(abo.id);
  const fremd = abo.besitzer !== ICH.id && abo.art !== 'gemeinsam';
  const ab = Math.max(0, st.gelesen - 3);
  const zeilen = abo.einheiten.slice(ab, st.gelesen + 12).map((e, i) => {
    const nr = ab + i + 1;
    const fertig = nr <= st.gelesen;
    const naechste = nr === st.gelesen + 1;
    return `<div class="row${naechste ? ' plan-row--next' : ''}"><span class="check-ring${fertig ? ' check-ring--done' : ''}${naechste ? ' check-ring--next' : ''}" role="img" aria-label="${fertig ? 'gelesen' : 'offen'}">${fertig ? ic('check') : ''}</span>
      <div class="row__main"><span class="row__title">${stelle(e)}</span><span class="row__meta">${min(minuten(e, abo.wpm))}</span></div><span class="row__end">${nr}</span></div>`;
  }).join('');
  const verschoben = st.ziel && st.zielUrspruenglich.getTime() !== st.ziel.getTime();
  const einteilen = fremd ? null : neuEinteilenVorschau(abo);
  const lesart = LESARTEN.find((l) => l.wpm === abo.wpm)?.name ?? `${abo.wpm} Wörter je Min.`;
  const rhythmus = RHYTHMEN.find((r) => String(r.tage) === String(abo.tempo.tage))?.name ?? '';
  return `<p class="footnote" style="margin:0 0 12px">${esc(abo.rezept)}</p>
    <div class="inset rows" style="margin-bottom:12px">
      <div class="row"><div class="row__main"><span class="row__title">Für wen</span></div><span class="value-link">${ic(ART[abo.art].icon)}${abo.art === 'gemeinsam' ? 'Alle im Haushalt' : `${ART[abo.art].name}${fremd ? ` · ${PERSON[abo.besitzer].name}` : ''}`}</span></div>
      ${st.ziel ? `<button class="row" data-akt="sheet" data-was="ziel" data-abo="${abo.id}"${fremd ? ' disabled' : ''}>
        <div class="row__main"><span class="row__title">Ziel</span>${verschoben ? `<span class="row__meta">ursprünglich ${fmtDatum(st.zielUrspruenglich)}</span>` : ''}</div>
        <span class="value-link tabnum">${fmtDatum(st.ziel)}${fremd ? '' : ic('chevron-right')}</span></button>` : ''}
      <div class="row"><div class="row__main"><span class="row__title">Lesetage · Lesart</span></div><span class="value-link">${rhythmus} · ${lesart}</span></div>
      <div class="row"><div class="row__main"><span class="row__title">Stand</span></div><span class="value-link tabnum">Version ${abo.version} · ${lesungenText(st.anzahl)}</span></div>
      ${einteilen?.moeglich && st.verzug > 0 ? `<button class="row row--link" data-akt="neu-einteilen" data-abo="${abo.id}">Neu einteilen: Lesungen ${min(einteilen.nachher)} statt ${min(einteilen.vorher)}${ic('chevron-right')}</button>` : ''}
    </div>
    <div class="inset rows">${zeilen}</div>
    ${fremd ? `<div class="sheet__foot">${istUebernommen(abo) ? `<span class="state state--ok">${ic('check')}Übernommen</span>`
      : `<button class="btn btn--primary" data-akt="uebernehmen" data-abo="${abo.id}">Übernehmen</button>`}</div>` : ''}`;
}

function blattGelesenAm() {
  const { st } = planSicht(S.ui.aboId);
  return `<p style="margin:0;font-size:17px;font-weight:600">${stelle(st.naechste.kapitel)}</p>
    <div class="field"><label for="f-am">Gelesen am</label><input id="f-am" name="am" type="date" max="${tag(HEUTE)}" value="${tag(plusTage(HEUTE, -1))}"></div>
    <div class="sheet__foot"><button class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button class="btn btn--primary" data-akt="gelesen-am">${ic('check')}Gelesen</button></div>`;
}

/**
 * Aufholen ist kein eigener Modus: das Blatt zeigt, was es kostet, und lässt gleich weiterlesen.
 * Dritter Weg: „Neu einteilen“ – die restlichen Lesungen werden etwas länger, das Ziel bleibt.
 */
function blattAufholen() {
  const aboId = S.ui.aboId;
  const { st, abo } = planSicht(aboId);
  const sichtbar = Math.min(S.ui.anzahl, 5);
  const zeilen = Array.from({ length: sichtbar }, (_, i) => {
    const nr = S.ui.start + i + 1;
    const fertig = nr <= st.gelesen;
    const naechste = nr === st.gelesen + 1;
    const wann = i === 0 && S.ui.heuteOffen ? 'heute' : 'zum Aufholen';
    return `<div class="row${naechste ? ' plan-row--next' : ''}"><span class="check-ring${fertig ? ' check-ring--done' : ''}${naechste ? ' check-ring--next' : ''}" role="img" aria-label="${fertig ? 'gelesen' : 'offen'}">${fertig ? ic('check') : ''}</span>
      <div class="row__main"><span class="row__title">${stelle(abo.einheiten[nr - 1])}</span><span class="row__meta">Einheit ${nr} · ${wann}</span></div></div>`;
  }).join('');
  const mehr = S.ui.anzahl > sichtbar ? `<div class="row"><span class="row__meta" style="padding-left:32px">und ${S.ui.anzahl - sichtbar} weitere</span></div>` : '';
  let satz;
  if (st.verzug === 0) satz = `<p class="sheet__lead state state--ok">${ic('circle-check')}Wieder im Plan · Ziel ${fmtDatum(st.ziel)}</p>`;
  else if (st.grosserVerzug) satz = `<p class="sheet__lead">In zwei Wochen aufgeholt hieße ${Math.ceil(st.verzug / 14)} Einheiten mehr am Tag.</p>`;
  else {
    const t = tag(st.wiederImPlan);
    const wann = t === tag(HEUTE) ? 'heute' : t === tag(plusTage(HEUTE, 1)) ? 'morgen' : `am ${kurzDatum(st.wiederImPlan)}`;
    satz = `<p class="sheet__lead">Mit ${st.verzug === 1 ? 'einer' : 'je einer'} Einheit mehr bist du ${wann} wieder im Plan.</p>`;
  }
  const busy = S.busy === aboId;
  const haupt = st.verzug === 0
    ? '<button class="btn btn--primary" data-akt="schliessen">Fertig</button>'
    : `<button class="btn btn--primary${busy ? ' btn--busy' : ''}" data-akt="gelesen-blatt">${busy ? 'Wird gespeichert …' : `${ic('check')}Gelesen`}</button>`;
  const e = neuEinteilenVorschau(ABOS[aboId]);
  const dritter = st.verzug > 0 && e.moeglich
    ? `<div class="group-label">Oder ohne Mehrlesen</div>
      <div class="inset rows"><div class="row"><div class="row__main"><span class="row__title">Neu einteilen</span>
        <span class="row__meta tabnum">Lesungen ${min(e.nachher)} statt ${min(e.vorher)} · Ziel bleibt ${fmtDatum(st.ziel)}</span></div>
        <button class="btn btn--secondary btn--sm" data-akt="neu-einteilen" data-abo="${aboId}">Einteilen</button></div></div>`
    : '';
  return `${satz}<div class="inset rows">${zeilen}${mehr}</div>${dritter}
    <div class="sheet__foot"><button class="btn btn--secondary" data-akt="sheet" data-was="ziel" data-abo="${aboId}">Ziel verschieben</button>${haupt}</div>`;
}

/** Was ein Ziel bewirkt: „im Plan“, „7 Einheiten Vorsprung“ oder „2 Einheiten im Verzug“. */
function zielVorschau(abo, d) {
  if (!d || d <= HEUTE) return 'Das Ziel muss nach heute liegen.';
  const s = mitZiel(abo, d);
  if (s.verzug > 0) return `Danach: ${einheiten(s.verzug)} im Verzug`;
  if (s.vorsprung > 0) return `Danach: ${einheiten(s.vorsprung)} Vorsprung`;
  return 'Danach: im Plan';
}

function blattZiel() {
  const { st, abo } = planSicht(S.ui.aboId);
  const mitVerzug = st.verzug > 0;
  const art = S.ui.zielArt ?? (mitVerzug ? 'verzug' : 'datum');
  const datumWert = S.ui.datumWert ?? tag(mitVerzug ? st.ende : plusTage(st.ziel, 7));
  const tage = Math.round((st.ende - st.ziel) / 86400000);
  const gewaehlt = art === 'verzug' ? st.ende : datum(datumWert);
  const verlauf = abo.zielVerlauf.length
    ? `<div class="group-label">Verlauf</div><div class="inset rows">${abo.zielVerlauf.map((z) =>
        `<div class="row"><div class="row__main"><span class="row__title tabnum">${fmtDatum(z.von)} → ${fmtDatum(z.nach)}</span><span class="row__meta">am ${fmtDatum(datum(z.am))}</span></div></div>`).join('')}</div>`
    : '';
  return `<form data-form="ziel" onsubmit="return false">
    <p class="footnote" style="margin:0 0 12px">${esc(abo.name)}</p>
    <div class="inset rows">
      <div class="row"><div class="row__main"><span class="row__title">Jetziges Ziel</span>${st.zielUrspruenglich.getTime() !== st.ziel.getTime() ? `<span class="row__meta">ursprünglich ${fmtDatum(st.zielUrspruenglich)}</span>` : ''}</div>
        <span class="value-link tabnum">${fmtDatum(st.ziel)}</span></div>
    </div>
    <div class="group-label">Neues Ziel</div>
    <div class="inset rows">
      ${mitVerzug ? `<label class="row choice"><input type="radio" name="art" value="verzug"${art === 'verzug' ? ' checked' : ''}>
        <div class="row__main"><span class="row__title">Um den Verzug</span><span class="row__meta tabnum">um ${tage} ${tage === 1 ? 'Tag' : 'Tage'} auf ${fmtDatum(st.ende)}</span></div></label>` : ''}
      <label class="row choice"><input type="radio" name="art" value="datum"${art === 'datum' ? ' checked' : ''}>
        <div class="row__main"><span class="row__title">Anderes Datum</span></div>
        <input class="choice__date" type="date" name="datum" min="${tag(plusTage(HEUTE, 1))}" value="${esc(datumWert)}" aria-label="Neues Ziel"></label>
    </div>
    <p class="sheet__preview tabnum" data-vorschau aria-live="polite">${zielVorschau(abo, gewaehlt)}</p>
    ${verlauf}
    <div class="sheet__foot"><button type="button" class="btn btn--ghost" data-akt="schliessen">Abbrechen</button>
      <button type="button" class="btn btn--primary" data-akt="ziel-setzen">Ziel verschieben</button></div></form>`;
}

function blattEinstellungen() {
  const seg = (key, optionen) => `<div class="seg" role="group">${optionen.map(([w, l]) =>
    `<button type="button" aria-pressed="${S.einst[key] === w}" data-akt="einst" data-was="${key}" data-wert="${w}">${l}</button>`).join('')}</div>`;
  const ok = (key) => `<span class="saved${S.saved === key ? ' saved--on' : ''}">${ic('check')}Gespeichert</span>`;
  return `<div class="group-label">Für mich</div>
    <div class="inset rows">
      <button class="row" data-akt="tab" data-wert="plaene"><div class="row__main"><span class="row__title">Meine Pläne</span></div>
        <span class="value-link">${meinePlaene().filter((a) => a.art !== 'gemeinsam').length}${ic('chevron-right')}</span></button>
      <div class="row"><div class="row__main"><span class="row__title">Gemeinsame Pläne zählen für mich, wenn ich dabei war</span></div>${ok('gemeinsamZaehlt')}
        <button class="switch" role="switch" aria-checked="${S.einst.gemeinsamZaehlt}" data-akt="einst" data-was="gemeinsamZaehlt" aria-label="Gemeinsame Pläne zählen für mich"></button></div>
    </div>
    <div class="group-label">Für den Haushalt</div>
    <div class="inset rows">
      <div class="row"><div class="row__main"><span class="row__title">Gemeinsame Pläne anlegen</span></div>${ok('anlegen')}${seg('anlegen', [['alle', 'Alle'], ['admins', 'Nur Admins']])}</div>
    </div>
    <div class="inset rows" style="margin-top:16px"><button class="row row--link">In den Yuvomi-Einstellungen öffnen${ic('chevron-right')}</button></div>`;
}

// ------------------------------------------------------------------ Assistent „Neuer Leseplan“
// Antworten → Bücher wählen → ordnen → Ring drehen → Parallelen bündeln → einteilen (LESEPLAN.md).
// Die Vorschau rechnet live mit dem vereinfachten Erzeuger aus bibellese-daten.js.

const SCHRITTE = ['Was', 'Wo anfangen', 'Parallelen', 'Wie viel', 'Für wen'];

function neuerAssistent() {
  return {
    schritt: 1, auswahl: 'bibel', gruppe: 'evang', buecher: ['John'], weisheit: false, reihenfolge: 'kanonisch',
    startArt: 'anfang', start: null, parallelen: { geschichte: true, lieder: true, gesetz: false },
    modus: 'datum', bis: tag(plusTage(HEUTE, 364)), minuten: 10, rhythmus: 'taeglich', lesart: 'still',
    name: '', art: 'privat', beginn: tag(HEUTE),
  };
}

function rezeptAus(a) {
  return {
    auswahl: a.auswahl, gruppe: a.gruppe, buecher: a.buecher, weisheit: a.weisheit,
    start: a.startArt === 'buch' ? a.start : null,
    modus: a.rhythmus === 'frei' ? 'minuten' : a.modus, bis: datum(a.bis), minuten: a.minuten,
    rhythmus: a.rhythmus, wpm: LESARTEN.find((l) => l.id === a.lesart).wpm, beginn: datum(a.beginn),
  };
}

function nameVorschlag(a) {
  if (a.auswahl === 'bibel') return a.weisheit ? 'Bibel mit Weisheit' : 'Ganze Bibel';
  if (a.auswahl === 'at') return 'Altes Testament';
  if (a.auswahl === 'nt') return 'Neues Testament';
  if (a.auswahl === 'gruppe') return GRUPPEN.find((g) => g.id === a.gruppe).name;
  const b = buecherDerAuswahl(a);
  return b.length <= 2 ? b.map((x) => x.name).join(' und ') : `${b[0].name} und ${b.length - 1} weitere`;
}

function rezeptText(a, e) {
  const was = nameVorschlag(a);
  const start = a.startArt === 'buch' && a.start ? ` · ab ${BUCH[a.start].name}` : '';
  const rhythmus = RHYTHMEN.find((r) => r.id === a.rhythmus).name;
  const wie = e.ende ? `bis ${fmtDatum(e.ende)}` : `${a.minuten} Min. je Lesung`;
  return `${was}${start} · ${wie} · ${rhythmus}`;
}

const radioZeile = (name, wert, aktiv, titel, meta = '', extra = '') => `<label class="row choice">
  <input type="radio" name="${name}" value="${wert}"${aktiv ? ' checked' : ''}>
  <div class="row__main"><span class="row__title">${titel}</span>${meta ? `<span class="row__meta">${meta}</span>` : ''}</div>${extra}</label>`;

const schalterZeile = (key, an, titel, meta = '', gesperrt = '') => `<div class="row">
  <div class="row__main"><span class="row__title">${titel}</span>${meta ? `<span class="row__meta">${meta}</span>` : ''}</div>
  <button type="button" class="switch" role="switch" aria-checked="${an}" data-akt="assistent-schalter" data-was="${key}" aria-label="${titel}"${gesperrt ? ` disabled title="${gesperrt}"` : ''}></button></div>`;

const segAssistent = (key, optionen) => `<div class="seg" role="group">${optionen.map(([w, l, gesperrt]) =>
  `<button type="button" aria-pressed="${S.assistent[key] === w}" data-akt="assistent-wert" data-was="${key}" data-wert="${w}"${gesperrt ? ` disabled title="${gesperrt}"` : ''}>${l}</button>`).join('')}</div>`;

function schrittInhalt() {
  const a = S.assistent;
  const auswahl = buecherDerAuswahl(a);
  if (a.schritt === 1) {
    const verse = (bs) => `${zahl(bs.length)} ${bs.length === 1 ? 'Buch' : 'Bücher'}`;
    const buecherWahl = a.auswahl === 'buecher' ? `<div class="tiles tiles--pick">${BUECHER.map((b) =>
      `<button type="button" class="tile" aria-pressed="${a.buecher.includes(b.id)}" data-akt="assistent-buch" data-wert="${b.id}" title="${b.name}">${b.kurz}</button>`).join('')}</div>` : '';
    return `<h3 class="wizard__q">Was möchtest du lesen?</h3>
      <div class="inset rows">
        ${radioZeile('auswahl', 'bibel', a.auswahl === 'bibel', 'Ganze Bibel', verse(BUECHER))}
        ${radioZeile('auswahl', 'at', a.auswahl === 'at', 'Altes Testament', verse(BUECHER.filter((b) => b.testament === 'AT')))}
        ${radioZeile('auswahl', 'nt', a.auswahl === 'nt', 'Neues Testament', verse(BUECHER.filter((b) => b.testament === 'NT')))}
        ${radioZeile('auswahl', 'gruppe', a.auswahl === 'gruppe', 'Eine Buchgruppe', '',
          `<select name="gruppe" class="choice__date" aria-label="Buchgruppe">${GRUPPEN.map((g) => `<option value="${g.id}"${a.gruppe === g.id ? ' selected' : ''}>${g.name}</option>`).join('')}</select>`)}
        ${radioZeile('auswahl', 'buecher', a.auswahl === 'buecher', 'Einzelne Bücher', a.auswahl === 'buecher' ? `${a.buecher.length} gewählt` : '')}
      </div>${buecherWahl}
      <div class="inset rows" style="margin-top:12px">
        ${schalterZeile('weisheit', a.weisheit && ['bibel', 'at'].includes(a.auswahl), 'Weisheitsliteratur nebenher', 'Hiob bis Hoheslied als zweiter Strang', ['bibel', 'at'].includes(a.auswahl) ? '' : 'Nur mit ganzer Bibel oder Altem Testament')}
        <div class="row"><div class="row__main"><span class="row__title">Reihenfolge</span></div>
          ${segAssistent('reihenfolge', [['kanonisch', 'Kanonisch'], ['chronologisch', 'Chronologisch', 'Die chronologische Reihenfolge wird noch erstellt']])}</div>
      </div>`;
  }
  if (a.schritt === 2) {
    const haupt = a.weisheit && ['bibel', 'at'].includes(a.auswahl) ? auswahl.filter((b) => !WEISHEIT.includes(b.id)) : auswahl;
    return `<h3 class="wizard__q">Wo fängst du an?</h3>
      <div class="inset rows">
        ${radioZeile('startArt', 'anfang', a.startArt === 'anfang', 'Am Anfang', haupt[0]?.name ?? '')}
        ${radioZeile('startArt', 'buch', a.startArt === 'buch', 'Bei einem Buch', 'Was davor liegt, kommt am Ende',
          `<select name="start" class="choice__date" aria-label="Startbuch">${haupt.map((b) => `<option value="${b.id}"${a.start === b.id ? ' selected' : ''}>${b.name}</option>`).join('')}</select>`)}
      </div>`;
  }
  if (a.schritt === 3) {
    return `<h3 class="wizard__q">Parallelstellen zusammen lesen?</h3>
      <div class="inset rows">
        ${schalterZeile('p-geschichte', a.parallelen.geschichte, 'Geschichte', '62 Gruppen, z. B. 1Kö 8 mit 2Chr 5–7')}
        ${schalterZeile('p-lieder', a.parallelen.lieder, 'Lieder', '3 Gruppen, z. B. 2Sam 22 mit Ps 18')}
        ${schalterZeile('p-gesetz', a.parallelen.gesetz, 'Gesetz', '4 Gruppen, z. B. die Zehn Gebote')}
        ${schalterZeile('p-evangelien', false, 'Evangelien', 'Kommt in einem zweiten Schritt', 'Die Synopse der Evangelien wird noch erfasst')}
      </div>`;
  }
  if (a.schritt === 4) {
    const frei = a.rhythmus === 'frei';
    const modus = frei ? 'minuten' : a.modus;
    return `<h3 class="wizard__q">Wie viel und wann?</h3>
      <div class="inset rows">
        <div class="row"><div class="row__main"><span class="row__title">Lesetage</span></div>
          ${segAssistent('rhythmus', RHYTHMEN.map((r) => [r.id, r.id === 'frei' ? 'Frei' : r.name]))}</div>
        <div class="row"><div class="row__main"><span class="row__title">Festlegen über</span></div>
          ${segAssistent('modus', [['datum', 'Zieldatum', frei ? 'Ohne festen Rhythmus gibt es kein Zieldatum' : ''], ['minuten', 'Minuten']])}</div>
        ${modus === 'datum'
          ? `<label class="row"><div class="row__main"><span class="row__title">Fertig bis</span></div><input class="choice__date" type="date" name="bis" min="${tag(plusTage(HEUTE, 7))}" value="${esc(a.bis)}"></label>`
          : `<div class="row"><div class="row__main"><span class="row__title">Minuten je Lesung</span></div>${segAssistent('minuten', [[5, '5'], [10, '10'], [15, '15'], [20, '20']])}</div>`}
        <div class="row"><div class="row__main"><span class="row__title">Lesart</span></div>
          ${segAssistent('lesart', LESARTEN.map((l) => [l.id, l.name]))}</div>
      </div>`;
  }
  const vorschlag = nameVorschlag(a);
  return `<h3 class="wizard__q">Für wen ist der Plan?</h3>
    <div class="field" style="margin-top:0"><label for="a-name">Name</label><input id="a-name" name="name" type="text" value="${esc(a.name)}" placeholder="${esc(vorschlag)}"></div>
    <div class="inset rows" style="margin-top:14px">
      ${radioZeile('art', 'privat', a.art === 'privat', 'Nur für mich', 'Niemand sonst sieht ihn')}
      ${radioZeile('art', 'sichtbar', a.art === 'sichtbar', 'Für mich, sichtbar für alle', 'Andere können ihn übernehmen')}
      ${radioZeile('art', 'gemeinsam', a.art === 'gemeinsam', 'Gemeinsam mit allen im Haushalt', 'Ein Lesezeichen, jeder kann abhaken')}
    </div>
    <div class="field"><label for="a-beginn">Beginnen am</label><input id="a-beginn" name="beginn" type="date" min="${tag(HEUTE)}" value="${esc(a.beginn)}"></div>`;
}

function assistentVorschau() {
  const a = S.assistent;
  const e = erzeuge(rezeptAus(a));
  const kopf = e.ende
    ? `<b>${min(e.minutenJe)}</b> je Lesung · ${lesungenText(e.n)} · fertig etwa <b>${fmtDatum(e.ende)}</b>`
    : `<b>${min(e.minutenJe)}</b> je Lesung · ${lesungenText(e.n)} · das Ende ergibt sich aus deinem Tempo`;
  const erste = e.einheiten.slice(0, 3).map((u, i) => `<li><span class="tabnum">${i + 1}</span>${stelle(u)}</li>`).join('');
  return `<div class="wizard__preview" data-vorschau-assistent aria-live="polite">
    <div class="wizard__sum">${kopf}</div>
    ${e.begrenzt ? `<p class="state state--warn" style="font-size:13px;margin:6px 0 0">${ic('info')}Höchstens ${lesungenText(e.n)} – ein Kapitel wird nicht geteilt.</p>` : ''}
    <ol class="wizard__list">${erste}</ol>
    <div class="footnote">${e.straenge === 2 ? 'Zwei Stränge · ' : ''}${zahl(e.kapitel)} Kapitel · ${Math.round(e.gesamt / 60)} Std. insgesamt</div>
  </div>`;
}

function blattAssistent(ort) {
  const a = S.assistent;
  const letzter = a.schritt === SCHRITTE.length;
  const leer = a.auswahl === 'buecher' && a.buecher.length === 0;
  const steps = `<ol class="steps" aria-label="Schritte">${SCHRITTE.map((s, i) =>
    `<li class="${i + 1 === a.schritt ? 'is-now' : i + 1 < a.schritt ? 'is-done' : ''}"><button type="button" data-akt="assistent-schritt" data-wert="${i + 1}">${s}</button></li>`).join('')}</ol>`;
  const foot = `<div class="sheet__foot">
    <button type="button" class="btn btn--ghost" data-akt="${a.schritt === 1 ? 'schliessen' : 'assistent-zurueck'}">${a.schritt === 1 ? 'Abbrechen' : 'Zurück'}</button>
    <button type="button" class="btn btn--primary" data-akt="${letzter ? 'assistent-fertig' : 'assistent-weiter'}"${leer ? ' disabled title="Mindestens ein Buch wählen"' : ''}>${letzter ? 'Plan anlegen' : 'Weiter'}</button></div>`;
  return `<form data-form="assistent" onsubmit="return false">${steps}
    <div class="wizard"><div class="wizard__main">${schrittInhalt()}</div>${leer ? '' : assistentVorschau()}</div>${foot}</form>`;
}

// ------------------------------------------------------------------ Toast

function toast(ort, text, undo) {
  const id = Math.random();
  S.toast = { ort, text, undo, id };
  setTimeout(() => { if (S.toast?.id === id) { S.toast = null; render(); } }, 5000);
}
function toastHtml(ort) {
  if (S.toast?.ort !== ort) return '';
  const rein = S.toast.gezeigt ? '' : ' is-rein';
  S.toast.gezeigt = true;
  const undo = S.toast.undo ? '<button class="btn btn--ghost btn--sm" data-akt="undo">Rückgängig</button>' : '';
  return `<div class="toast${rein}" role="status">${ic('circle-check')}<span>${esc(S.toast.text)}</span>${undo}</div>`;
}

// ------------------------------------------------------------------ Dashboard-Kachel

function kachelWidget() {
  const zeilen = meinePlaene().slice(0, 3).map((a) => {
    const { st } = planSicht(a.id);
    if (!st.naechste) return '';
    const [cls, text] = kurzStatus(st);
    return `<div class="widget__item"><div class="row__main"><span class="footnote">${esc(a.name)}</span>
        <span class="widget__ref">${stelle(st.naechste.kapitel)}</span><span class="state ${cls}" style="font-size:13px">${text}</span></div>
      <button class="btn btn--secondary btn--sm" data-akt="gelesen" data-abo="${a.id}">${S.busy === a.id ? 'Wird gespeichert …' : `${ic('check')}Gelesen`}</button></div>`;
  }).join('');
  return `<div class="widget"><div class="widget__head"><span class="seal">${ic('book-open')}</span><b>Bibellese</b><span class="widget__meta">Heute</span></div>${zeilen}</div>${toastHtml('kachel')}`;
}

// ------------------------------------------------------------------ Zeichnen

const frames = () => [...document.querySelectorAll('[data-frame]')];

function render() {
  document.documentElement.dataset.theme = S.thema;
  document.getElementById('mk-stage').dataset.ansicht = S.ansicht;
  for (const seg of document.querySelectorAll('.mk-seg')) {
    for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(S[seg.dataset.mk] === b.dataset.wert));
  }
  for (const frame of frames()) {
    const ort = frame.dataset.frame;
    if (ort === 'kachel') { frame.replaceChildren(); frame.insertAdjacentHTML('beforeend', kachelWidget()); continue; }
    const scroll = frame.querySelector('.content')?.scrollTop ?? 0;
    const sheetScroll = frame.querySelector('.sheet')?.scrollTop ?? 0;
    frame.replaceChildren();
    frame.insertAdjacentHTML('beforeend', `<div class="app">${sidebar()}
      <div class="content">${kopf(ort)}${reiter()}${seite(ort)}</div>
      ${bottomNav(ort)}${blatt(ort)}${toastHtml(ort)}</div>`);
    frame.querySelector('.content').scrollTop = scroll;
    const sheet = frame.querySelector('.sheet');
    if (sheet) sheet.scrollTop = sheetScroll;
    for (const h of frame.querySelectorAll('.heat-scroll')) h.scrollLeft = h.scrollWidth;
  }
  window.lucide?.createIcons({ icons: window.lucide.icons, attrs: { 'stroke-width': 2 } });
  zoom();
}

function zoom() {
  const z = document.querySelector('.mk-zoom');
  const platz = Math.min(window.innerWidth - 32, 1280);
  z.style.zoom = String(Math.min(1, platz / 1280));
}

// ------------------------------------------------------------------ Handlungen

function lesen(ort, aboId, am = tag(HEUTE)) {
  const v = planSicht(aboId);
  if (!v.st?.naechste) return;
  S.busy = aboId;
  render();
  setTimeout(() => {
    const abo = ABOS[aboId];
    const amTag = abo.lesungen.filter((l) => !l.geloescht && l.datum === am).length;
    const basis = am === tag(HEUTE) ? (abo.art === 'gemeinsam' ? [19, 42] : [21, 5]) : [20, 0];
    const m = basis[1] + amTag * 12;
    const uhrzeit = `${zwei(basis[0] + Math.floor(m / 60))}:${zwei(m % 60)}`;
    const l = {
      id: `neu-${Date.now()}`, abo: aboId, person: ICH.id, quelle: 'plan', einheit: v.st.naechste.nr, datum: am, uhrzeit,
      kapitel: v.st.naechste.kapitel, dabei: abo.art === 'gemeinsam' ? [...S.dabei] : null, notiz: '',
    };
    abo.lesungen.push(l);
    const vorher = S.gerade[aboId];
    if (am === tag(HEUTE)) S.gerade[aboId] = { stelle: stelle(l.kapitel), uhrzeit, id: l.id };
    S.busy = null;
    if (S.szenario === 'fehler') S.warteschlange++;
    toast(ort, `${stelle(l.kapitel)} gelesen${S.szenario === 'fehler' ? ' · wird nachgetragen' : ''}`, () => {
      l.geloescht = true;
      S.gerade[aboId] = vorher;
      if (S.szenario === 'fehler') S.warteschlange = Math.max(0, S.warteschlange - 1);
    });
    render();
  }, 450);
}

function eintragSpeichern(frame) {
  const f = frame.querySelector('[data-form="eintrag"]');
  const buchId = f.buch.value;
  const von = Number(f.von.value);
  const bis = Number(f.bis.value);
  const b = BUCH[buchId];
  let fehler = '';
  if (!von || !bis) fehler = 'Kapitel von und bis eintragen.';
  else if (bis < von) fehler = 'Bis-Kapitel liegt vor dem Von-Kapitel.';
  else if (bis > b.kapitel) fehler = `${b.name} hat ${b.kapitel} Kapitel.`;
  if (fehler) {
    S.ui.fehler = fehler;
    S.ui.werte = { buch: buchId, von: f.von.value, bis: f.bis.value, datum: f.datum.value, zeit: f.zeit.value, notiz: f.notiz.value };
    render();
    frame.querySelector('#f-bis').focus();
    return;
  }
  const kapitel = Array.from({ length: bis - von + 1 }, (_, i) => ({ b: buchId, k: von + i }));
  const ort = S.ui.ort;
  if (S.ui.edit) {
    const l = alleLesungen().find((x) => x.id === S.ui.edit);
    const alt = { ...l };
    Object.assign(l, { kapitel, datum: f.datum.value || tag(HEUTE), uhrzeit: f.zeit.value || l.uhrzeit, notiz: f.notiz.value.trim() });
    S.ui = null;
    toast(ort, 'Eintrag gespeichert', () => Object.assign(l, alt));
  } else {
    const ziel = S.ui.ziel ?? (ABOS[S.filter]?.art === 'gemeinsam' ? S.filter : 'ich');
    const l = {
      id: `frei-neu-${Date.now()}`, abo: ziel === 'ich' ? null : ziel, person: ICH.id, quelle: 'frei', einheit: null,
      datum: f.datum.value || tag(HEUTE), uhrzeit: f.zeit.value || '20:15', kapitel,
      dabei: ziel === 'ich' ? null : [...S.dabei], notiz: f.notiz.value.trim(),
    };
    (ziel === 'ich' ? FREIE : ABOS[ziel].lesungen).push(l);
    S.ui = null;
    toast(ort, `${stelle(kapitel)} eingetragen`, () => { l.geloescht = true; });
  }
  render();
}

function planAnlegen(ort) {
  const a = S.assistent;
  const e = erzeuge(rezeptAus(a));
  const id = `neu-${Date.now()}`;
  const name = a.name.trim() || nameVorschlag(a);
  ABOS[id] = {
    id, name, art: a.art, besitzer: ICH.id, neu: true, rezept: rezeptText(a, e), wpm: LESARTEN.find((l) => l.id === a.lesart).wpm,
    begonnen: datum(a.beginn), tempo: e.tempo, einheiten: e.einheiten, ziel: e.ende,
    durchgang: 1, version: 1, lesungen: [], zielVerlauf: [],
  };
  S.ui = null;
  S.assistent = null;
  S.tab = 'heute';
  toast(ort, `„${name}“ angelegt`, () => { ABOS[id].geloescht = true; });
}

function uebernehmen(ort, quelleId) {
  const q = ABOS[quelleId];
  const id = `kopie-${Date.now()}`;
  ABOS[id] = {
    ...q, id, besitzer: ICH.id, art: 'privat', kopieVon: q.id, neu: true, begonnen: new Date(HEUTE), einheiten: [...q.einheiten],
    ziel: nterLesetag(q.tempo, HEUTE, q.einheiten.length), lesungen: [], zielVerlauf: [], version: 1, durchgang: 1,
  };
  S.ui = null;
  toast(ort, `„${q.name}“ übernommen`, () => { ABOS[id].geloescht = true; });
}

/** Einen Wert des Assistenten aus einem Formularfeld lesen. */
function assistentFeld(t) {
  const a = S.assistent;
  if (t.name === 'name') { a.name = t.value; return false; }
  if (['auswahl', 'gruppe', 'startArt', 'start', 'art', 'bis', 'beginn'].includes(t.name)) a[t.name] = t.value;
  if (t.name === 'gruppe') a.auswahl = 'gruppe';
  if (t.name === 'start') a.startArt = 'buch';
  if (t.name === 'startArt' && t.value === 'buch' && !a.start) a.start = t.form.start?.value ?? null;
  if (t.name === 'auswahl') { a.startArt = 'anfang'; a.start = null; }
  return true;
}

document.addEventListener('click', (e) => {
  const mk = e.target.closest('.mk-seg button');
  if (mk) {
    const key = mk.parentElement.dataset.mk;
    S[key] = mk.dataset.wert;
    if (key === 'szenario') { S.ui = null; S.gerade = {}; }
    render();
    return;
  }
  const el = e.target.closest('[data-akt]');
  const frame = e.target.closest('[data-frame]');
  const ort = frame?.dataset.frame;
  if (!el || el.disabled) {
    if (S.ui?.art === 'menu' && !e.target.closest('.menu')) { S.ui = null; render(); }
    return;
  }
  const { akt, wert, was } = el.dataset;
  if (S.ui?.art === 'menu' && akt !== 'menu' && !el.closest('.menu')) S.ui = null;
  switch (akt) {
    case 'tab': S.tab = wert; S.ui = null; S.tagWahl = null; break;
    case 'filter': S.filter = wert; S.buch = null; S.tagWahl = null; break;
    case 'dabei':
      if (S.dabei.has(wert) && S.dabei.size > 1) S.dabei.delete(wert); else S.dabei.add(wert);
      break;
    case 'gelesen': S.ui = null; lesen(ort === 'kachel' ? 'kachel' : ort, el.dataset.abo ?? ersterPlan()); return;
    case 'menu':
      S.ui = S.ui?.art === 'menu' && S.ui.was === was && S.ui.wert === wert && S.ui.ort === ort ? null : { art: 'menu', ort, was, wert };
      break;
    case 'sheet': {
      // Ein Blatt ersetzt das andere (nie Blatt auf Blatt); das Abo kommt aus data-abo oder bleibt.
      const aboId = el.dataset.abo ?? S.ui?.aboId ?? ersterPlan();
      S.ui = { art: 'sheet', ort: ort === 'kachel' ? 'laptop' : ort, was, wert, aboId };
      if (was === 'aufholen') {
        const { st } = planSicht(aboId);
        Object.assign(S.ui, { start: st.gelesen, heuteOffen: !st.heuteGelesen, anzahl: st.verzug + (st.heuteGelesen ? 0 : 1) });
      }
      break;
    }
    case 'schliessen': S.ui = null; if (S.assistent) S.assistent = null; break;
    case 'eintragen': S.ui = { art: 'sheet', ort, was: 'eintragen', datum: wert || null }; break;
    case 'assistent': S.assistent = neuerAssistent(); S.ui = { art: 'sheet', ort, was: 'assistent' }; break;
    case 'assistent-weiter': S.assistent.schritt = Math.min(SCHRITTE.length, S.assistent.schritt + 1); break;
    case 'assistent-zurueck': S.assistent.schritt = Math.max(1, S.assistent.schritt - 1); break;
    case 'assistent-schritt': S.assistent.schritt = Number(wert); break;
    case 'assistent-wert': S.assistent[was] = was === 'minuten' ? Number(wert) : wert; break;
    case 'assistent-schalter': {
      const a = S.assistent;
      if (was === 'weisheit') a.weisheit = !a.weisheit;
      else a.parallelen[was.slice(2)] = !a.parallelen[was.slice(2)];
      break;
    }
    case 'assistent-buch': {
      const set = new Set(S.assistent.buecher);
      if (set.has(wert)) set.delete(wert); else set.add(wert);
      S.assistent.buecher = BUECHER.filter((b) => set.has(b.id)).map((b) => b.id);
      break;
    }
    case 'assistent-fertig': planAnlegen(ort); break;
    case 'uebernehmen': uebernehmen(ort, el.dataset.abo); break;
    case 'logbuch-wahl': S.ui.ziel = wert; break;
    case 'gelesen-blatt': lesen(ort, S.ui.aboId); return;
    case 'neu-einteilen': {
      const abo = ABOS[el.dataset.abo];
      const undo = neuEinteilen(abo);
      if (!undo) break;
      S.ui = null;
      toast(ort, `„${abo.name}“ neu eingeteilt`, undo);
      break;
    }
    case 'ziel-setzen': {
      const f = frame.querySelector('[data-form="ziel"]');
      const abo = ABOS[S.ui.aboId];
      const { st } = planSicht(abo.id);
      const neu = f.art.value === 'verzug' ? st.ende : (f.datum.value ? datum(f.datum.value) : null);
      if (!neu || neu <= HEUTE) { f.datum.focus(); return; }
      const eintrag = { am: tag(HEUTE), von: abo.ziel, nach: neu };
      abo.zielVerlauf.push(eintrag);
      abo.ziel = neu;
      S.ui = null;
      toast(ort, `Ziel auf ${fmtDatum(neu)} verschoben`, () => {
        abo.ziel = eintrag.von;
        abo.zielVerlauf.splice(abo.zielVerlauf.indexOf(eintrag), 1);
      });
      break;
    }
    case 'eintrag-speichern': eintragSpeichern(frame); return;
    case 'bearbeiten': S.ui = { art: 'sheet', ort, was: 'eintragen', edit: wert }; break;
    case 'loeschen': {
      const l = alleLesungen().find((x) => x.id === wert);
      l.geloescht = true;
      S.ui = null;
      toast(ort, 'Eintrag gelöscht', () => { l.geloescht = false; });
      break;
    }
    case 'gelesen-am': {
      const am = frame.querySelector('#f-am').value || tag(plusTage(HEUTE, -1));
      const aboId = S.ui.aboId;
      S.ui = null;
      lesen(ort, aboId, am);
      return;
    }
    case 'monat': {
      const d = new Date(S.monat.j, S.monat.m + Number(wert), 1);
      if (d > HEUTE) return;
      S.monat = { j: d.getFullYear(), m: d.getMonth() };
      S.tagWahl = null;
      break;
    }
    case 'tag': S.tagWahl = S.tagWahl === wert ? null : wert; if (S.tab !== 'logbuch') S.tab = 'logbuch'; break;
    case 'tag-alle': S.tagWahl = null; break;
    case 'buch':
      S.buch = wert;
      if (ort === 'handy') S.ui = { art: 'sheet', ort, was: 'buch', wert };
      break;
    case 'einst': {
      if (was === 'gemeinsamZaehlt') S.einst.gemeinsamZaehlt = !S.einst.gemeinsamZaehlt; else S.einst[was] = wert;
      S.saved = was;
      setTimeout(() => { if (S.saved === was) { S.saved = null; render(); } }, 2000);
      break;
    }
    case 'erneut': {
      const n = S.warteschlange;
      S.szenario = 'normal';
      S.warteschlange = 0;
      toast(ort, n ? `Wieder verbunden · ${n === 1 ? '1 Eintrag' : `${n} Einträge`} nachgetragen` : 'Wieder verbunden');
      break;
    }
    case 'undo': S.toast?.undo?.(); S.toast = null; break;
    default: return;
  }
  render();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.ui) { S.ui = null; S.assistent = null; render(); }
});

// Formularfelder: „Ziel verschieben“ aktualisiert seine Vorschau am Ort (der Fokus bleibt im Feld),
// der Assistent übernimmt Auswahlfelder sofort und den Namen ohne neu zu zeichnen.
document.addEventListener('input', (e) => {
  const zf = e.target.closest('[data-form="ziel"]');
  if (zf && S.ui?.was === 'ziel') {
    if (e.target.name === 'datum') zf.querySelector('input[value="datum"]').checked = true;
    S.ui.zielArt = zf.art.value;
    S.ui.datumWert = zf.datum.value;
    const { st, abo } = planSicht(S.ui.aboId);
    const d = S.ui.zielArt === 'verzug' ? st.ende : (zf.datum.value ? datum(zf.datum.value) : null);
    zf.querySelector('[data-vorschau]').textContent = zielVorschau(abo, d);
    return;
  }
  if (e.target.closest('[data-form="assistent"]') && e.target.name === 'name') S.assistent.name = e.target.value;
});
document.addEventListener('change', (e) => {
  if (!e.target.closest('[data-form="assistent"]') || !S.assistent) return;
  if (assistentFeld(e.target)) render();
});

// Tooltip: eigener Hover-Layer für Kalender, Kacheln, Raster und Balken.
let tipEl = null;
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  const frame = e.target.closest('[data-frame]');
  tipEl?.remove();
  tipEl = null;
  if (!el || !frame) return;
  const z = Number(frame.closest('.mk-zoom')?.style.zoom || 1);
  const r = el.getBoundingClientRect();
  const fr = frame.getBoundingClientRect();
  tipEl = document.createElement('div');
  tipEl.className = 'tip';
  tipEl.textContent = el.dataset.tip;
  tipEl.style.left = `${(r.left + r.width / 2 - fr.left) / z}px`;
  tipEl.style.top = `${(r.top - fr.top) / z}px`;
  frame.append(tipEl);
});

window.addEventListener('resize', zoom);
render();
