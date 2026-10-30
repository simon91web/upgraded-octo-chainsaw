// Die Reiter der Seite als HTML (aus dem freigegebenen Mockup). Jede Funktion bekommt den
// Zustand `S` und gibt Markup zurück; Nutzerdaten gehen immer durch esc().

import {
  esc, ic, stelleHtml, NBSP, zahl, dezimal, prozent, anteil, min, einheiten, lesungenText, eintraegeText,
  WT2, MON, MON3, fmtDatum, kurzDatum, tagKopf, plusTage, wochentag, statistik,
} from './werkzeug.js';

export const ART = {
  gemeinsam: { icon: 'users', name: 'Gemeinsam', lang: 'Alle im Haushalt' },
  privat: { icon: 'lock', name: 'Nur für mich', lang: 'Nur für mich' },
  sichtbar: { icon: 'eye', name: 'Für mich, sichtbar', lang: 'Für mich, sichtbar für alle' },
};

export const meinePlaene = (S) => S.plaene.filter((p) => p.eigen || p.art === 'gemeinsam')
  .sort((a, b) => (a.art === 'gemeinsam' ? 0 : 1) - (b.art === 'gemeinsam' ? 0 : 1) || a.id - b.id);
export const vonAnderen = (S) => S.plaene.filter((p) => !p.eigen && p.art === 'sichtbar');
const person = (S, id) => S.mitglieder.find((m) => m.id === id);
const buchName = (S, id) => (S.bibel?.hat(id) ? S.bibel.buch(id).name : id);

// ------------------------------------------------------------------ Stellentexte
//
// Die Texte rechnet das Modul selbst aus den Stellen (Kern und Bibeldaten sind geladen). Der Dienst
// liefert nur Stellen; eine Änderung an der Darstellung braucht so nur das ZIP, keinen neuen Dienst.

const nebenCache = new Map();
function zweitVon(S, rezept) {
  if (!rezept?.straenge) return null;
  const k = JSON.stringify(rezept.straenge);
  if (!nebenCache.has(k)) nebenCache.set(k, S.kern.nebenBuecher(S.bibel, rezept));
  return nebenCache.get(k);
}

/**
 * Hauptstelle, zweiter Strang, Parallelstellen und der ganze Text einer Einheit.
 * `rezept` bestimmt den zweiten Strang. Ohne Stellen (sehr alter Dienst) gilt `ersatz`.
 */
export function stellenTexte(S, stuecke, rezept, { ersatz = '' } = {}) {
  if (!stuecke?.length || !S.kern?.einheitTeile) return { haupt: ersatz, zweit: null, dazu: null, text: ersatz };
  const zweit = zweitVon(S, rezept);
  const t = S.kern.einheitTeile(S.bibel, stuecke, { zweit });
  return { haupt: t.haupt?.text ?? '', zweit: t.zweit?.text ?? null, dazu: t.dazu?.text ?? null, text: S.kern.einheitText(S.bibel, stuecke, { zweit }) };
}

/** Der Text dessen, was ohne die herausgenommenen Teile gelesen wurde. */
export const gelesenText = (t, ohne = new Set()) => [t.haupt, !ohne.has('zweit') && t.zweit, !ohne.has('dazu') && t.dazu && `dazu ${t.dazu}`]
  .filter(Boolean).join(' · ');

/** Die nächste Einheit eines Plans als Texte. */
export const naechsteTexte = (S, p) => stellenTexte(S, p.naechste?.stuecke, p.rezept, { ersatz: p.naechste?.text ?? '' });

/**
 * Ein Logbuch-Eintrag: Gelesenes, die ganze Einheit (für die Haken im Blatt), welche Nebenteile sie
 * hatte und welche davon ausgelassen sind, und „Ausgelassen: …“ als Liste ohne „dazu“.
 */
export function eintragTexte(S, l) {
  const rezept = l.quelle === 'plan' ? S.plaene.find((p) => p.id === l.planId)?.rezept : null;
  const aus = l.ausgelassenStuecke ?? [];
  const gelesen = stellenTexte(S, l.stuecke, rezept, { ersatz: l.text });
  const ganz = stellenTexte(S, [...l.stuecke, ...aus], rezept, { ersatz: l.text });
  const hat = l.quelle === 'plan' ? ['zweit', 'dazu'].filter((t) => ganz[t]) : [];
  const ausgelassen = aus.length ? stellenTexte(S, aus.map(({ parallel, ...s }) => s), null).text : (l.ausgelassen ?? null);
  return { gelesen, ganz, hat, ohne: hat.filter((t) => !gelesen[t]), ausgelassen };
}

export const TABS = [['heute', 'Heute'], ['plaene', 'Pläne'], ['fortschritt', 'Fortschritt'], ['logbuch', 'Logbuch'], ['statistik', 'Statistik']];

export function reiter(S) {
  return `<div class="bl-tabs" role="tablist" aria-label="Ansicht">${TABS.map(([id, l]) =>
    `<button type="button" class="sub-tab${S.tab === id ? ' sub-tab--active' : ''}" role="tab" aria-selected="${S.tab === id}" data-akt="tab" data-wert="${id}">${l}</button>`).join('')}</div>`;
}

export function menuAnker(S, was, wert, label, klasse = 'btn btn--secondary btn--icon') {
  const offen = S.ui?.art === 'menu' && S.ui.was === was && String(S.ui.wert) === String(wert);
  return `<span class="bl-anker"><button type="button" class="${klasse}" data-akt="menu" data-was="${was}" data-wert="${esc(wert)}" aria-label="${esc(label)}" aria-expanded="${offen}" aria-haspopup="menu">${ic('ellipsis')}</button>${offen ? menu(S, was, wert) : ''}</span>`;
}

export function menu(S, was, wert) {
  let items = '';
  const a = `data-plan="${esc(wert)}"`;
  if (was === 'einheit') {
    const p = S.plaene.find((x) => String(x.id) === String(wert));
    items = `${p?.darfAbhaken ? `<button type="button" role="menuitem" data-akt="blatt" data-was="gelesenAm" ${a}>${ic('calendar-clock')}An einem anderen Tag gelesen …</button>` : ''}
      <button type="button" role="menuitem" data-akt="blatt" data-was="plan" ${a}>${ic('list')}Plan ansehen</button>
      ${p?.stand.verzug && p.darfAbhaken ? `<button type="button" role="menuitem" data-akt="blatt" data-was="aufholen" ${a}>${ic('fast-forward')}Aufholen …</button>` : ''}
      ${!p?.stand.ohneRhythmus && p?.darfAendern ? `<button type="button" role="menuitem" data-akt="blatt" data-was="ziel" ${a}>${ic('calendar-range')}Ziel verschieben …</button>` : ''}
      <hr><button type="button" role="menuitem" data-akt="blatt" data-was="einstellungen">${ic('settings')}Einstellungen</button>`;
  } else if (was === 'kopf') {
    items = `<button type="button" role="menuitem" data-akt="tab" data-wert="plaene">${ic('list')}Pläne verwalten</button>
      <button type="button" role="menuitem" data-akt="blatt" data-was="einstellungen">${ic('settings')}Einstellungen</button>`;
  } else if (was === 'neu') {
    items = `<button type="button" role="menuitem" data-akt="eintragen">${ic('pen-line')}Eintrag</button>
      <button type="button" role="menuitem" data-akt="assistent">${ic('list-plus')}Leseplan</button>`;
  } else if (was === 'eintrag') {
    items = `<button type="button" role="menuitem" data-akt="bearbeiten" data-wert="${esc(wert)}">${ic('pencil')}Bearbeiten</button>
      <hr><button type="button" role="menuitem" class="bl-danger" data-akt="loeschen" data-wert="${esc(wert)}">${ic('trash-2')}Löschen</button>`;
  }
  return `<div class="bl-menu" role="menu">${items}</div>`;
}

const spalten = (S, main, rail) => (S.breit
  ? `<div class="bl-columns"><div class="bl-col">${main}</div><div class="bl-col">${rail}</div></div>`
  : `<div class="bl-col">${main}${rail}</div>`);

export function filterLeiste(S) {
  const chips = [['alle', 'Alles von mir'], ...meinePlaene(S).map((p) => [String(p.id), p.name])];
  return `<div class="bl-chips" role="group" aria-label="Plan">${chips.map(([id, l]) =>
    `<button type="button" class="bl-chip" aria-pressed="${String(S.filter) === id}" data-akt="filter" data-wert="${id}">${esc(l)}</button>`).join('')}</div>`;
}

// ------------------------------------------------------------------ Heute

export function heute(S) {
  const plaene = meinePlaene(S);
  const karten = plaene.map((p, i) => heuteKarte(S, p, { primaer: i === 0 })).join('');
  const leer = plaene.some((p) => p.art !== 'gemeinsam') ? '' : `<section class="bl-carrier">${leerPlan(S)}</section>`;
  if (S.breit) return spalten(S, karten + leer, geradeDran(S, plaene) + kalenderKarte(S));
  return spalten(S, karten + leer + wocheKarte(S), geradeDran(S, plaene));
}

export function leerPlan(S) {
  return `<div class="bl-empty"><span class="bl-empty__icon">${ic('book-open')}</span>
    <h3>Noch kein eigener Plan</h3>
    <p>Stell dir einen Plan zusammen oder trag ein, was du liest.</p>
    ${S.ich.darfSchreiben ? `<div class="bl-empty__actions"><button type="button" class="btn btn--secondary" data-akt="assistent">${ic('list-plus')}Plan erstellen</button>
    <button type="button" class="btn btn--secondary" data-akt="eintragen">Frei eintragen</button></div>` : ''}</div>`;
}

/**
 * Zweiter Strang (Feder) und Parallelstellen (Spalten) unter der Hauptstelle, eine Stufe leiser.
 * Mit `schalter` tragen sie einen gesetzten Haken wie „Dabei“: ein Tipp nimmt die Stelle heraus,
 * sie zählt dann nicht als gelesen. `schalter(teil)` liefert die data-Attribute des Knopfs.
 * `fest` setzt die Hauptstelle mit festem Haken davor (sie lässt sich nicht herausnehmen).
 */
export function nebenZeilen(teile, { schalter = null, ohne = new Set(), fest = false } = {}) {
  const zeilen = [['zweit', 'feather', teile?.zweit], ['dazu', 'columns-2', teile?.dazu && `dazu ${teile.dazu}`]]
    .filter(([, , text]) => text)
    .map(([teil, icon, text]) => {
      const inhalt = `${ic(icon)}<span class="bl-neben__text">${stelleHtml(text)}</span>`;
      if (!schalter) return `<div class="bl-neben__zeile bl-neben__zeile--${teil}">${inhalt}</div>`;
      const an = !ohne.has(teil);
      return `<button type="button" class="bl-neben__zeile bl-neben__zeile--${teil}" ${schalter(teil)} aria-pressed="${an}"
        title="${an ? 'Mitgelesen – tippen zum Herausnehmen' : 'Nicht mitgelesen – tippen zum Mitzählen'}">${inhalt}<span class="bl-haken">${ic('check')}</span></button>`;
    });
  if (fest) zeilen.unshift(`<div class="bl-neben__zeile bl-neben__zeile--fest"><span class="bl-neben__text">${stelleHtml(teile.haupt)}</span><span class="bl-haken bl-haken--fest">${ic('check')}</span></div>`);
  return zeilen.length ? `<div class="bl-neben">${zeilen.join('')}</div>` : '';
}

/** Hat die Einheit etwas, das man beim Abhaken herausnehmen kann? */
export const hatNeben = (teile) => Boolean(teile?.zweit || teile?.dazu);

/**
 * Die Nachfrage nach „Gelesen“, wenn die Einheit Nebenstellen hat, Nebenstellen vorausgewählt.
 * Auf der Karte steht die Hauptstelle schon als Titel darüber, gefragt wird nur nach dem, was
 * dazukommt; anderswo (`fest`) steht sie mit festem Haken in der Liste. Die Knöpfe „Abbrechen“
 * und „Eintragen“ setzt der Aufrufer dorthin, wo „Gelesen“ stand.
 */
export function frageZeilen(S, p, teile, { fest = false } = {}) {
  return `<div class="bl-frage__titel" id="bl-frage-${p.id}">${fest ? 'Was hast du gelesen?' : 'Auch gelesen?'}</div>
    ${nebenZeilen(teile, { fest, ohne: S.ohne[p.id], schalter: (teil) => `data-akt="teil" data-plan="${p.id}" data-wert="${teil}"` })}`;
}

export const frageKnoepfe = (p, { klein = false } = {}) => `<button type="button" class="btn btn--ghost${klein ? ' btn--sm' : ''}" data-akt="frage-abbrechen" data-plan="${p.id}">Abbrechen</button>
  <button type="button" class="btn btn--primary${klein ? ' btn--sm' : ''}" data-akt="frage-eintragen" data-plan="${p.id}" aria-describedby="bl-frage-${p.id}">${ic('check')}Eintragen</button>`;

function heuteKarte(S, p, { primaer }) {
  const st = p.stand;
  if (!p.naechste) {
    return `<article class="bl-card bl-today"><div class="bl-today__eyebrow">${ic(ART[p.art].icon)}${esc(p.name)}</div>
      <div class="bl-today__ref">Fertig gelesen</div><div class="bl-today__unit">${lesungenText(st.anzahl)} · ${p.durchgang}. Durchgang</div>
      ${p.darfAendern ? `<div class="bl-today__actions"><button type="button" class="btn btn--secondary" data-akt="noch-einmal" data-plan="${p.id}">${ic('rotate-ccw')}Noch einmal</button></div>` : ''}</article>`;
  }
  const gemeinsam = p.art === 'gemeinsam';
  const gerade = S.gerade[p.id];
  const busy = S.busy === p.id;
  const aufholen = st.heuteGelesen && st.verzug > 0;
  const dabei = gemeinsam && p.darfAbhaken ? `<div class="bl-today__dabei"><span class="bl-today__label">Dabei</span><div class="bl-avatars">${S.mitglieder.map((m) =>
    `<button type="button" class="bl-avatar" style="--av:${esc(m.avatar_color || '#6C3AED')}" aria-pressed="${S.dabei.has(m.id)}" data-akt="dabei" data-wert="${m.id}" aria-label="${esc(m.display_name)}" title="${esc(m.display_name)}">
      <span class="bl-avatar__face">${esc((m.display_name || '?').slice(0, 1).toUpperCase())}</span><span class="bl-avatar__tick">${ic('check')}</span></button>`).join('')}</div></div>` : '';
  const knopf = `btn ${primaer ? 'btn--primary' : 'btn--secondary'}`;
  const teile = naechsteTexte(S, p);
  // Nachfrage offen: nur in der Karte, solange kein Blatt darüber liegt.
  const fragen = S.frage === p.id && !S.ui;
  return `<article class="bl-card bl-today${primaer ? '' : ' bl-today--compact'}" aria-label="${esc(p.name)}">
    <div class="bl-today__eyebrow">${ic(ART[p.art].icon)}${esc(p.name)}
      ${menuAnker(S, 'einheit', p.id, `Mehr zu ${p.name}`, 'btn btn--ghost btn--icon')}</div>
    ${gerade ? `<div class="bl-today__done"><span class="bl-ring bl-ring--done">${ic('check')}</span>${esc(gerade.text)} gelesen · ${esc(gerade.uhrzeit)}</div>` : ''}
    <div class="bl-today__ref">${stelleHtml(teile.haupt)}</div>
    ${fragen ? frageZeilen(S, p, teile) : nebenZeilen(teile)}
    <div class="bl-today__unit bl-tabnum">Einheit ${p.naechste.nr} von ${zahl(st.anzahl)} · ${min(p.naechste.minuten)}${aufholen ? ' · zum Aufholen' : ''}</div>
    ${zielStatus(p)}
    ${dabei}
    ${p.darfAbhaken ? `<div class="bl-today__actions">${fragen && !busy ? frageKnoepfe(p) : `<button type="button" class="${knopf}" data-akt="gelesen" data-plan="${p.id}"${busy ? ' aria-busy="true" disabled' : ''}>${busy ? 'Wird gespeichert …' : `${ic('check')}Gelesen`}</button>`}</div>` : ''}
  </article>`;
}

/** Ziel und Verzug. Bis 2 Einheiten Rückstand nur das Ziel; darüber Warnfarbe und die Auswege. */
export function zielStatus(p) {
  const st = p.stand;
  if (st.ohneRhythmus) return `<div class="bl-today__meta"><span class="bl-state">${ic('infinity')}Ohne festen Rhythmus</span></div>`;
  const ziel = fmtDatum(st.ziel);
  const a = `data-plan="${p.id}"`;
  if (st.verzug > 2) {
    const auswege = [
      p.darfAbhaken ? `<button type="button" class="btn btn--ghost btn--sm" data-akt="blatt" data-was="aufholen" ${a}>${ic('fast-forward')}Aufholen</button>` : '',
      p.darfAendern ? `<button type="button" class="btn btn--ghost btn--sm" data-akt="blatt" data-was="ziel" ${a}>${ic('calendar-range')}Ziel verschieben</button>` : '',
    ];
    if (st.grosserVerzug) auswege.reverse();
    return `<div class="bl-today__meta"><span class="bl-state bl-state--warn">${ic('hourglass')}${einheiten(st.verzug)} im Verzug</span>
        <span>so wird es der ${fmtDatum(st.ende)}</span></div>
      ${auswege.join('') ? `<div class="bl-today__fix">${auswege.join('')}</div>` : ''}`;
  }
  if (st.verzug > 0) return `<div class="bl-today__meta"><span class="bl-state">${ic('flag')}Ziel ${ziel}</span></div>`;
  if (st.vorsprung > 0) return `<div class="bl-today__meta"><span class="bl-state bl-state--ok">${ic('check')}${einheiten(st.vorsprung)} Vorsprung</span><span>Ziel ${ziel}</span></div>`;
  return `<div class="bl-today__meta"><span class="bl-state bl-state--ok">${ic('check')}Im Plan</span><span>Ziel ${ziel}</span></div>`;
}

export function kurzStatus(st) {
  if (st.ohneRhythmus) return ['', 'Ohne festen Rhythmus'];
  if (st.rest === 0) return ['bl-state--ok', 'Fertig gelesen'];
  if (st.verzug > 2) return ['bl-state--warn', `${einheiten(st.verzug)} im Verzug`];
  if (st.verzug > 0) return ['', `Ziel ${fmtDatum(st.ziel)}`];
  if (st.vorsprung > 0) return ['bl-state--ok', `${einheiten(st.vorsprung)} Vorsprung`];
  return ['bl-state--ok', 'Im Plan'];
}

function geradeDran(S, plaene) {
  const f = S.fortschrittAlle;
  const zeilen = plaene.filter((p) => p.aktuellesBuch).map((p) => {
    const b = S.bibel.buch(p.aktuellesBuch);
    const n = f?.jeBuch[b.id]?.gelesen ?? 0;
    return `<div class="bl-meter"><div class="bl-meter__head"><b>${esc(b.name)}</b><span>${n} von ${b.kapitel}</span></div>
      <div class="bl-bar"><span style="transform:scaleX(${anteil(n, b.kapitel)})"></span></div><div class="bl-footnote">${esc(p.name)}</div></div>`;
  }).join('');
  const gesamt = f?.gesamt ?? 0;
  return `<section class="bl-carrier"><div class="bl-stack">
      <h3 class="bl-card-title">Gerade dran</h3>${zeilen}
      <div class="bl-meter bl-meter--sum"><div class="bl-meter__head"><b>Ganze Bibel</b><span>${zahl(gesamt)} von ${zahl(1189)} · ${prozent(gesamt, 1189)}</span></div>
        <div class="bl-bar"><span style="transform:scaleX(${anteil(gesamt, 1189)})"></span></div><div class="bl-footnote">Alles von mir</div></div>
    </div>
    <button type="button" class="bl-row bl-row--link bl-row--sep" data-akt="tab" data-wert="fortschritt">Fortschritt${ic('chevron-right')}</button></section>`;
}

function wocheKarte(S) {
  const stat = statistik(S.lesungenAlle, S.heute, S.monat);
  const montag = plusTage(S.heute, -((wochentag(S.heute) + 6) % 7));
  let gelesen = 0;
  let bisher = 0;
  const tage = Array.from({ length: 7 }, (_, i) => {
    const t = plusTage(montag, i);
    const n = stat.proTag.get(t)?.length ?? 0;
    const zukunft = t > S.heute;
    const istHeute = t === S.heute;
    if (!zukunft && (!istHeute || n)) { bisher++; if (n) gelesen++; }
    return `<div class="bl-week__day" title="${kurzDatum(t, S.heute)} · ${n ? eintraegeText(n) : 'nichts eingetragen'}">${WT2[wochentag(t)]}
      <span class="bl-week__num${istHeute ? ' bl-week__num--today' : ''}${zukunft ? ' bl-week__num--future' : ''}">${Number(t.slice(8, 10))}</span>
      <span class="bl-dots bl-dots--sm">${'<i></i>'.repeat(Math.min(4, n))}</span></div>`;
  }).join('');
  return `<section class="bl-carrier"><div class="bl-pad">
    <h3 class="bl-card-title">Diese Woche<small>an ${gelesen} von ${bisher} Tagen gelesen</small></h3>
    <div class="bl-week">${tage}</div></div>
    <button type="button" class="bl-row bl-row--link bl-row--sep" data-akt="tab" data-wert="logbuch">Logbuch${ic('chevron-right')}</button></section>`;
}

// ------------------------------------------------------------------ Pläne

export function plaene(S) {
  const zeile = (p) => {
    const st = p.stand;
    const [cls, text] = kurzStatus(st);
    return `<button type="button" class="bl-row" data-akt="blatt" data-was="plan" data-plan="${p.id}">
      <span class="bl-row__well">${ic(ART[p.art].icon)}</span>
      <div class="bl-row__main"><span class="bl-row__title">${esc(p.name)}</span>
        <span class="bl-row__meta">${esc(rezeptText(S, p))}</span>
        <span class="bl-row__meta bl-tabnum">${ART[p.art].lang} · Einheit ${Math.min(st.gelesen + 1, st.anzahl)} von ${zahl(st.anzahl)} · <span class="bl-state ${cls}">${text}</span></span>
        <div class="bl-bar bl-bar--thin"><span style="transform:scaleX(${anteil(st.gelesen, st.anzahl)})"></span></div></div>
      ${ic('chevron-right')}</button>`;
  };
  const gemeinsam = meinePlaene(S).filter((p) => p.art === 'gemeinsam');
  const eigene = meinePlaene(S).filter((p) => p.art !== 'gemeinsam');
  const andere = vonAnderen(S);
  const andereZeilen = andere.map((p) => `<div class="bl-row"><span class="bl-row__well">${ic('eye')}</span>
      <button type="button" class="bl-row__main bl-plain" data-akt="blatt" data-was="plan" data-plan="${p.id}"><span class="bl-row__title">${esc(p.name)}</span>
        <span class="bl-row__meta">${esc(person(S, p.besitzer)?.display_name ?? 'Jemand')} · ${esc(rezeptText(S, p))} · ${lesungenText(p.stand.anzahl)}</span></button>
      ${p.uebernommen ? `<span class="bl-state bl-state--ok">${ic('check')}Übernommen</span>`
        : S.ich.darfSchreiben ? `<button type="button" class="btn btn--secondary btn--sm" data-akt="uebernehmen" data-plan="${p.id}">Übernehmen</button>` : ''}</div>`).join('');
  const main = `
    ${gemeinsam.length ? `<section class="bl-section"><h2 class="bl-section-title">Gemeinsam</h2><div class="bl-carrier bl-rows">${gemeinsam.map(zeile).join('')}</div></section>` : ''}
    <section class="bl-section"><h2 class="bl-section-title">Für mich</h2>
      ${eigene.length ? `<div class="bl-carrier bl-rows">${eigene.map(zeile).join('')}</div>` : `<section class="bl-carrier">${leerPlan(S)}</section>`}</section>
    ${andere.length ? `<section class="bl-section"><h2 class="bl-section-title">Von anderen</h2><div class="bl-carrier bl-rows">${andereZeilen}</div></section>` : ''}`;
  return S.breit ? `<div class="bl-columns"><div class="bl-col">${main}</div><div class="bl-col"></div></div>` : `<div class="bl-col">${main}</div>`;
}

/** Kurzbeschreibung eines Rezepts: „Ganze Bibel · ab Jesaja · bis 28.10.2027 · täglich“. */
export function rezeptText(S, p) {
  const r = p.rezept;
  const s0 = r.straenge[0];
  const auswahl = Array.isArray(s0.buecher)
    ? (s0.buecher.length <= 2 ? s0.buecher.map((id) => buchName(S, id)).join(' und ') : `${buchName(S, s0.buecher[0])} und ${s0.buecher.length - 1} weitere`)
    : s0.buecher === 'bibel' ? 'Ganze Bibel' : s0.buecher === 'at' ? 'Altes Testament' : s0.buecher === 'nt' ? 'Neues Testament'
      : (S.bibel.gruppen.find((g) => `gruppe:${g.id}` === s0.buecher)?.name ?? s0.buecher);
  const teile = [auswahl + (r.straenge.length > 1 ? ' mit Weisheit' : '')];
  if (s0.start) teile.push(`ab ${buchName(S, s0.start.split('.')[0])}`);
  teile.push(r.ziel.datum ? `bis ${fmtDatum(r.ziel.datum)}` : `${r.ziel.minuten} Min. je Lesung`);
  teile.push(rhythmusText(r.lesetage));
  return teile.join(' · ');
}

export const RHYTHMEN = [
  { id: 'taeglich', name: 'Täglich', tage: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'mo-sa', name: 'Mo–Sa', tage: [1, 2, 3, 4, 5, 6] },
  { id: 'werktags', name: 'Mo–Fr', tage: [1, 2, 3, 4, 5] },
  { id: 'frei', name: 'Ohne festen Rhythmus', tage: null },
];
export const rhythmusText = (tage) => RHYTHMEN.find((r) => String(r.tage) === String(tage ?? null))?.name
  ?? tage.map((d) => WT2[d]).join(', ');

// ------------------------------------------------------------------ Kalender

export function kalenderKarte(S, { voll = false } = {}) {
  const lesungen = String(S.filter) === 'alle' || S.tab === 'heute' ? S.lesungenAlle : S.lesungenFilter;
  const stat = statistik(lesungen, S.heute, S.monat);
  const { j, m } = { j: S.monat.jahr, m: S.monat.monat };
  const ersterTag = `${j}-${String(m + 1).padStart(2, '0')}-01`;
  const versatz = (wochentag(ersterTag) + 6) % 7;
  const tageImMonat = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
  const zellen = [];
  for (let i = 0; i < versatz; i++) zellen.push('<span></span>');
  for (let d = 1; d <= tageImMonat; d++) {
    const t = `${j}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = stat.proTag.get(t)?.length ?? 0;
    const zukunft = t > S.heute;
    const cls = ['bl-cal__day', t === S.heute && 'bl-cal__day--today', S.tagWahl === t && 'bl-cal__day--sel', zukunft && 'bl-cal__day--future'].filter(Boolean).join(' ');
    const tip = `${kurzDatum(t, S.heute)} · ${n ? eintraegeText(n) : 'nichts eingetragen'}`;
    zellen.push(zukunft
      ? `<span class="${cls}"><span class="bl-cal__num">${d}</span></span>`
      : `<button type="button" class="${cls}" data-akt="tag" data-wert="${t}" title="${tip}" aria-label="${tip}" aria-pressed="${S.tagWahl === t}">
          <span class="bl-cal__num">${d}</span><span class="bl-dots">${'<i></i>'.repeat(Math.min(4, n))}</span></button>`);
  }
  const aktuell = S.heute.startsWith(ersterTag.slice(0, 7));
  return `<section class="bl-carrier"><div class="bl-pad">
    <div class="bl-cal__head"><b>${MON[m]} ${j}</b>
      <button type="button" class="btn btn--ghost btn--icon" data-akt="monat" data-wert="-1" aria-label="Voriger Monat">${ic('chevron-left')}</button>
      <button type="button" class="btn btn--ghost btn--icon" data-akt="monat" data-wert="1" aria-label="Nächster Monat"${aktuell ? ' disabled title="Später als heute gibt es nichts"' : ''}>${ic('chevron-right')}</button></div>
    <div class="bl-cal__grid">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w) => `<span class="bl-cal__wd">${w}</span>`).join('')}${zellen.join('')}</div>
    <div class="bl-cal__foot"><span class="bl-dots"><i></i></span>je Eintrag<span class="bl-tabnum" style="margin-left:auto">an ${stat.lesetageImMonat} von ${stat.tageImMonat} Tagen</span></div></div>
    ${voll ? '' : `<button type="button" class="bl-row bl-row--link bl-row--sep" data-akt="tab" data-wert="logbuch">Logbuch${ic('chevron-right')}</button>`}</section>`;
}

// ------------------------------------------------------------------ Fortschritt

export function fortschritt(S) {
  const f = S.fortschrittFilter;
  if (!f) return `${filterLeiste(S)}<div class="bl-card bl-skeleton" aria-busy="true">Lädt …</div>`;
  const p = String(S.filter) === 'alle' ? null : S.plaene.find((x) => String(x.id) === String(S.filter));
  const ntOffen = p && f.nt === 0 && p.ntAbDatum
    ? `<div class="bl-footnote">Beginnt mit Einheit ${p.ntAb} · voraussichtlich ${fmtDatum(p.ntAbDatum)}</div>` : '';
  const herkunft = p ? `${p.durchgang}. Durchgang seit ${fmtDatum(p.begonnenAm)}` : 'aus deinen Plänen und freien Einträgen';
  const kopf = `<section class="bl-card bl-prog">
    <div class="bl-prog__big bl-tabnum">${prozent(f.gesamt, 1189)}</div>
    <div class="bl-prog__sub bl-tabnum">${zahl(f.gesamt)} von ${zahl(1189)} Kapiteln · ${herkunft}</div>
    <div class="bl-bar bl-bar--lg"><span style="transform:scaleX(${anteil(f.gesamt, 1189)})"></span></div>
    <div class="bl-prog__rows">
      <div class="bl-meter"><div class="bl-meter__head"><b>Altes Testament</b><span>${f.at} von 929 · ${prozent(f.at, 929)}</span></div>
        <div class="bl-bar"><span style="transform:scaleX(${anteil(f.at, 929)})"></span></div></div>
      <div class="bl-meter"><div class="bl-meter__head"><b>Neues Testament</b><span>${f.nt} von 260 · ${prozent(f.nt, 260)}</span></div>
        <div class="bl-bar"><span style="transform:scaleX(${anteil(f.nt, 260)})"></span></div>${ntOffen}</div>
    </div></section>`;
  const gewaehlt = S.buch ?? (p ?? meinePlaene(S).find((x) => x.aktuellesBuch))?.aktuellesBuch ?? 'Gen';
  const testament = (t) => `<section class="bl-section"><h2 class="bl-section-title">${t === 'AT' ? 'Altes Testament' : 'Neues Testament'}</h2>
    <div class="bl-card">${S.bibel.gruppen.filter((g) => g.testament === t).map((g) => {
      const gr = f.jeGruppe[g.id] ?? { gelesen: 0, von: 1 };
      return `<div class="bl-group"><h3 class="bl-group__head">${esc(g.name)}<span>${prozent(gr.gelesen, gr.von)}</span></h3>
        <div class="bl-tiles">${S.bibel.buecher.filter((b) => b.gruppe === g.id).map((b) => kachel(S, b, f, p, gewaehlt)).join('')}</div></div>`;
    }).join('')}</div></section>`;
  const main = kopf + testament('AT') + testament('NT');
  // Der Filter steht über beiden Spalten, damit die Karten links und rechts auf einer Höhe beginnen.
  return S.breit ? filterLeiste(S) + spalten(S, main, buchDetail(S, gewaehlt)) : `<div class="bl-col">${filterLeiste(S)}${main}</div>`;
}

function kachel(S, b, f, p, gewaehlt) {
  const n = f.jeBuch[b.id]?.gelesen ?? 0;
  const fertig = n === b.kapitel;
  const jetzt = p?.aktuellesBuch === b.id && p.naechste;
  const cls = ['bl-tile', fertig && 'bl-tile--done', jetzt && !fertig && 'bl-tile--now'].filter(Boolean).join(' ');
  const tip = `${b.name} · ${n} von ${b.kapitel}${jetzt ? ' · gerade dran' : ''}`;
  return `<button type="button" class="${cls}" data-akt="buch" data-wert="${b.id}" title="${tip}" aria-label="${tip}" aria-pressed="${S.breit && gewaehlt === b.id}">
    ${esc(b.abk)}<small>${fertig ? '100 %' : n ? prozent(n, b.kapitel) : NBSP}</small>
    ${!fertig && n ? `<span class="bl-tile__bar"><span style="width:${anteil(n, b.kapitel) * 100}%"></span></span>` : ''}</button>`;
}

export function buchDetail(S, id, { ohneRahmen = false } = {}) {
  const b = S.bibel.buch(id);
  const f = S.fortschrittFilter;
  const kap = f?.jeBuch[id]?.kapitel ?? {};
  const p = String(S.filter) === 'alle' ? null : S.plaene.find((x) => String(x.id) === String(S.filter));
  const naechste = new Set();
  for (const s of p?.naechste?.stuecke ?? []) if (s.b === id) for (let k = s.von[0]; k <= s.bis[0]; k++) naechste.add(k);
  const werte = Object.values(kap);
  const zellen = Array.from({ length: b.kapitel }, (_, i) => {
    const k = i + 1;
    const q = kap[k];
    const cls = naechste.has(k) ? 'bl-chapter--next' : q === 'plan' ? 'bl-chapter--plan' : q === 'frei' ? 'bl-chapter--frei' : '';
    const tip = `${b.stelle} ${k}${naechste.has(k) ? ' · als Nächstes' : q === 'plan' ? ' · im Plan gelesen' : q === 'frei' ? ' · frei gelesen' : ''}`;
    return `<span class="bl-chapter ${cls}" title="${tip}">${k}</span>`;
  }).join('');
  const stand = `${werte.length} von ${b.kapitel} · ${prozent(werte.length, b.kapitel)}`;
  // Im Blatt steht der Buchname schon im Kopf.
  const inhalt = `${ohneRahmen
    ? `<div class="bl-prog__sub bl-tabnum">${werte.length} von ${b.kapitel} Kapiteln gelesen · ${prozent(werte.length, b.kapitel)}</div>`
    : `<h3 class="bl-card-title">${esc(b.name)}<small class="bl-tabnum">${stand}</small></h3>`}
    <div class="bl-chapters">${zellen}</div>
    <div class="bl-legend"><span><i class="bl-legend--plan"></i>Gelesen</span>
      ${werte.includes('frei') ? '<span><i class="bl-legend--frei"></i>Frei gelesen</span>' : ''}
      ${naechste.size ? '<span><i class="bl-legend--next"></i>Als Nächstes</span>' : ''}
      <span><i class="bl-legend--offen"></i>Offen</span></div>`;
  return ohneRahmen ? inhalt : `<section class="bl-card">${inhalt}</section>`;
}

// ------------------------------------------------------------------ Logbuch

export function logbuch(S) {
  const lesungen = String(S.filter) === 'alle' ? S.lesungenAlle : S.lesungenFilter;
  const praefix = `${S.monat.jahr}-${String(S.monat.monat + 1).padStart(2, '0')}`;
  const liste = lesungen.filter((l) => (S.tagWahl ? l.datum === S.tagWahl : l.datum.startsWith(praefix)));
  const chip = S.tagWahl ? `<div><button type="button" class="bl-filter" data-akt="tag-alle" aria-label="Filter aufheben">${tagKopf(S.tagWahl, S.heute)}${ic('x')}</button></div>` : '';
  // Titel in der Karte wie beim Kalender daneben: beide Karten beginnen auf einer Höhe.
  const eintraege = liste.length
    ? `<section class="bl-carrier"><div class="bl-pad bl-pad--kopf"><h3 class="bl-card-title">Einträge<small class="bl-tabnum">${liste.length}</small></h3></div>
        <div class="bl-rows bl-rows--sep">${liste.map((l, i) => zeile(S, l, i === 0 || liste[i - 1].datum !== l.datum)).join('')}</div></section>`
    : `<section class="bl-carrier"><div class="bl-empty bl-empty--klein"><span class="bl-empty__icon">${ic('calendar-days')}</span>
        <h3>${S.tagWahl ? 'An diesem Tag nichts eingetragen' : 'In diesem Monat nichts eingetragen'}</h3>
        ${S.ich.darfSchreiben ? `<div class="bl-empty__actions"><button type="button" class="btn btn--secondary" data-akt="eintragen" data-wert="${S.tagWahl ?? ''}">Nachtragen</button></div>` : ''}</div></section>`;
  const kal = kalenderKarte(S, { voll: true });
  if (S.breit) return `<div class="bl-filterzeile">${filterLeiste(S)}${chip}</div>${spalten(S, eintraege, kal)}`;
  return `<div class="bl-col">${filterLeiste(S)}${kal}${chip}${eintraege}</div>`;
}

function zeile(S, l, ersterDesTages) {
  const namen = l.dabei ? (l.dabei.length >= S.mitglieder.length && S.mitglieder.length > 1 ? 'alle'
    : l.dabei.map((id) => person(S, id)?.display_name).filter(Boolean).join(', ')) : '';
  const planName = String(S.filter) === 'alle' && l.planName ? l.planName : null;
  const wer = !l.eigen ? person(S, l.personId)?.display_name : null;
  const meta = [planName, l.quelle === 'plan' ? `Einheit ${l.einheitNr}` : 'Frei eingetragen', l.uhrzeit, wer && !l.dabei ? `von ${wer}` : null, namen].filter(Boolean).join(' · ');
  const tag = Number(l.datum.slice(8, 10));
  const t = eintragTexte(S, l);
  return `<div class="bl-row${ersterDesTages ? '' : ' bl-row--same-day'}">
    <span class="bl-row__date${l.datum === S.heute ? ' bl-row__date--today' : ''}" aria-label="${tagKopf(l.datum, S.heute)}">${ersterDesTages ? `<b>${tag}</b>${WT2[wochentag(l.datum)]}` : ''}</span>
    <div class="bl-row__main"><span class="bl-row__title">${stelleHtml(t.gelesen.haupt)}</span>
      ${nebenZeilen(t.gelesen)}
      ${t.ausgelassen ? `<span class="bl-row__aus">Ausgelassen: ${stelleHtml(t.ausgelassen)}</span>` : ''}
      <span class="bl-row__meta">${esc(meta)}</span>
      ${l.notiz ? `<span class="bl-row__note">${esc(l.notiz)}</span>` : ''}</div>
    ${l.eigen || S.ich.admin ? menuAnker(S, 'eintrag', l.id, 'Mehr zum Eintrag', 'btn btn--ghost btn--icon') : ''}</div>`;
}

// ------------------------------------------------------------------ Statistik

export function statistikTab(S) {
  const lesungen = String(S.filter) === 'alle' ? S.lesungenAlle : S.lesungenFilter;
  const heuteMonat = { monat: Number(S.heute.slice(5, 7)) - 1, jahr: Number(S.heute.slice(0, 4)) };
  const s = statistik(lesungen, S.heute, heuteMonat);
  const gesamt = lesungen.length;
  const meistName = { Früh: 'Früh', Vormittag: 'Vormittags', Mittag: 'Mittags', Nachmittag: 'Nachmittags', Abend: 'Abends', Nacht: 'Nachts' }[s.meist.name];
  const je = dezimal(s.jeWoche);
  const monatName = MON[heuteMonat.monat];
  const seit = s.erster ? fmtDatum(s.erster) : '–';
  const kopf = S.breit
    ? `<div class="bl-metrics">
        <div class="bl-metric"><div class="bl-metric__label">Lesetage im ${monatName}</div><div class="bl-metric__value">${s.lesetageImMonat}<span class="bl-metric__unit">von ${s.tageImMonat}</span></div></div>
        <div class="bl-metric"><div class="bl-metric__label">Je Woche</div><div class="bl-metric__value">${je}<span class="bl-metric__unit">Tage</span></div><div class="bl-metric__note">letzte 8 Wochen</div></div>
        <div class="bl-metric"><div class="bl-metric__label">Meist gelesen</div><div class="bl-metric__value">${gesamt ? meistName : '–'}</div><div class="bl-metric__note">${gesamt ? `${prozent(s.meist.anzahl, gesamt)} der Einträge` : NBSP}</div></div>
        <div class="bl-metric"><div class="bl-metric__label">Einträge</div><div class="bl-metric__value">${zahl(gesamt)}</div><div class="bl-metric__note">seit ${seit}</div></div>
      </div>`
    : `<section class="bl-carrier bl-glance"><div class="bl-glance__lead"><span>Lesetage im ${monatName}</span><b>${s.lesetageImMonat} <small>von ${s.tageImMonat}</small></b></div>
        <div class="bl-glance__side"><span><b>${je}</b> Tage je Woche</span><span>Meist <b>${gesamt ? meistName.toLowerCase() : '–'}</b></span>
          <span><b>${zahl(gesamt)}</b> Einträge seit ${seit.slice(0, 6)}</span></div></section>`;
  const wt = balken(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], s.wochentage, (l, n) => `${l} · ${n} Lesetage`);
  const tz = balken(['Früh', 'Vorm.', 'Mittag', 'Nachm.', 'Abend', 'Nacht'], s.tageszeit.map((t) => t.anzahl),
    (l, n, i) => `${['5–9', '9–12', '12–15', '15–18', '18–22', '22–5'][i]} Uhr · ${n} Einträge`);
  return `${filterLeiste(S)}${kopf}
    <section class="bl-card"><h3 class="bl-card-title">Letzte 12 Monate<small class="bl-tabnum">${eintraegeText(gesamt)}</small></h3>${heatmap(S, s)}
      <div class="bl-legend"><span><i class="bl-legend--offen"></i>Nichts</span><span><i class="bl-legend--mid"></i>1 Eintrag</span><span><i class="bl-legend--plan"></i>2 und mehr</span></div></section>
    <div class="bl-pair">
      <section class="bl-card"><h3 class="bl-card-title">Nach Wochentag<small>Lesetage</small></h3>${wt}</section>
      <section class="bl-card"><h3 class="bl-card-title">Nach Tageszeit<small>Einträge</small></h3>${tz}</section>
    </div>`;
}

function heatmap(S, s) {
  const wochen = 53;
  const montag = plusTage(S.heute, -((wochentag(S.heute) + 6) % 7));
  const start = plusTage(montag, -(wochen - 1) * 7);
  const zellen = [];
  const monate = [];
  for (let w = 0; w < wochen; w++) {
    for (let d = 0; d < 7; d++) {
      const t = plusTage(start, w * 7 + d);
      if (d === 0 && Number(t.slice(8, 10)) <= 7) monate.push({ w, name: MON3[Number(t.slice(5, 7)) - 1] });
      if (t > S.heute) { zellen.push('<i class="bl-hx"></i>'); continue; }
      const n = s.proTag.get(t)?.length ?? 0;
      zellen.push(`<i class="${n >= 2 ? 'bl-h2' : n ? 'bl-h1' : ''}" title="${kurzDatum(t, S.heute)} · ${n ? eintraegeText(n) : 'nichts'}"></i>`);
    }
  }
  return `<div class="bl-heat-scroll"><div class="bl-heat" style="--wochen:${wochen}">${zellen.join('')}</div>
    <div class="bl-heat-months" style="--wochen:${wochen}">${monate.map((mo) => `<span style="grid-column:${mo.w + 1} / span 3">${mo.name}</span>`).join('')}</div></div>`;
}

function balken(labels, werte, tipText) {
  const max = Math.max(...werte, 1);
  const iMax = werte.indexOf(Math.max(...werte));
  return `<div class="bl-bars" role="img" aria-label="${labels.map((l, i) => `${l} ${werte[i]}`).join(', ')}">${werte.map((n, i) => `<div class="bl-bars__col" title="${tipText(labels[i], n, i)}">
      <div class="bl-bars__bar${i === iMax && n ? ' bl-bars__bar--max' : ''}" style="height:${Math.max(2, (n / max) * 100)}%">${i === iMax && n ? `<span class="bl-bars__val">${n}</span>` : ''}</div></div>`).join('')}</div>
    <div class="bl-bars__labels">${labels.map((l) => `<span>${l}</span>`).join('')}</div>`;
}
